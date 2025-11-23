export function showStatus(msg, type, elementId = "status") {
    const statusDiv = document.getElementById(elementId);
    if (statusDiv) {
        statusDiv.className = `status ${type}`;
        statusDiv.textContent = msg;
        setTimeout(() => {
            statusDiv.textContent = "";
            statusDiv.className = "status";
        }, 3000);
    }
}

export function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    })[m]);
}

export function initCustomSelect(selectId) {
    const originalSelect = document.getElementById(selectId);
    if (!originalSelect) return;

    const existingWrapper = originalSelect.parentElement.querySelector('.custom-select-container');
    if (existingWrapper) existingWrapper.remove();

    const container = document.createElement("div");
    container.classList.add("custom-select-container");

    const trigger = document.createElement("div");
    trigger.classList.add("custom-select-trigger");

    const selectedOption = originalSelect.options[originalSelect.selectedIndex];
    trigger.textContent = selectedOption ? selectedOption.textContent : "Chọn...";

    const optionsDiv = document.createElement("div");
    optionsDiv.classList.add("custom-options");

    Array.from(originalSelect.options).forEach(opt => {
        const divOpt = document.createElement("div");
        divOpt.classList.add("custom-option");
        divOpt.textContent = opt.textContent;
        divOpt.dataset.value = opt.value;

        if (opt.disabled) {
            divOpt.classList.add("is-header");
        } else {
            divOpt.addEventListener("click", () => {
                originalSelect.value = opt.value; 
                trigger.textContent = opt.textContent; 

                container.querySelectorAll('.custom-option').forEach(o => o.classList.remove('selected'));
                divOpt.classList.add('selected');

                const event = new Event('change');
                originalSelect.dispatchEvent(event);

                container.classList.remove("open");
            });
        }

        if (opt.style.fontWeight === "bold") {
            divOpt.style.fontWeight = "bold";
            divOpt.style.color = opt.style.color;
        }

        if (originalSelect.value === opt.value) {
            divOpt.classList.add("selected");
        }

        optionsDiv.appendChild(divOpt);
    });

    trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        document.querySelectorAll('.custom-select-container.open').forEach(el => {
            if (el !== container) el.classList.remove('open');
        });
        container.classList.toggle("open");
    });

    container.appendChild(trigger);
    container.appendChild(optionsDiv);

    originalSelect.parentNode.insertBefore(container, originalSelect.nextSibling);
}

document.addEventListener("click", (e) => {
    if (!e.target.closest(".custom-select-container")) {
        document.querySelectorAll(".custom-select-container.open").forEach(el => {
            el.classList.remove("open");
        });
    }
});