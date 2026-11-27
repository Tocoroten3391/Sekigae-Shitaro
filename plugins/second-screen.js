// ==========================================
// 拡張画面プラグイン：電子黒板などの拡張画面に、座席表を映します。席替えや指名は、いつもどおり、パソコン側で操作します。
// プレゼンテーションのアプリのように、手元には操作の画面、黒板側には座席表が出ます（巨大タイマーと、指名の名前も、選べば映ります）
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// ==========================================
const SCR_THEME_KEY = "second_screen_theme";          // "normal"（ふだんの色）／"dark"（黒板のように暗く）
const SCR_TIMER_KEY = "second_screen_timer";          // 巨大タイマーも映す（はじめは映す）
const SCR_NOM_KEY = "second_screen_nominate";         // 指名の名前も大きく映す（はじめは映す）
const SCR_HOLD_KEY = "second_screen_hold";            // 席替えの結果を、確認してから映す（はじめは映さな今ま止めない）
const SCR_TOPBTN_KEY = "second_screen_topbtn";        // 拡張画面がつながったら、画面の上にボタンを出す（はじめは出す）
const SCR_WINDOW_NAME = "sekigae_second_screen";
// 先生だけが見る印は、映しません
const SCR_HIDE_SELECTOR = ".seat-note, .seat-wish, .nb-badge";
const SCR_SKIP_BODY_CLASS = /^(lock-|app-locked$|sticky-)/;

let scrWin = null;
let scrObserver = null;
let scrSyncTimer = null;
let scrPollTimer = null;
let scrPaused = false;
let scrHeld = false;      // 席替えの結果の、確認待ち
let scrLastSyncAt = 0;

function scrIsOpen() {
    try { return !!scrWin && !scrWin.closed; } catch (e) { return false; }
}

function scrOpt(key) {
    const def = key === SCR_HOLD_KEY ? "0" : "1";
    return lsGet(key, def) === "1";
}

function scrOptChanged() {
    [["scrOptTimer", SCR_TIMER_KEY], ["scrOptNom", SCR_NOM_KEY], ["scrOptHold", SCR_HOLD_KEY], ["scrOptTop", SCR_TOPBTN_KEY]].forEach(([id, key]) => {
        const el = $id(id);
        if (el) lsSet(key, el.checked ? "1" : "0");
    });
    if (!scrOpt(SCR_HOLD_KEY) && scrHeld) { scrHeld = false; }
    scrSyncNow();
    scrRefreshUi();
}

function scrTheme() { return lsGet(SCR_THEME_KEY, "normal") === "dark" ? "dark" : "normal"; }

function scrSetTheme() {
    const sel = $id("scrTheme");
    lsSet(SCR_THEME_KEY, sel && sel.value === "dark" ? "dark" : "normal");
    scrSyncNow();
}

// ---- 映す側の画面（別ウィンドウ）を作る ----
function scrBuildWindow(win) {
    const doc = win.document;
    doc.open();
    doc.write('<!doctype html><html lang="ja"><head><meta charset="utf-8"><title>座席表</title></head><body class="scr-body"><div id="scrStage"><div id="classroom"></div></div><div id="giantTimeOverlay" style="display: none;"></div><div id="nominateDisplayArea" class="nominate-display-area"><div id="nominateNameDisplay" class="nominate-name-display"></div></div><div id="scrHint">ダブルクリックで全画面になります。Esc キーで、もどります。</div></body></html>');
    doc.close();
    // 本体と同じ見た目にするため、スタイルを写します
    document.querySelectorAll('link[rel="stylesheet"]').forEach(l => {
        const n = doc.createElement("link");
        n.rel = "stylesheet";
        n.href = l.href;
        n.onload = () => scrFit();      // スタイルが読み込まれた後に、大きさを合わせ直します
        doc.head.appendChild(n);
    });
    document.querySelectorAll("style").forEach(s => {
        if (s.id === "secondScreenStyle") return;
        const n = doc.createElement("style");
        n.textContent = s.textContent;
        doc.head.appendChild(n);
    });
    const mine = doc.createElement("style");
    mine.textContent = SCR_WINDOW_CSS;
    doc.head.appendChild(mine);

    const toggleFull = () => {
        try {
            if (doc.fullscreenElement) doc.exitFullscreen();
            else doc.documentElement.requestFullscreen();
        } catch (e) { /* 全画面にできなくても、そのまま続ける */ }
    };
    win.addEventListener("dblclick", toggleFull);
    win.addEventListener("keydown", e => { if (e.key === "f" || e.key === "F") toggleFull(); });
    win.addEventListener("resize", scrFit);
    win.addEventListener("pagehide", () => setTimeout(scrCheckClosed, 50));
    const hint = doc.getElementById("scrHint");
    let hintTimer = null;
    const showHint = () => { hint.classList.add("show"); clearTimeout(hintTimer); hintTimer = setTimeout(() => hint.classList.remove("show"), 4000); };
    win.addEventListener("mousemove", showHint);
    showHint();
}

