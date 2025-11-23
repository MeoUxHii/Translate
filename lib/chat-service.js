const MAX_SHORT_TERM_MEMORY = 20; 
const SUMMARIZE_THRESHOLD = 10;   

async function handleSmartChat(fullChatHistory) {
    try {
      const data = await chrome.storage.sync.get([
        "apiKeys",
        "currentKeyIndex",
        "translationTone",
      ]);
      const memoryData = await chrome.storage.local.get(["longTermMemory", "lastSummarizedIndex"]);
      
      if (!data.apiKeys || data.apiKeys.length === 0)
        return { success: false, error: "Chưa nhập Gemini API Key!" };
  
      const tone = data.translationTone || "default";
      let systemInstructionText = getChatSystemInstruction(tone); // Hàm này từ prompts.js
      
      let longTermMemory = memoryData.longTermMemory || "";
      let lastSummarizedIndex = memoryData.lastSummarizedIndex || 0;
  
      if (fullChatHistory.length < lastSummarizedIndex) {
          longTermMemory = "";
          lastSummarizedIndex = 0;
          await chrome.storage.local.set({ longTermMemory: "", lastSummarizedIndex: 0 });
      }
  
      let activeContextMessages = [];
      if (fullChatHistory.length > MAX_SHORT_TERM_MEMORY) {
          activeContextMessages = fullChatHistory.slice(-MAX_SHORT_TERM_MEMORY);
      } else {
          activeContextMessages = fullChatHistory;
      }
  
      const unsummarizedCount = fullChatHistory.length - activeContextMessages.length - lastSummarizedIndex;
      
      if (unsummarizedCount >= SUMMARIZE_THRESHOLD) {
          const messagesToSummarize = fullChatHistory.slice(lastSummarizedIndex, fullChatHistory.length - activeContextMessages.length);
          
          performBackgroundSummarization(messagesToSummarize, longTermMemory, data.apiKeys, data.currentKeyIndex || 0)
              .then(newSummary => {
                  const newIndex = fullChatHistory.length - activeContextMessages.length;
                  chrome.storage.local.set({ 
                      longTermMemory: newSummary,
                      lastSummarizedIndex: newIndex
                  });
                  console.log("Memory updated:", newSummary);
              })
              .catch(err => console.error("Lỗi tóm tắt ngầm:", err));
      }
  
      if (longTermMemory) {
          systemInstructionText += `\n\n### KÝ ỨC DÀI HẠN:\n${longTermMemory}\n\n(Ưu tiên bối cảnh hội thoại hiện tại).`;
      }
  
      let contents = JSON.parse(JSON.stringify(activeContextMessages));
  
      if (contents.length > 0 && contents[0].role === "user") {
          contents[0].parts[0].text = systemInstructionText + "\n\n" + contents[0].parts[0].text;
      } else {
          contents.unshift({
            role: "user",
            parts: [{ text: systemInstructionText }],
          });
      }
  
      const geminiResult = await callGeminiChatWithRotation(
        contents,
        data.apiKeys,
        data.currentKeyIndex || 0
      );
  
      if (geminiResult.success) {
        await chrome.storage.sync.set({
          currentKeyIndex: geminiResult.newKeyIndex,
        });
        return { success: true, reply: geminiResult.reply };
      } else {
        return { success: false, error: geminiResult.error };
      }
    } catch (e) {
      return { success: false, error: e.message };
    }
  }
  
  async function performBackgroundSummarization(messages, currentMemory, apiKeys, keyIndex) {
      console.log("Đang tóm tắt ký ức...");
      
      let conversationText = messages.map(msg => {
          const text = msg.parts[0].text || "";
          const role = msg.role === "user" ? "User" : "AI";
          return `${role}: ${text}`;
      }).join("\n");
  
      const prompt = `
      Bạn là module quản lý bộ nhớ AI.
      KÝ ỨC CŨ: "${currentMemory}"
      HỘI THOẠI MỚI:
      ${conversationText}
      
      NHIỆM VỤ: Tóm tắt ngắn gọn (<100 từ) các thông tin quan trọng về User (tên, sở thích, công việc) và bối cảnh chính. Bỏ qua chào hỏi xã giao. Trả về text thuần.
      `;
  
      const summaryResult = await callGeminiWithRotation(
          prompt, // Prompt text
          apiKeys,
          keyIndex
      );
  
      if (summaryResult.success) {
          return summaryResult.translation; // Hàm rotation trả về field là 'translation'
      } else {
          throw new Error("Tóm tắt thất bại: " + summaryResult.error);
      }
  }