let translateButton = null;
let popup = null;
let historyPopup = null;
let shadowRoot = null;
let currentThemeIsDark = false;
let hideButtonTimer = null;

const GRADIENT_DEFS_DARK = `
    <defs>
        <linearGradient id="gradThemeDark" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#FFCCFF" />
            <stop offset="100%" stop-color="#CCFFFF" />
        </linearGradient>
    </defs>
`;

const GRADIENT_DEFS_LIGHT = `
    <defs>
        <linearGradient id="gradThemeLight" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#FF0066" />
            <stop offset="50%" stop-color="#9900CC" />
            <stop offset="100%" stop-color="#6600FF" />
        </linearGradient>
    </defs>
`;

const ICONS_DARK = {
    history: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeDark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-history-icon lucide-history">${GRADIENT_DEFS_DARK}<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
    retranslate: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeDark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-languages-icon lucide-languages">${GRADIENT_DEFS_DARK}<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeDark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-icon lucide-clipboard">${GRADIENT_DEFS_DARK}<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeDark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-list-icon lucide-clipboard-list">${GRADIENT_DEFS_DARK}<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>`,
    speak: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeDark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume2-icon lucide-volume-2">${GRADIENT_DEFS_DARK}<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/></svg>`,
    stop: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeDark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-off-icon lucide-volume-off">${GRADIENT_DEFS_DARK}<path d="M16 9a5 5 0 0 1 .95 2.293"/><path d="M19.364 5.636a9 9 0 0 1 1.889 9.96"/><path d="m2 2 20 20"/><path d="m7 7-.587.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298V11"/><path d="M9.828 4.172A.686.686 0 0 1 11 4.657v.686"/></svg>`,
    loading: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeDark)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle-icon lucide-loader-circle ai-icon-spin">${GRADIENT_DEFS_DARK}<path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    back: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-undo-dot-icon lucide-undo-dot"><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/><path d="M3 7v6h6"/><circle cx="12" cy="17" r="1"/></svg>`
};

const ICONS_LIGHT = {
    history: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeLight)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-history-icon lucide-history">${GRADIENT_DEFS_LIGHT}<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>`,
    retranslate: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeLight)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-languages-icon lucide-languages">${GRADIENT_DEFS_LIGHT}<path d="m5 8 6 6"/><path d="m4 14 6-6 2-3"/><path d="M2 5h12"/><path d="M7 2h1"/><path d="m22 22-5-10-5 10"/><path d="M14 18h6"/></svg>`,
    copy: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeLight)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-icon lucide-clipboard">${GRADIENT_DEFS_LIGHT}<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>`,
    check: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeLight)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-clipboard-list-icon lucide-clipboard-list">${GRADIENT_DEFS_LIGHT}<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></svg>`,
    speak: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeLight)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume2-icon lucide-volume-2">${GRADIENT_DEFS_LIGHT}<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298z"/><path d="M16 9a5 5 0 0 1 0 6"/><path d="M19.364 18.364a9 9 0 0 0 0-12.728"/></svg>`,
    stop: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeLight)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-volume-off-icon lucide-volume-off">${GRADIENT_DEFS_LIGHT}<path d="M16 9a5 5 0 0 1 .95 2.293"/><path d="M19.364 5.636a9 9 0 0 1 1.889 9.96"/><path d="m2 2 20 20"/><path d="m7 7-.587.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298V11"/><path d="M9.828 4.172A.686.686 0 0 1 11 4.657v.686"/></svg>`,
    loading: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="url(#gradThemeLight)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-loader-circle-icon lucide-loader-circle ai-icon-spin">${GRADIENT_DEFS_LIGHT}<path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>`,
    close: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,
    back: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-undo-dot-icon lucide-undo-dot"><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/><path d="M3 7v6h6"/><circle cx="12" cy="17" r="1"/></svg>`
};

