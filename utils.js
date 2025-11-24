// utils.js - Các hàm tiện ích dùng chung (Helpers)
// Dữ liệu lấy từ assets.js (đã được load vào window)

// Hàm lấy random nhạc chờ
window.getRandomWaitingMusic = function() {
    const tracks = window.WAITING_MUSIC_TRACKS || [];
    if (tracks.length === 0) return null;
    const random = tracks[Math.floor(Math.random() * tracks.length)];
    return random;
};

// Hàm lấy random 1 file voice từ topic
window.getRandomVoice = function(topic) {
    if (!window.VOICE_MAP) return null;
    const files = window.VOICE_MAP[topic];
    if (!files || files.length === 0) return null;
    return files[Math.floor(Math.random() * files.length)];
};

window.hexToRgba = function(hex, alphaPercent) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const a = alphaPercent / 100;
    return `rgba(${r}, ${g}, ${b}, ${a})`;
};

window.getGradientString = function(theme) {
    if (!theme || !theme.colors) return 'linear-gradient(135deg, #667eea, #764ba2)';
    const rgbaColors = theme.colors.map(c => window.hexToRgba(c, theme.opacity));
    return `linear-gradient(${theme.angle}deg, ${rgbaColors.join(", ")})`;
};

window.isThemeDark = function(colors) {
    if (!colors || colors.length === 0) return false;
    let totalLum = 0;
    colors.forEach(hex => {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const lum = (0.299 * r + 0.587 * g + 0.114 * b);
        totalLum += lum;
    });
    return (totalLum / colors.length) < 140;
};

window.getTextColor = function(isDark) {
    return isDark ? '#f0f0f0' : '#333333';
};

window.escapeHTML = function(str) {
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
};

window.initCustomSelect = function(selectId) {
    const originalSelect = document.getElementById(selectId);
    if (!originalSelect) return;

    const existingWrapper = originalSelect.parentElement.querySelector('.custom-select-container');
    if (existingWrapper) existingWrapper.remove();

    const container = document.createElement("div");
    container.classList.add("custom-select-container");

    const trigger = document.createElement("div");
    trigger.classList.add("custom-select-trigger");

    const selectedOption = originalSelect.options[originalSelect.selectedIndex];
    trigger.textContent = selectedOption ? selectedOption.textContent : "Chọn...";

    const optionsDiv = document.createElement("div");
    optionsDiv.classList.add("custom-options");

    Array.from(originalSelect.options).forEach(opt => {
        const divOpt = document.createElement("div");
        divOpt.classList.add("custom-option");
        divOpt.textContent = opt.textContent;
        divOpt.dataset.value = opt.value;

        if (opt.disabled) {
            divOpt.classList.add("is-header");
        } else {
            divOpt.addEventListener("click", () => {
                originalSelect.value = opt.value; 
                trigger.textContent = opt.textContent; 

                container.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
                divOpt.classList.add('selected');

                const event = new Event('change');
                originalSelect.dispatchEvent(event);

                container.classList.remove("open");
            });
        }

        if (opt.style.fontWeight === "bold") {
            divOpt.style.fontWeight = "bold";
            divOpt.style.color = opt.style.color;
        }

        if (originalSelect.value === opt.value) {
            divOpt.classList.add("selected");
        }

        optionsDiv.appendChild(divOpt);
    });

    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-select-container.open').forEach(el => {
            if (el !== container) el.classList.remove('open');
        });
        container.classList.toggle("open");
    });

    container.appendChild(trigger);
    container.appendChild(optionsDiv);

    originalSelect.parentNode.insertBefore(container, originalSelect.nextSibling);
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-select-container")) {
        document.querySelectorAll(".custom-select-container.open").forEach(el => {
            el.classList.remove("open");
        });
    }
});

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        getRandomVoice: window.getRandomVoice,
        getRandomWaitingMusic: window.getRandomWaitingMusic,
        hexToRgba: window.hexToRgba,
        getGradientString: window.getGradientString,
        isThemeDark: window.isThemeDark,
        getTextColor: window.getTextColor,
        escapeHTML: window.escapeHTML,
        initCustomSelect: window.initCustomSelect
    };
}