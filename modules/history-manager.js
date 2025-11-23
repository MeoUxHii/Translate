import { escapeHTML } from './ui-utils.js';

export function initHistory() {
    const historyList = document.getElementById('history-list');
    const noHistory = document.getElementById('no-history');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const selectHistoryBtn = document.getElementById('selectHistoryBtn');
    const cancelSelectBtn = document.getElementById('cancelSelectBtn');
    const clearAllHistoryBtn = document.getElementById('clearAllHistoryBtn');

    function loadHistory() {
        if (!historyList) return; 
        historyList.innerHTML = ''; 
        noHistory.style.display = 'none';
        
        chrome.storage.local.get(["translationHistory"], (data) => {
            const history = data.translationHistory || [];
            if (history.length > 0) {
                history.forEach(item => {
                    const el = document.createElement('div'); 
                    el.className = 'history-item'; 
                    el.dataset.timestamp = item.timestamp;
                    el.innerHTML = `
                        <input type="checkbox" class="history-item-checkbox" data-timestamp="${item.timestamp}">
                        <div class="history-text-original">${escapeHTML(item.original)}</div>
                        <div class="history-text-translation">${escapeHTML(item.translation)}</div>
                    `;
                    historyList.appendChild(el);
                });
            } else { 
                noHistory.style.display = 'block'; 
            }
        });
    }
    
    window.loadHistoryFunc = loadHistory;

    function toggleSelectionMode(enable) {
        const historyContent = document.getElementById('history-content');
        const defaultGroup = document.getElementById('defaultBtnGroup');
        const selectionGroup = document.getElementById('selectionBtnGroup');
        if (enable) { 
            historyContent.classList.add('selection-mode'); 
            defaultGroup.style.display = 'none'; 
            selectionGroup.style.display = 'flex'; 
        } else { 
            historyContent.classList.remove('selection-mode'); 
            defaultGroup.style.display = 'flex'; 
            selectionGroup.style.display = 'none'; 
            historyList.querySelectorAll('.history-item-checkbox').forEach(cb => cb.checked = false); 
            historyList.querySelectorAll('.history-item').forEach(item => item.classList.remove('item-selected')); 
        }
        updateSelectionState();
    }

    function updateSelectionState() {
        const count = historyList.querySelectorAll('.history-item-checkbox:checked').length;
        if (deleteSelectedBtn) { 
            deleteSelectedBtn.textContent = `Xoá (${count})`; 
            deleteSelectedBtn.disabled = count === 0; 
        }
    }

    if (selectHistoryBtn) selectHistoryBtn.addEventListener('click', () => toggleSelectionMode(true));
    if (cancelSelectBtn) cancelSelectBtn.addEventListener('click', () => toggleSelectionMode(false));
    
    if (selectAllBtn) selectAllBtn.addEventListener('click', () => {
        const checkboxes = historyList.querySelectorAll('.history-item-checkbox'); 
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        checkboxes.forEach(cb => cb.checked = !allChecked); 
        historyList.querySelectorAll('.history-item').forEach(item => item.classList.toggle('item-selected', !allChecked)); 
        updateSelectionState();
    });

    if (deleteSelectedBtn) deleteSelectedBtn.addEventListener('click', () => {
        const checked = historyList.querySelectorAll('.history-item-checkbox:checked'); 
        if (!checked.length) return;
        const timestamps = Array.from(checked).map(cb => cb.dataset.timestamp);
        chrome.storage.local.get(["translationHistory"], (data) => {
            const newH = (data.translationHistory || []).filter(i => !timestamps.includes(i.timestamp));
            chrome.storage.local.set({ translationHistory: newH }, () => { loadHistory(); toggleSelectionMode(false); });
        });
    });

    if (clearAllHistoryBtn) clearAllHistoryBtn.addEventListener('click', () => { 
        if (confirm("Xoá hết sạch sành sanh?")) { 
            chrome.storage.local.remove("translationHistory", () => { loadHistory(); toggleSelectionMode(false); }); 
        } 
    });

    if (historyList) historyList.addEventListener('click', (e) => {
        const contentDiv = document.getElementById('history-content'); 
        if (!contentDiv.classList.contains('selection-mode')) return;
        const item = e.target.closest('.history-item'); 
        if (!item) return;
        const cb = item.querySelector('.history-item-checkbox'); 
        if (e.target !== cb) cb.checked = !cb.checked;
        item.classList.toggle('item-selected', cb.checked); 
        updateSelectionState();
    });
}