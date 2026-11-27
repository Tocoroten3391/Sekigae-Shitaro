// ==========================================
// 案内ツアープラグイン：はじめて使う人に、「席替え → 結果の確認 → 保存」まで、画面の上で順に案内します。
// はじめて開いた時と、「かんたん」の構成に切りかえた時に、案内をはじめるか、たずねます。設定の「しくみ」から、いつでも、もう一度見られます
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// ==========================================
const TOUR_DONE_KEY = "tour_done_v1";
const TOUR_FORCE_KEY = "tour_force_v1";   // 「簡単」に切りかえた時に立てる目印

let tourSteps = [];
let tourIndex = -1;
let tourTimer = null;
let tourShuffled = false;

function tourHasRoster() {
    return !!(currentStudents && currentStudents.some(s => s && s.type === "STUDENT"));
}

function tourVisible(sel) {
    const el = sel ? document.querySelector(sel) : null;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return (r.width > 0 && r.height > 0) ? el : null;
}

function tourBuildSteps() {
    const hasRoster = tourHasRoster();
    const steps = [];
    steps.push({
        sel: "#classroom",
        title: hasRoster ? "座席表" : "はじめに名簿を用意します",
        text: hasRoster
            ? "席替えの結果はここに出ます。席はドラッグで手で入れ替えることもできます。"
            : "「人数だけで始める」か「サンプルのクラスで試す」が手軽です。名簿ができると次に進みます。",
        until: hasRoster ? null : tourHasRoster
    });
    steps.push({
        sel: "#btnMainShuffle",
        title: "席替えをする",
        text: "「席替えスタート！」を押すと席替えが始まります。押してみましょう。終わると次に進みます。",
        until: () => tourShuffled
    });
    if ($id("btnSeatCheck")) {
        steps.push({
            sel: "#btnMoreMenu",
            title: "結果を確認する",
            text: "席替えの後は「他の操作」の「結果のチェック」で、前回と同じ席になっていないか、設定を守れているかを確かめられます。"
        });
    }
    steps.push({
        sel: "#configMenuBtn",
        title: "保存する",
        text: ($id("btnSavePng") ? "座席表は「他の操作」の「画像で保存」「PDFで保存」で、ワンタッチで保存できます。" : "") +
            "名簿や設定は「設定」の「保存・書き出し」で、バックアップできます。ときどき、保存しておくと安心です。"
    });
    steps.push({
        sel: null,
        title: "案内はここまでです",
        text: "わからなくなったら、「設定」の「しくみ」にある「案内ツアーをもう一度見る」を押してください。"
    });
    return steps;
}

function tourLayer() {
    let layer = $id("tourOverlay");
    if (!layer) {
        layer = document.createElement("div");
        layer.id = "tourOverlay";
        layer.className = "tour-layer";
        layer.setAttribute("data-plugin", "tour");
        layer.innerHTML = '<div class="tour-hole" id="tourHole"></div><div class="tour-card" id="tourCard" role="dialog" aria-live="polite"></div>';
        document.body.appendChild(layer);
    }
    return layer;
}

function tourFinish(markDone) {
    if (tourTimer) { clearInterval(tourTimer); tourTimer = null; }
    const layer = $id("tourOverlay");
    if (layer) layer.remove();
    tourIndex = -1;
    if (markDone) {
        lsSet(TOUR_DONE_KEY, "1");
        try { localStorage.removeItem(TOUR_FORCE_KEY); } catch (e) { /* 何もしない */ }
    }
}

function tourPlace() {
    const step = tourSteps[tourIndex];
    const hole = $id("tourHole"), card = $id("tourCard");
    if (!step || !hole || !card) return;
    const el = tourVisible(step.sel);
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let left, top;
    if (el) {
        const r = el.getBoundingClientRect();
        const pad = 8;
        hole.style.display = "block";
        hole.style.left = (r.left - pad) + "px";
        hole.style.top = (r.top - pad) + "px";
        hole.style.width = (r.width + pad * 2) + "px";
        hole.style.height = (r.height + pad * 2) + "px";
        const below = vh - r.bottom, above = r.top;
        left = r.left + r.width / 2 - cw / 2;
        if (below >= ch + 24) top = r.bottom + pad + 12;
        else if (above >= ch + 24 && r.height < vh * 0.4) top = r.top - pad - 12 - ch;
        else {   // 上にも下にも入らない大きな場所（座席表など）は、その中の下側に出して、上のボタンを隠しません
            top = vh - ch - 20;
            left = Math.min(left, r.right - cw - 16);
        }
    } else {
        hole.style.display = "none";
        top = step.ask ? vh - ch - 28 : (vh - ch) / 2;   // 最初のたずねる画面は、画面の中をふさがないように下に出します
        left = (vw - cw) / 2;
    }
    left = Math.max(12, Math.min(left, vw - cw - 12));
    top = Math.max(12, Math.min(top, vh - ch - 12));
    card.style.left = left + "px";
    card.style.top = top + "px";
}

