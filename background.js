chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "translate_image",
        title: "Hình đó có gì?",
        contexts: ["image"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "translate_image" && tab.id) {
        try {
            const data = await chrome.storage.sync.get([
                "gcpTtsApiKey", "apiKeys", "targetLang", 
                "translationTone", "currentKeyIndex"
            ]);

            if (!data.gcpTtsApiKey) {
                throw new Error("Vui lòng cài đặt Google Cloud API key");
            }
            if (!data.apiKeys || data.apiKeys.length === 0) {
                throw new Error("Vui lòng cài đặt Gemini API key");
            }

            chrome.tabs.sendMessage(tab.id, { 
                action: "show_loading_popup",
                title: "Đợi tí đang nhận diện ảnh..." 
            });

            const extractedText = await callVisionAPI(info.srcUrl, data.gcpTtsApiKey);

            chrome.tabs.sendMessage(tab.id, { 
                action: "update_loading_popup", 
                title: "Đợi tí nhé..." 
            });
            
            const targetLang = data.targetLang || "vi-VN";
            const tone = data.translationTone || "default";
            const analysisPrompt = buildImageAnalysisPrompt(extractedText, targetLang, tone);

            const geminiResult = await callGeminiWithRotation(
                analysisPrompt, 
                data.apiKeys, 
                data.currentKeyIndex
            );

            if (geminiResult.success) {
                chrome.tabs.sendMessage(tab.id, {
                    action: "show_translation_result",
                    success: true,
                    translation: geminiResult.translation
                });
                await chrome.storage.sync.set({ currentKeyIndex: geminiResult.newKeyIndex });
            } else {
                await chrome.storage.sync.set({ currentKeyIndex: geminiResult.newKeyIndex });
                throw new Error(geminiResult.error);
            }
        } catch (error) {
            chrome.tabs.sendMessage(tab.id, {
                action: "show_translation_result",
                success: false,
                error: error.message
            });
        }
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "translate") {
        translateText(request.text).then(sendResponse);
        return true; 
    }
    if (request.action === "speak") {
        callGoogleCloudTTS(request.text).then(sendResponse);
        return true; 
    }
});

chrome.commands.onCommand.addListener((command) => {
    if (command === "translate-text") {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    action: "translate-shortcut",
                });
            }
        });
    }
});

async function translateText(text) {
    try {
        const data = await chrome.storage.sync.get([
            "translationService", "apiKeys", "gcpTtsApiKey",
            "targetLang", "translationTone", "currentKeyIndex"
        ]);

        const service = data.translationService || "gemini";
        const targetLang = data.targetLang || "vi-VN";
        const tone = data.translationTone || "default";

        if (service === "gemini") {
            if (!data.apiKeys || data.apiKeys.length === 0) {
                return { success: false, error: "Vui lòng cài đặt Gemini API key" };
            }
            
            const translationPrompt = buildTextTranslationPrompt(text, targetLang, tone);
            
            const geminiResult = await callGeminiWithRotation(
                translationPrompt,
                data.apiKeys,
                data.currentKeyIndex
            );

            if (geminiResult.success) {
                await chrome.storage.sync.set({ currentKeyIndex: geminiResult.newKeyIndex });
                return { success: true, translation: geminiResult.translation };
            } else {
                await chrome.storage.sync.set({ currentKeyIndex: geminiResult.newKeyIndex });
                return { success: false, error: geminiResult.error };
            }

        } else {
            if (!data.gcpTtsApiKey) {
                return { success: false, error: "Vui lòng cài đặt Google Cloud API key" };
            }
            try {
                const translation = await callGCPTranslateAPI(data.gcpTtsApiKey, text, targetLang);
                return { success: true, translation: translation };
            } catch (error) {
                 return { success: false, error: error.message };
            }
        }
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function executeGeminiRequest(apiKey, prompt) {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
            }),
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 429) {
            throw new Error("API key đã hết quota (429)");
        } else if (response.status === 403) {
            throw new Error("API key không hợp lệ (403)");
        } else {
            throw new Error(
                `Gemini API error: ${response.status} - ${
                    errorData.error?.message || "Unknown error"
                }`
            );
        }
    }

    const data = await response.json();
    if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
        return data.candidates[0].content.parts[0].text.trim();
    } else {
        throw new Error("Không nhận được kết quả dịch từ Gemini");
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
                newKeyIndex: currentKeyIndex 
            };
        } catch (error) {
            lastError = error.message;
            console.log(`Gemini Key ${currentKeyIndex} failed: ${error.message}`);
            currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
        }
    }
    return { 
        success: false, 
        error: `Tất cả Gemini keys đều thất bại: ${lastError}`,
        newKeyIndex: currentKeyIndex
    };
}

