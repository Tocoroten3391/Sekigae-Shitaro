// ==========================================
// 教室の配置プラグイン：黒板、電子黒板、教卓、ドア、窓、通り道などを、座席表のまわりに置いて、本物の教室のように再現します。
// 置いた物は、ドラッグで動かせて、大きさも変えられます。クラスごとに、ブラウザへ保存します
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります（置いた物は、ブラウザに残ります）
// ==========================================
const ROOM_KEY = "room_layout";        // { クラス名: [ { id, k: 種類, x, y, w, h（座席表の枠に対する%）, t: 名前, top: 座席の手前に出すか } ] }
const ROOM_SHOW_KEY = "room_show";     // "0" なら、教室の物を隠す

// 置ける物。w・h は、置くときの大きさ（画面のピクセル）
const ROOM_KINDS = [
    { k: "blackboard", icon: "🟩", name: "黒板", w: 360, h: 46 },
    { k: "eboard", icon: "🖥️", name: "電子黒板", w: 240, h: 46 },
    { k: "desk", icon: "🧑‍🏫", name: "教卓", w: 120, h: 62 },
    { k: "door", icon: "🚪", name: "ドア", w: 26, h: 80 },
    { k: "window", icon: "🪟", name: "窓", w: 22, h: 220 },
    { k: "aisle", icon: "⇅", name: "通り道", w: 44, h: 260, top: true },
    { k: "locker", icon: "🗄️", name: "ロッカー", w: 54, h: 130 },
    { k: "clean", icon: "🧹", name: "そうじ用具", w: 48, h: 70 },
    { k: "shelf", icon: "📚", name: "本棚", w: 64, h: 130 },
    { k: "tv", icon: "📺", name: "テレビ", w: 90, h: 50 },
    { k: "sink", icon: "🚰", name: "手洗い場", w: 80, h: 44 },
    { k: "piano", icon: "🎹", name: "ピアノ", w: 100, h: 56 },
    { k: "pillar", icon: "⬛", name: "柱", w: 38, h: 38 },
    { k: "text", icon: "🏷️", name: "文字", w: 120, h: 34 }
];
let roomEditing = false;       // 配置の編集中か
let roomSelId = null;          // 選んでいる物
let roomDrag = null;           // ドラッグ中の { mode: "move" | "size", id, sx, sy, o }

