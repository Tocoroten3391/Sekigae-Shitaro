// ==========================================
// 座席の付箋メモプラグイン：生徒ごとに付箋メモを付けて、座席表に小さく出します。席替えをしても、付箋は生徒についていきます
// このファイルを index.html から外すと、付箋のボタンも、座席表の付箋も、まとめて消えます（書いたメモは、ブラウザに残ります）
// ==========================================
const STICKY_KEY = "seat_notes";        // { クラス名: { 生徒の目印: { t: メモ, c: 色 } } }
const STICKY_HIDE_KEY = "sticky_hidden"; // "1" なら、座席表の付箋を隠す
const STICKY_COLORS = [
    { id: "yellow", label: "黄" },
    { id: "pink", label: "ピンク" },
    { id: "blue", label: "青" },
    { id: "green", label: "緑" }
];
let stickyMode = false;      // 「付箋モード」：席を押すと、付箋を書く画面が開く
let stickyEditing = null;    // 書いている最中の { key, name }
let stickyColor = "yellow";

function stickyClassName() {
    try { return (typeof getSelectedPresetName === "function" && getSelectedPresetName()) || ""; } catch (e) { return ""; }
}
function stickyLoadAll() {
    try { const v = JSON.parse(lsGet(STICKY_KEY, "{}")); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
}
function stickyNotes() { return stickyLoadAll()[stickyClassName()] || {}; }
function stickySaveNotes(notes) {
    const all = stickyLoadAll();
    const cls = stickyClassName();
    if (Object.keys(notes).length) all[cls] = notes; else delete all[cls];
    lsSet(STICKY_KEY, JSON.stringify(all));
}
function stickyEsc(t) { return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function stickyNameOf(key) {
    // 目印から、画面に出す名前を探します（座席表にいない生徒は、目印をそのまま出します）
    const hit = (currentStudents || []).find(s => s && s.type === "STUDENT" && s.text && getCleanStudentKey(s.text) === key);
    if (hit) { const p = getSeatDisplayParts(hit.text); return (p.no ? p.no + "番 " : "") + (p.name || ""); }
    return key;
}

// ---- 座席表に付箋を出す（座席表を描き直すたびに、本体から呼ばれます）----
function stickyDecorate() {
    const notes = stickyNotes();
    document.querySelectorAll("#classroom .seat").forEach(el => {
        const old = el.querySelector(".seat-note");
        if (old) old.remove();
        const key = el.dataset.seatKey;
        const n = key ? notes[key] : null;
        if (!n || !n.t) return;
        const tag = document.createElement("span");
        tag.className = "seat-note sn-" + (n.c || "yellow");
        tag.textContent = n.t;
        tag.title = n.t + "（押すと、書き直せます）";
        tag.onclick = ev => { ev.stopPropagation(); stickyOpenEditor(el); };
        el.appendChild(tag);
    });
    stickyUpdateLabels();
}
function stickyUpdateLabels() {
    const m = $id("btnStickyMode");
    if (m) m.textContent = stickyMode ? "📝 付箋モードをやめる" : "付箋モードにする";
    const h = $id("btnStickyHide");
    if (h) h.textContent = document.body.classList.contains("sticky-hidden") ? "👁️ 付箋を出す" : "付箋を隠す";
    const bar = $id("stickyModeBar");
    if (bar) bar.style.display = stickyMode ? "flex" : "none";
}

// ---- 付箋モード・隠す ----
function toggleStickyMode() {
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return; }
    stickyMode = !stickyMode;
    document.body.classList.toggle("sticky-mode", stickyMode);
    if (stickyMode && document.body.classList.contains("sticky-hidden")) toggleStickyHide(true);
    stickyUpdateLabels();
    if (stickyMode) showToast("付箋モードです。席を押すと、付箋を書けます。", "info");
}
function toggleStickyHide(silent) {
    const hide = !document.body.classList.contains("sticky-hidden");
    document.body.classList.toggle("sticky-hidden", hide);
    lsSet(STICKY_HIDE_KEY, hide ? "1" : "0");
    stickyUpdateLabels();
    if (!silent) showToast(hide ? "座席表の付箋を隠しました。" : "座席表に付箋を出しました。", "success");
}

// ---- 付箋を書く画面 ----
function stickyOpenEditor(seatEl) {
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return; }
    const idx = parseInt(seatEl.dataset.seatIndex, 10);
    const seat = currentStudents && currentStudents[idx];
    if (!seat || seat.type !== "STUDENT" || !seat.text) return;
    const key = getCleanStudentKey(seat.text);
    if (!key) return;
    const p = getSeatDisplayParts(seat.text);
    stickyEditing = { key, name: (p.no ? p.no + "番 " : "") + (p.name || key) };
    stickyOpenEditorFor(key, stickyEditing.name);
}
function stickyOpenEditorFor(key, name) {
    stickyEditing = { key, name };
    const n = stickyNotes()[key];
    $id("stickyWho").textContent = name;
    $id("stickyText").value = n ? n.t : "";
    stickyPickColor(n && n.c ? n.c : "yellow");
    $id("stickyDeleteBtn").style.display = n ? "" : "none";
    stickyCountText();
    closeStickyList();
    $id("stickyModalOverlay").style.display = "flex";
    setTimeout(() => { const t = $id("stickyText"); if (t) t.focus(); }, 50);
}
function closeStickyEditor() {
    const o = $id("stickyModalOverlay");
    if (o) o.style.display = "none";
    stickyEditing = null;
}
function stickyPickColor(c) {
    stickyColor = c;
    document.querySelectorAll("#stickyColors .sticky-chip").forEach(b => b.classList.toggle("is-on", b.dataset.color === c));
}
function stickyCountText() {
    const t = $id("stickyText"), c = $id("stickyCount");
    if (t && c) c.textContent = `${t.value.length} / ${t.maxLength}`;
}
function saveStickyNote() {
    if (!stickyEditing) return;
    const text = $id("stickyText").value.replace(/\s+/g, " ").trim();
    const notes = stickyNotes();
    if (text) notes[stickyEditing.key] = { t: text, c: stickyColor };
    else delete notes[stickyEditing.key];
    stickySaveNotes(notes);
    closeStickyEditor();
    stickyDecorate();
    showToast(text ? "付箋を保存しました。" : "付箋を消しました。", "success");
}
function deleteStickyNote() {
    if (!stickyEditing) return;
    const notes = stickyNotes();
    delete notes[stickyEditing.key];
    stickySaveNotes(notes);
    closeStickyEditor();
    stickyDecorate();
    showToast("付箋を消しました。", "success");
}

