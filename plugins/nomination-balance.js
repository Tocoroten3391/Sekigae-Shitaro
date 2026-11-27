// ==========================================
// 発言・指名の偏り防止プラグイン：指名された回数と、発言した回数を数えて、まだ当たっていない人を、先に指名できるようにします。
// 座席を押して発言を数える「発言モード」、座席表に回数を小さく出す表示、記録・統計の「偏り」タブがあります。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります。指名は、これまでどおりに動きます
// ==========================================
const NB_SPEECH_KEY = "speech_log_v1";     // { クラス名: { 生徒の目印: 発言の回数 } }
const NB_SET_KEY = "nom_balance_v1";       // { mode: "off"／"fair"／"strict", speech: 発言も数えるか, badge: 座席表に回数を出すか }
let nbSpeechMode = false;                   // 発言モード（座席を押すと発言を数える）
let nbUndo = [];                            // 発言を数えた記録（取り消し用）
let nbSort = "few";

function nbEsc(t) { return String(t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])); }
function nbClass() { try { return (typeof getSelectedPresetName === "function" && getSelectedPresetName()) || ""; } catch (e) { return ""; } }
function nbSettings() {
    let v = null;
    try { v = JSON.parse(lsGet(NB_SET_KEY, "null")); } catch (e) { v = null; }
    v = v && typeof v === "object" ? v : {};
    return { mode: ["off", "fair", "strict"].includes(v.mode) ? v.mode : "off", speech: v.speech !== false, badge: v.badge === true };
}
function nbSaveSettings(s) { lsSet(NB_SET_KEY, JSON.stringify(s)); }
function nbSpeechAll() {
    try { const v = JSON.parse(lsGet(NB_SPEECH_KEY, "{}")); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
}
function nbSpeechMap() { const m = nbSpeechAll()[nbClass()]; return m && typeof m === "object" ? m : {}; }
function nbSpeechSet(map) {
    const all = nbSpeechAll();
    const cls = nbClass();
    if (Object.keys(map).length) all[cls] = map; else delete all[cls];
    lsSet(NB_SPEECH_KEY, JSON.stringify(all));
}
function nbNomCount(key) { const o = (typeof nominationHistoryLog !== "undefined" && nominationHistoryLog[key]) || null; return o ? (o.count || 0) : 0; }
function nbTotal(key, speechMap) {
    const s = nbSettings();
    return nbNomCount(key) + (s.speech ? ((speechMap || nbSpeechMap())[key] || 0) : 0);
}

// 指名する人を選ぶところを、包みます。「回数が少ない人を優先」のとき、少ない人が、当たりやすくなります
const nbOrigPick = typeof pickSeatWeightedByHistory === "function" ? pickSeatWeightedByHistory : null;
function nbPick(seats) {
    const s = nbSettings();
    if (!nbOrigPick || s.mode === "off" || !SekigaeApp.isEnabled("nomination-balance") || seats.length <= 1) return nbOrigPick ? nbOrigPick(seats) : seats[0];
    const map = nbSpeechMap();
    const info = seats.map(x => ({ seat: x, n: nbTotal(getCleanStudentKey(x.data.text), map) }));
    if (s.mode === "strict") {
        const min = Math.min.apply(null, info.map(i => i.n));
        const pool = info.filter(i => i.n === min);
        return pool[Math.floor(Math.random() * pool.length)].seat;
    }
    const weights = info.map(i => 1 / Math.pow(1 + i.n, 1.6));   // 回数が多い程、当たりにくくします
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < info.length; i++) { r -= weights[i]; if (r <= 0) return info[i].seat; }
    return info[info.length - 1].seat;
}

// ---- 名前 ----
function nbStudents() {
    const out = [], seen = new Set();
    (currentStudents || []).forEach(seat => {
        if (!seat || seat.type !== "STUDENT" || !seat.text) return;
        const key = getCleanStudentKey(seat.text);
        if (!key || seen.has(key)) return;
        seen.add(key);
        const p = typeof getSeatDisplayParts === "function" ? getSeatDisplayParts(seat.text) : { no: "", name: key };
        out.push({ key: key, no: p.no || "", name: p.name || key, absent: !!seat.isAbsent });
    });
    return out;
}

