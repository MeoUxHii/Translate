try {
  importScripts(
      "prompts.js",
      "retranslate-prompts.js", 
      "lib/api-client.js", 
      "lib/chat-service.js", 
      "lib/translation-service.js"
  );
} catch (e) {
  console.error("Lỗi Import Scripts:", e);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translate_image",
    title: "Hình đó có gì?",
    contexts: ["image"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "translate_image" && tab.id) {
    handleImageTranslation(info.srcUrl, tab.id);
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === "translate-text") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "translate-shortcut" });
      }
    });
  }
});

// --- HÀM GỬI TIN AN TOÀN (FIX LỖI RECEIVING END DOES NOT EXIST) ---
function safeSendMessage(message) {
    // Gửi tin nhắn và bắt lỗi nếu không có người nhận (Popup đóng)
    const promise = chrome.runtime.sendMessage(message);
    if (promise) {
        promise.catch((error) => {
            // Kệ nó, Popup đóng thì thôi, không cần log lỗi
            // console.log("Popup closed, UI update skipped.");
        });
    }
}

function calculateTypingDelay(text) {
    if (!text) return 500;
    const baseDelay = 400; const charDelay = 30;
    const calculated = baseDelay + (text.length * charDelay);
    return Math.min(Math.max(calculated, 600), 3500);
}

async function processChatResponse(request, sendResponse) {
    const response = await handleSmartChat(request.history, request.tone);
    
    if (!response.success) {
        safeSendMessage({ action: "chat_error", error: response.error, tone: request.tone });
        return;
    }

    const fullReply = response.reply;
    
    // Tách dòng
    const lines = fullReply.split('\n').filter(line => line.trim() !== '');

    // Xử lý tuần tự từng dòng
    for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i].trim();
        if (!lineText) continue;

        if (i > 0) {
            const delay = calculateTypingDelay(lineText);
            // Dùng safeSendMessage thay vì chrome.runtime.sendMessage
            safeSendMessage({ action: "chat_typing", tone: request.tone, isTyping: true });
            await new Promise(r => setTimeout(r, delay));
        }

        const botMsgObj = { role: "model", parts: [{ text: lineText }] };
        
        const currentData = await chrome.storage.local.get("chatData"); 
        let currentAllChatData = currentData.chatData || {};
        if (!currentAllChatData[request.tone]) currentAllChatData[request.tone] = [];
        
        currentAllChatData[request.tone].push(botMsgObj);
        
        if (currentAllChatData[request.tone].length > 50) {
            currentAllChatData[request.tone] = currentAllChatData[request.tone].slice(currentAllChatData[request.tone].length - 50);
        }
        
        await chrome.storage.local.set({ chatData: currentAllChatData });

        // Dùng safeSendMessage
        safeSendMessage({ 
            action: "chat_incoming_message", 
            tone: request.tone, 
            message: botMsgObj,
            isLast: i === lines.length - 1
        });
    }
    
    // Dùng safeSendMessage
    safeSendMessage({ action: "chat_typing", tone: request.tone, isTyping: false });
}


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  
  if (request.action === "translate") {
    translateText(request.text, request.targetLangOverride).then(sendResponse);
    return true; 
  }
  
  if (request.action === "speak") {
    callGoogleCloudTTS(request.text).then(sendResponse);
    return true;
  }
  if (request.action === "get_voices") {
    getGoogleVoices(request.langCode).then(sendResponse);
    return true;
  }
  if (request.action === "getHistory") {
    chrome.storage.local.get(["translationHistory"], (data) => {
      sendResponse({ history: data.translationHistory || [] });
    });
    return true;
  }
  if (request.action === "clearHistory") {
    chrome.storage.local.set({ translationHistory: [] }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (request.action === "capture_visible_tab") {
    chrome.tabs.captureVisibleTab(null, { format: "jpeg", quality: 80 }, (dataUrl) => {
        if (chrome.runtime.lastError) sendResponse({ error: chrome.runtime.lastError.message });
        else sendResponse({ dataUrl: dataUrl });
    });
    return true;
  }
  if (request.action === "translate-shortcut") {
        return true;
  }
  if (request.action === "translate_image_data") {
    handleCroppedImageTranslation(request.imageData).then(sendResponse);
    return true;
  }

  if (request.action === "chat") {
    processChatResponse(request, sendResponse); 
    sendResponse({ status: "processing" }); 
    return true;
  }
});