function roomKind(k) { return ROOM_KINDS.find(x => x.k === k) || ROOM_KINDS[ROOM_KINDS.length - 1]; }
function roomClassName() {
    try { return (typeof getSelectedPresetName === "function" && getSelectedPresetName()) || ""; } catch (e) { return ""; }
}
function roomLoadAll() {
    try { const v = JSON.parse(lsGet(ROOM_KEY, "{}")); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
}
function roomObjs() {
    const list = roomLoadAll()[roomClassName()];
    return Array.isArray(list) ? list.filter(o => o && o.id && typeof o.x === "number" && typeof o.y === "number") : [];
}
function roomSave(list) {
    const all = roomLoadAll();
    const cls = roomClassName();
    if (list.length) all[cls] = list; else delete all[cls];
    lsSet(ROOM_KEY, JSON.stringify(all));
}
function roomShown() { return lsGet(ROOM_SHOW_KEY, "1") !== "0"; }
function roomEsc(t) { return String(t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])); }
function roomNewId() { return "r" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
function roomClamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// 座席表の枠（#classroom）の大きさ（画面のピクセル）。拡大・縮小しても、割合で測るので、ずれません
function roomBox() {
    const c = $id("classroom");
    return c ? c.getBoundingClientRect() : null;
}
// 座席だけがある範囲を、枠に対する%で返します（ひな形を置く時の目安）
function roomSeatArea() {
    const c = $id("classroom"), box = roomBox();
    if (!c || !box || !box.width || !box.height) return null;
    const seats = c.querySelectorAll(".seat");
    if (!seats.length) return null;
    let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity;
    seats.forEach(s => { const q = s.getBoundingClientRect(); l = Math.min(l, q.left); t = Math.min(t, q.top); r = Math.max(r, q.right); b = Math.max(b, q.bottom); });
    return { l: (l - box.left) / box.width * 100, t: (t - box.top) / box.height * 100, r: (r - box.left) / box.width * 100, b: (b - box.top) / box.height * 100 };
}

// ---- 描く ----
function roomRender() {
    const c = $id("classroom");
    if (!c) return;
    let layer = $id("roomLayer");
    if (layer && layer.parentNode !== c) layer = null;
    if (!layer) {
        layer = document.createElement("div");
        layer.id = "roomLayer";
        layer.className = "room-layer";
        c.insertBefore(layer, c.firstChild);
    }
    const objs = roomObjs();
    const show = roomShown() || roomEditing;
    document.body.classList.toggle("room-has-objects", show && objs.length > 0);
    document.body.classList.toggle("room-edit", roomEditing);
    layer.innerHTML = "";
    if (!show || c.querySelector(".welcome-card")) { roomFitMargins([]); roomUpdatePanel(); roomUpdateLabels(); return; }
    objs.forEach(o => {
        const kd = roomKind(o.k);
        const el = document.createElement("div");
        el.className = "room-obj room-k-" + kd.k + (o.top || kd.top ? " room-top" : "") + (o.id === roomSelId && roomEditing ? " room-sel" : "");
        el.dataset.id = o.id;
        el.style.left = o.x + "%"; el.style.top = o.y + "%"; el.style.width = o.w + "%"; el.style.height = o.h + "%";
        const label = o.t !== undefined && o.t !== null ? o.t : kd.name;
        el.innerHTML = `<span class="room-label">${roomEsc(label)}</span>` + (roomEditing ? '<i class="room-grip" data-grip="1"></i>' : "");
        layer.appendChild(el);
    });
    // 上下の余白が変わったら、座席が画面に収まるよう、大きさを測り直します（2回までです）
    if (roomFitMargins(objs) && typeof fitClassroomToScreen === "function") { fitClassroomToScreen(); roomFitMargins(objs); }
    roomUpdatePanel();
    roomUpdateLabels();
}
// 座席表の上や下にはみ出した物のために、上下の余白を広げます
function roomFitMargins(objs) {
    const c = $id("classroom"), box = roomBox();
    if (!c || !box || !box.height) return;
    const zoom = parseFloat(getComputedStyle(c).getPropertyValue("--zoom-level")) || 1;
    const H = box.height / zoom;
    let minY = 0, maxY = 100;
    objs.forEach(o => { minY = Math.min(minY, o.y); maxY = Math.max(maxY, o.y + o.h); });
    const mt = minY < 0 ? Math.max(40, Math.ceil(-minY / 100 * H) + 24) + "px" : "";
    const mb = maxY > 100 ? Math.max(40, Math.ceil((maxY - 100) / 100 * H) + 24) + "px" : "";
    const changed = c.style.marginTop !== mt || c.style.marginBottom !== mb;
    c.style.marginTop = mt;
    c.style.marginBottom = mb;
    return changed;
}

// ---- 物を置く・直す ----
function roomAdd(k, at) {
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return null; }
    const kd = roomKind(k), box = roomBox();
    if (!box || !box.width) return null;
    const w = kd.w / box.width * 100, h = kd.h / box.height * 100;
    const o = { id: roomNewId(), k: kd.k, x: at ? at.x : roomClamp(50 - w / 2, 0, 100 - w), y: at ? at.y : roomClamp(-h - 2, -60, 0), w: w, h: h };
    if (kd.k === "text") o.t = "ラベル";
    const list = roomObjs();
    list.push(o);
    roomSave(list);
    roomSelId = o.id;
    roomRender();
    return o;
}
function roomPatch(id, patch) {
    const list = roomObjs();
    const o = list.find(x => x.id === id);
    if (!o) return;
    Object.assign(o, patch);
    roomSave(list);
}
function roomSelected() { return roomObjs().find(o => o.id === roomSelId) || null; }
function roomDeleteSelected() {
    if (!roomSelId) return;
    roomSave(roomObjs().filter(o => o.id !== roomSelId));
    roomSelId = null;
    roomRender();
}
function roomDuplicateSelected() {
    const o = roomSelected();
    if (!o) return;
    const copy = Object.assign({}, o, { id: roomNewId(), x: roomClamp(o.x + 3, -10, 100), y: roomClamp(o.y + 3, -60, 150) });
    const list = roomObjs(); list.push(copy); roomSave(list);
    roomSelId = copy.id;
    roomRender();
}
// 縦横を入れ替える（真ん中は、そのままにします）
function roomSwapSelected() {
    const o = roomSelected(), box = roomBox();
    if (!o || !box) return;
    const wpx = o.w / 100 * box.width, hpx = o.h / 100 * box.height;
    const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
    const nw = hpx / box.width * 100, nh = wpx / box.height * 100;
    roomPatch(o.id, { w: nw, h: nh, x: cx - nw / 2, y: cy - nh / 2 });
    roomRender();
}
function roomToggleTopSelected() {
    const o = roomSelected();
    if (!o) return;
    roomPatch(o.id, { top: !(o.top !== undefined ? o.top : roomKind(o.k).top) });
    roomRender();
}
function roomRenameSelected(v) {
    const o = roomSelected();
    if (!o) return;
    roomPatch(o.id, { t: v.slice(0, 20) });
    const el = document.querySelector('#roomLayer .room-obj[data-id="' + o.id + '"] .room-label');
    if (el) el.textContent = v.slice(0, 20);
}
function roomClearAll() {
    if (!roomObjs().length) return;
    if (!confirm("このクラスの、教室の物を、全て消します。よろしいですか？")) return;
    roomSave([]);
    roomSelId = null;
    roomRender();
}

