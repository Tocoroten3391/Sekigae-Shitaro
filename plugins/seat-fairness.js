// ==========================================
// 席の公平性レポートプラグイン：前列・後列・窓側・廊下側・角・教卓の前に、何回座ったかを、生徒ごとに数えて、偏りを見せます。
// 席替えの履歴（席替えのたびに残している、座席表の記録）から数えます。印刷とコピーができます。
// 「席替えで、偏りを減らす」をオンにすると、好まれやすい席が続いた人は、次はその席を避けて、いやがられやすい席が続いた人は、その席を避けます（運の貯金と同じ考え方です）
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります。席替えは、これまでどおりに動きます
// ==========================================
const FAIR_KEY = "seat_fair_v1";   // { win: "none"／"left"／"right", period: "all"／"10"／"5", fav: [席の種類], bad: [席の種類], use: 席替えで使うか }
const FAIR_ZONES = [
    { id: "front", name: "前列" },
    { id: "back", name: "後列" },
    { id: "window", name: "窓側" },
    { id: "corridor", name: "廊下側" },
    { id: "corner", name: "角" },
    { id: "podium", name: "教卓の前" }
];
let fairCache = null;   // { key, dev: { 目印: 偏り } }

function fairEsc(t) { return String(t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])); }
function fairSettings() {
    let v = null;
    try { v = JSON.parse(lsGet(FAIR_KEY, "null")); } catch (e) { v = null; }
    v = v && typeof v === "object" ? v : {};
    const ids = FAIR_ZONES.map(z => z.id);
    const pick = (a, def) => Array.isArray(a) ? a.filter(x => ids.includes(x)) : def;
    return {
        win: ["none", "left", "right"].includes(v.win) ? v.win : "none",
        period: ["all", "10", "5"].includes(v.period) ? v.period : "all",
        fav: pick(v.fav, ["window", "back"]),
        bad: pick(v.bad, ["podium"]),
        use: v.use === true
    };
}
function fairSave(s) { lsSet(FAIR_KEY, JSON.stringify(s)); fairCache = null; }

// 席の場所の種類。idx：座席の番号（左上から右へ数える）、cols：列の数、rows：行の数
function fairZonesOf(idx, cols, rows, win) {
    const r = Math.floor(idx / cols), c = idx % cols;
    const z = [];
    if (r === 0) z.push("front");
    if (rows >= 2 && r === rows - 1) z.push("back");
    if (win !== "none" && cols >= 2) {
        const winCol = win === "left" ? 0 : cols - 1;
        if (c === winCol) z.push("window");
        if (c === (win === "left" ? cols - 1 : 0)) z.push("corridor");
    }
    if (cols >= 2 && rows >= 2 && (r === 0 || r === rows - 1) && (c === 0 || c === cols - 1)) z.push("corner");
    if (r === 0 && Math.abs(c - (cols - 1) / 2) < 1) z.push("podium");
    return z;
}

// 席替えの履歴を、期間で切りとります（新しい順に入っています）
function fairEntries(period) {
    const list = (typeof seatTimeline !== "undefined" && Array.isArray(seatTimeline)) ? seatTimeline : [];
    return period === "all" ? list : list.slice(0, parseInt(period, 10));
}
// 生徒ごとの集計：{ 目印: { n: 参加した回数, front: 回数, … } }
function fairCount(entries, win) {
    const out = {};
    entries.forEach(e => {
        const cols = e.cols, rows = Math.ceil(e.n.length / cols);
        for (let i = 0; i < e.n.length; i++) {
            if (e.f.charAt(i) !== "s" || !e.n[i]) continue;
            const key = getCleanStudentKey(e.n[i]);
            if (!key) continue;
            const o = out[key] || (out[key] = { n: 0, front: 0, back: 0, window: 0, corridor: 0, corner: 0, podium: 0, fav: 0, bad: 0 });
            o.n++;
            fairZonesOf(i, cols, rows, win).forEach(z => { o[z]++; });
        }
    });
    return out;
}
// 「好まれやすい席」と「いやがられやすい席」に座った回数から、生徒ごとの偏りを出します（全体の平均との差）
function fairDeviations(s) {
    const entries = fairEntries(s.period);
    const net = {};
    entries.forEach(e => {
        const cols = e.cols, rows = Math.ceil(e.n.length / cols);
        for (let i = 0; i < e.n.length; i++) {
            if (e.f.charAt(i) !== "s" || !e.n[i]) continue;
            const key = getCleanStudentKey(e.n[i]);
            if (!key) continue;
            const zs = fairZonesOf(i, cols, rows, s.win);
            net[key] = (net[key] || 0) + (zs.some(z => s.fav.includes(z)) ? 1 : 0) - (zs.some(z => s.bad.includes(z)) ? 1 : 0);
        }
    });
    const keys = Object.keys(net);
    if (!keys.length) return {};
    const mean = keys.reduce((a, k) => a + net[k], 0) / keys.length;
    const dev = {};
    keys.forEach(k => { dev[k] = net[k] - mean; });
    return dev;
}
function fairBuildCache() {
    const s = fairSettings();
    const list = (typeof seatTimeline !== "undefined" && Array.isArray(seatTimeline)) ? seatTimeline : [];
    const key = JSON.stringify(s) + "|" + list.length + "|" + (list[0] ? list[0].id : "");
    if (fairCache && fairCache.key === key) return fairCache;
    const dev = fairDeviations(s);
    fairCache = { key: key, s: s, dev: dev, active: Object.keys(dev).some(k => dev[k] >= 1 || dev[k] <= -1) };
    return fairCache;
}

