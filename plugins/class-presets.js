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
    try { preset.lastUsed = Date.now(); savePresetsObject(presets); } catch (e) { /* 使った日が残せなくても、そのまま続ける */ }
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
    btn.textContent = archived ? "去年度から戻す" : "去年度にする";
    btn.disabled = !name;
    const ex = $id("btnExportYearCsv");
    if (ex) ex.disabled = !name;
    ["btnRenameClass", "btnDuplicateClass"].forEach(id => { const b = $id(id); if (b) b.disabled = !name; });
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

// ==========================================
// クラス一覧（カード型）：人数・列×行・最後に使った日を見せ、よく使うクラスを上に固定できます
// ==========================================

const PRESET_SORT_MODES = { recent: "最近使った順", name: "名前順", saved: "登録した順" };

function getPresetSortMode() {
    const m = lsGet("preset_sort_mode", "recent");
    return PRESET_SORT_MODES[m] ? m : "recent";
}

function setPresetSortMode(m) {
    if (!PRESET_SORT_MODES[m]) return;
    lsSet("preset_sort_mode", m);
    updatePresetRadioButtons();
}

function sortPresetNames(names, presets) {
    const mode = getPresetSortMode();
    const idx = new Map(names.map((n, i) => [n, i]));
    return names.slice().sort((a, b) => {
        const pa = presets[a] && presets[a].pinned ? 1 : 0, pb = presets[b] && presets[b].pinned ? 1 : 0;
        if (pa !== pb) return pb - pa;
        if (mode === "name") return a.localeCompare(b, "ja", { numeric: true });
        if (mode === "recent") {
            const ta = (presets[a] && presets[a].lastUsed) || 0, tb = (presets[b] && presets[b].lastUsed) || 0;
            if (ta !== tb) return tb - ta;
        }
        return idx.get(a) - idx.get(b);
    });
}

function presetStudentCount(p) {
    try { return splitRosterRaw((p && p.students) || "").filter(x => x.trim() !== "").length; } catch (e) { return 0; }
}

function formatPresetLastUsed(ts) {
    if (!ts) return "まだ使っていません";
    const d = new Date(ts), now = new Date();
    const day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day(now) - day(d)) / 86400000);
    if (diff <= 0) return "今日";
    if (diff === 1) return "昨日";
    return (d.getFullYear() !== now.getFullYear() ? d.getFullYear() + "年" : "") + (d.getMonth() + 1) + "月" + d.getDate() + "日";
}

function togglePresetPin(name) {
    if (isAppLocked()) { showLockedToast(); return; }
    const presets = readPresetsSafe();
    if (!presets[name]) return;
    const now = !presets[name].pinned;
    if (now) presets[name].pinned = true; else delete presets[name].pinned;
    savePresetsObject(presets);
    updatePresetRadioButtons();
    showToast(now ? `クラス「${name}」を、一覧の上に固定しました。` : `クラス「${name}」の固定を、はずしました。`, "success");
}

