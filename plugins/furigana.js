// ==========================================
// ふりがなプラグイン：名前の上に、読みがなを小さく出します。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="furigana" で結びついていて、自動で隠れます）
// ==========================================
function loadFurigana() {
    try { const m = JSON.parse(lsGet("furigana_map", "{}")); furiganaMap = (m && typeof m === "object" && !Array.isArray(m)) ? m : {}; } catch (error) { furiganaMap = {}; }
    furiganaShow = lsGet("furigana_show", "false") === "true";
    applyFuriganaSize(lsGet("furigana_size", "m"));
    updateFuriganaMenuLabel();
    try { const a = JSON.parse(lsGet("furigana_auto", "{}")); furiganaAuto = (a && typeof a === "object" && !Array.isArray(a)) ? a : {}; } catch (error) { furiganaAuto = {}; }
}
function saveFurigana() {
    lsSet("furigana_map", JSON.stringify(furiganaMap));
    lsSet("furigana_show", String(furiganaShow));
    lsSet("furigana_auto", JSON.stringify(furiganaAuto));
}

// ---- ふりがなの大きさ（小さめ・ふつう・大きめ）と、「ほかの操作」からの切り替え
function applyFuriganaSize(v) {
    const size = (v === "s" || v === "l") ? v : "m";
    document.body.classList.toggle("furi-s", size === "s");
    document.body.classList.toggle("furi-l", size === "l");
    const sel = $id("furiganaSizeSelect");
    if (sel) sel.value = size;
    return size;
}
function setFuriganaSize(v) {
    const size = applyFuriganaSize(v);
    lsSet("furigana_size", size);
    if (typeof uisFit === "function") uisFit();
}
function updateFuriganaMenuLabel() {
    const b = $id("btnFuriToggle");
    if (b) b.textContent = furiganaShow ? "ふりがなを隠す" : "ふりがなを表示する";
}
function toggleFuriganaFromMenu() {
    if (isAppLocked()) { showLockedToast(); return; }
    if (!furiganaShow && Object.keys(furiganaMap).length === 0) {
        showToast("ふりがなが、まだ入っていません。設定の「ふりがなの設定」で入れてください。", "error");
        return;
    }
    furiganaShow = !furiganaShow;
    saveFurigana();
    updateFuriganaMenuLabel();
    renderClassroom("none");
    showToast(furiganaShow ? "ふりがなを表示します。" : "ふりがなを隠します。", "success");
}

// ---- GASの名簿（C列のフリガナ）から、ふりがなを自動で取り込む
// GASからは「1. 田中太郎（たなかたろう）」の形で届く。かっこの中が、ひらがな・カタカナだけのときに、ふりがなとみなす。
let furiganaAuto = {}; // 名簿から取り込んだふりがな（手で直したものと区別するため）
let lastFuriganaHarvestSig = "";
function extractFuriganaFromRosterText(raw) {
    const text = String(raw || "").replace(/<[^>]*>/g, "");
    const re = /[（(]([^）)]*)[）)]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
        const v = m[1].replace(/[\s\u3000]+/g, " ").trim();
        if (v && /^[\u3041-\u3096\u30A1-\u30FA\u30FC\u30FB\u30FD\u30FE ]+$/.test(v)) return v;
    }
    return "";
}

// 名簿の並びから、ふりがなを取り込む。手で入れたふりがなは上書きしない。取り込めた人数を返す。
function harvestFuriganaFromRoster(list, notify) {
    if (!Array.isArray(list) || list.length === 0) return 0;
    const sig = list.join("\n");
    if (sig === lastFuriganaHarvestSig && !notify) return 0;
    lastFuriganaHarvestSig = sig;
    let found = 0, changed = 0;
    list.forEach(raw => {
        const key = getCleanStudentKey(raw);
        if (!key) return;
        const reading = extractFuriganaFromRosterText(raw);
        if (!reading) return;
        found++;
        const cur = furiganaMap[key];
        if (cur === undefined || cur === "" || cur === furiganaAuto[key]) {
            if (cur !== reading) { furiganaMap[key] = reading; changed++; }
        }
        furiganaAuto[key] = reading;
    });
    if (found === 0) return 0;
    let turnedOn = false;
    if (lsGet("furigana_show", null) === null) { furiganaShow = true; turnedOn = true; } // はじめて取り込めたときは、表示もONにする
    saveFurigana();
    if (notify) {
        showToast(`名簿のフリガナ${found}人分を、ふりがなとして取り込みました。` + (turnedOn ? "座席表にも表示します。" : ""), "success");
    }
    return found;
}

