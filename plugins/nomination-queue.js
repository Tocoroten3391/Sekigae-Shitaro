// ==========================================
// 指名の順番リスト・プラグイン：指名する人を、あらかじめ順番に決めておけます。
// 「次を指名する！」を押すたびに、順番リストの上の人から当たります。リストが終わったら、ふだんどおりのランダムに戻ります。
// 指名の画面には、順番を使っていることは出ません（設定の画面にだけ出ます）。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります。指名は、これまでどおりに動きます
// ==========================================
const NQ_KEY = "nominate_queue_v1";   // { on: 使うか, lists: { クラス名: [生徒の目印（座席の文字）の並び] } }
let nqPendingPrev = null;             // 直前の指名で使った、順番リストのもとの並び（取り消し用）

// クラスごとに、順番リストを持ちます。{ on: 使うか, lists: { クラス名: [生徒の目印の並び] } }
function nqClassKey() { try { return (typeof activeClassId !== "undefined" && activeClassId) ? String(activeClassId) : ""; } catch (e) { return ""; } }
function nqRaw() {
    let v = null;
    try { v = JSON.parse(lsGet(NQ_KEY, "null")); } catch (e) { v = null; }
    v = v && typeof v === "object" ? v : {};
    const lists = v.lists && typeof v.lists === "object" && !Array.isArray(v.lists) ? v.lists : {};
    const out = { on: v.on === true, lists: {} };
    Object.keys(lists).forEach(k => { if (Array.isArray(lists[k])) out.lists[k] = lists[k].filter(x => typeof x === "string" && x); });
    // 古い形（クラスを分けずに、ひとつだけ持っていた）は、いま開いているクラスのものとして引き継ぎます
    if (Array.isArray(v.list) && v.list.length && !Object.keys(out.lists).length) out.lists[nqClassKey()] = v.list.filter(x => typeof x === "string" && x);
    return out;
}
function nqWriteRaw(r) {
    const lists = {};
    Object.keys(r.lists).forEach(k => { if (r.lists[k].length) lists[k] = r.lists[k]; });
    lsSet(NQ_KEY, JSON.stringify({ on: !!r.on, lists: lists }));
}
function nqState() {
    const r = nqRaw();
    return { on: r.on, list: (r.lists[nqClassKey()] || []).slice() };
}
function nqSave(s) {
    const r = nqRaw();
    r.on = !!s.on;
    r.lists[nqClassKey()] = s.list.slice();
    nqWriteRaw(r);
}
// クラスの名前を変えた・複製した・消した時に、順番リストも合わせます
function nqRenameClass(oldName, newName) { const r = nqRaw(); if (r.lists[oldName]) { r.lists[newName] = r.lists[oldName]; delete r.lists[oldName]; nqWriteRaw(r); } }
function nqCopyClass(fromName, toName) { const r = nqRaw(); if (r.lists[fromName]) { r.lists[toName] = r.lists[fromName].slice(); nqWriteRaw(r); } }
function nqRemoveClass(name) { const r = nqRaw(); if (r.lists[name]) { delete r.lists[name]; nqWriteRaw(r); } }
function nqSetList(list) { const s = nqState(); s.list = list; nqSave(s); nqRender(); }
function nqEsc(t) { return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function nqLabel(text) {
    const p = typeof nominationNameParts === "function" ? nominationNameParts(text) : { no: "", name: text };
    return (p.no ? p.no + "番 " : "") + p.name;
}
// 名簿にいるか、お休みか
function nqStatus(text) {
    const seat = (typeof currentStudents !== "undefined" ? currentStudents : []).find(s => s && s.type === "STUDENT" && s.text === text);
    if (!seat) return "none";
    return seat.isAbsent ? "absent" : "ok";
}

function nqRender() {
    const panel = $id("nqPanel");
    const s = nqState();
    const tg = $id("nqToggle");
    if (tg) tg.checked = s.on;
    if (panel) panel.hidden = !s.on;
    if (!panel || !s.on) return;
    const list = $id("nqList"), picker = $id("nqPicker"), count = $id("nqCount");
    if (list) {
        if (!s.list.length) list.innerHTML = '<div class="nq-empty">まだ、決めていません。下の名前を押すと、ここに入ります。</div>';
        else list.innerHTML = s.list.map((t, i) => {
            const st = nqStatus(t);
            const tag = st === "none" ? '<span class="nq-tag">名簿にいません</span>' : (st === "absent" ? '<span class="nq-tag">お休み</span>' : "");
            return '<div class="nq-item' + (st === "ok" ? "" : " is-away") + '" data-i="' + i + '">'
                + '<span class="nq-no">' + (i + 1) + '</span><span class="nq-name">' + nqEsc(nqLabel(t)) + '</span>' + tag
                + '<span class="nq-ops">'
                + '<button type="button" class="nq-op" data-op="up" aria-label="' + nqEsc(nqLabel(t)) + 'を、一つ前にする"' + (i === 0 ? " disabled" : "") + '><span class="pico" data-pico="arrowup" aria-hidden="true">⬆</span></button>'
                + '<button type="button" class="nq-op" data-op="down" aria-label="' + nqEsc(nqLabel(t)) + 'を、一つ後ろにする"' + (i === s.list.length - 1 ? " disabled" : "") + '><span class="pico" data-pico="arrowdown" aria-hidden="true">⬇</span></button>'
                + '<button type="button" class="nq-op" data-op="del" aria-label="' + nqEsc(nqLabel(t)) + 'を、順番からはずす"><span class="pico" data-pico="close" aria-hidden="true">✕</span></button>'
                + '</span></div>';
        }).join("");
    }
    if (count) {
        const n = s.list.filter(t => nqStatus(t) === "ok").length;
        count.textContent = s.list.length ? "あと " + n + " 人（お休みの人と、名簿にいない人は、とばします）" : "";
    }
    if (picker) {
        const students = (typeof currentStudents !== "undefined" ? currentStudents : []).filter(x => x && x.type === "STUDENT" && x.text);
        const num = x => { const n = parseInt(nqLabel(x.text), 10); return isNaN(n) ? 1e9 : n; };
        const rest = students.filter(x => !s.list.includes(x.text)).sort((a, b) => num(a) - num(b));
        picker.innerHTML = rest.length
            ? rest.map(x => '<button type="button" class="nq-chip" data-t="' + nqEsc(x.text) + '">' + nqEsc(nqLabel(x.text)) + '</button>').join("")
            : '<span class="nq-empty">' + (students.length ? "全員、順番に入っています。" : "名簿が空です。") + '</span>';
    }
}

function nqToggle() {
    const tg = $id("nqToggle");
    const s = nqState();
    s.on = !!(tg && tg.checked);
    nqSave(s);
    nqRender();
}
function nqShuffle() {
    const a = nqState().list.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    nqSetList(a);
    if (a.length > 1) showToast("順番を、ばらばらにしました。", "success");
}
function nqClear() {
    if (!nqState().list.length) return;
    nqSetList([]);
    showToast("順番を、からにしました。", "success");
}
function nqAddAll() {
    const s = nqState();
    const add = (typeof currentStudents !== "undefined" ? currentStudents : []).filter(x => x && x.type === "STUDENT" && x.text && !s.list.includes(x.text)).map(x => x.text);
    if (!add.length) return;
    nqSetList(s.list.concat(add));
    showToast("全員を、名簿の順に入れました。", "success");
}

function nqClick(e) {
    const chip = e.target.closest && e.target.closest("#nqPicker .nq-chip");
    if (chip) { const s = nqState(); const t = chip.dataset.t; if (t && !s.list.includes(t)) nqSetList(s.list.concat([t])); return; }
    const op = e.target.closest && e.target.closest("#nqList .nq-op");
    if (!op || op.disabled) return;
    const item = op.closest(".nq-item");
    const i = item ? parseInt(item.dataset.i, 10) : -1;
    const a = nqState().list.slice();
    if (i < 0 || i >= a.length) return;
    if (op.dataset.op === "del") a.splice(i, 1);
    else if (op.dataset.op === "up" && i > 0) [a[i - 1], a[i]] = [a[i], a[i - 1]];
    else if (op.dataset.op === "down" && i < a.length - 1) [a[i + 1], a[i]] = [a[i], a[i + 1]];
    nqSetList(a);
}

// 指名する人を選ぶところ：順番リストの、いちばん上の（当たれる）人を返します
function nqPickWith(seats, orig) {
    nqPendingPrev = null;
    const s = nqState();
    if (s.on && s.list.length && SekigaeApp.isEnabled("nomination-queue")) {
        for (let i = 0; i < s.list.length; i++) {
            const hit = seats.find(x => x.data.text === s.list[i]);
            if (!hit) continue;
            nqPendingPrev = s.list.slice();
            const next = s.list.slice();
            next.splice(i, 1);
            nqSave({ on: s.on, list: next });
            setTimeout(nqRender, 0);
            return hit;
        }
    }
    return orig ? orig(seats) : seats[Math.floor(Math.random() * seats.length)];
}

// 巨大ルーレット：順番リストの、いちばん上の（盤にいる）人の番号を返します（なければ -1）。消すのは、当たりが決まった時です
function nqRouletteIndex(items) {
    const s = nqState();
    if (!s.on || !SekigaeApp.isEnabled("nomination-queue")) return -1;
    for (let i = 0; i < s.list.length; i++) {
        const k = items.findIndex(it => it.fullText === s.list[i]);
        if (k >= 0) return k;
    }
    return -1;
}

const NQ_CSS = `
.nq-list { display: flex; flex-direction: column; gap: 5px; max-height: 220px; overflow-y: auto; margin-bottom: 8px; }
.nq-item { display: flex; align-items: center; gap: 8px; padding: 5px 6px 5px 10px; border: 1px solid var(--seat-border); border-radius: 10px; background: var(--card-bg, var(--input-bg)); color: var(--input-text); font-size: 14px; font-weight: 700; }
.nq-item.is-away { opacity: 0.6; }
.nq-no { flex: none; min-width: 22px; height: 22px; border-radius: 50%; background: var(--accent-color); color: #fff; font-size: 12px; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; }
.nq-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.nq-tag { flex: none; font-size: 11px; font-weight: 800; color: var(--text-sub); border: 1px solid var(--seat-border); border-radius: 999px; padding: 0 7px; }
.nq-ops { flex: none; display: inline-flex; gap: 2px; }
.config-container .nq-ops .nq-op, .nq-ops .nq-op { width: 30px !important; height: 30px !important; min-width: 30px !important; min-height: 30px !important; max-width: 30px; padding: 0 !important; margin: 0 !important; border-radius: 8px; border: 1px solid var(--seat-border); background: transparent; color: var(--text-sub); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; box-shadow: none; font-size: 13px; }
.nq-ops .nq-op:hover:not(:disabled) { border-color: var(--accent-color); color: var(--accent-color); }
.nq-ops .nq-op:disabled { opacity: 0.35; cursor: default; }
.nq-picker { display: flex; flex-wrap: wrap; gap: 6px; max-height: 150px; overflow-y: auto; }
#configContainer .nq-picker .nq-chip, .config-container .nq-picker .nq-chip, .nq-chip { display: inline-flex !important; align-items: center; width: auto !important; flex: 0 0 auto !important; min-height: 32px !important; height: auto !important; margin: 0 !important; padding: 4px 10px !important; font-size: 13px !important; border-radius: 999px; border: 1px solid var(--seat-border); background: var(--input-bg); color: var(--input-text); font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: none; }
.nq-chip:hover { border-color: var(--accent-color); color: var(--accent-color); }
.nq-empty { color: var(--text-sub); font-size: 12px; font-weight: 600; }
.nq-count { color: var(--text-sub); font-size: 12px; font-weight: 700; margin: 2px 0 8px; }
.nq-tools { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 10px; }
#configContainer .nq-tools button, .nq-tools button { margin: 0 !important; }
`;
const NQ_HTML = `
<div class="switch-container" style="margin-top: 8px;">
    <label class="switch"><input type="checkbox" id="nqToggle" onchange="nqToggle()"><span class="slider slider-purple"></span></label>
    <span class="switch-label" style="color: var(--lbl-purple); font-weight: bold;">指名する人を、順番に決めておく</span>
</div>
<div id="nqPanel" class="nominate-exclude-panel" hidden>
    <div class="nominate-exclude-help">上の人から順に、指名で当たります。順番が終わると、ふだんどおりのランダムに戻ります。順番を使っていることは、指名の画面には出ません。</div>
    <div id="nqList" class="nq-list"></div>
    <div id="nqCount" class="nq-count"></div>
    <div class="nominate-exclude-help">名前を押すと、順番の最後に入ります</div>
    <div id="nqPicker" class="nq-picker"></div>
    <div class="nq-tools">
        <button type="button" id="nqAddAllBtn" onclick="nqAddAll()" class="btn-secondary">全員を名簿の順に入れる</button>
        <button type="button" id="nqShuffleBtn" onclick="nqShuffle()" class="btn-secondary">順番をばらばらにする</button>
        <button type="button" id="nqClearBtn" onclick="nqClear()" class="btn-secondary">順番をからにする</button>
    </div>
</div>`;

SekigaeApp.registerPlugin({
    id: "nomination-queue",
    name: "指名の順番リスト",
    version: "1.0",
    description: "指名する人を、あらかじめ順番に決めておけます。「次を指名する！」を押すたびに、上の人から当たります。",
    backupKeys: [NQ_KEY],
    searchWords: "指名 順番 事前 決める 予約 あらかじめ 順に 順番に当てる リスト 次は誰",
    mount(app) {
        const st = document.createElement("style");
        st.id = "nqStyle";
        st.textContent = NQ_CSS;
        document.head.appendChild(st);
        app.insertInto("settings-nominate", NQ_HTML);
        document.addEventListener("click", nqClick);
        // 指名する人を選ぶところ（ほかのプラグインが包んだあとの関数を、さらに包みます）
        const prevPick = window.pickSeatWeightedByHistory;
        window.pickSeatWeightedByHistory = seats => nqPickWith(seats, prevPick);
        // 指名を取り消したら、順番リストも、もとに戻します
        const prevPush = window.pushNominationUndo;
        window.pushNominationUndo = function (kind, text, prevList, hist) {
            // ルーレットで当たった人が、順番リストにいたら、リストから外します
            if (kind === "roulette") {
                const cur = nqState();
                if (cur.on && SekigaeApp.isEnabled("nomination-queue") && cur.list.includes(text)) {
                    nqPendingPrev = cur.list.slice();
                    nqSave({ on: cur.on, list: cur.list.filter(t => t !== text) });
                    setTimeout(nqRender, 0);
                }
            }
            prevPush.apply(this, arguments);
            if (nqPendingPrev && nominationUndoStack.length) nominationUndoStack[nominationUndoStack.length - 1].nqPrev = nqPendingPrev;
            nqPendingPrev = null;
        };
        const prevUndo = window.undoLastNomination;
        window.undoLastNomination = function () {
            const before = nominationUndoStack.length;
            const top = nominationUndoStack[before - 1];
            const r = prevUndo.apply(this, arguments);
            if (top && top.nqPrev && nominationUndoStack.length < before) {
                const s = nqState();
                nqSave({ on: s.on, list: top.nqPrev });
                nqRender();
            }
            return r;
        };
        nqRender();
    },
    afterRender() { nqRender(); }
});
