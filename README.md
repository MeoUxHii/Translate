# **MeoU \- Tiện ích Dịch Thuật AI 😼**

**MeoU** là một tiện ích mở rộng (Extension) cho trình duyệt, sử dụng sức mạnh của Google Gemini và Google Cloud API để cung cấp các tính năng dịch thuật mạnh mẽ, dịch văn bản trực tiếp từ hình ảnh (OCR), và phát âm thanh (TTS) cho nội dung đã dịch.

## **🚀 Tính năng nổi bật**

* **Dịch Văn Bản Thông Minh**: Bôi đen văn bản trên web và dịch ngay lập tức bằng một cú click hoặc phím tắt.  
* **Dịch Ảnh (OCR)**: Click chuột phải vào bất kỳ hình ảnh nào trên web và chọn "Hình đó có gì?" để trích xuất và dịch văn bản bên trong ảnh.  
* **Phát Âm (TTS)**: Nghe bản dịch bằng giọng đọc tự nhiên của Google Cloud Text-to-Speech.  
* **Hỗ trợ Đa Model**:  
  * **Gemini**: Hỗ trợ nhiều API key (tự động xoay vòng) và hai văn phong dịch độc đáo.  
  * **Google Cloud**: Sử dụng Cloud Translation API truyền thống tương tự như Google Dịch.  
* **Tùy biến Văn Phong (Chỉ áp dụng với model Gemini)**:  
  * **Dân Chuyên**: Dịch thuật chuyên nghiệp, chính xác.  
  * **Bố mày người Việt**: Văn phong "đường phố", thân mật, sử dụng từ lóng và các câu cảm thán mạnh

## **🛠️ Hướng dẫn Cài đặt**

Vì tiện ích này yêu cầu API Key cá nhân, bạn cần cài đặt thủ công qua chế độ Nhà phát triển (Developer Mode).

### **1\. Cài đặt Tiện ích**

1. Tải toàn bộ dự án này về máy tính của bạn (dưới dạng file .zip) và giải nén ra một thư mục (ví dụ: MeoU-Extension).  
2. Mở trình duyệt (Chrome, Edge, ...).  
3. Truy cập trang quản lý tiện ích:  
   * **Chrome**: chrome://extensions  
   * **Edge**: edge://extensions  
4. Bật **Chế độ nhà phát triển** (Developer Mode) ở góc trên bên phải.  
5. Click vào nút **Tải tiện ích đã giải nén** (Load unpacked).  
6. Chọn thư mục MeoU-Extension bạn vừa giải nén. Tiện ích sẽ được cài đặt.

### **2\. Cấu hình API Keys (Bắt buộc)**

Sau khi cài, bạn cần cung cấp API Keys để tiện ích hoạt động. Click vào biểu tượng của tiện ích trên thanh công cụ để mở popup Cài đặt.

#### **A. Gemini API Key (Dùng cho Model Gemini)**

1. Truy cập [Google AI Studio](https://aistudio.google.com/app/apikey).  
2. Đăng nhập và tạo một API Key mới.  
3. Sao chép key.  
4. Dán vào ô **Gemini API Keys** trong popup Cài đặt.  
   * *Mẹo*: Bạn có thể dán nhiều key, mỗi key một dòng. Tiện ích sẽ tự động xoay vòng key nếu có lỗi.

#### **B. Google Cloud API Key (Dùng cho TTS, Dịch Ảnh, Model GCP)**

Đây là key quan trọng nhất, dùng cho 3 dịch vụ.

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/) và tạo một dự án mới.  
2. **Bật thanh toán (Enable Billing)** cho dự án của bạn. (Google Cloud API không miễn phí, nhưng có cung cấp một lượng sử dụng miễn phí hàng tháng lên đến 300$).  
3. Trong dự án của bạn, đi tới **APIs & Services** \-\> **Library** (Thư viện).  
4. Tìm và **Bật (Enable)** cả 3 API sau:  
   * Cloud Translation API (Dùng cho dịch)  
   * Cloud Vision API (Dùng cho quét ảnh/OCR)  
   * Cloud Text-to-Speech API (Dùng cho đọc)  