// ---- 発言を数える ----
function nbAddSpeech(key, delta, noUndo) {
    const map = nbSpeechMap();
    const next = Math.max(0, (map[key] || 0) + delta);
    if (next === (map[key] || 0)) return false;
    if (next === 0) delete map[key]; else map[key] = next;
    nbSpeechSet(map);
    if (!noUndo) { nbUndo.push({ key: key, delta: delta }); if (nbUndo.length > 30) nbUndo.shift(); }
    nbDecorate();
    if (nbModalOpen()) nbRenderModal();
    nbUpdateBar();
    return true;
}
function nbUndoLast() {
    const last = nbUndo.pop();
    if (!last) return;
    nbAddSpeech(last.key, -last.delta, true);
    showToast("発言の記録を、1つ取り消しました。", "success");
}
function nbSetSpeechMode(on) {
    nbSpeechMode = !!on;
    document.body.classList.toggle("nb-speech-mode", nbSpeechMode);
    nbUpdateBar();
    if (nbSpeechMode) { closeNomBalance(); showToast("🗣️ 発言モードです。座席を押すと発言を1回数えます。", "success"); }
}
// 発言モードの間は、座席を押しても、ふだんの画面は開かず、発言を数えます
function nbSeatClick(e) {
    if (!nbSpeechMode || document.body.classList.contains("nomination-active")) return;
    const seat = e.target.closest && e.target.closest("#classroom .seat");
    if (!seat) return;
    e.stopPropagation();
    e.preventDefault();
    const key = seat.dataset.seatKey;
    if (!key) return;
    nbAddSpeech(key, 1);
    const n = nbSpeechMap()[key] || 0;
    showToast("🗣️ " + key + " さん　発言 " + n + " 回", "success");
}
function nbUpdateBar() {
    let bar = $id("nbBar");
    if (!nbSpeechMode) { if (bar) bar.hidden = true; return; }
    if (!bar) {
        bar = document.createElement("div");
        bar.id = "nbBar";
        bar.className = "nb-bar";
        bar.innerHTML = '<span>🗣️ 発言モード：座席を押すと発言を数えます</span><button type="button" class="nb-bar-btn" id="nbBarUndo" onclick="nbUndoLast()">↩️ 取り消す</button><button type="button" class="nb-bar-btn" onclick="nbSetSpeechMode(false)">終わる</button>';
        document.body.appendChild(bar);
    }
    bar.hidden = false;
    const u = $id("nbBarUndo");
    if (u) u.disabled = nbUndo.length === 0;
}

// ---- 座席表に、回数を小さく出す ----
function nbDecorate() {
    const s = nbSettings();
    const seats = document.querySelectorAll("#classroom .seat");
    if (!seats.length) return;
    const map = s.badge ? nbSpeechMap() : null;
    let max = 0;
    const rows = [];
    seats.forEach(el => {
        const old = el.querySelector(".nb-badge");
        if (old) old.remove();
        if (!s.badge) return;
        const key = el.dataset.seatKey;
        if (!key) return;
        const nom = nbNomCount(key), sp = map[key] || 0;
        rows.push({ el: el, nom: nom, sp: sp });
        max = Math.max(max, nom + sp);
    });
    rows.forEach(r => {
        const tag = document.createElement("span");
        tag.className = "nb-badge" + (r.nom + r.sp === 0 ? " nb-zero" : "");
        tag.textContent = "指" + r.nom + (s.speech ? " 発" + r.sp : "");
        tag.title = "指名 " + r.nom + " 回" + (s.speech ? "、発言 " + r.sp + " 回" : "");
        r.el.appendChild(tag);
    });
}

