// ==========================================
// 確定前のプレビュープラグイン：席替えを確定する前に、3案を作って見比べられます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="preview" で結びついていて、自動で隠れます）
// ==========================================
let previewCandidates = [];
let previewIndex = 0;
let previewBaseSeats = null;
const PREVIEW_COUNT = 3;

// 座席表の表示用に、名前から印（固定・わがまま・メモ・お休み）を除き、番号と名前に分ける
function buildShuffleCandidate(rawList) {
    return searchBestShuffle(rawList);
}
function generatePreviewCandidates() {
    const base = previewBaseSeats;
    previewCandidates = [];
    for (let i = 0; i < PREVIEW_COUNT; i++) previewCandidates.push(buildShuffleCandidate(lastRawList));
    currentStudents = base; // 作っている間に変わった座席表を、元に戻す（画面はまだ変えない）
    previewIndex = 0;
}
function openShufflePreview() {
    if (isAppLocked()) { showLockedToast(); return; }
    if (yaochoMode) { shuffleSeats(); return; }
    const inputEl = $id("studentInput");
    if (!inputEl) { showToast("名簿を入力してください。", "error"); return; }
    lastRawList = splitRosterRaw(inputEl.value).map(n => n.trim()).filter(n => n !== "");
    if (lastRawList.length === 0) { showToast("名簿が空っぽです。", "error"); return; }
    previewBaseSeats = currentStudents;
    generatePreviewCandidates();
    const overlay = $id("shufflePreviewModalOverlay");
    if (overlay) overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    renderShufflePreview();
}
function regenerateShufflePreview() {
    generatePreviewCandidates();
    renderShufflePreview();
}
function selectShufflePreview(i) {
    previewIndex = i;
    renderShufflePreview();
}
function closeShufflePreview() {
    const overlay = $id("shufflePreviewModalOverlay");
    if (overlay) overlay.style.display = "none";
    document.body.style.overflow = "";
    previewCandidates = [];
    previewBaseSeats = null;
}
function renderShufflePreview() {
    const cand = previewCandidates[previewIndex];
    if (!cand) return;
    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) || 6 : 6;

    const tabs = $id("previewTabs");
    if (tabs) {
        tabs.innerHTML = previewCandidates.map((c, i) =>
            `<button type="button" class="stats-tab${i === previewIndex ? " is-active" : ""}" onclick="selectShufflePreview(${i})">📋 案${i + 1}</button>`).join("");
    }

    // 今の席から動く人の数
    const prevPos = {};
    (previewBaseSeats || []).forEach((seat, idx) => {
        if (seat && seat.type === "STUDENT" && seat.text) { const k = getCleanNameForMatch(seat.text); if (k && !(k in prevPos)) prevPos[k] = idx; }
    });
    let moved = 0, stay = 0;
    cand.seats.forEach((seat, idx) => {
        if (!seat || seat.type !== "STUDENT" || !seat.text || seat.isAbsent) return;
        const k = getCleanNameForMatch(seat.text);
        if (k in prevPos && prevPos[k] === idx) stay++; else moved++;
    });
    const info = $id("previewInfo");
    if (info) {
        info.textContent = `今の席から動く人：${moved}人／同じ席のまま：${stay}人` +
            (separationPairs.length > 0 ? (cand.violations === 0 ? "　離す設定は全て守れています" : `　離す設定のうち${cand.violations}組は離せていません`) : "") +
            (nearPairs.length > 0 ? (cand.nearUnmet === 0 ? "　近くに置く設定は全て守れています" : `　近くに置く設定のうち${cand.nearUnmet}組は近くにできていません`) : "") +
            (cand.avoiding ? `　前回までと同じ席：${cand.same}件／同じ隣：${cand.pairs}件` : "");
    }

    const grid = $id("previewGrid");
    if (!grid) return;
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    const pvColorOn = $id("groupColorToggle") ? $id("groupColorToggle").checked : false;
    const pvMarkOn = pvColorOn && lsGet("group_mark_on", "0") === "1" && getGroupMarkScope() !== "seat";
    grid.classList.toggle("pv-mark", pvMarkOn);
    grid.innerHTML = cand.seats.map((seat, idx) => {
        if (!seat || seat.type !== "STUDENT") {
            return `<div class="preview-cell is-empty">${seat && seat.type === "MANUAL_EMPTY" ? "✕" : ""}</div>`;
        }
        const p = getSeatDisplayParts(seat.text);
        const k = getCleanNameForMatch(seat.text);
        const same = k in prevPos && prevPos[k] === idx;
        const pvG = pvColorOn ? getShownGroupNoForIndex(idx, cols, cand.seats) : 0;
        const cls = ["preview-cell", seat.isAbsent ? "is-absent" : "", seat.isFixed ? "is-fixed" : "", same && !seat.isAbsent ? "is-same" : "", pvG ? `group-${pvG}` : ""].filter(Boolean).join(" ");
        return `<div class="${cls}"${pvG ? ` data-group-no="${pvG}"` : ""} title="${escapeStatsHtml(p.name)}　${getSeatLabel(idx, cols)}">${p.no ? `<span class="pv-no">${escapeStatsHtml(p.no)}</span>` : ""}${getFuriganaFor(seat.text) ? `<span class="pv-furi">${escapeStatsHtml(getFuriganaFor(seat.text))}</span>` : ""}<span class="pv-name">${escapeStatsHtml(p.name || p.no)}</span></div>`;
    }).join("");
}
function applyShufflePreview(announce) {
    const cand = previewCandidates[previewIndex];
    if (!cand || cand.seats.length === 0) return;
    const seats = JSON.parse(JSON.stringify(cand.seats));
    const violations = cand.violations;
    closeShufflePreview();
    currentStudents = previewBaseSeats || currentStudents;
    saveSeatHistory(); // 「戻す」で、決める前の席順に戻せる
    resetNominatedHistory(false);
    currentStudents = seats;
    recordShuffleInfo(cand);
    renderClassroom(document.body.classList.contains("no-animation") ? "none" : "wave");
    showToast("選んだ案で席替えが完了しました。", "success");
    if (violations > 0) showToast(`離す設定のうち${violations}組は席の都合で離せませんでした。`, "error");
    recordSeatHistory();
    maybeAutoUploadAfterShuffle();
    if (announce === true) openAnnounce();
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "preview",
    suggests: ["furigana", "announce"],   // あわせて使うと便利なプラグイン
    name: "確定前のプレビュー",
    version: "1.1",
    description: "席替えを確定する前に、3案を作って見比べられます。",
    stubs: []
});
