// ==========================================
// 補足説明とよく使う設定プラグイン（必須）：「i」の補足説明、「★ よく使う設定」の星、ポップアップメニューのしくみです。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
let infoTipBox = null;

let infoTipOwner = null;

function hideInfoTip() {
    if (infoTipBox) infoTipBox.classList.remove("is-show");
    if (infoTipOwner) infoTipOwner.setAttribute("aria-expanded", "false");
    infoTipOwner = null;
}

function showInfoTip(el) {
    if (!infoTipBox) {
        infoTipBox = document.createElement("div");
        infoTipBox.id = "infoTipBox";
        infoTipBox.setAttribute("role", "tooltip");
        document.body.appendChild(infoTipBox);
    }
    if (infoTipOwner && infoTipOwner !== el) infoTipOwner.setAttribute("aria-expanded", "false");
    infoTipOwner = el;
    el.setAttribute("aria-expanded", "true");
    infoTipBox.textContent = el.dataset.tip || "";
    infoTipBox.style.left = "0px";
    infoTipBox.style.top = "0px";
    infoTipBox.classList.add("is-show");
    const r = el.getBoundingClientRect();
    const bw = infoTipBox.offsetWidth, bh = infoTipBox.offsetHeight;
    const vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight;
    let left = r.left + r.width / 2 - bw / 2;
    left = Math.max(8, Math.min(left, vw - bw - 8));
    let top = r.bottom + 8;
    if (top + bh > vh - 8) top = Math.max(8, r.top - bh - 8);
    infoTipBox.style.left = left + "px";
    infoTipBox.style.top = top + "px";
}

function makeInfoTip(text) {
    const tip = document.createElement("span");
    tip.className = "info-tip";
    tip.tabIndex = 0;
    tip.setAttribute("role", "button");
    tip.setAttribute("aria-label", "補足の説明：" + text);
    tip.setAttribute("aria-expanded", "false");
    tip.dataset.tip = text;
    tip.textContent = "i";
    tip.addEventListener("mouseenter", () => showInfoTip(tip));
    tip.addEventListener("mouseleave", () => { if (document.activeElement !== tip) hideInfoTip(); });
    tip.addEventListener("focus", () => showInfoTip(tip));
    tip.addEventListener("blur", hideInfoTip);
    tip.addEventListener("click", ev => {
        ev.preventDefault(); ev.stopPropagation();
        if (infoTipOwner === tip && infoTipBox && infoTipBox.classList.contains("is-show") && document.activeElement !== tip) hideInfoTip(); else showInfoTip(tip);
    });
    tip.addEventListener("keydown", ev => { if (ev.key === "Escape") { hideInfoTip(); tip.blur(); } });
    return tip;
}

function setupInfoTips() {
    document.querySelectorAll(".config-note:not([id]):not([data-keep]), .anim-extra-note:not([id]), .backup-auto-note:not([id])").forEach(note => {
        const text = (note.textContent || "").trim();
        if (!text || note.closest("[hidden]")) return;
        const tip = makeInfoTip(text);
        let host = null;
        const prev = note.previousElementSibling;
        if (prev && prev.classList.contains("switch-container")) host = prev.querySelector(".switch-label");
        else if (prev && /^(SELECT|INPUT)$/.test(prev.tagName)) {
            const lab = prev.previousElementSibling;
            if (lab && lab.tagName === "LABEL") host = lab;
        } else if (prev && prev.classList.contains("modal-btn-row")) host = prev.querySelector(".switch-label");
        else if (prev && prev.tagName === "DIV") { const labs = prev.querySelectorAll("label"); if (labs.length === 1 && !prev.querySelector("button")) host = labs[0]; }
        if (host) { host.appendChild(document.createTextNode(" ")); host.appendChild(tip); note.remove(); return; }
        const row = document.createElement("div");
        row.className = "info-tip-row";
        row.appendChild(tip);
        note.replaceWith(row);
    });
    document.addEventListener("click", ev => { if (!ev.target.closest || !ev.target.closest(".info-tip")) hideInfoTip(); });
    window.addEventListener("scroll", hideInfoTip, true);
}

