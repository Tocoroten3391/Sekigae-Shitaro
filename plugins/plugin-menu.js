// ==========================================
// プラグインメニュー強化プラグイン：「プラグインの設定」の画面を、使いやすくします。
//  ・上の検索ボックス（名前・説明・読みで絞る。一致した文字に色を付けて、その場所へ移って光らせます）
//  ・グループの折りたたみ、「すべて開く／閉じる」
//  ・画面の下に固定する「変更が N 件あります」と「今すぐ再読み込み」
//  ・起動の準備にかかった時間から出す「軽い／ふつう／重い」の目安
//  ・広い画面では、左に目次、右に2列の一覧
//  ・プラグイン名を押すと、そのボタンがある設定の区分へ移動
//  ・60日使っていないプラグインにつける印と、まとめてオフにする案内（使った回数は、この端末の中だけで数えます）
// このファイルを index.html から外しても、プラグインのオン・オフは、これまでどおりに使えます
// ==========================================
const PM_UI_KEY = "plugin_menu_ui_v1";      // { groupOpen: { グループ名: true/false } }
const PM_USE_KEY = "plugin_usage_v1";       // { since: 日, p: { id: [使った回数, 最後に使った日] } }（バックアップには入れません）
const PM_UNUSED_DAYS = 60;
// 使った回数を数えない（自動で動くもの・このメニュー自身など）
const PM_NO_TRACK = ["plugin-menu", "plugin-presets", "settings-search", "diagnostics", "cloud", "updateinfo", "program-timer"];
// 重さの目安の境目（ミリ秒）。mount と ready にかかった時間の合計で決めます
const PM_WEIGHT_MID = 4, PM_WEIGHT_HEAVY = 15;

let pmState = { onlyHeavy: false, hits: [], cur: -1, searching: false, timer: null };
let pmUse = { since: 0, p: {} };
let pmUseDirty = false, pmUseTimer = null, pmFlashTimer = null;

