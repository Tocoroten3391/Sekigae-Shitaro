// ==========================================
// 座席表の文字と班の印プラグイン（必須）：座席表の文字の大きさ、番号だけの表示、班の印の出し方です。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
function isNumberRoster() {
    const list = (lastRawList || []).map(x => String(x).replace(/\[[^\]]*\]/g, "").replace(/\{[^}]*\}/g, "").trim()).filter(x => x !== "");
    if (!list.length) return false;
    return list.every(x => { const m = x.match(/^(\d+)\s*[.．]\s*(.*)$/); return !!m && (m[2] === "" || m[2] === m[1] + "番" || m[2] === m[1]); });
}
// 座席を番号のみで表示するかどうか。番号名簿の時は、スイッチに関わらず、必ず番号のみにします

let lastNumberOnlyState = null;

function isNumberOnlyMode() {
    const tg = $id("numberOnlyToggle");
    return !!(tg && tg.checked) || isNumberRoster();
}

// 見やすさの設定：班の番号と模様、座席の文字の大きさ

const SEAT_TEXT_SCALES = [1, 1.2, 1.4];
// 座席の横幅は、文字の大きさに関わらず、「ふつう」と同じです（文字が長い名前は、2行に分けて表示します）

const SEAT_TEXT_WIDE = { 1: 1, 1.2: 1, 1.4: 1 };

// 座席の横幅の倍率。設定する側（appearance.js、seat-layout.js）が、画面の根っこに直接書いているので、それを読みます。
// getComputedStyle を使うと、そのたびに画面の再計算が起きて、起動が遅くなるためです
function getSeatWideFactor() { return parseFloat(document.documentElement.style.getPropertyValue("--seat-wide")) || 1; }
// 画面の上のタイトル：自分で決めた言葉にしたり、消したりできます

function getGroupMarkScope() {
    const v = lsGet("group_mark_scope", "all");
    return ["all", "announce", "seat"].includes(v) ? v : "all";
}

function onGroupMarkScopeChange() {
    const sel = $id("groupMarkScopeSelect");
    if (!sel) return;
    lsSet("group_mark_scope", sel.value);
}
// 班の番号（表示用の1〜8）。班分けカラーを表示していない時や、班のない席は0

function getShownGroupNoForIndex(idx, cols, seats) {
    const seat = (seats || currentStudents)[idx];
    if (!seat || seat.type !== "STUDENT" || !seat.text) return 0;
    const n = getGroupNumberForIndex(idx, cols);
    if (!(n > 0)) return 0;
    return ((n - 1) % seatGroupCount) + 1;
}

function onGroupMarkToggle() {
    const t = $id("groupMarkToggle");
    lsSet("group_mark_on", t && t.checked ? "1" : "0");
    applyAccessibilitySettings();
}

function onSeatTextScaleChange() {
    const sel = $id("seatTextScaleSelect");
    if (!sel) return;
    lsSet("seat_text_scale", sel.value);
    applyAccessibilitySettings();
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "seat-style",
    name: "座席表の文字と班の印",
    version: "1.0",
    required: true,
    description: "座席表の文字の大きさ、番号だけの表示、班の印の出し方です。"
});
