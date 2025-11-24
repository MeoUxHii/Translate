// Module xử lý Audio, hình ảnh và logic parse tin nhắn media
// Tạm thời vẫn lấy map từ window (sẽ refactor sau)
const { IMAGE_MAP, VOICE_MAP } = window;

export const COOLDOWN_TIME = 10 * 60 * 1000; // 10 phút

export let mediaState = {
    lastImageTime: 0,
    lastVoiceTime: 0,
    sentImages: [],
    sentVoices: []
};

export function loadMediaState() {
    chrome.storage.local.get(['mediaState'], (result) => {
        if (result.mediaState) {
            mediaState = result.mediaState;
        }
    });
}

export function saveMediaState() {
    chrome.storage.local.set({ mediaState: mediaState });
}

export function updateMediaState(newState) {
    mediaState = { ...mediaState, ...newState };
    saveMediaState();
}

// Reset state (khi bấm nút tạo cuộc trò chuyện mới)
export function resetMediaState() {
    mediaState = { lastImageTime: 0, lastVoiceTime: 0, sentImages: [], sentVoices: [] };
    saveMediaState();
}

// --- HELPER: Format giây thành mm:ss ---
function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

// --- TẠO AUDIO BUBBLE (Custom Player) ---
export function createAudioBubble(audioSrc) {
    const bubble = document.createElement("div");
    bubble.className = "audio-msg-bubble";

    // 1. Nút Play/Pause
    const btn = document.createElement("button");
    btn.className = "audio-control-btn";
    const playIcon = `<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`;
    const pauseIcon = `<svg viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
    btn.innerHTML = playIcon;

    // 2. Container chứa sóng
    const waveContainer = document.createElement("div");
    waveContainer.className = "wave-container";

    // Fallback bar
    const fallbackBar = document.createElement("div");
    fallbackBar.className = "fallback-progress-bar";
    const fallbackFill = document.createElement("div");
    fallbackFill.className = "fallback-progress-fill";
    fallbackBar.appendChild(fallbackFill);
    fallbackBar.style.display = "none";
    waveContainer.appendChild(fallbackBar);

    // WaveSurfer wrapper
    const uniqueId = 'waveform-' + Math.random().toString(36).substr(2, 9);
    const waveWrapper = document.createElement("div");
    waveWrapper.id = uniqueId;
    waveWrapper.style.width = "100%";
    waveContainer.appendChild(waveWrapper);

    // 3. Thời lượng (Đếm ngược)
    const timeDiv = document.createElement("div");
    timeDiv.className = "audio-duration";
    timeDiv.textContent = "--:--";

    bubble.appendChild(btn);
    bubble.appendChild(waveContainer);
    bubble.appendChild(timeDiv);

    // --- LOGIC KHỞI TẠO ---
    setTimeout(() => {
        // KIỂM TRA THƯ VIỆN
        if (typeof WaveSurfer === 'undefined') {
            console.warn("WaveSurfer not found, using fallback audio.");
            waveWrapper.style.display = "none";
            fallbackBar.style.display = "block";

            const audio = new Audio(audioSrc);

            audio.onloadedmetadata = () => {
                timeDiv.textContent = formatTime(audio.duration);
            };

            audio.ontimeupdate = () => {
                const percent = (audio.currentTime / audio.duration) * 100;
                fallbackFill.style.width = `${percent}%`;
                const remaining = Math.max(0, audio.duration - audio.currentTime);
                timeDiv.textContent = formatTime(remaining);
            };

            audio.onended = () => {
                btn.innerHTML = playIcon;
                btn.classList.remove('playing');
                fallbackFill.style.width = "0%";
                timeDiv.textContent = formatTime(audio.duration);
            };

            btn.onclick = (e) => {
                e.stopPropagation();
                if (audio.paused) {
                    document.querySelectorAll('audio').forEach(a => { if (a !== audio) a.pause(); });
                    audio.play();
                    btn.innerHTML = pauseIcon;
                    btn.classList.add('playing');
                } else {
                    audio.pause();
                    btn.innerHTML = playIcon;
                    btn.classList.remove('playing');
                }
            };

            waveContainer.onclick = (e) => {
                e.stopPropagation();
                const rect = waveContainer.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                if (Number.isFinite(audio.duration)) {
                    audio.currentTime = percent * audio.duration;
                    if (audio.paused) { audio.play(); btn.innerHTML = pauseIcon; btn.classList.add('playing'); }
                }
            };
            return;
        }

        // --- WAVESURFER LOGIC ---
        try {
            const wavesurfer = WaveSurfer.create({
                container: `#${uniqueId}`,
                waveColor: '#d1d5db',
                progressColor: '#000000',
                cursorColor: '#9ca3af',
                barWidth: 3,
                barRadius: 3,
                cursorWidth: 2,
                height: 32,
                barGap: 2,
                url: audioSrc,
                normalize: true,
            });

            wavesurfer.on('ready', () => {
                const duration = wavesurfer.getDuration();
                timeDiv.textContent = formatTime(duration);
            });

            wavesurfer.on('audioprocess', (currentTime) => {
                const duration = wavesurfer.getDuration();
                const remaining = Math.max(0, duration - currentTime);
                timeDiv.textContent = formatTime(remaining);
            });

            wavesurfer.on('interaction', () => {
                const currentTime = wavesurfer.getCurrentTime();
                const duration = wavesurfer.getDuration();
                timeDiv.textContent = formatTime(duration - currentTime);
                if (!wavesurfer.isPlaying()) {
                    wavesurfer.play();
                    btn.innerHTML = pauseIcon;
                    btn.classList.add('playing');
                }
            });

            wavesurfer.on('finish', () => {
                btn.innerHTML = playIcon;
                btn.classList.remove('playing');
                wavesurfer.stop();
                const duration = wavesurfer.getDuration();
                timeDiv.textContent = formatTime(duration);
            });

            btn.onclick = (e) => {
                e.stopPropagation();
                wavesurfer.playPause();
                if (wavesurfer.isPlaying()) {
                    btn.innerHTML = pauseIcon;
                    btn.classList.add('playing');
                } else {
                    btn.innerHTML = playIcon;
                    btn.classList.remove('playing');
                }
            };
        } catch (err) {
            console.error("WaveSurfer init error:", err);
            timeDiv.textContent = "Err";
        }

    }, 100);

    return bubble;
}

