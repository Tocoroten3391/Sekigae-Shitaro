// ==========================================
// 席替えの条件セットプラグイン：席替えの条件（前の席を避ける・離す／近くに置く・優先順位など）に名前をつけて、
// いくつか保存しておき、ワンタップで切り替えられます。例：「ふだん用」「班活動用」「席を大きく変えたい時」
// このファイルを index.html から外すと、この機能は使えなくなります。席替えの条件そのものは、これまでどおり使えます
// ==========================================
const RSET_KEY = "seat_rule_sets_v1";   // [ { id, name, t: 保存した時刻, keys: [含めた設定], vals: { 設定名: 文字列／null }, sig: 内容の目印 } ]
const RSET_MAX = 20;
// 条件に入る設定（localStorage の名前）。pairs は、特定の生徒の組み合わせなので、含めるかどうかを選べます
const RSET_BASE_KEYS = ["avoid_same_seat", "avoid_neighbor", "avoid_depth", "condition_priority", "seat_fair_v1", "luck_use", "luck_window", "luck_threshold"];
const RSET_PAIR_KEYS = ["separation_pairs", "near_pairs"];

function rsetEsc(t) { return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function rsetRaw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function rsetJson(k, def) { try { const v = JSON.parse(rsetRaw(k)); return v === null || v === undefined ? def : v; } catch (e) { return def; } }

function rsetLoad() {
    const v = rsetJson(RSET_KEY, []);
    return Array.isArray(v) ? v.filter(s => s && typeof s.name === "string" && s.vals && typeof s.vals === "object").slice(0, RSET_MAX) : [];
}
function rsetSave(list) {
    try { localStorage.setItem(RSET_KEY, JSON.stringify(list)); return true; } catch (e) { showToast("条件セットを保存できませんでした。端末の空きが足りない可能性があります。", "error"); return false; }
}

// 設定ごとの「意味」だけを取り出す（未設定と、初期値のままの違いを、同じものとして比べるため）
function rsetCanon(k, raw) {
    switch (k) {
        case "avoid_same_seat": case "avoid_neighbor": return raw === "true" ? "1" : "0";
        case "avoid_depth": { const n = parseInt(raw, 10); return String(n >= 1 && n <= 9 ? n : 2); }
        case "condition_priority": return typeof CONDITION_PRIORITY_WEIGHTS !== "undefined" && CONDITION_PRIORITY_WEIGHTS[raw] ? raw : "separate";
        case "seat_fair_v1": {
            let v = null; try { v = JSON.parse(raw); } catch (e) { v = null; }
            v = v && typeof v === "object" ? v : {};
            return JSON.stringify([v.use === true, ["none", "left", "right"].includes(v.win) ? v.win : "none", ["all", "10", "5"].includes(v.period) ? v.period : "all", Array.isArray(v.fav) ? v.fav.slice().sort() : "d", Array.isArray(v.bad) ? v.bad.slice().sort() : "d"]);
        }
        case "luck_use": return raw === "1" ? "1" : "0";
        case "luck_window": return ["5", "10", "20", "40"].includes(raw) ? raw : "10";
        case "luck_threshold": return ["1", "2", "3"].includes(raw) ? raw : "2";
        case "separation_pairs": case "near_pairs": {
            let v = null; try { v = JSON.parse(raw); } catch (e) { v = null; }
            return JSON.stringify(Array.isArray(v) ? v : []);
        }
    }
    return String(raw);
}
function rsetSig(keys, vals) { return JSON.stringify(keys.map(k => [k, rsetCanon(k, vals[k] === undefined ? null : vals[k])])); }
function rsetCurrentVals(keys) { const o = {}; keys.forEach(k => { o[k] = rsetRaw(k); }); return o; }

// 設定の中身を、人が読める一行にする
function rsetSummary(set) {
    const g = k => rsetCanon(k, set.vals[k] === undefined ? null : set.vals[k]);
    const has = k => set.keys.includes(k);
    const parts = [];
    const avoid = [];
    if (g("avoid_same_seat") === "1") avoid.push("前と同じ席");
    if (g("avoid_neighbor") === "1") avoid.push("前と同じ隣");
    parts.push(avoid.length ? avoid.join("・") + "を避ける（" + g("avoid_depth") + "回分）" : "前の席は、避けない");
    parts.push("優先：" + ({ separate: "離す", near: "近くに置く", balance: "同じくらい" }[g("condition_priority")] || "離す"));
    if (JSON.parse(g("seat_fair_v1"))[0]) parts.push("席の公平性");
    if (g("luck_use") === "1") parts.push("運の貯金");
    if (has("separation_pairs") || has("near_pairs")) {
        const sp = has("separation_pairs") ? JSON.parse(g("separation_pairs")).length : 0;
        const np = has("near_pairs") ? JSON.parse(g("near_pairs")).length : 0;
        parts.push("離す " + sp + "組・近く " + np + "組");
    }
    return parts.join(" ／ ");
}

// ---- 画面に反映する（再読み込みなしで）
function rsetRefreshUi() {
    const call = (f) => { try { if (typeof window[f] === "function") window[f](); } catch (e) { /* 画面の更新に失敗しても、設定は反映されています */ } };
    call("loadAvoidSettings");
    const dep = $id("avoidDepthSelect");
    if (dep && rsetRaw("avoid_depth") === null && Array.from(dep.options).some(o => o.value === "2")) dep.value = "2";
    call("applyConditionPriorityUi");
    call("loadSeparationPairs");
    call("loadNearPairs");
    call("renderSeparationList");
    try { if (typeof fairCache !== "undefined") fairCache = null; } catch (e) { /* なし */ }
    try { if (typeof luckCache !== "undefined") luckCache = null; } catch (e) { /* なし */ }
}

function rsetApply(id) {
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return; }
    const set = rsetLoad().find(s => s.id === id);
    if (!set) return;
    set.keys.forEach(k => {
        try {
            const v = set.vals[k];
            if (v === null || v === undefined) localStorage.removeItem(k); else localStorage.setItem(k, v);
        } catch (e) { /* 何もしない */ }
    });
    rsetRefreshUi();
    rsetRender();
    showToast(`条件セット「${set.name}」に切り替えました。次の席替えから、使います。`, "success");
}