// ---- 文字をそろえる（ひらがな・カタカナ・全角半角・大文字小文字を、区別しません） ----
function pmFold(ch) {
    return ch.normalize("NFKC").toLowerCase().replace(/[ァ-ヶ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60)).replace(/[\s　・、。,.\-_\/()（）「」『』:：]/g, "");
}
function pmNormMap(text) {
    let n = "";
    const map = [];
    Array.from(String(text)).reduce((idx, ch) => {
        const f = pmFold(ch);
        for (let k = 0; k < f.length; k++) { n += f[k]; map.push(idx); }
        return idx + ch.length;
    }, 0);
    return { n: n, map: map };
}
function pmNorm(text) { return pmNormMap(text).n; }
function pmTerms(q) { return String(q || "").split(/[\s　]+/).map(pmNorm).filter(Boolean); }
function pmDefText(def) {
    if (!def._pmText) {
        const n = pmNorm((def.name || "") + " " + (def.description || "") + " " + (def.searchWords || ""));
        def._pmText = n + ((typeof ssAliasFor === "function") ? ssAliasFor(n) : "");
    }
    return def._pmText;
}
// text の中で、terms に一致した範囲 [始め, 終わり) を返します
function pmRanges(text, terms) {
    const nm = pmNormMap(text);
    const raw = [];
    terms.forEach(t => {
        let i = nm.n.indexOf(t);
        while (i >= 0) { raw.push([nm.map[i], nm.map[i + t.length - 1] + 1]); i = nm.n.indexOf(t, i + 1); }
    });
    raw.sort((a, b) => a[0] - b[0]);
    const out = [];
    raw.forEach(r => { const l = out[out.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else out.push(r.slice()); });
    return out;
}
function pmMarked(text, terms) {
    const frag = document.createDocumentFragment();
    let pos = 0;
    pmRanges(text, terms).forEach(r => {
        if (r[0] > pos) frag.appendChild(document.createTextNode(text.slice(pos, r[0])));
        const m = document.createElement("mark");
        m.textContent = text.slice(r[0], r[1]);
        frag.appendChild(m);
        pos = r[1];
    });
    if (pos < text.length) frag.appendChild(document.createTextNode(text.slice(pos)));
    return frag;
}
function pmSnippet(desc, terms) {
    const nm = pmNormMap(desc);
    let first = -1;
    terms.forEach(t => { const i = nm.n.indexOf(t); if (i >= 0 && (first < 0 || i < first)) first = i; });
    if (first < 0) return null;
    const at = nm.map[first];
    const s = Math.max(0, at - 16), e = Math.min(desc.length, at + 46);
    return { text: (s > 0 ? "…" : "") + desc.slice(s, e) + (e < desc.length ? "…" : ""), from: s };
}

// ---- 保存しておくもの ----
function pmLoadUi() {
    try { const v = JSON.parse(lsGet(PM_UI_KEY, "{}")); return v && typeof v === "object" ? v : {}; } catch (e) { return {}; }
}
function pmSaveUi() {
    const groups = {};
    document.querySelectorAll("#pluginList details.plugin-group").forEach(g => { groups[g.dataset.group] = g.open; });
    SekigaeApp.groupOpen = Object.assign(SekigaeApp.groupOpen || {}, groups);
    lsSet(PM_UI_KEY, JSON.stringify({ groupOpen: SekigaeApp.groupOpen }));
}
function pmDay() { return Math.floor(Date.now() / 86400000); }
function pmLoadUse() {
    try {
        const v = JSON.parse(lsGet(PM_USE_KEY, "{}"));
        return { since: v && v.since ? v.since : pmDay(), p: v && v.p && typeof v.p === "object" ? v.p : {} };
    } catch (e) { return { since: pmDay(), p: {} }; }
}
function pmSaveUse() {
    pmUseDirty = false;
    lsSet(PM_USE_KEY, JSON.stringify(pmUse));
}
function pmOptional() { return SekigaeApp.plugins.filter(p => !p.required); }

// ---- 重さの目安 ----
function pmWeightOf(p) {
    // 読み込んだ時にオフだったものは、動いていないので、測れていません
    if ((SekigaeApp._baseDisabled || []).includes(p.id)) return null;
    const ms = (p._t_mount || 0) + (p._t_ready || 0);     // 起動の時に、何もしないプラグインは、0 ミリ秒（軽い）
    return { ms: ms, load: p._load || 0, level: ms >= PM_WEIGHT_HEAVY ? "heavy" : (ms >= PM_WEIGHT_MID ? "mid" : "light") };
}
const PM_WEIGHT_LABEL = { light: "軽い", mid: "普通", heavy: "重い" };

// ---- 設定のどこにあるか ----
function pmTargets(id) {
    const cc = $id("configContainer");
    if (!cc) return [];
    return Array.from(cc.querySelectorAll('[data-plugin="' + id + '"],[data-plugin-src="' + id + '"]')).filter(el =>
        !el.closest(".usage-section, #favSection, #adminSection, .config-search, #configWideNav, #cfgSearchPanel, [data-plugin-off]"));
}
function pmFlash(el) {
    if (!el) return;
    document.querySelectorAll(".pm-flash").forEach(x => x.classList.remove("pm-flash"));
    void el.offsetWidth;
    el.classList.add("pm-flash");
    clearTimeout(pmFlashTimer);
    pmFlashTimer = setTimeout(() => el.classList.remove("pm-flash"), 2300);
}
function pmOpenAncestors(el) {
    let d = el.parentElement;
    while (d) { if (d.tagName === "DETAILS") d.open = true; d = d.parentElement; }
}
function pmJump(id) {
    const def = SekigaeApp.plugins.find(p => p.id === id);
    const name = def ? (def.name || id) : id;
    if (!SekigaeApp.isEnabled(id)) { showToast("「" + name + "」はオフです。オンにして再読み込みすると、設定に出ます。", "info"); return; }
    const t = pmTargets(id);
    if (!t.length) { showToast("「" + name + "」の操作は設定の中にはありません。", "info"); return; }
    const el = t[0], sec = el.closest(".config-section");
    if (typeof closePluginModal === "function") closePluginModal();
    const cc = $id("configContainer");
    if (cc && !cc.classList.contains("open") && typeof toggleConfigMenu === "function") toggleConfigMenu();
    if (sec) {
        setConfigSectionCollapsed(sec, false);
        if (typeof isConfigWide === "function" && isConfigWide()) { const i = configWideSections().indexOf(sec); if (i >= 0) selectConfigWideSection(i); }
    }
    setTimeout(() => {
        pmOpenAncestors(el);
        const target = el.offsetParent === null ? (sec || el) : el;
        target.scrollIntoView({ block: "center" });
        pmFlash(target);
    }, (typeof isConfigWide === "function" && isConfigWide()) ? 140 : 80);
}

// ---- 検索 ----
function pmRowDef(row) {
    const id = row.dataset.pluginRow;
    return SekigaeApp.plugins.find(p => p.id === id);
}
function pmApplyFilter(scrollToFirst) {
    const list = $id("pluginList"), inp = $id("pluginSearchInput");
    if (!list || !inp) return;
    const terms = pmTerms(inp.value);
    const searching = terms.length > 0 || pmState.onlyHeavy;
    list.classList.toggle("pm-searching", searching);
    const hits = [];
    list.querySelectorAll(".plugin-row").forEach(row => {
        const def = pmRowDef(row);
        const w = def ? pmWeightOf(def) : null;
        const ok = !!def && terms.every(t => pmDefText(def).includes(t)) && (!pmState.onlyHeavy || (w && w.level === "heavy" && SekigaeApp.isEnabled(def.id)));
        row.hidden = !ok;
        // 前の色と、説明の抜き出しを消す
        const nameEl = row.querySelector(".pm-name");
        if (nameEl && nameEl.dataset.raw !== undefined) nameEl.textContent = nameEl.dataset.raw;
        const old = row.querySelector(".pm-snip");
        if (old) old.remove();
        if (!ok) return;
        hits.push(row);
        if (terms.length && nameEl) {
            nameEl.textContent = "";
            nameEl.appendChild(pmMarked(nameEl.dataset.raw, terms));
            const raw = nameEl.dataset.raw, normName = pmNorm(raw + " " + (def.version || ""));
            if (def.description && !terms.every(t => normName.includes(t))) {
                const sn = pmSnippet(def.description, terms);
                if (sn) {
                    const div = document.createElement("div");
                    div.className = "pm-snip";
                    div.appendChild(pmMarked(sn.text, terms));
                    row.querySelector(".switch-container").after(div);
                }
            }
        }
    });
    list.querySelectorAll("details.plugin-group").forEach(g => {
        const any = !!g.querySelector(".plugin-row:not([hidden])");
        g.hidden = searching && !any;
        if (searching) { if (any) g.open = true; }
        else if (pmState.searching) g.open = !(SekigaeApp.groupOpen && SekigaeApp.groupOpen[g.dataset.group] === false);
    });
    pmState.searching = searching;
    const req = list.querySelector(".plugin-required-box");
    if (req) {
        let any = false;
        req.querySelectorAll(".plugin-required-item").forEach(it => {
            const lab = it.querySelector("[data-plugin-label]");
            const def = lab && SekigaeApp.plugins.find(p => p.id === lab.dataset.pluginLabel);
            const ok = !terms.length ? !pmState.onlyHeavy : (!pmState.onlyHeavy && !!def && terms.every(t => pmDefText(def).includes(t)));
            it.hidden = !ok;
            if (ok) any = true;
        });
        req.hidden = searching && !any;
        if (terms.length && any) req.open = true;
    }
    ["presetBox", "pluginMissing"].forEach(id => { const el = $id(id); if (el) el.hidden = searching; });
    const ub = $id("pmUnusedBox");
    if (ub) { if (searching) ub.hidden = true; else pmRenderUnused(); }
    const nav = $id("pmNav");
    if (nav) nav.classList.toggle("is-dim", searching);
    pmState.hits = hits;
    pmState.cur = -1;
    const empty = $id("pluginSearchEmpty");
    if (empty) empty.hidden = !searching || hits.length > 0 || (req && !req.hidden);
    const cnt = $id("pluginSearchCount");
    if (cnt) cnt.textContent = searching ? hits.length + "件" : "";
    const ob = document.querySelector('#pmTools [data-pm="heavy"]');
    if (ob) { ob.classList.toggle("is-on", pmState.onlyHeavy); ob.setAttribute("aria-pressed", String(pmState.onlyHeavy)); }
    if (scrollToFirst && terms.length && hits.length) pmFocusHit(0);
}
function pmFocusHit(i) {
    if (!pmState.hits.length) return;
    pmState.cur = ((i % pmState.hits.length) + pmState.hits.length) % pmState.hits.length;
    const row = pmState.hits[pmState.cur];
    row.scrollIntoView({ block: "center", behavior: "auto" });
    pmFlash(row);
}
// 設定の検索などから、プラグインの行を見せる
function pmRevealRow(id) {
    const inp = $id("pluginSearchInput");
    if (inp && inp.value) inp.value = "";
    pmState.onlyHeavy = false;
    pmApplyFilter(false);
    let row = document.querySelector('#pluginList .plugin-row[data-plugin-row="' + id + '"]');
    if (!row) { const lab = document.querySelector('#pluginList [data-plugin-label="' + id + '"]'); row = lab && lab.closest(".switch-container"); }
    if (!row) return;
    pmOpenAncestors(row);
    pmSaveUi();
    row.scrollIntoView({ block: "center" });
    pmFlash(row);
}

// ---- 一覧を描いたあとに、足すもの ----
function pmDecorate() {
    const list = $id("pluginList");
    if (!list) return;
    const unused = new Set(pmUnusedList().map(p => p.id));
    list.querySelectorAll(".plugin-row").forEach(row => {
        const def = pmRowDef(row);
        if (!def) return;
        const sc = row.querySelector(".switch-container");
        const label = sc.querySelector("[data-plugin-label]");
        // 名前を、押せるようにする（設定の中の場所へ移る）
        const first = label.firstChild;
        if (first && first.nodeType === 3 && !label.querySelector(".pm-name")) {
            const nm = def.name || def.id;
            const txt = first.textContent;
            const span = document.createElement("span");
            span.className = "pm-name";
            span.dataset.raw = nm;
            span.textContent = nm;
            first.textContent = txt.startsWith(nm) ? txt.slice(nm.length) : txt;
            label.insertBefore(span, first);
        }
        const nameEl = label.querySelector(".pm-name");
        const on = SekigaeApp.isEnabled(def.id);
        const hasTarget = on && pmTargets(def.id).length > 0;
        nameEl.classList.toggle("is-link", hasTarget);
        if (hasTarget) { nameEl.setAttribute("role", "button"); nameEl.tabIndex = 0; } else { nameEl.removeAttribute("role"); nameEl.removeAttribute("tabindex"); }
        const rec = pmUse.p[def.id];
        let tip = hasTarget ? "押すと設定の中の、この機能のボタンがある場所へ移ります。" : "";
        if (rec && on) tip += (tip ? "\n" : "") + "この端末で、" + rec[0] + "回使いました。" + (rec[0] ? "最後に使ったのは、" + Math.max(0, pmDay() - rec[1]) + "日前です。" : "");
        if (tip) nameEl.title = tip; else nameEl.removeAttribute("title");
        // 重さの目安
        sc.querySelectorAll(".pm-badges").forEach(x => x.remove());
        const badges = document.createElement("span");
        badges.className = "pm-badges";
        const w = pmWeightOf(def);
        if (w && on) {
            const b = document.createElement("span");
            b.className = "pm-weight pm-w-" + w.level;
            b.textContent = PM_WEIGHT_LABEL[w.level];
            b.title = "起動の準備に約 " + w.ms.toFixed(1) + " ミリ秒かかりました（この端末で測りました）。\nファイルの読み込みに、約 " + w.load.toFixed(1) + " ミリ秒かかっていて、これはオフにしてもファイルを外さないと減りません。\n動いている間の重さは、入っていません。目安です。";
            badges.appendChild(b);
        }
        if (unused.has(def.id)) {
            const u = document.createElement("span");
            u.className = "pm-unused";
            u.textContent = PM_UNUSED_DAYS + "日使っていません";
            u.title = PM_UNUSED_DAYS + "日以上、この機能を押した記録がありません。使わないなら、オフにすると少し軽くなります。\n数えているのはこの端末の中だけです。";
            badges.insertBefore(u, badges.firstChild);
        }
        if (badges.firstChild) sc.appendChild(badges);
    });
    pmRenderNav();
    pmRenderSummary();
    pmRenderUnused();
    pmRenderReload();
    pmApplyFilter(false);
}
function pmRenderNav() {
    const nav = $id("pmNav");
    if (!nav) return;
    const list = $id("pluginList");
    let h = '<div class="pm-nav-title">グループ</div>';
    list.querySelectorAll("details.plugin-group").forEach(g => {
        const c = g.querySelector(".plugin-group-count");
        h += '<div class="pm-nav-item" role="button" tabindex="0" data-pm-go="' + g.dataset.group.replace(/"/g, "&quot;") + '"><span>' + g.dataset.group.replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch])) + '</span><small>' + (c ? c.textContent : "") + '</small></div>';
    });
    const req = list.querySelector(".plugin-required-box");
    if (req) h += '<div class="pm-nav-item" role="button" tabindex="0" data-pm-go="__required"><span>必須</span><small>' + SekigaeApp.plugins.filter(p => p.required).length + '</small></div>';
    nav.innerHTML = h;
}
function pmRenderSummary() {
    const el = $id("pmSummaryText");
    if (!el) return;
    const on = pmOptional().filter(p => SekigaeApp.isEnabled(p.id) && pmWeightOf(p));
    const total = on.reduce((a, p) => a + pmWeightOf(p).ms, 0);
    const heavy = on.filter(p => pmWeightOf(p).level === "heavy");
    el.textContent = "起動の準備にかかった時間（オンの機能の合計）：約 " + total.toFixed(0) + " ミリ秒。" +
        (heavy.length ? "重い機能：" + heavy.sort((a, b) => pmWeightOf(b).ms - pmWeightOf(a).ms).map(p => p.name || p.id).join("、") + "。" : "重い機能はありません。");
}
// 変更の数（読み込んだ時と比べて、オン・オフが変わったもの）
function pmChanges() {
    const base = new Set(SekigaeApp._baseDisabled || []), cur = new Set(SekigaeApp.disabledIds());
    const out = [];
    pmOptional().forEach(p => {
        const was = !base.has(p.id), now = !cur.has(p.id);
        if (was !== now) out.push({ id: p.id, name: p.name || p.id, on: now });
    });
    return out;
}
function pmRenderReload() {
    const bar = $id("pmReloadBar");
    if (!bar) return;
    const ch = pmChanges();
    bar.hidden = ch.length === 0;
    if (!ch.length) return;
    $id("pmReloadText").textContent = "変更が " + ch.length + " 件あります";
    const ons = ch.filter(c => c.on).map(c => c.name), offs = ch.filter(c => !c.on).map(c => c.name);
    $id("pmReloadSub").textContent = (ons.length ? "オンにする：" + ons.join("、") : "") + (ons.length && offs.length ? "　" : "") + (offs.length ? "オフにする：" + offs.join("、") : "");
}
function pmUndoChanges() {
    if (typeof isAppLocked === "function" && isAppLocked()) { if (typeof showLockedToast === "function") showLockedToast(); return; }
    pmChanges().forEach(c => SekigaeApp.setEnabled(c.id, !c.on));
    SekigaeApp.renderPluginList();
    showToast("変更をもとに戻しました。", "success");
}

// ---- 使っていない機能 ----
function pmTrackInit() {
    pmUse = pmLoadUse();
    const today = pmDay();
    pmOptional().forEach(p => {
        const base = new Set(SekigaeApp._baseDisabled || []);
        if (base.has(p.id)) delete pmUse.p[p.id];                    // オフの間は数えない（またオンにしたら、新しく数えはじめる）
        else if (!pmUse.p[p.id]) pmUse.p[p.id] = [0, today];
    });
    pmSaveUse();
    document.addEventListener("click", e => {
        const t = e.target;
        if (!t || !t.closest) return;
        if (t.closest("#pluginModalOverlay, #cfgSearchPanel, .config-search, .usage-section")) return;
        if (!t.closest("button, a, input, select, label, summary, [onclick], [role='button']")) return;
        const host = t.closest("[data-plugin],[data-plugin-src]");
        if (!host) return;
        const rec = pmUse.p[host.dataset.plugin || host.dataset.pluginSrc];
        if (!rec) return;
        rec[0]++;
        rec[1] = pmDay();
        pmUseDirty = true;
        clearTimeout(pmUseTimer);
        pmUseTimer = setTimeout(pmSaveUse, 4000);
    }, true);
    window.addEventListener("pagehide", () => { if (pmUseDirty) pmSaveUse(); });
    document.addEventListener("visibilitychange", () => { if (document.hidden && pmUseDirty) pmSaveUse(); });
}
function pmUnusedList() {
    const today = pmDay();
    return pmOptional().filter(p => {
        if (PM_NO_TRACK.includes(p.id) || !SekigaeApp.isEnabled(p.id) || (SekigaeApp._baseDisabled || []).includes(p.id)) return false;
        const rec = pmUse.p[p.id];
        if (!rec || today - rec[1] < PM_UNUSED_DAYS) return false;
        return !!document.querySelector('[data-plugin="' + p.id + '"],[data-plugin-src="' + p.id + '"]');   // 画面に、操作できる部品があるものだけ
    });
}
function pmRenderUnused() {
    const box = $id("pmUnusedBox");
    if (!box) return;
    const list = pmUnusedList();
    if (!list.length || box.dataset.dismissed === "1") { box.hidden = true; box.innerHTML = ""; return; }
    box.hidden = false;
    box.innerHTML = '<span class="pm-unused-text">' + PM_UNUSED_DAYS + '日以上、使っていない機能が ' + list.length + ' 個あります：' + list.map(p => (p.name || p.id).replace(/[&<>]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]))).join("、") +
        '。オフにすると少し軽くなります。</span><span class="pm-unused-btns"><button type="button" class="btn-compact" data-pm="unused-off">まとめてオフにする</button><button type="button" class="btn-compact" data-pm="unused-later">後で</button></span>';
}
function pmUnusedOff() {
    if (typeof isAppLocked === "function" && isAppLocked()) { if (typeof showLockedToast === "function") showLockedToast(); return; }
    const list = pmUnusedList();
    if (!list.length) return;
    if (!confirm(PM_UNUSED_DAYS + "日以上、使っていない機能をオフにします。\n" + list.map(p => "・" + (p.name || p.id)).join("\n") + "\n\n反映するには再読み込みが必要です。オフにしますか？")) return;
    list.forEach(p => SekigaeApp.setEnabled(p.id, false));
    SekigaeApp.renderPluginList();
    showToast(list.length + "個をオフにしました。再読み込みの後に反映されます。", "success");
}