// ==========================================
// よく使う設定：設定やボタンの右の星を押すと、いちばん上の「よく使う設定」にも出る
// 元の場所には、そのまま残ります。上に出るのは、同じ動きをする写しです
// ==========================================

const FAV_KEY = "fav_settings";

function getFavIds() {
    try { const v = JSON.parse(lsGet(FAV_KEY, "[]")); return Array.isArray(v) ? v.filter(x => typeof x === "string") : []; } catch (error) { return []; }
}

let favItems = {};   // 目印 → { kind: "switch" か "button", el: 元の行かボタン, input: スイッチの入力欄 }

let favProxies = {}; // 目印 → 「よく使う設定」に出す写し

let favRefreshTimer = null;

const FAV_SKIP_BUTTONS = new Set(["animFavToggleBtn", "animFavClearBtn", "myAnimDeleteBtn", "btnRosterExportMenu", "btnPluginMenu", "btnConfigWide", "btnRenameClass", "btnDuplicateClass"]);

function favButtonEligible(b) {
    if (b.classList.contains("fav-star") || b.classList.contains("config-section-toggle")) return false;
    if (b.closest("#favSection, #adminSection, #configWideNav, .usage-section, .modal-overlay, .btn-mini-row, .slider-bottom-row, .anim-extra-row, .password-area, .pop-menu, #pluginReloadNote")) return false;
    if (FAV_SKIP_BUTTONS.has(b.id)) return false;
    if (b.textContent.trim().length < 4) return false;
    return !!(b.id || b.getAttribute("onclick"));
}

function favKeyOfButton(b) { return "btn:" + (b.id || b.getAttribute("onclick").replace(/\s+/g, "")).slice(0, 100); }

function favMakeStar(key) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "fav-star";
    star.dataset.favFor = key;
    star.addEventListener("click", ev => { ev.preventDefault(); ev.stopPropagation(); toggleFavSetting(key); });
    return star;
}

function setupFavoriteSettings() {
    const cc = $id("configContainer");
    if (!cc || $id("favSection")) return;
    const sec = document.createElement("div");
    sec.id = "favSection";
    sec.className = "config-section config-fav";
    sec.dataset.kw = "よく使う お気に入り 星";
    sec.innerHTML = `<h3>★ よく使う設定</h3><div id="favBody" class="config-fav-body"></div><p id="favEmpty" class="config-note">各設定やボタンの右にある星を押すと、ここにも出ます。元の場所にも残ります。</p>`;
    // 他の設定の箱と同じように、見出しを押して、折りたためるようにします（開いているか閉じているかは、覚えておきます）
    {
        const heading = sec.querySelector("h3");
        const title = document.createElement("span");
        title.className = "config-section-title";
        title.textContent = heading.textContent;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "config-section-toggle";
        button.textContent = "∧";
        button.setAttribute("aria-expanded", "true");
        const body = document.createElement("div");
        body.className = "config-section-body";
        Array.from(sec.children).forEach(child => { if (child !== heading) body.appendChild(child); });
        heading.textContent = "";
        heading.append(title, button);
        sec.appendChild(body);
        heading.onclick = () => {
            const collapsed = !sec.classList.contains("is-collapsed");
            setConfigSectionCollapsed(sec, collapsed);
            try { localStorage.setItem("config_section_fav", collapsed ? "collapsed" : "open"); } catch (e) {}
        };
        try { if (localStorage.getItem("config_section_fav") === "collapsed") setConfigSectionCollapsed(sec, true); } catch (e) {}
    }
    const first = cc.querySelector(".config-section");
    if (first) cc.insertBefore(sec, first); else cc.appendChild(sec);
    cc.querySelectorAll(".config-section .switch-container").forEach(row => {
        if (row.closest("#favSection") || row.closest("#adminSection") || row.closest(".usage-section") || row.closest("#pluginList")) return;
        const input = row.querySelector('input[type="checkbox"][id]');
        if (!input || favItems[input.id]) return;
        favItems[input.id] = { kind: "switch", el: row, input };
        row.appendChild(favMakeStar(input.id));
    });
    cc.querySelectorAll(".config-section button").forEach(b => {
        if (!favButtonEligible(b)) return;
        const key = favKeyOfButton(b);
        if (favItems[key]) return;
        const wrap = document.createElement("div");
        wrap.className = "fav-btn-row";
        b.parentNode.insertBefore(wrap, b);
        wrap.appendChild(b);
        const star = favMakeStar(key);
        wrap.appendChild(star);
        favItems[key] = { kind: "button", el: b, star };
    });
    applyFavPlacement();
    // 元の設定が変わった時（ほかの操作で変わった時も）、写しを合わせる
    const later = () => { clearTimeout(favRefreshTimer); favRefreshTimer = setTimeout(refreshFavMirrors, 40); };
    cc.addEventListener("click", later);
    cc.addEventListener("change", later);
    try {
        new MutationObserver(recs => { if (recs.some(r => !(r.target.closest ? r.target.closest("#favSection") : r.target.parentElement && r.target.parentElement.closest("#favSection")))) later(); })
            .observe(cc, { attributes: true, attributeFilter: ["style", "class", "hidden", "disabled", "data-plugin-off"], childList: true, characterData: true, subtree: true });
    } catch (e) { /* 何もしない */ }
}

