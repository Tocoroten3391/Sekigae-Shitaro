// ==========================================
// クラスごとの設定プラグイン：席替えの条件・演出・テーマ・指名のしかたを、クラスごとに持てるようにします。
// オンにすると、クラスを切り替えるたびに、いまの設定をそのクラスに覚えさせて、切り替え先のクラスの設定を使います。
// このファイルを index.html から外すと、この機能は使えなくなります。クラスの保存・切り替えは、これまでどおり使えます
// ==========================================
const CSET_ON_KEY = "class_settings_on_v1";       // "1" なら、クラスごとの設定を使う
const CSET_CATS_KEY = "class_settings_cats_v1";   // クラスごとに持つ設定の種類（JSON の配列）
// 各クラスの設定は、クラスの保存データ（seat_shuffler_presets）の csettings に、入ります： { t: 時刻, cats: [種類], vals: { 設定名: 文字列／null } }
const CSET_CATS = [
    { id: "rules", label: "席替えの条件（前の席を避ける・離す／近くに置く・優先順位など）", short: "席替えの条件",
      keys: ["avoid_same_seat", "avoid_neighbor", "avoid_depth", "condition_priority", "seat_fair_v1", "luck_use", "luck_window", "luck_threshold", "separation_pairs", "near_pairs"] },
    { id: "anim", label: "席替えの演出と音", short: "演出と音",
      keys: ["shuffle_anim_type", "shuffle_sound", "shuffle_anim_speed", "random_anim_scope"] },
    { id: "theme", label: "テーマ（色の着せ替え）", short: "テーマ",
      keys: ["app_theme", "follow_system_dark"] },
    { id: "nominate", label: "指名のしかた（重複・偏り防止など）", short: "指名のしかた",
      keys: ["nominate_favor_recent", "nominate_specific_exclude_enabled", "nominate_specific_excluded", "nom_balance_v1"] }
];