// ---- ひな形 ----
function roomApplyTemplate(name) {
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return; }
    const a = roomSeatArea(), box = roomBox();
    if (!a || !box) { showToast("座席表がありません。名簿を入れて、席替えをしてください。", "error"); return; }
    const pw = px => px / box.width * 100, ph = px => px / box.height * 100;
    const aw = a.r - a.l, mid = (a.l + a.r) / 2;
    const add = (k, x, y, w, h, t, top) => {
        const o = { id: roomNewId(), k: k, x: x, y: y, w: w, h: h };
        if (t !== undefined) o.t = t;
        if (top) o.top = true;
        list.push(o);
    };
    const list = roomObjs();
    if (name === "board") {
        const w = Math.min(aw * 0.7, 62), h = ph(46);
        add("blackboard", mid - w / 2, a.t - h - ph(14), w, h);
        add("desk", Math.max(0.5, a.l - pw(132)), a.t, pw(120), ph(62));
    } else if (name === "eboard") {
        const w = Math.min(aw * 0.36, 34), h = ph(46);
        add("eboard", mid - w - 1, a.t - h - ph(14), w, h);
        add("blackboard", mid + 1, a.t - h - ph(14), w, h);
        add("desk", Math.min(99.5 - pw(120), a.r + pw(12)), a.t, pw(120), ph(62));
    } else if (name === "doorwindow") {
        add("door", a.l - pw(44), a.t, pw(26), ph(80), "前のドア");
        add("door", a.l - pw(44), a.b - ph(80), pw(26), ph(80), "後ろのドア");
        add("window", a.r + pw(14), a.t, pw(22), a.b - a.t);
    } else if (name === "aisle") {
        // 真ん中あたりの、列と列のあいだに、縦の通り道を置きます（座席の間隔に合わせます）
        const cols = (typeof getGridCols === "function" ? getGridCols() : 6) || 6;
        const left = Math.max(0, Math.floor(cols / 2) - 1);
        const seatEls = id => document.querySelector('#classroom .seat[data-seat-index="' + id + '"]');
        const sl = seatEls(left), sr = seatEls(left + 1);
        let x = mid - pw(10), w = pw(20);
        if (sl && sr) {
            const ql = sl.getBoundingClientRect(), qr = sr.getBoundingClientRect();
            const gap = Math.max(10, qr.left - ql.right);
            x = ((ql.right + qr.left) / 2 - box.left - gap / 2) / box.width * 100; w = pw(gap);
        }
        add("aisle", x, a.t - ph(6), w, a.b - a.t + ph(12), "通り道");
    }
    roomSave(list);
    roomSelId = null;
    roomRender();
    showToast("ひな形を置きました。ドラッグで、動かせます。", "success");
}

