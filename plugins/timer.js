// ==========================================
// タイマーとアラームプラグイン：タイマー、ストップウォッチ、ステップタイマー、アラームを使えます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="timer" で結びついていて、自動で隠れます）
// ==========================================
function playAlarmPattern() {
    if (!audioCtx) return;
    const now = audioCtx.currentTime + 0.03;
    
    if (alarmType === "beep") {
        playTone(880, now, 0.15, "sine", { harm: 0.2, attack: 0.008, release: 0.05, vol: 0.8 });
        playTone(880, now + 0.3, 0.15, "sine", { harm: 0.2, attack: 0.008, release: 0.05, vol: 0.8 });
        playTone(880, now + 0.6, 0.4, "sine", { harm: 0.2, attack: 0.008, release: 0.12, vol: 0.8 });
    } else if (alarmType === "digital") {
        for (let i = 0; i < 8; i++) {
            playTone(1000, now + i * 0.1, 0.05, "square", { filter: 3200, attack: 0.003, release: 0.015, vol: 0.45 });
        }
    } else if (alarmType === "chime") {
        playBell(659.25, now, 2.2);
        playBell(523.25, now + 0.6, 2.2);
        playBell(587.33, now + 1.2, 2.2);
        playBell(392.00, now + 1.8, 3.0);
    } else if (alarmType === "mellow") {
        playTone(440, now, 1.0, "triangle", { attack: 0.08, release: 0.4, detune: 7, filter: 2400, wet: 0.35, vol: 0.9 });
        playTone(554.37, now + 0.8, 1.7, "triangle", { attack: 0.08, release: 0.8, detune: 7, filter: 2400, wet: 0.35, vol: 0.9 });
    } else if (alarmType === "warning") {
        for (let i = 0; i < 3; i++) {
            playTone(800, now + i * 0.2, 0.2, "sawtooth", { filter: 2600, attack: 0.01, release: 0.03, vol: 0.4 });
            playTone(1200, now + i * 0.2, 0.2, "sawtooth", { filter: 2600, attack: 0.01, release: 0.03, vol: 0.4 });
        }
    } else if (alarmType === "bell") {
        playBell(1046.5, now, 1.6, 0.9, 0.4);
        playBell(1046.5, now + 0.45, 1.6, 0.9, 0.4);
        playBell(1046.5, now + 0.9, 2.4, 0.9, 0.4);
    }
}
function playSingleBeep() {
    if (isSilentTestMode) return;
    initAudio();
    if (!audioCtx) return;
    const now = audioCtx.currentTime + 0.02;

    if (alarmType === "beep") {
        playTone(880, now, 0.2, "sine", { harm: 0.2, attack: 0.008, release: 0.06, vol: 0.8 });
    } else if (alarmType === "digital") {
        playTone(1000, now, 0.05, "square", { filter: 3200, attack: 0.003, release: 0.015, vol: 0.45 });
        playTone(1000, now + 0.1, 0.05, "square", { filter: 3200, attack: 0.003, release: 0.015, vol: 0.45 });
    } else if (alarmType === "chime") {
        playBell(659.25, now, 1.2, 0.9, 0.4);
    } else if (alarmType === "mellow") {
        playTone(440, now, 0.5, "triangle", { attack: 0.05, release: 0.25, detune: 7, filter: 2400, wet: 0.3, vol: 0.9 });
    } else if (alarmType === "warning") {
        playTone(800, now, 0.15, "sawtooth", { filter: 2600, attack: 0.01, release: 0.03, vol: 0.4 });
    } else if (alarmType === "bell") {
        playBell(1046.5, now, 1.0, 0.9, 0.35);
    }
}
function playAlarmSound() {
    if (isSilentTestMode) return;
    initAudio();
    if (!audioCtx) return;
    
    stopAlarmSound(); 

    if (isContinuousAlarm) {
        playAlarmPattern();
        
        let intervalTime = 1200;
        if (alarmType === "digital") intervalTime = 1000;
        if (alarmType === "chime") intervalTime = 3200;
        if (alarmType === "mellow") intervalTime = 2500;
        if (alarmType === "warning") intervalTime = 1000;
        if (alarmType === "bell") intervalTime = 3200;
        
        continuousAlarmInterval = setInterval(playAlarmPattern, intervalTime);
    } else {
        playAlarmPattern();
    }
}
function stopAlarmSound() {
    if (continuousAlarmInterval) {
        clearInterval(continuousAlarmInterval);
        continuousAlarmInterval = null;
    }
}
function updateAlarmSettings() {
    const sel = $id('alarmSoundSelect');
    if (sel) {
        alarmType = sel.value;
    }
    updateVolumeUI();
    
    initAudio();
    stopAlarmSound();
    
    if(!isSilentTestMode) {
        playAlarmPattern(); 
    }
}
function toggleSilentTestMode() {
    const tog = $id('silentTestModeToggle');
    if (!tog) return;
    isSilentTestMode = tog.checked;
    localStorage.setItem("silent_test_mode", isSilentTestMode);
    showToast(isSilentTestMode ? "🤫 完全サイレントモードをONにしました。" : "サイレントモードを解除しました。", "success");
    if (!isStopwatchMode && timerMilliseconds < 0) {
        updateTimerDisplay();
    }
}
function updateTimerEndAnim() {
    const sel = $id("timerEndAnimSelect");
    if (sel) {
        timerEndAnimType = sel.value;
        localStorage.setItem("timer_end_anim", timerEndAnimType);
        if (!isStopwatchMode && timerMilliseconds < 0) {
            updateTimerDisplay();
        }
    }
}

