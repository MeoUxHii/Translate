import { escapeHTML, initCustomSelect } from './ui-utils.js';

const { IMAGE_MAP, VOICE_MAP, getRandomVoice } = window;

let mediaState = {
    lastImageTime: 0,
    lastVoiceTime: 0,
    sentImages: [], 
    sentVoices: [] 
};

const COOLDOWN_TIME = 10 * 60 * 1000; 

function loadMediaState() {
    chrome.storage.local.get(['mediaState'], (result) => {
        if (result.mediaState) {
            mediaState = result.mediaState;
        }
    });
}

function saveMediaState() {
    chrome.storage.local.set({ mediaState: mediaState });
}

// --- HELPER: Format giây thành mm:ss ---
function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// --- HÀM TẠO AUDIO BUBBLE (SIÊU BỀN - COUNTDOWN) ---
function createAudioBubble(audioSrc) {
    const bubble = document.createElement("div");
    bubble.className = "audio-msg-bubble";

    // 1. Nút Play/Pause
    const btn = document.createElement("button");
    btn.className = "audio-control-btn";
    const playIcon = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    const pauseIcon = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    btn.innerHTML = playIcon;

    // 2. Container chứa sóng
    const waveContainer = document.createElement("div");
    waveContainer.className = "wave-container";
    
    // Fallback bar
    const fallbackBar = document.createElement("div");
    fallbackBar.className = "fallback-progress-bar";
    const fallbackFill = document.createElement("div");
    fallbackFill.className = "fallback-progress-fill";
    fallbackBar.appendChild(fallbackFill);
    fallbackBar.style.display = "none"; 
    waveContainer.appendChild(fallbackBar);

    // WaveSurfer wrapper
    const uniqueId = 'waveform-' + Math.random().toString(36).substr(2, 9);
    const waveWrapper = document.createElement("div");
    waveWrapper.id = uniqueId;
    waveWrapper.style.width = "100%";
    waveContainer.appendChild(waveWrapper);

    // 3. Thời lượng (Đếm ngược)
    const timeDiv = document.createElement("div");
    timeDiv.className = "audio-duration";
    timeDiv.textContent = "--:--";

    bubble.appendChild(btn);
    bubble.appendChild(waveContainer);
    bubble.appendChild(timeDiv);

    // --- LOGIC KHỞI TẠO ---
    setTimeout(() => {
        // KIỂM TRA THƯ VIỆN
        if (typeof WaveSurfer === 'undefined') {
            console.warn("WaveSurfer not found, using fallback audio.");
            waveWrapper.style.display = "none";
            fallbackBar.style.display = "block";
            
            const audio = new Audio(audioSrc);
            
            audio.onloadedmetadata = () => {
                timeDiv.textContent = formatTime(audio.duration);
            };

            audio.ontimeupdate = () => {
                const percent = (audio.currentTime / audio.duration) * 100;
                fallbackFill.style.width = `${percent}%`;
                const remaining = Math.max(0, audio.duration - audio.currentTime);
                timeDiv.textContent = formatTime(remaining);
            };

            audio.onended = () => {
                btn.innerHTML = playIcon;
                btn.classList.remove('playing');
                fallbackFill.style.width = "0%";
                timeDiv.textContent = formatTime(audio.duration);
            };

            btn.onclick = (e) => {
                e.stopPropagation();
                if (audio.paused) {
                    document.querySelectorAll('audio').forEach(a => { if(a !== audio) a.pause(); });
                    audio.play();
                    btn.innerHTML = pauseIcon;
                    btn.classList.add('playing');
                } else {
                    audio.pause();
                    btn.innerHTML = playIcon;
                    btn.classList.remove('playing');
                }
            };
            
            waveContainer.onclick = (e) => {
                e.stopPropagation();
                const rect = waveContainer.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                if (Number.isFinite(audio.duration)) {
                    audio.currentTime = percent * audio.duration;
                    if(audio.paused) { audio.play(); btn.innerHTML = pauseIcon; btn.classList.add('playing'); }
                }
            };
            return; 
        }

        // --- WAVESURFER LOGIC ---
        try {
            const wavesurfer = WaveSurfer.create({
                container: `#${uniqueId}`,
                waveColor: '#d1d5db',      
                progressColor: '#000000',  
                cursorColor: '#9ca3af',    
                barWidth: 3,
                barRadius: 3,
                cursorWidth: 2,            
                height: 32,                
                barGap: 2,
                url: audioSrc,
                normalize: true,
            });

            wavesurfer.on('ready', () => {
                const duration = wavesurfer.getDuration();
                timeDiv.textContent = formatTime(duration);
            });

            wavesurfer.on('audioprocess', (currentTime) => {
                const duration = wavesurfer.getDuration();
                const remaining = Math.max(0, duration - currentTime);
                timeDiv.textContent = formatTime(remaining);
            });

            wavesurfer.on('interaction', () => {
                 const currentTime = wavesurfer.getCurrentTime();
                 const duration = wavesurfer.getDuration();
                 timeDiv.textContent = formatTime(duration - currentTime);
                 if(!wavesurfer.isPlaying()) {
                     wavesurfer.play();
                     btn.innerHTML = pauseIcon;
                     btn.classList.add('playing');
                 }
            });

            wavesurfer.on('finish', () => {
                btn.innerHTML = playIcon;
                btn.classList.remove('playing');
                wavesurfer.stop();
                const duration = wavesurfer.getDuration();
                timeDiv.textContent = formatTime(duration); 
            });

            btn.onclick = (e) => {
                e.stopPropagation();
                wavesurfer.playPause();
                if (wavesurfer.isPlaying()) {
                    btn.innerHTML = pauseIcon;
                    btn.classList.add('playing');
                } else {
                    btn.innerHTML = playIcon;
                    btn.classList.remove('playing');
                }
            };
        } catch (err) {
            console.error("WaveSurfer init error:", err);
            timeDiv.textContent = "Err";
        }

    }, 100);

    return bubble;
}

