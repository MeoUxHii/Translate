async function callGeminiChatWithRotation(contents, apiKeys, startIndex = 0) {
    let currentKeyIndex = startIndex;
    let lastError = null;
  
    for (let attempt = 0; attempt < apiKeys.length; attempt++) {
      const apiKey = apiKeys[currentKeyIndex];
      try {
        const reply = await executeGeminiChatRequest(apiKey, contents);
        return { success: true, reply: reply, newKeyIndex: currentKeyIndex };
      } catch (error) {
        lastError = error.message;
        console.log(`Gemini Key ${currentKeyIndex} tạch: ${error.message}`);
        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
      }
    }
    return {
      success: false,
      error: `Tất cả keys đều hỏng: ${lastError}`,
      newKeyIndex: currentKeyIndex,
    };
}

async function executeGeminiChatRequest(apiKey, contents) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: contents }),
      }
    );
  
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 429) throw new Error("Hết quota (429)");
      else if (response.status === 403) throw new Error("Key lởm (403)");
      else throw new Error(`Lỗi ${response.status}: ${errorData.error?.message || "Unknown"}`);
    }
  
    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text.trim();
    } else {
      throw new Error("Gemini không trả lời (Empty response)");
    }
}

async function callGeminiWithRotation(prompt, apiKeys, startIndex = 0) {
    let currentKeyIndex = startIndex;
    let lastError = null;

    for (let attempt = 0; attempt < apiKeys.length; attempt++) {
        const apiKey = apiKeys[currentKeyIndex];
        try {
            const translation = await executeGeminiRequest(apiKey, prompt);
            return {
                success: true,
                translation: translation,
                newKeyIndex: currentKeyIndex,
            };
        } catch (error) {
            lastError = error.message;
            console.log(`Gemini Key ${currentKeyIndex} tạch: ${error.message}`);
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
        }
    }
    return {
        success: false,
        error: `Tất cả keys đều hỏng: ${lastError}`,
        newKeyIndex: currentKeyIndex,
    };
}

async function executeGeminiRequest(apiKey, prompt) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        }
    );
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) throw new Error("Hết quota (429)");
        else if (response.status === 403) throw new Error("Key lởm (403)");
        else throw new Error(`Lỗi ${response.status}: ${errorData.error?.message || "Unknown"}`);
    }
    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
    } else {
        throw new Error("Gemini không trả lời");
    }
}


async function callGCPTranslateAPI(apiKey, text, targetLang) {
    const langCode = targetLang.split("-")[0];
    const response = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: text, target: langCode }),
      }
    );
    if (!response.ok) throw new Error("GCP Translate API lỗi");
    const data = await response.json();
    return data.data.translations[0].translatedText;
}

async function callGoogleCloudTTS(text) {
    try {
      const data = await chrome.storage.sync.get([
        "gcpTtsApiKey", "targetLang", "voicePrefs", "speakingRate",
      ]);
      const apiKey = data.gcpTtsApiKey;
      const targetLang = data.targetLang || "vi-VN";
      const voicePrefs = data.voicePrefs || {};
      const speakingRate = Number(data.speakingRate) || 1.0;
  
      if (!apiKey) return { success: false, error: "Chưa nhập GCP API Key" };
  
      const langCode = targetLang;
      let voiceName = voicePrefs[langCode];
      if (!voiceName) {
        // Fallback voices
        const defaultVoices = {
          "vi-VN": "vi-VN-Wavenet-A", "en-US": "en-US-Wavenet-D",
          "ja-JP": "ja-JP-Wavenet-B", "ko-KR": "ko-KR-Wavenet-A",
          "zh-CN": "cmn-CN-Wavenet-A", "fr-FR": "fr-FR-Wavenet-A",
        };
        voiceName = defaultVoices[langCode] || "vi-VN-Wavenet-A";
      }
  
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: { text: text },
            voice: { languageCode: langCode, name: voiceName },
            audioConfig: { audioEncoding: "MP3", speakingRate: speakingRate },
          }),
        }
      );
  
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`TTS Lỗi ${response.status}: ${errorData.error?.message}`);
      }
      const result = await response.json();
      if (result.audioContent) return { success: true, audioBase64: result.audioContent };
      throw new Error("Không có audioContent");
    } catch (error) {
      return { success: false, error: error.message };
    }
}

async function getGoogleVoices(langCode) {
    try {
      const data = await chrome.storage.sync.get(["gcpTtsApiKey"]);
      const apiKey = data.gcpTtsApiKey;
      if (!apiKey) return { success: false, error: "Chưa có API Key" };
      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/voices?key=${apiKey}&languageCode=${langCode}`,
        { method: "GET" }
      );
      if (!response.ok) throw new Error("Không tải được danh sách giọng");
      const result = await response.json();
      if (result.voices) return { success: true, voices: result.voices };
      return { success: false, error: "Không tìm thấy giọng nào" };
    } catch (error) {
      return { success: false, error: error.message };
    }
}

async function callVisionAPI(imageUrl, apiKey) {
    if (imageUrl.startsWith("data:")) {
      try {
        const base64String = imageUrl.split(",")[1];
        if (!base64String) throw new Error("Data URI lỗi");
        
        const requestPayload = {
          image: { content: base64String },
          features: [{ type: "TEXT_DETECTION" }],
        };
        const response = await fetch(
          `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ requests: [requestPayload] }),
          }
        );
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error?.message || response.statusText);
        }
        const data = await response.json();
        const text = data.responses?.[0]?.fullTextAnnotation?.text;
        if (!text || text.trim().length === 0) throw new Error("Ảnh này trắng trơn à? Không thấy chữ.");
        return text;
      } catch (error) {
        throw new Error(`Lỗi Vision (Base64): ${error.message}`);
      }
    }
      
    try {
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) throw new Error("Không tải được ảnh từ URL");
        const buffer = await imageResponse.arrayBuffer();
        let binary = "";
        const bytes = new Uint8Array(buffer);
        for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
        const base64String = btoa(binary);
        
        const requestPayload = {
            image: { content: base64String },
            features: [{ type: "TEXT_DETECTION" }],
        };
        const response = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requests: [requestPayload] }),
            }
        );
        if (!response.ok) throw new Error("Lỗi Vision API");
        const data = await response.json();
        const text = data.responses?.[0]?.fullTextAnnotation?.text;
        if (!text) throw new Error("Không thấy chữ nào cả.");
        return text;
    } catch (e) {
        throw new Error(`Thua! Không đọc được: ${e.message}`);
    }
}