// ==========================================
// 見た目とテーマプラグイン（必須）：テーマ、季節の飾り、画面の大きさ、タイトル、見やすさの設定です。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
const APP_TITLE_DEFAULT = "席替えし太郎";

const APP_TITLE_MAX = 24;

function getAppTitleText() { return String(lsGet("app_title_text", "")).replace(/[\r\n]+/g, " ").trim().slice(0, APP_TITLE_MAX); }

function applyAppTitle() {
    const el = $id("appTitle");
    const show = lsGet("app_title_show", "1") !== "0";
    const text = getAppTitleText();
    const tx = $id("appTitleText");
    if (el && tx) { tx.textContent = text || APP_TITLE_DEFAULT; el.hidden = !show; }
    fitAppTitle();
    const inp = $id("appTitleInput");
    if (inp && document.activeElement !== inp) inp.value = text;
    const tg = $id("appTitleShowToggle");
    if (tg) tg.checked = show;
    if (typeof fitClassroomToScreen === "function") { fitClassroomToScreen(); requestAnimationFrame(fitClassroomToScreen); }
}
// タイトルが場所に入りきらない時は、左右にゆっくり動かして、全部読めるようにします

let appTitleFitTimer = null;

function fitAppTitle() {
    const el = $id("appTitle"), tx = $id("appTitleText");
    if (!el || !tx) return;
    el.classList.remove("is-marquee");
    el.style.removeProperty("--ttl-shift");
    el.style.removeProperty("--ttl-dur");
    el.removeAttribute("title");
    if (el.hidden) return;
    const noWrap = getComputedStyle(el).whiteSpace === "nowrap";
    const over = Math.ceil(tx.getBoundingClientRect().width - el.clientWidth);
    if (!noWrap || over <= 1) return;
    el.title = tx.textContent;
    const calm = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) || document.body.classList.contains("no-animation");
    if (calm) return; // 動きを減らす設定の時は、「…」で省くだけにします
    el.style.setProperty("--ttl-shift", "-" + (over + 6) + "px");
    el.style.setProperty("--ttl-dur", Math.max(3, Math.round(over / 35 + 2)) + "s");
    el.classList.add("is-marquee");
}

window.addEventListener("resize", () => { clearTimeout(appTitleFitTimer); appTitleFitTimer = setTimeout(fitAppTitle, 150); });

if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fitAppTitle());

function onAppTitleInput() {
    const inp = $id("appTitleInput");
    if (!inp) return;
    lsSet("app_title_text", inp.value.slice(0, APP_TITLE_MAX));
    applyAppTitle();
}

function onAppTitleShowToggle() {
    const tg = $id("appTitleShowToggle");
    lsSet("app_title_show", tg && tg.checked ? "1" : "0");
    applyAppTitle();
}

function applyAccessibilitySettings() {
    applyAppTitle();
    const markOn = lsGet("group_mark_on", "0") === "1";
    document.body.classList.toggle("group-mark-on", markOn);
    const markToggle = $id("groupMarkToggle");
    if (markToggle) markToggle.checked = markOn;
    const scopeSel = $id("groupMarkScopeSelect");
    if (scopeSel) scopeSel.value = getGroupMarkScope();
    let scale = parseFloat(lsGet("seat_text_scale", "1"));
    if (!SEAT_TEXT_SCALES.includes(scale)) scale = 1;
    // 文字の大きさは「ふつう」の倍率そのままにして、座席の横幅を広げます
    // 座席を番号のみで表示する時は、設定に関わらず、文字は「とても大きい」、座席の横幅は「ふつう」のままにします
    const numOnlyOn = isNumberOnlyMode();
    const shownScale = numOnlyOn ? 1.4 : scale;
    const wide = numOnlyOn ? 1 : (SEAT_TEXT_WIDE[shownScale] || 1);
    document.documentElement.style.setProperty("--seat-text-scale", String(shownScale));
    document.documentElement.dataset.seatWideBase = String(wide);
    document.documentElement.style.setProperty("--seat-wide", String(wide));
    document.documentElement.style.setProperty("--seat-ar", (4 * wide).toFixed(3) + " / 3.15");
    document.body.classList.toggle("seat-text-large", shownScale > 1);
    if (typeof fitClassroomToScreen === "function" && $id("classroom")) { fitClassroomToScreen(); requestAnimationFrame(fitClassroomToScreen); }
    const scaleSelect = $id("seatTextScaleSelect");
    if (scaleSelect) scaleSelect.value = String(scale);
}
// 班の番号と模様を出す場所： all = 座席表、発表モード、印刷と画像保存 / announce = 座席表と発表モード / seat = 座席表だけ

