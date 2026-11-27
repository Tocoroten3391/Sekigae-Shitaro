// ==========================================
// クラスごとの記録と進級プラグイン（必須）：記録をクラスごとに分けて持ち、新しい学年へ進級させます。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
const CLASS_RECORD_KEYS = ["seat_history_log", "nomination_history_log", "seat_layout_log", "seat_timeline", "pair_history_log", "stats_archives"];

const TRIAL_CLASS_ID = "__sample__";

let activeClassId = "";

function readClassRecordStore() {
    try { const v = JSON.parse(lsGet("class_records_v1", "{}")); return (v && typeof v === "object" && !Array.isArray(v)) ? v : {}; } catch (error) { return {}; }
}

function writeClassRecordStore(store) { lsSet("class_records_v1", JSON.stringify(store)); }

function snapshotMainRecords() {
    const snap = {};
    CLASS_RECORD_KEYS.forEach(k => { const v = lsGet(k, null); if (v !== null) snap[k] = v; });
    return snap;
}

function hasMeaningfulRecords(snap) { return !!snap && CLASS_RECORD_KEYS.some(k => snap[k] !== undefined && countJsonEntries(snap[k]) > 0); }

function putMainRecords(snap) {
    CLASS_RECORD_KEYS.forEach(k => {
        if (snap && snap[k] !== undefined) lsSet(k, snap[k]);
        else { try { localStorage.removeItem(k); } catch (error) { /* そのまま続ける */ } }
    });
}

function flushActiveClassRecords() {
    if (activeClassId === TRIAL_CLASS_ID) return;
    const store = readClassRecordStore();
    store[activeClassId] = snapshotMainRecords();
    writeClassRecordStore(store);
}

function describeActiveClassRecords() {
    if (activeClassId === TRIAL_CLASS_ID) return "今見ているのはサンプルのクラスの記録です。サンプルを終わると消えます。";
    if (activeClassId) return `今見ているのはクラス「${activeClassId}」の記録です。クラスを切り替えると記録も切り替わります。`;
    return "今見ているのはクラスを選んでいない時の記録です。クラスを選ぶとそのクラスの記録に切り替わります。";
}

function updateStatsClassNote() { const n = $id("statsClassNote"); if (n) n.textContent = describeActiveClassRecords(); }

function updateClassStatusBar() {
    const bar = $id("classStatusBar"), txt = $id("classStatusText"), btn = $id("classStatusBtn");
    if (!bar || !txt) return;
    // 「本物の名簿にする」ボタン：サンプルを終わって、そのまま名簿を作る画面へ進みます
    let real = $id("classStatusRealBtn");
    if (!$id("classTrialStyle")) {
        const st = document.createElement("style");
        st.id = "classTrialStyle";
        // ボタンが増えても、「サンプルで試し中」が途中で切れないようにします
        st.textContent = ".class-status-bar.is-trial { max-width: 480px; } .class-status-bar.is-trial #classStatusText { overflow: visible; text-overflow: clip; flex: 0 0 auto; }";
        document.head.appendChild(st);
    }
    if (!real && btn) {
        btn.insertAdjacentHTML("beforebegin", '<button type="button" id="classStatusRealBtn" class="class-status-btn" onclick="trialToRealRoster()" hidden title="サンプルを終わって、本物の名簿を作ります">本物の名簿にする</button>');
        real = $id("classStatusRealBtn");
    }
    if (real) real.hidden = activeClassId !== TRIAL_CLASS_ID;
    if (activeClassId === TRIAL_CLASS_ID) {
        txt.textContent = "サンプルで試し中";
        bar.title = "サンプルのクラスで試し中です。この記録は本物のクラスには入りません。";
        if (btn) btn.hidden = false;
        bar.classList.add("is-trial");
        bar.hidden = false;
    } else if (activeClassId) {
        txt.textContent = `今のクラス：${activeClassId}`;
        bar.title = `今のクラス：${activeClassId}`;
        if (btn) btn.hidden = true;
        bar.classList.remove("is-trial");
        bar.hidden = false;
    } else {
        if (btn) btn.hidden = true;
        bar.hidden = true;
    }
}