function getShadowRoot() {
    if (shadowRoot) return shadowRoot;
    
    const host = document.createElement('div');
    host.id = 'meou-extension-host';
    document.body.appendChild(host);
    
    shadowRoot = host.attachShadow({ mode: 'open' });
    
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = chrome.runtime.getURL('content.css');
    shadowRoot.appendChild(link);
    
    const style = document.createElement('style');
    style.textContent = `
        .ai-popup-back-to-translate {
            width: 30px !important;
            height: 30px !important;
            padding: 0 !important;
            border-radius: 50% !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            background: transparent !important;
            margin-left: auto;
        }
        .ai-popup-back-to-translate:hover {
            background: rgba(255, 255, 255, 0.2) !important;
        }
    `;
    shadowRoot.appendChild(style);

    return shadowRoot;
}

function updateIcons(isDark) {
    currentThemeIsDark = isDark;
    const icons = isDark ? ICONS_DARK : ICONS_LIGHT;

    if (popup) {
        const historyBtn = popup.querySelector(".ai-popup-show-history");
        const retranslateBtn = popup.querySelector(".ai-popup-retranslate");
        const copyBtn = popup.querySelector(".ai-popup-copy");
        const speakBtn = popup.querySelector(".ai-popup-speak");
        const closeBtn = popup.querySelector(".ai-popup-close");

        if (historyBtn) historyBtn.innerHTML = icons.history;
        if (retranslateBtn) retranslateBtn.innerHTML = icons.retranslate;
        if (copyBtn && !copyBtn.innerHTML.includes("clipboard-list")) copyBtn.innerHTML = icons.copy;
        
        // Logic icon Loa
        if (speakBtn && !speakBtn.classList.contains("loading")) {
             if(speakBtn.innerHTML.includes("volume-off")) speakBtn.innerHTML = icons.stop;
             else speakBtn.innerHTML = icons.speak;
        }
        if (closeBtn) closeBtn.innerHTML = icons.close;
    }

    if (historyPopup) {
        const backBtn = historyPopup.querySelector(".ai-popup-back-to-translate");
        const closeBtn = historyPopup.querySelector(".ai-popup-close-history");

        if (backBtn) backBtn.innerHTML = icons.back;
        if (closeBtn) closeBtn.innerHTML = icons.close;
    }
}

function applyThemeToElements() {
    chrome.storage.sync.get(['userTheme'], (data) => {
        const theme = data.userTheme || {
            colors: ["#6DD5FA", "#FFDA63"], 
            angle: 135,
            opacity: 100
        };

        const gradient = getGradientString(theme);
        const isDark = isThemeDark(theme.colors);
        const textColor = getTextColor(isDark);
        
        updateIcons(isDark);

        if (popup) {
            const header = popup.querySelector('.ai-popup-header');
            if (header) {
                header.style.background = gradient;
                header.style.color = textColor;
            }
        }

        if (historyPopup) {
            const header = historyPopup.querySelector('.ai-popup-header');
            if (header) {
                header.style.background = gradient;
                header.style.color = textColor;
            }
        }
    });
}

function createTranslateButton() {
    if (translateButton) return translateButton;

    translateButton = document.createElement("div");
    translateButton.id = "ai-translate-btn";
    translateButton.innerHTML = "🧐";
    translateButton.style.display = "none";
    getShadowRoot().appendChild(translateButton);

    translateButton.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        hideTranslateButton();
        if(typeof translateSelectedText === 'function') {
             await translateSelectedText({ clientX: e.clientX, clientY: e.clientY });
        }
    });

    return translateButton;
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