function adjustSlider(id, amount) {
    const slider = $id(id);
    if (!slider) return;
    let val = parseFloat(slider.value) + amount;
    val = Math.max(parseFloat(slider.min), Math.min(parseFloat(slider.max), val));
    slider.value = val;
    
    if (id === 'zoomSlider') {
        updateZoom();
    }
    if (id === 'alarmVolumeSlider') {
        updateVolumeUI();
        updateAlarmSettings(); 
    }
}

function updateZoom() {
    const slider = $id("zoomSlider");
    const text = $id("zoomValueText");
    if (!slider) return;
    
    currentZoomLevel = parseFloat(slider.value);
    document.documentElement.style.setProperty('--zoom-level', currentZoomLevel);
    localStorage.setItem("classroom_zoom", currentZoomLevel);
    
    if (text) {
        text.textContent = currentZoomLevel.toFixed(2) + "x";
    }
    const percent = ((currentZoomLevel - parseFloat(slider.min)) / (parseFloat(slider.max) - parseFloat(slider.min))) * 100;
    slider.style.setProperty('--val', percent + '%');
}

const THEME_CLASSES = ['theme-default', 'theme-dark', 'theme-sakura', 'theme-summer', 'theme-halloween', 'theme-christmas', 'theme-334', 'theme-miku', 'theme-kaizuka', 'theme-paper', 'theme-blackboard', 'theme-game', 'theme-winter', 'theme-autumn', 'theme-spring'];

const systemDarkQuery = (typeof window !== "undefined" && window.matchMedia) ? window.matchMedia("(prefers-color-scheme: dark)") : null;
// 画面に表示するテーマを決めます。「端末がダークモードの時は自動でダークモードにする」がONで、端末がダークモードなら、選んだテーマに関係なくダークモードにします。選んだテーマは、そのまま残ります。

const THEME_LABELS = { "theme-default": "デフォルト", "theme-dark": "ダークモード", "theme-sakura": "サクラ", "theme-summer": "サマー", "theme-halloween": "ハロウィン", "theme-christmas": "クリスマス", "theme-334": "33-4", "theme-miku": "ネギ", "theme-kaizuka": "カイヅカ", "theme-paper": "ペーパー", "theme-blackboard": "黒板", "theme-game": "ゲーム画面風", "theme-winter": "ウィンター", "theme-autumn": "オータム", "theme-spring": "新学期" };
// 季節おまかせ：日付から、その時期のテーマを選ぶ

function seasonThemeForDate(d) {
    const m = d.getMonth() + 1, day = d.getDate();
    if (m === 10 && day >= 25) return "theme-halloween";
    if (m === 12) return "theme-christmas";
    if (m === 1 || m === 2) return "theme-winter";
    if (m === 3) return "theme-sakura";
    if (m === 4 || m === 5) return "theme-spring";
    if (m >= 6 && m <= 8) return "theme-summer";
    return "theme-autumn";
}

function applyTheme() {
    const sel = $id("themeSelect");
    let chosen = (sel && (THEME_CLASSES.includes(sel.value) || sel.value === "theme-auto")) ? sel.value : "theme-default";
    const resolved = chosen === "theme-auto" ? seasonThemeForDate(new Date()) : chosen;
    const follow = lsGet("follow_system_dark", "0") === "1";
    const sysDark = !!(systemDarkQuery && systemDarkQuery.matches);
    const effective = (follow && sysDark) ? "theme-dark" : resolved;
    document.body.classList.remove(...THEME_CLASSES);
    document.body.classList.add(effective);
    document.documentElement.classList.toggle("boot-dark", effective === "theme-dark");
    const t = $id("followSystemDarkToggle");
    if (t) t.checked = follow;
    updateSeasonDeco();
    return { chosen, resolved, effective, auto: follow && sysDark && chosen !== "theme-dark" };
}