function reloadRecordsIntoMemory() {
    loadHistoryLogs();
    loadSeatLayoutLog();
    loadSeatTimeline();
    nominatedHistoryList = [];
    clearNominationUndo();
    document.querySelectorAll(".seat").forEach(s => s.classList.remove("is-nominated", "is-already-nominated"));
    updateSeatCheckButton();
    updateCompareButton();
    updateNominationProgress();
    updateClassStatusBar();
    updateStatsClassNote();
    const m = $id("statsModalOverlay");
    if (m && getComputedStyle(m).display !== "none") renderStatsDashboard();
}

function initClassRecords() {
    const saved = lsGet("active_class_id", null);
    if (saved === null) {
        activeClassId = "";
        lsSet("active_class_id", "");
        // この版より前の記録は、最初に選んだクラスのものとして引き継ぐ
        if (hasMeaningfulRecords(snapshotMainRecords())) lsSet("legacy_records_pending", "1");
    } else {
        activeClassId = saved;
    }
    updateClassStatusBar();
    updateStatsClassNote();
}

function switchRecordClass(newId) {
    newId = newId || "";
    if (newId === activeClassId) return false;
    const wasTrial = activeClassId === TRIAL_CLASS_ID;
    if (!wasTrial) flushActiveClassRecords();
    const store = readClassRecordStore();
    delete store[TRIAL_CLASS_ID];
    let next = newId === TRIAL_CLASS_ID ? {} : (store[newId] || {});
    let adopted = false;
    if (newId !== "" && newId !== TRIAL_CLASS_ID && lsGet("legacy_records_pending", "") === "1") {
        lsSet("legacy_records_pending", "0");
        const legacy = store[""];
        if (!hasMeaningfulRecords(next) && hasMeaningfulRecords(legacy)) { next = legacy; store[""] = {}; adopted = true; }
    }
    if (newId !== TRIAL_CLASS_ID) store[newId] = next;
    writeClassRecordStore(store);
    putMainRecords(next);
    activeClassId = newId;
    lsSet("active_class_id", newId);
    reloadRecordsIntoMemory();
    if (adopted) showToast(`これまでの記録をクラス「${newId}」の記録として引き継ぎました。`, "success");
    return true;
}

// サンプルのクラス：試した記録は、本物のクラスに混ぜず、終わる時に捨てる

function startTrialClass() {
    if (activeClassId === TRIAL_CLASS_ID) return;
    lsSet("trial_return_class", activeClassId);
    switchRecordClass(TRIAL_CLASS_ID);
}

function endTrialIfActive(toNoClass) {
    if (activeClassId !== TRIAL_CLASS_ID) return false;
    const back = toNoClass ? "" : lsGet("trial_return_class", "");
    try { localStorage.removeItem("trial_return_class"); } catch (error) { /* そのまま続ける */ }
    switchRecordClass(back === TRIAL_CLASS_ID ? "" : back);
    return true;
}

function endTrialFromBar() {
    if (isAppLocked()) { showLockedToast(); return; }
    if (activeClassId !== TRIAL_CLASS_ID) return;
    if (!confirm("サンプルのクラスを終わります。試した記録は消えます。よろしいですか？")) return;
    clearTrialAndScreen();
    showToast("サンプルのクラスを終わりました。", "success");
}

// サンプルを終わって、本物の名簿を作る画面へ進みます
function trialToRealRoster() {
    if (isAppLocked()) { showLockedToast(); return; }
    if (activeClassId !== TRIAL_CLASS_ID) return;
    if (!confirm("サンプルを終わって、本物の名簿を作ります。試した記録は消えます。よろしいですか？")) return;
    clearTrialAndScreen();
    if (typeof openRosterEditor === "function") openRosterEditor();
}

function clearTrialAndScreen() {
    endTrialIfActive(false);
    const sInput = $id("studentInput");
    if (sInput) sInput.value = "";
    lastRawList = [];
    currentStudents = [];
    seatHistory = [];
    seatRedo = [];
    try { localStorage.removeItem("seat_undo_v1"); } catch (error) { /* そのまま続ける */ }
    try { localStorage.removeItem(WORK_STATE_KEY); } catch (error) { /* そのまま続ける */ }
    renderClassroom("none");
}