const SCR_WINDOW_CSS = `
html body.scr-body { margin: 0 !important; padding: 0 !important; height: 100vh; overflow: hidden; display: flex !important; flex-direction: column !important; align-items: center !important; justify-content: center !important; }
html body.scr-body.scr-dark { background: #374151 !important; }
#scrStage { flex: none; }
html body.scr-body #classroom { margin: 0 !important; width: max-content !important; max-width: none !important; transform: none !important; transition: none !important; position: relative; }
#giantTimeOverlay button, #giantTimeOverlay .giant-timer-btn-row, #giantTimeOverlay .giant-add-wrap, #giantTimeOverlay #lapContainer, #giantTimeOverlay .btn-close-giant { display: none !important; }
html body.scr-body #giantTimeOverlay { z-index: 20; }
html body.scr-body.scr-no-nom #nominateDisplayArea { display: none !important; }
html body.scr-body #nominateDisplayArea { zoom: var(--scr-ui, 1); }
#scrHint { position: fixed; left: 50%; bottom: 18px; translate: -50% 0; background: rgba(15, 23, 42, 0.82); color: #fff; padding: 8px 18px; border-radius: 999px; font-size: 14px; opacity: 0; transition: opacity 0.4s; pointer-events: none; z-index: 10; }
#scrHint.show { opacity: 1; }`;

// ---- 本体の座席表を、別ウィンドウに写す ----
function scrClean(el) {
    el.querySelectorAll(SCR_HIDE_SELECTOR).forEach(n => n.remove());
    el.removeAttribute("draggable");
    el.querySelectorAll("[draggable]").forEach(n => n.removeAttribute("draggable"));
    [el].concat(Array.from(el.querySelectorAll("*"))).forEach(n => {
        Array.from(n.attributes).forEach(a => { if (/^on/i.test(a.name)) n.removeAttribute(a.name); });
    });
}

// 要素の中身を、そっくり写します（同じ形のところは、使い回すので、動きや点滅が、途切れません）
function scrPatchTree(src, dst) {
    const keep = new Set();
    Array.from(src.attributes).forEach(a => {
        if (/^on/i.test(a.name)) return;
        keep.add(a.name);
        if (dst.getAttribute(a.name) !== a.value) dst.setAttribute(a.name, a.value);
    });
    Array.from(dst.attributes).forEach(a => { if (!keep.has(a.name)) dst.removeAttribute(a.name); });
    const sk = src.childNodes;
    for (let i = 0; i < sk.length; i++) {
        const s = sk[i], d = dst.childNodes[i];
        if (!d || d.nodeType !== s.nodeType || (s.nodeType === 1 && d.tagName !== s.tagName)) {
            const c = s.cloneNode(true);
            if (c.nodeType === 1) scrClean(c);
            if (d) dst.replaceChild(c, d); else dst.appendChild(c);
        } else if (s.nodeType === 3) {
            if (d.nodeValue !== s.nodeValue) d.nodeValue = s.nodeValue;
        } else if (s.nodeType === 1) {
            scrPatchTree(s, d);
        }
    }
    while (dst.childNodes.length > sk.length) dst.removeChild(dst.lastChild);
}

// 巨大タイマーと、指名の名前を、映します
function scrSyncExtras(doc) {
    const timerSrc = $id("giantTimeOverlay"), timerDst = doc.getElementById("giantTimeOverlay");
    if (timerDst) {
        if (scrOpt(SCR_TIMER_KEY) && timerSrc && timerSrc.style.display !== "none") scrPatchTree(timerSrc, timerDst);
        else if (timerDst.style.display !== "none") timerDst.style.display = "none";
    }
    const nomSrc = $id("nominateNameDisplay"), nomDst = doc.getElementById("nominateNameDisplay");
    if (nomSrc && nomDst && document.body.classList.contains("nomination-active")) scrPatchTree(nomSrc, nomDst);
}

