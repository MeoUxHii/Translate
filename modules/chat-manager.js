import { escapeHTML, initCustomSelect } from './ui-utils.js';

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

    // Khởi tạo đầy đủ các key để tránh undefined
    let allChatData = {
        "dan_chuyen": [],
        "lao_vo_cung": [],
        "be_cung": [],
        "mot_con_meo": []
    };
    
    let currentTone = "dan_chuyen"; 
    let currentAttachment = null; 
    let currentWeatherContext = "";

    const GREETINGS = {
        "dan_chuyen": "Chào bạn! Tôi là trợ lý AI chuyên nghiệp. Tôi có thể giúp gì cho bạn hôm nay?",
        "lao_vo_cung": "Nhìn cái gì? Có việc gì thì nói nhanh, bố mày đang bận. 😒",
        "be_cung": "Anh yêu ơi! 😍 Em nhớ anh quá à. Nay anh có chuyện gì vui kể em nghe đi :3",
        "mot_con_meo": "Sen kia! 😾 Khui pate chưa mà dám gọi trẫm? Có việc gì tâu mau!"
    };

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

    // --- LẮNG NGHE MESSAGE TỪ BACKGROUND ---
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.tone !== currentTone) return;

        if (request.action === "chat_incoming_message") {
            removeTypingIndicator();
            renderBubble("bot", request.message.parts[0].text);
            scrollToBottom();
            
            // Đảm bảo mảng tồn tại trước khi push
            if (!allChatData[currentTone]) allChatData[currentTone] = [];
            allChatData[currentTone].push(request.message);
        }

        if (request.action === "chat_typing") {
            if (request.isTyping) showTypingIndicator();
            else removeTypingIndicator();
        }

        if (request.action === "chat_error") {
            removeTypingIndicator();
            renderBubble("error", "❌ Lỗi: " + request.error);
            scrollToBottom();
        }
    });

    chrome.storage.sync.get(["translationTone"], (data) => {
        if (data.translationTone) {
            currentTone = data.translationTone;
            const toneEl = document.getElementById("translationTone");
            if (toneEl) toneEl.value = currentTone;
            updateToneUI(currentTone);
        } else {
            updateToneUI("default"); 
        }
        initCustomSelect("translationTone");
        loadChatData();
    });

    function loadChatData() {
        chrome.storage.local.get(["chatData", "chatMessages"], (result) => {
            if (result.chatData) {
                // Merge với cấu trúc mặc định để đảm bảo không thiếu key nào
                allChatData = { ...allChatData, ...result.chatData };
            } else if (result.chatMessages && result.chatMessages.length > 0) {
                allChatData[currentTone] = result.chatMessages;
                chrome.storage.local.set({ chatData: allChatData });
                chrome.storage.local.remove("chatMessages");
            }
            switchChatMode(currentTone);
        });
    }

    function switchChatMode(tone) {
        currentTone = tone;
        
        // FIX LỖI Ở ĐÂY: Đảm bảo mảng tồn tại
        if (!allChatData[tone]) {
            allChatData[tone] = [];
        }

        const history = allChatData[tone];
        chatHistory.innerHTML = ''; 

        if (history.length === 0) {
            const greeting = GREETINGS[tone] || GREETINGS["dan_chuyen"];
            renderBubble("bot", greeting);
            const botMsgObj = { role: "model", parts: [{ text: greeting }] };
            
            // Giờ thì an toàn rồi
            allChatData[tone].push(botMsgObj);
            chrome.storage.local.set({ chatData: allChatData });
        } else {
            renderChatHistory(history);
        }
    }

    function updateToneUI(value) {
        toneOptions.forEach(opt => {
            if (opt.dataset.value === value) {
                opt.classList.add("selected");
                if (currentToneLabel) currentToneLabel.textContent = opt.textContent;
            } else {
                opt.classList.remove("selected");
            }
        });
    }

    if (toneTriggerBtn) {
        toneTriggerBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            toneMenu.classList.toggle("show");
        });
    }

    toneOptions.forEach(opt => {
        opt.addEventListener("click", (e) => {
            e.stopPropagation();
            const newTone = opt.dataset.value;
            
            if (newTone !== currentTone) {
                updateToneUI(newTone);
                toneMenu.classList.remove("show");
                
                const mainToneSelect = document.getElementById("translationTone");
                if (mainToneSelect) {
                    mainToneSelect.value = newTone;
                    initCustomSelect("translationTone");
                }
                
                chrome.storage.sync.set({ translationTone: newTone });
                switchChatMode(newTone);
            }
        });
    });

    document.addEventListener("click", (e) => {
        if (toneMenu && toneMenu.classList.contains("show")) {
            if (!toneMenu.contains(e.target) && e.target !== toneTriggerBtn) {
                toneMenu.classList.remove("show");
            }
        }
    });

    function renderChatHistory(messages) {
        if (!chatHistory) return;
        messages.forEach(msg => {
            const roleClass = msg.role === "user" ? "user" : "bot";
            let text = "";
            let imgSrc = null;
            let fileInfo = null;

            if (msg.parts && Array.isArray(msg.parts)) {
                const imgPart = msg.parts.find(p => p.inline_data);
                if (imgPart) imgSrc = `data:${imgPart.inline_data.mime_type};base64,${imgPart.inline_data.data}`;

                const textPart = msg.parts.find(p => p.text);
                if (textPart) {
                    const rawText = textPart.text;
                    let cleanText = rawText.split('\n\n[Hệ thống (Ẩn):')[0];
                    const fileRegex = /([\s\S]*?)\n\n--- File Attached: (.+) ---\n[\s\S]*?(\n------------------\n|$)/;
                    const match = cleanText.match(fileRegex);
                    if (match) {
                        text = match[1].trim();
                        fileInfo = { name: match[2].trim() };
                    } else {
                        text = cleanText;
                    }
                }
            }
            
            displayMessage(roleClass, text, imgSrc, fileInfo, false);
        });
        scrollToBottom();
    }

    function renderBubble(roleClass, text, imgSrc, fileInfo) {
        const row = document.createElement("div");
        row.className = `chat-row ${roleClass}`;
        if (roleClass === 'bot') {
            const avatar = document.createElement("img");
            avatar.className = "chat-avatar";
            avatar.src = "icon48.png"; 
            row.appendChild(avatar);
        }
        const msgDiv = document.createElement("div");
        msgDiv.className = `chat-msg ${roleClass}`;
        if (!text && (imgSrc || fileInfo)) msgDiv.classList.add("media-msg");

        if (text) {
            const textSpan = document.createElement("div");
            textSpan.textContent = text;
            msgDiv.appendChild(textSpan);
        }
        if (imgSrc) {
            const img = document.createElement("img");
            img.src = imgSrc;
            img.className = "chat-img-content";
            msgDiv.appendChild(img);
        }
        if (fileInfo) {
            const fileChip = document.createElement("div");
            fileChip.className = "chat-file-chip";
            fileChip.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg><span>${escapeHTML(fileInfo.name)}</span>`;
            msgDiv.appendChild(fileChip);
        }
        row.appendChild(msgDiv);
        chatHistory.appendChild(row);
    }

    function displayMessage(roleClass, text, imgSrc = null, fileInfo = null, shouldScroll = true) {
        const hasText = !!text;
        const hasImg = !!imgSrc;
        const hasFile = !!fileInfo;
        if (hasText) renderBubble(roleClass, text, null, null);
        if (hasImg) renderBubble(roleClass, null, imgSrc, null);
        if (hasFile) renderBubble(roleClass, null, null, fileInfo);
        if(shouldScroll) scrollToBottom();
    }

    function scrollToBottom() {
        requestAnimationFrame(() => { if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight; });
    }
    window.chatScrollToBottom = scrollToBottom; 

    function showTypingIndicator() {
        if (chatHistory.querySelector(".typing-indicator-row")) return;
        const row = document.createElement("div");
        row.className = "chat-row bot typing-indicator-row";
        const avatar = document.createElement("img");
        avatar.className = "chat-avatar";
        avatar.src = "icon48.png"; 
        row.appendChild(avatar);
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

        displayMessage("user", uiText, uiImg, uiFile);
        chatInput.value = ""; chatInput.style.height = '18px';
        currentAttachment = null; renderAttachmentPreview();
        showTypingIndicator();

        const userMsgObj = { role: "user", parts: parts }; 
        
        // FIX LỖI Ở ĐÂY NỮA: Check mảng trước khi push
        if (!allChatData[currentTone]) allChatData[currentTone] = [];
        allChatData[currentTone].push(userMsgObj);
        
        if (allChatData[currentTone].length > 50) {
            allChatData[currentTone] = allChatData[currentTone].slice(allChatData[currentTone].length - 50);
        }
        chrome.storage.local.set({ chatData: allChatData });

        const historyForApi = JSON.parse(JSON.stringify(allChatData[currentTone]));
        const lastMsg = historyForApi[historyForApi.length - 1];
        const now = new Date();
        const timeString = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const dateString = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const systemContext = `\n\n[Hệ thống (Ẩn): Hiện tại là ${timeString}, ${dateString}${currentWeatherContext}. Hãy trả lời phù hợp với ngữ cảnh thời gian thực tế này.]`;

        if (lastMsg.parts && lastMsg.parts.length > 0) {
            if (lastMsg.parts[0].text) lastMsg.parts[0].text += systemContext;
            else lastMsg.parts.push({ text: systemContext });
        } else { lastMsg.parts = [{ text: systemContext }]; }

        chrome.runtime.sendMessage({ action: "chat", history: historyForApi, tone: currentTone });
    }

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
            chrome.storage.local.set({ chatData: allChatData });
            chatHistory.innerHTML = '';
            const greeting = GREETINGS[currentTone] || GREETINGS["dan_chuyen"];
            renderBubble("bot", greeting);
            
            // FIX LỖI Ở ĐÂY LUÔN CHO CHẮC
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
}