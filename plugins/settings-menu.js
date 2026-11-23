// ==========================================
// 設定メニュープラグイン（必須）：設定メニューの開け閉め、さがす、拡大表示、使い方の検索、Enterキーでの決定です。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
function setupConfigSectionToggles() { document.querySelectorAll(".config-section").forEach((section, index) => { const heading = section.querySelector("h3"); if (!heading || heading.querySelector(".config-section-toggle")) return; const secKey = section.dataset.sec ? `config_section_${section.dataset.sec}` : `config_section_${index}`; const title = document.createElement("span"); title.className = "config-section-title"; title.textContent = heading.textContent; const button = document.createElement("button"); button.type = "button"; button.className = "config-section-toggle"; button.textContent = "∨"; button.setAttribute("aria-expanded", "false"); const body = document.createElement("div"); body.className = "config-section-body"; Array.from(section.children).forEach(child => { if (child !== heading) body.appendChild(child); }); const toggleSection = () => { const collapsed = section.classList.toggle("is-collapsed"); button.textContent = collapsed ? "∨" : "∧"; button.setAttribute("aria-expanded", String(!collapsed)); localStorage.setItem(secKey, collapsed ? "collapsed" : "open"); }; heading.onclick = toggleSection; heading.textContent = ""; heading.append(title, button); section.appendChild(body); section.classList.add("is-collapsed"); try { if (localStorage.getItem(secKey) === "open") { section.classList.remove("is-collapsed"); button.textContent = "∧"; button.setAttribute("aria-expanded", "true"); } } catch (e) {} }); }

// 設定メニュー：「くわしい設定」の開閉を覚える

let configSearchSnap = null;

function setupAdvBoxes() {
    document.querySelectorAll(".adv-box").forEach(box => {
        const key = "adv_open_" + (box.dataset.adv || "");
        try { if (localStorage.getItem(key) === "1") box.open = true; } catch (e) {}
        box.addEventListener("toggle", () => { if (configSearchSnap) return; try { localStorage.setItem(key, box.open ? "1" : "0"); } catch (e) {} });
    });
}

// 番号名簿（「番号名簿をクイック生成」で作る、「1.1番」「2.2番」…だけの名簿）かどうかを調べます

let usageSearchSnap = null;

function onUsageSearch() {
    const input = $id("usageSearchInput");
    if (!input) return;
    const terms = input.value.toLowerCase().split(/[\s　]+/).filter(Boolean).map(normalizeConfigText);
    if (terms.length === 0) { clearUsageSearch(); return; }
    const details = Array.from(document.querySelectorAll(".usage-guide .usage-group > details"));
    if (!usageSearchSnap) usageSearchSnap = details.map(d => d.open);
    let hits = 0;
    details.forEach(d => {
        const text = normalizeConfigText(d.textContent);
        const ok = terms.every(t => text.includes(t));
        d.hidden = !ok;
        if (ok) { d.open = true; hits++; }
    });
    document.querySelectorAll(".usage-guide .usage-group").forEach(g => { g.hidden = !Array.from(g.querySelectorAll(":scope > details")).some(d => !d.hidden); });
    const empty = $id("usageSearchEmpty");
    if (empty) empty.hidden = hits > 0;
}

function clearUsageSearch() {
    const input = $id("usageSearchInput");
    if (input) input.value = "";
    const empty = $id("usageSearchEmpty");
    if (empty) empty.hidden = true;
    const details = Array.from(document.querySelectorAll(".usage-guide .usage-group > details"));
    details.forEach((d, i) => { d.hidden = false; if (usageSearchSnap) d.open = !!usageSearchSnap[i]; });
    usageSearchSnap = null;
    document.querySelectorAll(".usage-guide .usage-group").forEach(g => { g.hidden = false; });
}

// 設定メニュー：言葉でさがす

function normalizeConfigText(t) { return String(t || "").toLowerCase().replace(/[\s　]+/g, ""); }
// ==========================================
// 設定メニューの拡大表示（左にセクションの一覧、右に選んだ設定を大きく出す）
// ==========================================

