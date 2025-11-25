window.selectedText = "";
let selectionRange = null;

// --- MAGIC TEXT EXPANDER LOGIC (MAGICAL STYLE) ---
let magicShortcuts = [];
let isMagicEnabled = true;

// Danh sách web "khó ở" cần dùng chiêu đặc biệt
const HARDCORE_DOMAINS = [
    'docs.google.com',
    'facebook.com',
    'messenger.com',
    'notion.so',
    'slack.com',
    'discord.com',
    'trello.com',
    'canva.com'
];

// Load settings
chrome.storage.sync.get(['magicTemplates', 'magicEnabled'], (data) => {
    if (data.magicTemplates) magicShortcuts = data.magicTemplates;
    if (data.magicEnabled !== undefined) isMagicEnabled = data.magicEnabled;
});

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        if (changes.magicTemplates) magicShortcuts = changes.magicTemplates.newValue || [];
        if (changes.magicEnabled) isMagicEnabled = changes.magicEnabled.newValue;
    }
});

// Hàm kiểm tra web khó tính
function isHardcoreSite() {
    return HARDCORE_DOMAINS.some(domain => window.location.hostname.includes(domain));
}

// Buffer lưu các phím vừa gõ (để phát hiện shortcut mà không cần đọc toàn bộ content)
// Cái này giúp bypass việc GDocs không cho đọc value
let keyBuffer = "";
const BUFFER_LIMIT = 50; // Chỉ cần nhớ 50 ký tự cuối

// Lắng nghe từng phím bấm (Keydown tin cậy hơn Input trên GDocs)
// Quan trọng: Dùng capture = true để bắt sự kiện trước khi nó bị trang web chặn
// Dùng window.addEventListener để bao phủ rộng nhất
window.addEventListener('keydown', (e) => {
    if (!isMagicEnabled) return;

    // 1. Xử lý buffer: Chỉ ghi nhận các phím ký tự thông thường
    // Bỏ qua các phím chức năng (Ctrl, Alt, Meta)
    if (e.key.length === 1 && !e.ctrlKey && !e.altKey && !e.metaKey) {
        keyBuffer += e.key;
        if (keyBuffer.length > BUFFER_LIMIT) keyBuffer = keyBuffer.slice(-BUFFER_LIMIT);
    } 
    // 2. Xử lý xóa lùi: Cập nhật buffer khi người dùng xóa
    else if (e.key === 'Backspace') {
        keyBuffer = keyBuffer.slice(0, -1);
    }

    // 3. Trigger kiểm tra: Khi nhấn Space hoặc Enter
    // Magical Text thường kích hoạt khi kết thúc từ
    if (e.key === ' ' || e.key === 'Enter') {
        // Dùng setTimeout để ký tự Space/Enter kịp vào buffer/editor trước khi check
        setTimeout(() => checkAndExpand(), 10);
    }
}, true); 

// Hàm xử lý chính
async function checkAndExpand() {
    if (magicShortcuts.length === 0) return;

    // Lấy buffer hiện tại (đã bao gồm ký tự trigger vừa gõ)
    const currentBuffer = keyBuffer; 

    for (const template of magicShortcuts) {
        // Kiểm tra: Buffer kết thúc bằng "shortcut" + "ký tự phân tách" (space/enter)
        
        const triggerChar = currentBuffer.slice(-1); // Ký tự vừa gõ (Space/Enter)
        // Chỉ check nếu trigger là khoảng trắng (đơn giản hóa)
        if (triggerChar.trim() !== '') continue; 

        const textToCheck = currentBuffer.trim(); // Bỏ space cuối đi để check shortcut
        
        if (textToCheck.endsWith(template.shortcut)) {
            console.log("MeoU Magic: Triggered!", template.shortcut);
            
            // Reset buffer để tránh trigger lặp lại
            keyBuffer = ""; 
            
            const target = document.activeElement;
            
            // Chiến thuật: Xóa lùi + Paste
            // --- Logic thêm khoảng trắng vào content ---
            let contentWithSpace = template.content;
            if (!contentWithSpace.endsWith(' ')) {
                contentWithSpace += ' ';
            }

            await executeMagicalReplace(target, template.shortcut, contentWithSpace);
            return;
        }
    }
}

