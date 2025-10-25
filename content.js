let translateButton = null;
let popup = null;
let selectedText = "";
let selectionRange = null;
let hideButtonTimer = null;

function createTranslateButton() {
    if (translateButton) return translateButton;

    translateButton = document.createElement("div");
    translateButton.id = "ai-translate-btn";
    translateButton.innerHTML = "🧐";
    translateButton.style.display = "none";
    document.body.appendChild(translateButton);

    translateButton.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await translateSelectedText();
    });

    return translateButton;
}

function createPopup() {
    if (popup) return popup;

    popup = document.createElement("div");
    popup.id = "ai-translate-popup";
    popup.innerHTML = `
        <div class="ai-popup-content">
            <div class="ai-popup-header">
                🤨 <span class="ai-popup-title">Bản Dịch</span>
                
                <div class="ai-header-buttons">
                    <button class="ai-popup-speak" title="Đọc văn bản">🔊</button>
                    <button class="ai-popup-close">&times;</button>
                </div>
            </div>
            <div class="ai-popup-body">
                <div class="ai-translated">
                    <div class="ai-text ai-translated-text"></div>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(popup);
    
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    const header = popup.querySelector(".ai-popup-header");

    function clampPosition(x, y, popupEl) {
        const pad = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = popupEl.getBoundingClientRect();
        const maxX = vw - rect.width - pad;
        const maxY = vh - rect.height - pad;
        const nx = Math.min(Math.max(x, pad), Math.max(maxX, pad));
        const ny = Math.min(Math.max(y, pad), Math.max(maxY, pad));
        return { x: nx, y: ny };
    }

    function startDrag(clientX, clientY) {
        const rect = popup.getBoundingClientRect();
        isDragging = true;
        popup.classList.add("ai-dragging");
        dragOffsetX = clientX - rect.left;
        dragOffsetY = clientY - rect.top;
    }

    function onMove(clientX, clientY) {
        if (!isDragging) return;
        let x = clientX - dragOffsetX;
        let y = clientY - dragOffsetY;
        const pos = clampPosition(x, y, popup);
        popup.style.left = pos.x + "px";
        popup.style.top = pos.y + "px";
    }

    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        popup.classList.remove("ai-dragging");
        const left = parseFloat(popup.style.left) || 0;
        const top = parseFloat(popup.style.top) || 0;
        chrome.storage.sync.set({ popupPos: { left, top } });
    }

    header.addEventListener("mousedown", (e) => {
        if (e.button !== 0) return;
        if (e.target.closest('button')) return;
        e.preventDefault();
        startDrag(e.clientX, e.clientY);
    });

    document.addEventListener("mousemove", (e) => {
        onMove(e.clientX, e.clientY);
    });

    document.addEventListener("mouseup", (e) => {
        endDrag();
    });

    header.addEventListener(
        "touchstart",
        (e) => {
            const t = e.touches[0];
            if (!t) return;
            if (e.target.closest('button')) return;
            e.preventDefault();
            startDrag(t.clientX, t.clientY);
        },
        { passive: false }
    );

    document.addEventListener(
        "touchmove",
        (e) => {
            if (!isDragging) return;
            const t = e.touches[0];
            if (!t) return;
            e.preventDefault();
            onMove(t.clientX, t.clientY);
        },
        { passive: false }
    );

    document.addEventListener("touchend", (e) => {
        endDrag();
    });

    let currentAudio = null;
    let currentAudioText = "";

    function stopAudio() {
        if (currentAudio) {
            currentAudio.pause();
            currentAudio.currentTime = 0;
            currentAudio = null;
            currentAudioText = "";
            
            const speakBtn = popup.querySelector(".ai-popup-speak");
            if (speakBtn) {
                speakBtn.textContent = "🔊";
                speakBtn.classList.remove("loading");
            }
        }
    }

    popup.querySelector(".ai-popup-close").addEventListener("click", () => {
        stopAudio();
        popup.style.display = "none";
    });

    const speakBtn = popup.querySelector(".ai-popup-speak");
    speakBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const textToSpeak = popup.querySelector(".ai-translated-text").textContent;
        
        if (!textToSpeak || textToSpeak.length === 0) return;
        
        if (currentAudio && currentAudioText === textToSpeak) {
            currentAudio.play();
            return;
        }

        if (speakBtn.classList.contains("loading")) return;

        stopAudio();
        speakBtn.textContent = "⏳";
        speakBtn.classList.add("loading");

        chrome.runtime.sendMessage(
            { action: "speak", text: textToSpeak }, 
            (response) => {
                if (response && response.success && response.audioBase64) {
                    try {
                        const audioData = atob(response.audioBase64);
                        const audioBytes = new Uint8Array(audioData.length);
                        for (let i = 0; i < audioData.length; i++) {
                            audioBytes[i] = audioData.charCodeAt(i);
                        }
                        const audioBlob = new Blob([audioBytes], { type: "audio/mp3" });
                        const audioUrl = URL.createObjectURL(audioBlob);
                        
                        currentAudio = new Audio(audioUrl);
                        currentAudioText = textToSpeak;
                        
                        currentAudio.playbackRate = 1.25;
                        
                        currentAudio.play();

                        speakBtn.textContent = "🔊";
                        speakBtn.classList.remove("loading");

                        currentAudio.onended = () => {
                            currentAudio = null;
                            currentAudioText = "";
                        };

                        currentAudio.onerror = () => {
                            throw new Error("Lỗi phát audio blob");
                        }
                    } catch (err) {
                        console.error("Lỗi xử lý audio base64:", err);
                        speakBtn.textContent = "🔊";
                        speakBtn.classList.remove("loading");
                    }
                } else {
                    console.error("Lỗi GCP TTS:", response.error);
                    speakBtn.textContent = "🔊";
                    speakBtn.classList.remove("loading");
                }
            }
        );
    });

    document.addEventListener("mousedown", (e) => {
        if (
            popup.style.display === "block" &&
            !popup.contains(e.target) &&
            !translateButton.contains(e.target)
        ) {
            stopAudio();
            popup.style.display = "none";
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && popup.style.display === "block") {
            stopAudio();
            popup.style.display = "none";
        }
    });

    return popup;
}

function showTranslateButton(x, y) {
    if (!translateButton) {
        translateButton = createTranslateButton();
    }

    const buttonWidth = 50; 
    const buttonHeight = 50;
    const pad = 10;

    let left = x + 10;
    let top = y + 10;

    if (left + buttonWidth + pad > window.innerWidth + window.scrollX) {
        left = x - buttonWidth - 5;
    }
    if (top + buttonHeight + pad > window.innerHeight + window.scrollY) {
        top = y - buttonHeight - 5;
    }

    translateButton.style.left = `${left}px`;
    translateButton.style.top = `${top}px`;
    translateButton.style.display = "flex";
    if (hideButtonTimer) {
        clearTimeout(hideButtonTimer);
    }
    hideButtonTimer = setTimeout(() => {
        hideTranslateButton();
    }, 2000);
}

function hideTranslateButton() {
    if (translateButton) {
        translateButton.style.display = "none";
    }
    if (hideButtonTimer) {
        clearTimeout(hideButtonTimer);
        hideButtonTimer = null;
    }
}

document.addEventListener("mouseup", (e) => {
    if (
        (translateButton && translateButton.contains(e.target)) ||
        (popup && popup.contains(e.target)) ||
        (e.target.closest && e.target.closest("#ai-translate-popup")) 
    ) {
        return;
    }

    if (popup && popup.classList.contains("ai-dragging")) {
        return;
    }

    const text = window.getSelection().toString().trim();

    if (text.length > 0) {
        selectedText = text;
        selectionRange = window.getSelection().getRangeAt(0).cloneRange();
        
        showTranslateButton(e.pageX, e.pageY); 

    } else {
        hideTranslateButton();
    }
});

async function translateSelectedText() {
    if (!selectedText) return;

    const popupEl = createPopup();
    const translatedDiv = popupEl.querySelector(".ai-translated-text");
    const titleEl = popupEl.querySelector(".ai-popup-title");

    titleEl.textContent = "Bản Dịch";
    translatedDiv.style.whiteSpace = 'pre-wrap'; 
    translatedDiv.innerHTML = '<div class="ai-loading">Đợi tí...</div>';
    hideTranslateButton();

    try {
        const rect = selectionRange.getBoundingClientRect();
        popupEl.style.left = `${window.scrollX + rect.left}px`;
        popupEl.style.top = `${window.scrollY + rect.bottom + 8}px`;
    } catch (error) {}
    
    popupEl.style.display = "block";
    
    const clamped = (function () {
        const pad = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = popupEl.getBoundingClientRect();
        let left = rect.left;
        let top = rect.top;
        const maxLeft = vw - rect.width - pad;
        const maxTop = vh - rect.height - pad;
        left = Math.min(Math.max(left, pad), Math.max(maxLeft, pad));
        top = Math.min(Math.max(top, pad), Math.max(maxTop, pad));
        return { left, top };
    })();

    popupEl.style.left = clamped.left + "px";
    popupEl.style.top = clamped.top + "px";

    try {
        const result = await chrome.runtime.sendMessage({
            action: "translate",
            text: selectedText,
        });

        if (result.success) {
            translatedDiv.textContent = result.translation;
        } else {
            translatedDiv.style.whiteSpace = 'normal';
            translatedDiv.innerHTML = `<div class="ai-error">❌ ${result.error}</div>`;
        }
    } catch (error) {
        translatedDiv.style.whiteSpace = 'normal';
        translatedDiv.innerHTML = `<div class="ai-error">❌ Lỗi: ${error.message}</div>`;
    }
}

async function positionAndShowImagePopup(popupEl) {
     try {
        const data = await chrome.storage.sync.get(["popupPos"]);
        const saved = data.popupPos;
        if (saved && typeof saved.left === "number" && typeof saved.top === "number") {
            popupEl.style.left = saved.left + "px";
            popupEl.style.top = saved.top + "px";
        } else {
            const popupWidth = 400; 
            popupEl.style.left = `${(window.innerWidth - popupWidth) / 2}px`;
            popupEl.style.top = `20px`;
        }
    } catch (error) {
        const popupWidth = 400;
        popupEl.style.left = `${(window.innerWidth - popupWidth) / 2}px`;
        popupEl.style.top = `20px`;
    }
    
    popupEl.style.display = "block";

    const clamped = (function () {
        const pad = 8;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const rect = popupEl.getBoundingClientRect(); 
        let left = rect.left;
        let top = rect.top;
        const maxLeft = vw - rect.width - pad;
        const maxTop = vh - rect.height - pad;
        left = Math.min(Math.max(left, pad), Math.max(maxLeft, pad));
        top = Math.min(Math.max(top, pad), Math.max(maxTop, pad));
        return { left, top };
    })();

    popupEl.style.left = clamped.left + "px";
    popupEl.style.top = clamped.top + "px";
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === "translate-shortcut") {
        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (text.length > 0) {
            selectedText = text;
            selectionRange = selection.getRangeAt(0).cloneRange();
            await translateSelectedText();
        }
        return; 
    }

    if (request.action === "show_loading_popup" || request.action === "update_loading_popup") {
        const popupEl = createPopup();
        const titleEl = popupEl.querySelector(".ai-popup-title");
        const translatedDiv = popupEl.querySelector(".ai-translated-text");

        if (titleEl) titleEl.textContent = request.title;
        translatedDiv.style.whiteSpace = 'pre-wrap';
        translatedDiv.innerHTML = '<div class="ai-loading">Đợi tí...</div>';
        
        if (popupEl.style.display !== 'block') {
            await positionAndShowImagePopup(popupEl);
        }
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
        
        if (popupEl.style.display !== 'block') {
            await positionAndShowImagePopup(popupEl);
        }
        return; 
    }
});


document.addEventListener("keydown", async (e) => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "t") {
        e.preventDefault();
        const selection = window.getSelection();
        const text = selection.toString().trim();
        if (text.length > 0) {
            selectedText = text;
            selectionRange = selection.getRangeAt(0).cloneRange();
            await translateSelectedText();
        }
    }
});

document.addEventListener("mousedown", (e) => {
    if (translateButton && !translateButton.contains(e.target)) {
        setTimeout(() => {
            const selection = window.getSelection();
            if (selection.toString().trim().length === 0) {
                hideTranslateButton();
            }
        }, 10);
    }
});

createTranslateButton();
createPopup();
