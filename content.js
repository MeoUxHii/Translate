window.selectedText = "";
let selectionRange = null;

// --- MAGIC TEXT EXPANDER LOGIC (ULTRA ROBUST VERSION) ---
let magicShortcuts = [];
let isMagicEnabled = true;

// Load settings
chrome.storage.sync.get(['magicTemplates', 'magicEnabled'], (data) => {
    if (data.magicTemplates) magicShortcuts = data.magicTemplates;
    if (data.magicEnabled !== undefined) isMagicEnabled = data.magicEnabled;
});

// Listen for changes
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        if (changes.magicTemplates) magicShortcuts = changes.magicTemplates.newValue || [];
        if (changes.magicEnabled) isMagicEnabled = changes.magicEnabled.newValue;
    }
});

// Hàm xử lý chính cho sự kiện input
// Sử dụng input event là cách tốt nhất để bắt được ký tự vừa gõ trên mọi nền tảng
function handleInput(e) {
    if (!isMagicEnabled || !e.target) return;
    
    // Bỏ qua nếu đang xóa hoặc undo
    if (e.inputType && (e.inputType.startsWith('delete') || e.inputType === 'historyUndo')) return;

    const target = e.target;
    const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
    const isEditable = target.isContentEditable;

    if (!isInput && !isEditable) return;
    
    // Chỉ xử lý trên element đang được focus
    if (target !== document.activeElement && !target.contains(document.activeElement)) return;

    // Delay cực nhỏ để đảm bảo ký tự vừa gõ đã thực sự vào DOM/Value
    setTimeout(() => {
        if (isInput) {
            checkAndExpandInput(target);
        } else {
            checkAndExpandContentEditable(target);
        }
    }, 0);
}

// Lắng nghe sự kiện input
document.addEventListener('input', handleInput);

function checkAndExpandInput(target) {
    if (magicShortcuts.length === 0) return;

    const text = target.value;
    const cursorPosition = target.selectionStart;
    const textBeforeCursor = text.slice(Math.max(0, cursorPosition - 50), cursorPosition);
    
    for (const template of magicShortcuts) {
        if (textBeforeCursor.endsWith(template.shortcut)) {
            // Tìm thấy shortcut!
            const shortcutLen = template.shortcut.length;
            
            // Chọn shortcut vừa gõ
            target.setSelectionRange(cursorPosition - shortcutLen, cursorPosition);
            
            // Dùng execCommand để thay thế -> Cái này giúp kích hoạt các event listeners của trang web
            // để nó biết là value đã thay đổi (quan trọng cho React/Angular)
            const success = document.execCommand('insertText', false, template.content);
            
            if (!success) {
                // Fallback nếu execCommand thất bại (hiếm khi trên input/textarea)
                const preText = text.substring(0, cursorPosition - shortcutLen);
                const postText = text.substring(cursorPosition);
                const newText = preText + template.content + postText;
                
                // Hack cho React 15/16+
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;

                if (target.tagName === 'INPUT' && nativeInputValueSetter) {
                    nativeInputValueSetter.call(target, newText);
                } else if (target.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
                    nativeTextAreaValueSetter.call(target, newText);
                } else {
                    target.value = newText;
                }
                
                // Restore cursor
                const newCursorPos = cursorPosition - shortcutLen + template.content.length;
                target.setSelectionRange(newCursorPos, newCursorPos);
                
                // Dispatch events thủ công
                target.dispatchEvent(new Event('input', { bubbles: true }));
                target.dispatchEvent(new Event('change', { bubbles: true }));
            }
            return;
        }
    }
}