// --- Parse nội dung tin nhắn để tìm thẻ Media ---
export function parseMessageContent(rawText, isHistory = false) {
    let displayText = rawText || "";
    const mediaItems = [];

    // Xử lý ảnh: {{IMG:id}}
    const imgRegex = /{{IMG:([a-zA-Z0-9_]+)}}/g;
    let imgMatch;
    while ((imgMatch = imgRegex.exec(rawText)) !== null) {
        const imgId = imgMatch[1];
        const now = new Date().getTime();

        if (isHistory || now - mediaState.lastImageTime > COOLDOWN_TIME || !mediaState.sentImages.includes(imgId)) {
            if (window.IMAGE_MAP && window.IMAGE_MAP[imgId]) {
                mediaItems.push({ type: 'image', src: window.IMAGE_MAP[imgId], id: imgId });

                if (!isHistory) {
                    updateMediaState({
                        lastImageTime: now,
                        sentImages: [...mediaState.sentImages, imgId]
                    });
                }
            }
        }
        displayText = displayText.replace(imgMatch[0], "");
    }

    // Xử lý voice topic: {{VOICE:topic}}
    const voiceTopicRegex = /{{VOICE:([a-zA-Z0-9_]+)}}/g;
    let voiceTopicMatch;
    while ((voiceTopicMatch = voiceTopicRegex.exec(rawText)) !== null) {
        const topic = voiceTopicMatch[1];
        const now = new Date().getTime();

        if (isHistory || (now - mediaState.lastVoiceTime > COOLDOWN_TIME)) {
            if (window.VOICE_MAP && window.VOICE_MAP[topic]) {
                const files = window.VOICE_MAP[topic];
                const availableFiles = files.filter(f => !mediaState.sentVoices.includes(f));
                const candidates = availableFiles.length > 0 ? availableFiles : files;
                const selectedFile = candidates[Math.floor(Math.random() * candidates.length)];

                mediaItems.push({ type: 'voice', src: selectedFile });

                if (!isHistory) {
                    // Chỉ cập nhật cooldown khi gửi voice topic, không phải khi replay
                    updateMediaState({
                        lastVoiceTime: now,
                        sentVoices: [...mediaState.sentVoices, selectedFile]
                    });
                }
            }
        }
        displayText = displayText.replace(voiceTopicMatch[0], "");
    }

    // Xử lý voice file cụ thể: {{VOICE_FILE:path}}
    const voiceFileRegex = /{{VOICE_FILE:([^}]+)}}/g;
    let voiceFileMatch;
    while ((voiceFileMatch = voiceFileRegex.exec(rawText)) !== null) {
        mediaItems.push({ type: 'voice', src: voiceFileMatch[1] });
        displayText = displayText.replace(voiceFileMatch[0], "");
    }

    return { displayText: displayText.trim(), mediaItems };
}