// 席替えの計算から呼ばれます（shuffle-engine.js）
function fairActive() {
    if (!SekigaeApp.isEnabled("seat-fairness")) return false;
    const s = fairSettings();
    return s.use && (s.fav.length > 0 || s.bad.length > 0) && fairBuildCache().active;
}
// 今の席の配置で、偏りに合っていない度合い（整数。偏りの大きさ1〜3 に応じて、いやがられやすい席が続いた人が、またその席：2倍、好まれやすい席が続いた人が、またその席：2倍、不利が続いた人が、好まれやすい席にいない：1倍）
function fairPenalty(seats, cols) {
    const c = fairBuildCache(), s = c.s;
    const total = (seats || []).length, rows = Math.ceil(total / cols);
    let pen = 0;
    (seats || []).forEach((seat, idx) => {
        if (!seat || seat.type !== "STUDENT" || !seat.text) return;
        if (seat.isFixed || seat.fixedType !== "none") return; // 席を指定している人は、動かせません
        const d = c.dev[getCleanStudentKey(seat.text)];
        if (d === undefined) return;
        const zs = fairZonesOf(idx, cols, rows, s.win);
        const inFav = zs.some(z => s.fav.includes(z)), inBad = zs.some(z => s.bad.includes(z));
        const mag = Math.min(3, Math.floor(Math.abs(d)));   // 偏りが大きい人程、強く調整します（1〜3）
        if (mag < 1) return;
        if (d > 0 && inFav) pen += 2 * mag;
        if (d < 0 && inBad) pen += 2 * mag;
        if (d < 0 && s.fav.length && !inFav) pen += mag;
    });
    return pen;
}