// ==========================================
// 進級の切り替え：新しい学年のクラスを作って、記録をまっさらから始める
// ==========================================

function suggestNextGradeName(name) {
    const m = /^(\s*)([0-9０-９]+)(年.*)$/.exec(name || "");
    if (!m) return "";
    const n = parseInt(m[2].replace(/[０-９]/g, ch => String(ch.charCodeAt(0) - 0xFF10)), 10);
    if (!(n >= 1) || n >= 6) return "";
    const full = /[０-９]/.test(m[2]);
    const next = String(n + 1);
    return m[1] + (full ? next.replace(/[0-9]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0xFEE0)) : next) + m[3];
}

function readPresetsSafe() {
    try { const v = JSON.parse(localStorage.getItem("seat_shuffler_presets") || "{}"); return (v && typeof v === "object") ? v : {}; } catch (error) { return {}; }
}

function openPromoteModal() {
    if (isAppLocked()) { showLockedToast(); return; }
    if (!activeClassId || activeClassId === TRIAL_CLASS_ID) {
        showToast("進級させるクラスを先に選んでください。クラスは名前を付けて「保存」すると選べます。", "error");
        return;
    }
    const from = $id("promoteFromText");
    if (from) from.textContent = `今のクラス「${activeClassId}」から、新しい学年のクラスを作ります。`;
    const inp = $id("promoteNewName");
    if (inp) inp.value = suggestNextGradeName(activeClassId);
    const ra = document.querySelector('input[name="promoteRoster"][value="reset"]');
    if (ra) ra.checked = true;
    const ao = $id("promoteArchiveOld");
    if (ao) ao.checked = true;
    updatePromoteHint();
    const overlay = $id("promoteModalOverlay");
    if (overlay) overlay.style.display = "flex";
    if (inp) inp.focus();
}

function closePromoteModal() {
    const overlay = $id("promoteModalOverlay");
    if (overlay) overlay.style.display = "none";
}

function updatePromoteHint() {
    const inp = $id("promoteNewName"), hint = $id("promoteNameHint"), btn = $id("btnPromoteGo");
    if (!inp || !hint) return;
    const name = inp.value.trim();
    let msg = "", ok = true;
    if (!name) { msg = "新しいクラスの名前を入れてください。"; ok = false; }
    else if (name === activeClassId || readPresetsSafe()[name]) { msg = "その名前のクラスはもうあります。別の名前にしてください。"; ok = false; }
    hint.textContent = msg;
    if (btn) btn.disabled = !ok;
}