// --- POPUP CREATION LOGIC ---
function createPopup() {
    if (popup) return popup;

    popup = document.createElement("div");
    popup.id = "ai-translate-popup";
    popup.innerHTML = `
        <div class="ai-popup-content">
            <div class="ai-popup-header">
                <div class="ai-popup-title">🧐 Bản Dịch</div>
                
                <div class="ai-header-buttons">
                    <button class="ai-popup-show-history" title="Lịch sử">${ICONS_DARK.history}</button>
                    <button class="ai-popup-retranslate" title="Dịch lại">${ICONS_DARK.retranslate}</button>
                    <button class="ai-popup-copy" title="Copy bản dịch">${ICONS_DARK.copy}</button>
                    <button class="ai-popup-speak" title="Đọc văn bản">${ICONS_DARK.speak}</button>
                </div>
                <button class="ai-popup-close" title="Đóng">${ICONS_DARK.close}</button>
            </div>
            <div class="ai-popup-body">
                <div class="ai-translated">
                    <div class="ai-text ai-translated-text"></div>
                </div>
                </div>
            <div id="ai-lang-selector"></div>
        </div>
    `;
    getShadowRoot().appendChild(popup);
    
    applyThemeToElements();

    // Drag Logic
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
    document.addEventListener("mousemove", (e) => { onMove(e.clientX, e.clientY); });
    document.addEventListener("mouseup", (e) => { endDrag(); });
    header.addEventListener("touchstart", (e) => {
        const t = e.touches[0];
        if (!t || e.target.closest('button')) return;
        e.preventDefault();
        startDrag(t.clientX, t.clientY);
    }, { passive: false });
    document.addEventListener("touchmove", (e) => {
        if (!isDragging) return;
        const t = e.touches[0];
        if (!t) return;
        e.preventDefault();
        onMove(t.clientX, t.clientY);
    }, { passive: false });
    document.addEventListener("touchend", (e) => { endDrag(); });


    // Audio Logic
    let currentAudio = null;
    let currentAudioText = "";
    
    function resetAudioState() {
        const icons = currentThemeIsDark ? ICONS_DARK : ICONS_LIGHT;
        const speakBtn = popup.querySelector(".ai-popup-speak");
        
        if (currentAudio) {
            currentAudio.pause();
            currentAudio = null;
        }
        currentAudioText = "";
        
        if (speakBtn) {
            speakBtn.innerHTML = icons.speak;
            speakBtn.classList.remove("loading");
        }
    }
    
    popup.resetAudio = resetAudioState;

    const speakBtn = popup.querySelector(".ai-popup-speak");

    speakBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const icons = currentThemeIsDark ? ICONS_DARK : ICONS_LIGHT;
        const translatedDiv = popup.querySelector(".ai-translated-text");
        const textContent = translatedDiv.textContent;
        const isWaitingMode = translatedDiv.querySelector(".ai-loading") || textContent.includes("Đang dịch") || textContent.includes("Đợi");

        chrome.storage.sync.get(["audioVolume"], (data) => {
            const volume = data.audioVolume !== undefined ? data.audioVolume / 100 : 1.0;

            if (isWaitingMode) {
                if (currentAudio && currentAudioText === "WAITING_MUSIC") {
                    if (currentAudio.paused) {
                        currentAudio.volume = volume;
                        currentAudio.play();
                        speakBtn.innerHTML = icons.speak;
                    } else {
                        currentAudio.pause();
                        speakBtn.innerHTML = icons.stop;
                    }
                    return; 
                }
                
                resetAudioState();
                try {
                    const randomTrackPath = getRandomWaitingMusic(); 
                    const musicUrl = chrome.runtime.getURL(randomTrackPath);
                    currentAudio = new Audio(musicUrl);
                    currentAudioText = "WAITING_MUSIC"; 
                    currentAudio.volume = volume;
                    
                    speakBtn.innerHTML = icons.loading;
                    speakBtn.classList.add("loading");

                    currentAudio.play().then(() => { 
                        speakBtn.innerHTML = icons.speak;
                        speakBtn.classList.remove("loading");
                    }).catch(err => { 
                        console.error("Lỗi nhạc:", err); 
                        speakBtn.textContent = "❌"; 
                    });
                    
                    currentAudio.onended = () => { 
                        currentAudio = null; 
                        currentAudioText = ""; 
                        speakBtn.innerHTML = icons.speak; 
                    };
                } catch (err) { console.error(err); }
                return;
            }

            if (speakBtn.classList.contains("loading")) return;
            const textToSpeak = textContent;
            if (!textToSpeak || textToSpeak.length === 0) return;

            if (currentAudio && currentAudioText === textToSpeak) {
                if (currentAudio.paused) {
                    currentAudio.volume = volume;
                    currentAudio.play();
                    speakBtn.innerHTML = icons.speak; 
                } else {
                    currentAudio.pause();
                    speakBtn.innerHTML = icons.stop; 
                }
                return; 
            }

            resetAudioState();
            
            speakBtn.innerHTML = icons.loading;
            speakBtn.classList.add("loading");

            chrome.runtime.sendMessage({ action: "speak", text: textToSpeak }, (response) => {
                if (popup.style.display === "none") {
                    resetAudioState();
                    return;
                }
                
                if (response && response.success && response.audioBase64) {
                    try {
                        const audioData = atob(response.audioBase64);
                        const audioBytes = new Uint8Array(audioData.length);
                        for (let i = 0; i < audioData.length; i++) audioBytes[i] = audioData.charCodeAt(i);
                        const audioBlob = new Blob([audioBytes], { type: "audio/mp3" });
                        const audioUrl = URL.createObjectURL(audioBlob);
                        
                        currentAudio = new Audio(audioUrl);
                        currentAudioText = textToSpeak; 
                        currentAudio.playbackRate = 1;
                        currentAudio.volume = volume;
                        
                        currentAudio.play();
                        speakBtn.innerHTML = icons.speak; 
                        speakBtn.classList.remove("loading");
                        
                        currentAudio.onended = () => { 
                            currentAudio = null; 
                            currentAudioText = ""; 
                            speakBtn.innerHTML = icons.speak; 
                        };
                    } catch (err) { 
                        console.error(err); 
                        speakBtn.innerHTML = icons.speak; 
                        speakBtn.classList.remove("loading"); 
                    }
                } else { 
                    speakBtn.innerHTML = icons.speak; 
                    speakBtn.classList.remove("loading"); 
                }
            });
        });
    });

    const langSelector = popup.querySelector("#ai-lang-selector");
    popup.querySelector(".ai-popup-close").addEventListener("click", () => {
        resetAudioState();
        popup.style.display = "none";
        langSelector.style.display = "none";
    });

    const copyBtn = popup.querySelector(".ai-popup-copy");
    copyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const icons = currentThemeIsDark ? ICONS_DARK : ICONS_LIGHT;
        const textToCopy = popup.querySelector(".ai-translated-text").textContent;
        if (textToCopy) {
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyBtn.innerHTML = icons.check;
                setTimeout(() => { copyBtn.innerHTML = icons.copy; }, 3000);
            }).catch(err => {
                console.error("Lỗi copy:", err);
                copyBtn.textContent = "❌";
                 setTimeout(() => { copyBtn.innerHTML = icons.copy; }, 3000);
            });
        }
    });

    const retranslateBtn = popup.querySelector(".ai-popup-retranslate");
    supportedLangs.forEach(lang => {
        const langBtn = document.createElement("button");
        langBtn.className = "ai-lang-btn";
        langBtn.textContent = lang.name;
        langBtn.dataset.langCode = lang.code;
        langSelector.appendChild(langBtn);
    });

    retranslateBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        langSelector.style.display = langSelector.style.display === "block" ? "none" : "block";
    });

    langSelector.addEventListener("click", (e) => {
        const btn = e.target.closest(".ai-lang-btn");
        if (btn) {
            const langCode = btn.dataset.langCode;
            const textToTranslate = window.selectedText || "";
            const translatedDiv = popup.querySelector(".ai-translated-text");

            if (!textToTranslate || !langCode) return;

            langSelector.style.display = "none";
            resetAudioState();
            translatedDiv.innerHTML = '<div class="ai-loading">Đợi bố mày tí...</div>';

            chrome.runtime.sendMessage(
                { action: "translate", text: textToTranslate, targetLangOverride: langCode }, 
                (response) => {
                    if (response.success) {
                        translatedDiv.textContent = response.translation;
                    } else {
                        translatedDiv.style.whiteSpace = 'normal';
                        translatedDiv.innerHTML = `<div class="ai-error">❌ ${response.error}</div>`;
                    }
                }
            );
        }
    });

    const historyBtn = popup.querySelector(".ai-popup-show-history");
    historyBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        resetAudioState();
        showHistoryPopup();
    });

    return popup;
}