// ---- 画面の部品と、CSS ----
const PM_CSS = `
.pm-tools { display: flex; flex-direction: column; gap: 8px; }
.pm-search-row { display: flex; align-items: center; gap: 8px; }
#pluginSearchInput { flex: 1 1 auto; min-width: 0; width: 100%; box-sizing: border-box; height: 40px; padding: 0 12px; font-size: 14px; border-radius: 10px; }
#pluginSearchCount { flex: 0 0 auto; min-width: 2.5em; text-align: right; font-size: 12px; font-weight: 700; color: var(--text-sub); }
.pm-toolbtns { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.modal-content .pm-toolbtns button.btn-compact { background: var(--uis-b-bg, var(--input-bg, #f2f2f7)); color: var(--uis-b-fg, var(--text-main, #1c1c1e)); border: 1px solid var(--uis-b-line, var(--seat-border, #e2e8f0)); cursor: pointer; font-weight: 600; }
.modal-content .pm-toolbtns button.btn-compact:hover { border-color: var(--uis-b-hover-line, #0891b2); }
.modal-content .pm-toolbtns button.btn-compact.is-on { background: var(--uis-b-on-bg, #0891b2); border-color: var(--uis-b-on-bg, #0891b2); color: var(--uis-b-on-fg, #fff); }
.pm-summary { margin: 0; font-size: 12px; line-height: 1.6; color: var(--text-sub); }
.pm-unused-box { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; padding: 8px 12px; border-radius: 10px; border: 1px solid var(--uis-n-line, #fcd34d); background: var(--uis-n-bg, #fffbeb); color: var(--uis-n-fg, #78350f); font-size: 12px; line-height: 1.6; }
.pm-unused-box[hidden] { display: none; }
.pm-unused-text { flex: 1 1 220px; }
.pm-unused-btns { display: flex; gap: 6px; }
.pm-unused-btns { --uis-b-bg: var(--uis-n-btn-bg, #fff); --uis-b-hover-bg: var(--uis-n-btn-bg, #fff); --uis-b-fg: var(--uis-n-fg, #78350f); --uis-b-line: var(--uis-n-line, #f59e0b); }
.modal-content .pm-unused-btns button.btn-compact { background: var(--uis-b-bg); color: var(--uis-b-fg); border: 1px solid var(--uis-b-line); cursor: pointer; font-weight: 700; }
.pm-body { display: block; }
.pm-nav { display: none; }
.pm-name.is-link { cursor: pointer; text-decoration: underline dotted; text-underline-offset: 4px; }
.pm-name.is-link:hover { color: var(--uis-b-hover-line, #0891b2); }
.pm-name mark, .pm-snip mark { background: rgba(245, 158, 11, 0.38); color: inherit; border-radius: 3px; padding: 0 1px; }
.pm-snip { margin: 4px 0 0 52px; font-size: 12px; line-height: 1.6; color: var(--text-sub); }
.plugin-row .switch-container { flex-wrap: wrap; row-gap: 4px; }
.pm-weight, .pm-unused { flex: 0 0 auto; padding: 0 8px; border-radius: 999px; font-size: 11px; font-weight: 700; line-height: 1.7; cursor: help; }
.pm-badges { margin-left: auto; display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px 6px; }
.pm-w-light { background: var(--uis-w-light-bg, rgba(22, 163, 74, 0.14)); color: var(--uis-w-light-fg, #15803d); }
.pm-w-mid { background: var(--uis-w-mid-bg, rgba(245, 158, 11, 0.18)); color: var(--uis-w-mid-fg, #b45309); }
.pm-w-heavy { background: var(--uis-w-heavy-bg, rgba(220, 38, 38, 0.14)); color: var(--uis-w-heavy-fg, #b91c1c); }
.pm-unused { background: rgba(100, 116, 139, 0.18); color: var(--text-sub); }
.pm-flash { outline: 3px solid transparent; outline-offset: 3px; border-radius: 8px; animation: pmFlash 2.2s ease-in-out 1; }
@keyframes pmFlash { 0%, 100% { outline-color: transparent; box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); } 12%, 70% { outline-color: #f59e0b; box-shadow: 0 0 22px 6px rgba(245, 158, 11, 0.5); } }
body.lite-mode .pm-flash { animation: none; outline-color: #f59e0b; box-shadow: none; }
.pm-reload { position: sticky; bottom: -16px; z-index: 5; display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; padding: 10px 14px; border-radius: 14px; background: var(--uis-bar-bg, #0f172a); color: var(--uis-bar-fg, #fff); box-shadow: 0 8px 24px rgba(15, 23, 42, 0.35); }
.pm-reload[hidden] { display: none; }
.pm-reload-main { flex: 1 1 200px; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.pm-reload-main strong { font-size: 14px; }
.pm-reload-main span { font-size: 11px; opacity: 0.8; line-height: 1.5; word-break: break-all; }
.pm-reload-btns { display: flex; gap: 6px; }
.pm-reload-btns button { --uis-b-line: transparent; }
.pm-reload-btns button[data-pm="reload"] { --uis-b-bg: var(--uis-bar-go-bg, #06b6d4); --uis-b-hover-bg: var(--uis-bar-go-bg, #06b6d4); --uis-b-fg: var(--uis-bar-go-fg, #0f172a); }
.pm-reload-btns button[data-pm="undo"] { --uis-b-bg: var(--uis-bar-sub-bg, rgba(255, 255, 255, 0.16)); --uis-b-hover-bg: var(--uis-bar-sub-bg, rgba(255, 255, 255, 0.16)); --uis-b-fg: var(--uis-bar-fg, #fff); }
.modal-content .pm-reload-btns button { background: var(--uis-b-bg); color: var(--uis-b-fg); border: 1px solid var(--uis-b-line); cursor: pointer; font-weight: 700; }
#pluginReloadNote { display: none !important; }
#pluginModalOverlay [hidden] { display: none !important; }
#pluginList.pm-searching .plugin-group-title { cursor: default; }
@media (min-width: 1000px) {
    #pluginModalOverlay .modal-content { max-width: 1040px !important; width: 96% !important; }
    .pm-body { display: grid; grid-template-columns: 222px minmax(0, 1fr); gap: 22px; align-items: start; }
    .pm-body > #presetBox { grid-column: 1 / -1; }
    .pm-nav { display: flex; flex-direction: column; gap: 4px; position: sticky; top: 0; padding-right: 14px; border-right: 1px solid var(--seat-border); }
    .pm-nav.is-dim { opacity: 0.4; pointer-events: none; }
    .pm-nav-title { font-size: 11px; font-weight: 800; letter-spacing: 0.06em; color: var(--text-sub); margin: 0 0 4px 8px; }
    .pm-nav-item { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 7px 10px; border-radius: 8px; font-size: 13px; font-weight: 600; color: var(--text-main); cursor: pointer; }
    .pm-nav-item:hover, .pm-nav-item:focus-visible { background: var(--uis-nav-hover, rgba(8, 145, 178, 0.13)); outline: none; }
    .pm-nav-item small { color: var(--text-sub); font-weight: 400; font-size: 11px; white-space: nowrap; }
    #pluginList .plugin-group-body { display: grid; grid-template-columns: 1fr 1fr; gap: 0 26px; align-items: start; }
}
body.theme-dark:not(.ui-style-a):not(.ui-style-b) .pm-unused-box, body.theme-blackboard:not(.ui-style-a):not(.ui-style-b) .pm-unused-box, body.theme-game:not(.ui-style-a):not(.ui-style-b) .pm-unused-box { background: rgba(245, 158, 11, 0.14); color: #fcd34d; border-color: rgba(252, 211, 77, 0.5); }
body.theme-dark:not(.ui-style-a):not(.ui-style-b) .pm-w-light, body.theme-blackboard:not(.ui-style-a):not(.ui-style-b) .pm-w-light, body.theme-game:not(.ui-style-a):not(.ui-style-b) .pm-w-light { color: #86efac; }
body.theme-dark:not(.ui-style-a):not(.ui-style-b) .pm-w-mid, body.theme-blackboard:not(.ui-style-a):not(.ui-style-b) .pm-w-mid, body.theme-game:not(.ui-style-a):not(.ui-style-b) .pm-w-mid { color: #fcd34d; }
body.theme-dark:not(.ui-style-a):not(.ui-style-b) .pm-w-heavy, body.theme-blackboard:not(.ui-style-a):not(.ui-style-b) .pm-w-heavy, body.theme-game:not(.ui-style-a):not(.ui-style-b) .pm-w-heavy { color: #fca5a5; }
`;