function changeTheme() {
    const sel = $id("themeSelect");
    if (!sel) return;
    localStorage.setItem("app_theme", sel.value);
    const r = applyTheme();
    if (r.auto) showToast("テーマを選びました。端末がダークモードの間は、ダークモードで表示します。", "success");
    else if (r.chosen === "theme-auto") showToast(`季節おまかせにしました。今は「${THEME_LABELS[r.resolved] || ""}」です。`, "success");
    else showToast("テーマを着せ替えました。", "success");
}

// ---- 季節の飾り（背景に、花びら・あわ・落ち葉・雪をゆっくり舞わせる）

const SEASON_DECO = {
    "theme-sakura": { kind: "petal", colors: ["#ffb7c5", "#ffc9d4", "#ff9fb3"] },
    "theme-spring": { kind: "petal", colors: ["#b9e39a", "#f4e07e", "#ffffff"] },
    "theme-summer": { kind: "bubble", colors: ["#0ea5e9"] },
    "theme-autumn": { kind: "leaf", colors: ["#d9480f", "#f08c00", "#c92a2a", "#a8660f"] },
    "theme-winter": { kind: "snow", colors: ["#ffffff"], edge: "rgba(100, 150, 200, 0.55)" },
    "theme-christmas": { kind: "snow", colors: ["#ffffff"], edge: "rgba(255, 255, 255, 0.0)" },
    "theme-halloween": { kind: "leaf", colors: ["#ea580c", "#a855f7", "#fb923c"] }
};

const seasonDeco = { canvas: null, ctx: null, parts: [], key: "", raf: 0, last: 0, w: 0, h: 0 };

function isSeasonDecoOn() {
    const v = lsGet("season_deco", null);
    if (v === null) { const sel = $id("themeSelect"); return !!(sel && sel.value === "theme-auto"); }
    return v === "1";
}

function onSeasonDecoToggle() {
    const t = $id("seasonDecoToggle");
    lsSet("season_deco", t && t.checked ? "1" : "0");
    updateSeasonDeco();
    const key = seasonDeco.key;
    if (t && t.checked && !key) showToast("今のテーマには飾りがありません。サクラ、新学期、サマー、オータム、ハロウィン、ウィンター、クリスマスで出ます。", "success");
}

function stopSeasonDeco() {
    if (seasonDeco.raf) cancelAnimationFrame(seasonDeco.raf);
    seasonDeco.raf = 0; seasonDeco.key = ""; seasonDeco.parts = [];
    if (seasonDeco.canvas) seasonDeco.canvas.style.display = "none";
}

function resizeSeasonDeco() {
    const cv = seasonDeco.canvas;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    seasonDeco.w = window.innerWidth; seasonDeco.h = window.innerHeight;
    cv.width = Math.round(seasonDeco.w * dpr); cv.height = Math.round(seasonDeco.h * dpr);
    seasonDeco.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function makeDecoParticle(first) {
    const w = seasonDeco.w, h = seasonDeco.h;
    return { x: Math.random() * w, y: first ? Math.random() * h : -20, r: 3 + Math.random() * 5, vy: 22 + Math.random() * 30, ph: Math.random() * 6.28, sw: 14 + Math.random() * 24, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 1.6, ci: Math.floor(Math.random() * 4) };
}

function drawDeco(cfg) {
    const ctx = seasonDeco.ctx;
    ctx.clearRect(0, 0, seasonDeco.w, seasonDeco.h);
    seasonDeco.parts.forEach(p => {
        const col = cfg.colors[p.ci % cfg.colors.length];
        ctx.save();
        ctx.translate(p.x, p.y);
        if (cfg.kind === "snow") {
            ctx.beginPath(); ctx.arc(0, 0, p.r * 0.95, 0, 6.2832); ctx.fillStyle = col; ctx.globalAlpha = 0.95; ctx.fill();
            ctx.lineWidth = 1; ctx.strokeStyle = cfg.edge; ctx.stroke();
        } else if (cfg.kind === "bubble") {
            ctx.beginPath(); ctx.arc(0, 0, p.r * 1.4, 0, 6.2832);
            ctx.fillStyle = "rgba(255, 255, 255, 0.28)"; ctx.fill();
            ctx.lineWidth = 1.2; ctx.strokeStyle = "rgba(14, 165, 233, 0.5)"; ctx.stroke();
            ctx.beginPath(); ctx.arc(-p.r * 0.45, -p.r * 0.45, p.r * 0.3, 0, 6.2832); ctx.fillStyle = "rgba(255, 255, 255, 0.85)"; ctx.fill();
        } else if (cfg.kind === "petal") {
            ctx.rotate(p.rot); ctx.globalAlpha = 0.85; ctx.fillStyle = col;
            ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.3, p.r * 0.75, 0, 0, 6.2832); ctx.fill();
        } else {
            ctx.rotate(p.rot); ctx.globalAlpha = 0.9; ctx.fillStyle = col;
            ctx.beginPath(); ctx.ellipse(0, 0, p.r * 1.7, p.r * 0.95, 0, 0, 6.2832); ctx.fill();
            ctx.strokeStyle = "rgba(60, 30, 10, 0.45)"; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-p.r * 1.7, 0); ctx.lineTo(p.r * 1.7, 0); ctx.stroke();
        }
        ctx.restore();
    });
}

