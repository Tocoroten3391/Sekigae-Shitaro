// ==========================================
// 指名プラグイン（必須）：指名の抽選、指名モード、取り消し、除外、進み具合です。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
function getSeatsInLabelOrder() {
    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) : 6;
    const rowSel = $id("rowSelect");
    const rows = rowSel ? parseInt(rowSel.value, 10) : 6;
    const ordered = [];
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
            const label = String.fromCharCode(65 + c) + (r + 1);
            const idx = getIndexFromLabel(label, cols);
            if (idx !== null && idx < currentStudents.length) ordered.push(currentStudents[idx]);
        }
    }
    return ordered;
}

function getNominationCandidates() { return getSeatsInLabelOrder().filter(s => s && s.type === "STUDENT" && s.text !== "" && !s.isAbsent && !specificallyExcludedStudents.has(s.text)); }

function renderSpecificExcludeList() { const list = $id("nominateSpecificExcludeList"); if (!list) return; const students = currentStudents.filter(s => s && s.type === "STUDENT" && s.text); list.innerHTML = students.map(s => `<label class="nominate-exclude-item"><input type="checkbox" value="${s.text.replace(/"/g, "&quot;")}"${specificallyExcludedStudents.has(s.text) ? " checked" : ""} onchange="updateSpecificExclusions()"><span>${s.text.replace(/\\[休\\]/g, "").trim()}</span></label>`).join("") || `<span class="nominate-exclude-help">名簿を読み込むと選択できます</span>`; }

function updateSpecificExclusions() { const list = $id("nominateSpecificExcludeList"); if (!list) return; specificallyExcludedStudents = new Set(Array.from(list.querySelectorAll("input:checked"), input => input.value)); localStorage.setItem("nominate_specific_excluded", JSON.stringify([...specificallyExcludedStudents])); rItems = rItems.filter(item => !specificallyExcludedStudents.has(item.fullText)); drawRoulette(); }

function toggleSpecificExclude() { const toggle = $id("nominateSpecificExcludeToggle"); const panel = $id("nominateSpecificExcludePanel"); if (panel) panel.hidden = !toggle?.checked; renderSpecificExcludeList(); if (toggle) localStorage.setItem("nominate_specific_exclude_enabled", String(toggle.checked)); }
// ==========================================
// 補足の説明：「i」の印にマウスを載せると出ます（タップや、キーボードの操作でも開きます）
// ==========================================

function toggleNominationExclusion(label) {
    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) : 6;
    const idx = getIndexFromLabel(label, cols);
    const seatData = currentStudents[idx];
    if (!seatData || seatData.type !== "STUDENT" || !seatData.text) return;

    const text = seatData.text;
    if (nominatedHistoryList.includes(text)) {
        nominatedHistoryList = nominatedHistoryList.filter(t => t !== text);
    } else {
        nominatedHistoryList.push(text);
    }
    renderClassroom("none");
}

function getNominationProgress() {
    const active = currentStudents.filter(s => s && s.type === "STUDENT" && s.text !== "" && !s.isAbsent);
    const total = active.length;
    const done = active.filter(s => nominatedHistoryList.includes(s.text) || (rPendingWinner && s.text === rPendingWinner)).length;
    return { total: total, done: done, left: Math.max(0, total - done) };
}

function updateNominationProgress() {
    const ex = $id("nominateExcludeToggle");
    const on = !!(ex && ex.checked);
    const p = getNominationProgress();
    const pct = p.total > 0 ? Math.round(p.done / p.total * 100) : 0;

    // 座席表の画面には、進み具合を出しません（指名モードとルーレットの、画面の右上にだけ出します）
    const box = $id("nomProgress");
    if (box) box.style.display = "none";

    const mode = $id("nomProgressMode");
    if (mode) {
        const txt = $id("nomProgressModeText");
        const fill = $id("nomProgressModeFill");
        mode.classList.remove("is-hidden", "is-done");
        if (!on) {
            if (txt) txt.textContent = "毎回、全員から選んでいます";
            if (fill && fill.parentElement) fill.parentElement.style.display = "none";
        } else {
            if (fill && fill.parentElement) fill.parentElement.style.display = "";
            if (p.done >= p.total && p.total > 0) {
                mode.classList.add("is-done");
                if (txt) txt.textContent = "全員に回りました　次は最初から数えます";
            } else if (txt) {
                txt.textContent = `指名済み ${p.done} / ${p.total}人　あと${p.left}人`;
            }
            if (fill) fill.style.width = pct + "%";
        }
    }
}