function rsetNewId() { return "rs" + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }

function rsetBodyEl(withPairs) {
    const wrap = document.createElement("div");
    const info = document.createElement("p");
    info.className = "preset-dialog-msg";
    info.textContent = "いまの条件：" + rsetSummary({ keys: RSET_BASE_KEYS.concat(RSET_PAIR_KEYS), vals: rsetCurrentVals(RSET_BASE_KEYS.concat(RSET_PAIR_KEYS)) });
    wrap.appendChild(info);
    return wrap;
}

// 新しく保存する
function rsetSaveNew() {
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return; }
    const list = rsetLoad();
    if (list.length >= RSET_MAX) { showToast(`条件セットは、${RSET_MAX}個までです。使わないものを消してください。`, "error"); return; }
    presetDialog({
        title: "いまの条件を、保存する",
        message: "いまの席替えの条件に、名前をつけて保存します。",
        bodyEl: rsetBodyEl(),
        input: { value: "", placeholder: "例：ふだん用", label: "条件セットの名前" },
        check: { label: "離す・近くに置く人の組み合わせも、入れる", checked: true },
        buttons: [
            { label: "キャンセル", value: "cancel", cls: "btn-secondary" },
            { label: "保存する", value: "ok", cls: "btn-connect is-primary", primary: true }
        ]
    }, (v, o) => {
        if (v !== "ok") return;
        const name = (o.text || "").slice(0, 30);
        if (!name) { showToast("名前を入れてください。", "error"); return; }
        const cur = rsetLoad();
        if (cur.some(s => s.name === name)) { showToast(`「${name}」という条件セットは、もうあります。上書きしたい時は、一覧の「上書き」を使ってください。`, "error"); return; }
        const keys = RSET_BASE_KEYS.concat(o.checked ? RSET_PAIR_KEYS : []);
        const vals = rsetCurrentVals(keys);
        cur.push({ id: rsetNewId(), name: name, t: Date.now(), keys: keys, vals: vals, sig: rsetSig(keys, vals) });
        if (rsetSave(cur)) { rsetRender(); showToast(`条件セット「${name}」を保存しました。`, "success"); }
    });
}

// いまの条件で、上書きする
function rsetOverwrite(id) {
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return; }
    const list = rsetLoad();
    const set = list.find(s => s.id === id);
    if (!set) return;
    presetDialog({
        title: `「${set.name}」を、上書きする`,
        message: "いまの席替えの条件で、この条件セットの中身を入れかえます。もとの中身には、戻せません。",
        bodyEl: rsetBodyEl(),
        check: { label: "離す・近くに置く人の組み合わせも、入れる", checked: set.keys.includes("separation_pairs") },
        buttons: [
            { label: "キャンセル", value: "cancel", cls: "btn-secondary" },
            { label: "上書きする", value: "ok", cls: "btn-connect is-primary", primary: true }
        ]
    }, (v, o) => {
        if (v !== "ok") return;
        const cur = rsetLoad();
        const s = cur.find(x => x.id === id);
        if (!s) return;
        s.keys = RSET_BASE_KEYS.concat(o.checked ? RSET_PAIR_KEYS : []);
        s.vals = rsetCurrentVals(s.keys);
        s.sig = rsetSig(s.keys, s.vals);
        s.t = Date.now();
        if (rsetSave(cur)) { rsetRender(); showToast(`条件セット「${s.name}」を上書きしました。`, "success"); }
    });
}

function rsetDelete(id) {
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return; }
    const list = rsetLoad();
    const set = list.find(s => s.id === id);
    if (!set) return;
    presetDialog({
        title: `「${set.name}」を、消す`,
        message: "この条件セットを消します。いまの席替えの条件は、変わりません。",
        buttons: [
            { label: "キャンセル", value: "cancel", cls: "btn-secondary" },
            { label: "消す", value: "ok", cls: "btn-delete is-primary", primary: true }
        ]
    }, v => {
        if (v !== "ok") return;
        if (rsetSave(rsetLoad().filter(s => s.id !== id))) { rsetRender(); showToast(`条件セット「${set.name}」を消しました。`, "success"); }
    });
}

