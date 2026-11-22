// ==========================================
// 名簿の保存とクラス一覧プラグイン（必須）：名簿をクラスとして保存・削除し、去年度のクラスをまとめます。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
function loadPreset(name) {
    if (!name) return; 
    let presets = {}; 
    try { 
        presets = JSON.parse(localStorage.getItem("seat_shuffler_presets") || "{}"); 
    } catch(e) {} 
    
    const preset = presets[name]; 
    if (!preset) return;
    
    switchRecordClass(name);
    const nInput = $id("presetNameInput"); 
    if (nInput) nInput.value = name; 
    
    const uInput = $id("gasUrlInput"); 
    if (uInput) uInput.value = preset.gasUrl || ""; 
    
    const cSel = $id("columnSelect"); 
    if (cSel) cSel.value = preset.cols || "6"; 
    
    const rSel = $id("rowSelect");
    let pRows = preset.rows || "6"; 
    if (rSel) {
        if (!Array.from(rSel.options).some(opt => opt.value == pRows)) { 
            const newOpt = document.createElement("option"); 
            newOpt.value = pRows; 
            newOpt.textContent = pRows + "行"; 
            rSel.appendChild(newOpt); 
        } 
        rSel.value = pRows;
    }
    
    const eInput = $id("emptySeatsInput"); 
    if (eInput) eInput.value = preset.emptySeats || ""; 
    
    const sInput = $id("studentInput"); 
    if (sInput) sInput.value = preset.students || ""; 
    
    const tSel = $id("groupTypeSelect"); 
    if (tSel) tSel.value = preset.groupType || "column"; 
    
    const cTog = $id("groupColorToggle"); 
    if (cTog) cTog.checked = (preset.groupColorToggle !== undefined) ? preset.groupColorToggle : false; 
    
    groupNames = preset.groupNames ? { ...preset.groupNames } : { 1: "1班", 2: "2班", 3: "3班", 4: "4班", 5: "5班", 6: "6班", 7: "7班", 8: "8班" }; 
    for (let i = 1; i <= 8; i++) { applyGroupColor(i, (preset.groupColors && preset.groupColors[i]) || GROUP_COLOR_DEFAULTS[i]); }
    seatGroupCount = (preset.groupCount >= 2 && preset.groupCount <= 8) ? preset.groupCount : 8;
    const countSel = $id("groupCountSelect");
    if (countSel) countSel.value = String(seatGroupCount);
    manualGroupMap = preset.manualGroupMap ? { ...preset.manualGroupMap } : {}; 
    
    initGroupNamesUI(); 
    onGroupTypeChange(); 
    syncOfflineButtons(); 
    updateColumns();
    
    // クラスを選んでも、GAS（クラウド）には自動で接続しない。保存してある名簿をそのまま使う。
    // クラウドの名簿と同期したい時は「GASに接続・更新」を、接続だけ確かめたい時は「GASに接続」を押す。
    let rosterText = preset.students || "";
    if (!rosterText) {
        // 名簿が保存されていないクラスは、前回クラウドから取得した名簿の控えがあればそれを使う
        try {
            const cached = JSON.parse(localStorage.getItem(`gas_student_cache_${name}`) || "null");
            if (Array.isArray(cached) && cached.length > 0) rosterText = cleanAndFormatNameList(cached).join(",");
        } catch (e) {}
        if (rosterText && sInput) sInput.value = rosterText;
    }
    if (rosterText) { 
        lastRawList = splitRosterRaw(rosterText).map(s => s.trim()).filter(s => s !== ""); 
        parseAndSetSeats(lastRawList, false, document.body.classList.contains("no-animation") ? "none" : "initial"); 
    }
}

// ==========================================
// 去年度のクラス：前の学年のクラスを、一覧の下にまとめる
// ==========================================

function savePresetsObject(presets) { localStorage.setItem("seat_shuffler_presets", JSON.stringify(presets)); }

function toggleArchiveSelectedClass() {
    if (isAppLocked()) { showLockedToast(); return; }
    const name = getSelectedPresetName();
    if (!name) { showToast("クラスを選んでください。", "error"); return; }
    const presets = readPresetsSafe();
    if (!presets[name]) return;
    const now = !presets[name].archived;
    if (now) presets[name].archived = true; else delete presets[name].archived;
    savePresetsObject(presets);
    updatePresetRadioButtons();
    showToast(now ? `クラス「${name}」を、去年度のクラスにしました。記録は、そのまま残っています。` : `クラス「${name}」を、去年度から戻しました。`, "success");
}