// ---- 編集 ----
function toggleRoomEdit() {
    if (typeof isAppLocked === "function" && isAppLocked() && !roomEditing) { showLockedToast(); return; }
    roomEditing = !roomEditing;
    if (typeof closePopMenus === "function") closePopMenus();
    if (!roomEditing) roomSelId = null;
    roomRender();
}
function toggleRoomShow() {
    lsSet(ROOM_SHOW_KEY, roomShown() ? "0" : "1");
    if (typeof closePopMenus === "function") closePopMenus();
    roomRender();
}
function roomUpdateLabels() {
    const s = $id("btnRoomShow");
    if (s) s.textContent = roomShown() ? "教室の物を隠す" : "🏫 教室の物を出す";
    const e = $id("btnRoomSettings");
    if (e) e.textContent = roomEditing ? "🏫 教室の配置を終える" : "教室の配置を直す";
}
function roomUpdatePanel() {
    const p = $id("roomPanel");
    if (!p) return;
    p.style.display = roomEditing ? "flex" : "none";
    if (!roomEditing) return;
    const o = roomSelected();
    const sel = $id("roomSelBox");
    sel.style.display = o ? "" : "none";
    if (o) {
        const kd = roomKind(o.k);
        $id("roomSelName").textContent = kd.icon + " " + kd.name;
        const inp = $id("roomNameInput");
        if (document.activeElement !== inp) inp.value = o.t !== undefined && o.t !== null ? o.t : kd.name;
    }
    $id("roomCount").textContent = roomObjs().length + "個を置いています";
}

// ドラッグ（動かす・大きさを変える）
function roomPointerDown(ev) {
    if (!roomEditing) return;
    const el = ev.target.closest && ev.target.closest(".room-obj");
    if (!el) return;
    const id = el.dataset.id;
    const o = roomObjs().find(x => x.id === id);
    if (!o) return;
    ev.preventDefault(); ev.stopPropagation();
    roomSelId = id;
    document.querySelectorAll("#roomLayer .room-obj").forEach(n => n.classList.toggle("room-sel", n.dataset.id === id));
    roomUpdatePanel();
    roomDrag = { mode: ev.target.dataset && ev.target.dataset.grip ? "size" : "move", id: id, sx: ev.clientX, sy: ev.clientY, o: Object.assign({}, o), el: el };
    try { el.setPointerCapture(ev.pointerId); } catch (e) { /* 何もしない */ }
}
function roomPointerMove(ev) {
    if (!roomDrag) return;
    const box = roomBox();
    if (!box || !box.width) return;
    const dx = (ev.clientX - roomDrag.sx) / box.width * 100, dy = (ev.clientY - roomDrag.sy) / box.height * 100;
    const o = roomDrag.o, el = roomDrag.el;
    if (roomDrag.mode === "move") {
        const x = roomClamp(o.x + dx, -2, 100 - o.w + 2), y = roomClamp(o.y + dy, -70, 170);
        el.style.left = x + "%"; el.style.top = y + "%";
        roomDrag.cur = { x: x, y: y };
    } else {
        const w = Math.max(1.5, o.w + dx), h = Math.max(2, o.h + dy);
        el.style.width = w + "%"; el.style.height = h + "%";
        roomDrag.cur = { w: w, h: h };
    }
}
function roomPointerUp() {
    if (!roomDrag) return;
    if (roomDrag.cur) roomPatch(roomDrag.id, roomDrag.cur);
    roomDrag = null;
    roomFitMargins(roomObjs());
}