function csetRaw(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
function csetOn() { return csetRaw(CSET_ON_KEY) === "1"; }
function csetCats() {
    let v = null;
    try { v = JSON.parse(csetRaw(CSET_CATS_KEY)); } catch (e) { v = null; }
    const ids = CSET_CATS.map(c => c.id);
    return Array.isArray(v) ? v.filter(x => ids.includes(x)) : ids.slice();
}
function csetKeysOf(cats) { const out = []; CSET_CATS.forEach(c => { if (cats.includes(c.id)) c.keys.forEach(k => out.push(k)); }); return out; }
function csetCurrentVals(keys) { const o = {}; keys.forEach(k => { o[k] = csetRaw(k); }); return o; }
function csetValsSig(keys, vals) { return JSON.stringify(keys.map(k => [k, vals && vals[k] !== undefined ? vals[k] : null])); }
function csetTrial(name) { return !name || (typeof TRIAL_CLASS_ID !== "undefined" && name === TRIAL_CLASS_ID); }

// いまの設定を、クラスに覚えさせる（変わっていなければ、何も書かない）
function csetCaptureFor(name, force) {
    if (csetTrial(name)) return false;
    const presets = readPresetsSafe();
    const p = presets[name];
    if (!p) return false;
    const cats = csetCats();
    const keys = csetKeysOf(cats);
    const vals = csetCurrentVals(keys);
    const old = p.csettings;
    if (!force && old && Array.isArray(old.cats) && csetValsSig(keys, old.vals) === csetValsSig(keys, vals) && JSON.stringify(old.cats) === JSON.stringify(cats)) return false;
    p.csettings = { t: Date.now(), cats: cats, vals: vals };
    savePresetsObject(presets);
    return true;
}

// 設定を画面に反映する（再読み込みなしで）
function csetRefreshUi(cats) {
    const call = f => { try { if (typeof window[f] === "function") window[f](); } catch (e) { /* 画面の更新に失敗しても、設定は反映されています */ } };
    if (cats.includes("rules")) {
        call("loadAvoidSettings");
        const dep = $id("avoidDepthSelect");
        if (dep && csetRaw("avoid_depth") === null && Array.from(dep.options).some(o => o.value === "2")) dep.value = "2";
        call("applyConditionPriorityUi");
        call("loadSeparationPairs");
        call("loadNearPairs");
        call("renderSeparationList");
        try { if (typeof fairCache !== "undefined") fairCache = null; } catch (e) { /* なし */ }
        try { if (typeof luckCache !== "undefined") luckCache = null; } catch (e) { /* なし */ }
    }
    if (cats.includes("anim")) { call("loadShuffleAnimationSettings"); call("loadRandomScope"); }
    if (cats.includes("theme")) {
        const sel = $id("themeSelect"), t = csetRaw("app_theme");
        if (sel && t && Array.from(sel.options).some(o => o.value === t)) sel.value = t;
        call("applyTheme");
    }
    if (cats.includes("nominate")) {
        const fav = $id("nominateFavorRecentToggle");
        if (fav) fav.checked = csetRaw("nominate_favor_recent") === "true";
        try { specificallyExcludedStudents = new Set(JSON.parse(csetRaw("nominate_specific_excluded") || "[]")); } catch (e) { /* なし */ }
        const ex = $id("nominateSpecificExcludeToggle");
        if (ex) { ex.checked = csetRaw("nominate_specific_exclude_enabled") === "true"; call("toggleSpecificExclude"); }
        call("nbDecorate");
    }
}

// クラスに覚えさせた設定を、使う。覚えていないクラスは、いまの設定のまま使う
function csetApplyFor(name) {
    if (csetTrial(name)) return false;
    const p = readPresetsSafe()[name];
    const c = p && p.csettings;
    if (!c || !c.vals || typeof c.vals !== "object") return false;
    const cats = csetCats().filter(id => Array.isArray(c.cats) && c.cats.includes(id));
    csetKeysOf(cats).forEach(k => {
        try {
            const v = c.vals[k];
            if (v === null || v === undefined) localStorage.removeItem(k); else if (typeof v === "string") localStorage.setItem(k, v);
        } catch (e) { /* 何もしない */ }
    });
    csetRefreshUi(cats);
    return true;
}

function csetStatus() {
    const el = $id("csetStatus");
    if (!el) return;
    const name = (typeof activeClassId !== "undefined") ? activeClassId : "";
    if (csetTrial(name)) { el.textContent = "クラスを保存して選ぶと、そのクラスの設定を覚えられます"; return; }
    const p = readPresetsSafe()[name];
    const c = p && p.csettings;
    if (!c) { el.textContent = `クラス「${name}」：まだ覚えていません。このクラスを離れる時に、今の設定を覚えます。`; return; }
    const d = new Date(c.t || 0);
    const names = CSET_CATS.filter(x => Array.isArray(c.cats) && c.cats.includes(x.id)).map(x => x.short).join("・");
    el.textContent = `クラス「${name}」：覚えています（${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}・${names || "なし"}）`;
}

function csetRenderPanel() {
    const t = $id("csetToggle");
    if (t) t.checked = csetOn();
    const panel = $id("csetPanel");
    if (panel) panel.hidden = !csetOn();
    const cats = csetCats();
    CSET_CATS.forEach(c => { const cb = $id("csetCat_" + c.id); if (cb) cb.checked = cats.includes(c.id); });
    csetStatus();
}

function csetToggle() {
    const t = $id("csetToggle");
    if (!t) return;
    if (typeof isAppLocked === "function" && isAppLocked()) { t.checked = csetOn(); showLockedToast(); return; }
    try { localStorage.setItem(CSET_ON_KEY, t.checked ? "1" : "0"); } catch (e) { /* なし */ }
    if (t.checked) {
        const name = typeof activeClassId !== "undefined" ? activeClassId : "";
        const ok = csetCaptureFor(name, true);
        showToast(ok ? `クラスごとの設定を使います。今の設定をクラス「${name}」に覚えさせました。` : "クラスごとの設定を使います。クラスを保存して選ぶと、そのクラスの設定を覚えます。", "success");
    } else {
        showToast("クラスごとの設定をやめました。今の設定はどのクラスでもそのまま使います。", "success");
    }
    csetRenderPanel();
}

function csetCatChange() {
    const cats = CSET_CATS.filter(c => { const cb = $id("csetCat_" + c.id); return cb && cb.checked; }).map(c => c.id);
    try { localStorage.setItem(CSET_CATS_KEY, JSON.stringify(cats)); } catch (e) { /* なし */ }
    const name = typeof activeClassId !== "undefined" ? activeClassId : "";
    if (csetOn()) csetCaptureFor(name, true);
    csetStatus();
}

function csetRemember() {
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return; }
    const name = typeof activeClassId !== "undefined" ? activeClassId : "";
    if (csetTrial(name)) { showToast("クラスを保存して、選んでから使ってください", "error"); return; }
    csetCaptureFor(name, true);
    csetStatus();
    showToast(`今の設定をクラス「${name}」に覚えさせました`, "success");
}

