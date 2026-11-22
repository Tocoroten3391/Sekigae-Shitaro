// ==========================================
// 作業の自動保存プラグイン（必須）：作業中の座席を自動で残し、閉じてしまっても戻せるようにします。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
const WORK_STATE_KEY = "work_state_v1";

const WORK_LOG_MAX = 30;

let workBaselineJson = "";

let workBaselineSnap = null;

let workAutosaveTimer = null;

let workRestoreChecked = false;

let workEditLog = [];

let workCloudSyncedJson = null; // GASに保存した時点の状態。これと同じ間は「クラウドと一致している」とみなす

function captureWorkSnapshot() {
    const val = id => { const el = $id(id); return el ? el.value : ""; };
    const toggle = $id("groupColorToggle");
    return {
        rawList: [...lastRawList],
        empty: val("emptySeatsInput"),
        cols: val("columnSelect"),
        rows: val("rowSelect"),
        groupType: val("groupTypeSelect"),
        groupColor: toggle ? toggle.checked : true,
        manualGroupMap: JSON.parse(JSON.stringify(manualGroupMap || {})),
        students: JSON.parse(JSON.stringify(currentStudents || []))
    };
}

function workSeatMap(snap) {
    const map = {};
    const cols = parseInt(snap.cols, 10) || 6;
    (snap.students || []).forEach((seat, idx) => {
        if (!seat || seat.type !== "STUDENT" || !seat.text) return;
        const key = getCleanStudentKey(seat.text);
        if (key) map[key] = getSeatLabel(idx, cols);
    });
    return map;
}

// 前回の保存状態と今の状態を比べて、「どこをどう編集したか」を短い文章にする。

function describeWorkChange(prev, next) {
    const parts = [];
    if (!prev || !prev.rawList || prev.rawList.length === 0) return "名簿を読み込み・座席表を作成";
    if (prev.cols !== next.cols || prev.rows !== next.rows) parts.push(`座席の列数・行数を変更：${prev.cols}列×${prev.rows}行 → ${next.cols}列×${next.rows}行`);

    const before = workSeatMap(prev), after = workSeatMap(next);
    const moved = Object.keys(after).filter(k => k in before && before[k] !== after[k]);
    if (moved.length >= 5) parts.push(`席替え・大きな配置変更：${moved.length}人の席が変わりました`);
    else moved.forEach(k => parts.push(`${k}：${before[k]} → ${after[k]} に移動`));

    if (prev.empty !== next.empty) parts.push(`空席の指定を変更：${prev.empty || "なし"} → ${next.empty || "なし"}`);

    const prevByKey = {}, nextByKey = {};
    prev.rawList.forEach(r => { prevByKey[getCleanStudentKey(r)] = r; });
    next.rawList.forEach(r => { nextByKey[getCleanStudentKey(r)] = r; });
    Object.keys(nextByKey).forEach(k => {
        if (!(k in prevByKey)) parts.push(`名簿に追加：${k}`);
        else if (prevByKey[k] !== nextByKey[k] && !moved.includes(k)) parts.push(`${k}：固定・指定・欠席などの設定を変更`);
    });
    Object.keys(prevByKey).forEach(k => { if (!(k in nextByKey)) parts.push(`名簿から削除：${k}`); });

    if (prev.groupType !== next.groupType) parts.push("班の決め方を変更");
    if (JSON.stringify(prev.manualGroupMap) !== JSON.stringify(next.manualGroupMap)) parts.push("班の手動色分けを変更");
    if (parts.length === 0) return "座席表を編集";
    return parts.slice(0, 6).join(" ／ ") + (parts.length > 6 ? ` ほか${parts.length - 6}件` : "");
}

function scheduleWorkAutosave() {
    if (!workRestoreChecked) return;
    clearTimeout(workAutosaveTimer);
    workAutosaveTimer = setTimeout(autosaveWorkState, 400);
}

