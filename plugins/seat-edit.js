// ==========================================
// 席の入れ替えと取り消しプラグイン（必須）：席の入れ替え（ドラッグ）、席替えの取り消しとやり直しです。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
// 取り消し（戻す）とやり直しのために、席順の状態を覚えておきます。最大30回まで、さかのぼれます
const SEAT_HISTORY_MAX = 30;
let seatRedo = [];

// 取り消しの記録は、アプリを閉じても、残します（いまの席順と合っている時だけ、戻ります）。
// 保存は、直近の10回までです。多すぎると、保存に時間がかかるためです
const SEAT_UNDO_KEY = "seat_undo_v1";
const SEAT_UNDO_SAVE_MAX = 10;
let seatUndoSaveTimer = null;

function seatUndoSignature() {
    const str = JSON.stringify(currentStudents || []);
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return str.length + ":" + h;
}

function persistSeatUndoNow() {
    clearTimeout(seatUndoSaveTimer);
    try {
        if (seatHistory.length === 0 && seatRedo.length === 0) { localStorage.removeItem(SEAT_UNDO_KEY); return; }
        let hist = seatHistory.slice(-SEAT_UNDO_SAVE_MAX), redo = seatRedo.slice(-SEAT_UNDO_SAVE_MAX);
        while (true) {
            try { localStorage.setItem(SEAT_UNDO_KEY, JSON.stringify({ sig: seatUndoSignature(), hist: hist, redo: redo })); return; }
            catch (e) { if (hist.length + redo.length <= 1) { localStorage.removeItem(SEAT_UNDO_KEY); return; } if (hist.length > redo.length) hist.shift(); else redo.shift(); }
        }
    } catch (e) { /* 保存できなくても、そのまま続ける */ }
}

function persistSeatUndoSoon() {
    clearTimeout(seatUndoSaveTimer);
    seatUndoSaveTimer = setTimeout(persistSeatUndoNow, 700);
}

// 起動した時に、作業の復元のあとで呼ばれます。席順が、閉じる前と同じ時だけ、取り消しの記録を戻します
function restoreSeatUndo() {
    try {
        const o = JSON.parse(localStorage.getItem(SEAT_UNDO_KEY) || "null");
        if (!o || !Array.isArray(o.hist) || !Array.isArray(o.redo)) return;
        if (!currentStudents || currentStudents.length === 0 || o.sig !== seatUndoSignature()) { localStorage.removeItem(SEAT_UNDO_KEY); return; }
        const okState = st => st && Array.isArray(st.students) && Array.isArray(st.rawList);
        seatHistory = o.hist.filter(okState);
        seatRedo = o.redo.filter(okState);
        updateUndoButton();
    } catch (e) { /* 戻せなくても、そのまま続ける */ }
}

window.addEventListener("beforeunload", persistSeatUndoNow);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") persistSeatUndoNow(); });

function snapshotSeatState() {
    return {
        students: JSON.parse(JSON.stringify(currentStudents)),
        rawList: [...lastRawList],
        empty: $id("emptySeatsInput") ? $id("emptySeatsInput").value : ""
    };
}

// 「いまの席順」を、これから変える前に覚えます。変えたあとは、「やり直す」の分は、使えなくなります
function saveSeatHistory() {
    if (currentStudents.length === 0) return;
    seatHistory.push(snapshotSeatState());
    if (seatHistory.length > SEAT_HISTORY_MAX) seatHistory.shift();
    seatRedo = [];
    updateUndoButton();
    persistSeatUndoSoon();
}

function restoreSeatState(state) {
    currentStudents = state.students;
    lastRawList = state.rawList;
    if ($id("studentInput")) $id("studentInput").value = lastRawList.join(", ");
    if ($id("emptySeatsInput")) {
        $id("emptySeatsInput").value = state.empty;
        onEmptySeatsInput();
    }
    updateUndoButton();
    renderClassroom("none");
}

function undoSeatArrangement() {
    if (isAppLocked()) { showLockedToast(); return; }
    if (seatHistory.length === 0) return;
    const state = seatHistory.pop();
    seatRedo.push(snapshotSeatState());
    restoreSeatState(state);
    persistSeatUndoSoon();
    showToast("1つ前の席順に戻しました。" + (seatHistory.length ? "あと" + seatHistory.length + "回、戻せます。" : ""), "success");
}

function redoSeatArrangement() {
    if (isAppLocked()) { showLockedToast(); return; }
    if (seatRedo.length === 0) return;
    const state = seatRedo.pop();
    seatHistory.push(snapshotSeatState());
    restoreSeatState(state);
    persistSeatUndoSoon();
    showToast("取り消しを、やり直しました。" + (seatRedo.length ? "あと" + seatRedo.length + "回、やり直せます。" : ""), "success");
}