const CONFIG_WIDE_KEY = "config_wide";

const CONFIG_WIDE_IDX_KEY = "config_wide_idx";

let configWideObserver = null;

let configWideSig = "";

function isConfigWide() { return document.body.classList.contains("config-wide"); }

function configWideSections() { return Array.from(document.querySelectorAll("#configContainer > .config-section")); }

function configSectionAvailable(sec) {
    return sec.style.display !== "none" && !sec.hidden && !sec.classList.contains("is-search-hidden") && !sec.hasAttribute("data-plugin-off");
}

function configSectionTitle(sec) {
    const t = sec.querySelector(":scope > h3 .config-section-title") || sec.querySelector(":scope > h3");
    return t ? t.textContent.trim() : "";
}
// 左の一覧と、右に出す設定を、今の状態に合わせます（変わっていなければ、何もしません）

function refreshConfigWide() {
    if (!isConfigWide()) return;
    const cc = $id("configContainer");
    if (!cc) return;
    const all = configWideSections();
    const avail = all.filter(configSectionAvailable);
    let idx = -1;
    const cur = all.findIndex(sec => sec.classList.contains("is-wide-active"));
    if (cur >= 0 && avail.includes(all[cur])) idx = cur;
    if (idx < 0) {
        let saved = -1;
        try { saved = parseInt(lsGet(CONFIG_WIDE_IDX_KEY, "-1"), 10); } catch (e) {}
        idx = (saved >= 0 && all[saved] && avail.includes(all[saved])) ? saved : (avail.length ? all.indexOf(avail[0]) : -1);
    }
    const sig = avail.map(sec => all.indexOf(sec) + ":" + configSectionTitle(sec) + ":" + (sec.dataset.group || "")).join("|") + "#" + idx;
    if (sig === configWideSig && $id("configWideNav")) return;
    configWideSig = sig;
    let nav = $id("configWideNav");
    if (!nav) {
        nav = document.createElement("nav");
        nav.id = "configWideNav";
        nav.setAttribute("aria-label", "設定のセクション");
        const search = cc.querySelector(".config-search");
        if (search) search.insertAdjacentElement("afterend", nav); else cc.prepend(nav);
    }
    nav.innerHTML = "";
    let lastGroup = "";
    avail.forEach(sec => {
        const i = all.indexOf(sec);
        // グループが変わるところに、グループの名前を出します
        if (sec.dataset.group && sec.dataset.group !== lastGroup) {
            lastGroup = sec.dataset.group;
            const g = document.createElement("div");
            g.className = "config-nav-group";
            g.textContent = lastGroup;
            nav.appendChild(g);
        }
        const b = document.createElement("button");
        b.type = "button";
        b.className = "config-nav-item";
        b.textContent = configSectionTitle(sec);
        b.setAttribute("aria-current", i === idx ? "true" : "false");
        b.onclick = () => selectConfigWideSection(i);
        nav.appendChild(b);
    });
    all.forEach((sec, i) => sec.classList.toggle("is-wide-active", i === idx));
}

function selectConfigWideSection(i) {
    const all = configWideSections();
    if (!all[i]) return;
    all.forEach((sec, j) => sec.classList.toggle("is-wide-active", j === i));
    try { lsSet(CONFIG_WIDE_IDX_KEY, String(i)); } catch (e) {}
    configWideSig = "";
    refreshConfigWide();
    const cc = $id("configContainer");
    if (cc) cc.scrollTop = 0;
    const act = document.querySelector("#configContainer > .config-section.is-wide-active");
    if (act) act.scrollTop = 0;
}

