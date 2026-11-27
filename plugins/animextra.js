// ==========================================
// 演出のお気に入りと一覧プラグイン：演出の速さ、お気に入り、マイ演出、演出とテーマの一覧を使えます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="animextra" で結びついていて、自動で隠れます）
// ==========================================
function getAnimSpeed() {
    const v = parseFloat(lsGet("shuffle_anim_speed", "1"));
    return (v === 0.7 || v === 1.3) ? v : 1;
}
function onAnimSpeedChange() {
    const sel = $id("animSpeedSelect");
    if (sel) lsSet("shuffle_anim_speed", sel.value);
}
function getFavAnims() {
    try {
        const list = JSON.parse(lsGet("shuffle_anim_favs", "[]"));
        return Array.isArray(list) ? list.filter(v => typeof v === "string") : [];
    } catch (error) { return []; }
}
function saveFavAnims(list) { lsSet("shuffle_anim_favs", JSON.stringify(list)); }
function getAnimBaseLabel(opt) {
    if (opt.dataset.baseLabel === undefined) opt.dataset.baseLabel = opt.textContent;
    return opt.dataset.baseLabel;
}

// お気に入りの印（）を選択肢に付けて、「おまかせ」の説明も合わせる
function refreshFavAnimUI() {
    const sel = $id("animationSelect");
    if (!sel) return;
    const favs = getFavAnims();
    Array.from(sel.options).forEach(opt => {
        const base = getAnimBaseLabel(opt);
        if (opt.value === "random") opt.textContent = favs.length > 0 ? "🎲 お気に入りからランダム" : (getRandomScope() !== "all" ? `🎲 ${RANDOM_SCOPE_LABELS[getRandomScope()]}からランダム` : base);
        else opt.textContent = (favs.includes(opt.value) ? "★ " : "") + base;
    });
    const isFav = favs.includes(sel.value);
    const btn = $id("animFavToggleBtn");
    if (btn) {
        const canFav = sel.value !== "none" && sel.value !== "random";
        btn.disabled = !canFav;
        btn.classList.toggle("is-fav", isFav);
        btn.textContent = isFav ? "💔 お気に入りから外す" : "選んでいる演出をお気に入りにする";
    }
    const names = favs.map(v => {
        const o = Array.from(sel.options).find(opt => opt.value === v);
        return o ? getAnimBaseLabel(o).replace(/^\S+\s*(\d+\.\s*)?/, "") : "";
    }).filter(Boolean);
    const sum = $id("animFavSummary");
    if (sum) {
        sum.textContent = names.length > 0
            ? `お気に入り${names.length}個：${names.join("、")}。「お気に入りからランダム」では、この中から選びます。`
            : "お気に入りにした演出だけを、ランダムで出せます。まだ選んでいません。選ぶまでは、全部の演出から選びます。";
    }
    const clr = $id("animFavClearBtn");
    if (clr) clr.style.display = names.length > 0 ? "" : "none";
}
function toggleFavAnim() {
    const sel = $id("animationSelect");
    if (!sel || sel.value === "none" || sel.value === "random") { showToast("お気に入りにする演出を、先に選んでください。", "error"); return; }
    let favs = getFavAnims();
    const was = favs.includes(sel.value);
    favs = was ? favs.filter(v => v !== sel.value) : favs.concat(sel.value);
    saveFavAnims(favs);
    refreshFavAnimUI();
    if (!was && sel.value === "slotstop") showToast("お気に入りに入れました。ただし、自分で止めるスロットは、ランダムには出ません。", "success");
    else showToast(was ? "お気に入りから外しました。" : "お気に入りに入れました。", "success");
}
function clearFavAnims() {
    saveFavAnims([]);
    refreshFavAnimUI();
    showToast("お気に入りを全て外しました。", "success");
}