function tourRender() {
    const step = tourSteps[tourIndex];
    if (!step) { tourFinish(true); return; }
    tourLayer();
    const card = $id("tourCard");
    const last = tourIndex === tourSteps.length - 1;
    const shown = tourSteps.length;
    card.innerHTML = '<div class="tour-count">' + (tourIndex + 1) + ' / ' + shown + '</div>' +
        '<div class="tour-title"></div><div class="tour-text"></div>' +
        '<div class="tour-btns">' +
        '<button type="button" class="tour-skip" id="tourSkip">' + (last ? "" : "とばす") + '</button>' +
        (tourIndex > 0 ? '<button type="button" class="tour-prev" id="tourPrev">まえへ</button>' : "") +
        '<button type="button" class="tour-next" id="tourNext">' + (last ? "おわる" : "つぎへ") + '</button></div>';
    card.querySelector(".tour-title").textContent = step.title;
    card.querySelector(".tour-text").textContent = step.text;
    const skip = $id("tourSkip");
    if (last) skip.remove(); else skip.onclick = () => tourFinish(true);
    const prev = $id("tourPrev");
    if (prev) prev.onclick = () => tourGo(tourIndex - 1);
    $id("tourNext").onclick = () => { if (last) tourFinish(true); else tourGo(tourIndex + 1); };
    const el = step.sel ? document.querySelector(step.sel) : null;
    if (el) { try { el.scrollIntoView({ block: "center" }); } catch (e) { /* 何もしない */ } }
    tourPlace();
    setTimeout(tourPlace, 120);
    $id("tourNext").focus({ preventScroll: true });
    if (tourTimer) { clearInterval(tourTimer); tourTimer = null; }
    if (typeof step.until === "function") {
        tourTimer = setInterval(() => {
            let ok = false;
            try { ok = !!step.until(); } catch (e) { ok = false; }
            if (ok) { clearInterval(tourTimer); tourTimer = null; setTimeout(() => { if (tourSteps[tourIndex] === step) tourGo(tourIndex + 1); }, 900); }
        }, 500);
    }
}

function tourGo(i) {
    // 画面にない部品の案内は、とばします
    const dir = i >= tourIndex ? 1 : -1;
    while (i >= 0 && i < tourSteps.length - 1 && tourSteps[i].sel && !tourVisible(tourSteps[i].sel)) i += dir;
    if (i < 0) i = 0;
    if (i >= tourSteps.length) { tourFinish(true); return; }
    tourIndex = i;
    tourRender();
}

function startTour() {
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return; }
    if (typeof closeConfigMenuIfOpen === "function") closeConfigMenuIfOpen();
    closePopMenus();
    tourFinish(false);
    tourShuffled = false;
    tourSteps = tourBuildSteps();
    tourGo(0);
}

function tourAskStart() {
    if (tourIndex >= 0 || $id("tourOverlay")) return;
    tourLayer();
    tourSteps = [{ sel: null, ask: true, title: "はじめての方へ", text: "「席替え → 結果の確認 → 保存」まで画面の上で順に案内します。1分程で終わります。" }];
    tourIndex = 0;
    const card = $id("tourCard");
    card.innerHTML = '<div class="tour-title"></div><div class="tour-text"></div><div class="tour-btns"><button type="button" class="tour-skip" id="tourLater">後で</button><button type="button" class="tour-next" id="tourBegin">案内をはじめる</button></div>';
    card.querySelector(".tour-title").textContent = tourSteps[0].title;
    card.querySelector(".tour-text").textContent = tourSteps[0].text;
    $id("tourLater").onclick = () => { tourFinish(true); showToast("案内は「設定」の「しくみ」から、いつでも見られます。", "info"); };
    $id("tourBegin").onclick = () => startTour();
    tourPlace();
    $id("tourBegin").focus({ preventScroll: true });
}

