// Khởi tạo biến toàn cục để content.js có thể truy cập
window.isWibuMode = false;
window.selectionBox = null;
window.isSelecting = false;

// Biến cục bộ (không cần chia sẻ)
let startX, startY;

function showToast(message) {
    const toast = document.createElement("div");
    toast.className = "wibu-toast";
    toast.textContent = message;
    getShadowRoot().appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}

function toggleWibuMode() {
    window.isWibuMode = !window.isWibuMode;
    if (window.isWibuMode) {
        document.body.classList.add("wibu-mode-active");
        showToast("✨ Wibu Mode: ON");
    } else {
        document.body.classList.remove("wibu-mode-active");
        showToast("🐶 Wibu Mode: OFF");
        if (window.selectionBox) window.selectionBox.style.display = 'none';
    }
}

function createSelectionBox() {
    if (window.selectionBox) return window.selectionBox;
    window.selectionBox = document.createElement("div");
    window.selectionBox.id = "wibu-selection-box";
    getShadowRoot().appendChild(window.selectionBox);
    return window.selectionBox;
}

function fitText(container, text) {
    container.innerHTML = text;
    let fontSize = 100; 
    container.style.fontSize = fontSize + "px";
    while ((container.scrollHeight > container.clientHeight || container.scrollWidth > container.clientWidth) && fontSize > 10) {
        fontSize -= 2; 
        container.style.fontSize = fontSize + "px";
    }
}

function createMangaOverlay(x, y, width, height, theme = 'light') {
    const box = document.createElement("div");
    box.className = "manga-overlay-box";
    box.classList.add(theme === 'dark' ? 'glass-dark' : 'glass-light');
    box.style.left = (x + window.scrollX) + "px";
    box.style.top = (y + window.scrollY) + "px";
    box.style.width = width + "px";
    box.style.height = height + "px";

    const closeBtn = document.createElement("div");
    closeBtn.className = "manga-close-btn";
    closeBtn.innerHTML = "&times;";
    closeBtn.onclick = (e) => { e.stopPropagation(); box.remove(); };
    box.appendChild(closeBtn);

    const content = document.createElement("div");
    content.className = "manga-text-content";
    content.innerHTML = '<div class="manga-loading">Đang dịch...</div>';
    
    box.appendChild(content);
    getShadowRoot().appendChild(box);
    
    return { box, content };
}

// Hàm phân tích độ sáng (đơn giản hóa để chạy trong file này hoặc lấy từ global nếu có)
function analyzeBrightnessSimple(canvas) {
    // Logic đơn giản hoặc gọi hàm từ utils nếu đã gán window
    // Tạm thời trả về 'light' nếu chưa implement sâu
    return 'light';
}

async function processSelection(x, y, w, h) {
    if (window.selectionBox) window.selectionBox.style.display = 'none';
    try {
        chrome.runtime.sendMessage({ action: "capture_visible_tab" }, (response) => {
            if (chrome.runtime.lastError || !response || response.error) {
                showToast("Lỗi chụp: " + (chrome.runtime.lastError?.message));
                return;
            }
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement("canvas");
                const ctx = canvas.getContext("2d");
                const ratio = window.devicePixelRatio || 1;
                canvas.width = w;
                canvas.height = h;
                ctx.drawImage(img, x * ratio, y * ratio, w * ratio, h * ratio, 0, 0, w, h);
                
                // Gọi hàm analyzeBrightness nếu nó tồn tại global, không thì dùng default
                const brightnessTheme = (typeof window.analyzeBrightness === 'function') ? window.analyzeBrightness(canvas) : 'light';
                
                const { content, box } = createMangaOverlay(x, y, w, h, brightnessTheme);
                const croppedDataUrl = canvas.toDataURL("image/jpeg");
                chrome.runtime.sendMessage({ action: "translate_image_data", imageData: croppedDataUrl }, (transResponse) => {
                    if (transResponse && transResponse.success) { fitText(content, transResponse.translation); } 
                    else { content.innerHTML = `<span style="color:red;font-size:12px">Error</span>`; }
                });
            };
            img.src = response.dataUrl;
        });
    } catch (e) { console.error(e); }
}

(function injectGlobalCursorStyle() {
    const style = document.createElement('style');
    style.textContent = `
        body.wibu-mode-active, body.wibu-mode-active * { cursor: crosshair !important; user-select: none !important; }
    `;
    if (document.head) document.head.appendChild(style);
    else document.addEventListener('DOMContentLoaded', () => { document.head.appendChild(style); });
})();