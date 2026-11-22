// ==========================================
// 前回との比較プラグイン：前回と比べて、動いた人や同じ席の人が分かります。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="compare" で結びついていて、自動で隠れます）
// ==========================================
function getCompareBase() {
    const prev = seatLayoutLog[1];
    if (!prev || !prev.pos || prev.cols !== getGridCols()) return null;
    return prev;
}
function updateCompareButton() {
    const btn = $id("btnCompare");
    if (!btn) return;
    const hasList = lastRawList && lastRawList.length > 0;
    const isBlackboard = document.body.classList.contains("blackboard-active");
    btn.style.display = (hasList && !isBlackboard && seatLayoutLog.length >= 2) ? "block" : "none";
    btn.textContent = compareOn ? "🙈 比較を閉じる" : "前回と比べる";
    syncSeatToolsRow();
}
function toggleCompare() {
    if (!compareOn && !getCompareBase()) {
        showToast("比べられる前回の席替えが、まだありません。列数を変えた直後は、比べられません。", "error");
        return;
    }
    compareOn = !compareOn;
    lsSet("compare_on", String(compareOn));
    updateCompareButton();
    applyCompareBadges();
}

// 描き直さずに、今ある座席に「同じ席」「前の席」「新」の印を付け外しする
function applyCompareBadges() {
    const summary = $id("compareSummary");
    document.querySelectorAll("#classroom .seat").forEach(el => {
        el.classList.remove("cmp-same", "cmp-moved", "cmp-new");
        const old = el.querySelector(".seat-cmp");
        if (old) old.remove();
    });
    const hideSummary = () => { if (summary) summary.style.display = "none"; };
    if (!compareOn || shuffleAnimating) { hideSummary(); return; }
    const base = getCompareBase();
    if (!base) { hideSummary(); return; }
    const cols = getGridCols();
    let same = 0, moved = 0, added = 0;
    document.querySelectorAll("#classroom .seat").forEach((el, idx) => {
        const seat = currentStudents[idx];
        if (!seat || seat.type !== "STUDENT" || !seat.text) return;
        const key = getCleanStudentKey(seat.text);
        if (!key) return;
        const prevIdx = base.pos[key];
        const badge = document.createElement("span");
        badge.className = "seat-cmp";
        if (prevIdx === undefined) { el.classList.add("cmp-new"); badge.textContent = "新"; added++; }
        else if (prevIdx === idx) { el.classList.add("cmp-same"); badge.textContent = "同じ席"; same++; }
        else { el.classList.add("cmp-moved"); badge.textContent = `前 ${getSeatLabel(prevIdx, cols)}`; moved++; }
        el.appendChild(badge);
    });
    if (summary) {
        const d = new Date(base.at);
        summary.innerHTML = `前回 ${d.getMonth() + 1}/${d.getDate()} との比較：<span class="cmp-dot" style="background:#0f172a"></span>動いた <b>${moved}</b>人<span class="cmp-dot" style="background:#f59e0b"></span>同じ席 <b>${same}</b>人` + (added > 0 ? `<span class="cmp-dot" style="background:#16a34a"></span>新しい席 <b>${added}</b>人` : "");
        summary.style.display = "block";
    }
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "compare",
    name: "前回との比較",
    version: "1.0",
    description: "前回と比べて、動いた人や同じ席の人が分かります。",
    stubs: ["applyCompareBadges", "updateCompareButton"]
});