function tourModalOpen() {
    return Array.from(document.querySelectorAll(".modal-overlay")).some(o => o.style.display && o.style.display !== "none");
}

// はじめて開いた時（いままでの記録が何もない時）と、「かんたん」に切りかえた直後だけ、たずねます
function tourShouldAsk() {
    if (lsGet(TOUR_FORCE_KEY, "") === "1") return true;
    if (lsGet(TOUR_DONE_KEY, "") === "1") return false;
    const hasData = ["seat_shuffler_presets", "seat_history_log", "nomination_history_log", WORK_STATE_KEY].some(k => lsGet(k, "") !== "");
    return !hasData;
}

function tourOnKey(e) {
    if (tourIndex < 0 || !$id("tourOverlay")) return;
    if (e.key === "Escape") { e.stopPropagation(); tourFinish(true); }
}

const TOUR_CSS = `
.tour-layer { position: fixed; inset: 0; z-index: 6000; pointer-events: none; }
.tour-hole { position: fixed; border-radius: 14px; box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.62), 0 0 0 4px #fbbf24; pointer-events: none; transition: all 0.25s ease; }
.tour-card { position: fixed; width: min(360px, calc(100vw - 24px)); box-sizing: border-box; padding: 16px 18px; border-radius: 16px; background: var(--card-bg, #fff); color: var(--text-main, #1f2937); box-shadow: 0 16px 40px rgba(0,0,0,0.35); border: 2px solid #fbbf24; pointer-events: auto; }
.tour-count { font-size: 12px; font-weight: 700; opacity: 0.7; margin-bottom: 4px; }
.tour-title { font-size: 17px; font-weight: 800; margin-bottom: 6px; }
.tour-text { font-size: 14px; line-height: 1.7; }
.tour-btns { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 14px; }
.tour-btns button { height: 40px; padding: 0 16px; border-radius: 10px; border: 1px solid var(--seat-border, #cbd5e1); background: transparent; color: inherit; font-size: 14px; font-weight: 700; cursor: pointer; width: auto; margin: 0; }
.tour-btns button.tour-skip { margin-right: auto; border-color: transparent; opacity: 0.75; }
.tour-btns button.tour-next { background: #2563eb; border-color: #2563eb; color: #fff; }
@media (prefers-reduced-motion: reduce) { .tour-hole { transition: none; } }`;

SekigaeApp.registerPlugin({
    id: "tour",
    name: "案内ツアー",
    version: "1.1",
    description: "はじめて使う人に席替えから、結果の確認、保存まで画面の上で順に案内します。「簡単」の構成とセットで使います。",
    searchWords: "案内 ツアー 使い方 はじめて 初心者 ガイド チュートリアル 説明 かんたん",
    mount(app) {
        app.insertInto("guide-faq", "<li data-plugin=\"tour\"><strong>使い方の案内をもう一度見たい</strong>：設定の「しくみ」の「案内ツアーをもう一度見る」を押してください。席替えから、結果の確認、保存まで順に案内します。</li>");
        const st = document.createElement("style");
        st.id = "tourStyle";
        st.textContent = TOUR_CSS;
        document.head.appendChild(st);
        app.insertInto("settings-system", '<button type="button" onclick="startTour()" class="btn-secondary" id="btnStartTour" style="margin-top: 10px;" data-plugin="tour">案内ツアーをもう一度見る</button>');
        document.addEventListener("sekigae:shuffle-done", () => { tourShuffled = true; });
        document.addEventListener("keydown", tourOnKey, true);
        window.addEventListener("resize", () => { if (tourIndex >= 0) tourPlace(); });
    },
    ready() {
        if (!tourShouldAsk()) return;
        let tries = 0;
        const attempt = () => {
            if (!tourShouldAsk()) return;
            if (tourModalOpen() && tries++ < 6) { setTimeout(attempt, 2000); return; }
            if (tourModalOpen()) return;
            tourAskStart();
        };
        setTimeout(attempt, 1500);
    }
});
