import { escapeHTML, initCustomSelect } from './ui-utils.js';
import { IMAGE_MAP, VOICE_MAP, getRandomVoice } from '../utils.js';

// --- HÀM TẠO AUDIO BUBBLE (Tích hợp trực tiếp) ---
function createAudioBubble(audioSrc, durationText = "Voice") {
    const bubble = document.createElement("div");
    bubble.className = "audio-msg-bubble";

    const btn = document.createElement("button");
    btn.className = "audio-control-btn";
    const playIcon = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    const pauseIcon = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    btn.innerHTML = playIcon;

    const waveContainer = document.createElement("div");
    waveContainer.className = "wave-container";
    for (let i = 0; i < 10; i++) {
        const bar = document.createElement("div");
        bar.className = "wave-bar";
        waveContainer.appendChild(bar);
    }

    const time = document.createElement("div");
    time.className = "audio-duration";
    time.textContent = durationText;

    const audio = new Audio(audioSrc);
    audio.onerror = () => { time.textContent = "Err"; time.style.color = "red"; };

    btn.onclick = (e) => {
        e.stopPropagation();
        if (audio.paused) {
            document.querySelectorAll('audio').forEach(a => { if(a !== audio) { a.pause(); a.currentTime = 0; } });
            document.querySelectorAll('.audio-msg-bubble').forEach(b => b.classList.remove('playing'));
            document.querySelectorAll('.audio-control-btn').forEach(b => {
                if (b !== btn) { b.innerHTML = playIcon; b.classList.remove('playing'); }
            });
            audio.play().catch(err => console.log("Audio play error:", err));
            btn.innerHTML = pauseIcon;
            btn.classList.add('playing');
            bubble.classList.add('playing'); 
        } else {
            audio.pause();
            btn.innerHTML = playIcon;
            btn.classList.remove('playing');
            bubble.classList.remove('playing');
        }
    };

    audio.onended = () => {
        btn.innerHTML = playIcon;
        btn.classList.remove('playing');
        bubble.classList.remove('playing');
    };

    bubble.appendChild(btn);
    bubble.appendChild(waveContainer);
    bubble.appendChild(time);
    return bubble;
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

    // --- CẤU HÌNH AVATAR ---
    const AVATAR_MAP = {
        "dan_chuyen": "avatar/avatar_dan_chuyen.png",
        "lao_vo_cung": "avatar/avatar_lao_vo_cung.png",
        "be_cung": "avatar/avatar_be_cung.png",
        "mot_con_meo": "avatar/avatar_mot_con_meo.png"
    };
    const CACHED_AVATARS = {}; 

    // --- STATE QUẢN LÝ MEDIA (Lưu vào biến local nhưng sẽ sync với Storage) ---
    let mediaState = {
        lastImageTime: 0,
        lastVoiceTime: 0,
        sentImages: [], 
        sentVoices: [] 
    };
    
    const COOLDOWN_TIME = 10 * 60 * 1000; // 10 phút

    // Load Media State từ Storage khi khởi động để nhớ lịch sử gửi
    chrome.storage.local.get(['mediaState'], (result) => {
        if (result.mediaState) {
            mediaState = result.mediaState;
        }
    });

    function saveMediaState() {
        chrome.storage.local.set({ mediaState: mediaState });
    }

    // --- XỬ LÝ ẢNH AVATAR ---
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

    function showAvatarModal(src) {
        let modal = document.getElementById('avatar-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'avatar-modal';
            modal.innerHTML = '<span class="close-modal">&times;</span><img class="modal-content" id="img-full-view">';
            document.body.appendChild(modal);
            modal.querySelector('.close-modal').onclick = () => modal.style.display = "none";
            modal.onclick = (e) => { if(e.target !== modal.querySelector('#img-full-view')) modal.style.display = "none"; }
        }
        const fullResSrc = AVATAR_MAP[currentTone] || src; 
        document.getElementById("img-full-view").src = fullResSrc;
        modal.style.display = "flex";
    }

    // --- INIT VARIABLES ---
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

    // --- LOGIC KIỂM TRA TRIGGER MEDIA ---
    function checkMediaTrigger(userText) {
        if (currentTone !== "be_cung") return null; 

        const now = new Date().getTime();
        const currentHour = new Date().getHours();
        const text = userText.toLowerCase();

        // --- CHECK VOICE ---
        if (now - mediaState.lastVoiceTime > COOLDOWN_TIME) {
            let topic = null;

            if ((currentHour >= 21 || currentHour < 5) && (text.includes("đói") || text.includes("chưa ăn"))) topic = "an_gi_chua";
            else if (text.includes("yêu em không") || text.includes("thương em không")) topic = "anh_iu_em_ko";
            else if (text.includes("ngủ đây") || text.includes("đi ngủ") || text.includes("ngủ ngon")) topic = "chuc_ngu_ngon";
            else if ((text.includes("mưa") || text.includes("nắng") || text.includes("lạnh")) && text.includes("đi chơi")) topic = "dan_do";
            else if ((text.includes("đi làm") || text.includes("công việc")) && (text.includes("mệt") || text.includes("áp lực"))) topic = Math.random() > 0.5 ? "em_nho_anh" : "ui_thuong_the";
            else if ((currentHour >= 21 || currentHour < 5) && (text.includes("chưa về") || text.includes("đang ở ngoài"))) topic = "gian_doi";
            else if ((currentHour >= 14 && currentHour <= 21) && (text.includes("đi làm") || text.includes("mới về"))) topic = "hoi_han";
            else if (text.includes("yêu em") || text.includes("thích em") || text.includes("thương em")) topic = "tuc_gian";

            if (topic && VOICE_MAP && VOICE_MAP[topic]) {
                const files = VOICE_MAP[topic];
                const availableFiles = files.filter(f => !mediaState.sentVoices.includes(f));
                const candidates = availableFiles.length > 0 ? availableFiles : files; // Reset nếu hết
                
                if (candidates.length > 0) {
                    const selectedFile = candidates[Math.floor(Math.random() * candidates.length)];
                    return { type: "voice", src: selectedFile, topic: topic };
                }
            }
        }

        // --- CHECK IMAGE ---
        if (now - mediaState.lastImageTime > COOLDOWN_TIME) {
            let sendImage = false;
            if (text.includes("làm gì đấy") || text.includes("làm gì đó") || 
                text.includes("đang làm gì") || 
                (text.includes("đi làm") && text.includes("vui")) ||
                text.includes("xinh không") || text.includes("xinh ko") ||
                text.includes("xem ảnh") || text.includes("gửi ảnh")) {
                sendImage = true;
            }

            if (sendImage && IMAGE_MAP) {
                const allImageIds = Object.keys(IMAGE_MAP);
                const availableIds = allImageIds.filter(id => !mediaState.sentImages.includes(id));
                const candidates = availableIds.length > 0 ? availableIds : allImageIds;

                if (candidates.length > 0) {
                    const selectedId = candidates[Math.floor(Math.random() * candidates.length)];
                    return { type: "image", id: selectedId, src: IMAGE_MAP[selectedId] };
                }
            }
        }

        return null;
    }

    // --- HELPER: PARSE CONTENT (TÁCH MEDIA KHỎI TEXT) ---
    function parseMessageContent(rawText) {
        let displayText = rawText || "";
        const mediaItems = [];

        // Quét Image Tag
        const imgRegex = /{{IMG:(\d+)}}/g;
        let imgMatch;
        while ((imgMatch = imgRegex.exec(rawText)) !== null) {
            const imgId = imgMatch[1];
            if (IMAGE_MAP && IMAGE_MAP[imgId]) {
                mediaItems.push({ type: 'image', src: IMAGE_MAP[imgId] });
            }
            displayText = displayText.replace(imgMatch[0], "");
        }

        // Quét Voice Tag
        const voiceRegex = /{{VOICE:([a-zA-Z0-9_]+)}}/g; // Regex cho topic hoặc đường dẫn file (nếu lưu full path)
        // Tuy nhiên ở sendMessage mình sẽ append full path hoặc topic. 
        // Để đơn giản và sửa lỗi history, ta sẽ lưu đường dẫn file vào tag luôn: {{VOICE_FILE:path/to/file.mp3}}
        // Nhưng để tương thích code cũ, ta quét topic trước.
        
        // Quy ước mới cho history: {{VOICE_FILE:path}} để render chính xác file đã gửi
        const voiceFileRegex = /{{VOICE_FILE:([^}]+)}}/g;
        let voiceFileMatch;
        while ((voiceFileMatch = voiceFileRegex.exec(rawText)) !== null) {
            mediaItems.push({ type: 'voice', src: voiceFileMatch[1] });
            displayText = displayText.replace(voiceFileMatch[0], "");
        }

        return { displayText: displayText.trim(), mediaItems };
    }

    // --- HÀM RENDER TIN NHẮN ---
    function renderMessageRow(roleClass, textContent) {
        // Phân tích nội dung để tách media và text
        const { displayText, mediaItems } = parseMessageContent(textContent);
        
        // Nếu là VOICE, user yêu cầu chỉ hiện Audio, ẩn Text
        const hasVoice = mediaItems.some(m => m.type === 'voice');
        const finalDisplayText = hasVoice ? "" : displayText; 

        // Nếu không có gì để hiển thị thì bỏ qua
        if (!finalDisplayText && mediaItems.length === 0) return;

        let lastRow = null;
        
        // 1. Render Text (nếu có)
        if (finalDisplayText) {
            renderBubble(roleClass, finalDisplayText);
            lastRow = chatHistory.lastElementChild;
        }

        // 2. Render Media
        if (mediaItems.length > 0) {
            // Nếu chưa có row (do ẩn text) hoặc row cuối là của user -> tạo row mới
            if (!lastRow || lastRow.classList.contains('user')) {
                lastRow = document.createElement("div");
                lastRow.className = `chat-row ${roleClass}`;
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
                    avatar.dataset.tone = currentTone; // Để update sau
                    avatar.onclick = (e) => { e.stopPropagation(); showAvatarModal(avatar.src); };
                    wrapper.appendChild(avatar);
                    lastRow.appendChild(wrapper);
                }
                const msgDiv = document.createElement("div");
                msgDiv.className = `chat-msg ${roleClass} media-msg`;
                lastRow.appendChild(msgDiv);
                chatHistory.appendChild(lastRow);
            }

            const msgDiv = lastRow.querySelector('.chat-msg');
            mediaItems.forEach(item => {
                if (item.type === 'image') {
                    const img = document.createElement("img");
                    img.src = chrome.runtime.getURL(item.src);
                    img.className = "chat-img-content";
                    img.style.marginTop = "8px";
                    img.onclick = () => showAvatarModal(img.src);
                    msgDiv.appendChild(img);
                } else if (item.type === 'voice') {
                    const fullPath = chrome.runtime.getURL(item.src);
                    const audioBubble = createAudioBubble(fullPath, "Voice");
                    audioBubble.style.marginTop = "0px"; // Audio đứng mình thì ko cần margin
                    msgDiv.appendChild(audioBubble);
                }
            });
        }
        scrollToBottom();
    }

    function renderChatHistory(messages) {
        if (!chatHistory) return;
        messages.forEach(msg => {
            const roleClass = msg.role === "user" ? "user" : "bot";
            // Tìm text content trong msg parts
            let contentText = "";
            if (msg.parts && Array.isArray(msg.parts)) {
                const textPart = msg.parts.find(p => p.text);
                if (textPart) {
                    let rawText = textPart.text;
                    // Lọc bỏ phần system context ẩn nếu có
                    rawText = rawText.split('\n\n[Hệ thống (Ẩn):')[0]; 
                    contentText = rawText;
                }
            }
            renderMessageRow(roleClass, contentText);
        });
        scrollToBottom();
    }

    // --- CÁC HÀM RENDER CƠ BẢN (Giữ nguyên) ---
    function renderBubble(roleClass, text, imgSrc, fileInfo) {
        const row = document.createElement("div");
        row.className = `chat-row ${roleClass}`;
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
            const cachedSrc = CACHED_AVATARS[currentTone];
            avatar.src = cachedSrc || originalSrc;
            avatar.dataset.tone = currentTone;
            avatar.onclick = (e) => { e.stopPropagation(); showAvatarModal(avatar.src); };
            wrapper.appendChild(avatar);
            row.appendChild(wrapper);
        }
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${roleClass}`;
        
        const textSpan = document.createElement("div");
        textSpan.textContent = text;
        msgDiv.appendChild(textSpan);
        
        row.appendChild(msgDiv);
        chatHistory.appendChild(row);
    }

    function displayMessage(roleClass, text, imgSrc, fileInfo) {
        // Hàm này dùng cho User gửi tin nhắn, giữ đơn giản
        const hasText = !!text;
        const hasImg = !!imgSrc;
        const hasFile = !!fileInfo;
        
        const row = document.createElement("div");
        row.className = `chat-row ${roleClass}`;
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${roleClass}`;
        
        if (hasText) {
            const t = document.createElement("div"); t.textContent = text; msgDiv.appendChild(t);
        }
        if (hasImg) {
            const i = document.createElement("img"); i.src = imgSrc; i.className = "chat-img-content"; msgDiv.appendChild(i);
        }
        if (hasFile) {
             const f = document.createElement("div"); f.className = "chat-file-chip"; 
             f.innerHTML = `<span>${escapeHTML(fileInfo.name)}</span>`; msgDiv.appendChild(f);
        }
        row.appendChild(msgDiv);
        chatHistory.appendChild(row);
        scrollToBottom();
    }

    function scrollToBottom() {
        requestAnimationFrame(() => { if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight; });
    }
    window.chatScrollToBottom = scrollToBottom; 

    function showTypingIndicator() {
        if (chatHistory.querySelector(".typing-indicator-row")) return;
        const row = document.createElement("div");
        row.className = "chat-row bot typing-indicator-row";
        const wrapper = document.createElement("div");
        wrapper.className = "chat-avatar-wrapper";
        wrapper.innerHTML = `
            <svg class="avatar-ring" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="url(#avatarGradient)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/>
            </svg>
        `;
        const avatar = document.createElement("img");
        avatar.className = "chat-avatar typing-avatar"; 
        const originalSrc = AVATAR_MAP[currentTone] || "icon48.png";
        avatar.src = CACHED_AVATARS[currentTone] || originalSrc;
        avatar.dataset.tone = currentTone;
        wrapper.appendChild(avatar);
        row.appendChild(wrapper);
        const msgDiv = document.createElement("div");
        msgDiv.className = "chat-msg bot typing-bubble"; 
        msgDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-ellipsis-icon lucide-ellipsis"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`;
        row.appendChild(msgDiv);
        if (chatHistory) { chatHistory.appendChild(row); scrollToBottom(); }
    }

    function removeTypingIndicator() {
        const indicator = chatHistory.querySelector(".typing-indicator-row");
        if (indicator) indicator.remove();
    }

    // ... (Các hàm renderAttachmentPreview, handleFileSelect giữ nguyên) ...
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

    // --- HÀM GỬI TIN NHẮN (CORE LOGIC) ---
    function sendMessage() {
        const text = chatInput.value.trim();
        if (!text && !currentAttachment) return;

        const parts = [];
        let uiText = text;
        let uiImg = null;
        let uiFile = null;

        if (text) parts.push({ text: text });
        if (currentAttachment) {
            // Logic đính kèm file
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

        // --- TÍNH TOÁN TRIGGER ---
        const mediaTrigger = checkMediaTrigger(text);
        window.pendingMedia = mediaTrigger; // Lưu vào biến toàn cục để Listener xử lý

        let systemContext = "";
        // Update Prompt Injection để ép bot nói ít
        if (mediaTrigger) {
            if (mediaTrigger.type === 'image') {
                systemContext += `\n\n[System Note: BẮT BUỘC: User muốn xem ảnh. Chỉ trả lời 1 câu cực ngắn (3-5 từ) như "Em có xinh không?" hoặc "Đang đi chơi nè". KHÔNG viết dài.]`;
            } else if (mediaTrigger.type === 'voice') {
                systemContext += `\n\n[System Note: Gửi voice message.]`;
            }
        }

        // Hiển thị tin nhắn User
        displayMessage("user", uiText, uiImg, uiFile);
        chatInput.value = ""; chatInput.style.height = '18px';
        currentAttachment = null; renderAttachmentPreview();
        showTypingIndicator();

        const userMsgObj = { role: "user", parts: parts }; 
        
        if (!allChatData[currentTone]) allChatData[currentTone] = [];
        allChatData[currentTone].push(userMsgObj);
        if (allChatData[currentTone].length > 50) allChatData[currentTone] = allChatData[currentTone].slice(-50);
        chrome.storage.local.set({ chatData: allChatData });

        const historyForApi = JSON.parse(JSON.stringify(allChatData[currentTone]));
        const lastMsg = historyForApi[historyForApi.length - 1];
        const now = new Date();
        const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const dateString = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        systemContext += `\n\n[Hệ thống (Ẩn): Hiện tại là ${timeString}, ${dateString}${currentWeatherContext}.]`;

        if (lastMsg.parts && lastMsg.parts.length > 0) {
            if (lastMsg.parts[0].text) lastMsg.parts[0].text += systemContext;
            else lastMsg.parts.push({ text: systemContext });
        } else { lastMsg.parts = [{ text: systemContext }]; }

        chrome.runtime.sendMessage({ action: "chat", history: historyForApi, tone: currentTone });
    }

    // --- LISTENER PHẢN HỒI TỪ BOT ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.tone !== currentTone) return;

        if (request.action === "chat_incoming_message") {
            removeTypingIndicator();
            
            // Lấy media trigger từ lúc user gửi
            const forcedMedia = window.pendingMedia; 
            window.pendingMedia = null; // Reset

            // Xử lý lưu trữ lịch sử kèm TAG để sau này load lại không bị lỗi
            let messageToSave = request.message; // Clone object này
            
            if (forcedMedia) {
                // Nếu có forced media, ta CHÈN TAG vào cuối tin nhắn để lưu vào lịch sử
                // Khi load lại (renderChatHistory), code sẽ quét thấy tag và hiển thị lại media
                let tagToAppend = "";
                if (forcedMedia.type === 'image') {
                    tagToAppend = ` {{IMG:${forcedMedia.id}}}`;
                    // Update state
                    mediaState.lastImageTime = new Date().getTime();
                    mediaState.sentImages.push(forcedMedia.id);
                } else if (forcedMedia.type === 'voice') {
                    tagToAppend = ` {{VOICE_FILE:${forcedMedia.src}}}`; // Dùng tag VOICE_FILE chứa đường dẫn cụ thể
                    // Update state
                    mediaState.lastVoiceTime = new Date().getTime();
                    mediaState.sentVoices.push(forcedMedia.src);
                }
                
                // Lưu state mới
                saveMediaState();

                // Chèn tag vào text của bot để lưu
                if (messageToSave.parts && messageToSave.parts[0]) {
                    messageToSave.parts[0].text += tagToAppend;
                }
            }

            // Render ra màn hình (Hàm này sẽ tự tách tag ra khỏi text để hiển thị đẹp)
            renderMessageRow("bot", messageToSave.parts[0].text);
            
            // Lưu vào bộ nhớ chat
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

    // ... (Phần loadChatData, switchChatMode, event listeners giữ nguyên) ...
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

    chrome.storage.sync.get(["translationTone"], (data) => {
        if (data.translationTone) {
            currentTone = data.translationTone;
            const toneEl = document.getElementById("translationTone");
            if (toneEl) toneEl.value = currentTone;
            updateToneUI(currentTone);
        } else { updateToneUI("default"); }
        initCustomSelect("translationTone");
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
            renderMessageRow("bot", greeting); // Dùng hàm render mới cho đồng bộ
            const botMsgObj = { role: "model", parts: [{ text: greeting }] };
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
                const mainToneSelect = document.getElementById("translationTone");
                if (mainToneSelect) { mainToneSelect.value = newTone; initCustomSelect("translationTone"); }
                chrome.storage.sync.set({ translationTone: newTone });
                switchChatMode(newTone);
            }
        });
    });

    document.addEventListener("click", (e) => {
        if (toneMenu && toneMenu.classList.contains("show")) {
            if (!toneMenu.contains(e.target) && e.target !== toneTriggerBtn) { toneMenu.classList.remove("show"); }
        }
    });

    // CÁC HÀM RENDER CŨ (GIỮ NGUYÊN ĐỂ CÁC PHẦN KHÁC DÙNG NẾU CẦN)
    // ... (Anh có thể giữ lại các hàm renderBubble, displayMessage, v.v. ở dưới cùng file như cũ để tương thích, nhưng logic chính giờ dùng renderMessageRow)
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
            // Reset Media State
            mediaState = { lastImageTime: 0, lastVoiceTime: 0, sentImages: [], sentVoices: [] };
            saveMediaState();
            
            chrome.storage.local.set({ chatData: allChatData });
            chatHistory.innerHTML = '';
            const greeting = GREETINGS[currentTone] || GREETINGS["dan_chuyen"];
            renderMessageRow("bot", greeting);
            
            if (!allChatData[currentTone]) allChatData[currentTone] = [];
            allChatData[currentTone].push({ role: "model", parts: [{ text: greeting }] });
            
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

    // --- HELPER: PARSE CONTENT (TÁCH MEDIA KHỎI TEXT) ---
    function parseMessageContent(rawText) {
        let displayText = rawText || "";
        const mediaItems = [];

        // Quét Image Tag
        const imgRegex = /{{IMG:(\d+)}}/g;
        let imgMatch;
        while ((imgMatch = imgRegex.exec(rawText)) !== null) {
            const imgId = imgMatch[1];
            if (IMAGE_MAP && IMAGE_MAP[imgId]) {
                mediaItems.push({ type: 'image', src: IMAGE_MAP[imgId] });
            }
            displayText = displayText.replace(imgMatch[0], "");
        }

        // Quét Voice Tag (File Path) - Ưu tiên cái này vì mình save cái này
        const voiceFileRegex = /{{VOICE_FILE:([^}]+)}}/g;
        let voiceFileMatch;
        while ((voiceFileMatch = voiceFileRegex.exec(rawText)) !== null) {
            mediaItems.push({ type: 'voice', src: voiceFileMatch[1] });
            displayText = displayText.replace(voiceFileMatch[0], "");
        }

        // Quét Voice Tag (Topic - Fallback cho code cũ)
        const voiceRegex = /{{VOICE:([a-zA-Z0-9_]+)}}/g;
        let voiceMatch;
        while ((voiceMatch = voiceRegex.exec(rawText)) !== null) {
            // Nếu đã có voice file thì bỏ qua topic tag để tránh double
            displayText = displayText.replace(voiceMatch[0], "");
        }

        return { displayText: displayText.trim(), mediaItems };
    }

    // --- HÀM RENDER TIN NHẮN (Dùng chung cho cả Real-time và History) ---
    function renderMessageRow(roleClass, textContent) {
        const { displayText, mediaItems } = parseMessageContent(textContent);
        
        // Logic: Nếu có Voice -> Ẩn hoàn toàn Text (theo yêu cầu 1)
        const hasVoice = mediaItems.some(m => m.type === 'voice');
        const finalDisplayText = hasVoice ? "" : displayText; 

        if (!finalDisplayText && mediaItems.length === 0) return;

        let lastRow = null;
        
        // 1. Render Text
        if (finalDisplayText) {
            renderBubble(roleClass, finalDisplayText);
            lastRow = chatHistory.lastElementChild;
        }

        // 2. Render Media
        if (mediaItems.length > 0) {
            if (!lastRow || lastRow.classList.contains('user')) {
                // Tạo row mới nếu chưa có text hoặc row trước là user
                lastRow = document.createElement("div");
                lastRow.className = `chat-row ${roleClass}`;
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
                    avatar.onclick = (e) => { e.stopPropagation(); showAvatarModal(avatar.src); };
                    wrapper.appendChild(avatar);
                    lastRow.appendChild(wrapper);
                }
                const msgDiv = document.createElement("div");
                msgDiv.className = `chat-msg ${roleClass} media-msg`;
                lastRow.appendChild(msgDiv);
                chatHistory.appendChild(lastRow);
            }

            const msgDiv = lastRow.querySelector('.chat-msg');
            mediaItems.forEach(item => {
                if (item.type === 'image') {
                    const img = document.createElement("img");
                    img.src = chrome.runtime.getURL(item.src);
                    img.className = "chat-img-content";
                    img.style.marginTop = "8px";
                    img.onclick = () => showAvatarModal(img.src);
                    msgDiv.appendChild(img);
                } else if (item.type === 'voice') {
                    const fullPath = chrome.runtime.getURL(item.src);
                    const audioBubble = createAudioBubble(fullPath, "Voice");
                    audioBubble.style.marginTop = "0px";
                    msgDiv.appendChild(audioBubble);
                }
            });
        }
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
            // User thì displayMessage (đơn giản), Bot thì renderMessageRow (xử lý tag)
            if (roleClass === 'user') {
                // Logic hiển thị tin nhắn user (giữ nguyên logic hiển thị ảnh/file đính kèm nếu có)
                // Tạm thời dùng lại displayMessage cho user
                let text = contentText;
                let imgSrc = null; let fileInfo = null;
                // ... (lấy file đính kèm từ msg.parts nếu có) ...
                if (msg.parts) {
                     const imgPart = msg.parts.find(p => p.inline_data);
                     if (imgPart) imgSrc = `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}`;
                }
                displayMessage(roleClass, text, imgSrc, fileInfo, false);
            } else {
                renderMessageRow(roleClass, contentText);
            }
        });
        scrollToBottom();
    }

    // ... (Hàm renderBubble, displayMessage, scrollToBottom, showTypingIndicator, removeTypingIndicator giữ lại để hỗ trợ hàm trên)
    function renderBubble(roleClass, text) { // Rút gọn tham số vì logic xử lý media đã tách ra
        const row = document.createElement("div");
        row.className = `chat-row ${roleClass}`;
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
            const cachedSrc = CACHED_AVATARS[currentTone];
            avatar.src = cachedSrc || originalSrc;
            avatar.dataset.tone = currentTone;
            avatar.onclick = (e) => { e.stopPropagation(); showAvatarModal(avatar.src); };
            wrapper.appendChild(avatar);
            row.appendChild(wrapper);
        }
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${roleClass}`;
        const textSpan = document.createElement("div");
        textSpan.textContent = text;
        msgDiv.appendChild(textSpan);
        row.appendChild(msgDiv);
        chatHistory.appendChild(row);
    }

    function displayMessage(roleClass, text, imgSrc, fileInfo, scroll = true) {
        const row = document.createElement("div");
        row.className = `chat-row ${roleClass}`;
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${roleClass}`;
        if(text) { const t = document.createElement("div"); t.textContent = text; msgDiv.appendChild(t); }
        if(imgSrc) { const i = document.createElement("img"); i.src = imgSrc; i.className = "chat-img-content"; msgDiv.appendChild(i); }
        if(fileInfo) { const f = document.createElement("div"); f.className = "chat-file-chip"; f.innerHTML = `<span>${escapeHTML(fileInfo.name)}</span>`; msgDiv.appendChild(f); }
        row.appendChild(msgDiv);
        chatHistory.appendChild(row);
        if(scroll) scrollToBottom();
    }

    function scrollToBottom() { requestAnimationFrame(() => { if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight; }); }
    window.chatScrollToBottom = scrollToBottom; 
    function showTypingIndicator() {
        if (chatHistory.querySelector(".typing-indicator-row")) return;
        const row = document.createElement("div"); row.className = "chat-row bot typing-indicator-row";
        const wrapper = document.createElement("div"); wrapper.className = "chat-avatar-wrapper";
        wrapper.innerHTML = `<svg class="avatar-ring" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="url(#avatarGradient)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
        const avatar = document.createElement("img"); avatar.className = "chat-avatar typing-avatar"; 
        const originalSrc = AVATAR_MAP[currentTone] || "icon48.png"; avatar.src = CACHED_AVATARS[currentTone] || originalSrc;
        wrapper.appendChild(avatar); row.appendChild(wrapper);
        const msgDiv = document.createElement("div"); msgDiv.className = "chat-msg bot typing-bubble"; 
        msgDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-ellipsis-icon lucide-ellipsis"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`;
        row.appendChild(msgDiv); if (chatHistory) { chatHistory.appendChild(row); scrollToBottom(); }
    }
    function removeTypingIndicator() { const indicator = chatHistory.querySelector(".typing-indicator-row"); if (indicator) indicator.remove(); }
}