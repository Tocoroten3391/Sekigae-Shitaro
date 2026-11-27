// ==========================================
// 席替え占いプラグイン：席替えのあとに、生徒ごとの「今日の運勢」を出します。星の数、ラッキーアイテム、ラッキーカラー、ひとことが出ます。
// 占いの結果は、日付・生徒・席から決まるので、同じ日の同じ席なら、何度見ても同じです
// このファイルを index.html から外すと、占いのボタンも、座席表の星も、まとめて消えます
// ==========================================
const FORTUNE_BADGE_KEY = "fortune_badge"; // "1" なら、座席表に星を出す

const FORTUNE_ITEMS = [
    "消しゴム", "赤ペン", "三角定規", "ふせん", "のり", "分度器", "ハンカチ", "水筒", "上ばき", "ノート",
    "定規", "えんぴつ", "コンパス", "蛍光ペン", "リコーダー", "給食エプロン", "ぞうきん", "体操服", "筆箱", "下じき",
    "色えんぴつ", "はさみ", "セロハンテープ", "ホチキス", "ブックカバー", "しおり", "図鑑", "電卓", "地球儀", "習字道具",
    "ランドセル", "かさ", "ティッシュ", "ひざかけ", "メモ帳", "ストップウォッチ", "黒板消し", "チョーク", "おりがみ", "クリアファイル",
    "ふでばこ", "コップ", "マスク", "くつひも", "たて笛", "ものさし", "付箋", "ペンケース", "キーホルダー", "タオル"
];
const FORTUNE_COLORS = [
    { n: "あか", c: "#ef4444" }, { n: "だいだい", c: "#f97316" }, { n: "きいろ", c: "#eab308" }, { n: "きみどり", c: "#84cc16" },
    { n: "みどり", c: "#22c55e" }, { n: "みずいろ", c: "#06b6d4" }, { n: "あお", c: "#3b82f6" }, { n: "むらさき", c: "#8b5cf6" },
    { n: "ピンク", c: "#ec4899" }, { n: "しろ", c: "#f8fafc" }, { n: "はいいろ", c: "#94a3b8" }, { n: "ちゃいろ", c: "#a16207" }
];
const FORTUNE_WORDS = {
    5: ["今日はなにをやってもうまくいく日です。思いきって手をあげましょう。", "すてきな出会いがある日です。となりの人に声をかけてみましょう。", "ひらめきが冴える日です。気づいたことをノートにメモしましょう。", "あなたの笑顔がまわりを明るくします。"],
    4: ["いい流れの日です。いつもより、少しだけがんばってみましょう。", "友だちとの話がはずみそうです。", "小さな「ありがとう」が、運を呼びます。", "授業でいい発見がありそうです。"],
    3: ["普通が一番の日です。いつものペースで進みましょう。", "ていねいな字で書くと運が上がります。", "休み時間は外の空気をすいましょう。", "落ち着いて、一つずつ進めれば大丈夫です。"],
    2: ["ゆっくり進む日です。深呼吸をして、始めましょう。", "忘れ物に気を付けるといい日になります。", "わからないことは早めに聞きましょう。", "のんびりした気持ちが運を連れてきます。"],
    1: ["あしたにつながる、充電の日です。ゆっくり過ごしましょう。", "ラッキーアイテムを持てば、運が戻ってきます。", "今日の小さながんばりが、あした大きく実ります。", "お水をたくさん飲んで元気にいきましょう。"]
};
const FORTUNE_WEIGHTS = [[1, 10], [2, 20], [3, 35], [4, 23], [5, 12]];

