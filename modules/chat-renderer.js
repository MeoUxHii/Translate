// Module chuyên trách việc vẽ UI Chat (Bubble, Row, Timestamp)
import { escapeHTML } from './ui-utils.js';
import { createAudioBubble, parseMessageContent } from './media-handler.js';
import { getAvatarSrc, showAvatarModal } from './avatar-manager.js';

let chatHistoryContainer = null;

export function initChatRenderer(container) {
    chatHistoryContainer = container;
}

export function scrollToBottom() {
    if (chatHistoryContainer) {
        requestAnimationFrame(() => {
            chatHistoryContainer.scrollTop = chatHistoryContainer.scrollHeight;
        });
    }
}

// Tạo hàng chat (Row) và Wrapper nội dung
function createChatRowWithWrapper(roleClass, currentTone) {
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
        avatar.src = getAvatarSrc(currentTone);
        avatar.dataset.tone = currentTone;
        avatar.onclick = (e) => { e.stopPropagation(); showAvatarModal(avatar.src, currentTone); };
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

// Render tin nhắn Bot (có xử lý media tags)
export function renderMessageRow(roleClass, textContent, timestamp = null, isHistory = false, currentTone = 'dan_chuyen') {
    if (!chatHistoryContainer) return;

    const { displayText, mediaItems } = parseMessageContent(textContent, isHistory);
    
    if (!displayText && mediaItems.length === 0) return;

    const { row, contentWrapper } = createChatRowWithWrapper(roleClass, currentTone);
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
                img.onclick = () => showAvatarModal(img.src, null);
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

    if (lastElement) {
        appendTimestamp(lastElement, timestamp);
    }

    chatHistoryContainer.appendChild(row);
    scrollToBottom();
}

// Render bong bóng chat User (hoặc tin đơn giản)
export function displayMessage(roleClass, text, imgSrc, fileInfo, scroll = true, timestamp = null, currentTone = 'dan_chuyen') {
    if (!chatHistoryContainer) return;

    const { row, contentWrapper } = createChatRowWithWrapper(roleClass, currentTone);
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
        i.onclick = () => showAvatarModal(imgSrc, null); // Xem ảnh mình gửi
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

    chatHistoryContainer.appendChild(row);
    if (scroll) scrollToBottom();
}

// Render bong bóng đặc biệt (Error, System msg)
export function renderBubble(roleClass, text, timestamp = null, currentTone = 'dan_chuyen') {
    if (!chatHistoryContainer) return;
    
    const targetRole = roleClass === 'error' ? 'bot' : roleClass;
    const { row, contentWrapper } = createChatRowWithWrapper(targetRole, currentTone);
    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-msg ${roleClass}`;

    // Xử lý HTML (cho icon)
    if (text.includes('<svg')) {
        msgDiv.innerHTML = text;
    } else {
        const textSpan = document.createElement("div");
        textSpan.textContent = text;
        msgDiv.appendChild(textSpan);
    }

    if (timestamp) appendTimestamp(msgDiv, timestamp);
    contentWrapper.appendChild(msgDiv);
    chatHistoryContainer.appendChild(row);
    scrollToBottom();
}

export function showTypingIndicator(currentTone) {
    if (!chatHistoryContainer || chatHistoryContainer.querySelector(".typing-indicator-row")) return;
    
    renderBubble("bot", `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-ellipsis-icon lucide-ellipsis"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>`, null, currentTone);
    
    const lastRow = chatHistoryContainer.lastElementChild;
    if (lastRow) lastRow.classList.add("typing-indicator-row");
    scrollToBottom();
}

export function removeTypingIndicator() {
    if (!chatHistoryContainer) return;
    const indicator = chatHistoryContainer.querySelector(".typing-indicator-row");
    if (indicator) indicator.remove();
}