function resetNominatedHistory(showMsg = true) { 
    nominatedHistoryList = []; 
    clearNominationUndo();
    document.querySelectorAll('.seat').forEach(s => s.classList.remove('is-nominated', 'is-already-nominated')); 
    updateNominationProgress();
    if (showMsg) showToast("指名履歴をリセットしました", "success"); 
}

// ==========================================
// 記録・統計（指名回数／座席の履歴を長期間ためて振り返れるようにする）
// ==========================================

let nominationHistoryLog = {}; // { "田中": { count: 3, lastAt: 1234567890 } }

let seatHistoryLog = {}; // { "田中": { "A1": 2, "B3": 1 } }

function pushNominationUndo(kind, text, prevList, hist) {
    nominationUndoStack.push({ kind: kind, text: text, prevList: prevList.slice(), hist: hist });
    if (nominationUndoStack.length > 20) nominationUndoStack.shift();
    updateNominationUndoUi();
}

function clearNominationUndo() {
    nominationUndoStack = [];
    updateNominationUndoUi();
}

function updateNominationUndoUi() {
    const can = nominationUndoStack.length > 0;
    const modeBtn = $id("btnNominateUndoMode");
    if (modeBtn) modeBtn.style.display = can ? "" : "none";
    const rouBtn = $id("btnRouletteUndo");
    if (rouBtn) rouBtn.style.display = can ? "" : "none";
    const menuBtn = $id("btnNominateUndoMenu");
    if (menuBtn) menuBtn.disabled = !can;
}

function undoLastNomination() {
    if (isAppLocked() && !getLockOptions().allowNominate) { showLockedToast(); return; }
    if (isNominating || rSpinning) { showToast("演出が終わってから、押してください", "error"); return; }
    const u = nominationUndoStack.pop();
    if (!u) { showToast("取り消せる指名がありません", "error"); updateNominationUndoUi(); return; }
    closePopMenus();
    const key = u.hist && u.hist.key ? u.hist.key : getCleanStudentKey(u.text);
    if (u.hist && u.hist.key) {
        if (u.hist.prev) nominationHistoryLog[u.hist.key] = u.hist.prev; else delete nominationHistoryLog[u.hist.key];
        try { localStorage.setItem("nomination_history_log", JSON.stringify(nominationHistoryLog)); } catch (error) { /* そのまま続ける */ }
    }
    nominatedHistoryList = u.prevList.slice();
    if (u.kind === "roulette") {
        rPendingWinner = null;
        // 当たった人が、盤面から外れていたら、盤面に戻す
        if (!rItems.some(it => it.fullText === u.text)) {
            const seat = currentStudents.find(x => x && x.type === "STUDENT" && x.text === u.text && !x.isAbsent);
            if (seat) {
                const name = seat.text.replace(/\[休\]/g, "").replace(/\[.*?\]/g, "").replace(/\{.*?\}/g, "").replace(/[（\(].*?[）\)]/g, "").trim();
                rItems.push({ fullText: seat.text, cleanName: name.includes(".") ? name.split(".")[1].trim() : name });
            }
        }
        const ov = $id("rouletteOverlay");
        if (rCanvas && ov && getComputedStyle(ov).display !== "none") drawRoulette();
    }
    document.querySelectorAll(".seat").forEach((el, i) => {
        el.classList.remove("is-nominated", "is-shuffling-nominate");
        const t = currentStudents[i] && currentStudents[i].text;
        el.classList.toggle("is-already-nominated", !!(t && nominatedHistoryList.includes(t)));
    });
    const nameDisplay = $id("nominateNameDisplay");
    if (nameDisplay) { nameDisplay.textContent = "誰に当たるでしょうか？"; nameDisplay.className = "nominate-name-display"; }
    updateNominationProgress();
    updateNominationUndoUi();
    showToast(`${key} さんの指名を取り消しました。もう一度、指名できます。`, "success");
}