const ROOM_HTML = `
<div id="roomPanel" class="room-panel" style="display: none;">
    <div class="room-panel-head">🏫 教室の配置<button type="button" class="room-done" onclick="toggleRoomEdit()">終える</button></div>
    <p class="room-help">置きたい物を押すと、座席表の上に出ます。ドラッグで動かして、右下の角で大きさを変えます。</p>
    <div class="room-kinds" id="roomKinds"></div>
    <div class="room-sub">ひな形</div>
    <div class="room-tpls">
        <button type="button" onclick="roomApplyTemplate('board')">黒板と教卓</button>
        <button type="button" onclick="roomApplyTemplate('eboard')">電子黒板つき</button>
        <button type="button" onclick="roomApplyTemplate('doorwindow')">ドアと窓</button>
        <button type="button" onclick="roomApplyTemplate('aisle')">通り道</button>
    </div>
    <div id="roomSelBox" style="display: none;">
        <div class="room-sub">選んでいる物：<b id="roomSelName"></b></div>
        <input type="text" id="roomNameInput" maxlength="20" placeholder="名前" oninput="roomRenameSelected(this.value)">
        <div class="room-tpls">
            <button type="button" onclick="roomSwapSelected()">縦横を入れ替える</button>
            <button type="button" onclick="roomToggleTopSelected()">席の手前と奥</button>
            <button type="button" onclick="roomDuplicateSelected()">同じ物を増やす</button>
            <button type="button" class="room-del" onclick="roomDeleteSelected()">🗑️ 消す</button>
        </div>
    </div>
    <div class="room-foot"><span id="roomCount"></span><button type="button" class="room-del" onclick="roomClearAll()">全て消す</button></div>
</div>`;

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "roomlayout",
    name: "教室の配置",
    version: "1.0",
    description: "黒板、電子黒板、教卓、ドア、窓、通り道などを、座席表のまわりに置いて、本物の教室のように再現します。ドラッグで動かせます。",
    backupKeys: [ROOM_KEY, ROOM_SHOW_KEY],
    searchWords: "教室 配置 黒板 電子黒板 教卓 ドア 窓 通り道 ロッカー レイアウト 再現",
    stubs: [],
    mount(app) {
        document.body.insertAdjacentHTML("beforeend", ROOM_HTML);
        $id("roomKinds").innerHTML = ROOM_KINDS.map(k => `<button type="button" onclick="roomAdd('${k.k}')"><span>${k.icon}</span>${k.name}</button>`).join("");
        app.insertInto("settings-seat",
            '<button type="button" onclick="if (!roomEditing) closeConfigMenuIfOpen(); toggleRoomEdit()" class="btn-secondary" id="btnRoomSettings" style="margin-top: 10px;">教室の配置を直す</button>' +
            '<button type="button" onclick="toggleRoomShow()" class="btn-secondary" id="btnRoomShow" style="margin-top: 10px;">教室の物を隠す</button>');
        app.insertInto("guide-faq", "<li><strong>本物の教室のように見せたい</strong>：設定の「座席のレイアウト」の「教室の配置を直す」を押すと、黒板、電子黒板、教卓、ドア、窓、通り道などを、座席表のまわりに置けます。ひな形から始めると、簡単です。座席を空席にすると、通り道を作れます。</li>");
    },
    ready() {
        document.addEventListener("pointerdown", roomPointerDown, true);
        document.addEventListener("pointermove", roomPointerMove);
        document.addEventListener("pointerup", roomPointerUp);
        document.addEventListener("pointercancel", roomPointerUp);
        roomRender();
    },
    afterRender() { roomRender(); }
});
document.addEventListener("keydown", e => {
    if (!roomEditing) return;
    const tag = (e.target && e.target.tagName) || "";
    if (e.key === "Escape") { toggleRoomEdit(); return; }
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); roomDeleteSelected(); return; }
    const o = roomSelected();
    if (!o) return;
    const step = e.shiftKey ? 2 : 0.5;
    const move = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (move) { e.preventDefault(); roomPatch(o.id, { x: o.x + move[0], y: o.y + move[1] }); roomRender(); }
});