// 席の文字（番号・印つき）から、表示するふりがなを返す。OFFの時や、未登録の時は空。
function getFuriganaFor(text) {
    if (!furiganaShow) return "";
    const key = getCleanStudentKey(text || "");
    return (key && furiganaMap[key]) ? String(furiganaMap[key]) : "";
}
function getRosterNameKeys() {
    return [...new Set((lastRawList || []).map(x => getCleanStudentKey(x)).filter(x => x))];
}
function openFuriganaModal() {
    if (isAppLocked()) { showLockedToast(); return; }
    const keys = getRosterNameKeys();
    if (keys.length === 0) { showToast("名簿が空っぽです。先に名簿を用意してください。", "error"); return; }
    const tog = $id("furiganaShowToggle");
    if (tog) tog.checked = furiganaShow;
    const bulk = $id("furiganaBulkInput");
    if (bulk) bulk.value = "";
    renderFuriganaRows();
    const overlay = $id("furiganaModalOverlay");
    if (overlay) overlay.style.display = "flex";
}
function closeFuriganaModal() {
    const overlay = $id("furiganaModalOverlay");
    if (overlay) overlay.style.display = "none";
}
function renderFuriganaRows() {
    const box = $id("furiganaRows");
    if (!box) return;
    const keys = getRosterNameKeys();
    box.innerHTML = keys.map((k, i) =>
        `<div class="furi-row"><span class="furi-name">${escapeStatsHtml(k)}</span><input type="text" class="furi-input" data-key="${escapeStatsHtml(k)}" value="${escapeStatsHtml(furiganaMap[k] || "")}" placeholder="ふりがな" maxlength="30" autocomplete="off" oninput="updateFuriganaCount()"></div>`).join("");
    updateFuriganaCount();
}
function updateFuriganaCount() {
    const inputs = Array.from(document.querySelectorAll("#furiganaRows .furi-input"));
    const done = inputs.filter(i => i.value.trim() !== "").length;
    const el = $id("furiganaCount");
    if (el) el.textContent = `ふりがなを入れた人：${done} / ${inputs.length}人`;
}

// 「名前,ふりがな」「名前 ふりがな」「名前<TAB>ふりがな」を1行ずつ貼り付けて、まとめて入れる
function applyFuriganaBulk() {
    const bulk = $id("furiganaBulkInput");
    const text = bulk ? bulk.value : "";
    if (!text.trim()) { showToast("貼り付ける内容が空です。", "error"); return; }
    const keys = getRosterNameKeys();
    const keySet = new Set(keys);
    const noSpace = new Map(keys.map(k => [k.replace(/\s+/g, ""), k]));
    let hit = 0, miss = 0;
    text.split(/\r?\n/).forEach(line => {
        const t = line.trim();
        if (!t) return;
        const parts = t.split(/[,、\t，]+/).map(x => x.trim()).filter(x => x);
        let name, reading;
        if (parts.length >= 2) { name = parts[0]; reading = parts[1]; }
        else { const m = t.match(/^(\S+)\s+(\S+)$/); if (!m) { miss++; return; } name = m[1]; reading = m[2]; }
        const nm = getCleanStudentKey(name) || name;
        const key = keySet.has(nm) ? nm : noSpace.get(nm.replace(/\s+/g, ""));
        if (!key) { miss++; return; }
        const input = document.querySelector(`#furiganaRows .furi-input[data-key="${CSS.escape(key)}"]`);
        if (input) input.value = reading;
        hit++;
    });
    updateFuriganaCount();
    showToast(`${hit}人分を入れました。` + (miss > 0 ? `名簿にない名前などが${miss}行ありました。` : "") + "「保存する」を押すと確定します。", miss > 0 && hit === 0 ? "error" : "success");
}

// 名簿（GAS）から取り込んだふりがなで、一覧を入れ直す（手で直した分も、名簿の内容に戻る）
function reapplyFuriganaFromRoster() {
    let n = 0;
    document.querySelectorAll("#furiganaRows .furi-input").forEach(inp => {
        const k = inp.getAttribute("data-key");
        if (furiganaAuto[k]) { inp.value = furiganaAuto[k]; n++; }
    });
    updateFuriganaCount();
    showToast(n > 0 ? `名簿のふりがな${n}人分を入れました。「保存する」を押すと確定します。` : "名簿にフリガナが入っている人がいませんでした。", n > 0 ? "success" : "error");
}
function saveFuriganaModal() {
    const next = {};
    Object.keys(furiganaMap).forEach(k => { next[k] = furiganaMap[k]; });
    document.querySelectorAll("#furiganaRows .furi-input").forEach(inp => {
        const k = inp.getAttribute("data-key");
        const v = inp.value.trim();
        if (v) next[k] = v; else delete next[k];
    });
    furiganaMap = next;
    const tog = $id("furiganaShowToggle");
    furiganaShow = !!(tog && tog.checked);
    saveFurigana();
    updateFuriganaMenuLabel();
    closeFuriganaModal();
    renderClassroom("none");
    showToast(furiganaShow ? "ふりがなを保存しました。座席表に表示します。" : "ふりがなを保存しました。表示はOFFです。", "success");
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "furigana",
    name: "ふりがな",
    version: "1.1",
    description: "名前の上に、読みがなを小さく出します。大きさを選べて、「ほかの操作」から表示を切り替えられます。",
    stubs: ["extractFuriganaFromRosterText", "getFuriganaFor", "harvestFuriganaFromRoster", "loadFurigana", "saveFurigana"]
});