function setConfigWide(on) {
    document.body.classList.toggle("config-wide", on);
    const btn = $id("btnConfigWide");
    if (btn) { btn.setAttribute("aria-pressed", String(on)); btn.textContent = on ? "⛶ 縮小" : "⛶ 拡大"; }
    try { lsSet(CONFIG_WIDE_KEY, on ? "1" : "0"); } catch (e) {}
    const cc = $id("configContainer");
    if (configWideObserver) { configWideObserver.disconnect(); configWideObserver = null; }
    configWideSig = "";
    if (on && cc) {
        configWideSections().forEach(sec => sec.classList.remove("is-wide-active"));
        refreshConfigWide();
        let timer = null;
        configWideObserver = new MutationObserver(() => { if (timer) return; timer = setTimeout(() => { timer = null; refreshConfigWide(); }, 30); });
        configWideObserver.observe(cc, { subtree: true, childList: true, attributes: true, attributeFilter: ["style", "hidden", "class", "data-plugin-off"] });
    } else {
        configWideSections().forEach(sec => sec.classList.remove("is-wide-active"));
        const nav = $id("configWideNav");
        if (nav) nav.remove();
    }
    cc && (cc.scrollTop = 0);
}

function toggleConfigWide() { setConfigWide(!isConfigWide()); }

function initConfigWide() {
    let on = false;
    try { on = lsGet(CONFIG_WIDE_KEY, "0") === "1"; } catch (e) {}
    if (on) setConfigWide(true);
}

function setConfigSectionCollapsed(section, collapsed) {
    section.classList.toggle("is-collapsed", collapsed);
    const btn = section.querySelector(".config-section-toggle");
    if (btn) { btn.textContent = collapsed ? "∨" : "∧"; btn.setAttribute("aria-expanded", String(!collapsed)); }
}

function onConfigSearch() {
    const input = $id("configSearchInput");
    if (!input) return;
    const terms = input.value.toLowerCase().split(/[\s　]+/).filter(Boolean);
    const sections = Array.from(document.querySelectorAll("#configContainer .config-section"));
    if (terms.length === 0) { clearConfigSearch(); return; }
    if (!configSearchSnap) {
        configSearchSnap = sections.map(sec => ({ sec, collapsed: sec.classList.contains("is-collapsed"), adv: Array.from(sec.querySelectorAll(".adv-box")).map(b => b.open) }));
    }
    let hits = 0;
    sections.forEach(sec => {
        if (sec.id === "adminSection" || sec.classList.contains("usage-section")) { sec.classList.add("is-search-hidden"); return; }
        const adv = sec.querySelector(".adv-box");
        const advText = adv ? normalizeConfigText(adv.textContent) : "";
        const tipText = Array.from(sec.querySelectorAll("[data-tip]"), el => el.dataset.tip).join(" ");
        const allText = normalizeConfigText(sec.textContent + " " + tipText + " " + (sec.dataset.kw || ""));
        const ok = terms.every(t => allText.includes(normalizeConfigText(t)));
        sec.classList.toggle("is-search-hidden", !ok);
        if (!ok) return;
        hits++;
        setConfigSectionCollapsed(sec, false);
        if (adv) adv.open = terms.some(t => advText.includes(normalizeConfigText(t)));
    });
    const empty = $id("configSearchEmpty");
    if (empty) empty.hidden = hits > 0;
    syncConfigGroupTitles();
}

// グループの名前は、その中に見える区分が1つもない時（さがした結果など）は、隠します
function syncConfigGroupTitles() {
    const secs = Array.from(document.querySelectorAll("#configContainer > .config-section[data-group]"));
    document.querySelectorAll("#configContainer > .config-group-title").forEach(t => {
        t.hidden = !secs.some(s => s.dataset.group === t.dataset.group && !s.classList.contains("is-search-hidden") && !s.hasAttribute("data-plugin-off"));
    });
}

function clearConfigSearch() {
    const input = $id("configSearchInput");
    if (input) input.value = "";
    const empty = $id("configSearchEmpty");
    if (empty) empty.hidden = true;
    document.querySelectorAll("#configContainer .config-section").forEach(sec => sec.classList.remove("is-search-hidden"));
    syncConfigGroupTitles();
    if (configSearchSnap) {
        const snap = configSearchSnap;
        configSearchSnap = null;
        snap.forEach(item => { setConfigSectionCollapsed(item.sec, item.collapsed); item.sec.querySelectorAll(".adv-box").forEach((b, i) => { b.open = !!item.adv[i]; }); });
    }
}

