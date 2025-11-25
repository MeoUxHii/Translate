async function translateText(text, targetLangOverride = null, isImageAnalysis = false, isWibuMode = false) {
    try {
      const data = await chrome.storage.sync.get([
        "translationService", "apiKeys", "gcpTtsApiKey", "targetLang",
        "translationTone", "currentKeyIndex",
      ]);
  
      const service = data.translationService || "gemini";
      const targetLang = targetLangOverride || data.targetLang || "vi-VN";
  
      let tone = data.translationTone || "default";
      if (tone === "vietnamese_native" && targetLang !== "vi-VN") tone = "default";
  
      if (!isImageAnalysis && targetLangOverride === null) {
        let sourceLangGuessed = null;
        const isKorean = /[가-힣]/.test(text);
        const isJapanese = /[ぁ-んァ-ヶ]/.test(text);
        const isVietnamese = /[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i.test(text);
        
        if (isKorean) sourceLangGuessed = "ko-KR";
        else if (isJapanese) sourceLangGuessed = "ja-JP";
        else if (isVietnamese) sourceLangGuessed = "vi-VN";
        
        if (sourceLangGuessed && sourceLangGuessed === targetLang) {
          return { success: true, translation: text };
        }
      }
  
      if (service === "gemini") {
        if (!data.apiKeys || data.apiKeys.length === 0)
          return { success: false, error: "Chưa có Gemini API Key" };
  
        let translationPrompt;

        if (targetLangOverride && typeof RETRANSLATE_PROMPTS !== 'undefined' && RETRANSLATE_PROMPTS[targetLangOverride]) {
             const roleSettings = RETRANSLATE_PROMPTS[targetLangOverride];
             translationPrompt = `${roleSettings}\n\nInput text to translate:\n"${text}"\n\n(Output ONLY the translation content)`;
        } 
        else {
             translationPrompt = isImageAnalysis
              ? buildImageAnalysisPrompt(text, targetLang, tone, isWibuMode)
              : buildTextTranslationPrompt(text, targetLang, tone);
        }
  
        const geminiResult = await callGeminiWithRotation(
          translationPrompt,
          data.apiKeys,
          data.currentKeyIndex || 0
        );
  
        if (geminiResult.success) {
          if (targetLangOverride === null) {
            await chrome.storage.sync.set({ currentKeyIndex: geminiResult.newKeyIndex });
            if (!isImageAnalysis) await saveToHistory(text, geminiResult.translation);
          }
          return { success: true, translation: geminiResult.translation };
        } else {
            if (targetLangOverride === null)
                 await chrome.storage.sync.set({ currentKeyIndex: geminiResult.newKeyIndex });
            return { success: false, error: geminiResult.error };
        }
      } 
      else {
        if (!data.gcpTtsApiKey) return { success: false, error: "Chưa có GCP API Key" };
        try {
          const translation = await callGCPTranslateAPI(data.gcpTtsApiKey, text, targetLang);
          if (targetLangOverride === null && !isImageAnalysis) await saveToHistory(text, translation);
          return { success: true, translation: translation };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  
  async function handleImageTranslation(imageUrl, tabId) {
    try {
      const data = await chrome.storage.sync.get(["gcpTtsApiKey", "apiKeys"]);
      if (!data.gcpTtsApiKey) throw new Error("Thiếu Google Cloud Key (để OCR)");
      if (!data.apiKeys || data.apiKeys.length === 0) throw new Error("Thiếu Gemini Key (để dịch)");
      
      chrome.tabs.sendMessage(tabId, { action: "show_loading_popup", title: "Đang soi..." });
      const extractedText = await callVisionAPI(imageUrl, data.gcpTtsApiKey);
      chrome.tabs.sendMessage(tabId, { action: "update_loading_popup", title: "Đang dịch..." });
      const translationResult = await translateText(extractedText, null, true, false);
      
      if (translationResult.success) {
        chrome.tabs.sendMessage(tabId, { action: "show_translation_result", success: true, translation: translationResult.translation });
      } else { throw new Error(translationResult.error); }
    } catch (error) {
      chrome.tabs.sendMessage(tabId, { action: "show_translation_result", success: false, error: error.message });
    }
  }
  
  async function handleCroppedImageTranslation(base64Data) {
    try {
      const data = await chrome.storage.sync.get(["gcpTtsApiKey", "apiKeys"]);
      if (!data.gcpTtsApiKey) throw new Error("Thiếu GCP Key");
      if (!data.apiKeys) throw new Error("Thiếu Gemini Key");
      const extractedText = await callVisionAPI(base64Data, data.gcpTtsApiKey);
      const translationResult = await translateText(extractedText, null, true, true);
      return translationResult;
    } catch (error) { return { success: false, error: error.message }; }
  }
  
  async function saveToHistory(original, translation) {
    try {
      const data = await chrome.storage.local.get(["translationHistory"]);
      let history = data.translationHistory || [];
      history.unshift({ original, translation, timestamp: new Date().toISOString() });
      if (history.length > 50) history = history.slice(0, 50);
      await chrome.storage.local.set({ translationHistory: history });
    } catch (error) { console.error("Lỗi lưu history:", error); }
  }