function csetClear() {
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return; }
    const name = typeof activeClassId !== "undefined" ? activeClassId : "";
    const presets = readPresetsSafe();
    if (csetTrial(name) || !presets[name] || !presets[name].csettings) { showToast("このクラスはまだ設定を覚えていません", "error"); return; }
    delete presets[name].csettings;
    savePresetsObject(presets);
    csetStatus();
    showToast(`クラス「${name}」の設定を忘れました。今の設定はそのまま使います。`, "success");
}

const CSET_CSS = `
.cset-status { margin: 8px 0 10px; font-size: 13px; font-weight: 700; color: var(--input-text); line-height: 1.5; }
.cset-cats { display: flex; flex-direction: column; gap: 7px; margin: 8px 0 4px; }
.cset-cats label { display: flex; align-items: flex-start; gap: 8px; font-size: 13px; font-weight: 600; color: var(--input-text); line-height: 1.5; cursor: pointer; }
.cset-cats input[type="checkbox"] { flex: none; margin-top: 3px; }
.cset-tools { display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 10px; }
#configContainer .cset-tools button { margin: 0 !important; }
`;
const CSET_HTML = `
<div class="cset-block">
    <div class="switch-container" style="margin-top: 14px;">
        <label class="switch"><input type="checkbox" id="csetToggle" onchange="csetToggle()"><span class="slider slider-purple"></span></label>
        <span class="switch-label" style="color: var(--lbl-purple); font-weight: bold;">設定をクラスごとに持つ</span>
    </div>
    <div id="csetPanel" class="nominate-exclude-panel" hidden>
        <div class="nominate-exclude-help">クラスを切り替えるたびに、今の設定をそのクラスに覚えさせて、切り替え先のクラスの設定を使います。まだ設定を覚えていないクラスは、今の設定のまま使います。</div>
        <div id="csetStatus" class="cset-status"></div>
        <div class="nominate-exclude-help">クラスごとに持つ設定</div>
        <div class="cset-cats">
            ${CSET_CATS.map(c => `<label><input type="checkbox" id="csetCat_${c.id}" onchange="csetCatChange()"><span>${c.label}</span></label>`).join("\n            ")}
        </div>
        <div class="cset-tools">
            <button type="button" id="csetRememberBtn" onclick="csetRemember()" class="btn-secondary">今の設定を覚えさせる</button>
            <button type="button" id="csetClearBtn" onclick="csetClear()" class="btn-secondary">覚えた設定を消す</button>
        </div>
    </div>
</div>`;

SekigaeApp.registerPlugin({
    id: "class-settings",
    name: "クラスごとの設定",
    version: "1.0",
    description: "席替えの条件・演出・テーマ・指名のしかたを、クラスごとに持てます。クラスを切り替えるだけで、そのクラスの設定になります。",
    backupKeys: [CSET_ON_KEY, CSET_CATS_KEY],
    searchWords: "クラスごと 設定 クラス別 持ち分け 切り替え 演出 テーマ 指名 重複 条件 別々 学年 クラス単位",
    mount(app) {
        const st = document.createElement("style");
        st.id = "csetStyle";
        st.textContent = CSET_CSS;
        document.head.appendChild(st);
        app.insertInto("settings-classes", CSET_HTML);
        csetRenderPanel();
        // クラスを切り替える時：離れるクラスに、いまの設定を覚えさせて、切り替え先の設定を使う
        const prevLoad = window.loadPreset;
        window.loadPreset = function (name) {
            const on = csetOn() && SekigaeApp.isEnabled("class-settings");
            if (on) { try { csetCaptureFor(typeof activeClassId !== "undefined" ? activeClassId : ""); } catch (e) { /* 何もしない */ } }
            const r = prevLoad.apply(this, arguments);
            if (on) { try { csetApplyFor(name); } catch (e) { /* 何もしない */ } csetStatus(); }
            return r;
        };
        // 設定を変えたら、そのクラスに覚えさせる（アプリを閉じても、新しい設定が残るように）
        let timer = null;
        const later = () => {
            if (!csetOn()) return;
            clearTimeout(timer);
            timer = setTimeout(() => { try { if (csetCaptureFor(typeof activeClassId !== "undefined" ? activeClassId : "")) csetStatus(); } catch (e) { /* 何もしない */ } }, 500);
        };
        document.addEventListener("change", later, true);
        document.addEventListener("click", later, true);
        window.addEventListener("pagehide", () => { if (csetOn()) { try { csetCaptureFor(typeof activeClassId !== "undefined" ? activeClassId : ""); } catch (e) { /* 何もしない */ } } });
    },
    afterRender() { csetStatus(); }
});