function toggleFavSetting(key) {
    const a = getFavIds();
    const i = a.indexOf(key);
    if (i >= 0) a.splice(i, 1); else a.push(key);
    lsSet(FAV_KEY, JSON.stringify(a));
    applyFavPlacement();
}

function favMakeProxy(key) {
    const item = favItems[key];
    if (!item) return null;
    let p;
    if (item.kind === "switch") {
        p = document.createElement("div");
        p.className = "switch-container fav-mirror";
        p.innerHTML = '<label class="switch"><input type="checkbox"><span class="slider"></span></label><span class="switch-label"></span>';
        const inp = p.querySelector("input");
        inp.addEventListener("click", ev => {
            ev.preventDefault(); // 写しの見た目は、元の設定が変わってから合わせる
            item.input.click();
            setTimeout(refreshFavMirrors, 0);
        });
    } else {
        p = document.createElement("div");
        p.className = "fav-btn-row fav-mirror";
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = item.el.className;
        btn.style.cssText = item.el.style.cssText;
        btn.addEventListener("click", ev => { ev.preventDefault(); item.el.click(); setTimeout(refreshFavMirrors, 0); });
        p.appendChild(btn);
    }
    p.dataset.favKey = key;
    const star = favMakeStar(key);
    star.classList.add("is-on");
    star.textContent = "★";
    star.setAttribute("aria-pressed", "true");
    star.title = "よく使う設定から外す";
    p.appendChild(star);
    return p;
}

function applyFavPlacement() {
    const body = $id("favBody");
    if (!body) return;
    const ids = getFavIds().filter(k => favItems[k]);
    Object.keys(favItems).forEach(key => {
        const item = favItems[key];
        const star = item.kind === "switch" ? item.el.querySelector(".fav-star") : item.star;
        const want = ids.includes(key);
        if (star) {
            star.textContent = want ? "★" : "☆";
            star.classList.toggle("is-on", want);
            star.setAttribute("aria-pressed", want ? "true" : "false");
            star.title = want ? "よく使う設定から外す" : "よく使う設定にも出す";
        }
    });
    Object.keys(favProxies).forEach(key => { if (!ids.includes(key)) { favProxies[key].remove(); delete favProxies[key]; } });
    ids.forEach(key => {
        if (!favProxies[key]) favProxies[key] = favMakeProxy(key);
        body.appendChild(favProxies[key]);
    });
    const empty = $id("favEmpty");
    if (empty) empty.hidden = ids.length > 0;
    refreshFavMirrors();
}
// 写しの文字、スイッチの状態、表示と非表示を、元に合わせる

