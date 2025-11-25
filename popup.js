import { initSettings } from './modules/settings-manager.js';
import { initTheme } from './modules/theme-manager.js';
import { initChat } from './modules/chat-manager.js';
import { initHistory } from './modules/history-manager.js';
import { escapeHTML } from './modules/ui-utils.js';

// --- MAGIC EXPANDER CLASS (INTEGRATED FOR POPUP) ---
class PopupMagicExpander {
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
    initSettings();
    initTheme();
    initChat();
    initHistory();
    
    // Kích hoạt Magic trong Popup
    new PopupMagicExpander();

    const tabs = [ 
        { btn: 'settingsTabBtn', content: 'settings-content' }, 
        { btn: 'apiTabBtn', content: 'api-content' }, 
        { btn: 'historyTabBtn', content: 'history-content' }, 
        { btn: 'themeTabBtn', content: 'theme-content' },
        { btn: 'chatTabBtn', content: 'chat-content' },
        { btn: 'magicTabBtn', content: 'magic-content' }
    ];

    // Set mặc định tab đầu tiên active (Model/Settings)
    if (!document.querySelector('.tab-content.active')) {
        const defaultTab = document.getElementById('settings-content');
        if (defaultTab) defaultTab.classList.add('active');
    }

    tabs.forEach(tab => {
        const btn = document.getElementById(tab.btn);
        if(btn) {
            btn.addEventListener('click', () => {
                // 1. Bỏ active cũ
                tabs.forEach(t => { 
                    const b = document.getElementById(t.btn);
                    const c = document.getElementById(t.content);
                    if (b) b.classList.remove('active'); 
                    if (c) {
                        c.classList.remove('active');
                        c.style.display = ''; 
                    }
                });
                
                // 2. Set active mới
                btn.classList.add('active'); 
                const content = document.getElementById(tab.content);
                if (content) content.classList.add('active');
                
                // 3. Logic riêng từng tab
                if (tab.btn === 'historyTabBtn' && window.loadHistoryFunc) {
                    window.loadHistoryFunc();
                }
                if (tab.btn === 'chatTabBtn' && window.chatScrollToBottom) {
                    setTimeout(() => window.chatScrollToBottom(), 50); 
                }
                if (tab.btn === 'magicTabBtn') {
                    loadMagicData();
                }
            });
        }
    });

    // --- MAGIC TAB LOGIC ---
    const magicToggle = document.getElementById('magicToggle');
    const openOptionsBtn = document.getElementById('openOptionsBtn');
    const magicSearch = document.getElementById('magicSearchPopup');
    const magicList = document.getElementById('magicListPopup');
    const magicCount = document.getElementById('magicCountPopup');
    
    let allShortcuts = [];

    chrome.storage.sync.get(['magicEnabled'], (data) => {
        if(magicToggle) magicToggle.checked = data.magicEnabled !== false; 
    });

    if(magicToggle) {
        magicToggle.addEventListener('change', (e) => {
            chrome.storage.sync.set({ magicEnabled: e.target.checked });
        });
    }

    if (openOptionsBtn) {
        openOptionsBtn.addEventListener('click', () => {
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
            magicList.innerHTML = `<div class="empty-magic-state">Chưa có shortcut nào.<br>Bấm "Quản lý" để thêm mới nhé!</div>`;
            return;
        }

        templates.forEach(item => {
            const card = document.createElement('div');
            card.className = 'magic-card';
            card.onclick = () => {
                if (chrome.runtime.openOptionsPage) chrome.runtime.openOptionsPage();
                else window.open(chrome.runtime.getURL('options.html'));
            };
            card.innerHTML = `
                <div class="magic-card-shortcut">${escapeHTML(item.shortcut)}</div>
                <div class="magic-card-preview">${escapeHTML(item.content)}</div>
            `;
            magicList.appendChild(card);
        });
    }

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
});