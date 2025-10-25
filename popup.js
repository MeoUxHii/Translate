document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.sync.get(
        [
            "gcpTtsApiKey",
            "apiKeys", 
            "targetLang",
            "voicePrefs",
            "translationService",
            "translationTone", 
            "currentKeyIndex"
        ],
        (data) => {
            if (data.gcpTtsApiKey) {
                document.getElementById("gcpTtsApiKey").value =
                    data.gcpTtsApiKey;
            }
            if (data.apiKeys && Array.isArray(data.apiKeys)) {
                document.getElementById("apiKeys").value =
                    data.apiKeys.join("\n");
            }
            if (data.targetLang) {
                document.getElementById("targetLang").value = data.targetLang;
            }
            if (data.translationService) {
                document.getElementById("translationService").value =
                    data.translationService;
            }
            if (data.translationTone) {
                document.getElementById("translationTone").value =
                    data.translationTone;
            }
            if (data.voicePrefs && data.voicePrefs["vi-VN"]) {
                document.getElementById("voice-vi-VN").value =
                    data.voicePrefs["vi-VN"];
            }
        }
    );
});

document.getElementById("saveBtn").addEventListener("click", () => {
    const gcpTtsApiKey =
        document.getElementById("gcpTtsApiKey").value.trim();
    const targetLang = document.getElementById("targetLang").value;
    const translationService =
        document.getElementById("translationService").value;
    const statusDiv = document.getElementById("status");
    
    const apiKeysRaw = document.getElementById("apiKeys").value;
    const apiKeys = apiKeysRaw
        .split("\n")
        .map((k) => k.trim())
        .filter((k) => k.length > 0);

    const translationTone = document.getElementById("translationTone").value;
    const viVoice = document.getElementById("voice-vi-VN").value;
    const voicePrefs = {
        "vi-VN": viVoice,
    };
    
    if (translationService === "gemini" && apiKeys.length === 0) {
        statusDiv.className = "status error";
        statusDiv.textContent = "❌ Vui lòng nhập ít nhất 1 Gemini API key!";
        return;
    }
    if (translationService === "gcp" && !gcpTtsApiKey) {
        statusDiv.className = "status error";
        statusDiv.textContent = "❌ Vui lòng nhập Google Cloud API key!";
        return;
    }
    if (!gcpTtsApiKey) {
        statusDiv.className = "status error";
        statusDiv.textContent = "❌ Vui lòng nhập Google Cloud API key (cần cho cả TTS)!";
        return;
    }

    chrome.storage.sync.set(
        {
            gcpTtsApiKey: gcpTtsApiKey,
            apiKeys: apiKeys, 
            targetLang: targetLang,
            voicePrefs: voicePrefs,
            translationService: translationService,
            translationTone: translationTone, 
            currentKeyIndex: 0 
        },
        () => {
            statusDiv.className = "status success";
            statusDiv.textContent = "✅ Đã lưu cài đặt!";
            setTimeout(() => {
                statusDiv.style.display = "none";
            }, 3000);
        }
    );
});