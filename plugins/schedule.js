// ==========================================
// 席替えの予約プラグイン：次の席替え日を決めておくと、その日に起動した時に、知らせます。
// 毎週・2週間ごと・毎月の、くりかえしも選べます。席替えをすると、予約は、次の日付に進みます
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// ==========================================
const SCHED_KEY = "shuffle_schedule_v1";
const SCHED_SHOWN_KEY = "shuffle_schedule_shown";
const SCHED_REPEATS = [
    { v: "none", label: "くりかえさない" },
    { v: "week", label: "毎週" },
    { v: "2weeks", label: "2週間ごと" },
    { v: "month", label: "毎月" }
];
const SCHED_WEEK = ["日", "月", "火", "水", "木", "金", "土"];

function schedYmd(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function schedParse(str) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str || "");
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

function schedRead() {
    try {
        const o = JSON.parse(lsGet(SCHED_KEY, "{}")) || {};
        return { date: schedParse(o.date) ? o.date : "", repeat: SCHED_REPEATS.some(r => r.v === o.repeat) ? o.repeat : "none", notify: o.notify !== false };
    } catch (e) { return { date: "", repeat: "none", notify: true }; }
}

function schedWrite(s) { lsSet(SCHED_KEY, JSON.stringify(s)); }

// 今日から、予約の日まで、あと何日か（今日なら 0、すぎていれば マイナス）
function schedDaysLeft(dateStr, today) {
    const d = schedParse(dateStr), t = today || schedParse(schedYmd(new Date()));
    if (!d) return null;
    return Math.round((d.getTime() - t.getTime()) / 86400000);
}

function schedLabel(dateStr) {
    const d = schedParse(dateStr);
    return d ? (d.getMonth() + 1) + "月" + d.getDate() + "日 " + SCHED_WEEK[d.getDay()] + "曜日" : "";
}

// くりかえしの設定がある時に、今日より後の、次の日付を求めます
function schedNextDate(dateStr, repeat, today) {
    let d = schedParse(dateStr);
    if (!d || repeat === "none") return "";
    const t = today || schedParse(schedYmd(new Date()));
    for (let i = 0; i < 400 && d.getTime() <= t.getTime(); i++) {
        if (repeat === "week") d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
        else if (repeat === "2weeks") d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 14);
        else d = new Date(d.getFullYear(), d.getMonth() + 1, d.getDate());
    }
    return schedYmd(d);
}

function schedStatusText(s) {
    if (!s.date) return "予約はありません。";
    const left = schedDaysLeft(s.date);
    const base = "次の席替えは、" + schedLabel(s.date) + "です。";
    if (left > 1) return base + "あと" + left + "日です。";
    if (left === 1) return base + "あしたです。";
    if (left === 0) return base + "今日です。";
    return base + Math.abs(left) + "日、すぎています。";
}

function schedRefreshUi() {
    const s = schedRead();
    const d = $id("schedDate"), r = $id("schedRepeat"), n = $id("schedNotify"), st = $id("schedStatus"), c = $id("btnSchedClear");
    if (d && document.activeElement !== d) d.value = s.date;
    if (r) r.value = s.repeat;
    if (n) n.checked = s.notify;
    if (st) st.textContent = schedStatusText(s);
    if (c) c.disabled = !s.date;
}

function schedOnChange() {
    const d = $id("schedDate"), r = $id("schedRepeat"), n = $id("schedNotify");
    const s = schedRead();
    if (d) s.date = schedParse(d.value) ? d.value : "";
    if (r) s.repeat = r.value;
    if (n) s.notify = n.checked;
    schedWrite(s);
    lsSet(SCHED_SHOWN_KEY, "");
    schedRefreshUi();
    if (s.date) showToast("次の席替えを、" + schedLabel(s.date) + "に予約しました。", "success");
}

function schedClear() {
    schedWrite({ date: "", repeat: "none", notify: schedRead().notify });
    lsSet(SCHED_SHOWN_KEY, "");
    schedRefreshUi();
    schedHideBanner();
    showToast("席替えの予約を消しました。", "success");
}

function schedHideBanner() {
    const b = $id("schedBanner");
    if (b) b.remove();
}

