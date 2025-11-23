const supportedLangs = [
    { code: "vi-VN", name: "Tiếng Việt" },
    { code: "en-US", name: "Tiếng Anh" },
    { code: "zh-CN", name: "Tiếng Trung" },
    { code: "ja-JP", name: "Tiếng Nhật" },
    { code: "ko-KR", name: "Tiếng Hàn" },
    { code: "fr-FR", name: "Tiếng Pháp" },
    { code: "de-DE", name: "Tiếng Đức" },
    { code: "es-ES", name: "Tiếng Tây Ban Nha" }
];

const waitingMusicList = ["media/emdenlam.mp3"];
for (let i = 1; i <= 13; i++) {
    waitingMusicList.push(`media/${i}.mp3`);
}

let lastPlayedMusicIndex = -1;

function getRandomWaitingMusic() {
    if (waitingMusicList.length === 1) return waitingMusicList[0];

    let newIndex;
    do {
        newIndex = Math.floor(Math.random() * waitingMusicList.length);
    } while (newIndex === lastPlayedMusicIndex);

    lastPlayedMusicIndex = newIndex;
    return waitingMusicList[newIndex];
}

function hexToRgba(hex, alphaPercent) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = alphaPercent / 100;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function getGradientString(theme) {
    if (!theme || !theme.colors) return 'linear-gradient(135deg, #667eea, #764ba2)'; // Default fallback
    const rgbaColors = theme.colors.map(c => hexToRgba(c, theme.opacity));
    return `linear-gradient(${theme.angle}deg, ${rgbaColors.join(", ")})`;
}

function isThemeDark(colors) {
    if (!colors || colors.length === 0) return false;
    let totalLum = 0;
    colors.forEach(hex => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const lum = (0.299 * r + 0.587 * g + 0.114 * b);
        totalLum += lum;
    });
    const avgLum = totalLum / colors.length;
    return avgLum < 140;
}

function getTextColor(isDark) {
    return isDark ? '#f0f0f0' : '#333333';
}

function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, function(m) {
        return {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[m];
    });
}

function analyzeBrightness(canvas) {
    try {
        const ctx = canvas.getContext('2d');
        const sampleSize = 30; 
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sampleSize;
        tempCanvas.height = sampleSize;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0, sampleSize, sampleSize);
        
        const imageData = tempCtx.getImageData(0, 0, sampleSize, sampleSize);
        const data = imageData.data;
        
        let totalBrightness = 0;
        let count = 0;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const brightness = (r * 299 + g * 587 + b * 114) / 1000;
            totalBrightness += brightness;
            count++;
        }

        const avgBrightness = totalBrightness / count;
        
        return avgBrightness < 100 ? 'dark' : 'light';

    } catch (e) {
        console.error(e);
        return 'light'; 
    }
}