// ---- 付箋の一覧 ----
function openStickyList() {
    renderStickyList();
    $id("stickyListOverlay").style.display = "flex";
}
function closeStickyList() {
    const o = $id("stickyListOverlay");
    if (o) o.style.display = "none";
}
function renderStickyList() {
    const body = $id("stickyListBody");
    const notes = stickyNotes();
    const keys = Object.keys(notes);
    const cls = stickyClassName();
    $id("stickyListClass").textContent = cls ? `クラス：${cls}` : "いまのクラス";
    if (!keys.length) { body.innerHTML = '<p class="config-note" data-keep="1">付箋は、まだありません。</p>'; $id("stickyClearAllBtn").style.display = "none"; return; }
    $id("stickyClearAllBtn").style.display = "";
    body.innerHTML = keys.map(k => {
        const n = notes[k];
        return `<div class="sticky-list-row"><span class="sticky-dot sn-${stickyEsc(n.c || "yellow")}"></span>` +
            `<span class="sticky-list-text"><b>${stickyEsc(stickyNameOf(k))}</b><br>${stickyEsc(n.t)}</span>` +
            `<button type="button" class="btn-secondary btn-compact" data-edit="${stickyEsc(k)}">✏️ 直す</button>` +
            `<button type="button" class="btn-delete-mini btn-compact" data-del="${stickyEsc(k)}">🗑️</button></div>`;
    }).join("");
    body.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => stickyOpenEditorFor(b.dataset.edit, stickyNameOf(b.dataset.edit)));
    body.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
        const nn = stickyNotes(); delete nn[b.dataset.del]; stickySaveNotes(nn); renderStickyList(); stickyDecorate();
    });
}
function clearAllStickyNotes() {
    if (!confirm("このクラスの付箋を、すべて消します。よろしいですか？")) return;
    stickySaveNotes({});
    renderStickyList();
    stickyDecorate();
    showToast("付箋を、すべて消しました。", "success");
}