// ---- 画面 ----
function fairNameRows() {
    const out = [], seen = new Set();
    (currentStudents || []).forEach(seat => {
        if (!seat || seat.type !== "STUDENT" || !seat.text) return;
        const key = getCleanStudentKey(seat.text);
        if (!key || seen.has(key)) return;
        seen.add(key);
        const p = typeof getSeatDisplayParts === "function" ? getSeatDisplayParts(seat.text) : { no: "", name: key };
        out.push({ key: key, no: p.no || "", name: p.name || key });
    });
    out.sort((a, b) => (parseInt(a.no, 10) || 9999) - (parseInt(b.no, 10) || 9999));
    return out;
}
function fairReport() {
    const s = fairSettings();
    const entries = fairEntries(s.period);
    const counts = fairCount(entries, s.win);
    const dev = fairDeviations(s);
    const zones = FAIR_ZONES.filter(z => s.win !== "none" || (z.id !== "window" && z.id !== "corridor"));
    const rows = fairNameRows().map(r => ({ r: r, c: counts[r.key] || { n: 0, front: 0, back: 0, window: 0, corridor: 0, corner: 0, podium: 0 }, d: dev[r.key] }));
    const mean = {};
    zones.forEach(z => { mean[z.id] = rows.length ? rows.reduce((a, x) => a + x.c[z.id], 0) / rows.length : 0; });
    return { s: s, entries: entries, rows: rows, zones: zones, mean: mean };
}
function fairTag(d) {
    if (d === undefined) return { t: "記録なし", c: "none" };
    if (d >= 1) return { t: "好まれやすい席が多め", c: "high" };
    if (d <= -1) return { t: "いやがられやすい席が多め", c: "low" };
    return { t: "普通", c: "mid" };
}
function fairModalOpen() { const o = $id("fairModalOverlay"); return !!o && o.style.display !== "none"; }
function openFairness() {
    if (typeof closePopMenus === "function") closePopMenus();
    const s = fairSettings();
    $id("fairWinSelect").value = s.win;
    $id("fairPeriodSelect").value = s.period;
    $id("fairUseToggle").checked = s.use;
    $id("fairFav").innerHTML = FAIR_ZONES.map(z => '<label class="fair-chip"><input type="checkbox" value="' + z.id + '"' + (s.fav.includes(z.id) ? " checked" : "") + ' onchange="fairSettingChanged()"><span>' + z.name + "</span></label>").join("");
    $id("fairBad").innerHTML = FAIR_ZONES.map(z => '<label class="fair-chip fair-chip-bad"><input type="checkbox" value="' + z.id + '"' + (s.bad.includes(z.id) ? " checked" : "") + ' onchange="fairSettingChanged()"><span>' + z.name + "</span></label>").join("");
    fairRender();
    $id("fairModalOverlay").style.display = "flex";
}
function closeFairness() { const o = $id("fairModalOverlay"); if (o) o.style.display = "none"; }
function fairSettingChanged() {
    fairSave({
        win: $id("fairWinSelect").value,
        period: $id("fairPeriodSelect").value,
        use: $id("fairUseToggle").checked,
        fav: Array.from(document.querySelectorAll("#fairFav input:checked"), el => el.value),
        bad: Array.from(document.querySelectorAll("#fairBad input:checked"), el => el.value)
    });
    fairRender();
}
function fairTableHtml(rep, forPrint) {
    const cell = (v, m) => {
        const cls = v >= m + 1.5 ? " fair-hot" : (v <= m - 1.5 && m >= 1.5 ? " fair-cold" : "");
        return '<td class="fair-num' + cls + '">' + v + "</td>";
    };
    let h = '<table class="fair-table"><thead><tr><th class="fair-left">名前</th><th>参加</th>' + rep.zones.map(z => "<th>" + z.name + "</th>").join("") + '<th class="fair-left">偏り</th></tr></thead><tbody>';
    rep.rows.forEach(x => {
        const tag = fairTag(x.d);
        h += '<tr><td class="fair-left">' + (x.r.no ? fairEsc(x.r.no) + "番 " : "") + fairEsc(x.r.name) + '</td><td class="fair-num">' + x.c.n + "</td>" +
            rep.zones.map(z => cell(x.c[z.id], rep.mean[z.id])).join("") + '<td class="fair-left"><span class="fair-tag fair-tag-' + tag.c + '">' + tag.t + "</span></td></tr>";
    });
    h += '<tr class="fair-mean"><td class="fair-left">平均</td><td class="fair-num">' + (rep.rows.length ? (rep.rows.reduce((a, x) => a + x.c.n, 0) / rep.rows.length).toFixed(1) : 0) + "</td>" +
        rep.zones.map(z => '<td class="fair-num">' + rep.mean[z.id].toFixed(1) + "</td>").join("") + "<td></td></tr></tbody></table>";
    return h;
}
function fairRender() {
    const rep = fairReport();
    const cls = typeof getSelectedPresetName === "function" ? getSelectedPresetName() : "";
    const allN = (typeof seatTimeline !== "undefined" && Array.isArray(seatTimeline)) ? seatTimeline.length : 0;
    $id("fairInfo").textContent = (cls ? "クラス：" + cls + "　" : "") + "席替えの記録：" + allN + "回分" + (rep.entries.length < allN ? "（数えるのは直近の" + rep.entries.length + "回分）" : "");
    $id("fairWinNote").style.display = rep.s.win === "none" ? "" : "none";
    $id("fairBody").innerHTML = allN === 0
        ? '<p class="config-note" data-keep="1">まだ記録がありません。席替えをするたびに座席表が記録されて、ここで集計できます。</p>'
        : '<div class="fair-scroll">' + fairTableHtml(rep, false) + "</div>";
    $id("fairCopyBtn").disabled = $id("fairPrintBtn").disabled = allN === 0;
}
function fairCopy() {
    const rep = fairReport();
    const lines = [["名前", "参加"].concat(rep.zones.map(z => z.name), ["偏り"]).join("\t")];
    rep.rows.forEach(x => lines.push([(x.r.no ? x.r.no + "番 " : "") + x.r.name, x.c.n].concat(rep.zones.map(z => x.c[z.id]), [fairTag(x.d).t]).join("\t")));
    const text = lines.join("\n");
    const done = () => showToast("表をコピーしました。スプレッドシートにそのまま貼れます。", "success");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fairCopyFallback(text, done));
    else fairCopyFallback(text, done);
}
function fairCopyFallback(text, done) {
    const ta = document.createElement("textarea");
    ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); done(); } catch (e) { showToast("コピーできませんでした", "error"); }
    ta.remove();
}
// 印刷：見えない枠の中に、報告用の表を作って、印刷します
function fairPrint() {
    const rep = fairReport();
    const cls = typeof getSelectedPresetName === "function" ? getSelectedPresetName() : "";
    const d = new Date();
    const zn = ids => ids.map(id => FAIR_ZONES.find(z => z.id === id).name).join("・") || "なし";
    const html = '<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>席の公平性レポート</title><style>' +
        'body{font-family:"Hiragino Sans","Noto Sans JP",sans-serif;color:#111;margin:18mm 14mm;font-size:12px}h1{font-size:18px;margin:0 0 4px}p{margin:2px 0 10px;color:#444}' +
        'table{border-collapse:collapse;width:100%}th,td{border:1px solid #888;padding:4px 6px;text-align:center}th{background:#eee}.fair-left{text-align:left}.fair-hot{background:#ffe3c2}.fair-cold{background:#d9ecff}.fair-mean td{background:#f5f5f5;font-weight:bold}.fair-tag{font-size:11px}' +
        '</style></head><body><h1>席の公平性レポート</h1><p>' + (cls ? fairEsc(cls) + "　" : "") + d.getFullYear() + "年" + (d.getMonth() + 1) + "月" + d.getDate() + "日　席替えの記録：" + rep.entries.length + "回分" + '</p>' +
        '<p>席に座った回数です。薄いオレンジは平均より多い席、薄い青は平均より少ない席です。' + (rep.s.win === "none" ? "" : "窓側は座席表の" + (rep.s.win === "left" ? "左" : "右") + "端の列です。") +
        "「偏り」は、好まれやすい席（" + zn(rep.s.fav) + "）と、いやがられやすい席（" + zn(rep.s.bad) + "）に座った回数の差を全体の平均と比べたものです。</p>" + fairTableHtml(rep, true) + "</body></html>";
    const fr = document.createElement("iframe");
    fr.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    document.body.appendChild(fr);
    const doc = fr.contentWindow.document;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
        try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) { showToast("印刷を始められませんでした", "error"); }
        setTimeout(() => fr.remove(), 2000);
    }, 200);
}