function updatePresetRadioButtons() {
    const container = $id("presetRadioContainer");
    if (!container) return;
    const keepScroll = container.scrollTop;
    container.innerHTML = "";
    const presets = readPresetsSafe();
    const sortSel = $id("presetSortSelect");
    if (sortSel && sortSel.value !== getPresetSortMode()) sortSel.value = getPresetSortMode();
    const tools = $id("presetListTools");
    if (tools) tools.hidden = Object.keys(presets).length < 2;

    if (Object.keys(presets).length === 0) {
        container.innerHTML = `<span style="font-size: 12px; color: var(--text-sub); font-weight: 600; text-align: center; padding: 10px 0; display: block;">保存されたクラスはありません。</span>`;
        updateArchiveButton();
        return;
    }

    const makeItem = name => {
        const p = presets[name] || {};
        const label = document.createElement("label");
        label.className = "preset-radio-item preset-card" + (p.archived ? " is-archived" : "") + (p.pinned ? " is-pinned" : "");
        const radio = document.createElement("input");
        radio.type = "radio";
        radio.name = "presetClassRadio";
        radio.value = name;
        radio.checked = (name === activeClassId);
        radio.onchange = function() {
            const target = this.value;
            requestClassSwitch(target, () => {
                const last = label.querySelector(".pc-last");
                if (last) last.textContent = "最後に使った日：今日";
                updatePresetActiveMark();
                updateArchiveButton();
            }, () => { updatePresetRadioButtons(); });
        };
        label.appendChild(radio);

        const main = document.createElement("span");
        main.className = "pc-main";
        const top = document.createElement("span");
        top.className = "pc-top";
        const nm = document.createElement("span");
        nm.className = "pc-name";
        nm.textContent = name;
        const now = document.createElement("span");
        now.className = "pc-now";
        now.textContent = "使用中";
        top.appendChild(nm);
        top.appendChild(now);
        const meta = document.createElement("span");
        meta.className = "pc-meta";
        const cnt = presetStudentCount(p);
        meta.textContent = (cnt ? cnt + "人" : "名簿なし") + "　" + (p.cols || "6") + "列×" + (p.rows || "6") + "行";
        const last = document.createElement("span");
        last.className = "pc-last";
        last.textContent = "最後に使った日：" + formatPresetLastUsed(p.lastUsed);
        main.appendChild(top);
        main.appendChild(meta);
        main.appendChild(last);
        label.appendChild(main);

        const pin = document.createElement("button");
        pin.type = "button";
        pin.className = "pc-pin";
        pin.setAttribute("aria-pressed", p.pinned ? "true" : "false");
        pin.setAttribute("aria-label", p.pinned ? `「${name}」の固定をはずす` : `「${name}」を一覧の上に固定する`);
        pin.title = p.pinned ? "固定をはずす" : "一覧の上に固定する";
        pin.innerHTML = '<span class="pico" data-pico="star" aria-hidden="true">⭐</span>';
        pin.addEventListener("click", e => { e.preventDefault(); e.stopPropagation(); togglePresetPin(name); });
        label.appendChild(pin);
        return label;
    };
    const names = Object.keys(presets);
    sortPresetNames(names.filter(n => !(presets[n] && presets[n].archived)), presets).forEach(n => container.appendChild(makeItem(n)));
    const archivedNames = sortPresetNames(names.filter(n => presets[n] && presets[n].archived), presets);
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
    container.scrollTop = keepScroll;
    updatePresetActiveMark();
    updateArchiveButton();
}

// 「使用中」の目印は、選ばれているカードだけに出す
function updatePresetActiveMark() {
    const container = $id("presetRadioContainer");
    if (!container) return;
    container.querySelectorAll(".preset-card").forEach(c => {
        const r = c.querySelector("input[type=radio]");
        c.classList.toggle("is-current", !!(r && r.checked));
    });
}

// ==========================================
// 小さな確認・入力ダイアログ（クラスの名前変更・複製・保存確認で使う）
// ==========================================

function presetDialog(opts, done) {
    const old = $id("presetDialogOverlay");
    if (old) old.remove();
    const ov = document.createElement("div");
    ov.id = "presetDialogOverlay";
    ov.className = "modal-overlay";
    ov.setAttribute("role", "dialog");
    ov.setAttribute("aria-modal", "true");
    const box = document.createElement("div");
    box.className = "modal-content preset-dialog";
    const h = document.createElement("h4");
    h.textContent = opts.title || "";
    box.appendChild(h);
    if (opts.message) {
        const m = document.createElement("p");
        m.className = "preset-dialog-msg";
        m.textContent = opts.message;
        box.appendChild(m);
    }
    let input = null, check = null;
    if (opts.bodyEl) box.appendChild(opts.bodyEl);
    if (opts.input) {
        input = document.createElement("input");
        input.type = "text";
        input.className = "preset-dialog-input";
        input.value = opts.input.value || "";
        input.placeholder = opts.input.placeholder || "";
        input.setAttribute("aria-label", opts.input.label || opts.title || "名前");
        box.appendChild(input);
    }
    if (opts.check) {
        const lab = document.createElement("label");
        lab.className = "preset-dialog-check";
        check = document.createElement("input");
        check.type = "checkbox";
        check.checked = !!opts.check.checked;
        lab.appendChild(check);
        lab.appendChild(document.createTextNode(" " + opts.check.label));
        box.appendChild(lab);
    }
    const row = document.createElement("div");
    row.className = "modal-btn-row preset-dialog-btns";
    let closed = false;
    const finish = value => {
        if (closed) return;
        closed = true;
        document.removeEventListener("keydown", onKey, true);
        ov.remove();
        if (done) done(value, { text: input ? input.value.trim() : "", checked: check ? check.checked : false });
    };
    const primary = (opts.buttons || []).find(b => b.primary) || null;
    (opts.buttons || []).forEach(b => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = b.cls || "btn-secondary";
        btn.textContent = b.label;
        btn.dataset.value = b.value;
        btn.onclick = () => finish(b.value);
        row.appendChild(btn);
    });
    box.appendChild(row);
    ov.appendChild(box);
    function onKey(e) {
        if (e.key === "Escape") { e.stopPropagation(); finish("cancel"); }
        else if (e.key === "Enter" && input && document.activeElement === input && primary) { e.preventDefault(); finish(primary.value); }
    }
    document.addEventListener("keydown", onKey, true);
    ov.addEventListener("mousedown", e => { if (e.target === ov) finish("cancel"); });
    document.body.appendChild(ov);
    const focusEl = input || row.querySelector(".is-primary") || row.querySelector("button");
    if (focusEl) { focusEl.focus(); if (input) input.select(); }
}

