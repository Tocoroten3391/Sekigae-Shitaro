// ==========================================
// プログラムタイマープラグイン：曜日ごとの時間割を登録しておくと、決めた時刻に、自動でチャイムが鳴ります。
// 始まる少し前の予鈴、始まりと終わりのチャイム、いまの授業の残り時間の表示、授業の始まりでタイマーを自動で始める機能があります。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります。席替えやタイマーは、これまでどおりに動きます
// ==========================================
const PT_KEY = "program_timer_v1";   // { on, pre, startSound, endSound, show, autoTimer, offDate, sets: [{ id, name, days: [0〜6], rows: [{ s, e, n }] }] }
const PT_DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const PT_TEMPLATES = {
    elem: { name: "小学校の例（45分）", rows: [["08:45", "09:30", "1時間目"], ["09:35", "10:20", "2時間目"], ["10:40", "11:25", "3時間目"], ["11:30", "12:15", "4時間目"], ["12:15", "13:00", "給食"], ["13:25", "14:10", "5時間目"], ["14:15", "15:00", "6時間目"]] },
    junior: { name: "中学校の例（50分）", rows: [["08:50", "09:40", "1時間目"], ["09:50", "10:40", "2時間目"], ["10:50", "11:40", "3時間目"], ["11:50", "12:40", "4時間目"], ["12:40", "13:25", "昼食"], ["13:35", "14:25", "5時間目"], ["14:35", "15:25", "6時間目"]] }
};
const PT_SOUNDS = { school: "🏫 学校のチャイム", ding: "🔔 ピンポン", bell: "🛎️ ベル", none: "鳴らさない" };

let ptData = null;       // 保存してある内容
let ptEdit = null;       // 編集中の時間割（保存するまでは、ここだけが変わります）
let ptEditId = "";
let ptEvents = null;     // 今日の予定の計算結果（内容が変わるまで使い回します）
let ptEventsKey = "";
let ptFired = {};        // 今日、もう鳴らした予定
let ptFiredDate = "";
let ptTimerId = null;
let ptChipText = null;

