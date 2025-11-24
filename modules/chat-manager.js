import { escapeHTML } from './ui-utils.js';
import { optimizeAvatars } from './avatar-manager.js';
import { 
    loadMediaState, 
    saveMediaState, 
    resetMediaState, 
    mediaState, 
    COOLDOWN_TIME 
} from './media-handler.js';
import { 
    initChatRenderer, 
    renderMessageRow, 
    displayMessage, 
    renderBubble, 
    showTypingIndicator, 
    removeTypingIndicator, 
    scrollToBottom 
} from './chat-renderer.js';

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

    // Khởi tạo các module con
    initChatRenderer(chatHistory);
    window.chatScrollToBottom = scrollToBottom; 
    loadMediaState();
    optimizeAvatars();

    let allChatData = { "dan_chuyen": [], "lao_vo_cung": [], "be_cung": [], "mot_con_meo": [] };
    let currentTone = "dan_chuyen"; 
    let currentAttachment = null; 
    let currentWeatherContext = "";
    
    // --- BIẾN MỚI: ĐẾM SỐ REQUEST ĐANG XỬ LÝ ---
    // Giúp tránh việc tắt typing indicator của tin nhắn sau khi tin nhắn trước vừa delay xong
    let activeRequestCount = 0; 

    const GREETINGS = {
        "dan_chuyen": "Chào bạn! Tôi là trợ lý AI chuyên nghiệp. Tôi có thể giúp gì cho bạn hôm nay?",
        "lao_vo_cung": "Nhìn cái gì? Có việc gì thì nói nhanh, bố mày đang bận. 😒",
        "be_cung": "Anh yêu ơi! 😍 Em nhớ anh quá à. Nay anh có chuyện gì vui kể em nghe đi :3",
        "mot_con_meo": "Sen kia! 😾 Khui pate chưa mà dám gọi trẫm? Có việc gì tâu mau!"
    };

    // --- HÀM 1: PHÂN TÍCH Ý ĐỊNH ẢNH (Context Aware) ---
    function analyzeImageIntent(text) {
        if (!text) return null;
        const lowerText = text.toLowerCase();
        
        const negKeywords = ["không", "đừng", "chả", "chẳng", "khỏi", "thôi", "đéo", "éo"];
        const actionKeywords = ["xem", "gửi", "coi"];
        const hasAction = actionKeywords.some(kw => lowerText.includes(kw));
        const hasNegation = negKeywords.some(kw => lowerText.includes(kw));
        
        if (hasAction && hasNegation) return null;

        const contextRules = [
            {
                folder: 'di_choi',
                keywords: ["có đi đâu chơi không", "đi chơi không", "đi đâu chơi", "đi đu đưa"]
            },
            {
                folder: 'di_lam',
                keywords: ["đang đi làm hả", "có đi làm không", "ở công ty", "ở văn phòng"]
            },
            {
                folder: 'o_nha',
                keywords: ["em chưa ngủ hả", "thức khuya", "chuẩn bị ngủ", "mới ngủ dậy", "ở nhà"]
            },
            {
                folders: ['di_lam', 'o_nha'],
                keywords: ["đang làm gì đấy", "đang làm gì đó", "làm gì thế", "đang làm chi"]
            }
        ];

        let allowedFolders = [];

        contextRules.forEach(rule => {
            if (rule.keywords.some(kw => lowerText.includes(kw))) {
                if (rule.folders) {
                    allowedFolders.push(...rule.folders);
                } else {
                    allowedFolders.push(rule.folder);
                }
            }
        });

        if (allowedFolders.length > 0) {
            return [...new Set(allowedFolders)];
        }

        const genericKeywords = ["xem hình", "gửi ảnh", "xem ảnh", "gửi hình", "coi hình"];
        if (genericKeywords.some(kw => lowerText.includes(kw))) {
            return ['di_choi', 'di_lam', 'o_nha'];
        }

        return null; 
    }

    // --- HÀM 2: PHÂN TÍCH Ý ĐỊNH AUDIO (Context Aware) ---
    function analyzeAudioIntent(text) {
        if (!text) return null;
        const lowerText = text.toLowerCase();

        // 1. Check phủ định
        const negKeywords = ["không", "đừng", "chả", "chẳng", "khỏi", "thôi", "im"];
        if (negKeywords.some(kw => lowerText.includes(kw)) && 
           ["hát", "nói", "voice", "nghe"].some(kw => lowerText.includes(kw))) {
            return null;
        }

        // 2. Định nghĩa các Rule theo yêu cầu
        const audioRules = [
            {
                folder: 'chuc_ngu_ngon',
                keywords: ["chúc em ngủ ngon", "khuya rồi", "anh đi ngủ đây"]
            },
            {
                folder: 'anh_iu_em_ko',
                keywords: ["em yêu anh không", "em có thương anh không", "em ghét anh không", "em gửi voice", "muốn nghe giọng em"]
            },
            {
                folder: 'an_gi_chua',
                keywords: ["anh chưa ăn cơm", "anh đói quá", "anh chưa ăn gì"]
            },
            {
                folder: 'gian_doi',
                keywords: ["anh đang ngoài đường", "anh chưa đi làm về", "anh chưa về"]
            },
            {
                folder: 'hoi_han',
                keywords: ["mới đi làm về", "đi làm về mệt"] 
            },
            {
                folder: 'sao_chua_ngu',
                keywords: ["sao em chưa ngủ", "em chưa ngủ à"]
            },
            {
                folder: 'ui_thuong_the',
                keywords: ["đi làm mệt quá", "mới đi làm về"] 
            },
            {
                folder: 'chia_tay',
                keywords: ["mình dừng lại", "mình chia tay"]
            },
            {
                folder: 'dan_do',
                keywords: ["chuẩn bị đi làm", "chuẩn bị ra ngoài"]
            },
            {
                folder: 'em_nho_anh',
                keywords: ["anh nhớ em quá à"]
            }
        ];

        let allowedFolders = [];

        // 3. Quét keyword
        audioRules.forEach(rule => {
            if (rule.keywords.some(kw => lowerText.includes(kw))) {
                allowedFolders.push(rule.folder);
            }
        });

        if (allowedFolders.length > 0) {
            return [...new Set(allowedFolders)]; 
        }

        return null; 
    }

    function getCurrentTime() {
        const now = new Date();
        const hours = now.getHours().toString().padStart(2, '0');
        const minutes = now.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
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
                    rawText = rawText.split('\n\n[SYSTEM_OVERRIDE:')[0]; 
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
                displayMessage(roleClass, text, imgSrc, fileInfo, false, time, currentTone);
            } else {
                renderMessageRow(roleClass, contentText, time, true, currentTone);
            }
        });
        scrollToBottom();
    }

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

        displayMessage("user", uiText, uiImg, uiFile, true, timestamp, currentTone);
        chatInput.value = ""; chatInput.style.height = '18px';
        currentAttachment = null; renderAttachmentPreview();
        
        // --- CẬP NHẬT: TĂNG BIẾN ĐẾM VÀ HIỂN THỊ TYPING ---
        activeRequestCount++; // Đánh dấu có 1 request mới
        showTypingIndicator(currentTone);

        const userMsgObj = { role: "user", parts: parts, timestamp: timestamp }; 
        
        if (!allChatData[currentTone]) allChatData[currentTone] = [];
        allChatData[currentTone].push(userMsgObj);
        if (allChatData[currentTone].length > 50) allChatData[currentTone] = allChatData[currentTone].slice(-50);
        chrome.storage.local.set({ chatData: allChatData });

        // --- LOGIC MỚI: SYSTEM OVERRIDE & COOLDOWN & CONTEXT ---
        const nowTime = new Date().getTime();
        const timeDiff = nowTime - mediaState.lastImageTime; 
        const isCooldownActive = timeDiff < COOLDOWN_TIME;
        
        // Phân tích ý định
        const allowedImageContexts = analyzeImageIntent(text); 
        const allowedAudioContexts = analyzeAudioIntent(text); 
        
        const isAskingForImage = allowedImageContexts !== null;
        const isAskingForAudio = allowedAudioContexts !== null;

        let overrideInstruction = "";

        // KỊCH BẢN 1: User ĐÒI AUDIO (Ưu tiên)
        if (isAskingForAudio) {
            const contextStr = allowedAudioContexts.join(", ");
            overrideInstruction = `\n\n[SYSTEM_OVERRIDE: User request implies a VOICE/AUDIO response. Contexts detected: [${contextStr}]. You MUST send a suitable audio using syntax {{AUDIO:category_name}} (e.g., {{AUDIO:${allowedAudioContexts[0]}}}). Do NOT send text only.]`;
        } 
        // KỊCH BẢN 2: User ĐÒI ẢNH nhưng CHƯA HẾT Cooldown
        else if (isAskingForImage && isCooldownActive) {
            const minutesLeft = Math.ceil((COOLDOWN_TIME - timeDiff) / 60000);
            overrideInstruction = `\n\n[SYSTEM_OVERRIDE: User asked for an image BUT cooldown is ACTIVE (wait ${minutesLeft} minutes). DO NOT send image. Politely refuse or make an excuse to wait.]`;
        } 
        // KỊCH BẢN 3: User ĐÒI ẢNH và ĐÃ HẾT Cooldown
        else if (isAskingForImage && !isCooldownActive) {
            const contextStr = allowedImageContexts.join(", ");
            overrideInstruction = `\n\n[SYSTEM_OVERRIDE: User explicitly REQUESTED an image. Contexts allowed: [${contextStr}]. You MUST send a suitable image from one of these folders using syntax {{IMG:folder_id}} (e.g., {{IMG:${allowedImageContexts[0]}_1}}). Do NOT send images from other folders.]`;
        }
        // KỊCH BẢN 4: User KHÔNG đòi gì
        else {
            overrideInstruction = `\n\n[SYSTEM_OVERRIDE: User DID NOT ask for media. Reply with text normally.]`;
        }

        const historyForApi = JSON.parse(JSON.stringify(allChatData[currentTone]));
        const historyClean = historyForApi.map(msg => ({role: msg.role, parts: msg.parts}));

        const lastMsg = historyClean[historyClean.length - 1];
        const now = new Date();
        const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const dateString = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        
        systemContext += `\n\n[Hệ thống (Ẩn): Hiện tại là ${timeString}, ${dateString}${currentWeatherContext}.]`;
        systemContext += overrideInstruction; 

        if (lastMsg.parts && lastMsg.parts.length > 0) {
            if (lastMsg.parts[0].text) lastMsg.parts[0].text += systemContext;
            else lastMsg.parts.push({ text: systemContext });
        } else { lastMsg.parts = [{ text: systemContext }]; }

        chrome.runtime.sendMessage({ action: "chat", history: historyClean, tone: currentTone });
    }

    // --- HÀM MỚI: XỬ LÝ TIN NHẮN ĐẾN (ĐẢM BẢO TÍNH ĐỒNG BỘ) ---
    function handleIncomingMessage(request) {
        let messageToSave = request.message; 
        const textContent = messageToSave.parts && messageToSave.parts[0] ? messageToSave.parts[0].text : "";

        const hasMedia = textContent.includes("{{IMG") || textContent.includes("{{AUDIO");
        const delayTime = hasMedia ? 5000 : 0;

        // Nếu có media thì force show indicator lại, phòng trường hợp backend vừa gửi lệnh tắt
        if (hasMedia) {
            showTypingIndicator(currentTone);
        }

        const finalProcessing = () => {
            const timestamp = getCurrentTime();
            messageToSave.timestamp = timestamp;
            renderMessageRow("bot", textContent, timestamp, false, currentTone);
            
            // Lưu lịch sử chat
            if (!allChatData[currentTone]) allChatData[currentTone] = [];
            allChatData[currentTone].push(messageToSave);
            if (allChatData[currentTone].length > 50) allChatData[currentTone] = allChatData[currentTone].slice(-50);
            chrome.storage.local.set({ chatData: allChatData });

            // Logic giảm biến đếm và tắt indicator
            activeRequestCount--; 
            if (activeRequestCount <= 0) {
                activeRequestCount = 0; 
                removeTypingIndicator(); // Chỉ tắt khi count = 0
            }
        };

        if (delayTime > 0) {
            // Delay cho Media
            setTimeout(finalProcessing, delayTime);
        } else {
            // Xử lý ngay lập tức cho Text (Đồng bộ - FIX RACE CONDITION)
            finalProcessing();
        }
    }

    // --- CẬP NHẬT: XỬ LÝ NHẬN TIN NHẮN ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.tone !== currentTone) return;

        if (request.action === "chat_incoming_message") {
            handleIncomingMessage(request);
        }

        if (request.action === "chat_typing") {
            // Chỉ hiện khi bắt đầu gõ.
            // KHÔNG remove ở đây, việc đó để hàm handleIncomingMessage lo sau khi check activeRequestCount.
            if (request.isTyping) {
                showTypingIndicator(currentTone);
            } 
        }
        
        if (request.action === "chat_error") {
            // Nếu lỗi thì reset hết
            activeRequestCount = 0;
            removeTypingIndicator(); 
            renderBubble("error", "❌ Lỗi: " + request.error, null, currentTone); 
            scrollToBottom();
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
            
            renderMessageRow("bot", greeting, timestamp, false, currentTone); 
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
            resetMediaState();
            
            chrome.storage.local.set({ chatData: allChatData });
            chatHistory.innerHTML = '';
            const greeting = GREETINGS[currentTone] || GREETINGS["dan_chuyen"];
            const timestamp = getCurrentTime();
            renderMessageRow("bot", greeting, timestamp, false, currentTone);
            
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