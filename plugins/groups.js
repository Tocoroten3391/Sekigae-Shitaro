// ==========================================
// 班の色と名前プラグイン（必須）：班の数、種類、色、名前を決めます。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
function getCurrentGroupColor(n) {
    const saved = localStorage.getItem(`group_color_${n}`);
    if (saved) return saved;
    // 画面の根っこに直接書かれた値を読みます（getComputedStyle は、起動が遅くなるので使いません。既定の色は style.css と同じです）
    const inline = document.documentElement.style.getPropertyValue(`--group-${n}-color`).trim();
    return inline || GROUP_COLOR_DEFAULTS[n];
}

function applyGroupColor(n, hex, persist = true) {
    document.documentElement.style.setProperty(`--group-${n}-color`, hex);
    if (persist) localStorage.setItem(`group_color_${n}`, hex);
}

function loadGroupColorsFromStorage() {
    for (let i = 1; i <= 8; i++) {
        const saved = localStorage.getItem(`group_color_${i}`);
        applyGroupColor(i, saved || GROUP_COLOR_DEFAULTS[i], false);
    }
}

function resetGroupColors() {
    for (let i = 1; i <= 8; i++) {
        applyGroupColor(i, GROUP_COLOR_DEFAULTS[i]);
        const input = $id(`groupColorInput_${i}`);
        if (input) input.value = GROUP_COLOR_DEFAULTS[i];
    }
    renderGroupColorPalette();
    renderClassroom("none");
    showToast("班の色をデフォルトに戻しました。", "success");
}

function initGroupNamesUI() {
    const container = $id("groupNamesFieldsContainer"); 
    if (!container) return;
    
    container.innerHTML = ""; 
    
    for (let i = 1; i <= seatGroupCount; i++) { 
        const row = document.createElement("div"); 
        row.className = "group-name-row"; 
        
        const colorInput = document.createElement("input");
        colorInput.type = "color";
        colorInput.id = `groupColorInput_${i}`;
        colorInput.className = "group-color-dot-input";
        colorInput.value = getCurrentGroupColor(i);
        colorInput.oninput = function() {
            applyGroupColor(i, this.value);
            renderGroupColorPalette();
            renderClassroom("none");
        };
        
        const input = document.createElement("input"); 
        input.type = "text"; 
        input.id = `groupNameInput_${i}`;
        input.value = groupNames[i] || `${i}班`; 
        input.oninput = function() { 
            groupNames[i] = this.value.trim() || `${i}班`; 
            renderClassroom("none"); 
        }; 
        
        row.appendChild(colorInput); 
        row.appendChild(input); 
        container.appendChild(row); 
    }
}

function onGroupCountChange() {
    const sel = $id("groupCountSelect");
    seatGroupCount = sel ? (parseInt(sel.value, 10) || 8) : 8;
    localStorage.setItem("seat_group_count", seatGroupCount);
    initGroupNamesUI();
    if (groupColorModeActive) renderGroupColorPalette();
    renderClassroom("none");
}

function onGroupTypeChange() { 
    const select = $id("groupTypeSelect");
    if (select && select.value !== "manual" && groupColorModeActive) {
        const modeToggle = $id("groupColorModeToggle");
        if (modeToggle) modeToggle.checked = false;
        toggleGroupColorMode();
        return;
    }
    renderClassroom(); 
}

function toggleGroupColorMode() {
    const toggle = $id("groupColorModeToggle");
    groupColorModeActive = toggle ? toggle.checked : false;
    const panel = $id("groupColorModePanel");

    if (groupColorModeActive) {
        const typeSelect = $id("groupTypeSelect");
        if (typeSelect) typeSelect.value = "manual";
        const wrapper = $id("groupNamesCustomWrapper");
        if (wrapper) wrapper.style.display = "block";
        const colorToggle = $id("groupColorToggle");
        if (colorToggle) colorToggle.checked = true;
        if (panel) panel.style.display = "block";
        document.body.classList.add("group-color-mode-active");
        renderGroupColorPalette();
        showToast("班の色を設定するモードをONにしました。座席をクリックしてください", "success");
    } else {
        if (panel) panel.style.display = "none";
        document.body.classList.remove("group-color-mode-active");
        showToast("班の色を設定するモードをOFFにしました。", "success");
    }
    renderClassroom("none");
}

function renderGroupColorPalette() {
    const container = $id("groupColorPaletteContainer");
    if (!container) return;
    container.innerHTML = "";

    const eraser = document.createElement("button");
    eraser.type = "button";
    eraser.className = "group-color-swatch is-eraser" + (selectedGroupColorTarget === 0 ? " is-selected" : "");
    eraser.textContent = "🧹 無色に戻す";
    eraser.onclick = () => selectGroupColorTarget(0);
    container.appendChild(eraser);

    for (let i = 1; i <= seatGroupCount; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `group-color-swatch group-${i}` + (selectedGroupColorTarget === i ? " is-selected" : "");
        btn.textContent = groupNames[i] || `${i}班`;
        btn.onclick = () => selectGroupColorTarget(i);
        container.appendChild(btn);
    }
}

function selectGroupColorTarget(n) {
    selectedGroupColorTarget = n;
    renderGroupColorPalette();
}

function applyGroupColorToSeat(label) {
    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) : 6;
    const idx = getIndexFromLabel(label, cols);
    const seatData = currentStudents[idx];

    if (!seatData || seatData.type !== "STUDENT" || !seatData.text) {
        showToast("その席には人がいません。", "error");
        return;
    }

    if (selectedGroupColorTarget > 0) {
        manualGroupMap[label] = selectedGroupColorTarget;
        showToast(`${groupNames[selectedGroupColorTarget] || selectedGroupColorTarget + "班"} の色にしました。`, "success");
    } else {
        delete manualGroupMap[label];
        showToast("班の色を消しました。", "success");
    }
    renderClassroom("none");
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "groups",
    name: "班の色と名前",
    version: "1.0",
    required: true,
    description: "班の数、種類、色、名前を決めます。"
});