function favItemGone(item) {
    // 入っていない・オフのプラグインの設定や、いま隠れている設定は、星も出しません
    const el = item.el;
    return !el.isConnected || !!el.closest("[data-plugin-off]") || !!el.closest("[hidden]") || getComputedStyle(el).display === "none";
}

function refreshFavMirrors() {
    // 設定を閉じている間は、写しの表示を合わせる必要がありません（開いた時に、合わせ直します）。起動を軽くするための省略です
    const cfg = $id("configContainer");
    if (cfg && !cfg.classList.contains("open")) return;
    Object.keys(favItems).forEach(key => {
        const item = favItems[key];
        if (item.kind !== "button" || !item.star) return;
        const gone = favItemGone(item);
        const wrap = item.star.parentNode;
        if (wrap && wrap.classList.contains("fav-btn-row")) wrap.style.display = gone ? "none" : "";
    });
    Object.keys(favProxies).forEach(key => {
        const item = favItems[key], p = favProxies[key];
        if (!item || !p) return;
        const hidden = favItemGone(item);
        if (p.hidden !== hidden) p.hidden = hidden;
        if (item.kind === "switch") {
            const lab = item.el.querySelector(".switch-label");
            const t = lab ? lab.textContent : "";
            const pl = p.querySelector(".switch-label");
            if (pl && pl.textContent !== t) pl.textContent = t;
            const inp = p.querySelector("input");
            if (inp.checked !== item.input.checked) inp.checked = item.input.checked;
            if (inp.disabled !== item.input.disabled) inp.disabled = item.input.disabled;
        } else {
            const btn = p.querySelector("button:not(.fav-star)");
            if (btn.innerHTML !== item.el.innerHTML) btn.innerHTML = item.el.innerHTML;
            if (btn.disabled !== item.el.disabled) btn.disabled = item.el.disabled;
        }
    });
    Object.keys(favProxies).forEach(key => {
        const p = favProxies[key];
        if (!p || !favItems[key] || favItems[key].kind !== "button") return;
        const btn = p.querySelector("button:not(.fav-star)"), star = p.querySelector(".fav-star");
        if (btn && star && btn.offsetHeight > 0) { star.style.height = btn.offsetHeight + "px"; star.style.marginTop = getComputedStyle(btn).marginTop; }
    });
    // ボタンの星は、ボタンの高さと余白に合わせる
    Object.keys(favItems).forEach(key => {
        const item = favItems[key];
        if (item.kind !== "button" || !item.star) return;
        const h = item.el.offsetHeight;
        if (h > 0) { item.star.style.height = h + "px"; item.star.style.marginTop = getComputedStyle(item.el).marginTop; }
    });
}

function closePopMenus() {
    document.querySelectorAll(".pop-menu").forEach(m => { m.hidden = true; });
    document.querySelectorAll("[aria-haspopup]").forEach(b => b.setAttribute("aria-expanded", "false"));
}

function togglePopMenu(id, ev) {
    if (ev) ev.stopPropagation();
    const menu = $id(id);
    if (!menu) return;
    const willOpen = menu.hidden;
    closePopMenus();
    if (willOpen) {
        menu.hidden = false;
        const trigger = ev && ev.currentTarget;
        if (trigger) trigger.setAttribute("aria-expanded", "true");
    }
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "ui-parts",
    name: "補足説明とよく使う設定",
    version: "1.0",
    required: true,
    description: "「i」の補足説明、「★ よく使う設定」の星、ポップアップメニューのしくみです。"
});