function rsetRender() {
    const box = $id("rsetList");
    if (!box) return;
    const list = rsetLoad();
    box.innerHTML = "";
    if (!list.length) {
        const p = document.createElement("p");
        p.className = "rset-empty";
        p.textContent = "まだ、保存した条件セットはありません。";
        box.appendChild(p);
        return;
    }
    list.forEach(s => {
        const inUse = rsetSig(s.keys, rsetCurrentVals(s.keys)) === rsetSig(s.keys, s.vals);
        const item = document.createElement("div");
        item.className = "rset-item" + (inUse ? " is-use" : "");
        const head = document.createElement("div");
        head.className = "rset-head";
        const nm = document.createElement("span");
        nm.className = "rset-name";
        nm.textContent = s.name;
        head.appendChild(nm);
        if (inUse) {
            const tag = document.createElement("span");
            tag.className = "rset-tag";
            tag.textContent = "使用中";
            head.appendChild(tag);
        }
        item.appendChild(head);
        const sum = document.createElement("div");
        sum.className = "rset-sum";
        sum.textContent = rsetSummary(s);
        item.appendChild(sum);
        const ops = document.createElement("div");
        ops.className = "rset-ops";
        [["使う", "use", rsetApply, inUse], ["上書き", "over", rsetOverwrite, false], ["消す", "del", rsetDelete, false]].forEach(a => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "btn-secondary rset-op rset-op-" + a[1];
            b.textContent = a[0];
            b.disabled = !!a[3];
            b.addEventListener("click", () => a[2](s.id));
            ops.appendChild(b);
        });
        item.appendChild(ops);
        box.appendChild(item);
    });
}

const RSET_CSS = `
.rset-list { display: flex; flex-direction: column; gap: 8px; margin: 10px 0 8px; }
.rset-empty { margin: 0; color: var(--text-sub); font-size: 13px; font-weight: 600; }
.rset-item { padding: 9px 10px 9px 12px; border: 1px solid var(--seat-border); border-radius: 12px; background: var(--card-bg, var(--input-bg)); color: var(--input-text); }
.rset-item.is-use { border-color: var(--accent-color); box-shadow: inset 3px 0 0 var(--accent-color); }
.rset-head { display: flex; align-items: center; gap: 8px; }
.rset-name { flex: 1; min-width: 0; font-weight: 800; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rset-tag { flex: none; font-size: 11px; font-weight: 800; color: #fff; background: var(--accent-color); border-radius: 999px; padding: 1px 9px; }
.rset-sum { margin-top: 3px; font-size: 12px; line-height: 1.5; color: var(--text-sub); font-weight: 600; }
.rset-ops { display: flex; gap: 6px; margin-top: 8px; }
#configContainer .rset-ops .rset-op, .config-container .rset-ops .rset-op { flex: 1 1 0 !important; width: auto !important; min-width: 0 !important; height: 32px !important; min-height: 32px !important; padding: 0 8px !important; margin: 0 !important; font-size: 13px !important; font-weight: 700 !important; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 4px; }
#configContainer .rset-ops .rset-op:disabled { opacity: 0.45; }
.rset-title { margin: 16px 0 4px; font-size: 14px; font-weight: 700; color: var(--text-main); }
#rsetSaveBtn { margin-top: 10px; }
`;
const RSET_HTML = `
<div class="rset-block">
    <h4 class="rset-title">席替えの条件セット</h4>
    <p class="config-note">前の席を避ける・離す／近くに置く・優先順位などを、名前をつけて、いくつか保存できます。1回押すと、切り替わります。</p>
    <div id="rsetList" class="rset-list"></div>
    <button type="button" id="rsetSaveBtn" onclick="rsetSaveNew()" class="btn-secondary">いまの条件を保存</button>
</div>`;

SekigaeApp.registerPlugin({
    id: "rule-sets",
    name: "席替えの条件セット",
    version: "1.0",
    description: "席替えの条件（前の席を避ける・離す／近くに置く・優先順位など）に名前をつけて保存し、ワンタップで切り替えられます。",
    backupKeys: [RSET_KEY],
    searchWords: "席替え 条件 セット 切り替え 保存 ルール 前の席 避ける 離す 近く 優先順位 プリセット 班活動 ふだん用",
    mount(app) {
        const st = document.createElement("style");
        st.id = "rsetStyle";
        st.textContent = RSET_CSS;
        document.head.appendChild(st);
        app.insertInto("settings-rules", RSET_HTML);
        rsetRender();
        // 条件が、ほかの場所で変えられたら、「使用中」の表示を直す
        let timer = null;
        const later = () => { clearTimeout(timer); timer = setTimeout(rsetRender, 120); };
        document.addEventListener("change", later, true);
        document.addEventListener("click", later, true);
    },
    afterRender() { rsetRender(); }
});
