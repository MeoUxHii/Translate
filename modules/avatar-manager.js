// Module quản lý Avatar và hiển thị ảnh phóng to
export const AVATAR_MAP = {
    "dan_chuyen": "avatar/avatar_dan_chuyen.png",
    "lao_vo_cung": "avatar/avatar_lao_vo_cung.png",
    "be_cung": "avatar/avatar_be_cung.png",
    "mot_con_meo": "avatar/avatar_mot_con_meo.png"
};

const CACHED_AVATARS = {};

// Xử lý ảnh để cache (tăng tốc độ load)
const processAvatar = async (src) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = src;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const size = 128;
            canvas.width = size;
            canvas.height = size;
            const minDim = Math.min(img.width, img.height);
            const sx = (img.width - minDim) / 2;
            const sy = (img.height - minDim) / 2;
            ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (e) => { resolve(src); };
    });
};

// Hàm khởi tạo tối ưu avatar (gọi 1 lần khi init)
export async function optimizeAvatars() {
    for (const [tone, src] of Object.entries(AVATAR_MAP)) {
        try {
            const optimizedDataUrl = await processAvatar(src);
            CACHED_AVATARS[tone] = optimizedDataUrl;
            const existingImgs = document.querySelectorAll(`.chat-avatar[data-tone="${tone}"]`);
            existingImgs.forEach(img => img.src = optimizedDataUrl);
        } catch (e) { console.error(e); }
    }
}

// Lấy src avatar đã cache
export function getAvatarSrc(tone) {
    return CACHED_AVATARS[tone] || AVATAR_MAP[tone] || "icon48.png";
}

// Hiển thị modal xem ảnh full size
export function showAvatarModal(src, currentTone = null) {
    let modal = document.getElementById('avatar-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'avatar-modal';
        modal.innerHTML = '<span class="close-modal">&times;</span><img class="modal-content" id="img-full-view">';
        document.body.appendChild(modal);
        modal.querySelector('.close-modal').onclick = () => modal.style.display = "none";
        modal.onclick = (e) => { if (e.target !== modal.querySelector('#img-full-view')) modal.style.display = "none"; }
    }

    let fullResSrc = src;
    // Nếu không truyền src cụ thể, lấy avatar của tone hiện tại
    if (!src && currentTone) {
        fullResSrc = AVATAR_MAP[currentTone];
    }

    document.getElementById("img-full-view").src = fullResSrc;
    modal.style.display = "flex";
}