function stepSeasonDeco(ts) {
    const cfg = SEASON_DECO[seasonDeco.key];
    if (!cfg) { stopSeasonDeco(); return; }
    seasonDeco.raf = requestAnimationFrame(stepSeasonDeco);
    if (document.hidden) { seasonDeco.last = ts; return; }
    if (ts - seasonDeco.last < 33) return; // 約30コマ
    const dt = Math.min(0.1, (ts - seasonDeco.last) / 1000 || 0.033);
    seasonDeco.last = ts;
    const up = cfg.kind === "bubble";
    seasonDeco.parts.forEach(p => {
        p.ph += dt * 1.2; p.rot += p.vr * dt;
        p.y += (up ? -p.vy * 0.8 : p.vy) * dt;
        p.x += Math.sin(p.ph) * p.sw * dt;
        if (!up && p.y > seasonDeco.h + 24) { Object.assign(p, makeDecoParticle(false)); }
        if (up && p.y < -24) { Object.assign(p, makeDecoParticle(false)); p.y = seasonDeco.h + 20; }
        if (p.x < -30) p.x = seasonDeco.w + 20; else if (p.x > seasonDeco.w + 30) p.x = -20;
    });
    drawDeco(cfg);
}

function updateSeasonDeco() {
    const on = isSeasonDecoOn();
    const t = $id("seasonDecoToggle");
    if (t) t.checked = on;
    const themeCls = THEME_CLASSES.find(k => document.body.classList.contains(k)) || "theme-default";
    const cfg = SEASON_DECO[themeCls];
    const reduce = !!(window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const allowed = on && cfg && !reduce && !document.body.classList.contains("no-animation");
    if (!allowed) { stopSeasonDeco(); return; }
    if (!seasonDeco.canvas) {
        const cv = document.createElement("canvas");
        cv.id = "seasonCanvas"; cv.setAttribute("aria-hidden", "true");
        document.body.appendChild(cv);
        seasonDeco.canvas = cv; seasonDeco.ctx = cv.getContext("2d");
        window.addEventListener("resize", () => { if (seasonDeco.key) { resizeSeasonDeco(); } });
    }
    seasonDeco.canvas.style.display = "block";
    if (seasonDeco.key === themeCls && seasonDeco.raf) return;
    resizeSeasonDeco();
    seasonDeco.key = themeCls;
    const n = Math.max(14, Math.min(36, Math.round(seasonDeco.w / 36)));
    seasonDeco.parts = Array.from({ length: n }, () => makeDecoParticle(true));
    if (seasonDeco.raf) cancelAnimationFrame(seasonDeco.raf);
    seasonDeco.last = 0;
    seasonDeco.raf = requestAnimationFrame(stepSeasonDeco);
}
// 全体アニメーションの切り替えなど、画面の状態が変わった時にも、飾りを合わせる

if (typeof MutationObserver !== "undefined" && typeof document !== "undefined") {
    new MutationObserver(() => updateSeasonDeco()).observe(document.body, { attributes: true, attributeFilter: ["class"] });
}

function onFollowSystemDarkToggle() {
    const t = $id("followSystemDarkToggle");
    lsSet("follow_system_dark", t && t.checked ? "1" : "0");
    applyTheme();
}

if (systemDarkQuery) {
    const onSysChange = () => { applyTheme(); };
    if (systemDarkQuery.addEventListener) systemDarkQuery.addEventListener("change", onSysChange);
    else if (systemDarkQuery.addListener) systemDarkQuery.addListener(onSysChange);
}

function toggleFullScreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            showToast(`全画面表示に失敗しました: ${err.message}`, "error");
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
}