// ==========================================
// タイマー・ストップウォッチ処理
// ==========================================
function renderTimerButtons() {
    const pRow = $id("quickPresetRow");
    if (pRow) {
        pRow.innerHTML = customTimerPresets.map((item) => {
            const sec = item.unit === "min" ? item.value * 60 : item.value;
            const label = item.unit === "min" ? `${item.value}分` : `${item.value}秒`;
            return `<button class="btn-secondary" onclick="setTimerTime(${sec})">${label}</button>`;
        }).join("");
    }
    
    const addHtml = customTimerAdds.map((item, i) => {
        const sec = item.unit === "min" ? item.value * 60 : item.value;
        const label = item.unit === "min" ? `+${item.value}分` : `+${item.value}秒`;
        let cls = "btn-secondary";
        if (i % 3 === 1) cls = "btn-connect-mini";
        if (i % 3 === 2) cls = "btn-save";      // 「btn-main」は、画面に出ない部品用の名前なので、使わない
        return `<button class="${cls}" onclick="addTimerTime(${sec})">${label}</button>`;
    }).join("");

    const aRow = $id("quickAddRow");
    if (aRow) aRow.innerHTML = addHtml;
    
    const gRow = $id("giantQuickAddRow");
    if (gRow) gRow.innerHTML = addHtml;
}
function openTimerBtnModal(type) {
    currentEditingBtnType = type;
    const title = $id("timerBtnModalTitle");
    if (title) {
        title.textContent = type === "preset" ? "🕒 クイック・プリセット設定" : "✏️ 手動追加ボタン設定";
    }
    renderTimerBtnModalList();
    document.body.style.overflow = "hidden";
    const modal = $id("timerBtnModalOverlay");
    if (modal) modal.style.display = "flex";
}
function closeTimerBtnModal() {
    document.body.style.overflow = "";
    const modal = $id("timerBtnModalOverlay");
    if (modal) modal.style.display = "none";
}
function renderTimerBtnModalList() {
    const list = currentEditingBtnType === "preset" ? customTimerPresets : customTimerAdds;
    const container = $id("timerBtnListContainer");
    if (!container) return;
    
    container.innerHTML = list.map((item, i) => `
        <div style="display:flex; gap:10px; align-items:center; margin-bottom:10px; border: 1px solid var(--seat-border); padding: 10px; border-radius: 10px; background: var(--body-bg);">
            <input type="number" id="timerBtnVal_${i}" value="${item.value}" min="1" style="width: 80px !important; text-align: center; padding: 8px;">
            <select id="timerBtnUnit_${i}" style="width: 100px !important; padding: 8px;">
                <option value="sec" ${item.unit === "sec" ? "selected" : ""}>秒</option>
                <option value="min" ${item.unit === "min" ? "selected" : ""}>分</option>
            </select>
            <button class="btn-delete-mini btn-rounded-box" onclick="removeTimerBtnRow(${i})">✕</button>
        </div>
    `).join("");
}
function addTimerBtnRow() {
    const list = currentEditingBtnType === "preset" ? customTimerPresets : customTimerAdds;
    if (list.length >= 6) { 
        showToast("最大6個までです", "error"); 
        return; 
    }
    list.push({ value: 1, unit: "min" });
    renderTimerBtnModalList();
}
function removeTimerBtnRow(idx) {
    const list = currentEditingBtnType === "preset" ? customTimerPresets : customTimerAdds;
    list.splice(idx, 1);
    renderTimerBtnModalList();
}
function saveTimerBtnModal() {
    const list = currentEditingBtnType === "preset" ? customTimerPresets : customTimerAdds;
    for (let i = 0; i < list.length; i++) {
        const valInput = $id(`timerBtnVal_${i}`);
        const unitSelect = $id(`timerBtnUnit_${i}`);
        if (valInput && unitSelect) {
            let val = parseInt(valInput.value, 10);
            if (isNaN(val) || val <= 0) val = 1;
            list[i].value = val;
            list[i].unit = unitSelect.value;
        }
    }
    
    if (currentEditingBtnType === "preset") {
        localStorage.setItem("timer_presets", JSON.stringify(customTimerPresets));
    } else {
        localStorage.setItem("timer_adds", JSON.stringify(customTimerAdds));
    }
    
    renderTimerButtons();
    closeTimerBtnModal();
    showToast("保存しました。", "success");
}
function updateClock() {
    const clockEl = $id("realtimeClock");
    const giantClockEl = $id("giantClockDisplay");
    if (!clockEl && !giantClockEl) return;

    const { dateStr, timeStr } = getClockParts(new Date());

    if (clockEl) clockEl.innerHTML = `🕒 ${dateStr} ${timeStr}`; 
    if (giantClockEl) {
        const clockOnly = !!$id("giantTimeOverlay") && $id("giantTimeOverlay").classList.contains("clock-only");
        giantClockEl.style.marginTop = clockOnly ? "0" : "-5vh"; 
        if (clockOnly) {
            giantClockEl.innerHTML = `<span style="font-size: 0.4em; opacity: 0.9;">${dateStr}</span><br>🕒 ${timeStr}`;
        } else if (timerMilliseconds > 0 || isStopwatchMode) {
            giantClockEl.innerHTML = `🕒 ${timeStr}`;
        } else {
            giantClockEl.innerHTML = `<span style="font-size: 0.45em; opacity: 0.9;">${dateStr}</span><br>🕒 ${timeStr}`;
        }
    }

    if (!isTimerRunning && timerMilliseconds > 0 && !isStopwatchMode) {
        updateTimerDisplay();
    }
}
function updateGaugeType() {
    const sel = $id("gaugeTypeSelect");
    if (!sel) return;
    lsSet("timer_gauge_type", sel.value);
    updateTimerDisplay();
}

