// ==========================================
// 座席表の大きさプラグイン（必須）：列の数、画面に合わせた大きさ調整、空席の数です。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
function updateColumns() { 
    const classroom = $id("classroom");
    const select = $id("columnSelect");
    const rowSelect = $id("rowSelect");
    if (classroom && select) {
        // 列数・行数はCSS変数で管理し、座席サイズ(--seat-size)は固定。
        // これにより横列・縦列を変えても座席の大きさ・感覚が一定になる。
        // 行数も明示しておくことで、わがまま指定の列を囲む枠（grid-row: 1 / -1）が
        // 正しく一番下の行まで届くようになる。
        classroom.style.setProperty('--seat-cols', parseInt(select.value, 10) || 6); 
        if (rowSelect) classroom.style.setProperty('--seat-rows', parseInt(rowSelect.value, 10) || 6); 
        fitClassroomToScreen();
        // 描画のあとでボタンなどが増えて座席表の位置が下がることがあるため、描画後にも測り直す
        requestAnimationFrame(fitClassroomToScreen);
    }
}

// 座席表が画面（横幅・縦の残り）にスクロールなしで収まるよう、座席の大きさを自動で小さくする。
// 画面が十分に広いときは従来どおりの大きさのまま。小さくしすぎて読めなくならないよう下限(52px)を設ける。

const SEAT_FIT_MIN_SIZE = 52;

const SEAT_FIT_NARROW_MIN_SIZE = 36;

const SEAT_GROW_MIN_VIEWPORT = 900;   // この幅より広い画面では、座席を大きくします

const SEAT_GROW_MAX_SIZE = 240;       // 大きくする時の上限（座席の横幅）

// 「画面の大きさ」プラグインで画面全体を拡大している時の倍率です（拡大していなければ 1）
function getUiScale() {
    const z = parseFloat(document.documentElement.style.zoom);
    return z > 0 ? z : 1;
}

function fitClassroomToScreen() {
    const classroom = $id("classroom");
    if (!classroom) return;
    // 名前が座席に入りきらない時は、座席の横幅を広げます（文字の大きさは、そのままです）。広げた分で大きさが変わるので、数回やり直して落ち着かせます
    const baseWide = parseFloat(document.documentElement.dataset.seatWideBase) || getSeatWideFactor();
    document.documentElement.dataset.seatWideBase = String(baseWide);
    let wide = baseWide;
    const em = measureWidestSeatNameEm();
    const scale = parseFloat(document.documentElement.style.getPropertyValue("--seat-text-scale")) || 1; // 繰り返しの外で、1回だけ読みます
    for (let i = 0; i < 4; i++) {
        setSeatWide(wide);
        fitClassroomCore();
        if (!em) break;
        const size = parseFloat(classroom.style.getPropertyValue('--seat-size')) || Math.min(132, Math.max(92, document.documentElement.clientWidth / getUiScale() * 0.09));
        const fontPx = Math.max(12, 0.16 * scale * size);
        const needW = (em * fontPx) / 0.9 + 4;
        const next = Math.min(SEAT_AUTO_WIDE_MAX, Math.max(baseWide, Math.ceil((needW / size) * 20) / 20));
        if (Math.abs(next - wide) < 0.03) break;
        wide = next;
    }
}

const SEAT_AUTO_WIDE_MAX = 2.4;   // 名前が長い時に、座席の横幅を広げる上限（「ふつう」の何倍か）

let seatNameMeasureCtx = null;

// いま座席表にある名前のうち、いちばん長いものの幅（文字の大きさを1とした割合）。番号のみの表示の時は、測りません
function measureWidestSeatNameEm() {
    const classroom = $id("classroom");
    if (!classroom || document.body.classList.contains("number-only-mode")) return 0;
    const els = classroom.querySelectorAll(".seat:not(.number-only-huge) .seat-name");
    if (!els.length) return 0;
    if (!seatNameMeasureCtx) seatNameMeasureCtx = document.createElement("canvas").getContext("2d");
    seatNameMeasureCtx.font = "700 100px " + getComputedStyle(els[0]).fontFamily;
    let max = 0;
    els.forEach(el => { max = Math.max(max, seatNameMeasureCtx.measureText(el.textContent).width / 100); });
    return max;
}

function setSeatWide(w) {
    document.documentElement.style.setProperty("--seat-wide", String(w));
    document.documentElement.style.setProperty("--seat-ar", (4 * w).toFixed(3) + " / 3.15");
}

