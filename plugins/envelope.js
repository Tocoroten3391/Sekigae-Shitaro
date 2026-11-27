// ==========================================
// 封筒くじプラグイン：席替えの結果を、封筒を選んで開く形で、1人ずつ発表します。電子黒板で、みんなで盛り上がるための機能です
// 結果は、席替えで先に決まっています。どの封筒を選んでも、呼ばれた人の席が出ます
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// ==========================================
const ENV_ORDER_KEY = "env_order";   // "number"（出席番号順）／ "random"（ランダム）
let envDraw = null;                   // { people, idx, cards: [{ n, person }], busy, cols, rows }

function envAddStyle() {
    if ($id("envDrawStyle")) return;
    const st = document.createElement("style");
    st.id = "envDrawStyle";
    st.textContent = `
.env-overlay { position: fixed; inset: 0; z-index: 3000; display: none; flex-direction: column; align-items: center; padding: 18px 16px 24px; overflow-y: auto; background: radial-gradient(circle at 50% 0%, #4c1d95, #1e1b4b 70%); color: #fff; }
.env-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; max-width: 1040px; font-weight: 700; }
.env-head h3 { margin: 0; font-size: 20px; }
.env-quit { background: rgba(255,255,255,0.16); color: #fff; border: 1px solid rgba(255,255,255,0.35); border-radius: 10px; padding: 6px 14px; font-weight: 700; cursor: pointer; }
.env-setup, .env-end { width: 100%; max-width: 520px; margin-top: 8vh; text-align: center; display: flex; flex-direction: column; gap: 14px; align-items: center; }
.env-setup .env-big { font-size: 56px; }
.env-setup select { padding: 8px 12px; border-radius: 8px; font-size: 15px; }
.env-go { background: #f59e0b; color: #1c1917; border: none; border-radius: 12px; padding: 12px 34px; font-size: 18px; font-weight: 700; cursor: pointer; box-shadow: 0 6px 18px rgba(0,0,0,0.35); }
.env-note { font-size: 13px; color: #ddd6fe; line-height: 1.6; }
.env-call { margin: 14px 0 4px; font-size: clamp(22px, 4vw, 38px); font-weight: 700; text-align: center; }
.env-call small { display: block; font-size: 14px; color: #ddd6fe; font-weight: 400; margin-top: 2px; }
.env-grid { width: 100%; max-width: 1040px; display: grid; grid-template-columns: repeat(auto-fill, minmax(92px, 1fr)); gap: 14px; margin-top: 12px; }
.env-card { position: relative; aspect-ratio: 3 / 2; border: 2px solid #b45309; border-radius: 8px; background: linear-gradient(135deg, #fef3c7, #fbbf24); color: #78350f; font-weight: 700; cursor: pointer; padding: 0; box-shadow: 0 6px 14px rgba(0,0,0,0.35); transition: transform 0.2s ease, opacity 0.4s ease; overflow: hidden; }
.env-card::before { content: ""; position: absolute; inset: 0; background: linear-gradient(to bottom right, transparent 49.2%, rgba(120,53,15,0.35) 50%) , linear-gradient(to bottom left, transparent 49.2%, rgba(120,53,15,0.35) 50%); clip-path: polygon(0 0, 100% 0, 50% 56%); }
.env-card .env-no { position: absolute; left: 0; right: 0; bottom: 6px; font-size: 15px; }
.env-card:hover:not(:disabled) { transform: translateY(-6px) rotate(-2deg); }
.env-card:disabled { cursor: default; }
.env-card.is-open { opacity: 0.32; filter: grayscale(0.5); transform: none; }
.env-card.is-open .env-no { font-size: 12px; }
.env-card.is-opening { animation: envOpening 0.7s ease both; z-index: 2; }
@keyframes envOpening { 0% { transform: scale(1) rotate(0); } 40% { transform: scale(1.35) rotate(-6deg); } 100% { transform: scale(1.6) rotate(4deg); opacity: 0; } }
.env-reveal { position: fixed; inset: 0; z-index: 3010; display: none; align-items: center; justify-content: center; background: rgba(15,23,42,0.6); }
.env-paper { width: min(92vw, 560px); padding: 26px 22px 20px; border-radius: 16px; background: #fffbeb; color: #78350f; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); animation: envPaperIn 0.5s cubic-bezier(0.2, 1.2, 0.3, 1) both; }
@keyframes envPaperIn { from { transform: translateY(40px) scale(0.7); opacity: 0; } to { transform: none; opacity: 1; } }
.env-paper .env-who { font-size: 20px; font-weight: 700; }
.env-paper .env-seat { font-size: clamp(54px, 14vw, 96px); font-weight: 800; line-height: 1.1; color: #b45309; margin: 6px 0 2px; }
.env-paper .env-row { font-size: 15px; color: #92400e; margin-bottom: 10px; }
.env-map { display: grid; gap: 3px; margin: 8px auto 14px; max-width: 420px; }
.env-cell { aspect-ratio: 4 / 3; border-radius: 4px; background: #fde68a; border: 1px solid #f59e0b; font-size: 10px; line-height: 1.1; display: flex; align-items: center; justify-content: center; overflow: hidden; color: #78350f; padding: 1px; word-break: break-all; }
.env-cell.is-none { background: transparent; border-color: transparent; }
.env-cell.is-wait { background: #fef3c7; border-style: dashed; color: transparent; }
.env-cell.is-now { background: #ef4444; border-color: #991b1b; color: #fff; font-weight: 700; animation: envBlink 0.9s ease-in-out infinite alternate; }
@keyframes envBlink { from { transform: scale(1); } to { transform: scale(1.18); } }
.env-next { background: #7c3aed; color: #fff; border: none; border-radius: 12px; padding: 10px 30px; font-size: 17px; font-weight: 700; cursor: pointer; }
`;
    document.head.appendChild(st);
}

