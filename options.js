// Đã xoá dòng import vì utils.js được load toàn cục từ options.html
// Các hàm như getGradientString sẽ tự động có sẵn

let allTemplates = [];
let editingIndex = -1;

// === DOM ELEMENTS ===
const searchInput = document.getElementById('searchInput');
const templateList = document.getElementById('templateList');
const templateCount = document.getElementById('templateCount');
const createBtn = document.getElementById('createBtn');
const modalOverlay = document.getElementById('modalOverlay');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelBtn = document.getElementById('cancelBtn');
const saveTemplateBtn = document.getElementById('saveTemplateBtn');
const deleteBtn = document.getElementById('deleteBtn');
const shortcutInput = document.getElementById('shortcutInput');
const contentInput = document.getElementById('contentInput');
const modalTitle = document.getElementById('modalTitle');
const toast = document.getElementById('toast');
const appTitle = document.querySelector('.app-title');
const primaryBtns = document.querySelectorAll('.primary-btn');

// === INIT ===
document.addEventListener('DOMContentLoaded', async () => {
    await loadTheme();
    await loadTemplates();
    setupEventListeners();
});

// === THEME SYNC ===
async function loadTheme() {
    const data = await chrome.storage.sync.get(['userTheme']);
    if (data.userTheme) {
        // Hàm getGradientString lấy từ utils.js (global)
        const gradient = getGradientString(data.userTheme);
        const mainColor = data.userTheme.colors[0] || '#0056b3';
        
        // Apply theme to CSS variables dynamically
        document.documentElement.style.setProperty('--primary-color', mainColor);
        
        // Apply gradient to Title
        if (appTitle) {
            appTitle.style.background = gradient;
            appTitle.style.webkitBackgroundClip = 'text';
            appTitle.style.webkitTextFillColor = 'transparent';
        }

        // Apply gradient background to Create Button
        primaryBtns.forEach(btn => {
            btn.style.background = mainColor; // Fallback
            btn.style.backgroundImage = gradient;
        });
    }
}

// === DATA HANDLING ===
async function loadTemplates() {
    const data = await chrome.storage.sync.get(['magicTemplates']);
    allTemplates = data.magicTemplates || [];
    renderList(allTemplates);
}

async function saveTemplates() {
    await chrome.storage.sync.set({ magicTemplates: allTemplates });
    renderList(allTemplates);
    showToast('Đã lưu thành công!');
}

// === RENDER ===
function renderList(templates) {
    if (!templateList) return;
    templateList.innerHTML = '';
    if (templateCount) templateCount.textContent = templates.length;

    if (templates.length === 0) {
        const emptyState = document.querySelector('.empty-state');
        if (emptyState) emptyState.style.display = 'block';
        return;
    }
    
    const emptyState = document.querySelector('.empty-state');
    if (emptyState) emptyState.style.display = 'none';

    templates.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'template-card';
        card.onclick = () => openEditModal(index);
        card.innerHTML = `
            <span class="shortcut-text">${escapeHtml(item.shortcut)}</span>
            <span class="content-preview">${escapeHtml(item.content)}</span>
        `;
        templateList.appendChild(card);
    });
}

function filterTemplates(query) {
    const lowerQuery = query.toLowerCase();
    const filtered = allTemplates.filter(t => 
        t.shortcut.toLowerCase().includes(lowerQuery) || 
        t.content.toLowerCase().includes(lowerQuery)
    );
    renderList(filtered);
}

// === MODAL LOGIC ===
function openCreateModal() {
    editingIndex = -1;
    if (modalTitle) modalTitle.textContent = 'Thêm Magic mới';
    if (shortcutInput) shortcutInput.value = '';
    if (contentInput) contentInput.value = '';
    if (deleteBtn) deleteBtn.style.display = 'none';
    if (modalOverlay) {
        modalOverlay.classList.add('active');
        setTimeout(() => shortcutInput && shortcutInput.focus(), 100);
    }
}

function openEditModal(index) {
    editingIndex = index;
    const item = allTemplates[index];
    if (modalTitle) modalTitle.textContent = 'Chỉnh sửa Magic';
    if (shortcutInput) shortcutInput.value = item.shortcut;
    if (contentInput) contentInput.value = item.content;
    if (deleteBtn) deleteBtn.style.display = 'block';
    if (modalOverlay) modalOverlay.classList.add('active');
}

function closeModal() {
    if (modalOverlay) modalOverlay.classList.remove('active');
}

function handleSave() {
    const shortcut = shortcutInput.value.trim();
    const content = contentInput.value;

    if (!shortcut || !content) {
        alert('Vui lòng nhập đủ thông tin!');
        return;
    }

    // Check duplicate shortcut if creating new
    if (editingIndex === -1) {
        const exists = allTemplates.some(t => t.shortcut === shortcut);
        if (exists) {
            alert('Phím tắt này đã tồn tại rồi anh ơi!');
            return;
        }
        allTemplates.unshift({ shortcut, content }); // Add to top
    } else {
        // Check duplicate shortcut if editing (exclude self)
        const exists = allTemplates.some((t, i) => t.shortcut === shortcut && i !== editingIndex);
        if (exists) {
            alert('Phím tắt này đã trùng với cái khác!');
            return;
        }
        allTemplates[editingIndex] = { shortcut, content };
    }

    saveTemplates();
    closeModal();
}

function handleDelete() {
    if (editingIndex > -1) {
        if (confirm('Anh có chắc muốn xoá cái này không?')) {
            allTemplates.splice(editingIndex, 1);
            saveTemplates();
            closeModal();
        }
    }
}

// === EVENTS ===
function setupEventListeners() {
    if (createBtn) createBtn.addEventListener('click', openCreateModal);
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
    if (modalOverlay) modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) closeModal();
    });

    if (saveTemplateBtn) saveTemplateBtn.addEventListener('click', handleSave);
    if (deleteBtn) deleteBtn.addEventListener('click', handleDelete);

    if (searchInput) searchInput.addEventListener('input', (e) => {
        filterTemplates(e.target.value);
    });
    
    // Nút quay lại ở Header
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.close(); // Đóng tab options
        });
    }
}

// === UTILS ===
function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}