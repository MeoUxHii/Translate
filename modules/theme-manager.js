import { showStatus } from './ui-utils.js';

export function initTheme() {
    const presetListContainer = document.getElementById("preset-list");
    const colorListContainer = document.getElementById("color-list");
    const addColorBtn = document.getElementById("add-color-btn");
    const gradientAngleSlider = document.getElementById("gradientAngle");
    const bgOpacitySlider = document.getElementById("bgOpacity");
    const angleValDisplay = document.getElementById("angleVal");
    const opacityValDisplay = document.getElementById("opacityVal");
    const themePreviewBar = document.getElementById("themePreviewBar");
    const saveThemeBtn = document.getElementById("saveThemeBtn");

    let currentTheme = {
        colors: ["#6DD5FA", "#FFDA63"], 
        angle: 135,
        opacity: 100
    };

    const themePresets = [
        { colors: ["#FF9A9E", "#FECFEF", "#FEF9D7"], angle: 135 },
        { colors: ["#a18cd1", "#fbc2eb", "#fad0c4"], angle: 135 },
        { colors: ["#84fab0", "#8fd3f4", "#a1c4fd"], angle: 120 },
        { colors: ["#fccb90", "#d57eeb", "#e0c3fc"], angle: 135 },
        { colors: ["#e0c3fc", "#8ec5fc", "#91EAE4"], angle: 135 },
        { colors: ["#43e97b", "#38f9d7", "#11998e"], angle: 135 },
        { colors: ["#fa709a", "#fee140", "#fdcbf1"], angle: 135 },
        { colors: ["#ffc3a0", "#ffafbd", "#ffc3a0"], angle: 135 },
        { colors: ["#74EBD5", "#9FACE6", "#ffffff"], angle: 90 },
        { colors: ["#FA8BFF", "#2BD2FF", "#2BFF88"], angle: 90 },
        { colors: ["#FEE140", "#FA709A", "#FEE140"], angle: 90 },
        { colors: ["#3EECAC", "#EE74E1", "#ffffff"], angle: 19 },
        { colors: ["#FF9A9E", "#FECFEF", "#F6D365"], angle: 0 },
        { colors: ["#ff9a9e", "#fecfef", "#a18cd1"], angle: 135 },
        { colors: ["#21D4FD", "#B721FF", "#21D4FD"], angle: 19 },
        { colors: ["#08AEEA", "#2AF598", "#08AEEA"], angle: 0 },
        { colors: ["#0093E9", "#80D0C7", "#ffffff"], angle: 160 },
        { colors: ["#4158D0", "#C850C0", "#FFCC70"], angle: 43 },
        { colors: ["#00DBDE", "#FC00FF", "#00DBDE"], angle: 135 },
        { colors: ["#85FFBD", "#FFFB7D", "#ffffff"], angle: 45 },
        { colors: ["#FF3CAC", "#784BA0", "#2B86C5"], angle: 225 },
        { colors: ["#D9AFD9", "#97D9E1", "#ffffff"], angle: 0 },
        { colors: ["#FBAB7E", "#F7CE68", "#ffffff"], angle: 62 },
        { colors: ["#8BC6EC", "#9599E2", "#ffffff"], angle: 135 },
        { colors: ["#0f0c29", "#302b63", "#24243e"], angle: 135 },
        { colors: ["#232526", "#414345", "#232526"], angle: 135 },
        { colors: ["#000000", "#434343", "#000000"], angle: 135 },
        { colors: ["#141e30", "#243b55", "#141e30"], angle: 135 },
        { colors: ["#4b6cb7", "#182848", "#4b6cb7"], angle: 135 },
        { colors: ["#870000", "#190a05", "#870000"], angle: 135 },
        { colors: ["#16222a", "#3a6073", "#16222a"], angle: 135 },
        { colors: ["#000428", "#004e92", "#000428"], angle: 135 }
    ];

    chrome.storage.sync.get(["userTheme"], (data) => {
        if (data.userTheme) {
            currentTheme = data.userTheme;
        }
        renderUI();
        applyTheme(currentTheme);
    });

    function renderUI() {
        renderPresets();
        renderColorInputs();
        
        if(gradientAngleSlider) gradientAngleSlider.value = currentTheme.angle;
        if(bgOpacitySlider) bgOpacitySlider.value = currentTheme.opacity;
        if(angleValDisplay) angleValDisplay.textContent = currentTheme.angle;
        if(opacityValDisplay) opacityValDisplay.textContent = currentTheme.opacity;

        if(gradientAngleSlider) {
            gradientAngleSlider.addEventListener("input", (e) => {
                currentTheme.angle = e.target.value;
                angleValDisplay.textContent = currentTheme.angle;
                updatePreview();
            });
        }

        if(bgOpacitySlider) {
            bgOpacitySlider.addEventListener("input", (e) => {
                currentTheme.opacity = e.target.value;
                opacityValDisplay.textContent = currentTheme.opacity;
                updatePreview();
            });
        }

        if(addColorBtn) {
            addColorBtn.addEventListener("click", () => {
                if (currentTheme.colors.length >= 5) {
                    alert("Thôi tham vừa thôi, 5 màu là loè loẹt lắm rồi!");
                    return;
                }
                currentTheme.colors.unshift(getRandomHexColor()); 
                renderColorInputs();
                updatePreview();
            });
        }

        if(saveThemeBtn) {
            saveThemeBtn.addEventListener("click", () => {
                chrome.storage.sync.set({ userTheme: currentTheme }, () => {
                    showStatus("✅ Đã lưu Theme!", "success", "theme-status");
                    applyTheme(currentTheme); 
                });
            });
        }
    }

    function getRandomHexColor() {
        return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
    }

    function renderPresets() {
        if (!presetListContainer) return;
        presetListContainer.innerHTML = "";
        
        themePresets.forEach(preset => {
            const div = document.createElement("div");
            div.className = "preset-item";
            const rgbaColors = preset.colors.map(c => hexToRgba(c, 100));
            div.style.background = `linear-gradient(${preset.angle}deg, ${rgbaColors.join(", ")})`;
            div.title = "Chọn màu này";

            div.addEventListener("click", () => {
                currentTheme.colors = [...preset.colors];
                currentTheme.angle = preset.angle;
                
                if(gradientAngleSlider) gradientAngleSlider.value = currentTheme.angle;
                if(angleValDisplay) angleValDisplay.textContent = currentTheme.angle;

                renderColorInputs();
                updatePreview();
            });

            presetListContainer.appendChild(div);
        });
    }

    function renderColorInputs() {
        if (!colorListContainer) return;
        colorListContainer.innerHTML = "";
        currentTheme.colors.forEach((color, index) => {
            const div = document.createElement("div");
            div.className = "color-item";
            
            const wrapper = document.createElement("div");
            wrapper.className = "color-input-wrapper";

            const input = document.createElement("input");
            input.type = "color";
            input.value = color;
            input.addEventListener("input", (e) => {
                currentTheme.colors[index] = e.target.value;
                updatePreview();
            });

            wrapper.appendChild(input);
            div.appendChild(wrapper);

            if (currentTheme.colors.length > 2) {
                const btn = document.createElement("button");
                btn.className = "remove-color-btn";
                btn.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                        <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>`;
                btn.addEventListener("click", () => {
                    currentTheme.colors.splice(index, 1);
                    renderColorInputs();
                    updatePreview();
                });
                div.appendChild(btn);
            }
            colorListContainer.appendChild(div);
        });
    }

    function hexToRgba(hex, alphaPercent) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        const a = alphaPercent / 100;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    function getGradientString(theme) {
        const rgbaColors = theme.colors.map(c => hexToRgba(c, theme.opacity));
        return `linear-gradient(${theme.angle}deg, ${rgbaColors.join(", ")})`;
    }

    function updateTextColor(colors) {
        let totalLum = 0;
        colors.forEach(hex => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            const lum = (0.299 * r + 0.587 * g + 0.114 * b);
            totalLum += lum;
        });
        
        const avgLum = totalLum / colors.length;
        const body = document.body;
        
        if (avgLum < 140) {
            body.style.setProperty('--text-color', '#f0f0f0');
            body.classList.add('dark-mode'); 
        } else {
            body.style.setProperty('--text-color', '#333333');
            body.classList.remove('dark-mode');
        }
    }

    function updatePreview() {
        const grad = getGradientString(currentTheme);
        if (themePreviewBar) themePreviewBar.style.background = grad;
        document.body.style.background = grad;
        updateTextColor(currentTheme.colors);
    }

    function applyTheme(theme) {
        const grad = getGradientString(theme);
        document.body.style.background = grad;
        if (themePreviewBar) themePreviewBar.style.background = grad;
        updateTextColor(theme.colors);
    }
}