function envPeople() {
    const cols = getGridCols();
    const list = [];
    (currentStudents || []).forEach((seat, idx) => {
        if (!seat || seat.type !== "STUDENT" || !seat.text || seat.isAbsent) return;
        const p = getSeatDisplayParts(seat.text);
        list.push({ idx: idx, label: getSeatLabel(idx, cols), row: Math.floor(idx / cols) + 1, no: p.no, name: p.name || getCleanStudentKey(seat.text) });
    });
    return list;
}
function envEsc(t) { return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function envWho(p) { return (p.no ? p.no + "番 " : "") + p.name; }

function openEnvDraw() {
    if (typeof closePopMenus === "function") closePopMenus();
    const people = envPeople();
    if (!people.length) { showToast("座席表に生徒がいません。名簿を入れて、席替えをしてください。", "error"); return; }
    envAddStyle();
    envDraw = { people: people, idx: 0, cards: [], busy: false, order: [] };
    envShowSetup();
    $id("envOverlay").style.display = "flex";
}
function closeEnvDraw() {
    const o = $id("envOverlay"), r = $id("envReveal");
    if (o) o.style.display = "none";
    if (r) r.style.display = "none";
    envDraw = null;
}
function envShowSetup() {
    const saved = lsGet(ENV_ORDER_KEY, "number") === "random" ? "random" : "number";
    $id("envBody").innerHTML =
        '<div class="env-setup"><div class="env-big">🎁</div>' +
        '<div style="font-size:20px;font-weight:700">' + envDraw.people.length + '人が封筒を1つずつ選びます</div>' +
        '<label>呼ぶ順番　<select id="envOrderSelect"><option value="number">出席番号順</option><option value="random">ランダム</option></select></label>' +
        '<button type="button" class="env-go" onclick="envStart()">はじめる</button>' +
        '<div class="env-note">席は席替えで先に決まっています。どの封筒を選んでも呼ばれた人の席が出ます。席替えをやり直すと結果も変わります。</div></div>';
    $id("envOrderSelect").value = saved;
}
function envStart() {
    const sel = $id("envOrderSelect");
    const order = sel && sel.value === "random" ? "random" : "number";
    lsSet(ENV_ORDER_KEY, order);
    const list = envDraw.people.slice();
    if (order === "random") { for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; } }
    else list.sort((a, b) => (parseInt(a.no, 10) || 1e6) - (parseInt(b.no, 10) || 1e6) || a.idx - b.idx);
    envDraw.order = list;
    envDraw.idx = 0;
    envDraw.cards = list.map((p, i) => ({ n: i + 1, person: null }));
    // 封筒の位置は、毎回ばらばらにします（番号は、そのままです）
    envDraw.slots = envDraw.cards.map((c, i) => i);
    for (let i = envDraw.slots.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [envDraw.slots[i], envDraw.slots[j]] = [envDraw.slots[j], envDraw.slots[i]]; }
    envRenderStage();
}
function envRenderStage() {
    const d = envDraw;
    const p = d.order[d.idx];
    $id("envBody").innerHTML =
        '<div class="env-call">' + envEsc(envWho(p)) + ' さん、封筒を選んでください<small>' + (d.idx + 1) + ' / ' + d.order.length + '人目</small></div>' +
        '<div class="env-grid" id="envGrid">' + d.slots.map(i => {
            const c = d.cards[i];
            return '<button type="button" class="env-card' + (c.person ? " is-open" : "") + '" data-card="' + i + '"' + (c.person ? " disabled" : "") + '>' +
                '<span class="env-no">' + (c.person ? "✓ " + envEsc(c.person.name.slice(0, 5)) : c.n) + '</span></button>';
        }).join("") + '</div>';
    $id("envGrid").querySelectorAll(".env-card:not(:disabled)").forEach(b => b.onclick = () => envPick(parseInt(b.dataset.card, 10), b));
}
function envPick(i, btn) {
    const d = envDraw;
    if (!d || d.busy) return;
    d.busy = true;
    const p = d.order[d.idx];
    d.cards[i].person = p;
    btn.classList.add("is-opening");
    setTimeout(() => envReveal(p), 650);
}
function envMapHtml(p) {
    const cols = getGridCols();
    const total = (currentStudents || []).length;
    const rows = Math.max(1, Math.ceil(total / cols));
    const revealed = new Set(envDraw.order.slice(0, envDraw.idx + 1).map(x => x.idx));
    const byIdx = {};
    envDraw.order.forEach(x => { byIdx[x.idx] = x; });
    let html = '<div class="env-map" style="grid-template-columns: repeat(' + cols + ', 1fr);">';
    for (let i = 0; i < cols * rows; i++) {
        const q = byIdx[i];
        if (!q) { html += '<div class="env-cell is-none"></div>'; continue; }
        if (i === p.idx) html += '<div class="env-cell is-now">' + envEsc(p.name.slice(0, 4)) + '</div>';
        else if (revealed.has(i)) html += '<div class="env-cell">' + envEsc(q.name.slice(0, 4)) + '</div>';
        else html += '<div class="env-cell is-wait">?</div>';
    }
    return html + '</div>';
}
function envReveal(p) {
    const d = envDraw;
    if (!d) return;
    const last = d.idx >= d.order.length - 1;
    const rowText = p.row === 1 ? "一番前の列です" : "前から" + p.row + "列目です";
    $id("envReveal").innerHTML = '<div class="env-paper"><div class="env-who">' + envEsc(envWho(p)) + ' さんの席は</div>' +
        '<div class="env-seat">' + envEsc(p.label) + '</div><div class="env-row">' + rowText + '</div>' + envMapHtml(p) +
        '<button type="button" class="env-next" id="envNextBtn">' + (last ? "おわり 🎉" : "次の人へ ▶") + '</button></div>';
    $id("envReveal").style.display = "flex";
    $id("envNextBtn").onclick = envNext;
    $id("envNextBtn").focus();
}
function envNext() {
    const d = envDraw;
    if (!d) return;
    $id("envReveal").style.display = "none";
    d.busy = false;
    if (d.idx >= d.order.length - 1) { envShowEnd(); return; }
    d.idx++;
    envRenderStage();
}
function envShowEnd() {
    const d = envDraw;
    d.idx = d.order.length - 1;
    const cols = getGridCols();
    const total = (currentStudents || []).length;
    const rows = Math.max(1, Math.ceil(total / cols));
    const byIdx = {};
    d.order.forEach(x => { byIdx[x.idx] = x; });
    let map = '<div class="env-map" style="grid-template-columns: repeat(' + cols + ', 1fr); max-width: 640px;">';
    for (let i = 0; i < cols * rows; i++) map += byIdx[i] ? '<div class="env-cell">' + envEsc(byIdx[i].name.slice(0, 4)) + '</div>' : '<div class="env-cell is-none"></div>';
    map += '</div>';
    $id("envBody").innerHTML = '<div class="env-end"><div class="env-big" style="font-size:56px">🎉</div><div style="font-size:24px;font-weight:700">みんなの席が決まりました！</div>' + map +
        '<button type="button" class="env-go" onclick="closeEnvDraw()">とじる</button></div>';
}