function scrIsFrozen() { return scrPaused || scrHeld; }

function scrSyncNow() {
    clearTimeout(scrSyncTimer);
    scrSyncTimer = null;
    if (!scrIsOpen()) { scrStop(); return; }
    if (scrIsFrozen()) return;
    scrLastSyncAt = Date.now();
    const src = $id("classroom");
    const doc = scrWin.document;
    const dst = doc.getElementById("classroom");
    if (!src || !dst) return;

    // 画面の色や大きさの設定（zoom は、写しません。映す側で、画面に合わせます）
    const rootStyle = (document.documentElement.getAttribute("style") || "").replace(/(^|;)\s*zoom\s*:[^;]*/g, "$1");
    if (doc.documentElement.getAttribute("style") !== rootStyle) doc.documentElement.setAttribute("style", rootStyle);
    const classes = Array.from(document.body.classList).filter(c => !SCR_SKIP_BODY_CLASS.test(c));
    classes.push("scr-body");
    if (!scrOpt(SCR_NOM_KEY)) classes.push("scr-no-nom");
    if (scrTheme() === "dark") { classes.push("scr-dark"); if (classes.indexOf("blackboard-active") < 0) classes.push("blackboard-active"); }
    const bodyClass = classes.join(" ");
    if (doc.body.className !== bodyClass) doc.body.className = bodyClass;
    const roomStyle = src.getAttribute("style") || "";
    if (dst.getAttribute("style") !== roomStyle) dst.setAttribute("style", roomStyle);

    // 座席を、1つずつ写します。同じ座席は、使い回すので、席替えの動きも、そのまま映ります
    let changed = false;
    const want = [];
    Array.from(src.children).forEach(s => {
        const clone = s.cloneNode(true);
        scrClean(clone);
        const sig = clone.className + "|" + (clone.getAttribute("style") || "") + "|" + clone.innerHTML;
        let d = s.__ssMirror;
        if (!d || d.parentNode !== dst || d.tagName !== s.tagName) {
            clone.__ssSig = sig;
            s.__ssMirror = clone;
            d = clone;
            changed = true;
        } else if (d.__ssSig !== sig) {
            if (d.className !== clone.className) d.className = clone.className;
            const st = clone.getAttribute("style") || "";
            if ((d.getAttribute("style") || "") !== st) { if (st) d.setAttribute("style", st); else d.removeAttribute("style"); }
            if (d.innerHTML !== clone.innerHTML) d.innerHTML = clone.innerHTML;
            d.__ssSig = sig;
            changed = true;
        }
        want.push(d);
    });
    const have = Array.from(dst.children);
    if (have.length !== want.length || have.some((n, i) => n !== want[i])) {
        dst.replaceChildren.apply(dst, want);
        changed = true;
    }
    scrSyncExtras(doc);
    if (changed) scrFit();
}

// 座席表が、映す画面いっぱいに見えるように、大きさを合わせます
function scrFit() {
    if (!scrIsOpen()) return;
    const doc = scrWin.document;
    const stage = doc.getElementById("scrStage");
    const room = doc.getElementById("classroom");
    if (!stage || !room) return;
    stage.style.zoom = "1";
    const w = room.offsetWidth, h = room.offsetHeight;
    if (!w || !h) return;
    const iw = scrWin.innerWidth, ih = scrWin.innerHeight;
    doc.documentElement.style.setProperty("--scr-ui", String(Math.max(1, Math.min(2.6, iw / 900))));
    const pad = Math.round(Math.min(iw, ih) * 0.03);
    const k = Math.max(0.2, Math.min(6, Math.min((iw - pad * 2) / w, (ih - pad * 2) / h)));
    stage.style.zoom = String(k);
}

function scrSyncSoon() {
    if (scrSyncTimer || !scrIsOpen()) return;
    const wait = Math.max(30, 50 - (Date.now() - scrLastSyncAt));
    scrSyncTimer = setTimeout(scrSyncNow, wait);
}

function scrStart() {
    const room = $id("classroom");
    if (!room || scrObserver) return;
    scrObserver = new MutationObserver(scrSyncSoon);
    scrObserver.observe(room, { childList: true, subtree: true, attributes: true, characterData: true });
    scrObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
    scrObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    [$id("giantTimeOverlay"), $id("nominateNameDisplay")].forEach(el => { if (el) scrObserver.observe(el, { childList: true, subtree: true, attributes: true, characterData: true }); });
    scrPollTimer = setInterval(scrCheckClosed, 1500);
}