function checkAndExpandContentEditable(target) {
    if (magicShortcuts.length === 0) return;

    const selection = window.getSelection();
    if (!selection.rangeCount) return;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;

    // Lấy text content hiện tại.
    // Lưu ý: Với contentEditable phức tạp, node có thể không phải text node thuần túy
    // Nhưng ta chỉ quan tâm text ngay tại con trỏ
    let textBeforeCursor = "";
    let cursorOffset = 0;

    if (node.nodeType === Node.TEXT_NODE) {
        cursorOffset = range.startOffset;
        textBeforeCursor = node.textContent.slice(Math.max(0, cursorOffset - 50), cursorOffset);
    } else {
        // Trường hợp node là element, thử lấy textContent nhưng cái này kém chính xác hơn
        // Thường xảy ra khi vừa gõ xong 1 thẻ br hoặc div mới
        return; 
    }

    for (const template of magicShortcuts) {
        if (textBeforeCursor.endsWith(template.shortcut)) {
            const shortcutLen = template.shortcut.length;

            // 1. Chọn shortcut để xóa
            // Tạo range bao trùm shortcut vừa gõ
            const rangeToDelete = document.createRange();
            try {
                rangeToDelete.setStart(node, cursorOffset - shortcutLen);
                rangeToDelete.setEnd(node, cursorOffset);
                
                selection.removeAllRanges();
                selection.addRange(rangeToDelete);
                
                // 2. Thực hiện thay thế bằng execCommand
                // Lệnh này cực kỳ mạnh, nó giả lập hành động Paste text của người dùng
                // Giúp bypass hầu hết các cơ chế chặn của Facebook/Google Docs
                document.execCommand('insertText', false, template.content);
                
                // Docs/Sheets đôi khi cần thêm cú hích này
                if (target.isContentEditable) {
                     target.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                return; // Thành công rồi thì thoát
            } catch (err) {
                console.log("MeoU Magic: Lỗi thay thế text", err);
                // Khôi phục selection cũ nếu lỗi
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }
}
// --- END MAGIC LOGIC ---

createTranslateButton();

document.addEventListener("mouseup", (e) => {
    if (window.isWibuMode && window.isSelecting) {
        window.isSelecting = false;
        if (!window.selectionBox) return;
        const rect = window.selectionBox.getBoundingClientRect();
        if (rect.width > 10 && rect.height > 10) processSelection(rect.left, rect.top, rect.width, rect.height);
        else if (window.selectionBox) window.selectionBox.style.display = 'none';
        return;
    }
    const path = e.composedPath();
    if (path.some(el => el === translateButton || el === popup || el === historyPopup || el.id === "ai-translate-popup" || el.id === "ai-history-popup")) return;
    if ((popup && popup.classList.contains("ai-dragging")) || (historyPopup && historyPopup.classList.contains("ai-dragging"))) return;
    
    const text = window.getSelection().toString().trim();
    if (text.length > 0) {
        window.selectedText = text;
        selectionRange = window.getSelection().getRangeAt(0).cloneRange();
        showTranslateButton(e.pageX, e.pageY);
    } else {
        hideTranslateButton();
    }
});

document.addEventListener("mousedown", (e) => {
    if (window.isWibuMode) {
        const path = e.composedPath();
        if (path.some(el => el.classList && el.classList.contains('manga-overlay-box'))) return;
        e.preventDefault();
        window.isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        const box = createSelectionBox();
        box.style.left = startX + "px";
        box.style.top = startY + "px";
        box.style.width = "0px";
        box.style.height = "0px";
        box.style.display = "block";
        return;
    }

    const path = e.composedPath();
    const isClickInside = path.some(el => el === shadowRoot?.host);
    if (isClickInside) return;

    if (popup && popup.style.display === "block") {
        if (typeof popup.resetAudio === 'function') popupEl.resetAudio();
        
        const stopAudioFn = popup.querySelector('.ai-popup-speak') ? () => {} : null; 
        popup.style.display = "none";
        const langSelector = popup.querySelector("#ai-lang-selector");
        if (langSelector) langSelector.style.display = "none";
    }
    
    if (historyPopup && historyPopup.style.display === "block") {
        historyPopup.style.display = "none";
    }

    if (translateButton && !translateButton.contains(e.target)) {
        setTimeout(() => {
            const selection = window.getSelection();
            if (selection.toString().trim().length === 0) {
                hideTranslateButton();
            }
        }, 10);
    }
});

document.addEventListener("mousemove", (e) => {
    if (!window.isWibuMode || !window.isSelecting) return;
    const currentX = e.clientX;
    const currentY = e.clientY;
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);

    if (window.selectionBox) {
        window.selectionBox.style.width = width + "px";
        window.selectionBox.style.height = height + "px";
        window.selectionBox.style.left = left + "px";
        window.selectionBox.style.top = top + "px";
    }
});

document.addEventListener("keydown", async (e) => {
    if (e.key === "T" && e.altKey && e.shiftKey) {
        e.preventDefault();
        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (text.length > 0) {
            window.selectedText = text;
            selectionRange = selection.getRangeAt(0).cloneRange();
            await translateSelectedText();
        }
    }
    if (e.ctrlKey && (e.key === "q" || e.key === "Q")) {
        e.preventDefault();
        toggleWibuMode();
    }
    if (e.key === "Escape" && historyPopup && historyPopup.style.display === "block") {
        historyPopup.style.display = "none";
    }
});

async function translateSelectedText(clickCoords = null) {
    if (!window.selectedText) return;

    const popupEl = createPopup();
    
    if (typeof popupEl.resetAudio === 'function') popupEl.resetAudio();

    const translatedDiv = popupEl.querySelector(".ai-translated-text");
    const titleEl = popupEl.querySelector(".ai-popup-title");

    const langSelector = popupEl.querySelector("#ai-lang-selector");
    if (langSelector) langSelector.style.display = "none";
    if (historyPopup) historyPopup.style.display = 'none';

    titleEl.textContent = "Bản Dịch";
    translatedDiv.style.whiteSpace = 'pre-wrap';
    translatedDiv.innerHTML = '<div class="ai-loading">Đợi bố mày tí...</div>';

    let targetLeft, targetTop;
    if (clickCoords) {
        targetLeft = clickCoords.clientX + 5;
        targetTop = clickCoords.clientY + 5;
    } else {
        try {
            const rect = selectionRange.getBoundingClientRect();
            targetLeft = rect.left;
            targetTop = rect.bottom + 8;
        } catch (error) { targetLeft = 100; targetTop = 100; }
    }

    popupEl.style.display = "block";
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popupWidth = 400;
    const popupMaxHeight = 240;
    const maxLeft = Math.max(vw - popupWidth - pad, pad);
    const maxTop = Math.max(vh - popupMaxHeight - pad, pad);
    targetLeft = Math.max(targetLeft, pad);
    targetTop = Math.max(targetTop, pad);
    targetLeft = Math.min(targetLeft, maxLeft);
    targetTop = Math.min(targetTop, maxTop);
    popupEl.style.left = targetLeft + "px";
    popupEl.style.top = targetTop + "px";

    try {
        const result = await chrome.runtime.sendMessage({
            action: "translate",
            text: window.selectedText,
            targetLangOverride: null
        });
        if (result.success) translatedDiv.textContent = result.translation;
        else {
            translatedDiv.style.whiteSpace = 'normal';
            translatedDiv.innerHTML = `<div class="ai-error">❌ ${result.error}</div>`;
        }
    } catch (error) {
        translatedDiv.style.whiteSpace = 'normal';
        translatedDiv.innerHTML = `<div class="ai-error">❌ Lỗi: ${error.message} (Thử F5 lại trang)</div>`;
    }
}

async function positionAndShowImagePopup(popupEl) {
     let initialLeft, initialTop;
     try {
        const data = await chrome.storage.sync.get(["popupPos"]);
        const saved = data.popupPos;
        if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
            initialLeft = saved.left; initialTop = saved.top;
        } else {
            const popupWidth = 400; initialLeft = (window.innerWidth - popupWidth) / 2; initialTop = 20;
        }
    } catch (error) {
        const popupWidth = 400; initialLeft = (window.innerWidth - popupWidth) / 2; initialTop = 20;
    }
    popupEl.style.display = "block";
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const popupWidth = 400;
    const popupMaxHeight = 240;
    const maxLeft = Math.max(vw - popupWidth - pad, pad);
    const maxTop = Math.max(vh - popupMaxHeight - pad, pad);
    let clampedLeft = Math.max(initialLeft, pad);
    let clampedTop = Math.max(initialTop, pad);
    clampedLeft = Math.min(clampedLeft, maxLeft);
    clampedTop = Math.min(clampedTop, maxTop);
    popupEl.style.left = clampedLeft + "px";
    popupEl.style.top = clampedTop + "px";
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "translate-shortcut") {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (text.length > 0) {
            window.selectedText = text;
            selectionRange = selection.getRangeAt(0).cloneRange();
            await translateSelectedText();
        }
        return; 
    }
    if (request.action === "show_loading_popup" || request.action === "update_loading_popup") {
        const popupEl = createPopup();
        const titleEl = popupEl.querySelector(".ai-popup-title");
        const translatedDiv = popupEl.querySelector(".ai-translated-text");
        const langSelector = popupEl.querySelector("#ai-lang-selector");
        if (langSelector) langSelector.style.display = "none";
        if (historyPopup) historyPopup.style.display = 'none';
        if (titleEl) titleEl.textContent = request.title;
        translatedDiv.style.whiteSpace = 'pre-wrap';
        translatedDiv.innerHTML = '<div class="ai-loading">Đợi bố mày tí...</div>';
        
        if (typeof popupEl.resetAudio === 'function') popupEl.resetAudio();

        if (popupEl.style.display !== 'block') await positionAndShowImagePopup(popupEl);
        return; 
    }
    if (request.action === "show_translation_result") {
        const popupEl = createPopup();
        const titleEl = popupEl.querySelector(".ai-popup-title");
        const translatedDiv = popupEl.querySelector(".ai-translated-text");
        if (titleEl) titleEl.textContent = "Kết quả Phân tích Ảnh";
        if (request.success) {
            translatedDiv.style.whiteSpace = 'pre-wrap';
            translatedDiv.textContent = request.translation;
        } else {
            translatedDiv.style.whiteSpace = 'normal';
            translatedDiv.innerHTML = `<div class="ai-error">❌ ${request.error}</div>`;
        }
        if (popupEl.style.display !== 'block') await positionAndShowImagePopup(popupEl);
        return; 
    }
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync' && changes.userTheme) {
        applyThemeToElements();
    }
});