function pmBuild() {
    const modal = $id("pluginModalOverlay");
    const content = modal && modal.querySelector(".modal-content");
    const list = $id("pluginList");
    if (!content || !list) return false;
    const note = content.querySelector(":scope > p");
    const tools = '<div id="pmTools" class="pm-tools">' +
        '<div class="pm-search-row"><input type="search" id="pluginSearchInput" placeholder="プラグインをさがす　例：音、印刷、名簿" aria-label="プラグインをさがす" autocomplete="off"><span id="pluginSearchCount" aria-live="polite"></span></div>' +
        '<p id="pluginSearchEmpty" class="config-note" data-keep="1" hidden>見つかりませんでした。別の言葉で試してください。</p>' +
        '<div class="pm-toolbtns"><button type="button" class="btn-compact" data-pm="open">全て開く</button><button type="button" class="btn-compact" data-pm="close">全て閉じる</button>' +
        '<button type="button" class="btn-compact" data-pm="heavy" aria-pressed="false">重い機能だけ見る</button></div>' +
        '<p class="pm-summary" id="pmSummaryText"></p>' +
        '<div id="pmUnusedBox" class="pm-unused-box" hidden></div></div>';
    if (note) note.insertAdjacentHTML("afterend", tools); else content.insertAdjacentHTML("afterbegin", tools);
    const body = document.createElement("div");
    body.className = "pm-body";
    body.id = "pmBody";
    list.parentNode.insertBefore(body, list);
    const nav = document.createElement("nav");
    nav.className = "pm-nav";
    nav.id = "pmNav";
    nav.setAttribute("aria-label", "グループの目次");
    body.appendChild(nav);
    body.appendChild(list);
    const row = content.querySelector(":scope > .modal-btn-row");
    const bar = '<div id="pmReloadBar" class="pm-reload" role="status" hidden><div class="pm-reload-main"><strong id="pmReloadText"></strong><span id="pmReloadSub"></span></div>' +
        '<div class="pm-reload-btns"><button type="button" class="btn-compact" data-pm="undo">元に戻す</button><button type="button" class="btn-compact" data-pm="reload">🔄 今すぐ再読み込み</button></div></div>';
    if (row) row.insertAdjacentHTML("beforebegin", bar); else content.insertAdjacentHTML("beforeend", bar);
    return true;
}
function pmBind() {
    const modal = $id("pluginModalOverlay");
    const inp = $id("pluginSearchInput");
    inp.addEventListener("input", () => {
        pmApplyFilter(false);
        clearTimeout(pmState.timer);
        pmState.timer = setTimeout(() => pmApplyFilter(true), 220);     // 打ち終わったら、最初の一致へ移って光らせる
    });
    inp.addEventListener("keydown", e => {
        if (e.isComposing || e.keyCode === 229) return;
        if (e.key === "Escape" && (inp.value || pmState.onlyHeavy)) { e.preventDefault(); e.stopPropagation(); inp.value = ""; pmState.onlyHeavy = false; pmApplyFilter(false); }
        else if (e.key === "Enter") { e.preventDefault(); pmFocusHit(pmState.cur + 1); }
    });
    modal.addEventListener("click", e => {
        const t = e.target;
        const go = t.closest("[data-pm-go]");
        if (go) {
            const key = go.dataset.pmGo;
            const el = key === "__required" ? document.querySelector("#pluginList .plugin-required-box") : Array.from(document.querySelectorAll("#pluginList details.plugin-group")).find(g => g.dataset.group === key);
            if (el) { el.open = true; el.scrollIntoView({ block: "start" }); pmSaveUi(); }
            return;
        }
        const nm = t.closest(".pm-name.is-link");
        if (nm) { pmJump(nm.closest(".plugin-row").dataset.pluginRow); return; }
        const b = t.closest("[data-pm]");
        if (!b) return;
        const act = b.dataset.pm;
        if (act === "open" || act === "close") {
            document.querySelectorAll("#pluginList details.plugin-group").forEach(g => { g.open = act === "open"; });
            const req = document.querySelector("#pluginList .plugin-required-box");
            if (req) req.open = act === "open";
            pmSaveUi();
        } else if (act === "heavy") { pmState.onlyHeavy = !pmState.onlyHeavy; pmApplyFilter(false); }
        else if (act === "reload") SekigaeApp.reloadNow();
        else if (act === "undo") pmUndoChanges();
        else if (act === "unused-off") pmUnusedOff();
        else if (act === "unused-later") { const ub = $id("pmUnusedBox"); ub.dataset.dismissed = "1"; pmRenderUnused(); }
    });
    modal.addEventListener("keydown", e => {
        if (e.key !== "Enter" && e.key !== " ") return;
        const go = e.target.closest && e.target.closest("[data-pm-go], .pm-name.is-link");
        if (go) { e.preventDefault(); go.click(); }
    });
    // グループの開き閉じを、保存する（検索中は、保存しない）
    $id("pluginList").addEventListener("toggle", e => {
        if (!e.target.classList || !e.target.classList.contains("plugin-group") || $id("pluginList").classList.contains("pm-searching")) return;
        pmSaveUi();
    }, true);
}

