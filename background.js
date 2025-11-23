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
    handleSmartChat(request.history).then(sendResponse);
    return true;
  }
});