function buildTextTranslationPrompt(text, targetLang, tone) {
    const langNames = {
        "vi-VN": "Vietnamese", "en-US": "English", "zh-CN": "Chinese",
        "ja-JP": "Japanese", "ko-KR": "Korean", "fr-FR": "French",
        "de-DE": "German", "es-ES": "Spanish",
    };
    const targetLangName = langNames[targetLang] || "Vietnamese";

    const isSingleWord = text.trim().split(/\s+/).length === 1;
    let prompt;
    let toneInstruction = "";

    if (tone === 'vietnamese_native') {
        toneInstruction = `
        Act as a native ${targetLangName} translator with a very casual, 'street' style.
        Your task is to translate the text into natural, spoken Vietnamese.
        
        **CRITICAL RULES:**
        
        **1. Pronouns (Keep these):**
        -   **For "I" and "you"**: You MUST pick ONE pair from this list and use it consistently: (tao - mày), (tớ - cậu), (mình - bạn).
        -   **For "he" and "she"**: You can use pairs like (ổng - bả), (cha nội đó - mẹ đó), (ảnh - ẻm).
        -   **For "they" or "them"**: You MUST use "bọn nó" or "tụi nó".
        -   Avoid formal words like 'tôi', 'ngài'.
        
        **2. Style (UPDATED):**
        -   **Strong Exclamations**: Translate strong exclamations (e.g., "Oh my god!", "What the hell!") into strong, equivalent Vietnamese slang, including curses (e.g., "vãi cả bìu", "vcl", "dcm").
        -   **Filler Words**: Limit the use of filler words (like "á", "nhé", "nha"). Use them very sparingly, not at the end of every sentence.
        
        **3. Formatting:**
        -   The entire response must be plain text. DO NOT use markdown like '*' or '"'.
        `;
    } else {
        toneInstruction = `
Act as a professional, native ${targetLangName} translator.
Ensure the translation is natural, fluent, and contextually accurate.
Avoid literal, word-for-word translations.
The entire response must be plain text with NO markdown formatting.
`;
    }

    if (isSingleWord) {
        prompt = `
You are an expert bilingual dictionary assistant, translating into ${targetLangName}.
Provide a concise analysis of the following word.
The response must be clean, plain text, with NO markdown formatting (like *, **).
- Part of speech (e.g., noun, verb)
- Meanings (in ${targetLangName})
- Natural example sentence (in the original language) and its fluent, natural translation (in ${targetLangName}).
Word: "${text}"
        `.trim();
    } else {
        prompt = `
${toneInstruction}
Only return the final, clean, plain-text translation. Do not include explanations or notes.
Text: ${text}
        `.trim();
    }
    return prompt;
}

