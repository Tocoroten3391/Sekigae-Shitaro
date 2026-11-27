// ==========================================
// 座席の旅プラグイン：ひとりの生徒が、これまでどの席を旅してきたかを、座席表の上に線でつないで見せます。席替え履歴プラグインの記録を使います
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// ==========================================
const SJ_WINDOW_KEY = "sj_window";   // "10"（直近10回）／ "all"（全て）
let sjTimer = null;
let sjSteps = [];

function sjAddStyle() {
    if ($id("sjStyle")) return;
    const st = document.createElement("style");
    st.id = "sjStyle";
    st.textContent = `
.sj-overlay { position: fixed; inset: 0; z-index: 2900; display: none; align-items: center; justify-content: center; background: rgba(15,23,42,0.55); padding: 12px; }
.sj-box { text-align: left; width: min(96vw, 760px); max-height: 94vh; overflow-y: auto; background: var(--uis-s-surf, #fff); color: var(--uis-s-text, #1f2937); border-radius: 16px; padding: 18px 18px 16px; box-shadow: 0 20px 50px rgba(0,0,0,0.4); }
.sj-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.sj-head h3 { margin: 0; font-size: 18px; }
.sj-x { border: none; background: var(--uis-s-soft, #e5e7eb); color: inherit; border-radius: 8px; padding: 5px 12px; font-weight: 700; cursor: pointer; }
.sj-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 14px; margin-bottom: 10px; }
.sj-box .sj-row select { width: auto !important; min-width: 0; flex: 0 0 auto; margin: 0 !important; padding: 6px 10px; border-radius: 8px; border: 1px solid var(--uis-s-line, #cbd5e1); font-size: 14px; }
.sj-play { background: var(--uis-b-on-bg, #2563eb); color: var(--uis-b-on-fg, #fff); border: none; border-radius: 10px; padding: 7px 16px; font-weight: 700; cursor: pointer; }
.sj-stats { text-align: left; font-size: 14px; line-height: 1.7; background: var(--uis-s-soft, #f1f5f9); border-radius: 10px; padding: 8px 12px; margin-top: 10px; }
.sj-svg { width: 100%; height: auto; display: block; background: var(--uis-s-surf, #f8fafc); border-radius: 10px; border: 1px solid var(--uis-s-line, #e2e8f0); }
.sj-empty { padding: 30px 10px; text-align: center; color: var(--uis-s-sub, #64748b); }
.sj-svg .sj-cell { fill: var(--uis-s-surf, #fff); stroke: var(--uis-s-line, #cbd5e1); stroke-width: 1; }
.sj-svg .sj-cell.is-visit { fill: #dbeafe; stroke: #60a5fa; }
.sj-svg .sj-cell.is-now { fill: #fef08a; stroke: #eab308; stroke-width: 2.5; }
.sj-svg .sj-lbl { font-size: 11px; fill: var(--uis-s-sub, #94a3b8); text-anchor: middle; }
.sj-svg .sj-line { fill: none; stroke: var(--uis-b-on-bg, #2563eb); stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; opacity: 0.75; }
.sj-svg .sj-dot { fill: var(--uis-b-on-bg, #2563eb); }
.sj-svg .sj-dot.is-last { fill: #dc2626; }
.sj-svg .sj-num { font-size: 11px; font-weight: 700; fill: var(--uis-b-on-fg, #fff); text-anchor: middle; dominant-baseline: central; }
.sj-svg .sj-rep { font-size: 11px; font-weight: 700; fill: #b45309; text-anchor: middle; }
.sj-svg .sj-hide { display: none; }
`;
    document.head.appendChild(st);
}