const FAIR_CSS = `
.fair-scroll { overflow: auto; max-height: 44vh; border-radius: 8px; border: 1px solid var(--seat-border, #e2e8f0); }
.fair-table { border-collapse: collapse; width: 100%; font-size: 12px; color: var(--text-main, #1e293b); }
.fair-table th { position: sticky; top: 0; background: var(--input-bg, #f2f2f7); padding: 6px 6px; white-space: nowrap; z-index: 1; }
.fair-table td { padding: 5px 6px; border-top: 1px solid var(--seat-border, #e2e8f0); text-align: center; white-space: nowrap; }
.fair-table .fair-left { text-align: left; }
.fair-num { font-variant-numeric: tabular-nums; }
.fair-hot { background: rgba(249, 115, 22, 0.25); font-weight: 700; }
.fair-cold { background: rgba(59, 130, 246, 0.22); }
.fair-mean td { background: var(--input-bg, #f2f2f7); font-weight: 700; }
.fair-tag { font-size: 11px; padding: 2px 8px; border-radius: 8px; }
.fair-tag-high { background: #fef3c7; color: #92400e; }
.fair-tag-low { background: #dbeafe; color: #1e40af; }
.fair-tag-mid, .fair-tag-none { background: var(--input-bg, #f2f2f7); color: var(--text-sub, #64748b); }
.fair-chips { display: flex; flex-wrap: wrap; gap: 6px; margin: 4px 0 10px; }
.fair-chip { display: inline-flex; cursor: pointer; }
.fair-chip input { position: absolute; opacity: 0; pointer-events: none; }
.fair-chip span { padding: 6px 12px; border-radius: 999px; border: 1px solid var(--seat-border, #e2e8f0); background: var(--input-bg, #f2f2f7); color: var(--input-text, #1c1c1e); font-size: 13px; font-weight: 700; }
.fair-chip input:checked + span { background: #f59e0b; border-color: #f59e0b; color: #1c1917; }
.fair-chip-bad input:checked + span { background: #3b82f6; border-color: #3b82f6; color: #fff; }
.fair-chip input:focus-visible + span { outline: 2px solid var(--uis-focus, #0369a1); outline-offset: 2px; }
`;
const FAIR_HTML = `
<div id="fairModalOverlay" class="modal-overlay" style="display: none;">
    <div class="modal-content" style="max-width: 760px; width: 96%; max-height: 92vh; overflow-y: auto;">
        <h4 style="color: #b45309;">📊 席の公平性レポート <span data-fairtip="席替えの記録から、前列・後列・窓側・廊下側・角・教卓の前に、何回座ったかを生徒ごとに数えます。窓の位置は座席表で窓がある側の端の列を選びます。「好まれやすい席」が続いた人は次の席替えでその席を避けます。「いやがられやすい席」が続いた人はその席を避けて、好まれやすい席になりやすくなります。名簿で席を決めている生徒は、動かしません。他の条件（離す・近くに置く・前と同じ席を避ける・運の貯金）が、いつも先です。"></span></h4>
        <div class="layout-grid-fields" style="margin: 6px 0 10px;">
            <div><label for="fairWinSelect">窓の位置</label>
                <select id="fairWinSelect" onchange="fairSettingChanged()"><option value="none">指定しない</option><option value="left">座席表の左端の列</option><option value="right">座席表の右端の列</option></select></div>
            <div><label for="fairPeriodSelect">数える期間</label>
                <select id="fairPeriodSelect" onchange="fairSettingChanged()"><option value="all">記録の全て</option><option value="10">直近10回</option><option value="5">直近5回</option></select></div>
        </div>
        <p id="fairWinNote" class="config-note" style="margin: -4px 0 8px;">窓の位置を選ぶと窓側と廊下側も数えます</p>
        <label class="input-label">好まれやすい席</label>
        <div id="fairFav" class="fair-chips"></div>
        <label class="input-label">いやがられやすい席</label>
        <div id="fairBad" class="fair-chips"></div>
        <div class="switch-container">
            <label class="switch"><input type="checkbox" id="fairUseToggle" onchange="fairSettingChanged()"><span class="slider"></span></label>
            <span class="switch-label">席替えで偏りを減らす</span>
        </div>
        <p id="fairInfo" class="config-note" style="margin: 10px 0 6px;"></p>
        <div id="fairBody"></div>
        <div class="modal-btn-row">
            <button type="button" id="fairCopyBtn" onclick="fairCopy()" class="btn-secondary">📋 表をコピー</button>
            <button type="button" id="fairPrintBtn" onclick="fairPrint()" class="btn-secondary">🖨️ 印刷</button>
            <button type="button" onclick="closeFairness()" class="btn-secondary">閉じる</button>
        </div>
    </div>
</div>`;

