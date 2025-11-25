// ... imports giữ nguyên ...
import { initSettings } from './modules/settings-manager.js';
import { initTheme } from './modules/theme-manager.js';
import { initChat } from './modules/chat-manager.js';
import { initHistory } from './modules/history-manager.js';
import { escapeHTML } from './modules/ui-utils.js';

// ... Class PopupMagicExpander giữ nguyên ...
class PopupMagicExpander {
    // ... (code cũ) ...
     constructor() {
        this.shortcuts = [];
        this.enabled = true;
        this.loadSettings();
        this.initListener();
    }

    loadSettings() {
        chrome.storage.sync.get(['magicTemplates', 'magicEnabled'], (data) => {
            if (data.magicTemplates) this.shortcuts = data.magicTemplates;
            if (data.magicEnabled !== undefined) this.enabled = data.magicEnabled;
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'sync') {
                if (changes.magicTemplates) this.shortcuts = changes.magicTemplates.newValue || [];
                if (changes.magicEnabled) this.enabled = changes.magicEnabled.newValue;
            }
        });
    }

    initListener() {
        document.addEventListener('input', (e) => this.handleInput(e));
    }

    handleInput(e) {
        if (!this.enabled || !e.target) return;
        if (e.inputType && (e.inputType.startsWith('delete') || e.inputType === 'historyUndo')) return;

        const target = e.target;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';

        if (!isInput) return; // Popup chủ yếu dùng input/textarea

        this.expandInput(target);
    }

    expandInput(target) {
        if (this.shortcuts.length === 0) return;

        const text = target.value;
        const cursorPosition = target.selectionStart;
        const textBeforeCursor = text.slice(Math.max(0, cursorPosition - 50), cursorPosition);
        
        for (const template of this.shortcuts) {
            if (textBeforeCursor.endsWith(template.shortcut)) {
                const cutIndex = cursorPosition - template.shortcut.length;
                const newText = text.slice(0, cutIndex) + template.content + text.slice(cursorPosition);
                
                const scrollTop = target.scrollTop;
                target.value = newText; // Popup không dùng React nên set value trực tiếp ok
                
                const newCursorPos = cutIndex + template.content.length;
                target.setSelectionRange(newCursorPos, newCursorPos);
                target.scrollTop = scrollTop;
                
                // Dispatch input event
                target.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    // Init modules
    initSettings();
    initTheme();
    initChat();
    initHistory();
    new PopupMagicExpander();

    // --- TAB NAVIGATION LOGIC (UPDATED) ---
    const tabs = [
        { btn: 'magicTabBtn', content: 'magic-content' }, // Mặc định là Magic cho giống ảnh
        { btn: 'settingsTabBtn', content: 'settings-content' },
        { btn: 'apiTabBtn', content: 'api-content' },
        { btn: 'themeTabBtn', content: 'theme-content' },
        { btn: 'chatTabBtn', content: 'chat-content' },
        { btn: 'historyTabBtn', content: 'history-content' }
    ];

    // Hàm chuyển tab
    function switchTab(tabId) {
        tabs.forEach(t => {
            const btn = document.getElementById(t.btn);
            const content = document.getElementById(t.content);
            
            if (btn) btn.classList.remove('active');
            if (content) content.classList.remove('active');
            
            if (t.btn === tabId) {
                if (btn) btn.classList.add('active');
                if (content) content.classList.add('active');
            }
        });
    }

    // Gán sự kiện click
    tabs.forEach(t => {
        const btn = document.getElementById(t.btn);
        if (btn) {
            btn.addEventListener('click', () => {
                switchTab(t.btn);
                
                // Trigger load data riêng cho từng tab nếu cần
                if (t.btn === 'historyTabBtn' && window.loadHistoryFunc) window.loadHistoryFunc();
                if (t.btn === 'magicTabBtn') loadMagicData();
            });
        }
    });

    // Mặc định mở tab Magic (hoặc tab đầu tiên trong list)
    switchTab('magicTabBtn');


    // --- MAGIC TAB LOGIC (UPDATED FOR NEW UI) ---
    const magicToggle = document.getElementById('magicToggle');
    const openOptionsBtn = document.getElementById('openOptionsBtn'); // Nút Create Shortcut
    const magicSearch = document.getElementById('magicSearchPopup');
    const magicList = document.getElementById('magicListPopup');
    const magicCount = document.getElementById('magicCountPopup');
    
    let allShortcuts = [];

    // Load toggle state
    chrome.storage.sync.get(['magicEnabled'], (data) => {
        if(magicToggle) magicToggle.checked = data.magicEnabled !== false; 
    });

    if(magicToggle) {
        magicToggle.addEventListener('change', (e) => {
            chrome.storage.sync.set({ magicEnabled: e.target.checked });
        });
    }

    // Nút Create Shortcut -> Mở trang Options (hoặc Modal tạo mới)
    // Ở đây ta giữ logic cũ là mở trang options full
    if (openOptionsBtn) {
        openOptionsBtn.addEventListener('click', () => {
             // Logic mở modal tạo mới ở đây (nếu muốn làm trong popup)
             // Hoặc mở tab options full
             if (chrome.runtime.openOptionsPage) {
                chrome.runtime.openOptionsPage();
            } else {
                window.open(chrome.runtime.getURL('options.html'));
            }
        });
    }

    function loadMagicData() {
        chrome.storage.sync.get(['magicTemplates'], (data) => {
            allShortcuts = data.magicTemplates || [];
            renderMagicList(allShortcuts);
        });
    }

    function renderMagicList(templates) {
        if (!magicList) return;
        magicList.innerHTML = '';
        if (magicCount) magicCount.textContent = templates.length;

        if (templates.length === 0) {
            magicList.innerHTML = `<div class="empty-magic-state">No shortcuts found. Create one to get started!</div>`;
            return;
        }

        templates.forEach(item => {
            const row = document.createElement('div');
            row.className = 'magic-card'; // Dùng class card nhưng style như row
            // Logic edit khi click
            row.onclick = () => {
                // Mở modal edit (chưa implement trong code này, giữ placeholder)
                // window.open(chrome.runtime.getURL('options.html')); 
                alert("Tính năng Edit đang phát triển! :P");
            };
            
            row.innerHTML = `
                <div class="magic-card-shortcut">${escapeHTML(item.shortcut)}</div>
                <div class="magic-card-preview">${escapeHTML(item.content)}</div>
                <div class="col-actions" style="color: #94A3B8;">✎</div>
            `;
            magicList.appendChild(row);
        });
    }

    // Search Logic
    if (magicSearch) {
        magicSearch.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allShortcuts.filter(t => 
                t.shortcut.toLowerCase().includes(query) || 
                t.content.toLowerCase().includes(query)
            );
            renderMagicList(filtered);
        });
    }
    
    // Load data lần đầu
    loadMagicData();
});