// ==========================================
// 保存していない変更の確認：クラスを切り替える前に、いまの画面が保存した内容と違わないかを見る
// ==========================================

function presetSignature(p, strictStudents) {
    const gn = (p && p.groupNames) || {}, gc = (p && p.groupColors) || {};
    const names = [], colors = [];
    for (let i = 1; i <= 8; i++) {
        names.push(gn[i] || (i + "班"));
        colors.push(String(gc[i] || GROUP_COLOR_DEFAULTS[i]).toLowerCase());
    }
    const mm = (p && p.manualGroupMap) || {};
    const mmSorted = Object.keys(mm).sort().map(k => [k, mm[k]]);
    return JSON.stringify([
        (p && p.gasUrl) || "", String((p && p.cols) || "6"), String((p && p.rows) || "6"), (p && p.emptySeats) || "",
        strictStudents ? ((p && p.students) || "").trim() : "",
        (p && p.groupType) || "column", !!(p && p.groupColorToggle),
        (p && p.groupCount >= 2 && p.groupCount <= 8) ? p.groupCount : 8,
        names, colors, mmSorted
    ]);
}

// 保存してあるクラスと、いまの画面の内容が違うか（名簿が空のクラスは、名簿を比べない）
function isPresetDirty(name) {
    const presets = readPresetsSafe();
    const saved = presets[name];
    if (!saved) return false;
    try {
        const strict = ((saved.students || "").trim() !== "");
        const cur = buildPresetFromUI(saved);
        return presetSignature(saved, strict) !== presetSignature(cur, strict);
    } catch (e) { return false; }
}

function saveCurrentIntoPreset(name) {
    const presets = readPresetsSafe();
    if (!presets[name]) return;
    presets[name] = buildPresetFromUI(presets[name]);
    savePresetsObject(presets);
}

// クラスを切り替える（保存していない変更があれば、先に確かめる）
function requestClassSwitch(name, onDone, onCancel) {
    if (!name || name === activeClassId) { if (onDone) onDone(); return; }
    const cur = activeClassId;
    const doSwitch = () => { loadPreset(name); if (onDone) onDone(); };
    if (cur && cur !== TRIAL_CLASS_ID && !isAppLocked() && isPresetDirty(cur)) {
        presetDialog({
            title: "保存していない変更があります",
            message: `クラス「${cur}」の座席数・名簿・班の設定が、保存した内容と変わっています。切り替える前に、保存しますか？`,
            buttons: [
                { label: "キャンセル", value: "cancel", cls: "btn-secondary" },
                { label: "保存せず切り替える", value: "discard", cls: "btn-secondary" },
                { label: "保存して切り替える", value: "save", cls: "btn-connect is-primary", primary: true }
            ]
        }, v => {
            if (v === "save") { saveCurrentIntoPreset(cur); showToast(`クラス「${cur}」を保存しました。`, "success"); doSwitch(); }
            else if (v === "discard") doSwitch();
            else if (onCancel) onCancel();
        });
        return;
    }
    doSwitch();
}

// ==========================================
// 名前の変更と複製
// ==========================================

function validatePresetNewName(text, presets, self) {
    if (!text) return "名前を入れてください。";
    if (text === self) return "今と同じ名前です。";
    if (text === TRIAL_CLASS_ID || text === "__proto__") return "この名前は使えません。";
    if (Object.prototype.hasOwnProperty.call(presets, text)) return `「${text}」というクラスは、もうあります。`;
    return "";
}