function scrStop() {
    if (scrObserver) { scrObserver.disconnect(); scrObserver = null; }
    clearInterval(scrPollTimer);
    scrPollTimer = null;
    clearTimeout(scrSyncTimer);
    scrSyncTimer = null;
    scrPaused = false;
    scrHeld = false;
    scrWin = null;
    scrRefreshUi();
}

function scrCheckClosed() {
    if (scrWin && !scrIsOpen()) {
        scrStop();
        showToast("拡張画面の表示が閉じられました", "success");
    }
}

// ---- 開く・閉じる・一時止める ----
let scrFoundExtended = null;   // 拡張画面が見つかったか（null は、まだ調べていない）

async function scrMoveToExtended(win) {
    try {
        if (!(window.screen && window.screen.isExtended) || typeof window.getScreenDetails !== "function") { scrFoundExtended = false; return; }
        const details = await window.getScreenDetails();
        const cur = details.currentScreen;
        const other = details.screens.find(s => s.availLeft !== cur.availLeft || s.availTop !== cur.availTop);
        if (!other) { scrFoundExtended = false; return; }
        win.moveTo(other.availLeft, other.availTop);
        win.resizeTo(other.availWidth, other.availHeight);
        scrFoundExtended = true;
        setTimeout(scrFit, 300);
    } catch (e) { scrFoundExtended = false; }
    scrRefreshUi();
}

function scrToggle() {
    if (scrIsOpen()) { scrClose(); return; }
    // ポップアップが止められないように、押したその場で、先にウィンドウを開きます
    let win = null;
    try { win = window.open("", SCR_WINDOW_NAME, "popup=yes,width=1100,height=680"); } catch (e) { win = null; }
    if (!win) { showToast("別ウィンドウが開けませんでした。ブラウザのポップアップを、許可してください。", "error"); return; }
    scrWin = win;
    scrPaused = false;
    scrHeld = false;
    scrFoundExtended = null;
    try { scrBuildWindow(win); } catch (e) { console.warn("拡張画面の準備に失敗しました:", e); try { win.close(); } catch (e2) { /* 何もしない */ } scrWin = null; showToast("拡張画面を開けませんでした", "error"); return; }
    scrStart();
    scrSyncNow();
    scrRefreshUi();
    closePopMenus();
    scrMoveToExtended(win).then(() => {
        scrRefreshUi();
        showToast(scrFoundExtended ? "拡張画面に座席表を映しました。ダブルクリックで全画面になります。" : "別ウィンドウに座席表を映しました。拡張画面に動かして、ダブルクリックで全画面にしてください。", "success");
    });
}

function scrClose() {
    const w = scrWin;
    scrStop();
    try { if (w) w.close(); } catch (e) { /* 何もしない */ }
    showToast("拡張画面への表示をやめました", "success");
}

// 席替えが始まったら、結果を確認するまで、拡張画面を止めておきます
document.addEventListener("sekigae:shuffle-start", () => {
    if (scrIsOpen() && scrOpt(SCR_HOLD_KEY) && !scrHeld) {
        scrHeld = true;
        scrRefreshUi();
    }
});

function scrRelease() {
    if (!scrHeld) return;
    scrHeld = false;
    scrSyncNow();
    scrRefreshUi();
    showToast("席替えの結果を拡張画面に映しました", "success");
}

function scrTogglePause() {
    if (!scrIsOpen()) return;
    scrPaused = !scrPaused;
    scrRefreshUi();
    if (scrPaused) showToast("拡張画面を今の表示のまま止めました", "success");
    else { scrSyncNow(); showToast("拡張画面の表示を再開しました", "success"); }
}

function scrUpdateTopButtons() {
    const open = scrIsOpen();
    const ext = !!(window.screen && window.screen.isExtended);
    const top = $id("btnTopScreen"), rel = $id("btnTopScreenRelease");
    if (top) {
        top.style.display = (scrOpt(SCR_TOPBTN_KEY) && (ext || open)) ? "" : "none";
        top.textContent = open ? "🖥️ 映し中" : "拡張画面へ";
        top.title = open ? "拡張画面を前に出します。やめる時は設定か「他の操作」から、やめてください。" : "拡張画面に座席表を映します。";
    }
    if (rel) rel.style.display = (open && scrHeld) ? "" : "none";
}

function scrTopButton() {
    if (scrIsOpen()) { try { scrWin.focus(); } catch (e) { /* 何もしない */ } return; }
    scrToggle();
}