SekigaeApp.registerPlugin({
    id: "seat-fairness",
    name: "席の公平性レポート",
    version: "1.1",
    description: "前列・後列・窓側・廊下側・角・教卓の前に、何回座ったかを生徒ごとに数えて、偏りを見せます。偏りが続いた人は次の席替えで調整できます。表のコピーと印刷ができます。席替えの履歴を使います。",
    backupKeys: [FAIR_KEY],
    requires: ["history"],
    suggests: ["luckbank"],
    searchWords: "公平 公平性 レポート 前列 後列 窓側 廊下側 角 教卓 偏り 不公平 保護者 説明 印刷 席 回数",
    mount(app) {
        const st = document.createElement("style");
        st.id = "fairStyle";
        st.textContent = FAIR_CSS;
        document.head.appendChild(st);
        document.body.insertAdjacentHTML("beforeend", FAIR_HTML);
        document.querySelectorAll("#fairModalOverlay [data-fairtip]").forEach(el => el.replaceWith(makeInfoTip(el.dataset.fairtip)));
        app.insertInto("settings-records", '<button type="button" onclick="openFairness()" class="btn-secondary" id="btnFairness" style="margin-top: 10px;">席の公平性レポート</button>');
        app.insertInto("guide-tools", '<li><strong>席の公平性レポート</strong>：設定の「記録・統計」の「席の公平性レポート」で、前列・後列・窓側・廊下側・角・教卓の前に、何回座ったかを生徒ごとに見られます。「席替えで偏りを減らす」をオンにすると同じような席が続いた人を、次は避けます。保護者への説明には印刷が使えます。</li>');
    }
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && fairModalOpen()) closeFairness();
});