// 残り時間の見せ方：巨大表示の帯・円と、タイマー画面・上のバーの小さな帯
function isTimerGaugeBold() { return lsGet("timer_gauge_bold", "1") === "1"; }
function isTimerMiniBarOn() { return lsGet("timer_mini_bar", "1") === "1"; }
function applyTimerVisualSettings() {
    const type = lsGet("timer_gauge_type", "bar");
    const sel = $id("gaugeTypeSelect");
    if (sel) sel.value = ["bar", "circle", "none"].includes(type) ? type : "bar";
    const bold = $id("timerGaugeBoldToggle");
    if (bold) bold.checked = isTimerGaugeBold();
    const mini = $id("timerMiniBarToggle");
    if (mini) mini.checked = isTimerMiniBarOn();
    document.body.classList.toggle("timer-gauge-bold", isTimerGaugeBold());
}
function onTimerVisualToggle() {
    const bold = $id("timerGaugeBoldToggle");
    const mini = $id("timerMiniBarToggle");
    lsSet("timer_gauge_bold", bold && bold.checked ? "1" : "0");
    lsSet("timer_mini_bar", mini && mini.checked ? "1" : "0");
    applyTimerVisualSettings();
    updateTimerDisplay();
}
// 小さな帯を更新します。カウントダウン中だけ表示し、時間が見えない設定の時は隠します。
function updateTimerMiniBars(warningLineMs, fromTick) {
    const targets = [["timerMiniBar", "timerMiniBarFill"], ["compactTimerBar", "compactTimerBarFill"]];
    const show = isTimerMiniBarOn() && !isStopwatchMode && initialTimerMilliseconds > 0 && !isBlindModeActive;
    let state = "ok", pct = 0;
    if (show) {
        if (timerMilliseconds < 0) { state = "over"; pct = 100; }
        else {
            pct = Math.max(0, Math.min(100, (timerMilliseconds / initialTimerMilliseconds) * 100));
            if (timerMilliseconds <= warningLineMs) state = "warn";
        }
    }
    targets.forEach(([boxId, fillId]) => {
        const box = $id(boxId), fill = $id(fillId);
        if (!box || !fill) return;
        const key = boxId + "|" + (show ? Math.round(pct * 10) / 10 + "|" + state : "hide");
        if (fromTick && box._miniKey === key) return;      // 変わっていなければ書かない
        box._miniKey = key;
        box.hidden = !show;
        if (!show) return;
        fill.style.width = pct + "%";
        box.dataset.state = state;
    });
}

// ==========================================
// ステップタイマー（名前をつけて保存できる、順番に進むタイマー）
// ==========================================
const STEP_SETS_KEY = "timer_step_sets_v1";
const STEP_MAX = 12;
let stepSets = [];          // [{ id, name, steps: [{ label, sec }] }]
let stepRun = null;         // 実行中: { name, total }。残りのステップは routineQueue に入っている
let stepEditId = "";        // 編集中のセット（"" は新規）
let stepEditRows = [];      // 編集中のステップ行 [{ label, min, sec }]
function loadStepSets() {
    try {
        const list = JSON.parse(localStorage.getItem(STEP_SETS_KEY) || "[]");
        stepSets = Array.isArray(list) ? list.filter(x => x && Array.isArray(x.steps)) : [];
    } catch (error) { stepSets = []; }
    renderStepSetSelect();
}
function saveStepSets() {
    try { localStorage.setItem(STEP_SETS_KEY, JSON.stringify(stepSets)); } catch (error) { console.warn(error); }
    renderStepSetSelect();
}
function formatStepTime(sec) {
    const m = Math.floor(sec / 60), s = sec % 60;
    if (m > 0 && s > 0) return `${m}分${s}秒`;
    return m > 0 ? `${m}分` : `${s}秒`;
}
function renderStepSetSelect() {
    const sel = $id("stepSetSelect");
    if (!sel) return;
    const keep = sel.value;
    if (stepSets.length === 0) {
        sel.innerHTML = '<option value="">まだありません。「作成・編集」で作れます</option>';
        return;
    }
    sel.innerHTML = stepSets.map(set => {
        const total = set.steps.reduce((sum, st) => sum + st.sec, 0);
        return `<option value="${set.id}">${escapeStatsHtml(set.name)}　${set.steps.length}ステップ・計${formatStepTime(total)}</option>`;
    }).join("");
    if (stepSets.some(x => x.id === keep)) sel.value = keep;
}

// 1つのステップを始める。すでに動いていても、このステップの時間で数え直す。
function beginStepPhase(step) {
    currentPhaseLabel = step.label || "";
    setTimerTime(step.time);
    if (isTimerRunning) {
        clearInterval(timerIntervalId);
        isTimerRunning = false;
    }
    toggleTimer();
}
function startStepSet() {
    const sel = $id("stepSetSelect");
    const set = stepSets.find(x => x.id === (sel ? sel.value : ""));
    if (!set || set.steps.length === 0) {
        showToast("ステップタイマーがありません。「作成・編集」で作ってください。", "error");
        return;
    }
    if (isStopwatchMode) {
        showToast("タイマーのモードに切り替えてから使ってください。", "error");
        return;
    }
    stepRun = { name: set.name, total: set.steps.length };
    const queue = set.steps.map(st => ({ time: st.sec, label: st.label || "" }));
    const first = queue.shift();
    routineQueue = queue;
    beginStepPhase(first);
    showToast(`「${set.name}」を開始します。`, "success");
}
function advanceStep() {
    if (!stepRun || routineQueue.length === 0) {
        showToast("次のステップはありません。", "error");
        return;
    }
    stopAlarmSound();
    const next = routineQueue.shift();
    beginStepPhase(next);
}
function clearStepRun() {
    stepRun = null;
    routineQueue = [];
    currentPhaseLabel = "";
}