function renameSelectedClass() {
    if (isAppLocked()) { showLockedToast(); return; }
    const old = getSelectedPresetName();
    if (!old) { showToast("名前を変えるクラスを選んでください。", "error"); return; }
    const ask = (value, err) => presetDialog({
        title: "クラスの名前を変える",
        message: err || `クラス「${old}」の新しい名前を入れてください。記録も、一緒に引き継がれます。`,
        input: { value, placeholder: "例: 2年A組", label: "新しいクラス名" },
        buttons: [
            { label: "キャンセル", value: "cancel", cls: "btn-secondary" },
            { label: "名前を変える", value: "ok", cls: "btn-connect is-primary", primary: true }
        ]
    }, (v, r) => {
        if (v !== "ok") return;
        const presets = readPresetsSafe();
        const e = validatePresetNewName(r.text, presets, old);
        if (e) { ask(r.text, e); return; }
        applyRenameClass(old, r.text);
    });
    ask(old, "");
}

// クラス名をキーにして保存している情報（教室の配置・付箋・希望・運の貯金）を、名前変更・複製・削除に合わせて動かします
const CLASS_KEYED_STORES = ["room_layout", "seat_notes", "seat_wishes_v1", "luck_bank"];
function classKeyedMove(mode, from, to) {
    CLASS_KEYED_STORES.forEach(key => {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return;
            const all = JSON.parse(raw);
            if (!all || typeof all !== "object" || Array.isArray(all) || all[from] === undefined) return;
            if (mode === "rename") { all[to] = all[from]; delete all[from]; }
            else if (mode === "copy") { all[to] = JSON.parse(JSON.stringify(all[from])); }
            else if (mode === "remove") { delete all[from]; }
            localStorage.setItem(key, JSON.stringify(all));
        } catch (e) { /* 動かせなくても、そのまま続ける */ }
    });
}

function applyRenameClass(old, next) {
    const presets = readPresetsSafe();
    if (!presets[old] || presets[next]) return;
    if (activeClassId === old) flushActiveClassRecords();
    // 並び順を保つため、同じ位置で名前だけ入れ替える
    const rebuilt = {};
    Object.keys(presets).forEach(k => { rebuilt[k === old ? next : k] = presets[k]; });
    savePresetsObject(rebuilt);
    const store = readClassRecordStore();
    if (store[old] !== undefined) { store[next] = store[old]; delete store[old]; writeClassRecordStore(store); }
    try {
        const c = localStorage.getItem(`gas_student_cache_${old}`);
        if (c !== null) { localStorage.setItem(`gas_student_cache_${next}`, c); localStorage.removeItem(`gas_student_cache_${old}`); }
    } catch (e) { /* 控えが移せなくても、そのまま続ける */ }
    if (activeClassId === old) {
        activeClassId = next;
        lsSet("active_class_id", next);
        const nInput = $id("presetNameInput");
        if (nInput) nInput.value = next;
        updateClassStatusBar();
        updateStatsClassNote();
    }
    if (lsGet("trial_return_class", "") === old) lsSet("trial_return_class", next);
    classKeyedMove("rename", old, next);
    if (typeof nqRenameClass === "function") nqRenameClass(old, next);
    if (typeof chistRenameClass === "function") chistRenameClass(old, next);
    updatePresetRadioButtons();
    showToast(`クラス「${old}」を、「${next}」に名前変更しました。`, "success");
}

function duplicateSelectedClass() {
    if (isAppLocked()) { showLockedToast(); return; }
    const old = getSelectedPresetName();
    if (!old) { showToast("複製するクラスを選んでください。", "error"); return; }
    const presets0 = readPresetsSafe();
    let base = `${old}のコピー`, n = 2, def = base;
    while (Object.prototype.hasOwnProperty.call(presets0, def)) def = base + (n++);
    const ask = (value, checked, err) => presetDialog({
        title: "クラスを複製する",
        message: err || `クラス「${old}」の名簿と設定を、新しいクラスとしてコピーします。`,
        input: { value, placeholder: "新しいクラス名", label: "新しいクラス名" },
        check: { label: "これまでの記録（指名・席の履歴）も、コピーする", checked },
        buttons: [
            { label: "キャンセル", value: "cancel", cls: "btn-secondary" },
            { label: "複製する", value: "ok", cls: "btn-connect is-primary", primary: true }
        ]
    }, (v, r) => {
        if (v !== "ok") return;
        const presets = readPresetsSafe();
        const e = validatePresetNewName(r.text, presets, "");
        if (e) { ask(r.text, r.checked, e); return; }
        applyDuplicateClass(old, r.text, r.checked);
    });
    ask(def, false, "");
}