const STICKY_HTML = `
<div id="stickyModalOverlay" class="modal-overlay" style="display: none;">
    <div class="modal-content" style="max-width: 420px; width: 95%;">
        <h4 style="color: #d97706;">📝 付箋メモ</h4>
        <p id="stickyWho" style="font-weight: bold; margin: -6px 0 10px; color: var(--text-main);"></p>
        <textarea id="stickyText" rows="3" maxlength="80" placeholder="例：前の席がいい、見えにくい、係の仕事あり" oninput="stickyCountText()" style="width: 100%; box-sizing: border-box;"></textarea>
        <div style="text-align: right; font-size: 11px; color: var(--text-sub); margin: 2px 0 10px;" id="stickyCount"></div>
        <label class="input-label">色：</label>
        <div id="stickyColors" class="sticky-colors">
            <button type="button" class="sticky-chip sn-yellow" data-color="yellow" onclick="stickyPickColor('yellow')">黄</button>
            <button type="button" class="sticky-chip sn-pink" data-color="pink" onclick="stickyPickColor('pink')">ピンク</button>
            <button type="button" class="sticky-chip sn-blue" data-color="blue" onclick="stickyPickColor('blue')">青</button>
            <button type="button" class="sticky-chip sn-green" data-color="green" onclick="stickyPickColor('green')">緑</button>
        </div>
        <p class="config-note" style="margin: 10px 0 0;">付箋は、席ではなく生徒についていきます。席替えをしても、そのまま動きます。</p>
        <div class="modal-btn-row">
            <button onclick="closeStickyEditor()" class="btn-secondary">キャンセル</button>
            <button id="stickyDeleteBtn" onclick="deleteStickyNote()" class="btn-delete">🗑️ 消す</button>
            <button onclick="saveStickyNote()" class="btn-save">保存</button>
        </div>
    </div>
</div>
<div id="stickyListOverlay" class="modal-overlay" style="display: none;">
    <div class="modal-content" style="max-width: 480px; width: 95%;">
        <h4 style="color: #d97706;">📝 付箋メモの一覧</h4>
        <p id="stickyListClass" class="config-note" style="margin: -6px 0 10px;"></p>
        <div id="stickyListBody" class="sticky-list"></div>
        <div class="modal-btn-row">
            <button id="stickyClearAllBtn" onclick="clearAllStickyNotes()" class="btn-delete">🗑️ すべて消す</button>
            <button onclick="closeStickyList()" class="btn-secondary">閉じる</button>
        </div>
    </div>
</div>`;

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "seatnote",
    name: "座席の付箋メモ",
    version: "1.0",
    description: "生徒ごとに、付箋メモを付けて、座席表に小さく出します。席替えをしても、付箋は生徒についていきます。",
    backupKeys: [STICKY_KEY, STICKY_HIDE_KEY],
    searchWords: "付箋 メモ 付箋メモ 配慮 ふせん",
    stubs: [],
    mount(app) {
        document.body.insertAdjacentHTML("beforeend", STICKY_HTML);
        const bar = '<div id="stickyModeBar" class="sticky-mode-bar" style="display: none;">📝 付箋モード：席を押すと、付箋を書けます<button type="button" onclick="toggleStickyMode()">やめる</button></div>';
        const room = $id("classroom");
        if (room) room.insertAdjacentHTML("beforebegin", bar);
        app.insertInto("settings-seatview",
            '<button type="button" onclick="closeConfigMenuIfOpen(); toggleStickyMode()" class="btn-secondary" id="btnStickyMode" style="margin-top: 10px;">付箋モードにする</button>' +
            '<button type="button" onclick="toggleStickyHide()" class="btn-secondary" id="btnStickyHide" style="margin-top: 10px;">付箋を隠す</button>' +
            '<button type="button" onclick="openStickyList()" class="btn-secondary" id="btnStickyList" style="margin-top: 10px;">付箋メモの一覧</button>');
        app.insertInto("guide-faq", "<li><strong>生徒に印を付けたい</strong>：設定の「座席の見え方」の「付箋モードにする」を押してから、席を押すと、付箋メモを書けます。付箋は、席ではなく生徒についていくので、席替えをしても動きます。みんなに見せるときは、「付箋を隠す」を押してください。</li>");
    },
    ready() {
        if (lsGet(STICKY_HIDE_KEY, "0") === "1") document.body.classList.add("sticky-hidden");
        const room = $id("classroom");
        // 付箋モードの間は、席を押したときに、座席の設定ではなく、付箋の画面を開きます
        if (room) room.addEventListener("click", ev => {
            if (!stickyMode) return;
            const seat = ev.target.closest && ev.target.closest(".seat");
            if (!seat || !seat.dataset.seatKey) return;
            ev.stopPropagation();
            ev.preventDefault();
            stickyOpenEditor(seat);
        }, true);
        stickyDecorate();
    },
    afterRender() { stickyDecorate(); }
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
        const a = $id("stickyModalOverlay"), l = $id("stickyListOverlay");
        if (a && a.style.display !== "none") closeStickyEditor();
        else if (l && l.style.display !== "none") closeStickyList();
    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
        const a = $id("stickyModalOverlay");
        if (a && a.style.display !== "none") { e.preventDefault(); saveStickyNote(); }
    }
});