function schedPulseShuffle() {
    const btn = $id("btnMainShuffle");
    if (!btn) return;
    btn.classList.add("sched-pulse");
    try { btn.scrollIntoView({ block: "center", behavior: "smooth" }); } catch (e) { /* 何もしない */ }
    setTimeout(() => btn.classList.remove("sched-pulse"), 5000);
}

function schedShowBanner(text, due) {
    schedHideBanner();
    const b = document.createElement("div");
    b.id = "schedBanner";
    b.className = "sched-banner";
    b.setAttribute("role", "status");
    b.setAttribute("data-plugin", "schedule");
    const msg = document.createElement("div");
    msg.className = "sched-banner-text";
    msg.textContent = "📅 " + text;
    b.appendChild(msg);
    const row = document.createElement("div");
    row.className = "sched-banner-btns";
    if (due) {
        const go = document.createElement("button");
        go.type = "button"; go.className = "sched-go";
        go.textContent = "席替えスタートへ";
        go.onclick = () => { schedHideBanner(); schedPulseShuffle(); };
        row.appendChild(go);
    }
    const later = document.createElement("button");
    later.type = "button"; later.className = "sched-later";
    later.textContent = due ? "後で" : "とじる";
    later.onclick = schedHideBanner;
    row.appendChild(later);
    b.appendChild(row);
    document.body.appendChild(b);
}

// 起動した時に、予約の日が来ていれば（または、あしたなら）、1日1回だけ知らせます
function schedCheckOnStart() {
    const s = schedRead();
    if (!s.date || !s.notify) return;
    const left = schedDaysLeft(s.date);
    const key = schedYmd(new Date()) + "_" + s.date;
    if (lsGet(SCHED_SHOWN_KEY, "") === key) return;
    if (left <= 0) {
        lsSet(SCHED_SHOWN_KEY, key);
        schedShowBanner(left === 0 ? "今日は、予約していた席替えの日です。" : "予約していた席替えの日は、" + schedLabel(s.date) + "でした。すぎています。", true);
    } else if (left === 1) {
        lsSet(SCHED_SHOWN_KEY, key);
        schedShowBanner("あしたは、予約していた席替えの日です。", false);
    }
}

// 開いたままの時にも、知らせます：日付が変わった時と、しばらく画面から離れて戻ってきた時に、調べ直します。
// 調べるのは、1分に1回だけで、とても軽い処理です（保存した値を読むだけです）
let schedLastDay = schedYmd(new Date());
let schedTimer = null;

function schedTick() {
    const today = schedYmd(new Date());
    if (today !== schedLastDay) {
        schedLastDay = today;
        schedRefreshUi();
    }
    schedCheckOnStart();
}

function schedStartWatching() {
    if (schedTimer) return;
    schedTimer = setInterval(() => { if (document.visibilityState === "visible") schedTick(); }, 60000);
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") schedTick(); });
    window.addEventListener("focus", schedTick);
}

// 予約の日（またはそれ以降）に席替えをしたら、予約を、次の日付に進めます
function schedOnShuffleDone() {
    const s = schedRead();
    if (!s.date || schedDaysLeft(s.date) > 0) return;
    const next = schedNextDate(s.date, s.repeat);
    s.date = next;
    schedWrite(s);
    schedHideBanner();
    schedRefreshUi();
    showToast(next ? "席替えの予約を、次の" + schedLabel(next) + "に進めました。" : "予約していた席替えが終わったので、予約を消しました。", "success");
}