function scrRefreshUi() {
    scrUpdateTopButtons();
    [["scrOptTimer", SCR_TIMER_KEY], ["scrOptNom", SCR_NOM_KEY], ["scrOptHold", SCR_HOLD_KEY], ["scrOptTop", SCR_TOPBTN_KEY]].forEach(([id, key]) => { const el = $id(id); if (el) el.checked = scrOpt(key); });
    const open = scrIsOpen();
    const b = $id("btnSsOpen"), p = $id("btnSsPause"), m = $id("btnSsMenu"), st = $id("scrStatus"), t = $id("scrTheme");
    if (b) b.textContent = open ? "拡張画面への表示をやめる" : "拡張画面に座席表を映す";
    if (m) m.textContent = open ? "拡張画面に映すのをやめる" : "拡張画面に映す";
    if (p) { p.disabled = !open; p.textContent = scrPaused ? "▶️ 映すのを、再開する" : "映すのを一時止める"; }
    if (t) t.value = scrTheme();
    if (st) {
        if (!open) st.textContent = "今は映していません";
        else if (scrHeld) st.textContent = "席替えの結果を確認しています。画面の上の「結果を映す」を押すと拡張画面に映ります。";
        else if (scrPaused) st.textContent = "一時止めています。拡張画面には止めた時の座席表が出たままです。";
        else if (scrFoundExtended === false) st.textContent = "別ウィンドウに映しています（拡張画面は見つかりませんでした）";
        else st.textContent = "拡張画面に映しています。席替えや指名はこのまま、操作できます。";
    }
}

window.addEventListener("pagehide", () => { try { if (scrWin && !scrWin.closed) scrWin.close(); } catch (e) { /* 何もしない */ } });

const SCR_CSS = `
.scr-box { margin-top: 12px; padding: 12px; border: 1px solid var(--seat-border, #cbd5e1); border-radius: 12px; }
.scr-box .scr-head { font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.scr-box button { margin-top: 6px; }
.scr-box .scr-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 10px; }
.scr-box .scr-row .switch-label { flex: 1 1 0; min-width: 0; white-space: normal; font-size: 13px; text-align: left; }
.scr-box .scr-row .scr-label-wrap { flex: 1 1 0; min-width: 0; }
.scr-box .scr-row .switch { flex: 0 0 auto; }
.scr-box .scr-row select { flex: 1 1 0; min-width: 0; width: auto; }
.scr-box .scr-row .scr-label-wrap { display: flex; align-items: center; gap: 4px; font-size: 13px; text-align: left; }
html body #topBarContainer button.scr-attn { border: 2px solid #f59e0b !important; background: #fef3c7 !important; background-image: none !important; color: #92400e !important; font-weight: 700 !important; animation: scrAttn 1.2s ease-in-out infinite; }
@keyframes scrAttn { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.8); } 50% { box-shadow: 0 0 0 8px rgba(245,158,11,0); } }
@media (prefers-reduced-motion: reduce) { .scr-attn { animation: none; } }
.scr-box #scrStatus { margin-top: 10px; font-size: 13px; opacity: 0.85; }`;

