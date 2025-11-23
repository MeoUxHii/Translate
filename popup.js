import { initSettings } from './modules/settings-manager.js';
import { initTheme } from './modules/theme-manager.js';
import { initChat } from './modules/chat-manager.js';
import { initHistory } from './modules/history-manager.js';

document.addEventListener("DOMContentLoaded", () => {
    initSettings();
    initTheme();
    initChat();
    initHistory();

    const tabs = [ 
        { btn: 'settingsTabBtn', content: 'settings-content' }, 
        { btn: 'apiTabBtn', content: 'api-content' }, 
        { btn: 'historyTabBtn', content: 'history-content' }, 
        { btn: 'themeTabBtn', content: 'theme-content' },
        { btn: 'chatTabBtn', content: 'chat-content' }
    ];

    tabs.forEach(tab => {
        const btn = document.getElementById(tab.btn);
        if(btn) {
            btn.addEventListener('click', () => {
                tabs.forEach(t => { 
                    document.getElementById(t.btn).classList.remove('active'); 
                    document.getElementById(t.content).style.display = 'none'; 
                });
                
                btn.classList.add('active'); 
                document.getElementById(tab.content).style.display = 'block';
                
                if (tab.btn === 'historyTabBtn' && window.loadHistoryFunc) {
                    window.loadHistoryFunc();
                }
                if (tab.btn === 'chatTabBtn' && window.chatScrollToBottom) {
                    window.chatScrollToBottom(); 
                }
            });
        }
    });
});