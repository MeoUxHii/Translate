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

// --- BIẾN CACHE GIỌNG NÓI ---
let voiceCache = {};

// Hàm load giọng nói và cache lại
async function preloadVoices(langCode) {
    if (voiceCache[langCode]) return voiceCache[langCode]; // Trả về ngay nếu có trong RAM

    try {
        const data = await chrome.storage.local.get(`voices_${langCode}`);
        if (data[`voices_${langCode}`]) {
             voiceCache[langCode] = data[`voices_${langCode}`]; // Load từ disk lên RAM
        }

        // Gọi API để update (ngầm)
        getGoogleVoices(langCode).then(response => {
            if (response.success) {
                voiceCache[langCode] = response.voices;
                chrome.storage.local.set({ [`voices_${langCode}`]: response.voices });
            }
        });

        return voiceCache[langCode];
    } catch (e) {
        console.error("Preload error:", e);
        return null;
    }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "translate_image",
    title: "Hình đó có gì?",
    contexts: ["image"],
  });
  // Preload giọng mặc định khi cài đặt
  preloadVoices("vi-VN");
  preloadVoices("en-US");
});

// ... (Các phần code xử lý command, context menu giữ nguyên) ...

chrome.commands.onCommand.addListener((command) => {
  if (command === "translate-text") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "translate-shortcut" });
      }
    });
  }
});

// --- HÀM GỬI TIN AN TOÀN ---
function safeSendMessage(message) {
    const promise = chrome.runtime.sendMessage(message);
    if (promise) {
        promise.catch((error) => {
            // Ignore errors if popup is closed
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
    // ... (Giữ nguyên logic chat response) ...
    const response = await handleSmartChat(request.history, request.tone);
    
    if (!response.success) {
        safeSendMessage({ action: "chat_error", error: response.error, tone: request.tone });
        return;
    }

    const fullReply = response.reply;
    const lines = fullReply.split('\n').filter(line => line.trim() !== '');

    for (let i = 0; i < lines.length; i++) {
        const lineText = lines[i].trim();
        if (!lineText) continue;

        if (i > 0) {
            const delay = calculateTypingDelay(lineText);
            safeSendMessage({ action: "chat_typing", tone: request.tone, isTyping: true });
            await new Promise(r => setTimeout(r, delay));
        }

        const botMsgObj = { role: "model", parts: [{ text: lineText }] };
        const currentData = await chrome.storage.local.get("chatData"); 
        let currentAllChatData = currentData.chatData || {};
        if (!currentAllChatData[request.tone]) currentAllChatData[request.tone] = [];
        
        currentAllChatData[request.tone].push(botMsgObj);
        if (currentAllChatData[request.tone].length > 50) {
            currentAllChatData[request.tone] = currentAllChatData[request.tone].slice(-50);
        }
        await chrome.storage.local.set({ chatData: currentAllChatData });

        safeSendMessage({ 
            action: "chat_incoming_message", 
            tone: request.tone, 
            message: botMsgObj,
            isLast: i === lines.length - 1
        });
    }
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
  
  // --- CẬP NHẬT: LOGIC LẤY GIỌNG NÓI TỪ CACHE ---
  if (request.action === "get_voices") {
    const langCode = request.langCode || "vi-VN";
    
    // Kiểm tra cache trong RAM
    if (voiceCache[langCode]) {
        sendResponse({ success: true, voices: voiceCache[langCode] });
    } else {
        // Kiểm tra cache trong Storage
        chrome.storage.local.get(`voices_${langCode}`, (data) => {
            if (data[`voices_${langCode}`]) {
                 voiceCache[langCode] = data[`voices_${langCode}`];
                 sendResponse({ success: true, voices: voiceCache[langCode] });
                 // Vẫn gọi API update ngầm
                 getGoogleVoices(langCode).then(res => {
                     if(res.success) {
                         voiceCache[langCode] = res.voices;
                         chrome.storage.local.set({ [`voices_${langCode}`]: res.voices });
                     }
                 });
            } else {
                // Không có cache, gọi API trực tiếp
                getGoogleVoices(langCode).then(response => {
                    if (response.success) {
                        voiceCache[langCode] = response.voices;
                        chrome.storage.local.set({ [`voices_${langCode}`]: response.voices });
                    }
                    sendResponse(response);
                });
            }
        });
    }
    return true;
  }
  // ... (Các logic xử lý message khác giữ nguyên) ...
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