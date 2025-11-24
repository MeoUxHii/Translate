// assets.js - Chứa dữ liệu tĩnh (Data & Config)
// Được load trước các file logic khác để gán dữ liệu vào window

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

// Cấu trúc ảnh theo folder
window.IMAGE_MAP = {
    // --- ĐI CHƠI (1-8) ---
    "di_choi_1": "pictures/di_choi/1.webp",
    "di_choi_2": "pictures/di_choi/2.webp",
    "di_choi_3": "pictures/di_choi/3.webp",
    "di_choi_4": "pictures/di_choi/4.webp",
    "di_choi_5": "pictures/di_choi/5.webp",
    "di_choi_6": "pictures/di_choi/6.webp",
    "di_choi_7": "pictures/di_choi/7.webp",
    "di_choi_8": "pictures/di_choi/8.webp",

    // --- ĐI LÀM (1-5) ---
    "di_lam_1": "pictures/di_lam/1.webp",
    "di_lam_2": "pictures/di_lam/2.webp",
    "di_lam_3": "pictures/di_lam/3.webp",
    "di_lam_4": "pictures/di_lam/4.webp",
    "di_lam_5": "pictures/di_lam/5.webp",

    // --- Ở NHÀ (1-9) ---
    "o_nha_1": "pictures/o_nha/1.webp",
    "o_nha_2": "pictures/o_nha/2.webp",
    "o_nha_3": "pictures/o_nha/3.webp",
    "o_nha_4": "pictures/o_nha/4.webp",
    "o_nha_5": "pictures/o_nha/5.webp",
    "o_nha_6": "pictures/o_nha/6.webp",
    "o_nha_7": "pictures/o_nha/7.webp",
    "o_nha_8": "pictures/o_nha/8.webp",
    "o_nha_9": "pictures/o_nha/9.webp"
};

window.VOICE_MAP = {
    "an_gi_chua": [
        "voice/an_gi_chua/1.mp3"
    ],
    "anh_iu_em_ko": [
        "voice/anh_iu_em_ko/1.mp3",
        "voice/anh_iu_em_ko/2.mp3",
        "voice/anh_iu_em_ko/3.mp3",
        "voice/anh_iu_em_ko/4.mp3"
    ],
    "chuc_ngu_ngon": [
        "voice/chuc_ngu_ngon/1.mp3",
        "voice/chuc_ngu_ngon/2.mp3",
        "voice/chuc_ngu_ngon/3.mp3"
    ],
    "dan_do": [
        "voice/dan_do/1.mp3"
    ],
    "em_nho_anh": [
        "voice/em_nho_anh/1.mp3"
    ],
    "gian_doi": [
        "voice/gian_doi/1.mp3"
    ],
    "hoi_han": [
        "voice/hoi_han/1.mp3",
        "voice/hoi_han/2.mp3",
        "voice/hoi_han/3.mp3"
    ],
    "chia_tay": [
        "voice/tuc_gian/1.mp3",
        "voice/tuc_gian/2.mp3"
    ],
    "ui_thuong_the": [
        "voice/ui_thuong_the/1.mp3"
    ],
    "sao_chua_ngu": [
        "voice/sao_chua_ngu/1.mp3"
    ]
    
};

// Danh sách nhạc chờ
window.WAITING_MUSIC_TRACKS = [
    "media/2.mp3", "media/3.mp3", "media/4.mp3", 
    "media/5.mp3", "media/7.mp3", "media/8.mp3", 
    "media/9.mp3", "media/10.mp3", "media/11.mp3",
    "media/12.mp3", "media/13.mp3"
];

// Hỗ trợ export module cho môi trường test (nếu cần)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        supportedLangs: window.supportedLangs,
        IMAGE_MAP: window.IMAGE_MAP,
        VOICE_MAP: window.VOICE_MAP,
        WAITING_MUSIC_TRACKS: window.WAITING_MUSIC_TRACKS
    };
}