function toggleFavorLongNotNominated() {
    const t = $id("nominateFavorRecentToggle");
    localStorage.setItem("nominate_favor_recent", String(!!(t && t.checked)));
    showToast(t && t.checked ? "最近当たっていない人を、当たりやすくしました。" : "全員が同じ確率で当たるようにしました。", "success");
}

function isFavorLongNotNominatedOn() {
    const t = $id("nominateFavorRecentToggle");
    return !!(t && t.checked);
}

function pickSeatWeightedByHistory(seats) {
    if (seats.length <= 1 || !isFavorLongNotNominatedOn()) return seats[Math.floor(Math.random() * seats.length)];
    const info = seats.map(s => {
        const nom = nominationHistoryLog[getCleanStudentKey(s.data.text)] || { count: 0, lastAt: 0 };
        return { seat: s, count: nom.count || 0, lastAt: nom.lastAt || 0 };
    });
    const rank = (key, asc) => {
        const sorted = info.slice().sort((a, b) => asc ? a[key] - b[key] : b[key] - a[key]);
        const m = new Map();
        sorted.forEach((it, i) => m.set(it, i));
        return m;
    };
    const byTime = rank("lastAt", true);   // 古い（または未指名）ほど 0 に近い
    const byCount = rank("count", true);   // 回数が少ない程 0 に近い
    const n = info.length;
    const weights = info.map(it => {
        const score = 1 - ((byTime.get(it) + byCount.get(it)) / 2) / (n - 1); // 1（当たりやすい）〜0
        return 1 + 3 * score;
    });
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < info.length; i++) {
        r -= weights[i];
        if (r <= 0) return info[i].seat;
    }
    return info[info.length - 1].seat;
}

function handleExcludeToggle() { 
    const toggle = $id("nominateExcludeToggle");
    if (toggle && toggle.checked) {
        showToast("重複させないモードをONにしました", "success"); 
    } else { 
        showToast("重複させないモードをOFFにしました。履歴もリセットしました。", "success"); 
        nominatedHistoryList = []; 
        document.querySelectorAll('.seat').forEach(s => s.classList.remove('is-nominated', 'is-already-nominated')); 
    } 
    clearNominationUndo();
    updateNominationProgress();
}

function toggleTextOnlyMode() { 
    if (document.body.classList.contains("nomination-active")) { 
        const toggle = $id("nominateTextOnlyToggle");
        if (toggle && toggle.checked) {
            document.body.classList.add("text-only-mode"); 
        } else {
            document.body.classList.remove("text-only-mode"); 
        }
    } 
}

// ---- 通常の指名の効果音：座席が光るたびに「カチッ」、決まった時に鐘の音です（「演出に効果音をつける」の設定に合わせます）
function nominationSoundOn() {
    if (isSilentTestMode || lsGet("shuffle_sound", "true") === "false") return false;
    try { initAudio(); } catch (error) { return false; }
    return !!audioCtx && typeof playTone === "function" && typeof getAudioBus === "function" && !!getAudioBus();
}
function nominationTickSound(heavy) {
    if (!nominationSoundOn()) return;
    const t = audioCtx.currentTime + 0.005;
    if (heavy) playTone(900, t, 0.06, "square", { filter: 2400, attack: 0.001, release: 0.045, vol: 0.2 });
    else playTone(1700, t, 0.03, "square", { filter: 3800, attack: 0.001, release: 0.02, vol: 0.12 });
}
function nominationWinSound() {
    if (!nominationSoundOn() || typeof playBell !== "function") return;
    const t = audioCtx.currentTime + 0.05;
    [784, 988, 1175, 1568].forEach((f, i) => playBell(f, t + i * 0.09, 1.1, 0.55, 0.4));
}

