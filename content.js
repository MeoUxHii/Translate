window.selectedText = "";
let selectionRange = null;

createTranslateButton();

document.addEventListener("mouseup", (e) => {
    // Sử dụng biến toàn cục window.isWibuMode và window.isSelecting
    if (window.isWibuMode && window.isSelecting) {
        window.isSelecting = false;
        if (!window.selectionBox) return;
        
        const rect = window.selectionBox.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        
        if (width > 10 && height > 10) {
            processSelection(rect.left, rect.top, width, height);
        } else {
            if (window.selectionBox) window.selectionBox.style.display = 'none';
        }
        return;
    }

    const path = e.composedPath();
    if (
        path.some(el => el === translateButton) ||
        path.some(el => el === popup) ||
        path.some(el => el === historyPopup) ||
        path.some(el => el.id === "ai-translate-popup") ||
        path.some(el => el.id === "ai-history-popup")
    ) return;
    
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
        if (typeof popup.resetAudio === 'function') popup.resetAudio();
        
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