function applyDuplicateClass(old, next, withRecords) {
    const presets = readPresetsSafe();
    if (!presets[old] || presets[next]) return;
    // 複製元が、いま開いているクラスなら、画面の内容（保存前の変更も）を元にする
    const src = (activeClassId === old) ? buildPresetFromUI(presets[old]) : presets[old];
    const copy = JSON.parse(JSON.stringify(src));
    delete copy.archived; delete copy.pinned; delete copy.lastUsed;
    presets[next] = copy;
    savePresetsObject(presets);
    if (withRecords) {
        const rec = JSON.parse(JSON.stringify(getRecordsForClass(old) || {}));
        const store = readClassRecordStore();
        store[next] = rec;
        writeClassRecordStore(store);
    }
    try {
        const c = localStorage.getItem(`gas_student_cache_${old}`);
        if (c !== null) localStorage.setItem(`gas_student_cache_${next}`, c);
    } catch (e) { /* 控えが写せなくても、そのまま続ける */ }
    classKeyedMove("copy", old, next);
    if (typeof nqCopyClass === "function") nqCopyClass(old, next);
    updatePresetRadioButtons();
    showToast(`クラス「${old}」を複製して、「${next}」を作りました。${withRecords ? "記録もコピーしています。" : "記録は、新しく始まります。"}`, "success");
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
    if (msg) msg.textContent = `本当にクラス「${name}」のデータを完全に消去してもよろしいですか？このクラスの記録も、一緒に消えます。`; 
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
    classKeyedMove("remove", name, null);
    if (typeof nqRemoveClass === "function") nqRemoveClass(name);
    if (typeof chistRemoveClass === "function") chistRemoveClass(name);
    updatePresetRadioButtons(); 
    onLayoutChange(); 
    closeDeleteModal(); 
    showToast(`プリセット「${name}」を完全に消去しました。`, "success"); 
}

// いまの画面の内容から、クラス1件ぶんのデータを作る（保存と、保存していない変更の確認で使う）
function buildPresetFromUI(prev) {
    const v = id => { const el = $id(id); return el ? el : null; };
    const gInput = v("gasUrlInput"), cSel = v("columnSelect"), rSel = v("rowSelect"), eInput = v("emptySeatsInput"), sInput = v("studentInput"), tSel = v("groupTypeSelect"), cTog = v("groupColorToggle");
    const keep = {};
    if (prev && prev.archived) keep.archived = true;
    if (prev && prev.pinned) keep.pinned = true;
    if (prev && prev.lastUsed) keep.lastUsed = prev.lastUsed;
    if (prev && prev.csettings) keep.csettings = prev.csettings;
    const colors = {};
    for (let i = 1; i <= 8; i++) colors[i] = getCurrentGroupColor(i);
    return {
        ...keep,
        gasUrl: gInput ? gInput.value.trim() : "",
        cols: cSel ? cSel.value : "6",
        rows: rSel ? rSel.value : "6",
        emptySeats: eInput ? eInput.value.trim() : "",
        students: sInput ? sInput.value.trim() : "",
        groupType: tSel ? tSel.value : "column",
        groupColorToggle: cTog ? cTog.checked : false,
        groupNames: { ...groupNames },
        groupColors: colors,
        groupCount: seatGroupCount,
        manualGroupMap: { ...manualGroupMap }
    };
}

function savePreset() {
    const input = $id("presetNameInput");
    const name = input ? input.value.trim() : "";
    if (!name) {
        showToast("プリセット名を入力してください。", "error");
        return;
    }
    const presets = readPresetsSafe();
    presets[name] = buildPresetFromUI(presets[name]);
    savePresetsObject(presets);
    adoptRecordsForSavedClass(name);
    updatePresetRadioButtons();
    showToast(`プリセット「${name}」を保存しました。`, "success");
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "class-presets",
    name: "名簿の保存とクラス一覧",
    version: "1.1",
    required: true,
    description: "名簿をクラスとして保存・削除・複製・名前変更し、よく使うクラスを上に固定して、去年度のクラスをまとめます。"
});