function confirmPromote() {
    if (isAppLocked()) { showLockedToast(); return; }
    const inp = $id("promoteNewName");
    const newName = inp ? inp.value.trim() : "";
    const oldName = activeClassId;
    if (!newName || !oldName || oldName === TRIAL_CLASS_ID) return;
    const presets = readPresetsSafe();
    if (newName === oldName || presets[newName]) { updatePromoteHint(); return; }
    const mode = (document.querySelector('input[name="promoteRoster"]:checked') || {}).value === "keep" ? "keep" : "reset";

    // いまの画面の内容を、新しいクラスのひな形にする
    const gInput = $id("gasUrlInput"), cSel = $id("columnSelect"), rSel = $id("rowSelect"), eInput = $id("emptySeatsInput");
    const sInput = $id("studentInput"), tSel = $id("groupTypeSelect"), cTog = $id("groupColorToggle");
    const base = presets[oldName] || {};
    const rosterKept = mode === "keep" ? (sInput ? sInput.value : (base.students || "")).replace(/\[休\]/g, "").trim() : "";
    presets[newName] = {
        gasUrl: gInput ? gInput.value.trim() : (base.gasUrl || ""),
        cols: cSel ? cSel.value : "6",
        rows: rSel ? rSel.value : "6",
        emptySeats: eInput ? eInput.value.trim() : "",
        students: rosterKept,
        groupType: tSel ? tSel.value : "column",
        groupColorToggle: cTog ? cTog.checked : false,
        groupNames: { ...groupNames },
        groupColors: { 1: getCurrentGroupColor(1), 2: getCurrentGroupColor(2), 3: getCurrentGroupColor(3), 4: getCurrentGroupColor(4), 5: getCurrentGroupColor(5), 6: getCurrentGroupColor(6), 7: getCurrentGroupColor(7), 8: getCurrentGroupColor(8) },
        groupCount: seatGroupCount,
        manualGroupMap: mode === "keep" ? { ...manualGroupMap } : {}
    };
    const archiveOld = $id("promoteArchiveOld");
    if (archiveOld && archiveOld.checked && presets[oldName]) presets[oldName].archived = true;
    localStorage.setItem("seat_shuffler_presets", JSON.stringify(presets));

    // 指名から外す設定、お休み、指名済みの印を外す
    specificallyExcludedStudents = new Set();
    try { localStorage.setItem("nominate_specific_excluded", JSON.stringify([])); } catch (error) { /* そのまま続ける */ }
    nominatedHistoryList = [];
    if (mode === "reset") {
        separationPairs = []; saveSeparationPairs();
        nearPairs = []; saveNearPairs();
    }

    // 記録を切り替える（前のクラスの記録は、前のクラスに控えとして残る）
    switchRecordClass(newName);
    lsSet("active_class_id", newName);

    // 画面を、新しいクラスの内容にする
    seatHistory = [];
    seatRedo = [];
    try { localStorage.removeItem("seat_undo_v1"); } catch (error) { /* そのまま続ける */ }
    try { localStorage.removeItem(WORK_STATE_KEY); } catch (error) { /* そのまま続ける */ }
    if (mode === "reset") {
        if (sInput) sInput.value = "";
        lastRawList = [];
        currentStudents = [];
        manualGroupMap = {};
    }
    const nInput = $id("presetNameInput");
    if (nInput) nInput.value = newName;
    updatePresetRadioButtons();
    if (typeof renderSeparationList === "function") { try { renderSeparationList(); } catch (error) { /* そのまま続ける */ } }
    if (typeof renderNearList === "function") { try { renderNearList(); } catch (error) { /* そのまま続ける */ } }
    if (typeof renderSpecificExcludeList === "function") renderSpecificExcludeList();
    if (mode === "keep") loadPreset(newName);
    else renderClassroom("none");
    reloadRecordsIntoMemory();
    closePromoteModal();
    showToast(mode === "keep"
        ? `クラス「${newName}」を作りました。名簿は引き継いでいます。`
        : `クラス「${newName}」を作りました。新しい名簿を入れてください。`, "success");
}

// クラスの保存：いまの記録を、そのクラスのものにするかを決める

function adoptRecordsForSavedClass(name) {
    if (!name || name === activeClassId) return;
    const store = readClassRecordStore();
    const own = hasMeaningfulRecords(store[name]);
    const fromUnsaved = activeClassId === "" || activeClassId === TRIAL_CLASS_ID;
    if (fromUnsaved && !own && hasMeaningfulRecords(snapshotMainRecords())) {
        if (confirm(`今の記録をクラス「${name}」の記録として引き継ぎますか？\n「キャンセル」を選ぶとクラス「${name}」は、新しい記録から始まります。`)) {
            if (activeClassId === "") store[""] = {};
            delete store[TRIAL_CLASS_ID];
            writeClassRecordStore(store);
            activeClassId = name;
            lsSet("active_class_id", name);
            lsSet("legacy_records_pending", "0");
            try { localStorage.removeItem("trial_return_class"); } catch (error) { /* そのまま続ける */ }
            reloadRecordsIntoMemory();
            showToast(`今の記録をクラス「${name}」の記録にしました。`, "success");
            return;
        }
        lsSet("legacy_records_pending", "0");
    }
    switchRecordClass(name);
}

// クラスの削除：そのクラスの記録もいっしょに消す

function removeClassRecords(name) {
    if (!name) return;
    const store = readClassRecordStore();
    delete store[name];
    writeClassRecordStore(store);
    if (activeClassId === name) {
        putMainRecords(store[""] || {});
        activeClassId = "";
        lsSet("active_class_id", "");
        reloadRecordsIntoMemory();
    }
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "class-records",
    name: "クラスごとの記録と進級",
    version: "1.0",
    required: true,
    description: "記録をクラスごとに分けて持ち、新しい学年へ進級させます。"
});