const SCHED_CSS = `
.sched-banner { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 1800; width: min(92vw, 560px); box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 12px 16px; border-radius: 14px; background: var(--uis-s-surf, var(--card-bg, #fff)); color: var(--uis-s-text, var(--text-main, #1f2937)); border: 2px solid #f59e0b; box-shadow: 0 10px 30px rgba(0,0,0,0.22); }
.sched-banner-text { font-weight: 700; font-size: 15px; flex: 1 1 220px; }
.sched-banner-btns { display: flex; gap: 8px; }
.sched-banner-btns button { height: 40px; padding: 0 14px; border-radius: 10px; border: 1px solid var(--uis-b-line, var(--seat-border, #cbd5e1)); background: transparent; color: inherit; font-size: 14px; font-weight: 700; cursor: pointer; }
.sched-banner-btns button.sched-go { background: var(--uis-b-on-bg, #2563eb); border-color: var(--uis-b-on-bg, #2563eb); color: var(--uis-b-on-fg, #fff); }
@keyframes schedPulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(245,158,11,0.9); } 50% { box-shadow: 0 0 0 14px rgba(245,158,11,0); } }
.sched-pulse { animation: schedPulse 1s ease-in-out 5; }
.sched-box { margin-top: 12px; padding: 12px; border: 1px solid var(--seat-border, #cbd5e1); border-radius: 12px; }
.sched-box .sched-head { font-weight: 700; margin-bottom: 8px; display: flex; align-items: center; gap: 6px; }
.sched-box .sched-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; }
.sched-box .sched-row .switch-label { flex: 0 0 auto; white-space: nowrap; font-size: 13px; }
.sched-box .sched-row input[type="date"], .sched-box .sched-row select { flex: 1 1 0; min-width: 0; width: auto; }
.sched-box #schedStatus { margin-top: 10px; font-size: 13px; opacity: 0.85; }
@media (prefers-reduced-motion: reduce) { .sched-pulse { animation: none; outline: 3px solid #f59e0b; } }`;

SekigaeApp.registerPlugin({
    id: "schedule",
    name: "席替えの予約",
    version: "1.2",
    description: "次の席替え日を決めておくと、その日に、知らせます（起動した時と、開いたままの時）。くりかえしも選べます。",
    backupKeys: [SCHED_KEY],
    searchWords: "予約 次の席替え 日付 知らせる 通知 お知らせ くりかえし 毎週 毎月 カレンダー 予定",
    mount(app) {
        app.insertInto("guide-faq", "<li data-plugin=\"schedule\"><strong>席替えの日を、忘れないようにしたい</strong>：設定の「席替えのルール」にある「席替えの予約」で、次の席替え日を決めておくと、その日に起動した時に知らせます。毎週や毎月のくりかえしも選べます。</li>");
        const st = document.createElement("style");
        st.id = "scheduleStyle";
        st.textContent = SCHED_CSS;
        document.head.appendChild(st);
        const opts = SCHED_REPEATS.map(r => '<option value="' + r.v + '">' + r.label + '</option>').join("");
        app.insertInto("settings-rules",
            '<div class="sched-box" data-plugin="schedule">' +
            '<div class="sched-head">📅 席替えの予約<span id="schedInfoSlot"></span></div>' +
            '<div class="sched-row"><label for="schedDate" class="switch-label">次の席替え日</label><input type="date" id="schedDate" onchange="schedOnChange()"></div>' +
            '<div class="sched-row"><label for="schedRepeat" class="switch-label">くりかえし</label><select id="schedRepeat" onchange="schedOnChange()">' + opts + '</select></div>' +
            '<div class="sched-row"><span class="switch-label">起動した時に知らせる</span><label class="switch"><input type="checkbox" id="schedNotify" checked onchange="schedOnChange()"><span class="slider"></span></label></div>' +
            '<div id="schedStatus"></div>' +
            '<button type="button" class="btn-secondary" id="btnSchedClear" onclick="schedClear()" style="margin-top: 8px;">予約を消す</button>' +
            '</div>');
        const slot = $id("schedInfoSlot");
        if (slot && typeof makeInfoTip === "function") slot.appendChild(makeInfoTip("次の席替えの日を決めておくと、その日か、すぎた後に、このアプリを開いた時に、画面の上で知らせます。開いたままの時も、日付が変わった時や、画面に戻ってきた時に知らせます。あしたの分も、前の日に知らせます。知らせは、1日に1回だけです。席替えをすると、くりかえしの設定に合わせて、次の日付に進みます。"));
        schedRefreshUi();
        document.addEventListener("sekigae:shuffle-done", schedOnShuffleDone);
    },
    ready() {
        schedRefreshUi();
        setTimeout(schedCheckOnStart, 600);
        schedStartWatching();
    }
});