// ---- 早押しボタン風の指名：少し間をおいて、「ピンポーン！」と鳴り、画面が光って、指名された人が大きく出ます ----
const NOM_BUZZER_KEY = "nominate_buzzer";   // "1"（早押しボタン風）／ "0"（普通の演出）
function nominationBuzzerOn() { return lsGet(NOM_BUZZER_KEY, "0") === "1"; }
function toggleNominationBuzzer() {
  const t = $id("nominateBuzzerToggle");
  lsSet(NOM_BUZZER_KEY, t && t.checked ? "1" : "0");
}
function nominationNameParts(text) {
  const raw = String(text || "").replace(/\[休\]/g, "").replace(/\[行\d+\]/g, "").replace(/\[列[A-Za-z]\]/gi, "").replace(/\[範囲[A-Za-z]\d+-[A-Za-z]\d+\]/g, "").replace(/\[自由(?:行列|席):[^\]]*\]/g, "").replace(/[（\(].*?[）\)]/g, "").trim();
  if (raw.includes(".")) { const p = raw.split("."); return { no: p[0].trim(), name: (p[1] ? p[1].trim() : p[0].trim()) }; }
  return { no: "", name: raw };
}
function nominationEsc(v) { return String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function nominationBuzzerSound() {
  if (!nominationSoundOn() || typeof playBell !== "function") return;
  const t = audioCtx.currentTime + 0.02;
  playBell(1319, t, 0.35, 0.5, 0.3);          // ピン
  playBell(1047, t + 0.3, 1.3, 0.55, 0.4);    // ポーン
}
function nominationBuzzerStyle() {
  if ($id("nomBuzzerStyle")) return;
  const st = document.createElement("style");
  st.id = "nomBuzzerStyle";
  st.textContent = `
.buzzer-flash { position: fixed; inset: 0; z-index: 9000; background: #ffffff; pointer-events: none; animation: buzzerFlash 0.55s ease-out forwards; }
@keyframes buzzerFlash { 0% { opacity: 0.95; } 100% { opacity: 0; } }
.buzzer-card-layer { position: fixed; inset: 0; z-index: 8990; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.55); animation: buzzerLayerIn 0.25s ease-out both; cursor: pointer; }
@keyframes buzzerLayerIn { from { opacity: 0; } to { opacity: 1; } }
.buzzer-card { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: clamp(18px, 4vh, 40px) clamp(28px, 7vw, 96px); border-radius: 28px; background: linear-gradient(135deg, #1d4ed8, #7c3aed); color: #fff; box-shadow: 0 24px 70px rgba(0,0,0,0.5), 0 0 0 6px rgba(255,255,255,0.25); max-width: 94vw; animation: buzzerCardPop 0.5s cubic-bezier(0.2, 1.5, 0.4, 1) both; }
@keyframes buzzerCardPop { 0% { transform: scale(0.4); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }
.buzzer-btn { width: clamp(56px, 11vh, 96px); height: clamp(56px, 11vh, 96px); border-radius: 50%; background: radial-gradient(circle at 35% 30%, #fecaca, #ef4444 55%, #991b1b); box-shadow: 0 6px 0 #7f1d1d, 0 10px 18px rgba(0,0,0,0.4), inset 0 -4px 8px rgba(0,0,0,0.25); animation: buzzerPress 0.5s ease-out both; }
@keyframes buzzerPress { 0% { transform: translateY(0); } 30% { transform: translateY(6px); box-shadow: 0 0 0 #7f1d1d, 0 3px 8px rgba(0,0,0,0.4), inset 0 -4px 8px rgba(0,0,0,0.25); } 100% { transform: translateY(0); } }
.buzzer-label { font-size: clamp(18px, 3.4vh, 34px); font-weight: 800; letter-spacing: 0.08em; color: #fde68a; }
.buzzer-no { font-size: clamp(20px, 4vh, 40px); font-weight: 700; opacity: 0.9; }
.buzzer-name { font-size: clamp(44px, 14vh, 150px); line-height: 1.1; font-weight: 900; text-shadow: 0 4px 0 rgba(0,0,0,0.25); word-break: keep-all; text-align: center; }
`;
  document.head.appendChild(st);
}
let nominationBuzzerTimers = [];
function nominationBuzzerClear() {
  nominationBuzzerTimers.forEach(t => clearTimeout(t));
  nominationBuzzerTimers = [];
  document.querySelectorAll(".buzzer-card-layer, .buzzer-flash").forEach(e => e.remove());
}
function nominationBuzzerShow(text) {
  nominationBuzzerClear();
  nominationBuzzerStyle();
  const parts = nominationNameParts(text);
  const flash = document.createElement("div");
  flash.className = "buzzer-flash";
  document.body.appendChild(flash);
  const layer = document.createElement("div");
  layer.className = "buzzer-card-layer";
  layer.innerHTML = '<div class="buzzer-card"><div class="buzzer-btn"></div><div class="buzzer-label">ピンポーン！</div>' + (parts.no ? '<div class="buzzer-no">' + nominationEsc(parts.no) + "番</div>" : "") + '<div class="buzzer-name">' + nominationEsc(parts.name) + "</div></div>";
  layer.onclick = () => nominationBuzzerClear();
  document.body.appendChild(layer);
  nominationBuzzerTimers.push(setTimeout(() => nominationBuzzerClear(), 2600));
}

function pickRandomStudent() {
  if (isNominating) return; 
  if (!currentStudents || currentStudents.length === 0) { showToast("座席表が空っぽの時は指名できません", "error"); return; }
  
  const isNominationMode = document.body.classList.contains("nomination-active");
  const excludeToggle = $id("nominateExcludeToggle");
  const shouldExclude = excludeToggle ? excludeToggle.checked : false;
  const teaseToggle = $id("nominateTeaseToggle");
  const isTeaseMode = teaseToggle ? teaseToggle.checked : false;
  const skipAnimToggle = $id("nominateSkipAnimToggle");
  const isSkipAnim = skipAnimToggle ? skipAnimToggle.checked : false;
  const textOnlyToggle = $id("nominateTextOnlyToggle");
  const isTextOnly = textOnlyToggle ? textOnlyToggle.checked : false;
  
  document.querySelectorAll('.seat').forEach(s => {
    s.classList.remove('is-shuffling-nominate', 'is-nominated');
    if (!shouldExclude) s.classList.remove('is-already-nominated');
  });
  
  const allActiveSeats = [];
  currentStudents.forEach((seat, idx) => {
    if (seat && seat.type === "STUDENT" && seat.text !== "" && !seat.isAbsent) {
      allActiveSeats.push({ data: seat, positionIndex: idx });
    }
  });
  
  if (allActiveSeats.length === 0) { showToast("全員お休みか、座席に誰もいません", "error"); return; }
  
  let finalLuckySeat = null;
  let roulettePool = allActiveSeats;
  const undoPrevList = nominatedHistoryList.slice();
  
  if (shouldExclude) {
    let candidates = allActiveSeats.filter(s => !nominatedHistoryList.includes(s.data.text));
    if (candidates.length === 0) {
      nominatedHistoryList = [];
      document.querySelectorAll('.seat').forEach(s => s.classList.remove('is-nominated', 'is-already-nominated'));
      candidates = [...allActiveSeats];
    }
    finalLuckySeat = pickSeatWeightedByHistory(candidates);
    nominatedHistoryList.push(finalLuckySeat.data.text);
    roulettePool = candidates; 
  } else {
    nominatedHistoryList = [];
    finalLuckySeat = pickSeatWeightedByHistory(allActiveSeats);
  }

  pushNominationUndo("pick", finalLuckySeat.data.text, undoPrevList, recordNominationHistory(finalLuckySeat.data.text));

  const seatElements = document.querySelectorAll('.seat');
  const nameDisplay = $id("nominateNameDisplay");

  if (nominationBuzzerOn()) {
    // 早押しボタン風：少し間をおいてから、「ピンポーン！」と鳴らして、大きく出します
    isNominating = true;
    if (nameDisplay && isNominationMode) { nameDisplay.textContent = "……"; nameDisplay.className = "nominate-name-display is-rolling"; }
    const waitMs = isSkipAnim ? 0 : (isTeaseMode ? 1700 : 700);
    if (isTeaseMode && !isSkipAnim) [500, 1000, 1400].forEach(ms => nominationBuzzerTimers.push(setTimeout(() => nominationTickSound(true), ms)));
    nominationBuzzerTimers.push(setTimeout(() => {
      if (!isTextOnly) {
        const winnerEl = seatElements[finalLuckySeat.positionIndex];
        if (winnerEl) {
          winnerEl.classList.add('is-nominated');
          if (shouldExclude) winnerEl.classList.add('is-already-nominated');
        }
      }
      const parts = nominationNameParts(finalLuckySeat.data.text);
      if (nameDisplay && isNominationMode) {
        nameDisplay.textContent = parts.no ? parts.no + "番 " + parts.name : " " + parts.name;
        nameDisplay.className = "nominate-name-display is-decided";
      }
      if (shouldExclude) {
        const totalCount = currentStudents.filter(s => s && s.type === "STUDENT" && s.text !== "" && !s.isAbsent).length;
        showToast(`🎯 指名：【 ${parts.name} 】 さんです。一巡まであと ${totalCount - nominatedHistoryList.length} 人です。`, "success");
      } else {
        showToast(`🎯 指名：【 ${parts.name} 】 さんです`, "success");
      }
      updateNominationProgress();
      nominationBuzzerSound();
      nominationBuzzerShow(finalLuckySeat.data.text);
      isNominating = false;
    }, waitMs));
    return;
  }

  if (isSkipAnim) {
    if (!isTextOnly) {
      const winnerEl = seatElements[finalLuckySeat.positionIndex];
      if (winnerEl) {
        winnerEl.classList.add('is-nominated');
        if (shouldExclude) winnerEl.classList.add('is-already-nominated');
      }
    }
    let displayName = finalLuckySeat.data.text.replace(/\[休\]/g, "").replace(/\[行\d+\]/g, "").replace(/\[列[A-Za-z]\]/gi, "").replace(/\[範囲[A-Za-z]\d+-[A-Za-z]\d+\]/g, "").replace(/\[自由(?:行列|席):[^\]]*\]/g, "").replace(/[（\(].*?[）\)]/g, "").trim();
    let finalString = displayName;
    if (displayName.includes(".")) {
      let p = displayName.split(".");
      displayName = p[1] ? p[1].trim() : p[0].trim();
      finalString = p[0].trim() + "番 " + displayName;
    } else {
      finalString = " " + displayName;
    }
    if (nameDisplay && isNominationMode) {
      nameDisplay.textContent = finalString;
      nameDisplay.className = "nominate-name-display is-decided";
    }
    if (shouldExclude) {
      const totalCount = currentStudents.filter(s => s && s.type === "STUDENT" && s.text !== "" && !s.isAbsent).length;
      const remaining = totalCount - nominatedHistoryList.length;
      showToast(`🎯 指名：【 ${displayName} 】 さんです。一巡まであと ${remaining} 人です。`, "success");
    } else {
      showToast(`🎯 指名：【 ${displayName} 】 さんです`, "success");
    }
    updateNominationProgress();
    nominationWinSound();
    return; 
  }

  isNominating = true; 
  let runCount = 0; 
  const baseRuns = 15;
  const extraTeaseRuns = isTeaseMode ? 4 : 0; 
  const maxRuns = baseRuns + extraTeaseRuns;
  let currentDelay = 50; 
  
  if (nameDisplay && isNominationMode) nameDisplay.className = "nominate-name-display is-rolling";

  function runRouletteStep() {
    seatElements.forEach(s => s.classList.remove('is-shuffling-nominate'));
    let dummyPick;
    if (runCount === maxRuns - 1 && isTeaseMode) {
      let fakeOutPool = roulettePool.filter(p => p !== finalLuckySeat);
      dummyPick = fakeOutPool.length > 0 ? fakeOutPool[Math.floor(Math.random() * fakeOutPool.length)] : finalLuckySeat;
    } else {
      dummyPick = roulettePool[Math.floor(Math.random() * roulettePool.length)];
    }

    if (!isTextOnly) {
      if (seatElements[dummyPick.positionIndex] && !seatElements[dummyPick.positionIndex].classList.contains('is-nominated')) {
        seatElements[dummyPick.positionIndex].classList.add('is-shuffling-nominate');
      }
    }
    
    if (nameDisplay && isNominationMode) {
      let rawText = dummyPick.data.text.replace(/\[休\]/g, "").replace(/\[行\d+\]/g, "").replace(/\[列[A-Za-z]\]/gi, "").replace(/\[範囲[A-Za-z]\d+-[A-Za-z]\d+\]/g, "").replace(/\[自由(?:行列|席):[^\]]*\]/g, "").replace(/[（\(].*?[）\)]/g, "").trim();
      if (rawText.includes(".")) {
        let p = rawText.split(".");
        nameDisplay.textContent = p[0].trim() + "番 " + (p[1] ? p[1].trim() : "");
      } else {
        nameDisplay.textContent = " " + rawText;
      }
    }

    runCount++;
    if (runCount < maxRuns) nominationTickSound(isTeaseMode && runCount > baseRuns - 4);

    if (runCount >= maxRuns) {
      seatElements.forEach(s => s.classList.remove('is-shuffling-nominate'));
      if (!isTextOnly) {
        const winnerEl = seatElements[finalLuckySeat.positionIndex];
        if (winnerEl) {
          winnerEl.classList.add('is-nominated');
          if (shouldExclude) winnerEl.classList.add('is-already-nominated');
        }
      }
      let displayName = finalLuckySeat.data.text.replace(/\[休\]/g, "").replace(/\[行\d+\]/g, "").replace(/\[列[A-Za-z]\]/gi, "").replace(/\[範囲[A-Za-z]\d+-[A-Za-z]\d+\]/g, "").replace(/\[自由(?:行列|席):[^\]]*\]/g, "").replace(/[（\(].*?[）\)]/g, "").trim();
      let finalString = displayName;
      if (displayName.includes(".")) {
        let p = displayName.split(".");
        displayName = p[1] ? p[1].trim() : p[0].trim();
        finalString = p[0].trim() + "番 " + displayName;
      } else {
        finalString = " " + displayName;
      }
      if (nameDisplay && isNominationMode) {
        nameDisplay.textContent = finalString;
        nameDisplay.className = "nominate-name-display is-decided";
      }
      if (shouldExclude) {
        const totalCount = currentStudents.filter(s => s && s.type === "STUDENT" && s.text !== "" && !s.isAbsent).length;
        const remaining = totalCount - nominatedHistoryList.length;
        showToast(`🎯 指名：【 ${displayName} 】 さんです。一巡まであと ${remaining} 人です。`, "success");
      } else {
        showToast(`🎯 指名：【 ${displayName} 】 さんです`, "success");
      }
      updateNominationProgress();
      nominationWinSound();
      isNominating = false; 
    } else {
      if (isTeaseMode) {
        if (runCount > baseRuns) currentDelay += 200; 
        else if (runCount > baseRuns - 4) currentDelay += 50;  
      } else {
        currentDelay = 70; 
      }
      nominateInterval = setTimeout(runRouletteStep, currentDelay);
    }
  }
  runRouletteStep();
}