// 今どのステップかを、タイマーパネルに表示する
let lastStepProgressText = null;
function renderStepProgress() {
    const box = $id("stepProgress");
    const nextBtn = $id("stepNextBtn");
    if (!box) return;
    let html = "", showNext = false;
    if (stepRun) {
        const idx = stepRun.total - routineQueue.length;
        const next = routineQueue[0];
        html = `<strong>${escapeStatsHtml(stepRun.name)}</strong>　ステップ ${idx}/${stepRun.total}：${escapeStatsHtml(currentPhaseLabel || "名前なし")}` +
            (next ? `<br>次は「${escapeStatsHtml(next.label || "名前なし")}」、${formatStepTime(Math.round(next.time))}です。` : "<br>これが最後のステップです。");
        showNext = routineQueue.length > 0;
    }
    const key = html + "|" + showNext;
    if (key === lastStepProgressText) return;
    lastStepProgressText = key;
    box.innerHTML = html;
    box.style.display = html ? "block" : "none";
    if (nextBtn) nextBtn.style.display = showNext ? "" : "none";
}
function openStepSetModal() {
    selectStepSetForEdit($id("stepSetSelect") && $id("stepSetSelect").value ? $id("stepSetSelect").value : "");
    document.body.style.overflow = "hidden";
    const overlay = $id("stepSetModalOverlay");
    if (overlay) overlay.style.display = "flex";
}
function closeStepSetModal() {
    document.body.style.overflow = "";
    const overlay = $id("stepSetModalOverlay");
    if (overlay) overlay.style.display = "none";
}
function selectStepSetForEdit(id) {
    stepEditId = stepSets.some(x => x.id === id) ? id : "";
    const set = stepSets.find(x => x.id === stepEditId);
    const sel = $id("stepSetEditSelect");
    if (sel) {
        sel.innerHTML = '<option value="">＋ 新しく作る</option>' + stepSets.map(x => `<option value="${x.id}">${escapeStatsHtml(x.name)}</option>`).join("");
        sel.value = stepEditId;
    }
    const nameInput = $id("stepSetNameInput");
    if (nameInput) nameInput.value = set ? set.name : "";
    stepEditRows = set
        ? set.steps.map(st => ({ label: st.label, min: Math.floor(st.sec / 60), sec: st.sec % 60 }))
        : [{ label: "説明", min: 5, sec: 0 }, { label: "作業", min: 15, sec: 0 }];
    renderStepRows();
    const del = $id("stepSetDeleteBtn");
    if (del) del.style.visibility = set ? "visible" : "hidden";
}
function readStepRowsFromDom() {
    stepEditRows = stepEditRows.map((row, i) => {
        const l = $id(`stepLabel_${i}`), m = $id(`stepMin_${i}`), s = $id(`stepSec_${i}`);
        return l && m && s ? { label: l.value.trim(), min: Math.max(0, parseInt(m.value, 10) || 0), sec: Math.max(0, parseInt(s.value, 10) || 0) } : row;
    });
}
function renderStepRows() {
    const box = $id("stepRowsContainer");
    if (!box) return;
    box.innerHTML = stepEditRows.map((row, i) => `
        <div class="step-row">
            <span class="step-no">${i + 1}</span>
            <input type="text" id="stepLabel_${i}" class="step-label-input" placeholder="例: 作業" value="${escapeStatsHtml(row.label)}">
            <input type="number" id="stepMin_${i}" min="0" placeholder="分" value="${row.min}">
            <input type="number" id="stepSec_${i}" min="0" max="59" placeholder="秒" value="${row.sec}">
            <button type="button" class="btn-delete-mini btn-rounded-box" onclick="removeStepRow(${i})">✕</button>
        </div>`).join("") || '<p class="stats-empty">ステップがありません。「＋ ステップを追加」で作れます。</p>';
}
function addStepRow() {
    readStepRowsFromDom();
    if (stepEditRows.length >= STEP_MAX) { showToast(`ステップは最大${STEP_MAX}個までです。`, "error"); return; }
    stepEditRows.push({ label: "", min: 5, sec: 0 });
    renderStepRows();
}
function removeStepRow(i) {
    readStepRowsFromDom();
    stepEditRows.splice(i, 1);
    renderStepRows();
}
function saveStepSet() {
    readStepRowsFromDom();
    const nameInput = $id("stepSetNameInput");
    const name = (nameInput && nameInput.value.trim()) || "ステップタイマー";
    const steps = stepEditRows.map(r => ({ label: r.label, sec: r.min * 60 + r.sec })).filter(st => st.sec > 0);
    if (steps.length === 0) { showToast("時間が入ったステップを1つ以上作ってください。", "error"); return; }
    if (stepEditId) {
        const set = stepSets.find(x => x.id === stepEditId);
        if (set) { set.name = name; set.steps = steps; }
    } else {
        stepEditId = "step_" + Date.now().toString(36);
        stepSets.push({ id: stepEditId, name: name, steps: steps });
    }
    saveStepSets();
    const sel = $id("stepSetSelect");
    if (sel) sel.value = stepEditId;
    closeStepSetModal();
    showToast(`「${name}」を保存しました。`, "success");
}
function deleteStepSet() {
    const set = stepSets.find(x => x.id === stepEditId);
    if (!set) return;
    if (!confirm(`ステップタイマー「${set.name}」を削除します。よろしいですか？`)) return;
    stepSets = stepSets.filter(x => x.id !== stepEditId);
    saveStepSets();
    selectStepSetForEdit("");
    showToast("削除しました。", "success");
}
function toggleContinuousAlarm() {
    const tog = $id('continuousAlarmToggle');
    if (!tog) return;
    isContinuousAlarm = tog.checked;
    localStorage.setItem("continuous_alarm", isContinuousAlarm);
    showToast(isContinuousAlarm ? "止めるまで鳴らすモードです。" : "1回鳴らすモードです。", "success");

    // すでにタイマーが時間切れ（超過計測中）の状態で設定を切り替えたときの反映
    const isOvertime = !isStopwatchMode && isTimerRunning && timerMilliseconds < 0;
    if (isContinuousAlarm) {
        // 超過計測中にONにしたら、その場で繰り返し鳴動を開始
        if (isOvertime) {
            playAlarmSound();
        }
    } else {
        // OFFにしたら繰り返し鳴動を停止
        stopAlarmSound();
    }
}
function updateWarningPct() {
    const input = $id('warningPctInput');
    if (!input) return;
    let val = parseInt(input.value, 10);
    if (isNaN(val) || val < 1) val = 1;
    if (val > 99) val = 99;
    input.value = val;
    warningPercentage = val;
    localStorage.setItem("warning_percentage", warningPercentage);
    if (!isStopwatchMode && timerMilliseconds > 0) {
        updateTimerDisplay();
    }
}
function toggleMsDisplay() {
    const tog = $id('msToggle');
    if (!tog) return;
    showMilliseconds = tog.checked;
    localStorage.setItem("show_milliseconds", showMilliseconds);
    updateTimerDisplay(); 
}
function toggleHoursDisplay() {
    const tog = $id('hoursFormatToggle');
    if (!tog) return;
    showHoursFormat = tog.checked;
    localStorage.setItem("show_hours_format", showHoursFormat);
    showToast(showHoursFormat ? "60分を超えたら時間表示にします。" : "分:秒 表示に戻しました。", "success");
    updateTimerDisplay();
}
function toggleTimerPanel() {
    const panel = $id("timerPanel");
    if (!panel) return;
    if (panel.style.display === "none" || panel.style.display === "") {
        panel.style.display = "block";
        panel.style.animation = "slideDown 0.2s ease-out both";
    } else {
        panel.style.display = "none";
    }
}
function toggleGiantTimeMode(mode) {
    const overlay = $id("giantTimeOverlay");
    const panel = $id("timerPanel");
    const clockDisp = $id("giantClockDisplay");
    const timerCont = $id("giantTimerContainer");

    if (!overlay) return;
    overlay.style.display = "flex";
    overlay.classList.toggle("clock-only", mode === 'clock');
    if (panel) panel.style.display = "none"; 

    if (mode === 'clock') {
        if (clockDisp) { 
            clockDisp.style.fontSize = "calc(var(--gu) * 12)"; 
            clockDisp.style.display = "block"; 
        }
        if (timerCont) timerCont.style.display = "none";
    } else {
        if (clockDisp) { 
            clockDisp.style.fontSize = "calc(var(--gu) * 5)"; 
            clockDisp.style.display = "block"; 
        }
        if (timerCont) timerCont.style.display = "flex";
        updateGaugeType(); 
    }
}
function closeGiantTimeMode() {
    const overlay = $id("giantTimeOverlay");
    if (overlay) {
        overlay.style.display = "none";
        overlay.classList.remove("focus-active", "focus-peek", "clock-only");
        clearTimeout(giantPeekTimer);
    }
}
// 超・集中フォーカスモードの間は、ボタンが消える。マウスを動かす・押す・キーを押すと、数秒だけ出す。
// Esc キーでも、巨大表示を閉じられる。（フォーカスモードで、もどれなくなるのを防ぐ）
let giantPeekTimer = 0;
function giantFocusPeek() {
    const overlay = $id("giantTimeOverlay");
    if (!overlay || overlay.style.display === "none" || !overlay.classList.contains("focus-active")) return;
    overlay.classList.add("focus-peek");
    clearTimeout(giantPeekTimer);
    giantPeekTimer = setTimeout(() => overlay.classList.remove("focus-peek"), 4000);
}
(function bindGiantPeek() {
    const overlay = document.getElementById("giantTimeOverlay");
    if (!overlay) return;
    let lx = -1, ly = -1;
    overlay.addEventListener("mousemove", e => {
        if (lx >= 0 && Math.abs(e.clientX - lx) + Math.abs(e.clientY - ly) < 4) return;      // 手がふれただけの、小さな動きは無視
        lx = e.clientX; ly = e.clientY;
        giantFocusPeek();
    });
    overlay.addEventListener("pointerdown", giantFocusPeek);
    overlay.addEventListener("touchstart", giantFocusPeek, { passive: true });
    document.addEventListener("keydown", e => {
        const o = document.getElementById("giantTimeOverlay");
        if (!o || o.style.display === "none") return;
        if (e.key === "Escape") {
            const m = document.getElementById("pluginModalOverlay");
            if (m && m.style.display !== "none") return;      // 他の窓が開いている時は、その窓を先に閉じる
            closeGiantTimeMode();
            return;
        }
        giantFocusPeek();
    });
})();
function addTimerTime(secondsToAdd) {
    if (isStopwatchMode) return; 
    initAudio();
    if (timerAlarmAt) timerAlarmAt += secondsToAdd * 1000;     // 目覚まし式の時は、鳴らす時刻がずれる
    timerMilliseconds += secondsToAdd * 1000;
    if (timerMilliseconds > initialTimerMilliseconds) {
        initialTimerMilliseconds = timerMilliseconds;
    }
    if (timerMilliseconds > 0) { 
        hasPlayedAlarm = false; 
        stopAlarmSound(); 
    }
    if (!stepRun) routineQueue = []; // ステップタイマー中は、時間を足しても続きのステップを残す
    updateTimerDisplay();
    updateClock(); 
}
function handleCustomTimeSet(minId, secId) {
    const minEl = $id(minId);
    const secEl = $id(secId);
    if (!minEl || !secEl) return;
    
    let m = parseInt(minEl.value, 10) || 0;
    let s = parseInt(secEl.value, 10) || 0;
    if (m === 0 && s === 0) return;
    
    clearStepRun();
    setTimerTime(m * 60 + s);
    minEl.value = "";
    secEl.value = "";
}
function setTimerTime(seconds) {
    if (isStopwatchMode) return; 
    initAudio();
    timerAlarmAt = 0;
    timerMilliseconds = seconds * 1000;
    initialTimerMilliseconds = timerMilliseconds;
    hasPlayedAlarm = false; 
    hasPlayedHalfBell = false;
    hasPlayedOneMinBell = false;
    stopAlarmSound();
    updateTimerDisplay();
    updateClock(); 
}