const ENV_HTML = `
<div id="envOverlay" class="env-overlay">
    <div class="env-head"><h3>🎁 封筒くじ</h3><button type="button" class="env-quit" onclick="closeEnvDraw()">やめる</button></div>
    <div id="envBody" style="width:100%; display:flex; flex-direction:column; align-items:center;"></div>
</div>
<div id="envReveal" class="env-reveal"></div>`;

SekigaeApp.registerPlugin({
    id: "envelope",
    name: "封筒くじ",
    version: "1.0",
    description: "席替えの結果を封筒を選んで開く形で、1人ずつ発表します。結果は席替えで先に決まっていて、どの封筒を選んでも呼ばれた人の席が出ます。",
    backupKeys: [ENV_ORDER_KEY],
    searchWords: "封筒 くじ くじ引き 発表 ふうとう 抽選 盛り上がる",
    stubs: [],
    mount(app) {
        envAddStyle();
        document.body.insertAdjacentHTML("beforeend", ENV_HTML);
        const more = $id("moreMenu");
        if (more) more.insertAdjacentHTML("beforeend", '<button type="button" onclick="openEnvDraw()" class="pop-item pop-item-gray" id="btnEnvDraw">封筒くじ</button>');
        app.insertInto("guide-faq", "<li><strong>席替えの結果を盛り上げて発表したい</strong>：席替えをした後に「他の操作」の「封筒くじ」を押します。呼ばれた人が封筒を1つ選ぶと、その人の席が出ます。席は席替えで先に決まっているので、どの封筒を選んでも同じです。</li>");
    }
});
document.addEventListener("keydown", e => {
    const o = $id("envOverlay");
    if (!o || o.style.display === "none" || !envDraw) return;
    if (e.key === "Escape") { closeEnvDraw(); return; }
    const rv = $id("envReveal");
    if (rv && rv.style.display !== "none" && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); envNext(); }
});