SekigaeApp.registerPlugin({
    id: "second-screen",
    name: "拡張画面",
    version: "1.2",
    description: "電子黒板などの拡張画面に、座席表を映します（巨大タイマーと指名の名前も選べます）。席替えや指名は手元のパソコンで操作できます。",
    backupKeys: [SCR_THEME_KEY, SCR_TIMER_KEY, SCR_NOM_KEY, SCR_HOLD_KEY, SCR_TOPBTN_KEY],
    searchWords: "拡張画面 電子黒板 モニター 2画面 外部ディスプレイ プロジェクター 座席表だけ 映す 別ウィンドウ プレゼン 発表者 タイマー 指名 確認 結果 先に見る",
    mount(app) {
        app.insertInto("guide-faq", "<li data-plugin=\"second-screen\"><strong>電子黒板には座席表を映して、手元で操作したい</strong>：拡張画面がつながると画面の上に「拡張画面へ」が出ます。設定の「拡張画面に座席表を映す」や、「他の操作」の「拡張画面に映す」からも開けます。電子黒板側には座席表が出て、席替えや指名は手元のパソコンでいつもどおりできます。巨大タイマーと指名の名前も映せます。席替えの結果を先に見たい時は、設定の「席替えの結果を確認してから映す」をオンにしてください。</li>");
        const st = document.createElement("style");
        st.id = "secondScreenStyle";
        st.textContent = SCR_CSS;
        document.head.appendChild(st);
        app.insertInto("settings-display",
            '<div class="scr-box" data-plugin="second-screen">' +
            '<div class="scr-head">拡張画面<span id="scrInfoSlot"></span></div>' +
            '<button type="button" class="btn-secondary" id="btnSsOpen" onclick="scrToggle()">拡張画面に座席表を映す</button>' +
            '<button type="button" class="btn-secondary" id="btnSsPause" onclick="scrTogglePause()" disabled>映すのを一時止める</button>' +
            '<div class="scr-row"><span class="switch-label">巨大タイマーも映す</span><label class="switch"><input type="checkbox" id="scrOptTimer" onchange="scrOptChanged()"><span class="slider"></span></label></div>' +
            '<div class="scr-row"><span class="switch-label">指名の名前も大きく映す</span><label class="switch"><input type="checkbox" id="scrOptNom" onchange="scrOptChanged()"><span class="slider"></span></label></div>' +
            '<div class="scr-row"><span class="scr-label-wrap">席替えの結果を確認してから映す<span id="scrHoldInfoSlot"></span></span><label class="switch"><input type="checkbox" id="scrOptHold" onchange="scrOptChanged()"><span class="slider"></span></label></div>' +
            '<div class="scr-row"><span class="switch-label">つながったら、画面の上にボタンを出す</span><label class="switch"><input type="checkbox" id="scrOptTop" onchange="scrOptChanged()"><span class="slider"></span></label></div>' +
            '<div class="scr-row"><label for="scrTheme" class="switch-label">映す色</label><select id="scrTheme" onchange="scrSetTheme()"><option value="normal">ふだんの色</option><option value="dark">黒板のように暗く</option></select></div>' +
            '<div id="scrStatus"></div>' +
            '</div>');
        const slot = $id("scrInfoSlot");
        if (slot && typeof makeInfoTip === "function") slot.appendChild(makeInfoTip("電子黒板や大型モニターなどの拡張画面に、座席表を映します。パソコンの画面にはいつもの操作画面が出たままなので、席替えや指名は手元で操作できます。付箋、希望のしるし、発言の回数など、先生だけが見る印は映りません。巨大タイマーを出した時は、拡張画面にもタイマーが出ます（ボタンは映りません）。拡張画面がつながっていない時は、普通の別ウィンドウで開くので、黒板の画面へ動かして、ダブルクリックで全画面にしてください。「一時止める」を押すと席替えの準備をしている間、今の表示のままにできます。"));
        const hslot = $id("scrHoldInfoSlot");
        if (hslot && typeof makeInfoTip === "function") hslot.appendChild(makeInfoTip("オンにすると席替えを始めた時に拡張画面を前の座席表のまま止めます。結果はパソコンの画面で確認できます。よければ、画面の上に出る「結果を映す」を押すと拡張画面に新しい座席表が出ます。"));
        const topFull = $id("btnTopFullscreen");
        if (topFull && !$id("btnTopScreen")) {
            const tb = document.createElement("button");
            tb.type = "button"; tb.id = "btnTopScreen"; tb.className = "btn-secondary btn-rounded-box";
            tb.setAttribute("data-plugin", "second-screen");
            tb.style.cssText = "padding: 8px 12px; display: none;";
            tb.onclick = scrTopButton;
            topFull.insertAdjacentElement("afterend", tb);
            const rb = document.createElement("button");
            rb.type = "button"; rb.id = "btnTopScreenRelease"; rb.className = "btn-secondary btn-rounded-box scr-attn";
            rb.setAttribute("data-plugin", "second-screen");
            rb.style.cssText = "padding: 8px 12px; display: none;";
            rb.textContent = "結果を映す";
            rb.onclick = scrRelease;
            tb.insertAdjacentElement("afterend", rb);
        }
        try { window.screen.addEventListener("change", scrUpdateTopButtons); } catch (e) { /* 対応していない時は、何もしない */ }
        window.addEventListener("focus", scrUpdateTopButtons);
        const more = $id("moreMenu");
        if (more && !$id("btnSsMenu")) {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.id = "btnSsMenu";
            btn.className = "pop-item pop-item-gray";
            btn.setAttribute("data-plugin", "second-screen");
            btn.onclick = scrToggle;
            more.insertBefore(btn, more.firstChild);
        }
        scrRefreshUi();
    },
    ready() { scrRefreshUi(); }
});
