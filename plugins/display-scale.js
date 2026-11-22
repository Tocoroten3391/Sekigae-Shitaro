// ==========================================
// 画面の大きさプラグイン：画面全体の文字やボタンの大きさを、1か所でそろえて、大きくできます。
// 大型モニターや、電子黒板で、うしろの席からも見やすくします
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// ==========================================
const DS_KEY = "ui_scale";
const DS_CHOICES = [
    { v: "1", label: "ふつう 100%" },
    { v: "1.15", label: "少し大きい 115%" },
    { v: "1.3", label: "大きい 130%" },
    { v: "1.5", label: "とても大きい 150%" },
    { v: "1.75", label: "特大 175%" },
    { v: "2", label: "最大 200%" }
];

// 画面の広さから、見やすい倍率をえらびます
function dsAutoScale() {
    const base = window.innerWidth;
    if (base >= 3000) return 2;
    if (base >= 2400) return 1.75;
    if (base >= 1900) return 1.3;
    if (base >= 1600) return 1.15;
    return 1;
}

function dsCurrent() {
    const raw = lsGet(DS_KEY, "1");
    if (raw === "auto") return { mode: "auto", z: dsAutoScale() };
    const z = parseFloat(raw);
    return { mode: "fixed", z: (z >= 0.8 && z <= 2.5) ? z : 1 };
}

function dsApply(refit) {
    const cur = dsCurrent();
    const root = document.documentElement;
    if (cur.z === 1) {
        root.style.removeProperty("zoom");
        root.style.removeProperty("--ui-scale");
        root.removeAttribute("data-ui-scale");
    } else {
        root.style.zoom = String(cur.z);
        root.style.setProperty("--ui-scale", String(cur.z));
        root.setAttribute("data-ui-scale", "1");
    }
    const sel = $id("uiScaleSelect");
    if (sel) sel.value = lsGet(DS_KEY, "1") === "auto" ? "auto" : (DS_CHOICES.some(c => c.v === String(cur.z)) ? String(cur.z) : "1");
    const note = $id("uiScaleNote");
    if (note) {
        const parts = [];
        if (cur.mode === "auto") parts.push("いまは " + Math.round(cur.z * 100) + "% です。");
        if (cur.z > 1 && window.innerWidth / cur.z < 1000) parts.push("この画面では、大きすぎて、ボタンがせまくなることがあります。");
        note.textContent = parts.join("");
    }
    // 座席表の大きさなどを、新しい倍率に合わせ直します（起動の時は、あとで本体が合わせるので、省きます）
    if (refit === false) return;
    if (typeof fitClassroomToScreen === "function") { fitClassroomToScreen(); requestAnimationFrame(fitClassroomToScreen); }
    window.dispatchEvent(new Event("resize"));
}

function onUiScaleChange() {
    const sel = $id("uiScaleSelect");
    if (!sel) return;
    lsSet(DS_KEY, sel.value);
    dsApply();
    showToast("画面の大きさを変えました。", "success");
}

const DS_CSS = `
/* 全画面の表示（巨大タイマー、ルーレットなど）は、もともと画面いっぱいに出るので、倍率をもどします */
html[data-ui-scale] body > [class*="overlay"]:not(.modal-overlay),
html[data-ui-scale] body > [id$="Overlay"]:not(.modal-overlay),
html[data-ui-scale] #giantTimeOverlay, html[data-ui-scale] #rouletteOverlay, html[data-ui-scale] #seasonCanvas,
html[data-ui-scale] #printSheet { zoom: calc(1 / var(--ui-scale)); }
/* 窓は、画面いっぱいに広げたまま、中身だけを大きくします */
html[data-ui-scale] .modal-overlay { zoom: calc(1 / var(--ui-scale)); }
html[data-ui-scale] .modal-overlay .modal-content { zoom: var(--ui-scale); max-height: calc(90vh / var(--ui-scale)); max-height: calc(90dvh / var(--ui-scale)); }
html[data-ui-scale] .config-container { height: calc(100vh / var(--ui-scale)); }
html[data-ui-scale] .room-panel { max-height: calc((100vh - 100px) / var(--ui-scale)); }
html[data-ui-scale] .gallery-dock { max-height: calc(44vh / var(--ui-scale)); }
.ds-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 10px; }
.ds-row select { flex: 1 1 160px; min-width: 0; }
.ds-note { font-size: 12px; opacity: 0.75; }`;

SekigaeApp.registerPlugin({
    id: "display-scale",
    name: "画面の大きさ",
    version: "1.0",
    description: "画面全体の文字やボタンの大きさを、1か所でそろえて、大きくできます。大型モニターや電子黒板向けです。",
    backupKeys: [DS_KEY],
    searchWords: "画面 大きさ 拡大 文字 ボタン 大型 モニター 電子黒板 ズーム 見やすい 倍率",
    mount(app) {
        app.insertInto("guide-faq", "<li data-plugin=\"display-scale\"><strong>文字やボタンが小さくて、うしろの席から見えない</strong>：設定の「画面の大きさ」で、100%から200%まで選べます。大型モニターや電子黒板では、「画面に合わせる」が便利です。</li>");
        const st = document.createElement("style");
        st.id = "displayScaleStyle";
        st.textContent = DS_CSS;
        document.head.appendChild(st);
        const opts = DS_CHOICES.map(c => '<option value="' + c.v + '">' + c.label + '</option>').join("") + '<option value="auto">画面に合わせる</option>';
        app.insertInto("settings-display", '<div class="ds-row" data-plugin="display-scale"><label for="uiScaleSelect" class="switch-label">画面の大きさ</label><select id="uiScaleSelect" onchange="onUiScaleChange()">' + opts + '</select><span id="uiScaleInfoSlot"></span></div><div class="ds-note" id="uiScaleNote" data-plugin="display-scale"></div>');
        const slot = $id("uiScaleInfoSlot");
        if (slot && typeof makeInfoTip === "function") slot.appendChild(makeInfoTip("画面全体の、文字やボタンの大きさを、まとめて変えます。大型モニターや電子黒板で、うしろの席から見にくい時に、大きくしてください。「画面に合わせる」を選ぶと、画面の広さから、見やすい大きさを自動で選びます。巨大タイマーなど、画面いっぱいに出る表示は、もともと大きいので、変わりません。"));
        dsApply(false);
    },
    ready() { dsApply(false); }
});
