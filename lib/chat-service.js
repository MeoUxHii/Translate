const MAX_SHORT_TERM_MEMORY = 20; 
const SUMMARIZE_THRESHOLD = 10;   

async function handleSmartChat(fullChatHistory, tone = 'dan_chuyen') {
    try {
      const data = await chrome.storage.sync.get([
        "apiKeys",
        "currentKeyIndex",
        "translationTone", // Vẫn lấy để dự phòng
      ]);
      
      // Tạo key động cho bộ nhớ dài hạn dựa trên Tone
      const memoryKey = `longTermMemory_${tone}`;
      const indexKey = `lastSummarizedIndex_${tone}`;

      const memoryData = await chrome.storage.local.get([memoryKey, indexKey]);
      
      if (!data.apiKeys || data.apiKeys.length === 0)
        return { success: false, error: "Chưa nhập Gemini API Key!" };
  
      // Sử dụng tone được truyền vào (để đảm bảo đúng mode hiện tại)
      let systemInstructionText = getChatSystemInstruction(tone); 
      
      let longTermMemory = memoryData[memoryKey] || "";
      let lastSummarizedIndex = memoryData[indexKey] || 0;
  
      if (fullChatHistory.length < lastSummarizedIndex) {
          longTermMemory = "";
          lastSummarizedIndex = 0;
          await chrome.storage.local.set({ [memoryKey]: "", [indexKey]: 0 });
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
                  // Lưu vào key riêng biệt
                  chrome.storage.local.set({ 
                      [memoryKey]: newSummary,
                      [indexKey]: newIndex
                  });
                  console.log(`[${tone}] Memory updated:`, newSummary);
              })
              .catch(err => console.error("Lỗi tóm tắt ngầm:", err));
      }
  
      if (longTermMemory) {
          systemInstructionText += `\n\n### KÝ ỨC DÀI HẠN (TÓM TẮT):\n${longTermMemory}\n\n(Sử dụng thông tin này để duy trì ngữ cảnh, ưu tiên hội thoại hiện tại).`;
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
      // console.log("Đang tóm tắt ký ức...");
      
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
          prompt, 
          apiKeys,
          keyIndex
      );
  
      if (summaryResult.success) {
          return summaryResult.translation; 
      } else {
          throw new Error("Tóm tắt thất bại: " + summaryResult.error);
      }
  }