SekigaeApp.registerPlugin({
    id: "plugin-menu",
    name: "プラグインメニュー強化",
    version: "1.1",
    description: "「プラグインの設定」の画面を使いやすくします。名前や説明でさがせて、一致した文字に色が付きます。グループごとに折りたためます。切りかえた件数と「今すぐ再読み込み」を、画面の下に固定します。機能ごとに軽い・普通・重いの目安を出します。広い画面では左に目次、右に2列で並びます。名前を押すと設定の中のボタンの場所へ移ります。60日使っていない機能には印が付きます。使った回数はこの端末の中だけで数えます。",
    searchWords: "プラグイン メニュー 検索 折りたたみ 再読み込み 重さ 軽い 重い 目次 2列 ジャンプ 使っていない 未使用 整理 軽量",
    mount(app) {
        const st = document.createElement("style");
        st.id = "pluginMenuStyle";
        st.textContent = PM_CSS;
        document.head.appendChild(st);
        const ui = pmLoadUi();
        app.groupOpen = Object.assign(app.groupOpen || {}, ui.groupOpen || {});
        if (!pmBuild()) return;
        pmBind();
        const orig = app.renderPluginList.bind(app);
        app.renderPluginList = function () { orig(); pmDecorate(); };
        // 開くたびに、検索をまっさらにする
        if (typeof window.openPluginModal === "function") {
            const o = window.openPluginModal;
            window.openPluginModal = function () {
                const inp = $id("pluginSearchInput");
                if (inp) inp.value = "";
                pmState.onlyHeavy = false;
                o.apply(this, arguments);
                pmDecorate();
                const ub = $id("pmUnusedBox");
                if (ub) { ub.dataset.dismissed = ""; pmRenderUnused(); }
            };
        }
        window.pmRevealRow = pmRevealRow;
        app.insertInto("guide-tools", '<li><strong>プラグインメニュー強化</strong>：設定の「機能・プラグイン」の「プラグインの設定」で、上の検索ボックスから、名前や説明で絞れます。グループは折りたためます。切りかえた件数は画面の下に固定して出ます。機能の名前を押すと設定の中のその場所へ移ります。「軽い・普通・重い」は、起動の準備にかかった時間の目安です。60日使っていない機能には印が付きます（使った回数はこの端末の中だけで数えます）。</li>');
    },
    ready() {
        pmTrackInit();
        pmDecorate();
    }
});
