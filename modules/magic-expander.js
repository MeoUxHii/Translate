// Module xử lý gõ tắt dùng chung cho cả Popup và Content Script
export class MagicExpander {
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
        
        // Bỏ qua nếu đang xóa hoặc undo
        if (e.inputType && (e.inputType.startsWith('delete') || e.inputType === 'historyUndo')) return;

        const target = e.target;
        const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
        const isEditable = target.isContentEditable;

        if (!isInput && !isEditable) return;

        // Chỉ xử lý trên các phần tử thực sự focus
        if (target !== document.activeElement) return;

        if (isInput) {
            this.expandInput(target);
        } else {
            this.expandContentEditable(target);
        }
    }

    expandInput(target) {
        if (this.shortcuts.length === 0) return;

        const text = target.value;
        const cursorPosition = target.selectionStart;
        // Lấy 50 ký tự trước con trỏ
        const textBeforeCursor = text.slice(Math.max(0, cursorPosition - 50), cursorPosition);
        
        for (const template of this.shortcuts) {
            if (textBeforeCursor.endsWith(template.shortcut)) {
                const cutIndex = cursorPosition - template.shortcut.length;
                const newText = text.slice(0, cutIndex) + template.content + text.slice(cursorPosition);
                
                const scrollTop = target.scrollTop;
                
                // Cập nhật value
                // Lưu ý: Với React 16+, set value trực tiếp có thể không trigger onChange
                // Cần set property value của prototype
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
                const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;

                if (target.tagName === 'INPUT' && nativeInputValueSetter) {
                    nativeInputValueSetter.call(target, newText);
                } else if (target.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
                    nativeTextAreaValueSetter.call(target, newText);
                } else {
                    target.value = newText;
                }

                const newCursorPos = cutIndex + template.content.length;
                target.setSelectionRange(newCursorPos, newCursorPos);
                target.scrollTop = scrollTop;
                
                // Dispatch input event chuẩn để báo hiệu thay đổi
                const event = new Event('input', { bubbles: true });
                target.dispatchEvent(event);
                return;
            }
        }
    }

    expandContentEditable(target) {
        if (this.shortcuts.length === 0) return;

        const selection = window.getSelection();
        if (!selection.rangeCount) return;

        const range = selection.getRangeAt(0);
        const node = range.startContainer;

        // Chỉ xử lý text node
        if (node.nodeType !== Node.TEXT_NODE) return;

        const text = node.textContent;
        const cursorPosition = range.startOffset;
        const textBeforeCursor = text.slice(Math.max(0, cursorPosition - 50), cursorPosition);

        for (const template of this.shortcuts) {
            if (textBeforeCursor.endsWith(template.shortcut)) {
                // 1. Xóa shortcut cũ bằng Range
                const rangeToDelete = document.createRange();
                rangeToDelete.setStart(node, cursorPosition - template.shortcut.length);
                rangeToDelete.setEnd(node, cursorPosition);
                rangeToDelete.deleteContents();

                // 2. Chèn nội dung mới
                // Sử dụng document.execCommand('insertText') là cách tốt nhất để tương thích với undo/redo
                // Tuy nhiên, cần focus lại range trước khi insert
                const newRange = document.createRange();
                newRange.setStart(node, cursorPosition - template.shortcut.length);
                newRange.collapse(true);
                selection.removeAllRanges();
                selection.addRange(newRange);

                if (!document.execCommand('insertText', false, template.content)) {
                    // Fallback nếu execCommand bị chặn (ít xảy ra)
                    const newTextNode = document.createTextNode(template.content);
                    newRange.insertNode(newTextNode);
                    newRange.setStartAfter(newTextNode);
                    newRange.setEndAfter(newTextNode);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                    
                    // Normalize để gộp text node
                    if (node.parentNode) node.parentNode.normalize();
                    
                    // Trigger input event
                    target.dispatchEvent(new Event('input', { bubbles: true }));
                }
                return;
            }
        }
    }
}