function autosaveWorkState() {
    if (!workRestoreChecked || !lastRawList || lastRawList.length === 0) return;
    try {
        const snap = captureWorkSnapshot();
        const json = JSON.stringify(snap);
        if (json === workBaselineJson) return;
        const changeText = describeWorkChange(workBaselineSnap, snap);
        workEditLog.push({ at: Date.now(), text: changeText });
        if (workEditLog.length > WORK_LOG_MAX) workEditLog = workEditLog.slice(-WORK_LOG_MAX);
        pushWorkHistory(workBaselineSnap, "編集前の状態");
        pushWorkHistory(snap, changeText);
        localStorage.setItem(WORK_STATE_KEY, JSON.stringify({ savedAt: Date.now(), appVersion: APP_VERSION, state: snap, log: workEditLog, cloudSynced: json === workCloudSyncedJson }));
        workBaselineJson = json;
        workBaselineSnap = snap;
    } catch (error) {
        console.warn("作業状態の自動保存に失敗しました:", error);
    }
}

// リロード直前にも、まだ保存されていない変更があれば保存する。

window.addEventListener("beforeunload", () => { clearTimeout(workAutosaveTimer); autosaveWorkState(); });

document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { clearTimeout(workAutosaveTimer); autosaveWorkState(); } });

// 「キャッシュから復元」用に、直近の状態を最大10件まで残しておく。

const WORK_HISTORY_KEY = "work_state_history_v1";

const WORK_HISTORY_MAX = 10;

function loadWorkHistory() {
    try {
        const list = JSON.parse(localStorage.getItem(WORK_HISTORY_KEY) || "[]");
        return Array.isArray(list) ? list : [];
    } catch (error) { return []; }
}

function pushWorkHistory(snap, text) {
    if (!snap || !snap.rawList || snap.rawList.length === 0 || !snap.students || snap.students.length === 0) return;
    try {
        let list = loadWorkHistory();
        const json = JSON.stringify(snap);
        if (list.length > 0 && JSON.stringify(list[list.length - 1].state) === json) return;
        list.push({ at: Date.now(), text: text, state: snap });
        list = list.slice(-WORK_HISTORY_MAX);
        // 容量オーバーの時は、古いものから減らして保存し直す
        while (list.length > 0) {
            try { localStorage.setItem(WORK_HISTORY_KEY, JSON.stringify(list)); return; }
            catch (error) { list.shift(); }
        }
    } catch (error) {
        console.warn("キャッシュ履歴の保存に失敗しました:", error);
    }
}

function openCacheRestoreModal() {
    const body = $id("cacheRestoreBody");
    const overlay = $id("cacheRestoreModalOverlay");
    if (!body || !overlay) return;
    const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const list = loadWorkHistory();
    const nowJson = JSON.stringify(captureWorkSnapshot());
    if (list.length === 0) {
        body.innerHTML = '<p class="stats-empty">キャッシュに保存された編集はまだありません。座席を編集すると自動で保存されます。</p>';
    } else {
        body.innerHTML = list.map((e, i) => ({ e, i })).reverse().map(({ e, i }) => {
            const same = JSON.stringify(e.state) === nowJson;
            return `<div class="cache-restore-item"><div class="cache-restore-info"><span>${formatWorkTime(e.at)}${same ? "　現在と同じ" : ""}</span><div>${esc(e.text || "座席表を編集")}</div></div><button type="button" class="btn-secondary btn-compact" ${same ? "disabled" : ""} onclick="restoreFromCacheEntry(${i})">↩️ この状態に戻す</button></div>`;
        }).join("");
    }
    overlay.style.display = "flex";
}

function closeCacheRestoreModal() {
    const overlay = $id("cacheRestoreModalOverlay");
    if (overlay) overlay.style.display = "none";
}

function restoreFromCacheEntry(index) {
    const entry = loadWorkHistory()[index];
    if (!entry || !entry.state) { showToast("その状態は見つかりませんでした。", "error"); return; }
    saveSeatHistory(); // 「元に戻す」ボタンで、復元前の状態にも戻せるようにする
    try {
        applyWorkSnapshot(entry.state);
        closeCacheRestoreModal();
        showToast(`${formatWorkTime(entry.at)} の状態をキャッシュから復元しました。`, "success");
    } catch (error) {
        console.error(error);
        showToast("キャッシュからの復元に失敗しました。", "error");
    }
}

// GASへの保存が成功した時に呼ぶ。保存した内容から何も変わっていなければ「クラウドと一致」として記録し、
// その後リロードしても、復元の通知は出さない（編集が加わったら、また通知する）。

