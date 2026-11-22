// ==========================================
// 座席の希望・配慮メモプラグイン：生徒ごとに、「前の席がいい」「窓側は避けたい」などの希望と、配慮メモを書けます。
// 席替えのとき、希望をできるだけ守るように席を決めます。守れているかは、結果のチェックで、確かめられます
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります（書いたメモは、ブラウザに残ります）
// ==========================================
const WISH_KEY = "seat_wishes_v1";        // { クラス名: { 生徒の目印: { w: 希望, a: 避けたい, n: 近くがいい人の目印, t: メモ } } }
const WISH_BADGE_KEY = "seat_wish_badge";   // 座席表に、希望のしるしを出すか（はじめは、出しません）
const WISH_WINDOW_KEY = "seat_wish_window"; // 窓は、座席表の "left"（左側）か "right"（右側）
const WISH_ZONES = [
    { k: "front", label: "前の席" },
    { k: "back", label: "後ろの席" },
    { k: "window", label: "窓側" },
    { k: "aisle", label: "廊下側" }
];

let wishCache = { at: 0, map: null, ver: -1 };
let wishVer = 0;

function wishClassName() {
    try { return (typeof getSelectedPresetName === "function" && getSelectedPresetName()) || ""; } catch (e) { return ""; }
}

function wishLoadAll() {
    try { const v = JSON.parse(lsGet(WISH_KEY, "{}")); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
}

function wishEsc(t) { return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

function wishZoneLabel(k) { const z = WISH_ZONES.find(x => x.k === k); return z ? z.label : ""; }

function wishWindowSide() { return lsGet(WISH_WINDOW_KEY, "left") === "right" ? "right" : "left"; }

// 席替えの計算で何度も呼ばれるので、少しの間、覚えておきます
function wishMap() {
    const now = performance.now();
    if (wishCache.map && wishCache.ver === wishVer && now - wishCache.at < 400) return wishCache.map;
    const m = {};
    const mine = wishLoadAll()[wishClassName()] || {};
    Object.keys(mine).forEach(k => {
        const e = mine[k];
        if (e && (e.w || e.a || e.n)) m[k] = { w: e.w || "", a: e.a || "", n: e.n || "" };
    });
    wishCache = { at: now, map: m, ver: wishVer };
    return m;
}

function wishSaveClass(entries) {
    const all = wishLoadAll();
    const cls = wishClassName();
    if (Object.keys(entries).length) all[cls] = entries; else delete all[cls];
    lsSet(WISH_KEY, JSON.stringify(all));
    wishVer++;
}

// 席の位置（idx）が、どの場所にあたるか
function wishZonesOf(idx, cols, rows, winSide) {
    const r = Math.floor(idx / cols), c = idx % cols;
    const band = Math.max(1, Math.round(rows / 3));
    const zs = [];
    if (r < band) zs.push("front");
    if (r >= rows - band) zs.push("back");
    const leftEdge = c === 0, rightEdge = c === cols - 1;
    if (winSide === "left" ? leftEdge : rightEdge) zs.push("window");
    if (winSide === "left" ? rightEdge : leftEdge) zs.push("aisle");
    return zs;
}

// 2つの席が、となり合っているか（ななめも含みます）
function wishAdjacent(i, j, cols) {
    if (i === j) return false;
    return Math.abs(Math.floor(i / cols) - Math.floor(j / cols)) <= 1 && Math.abs((i % cols) - (j % cols)) <= 1;
}

// 席替えの計算から呼ばれます（shuffle-engine.js）
function wishActive() {
    if (!SekigaeApp.isEnabled("seat-wishes")) return false;
    return Object.keys(wishMap()).filter(k => k !== "__near").length > 0;
}

function wishHasNear(map) {
    if (map.__near === undefined) { map.__near = Object.keys(map).some(k => k !== "__near" && map[k].n); }
    return map.__near;
}

// 今の配置で、希望に合っていない度合い（整数）。席を指定している人は、動かせないので数えません
function wishPenalty(seats, cols) {
    const map = wishMap();
    const total = (seats || []).length, rows = Math.max(1, Math.ceil(total / cols));
    const win = wishWindowSide();
    let pen = 0;
    let pos = null; // 「近くがいい人」がいる時だけ、全員の席の位置を調べます
    const hasNear = wishHasNear(map);
    if (hasNear) {
        pos = {};
        (seats || []).forEach((seat, idx) => { if (seat && seat.type === "STUDENT" && seat.text) pos[getCleanStudentKey(seat.text)] = idx; });
    }
    (seats || []).forEach((seat, idx) => {
        if (!seat || seat.type !== "STUDENT" || !seat.text) return;
        const fixed = seat.isFixed || seat.fixedType !== "none";
        const key = getCleanStudentKey(seat.text);
        const w = map[key];
        if (!w) return;
        if (w.n && pos && pos[w.n] !== undefined) {
            const tSeat = seats[pos[w.n]];
            const tFixed = tSeat && (tSeat.isFixed || tSeat.fixedType !== "none");
            if (!(fixed && tFixed) && !wishAdjacent(idx, pos[w.n], cols)) pen += 2;
        }
        if (fixed) return;
        const zs = wishZonesOf(idx, cols, rows, win);
        if (w.w && !zs.includes(w.w)) pen += 2;
        if (w.a && zs.includes(w.a)) pen += 2;
    });
    return pen;
}

// 結果のチェックに、希望が守れているかを足します（seatcheck.js から呼ばれます）
function wishAddToReport(add, posOf, cols, rows) {
    const mineAll = wishLoadAll()[wishClassName()] || {};
    const keys = Object.keys(mineAll).filter(k => posOf[k] !== undefined && (mineAll[k].w || mineAll[k].a || mineAll[k].n || mineAll[k].t));
    if (keys.length === 0) { add("info", "座席の希望・配慮メモ：登録されていません", []); return; }
    const win = wishWindowSide();
    const ng = [], notes = [];
    let counted = 0;
    keys.forEach(k => {
        const e = mineAll[k], idx = posOf[k];
        const label = getSeatLabel(idx, cols);
        const zs = wishZonesOf(idx, cols, rows, win);
        if (e.w || e.a || e.n) {
            counted++;
            if (e.n && posOf[e.n] !== undefined && !wishAdjacent(idx, posOf[e.n], cols)) ng.push(k + "　" + e.n + "さんの近くを希望　いまは " + label + " と " + getSeatLabel(posOf[e.n], cols));
            if (e.w && !zs.includes(e.w)) ng.push(k + "　" + wishZoneLabel(e.w) + "を希望　いまは " + label);
            if (e.a && zs.includes(e.a)) ng.push(k + "　" + wishZoneLabel(e.a) + "は避けたい　いまは " + label);
        }
        if (e.t) notes.push(k + "　" + label + "　" + e.t);
    });
    if (counted > 0) {
        if (ng.length > 0) add("warn", "座席の希望を守れていない人がいます", ng, "もう一度席替えすると、守れることがあります。席を指定している人や、ほかの条件を優先した場合は、守れないことがあります。");
        else add("ok", "座席の希望は、" + counted + "人すべて守れています", []);
    }
    if (notes.length > 0) add("info", "配慮メモのある人（" + notes.length + "人）", notes);
}

// ---- 座席表に、希望のしるしを出す（はじめは、出しません。生徒に見える画面なので、出すかどうかを選べます）----
function wishDecorate() {
    const on = SekigaeApp.isEnabled("seat-wishes") && lsGet(WISH_BADGE_KEY, "0") === "1";
    const mine = on ? (wishLoadAll()[wishClassName()] || {}) : {};
    document.querySelectorAll("#classroom .seat").forEach(el => {
        const old = el.querySelector(".seat-wish");
        if (old) old.remove();
        const e = on && el.dataset.seatKey ? mine[el.dataset.seatKey] : null;
        if (!e || !(e.w || e.a || e.n || e.t)) return;
        const tag = document.createElement("span");
        tag.className = "seat-wish";
        tag.textContent = "🙋";
        tag.title = [e.w ? wishZoneLabel(e.w) + "を希望" : "", e.a ? wishZoneLabel(e.a) + "は避けたい" : "", e.n ? e.n + "さんの近くを希望" : "", e.t || ""].filter(Boolean).join("　");
        el.appendChild(tag);
    });
}

// ---- 入力の窓 ----
function wishStudentKeys() {
    const input = $id("studentInput");
    const raw = input ? splitRosterRaw(input.value) : [];
    const seen = new Set(), out = [];
    raw.forEach(r => {
        const k = getCleanStudentKey(r.trim());
        if (k && !seen.has(k)) { seen.add(k); out.push(k); }
    });
    return out;
}

function wishSelectHtml(cls, key, value) {
    return '<select class="' + cls + '" data-key="' + wishEsc(key) + '" aria-label="' + wishEsc(key) + '">' +
        '<option value="">なし</option>' + WISH_ZONES.map(z => '<option value="' + z.k + '"' + (z.k === value ? " selected" : "") + ">" + z.label + "</option>").join("") + "</select>";
}

// 名簿の中で、同じ名前になっている人（名前は、同じ希望が当てはまります）
function wishDuplicateNames() {
    const input = $id("studentInput");
    const count = {};
    (input ? splitRosterRaw(input.value) : []).forEach(r => { const k = getCleanStudentKey(r.trim()); if (k) count[k] = (count[k] || 0) + 1; });
    return Object.keys(count).filter(k => count[k] > 1);
}

function wishNearSelectHtml(self, keys, value) {
    return '<select class="wish-near" aria-label="' + wishEsc(self) + 'の近くがいい人"><option value="">なし</option>' +
        keys.filter(k => k !== self).map(k => '<option value="' + wishEsc(k) + '"' + (k === value ? " selected" : "") + ">" + wishEsc(k) + "</option>").join("") + "</select>";
}

function wishRenderRows() {
    const box = $id("wishRows");
    if (!box) return;
    const keys = wishStudentKeys();
    const mine = wishLoadAll()[wishClassName()] || {};
    const dup = wishDuplicateNames();
    const dupNote = $id("wishDupNote");
    if (dupNote) { dupNote.hidden = dup.length === 0; dupNote.textContent = dup.length ? "同じ名前の人がいます：" + dup.join("、") + "。同じ名前の人には、同じ希望が当てはまります。" : ""; }
    if (keys.length === 0) { box.innerHTML = '<p class="wish-empty">名簿が、まだありません。先に名簿を用意してください。</p>'; wishRenderStale([]); return; }
    box.innerHTML = keys.map(k => {
        const e = mine[k] || {};
        return '<div class="wish-row" data-key="' + wishEsc(k) + '">' +
            '<div class="wish-name">' + wishEsc(k) + "</div>" +
            '<label class="wish-cell"><span>希望</span>' + wishSelectHtml("wish-want", k, e.w || "") + "</label>" +
            '<label class="wish-cell"><span>避けたい</span>' + wishSelectHtml("wish-avoid", k, e.a || "") + "</label>" +
            '<label class="wish-cell wish-wide"><span>近くがいい人</span>' + wishNearSelectHtml(k, keys, e.n || "") + "</label>" +
            '<input type="text" class="wish-note" maxlength="40" placeholder="配慮メモ　例：視力が弱いので前" value="' + wishEsc(e.t || "") + '" aria-label="' + wishEsc(k) + 'の配慮メモ">' +
            "</div>";
    }).join("");
    wishRenderStale(keys);
}

// 名簿にいない人の分（名前を変えた人や、転校した人の分）を、見つけて、消せるようにします
function wishRenderStale(keys) {
    const box = $id("wishStale");
    if (!box) return;
    const mine = wishLoadAll()[wishClassName()] || {};
    const shown = new Set(keys);
    const stale = Object.keys(mine).filter(k => !shown.has(k));
    box.hidden = stale.length === 0;
    box.innerHTML = stale.length ? '<div class="wish-stale-title">名簿にいない人の分</div>' + stale.map(k => '<div class="wish-stale-row"><span>' + wishEsc(k) + "　" + wishEsc([mine[k].w ? wishZoneLabel(mine[k].w) + "を希望" : "", mine[k].a ? wishZoneLabel(mine[k].a) + "は避けたい" : "", mine[k].n ? mine[k].n + "さんの近く" : "", mine[k].t || ""].filter(Boolean).join("、")) + '</span><button type="button" class="btn-secondary wish-del" data-key="' + wishEsc(k) + '">消す</button></div>').join("") : "";
    box.querySelectorAll(".wish-del").forEach(b => { b.onclick = () => wishDeleteStale(b.getAttribute("data-key")); });
}

function wishDeleteStale(key) {
    const entries = Object.assign({}, wishLoadAll()[wishClassName()] || {});
    delete entries[key];
    wishSaveClass(entries);
    wishRenderStale(wishStudentKeys());
    showToast(key + "さんの分を、消しました。", "success");
}

function openWishModal() {
    const ov = $id("wishModalOverlay");
    if (!ov) return;
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return; }
    const sel = $id("wishWindowSide");
    if (sel) sel.value = wishWindowSide();
    const bt = $id("wishBadgeToggle");
    if (bt) bt.checked = lsGet(WISH_BADGE_KEY, "0") === "1";
    wishRenderRows();
    ov.style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeWishModal() {
    const ov = $id("wishModalOverlay");
    if (ov) ov.style.display = "none";
    document.body.style.overflow = "";
}

function saveWishModal() {
    const entries = {};
    const old = wishLoadAll()[wishClassName()] || {};
    // 名簿にいない人の分は、そのまま残します（名簿を一時的に変えただけで、消えないように）
    const shown = new Set(wishStudentKeys());
    Object.keys(old).forEach(k => { if (!shown.has(k)) entries[k] = old[k]; });
    document.querySelectorAll("#wishRows .wish-row").forEach(row => {
        const k = row.getAttribute("data-key");
        const w = row.querySelector(".wish-want").value, a = row.querySelector(".wish-avoid").value;
        const n = row.querySelector(".wish-near").value;
        const t = row.querySelector(".wish-note").value.trim();
        if (w || a || n || t) entries[k] = { w: w, a: a, n: n, t: t };
    });
    const side = $id("wishWindowSide");
    if (side) lsSet(WISH_WINDOW_KEY, side.value === "right" ? "right" : "left");
    const badge = $id("wishBadgeToggle");
    if (badge) lsSet(WISH_BADGE_KEY, badge.checked ? "1" : "0");
    wishSaveClass(entries);
    wishDecorate();
    if (typeof updateSeatCheckButton === "function") updateSeatCheckButton();
    closeWishModal();
    const n = Object.values(entries).filter(e => e.w || e.a || e.n).length;
    showToast("座席の希望を保存しました。" + (n ? "次の席替えから、" + n + "人分を、守るようにします。" : ""), "success");
}

function clearWishAll() {
    if (!confirm("このクラスの、座席の希望と配慮メモを、すべて消します。よろしいですか？")) return;
    wishSaveClass({});
    wishRenderRows();
    wishDecorate();
    if (typeof updateSeatCheckButton === "function") updateSeatCheckButton();
    showToast("希望と配慮メモを、すべて消しました。", "success");
}

const WISH_CSS = `
#wishRows { max-height: 52vh; overflow-y: auto; border: 1px solid var(--seat-border, #cbd5e1); border-radius: 10px; margin: 10px 0; }
.wish-row { display: grid; grid-template-columns: minmax(70px, 1fr) 1.2fr 1.2fr; gap: 6px 8px; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--seat-border, #e2e8f0); }
.wish-row:last-child { border-bottom: none; }
.wish-name { font-weight: 700; word-break: break-all; }
.wish-cell { display: flex; flex-direction: column; gap: 2px; font-size: 11px; opacity: 0.9; }
.wish-cell span { font-weight: 700; }
.wish-row select, .wish-row input.wish-note { width: 100%; min-width: 0; box-sizing: border-box; margin: 0; }
.wish-row input.wish-note, .wish-row .wish-wide { grid-column: 1 / -1; }
.wish-dup { margin: 8px 0 0; padding: 6px 10px; border-radius: 8px; background: var(--uis-n-bg, #fef3c7); color: var(--uis-n-fg, #92400e); font-size: 12px; }
.wish-stale { margin: 0 0 10px; padding: 8px 10px; border: 1px dashed var(--seat-border, #cbd5e1); border-radius: 10px; font-size: 13px; }
.wish-stale[hidden], .wish-dup[hidden] { display: none; }
.wish-stale-title { font-weight: 700; margin-bottom: 6px; }
.wish-stale-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 3px 0; }
.modal-content .wish-stale-row button.wish-del { width: auto; height: 30px; padding: 0 12px; margin: 0; font-size: 12px; }
.wish-badge-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; font-size: 13px; }
#classroom .seat .seat-wish { position: absolute; right: 3px; bottom: 2px; font-size: 14px; line-height: 1; z-index: 2; pointer-events: auto; cursor: default; }
.wish-empty { padding: 16px; text-align: center; opacity: 0.75; }
.wish-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.wish-top select { flex: 1 1 140px; min-width: 0; }
.modal-content .wish-top-label { font-weight: 700; font-size: 14px; }`;

const WISH_HTML = `
<div data-plugin="seat-wishes" id="wishModalOverlay" class="modal-overlay" style="display: none;">
    <div class="modal-content" style="max-width: 640px; width: 95%;">
        <h4 style="color: var(--lbl-green);">座席の希望・配慮メモ</h4>
        <p style="font-size: 12px; color: var(--text-sub); margin: -8px 0 12px; line-height: 1.6;">「前の席がいい」「窓側は避けたい」などを選ぶと、席替えのときに、できるだけ守ります。条件が多いと、守れないこともあります。守れているかは、「ほかの操作」の「結果のチェック」で確かめられます。</p>
        <div class="wish-top">
            <label for="wishWindowSide" class="wish-top-label">窓は、座席表の</label>
            <select id="wishWindowSide"><option value="left">左側</option><option value="right">右側</option></select>
        </div>
        <div class="wish-badge-row"><span>席に、希望のしるしを出す<span id="wishBadgeInfoSlot"></span></span><label class="switch"><input type="checkbox" id="wishBadgeToggle"><span class="slider"></span></label></div>
        <div id="wishDupNote" class="wish-dup" hidden></div>
        <div id="wishRows"></div>
        <div id="wishStale" class="wish-stale" hidden></div>
        <div class="modal-btn-row">
            <button type="button" class="btn-secondary" onclick="clearWishAll()">すべて消す</button>
            <button type="button" class="btn-secondary" onclick="closeWishModal()">キャンセル</button>
            <button type="button" class="btn-save" onclick="saveWishModal()">✅ 保存</button>
        </div>
    </div>
</div>`;

SekigaeApp.registerPlugin({
    id: "seat-wishes",
    name: "座席の希望・配慮メモ",
    version: "1.3",
    description: "生徒ごとに、前の席・後ろの席・窓側・廊下側の希望と、配慮メモを書けます。席替えで、希望をできるだけ守ります。",
    backupKeys: [WISH_KEY, WISH_WINDOW_KEY, WISH_BADGE_KEY],
    suggests: ["seatcheck"],
    searchWords: "希望 配慮 前の席 後ろの席 窓側 廊下側 避けたい 視力 メモ 座席 お願い 事情",
    afterRender() { wishDecorate(); },
    mount(app) {
        app.insertInto("guide-faq", "<li data-plugin=\"seat-wishes\"><strong>「前の席がいい」など、希望を守りたい</strong>：設定の「席替えのルール」の「座席の希望・配慮メモ」に書くと、席替えで、できるだけ守ります。守れているかは、「ほかの操作」の「結果のチェック」で確かめられます。</li>");
        const st = document.createElement("style");
        st.id = "seatWishesStyle";
        st.textContent = WISH_CSS;
        document.head.appendChild(st);
        document.body.insertAdjacentHTML("beforeend", WISH_HTML);
        const bslot = $id("wishBadgeInfoSlot");
        if (bslot && typeof makeInfoTip === "function") bslot.appendChild(makeInfoTip("座席表の画面は、生徒にも見えます。しるしは、小さな絵だけで、中身は出ません（マウスを合わせた時だけ、先生に見えます）。見せたくない時は、オフのままにしてください。"));
        app.insertInto("settings-rules", '<button type="button" onclick="openWishModal()" class="btn-secondary" id="btnWishModal" style="margin-top: 10px;" data-plugin="seat-wishes">座席の希望・配慮メモ</button>');
    }
});