function updateArchiveButton() {
    const btn = $id("btnArchiveClass");
    if (!btn) return;
    const name = getSelectedPresetName();
    const presets = readPresetsSafe();
    const archived = !!(name && presets[name] && presets[name].archived);
    btn.textContent = archived ? "↩️ 選んだクラスを、去年度から戻す" : "選んだクラスを、去年度にする";
    btn.disabled = !name;
    const ex = $id("btnExportYearCsv");
    if (ex) ex.disabled = !name;
}
// クラスの記録（そのクラスのもの）を取り出す

function getRecordsForClass(name) {
    if (name === activeClassId && activeClassId !== TRIAL_CLASS_ID) return snapshotMainRecords();
    const store = readClassRecordStore();
    return store[name] || {};
}

function exportSelectedClassYearCsv() {
    const name = getSelectedPresetName();
    if (!name) { showToast("クラスを選んでください。", "error"); return; }
    const rec = getRecordsForClass(name);
    const parse = key => { try { const v = JSON.parse(rec[key] || "{}"); return (v && typeof v === "object") ? v : {}; } catch (error) { return {}; } };
    const nom = parse("nomination_history_log"), seat = parse("seat_history_log");
    let layouts = 0;
    try { const l = JSON.parse(rec.seat_layout_log || "[]"); layouts = Array.isArray(l) ? l.length : 0; } catch (error) { layouts = 0; }
    const presets = readPresetsSafe();
    let rosterNames = [];
    if (presets[name] && presets[name].students) rosterNames = splitRosterRaw(presets[name].students).map(x => getCleanStudentKey(x.trim())).filter(x => x);
    const names = [...new Set(rosterNames.concat(Object.keys(nom), Object.keys(seat)))];
    if (names.length === 0 || (!hasMeaningfulRecords(rec) && rosterNames.length === 0)) { showToast("このクラスには、書き出せる記録がありません。", "error"); return; }
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [["クラス", "名前", "指名回数", "最終指名", "よく座る席", "席替えの回数"].map(q).join(",")];
    names.forEach(n => {
        const nm = nom[n] || { count: 0, lastAt: 0 };
        lines.push([name, n, nm.count || 0, nm.lastAt ? formatStatsDate(nm.lastAt) : "", getMostFrequentSeat(n, seat), layouts].map(q).join(","));
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    a.download = `席替えし太郎_1年間の記録_${name}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    showToast(`クラス「${name}」の1年間の記録を書き出しました。`, "success");
}

function updatePresetRadioButtons() {
    const container = $id("presetRadioContainer"); 
    if (!container) return;
    container.innerHTML = ""; 
    
    let presets = {}; 
    try { 
        presets = JSON.parse(localStorage.getItem("seat_shuffler_presets") || "{}"); 
    } catch(e) { 
        presets = {}; 
    }
    
    if (Object.keys(presets).length === 0) { 
        container.innerHTML = `<span style="font-size: 12px; color: var(--text-sub); font-weight: 600; text-align: center; padding: 10px 0; display: block;">保存されたクラスはありません。</span>`; 
        return; 
    }
    
    const makeItem = name => {
        const label = document.createElement("label"); 
        label.className = "preset-radio-item" + (presets[name] && presets[name].archived ? " is-archived" : ""); 
        const radio = document.createElement("input"); 
        radio.type = "radio"; 
        radio.name = "presetClassRadio"; 
        radio.value = name; 
        radio.checked = (name === activeClassId);
        radio.onchange = function() { loadPreset(this.value); updateArchiveButton(); }; 
        label.appendChild(radio); 
        label.appendChild(document.createTextNode(" " + name)); 
        return label;
    };
    const names = Object.keys(presets);
    names.filter(n => !(presets[n] && presets[n].archived)).forEach(n => container.appendChild(makeItem(n)));
    const archivedNames = names.filter(n => presets[n] && presets[n].archived);
    if (archivedNames.length) {
        const det = document.createElement("details");
        det.className = "preset-archive";
        det.open = archivedNames.includes(activeClassId) || lsGet("preset_archive_open", "0") === "1";
        det.addEventListener("toggle", () => lsSet("preset_archive_open", det.open ? "1" : "0"));
        const sum = document.createElement("summary");
        sum.textContent = `去年度のクラス　${archivedNames.length}件`;
        det.appendChild(sum);
        archivedNames.forEach(n => det.appendChild(makeItem(n)));
        container.appendChild(det);
    }
    updateArchiveButton();
}

function getSelectedPresetName() { 
    const radios = document.getElementsByName("presetClassRadio"); 
    for (let i = 0; i < radios.length; i++) { 
        if (radios[i].checked) return radios[i].value; 
    } 
    return null; 
}

function deletePreset() { 
    const name = getSelectedPresetName(); 
    if (!name) { 
        showToast("削除するクラスを選択してください。", "error"); 
        return; 
    } 
    const msg = $id("deleteModalMessage");
    if (msg) msg.textContent = `本当にクラス「${name}」のデータを完全に消去してもよろしいですか？このクラスの記録も、いっしょに消えます。`; 
    const overlay = $id("deleteModalOverlay");
    if (overlay) overlay.style.display = "flex"; 
}

function closeDeleteModal() { 
    const overlay = $id("deleteModalOverlay");
    if (overlay) overlay.style.display = "none"; 
}

function confirmDeletePresetAction() { 
    const name = getSelectedPresetName(); 
    if (!name) return; 
    
    let presets = {}; 
    try { 
        presets = JSON.parse(localStorage.getItem("seat_shuffler_presets") || "{}"); 
    } catch(e) {} 
    
    delete presets[name]; 
    localStorage.setItem("seat_shuffler_presets", JSON.stringify(presets)); 
    removeClassRecords(name);
    updatePresetRadioButtons(); 
    onLayoutChange(); 
    closeDeleteModal(); 
    showToast(`プリセット「${name}」を完全に消去しました。`, "success"); 
}

function savePreset() {
    const input = $id("presetNameInput");
    const name = input ? input.value.trim() : ""; 
    if (!name) { 
        showToast("プリセット名を入力してください。", "error"); 
        return; 
    }
    
    let presets = {}; 
    try { 
        presets = JSON.parse(localStorage.getItem("seat_shuffler_presets") || "{}"); 
    } catch(e) {}
    
    const gInput = $id("gasUrlInput");
    const cSel = $id("columnSelect");
    const rSel = $id("rowSelect");
    const eInput = $id("emptySeatsInput");
    const sInput = $id("studentInput");
    const tSel = $id("groupTypeSelect");
    const cTog = $id("groupColorToggle");
    
    const wasArchived = !!(presets[name] && presets[name].archived);
    presets[name] = { 
        ...(wasArchived ? { archived: true } : {}),
        gasUrl: gInput ? gInput.value.trim() : "", 
        cols: cSel ? cSel.value : "6", 
        rows: rSel ? rSel.value : "6", 
        emptySeats: eInput ? eInput.value.trim() : "", 
        students: sInput ? sInput.value.trim() : "", 
        groupType: tSel ? tSel.value : "column", 
        groupColorToggle: cTog ? cTog.checked : false, 
        groupNames: { ...groupNames }, 
        groupColors: { 1: getCurrentGroupColor(1), 2: getCurrentGroupColor(2), 3: getCurrentGroupColor(3), 4: getCurrentGroupColor(4), 5: getCurrentGroupColor(5), 6: getCurrentGroupColor(6), 7: getCurrentGroupColor(7), 8: getCurrentGroupColor(8) }, 
        groupCount: seatGroupCount, 
        manualGroupMap: { ...manualGroupMap } 
    };
    
    localStorage.setItem("seat_shuffler_presets", JSON.stringify(presets)); 
    adoptRecordsForSavedClass(name);
    updatePresetRadioButtons(); 
    showToast(`プリセット「${name}」を保存しました。`, "success");
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "class-presets",
    name: "名簿の保存とクラス一覧",
    version: "1.0",
    required: true,
    description: "名簿をクラスとして保存・削除し、去年度のクラスをまとめます。"
});