// ---- マイ演出（演出・速さ・効果音のセットに名前を付けて保存）
const MY_ANIM_MAX = 10;
function loadMyAnims() {
    try {
        const list = JSON.parse(lsGet("shuffle_anim_presets", "[]"));
        return Array.isArray(list) ? list.filter(p => p && p.id && p.name && p.type) : [];
    } catch (error) { return []; }
}
function saveMyAnims(list) { lsSet("shuffle_anim_presets", JSON.stringify(list)); }
function refreshMyAnimUI(selectId) {
    const sel = $id("myAnimSelect");
    if (!sel) return;
    const list = loadMyAnims();
    const keep = selectId !== undefined ? selectId : sel.value;
    sel.innerHTML = '<option value="">保存したマイ演出を選ぶ</option>' + list.map(p => `<option value="${escapeStatsHtml(p.id)}">${escapeStatsHtml(p.name)}</option>`).join("");
    sel.value = list.some(p => p.id === keep) ? keep : "";
    const del = $id("myAnimDeleteBtn");
    if (del) del.style.display = sel.value ? "" : "none";
}
function saveMyAnim() {
    const animSel = $id("animationSelect");
    const nameInput = $id("myAnimName");
    if (!animSel) return;
    const name = (nameInput ? nameInput.value : "").trim();
    if (!name) { showToast("マイ演出の名前を入力してください。", "error"); return; }
    const snd = $id("shuffleSoundToggle");
    const spd = $id("animSpeedSelect");
    const item = { id: "", name: name, type: animSel.value, speed: parseFloat(spd ? spd.value : "1") || 1, sound: !!(snd && snd.checked) };
    const list = loadMyAnims();
    const same = list.find(p => p.name === name);
    if (same) { item.id = same.id; Object.assign(same, item); }
    else {
        if (list.length >= MY_ANIM_MAX) { showToast(`マイ演出は、${MY_ANIM_MAX}個まで保存できます。いらないものを削除してください。`, "error"); return; }
        item.id = "my_" + Date.now().toString(36);
        list.push(item);
    }
    saveMyAnims(list);
    if (nameInput) nameInput.value = "";
    refreshMyAnimUI(item.id);
    showToast(`マイ演出「${name}」を${same ? "上書き" : ""}保存しました。`, "success");
}
function applyMyAnim() {
    const sel = $id("myAnimSelect");
    const del = $id("myAnimDeleteBtn");
    const p = loadMyAnims().find(x => x.id === (sel ? sel.value : ""));
    if (del) del.style.display = p ? "" : "none";
    if (!p) return;
    const animSel = $id("animationSelect");
    if (animSel && Array.from(animSel.options).some(o => o.value === p.type)) { animSel.value = p.type; onShuffleAnimationChange(); }
    const spd = $id("animSpeedSelect");
    if (spd) { spd.value = String(p.speed); onAnimSpeedChange(); }
    const snd = $id("shuffleSoundToggle");
    if (snd) { snd.checked = !!p.sound; lsSet("shuffle_sound", String(!!p.sound)); }
    refreshFavAnimUI();
    showToast(`マイ演出「${p.name}」に切り替えました。`, "success");
}
function deleteMyAnim() {
    const sel = $id("myAnimSelect");
    const id = sel ? sel.value : "";
    const list = loadMyAnims();
    const target = list.find(p => p.id === id);
    if (!target) return;
    if (!confirm(`マイ演出「${target.name}」を削除します。よろしいですか？`)) return;
    saveMyAnims(list.filter(p => p.id !== id));
    refreshMyAnimUI("");
    showToast("マイ演出を削除しました。", "success");
}

