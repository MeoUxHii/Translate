// Gán các biến và hàm vào window để dùng chung (Content Script không hỗ trợ module import trực tiếp dễ dàng)

window.supportedLangs = [
    { code: "vi-VN", name: "Tiếng Việt" },
    { code: "en-US", name: "Tiếng Anh" },
    { code: "zh-CN", name: "Tiếng Trung" },
    { code: "ja-JP", name: "Tiếng Nhật" },
    { code: "ko-KR", name: "Tiếng Hàn" },
    { code: "fr-FR", name: "Tiếng Pháp" },
    { code: "de-DE", name: "Tiếng Đức" },
    { code: "es-ES", name: "Tiếng Tây Ban Nha" }
];

window.IMAGE_MAP = {
    "1": "pictures/1.webp",
    "2": "pictures/2.webp",
    "3": "pictures/3.webp",
    "4": "pictures/4.webp",
    "5": "pictures/5.webp",
    "6": "pictures/6.webp",
    "7": "pictures/7.webp",
    "8": "pictures/8.webp",
    "9": "pictures/9.webp",
    "10": "pictures/10.webp",
    "11": "pictures/11.webp",
    "12": "pictures/12.webp",
    "13": "pictures/13.webp"
};

window.VOICE_MAP = {
    "an_gi_chua": [
        "voice/an_gi_chua/an_gi_chua.mp3"
    ],
    "anh_iu_em_ko": [
        "voice/anh_iu_em_ko/anh-co-yeu-em-khong.mp3"
    ],
    "chuc_ngu_ngon": [
        "voice/chuc_ngu_ngon/anh-ngu-som-di.mp3",
        "voice/chuc_ngu_ngon/chuc_anh_ngu_ngon.mp3",
        "voice/chuc_ngu_ngon/chuc_ngu_ngon.mp3"
    ],
    "dan_do": [
        "voice/dan_do/thoi_tiet_thay_doi.mp3"
    ],
    "em_nho_anh": [
        "voice/em_nho_anh/em_cung_nho_anh.mp3"
    ],
    "gian_doi": [
        "voice/gian_doi/sao_anh_chua_ve.mp3"
    ],
    "hoi_han": [
        "voice/hoi_han/anh_di_lam_ve_chua_1.mp3",
        "voice/hoi_han/anh_di_lam_ve_chua_2.mp3",
        "voice/hoi_han/hoi_han.mp3"
    ],
    "tuc_gian": [
        "voice/tuc_gian/dan_doi_vi_map_mo.mp3"
    ],
    "ui_thuong_the": [
        "voice/ui_thuong_the/ui_thuong_the.mp3"
    ]
};

// Danh sách nhạc chờ (bổ sung để fix lỗi thiếu hàm)
const WAITING_MUSIC_TRACKS = [
    "media/2.mp3", "media/3.mp3", "media/4.mp3", 
    "media/5.mp3", "media/7.mp3", "media/8.mp3", 
    "media/9.mp3", "media/10.mp3", "media/11.mp3",
    "media/12.mp3", "media/13.mp3"
];

// Hàm lấy random nhạc chờ
window.getRandomWaitingMusic = function() {
    if (WAITING_MUSIC_TRACKS.length === 0) return null;
    const random = WAITING_MUSIC_TRACKS[Math.floor(Math.random() * WAITING_MUSIC_TRACKS.length)];
    return random;
};

// Hàm lấy random 1 file voice từ topic
window.getRandomVoice = function(topic) {
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

// Hỗ trợ module export cho môi trường module (như Popup)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        supportedLangs: window.supportedLangs,
        IMAGE_MAP: window.IMAGE_MAP,
        VOICE_MAP: window.VOICE_MAP,
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