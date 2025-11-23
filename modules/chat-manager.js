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

    let chatMessages = []; 
    let currentAttachment = null; 

    chrome.storage.sync.get(["translationTone"], (data) => {
        if (data.translationTone) {
            document.getElementById("translationTone").value = data.translationTone;
            updateToneUI(data.translationTone);
        } else {
            updateToneUI("default");
        }
        initCustomSelect("translationTone");
    });

    chrome.storage.local.get(["chatMessages"], (result) => {
        if (result.chatMessages) {
            chatMessages = result.chatMessages;
            renderChatHistory(chatMessages);
        } else {
            renderBubble("bot", "Chào cưng! Cần MeoU giúp gì nào? 😼");
        }
    });

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
            const val = opt.dataset.value;
            updateToneUI(val);
            toneMenu.classList.remove("show");
            
            const mainToneSelect = document.getElementById("translationTone");
            if (mainToneSelect) {
                mainToneSelect.value = val;
                initCustomSelect("translationTone");
            }
            chrome.storage.sync.set({ translationTone: val });
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
        chatHistory.innerHTML = '';
        if (messages.length === 0) {
            renderBubble("bot", "Chào cưng! Cần MeoU giúp gì nào? 😼");
        } else {
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
                        const fileRegex = /([\s\S]*?)\n\n--- File Attached: (.+) ---\n[\s\S]*?(\n------------------\n|$)/;
                        const match = rawText.match(fileRegex);
                        if (match) {
                            text = match[1].trim();
                            fileInfo = { name: match[2].trim() };
                        } else {
                            text = rawText;
                        }
                    }
                }
                displayMessage(roleClass, text, imgSrc, fileInfo, false);
            });
            scrollToBottom();
        }
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
        
        if (!text && (imgSrc || fileInfo)) {
            msgDiv.classList.add("media-msg");
        }

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
            fileChip.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                <span>${escapeHTML(fileInfo.name)}</span>
            `;
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
        requestAnimationFrame(() => {
            if (chatHistory) chatHistory.scrollTop = chatHistory.scrollHeight;
        });
    }
    
    window.chatScrollToBottom = scrollToBottom; 

    function showTypingIndicator() {
        removeTypingIndicator(); 

        const row = document.createElement("div");
        row.className = "chat-row bot typing-indicator-row";

        const avatar = document.createElement("img");
        avatar.className = "chat-avatar";
        avatar.src = "icon48.png"; 
        row.appendChild(avatar);

        const msgDiv = document.createElement("div");
        msgDiv.className = "chat-msg bot typing-bubble"; 
        
        msgDiv.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-ellipsis-icon lucide-ellipsis">
                <circle cx="12" cy="12" r="1"/>
                <circle cx="19" cy="12" r="1"/>
                <circle cx="5" cy="12" r="1"/>
            </svg>
        `;

        row.appendChild(msgDiv);

        if (chatHistory) {
            chatHistory.appendChild(row);
            scrollToBottom(); 
        }
    }

    function removeTypingIndicator() {
        const indicator = chatHistory.querySelector(".typing-indicator-row");
        if (indicator) indicator.remove();
    }
    // ----------------------------------------------

    function renderAttachmentPreview() {
        attachmentContent.innerHTML = "";
        if (!currentAttachment) {
            previewContainer.style.display = "none";
            return;
        }
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
            reader.onload = (e) => {
                currentAttachment = { type: 'image', data: e.target.result.split(',')[1], mime: file.type };
                renderAttachmentPreview();
            };
            reader.readAsDataURL(file);
        } else {
            const reader = new FileReader();
            reader.onload = (event) => {
                currentAttachment = { type: 'file', data: event.target.result, name: file.name, mime: "text/plain" };
                renderAttachmentPreview();
            };
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
                if (parts.length > 0 && parts[0].text) parts[0].text += fileContext;
                else parts.push({ text: fileContext });
                uiFile = { name: currentAttachment.name };
            }
        }

        displayMessage("user", uiText, uiImg, uiFile);
        chatInput.value = "";
        chatInput.style.height = '18px';
        currentAttachment = null;
        renderAttachmentPreview();
        
        showTypingIndicator();

        const userMsgObj = { role: "user", parts: parts }; 
        chatMessages.push(userMsgObj);
        if (chatMessages.length > 50) chatMessages = chatMessages.slice(chatMessages.length - 50);
        chrome.storage.local.set({ chatMessages: chatMessages });

        chrome.runtime.sendMessage({ action: "chat", history: chatMessages }, (response) => {
            removeTypingIndicator();
            if (response.success) {
                const botMsgObj = { role: "model", parts: [{ text: response.reply }] };
                chatMessages.push(botMsgObj);
                chrome.storage.local.set({ chatMessages: chatMessages });
                renderBubble("bot", response.reply);
            } else {
                renderBubble("error", "❌ Lỗi: " + response.error);
            }
            scrollToBottom();
        });
    }

    if (chatSendBtn) chatSendBtn.addEventListener("click", sendMessage);
    if (chatInput) {
        chatInput.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = (this.scrollHeight) + 'px';
            if (this.value === '') this.style.height = '18px'; 
        });
        chatInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
        });
        chatInput.addEventListener('paste', (e) => {
            const items = (e.clipboardData || e.originalEvent.clipboardData).items;
            for (let i = 0; i < items.length; i++) {
                if (items[i].type.indexOf("image") === 0) {
                    e.preventDefault(); 
                    const blob = items[i].getAsFile();
                    handleFileSelect(blob);
                    return; 
                }
            }
        });
    }
    if (chatResetBtn) {
        chatResetBtn.addEventListener("click", () => {
            chatMessages = [];
            chrome.storage.local.remove("chatMessages");
            chatHistory.innerHTML = '';
            renderBubble("bot", "Chào cưng! Cần MeoU giúp gì nào? 😼");
            currentAttachment = null;
            renderAttachmentPreview();
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