// ==========================================
// 前回との比較（動いた人・同じ席の人がひと目でわかる）
// ==========================================
let galleryKind = "";
function closeGallery() {
    const dock = $id("galleryDock");
    if (dock) { dock.hidden = true; dock.innerHTML = ""; }
    galleryKind = "";
}
function galleryHead(title, sub) {
    return `<div class="gal-head"><b>${escapeStatsHtml(title)}</b><span class="gal-sub">${escapeStatsHtml(sub)}</span><button type="button" class="gal-close" onclick="closeGallery()">✕ 閉じる</button></div>`;
}
function toggleAnimGallery() {
    if (galleryKind === "anim") { closeGallery(); return; }
    if (isAppLocked()) { showLockedToast(); return; }
    galleryKind = "anim";
    renderAnimGallery();
}
function renderAnimGallery() {
    const dock = $id("galleryDock"), sel = $id("animationSelect");
    if (!dock || !sel || galleryKind !== "anim") return;
    const keep = dock.scrollTop;
    const cur = sel.value, favs = getFavAnims();
    let html = galleryHead("演出を一覧で試す", "名前を押すと、今の席で試せます。✔ で、その演出にします。★ で、お気に入りに入れます。");
    html += '<div class="gal-body">';
    Array.from(sel.children).forEach(g => {
        if (g.tagName !== "OPTGROUP") return;
        const opts = Array.from(g.children).filter(o => o.value !== "random" && o.value !== "none");
        if (opts.length === 0) return;
        html += `<div class="gal-group-title">${escapeStatsHtml(g.label)}</div><div class="gal-grid">`;
        opts.forEach(o => {
            const v = o.value, label = getAnimBaseLabel(o), isFav = favs.includes(v), isCur = v === cur;
            html += `<div class="gal-card${isCur ? " is-current" : ""}">` +
                `<button type="button" class="gal-try" onclick="galleryTryAnim('${v}')">${escapeStatsHtml(label)}</button>` +
                `<button type="button" class="gal-pick${isCur ? " is-on" : ""}" aria-label="この演出にする" aria-pressed="${isCur}" onclick="galleryPickAnim('${v}')">${isCur ? "✔" : "○"}</button>` +
                `<button type="button" class="gal-fav${isFav ? " is-fav" : ""}" aria-label="お気に入り" aria-pressed="${isFav}" onclick="galleryFavAnim('${v}')">${isFav ? "★" : "☆"}</button></div>`;
        });
        html += "</div>";
    });
    html += "</div>";
    dock.innerHTML = html;
    dock.hidden = false;
    dock.scrollTop = keep;
}
function galleryTryAnim(v) {
    if (isAppLocked()) { showLockedToast(); return; }
    previewShuffleAnimation(v);
}
function galleryPickAnim(v) {
    const sel = $id("animationSelect");
    if (!sel) return;
    sel.value = v;
    onShuffleAnimationChange();
    renderAnimGallery();
    showToast(`席替えの演出を「${getAnimBaseLabel(sel.selectedOptions[0]).replace(/^\S+\s*(\d+\.\s*)?/, "")}」にしました。`, "success");
}
function galleryFavAnim(v) {
    let favs = getFavAnims();
    const was = favs.includes(v);
    favs = was ? favs.filter(x => x !== v) : favs.concat(v);
    saveFavAnims(favs);
    refreshFavAnimUI();
    renderAnimGallery();
    if (!was && v === "slotstop") showToast("お気に入りに入れました。ただし、自分で止めるスロットは、ランダムには出ません。", "success");
}