// 指定した「時刻」の00秒ちょうどに鳴らす、目覚まし式のタイマー
// 鳴らす時刻（ミリ秒）を覚えておいて、残り時間は、いつも「鳴らす時刻 − いま」で出す。
// 動きが少し遅れても、時計がずれても、その時刻の00秒に鳴る。0なら、ふつうのタイマー
let timerAlarmAt = 0;
function setTimerToClockTime(inputId) {
    if (isStopwatchMode) {
        showToast("タイマーのモードに切り替えてから使ってください。", "error");
        return;
    }
    const el = $id(inputId);
    if (!el || !el.value) {
        showToast("時刻を入力してください。例えば 10:45 です。", "error");
        return;
    }
    const parts = el.value.split(":");
    const th = parseInt(parts[0], 10);
    const tm = parseInt(parts[1], 10);
    if (isNaN(th) || isNaN(tm)) {
        showToast("正しい時刻を入力してください。", "error");
        return;
    }

    const now = new Date();
    const target = new Date();
    target.setHours(th, tm, 0, 0);
    // 入力時刻がすでに過ぎていたら「翌日のその時刻」まで数える
    if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
    }

    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) {
        showToast("その時刻はもう過ぎています。", "error");
        return;
    }

    clearStepRun();
    setTimerTime(Math.ceil(diffMs / 1000));
    // 秒に丸めずに、ミリ秒まで、鳴らす時刻に合わせる
    timerAlarmAt = target.getTime();
    timerMilliseconds = diffMs;
    initialTimerMilliseconds = diffMs;
    updateTimerDisplay();

    // 指定時刻に向けて自動でスタート
    if (!isTimerRunning) toggleTimer();

    const eh = String(target.getHours()).padStart(2, '0');
    const em = String(target.getMinutes()).padStart(2, '0');
    showToast(`⏰ ${eh}:${em}:00 に鳴るようにセットしました。`, "success");
}
let tickRenderAt = 0, tickRenderSec = NaN;     // 最後に画面を書きかえた時刻と、その時の秒
function toggleTimer() {
    initAudio();
    
    if (isTimerRunning) {
        clearInterval(timerIntervalId);
        isTimerRunning = false;
        stopAlarmSound(); 
        const overlay = $id("giantTimeOverlay");
        if(overlay) overlay.classList.remove("focus-active");
    } else {
        if (!isStopwatchMode && timerMilliseconds === 0) {
            showToast("時間を追加してからスタートしてください。", "error");
            return;
        }
        
        if (initialTimerMilliseconds === 0 && timerMilliseconds > 0) {
            initialTimerMilliseconds = timerMilliseconds;
        }
        
        isTimerRunning = true;
        lastTickTime = Date.now();
        isBlindModeActive = false;
        if (!isStopwatchMode && timerAlarmAt) {      // 止めている間に時間が進んでいても、鳴らす時刻に合わせなおす
            timerMilliseconds = timerAlarmAt - lastTickTime;
            if (timerMilliseconds <= 0) timerAlarmAt = 0;
        }

        const fTog = $id("focusModeToggle");
        if (fTog && fTog.checked) {
            const overlay = $id("giantTimeOverlay");
            if(overlay) overlay.classList.add("focus-active");
        }

        timerIntervalId = setInterval(() => {
            const now = Date.now();
            const delta = now - lastTickTime;
            lastTickTime = now;
            
            if (isStopwatchMode) {
                timerMilliseconds += delta;
            } else {
                let previousMs = timerMilliseconds;
                if (timerAlarmAt) timerMilliseconds = timerAlarmAt - now;     // 目覚まし式：鳴らす時刻から、残りを出す
                else timerMilliseconds -= delta;
                
                const bTog = $id("intervalBellToggle");
                if (bTog && bTog.checked) {
                    let halfMs = initialTimerMilliseconds / 2;
                    if (!hasPlayedHalfBell && previousMs >= halfMs && timerMilliseconds < halfMs) { 
                        playSingleBeep(); 
                        hasPlayedHalfBell = true; 
                    }
                    if (!hasPlayedOneMinBell && previousMs >= 60000 && timerMilliseconds < 60000 && initialTimerMilliseconds > 60000) { 
                        playSingleBeep(); 
                        hasPlayedOneMinBell = true; 
                    }
                }

                if (previousMs >= 0 && timerMilliseconds < 0) {
                    timerAlarmAt = 0;      // 鳴らしたので、ここからは普通のタイマー（超過時間を数える）
                    tickRenderAt = 0;
                    playAlarmSound();
                    
                    const stepAutoToggle = $id("stepAutoToggle");
                    const autoNext = !stepRun || !stepAutoToggle || stepAutoToggle.checked;
                    if (routineQueue.length > 0 && autoNext) {
                        clearInterval(timerIntervalId); 
                        showToast("次の項目へ進みます。", "success");
                        setTimeout(() => {
                            stopAlarmSound();
                            let next = routineQueue.shift(); 
                            currentPhaseLabel = next.label; 
                            setTimerTime(next.time); 
                            lastTickTime = Date.now(); 
                            isTimerRunning = true; 
                            toggleTimer(); 
                            toggleTimer();
                        }, 3000); 
                    } else {
                        showToast(stepRun && routineQueue.length > 0 ? "時間です。「次のステップへ」を押すと進みます。" : (isSilentTestMode ? "時間です。サイレントモードで音は鳴りません。" : "時間です。超過時間の計測を開始します。"), isSilentTestMode ? "success" : "error");
                        hasPlayedAlarm = true;
                        const overlay = $id("giantTimeOverlay");
                        if (overlay) overlay.classList.remove("focus-active");
                    }
                }
            }
            // 画面の書きかえは、見た目が変わるときだけにします。ミリ秒を出すときは約30回、出さないときは秒が変わるときと0.1秒おき
            const secKey = Math.floor(timerMilliseconds / 1000);
            const gap = showMilliseconds ? 33 : 100;
            if (now - tickRenderAt >= gap || (!showMilliseconds && secKey !== tickRenderSec)) {
                tickRenderAt = now;
                tickRenderSec = secKey;
                updateTimerDisplay(true);
            }
        }, 10);
    }
    updateTimerStartBtns();
    updateClock(); 
}
function resetTimer() {
    timerAlarmAt = 0;
    timerMilliseconds = 0;
    initialTimerMilliseconds = 0; 
    hasPlayedAlarm = false;
    clearStepRun();
    lapTimes = [];
    isBlindModeActive = false; 
    hasPlayedHalfBell = false; 
    hasPlayedOneMinBell = false;
    
    stopAlarmSound(); 
    
    if (isTimerRunning) {
        clearInterval(timerIntervalId);
        isTimerRunning = false;
    }
    
    const overlay = $id("giantTimeOverlay");
    if(overlay) overlay.classList.remove("focus-active");
    
    const lapList = $id("lapListContainer");
    if(lapList) lapList.innerHTML = "";
    
    updateTimerStartBtns();
    updateTimerDisplay();
    
    const d1 = $id("timerDisplay");
    const d2 = $id("giantTimerDisplay");
    if (d1) d1.style.color = "";
    if (d2) d2.style.color = "#ffffff"; 
    
    updateClock(); 
}
function switchTimerMode() {
    isStopwatchMode = !isStopwatchMode;
    stopAlarmSound(); 
    resetTimer();
    
    const switchBtn = $id("timerModeSwitchBtn");
    const lapBtn = $id("giantLapBtn");
    const lapContainer = $id("lapContainer");
    
    if (isStopwatchMode) {
        if(switchBtn) { 
            switchBtn.innerHTML = "⏳ タイマーに切替"; 
            switchBtn.style.color = "#d97706"; 
            switchBtn.style.borderColor = "#fde68a"; 
            switchBtn.style.background = "#fffbeb"; 
        }
        if(lapBtn) lapBtn.style.display = "inline-block";
        if(lapContainer) lapContainer.style.display = "block";
        showToast("ストップウォッチのモードに切り替えました。", "success");
    } else {
        if(switchBtn) { 
            switchBtn.innerHTML = "ストップウォッチに切替"; 
            switchBtn.style.color = "#3b82f6"; 
            switchBtn.style.borderColor = "#bfdbfe"; 
            switchBtn.style.background = "#eff6ff"; 
        }
        if(lapBtn) lapBtn.style.display = "none";
        if(lapContainer) lapContainer.style.display = "none";
        showToast("タイマーのモードに切り替えました。", "success");
    }
    updateTimerDisplay();
    updateClock(); 
}
function updateTimerStartBtns() {
    const text = isTimerRunning ? "⏸ 一時停止" : "スタート";
    const btnSmall = $id("timerStartBtn");
    const btnGiant = $id("giantTimerStartBtn");
    const btnCompact = $id("compactTimerStartBtn");
    
    if (btnSmall) btnSmall.innerHTML = text;
    if (btnGiant) btnGiant.innerHTML = text;
    if (btnCompact) btnCompact.innerHTML = isTimerRunning ? "⏸" : "▶";
}
function recordLap() {
    if (!isStopwatchMode || !isTimerRunning) return;
    
    let absMs = Math.abs(timerMilliseconds);
    const m = String(Math.floor(absMs / 60000)).padStart(2, '0');
    const s = String(Math.floor((absMs % 60000) / 1000)).padStart(2, '0');
    const ms = String(Math.floor((absMs % 1000) / 10)).padStart(2, '0');
    
    let timeStr = `${m}:${s}.${ms}`;
    lapTimes.push(timeStr);
    
    let container = $id("lapListContainer");
    if (container) {
        let div = document.createElement("div");
        div.style.animation = "fadeIn 0.3s ease";
        div.innerHTML = `<span style="color: #94a3b8;">${lapTimes.length}位:</span> <span style="color: #fff;">${timeStr}</span>`;
        container.prepend(div);
    }
}
// 同じ値を何度も書かないための控えです。タイマーが動いている間の、毎回の書きかえだけで使います
const tdCache = Object.create(null);
function tdPut(key, value, apply) {
    if (tdCache[key] === value) return;
    tdCache[key] = value;
    apply(value);
}
function updateTimerDisplay(fromTick) {
    if (!fromTick) { for (const k in tdCache) delete tdCache[k]; }     // 他の場所から呼ばれた時は、控えを捨てて全部書きなおす
    renderStepProgress();
    let isNegative = (!isStopwatchMode && timerMilliseconds < 0);
    let absMs = Math.abs(timerMilliseconds);

    const totalSeconds = Math.floor(absMs / 1000);
    const ms = Math.floor((absMs % 1000) / 10);
    const strMs = String(ms).padStart(2, '0');
    const s = String(totalSeconds % 60).padStart(2, '0');

    let timeStr;
    // 「時間表示」設定がONで、かつ60分を超えている場合は「時:分:秒」形式にする
    if (showHoursFormat && totalSeconds >= 3600) {
        const h = String(Math.floor(totalSeconds / 3600));
        const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        timeStr = showMilliseconds ? `${h}:${mm}:${s}.${strMs}` : `${h}:${mm}:${s}`;
    } else {
        const m = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        timeStr = showMilliseconds ? `${m}:${s}.${strMs}` : `${m}:${s}`;
    }
    if (isNegative) timeStr = "-" + timeStr;

    const bTog = $id("blindTimerToggle");
    if (isTimerRunning && bTog && bTog.checked) {
        if (isStopwatchMode && timerMilliseconds >= 3000) { 
            timeStr = showMilliseconds ? "??:??.??" : "??:??"; 
            isBlindModeActive = true; 
        } else if (!isStopwatchMode && timerMilliseconds <= initialTimerMilliseconds - 3000 && timerMilliseconds > 0) { 
            timeStr = showMilliseconds ? "??:??.??" : "??:??"; 
            isBlindModeActive = true; 
        } else {
            isBlindModeActive = false;
        }
    } else { 
        isBlindModeActive = false; 
    }
    
    const warningLineMs = initialTimerMilliseconds * (warningPercentage / 100);
    let timerColor = "#ffffff", smallTimerColor = "";
    
    const displaySmall = $id("timerDisplay");
    const displayGiant = $id("giantTimerDisplay");
    const giantOverlay = $id("giantTimeOverlay");

    let wantAnim = "", wantSilentFlash = false;

    if (!isStopwatchMode) {
        if (timerMilliseconds < 0) { 
            timerColor = "#ef4444"; 
            smallTimerColor = "#ef4444"; 
            
            if (isSilentTestMode && giantOverlay && giantOverlay.style.display !== "none") {
                wantSilentFlash = true;
            } else {
                if (timerEndAnimType === "flash") wantAnim = "timer-anim-flash";
                else if (timerEndAnimType === "pulse") wantAnim = "timer-anim-pulse";
            }
        } 
        else if (initialTimerMilliseconds > 0 && timerMilliseconds <= warningLineMs && timerMilliseconds > 0) { 
            timerColor = "#fbbf24"; 
            smallTimerColor = "#d97706"; 
        }
    }

    // 終了後の点滅などの、クラスの付けはずし（変わるときだけ）
    tdPut("anim", wantAnim, v => {
        [displaySmall, displayGiant].forEach(el => {
            if (!el) return;
            el.classList.remove("timer-anim-flash", "timer-anim-pulse");
            if (v) el.classList.add(v);
        });
    });
    tdPut("silentFlash", wantSilentFlash, v => { if (giantOverlay) giantOverlay.classList.toggle("timer-anim-silent-flash", v); });

    if (giantOverlay && giantOverlay.style.display !== "none" && !giantOverlay.classList.contains("focus-active")) {
        let bg = "";
        if (!isStopwatchMode && initialTimerMilliseconds > 0) {
            if (timerMilliseconds < 0) bg = isSilentTestMode ? null : "rgba(153, 27, 27, 0.95)";
            else if (timerMilliseconds <= warningLineMs) bg = "rgba(180, 83, 9, 0.95)";
        }
        if (bg !== null) tdPut("overlayBg", bg, v => { giantOverlay.style.backgroundColor = v; });
    }

    if (displaySmall) { 
        tdPut("smallText", timeStr, v => { displaySmall.textContent = v; });
        tdPut("smallColor", smallTimerColor, v => { displaySmall.style.color = v; });
    }
    
    if (displayGiant) {
        tdPut("giantText", timeStr, v => { displayGiant.textContent = v; });
        let fs = showMilliseconds ? "calc(var(--gu) * 16)" : "calc(var(--gu) * 24)";
        if (isNegative) fs = showMilliseconds ? "calc(var(--gu) * 14)" : "calc(var(--gu) * 20)"; 
        tdPut("giantSize", fs, v => { displayGiant.style.fontSize = v; });
        tdPut("giantColor", timerColor, v => { displayGiant.style.color = v; });
    }
    
    const icon = $id("timerIcon");
    if (icon) tdPut("icon", isStopwatchMode, v => { icon.textContent = v ? "⏱️" : "⏳"; });

    const phaseEl = $id("giantPhaseLabel");
    if (phaseEl) { 
        const phaseText = currentPhaseLabel ? (stepRun ? `▶ ${currentPhaseLabel} ◀　${stepRun.total - routineQueue.length}/${stepRun.total}` : `▶ ${currentPhaseLabel} ◀`) : "";
        tdPut("phase", phaseText, v => { 
            phaseEl.textContent = v; 
            phaseEl.style.display = v ? "block" : "none"; 
        });
    }

    const giantEndEl = $id("giantEndTimeDisplay");
    if (giantEndEl) {
        tdPut("endSize", showMilliseconds, v => {
            giantEndEl.style.fontSize = v ? "calc(var(--gu) * 3.5)" : "calc(var(--gu) * 4)";
            giantEndEl.style.marginTop = v ? "calc(var(--gu) * -0.5)" : "calc(var(--gu) * -1.5)"; 
        });
    }

    const sel = $id("gaugeTypeSelect");
    const gaugeType = sel ? sel.value : "bar";

    updateTimerMiniBars(warningLineMs, fromTick);

    const pb = $id("giantProgressBar"), cg = $id("giantCircleGauge");
    const gaugeOn = gaugeType !== "none" && !isStopwatchMode && initialTimerMilliseconds > 0;
    const pct = gaugeOn ? Math.max(0, Math.min(100, (timerMilliseconds / initialTimerMilliseconds) * 100)) : 0;
    const gaugeColor = timerMilliseconds < 0 ? "#ef4444" : (timerMilliseconds <= warningLineMs ? "#fbbf24" : "#3b82f6");
    if (pb) tdPut("barShow", gaugeOn && gaugeType === "bar", v => { pb.style.display = v ? "block" : "none"; });
    if (cg) tdPut("circleShow", gaugeOn && gaugeType !== "bar", v => { cg.style.display = v ? "block" : "none"; });
    if (gaugeOn && gaugeType === "bar") {
        const innerBar = $id("giantProgressInner");
        if (innerBar) {
            tdPut("barW", timerMilliseconds < 0 ? 100 : Math.round(pct * 10) / 10, v => { innerBar.style.width = v + "%"; });
            tdPut("barC", gaugeColor, v => { innerBar.style.background = v; });
        }
    } else if (gaugeOn) {
        const innerCircle = $id("giantCircleInner");
        if (innerCircle) {
            tdPut("circleOff", timerMilliseconds < 0 ? 0 : Math.round((283 - 283 * (pct / 100)) * 10) / 10, v => { innerCircle.style.strokeDashoffset = v; });
            tdPut("circleC", gaugeColor, v => { innerCircle.style.stroke = v; });
        }
    }

    const compactEndEl = $id("compactEndTimeDisplay");
    let endText = "";
    if (!isStopwatchMode && timerMilliseconds > 0 && !isBlindModeActive) {
        const end = new Date(Date.now() + timerMilliseconds);
        const eh = String(end.getHours()).padStart(2, '0');
        const em = String(end.getMinutes()).padStart(2, '0');
        endText = `🏁 ${eh}:${em} 終了予定`;
    }
    tdPut("endText", endText, v => {
        [giantEndEl, compactEndEl].forEach(el => {
            if (!el) return;
            if (v) { el.innerText = v; el.style.display = "block"; }
            else el.style.display = "none";
        });
    });
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "timer",
    name: "タイマーとアラーム",
    version: "1.1",
    description: "タイマー、ストップウォッチ、ステップタイマー、アラームを使えます。",
    stubs: ["applyTimerVisualSettings", "handleCustomTimeSet", "loadStepSets", "renderTimerButtons", "setTimerToClockTime", "updateAlarmSettings", "updateClock", "updateTimerDisplay", "updateWarningPct"]
});