async function executeMagicalReplace(target, shortcut, content) {
    // 1. Tính số lần cần xóa = độ dài shortcut + 1 (ký tự kích hoạt space/enter)
    const deleteCount = shortcut.length + 1; 

    // Với GDocs/Facebook, ta không select range được chuẩn.
    // Ta sẽ gửi sự kiện Backspace N lần.
    
    if (isHardcoreSite()) {
        // --- MODE: HARDCORE (GDocs, FB) ---
        
        // Bước 1: Xóa shortcut bằng cách giả lập phím Backspace
        for (let i = 0; i < deleteCount; i++) { 
            // Gửi sự kiện keydown Backspace
            const keyEvent = new KeyboardEvent('keydown', {
                key: 'Backspace',
                code: 'Backspace',
                keyCode: 8,
                which: 8,
                bubbles: true,
                cancelable: true,
                view: window
            });
            target.dispatchEvent(keyEvent);
            
            // Gửi thêm keyup cho đủ bộ
            const keyUpEvent = new KeyboardEvent('keyup', {
                key: 'Backspace',
                code: 'Backspace',
                keyCode: 8,
                which: 8,
                bubbles: true,
                cancelable: true,
                view: window
            });
            target.dispatchEvent(keyUpEvent);
            
            // Thêm delay nhỏ để editor kịp xử lý (quan trọng!)
            await new Promise(r => setTimeout(r, 5));
        }

        // Bước 2: Paste nội dung mới (đã có space ở cuối)
        await simulatePaste(content);
        
    } else {
        // --- MODE: STANDARD (Input thường) ---
        // Dùng cách cũ cho nhanh và mượt
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
            const start = target.selectionStart;
            const end = target.selectionEnd;
            const text = target.value;
            // Cắt bỏ shortcut trước con trỏ (lùi lại deleteCount ký tự)
            const replaceStart = Math.max(0, start - deleteCount);
            
            const newText = text.substring(0, replaceStart) + content + text.substring(end);
            
            // Hack React setter
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
            const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;

            if (target.tagName === 'INPUT' && nativeInputValueSetter) {
                nativeInputValueSetter.call(target, newText);
            } else if (target.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
                nativeTextAreaValueSetter.call(target, newText);
            } else {
                target.value = newText;
            }
            
            // Đặt lại con trỏ
            const newPos = replaceStart + content.length;
            target.setSelectionRange(newPos, newPos);
            target.dispatchEvent(new Event('input', { bubbles: true }));
        } else {
            // ContentEditable thường
             for (let i = 0; i < deleteCount; i++) document.execCommand('delete');
             document.execCommand('insertText', false, content);
        }
    }
}

// Hàm Copy & Paste thần thánh
async function simulatePaste(text) {
    // Copy vào clipboard
    const copyDataToClipboard = (e) => {
        e.preventDefault();
        e.clipboardData.setData('text/plain', text);
    };
    document.addEventListener('copy', copyDataToClipboard);
    document.execCommand('copy');
    document.removeEventListener('copy', copyDataToClipboard);

    // Chờ xíu cho clipboard ăn
    await new Promise(r => setTimeout(r, 50));

    // Paste ra
    const success = document.execCommand('paste');
    
    if (!success) {
        // Fallback nếu paste bị chặn: Thử insertText 
        console.log("MeoU: Paste bị chặn, thử insertText...");
        document.execCommand('insertText', false, text);
    }
}

// --- CÁC LOGIC DỊCH CŨ GIỮ NGUYÊN BÊN DƯỚI ---
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
    // Giữ lại phím tắt dịch
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