function ptEsc(t) { return String(t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])); }
function ptDefaults() { return { on: false, pre: 1, startSound: "school", endSound: "school", show: true, autoTimer: false, offDate: "", sets: [] }; }
function ptLoad() {
    let v = null;
    try { v = JSON.parse(lsGet(PT_KEY, "null")); } catch (e) { v = null; }
    const d = Object.assign(ptDefaults(), v && typeof v === "object" ? v : {});
    d.sets = (Array.isArray(d.sets) ? d.sets : []).filter(s => s && s.id && Array.isArray(s.rows)).map(s => ({
        id: String(s.id), name: String(s.name || "時間割"), days: Array.isArray(s.days) ? s.days.filter(x => x >= 0 && x <= 6) : [1, 2, 3, 4, 5],
        rows: s.rows.filter(r => r && /^\d{1,2}:\d{2}$/.test(r.s || "")).map(r => ({ s: ptNorm(r.s), e: /^\d{1,2}:\d{2}$/.test(r.e || "") ? ptNorm(r.e) : "", n: String(r.n || "") }))
    }));
    if (!["0", "1", "3", "5"].includes(String(d.pre))) d.pre = 1;
    d.pre = parseInt(d.pre, 10);
    if (!PT_SOUNDS[d.startSound]) d.startSound = "school";
    if (!PT_SOUNDS[d.endSound]) d.endSound = "school";
    ptData = d;
    return d;
}
function ptSave() {
    lsSet(PT_KEY, JSON.stringify(ptData));
    ptEvents = null;
    ptTick();
}
function ptNorm(t) { const m = String(t).match(/^(\d{1,2}):(\d{2})$/); return m ? String(parseInt(m[1], 10)).padStart(2, "0") + ":" + m[2] : ""; }
function ptSec(t) { const m = String(t).match(/^(\d{1,2}):(\d{2})$/); return m ? parseInt(m[1], 10) * 3600 + parseInt(m[2], 10) * 60 : -1; }
function ptDateKey(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
function ptFmtSec(sec) { return String(Math.floor(sec / 3600)).padStart(2, "0") + ":" + String(Math.floor(sec % 3600 / 60)).padStart(2, "0"); }

// 今日の曜日に合う時間割（最初に見つかったもの）
function ptSetFor(day) { return (ptData || ptLoad()).sets.find(s => s.days.includes(day)) || null; }

// 時間割から、鳴らす予定を作ります。同じ時刻に重なるときは、始まりを優先します
function ptBuildEvents(set) {
    if (!set) return [];
    const list = [];
    set.rows.forEach((r, i) => {
        const s = ptSec(r.s), e = ptSec(r.e);
        if (s < 0) return;
        const name = r.n || "授業";
        if (ptData.pre > 0 && s - ptData.pre * 60 >= 0) list.push({ sec: s - ptData.pre * 60, kind: "pre", name: name, i: i });
        list.push({ sec: s, kind: "start", name: name, i: i, dur: e > s ? e - s : 0 });
        if (e > s) list.push({ sec: e, kind: "end", name: name, i: i });
    });
    const rank = { start: 0, pre: 1, end: 2 };
    list.sort((a, b) => a.sec - b.sec || rank[a.kind] - rank[b.kind]);
    const out = [];
    list.forEach(ev => {
        const same = out.find(o => o.sec === ev.sec);
        if (!same) out.push(ev);
    });
    return out;
}
function ptTodayEvents(now) {
    const set = ptSetFor(now.getDay());
    const key = (set ? set.id : "-") + "|" + JSON.stringify(set ? set.rows : "") + "|" + ptData.pre;
    if (!ptEvents || key !== ptEventsKey) { ptEvents = ptBuildEvents(set); ptEventsKey = key; }
    return ptEvents;
}

// ---- 音 ----
function ptPlay(sound, isPre) {
    if (typeof isSilentTestMode !== "undefined" && isSilentTestMode) return;
    if (sound === "none") return;
    try { initAudio(); } catch (e) { return; }
    if (!audioCtx || typeof playBell !== "function") return;
    const t = audioCtx.currentTime + 0.05;
    if (isPre) {
        playBell(783.99, t, 1.4, 0.7, 0.4);
        playBell(659.25, t + 0.5, 1.8, 0.7, 0.4);
    } else if (sound === "school") {
        // キーン コーン カーン コーン（ミ ド レ ソ）、もう一度（ソ レ ミ ド）
        [[329.63, 0, 2.4], [261.63, 1, 2.4], [293.66, 2, 2.4], [196, 3, 3.4], [196, 5.2, 2.4], [293.66, 6.2, 2.4], [329.63, 7.2, 2.4], [261.63, 8.2, 4]].forEach(n => playBell(n[0], t + n[1], n[2], 0.95, 0.5));
    } else if (sound === "ding") {
        playBell(1046.5, t, 1.3, 0.9, 0.4);
        playBell(783.99, t + 0.55, 1.8, 0.9, 0.4);
    } else if (sound === "bell") {
        [0, 0.45, 0.9].forEach((d, i) => playBell(1046.5, t + d, i === 2 ? 2.4 : 1.6, 0.9, 0.4));
    }
}

function ptFire(ev) {
    if (ev.kind === "pre") {
        ptPlay("ding", true);
        showToast("🔔 予鈴です。まもなく「" + ev.name + "」です。", "info");
    } else if (ev.kind === "start") {
        ptPlay(ptData.startSound, false);
        showToast("🔔 「" + ev.name + "」の時間です。", "success");
        if (ptData.autoTimer && ev.dur > 0 && typeof setTimerTime === "function" && typeof toggleTimer === "function" && SekigaeApp.isEnabled("timer") && !isStopwatchMode) {
            try {
                if (typeof clearStepRun === "function") clearStepRun();
                setTimerTime(ev.dur);
                if (!isTimerRunning) toggleTimer();
            } catch (e) { console.warn(e); }
        }
    } else {
        ptPlay(ptData.endSound, false);
        showToast("🔔 「" + ev.name + "」の終わりの時間です。", "success");
    }
}

// ---- 1秒ごとの確認 ----
function ptTick() {
    if (!ptData) ptLoad();
    const now = new Date();
    const today = ptDateKey(now);
    if (ptFiredDate !== today) { ptFired = {}; ptFiredDate = today; }
    const muted = !ptData.on || ptData.offDate === today;
    const events = ptTodayEvents(now);
    const nowSec = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
    if (!muted) {
        events.forEach(ev => {
            const k = ev.sec + ev.kind;
            // 動きが少し遅れても鳴らします。ただし、ずいぶん前の予定は、鳴らしません
            if (nowSec >= ev.sec && nowSec - ev.sec <= 8 && !ptFired[k]) { ptFired[k] = true; ptFire(ev); }
        });
    }
    ptUpdateChip(now, nowSec, events, muted);
}

// 画面の隅に、いまの授業と残り時間を出します
function ptChipContent(nowSec, events, muted) {
    if (!ptData.on) return "";
    if (ptData.offDate === ptDateKey(new Date())) return "🔕 今日は、チャイムを鳴らしません";
    const set = ptSetFor(new Date().getDay());
    if (!set || !set.rows.length) return "";
    const rows = set.rows.map(r => ({ s: ptSec(r.s), e: ptSec(r.e), n: r.n || "授業" })).filter(r => r.s >= 0).sort((a, b) => a.s - b.s);
    const cur = rows.find(r => r.e > r.s && nowSec >= r.s && nowSec < r.e);
    if (cur) {
        const left = cur.e - nowSec, m = Math.floor(left / 60);
        return "🔔 " + cur.n + "　あと" + (m >= 1 ? m + "分" : left + "秒");
    }
    const next = rows.find(r => r.s > nowSec);
    if (next) {
        const gap = Math.ceil((next.s - nowSec) / 60);
        return "🔔 次は " + next.n + "　" + ptFmtSec(next.s) + "（あと" + gap + "分）";
    }
    return "";
}
function ptUpdateChip(now, nowSec, events, muted) {
    let chip = $id("ptChip");
    const text = ptData.show ? ptChipContent(nowSec, events, muted) : "";
    if (text === ptChipText) return;
    ptChipText = text;
    if (!text) { if (chip) chip.hidden = true; return; }
    if (!chip) {
        chip = document.createElement("button");
        chip.type = "button";
        chip.id = "ptChip";
        chip.className = "pt-chip";
        chip.title = "押すと、プログラムタイマーの設定が開きます";
        chip.onclick = () => openProgramTimer();
        document.body.appendChild(chip);
    }
    chip.hidden = false;
    chip.textContent = text;
}

// ---- 設定の画面 ----
function ptModalOpen() { const o = $id("ptModalOverlay"); return !!o && o.style.display !== "none"; }
function openProgramTimer() {
    if (typeof closePopMenus === "function") closePopMenus();
    ptLoad();
    ptSelectSet(ptData.sets.length ? (ptSetFor(new Date().getDay()) || ptData.sets[0]).id : "");
    ptRenderSettings();
    $id("ptModalOverlay").style.display = "flex";
}
function closeProgramTimer() { const o = $id("ptModalOverlay"); if (o) o.style.display = "none"; }
function ptRenderSettings() {
    $id("ptOnToggle").checked = !!ptData.on;
    $id("ptPreSelect").value = String(ptData.pre);
    $id("ptStartSound").value = ptData.startSound;
    $id("ptEndSound").value = ptData.endSound;
    $id("ptShowToggle").checked = !!ptData.show;
    $id("ptAutoTimerToggle").checked = !!ptData.autoTimer;
    $id("ptOffTodayToggle").checked = ptData.offDate === ptDateKey(new Date());
    const hasTimer = SekigaeApp.isEnabled("timer");
    $id("ptAutoTimerRow").style.display = hasTimer ? "" : "none";
    ptRenderToday();
}
function ptSettingChanged() {
    ptData.on = $id("ptOnToggle").checked;
    ptData.pre = parseInt($id("ptPreSelect").value, 10) || 0;
    ptData.startSound = $id("ptStartSound").value;
    ptData.endSound = $id("ptEndSound").value;
    ptData.show = $id("ptShowToggle").checked;
    ptData.autoTimer = $id("ptAutoTimerToggle").checked;
    ptData.offDate = $id("ptOffTodayToggle").checked ? ptDateKey(new Date()) : "";
    ptSave();
    ptRenderToday();
    if (ptData.on) { try { initAudio(); } catch (e) { /* 何もしない */ } }
}
function ptRenderToday() {
    const box = $id("ptToday");
    if (!box) return;
    const evs = ptTodayEvents(new Date());
    const label = { pre: "予鈴", start: "始まり", end: "終わり" };
    box.innerHTML = evs.length
        ? evs.map(ev => '<span class="pt-ev pt-ev-' + ev.kind + '">' + ptFmtSec(ev.sec) + " " + label[ev.kind] + (ev.kind === "pre" ? "" : "　" + ptEsc(ev.name)) + "</span>").join("")
        : '<span class="config-note" data-keep="1">今日の曜日に合う時間割が、ありません。</span>';
}
function ptTest(which) {
    try { initAudio(); } catch (e) { /* 何もしない */ }
    if (typeof isSilentTestMode !== "undefined" && isSilentTestMode) { showToast("サイレントモードなので、音は鳴りません。", "info"); return; }
    if (which === "pre") ptPlay("ding", true);
    else ptPlay(which === "start" ? $id("ptStartSound").value : $id("ptEndSound").value, false);
}

// 時間割（編集）
function ptSelectSet(id) {
    ptEditId = ptData.sets.some(s => s.id === id) ? id : "";
    const set = ptData.sets.find(s => s.id === ptEditId);
    ptEdit = set ? JSON.parse(JSON.stringify(set)) : { id: "", name: "ふだんの時間割", days: [1, 2, 3, 4, 5], rows: [] };
    ptRenderSets();
}
function ptRenderSets() {
    const sel = $id("ptSetSelect");
    sel.innerHTML = '<option value="">＋ 新しく作る</option>' + ptData.sets.map(s => '<option value="' + ptEsc(s.id) + '">' + ptEsc(s.name) + "　" + s.days.slice().sort().map(d => PT_DAYS[d]).join("") + "</option>").join("");
    sel.value = ptEditId;
    $id("ptSetName").value = ptEdit.name;
    $id("ptDays").innerHTML = PT_DAYS.map((d, i) => '<label class="pt-day"><input type="checkbox" value="' + i + '"' + (ptEdit.days.includes(i) ? " checked" : "") + ' onchange="ptReadEdit()"><span>' + d + "</span></label>").join("");
    ptRenderRows();
    $id("ptSetDeleteBtn").style.visibility = ptEditId ? "visible" : "hidden";
}
function ptRenderRows() {
    $id("ptRows").innerHTML = ptEdit.rows.map((r, i) =>
        '<div class="pt-row"><input type="time" id="ptS_' + i + '" value="' + ptEsc(r.s) + '" onchange="ptReadEdit()" aria-label="始まりの時刻"><span class="pt-to">〜</span>' +
        '<input type="time" id="ptE_' + i + '" value="' + ptEsc(r.e) + '" onchange="ptReadEdit()" aria-label="終わりの時刻">' +
        '<input type="text" id="ptN_' + i + '" class="pt-name" value="' + ptEsc(r.n) + '" placeholder="例: 1時間目" onchange="ptReadEdit()">' +
        '<button type="button" class="btn-delete-mini btn-rounded-box" onclick="ptRemoveRow(' + i + ')">✕</button></div>').join("")
        || '<p class="config-note" data-keep="1">まだ時間がありません。下の「時間を足す」か、「例から作る」で作れます。</p>';
}
function ptReadEdit() {
    ptEdit.name = ($id("ptSetName").value || "").trim() || "時間割";
    ptEdit.days = Array.from(document.querySelectorAll("#ptDays input:checked"), el => parseInt(el.value, 10));
    ptEdit.rows = ptEdit.rows.map((r, i) => {
        const s = $id("ptS_" + i), e = $id("ptE_" + i), n = $id("ptN_" + i);
        return s ? { s: ptNorm(s.value), e: ptNorm(e.value), n: n.value.trim() } : r;
    });
}
function ptAddRow() {
    ptReadEdit();
    if (ptEdit.rows.length >= 20) { showToast("時間は、最大20個までです。", "error"); return; }
    const last = ptEdit.rows[ptEdit.rows.length - 1];
    const start = last && last.e ? ptFmtSec(ptSec(last.e) + 5 * 60) : "08:45";
    ptEdit.rows.push({ s: start, e: ptFmtSec(ptSec(start) + 45 * 60), n: (ptEdit.rows.length + 1) + "時間目" });
    ptRenderRows();
}
function ptRemoveRow(i) { ptReadEdit(); ptEdit.rows.splice(i, 1); ptRenderRows(); }
function ptApplyTemplate() {
    const sel = $id("ptTemplateSelect");
    const t = PT_TEMPLATES[sel.value];
    if (!t) return;
    ptReadEdit();
    if (ptEdit.rows.length && !confirm("今の時間を、「" + t.name + "」に置きかえます。よろしいですか？")) return;
    ptEdit.rows = t.rows.map(r => ({ s: r[0], e: r[1], n: r[2] }));
    ptRenderRows();
    sel.value = "";
}
function ptSaveSet() {
    ptReadEdit();
    const rows = ptEdit.rows.filter(r => ptSec(r.s) >= 0).sort((a, b) => ptSec(a.s) - ptSec(b.s));
    if (!rows.length) { showToast("始まりの時刻が入った時間を、1つ以上作ってください。", "error"); return; }
    if (rows.some(r => r.e && ptSec(r.e) <= ptSec(r.s))) { showToast("終わりの時刻は、始まりより後にしてください。", "error"); return; }
    if (!ptEdit.days.length) { showToast("曜日を、1つ以上選んでください。", "error"); return; }
    const set = { id: ptEditId || "pt_" + Date.now().toString(36), name: ptEdit.name, days: ptEdit.days, rows: rows };
    const at = ptData.sets.findIndex(s => s.id === set.id);
    if (at >= 0) ptData.sets[at] = set; else ptData.sets.push(set);
    // 同じ曜日が、ほかの時間割と重なると、上にある時間割が使われます
    const dup = ptData.sets.filter(s => s.id !== set.id && s.days.some(d => set.days.includes(d)));
    ptSave();
    ptSelectSet(set.id);
    ptRenderToday();
    showToast("「" + set.name + "」を保存しました。" + (dup.length ? "同じ曜日の時間割が、他にもあります。上にある方が、使われます。" : ""), dup.length ? "info" : "success");
}
function ptDeleteSet() {
    const set = ptData.sets.find(s => s.id === ptEditId);
    if (!set || !confirm("時間割「" + set.name + "」を削除します。よろしいですか？")) return;
    ptData.sets = ptData.sets.filter(s => s.id !== ptEditId);
    ptSave();
    ptSelectSet("");
    ptRenderToday();
    showToast("削除しました。", "success");
}

const PT_CSS = `
.pt-chip { position: fixed; left: 12px; bottom: 12px; z-index: 900; padding: 8px 14px; border-radius: 999px; border: 1px solid rgba(100, 116, 139, 0.35); background: var(--uis-s-surf, var(--card-bg, #fff)); color: var(--uis-s-text, var(--text-main, #1e293b)); font-size: 13px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 14px rgba(15, 23, 42, 0.18); max-width: calc(100vw - 24px); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: auto; margin: 0; }
.pt-chip[hidden] { display: none; }
body.nomination-active .pt-chip, body.app-locked .pt-chip { display: none; }
.pt-days { display: flex; gap: 6px; flex-wrap: wrap; margin: 6px 0 10px; }
.pt-day { display: inline-flex; align-items: center; cursor: pointer; }
.pt-day input { position: absolute; opacity: 0; pointer-events: none; }
.pt-day span { min-width: 38px; text-align: center; padding: 7px 0; border-radius: 10px; border: 1px solid var(--seat-border, #e2e8f0); background: var(--input-bg, #f2f2f7); color: var(--input-text, #1c1c1e); font-weight: 700; font-size: 14px; }
.pt-day input:checked + span { background: var(--uis-b-on-bg, #0ea5e9); border-color: var(--uis-b-on-bg, #0ea5e9); color: var(--uis-b-on-fg, #fff); }
.pt-day input:focus-visible + span { outline: 2px solid var(--uis-focus, #0369a1); outline-offset: 2px; }
.pt-rows { display: flex; flex-direction: column; gap: 6px; margin: 6px 0; max-height: 34vh; overflow-y: auto; }
.pt-row { display: flex; align-items: center; gap: 6px; }
.pt-row input[type=time] { width: 112px; flex: none; padding: 8px 6px; }
.pt-row .pt-name { flex: 1; min-width: 0; padding: 8px; }
.pt-to { color: var(--text-sub, #64748b); }
.pt-today { display: flex; flex-wrap: wrap; gap: 4px; margin: 6px 0 10px; }
.pt-ev { font-size: 12px; padding: 3px 8px; border-radius: 8px; background: var(--input-bg, #f2f2f7); color: var(--input-text, #1c1c1e); }
.pt-ev-start { background: #dcfce7; color: #166534; }
.pt-ev-end { background: #fee2e2; color: #991b1b; }
.pt-ev-pre { background: #fef9c3; color: #854d0e; }
.pt-sound-row { display: flex; gap: 8px; flex-wrap: wrap; margin: 8px 0; }
.pt-sound-row > div { flex: 1 1 140px; min-width: 0; }
.pt-sound-row label { display: block; font-size: 12px; margin-bottom: 3px; color: var(--text-sub, #64748b); }
.pt-sound-row select { width: 100%; }
`;
const PT_HTML = `
<div id="ptModalOverlay" class="modal-overlay" style="display: none;">
    <div class="modal-content" style="max-width: 620px; width: 95%; max-height: 92vh; overflow-y: auto;">
        <h4 style="color: #0891b2;">🔔 プログラムタイマー <span data-pttip="曜日ごとの時間割を登録しておくと、決めた時刻に、自動でチャイムが鳴ります。始まる少し前の予鈴、始まりと終わりのチャイムが使えます。画面の隅には、今の授業と残り時間が出ます。ブラウザの決まりで、このページを開いてから、画面を一度タップしないと、音が鳴りません。同じ曜日が複数の時間割に入っている時は、一覧で上にあるものを使います。"></span></h4>
        <div class="switch-container">
            <label class="switch"><input type="checkbox" id="ptOnToggle" onchange="ptSettingChanged()"><span class="slider"></span></label>
            <span class="switch-label">決めた時刻に、自動でチャイムを鳴らす</span>
        </div>
        <div class="switch-container" style="margin-top: 8px;">
            <label class="switch"><input type="checkbox" id="ptOffTodayToggle" onchange="ptSettingChanged()"><span class="slider"></span></label>
            <span class="switch-label">今日だけ、鳴らさない</span>
        </div>
        <div class="pt-sound-row">
            <div><label for="ptPreSelect">予鈴</label><select id="ptPreSelect" onchange="ptSettingChanged()"><option value="0">鳴らさない</option><option value="1">1分前</option><option value="3">3分前</option><option value="5">5分前</option></select></div>
            <div><label for="ptStartSound">始まりの音</label><select id="ptStartSound" onchange="ptSettingChanged()"><option value="school">🏫 学校のチャイム</option><option value="ding">🔔 ピンポン</option><option value="bell">🛎️ ベル</option><option value="none">鳴らさない</option></select></div>
            <div><label for="ptEndSound">終わりの音</label><select id="ptEndSound" onchange="ptSettingChanged()"><option value="school">🏫 学校のチャイム</option><option value="ding">🔔 ピンポン</option><option value="bell">🛎️ ベル</option><option value="none">鳴らさない</option></select></div>
        </div>
        <div class="modal-btn-row" style="justify-content: flex-start; margin: 0 0 8px;">
            <button type="button" class="btn-secondary" onclick="ptTest('pre')">予鈴を聞く</button>
            <button type="button" class="btn-secondary" onclick="ptTest('start')">始まりを聞く</button>
            <button type="button" class="btn-secondary" onclick="ptTest('end')">終わりを聞く</button>
        </div>
        <div class="switch-container">
            <label class="switch"><input type="checkbox" id="ptShowToggle" onchange="ptSettingChanged()"><span class="slider"></span></label>
            <span class="switch-label">画面の隅に、今の授業と残り時間を出す</span>
        </div>
        <div class="switch-container" id="ptAutoTimerRow" style="margin-top: 8px;">
            <label class="switch"><input type="checkbox" id="ptAutoTimerToggle" onchange="ptSettingChanged()"><span class="slider"></span></label>
            <span class="switch-label">授業の始まりで、タイマーを自動で始める</span>
        </div>
        <div class="divider-line"></div>
        <label class="input-label" for="ptSetSelect">時間割：</label>
        <select id="ptSetSelect" onchange="ptSelectSet(this.value)"></select>
        <label class="input-label" for="ptSetName" style="margin-top: 10px;">名前：</label>
        <input type="text" id="ptSetName" placeholder="例: ふだんの時間割" onchange="ptReadEdit()">
        <label class="input-label" style="margin-top: 10px;">この時間割を使う曜日：</label>
        <div id="ptDays" class="pt-days"></div>
        <label class="input-label">時間（始まり〜終わり）：</label>
        <div id="ptRows" class="pt-rows"></div>
        <div class="modal-btn-row" style="justify-content: flex-start; margin: 8px 0 0;">
            <button type="button" class="btn-secondary btn-rounded-box" onclick="ptAddRow()">➕ 時間を足す</button>
            <select id="ptTemplateSelect" onchange="ptApplyTemplate()" aria-label="例から作る" style="flex: 1; min-width: 160px;"><option value="">📋 例から作る</option><option value="elem">小学校の例（45分）</option><option value="junior">中学校の例（50分）</option></select>
        </div>
        <label class="input-label" style="margin-top: 12px;">今日の予定：</label>
        <div id="ptToday" class="pt-today"></div>
        <div class="modal-btn-row">
            <button type="button" id="ptSetDeleteBtn" onclick="ptDeleteSet()" class="btn-delete-mini">削除</button>
            <button type="button" onclick="closeProgramTimer()" class="btn-secondary">閉じる</button>
            <button type="button" onclick="ptSaveSet()" class="btn-save">保存する</button>
        </div>
    </div>
</div>`;

SekigaeApp.registerPlugin({
    id: "program-timer",
    name: "プログラムタイマー",
    version: "1.1",
    description: "曜日ごとの時間割を登録しておくと、決めた時刻に、自動でチャイムが鳴ります。予鈴、始まりと終わりのチャイム、今の授業の残り時間の表示、授業の始まりでタイマーを自動で始める機能があります。",
    backupKeys: [PT_KEY],
    suggests: ["timer"],
    searchWords: "プログラムタイマー チャイム 予鈴 時間割 授業 休み時間 キンコンカンコン 鐘 ベル 自動 時刻 スケジュール",
    mount(app) {
        const st = document.createElement("style");
        st.id = "ptStyle";
        st.textContent = PT_CSS;
        document.head.appendChild(st);
        document.body.insertAdjacentHTML("beforeend", PT_HTML);
        document.querySelectorAll("#ptModalOverlay [data-pttip]").forEach(el => el.replaceWith(makeInfoTip(el.dataset.pttip)));
        app.insertInto("settings-timer", '<button type="button" onclick="openProgramTimer()" class="btn-secondary" id="btnProgramTimer" style="margin-top: 10px;">プログラムタイマー</button>');
        app.insertInto("guide-tools", '<li><strong>プログラムタイマー</strong>：設定の「アラームとチャイム」の「プログラムタイマー」で、曜日ごとの時間割を登録します。決めた時刻に、予鈴と、始まりと終わりのチャイムが、自動で鳴ります。画面の隅には、今の授業と残り時間が出ます。</li>');
    },
    ready() {
        ptLoad();
        ptTick();
        ptTimerId = setInterval(ptTick, 1000);
        // ブラウザは、画面を触るまで、音を出させません。最初に触った時に、音の準備をします
        const wake = () => { if (ptData && ptData.on) { try { initAudio(); } catch (e) { /* 何もしない */ } } };
        document.addEventListener("pointerdown", wake, { once: true, capture: true });
        document.addEventListener("keydown", wake, { once: true, capture: true });
    }
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && ptModalOpen()) closeProgramTimer();
});