// 画面に出す文章から、絵文字を取り除きます。サーバーから届く文章などにも使います。

function bindEnterKey(id, action) {
    const el = $id(id);
    if (!el) return;
    el.addEventListener("keydown", function(event) {
        if (event.key !== "Enter") return;
        // 日本語などの変換確定中は適用しない（Safari の 229 対策含む）
        if (event.isComposing || event.keyCode === 229) return;
        event.preventDefault();
        action();
    });
}

function initEnterKeyHandlers() {
    // 名簿・クラス
    bindEnterKey("presetNameInput", savePreset);
    bindEnterKey("gasUrlInput", saveAndConnectGas);
    bindEnterKey("quickCountInput", generateNumbersOnlyList);

    // タイマー（通常パネル）
    bindEnterKey("customMinInput", () => handleCustomTimeSet("customMinInput", "customSecInput"));
    bindEnterKey("customSecInput", () => handleCustomTimeSet("customMinInput", "customSecInput"));
    bindEnterKey("clockTargetInput", () => setTimerToClockTime("clockTargetInput"));

    // タイマー（巨大表示）
    bindEnterKey("giantCustomMinInput", () => handleCustomTimeSet("giantCustomMinInput", "giantCustomSecInput"));
    bindEnterKey("giantCustomSecInput", () => handleCustomTimeSet("giantCustomMinInput", "giantCustomSecInput"));

    // その他の設定・モーダル
    bindEnterKey("warningPctInput", updateWarningPct);
    bindEnterKey("passwordInput", checkPassword);
    bindEnterKey("modalStudentQuickInput", findStudentInModalByQuery);
    bindEnterKey("slotNameInput", confirmSlotNameAndSave);
}

// ==========================================
// 初期化 ＆ 全体設定
// ==========================================

// 設定の窓が開いていたら、閉じます（座席を直接さわる作業に移るときに使います）
function closeConfigMenuIfOpen() {
    const cc = document.getElementById("configContainer");
    if (cc && cc.classList.contains("open")) toggleConfigMenu();
}
function toggleConfigMenu() { 
    if (isAppLocked()) { showLockedToast(); return; }
    const container = $id("configContainer");
    const btn = $id("configMenuBtn"); 
    if(!container || !btn) return;
    
    container.classList.toggle("open"); 
    if (container.classList.contains("open")) { 
        btn.textContent = "✕ 閉じる"; 
        btn.classList.add("is-open"); 
    } else { 
        btn.textContent = "⚙️ 設定"; 
        btn.classList.remove("is-open"); 
    } 
}

function toggleSmoothAnimation() { 
    const toggle = $id("smoothAnimToggle");
    if(!toggle) return;
    
    if (toggle.checked) { 
        document.body.classList.remove("no-animation"); 
        localStorage.setItem("smooth_animation", "true"); 
        showToast("演出をONにしました。", "success"); 
    } else { 
        document.body.classList.add("no-animation"); 
        localStorage.setItem("smooth_animation", "false"); 
        showToast("演出をOFFにしました。", "success"); 
    } 
}

// 軽量モード：ぼかし・影・ボタンの動きをやめて、動作を軽くします
function applyLiteMode(on) {
    document.body.classList.toggle("lite-mode", !!on);
    const t = $id("liteModeToggle");
    if (t) t.checked = !!on;
}
function toggleLiteMode() {
    const t = $id("liteModeToggle");
    if (!t) return;
    applyLiteMode(t.checked);
    localStorage.setItem("lite_mode", t.checked ? "true" : "false");
    showToast(t.checked ? "軽量モードをONにしました。" : "軽量モードをOFFにしました。", "success");
}
// 保存された設定が無い時は、動作が遅くなりやすい端末（CPUが2コア以下、またはメモリが2GB以下）だけ、自動でONにします
function initLiteMode() {
    let saved = null;
    try { saved = localStorage.getItem("lite_mode"); } catch (e) {}
    let on = saved === "true";
    if (saved === null) {
        const cores = navigator.hardwareConcurrency || 0, mem = navigator.deviceMemory || 0;
        on = (cores > 0 && cores <= 2) || (mem > 0 && mem <= 2);
    }
    applyLiteMode(on);
}