5. Sau khi bật, đi tới **APIs & Services** \-\> **Credentials** (Thông tin xác thực).  
6. Click **Create Credentials** \-\> **API key** để tạo một key mới.  
7. Sao chép (Copy) key này và dán vào ô **Google Cloud API Key** trong popup Cài đặt.

### **3\. Hoàn tất**

Sau khi dán cả hai loại key, nhấn nút **Lưu cài đặt**. Tiện ích đã sẵn sàng để sử dụng\!

## **💡 Cách sử dụng**

* **Dịch văn bản**:  
  1. Bôi đen một đoạn văn bản bất kỳ.  
  2. Click vào biểu tượng 🧐 xuất hiện bên cạnh.  
  3. (Hoặc) Nhấn tổ hợp phím Ctrl \+ Alt \+ T (có thể thay đổi trong content.js).  
* **Dịch ảnh**:  
  1. Click chuột phải vào một hình ảnh.  
  2. Chọn **"Hình đó có gì?"** từ menu ngữ cảnh.  
  3. Popup sẽ hiện ra với nội dung văn bản trong ảnh và bản dịch/tóm tắt.  
* **Nghe đọc**:  
  1. Khi popup dịch thuật hiện ra, click vào biểu tượng loa 🔊 ở góc trên bên phải để nghe đọc.  
* **Thay đổi cài đặt**:  
  1. Click vào biểu tượng tiện ích trên thanh công cụ trình duyệt.  
  2. Tùy chỉnh Model Dịch, Tông giọng, Ngôn ngữ, và Giọng đọc.  
  3. Nhấn **Lưu cài đặt**.

## **📂 Cấu trúc dự án**

.  
├── manifest.json     \# Cấu hình, quyền hạn của extension (Manifest V3)  
├── background.js     \# Xử lý logic nền (gọi API, context menu, xoay vòng key, logic OCR)  
├── content.js        \# Can thiệp vào trang web (hiển thị nút 🧐, popup kết quả)  
├── content.css       \# CSS cho nút 🧐 và popup kết quả  
├── popup.html        \# Giao diện của popup Cài đặt  
├── popup.js          \# Logic cho popup Cài đặt (lưu/tải settings)  
└── icons/            \# (Thư mục chứa icons 16, 48, 128\)

## **💻 Công nghệ sử dụng**

* **Nền tảng**: Chrome Extension API (Manifest V3)  
* **Ngôn ngữ**: JavaScript, HTML5, CSS3  
* **APIs (Google)**:  
  * Gemini API (https://www.google.com/search?q=generativelanguage.googleapis.com)  
  * Cloud Vision API (https://www.google.com/search?q=vision.googleapis.com)  
  * Cloud Translation API (https://www.google.com/search?q=translation.googleapis.com)  
  * Cloud Text-to-Speech API (https://www.google.com/search?q=texttospeech.googleapis.com)  
* **Lưu trữ**: chrome.storage.sync (để lưu cài đặt và API keys)

## **⚠️ Tuyên bố miễn trừ trách nhiệm**

* Đây là một dự án cá nhân được tạo ra cho mục đích học tập và sử dụng cá nhân, không phải là một sản phẩm chính thức.  
* Việc sử dụng các API của Google có thể phát sinh chi phí. Vui lòng kiểm tra biểu phí của Google Cloud và giới hạn của Gemini.  
* Người dùng phải tự lấy và chịu trách nhiệm về API Key của mình.  
* Tiện ích này gửi dữ liệu (văn bản/ảnh bạn chọn) đến máy chủ của Google để xử lý. Vui lòng **không sử dụng** cho các thông tin nhạy cảm hoặc bí mật.  
* Tiện ích này không thu thập bất kỳ thông tin cá nhân hay dữ liệu nào của người dùng. Mọi cài đặt và API key đều được lưu trữ cục bộ trên trình duyệt của bạn thông qua `chrome.storage.sync`.

**❤️ Contributors (Người đóng góp)**
Project Manager: MeoU (Huy Phan)
Creative Director:├ 
                  ├── Vy Dam
                  ├──  Kieu Oanh Dam
                   