function getCurrentTime() {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
}

export function initChat() {
    const chatInput = document.getElementById("chatInput");
    const chatHistory = document.getElementById("chat-history");
    const chatResetBtn = document.getElementById("chatResetBtn");
    const chatSendBtn = document.getElementById("chatSendBtn");
    const attachBtn = document.getElementById("attachBtn"); 
    const previewContainer = document.getElementById("attachmentPreviewContainer");
    const attachmentContent = document.getElementById("attachmentContent");

    const toneTriggerBtn = document.getElementById("toneTriggerBtn");
    const toneMenu = document.getElementById("toneMenu");
    const toneOptions = document.querySelectorAll(".tone-option");
    const currentToneLabel = document.getElementById("currentToneLabel");

    const AVATAR_MAP = {
        "dan_chuyen": "avatar/avatar_dan_chuyen.png",
        "lao_vo_cung": "avatar/avatar_lao_vo_cung.png",
        "be_cung": "avatar/avatar_be_cung.png",
        "mot_con_meo": "avatar/avatar_mot_con_meo.png"
    };
    const CACHED_AVATARS = {}; 

    loadMediaState(); 

    const processAvatar = async (src) => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = "Anonymous"; 
            img.src = src;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const size = 128; 
                canvas.width = size;
                canvas.height = size;
                const minDim = Math.min(img.width, img.height);
                const sx = (img.width - minDim) / 2;
                const sy = (img.height - minDim) / 2;
                ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
                resolve(canvas.toDataURL('image/png'));
            };
            img.onerror = (e) => { resolve(src); };
        });
    };

    const optimizeAvatars = async () => {
        for (const [tone, src] of Object.entries(AVATAR_MAP)) {
            try {
                const optimizedDataUrl = await processAvatar(src);
                CACHED_AVATARS[tone] = optimizedDataUrl;
                const existingImgs = document.querySelectorAll(`.chat-avatar[data-tone="${tone}"]`);
                existingImgs.forEach(img => img.src = optimizedDataUrl);
            } catch (e) { console.error(e); }
        }
    };
    optimizeAvatars();

    function showAvatarModal(src, isChatImage = false) {
        let modal = document.getElementById('avatar-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'avatar-modal';
            modal.innerHTML = '<span class="close-modal">&times;</span><img class="modal-content" id="img-full-view">';
            document.body.appendChild(modal);
            modal.querySelector('.close-modal').onclick = () => modal.style.display = "none";
            modal.onclick = (e) => { if(e.target !== modal.querySelector('#img-full-view')) modal.style.display = "none"; }
        }
        
        let fullResSrc;
        if (isChatImage) {
            fullResSrc = src; 
        } else {
            fullResSrc = AVATAR_MAP[currentTone] || src; 
        }
        
        document.getElementById("img-full-view").src = fullResSrc;
        modal.style.display = "flex";
    }

    let allChatData = { "dan_chuyen": [], "lao_vo_cung": [], "be_cung": [], "mot_con_meo": [] };
    let currentTone = "dan_chuyen"; 
    let currentAttachment = null; 
    let currentWeatherContext = "";

    const GREETINGS = {
        "dan_chuyen": "Chào bạn! Tôi là trợ lý AI chuyên nghiệp. Tôi có thể giúp gì cho bạn hôm nay?",
        "lao_vo_cung": "Nhìn cái gì? Có việc gì thì nói nhanh, bố mày đang bận. 😒",
        "be_cung": "Anh yêu ơi! 😍 Em nhớ anh quá à. Nay anh có chuyện gì vui kể em nghe đi :3",
        "mot_con_meo": "Sen kia! 😾 Khui pate chưa mà dám gọi trẫm? Có việc gì tâu mau!"
    };

    function parseMessageContent(rawText, isHistory = false) {
        let displayText = rawText || "";
        const mediaItems = [];

        // SỬA: Regex cho phép cả chữ cái và dấu gạch dưới (ví dụ: o_nha_1)
        const imgRegex = /{{IMG:([a-zA-Z0-9_]+)}}/g;
        let imgMatch;
        while ((imgMatch = imgRegex.exec(rawText)) !== null) {
            const imgId = imgMatch[1];
            const now = new Date().getTime();
            
            if (isHistory || now - mediaState.lastImageTime > COOLDOWN_TIME || !mediaState.sentImages.includes(imgId)) {
                 if (IMAGE_MAP && IMAGE_MAP[imgId]) {
                    mediaItems.push({ type: 'image', src: IMAGE_MAP[imgId], id: imgId });
                    
                    if (!isHistory) {
                        mediaState.lastImageTime = now;
                        if(!mediaState.sentImages.includes(imgId)) mediaState.sentImages.push(imgId);
                        saveMediaState();
                    }
                }
            }
            displayText = displayText.replace(imgMatch[0], "");
        }

        const voiceTopicRegex = /{{VOICE:([a-zA-Z0-9_]+)}}/g;
        let voiceTopicMatch;
        while ((voiceTopicMatch = voiceTopicRegex.exec(rawText)) !== null) {
            const topic = voiceTopicMatch[1];
            const now = new Date().getTime();
            
            // SỬA LỖI: Thêm điều kiện OR isHistory vào đây để khi load lại lịch sử vẫn hiện voice
            if (isHistory || (now - mediaState.lastVoiceTime > COOLDOWN_TIME)) {
                if (VOICE_MAP && VOICE_MAP[topic]) {
                    const files = VOICE_MAP[topic];
                    const availableFiles = files.filter(f => !mediaState.sentVoices.includes(f));
                    const candidates = availableFiles.length > 0 ? availableFiles : files;
                    const selectedFile = candidates[Math.floor(Math.random() * candidates.length)];
                    
                    mediaItems.push({ type: 'voice', src: selectedFile });
                    
                    // CHỈ CẬP NHẬT STATE KHI KHÔNG PHẢI LÀ LOAD LỊCH SỬ
                    if (!isHistory) {
                        mediaState.lastVoiceTime = now;
                        if(!mediaState.sentVoices.includes(selectedFile)) mediaState.sentVoices.push(selectedFile);
                        saveMediaState();
                    }
                }
            }
            displayText = displayText.replace(voiceTopicMatch[0], "");
        }

        const voiceFileRegex = /{{VOICE_FILE:([^}]+)}}/g;
        let voiceFileMatch;
        while ((voiceFileMatch = voiceFileRegex.exec(rawText)) !== null) {
            mediaItems.push({ type: 'voice', src: voiceFileMatch[1] });
            displayText = displayText.replace(voiceFileMatch[0], "");
        }

        return { displayText: displayText.trim(), mediaItems };
    }

    // --- HELPER TẠO ROW & WRAPPER ---
    function createChatRowWithWrapper(roleClass) {
        const row = document.createElement("div");
        row.className = `chat-row ${roleClass}`;
        
        // Chỉ tạo Avatar cho Bot
        if (roleClass === 'bot') {
            const wrapper = document.createElement("div");
            wrapper.className = "chat-avatar-wrapper";
            wrapper.innerHTML = `
                <svg class="avatar-ring" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="url(#avatarGradient)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <defs><linearGradient id="avatarGradient" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#00C6FF" /><stop offset="100%" stop-color="#0072FF" /></linearGradient></defs>
                    <circle cx="12" cy="12" r="10"/>
                </svg>
            `;
            const avatar = document.createElement("img");
            avatar.className = "chat-avatar";
            const originalSrc = AVATAR_MAP[currentTone] || "icon48.png";
            avatar.src = CACHED_AVATARS[currentTone] || originalSrc;
            avatar.dataset.tone = currentTone;
            avatar.onclick = (e) => { e.stopPropagation(); showAvatarModal(avatar.src, false); };
            wrapper.appendChild(avatar);
            row.appendChild(wrapper);
        }

        const contentWrapper = document.createElement("div");
        contentWrapper.className = "chat-content-wrapper";
        row.appendChild(contentWrapper);

        return { row, contentWrapper };
    }

    function appendTimestamp(element, timestamp) {
        if (!timestamp || !element) return;
        const timeSpan = document.createElement("div");
        timeSpan.className = "msg-time";
        timeSpan.textContent = timestamp;
        element.appendChild(timeSpan);
    }

    function renderMessageRow(roleClass, textContent, timestamp = null, isHistory = false) {
        const { displayText, mediaItems } = parseMessageContent(textContent, isHistory);
        const hasVoice = mediaItems.some(m => m.type === 'voice');
        // Voice bubble đã có time countdown, nên nếu chỉ có voice thì text rỗng là ok.
        
        if (!displayText && mediaItems.length === 0) return;

        const { row, contentWrapper } = createChatRowWithWrapper(roleClass);
        let lastElement = null;

        // 1. Render Text Bubble
        if (displayText) {
            const msgDiv = document.createElement("div");
            msgDiv.className = `chat-msg ${roleClass}`;
            const textSpan = document.createElement("div");
            textSpan.textContent = displayText;
            msgDiv.appendChild(textSpan);
            contentWrapper.appendChild(msgDiv);
            lastElement = msgDiv;
        }

        // 2. Render Media Bubbles (Ảnh/Voice)
        if (mediaItems.length > 0) {
            mediaItems.forEach(item => {
                const msgDiv = document.createElement("div");
                msgDiv.className = `chat-msg ${roleClass} media-msg`;
                
                if (item.type === 'image') {
                    const img = document.createElement("img");
                    img.src = chrome.runtime.getURL(item.src);
                    img.className = "chat-img-content";
                    img.onclick = () => showAvatarModal(img.src, true);
                    msgDiv.appendChild(img);
                } else if (item.type === 'voice') {
                    const fullPath = chrome.runtime.getURL(item.src);
                    const audioBubble = createAudioBubble(fullPath); 
                    msgDiv.appendChild(audioBubble);
                }
                contentWrapper.appendChild(msgDiv);
                lastElement = msgDiv;
            });
        }

        // Attach timestamp to the LAST bubble in the group
        if (lastElement) {
            appendTimestamp(lastElement, timestamp);
        }

        chatHistory.appendChild(row);
        scrollToBottom();
    }

    function renderChatHistory(messages) {
        if (!chatHistory) return;
        messages.forEach(msg => {
            const roleClass = msg.role === "user" ? "user" : "bot";
            let contentText = "";
            if (msg.parts && Array.isArray(msg.parts)) {
                const textPart = msg.parts.find(p => p.text);
                if (textPart) {
                    let rawText = textPart.text;
                    rawText = rawText.split('\n\n[Hệ thống (Ẩn):')[0]; 
                    contentText = rawText;
                }
            }
            const time = msg.timestamp || null;
            if (roleClass === 'user') {
                let text = contentText;
                let imgSrc = null; let fileInfo = null;
                if (msg.parts) {
                     const imgPart = msg.parts.find(p => p.inline_data);
                     if (imgPart) imgSrc = `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}`;
                }
                displayMessage(roleClass, text, imgSrc, fileInfo, false, time);
            } else {
                renderMessageRow(roleClass, contentText, time, true);
            }
        });
        scrollToBottom();
    }

    // Hàm này dùng cho thông báo lỗi, typing indicator, system msg đơn giản
    function renderBubble(roleClass, text, timestamp = null) { 
        const { row, contentWrapper } = createChatRowWithWrapper(roleClass === 'error' ? 'bot' : roleClass); // Error coi như bot nói
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${roleClass}`;
        
        // Xử lý typing indicator (HTML)
        if (text.includes('<svg')) {
             msgDiv.innerHTML = text;
        } else {
             const textSpan = document.createElement("div");
             textSpan.textContent = text;
             msgDiv.appendChild(textSpan);
        }

        if (timestamp) appendTimestamp(msgDiv, timestamp);
        contentWrapper.appendChild(msgDiv);
        chatHistory.appendChild(row);
    }

    function displayMessage(roleClass, text, imgSrc, fileInfo, scroll = true, timestamp = null) {
        const { row, contentWrapper } = createChatRowWithWrapper(roleClass);
        let lastElement = null;

        if (text) {
            const msgDiv = document.createElement("div");
            msgDiv.className = `chat-msg ${roleClass}`;
            const t = document.createElement("div"); 
            t.textContent = text; 
            msgDiv.appendChild(t);
            contentWrapper.appendChild(msgDiv);
            lastElement = msgDiv;
        }

        if (imgSrc) {
            const msgDiv = document.createElement("div");
            msgDiv.className = `chat-msg ${roleClass} media-msg`;
            const i = document.createElement("img"); 
            i.src = imgSrc; 
            i.className = "chat-img-content"; 
            msgDiv.appendChild(i);
            contentWrapper.appendChild(msgDiv);
            lastElement = msgDiv;
        }

        if (fileInfo) {
            const msgDiv = document.createElement("div");
            msgDiv.className = `chat-msg ${roleClass}`;
            const f = document.createElement("div"); 
            f.className = "chat-file-chip"; 
            f.innerHTML = `<span>${escapeHTML(fileInfo.name)}</span>`; 
            msgDiv.appendChild(f);
            contentWrapper.appendChild(msgDiv);
            lastElement = msgDiv;
        }

        if (lastElement) {
            appendTimestamp(lastElement, timestamp);
        }

        chatHistory.appendChild(row);
        if(scroll) scrollToBottom();
    }

    function scrollToBottom() { requestAnimationFrame(() => { if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight; }); }
    window.chatScrollToBottom = scrollToBottom; 
    
    function showTypingIndicator() {
        if (chatHistory.querySelector(".typing-indicator-row")) return;
        // Dùng renderBubble để tận dụng wrapper
        renderBubble("bot", `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-ellipsis-icon lucide-ellipsis"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`);
        const lastRow = chatHistory.lastElementChild;
        if (lastRow) lastRow.classList.add("typing-indicator-row");
        scrollToBottom();
    }
    
    function removeTypingIndicator() { const indicator = chatHistory.querySelector(".typing-indicator-row"); if (indicator) indicator.remove(); }

    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text && !currentAttachment) return;

        const parts = [];
        let uiText = text;
        let uiImg = null;
        let uiFile = null;

        if (text) parts.push({ text: text });
        if (currentAttachment) {
            if (currentAttachment.type === 'image') {
                parts.push({ inline_data: { mime_type: currentAttachment.mime, data: currentAttachment.data } });
                uiImg = `data:${currentAttachment.mime};base64,${currentAttachment.data}`;
                if (!text) parts.push({ text: "Phân tích hình ảnh này." });
            } else if (currentAttachment.type === 'file') {
                const fileContext = `\n\n--- File Attached: ${currentAttachment.name} ---\n${currentAttachment.data}\n------------------\n`;
                if (parts.length > 0 && parts[0].text) parts[0].text += fileContext; else parts.push({ text: fileContext });
                uiFile = { name: currentAttachment.name };
            }
        }

        let systemContext = "";
        
        const timestamp = getCurrentTime();

        displayMessage("user", uiText, uiImg, uiFile, true, timestamp);
        chatInput.value = ""; chatInput.style.height = '18px';
        currentAttachment = null; renderAttachmentPreview();
        showTypingIndicator();

        const userMsgObj = { role: "user", parts: parts, timestamp: timestamp }; 
        
        if (!allChatData[currentTone]) allChatData[currentTone] = [];
        allChatData[currentTone].push(userMsgObj);
        if (allChatData[currentTone].length > 50) allChatData[currentTone] = allChatData[currentTone].slice(-50);
        chrome.storage.local.set({ chatData: allChatData });

        const nowTime = new Date().getTime();
        const recentHistory = allChatData[currentTone].slice(-20);
        
        const hasImageInHistory = recentHistory.some(msg => 
            msg.role === 'model' && 
            msg.parts && 
            msg.parts[0].text && 
            (msg.parts[0].text.includes('{{IMG:') || msg.parts[0].text.includes('{{IMG_FILE:'))
        );

        let imageSystemNote = "";
        
        if (hasImageInHistory) {
            const timeDiff = nowTime - mediaState.lastImageTime;
            if (timeDiff < COOLDOWN_TIME) {
                imageSystemNote = `\n\n[System: Bạn đã gửi ảnh cách đây ${Math.floor(timeDiff/60000)} phút. Vẫn chưa đủ 10 phút cooldown. TUYỆT ĐỐI KHÔNG ĐƯỢC gửi thêm ảnh lúc này.]`;
            } else {
                imageSystemNote = `\n\n[System: Đã hết cooldown ảnh. Nếu user yêu cầu, bạn có thể gửi ảnh.]`;
            }
        } else {
            imageSystemNote = `\n\n[System: Nếu user yêu cầu xem ảnh, bạn CÓ THỂ gửi ảnh.]`;
        }

        const historyForApi = JSON.parse(JSON.stringify(allChatData[currentTone]));
        const historyClean = historyForApi.map(msg => ({role: msg.role, parts: msg.parts}));

        const lastMsg = historyClean[historyClean.length - 1];
        const now = new Date();
        const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const dateString = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        systemContext += `\n\n[Hệ thống (Ẩn): Hiện tại là ${timeString}, ${dateString}${currentWeatherContext}.]`;
        systemContext += imageSystemNote; 

        if (lastMsg.parts && lastMsg.parts.length > 0) {
            if (lastMsg.parts[0].text) lastMsg.parts[0].text += systemContext;
            else lastMsg.parts.push({ text: systemContext });
        } else { lastMsg.parts = [{ text: systemContext }]; }

        chrome.runtime.sendMessage({ action: "chat", history: historyClean, tone: currentTone });
    }

    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.tone !== currentTone) return;

        if (request.action === "chat_incoming_message") {
            removeTypingIndicator();
            
            let messageToSave = request.message; 
            const timestamp = getCurrentTime();
            messageToSave.timestamp = timestamp;

            renderMessageRow("bot", messageToSave.parts[0].text, timestamp);
            
            if (!allChatData[currentTone]) allChatData[currentTone] = [];
            allChatData[currentTone].push(messageToSave);
            if (allChatData[currentTone].length > 50) allChatData[currentTone] = allChatData[currentTone].slice(-50);
            chrome.storage.local.set({ chatData: allChatData });
        }

        if (request.action === "chat_typing") {
            if (request.isTyping) showTypingIndicator(); else removeTypingIndicator();
        }
        if (request.action === "chat_error") {
            removeTypingIndicator(); renderBubble("error", "❌ Lỗi: " + request.error); scrollToBottom();
        }
    });

    async function fetchWeatherContext() {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(async (position) => {
            try {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code,is_day&timezone=auto`);
                const data = await response.json();
                if (data.current) {
                    const temp = data.current.temperature_2m;
                    const isDay = data.current.is_day ? "Ban ngày" : "Ban đêm";
                    const code = data.current.weather_code;
                    let weatherDesc = "Bình thường";
                    if (code === 0) weatherDesc = "Trời quang đãng";
                    else if (code >= 1 && code <= 3) weatherDesc = "Có mây";
                    else if (code >= 45 && code <= 48) weatherDesc = "Có sương mù";
                    else if (code >= 51 && code <= 67) weatherDesc = "Mưa nhỏ/Mưa phùn";
                    else if (code >= 80 && code <= 82) weatherDesc = "Mưa rào";
                    else if (code >= 95) weatherDesc = "Giông bão";
                    currentWeatherContext = `, Thời tiết: ${temp}°C (${weatherDesc}), ${isDay}`;
                }
            } catch (e) { console.log("Weather error:", e); }
        }, (err) => console.log("Loc error:", err));
    }
    fetchWeatherContext();

    chrome.storage.sync.get(["chatTone"], (data) => {
        if (data.chatTone) {
            currentTone = data.chatTone;
            updateToneUI(currentTone);
        } else { 
            updateToneUI("dan_chuyen"); 
        }
        loadChatData();
    });

    function loadChatData() {
        chrome.storage.local.get(["chatData", "chatMessages"], (result) => {
            if (result.chatData) { allChatData = { ...allChatData, ...result.chatData }; } 
            else if (result.chatMessages && result.chatMessages.length > 0) {
                allChatData[currentTone] = result.chatMessages;
                chrome.storage.local.set({ chatData: allChatData });
                chrome.storage.local.remove("chatMessages");
            }
            switchChatMode(currentTone);
        });
    }

    function switchChatMode(tone) {
        currentTone = tone;
        if (!allChatData[tone]) allChatData[tone] = [];
        const history = allChatData[tone];
        chatHistory.innerHTML = ''; 
        if (history.length === 0) {
            const greeting = GREETINGS[tone] || GREETINGS["dan_chuyen"];
            const timestamp = getCurrentTime();
            const botMsgObj = { role: "model", parts: [{ text: greeting }], timestamp: timestamp };
            
            renderMessageRow("bot", greeting, timestamp); 
            allChatData[tone].push(botMsgObj);
            chrome.storage.local.set({ chatData: allChatData });
        } else { renderChatHistory(history); }
    }

    function updateToneUI(value) {
        toneOptions.forEach(opt => {
            if (opt.dataset.value === value) {
                opt.classList.add("selected");
                if (currentToneLabel) currentToneLabel.textContent = opt.textContent;
            } else { opt.classList.remove("selected"); }
        });
    }

    if (toneTriggerBtn) {
        toneTriggerBtn.addEventListener("click", (e) => { e.stopPropagation(); toneMenu.classList.toggle("show"); });
    }

    toneOptions.forEach(opt => {
        opt.addEventListener("click", (e) => {
            e.stopPropagation();
            const newTone = opt.dataset.value;
            if (newTone !== currentTone) {
                updateToneUI(newTone);
                toneMenu.classList.remove("show");
                chrome.storage.sync.set({ chatTone: newTone });
                switchChatMode(newTone);
            }
        });
    });

    document.addEventListener("click", (e) => {
        if (toneMenu && toneMenu.classList.contains("show")) {
            if (!toneMenu.contains(e.target) && e.target !== toneTriggerBtn) { toneMenu.classList.remove("show"); }
        }
    });

    if (chatSendBtn) chatSendBtn.addEventListener("click", sendMessage);
    if (chatInput) {
        chatInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = (this.scrollHeight) + 'px'; if (this.value === '') this.style.height = '18px'; });
        chatInput.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } });
        chatInput.addEventListener('paste', (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let i = 0; i < items.length; i++) { if (items[i].type.indexOf("image") === 0) { e.preventDefault(); const blob = items[i].getAsFile(); handleFileSelect(blob); return; } }
        });
    }
    
    if (chatResetBtn) {
        chatResetBtn.addEventListener("click", () => {
            allChatData[currentTone] = [];
            mediaState = { lastImageTime: 0, lastVoiceTime: 0, sentImages: [], sentVoices: [] };
            saveMediaState();
            
            chrome.storage.local.set({ chatData: allChatData });
            chatHistory.innerHTML = '';
            const greeting = GREETINGS[currentTone] || GREETINGS["dan_chuyen"];
            const timestamp = getCurrentTime();
            renderMessageRow("bot", greeting, timestamp);
            
            if (!allChatData[currentTone]) allChatData[currentTone] = [];
            allChatData[currentTone].push({ role: "model", parts: [{ text: greeting }], timestamp: timestamp });
            
            chrome.storage.local.set({ chatData: allChatData });
            currentAttachment = null; renderAttachmentPreview();
        });
    }
    if (attachBtn) {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*, .txt,.js,.html,.css,.json,.py,.java,.cpp,.c,.h,.md"; 
        fileInput.style.display = "none";
        document.body.appendChild(fileInput);
        attachBtn.addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
        fileInput.addEventListener("change", (e) => { handleFileSelect(e.target.files[0]); fileInput.value = ''; });
    }

    function renderAttachmentPreview() {
        attachmentContent.innerHTML = "";
        if (!currentAttachment) { previewContainer.style.display = "none"; return; }
        previewContainer.style.display = "block";
        const removeBtn = document.createElement("button");
        removeBtn.className = "preview-remove-btn";
        removeBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`;
        removeBtn.onclick = () => { currentAttachment = null; renderAttachmentPreview(); };
        if (currentAttachment.type === 'image') {
            const img = document.createElement("img");
            img.src = `data:${currentAttachment.mime};base64,${currentAttachment.data}`;
            img.className = "preview-img-thumb";
            attachmentContent.appendChild(img);
            attachmentContent.appendChild(removeBtn);
        } else if (currentAttachment.type === 'file') {
            const fileCard = document.createElement("div");
            fileCard.className = "preview-file-card";
            fileCard.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg><span class="preview-file-name">${escapeHTML(currentAttachment.name)}</span>`;
            attachmentContent.appendChild(fileCard);
            attachmentContent.appendChild(removeBtn);
        }
        chatInput.focus();
    }

    function handleFileSelect(file) {
        if (!file) return;
        if (file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = (e) => { currentAttachment = { type: 'image', data: e.target.result.split(',')[1], mime: file.type }; renderAttachmentPreview(); };
            reader.readAsDataURL(file);
        } else {
            const reader = new FileReader();
            reader.onload = (event) => { currentAttachment = { type: 'file', data: event.target.result, name: file.name, mime: "text/plain" }; renderAttachmentPreview(); };
            reader.readAsText(file);
        }
    }
}