function updateStatus(state, text) { 
    const badge = $id("statusBadge");
    const label = $id("statusText");
    if (badge) badge.className = "status-badge status-" + state; 
    if (label) label.textContent = text; 
    updateStatusBadgeVisibility();
}
// GASのURLを入れていない時（GASを使っていない時）は、「未接続」や「通信エラー」の表示を隠します。オフラインモードの時は出します

function updateStatusBadgeVisibility() {
    const badge = $id("statusBadge");
    if (!badge) return;
    const gInput = $id("gasUrlInput");
    const offline = $id("offlineModeToggle");
    const usingGas = !!(gInput && gInput.value.trim());
    const isOffline = !!(offline && offline.checked);
    badge.style.display = (usingGas || isOffline) ? "" : "none";
}

function toggleOfflineMode() { 
    syncOfflineButtons(); 
    const toggle = $id("offlineModeToggle");
    if (toggle && toggle.checked) { 
        updateStatus("unconnected", "オフライン"); 
        showToast("オフラインモードにしました。", "success"); 
    } else { 
        updateStatus("unconnected", "未接続"); 
        showToast("オンラインモードにしました。", "success"); 
    } 
}

function syncOfflineButtons() { 
    const toggle = $id("offlineModeToggle");
    const isOffline = toggle ? toggle.checked : false; 
    
    const saveBtn = $id("saveSpreadsheetBtn");
    const loadBtn = $id("loadSpreadsheetBtn");
    const connectBtn = $id("connectGasBtn");
    const connectOnlyBtn = $id("connectOnlyGasBtn");
    
    if (connectOnlyBtn) connectOnlyBtn.disabled = isOffline;
    if (saveBtn) saveBtn.disabled = isOffline; 
    if (loadBtn) loadBtn.disabled = isOffline; 
    if (connectBtn) connectBtn.disabled = isOffline; 
    const histBtn = document.querySelector('button[onclick*="openHistoryModal"]');
    if (histBtn) histBtn.disabled = isOffline;
}

const GROUP_COLOR_DEFAULTS = { 1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#22c55e", 5: "#06b6d4", 6: "#3b82f6", 7: "#8b5cf6", 8: "#ec4899" };

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "settings-menu",
    name: "設定メニュー",
    version: "1.4",
    required: true,
    description: "設定メニューの開け閉め、さがす、拡大表示、使い方の検索、Enterキーでの決定です。",
    mount() {
        const liteLabel = $id("liteModeLabel");
        if (liteLabel && typeof makeInfoTip === "function" && !liteLabel.querySelector(".info-tip")) {
            liteLabel.appendChild(document.createTextNode(" "));
            liteLabel.appendChild(makeInfoTip("画面のぼかし、影、ボタンの動きをやめて、動作を軽くします。動きがもたつく時にお試しください。保存された設定が無い時は、動作が遅くなりやすい端末だけ、自動でONになります。"));
        }
        initLiteMode();
        // 拡大表示の時は、右の設定の部分だけをスクロールさせます。左の一覧と、下のクレジットは、動きません
        if (document.getElementById("settingsMenuCreditStyle")) return;
        const st = document.createElement("style");
        st.id = "settingsMenuCreditStyle";
        st.textContent = `
@media (min-width: 820px) and (min-height: 660px) {
    body.config-wide .config-container { overflow-y: hidden; }
    body.config-wide #configWideNav { align-self: stretch; min-height: 0; overflow-y: auto; scrollbar-width: thin; scrollbar-color: var(--seat-border) transparent; }
    body.config-wide .config-container > .config-section.is-wide-active { overflow-y: auto; min-height: 0; align-self: stretch; scrollbar-width: thin; scrollbar-color: var(--seat-border) transparent; }
}`;
        document.head.appendChild(st);
    }
});
