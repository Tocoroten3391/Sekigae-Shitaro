// ==========================================
// 席替え履歴プラグイン：過去の座席表を、学期や月ごとに見返せます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="history" で結びついていて、自動で隠れます）
// ==========================================
const SEAT_TIMELINE_KEEP = 150;
let seatTimeline = []; // 新しい順: [{ id, at, cols, n: ["5.山田", "", ...], f: "sse_a" }]
let timelineFilter = "all"; // "all" | "t:2026-2"（学期） | "m:2026-10"（月）
function loadSeatTimeline() {
    try {
        const list = JSON.parse(lsGet("seat_timeline", "[]"));
        seatTimeline = Array.isArray(list) ? list.filter(e => e && e.id && e.at && e.cols && Array.isArray(e.n) && typeof e.f === "string").slice(0, SEAT_TIMELINE_KEEP) : [];
    } catch (error) { seatTimeline = []; }
}
function saveSeatTimeline() {
    // 容量がいっぱいで保存できない時は、古い履歴から減らして保存し直す
    for (let tries = 0; tries < 6; tries++) {
        try { localStorage.setItem("seat_timeline", JSON.stringify(seatTimeline)); return; }
        catch (error) { seatTimeline = seatTimeline.slice(0, Math.max(1, Math.floor(seatTimeline.length * 0.7))); }
    }
}