document.addEventListener('fullscreenchange', () => {
    const btn = $id("btnFullscreen");
    const tbtn = $id("btnTopFullscreen");
    if (tbtn) tbtn.textContent = document.fullscreenElement ? "✖ 全画面表示を終える" : "全画面表示";
    if (document.fullscreenElement) {
        if (btn) btn.innerHTML = "✖ 全画面表示を終える";
        showToast("全画面モードになりました。", "success");
    } else {
        if (btn) btn.innerHTML = "全画面表示";
    }
});

// ==========================================
// アラーム・サウンド関連
// ==========================================

const EMOJI_LEAD_RE = /^(\s*)((?:\p{Extended_Pictographic}(?:\uFE0F|\u200D|\p{Emoji_Modifier})*)+)(\s*)(?=\S)/u;

const EMOJI_A11Y_SEL = "button, h3, h4, label, summary, .switch-label, .timer-section-label, .adv-title, .pop-item, option, optgroup";

function stripLeadingEmoji(text) { return String(text || "").replace(EMOJI_LEAD_RE, "").trim(); }

function wrapEmojiIn(el) {
    if (el.closest && el.closest("#classroom, .emo")) return;
    if (el.tagName === "OPTION") { const t = stripLeadingEmoji(el.textContent); if (t && t !== el.textContent.trim()) el.setAttribute("aria-label", t); else el.removeAttribute("aria-label"); return; }
    if (el.tagName === "OPTGROUP") { const t = stripLeadingEmoji(el.label); if (t && t !== el.label.trim()) el.setAttribute("aria-label", t); return; }
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: n => (!n.nodeValue.trim() || (n.parentElement && n.parentElement.closest(".emo, script, style"))) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
    const node = walker.nextNode();
    if (!node) return;
    const m = EMOJI_LEAD_RE.exec(node.nodeValue);
    if (!m) return;
    const span = document.createElement("span");
    span.className = "emo";
    span.setAttribute("aria-hidden", "true");
    span.textContent = m[2] + m[3]; // 絵文字のあとの空白も、この中に入れる（ボタンの中でも間があく）
    const rest = node.nodeValue.slice(m[0].length);
    node.nodeValue = m[1] + "";
    node.parentNode.insertBefore(span, node.nextSibling);
    node.parentNode.insertBefore(document.createTextNode(rest), span.nextSibling);
}

function wrapEmojiTree(root) {
    if (!root || root.nodeType !== 1) return;
    if (root.matches && root.matches(EMOJI_A11Y_SEL)) wrapEmojiIn(root);
    root.querySelectorAll(EMOJI_A11Y_SEL).forEach(wrapEmojiIn);
}

function setupEmojiA11y() {
    if (window.__emojiA11yOn) return;
    window.__emojiA11yOn = true;
    const pending = new Set();
    let scheduled = false;
    const flush = () => { scheduled = false; const list = Array.from(pending); pending.clear(); list.forEach(n => { if (n.isConnected) wrapEmojiTree(n); }); };
    const queue = n => {
        const el = n.nodeType === 1 ? n : n.parentElement;
        if (!el || (el.closest && el.closest(".emo, #classroom"))) return;
        const host = el.closest ? (el.closest(EMOJI_A11Y_SEL) || el) : el;
        pending.add(host);
        if (!scheduled) { scheduled = true; requestAnimationFrame(flush); }
    };
    new MutationObserver(muts => { muts.forEach(m => { if (m.type === "characterData") queue(m.target); else { queue(m.target); m.addedNodes.forEach(queue); } }); })
        .observe(document.body, { childList: true, characterData: true, subtree: true });
    wrapEmojiTree(document.body);
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "appearance",
    name: "見た目とテーマ",
    version: "1.1",
    required: true,
    description: "テーマ、季節の飾り、画面の大きさ、タイトル、見やすさの設定です。"
});