function fortuneHash(str) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
        const c = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 2654435761);
        h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0) * 4294967296 + (h1 >>> 0);
}
function fortuneRng(seed) {
    let a = (seed % 4294967296) >>> 0;
    return function () {
        a = (a + 0x6D2B79F5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
function fortuneToday() {
    const d = new Date();
    return d.getFullYear() + "-" + (d.getMonth() + 1) + "-" + d.getDate();
}
// 日付・生徒・席から、今日の運勢を決めます
function fortuneFor(key, seatLabel) {
    const rnd = fortuneRng(fortuneHash(fortuneToday() + "|" + key + "|" + seatLabel));
    let r = rnd() * 100, stars = 3;
    for (const [s, w] of FORTUNE_WEIGHTS) { if (r < w) { stars = s; break; } r -= w; }
    const pick = list => list[Math.floor(rnd() * list.length)];
    return { stars: stars, item: pick(FORTUNE_ITEMS), color: pick(FORTUNE_COLORS), word: pick(FORTUNE_WORDS[stars]) };
}
function fortuneStarText(n) { return "★".repeat(n) + "☆".repeat(5 - n); }
function fortuneEsc(t) { return String(t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])); }

// 座席表にいる生徒の、運勢のリスト
function fortuneList() {
    const cols = typeof getGridCols === "function" ? getGridCols() : 6;
    const out = [];
    (currentStudents || []).forEach((seat, idx) => {
        if (!seat || seat.type !== "STUDENT" || !seat.text || seat.isAbsent) return;
        const key = getCleanStudentKey(seat.text);
        if (!key) return;
        const label = typeof getSeatLabel === "function" ? getSeatLabel(idx, cols) : String(idx + 1);
        const p = typeof getSeatDisplayParts === "function" ? getSeatDisplayParts(seat.text) : { no: "", name: key };
        out.push({ idx: idx, label: label, name: (p.no ? p.no + "番 " : "") + (p.name || key), f: fortuneFor(key, label) });
    });
    return out;
}

// ---- 座席表の星 ----
function fortuneBadgeOn() { return lsGet(FORTUNE_BADGE_KEY, "0") === "1"; }
function fortuneDecorate() {
    const on = fortuneBadgeOn();
    const cols = typeof getGridCols === "function" ? getGridCols() : 6;
    document.querySelectorAll("#classroom .seat").forEach(el => {
        const old = el.querySelector(".seat-fortune");
        if (old) old.remove();
        if (!on) return;
        const key = el.dataset.seatKey;
        const idx = parseInt(el.dataset.seatIndex, 10);
        const seat = currentStudents && currentStudents[idx];
        if (!key || !seat || seat.type !== "STUDENT" || seat.isAbsent) return;
        const label = typeof getSeatLabel === "function" ? getSeatLabel(idx, cols) : String(idx + 1);
        const f = fortuneFor(key, label);
        const tag = document.createElement("span");
        tag.className = "seat-fortune fortune-s" + f.stars;
        tag.textContent = "★" + f.stars;
        tag.title = "今日の運勢 " + fortuneStarText(f.stars) + "　ラッキーアイテム：" + f.item;
        el.appendChild(tag);
    });
}
function onFortuneBadgeToggle() {
    lsSet(FORTUNE_BADGE_KEY, $id("fortuneBadgeToggle").checked ? "1" : "0");
    fortuneDecorate();
}

// ---- 占いの画面 ----
let fortuneTimer = null;
function fortuneModalOpen() { const o = $id("fortuneModalOverlay"); return !!o && o.style.display !== "none"; }
function openFortuneModal() {
    if (typeof closePopMenus === "function") closePopMenus();
    if (!fortuneList().length) { showToast("座席表に生徒がいません。名簿を入れて、席替えをしてください。", "error"); return; }
    $id("fortuneBadgeToggle").checked = fortuneBadgeOn();
    $id("fortuneModalOverlay").style.display = "flex";
    fortuneStartReading();
}
function closeFortuneModal() {
    clearTimeout(fortuneTimer);
    const o = $id("fortuneModalOverlay");
    if (o) o.style.display = "none";
}
// 水晶玉が回って、占い結果が出ます（約2秒）
function fortuneStartReading() {
    clearTimeout(fortuneTimer);
    $id("fortuneBall").style.display = "";
    $id("fortuneResult").style.display = "none";
    $id("fortuneAgainBtn").disabled = true;
    fortuneTimer = setTimeout(() => {
        $id("fortuneBall").style.display = "none";
        renderFortuneResult();
        $id("fortuneResult").style.display = "";
        $id("fortuneAgainBtn").disabled = false;
    }, 2000);
}
function renderFortuneResult() {
    const list = fortuneList();
    const best = Math.max.apply(null, list.map(x => x.f.stars));
    const tops = list.filter(x => x.f.stars === best);
    const t = new Date();
    const teacher = fortuneFor("先生", fortuneToday());
    $id("fortuneBest").innerHTML = `<div class="fortune-best-title">🌟 今日のベスト席（${fortuneStarText(best)}）</div>` +
        `<div>${tops.slice(0, 4).map(x => `<b>${fortuneEsc(x.label)}</b> ${fortuneEsc(x.name)}`).join("　")}${tops.length > 4 ? "　ほか" + (tops.length - 4) + "人" : ""}</div>` +
        `<div class="fortune-teacher">先生のラッキーアイテムは「${fortuneEsc(teacher.item)}」、ラッキーカラーは「${fortuneEsc(teacher.color.n)}」です。</div>`;
    const rows = list.slice().sort((a, b) => b.f.stars - a.f.stars || a.idx - b.idx);
    $id("fortuneRows").innerHTML = rows.map((x, i) =>
        `<div class="fortune-row" style="animation-delay: ${Math.min(i, 30) * 45}ms">` +
        `<span class="fortune-seat">${fortuneEsc(x.label)}</span><span class="fortune-name">${fortuneEsc(x.name)}</span>` +
        `<span class="fortune-stars fortune-s${x.f.stars}">${fortuneStarText(x.f.stars)}</span>` +
        `<span class="fortune-item">${fortuneEsc(x.f.item)}<i class="fortune-dot" style="background:${x.f.color.c}" title="ラッキーカラー：${fortuneEsc(x.f.color.n)}"></i></span>` +
        `<span class="fortune-word">${fortuneEsc(x.f.word)}</span></div>`).join("");
    $id("fortuneDate").textContent = t.getFullYear() + "年" + (t.getMonth() + 1) + "月" + t.getDate() + "日の運勢";
}

const FORTUNE_HTML = `
<div id="fortuneModalOverlay" class="modal-overlay" style="display: none;">
    <div class="modal-content" style="max-width: 640px; width: 95%;">
        <h4 style="color: #7c3aed;">🔮 席替え占い</h4>
        <p id="fortuneDate" class="config-note" data-keep="1" style="margin: -6px 0 8px;"></p>
        <div id="fortuneBall" class="fortune-ball" style="display: none;">🔮<div>占っています…</div></div>
        <div id="fortuneResult" style="display: none;">
            <div id="fortuneBest" class="fortune-best"></div>
            <div id="fortuneRows" class="fortune-rows"></div>
        </div>
        <div class="switch-container" style="margin-top: 10px;">
            <label class="switch"><input type="checkbox" id="fortuneBadgeToggle" onchange="onFortuneBadgeToggle()"><span class="slider"></span></label>
            <span class="switch-label">座席表に星の数を出す<span data-ftip="占いの結果は今日の日付と生徒と席から決まります。同じ日の同じ席なら、何度見ても同じ結果です。席替えをすると結果も変わります。占いは遊びです。"></span></span>
        </div>
        <div class="modal-btn-row">
            <button id="fortuneAgainBtn" onclick="fortuneStartReading()" class="btn-secondary">🔮 もう一度、占う</button>
            <button onclick="closeFortuneModal()" class="btn-secondary">閉じる</button>
        </div>
    </div>
</div>`;

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "fortune",
    name: "席替え占い",
    version: "1.0",
    description: "席替えの後に生徒ごとの「今日の運勢」を出します。星の数、ラッキーアイテム、ラッキーカラー、ひとことが出ます。座席表に星を出すこともできます。",
    backupKeys: [FORTUNE_BADGE_KEY],
    searchWords: "占い 運勢 星 ラッキー おみくじ 席替え占い",
    stubs: [],
    mount(app) {
        document.body.insertAdjacentHTML("beforeend", FORTUNE_HTML);
        document.querySelectorAll("#fortuneModalOverlay [data-ftip]").forEach(el => {
            if (typeof makeInfoTip === "function") el.replaceWith(makeInfoTip(el.dataset.ftip)); else el.remove();
        });
        const more = $id("moreMenu");
        if (more) more.insertAdjacentHTML("beforeend", '<button type="button" onclick="openFortuneModal()" class="pop-item pop-item-gray" id="btnFortune">席替え占い</button>');
        app.insertInto("guide-faq", "<li><strong>席替えの後に盛り上がりたい</strong>：「他の操作」の「席替え占い」を押すと生徒ごとの今日の運勢が出ます。座席表に星の数を出すこともできます。占いは遊びです。</li>");
    },
    ready() { fortuneDecorate(); },
    afterRender() { fortuneDecorate(); }
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && fortuneModalOpen()) closeFortuneModal();
});