// ---- 画面 ----
function nbModalOpen() { const o = $id("nbModalOverlay"); return !!o && o.style.display !== "none"; }
function openNomBalance() {
    if (typeof closePopMenus === "function") closePopMenus();
    const s = nbSettings();
    $id("nbModeSelect").value = s.mode;
    $id("nbSpeechToggle").checked = s.speech;
    $id("nbBadgeToggle").checked = s.badge;
    $id("nbSortSelect").value = nbSort;
    nbRenderModal();
    $id("nbModalOverlay").style.display = "flex";
}
function closeNomBalance() { const o = $id("nbModalOverlay"); if (o) o.style.display = "none"; }
function nbSettingChanged() {
    nbSaveSettings({ mode: $id("nbModeSelect").value, speech: $id("nbSpeechToggle").checked, badge: $id("nbBadgeToggle").checked });
    nbDecorate();
    nbRenderModal();
}
function nbSetSort(v) { nbSort = v; nbRenderModal(); }
function nbRows() {
    const map = nbSpeechMap();
    const rows = nbStudents().map(st => ({ st: st, nom: nbNomCount(st.key), sp: map[st.key] || 0 }));
    rows.forEach(r => { r.total = nbTotal(r.st.key, map); });
    if (nbSort === "few") rows.sort((a, b) => a.total - b.total || (parseInt(a.st.no, 10) || 999) - (parseInt(b.st.no, 10) || 999));
    else if (nbSort === "many") rows.sort((a, b) => b.total - a.total);
    return rows;   // 「seat」の時は座席表の順のままです
}
function nbRenderModal() {
    const body = $id("nbList");
    if (!body) return;
    const rows = nbRows();
    const s = nbSettings();
    const max = Math.max(1, ...rows.map(r => r.total));
    const zero = rows.filter(r => r.total === 0 && !r.st.absent);
    $id("nbInfo").textContent = (nbClass() ? "クラス：" + nbClass() + "　" : "") + rows.length + "人　" +
        (zero.length ? "まだ0回：" + zero.length + "人" : (rows.length ? "全員が、1回以上です" : ""));
    body.innerHTML = rows.length ? rows.map(r => {
        const pct = Math.round(r.total / max * 100);
        return '<div class="nb-row' + (r.total === 0 ? " is-zero" : "") + '">' +
            '<span class="nb-name">' + (r.st.no ? nbEsc(r.st.no) + "番 " : "") + nbEsc(r.st.name) + (r.st.absent ? '<small class="nb-abs">休み</small>' : "") + "</span>" +
            '<span class="nb-bar-track"><span class="nb-bar-fill" style="width:' + pct + '%"></span></span>' +
            '<span class="nb-num">指名 ' + r.nom + "</span>" +
            (s.speech ? '<span class="nb-sp"><button type="button" class="nb-pm" data-k="' + nbEsc(r.st.key) + '" onclick="nbAddSpeech(this.dataset.k, -1)" aria-label="発言を1つ減らす">−</button><span class="nb-num">発言 ' + r.sp + '</span><button type="button" class="nb-pm" data-k="' + nbEsc(r.st.key) + '" onclick="nbAddSpeech(this.dataset.k, 1)" aria-label="発言を1つ増やす">＋</button></span>' : "") +
            "</div>";
    }).join("") : '<p class="config-note" data-keep="1">名簿を読み込むとここに出ます。</p>';
    $id("nbResetSpeech").style.display = Object.keys(nbSpeechMap()).length ? "" : "none";
}
function nbResetSpeech() {
    if (!confirm("このクラスの、発言の回数を全て0に戻します。指名の回数は変わりません。よろしいですか？")) return;
    nbSpeechSet({});
    nbUndo = [];
    nbDecorate();
    nbRenderModal();
    showToast("発言の回数を、0に戻しました。", "success");
}