// テーマの色の見本（実際の表示から読み取った値：背景、座席、文字、強調、枠、背景の模様）
const THEME_SWATCH = {"theme-default": ["#f8fafc", "#ffffff", "#1e293b", "#3b82f6", "#e2e8f0", ""], "theme-dark": ["#121212", "#1e1e1e", "#f8fafc", "#38bdf8", "#334155", ""], "theme-sakura": ["#fff5f7", "#ffffff", "#5d2b3a", "#ff8fa3", "#ffcad4", ""], "theme-spring": ["#ecf8e8", "#ffffff", "#23422b", "#2f8f3e", "#c9e8c5", "linear-gradient(rgb(245, 253, 240) 0%, rgb(222, 242, 217) 100%)"], "theme-summer": ["#e0f2fe", "#ffffff", "#0c4a6e", "#facc15", "#bae6fd", ""], "theme-autumn": ["#f6e3cb", "#fff8ef", "#4a2511", "#c2410c", "#e6c8a4", "linear-gradient(rgb(251, 233, 211) 0%, rgb(242, 208, 166) 100%)"], "theme-winter": ["#e6f0f8", "#ffffff", "#1d3a52", "#2f78b7", "#c2d8ea", "linear-gradient(rgb(243, 249, 253) 0%, rgb(219, 233, 244) 100%)"], "theme-halloween": ["#1a103d", "#2d1e5e", "#fb923c", "#ea580c", "#4c1d95", ""], "theme-christmas": ["#064e3b", "#065f46", "#ffffff", "#ef4444", "#34d399", "repeating-linear-gradient(90deg, #6e2b33 0, #6e2b33 10px, #e9e4d8 10px, #e9e4d8 13px, #0b3d30 13px, #0b3d30 26px, #e9e4d8 26px, #e9e4d8 29px)"], "theme-paper": ["#f4eddc", "#fffaf0", "#3b3226", "#9a6b2f", "#dccfae", ""], "theme-blackboard": ["#1d3a2e", "#26493a", "#f3f1e6", "#f5d76e", "#5b866d", ""], "theme-game": ["#060818", "#0e1a66", "#ffffff", "#4dffb0", "#c9d4ff", ""], "theme-334": ["#0a0a0a", "#1a1a1a", "#ffe100", "#ffe100", "#4d4000", ""], "theme-miku": ["#eafaf7", "#ffffff", "#0b5e57", "#39c5bb", "#b6ebe3", ""], "theme-kaizuka": ["#f3f6ec", "#ffffff", "#26401c", "#3f7d20", "#c3d3a8", ""]};
function toggleThemeGallery() {
    if (galleryKind === "theme") { closeGallery(); return; }
    if (isAppLocked()) { showLockedToast(); return; }
    galleryKind = "theme";
    renderThemeGallery();
}
function themeSwatchHtml(v) {
    if (v === "theme-auto") {
        const bgs = ["theme-sakura", "theme-summer", "theme-autumn", "theme-winter"].map(k => THEME_SWATCH[k][0]);
        const stops = bgs.map((c, i) => `${c} ${i * 25}%, ${c} ${(i + 1) * 25}%`).join(", ");
        return `<span class="gal-swatch" style="background: linear-gradient(90deg, ${stops});"><span class="gal-seat" style="background:#fff; border-color:#cbd5e1;"><i style="background:#475569"></i></span><span class="gal-seat" style="background:#fff; border-color:#cbd5e1;"><i style="background:#475569"></i></span></span>`;
    }
    const t = THEME_SWATCH[v];
    if (!t) return '<span class="gal-swatch"></span>';
    const bg = t[5] ? `background-color: ${t[0]}; background-image: ${t[5]};` : `background: ${t[0]};`;
    const seat = `<span class="gal-seat" style="background:${t[1]}; border-color:${t[4]};"><i style="background:${t[2]}"></i></span>`;
    return `<span class="gal-swatch" style="${bg}">${seat}${seat}${seat}<span class="gal-dot" style="background:${t[3]}"></span></span>`;
}
function renderThemeGallery() {
    const dock = $id("galleryDock"), sel = $id("themeSelect");
    if (!dock || !sel || galleryKind !== "theme") return;
    const keep = dock.scrollTop;
    let html = galleryHead("テーマを一覧で見る", "押すと、すぐに着せ替わります。");
    html += '<div class="gal-body">';
    Array.from(sel.children).forEach(g => {
        if (g.tagName !== "OPTGROUP") return;
        html += `<div class="gal-group-title">${escapeStatsHtml(g.label)}</div><div class="gal-themes">`;
        Array.from(g.children).forEach(o => {
            const v = o.value, isCur = sel.value === v;
            html += `<button type="button" class="gal-theme${isCur ? " is-current" : ""}" aria-pressed="${isCur}" onclick="galleryPickTheme('${v}')">${themeSwatchHtml(v)}<span class="gal-name">${escapeStatsHtml(o.textContent.trim())}</span></button>`;
        });
        html += "</div>";
    });
    html += "</div>";
    dock.innerHTML = html;
    dock.hidden = false;
    dock.scrollTop = keep;
}
function galleryPickTheme(v) {
    const sel = $id("themeSelect");
    if (!sel) return;
    sel.value = v;
    changeTheme();
    renderThemeGallery();
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "animextra",
    name: "演出のお気に入りと一覧",
    version: "1.0",
    description: "演出の速さ、お気に入り、マイ演出、演出とテーマの一覧を使えます。",
    stubs: ["getAnimSpeed", "getFavAnims", "refreshFavAnimUI", "refreshMyAnimUI"]
});