function createHistoryPopup() {
    if (historyPopup) return historyPopup;

    historyPopup = document.createElement("div");
    historyPopup.id = "ai-history-popup";
    historyPopup.innerHTML = `
        <div class="ai-popup-content">
            <div class="ai-popup-header">
                <div class="ai-popup-title">Lịch Sử Dịch</div>
                <div class="ai-header-buttons">
                    <button class="ai-popup-back-to-translate" title="Quay lại">${ICONS_DARK.back}</button> 
                </div>
                <button class="ai-popup-close-history" title="Đóng" style="margin-left: 8px;">${ICONS_DARK.close}</button>
            </div>
            <div id="ai-history-body" class="ai-popup-body">
                <div id="ai-history-list">
                    </div>
                <div id="ai-no-history" style="display: none;">Chưa có lịch sử</div>
            </div>
        </div>
    `;
    getShadowRoot().appendChild(historyPopup);
    
    applyThemeToElements();

    historyPopup.querySelector('.ai-popup-close-history').addEventListener('click', () => {
        historyPopup.style.display = 'none';
    });

    historyPopup.querySelector('.ai-popup-back-to-translate').addEventListener('click', () => {
        historyPopup.style.display = 'none';
        if (popup) {
            popup.style.display = 'block';
        }
    });

    const header = historyPopup.querySelector(".ai-popup-header");
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
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
        const rect = historyPopup.getBoundingClientRect();
        isDragging = true;
        historyPopup.classList.add("ai-dragging");
        dragOffsetX = clientX - rect.left;
        dragOffsetY = clientY - rect.top;
     }
    function onMove(clientX, clientY) {
        if (!isDragging) return;
        let x = clientX - dragOffsetX;
        let y = clientY - dragOffsetY;
        const pos = clampPosition(x, y, historyPopup);
        historyPopup.style.left = pos.x + "px";
        historyPopup.style.top = pos.y + "px";
    }
    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        historyPopup.classList.remove("ai-dragging");
    }
    header.addEventListener("mousedown", (e) => {
        if (e.button !== 0 || e.target.closest('button')) return;
        e.preventDefault(); startDrag(e.clientX, e.clientY);
    });
    document.addEventListener("mousemove", (e) => { onMove(e.clientX, e.clientY); });
    document.addEventListener("mouseup", (e) => { endDrag(); });

    return historyPopup;
}

function showHistoryPopup() {
    const hPopup = createHistoryPopup();
    if (popup) {
        popup.style.display = 'none';
        popup.querySelector("#ai-lang-selector").style.display = "none";
    }
    if (popup && popup.style.left) {
        hPopup.style.left = popup.style.left;
        hPopup.style.top = popup.style.top;
    } else {
        hPopup.style.left = '100px';
        hPopup.style.top = '100px';
    }
    hPopup.style.display = 'block';
    loadHistoryInPage();
}

async function loadHistoryInPage() {
    const historyList = historyPopup.querySelector('#ai-history-list');
    const noHistory = historyPopup.querySelector('#ai-no-history');
    historyList.innerHTML = '';
    noHistory.style.display = 'none';

    chrome.runtime.sendMessage({ action: "getHistory" }, (response) => {
        if (response && response.history && response.history.length > 0) {
            response.history.forEach(item => {
                const el = document.createElement('div');
                el.className = 'ai-history-item'; 
                el.innerHTML = `<div class="history-text-original">${escapeHTML(item.original)}</div><div class="history-text-translation">${escapeHTML(item.translation)}</div>`;
                historyList.appendChild(el);
            });
        } else { noHistory.style.display = 'block'; }
    });
}