function enterNominationMode() {
  if (currentStudents.length === 0) { showToast("座席表が空っぽの時は指名モードに入れません", "error"); return; }
  const configContainer = $id("configContainer");
  if (configContainer) configContainer.classList.remove("open");
  const configMenuBtn = $id("configMenuBtn");
  if (configMenuBtn) { configMenuBtn.classList.remove("is-open"); configMenuBtn.textContent = "⚙️ 設定"; }
  document.body.classList.add("nomination-active");
  const textOnlyToggle = $id("nominateTextOnlyToggle");
  if (textOnlyToggle && textOnlyToggle.checked) document.body.classList.add("text-only-mode");
  else document.body.classList.remove("text-only-mode");
  
  const exitBtn = $id("btnExitNomination");
  if (exitBtn) {
    if (document.body.classList.contains("blackboard-active")) exitBtn.style.display = "none";
    else exitBtn.style.display = "inline-block";
  }
  const nameDisplay = $id("nominateNameDisplay");
  if (nameDisplay) { nameDisplay.textContent = "誰に当たるでしょうか？"; nameDisplay.className = "nominate-name-display"; }
  updateNominationProgress();
  showToast("指名モードを起動しました", "success");
}

function exitNominationMode() {
  document.body.classList.remove("nomination-active");
  document.body.classList.remove("text-only-mode");
  const exitBtn = $id("btnExitNomination");
  if (exitBtn) exitBtn.style.display = "none";
  document.querySelectorAll('.seat').forEach(s => { s.classList.remove('is-nominated', 'is-shuffling-nominate'); });
  showToast("通常モードに戻しました", "success");
}