function buildImageAnalysisPrompt(text, targetLang, tone) {
    const langNames = {
        "vi-VN": "Vietnamese", "en-US": "English", "zh-CN": "Chinese",
        "ja-JP": "Japanese", "ko-KR": "Korean", "fr-FR": "French",
        "de-DE": "German", "es-ES": "Spanish",
    };
    const targetLangName = langNames[targetLang] || "Vietnamese";

    let toneInstruction = "";
    if (tone === 'vietnamese_native') {
        toneInstruction = `
            Phong cách giao tiếp: Cực kỳ thoải mái, tự nhiên, văn nói 'đường phố'.
            
            **Quy tắc xưng hô (QUAN TRỌNG):**
            1.  **"I" và "you"**: PHẢI chọn MỘT cặp: (tao - mày), (tớ - cậu), (mình - bạn).
            2.  **"they" hoặc "them"**: PHẢI dùng "bọn nó" hoặc "tụi nó".
            3.  **Ngôn ngữ**: Tránh từ ngữ trang trọng.
            
            **Quy tắc văn phong (CẬP NHẬT):**
            4.  **Câu Cảm Thán**: Dịch các câu cảm thán mạnh (như 'Oh my god!', 'What the hell!') sang tiếng Việt tương đương, kể cả chửi thề (ví dụ: vãi cả bìu, vcl, dcm, đm).
            5.  **Từ Đệm**: Hạn chế dùng các từ đệm (như 'á', 'nhé', 'nha', 'trời ơi') ở cuối câu. Dùng tiết chế, không lạm dụng.
        `;
    } else {
        toneInstruction = `
Phong cách giao tiếp: Chuyên nghiệp, chính xác, tự nhiên, trôi chảy.
Đảm bảo độ chính xác theo ngữ cảnh.
`;
    }

    return `
Bạn là một nhà phân tích chuyên nghiệp và dịch giả bản địa ${targetLangName}.
Nhiệm vụ của bạn là phân tích văn bản được trích xuất từ một hình ảnh.

**Các bước phân tích:**
1.  **Dịch:** Đầu tiên, cung cấp bản dịch ${targetLangName} trôi chảy của TOÀN BỘ văn bản.
2.  **Tóm tắt (Nếu phức tạp):** Sau bản dịch, nếu văn bản phức tạp, lộn xộn (như hóa đơn, biểu mẫu) hoặc rất dài, HÃY thêm một dòng mới, viết "--- TÓM TẮT ---", và cung cấp một bản tóm tắt sạch sẽ, đơn giản, gạch đầu dòng về thông tin chính bằng ${targetLangName}. Nếu văn bản đơn giản và ngắn, hãy bỏ qua bước này.
3.  **Văn phong:** Áp dụng văn phong sau cho cả bản dịch và bản tóm tắt:
    ${toneInstruction}

**Định dạng phản hồi:**
-   Toàn bộ phản hồi PHẢI là văn bản thuần túy (plain text).
-   KHÔNG sử dụng markdown (như *, **, #). Sử dụng dấu gạch ngang (-) đơn giản cho các gạch đầu dòng trong phần tóm tắt nếu cần.

**Văn bản được trích xuất từ ảnh:**
${text}
    `.trim();
}