const NB_CSS = `
.nb-badge { position: absolute; right: 3px; top: 3px; z-index: 5; padding: 0 5px; border-radius: 8px; background: rgba(15, 23, 42, 0.72); color: #fff; font-size: 10px; line-height: 16px; font-weight: 700; pointer-events: none; white-space: nowrap; }
.nb-badge.nb-zero { background: #f59e0b; color: #1c1917; }
body.nomination-active .nb-badge, body.blackboard-active .nb-badge { display: none; }
@media print { .nb-badge, .nb-bar { display: none !important; } }
body.nb-speech-mode #classroom .seat { cursor: pointer; outline: 2px dashed rgba(14, 165, 233, 0.55); outline-offset: -3px; }
.nb-bar { position: fixed; left: 50%; bottom: 14px; transform: translateX(-50%); z-index: 950; display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px; background: var(--uis-bar-bg, #0369a1); color: var(--uis-bar-fg, #fff); font-size: 13px; font-weight: 700; box-shadow: 0 6px 20px rgba(15, 23, 42, 0.3); max-width: calc(100vw - 20px); }
.nb-bar[hidden] { display: none; }
.nb-bar-btn { width: auto !important; margin: 0 !important; padding: 5px 12px !important; border-radius: 999px !important; border: 1px solid rgba(255, 255, 255, 0.6); background: transparent; color: var(--uis-bar-fg, #fff); font-size: 12px; cursor: pointer; }
.nb-bar-btn:disabled { opacity: 0.4; cursor: default; }
.nb-list { display: flex; flex-direction: column; gap: 4px; max-height: 42vh; overflow-y: auto; margin: 6px 0; }
.nb-row { display: flex; align-items: center; gap: 8px; padding: 5px 8px; border-radius: 8px; background: var(--input-bg, #f2f2f7); color: var(--input-text, #1c1c1e); font-size: 13px; }
.nb-row.is-zero { box-shadow: inset 3px 0 0 #f59e0b; }
.nb-name { flex: 0 0 8.5em; min-width: 0; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nb-abs { margin-left: 4px; color: var(--text-sub, #64748b); font-weight: 400; }
.nb-bar-track { flex: 1; min-width: 30px; height: 8px; border-radius: 4px; background: rgba(100, 116, 139, 0.25); overflow: hidden; }
.nb-bar-fill { display: block; height: 100%; background: var(--uis-b-on-bg, #0ea5e9); }
.nb-num { font-variant-numeric: tabular-nums; white-space: nowrap; }
.nb-sp { display: inline-flex; align-items: center; gap: 4px; }
.nb-pm { width: 28px !important; height: 28px; margin: 0 !important; padding: 0 !important; border-radius: 8px !important; border: 1px solid var(--seat-border, #e2e8f0); background: var(--card-bg, #fff); color: var(--text-main, #1e293b); font-weight: 700; cursor: pointer; }
`;
const NB_HTML = `
<div id="nbModalOverlay" class="modal-overlay" style="display: none;">
    <div class="modal-content" style="max-width: 640px; width: 95%; max-height: 92vh; overflow-y: auto;">
        <h4 style="color: #0369a1;">🗣️ 発言・指名のバランス <span data-nbtip="指名された回数と発言した回数を生徒ごとに数えます。「回数が少ない人を優先」にすると指名でまだ当たっていない人が、当たりやすくなります。「回数が一番少ない人から」にすると一番少ない人だけから選びます。発言は「発言モード」で、座席を押すと数えられます。このクラスの記録として残ります。"></span></h4>
        <div class="layout-grid-fields" style="margin: 6px 0 10px;">
            <div><label for="nbModeSelect">指名で選ぶ人</label>
                <select id="nbModeSelect" onchange="nbSettingChanged()"><option value="off">ふだんどおり</option><option value="fair">回数が少ない人を優先</option><option value="strict">回数が一番少ない人から</option></select></div>
            <div><label for="nbSortSelect">並べ方</label>
                <select id="nbSortSelect" onchange="nbSetSort(this.value)"><option value="few">回数が少ない順</option><option value="many">回数が多い順</option><option value="seat">座席表の順</option></select></div>
        </div>
        <div class="switch-container">
            <label class="switch"><input type="checkbox" id="nbSpeechToggle" onchange="nbSettingChanged()"><span class="slider"></span></label>
            <span class="switch-label">発言の回数も数に入れる</span>
        </div>
        <div class="switch-container" style="margin-top: 8px;">
            <label class="switch"><input type="checkbox" id="nbBadgeToggle" onchange="nbSettingChanged()"><span class="slider"></span></label>
            <span class="switch-label">座席表に回数を小さく出す</span>
        </div>
        <div class="modal-btn-row" style="justify-content: flex-start; margin: 10px 0 6px;">
            <button type="button" class="btn-save" onclick="nbSetSpeechMode(true)">🗣️ 発言モードにする</button>
        </div>
        <p id="nbInfo" class="config-note" style="margin: 0 0 4px;"></p>
        <div id="nbList" class="nb-list"></div>
        <div class="modal-btn-row">
            <button type="button" id="nbResetSpeech" onclick="nbResetSpeech()" class="btn-delete">🗑️ 発言を0に戻す</button>
            <button type="button" onclick="closeNomBalance()" class="btn-secondary">閉じる</button>
        </div>
    </div>
</div>`;