function fitClassroomCore() {
    const classroom = $id("classroom");
    if (!classroom) return;
    const cols = parseInt(classroom.style.getPropertyValue('--seat-cols'), 10) || 6;
    const rows = parseInt(classroom.style.getPropertyValue('--seat-rows'), 10) || 6;

    // いったん自動調整を外して、本来の位置と大きさを測る
    classroom.style.removeProperty('--seat-size');
    classroom.style.removeProperty('--seat-gap');
    if (classroom.querySelector('.welcome-card')) return;

    const wideK = getSeatWideFactor(); // 文字を大きくした時は、座席の横幅が広がります
    const uiScale = getUiScale();
    const viewportW = document.documentElement.clientWidth / uiScale;
    const viewportH = window.innerHeight / uiScale;
    const defaultSize = Math.min(132, Math.max(92, viewportW * 0.09));
    const bodyPad = parseFloat(getComputedStyle(document.body).paddingLeft) || 0;
    const availW = viewportW - bodyPad * 2;
    const top = (classroom.getBoundingClientRect().top + window.scrollY) / uiScale;
    // 座席表の下の余白と、画面の下の余白も、ひいておきます（ひかないと、はみ出して、スクロールしてしまいます）
    const csClass = getComputedStyle(classroom), csBody = getComputedStyle(document.body);
    const bottomSpace = (parseFloat(csClass.marginBottom) || 0) + (parseFloat(csBody.paddingBottom) || 0) + (parseFloat(csBody.marginBottom) || 0);
    const availH = viewportH - top - bottomSpace - 2;

    // 横幅が足りない狭い画面では、座席の間隔を詰め、下限も下げて、必ず横に収める
    let gap = 10;
    let fitW = (availW - gap * (cols - 1)) / (cols * wideK);
    if (fitW < SEAT_FIT_MIN_SIZE) { gap = 6; fitW = (availW - gap * (cols - 1)) / (cols * wideK); }
    const sizeFloor = Math.min(SEAT_FIT_MIN_SIZE, Math.max(SEAT_FIT_NARROW_MIN_SIZE, Math.floor(fitW)));
    const fitH = (availH - gap * (rows - 1)) / (rows * 0.7875); // 座席は 4:3.15（縦を少し大きくしています。style.css の座席の縦横比と合わせます）
    const fit = Math.floor(Math.max(sizeFloor, Math.min(fitW, fitH)));

    if (fit < defaultSize) {
        classroom.style.setProperty('--seat-size', fit + 'px');
        classroom.style.setProperty('--seat-gap', gap + 'px');
        return;
    }
    // 広い画面（電子黒板やパソコン）では、余っている場所に合わせて、座席を大きくします。名前や番号の文字も、座席に合わせて大きくなります
    const inSpecialMode = document.body.classList.contains("blackboard-active") || document.body.classList.contains("nomination-active");
    if (viewportW >= SEAT_GROW_MIN_VIEWPORT && !inSpecialMode) {
        const gapFor = size => Math.round(Math.min(24, Math.max(10, size * 0.1)));
        let g = gapFor(fit);
        let big = Math.floor(Math.min(SEAT_GROW_MAX_SIZE, (availW - g * (cols - 1)) / (cols * wideK), (availH - g * (rows - 1)) / (rows * 0.7875)));
        g = gapFor(big);
        big = Math.floor(Math.min(SEAT_GROW_MAX_SIZE, (availW - g * (cols - 1)) / (cols * wideK), (availH - g * (rows - 1)) / (rows * 0.7875)));
        if (big >= defaultSize + 8) {
            classroom.style.setProperty('--seat-size', big + 'px');
            classroom.style.setProperty('--seat-gap', g + 'px');
        }
    }
}

// 座席を番号のみで表示する時は、座席の横幅はそのままで、数字をできるだけ大きくします。
// いちばん長い番号（例：「100番」）が座席の横幅に1行で収まる大きさと、座席の高さに収まる大きさの、小さいほうにします

const NUM_ONLY_WIDTH_RATIO = 0.86;    // 座席の横幅のうち、数字に使う割合

const NUM_ONLY_MAX_RATIO = 0.36;      // 数字の大きさの上限（座席の横幅に対する割合）

let numFitCtx = null;

function fitNumberOnlyFont() {
    const classroom = $id("classroom");
    if (!classroom) return;
    const els = classroom.querySelectorAll(".seat.number-only-huge .seat-name");
    if (!els.length) { classroom.style.removeProperty("--num-cqw"); return; }
    if (!numFitCtx) numFitCtx = document.createElement("canvas").getContext("2d");
    const family = getComputedStyle(els[0]).fontFamily;
    numFitCtx.font = "800 100px " + family;
    let maxEm = 0;
    els.forEach(el => { maxEm = Math.max(maxEm, numFitCtx.measureText(el.textContent).width / 100); });
    if (!maxEm) return;
    const ratio = Math.min(NUM_ONLY_MAX_RATIO, NUM_ONLY_WIDTH_RATIO / maxEm);
    classroom.style.setProperty("--num-cqw", (ratio * 100).toFixed(2));
}

let seatFitTimer = null;

function scheduleSeatFit() {
    clearTimeout(seatFitTimer);
    seatFitTimer = setTimeout(fitClassroomToScreen, 120);
}

window.addEventListener("resize", scheduleSeatFit);

window.addEventListener("orientationchange", scheduleSeatFit);

function onLayoutChange() { 
    updateColumns(); 
    resetNominatedHistory(false); 
    parseAndSetSeats(lastRawList, false, "initial", false, true); 
}

function onEmptySeatsInput() { 
    const input = $id("emptySeatsInput");
    if (input) {
        input.value = input.value.toUpperCase(); 
        onLayoutChange(); 
    }
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "seat-layout",
    name: "座席表の大きさ",
    version: "1.1",
    required: true,
    description: "列の数、画面に合わせた大きさ調整、空席の数です。"
});