// 席替えが終わるたびに、座席表まるごとを残しておく
function recordSeatTimeline() {
    const cols = getGridCols();
    const names = [], flags = [];
    (currentStudents || []).forEach(seat => {
        if (seat && seat.type === "STUDENT" && seat.text) { names.push(getCleanNameForMatch(seat.text)); flags.push(seat.isAbsent ? "a" : "s"); }
        else if (seat && seat.type === "MANUAL_EMPTY") { names.push(""); flags.push("e"); }
        else { names.push(""); flags.push("_"); }
    });
    if (!names.some(n => n)) return;
    seatTimeline.unshift({ id: "tl_" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36), at: Date.now(), cols: cols, n: names, f: flags.join("") });
    seatTimeline = seatTimeline.slice(0, SEAT_TIMELINE_KEEP);
    saveSeatTimeline();
}
function setTimelineFilter(value) {
    timelineFilter = value || "all";
    renderTimeline();
}
function renderTimeline() {
    const list = $id("timelineList");
    const sel = $id("timelineFilterSelect");
    if (!list || !sel) return;

    // 期間の選択肢（学期・月）を、履歴から作る
    const terms = new Map(), months = new Map();
    seatTimeline.forEach(e => {
        const t = getTermInfoFor(e.at);
        terms.set(t.key, { name: t.name, n: (terms.get(t.key) || { n: 0 }).n + 1 });
        const d = new Date(e.at);
        const mk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        months.set(mk, { name: `${d.getFullYear()}年${d.getMonth() + 1}月`, n: (months.get(mk) || { n: 0 }).n + 1 });
    });
    const opt = (v, label) => `<option value="${v}">${label}</option>`;
    sel.innerHTML = opt("all", `すべて　${seatTimeline.length}回`)
        + '<optgroup label="学期ごと">' + Array.from(terms.entries()).map(([k, v]) => opt("t:" + k, `${v.name}　${v.n}回`)).join("") + "</optgroup>"
        + '<optgroup label="月ごと">' + Array.from(months.entries()).map(([k, v]) => opt("m:" + k, `${v.name}　${v.n}回`)).join("") + "</optgroup>";
    if (!Array.from(sel.options).some(o => o.value === timelineFilter)) timelineFilter = "all";
    sel.value = timelineFilter;

    const shown = seatTimeline.filter(e => {
        if (timelineFilter === "all") return true;
        if (timelineFilter.startsWith("t:")) return getTermInfoFor(e.at).key === timelineFilter.slice(2);
        const d = new Date(e.at);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === timelineFilter.slice(2);
    });
    const summary = $id("timelineSummary");
    if (summary) summary.textContent = seatTimeline.length === 0 ? "" : `${shown.length}回分の席替えを、新しい順に表示しています。`;
    const clr = $id("timelineClearBtn");
    if (clr) clr.style.display = seatTimeline.length === 0 ? "none" : "";

    if (shown.length === 0) {
        list.innerHTML = '<p class="stats-empty">' + (seatTimeline.length === 0 ? "まだ履歴はありません。席替えをすると、自動で残ります。" : "この期間の席替えはありません。") + "</p>";
        return;
    }
    const wd = ["日", "月", "火", "水", "木", "金", "土"];
    list.innerHTML = shown.map(e => {
        const d = new Date(e.at);
        const head = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}（${wd[d.getDay()]}） ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        const count = e.f.split("").filter(c => c === "s" || c === "a").length;
        const cells = e.n.map((name, i) => {
            const flag = e.f.charAt(i);
            if (flag === "s" || flag === "a") {
                const parts = getSeatDisplayParts(name);
                return `<div class="timeline-cell${flag === "a" ? " is-absent" : ""}" title="${escapeStatsHtml(name)}">${escapeStatsHtml(parts.name || parts.no)}</div>`;
            }
            return '<div class="timeline-cell is-blank"></div>';
        }).join("");
        return `<div class="timeline-item"><div class="timeline-head"><strong>${head}</strong><span>${getTermInfoFor(e.at).name}・${e.cols}列×${Math.ceil(e.n.length / e.cols)}行・${count}人</span></div><div class="timeline-grid" style="grid-template-columns: repeat(${e.cols}, minmax(0, 1fr));">${cells}</div><div class="timeline-actions"><button type="button" class="btn-secondary btn-compact" onclick="restoreTimelineLayout('${e.id}')">↩️ この席に戻す</button><button type="button" class="btn-delete-mini btn-compact" onclick="deleteTimelineEntry('${e.id}')">🗑️ 削除</button></div></div>`;
    }).join("");
}
function restoreTimelineLayout(id) {
    if (isAppLocked()) { showLockedToast(); return; }
    const e = seatTimeline.find(x => x.id === id);
    if (!e) return;
    if (!confirm("今の座席表を、この日の座席表に置き換えます。置き換えたあとも、「戻す」で今の座席表に戻れます。よろしいですか？")) return;
    saveSeatHistory();
    const colSel = $id("columnSelect"), rowSel = $id("rowSelect");
    const rows = Math.ceil(e.n.length / e.cols);
    if (colSel && Array.from(colSel.options).some(o => o.value === String(e.cols))) colSel.value = String(e.cols);
    if (rowSel && Array.from(rowSel.options).some(o => o.value === String(rows))) rowSel.value = String(rows);
    if (typeof updateColumns === "function") updateColumns();
    currentStudents = e.n.map((name, i) => {
        const flag = e.f.charAt(i);
        if (flag === "s" || flag === "a") return { type: "STUDENT", text: name, isFixed: false, fixedType: "none", isAbsent: flag === "a", memo: "" };
        if (flag === "e") return { type: "MANUAL_EMPTY", text: "" };
        return { type: "EMPTY_SPACE", text: "" };
    });
    renderClassroom("none");
    closeStatsModal();
    showToast("過去の席順に戻しました。", "success");
}
function deleteTimelineEntry(id) {
    seatTimeline = seatTimeline.filter(x => x.id !== id);
    saveSeatTimeline();
    renderTimeline();
}
function clearSeatTimeline() {
    if (!confirm("席替えの履歴を、すべて消します。元に戻せません。よろしいですか？")) return;
    seatTimeline = [];
    saveSeatTimeline();
    renderTimeline();
    showToast("席替えの履歴を消しました。", "success");
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "history",
    name: "席替え履歴",
    version: "1.0",
    description: "過去の座席表を、学期や月ごとに見返せます。",
    stubs: ["loadSeatTimeline", "recordSeatTimeline", "renderTimeline"]
});