// 記録・統計の「偏り」タブ
function nbRenderStatsTab(data) {
    const body = $id("nbStatsBody");
    if (!body) return;
    const esc = nbEsc;
    const map = data.isArchive ? {} : nbSpeechMap();
    const s = nbSettings();
    const rows = data.names.map(name => {
        const nom = ((data.nom[name] || {}).count) || 0, sp = map[name] || 0;
        return { name: name, nom: nom, sp: sp, total: nom + (s.speech && !data.isArchive ? sp : 0) };
    }).sort((a, b) => a.total - b.total);
    if (!rows.length) { body.innerHTML = '<p class="stats-empty">名簿にまだ誰もいません。</p>'; return; }
    const max = Math.max(1, ...rows.map(r => r.total));
    const zero = rows.filter(r => r.total === 0);
    const avg = rows.reduce((a, r) => a + r.total, 0) / rows.length;
    let html = '<div class="stats-trend-grid"><div class="stats-trend-card"><strong>' + zero.length + '人</strong><span>まだ0回</span></div>' +
        '<div class="stats-trend-card"><strong>' + avg.toFixed(1) + '回</strong><span>1人当たり</span></div>' +
        '<div class="stats-trend-card"><strong>' + (rows[rows.length - 1].total - rows[0].total) + '回</strong><span>多い人と少ない人の差</span></div></div>';
    html += rows.map(r => '<div class="stats-trend-row"><span class="stats-trend-name">' + esc(r.name) + '</span><span class="nb-bar-track" style="margin: 0 8px;"><span class="nb-bar-fill" style="width:' + Math.round(r.total / max * 100) + '%"></span></span><span class="stats-trend-meta">指名 ' + r.nom + (data.isArchive ? "" : "・発言 " + r.sp) + '</span></div>').join("");
    body.innerHTML = html;
}

SekigaeApp.registerPlugin({
    id: "nomination-balance",
    name: "発言・指名の偏り防止",
    version: "1.1",
    description: "指名された回数と発言した回数を数えて、まだ当たっていない人を、先に指名できます。座席を押して発言を数える「発言モード」、座席表に回数を小さく出す表示、記録・統計の「偏り」タブがあります。",
    backupKeys: [NB_SPEECH_KEY, NB_SET_KEY],
    searchWords: "発言 指名 偏り 回数 当たっていない 公平 平等 まだ当たってない 発表 数える",
    statsTabs: [{
        id: "nomination-balance",
        label: "🗣️ 偏り",
        hideReset: true,
        hideCsv: true,
        paneHtml: '<p style="font-size: 12px; color: var(--text-sub); margin: 0 0 10px; line-height: 1.6;">指名と発言の回数が偏っていないかを確かめます。回数が少ない人が上に出ます。</p><div id="nbStatsBody" class="stats-summary-body"></div>',
        render: data => nbRenderStatsTab(data)
    }],
    mount(app) {
        const st = document.createElement("style");
        st.id = "nbStyle";
        st.textContent = NB_CSS;
        document.head.appendChild(st);
        document.body.insertAdjacentHTML("beforeend", NB_HTML);
        document.querySelectorAll("#nbModalOverlay [data-nbtip]").forEach(el => el.replaceWith(makeInfoTip(el.dataset.nbtip)));
        app.insertInto("settings-records", '<button type="button" onclick="openNomBalance()" class="btn-secondary" id="btnNomBalance" style="margin-top: 10px;">発言・指名のバランス</button>');
        app.insertInto("guide-tools", '<li><strong>発言・指名のバランス</strong>：設定の「記録・統計」の「発言・指名のバランス」で、指名と発言の回数が見られます。「回数が少ない人を優先」にするとまだ当たっていない人が、指名で当たりやすくなります。「発言モード」では座席を押すだけで発言を数えられます。</li>');
        // 指名する人を選ぶところを、包みます
        if (nbOrigPick) window.pickSeatWeightedByHistory = nbPick;
        // 指名の記録が増えたら、座席表の回数も、新しくします
        if (typeof recordNominationHistory === "function") {
            const orig = recordNominationHistory;
            window.recordNominationHistory = function (t) { const r = orig(t); nbDecorate(); return r; };
        }
        document.addEventListener("click", nbSeatClick, true);
    },
    afterRender() { nbDecorate(); }
});
document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    if (nbModalOpen()) closeNomBalance();
    else if (nbSpeechMode) nbSetSpeechMode(false);
});
