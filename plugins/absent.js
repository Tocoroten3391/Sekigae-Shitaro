// ==========================================
// 欠席者の選択プラグイン：今日の欠席者を、まとめて選べます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="absent" で結びついていて、自動で隠れます）
// ==========================================
let absentDraft = new Set(); // 欠席にする人（名簿 lastRawList の番号）
function getRosterLabel(raw) {
    const p = getSeatDisplayParts(raw);
    return { no: p.no, name: p.name || p.no || "" };
}
function openAbsentModal() {
    if (isAppLocked()) { showLockedToast(); return; }
    const inputEl = $id("studentInput");
    if (inputEl && inputEl.value.trim() !== "" && (!lastRawList || lastRawList.length === 0)) {
        lastRawList = splitRosterRaw(inputEl.value).map(n => n.trim()).filter(n => n !== "");
    }
    if (!lastRawList || lastRawList.length === 0) { showToast("名簿が空っぽです。先に名簿を用意してください。", "error"); return; }
    absentDraft = new Set();
    lastRawList.forEach((raw, i) => { if (raw.includes("[休]")) absentDraft.add(i); });
    renderAbsentModal();
    const overlay = $id("absentModalOverlay");
    if (overlay) overlay.style.display = "flex";
}
function closeAbsentModal() {
    const overlay = $id("absentModalOverlay");
    if (overlay) overlay.style.display = "none";
}
function toggleAbsentDraft(i) {
    if (absentDraft.has(i)) absentDraft.delete(i); else absentDraft.add(i);
    renderAbsentModal();
}
function clearAbsentDraft() { absentDraft = new Set(); renderAbsentModal(); }
function renderAbsentModal() {
    const grid = $id("absentGrid");
    if (!grid) return;
    grid.innerHTML = lastRawList.map((raw, i) => {
        const l = getRosterLabel(raw);
        const on = absentDraft.has(i);
        return `<button type="button" class="absent-chip${on ? " is-on" : ""}" onclick="toggleAbsentDraft(${i})" aria-pressed="${on}">${l.no ? `<span class="ac-no">${escapeStatsHtml(l.no)}</span>` : ""}<span class="ac-name">${escapeStatsHtml(l.name)}</span>${on ? '<span class="ac-tag">休</span>' : ""}</button>`;
    }).join("");
    const count = $id("absentCount");
    if (count) count.textContent = `欠席：${absentDraft.size}人 ／ 出席：${lastRawList.length - absentDraft.size}人`;
}
function applyAbsentModal() {
    if (isAppLocked()) { showLockedToast(); return; }
    let changed = 0;
    const next = lastRawList.map((raw, i) => {
        const has = raw.includes("[休]"), want = absentDraft.has(i);
        if (has === want) return raw;
        changed++;
        return want ? raw.replace(/\s+$/, "") + " [休]" : raw.replace(/\s*\[休\]/g, "").trim();
    });
    if (changed === 0) { closeAbsentModal(); showToast("欠席の変更はありません", "success"); return; }
    saveSeatHistory(); // 「戻す」で、変更前に戻せる
    lastRawList = next;
    const sInput = $id("studentInput");
    if (sInput) sInput.value = lastRawList.join(", ");
    closeAbsentModal();
    onLayoutChange();
    showToast(`今日の欠席者を${absentDraft.size}人にしました`, "success");
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "absent",
    name: "欠席者の選択",
    version: "1.0",
    description: "今日の欠席者をまとめて選べます。",
    stubs: []
});