function markWorkSyncedToCloud(savedSnapJson) {
    if (!workRestoreChecked) return;
    try {
        const snap = captureWorkSnapshot();
        const json = JSON.stringify(snap);
        if (json !== savedSnapJson) return; // 保存中に編集された場合は、一致していないので記録しない
        clearTimeout(workAutosaveTimer);
        workCloudSyncedJson = json;
        if (json !== workBaselineJson) workEditLog.push({ at: Date.now(), text: describeWorkChange(workBaselineSnap, snap) });
        workEditLog.push({ at: Date.now(), text: "クラウドのGASに保存" });
        if (workEditLog.length > WORK_LOG_MAX) workEditLog = workEditLog.slice(-WORK_LOG_MAX);
        localStorage.setItem(WORK_STATE_KEY, JSON.stringify({ savedAt: Date.now(), appVersion: APP_VERSION, state: snap, log: workEditLog, cloudSynced: true }));
        workBaselineJson = json;
        workBaselineSnap = snap;
    } catch (error) {
        console.warn("クラウド保存状態の記録に失敗しました:", error);
    }
}

// 保存されていた状態（座席表・名簿・空席・列数行数・班の設定）を画面に反映する。

function applyWorkSnapshot(st) {
    const setVal = (id, v) => { const el = $id(id); if (el && v !== undefined && v !== "") el.value = v; };
    setVal("columnSelect", st.cols);
    const rSel = $id("rowSelect");
    if (rSel && st.rows) {
        if (!Array.from(rSel.options).some(opt => opt.value == st.rows)) {
            const o = document.createElement("option"); o.value = st.rows; o.textContent = st.rows + "行"; rSel.appendChild(o);
        }
        rSel.value = st.rows;
    }
    const eInput = $id("emptySeatsInput"); if (eInput) eInput.value = st.empty || "";
    const sInput = $id("studentInput"); if (sInput) sInput.value = st.rawList.join(", ");
    setVal("groupTypeSelect", st.groupType);
    const gt = $id("groupColorToggle"); if (gt && typeof st.groupColor === "boolean") gt.checked = st.groupColor;
    manualGroupMap = st.manualGroupMap || {};
    lastRawList = [...st.rawList];
    currentStudents = st.students;
    updateColumns();
    renderClassroom("none");
}

function restoreWorkState() {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(WORK_STATE_KEY) || "null"); } catch (error) { saved = null; }
    const st = saved && saved.state;
    if (st && Array.isArray(st.rawList) && st.rawList.length > 0 && Array.isArray(st.students) && st.students.length > 0) {
        try {
            applyWorkSnapshot(st);
            workEditLog = Array.isArray(saved.log) ? saved.log : [];
            if (saved.cloudSynced) {
                // GASに保存したあと何も編集していない場合は、復元の通知を出さず、静かに元の状態に戻す。
                workCloudSyncedJson = JSON.stringify(captureWorkSnapshot());
            } else {
                protectRestoredSeatsFromAutoSync = true;
                showWorkRestoredModal(saved);
            }
        } catch (error) {
            console.error("作業状態の復元に失敗しました:", error);
        }
    }
    workBaselineSnap = captureWorkSnapshot();
    workBaselineJson = JSON.stringify(workBaselineSnap);
    workRestoreChecked = true;
}

function formatWorkTime(ts) {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function showWorkRestoredModal(saved) {
    const body = $id("workRestoredBody");
    const overlay = $id("workRestoredModalOverlay");
    if (!body || !overlay) return;
    const esc = t => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const log = (saved.log || []).slice(-8).reverse();
    body.innerHTML = `<p class="work-restored-lead">最後の保存：${formatWorkTime(saved.savedAt)}。直前の座席表を復元しました。</p>` +
        (log.length ? '<div class="work-restored-log">' + log.map(e => `<div class="work-restored-item"><span>${formatWorkTime(e.at)}</span><div>${esc(e.text)}</div></div>`).join("") + "</div>" : "");
    overlay.style.display = "flex";
}

function closeWorkRestoredModal() {
    const overlay = $id("workRestoredModalOverlay");
    if (overlay) overlay.style.display = "none";
}

// 「復元をやめる」：保存してあった作業状態を捨てて、開き直す。

function discardWorkState() {
    if (isAppLocked()) { showLockedToast(); return; }
    try { localStorage.removeItem(WORK_STATE_KEY); } catch (error) {}
    workRestoreChecked = false;
    location.reload();
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "work-state",
    name: "作業の自動保存",
    version: "1.0",
    required: true,
    description: "作業中の座席を自動で残し、閉じてしまっても戻せるようにします。"
});