const RANDOM_SCOPE_KEY = "random_anim_scope";

const RANDOM_SCOPE_LABELS = { all: "全ての演出", basic: "基本・定番", intense: "激しい・ダイナミック", unique: "個性的・特殊" };

function getRandomScope() {
    const v = lsGet(RANDOM_SCOPE_KEY, "all");
    return Object.prototype.hasOwnProperty.call(RANDOM_SCOPE_LABELS, v) ? v : "all";
}

function loadRandomScope() {
    const sel = $id("randomScopeSelect");
    if (sel) sel.value = getRandomScope();
    refreshFavAnimUI();
}

function onRandomScopeChange() {
    const sel = $id("randomScopeSelect");
    if (!sel) return;
    lsSet(RANDOM_SCOPE_KEY, sel.value);
    refreshFavAnimUI();
    showToast(sel.value === "all" ? "毎回ランダムは全ての演出から選びます。" : `毎回ランダムは「${RANDOM_SCOPE_LABELS[sel.value]}」から選びます。`, "success");
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "nomination",
    name: "指名",
    version: "1.4",
    required: true,
    description: "指名の抽選、指名モード、取り消し、除外、進み具合です。",
    backupKeys: [NOM_BUZZER_KEY],
    mount(app) {
        // 「くわしい設定」の、ルーレットを飛ばす設定の下に、早押しボタン風の切り替えを足します
        const skip = $id("nominateSkipAnimToggle");
        const row = skip && skip.closest(".switch-container");
        if (row && !$id("nominateBuzzerToggle")) {
            row.insertAdjacentHTML("afterend", '<div class="switch-container" style="margin-top: 8px;"><label class="switch"><input type="checkbox" id="nominateBuzzerToggle" onchange="toggleNominationBuzzer()"><span class="slider slider-purple"></span></label><span class="switch-label" id="nominateBuzzerLabel" style="color: var(--lbl-purple); font-weight: bold;">早押しボタン風にする</span></div>');
            const t = $id("nominateBuzzerToggle");
            t.checked = nominationBuzzerOn();
            if (typeof makeInfoTip === "function") $id("nominateBuzzerLabel").appendChild(makeInfoTip("ルーレット演出の代わりに、少し間を置いて「ピンポーン！」と鳴り、画面が光って、指名された人が大きく出ます。焦らし演出がONの時は、間が長くなります。ルーレット演出を飛ばす設定がONの時は、間なしですぐ鳴ります。"));
        }
        app.insertInto("guide-faq", "<li><strong>指名をクイズ番組の早押しのようにしたい</strong>：設定の「指名」の「詳しい設定」で、「早押しボタン風にする」をONにします。少し間を置いて「ピンポーン！」と鳴り、画面が光って、指名された人が大きく出ます。大きく出た画面は押すと閉じます。</li>");
    }
});