function updateUndoButton() {
    const btnUndo = $id("btnUndo");
    const btnRedo = $id("btnRedo");
    const hasList = lastRawList && lastRawList.length > 0;
    const isBlackboard = document.body.classList.contains("blackboard-active");
    if (btnUndo) {
        btnUndo.style.display = (seatHistory.length > 0 && hasList && !isBlackboard) ? 'inline-block' : 'none';
    }
    if (btnRedo) {
        btnRedo.style.display = (seatRedo.length > 0 && hasList && !isBlackboard) ? 'inline-block' : 'none';
    }
}

// キーボードでも、取り消し（Ctrl＋Z）とやり直し（Ctrl＋Y、または Ctrl＋Shift＋Z）ができます。
// 文字を入力している時や、窓が開いている時は、はたらきません
document.addEventListener("keydown", ev => {
    if (!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    const k = (ev.key || "").toLowerCase();
    const isUndo = k === "z" && !ev.shiftKey, isRedo = k === "y" || (k === "z" && ev.shiftKey);
    if (!isUndo && !isRedo) return;
    const t = ev.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    const cc = $id("configContainer");
    if (cc && cc.classList.contains("open")) return;
    const openModal = Array.from(document.querySelectorAll(".modal-overlay, [class*='-overlay']")).some(o => o.id && o.style && o.style.display && o.style.display !== "none");
    if (openModal) return;
    if (document.body.classList.contains("blackboard-active")) return;
    ev.preventDefault();
    if (isUndo) undoSeatArrangement(); else redoSeatArrangement();
});

// タッチ端末用の「長押し→ドラッグ&ドロップ」。HTML5のdraggableはマウス操作専用でタッチには
// 反応しないため、touchstart/touchmove/touchendで同じswapSeats()を呼ぶ形で再現する。

let touchDragState = null;

function setupSeatTouchDrag(el, index, cols) {
    const LONG_PRESS_MS = 500;
    const MOVE_CANCEL_PX = 10;
    let longPressTimer = null;
    let startX = 0, startY = 0;
    let pressCanceled = false;

    el.addEventListener("touchstart", function(e) {
        if (document.body.classList.contains("nomination-active") || document.body.classList.contains("blackboard-active")) return;
        if (e.touches.length !== 1) return;
        pressCanceled = false;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        clearTimeout(longPressTimer);
        longPressTimer = setTimeout(() => {
            if (pressCanceled) return;
            touchDragState = { fromIndex: index, overEl: null };
            el.classList.add("dragging");
            if (navigator.vibrate) navigator.vibrate(30);
        }, LONG_PRESS_MS);
    }, { passive: true });

    el.addEventListener("touchmove", function(e) {
        const touch = e.touches[0];
        if (!touchDragState) {
            if (Math.abs(touch.clientX - startX) > MOVE_CANCEL_PX || Math.abs(touch.clientY - startY) > MOVE_CANCEL_PX) {
                pressCanceled = true;
                clearTimeout(longPressTimer);
            }
            return;
        }
        // ドラッグ確定後は、ページがスクロールしないようにして指の下の座席をハイライトする。
        e.preventDefault();
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const seatUnder = target ? target.closest(".seat") : null;
        if (touchDragState.overEl && touchDragState.overEl !== seatUnder) {
            touchDragState.overEl.classList.remove("drag-over");
        }
        if (seatUnder && seatUnder !== el) {
            seatUnder.classList.add("drag-over");
            touchDragState.overEl = seatUnder;
        } else {
            touchDragState.overEl = null;
        }
    }, { passive: false });

    el.addEventListener("touchend", function(e) {
        clearTimeout(longPressTimer);
        if (!touchDragState) return;

        el.classList.remove("dragging");
        document.querySelectorAll(".seat").forEach(s => s.classList.remove("drag-over"));
        el.dataset.justDragged = "true";

        const touch = e.changedTouches[0];
        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        const seatUnder = target ? target.closest(".seat") : null;
        if (seatUnder && seatUnder.dataset.seatIndex !== undefined) {
            const toIndex = parseInt(seatUnder.dataset.seatIndex, 10);
            if (!isNaN(toIndex) && toIndex !== touchDragState.fromIndex) {
                saveSeatHistory();
                swapSeats(touchDragState.fromIndex, toIndex, cols);
            }
        }
        touchDragState = null;
    });

    el.addEventListener("touchcancel", function() {
        clearTimeout(longPressTimer);
        if (touchDragState) {
            el.classList.remove("dragging");
            document.querySelectorAll(".seat").forEach(s => s.classList.remove("drag-over"));
        }
        touchDragState = null;
    });
}

function swapSeats(fromIndex, toIndex, cols) {
    const labelFrom = getSeatLabel(fromIndex, cols);
    const labelTo = getSeatLabel(toIndex, cols);
    const seatFrom = currentStudents[fromIndex];
    const seatTo = currentStudents[toIndex];
    
    const input = $id("emptySeatsInput");
    let emptyArray = input ? input.value.split(",").map(s => s.trim().toUpperCase()).filter(s=>s!=="") : [];
    
    if (seatFrom && seatFrom.type === "MANUAL_EMPTY") emptyArray = emptyArray.filter(l => l !== labelFrom); 
    if (seatTo && seatTo.type === "MANUAL_EMPTY") emptyArray = emptyArray.filter(l => l !== labelTo);
    
    lastRawList = lastRawList.map(s => s.replace(new RegExp(`\\[${labelFrom}\\]`, 'gi'), '').replace(new RegExp(`\\[${labelTo}\\]`, 'gi'), '').replace(new RegExp(`\\{${labelFrom}\\}`, 'gi'), '').replace(new RegExp(`\\{${labelTo}\\}`, 'gi'), '').trim());
    
    if (seatFrom && seatFrom.type === "STUDENT") { 
        let targetIdx = lastRawList.findIndex(s => getCleanNameForMatch(s) === getCleanNameForMatch(seatFrom.text)); 
        if (targetIdx !== -1) lastRawList[targetIdx] += ` [${labelTo}]`; 
    } else if (seatFrom && seatFrom.type === "MANUAL_EMPTY") { 
        emptyArray.push(labelTo); 
    }
    
    if (seatTo && seatTo.type === "STUDENT") { 
        let targetIdx = lastRawList.findIndex(s => getCleanNameForMatch(s) === getCleanNameForMatch(seatTo.text)); 
        if (targetIdx !== -1) lastRawList[targetIdx] += ` [${labelFrom}]`; 
    } else if (seatTo && seatTo.type === "MANUAL_EMPTY") { 
        emptyArray.push(labelFrom); 
    }
    
    if (input) input.value = emptyArray.join(", "); 
    const sInput = $id("studentInput");
    if (sInput) sInput.value = lastRawList.join(", ");
    
    currentStudents[fromIndex] = seatTo; 
    currentStudents[toIndex] = seatFrom;
    
    if (currentStudents[fromIndex] && currentStudents[fromIndex].type === "STUDENT") currentStudents[fromIndex].isFixed = true;
    if (currentStudents[toIndex] && currentStudents[toIndex].type === "STUDENT") currentStudents[toIndex].isFixed = true;
    
    renderClassroom("none"); 
    showToast("座席を入れ替えて固定しました。", "success");
}

// 席替えの演出は、最初の席が動き出してから最後の席が止まるまで、最長でも5秒に収める

const MAX_SHUFFLE_ANIM_SEC = 5;

function capSeatAnimationTime(seatNodes) {
    const items = [];
    const speed = getAnimSpeed(); // 演出の速さ（ゆっくり 1.3／普通 1／はやい 0.7）。長さと待ち時間に掛ける
    let maxDur = 0, maxDelay = 0;
    seatNodes.forEach(el => {
        if (el.classList.contains("anim-none")) return;
        let dl = (parseFloat(el.style.animationDelay) || 0) * speed;
        if (speed !== 1) el.style.animationDelay = `${dl.toFixed(3)}s`;
        // マウスが乗っている席は、ホバー用のアニメーションになるので、長さの計測から外す
        if (!el.matches(":hover")) {
            let d = parseFloat(getComputedStyle(el).animationDuration) || 0;
            d *= speed;
            if (speed !== 1 && d > 0) el.style.animationDuration = `${d.toFixed(3)}s`;
            if (d > maxDur) maxDur = d;
        }
        if (dl > maxDelay) maxDelay = dl;
        items.push({ el, dl });
    });
    if (!items.length) return;
    const allowed = Math.max(0, MAX_SHUFFLE_ANIM_SEC - 0.1 - maxDur);
    if (maxDelay <= allowed) return;
    const ratio = allowed / maxDelay; // 順番はそのままで、間隔だけを縮める
    items.forEach(({ el, dl }) => { el.style.animationDelay = `${(dl * ratio).toFixed(3)}s`; });
}

function cleanSeatAnimationEffects() {
    if (animationCleanTimer) clearTimeout(animationCleanTimer);
    animationCleanTimer = setTimeout(() => {
        document.querySelectorAll('.seat').forEach(s => {
            const classesToRemove = Array.from(s.classList).filter(cls => cls.startsWith('anim-'));
            if (classesToRemove.length > 0) s.classList.remove(...classesToRemove);
        });
        animationCleanTimer = null;
    }, MAX_SHUFFLE_ANIM_SEC * 1000 + 300);
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "seat-edit",
    name: "席の入れ替えと取り消し",
    version: "1.2",
    required: true,
    description: "席の入れ替え（ドラッグ）、席替えの取り消しとやり直しです。"
});