function sjPrettyName(key) { return String(key).replace(/^(\d+)\./, "$1 "); }
function sjEsc(t) { return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function sjNumOf(key) { const m = /^(\d+)\./.exec(key); return m ? parseInt(m[1], 10) : 1e6; }

function sjStudentKeys() {
    const set = new Set();
    (currentStudents || []).forEach(s => { if (s && s.type === "STUDENT" && s.text) { const k = getCleanNameForMatch(s.text); if (k) set.add(k); } });
    if (!set.size && typeof seatTimeline !== "undefined") seatTimeline.forEach(e => e.n.forEach(k => { if (k) set.add(k); }));
    return Array.from(set).sort((a, b) => sjNumOf(a) - sjNumOf(b) || a.localeCompare(b, "ja"));
}

// 旅の記録を、古い順に作る
function sjBuildSteps(key, windowSize) {
    if (typeof seatTimeline === "undefined" || !seatTimeline.length) return [];
    let list = seatTimeline.slice();
    if (windowSize !== "all") list = list.slice(0, parseInt(windowSize, 10) || 10);
    list.reverse();
    const steps = [];
    list.forEach(e => {
        const idx = e.n.indexOf(key);
        if (idx < 0) return;
        const rows = Math.max(1, Math.ceil(e.n.length / e.cols));
        steps.push({ at: e.at, cols: e.cols, rows: rows, x: idx % e.cols, y: Math.floor(idx / e.cols), label: getSeatLabel(idx, e.cols), absent: e.f.charAt(idx) === "a" });
    });
    return steps;
}

function openSeatJourney() {
    if (typeof closePopMenus === "function") closePopMenus();
    // 席替え履歴プラグインがないと、旅の記録が残りません。理由が分かるように、知らせます
    const hist = SekigaeApp.plugins.some(p => p.id === "history");
    if (!hist) { showToast("座席の旅には席替え履歴プラグイン（history.js）が必要です。plugins フォルダに入れて、index.html に読み込む行を足してください。", "error"); return; }
    if (!SekigaeApp.isEnabled("history")) { showToast("座席の旅には席替え履歴プラグインが必要です。設定の「プラグイン」で、席替え履歴をオンにしてください。", "error"); return; }
    if (typeof seatTimeline === "undefined" || !seatTimeline.length) { showToast("席替えの履歴がまだありません。席替えをすると旅の記録が残ります。", "info"); return; }
    const keys = sjStudentKeys();
    if (!keys.length) { showToast("生徒がいません。名簿を入れてください。", "error"); return; }
    sjAddStyle();
    const sel = $id("sjStudent");
    const prev = sel.value;
    sel.innerHTML = keys.map(k => '<option value="' + sjEsc(k) + '">' + sjEsc(sjPrettyName(k)) + '</option>').join("");
    if (prev && keys.indexOf(prev) >= 0) sel.value = prev;
    $id("sjWindow").value = lsGet(SJ_WINDOW_KEY, "10") === "all" ? "all" : "10";
    $id("sjOverlay").style.display = "flex";
    renderSeatJourney();
}
function closeSeatJourney() {
    clearTimeout(sjTimer);
    const o = $id("sjOverlay");
    if (o) o.style.display = "none";
}

function renderSeatJourney() {
    clearTimeout(sjTimer);
    const key = $id("sjStudent").value;
    const win = $id("sjWindow").value === "all" ? "all" : "10";
    lsSet(SJ_WINDOW_KEY, win);
    const steps = sjBuildSteps(key, win);
    sjSteps = steps;
    const body = $id("sjBody"), stats = $id("sjStats");
    if (!steps.length) {
        body.innerHTML = '<div class="sj-empty">この生徒が座っていた記録が、ありません。</div>';
        stats.textContent = "";
        $id("sjPlay").disabled = true;
        return;
    }
    $id("sjPlay").disabled = false;
    const maxCols = Math.max.apply(null, steps.map(s => s.cols));
    const maxRows = Math.max.apply(null, steps.map(s => s.rows));
    const CW = 56, CH = 44, PAD = 14;
    const W = maxCols * CW + PAD * 2, H = maxRows * CH + PAD * 2 + 16;
    const cx = x => PAD + x * CW + CW / 2, cy = y => PAD + 16 + y * CH + CH / 2;
    const visits = {};
    steps.forEach(s => { const k = s.x + "," + s.y; visits[k] = (visits[k] || 0) + 1; });
    const last = steps[steps.length - 1];
    let svg = '<svg class="sj-svg" id="sjSvg" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="座席の旅の地図">';
    svg += '<text class="sj-lbl" x="' + (W / 2) + '" y="12">▲ 黒板</text>';
    for (let y = 0; y < maxRows; y++) {
        for (let x = 0; x < maxCols; x++) {
            const k = x + "," + y;
            const cls = (last.x === x && last.y === y) ? "is-now" : (visits[k] ? "is-visit" : "");
            svg += '<rect class="sj-cell ' + cls + '" x="' + (PAD + x * CW + 3) + '" y="' + (PAD + 16 + y * CH + 3) + '" width="' + (CW - 6) + '" height="' + (CH - 6) + '" rx="6"/>';
            svg += '<text class="sj-lbl" x="' + cx(x) + '" y="' + (cy(y) + 20) + '" style="font-size:9px">' + String.fromCharCode(65 + (maxCols - 1 - x)) + (y + 1) + '</text>';
        }
    }
    // 同じ席に何度もいる時は、点が重ならないように、少しずらす
    const seen = {};
    const pts = steps.map((s, i) => {
        const k = s.x + "," + s.y;
        const n = seen[k] || 0; seen[k] = n + 1;
        const off = [[0, 0], [-10, -8], [10, -8], [-10, 8], [10, 8]][Math.min(n, 4)];
        return { x: cx(s.x) + off[0], y: cy(s.y) + off[1], i: i };
    });
    for (let i = 1; i < pts.length; i++) {
        svg += '<line class="sj-line sj-step" data-step="' + i + '" x1="' + pts[i - 1].x + '" y1="' + pts[i - 1].y + '" x2="' + pts[i].x + '" y2="' + pts[i].y + '"/>';
    }
    pts.forEach((p, i) => {
        const isLast = i === pts.length - 1;
        svg += '<g class="sj-step" data-step="' + i + '"><circle class="sj-dot' + (isLast ? " is-last" : "") + '" cx="' + p.x + '" cy="' + p.y + '" r="9"/><text class="sj-num" x="' + p.x + '" y="' + p.y + '">' + (i + 1) + '</text></g>';
    });
    Object.keys(visits).forEach(k => {
        if (visits[k] < 2) return;
        const [x, y] = k.split(",").map(Number);
        svg += '<text class="sj-rep" x="' + (cx(x) + CW / 2 - 12) + '" y="' + (cy(y) - CH / 2 + 16) + '">×' + visits[k] + '</text>';
    });
    svg += '</svg>';
    body.innerHTML = svg;

    // まとめ
    let front = 0, back = 0;
    steps.forEach(s => { const third = Math.max(1, Math.ceil(s.rows / 3)); if (s.y < third) front++; else if (s.y >= s.rows - third) back++; });
    const distinct = Object.keys(visits).length;
    const maxRep = Math.max.apply(null, Object.keys(visits).map(k => visits[k]));
    const repKey = Object.keys(visits).find(k => visits[k] === maxRep);
    const repSeat = steps.find(s => s.x + "," + s.y === repKey);
    stats.innerHTML = sjEsc(sjPrettyName(key)) + ' さんは、' + steps.length + '回の席替えで、' + distinct + 'か所の席に座りました。<br>' +
        '前の列は' + front + '回、後ろの列は' + back + '回です。' +
        (maxRep >= 2 ? '<br>一番多かった席は、' + sjEsc(repSeat.label) + 'の' + maxRep + '回です。' : '<br>同じ席に座ったことはありません。') +
        '<br>今の席は、' + sjEsc(last.label) + 'です。';
}

function playSeatJourney() {
    clearTimeout(sjTimer);
    const svg = $id("sjSvg");
    if (!svg || !sjSteps.length) return;
    const els = Array.from(svg.querySelectorAll(".sj-step"));
    els.forEach(e => e.classList.add("sj-hide"));
    const total = sjSteps.length;
    const per = Math.max(120, Math.min(700, Math.floor(4500 / total)));   // 全体で、5秒を超えないようにします
    let i = 0;
    const tick = () => {
        svg.querySelectorAll('[data-step="' + i + '"]').forEach(e => e.classList.remove("sj-hide"));
        i++;
        if (i < total) sjTimer = setTimeout(tick, per);
    };
    tick();
}

const SJ_HTML = `
<div id="sjOverlay" class="sj-overlay" onclick="if(event.target===this)closeSeatJourney()">
    <div class="sj-box">
        <div class="sj-head"><h3>🗺️ 座席の旅</h3><button type="button" class="sj-x" onclick="closeSeatJourney()">とじる</button></div>
        <div class="sj-row">
            <select id="sjStudent" onchange="renderSeatJourney()"></select>
            <select id="sjWindow" onchange="renderSeatJourney()"><option value="10">直近10回</option><option value="all">全て</option></select>
            <button type="button" class="sj-play" id="sjPlay" onclick="playSeatJourney()">▶ 旅をたどる</button>
        </div>
        <div id="sjBody"></div>
        <div class="sj-stats" id="sjStats"></div>
    </div>
</div>`;

SekigaeApp.registerPlugin({
    id: "seatjourney",
    requires: ["history"],   // 前提のプラグイン（無いと使えません）
    name: "座席の旅",
    version: "1.3",
    description: "一人の生徒がこれまでどの席に座ってきたかを、座席表の上に線でつないで見せます。席替え履歴プラグインの記録を使います。",
    backupKeys: [SJ_WINDOW_KEY],
    searchWords: "座席の旅 履歴 軌跡 たどる 過去の席 ルート 地図",
    stubs: [],
    mount(app) {
        sjAddStyle();
        document.body.insertAdjacentHTML("beforeend", SJ_HTML);
        const more = $id("moreMenu");
        if (more) more.insertAdjacentHTML("beforeend", '<button type="button" onclick="openSeatJourney()" class="pop-item pop-item-gray" id="btnSeatJourney">座席の旅</button>');
        app.insertInto("guide-faq", "<li><strong>一人の生徒がどの席に座ってきたかを見たい</strong>：「他の操作」の「座席の旅」を押します。生徒を選ぶとこれまでの席が番号つきの線でつながります。「旅をたどる」を押すと古い順に動きます。席替え履歴プラグインの記録を使うので、履歴プラグインがオフだと、使えません。</li>");
    }
});
document.addEventListener("keydown", e => {
    const o = $id("sjOverlay");
    if (e.key === "Escape" && o && o.style.display === "flex") closeSeatJourney();
});