async function callVisionAPI(imageUrl, apiKey) {
    
    if (imageUrl.startsWith('data:')) {
        try {
            const base64String = imageUrl.split(',')[1];
            if (!base64String) throw new Error("Data URI không hợp lệ");
            
            const requestPayload = {
                image: { content: base64String }, 
                features: [{ type: "TEXT_DETECTION" }]
            };
            
            const response = await fetch(
                `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ requests: [requestPayload] })
                }
            );

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || response.statusText);
            }

            const data = await response.json();
            const annotation = data.responses?.[0];
            if (annotation.error) {
                throw new Error(`Vision API (data URI) lỗi: ${annotation.error.message}`);
            }
            const text = annotation?.fullTextAnnotation?.text;
            if (!text || text.trim().length === 0) {
                throw new Error("Không tìm thấy văn bản (data URI).");
            }
            return text; 

        } catch (error) {
            throw new Error(`Lỗi xử lý data URI: ${error.message}`);
        }
    }

    let firstError;
    try {
        const requestPayload1 = {
            image: { source: { imageUri: imageUrl } }, 
            features: [{ type: "TEXT_DETECTION" }]
        };
        
        const response1 = await fetch(
            `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ requests: [requestPayload1] })
            }
        );

        if (!response1.ok) {
            const errorData = await response1.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || response1.statusText;
            throw new Error(`Cloud Vision API lỗi ${response1.status}: ${errorMsg}`);
        }

        const data1 = await response1.json();
        const annotation1 = data1.responses?.[0];
        
        if (annotation1.error) {
            throw new Error(annotation1.error.message);
        }

        const text1 = annotation1?.fullTextAnnotation?.text;
        if (text1 && text1.trim().length > 0) {
            return text1; 
        }
        
        throw new Error("Không tìm thấy văn bản (Cách 1).");

    } catch (error1) {
        firstError = error1.message;
        console.warn(`Cách 1 (imageUri) thất bại: "${firstError}". Thử Cách 2 (base64 fallback)...`);

        try {
            const imageResponse = await fetch(imageUrl);
            if (!imageResponse.ok) {
                throw new Error(`Không thể tải ảnh về: ${imageResponse.statusText}`);
            }
            const buffer = await imageResponse.arrayBuffer();
            
            let binary = '';
            const bytes = new Uint8Array(buffer);
            for (let i = 0; i < bytes.byteLength; i++) {
                binary += String.fromCharCode(bytes[i]);
            }
            const base64String = btoa(binary);

            const requestPayload2 = {
                image: { content: base64String }, 
                features: [{ type: "TEXT_DETECTION" }]
            };
            const response2 = await fetch(
                `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ requests: [requestPayload2] })
                }
            );

            if (!response2.ok) {
                const errorData = await response2.json().catch(() => ({}));
                throw new Error(errorData.error?.message || response2.statusText);
            }
            
            const data2 = await response2.json();
            const annotation2 = data2.responses?.[0];
            if (annotation2.error) { 
                throw new Error(`Vision (fallback) lỗi: ${annotation2.error.message}`); 
            }
            
            const text2 = annotation2?.fullTextAnnotation?.text;
            if (!text2 || text2.trim().length === 0) { 
                throw new Error("Không tìm thấy văn bản (Cách 2)."); 
            }
            
            return text2; 

        } catch (error2) {
            throw new Error(`Thua! Không tìm thấy chữ trong ảnh`);
        }
    }
}

async function callGCPTranslateAPI(apiKey, text, targetLang) {
    const langCode = targetLang.split("-")[0];

    const response = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${apiKey}`,
        {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                q: text,
                target: langCode,
            }),
        }
    );

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMsg = errorData.error?.message || response.statusText;
        throw new Error(`GCP Translate API lỗi ${response.status}: ${errorMsg}`);
    }

    const data = await response.json();
    if (data.data && data.data.translations && data.data.translations[0]) {
        return data.data.translations[0].translatedText;
    } else {
        throw new Error("GCP Translate API không trả về kết quả");
    }
}

async function callGoogleCloudTTS(text) {
    try {
        const data = await chrome.storage.sync.get(["gcpTtsApiKey", "targetLang", "voicePrefs"]);
        const apiKey = data.gcpTtsApiKey;
        const targetLang = data.targetLang || "vi-VN"; 
        const voicePrefs = data.voicePrefs || {};

        if (!apiKey) {
            return { success: false, error: "Chưa cài đặt Google Cloud API key (cho TTS)" };
        }

        const langCode = targetLang;
        let voiceName;

        if (voicePrefs[langCode]) {
            voiceName = voicePrefs[langCode]; 
        } else {
            const defaultVoices = {
                 "vi-VN": "vi-VN-Wavenet-A",
                 "en-US": "en-US-Wavenet-D",
                 "ja-JP": "ja-JP-Wavenet-B",
                 "ko-KR": "ko-KR-Wavenet-A",
                 "zh-CN": "cmn-CN-Wavenet-A",
                 "fr-FR": "fr-FR-Wavenet-A",
                 "de-DE": "de-DE-Wavenet-F",
                 "es-ES": "es-ES-Wavenet-B",
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
                    voice: {
                        languageCode: langCode,
                        name: voiceName,
                    },
                    audioConfig: { audioEncoding: "MP3" },
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMsg = errorData.error?.message || response.statusText;
            throw new Error(`GCP TTS API lỗi ${response.status}: ${errorMsg}`);
        }

        const result = await response.json();
        if (result && result.audioContent) {
            return { success: true, audioBase64: result.audioContent };
        } else {
            throw new Error("GCP API không trả về audioContent");
        }
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}
