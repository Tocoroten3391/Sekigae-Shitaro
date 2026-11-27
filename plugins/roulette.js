// ==========================================
// 巨大ルーレットプラグイン：指名のとき、大きなルーレットで決めます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="roulette" で結びついていて、自動で隠れます）
// ==========================================
function openRouletteMode() {
    let allActive = getNominationCandidates();
    if (allActive.length === 0) { 
        showToast("座席に誰もいません。", "error"); 
        return; 
    }
    
    // 盤面を開いた時点では除外表示をせず、全員をルーレットに乗せる。
    // 一度当たった人の除外は、次にスピンボタンを押したときに行う。
    rPendingWinner = null;
    let candidates = allActive;
    
    rItems = candidates.map(s => {
        let name = s.text.replace(/\[休\]/g, "").replace(/\[.*?\]/g, "").replace(/\{.*?\}/g, "").replace(/[（\(].*?[）\)]/g, "").trim();
        let cleanName = name.includes(".") ? name.split(".")[1].trim() : name;
        return { fullText: s.text, cleanName: cleanName };
    });
    rAngle = getRouletteRestAngle();
    
    const overlay = $id("rouletteOverlay");
    if(overlay) overlay.style.display = "flex";
    rouletteAddStyle();
    document.body.classList.add("roulette-active");   // 指名の進み具合を、画面の右上に出します
    updateNominationProgress();
    roulettePinSetup();
    roulettePointerStart();
    
    rCanvas = $id("rouletteCanvas");
    if (rCanvas) {
        rCtx = rCanvas.getContext("2d");
        drawRoulette();
    }
    rouletteApplyStyle();
}
function closeRouletteMode() {
    const overlay = $id("rouletteOverlay");
    if(overlay) overlay.style.display = "none";
    document.body.classList.remove("roulette-active");
    roulettePointerStop();
    if(rSpinning) cancelAnimationFrame(rAnimationFrame);
    cancelAnimationFrame(rReelFrame);
    rSpinning = false; 
    rVelocity = 0;
}

// 盤面を止めた状態（rAngle）で、一番上（ポインター側）に rItems[0]（A1の人）が来るようにする角度。
// ポインターは3時方向を0として時計回りに3π/2（12時方向）にあるので、そこにスライス0の中心を合わせる。
function getRouletteRestAngle() {
    if (rItems.length === 0) return 0;
    const arc = Math.PI * 2 / rItems.length;
    return (Math.PI * 1.5) - (arc / 2);
}
function drawRoulette() {
    if (rouletteIsReel()) { drawReel(); return; }
    if (rouletteIsMarble()) { drawMarbleWheel(); return; }
    if (!rCtx) return;
    const cx = rCanvas.width / 2;
    const cy = rCanvas.height / 2;
    const radius = cx - 10;
    
    rCtx.clearRect(0, 0, rCanvas.width, rCanvas.height);
    if (rItems.length === 0) return;
    
    const arc = Math.PI * 2 / rItems.length;
    const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
    
    for (let i = 0; i < rItems.length; i++) {
        let angle = rAngle + i * arc;
        
        rCtx.beginPath();
        rCtx.arc(cx, cy, radius, angle, angle + arc, false);
        rCtx.lineTo(cx, cy);
        rCtx.fillStyle = colors[i % colors.length];
        rCtx.fill();
        
        rCtx.save();
        rCtx.translate(cx, cy);
        rCtx.rotate(angle + arc / 2);
        rCtx.textAlign = "right";
        rCtx.fillStyle = "#fff";
        rCtx.font = "bold 24px sans-serif";
        rCtx.fillText(rItems[i].cleanName, radius - 20, 10);
        rCtx.restore();
    }
    // 区切りごとの突起（針が引っ掛かります）
    const pegR = Math.min(PEG_RADIUS, arc * (radius - PEG_INSET) * 0.22);
    for (let i = 0; i < rItems.length; i++) {
        const a = rAngle + i * arc;
        const px = cx + Math.cos(a) * (radius - PEG_INSET), py = cy + Math.sin(a) * (radius - PEG_INSET);
        rCtx.save();
        rCtx.shadowColor = "rgba(0,0,0,0.45)"; rCtx.shadowBlur = 4; rCtx.shadowOffsetY = 1.5;
        const g = rCtx.createRadialGradient(px - pegR * 0.35, py - pegR * 0.4, pegR * 0.1, px, py, pegR);
        g.addColorStop(0, "#fff7d6"); g.addColorStop(0.55, "#fbbf24"); g.addColorStop(1, "#b45309");
        rCtx.beginPath(); rCtx.arc(px, py, pegR, 0, Math.PI * 2);
        rCtx.fillStyle = g; rCtx.fill();
        rCtx.shadowColor = "transparent";
        rCtx.lineWidth = 1; rCtx.strokeStyle = "#78350f"; rCtx.stroke();
        rCtx.restore();
    }
}

// ---- 針の動き：突起に引っ掛かって、はじかれて、カチッと戻ります ----
const PEG_RADIUS = 7, PEG_INSET = 11;         // 突起の大きさと、円盤のふちからの位置
const POINTER_LEN = 45;                         // 針（ピン）の長さ（回る軸から先まで）
const ROULETTE_POINTER_KEY = "roulette_pointer";   // "pin"（ピン）／ "hand"（指さしの手）／ "chalk"（チョーク）／ "teacher"（ミニ先生）
// どの針も、36×50 の大きさで、先が、下の中央に来ます
const POINTER_SKINS = {
    pin: { label: "ピン", svg: '<svg viewBox="0 0 36 50" width="36" height="50" aria-hidden="true"><path d="M18 49 C18 49 3 31 3 17.5 A15 15 0 1 1 33 17.5 C33 31 18 49 18 49 Z" fill="#ea4335" stroke="#a52714" stroke-width="1.5" stroke-linejoin="round"/><circle cx="18" cy="17.5" r="6" fill="#8c1c13"/><path d="M9 12 A11 11 0 0 1 17 6.6" fill="none" stroke="#ffffff" stroke-opacity="0.45" stroke-width="2.2" stroke-linecap="round"/></svg>' },
    hand: { label: "指さしの手", svg: '<svg viewBox="0 0 36 50" width="36" height="50" aria-hidden="true"><rect x="5" y="2" width="26" height="22" rx="9" fill="#fcd9b6" stroke="#b9794a" stroke-width="1.5"/><rect x="13.5" y="16" width="9" height="32" rx="4.5" fill="#fcd9b6" stroke="#b9794a" stroke-width="1.5"/><path d="M9 7 V15 M14 5 V12 M22 5 V12 M27 7 V15" stroke="#d9a273" stroke-width="1.4" stroke-linecap="round" fill="none"/><ellipse cx="18" cy="43" rx="2.2" ry="3.2" fill="#ffe9d2" opacity="0.8"/><rect x="5" y="2" width="26" height="6" rx="3" fill="#2563eb" opacity="0.9"/></svg>' },
    chalk: { label: "チョーク", svg: '<svg viewBox="0 0 36 50" width="36" height="50" aria-hidden="true"><path d="M11 2 H25 V38 L21 48 H15 L11 38 Z" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5" stroke-linejoin="round"/><rect x="11" y="2" width="14" height="13" fill="#38bdf8" stroke="#0369a1" stroke-width="1.2"/><path d="M14 20 V36 M18 18 V40 M22 20 V36" stroke="#e2e8f0" stroke-width="1.6" stroke-linecap="round"/><circle cx="18" cy="48" r="2.2" fill="#e2e8f0"/></svg>' },
    teacher: { label: "ミニ先生", svg: '<svg viewBox="0 0 36 50" width="36" height="50" aria-hidden="true"><path d="M18 49 L6 27 H30 Z" fill="#475569" stroke="#1e293b" stroke-width="1.5" stroke-linejoin="round"/><path d="M18 27 L15 32 L18 43 L21 32 Z" fill="#ef4444"/><circle cx="18" cy="15" r="13" fill="#fde1c2" stroke="#b9794a" stroke-width="1.5"/><path d="M5.5 13 C6 4 30 4 30.5 13 C26 8 10 8 5.5 13 Z" fill="#334155"/><circle cx="13" cy="16" r="4" fill="#ffffff" stroke="#1e293b" stroke-width="1.4"/><circle cx="23" cy="16" r="4" fill="#ffffff" stroke="#1e293b" stroke-width="1.4"/><path d="M17 16 H19" stroke="#1e293b" stroke-width="1.4"/><circle cx="13" cy="16" r="1.3" fill="#1e293b"/><circle cx="23" cy="16" r="1.3" fill="#1e293b"/><path d="M13 22 Q18 26.5 23 22" fill="none" stroke="#7c2d12" stroke-width="1.6" stroke-linecap="round"/></svg>' }
};
function roulettePointerSkin() { const v = lsGet(ROULETTE_POINTER_KEY, "pin"); return POINTER_SKINS[v] ? v : "pin"; }
function roulettePinSetup(force) {
    const el = $id("roulettePointer");
    if (!el) return;
    const skin = roulettePointerSkin();
    if (!force && el.classList.contains("is-pin") && el.dataset.skin === skin) return;
    el.innerHTML = POINTER_SKINS[skin].svg;
    el.dataset.skin = skin;
    el.classList.add("is-pin");
}
function setRoulettePointer(v) {
    if (!POINTER_SKINS[v]) v = "pin";
    lsSet(ROULETTE_POINTER_KEY, v);
    roulettePinSetup(true);
}
let rPtr = { th: 0, w: 0, t: null, idx: null, held: false, frame: 0 };
function roulettePointerUpdate(now) {
    const el = $id("roulettePointer");
    if (!el) return;
    if (rouletteIsReel() || rouletteIsMarble() || !rCanvas || !rItems.length) { if (rPtr.th !== 0) { rPtr.th = 0; rPtr.w = 0; el.style.transform = ""; } rPtr.t = now; return; }
    const dt = rPtr.t === null ? 0.016 : Math.min(0.05, Math.max(0, (now - rPtr.t) / 1000));
    rPtr.t = now;
    const n = rItems.length, arc = Math.PI * 2 / n;
    const scale = rCanvas.clientWidth ? rCanvas.clientWidth / rCanvas.width : 1;
    const ringR = (rCanvas.width / 2 - 10 - PEG_INSET) * scale;          // 突起が並ぶ円の半径（画面の大きさ）
    const arcPx = arc * ringR;
    const cPx = Math.min(15, arcPx * 0.4);                              // 針がたわむ、一番大きな距離
    const thMax = Math.asin(Math.min(0.95, cPx / POINTER_LEN));
    const norm = ((Math.PI * 1.5 - rAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const pos = norm / arc, idx = Math.floor(pos);
    const s = (pos - idx) * arcPx;                                       // 突起が針に届くまでの距離
    const engaged = s <= cPx;
    if (engaged) {
        rPtr.th = Math.asin((cPx - s) / POINTER_LEN); rPtr.w = 0;        // 突起に押されて、たわむ
    } else {
        if (rPtr.idx !== null && idx !== rPtr.idx && !rPtr.held) { rPtr.th = Math.max(rPtr.th, thMax * 0.9); rPtr.w = 0; }   // 速くて引っ掛からずに通った時の、はじき
        const k = 900, c = 27, steps = Math.max(1, Math.ceil(dt / 0.004)), h = dt / steps;
        for (let i = 0; i < steps; i++) { rPtr.w += (-k * rPtr.th - c * rPtr.w) * h; rPtr.th += rPtr.w * h; }
        rPtr.th = Math.max(-thMax * 0.5, Math.min(thMax * 1.05, rPtr.th));
        if (Math.abs(rPtr.th) < 0.002 && Math.abs(rPtr.w) < 0.05) { rPtr.th = 0; rPtr.w = 0; }
    }
    rPtr.held = engaged; rPtr.idx = idx;
    el.style.transform = "translateX(-50%) rotate(" + (-rPtr.th * 180 / Math.PI).toFixed(2) + "deg)";
}
function roulettePointerLoop(now) {
    roulettePointerUpdate(now);
    rPtr.frame = requestAnimationFrame(roulettePointerLoop);
}
function roulettePointerStart() {
    cancelAnimationFrame(rPtr.frame);
    rPtr = { th: 0, w: 0, t: null, idx: null, held: false, frame: 0 };
    rPtr.frame = requestAnimationFrame(roulettePointerLoop);
}
function roulettePointerStop() {
    cancelAnimationFrame(rPtr.frame);
    rPtr.frame = 0;
    const el = $id("roulettePointer");
    if (el) el.style.transform = "";
}
function spinRoulette(flickV) {
    if (rSpinning) return;
    initAudio();

    // 前回の当選者を、このスピンを押したタイミングで盤面から除外する（除外設定ON時）
    const excludeToggle = $id("nominateExcludeToggle");
    const shouldExclude = excludeToggle ? excludeToggle.checked : false;
    if (shouldExclude && rPendingWinner) {
        if (!nominatedHistoryList.includes(rPendingWinner)) {
            nominatedHistoryList.push(rPendingWinner);
        }
        rItems = rItems.filter(it => !nominatedHistoryList.includes(it.fullText));
        rPendingWinner = null;

        if (rItems.length === 0) {
            // 全員一巡したら履歴をリセットして再び全員を盤面に戻す
            nominatedHistoryList = [];
            document.querySelectorAll('.seat').forEach(s => s.classList.remove('is-nominated', 'is-already-nominated'));
            const allActive = getSeatsInLabelOrder().filter(s => s && s.type === "STUDENT" && s.text !== "" && !s.isAbsent);
            rItems = allActive.map(s => {
                let name = s.text.replace(/\[休\]/g, "").replace(/\[.*?\]/g, "").replace(/\{.*?\}/g, "").replace(/[（\(].*?[）\)]/g, "").trim();
                let cleanName = name.includes(".") ? name.split(".")[1].trim() : name;
                return { fullText: s.text, cleanName: cleanName };
            });
            showToast("全員一巡したので指名履歴をリセットしました。", "success");
        }
        rAngle = getRouletteRestAngle();
        drawRoulette();
        updateNominationProgress();
    }

    rouletteTickReset();
    if (rouletteIsReel()) { spinReel(); return; }
    if (rouletteIsMarble()) { spinMarble(); return; }
    if (rouletteTeaseOn() || rouletteHasQueuedWinner()) { spinWheelTease(); return; }
    rSpinning = true;
    rVelocity = typeof flickV === "number" ? flickV : 0.3 + Math.random() * 0.1;   // ドラッグではじいた時は、その強さで回ります
    rWheelLastT = null;
    animateRoulette();
}
// 当選者が決まった時の、共通の処理（円盤でも、縦スクロールでも使います）
function finishRoulette(winnerIndex) {
    let winnerObj = rItems[winnerIndex];
    let winnerClean = winnerObj.cleanName;
    let winnerFull = winnerObj.fullText;
    
    const excludeToggle = $id("nominateExcludeToggle");
    const shouldExclude = excludeToggle ? excludeToggle.checked : false;
    
    if (shouldExclude) {
        // この時点では盤面から消さず、当選者を記録しておく。
        // 実際の除外は次にスピンボタンを押したときに行う。
        rPendingWinner = winnerFull;
        const seatEls = document.querySelectorAll('.seat');
        currentStudents.forEach((seat, idx) => {
            if (seat && seat.text === winnerFull) {
                if (seatEls[idx]) seatEls[idx].classList.add('is-already-nominated');
            }
        });
    }
    
    pushNominationUndo("roulette", winnerFull, nominatedHistoryList.slice(), recordNominationHistory(winnerFull));
    updateNominationProgress();
    showToast(`🎯 ルーレット当選：【 ${winnerClean} 】 さんです。`, "success");

}
// 円盤の物理は、画面の更新の速さに関係なく、同じ時間で止まるようにします（1/60秒を1コマとして、経過した時間の分だけ進めます）
let rWheelLastT = null;
function animateRoulette() {
    const now = performance.now();
    const dtF = rWheelLastT === null ? 1 : Math.max(0.2, Math.min(4, (now - rWheelLastT) / (1000 / 60)));
    rWheelLastT = now;
    rAngle += rVelocity * dtF;
    rouletteWheelTick();
    rVelocity *= Math.pow(rouletteWheelDamp(), dtF);
    drawRoulette();
    
    if (rVelocity < 0.002) {
        rSpinning = false;
        
        let normalized = rAngle % (Math.PI * 2);
        let pointerAngle = Math.PI * 1.5;
        let diff = (pointerAngle - normalized + Math.PI * 2) % (Math.PI * 2);
        let arc = Math.PI * 2 / rItems.length;
        let winnerIndex = Math.floor(diff / arc);
        
        rouletteWinSound();
        finishRoulette(winnerIndex);
        return;
    }
    rAnimationFrame = requestAnimationFrame(animateRoulette);
}

// ==========================================
// 回る時間の設定と、ルーレットの音（円盤・縦スクロールの、どちらでも使います）
// ==========================================
const ROULETTE_SPEED_KEY = "roulette_speed";   // "short"（短め）／ "normal"（普通）／ "long"（長め）
const ROULETTE_SOUND_KEY = "roulette_sound";   // "1"（音を出す）／ "0"（出さない）
function rouletteSpeedName() { const v = lsGet(ROULETTE_SPEED_KEY, "normal"); return v === "short" || v === "long" ? v : "normal"; }
function rouletteSpeedMult() { return { short: 0.6, normal: 1, long: 1.4 }[rouletteSpeedName()]; }
function rouletteWheelDamp() { return { short: 0.98, normal: 0.99, long: 0.9925 }[rouletteSpeedName()]; }   // 円盤は、1コマごとにこの割合で遅くなります
function setRouletteSpeed(v) { if (rSpinning) { const sel = $id("rouletteSpeedSelect"); if (sel) sel.value = rouletteSpeedName(); return; } lsSet(ROULETTE_SPEED_KEY, v); }

function rouletteSoundOn() {
    if (lsGet(ROULETTE_SOUND_KEY, "1") !== "1" || isSilentTestMode) return false;
    try { initAudio(); } catch (e) { return false; }
    return !!audioCtx && typeof playTone === "function" && typeof getAudioBus === "function" && !!getAudioBus();
}
function toggleRouletteSound() {
    lsSet(ROULETTE_SOUND_KEY, lsGet(ROULETTE_SOUND_KEY, "1") === "1" ? "0" : "1");
    rouletteUpdateSoundButton();
    if (lsGet(ROULETTE_SOUND_KEY, "1") === "1") rouletteTickSound(false);   // 押した時に、1回鳴らして、確かめられます
}
function rouletteUpdateSoundButton() {
    const b = $id("btnRouletteSound");
    if (b) b.textContent = lsGet(ROULETTE_SOUND_KEY, "1") === "1" ? "音：あり" : "🔇 音：なし";
}
// 名前や区切りが、まん中を通るたびに、「カチッ」と鳴ります。ゆっくりになるほど、低く、重くなります
let rTickKey = null, rTickAt = 0;
function rouletteTickReset() { rTickKey = null; rTickAt = 0; }
function rouletteTickSound(heavy) {
    if (!rouletteSoundOn()) return;
    const t = audioCtx.currentTime + 0.005;
    if (heavy) playTone(900, t, 0.06, "square", { filter: 2400, attack: 0.001, release: 0.045, vol: 0.2 });
    else playTone(1700, t, 0.03, "square", { filter: 3800, attack: 0.001, release: 0.02, vol: 0.12 });
}
function rouletteTick(key) {
    if (rTickKey === null) { rTickKey = key; return; }
    if (key === rTickKey) return;
    rTickKey = key;
    const now = performance.now(), gap = now - rTickAt;
    if (gap < 45) return;                       // 速い時は、鳴らしすぎない
    rTickAt = now;
    rouletteTickSound(gap > 220);
}
// 止まった時の、お祝いの音
function rouletteWinSound() {
    if (!rouletteSoundOn() || typeof playBell !== "function") return;
    const t = audioCtx.currentTime + 0.05;
    [784, 988, 1175, 1568].forEach((f, i) => playBell(f, t + i * 0.09, 1.1, 0.55, 0.4));
}

// ==========================================
// 焦らし演出（「次は君かも？」焦らし演出がONの時）
// 最初にじわじわ加速して、そのあと減速します。止まる直前に、「進む」「戻る」「そのまま留まる」を、ランダムに2〜3回くり返してから、本当の人で止まります
// ==========================================
const TEASE_MAIN_MS = 3200;
const WHEEL_TEASE_MS = 4600;                    // 円盤の、焦らし演出の時の回る時間（この後に突起に引っ掛かる動きが続きます）
const TEASE_RAMP = 0.25;   // 加速する時間の割合（最初の4分の1）
// 0→1 の時間を、0→1 の進み具合にします。最初はじわじわ加速して、そのあと、長く減速して、そっと止まります
function rouletteDecayProfile(u) {
    const a = TEASE_RAMP, k = 2.2, area = a / 2 + (1 - a) / k;
    const d = u < a ? u * u / (2 * a) : a / 2 + (1 - a) * (1 - Math.pow(1 - (u - a) / (1 - a), k)) / k;
    return d / area;
}
function rouletteTeaseOn() { const t = $id("nominateTeaseToggle"); return !!(t && t.checked); }
// 止まる直前の動きを、ランダムに作ります。位置は、本当の人の位置を0として、1人分を1とします
//   進む：+0.6（次の人のほうへ進む）／戻る：-0.6（前の人のほうへ戻る）／留まる：その場で、じっとする
// この3つの動きだけで、最後にぴったり本当の人の所に着くように、はじめの位置を決めます（最後に、つじつまを合わせる動きは、ありません）
function rouletteTeasePlan(mainMs) {
    const STEP = 0.6;
    const kinds = [{ n: "go", d: STEP, hold: 250 }, { n: "back", d: -STEP, hold: 250 }, { n: "stay", d: 0, hold: 600 }];
    const ms = 900;                                                   // 進む・戻るは、ゆっくり動きます
    // 進む・戻るは、多くても1回までです（「留まる」は、前や後ろに付けられます）
    const mv = [null, kinds[0], kinds[1]][Math.floor(Math.random() * 3)];   // 進む／戻る／どちらもなし
    const stay = kinds[2];
    let picks;
    if (!mv) picks = [stay];
    else {
        const form = Math.floor(Math.random() * 3);
        picks = form === 0 ? [mv, stay] : form === 1 ? [stay, mv] : [stay, mv, stay];
    }
    const start = -picks.reduce((t, k) => t + k.d, 0);               // 動きの合計が0になる所から、はじめます
    const segs = [{ kind: "main", dur: mainMs || TEASE_MAIN_MS, to: start }, { kind: "hold", dur: 150, at: start }];
    let pos = start;
    picks.forEach(k => {
        if (k.n === "stay") { segs.push({ kind: "hold", dur: k.hold, at: pos }); return; }
        segs.push({ kind: "move", dur: ms, from: pos, to: pos + k.d });
        pos += k.d;
        segs.push({ kind: "hold", dur: k.hold, at: pos });
    });
    return { segs: segs, total: segs.reduce((t, g) => t + g.dur, 0), names: picks.map(k => k.n), start: start };
}
// from → to（止まる位置）。unit は、1人分の長さです
function rouletteTeaseValue(ms, from, to, unit, plan) {
    const ease = u => u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    let t = ms;
    for (const g of plan.segs) {
        if (t <= g.dur || g === plan.segs[plan.segs.length - 1]) {
            const u = Math.max(0, Math.min(1, t / g.dur));
            if (g.kind === "main") {
                // はじめは、じわじわ加速して、そのあと、だんだん遅くなる
                const d = rouletteDecayProfile(u);
                const peak = to + g.to * unit;
                return from + (peak - from) * d;
            }
            if (g.kind === "hold") return to + (g.at + (g.wob ? g.wob * Math.sin(u * Math.PI * 4) * (1 - u) : 0)) * unit;
            const e = g.ease === "out" ? 1 - Math.pow(1 - u, 2.4) : g.ease === "in" ? Math.pow(u, 2) : ease(u);
            return to + (g.from + (g.to - g.from) * e) * unit;
        }
        t -= g.dur;
    }
    return to;
}
function rouletteWheelTick() {
    const n = rItems.length;
    if (!n) return;
    const arc = Math.PI * 2 / n;
    const norm = ((Math.PI * 1.5 - rAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    rouletteTick(Math.floor(norm / arc));          // ポインターの下の、区切りが変わった時
}
// 円盤の焦らし：止まる直前の動きは、次の3つから、ランダムに選びます。止まる位置も、真ん中だけでなく、端に近い所まで、ランダムです
//   戻る　　　：次の人との境目の突起に引っ掛かって止まり、押し戻されて、止まる位置まで戻る
//   乗り越える：手前の突起に引っ掛かって止まり、ぐっと乗り越えて、止まる位置まで進む
//   そのまま　：何も引っ掛からずに、ゆっくり減速して、そのまま止まる
// 位置は、本当の人の真ん中を0として、1人分を1とします（突起は、±0.5にあります）
function rouletteWheelTeasePlan(mainMs) {
    const R = (a, b) => a + Math.random() * (b - a);
    // 針が突起に深く押される（画面の2〜4.5ピクセル手前）所で止めます。人数が少なくて1人分が広くても、針がしっかりたわみます
    const n = rItems.length || 1, scale = rCanvas && rCanvas.clientWidth ? rCanvas.clientWidth / rCanvas.width : 1;
    const arcPx = Math.max(12, (Math.PI * 2 / n) * ((rCanvas ? rCanvas.width / 2 : 300) - 10 - PEG_INSET) * scale);
    const near = () => Math.max(0.012, Math.min(0.08, R(2, 4.5) / arcPx));
    const kinds = rouletteTeaseOn() ? ["back", "over", "plain"] : ["plain"];   // 焦らし演出がオフの時（順番リストで当たる人が決まっている時）は、普通に止まります
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    // 止まる位置：真ん中に近い所が多めで、端（±0.4）にも止まります
    let fin = (Math.random() < 0.5 ? -1 : 1) * 0.4 * Math.pow(Math.random(), 0.6);
    const segs = [];
    let pos;
    const hold = (dur, wob) => segs.push({ kind: "hold", dur: dur, at: pos, wob: wob || 0 });
    const move = (to, dur, ease) => { segs.push({ kind: "move", dur: dur, from: pos, to: to, ease: ease }); pos = to; };
    if (kind === "plain") {
        segs.push({ kind: "main", dur: Math.round(mainMs * 1.3), to: fin });
        pos = fin;
    } else if (kind === "back") {
        const c = 0.5 - near();                                       // 次の突起に引っ掛かる位置
        fin = Math.min(fin, c - 0.12);                                // 戻る幅は、すくなくともこれだけ取ります
        pos = c; segs.push({ kind: "main", dur: Math.round(mainMs * 1.2), to: c });   // 回る勢いが、そのまま、突起に近づく動きにつながります（途中でいったん止まりません）
        hold(Math.round(R(380, 560)), 0.012);                         // 針がたわんで、ひと呼吸、止まる
        move(fin, Math.round(450 + 650 * Math.abs(c - fin)), "out");  // 押し戻されて、戻る
    } else {
        const c = -0.5 - near();                                      // 手前の突起に引っ掛かる位置
        pos = c; segs.push({ kind: "main", dur: Math.round(mainMs * 1.2), to: c });
        hold(Math.round(R(380, 560)), 0.012);
        move(fin, Math.round(600 + 500 * Math.abs(fin - c)));         // ぐっと、乗り越える
    }
    return { segs: segs, total: segs.reduce((t, g) => t + g.dur, 0), names: [kind], start: segs[0].to, fin: fin };
}
let rWheelTeaseKind = "";                       // 今回の焦らしの種類（back／over／plain）
// 当たる人を決めます（指名の順番リストがあれば、その順。なければ、ランダム）
function roulettePickWinnerIndex(n) {
    try { if (typeof nqRouletteIndex === "function") { const i = nqRouletteIndex(rItems); if (i >= 0 && i < n) return i; } } catch (e) { /* ランダムにする */ }
    return Math.floor(Math.random() * n);
}
function rouletteHasQueuedWinner() {
    try { return typeof nqRouletteIndex === "function" && nqRouletteIndex(rItems) >= 0; } catch (e) { return false; }
}
function spinWheelTease() {
    const n = rItems.length;
    const arc = Math.PI * 2 / n;
    const winner = roulettePickWinnerIndex(n);
    // 止まった時に、ポインターが winner の真ん中に来る角度
    const targetNorm = ((Math.PI * 1.5 - (winner + 0.5) * arc) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    const from = rAngle;
    const delta = (((targetNorm - from) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) + Math.PI * 2 * 4;
    const to = from + delta;
    // 最初にじわじわ加速して、ゆるやかに減速して、止まる直前に、突起に引っ掛かって、戻りかけたり、進みかけたりします
    const wheelMs = Math.round(WHEEL_TEASE_MS * rouletteSpeedMult());
    const plan = rouletteWheelTeasePlan(wheelMs);
    rWheelTeaseKind = plan.names[0];
    rSpinning = true;
    const t0 = performance.now();
    const step = now => {
        const ms = Math.max(0, Math.min(plan.total, now - t0));
        rAngle = rouletteTeaseValue(ms, from, to, arc, plan);
        rouletteWheelTick();
        drawRoulette();
        if (ms < plan.total) { rAnimationFrame = requestAnimationFrame(step); return; }
        rAngle = to + plan.fin * arc;
        rSpinning = false;
        drawRoulette();
        rouletteWinSound();
        finishRoulette(winner);
    };
    rAnimationFrame = requestAnimationFrame(step);
}

// ==========================================
// 縦スクロール式（柔道ルーレットのような見た目）
// 暗い青の背景に、名前の列だけが流れます。はじめは、まん中の名前だけを大きく光らせて、回り出すと、まわりの名前が出てきます
// 名前の列は、上から下へ流れて、だんだん遅くなり、そっと止まります。止まったら、まわりの名前が消えて、当たった名前だけが光ります
// ==========================================
const ROULETTE_STYLE_KEY = "roulette_style";   // "wheel"（円盤）／ "marble"（ビー玉）／ "reel"（縦スクロール）
const REEL_W = 1100, REEL_H = 440, REEL_ROW_H = 104;   // 画面の大きさと、1人分の高さ
const REEL_MS = 10500;                          // 普通の回る時間
const REEL_TEASE_MAIN_MS = 7000;                // 焦らし演出の時の、回る時間（この後に進む・戻る・留まるが続きます）
const REEL_FADE_IN_MS = 300, REEL_HOLD_MS = 1200, REEL_FADE_OUT_MS = 500;
let rReelFrame = 0, rReelPos = 0, rReelCanvas = null, rReelCtx = null, rReelFade = 0;

function rouletteIsReel() { return lsGet(ROULETTE_STYLE_KEY, "wheel") === "reel"; }
function rouletteIsMarble() { return lsGet(ROULETTE_STYLE_KEY, "wheel") === "marble"; }
function rouletteAddStyle() {
    if ($id("rouletteReelStyle")) return;
    const st = document.createElement("style");
    st.id = "rouletteReelStyle";
    st.textContent = `
#rouletteOverlay.is-reel { background: #071330 !important; backdrop-filter: none !important; }
#rouletteOverlay.is-reel .roulette-wrapper { display: none !important; }
#rouletteOverlay:not(.is-reel) #rouletteReelWrap { display: none !important; }
#rouletteReelWrap { width: 100%; display: flex; justify-content: center; }
#rouletteReelCanvas { width: min(98vw, 1100px); height: auto; display: block; }
#btnRouletteStyle { font-size: 16px; padding: 12px 22px; margin: 0; border-radius: 50px; }
#rouletteOptions { margin-top: 12px; display: flex; gap: 18px; align-items: center; justify-content: center; flex-wrap: wrap; font-size: 15px; color: #cbd5e1; }
#rouletteSpeedLabel { display: inline-flex; align-items: center; gap: 8px; margin: 0; }
#rouletteOptions select { width: auto !important; margin: 0 !important; padding: 6px 10px; border-radius: 8px; }
#btnRouletteSound { font-size: 15px; padding: 8px 18px; margin: 0; border-radius: 50px; }
#rouletteOverlay.is-marble #roulettePointer { display: none; }
#rouletteCanvas { touch-action: none; }
#rouletteOptions .roulette-note { display: inline-flex; align-items: center; gap: 6px; }
#roulettePointer { transform-origin: 50% 18%; will-change: transform; }
#roulettePointer.is-pin { font-size: 0; line-height: 0; width: 36px; height: 50px; top: -14px; transform-origin: 50% 10%; text-shadow: none; filter: drop-shadow(0 3px 3px rgba(0,0,0,0.45)); }
#roulettePointer.is-pin svg { display: block; }
body.roulette-active #nomProgressMode { display: flex; }
body.roulette-active #nomProgressMode.is-hidden { display: none; }
body.roulette-active #nomProgressMode { top: 32px; right: 160px; }
@media (max-width: 760px) { body.roulette-active #nomProgressMode { top: 36px; left: 10px; right: auto; font-size: 12px; padding: 5px 12px; gap: 8px; } body.roulette-active #nomProgressMode .nom-progress-bar { width: 56px; } }
`;
    document.head.appendChild(st);
}
function rouletteApplyStyle() {
    const o = $id("rouletteOverlay");
    if (!o) return;
    const reel = rouletteIsReel(), marble = rouletteIsMarble();
    o.classList.toggle("is-reel", reel);
    o.classList.toggle("is-marble", marble);
    const b = $id("btnRouletteStyle");
    if (b) b.textContent = reel ? "🎡 円盤にする" : marble ? "🥋 縦スクロールにする" : "ビー玉にする";
    document.querySelectorAll("#rouletteOptions [data-wheel-only]").forEach(e => { e.style.display = (reel || marble) ? "none" : ""; });
    if (reel) {
        if (rReelPos >= rItems.length || rReelPos < 0) rReelPos = 0;
        rReelFade = 0;
        drawReel();
    }
}
function toggleRouletteStyle() {
    if (rSpinning) return;
    lsSet(ROULETTE_STYLE_KEY, rouletteIsReel() ? "wheel" : rouletteIsMarble() ? "reel" : "marble");
    rMarble = null; rMarbleWin = -1;
    rouletteApplyStyle();
    if (!rouletteIsReel()) drawRoulette();
}

function reelMix(c1, c2, t) { return "rgb(" + c1.map((v, i) => Math.round(v + (c2[i] - v) * t)).join(",") + ")"; }
// pos は「まん中に来ている人の番号」です（小数も使います）。pos が減ると、名前の列は、下へ流れます
// rReelFade は、まわりの名前の濃さです（0：まん中の名前だけ ／ 1：全部）
function drawReel() {
    if (!rReelCtx || !rItems.length) return;
    const c = rReelCtx, W = REEL_W, H = REEL_H, cy = H / 2, n = rItems.length, fade = rReelFade;
    c.clearRect(0, 0, W, H);
    c.fillStyle = "#071330"; c.fillRect(0, 0, W, H);   // 画面の背景と、同じ色
    // まん中の、青い光
    c.save();
    c.translate(W / 2, cy); c.scale(1, 0.3);
    const gl = c.createRadialGradient(0, 0, 0, 0, 0, W * 0.42);
    gl.addColorStop(0, "rgba(80,140,230,0.55)"); gl.addColorStop(0.5, "rgba(50,100,190,0.22)"); gl.addColorStop(1, "rgba(30,70,150,0)");
    c.fillStyle = gl; c.beginPath(); c.arc(0, 0, W * 0.42, 0, Math.PI * 2); c.fill();
    c.restore();
    c.textAlign = "center"; c.textBaseline = "middle";
    const first = Math.floor(rReelPos) - 4, last = Math.floor(rReelPos) + 5;
    for (let k = first; k <= last; k++) {
        const dist = Math.abs(k - rReelPos);
        const center = Math.max(0, 1 - dist);                        // まん中に近い程 1
        const alpha = Math.max(fade, center);
        if (alpha <= 0.01) continue;
        const y = cy + (k - rReelPos) * REEL_ROW_H;
        const item = rItems[((k % n) + n) % n];
        const base = (k % 2 === 0) ? [255, 255, 255] : [140, 203, 242];   // 白と水色を、かわりばんこに
        c.save();
        c.globalAlpha = alpha;
        c.fillStyle = reelMix(base, [255, 255, 255], (1 - fade) * center);
        const scale = 1 + 0.16 * (1 - fade) * center;
        c.font = "bold " + Math.round(58 * scale) + "px 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif";
        const glow = (1 - fade) * center;
        if (glow > 0.02) { c.shadowColor = "rgba(255,255,255," + (0.85 * glow).toFixed(2) + ")"; c.shadowBlur = 26 * glow; }
        let nm = item.cleanName;
        while (nm.length > 1 && c.measureText(nm).width > W - 160) nm = nm.slice(0, -1);
        c.fillText(nm, W / 2, y);
        c.restore();
    }
}
function spinReel() {
    const n = rItems.length;
    if (!n) return;
    rSpinning = true;
    rReelPos = Math.round(rReelPos) % n;
    if (rReelPos < 0) rReelPos += n;
    const winner = roulettePickWinnerIndex(n);
    const from = rReelPos;
    const base = ((from - winner) % n + n) % n;
    const dist = base + n * Math.ceil(24 / n);                      // 24人分以上は、流れるようにします
    const to = from - dist;                                          // 名前の列は、下へ流れます（番号は減ります）
    const tease = rouletteTeaseOn();
    const mult = rouletteSpeedMult();
    const plan = tease ? rouletteTeasePlan(Math.round(REEL_TEASE_MAIN_MS * mult)) : null;
    const total = tease ? plan.total : Math.round(REEL_MS * mult);
    let won = false;
    cancelAnimationFrame(rReelFrame);
    const t0 = performance.now();
    const fadeOutAt = total + REEL_HOLD_MS, endAt = fadeOutAt + REEL_FADE_OUT_MS;
    const step = now => {
        const ms = Math.max(0, now - t0);                                  // 最初の1コマで、時間がマイナスにならないように
        if (ms < total) {
            rReelPos = tease ? rouletteTeaseValue(ms, from, to, -1, plan)      // 進む・戻る・留まる、をランダムにくり返す
                             : from + (to - from) * rouletteDecayProfile(ms / total);
            rReelFade = Math.min(1, ms / REEL_FADE_IN_MS);
            rouletteTick(Math.floor(rReelPos + 0.5));            // 名前が、まん中を通るたびに鳴る
        } else {
            if (!won) { won = true; rouletteWinSound(); }
            rReelPos = to;
            rReelFade = ms < fadeOutAt ? 1 : Math.max(0, 1 - (ms - fadeOutAt) / REEL_FADE_OUT_MS);   // 止まったら、まわりの名前が消える
        }
        drawReel();
        if (ms < endAt) { rReelFrame = requestAnimationFrame(step); return; }
        rReelPos = winner;
        rReelFade = 0;
        rSpinning = false;
        drawReel();
        finishRoulette(winner);
    };
    rReelFrame = requestAnimationFrame(step);
}

// ==========================================
// ビー玉ルーレット：円盤が、ゆっくり逆向きに回る中を、ビー玉が走り、ゆっくりになって、区画に落ちます
// 落ちる区画は、はじめに決めておきます。ビー玉は、そこへ向かって、時間で動きます（画面の更新の速さには、関係しません）
// ==========================================
const MARBLE = { OUT: 290, BOWL: 252, FRET_IN: 206, POCKET: 229, TRACK: 271, R: 11 };
let rMarble = null, rMarbleWin = -1;
function drawMarbleWheel() {
    if (!rCtx || !rCanvas) return;
    const c = rCtx, cx = rCanvas.width / 2, cy = rCanvas.height / 2, n = rItems.length;
    c.clearRect(0, 0, rCanvas.width, rCanvas.height);
    if (n === 0) return;
    const arc = Math.PI * 2 / n;
    const colors = ["#ef4444", "#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
    // 外側の、ビー玉が走る道
    const bg = c.createRadialGradient(cx, cy, MARBLE.BOWL, cx, cy, MARBLE.OUT);
    bg.addColorStop(0, "#0b1220"); bg.addColorStop(0.55, "#475569"); bg.addColorStop(1, "#0f172a");
    c.beginPath(); c.arc(cx, cy, MARBLE.OUT, 0, Math.PI * 2); c.fillStyle = bg; c.fill();
    // 円盤
    for (let i = 0; i < n; i++) {
        const a = rAngle + i * arc;
        c.beginPath(); c.arc(cx, cy, MARBLE.BOWL - 2, a, a + arc, false); c.lineTo(cx, cy);
        c.fillStyle = colors[i % colors.length]; c.fill();
        c.save(); c.translate(cx, cy); c.rotate(a + arc / 2);
        c.textAlign = "right"; c.fillStyle = "#fff"; c.font = "bold " + (n > 24 ? 17 : 22) + "px sans-serif";
        c.fillText(rItems[i].cleanName, MARBLE.FRET_IN - 8, 8);
        c.restore();
    }
    // ビー玉が落ちる、くぼみの帯
    c.beginPath(); c.arc(cx, cy, MARBLE.BOWL - 2, 0, Math.PI * 2); c.arc(cx, cy, MARBLE.FRET_IN, 0, Math.PI * 2, true);
    c.fillStyle = "rgba(0,0,0,0.3)"; c.fill();
    // 当たりの区画
    if (rMarbleWin >= 0 && rMarbleWin < n) {
        const a = rAngle + rMarbleWin * arc;
        c.beginPath(); c.arc(cx, cy, MARBLE.BOWL - 3, a, a + arc, false); c.arc(cx, cy, MARBLE.FRET_IN + 2, a + arc, a, true); c.closePath();
        c.fillStyle = "rgba(253,224,71,0.4)"; c.fill();
        c.lineWidth = 4; c.strokeStyle = "#fde047"; c.stroke();
    }
    // 区画の仕切り
    c.lineCap = "round"; c.strokeStyle = "#fbbf24"; c.lineWidth = 3;
    for (let i = 0; i < n; i++) {
        const a = rAngle + i * arc;
        c.beginPath(); c.moveTo(cx + Math.cos(a) * MARBLE.FRET_IN, cy + Math.sin(a) * MARBLE.FRET_IN); c.lineTo(cx + Math.cos(a) * (MARBLE.BOWL - 2), cy + Math.sin(a) * (MARBLE.BOWL - 2)); c.stroke();
    }
    c.lineWidth = 3; c.strokeStyle = "#e5e7eb"; c.beginPath(); c.arc(cx, cy, MARBLE.BOWL, 0, Math.PI * 2); c.stroke();
    const hub = c.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, 26);
    hub.addColorStop(0, "#fff7d6"); hub.addColorStop(1, "#b45309");
    c.beginPath(); c.arc(cx, cy, 24, 0, Math.PI * 2); c.fillStyle = hub; c.fill(); c.lineWidth = 2; c.strokeStyle = "#78350f"; c.stroke();
    // ビー玉（走った跡つき）
    const m = rMarble || { a: rAngle + ((rMarbleWin >= 0 ? rMarbleWin : 0) + 0.5) * arc, r: MARBLE.POCKET, trail: [] };
    (m.trail || []).forEach((t, i, arr) => {
        c.beginPath(); c.arc(cx + Math.cos(t.a) * t.r, cy + Math.sin(t.a) * t.r, MARBLE.R * (0.45 + 0.4 * (i + 1) / arr.length), 0, Math.PI * 2);
        c.fillStyle = "rgba(186,230,253," + (0.08 + 0.1 * (i + 1) / arr.length).toFixed(3) + ")"; c.fill();
    });
    const mx = cx + Math.cos(m.a) * m.r, my = cy + Math.sin(m.a) * m.r;
    c.beginPath(); c.ellipse(mx + 3, my + 5, MARBLE.R * 0.95, MARBLE.R * 0.6, 0, 0, Math.PI * 2); c.fillStyle = "rgba(0,0,0,0.35)"; c.fill();
    const mg = c.createRadialGradient(mx - 4, my - 4, 1, mx, my, MARBLE.R + 2);
    mg.addColorStop(0, "#ffffff"); mg.addColorStop(0.35, "#bae6fd"); mg.addColorStop(0.75, "#0284c7"); mg.addColorStop(1, "#0c4a6e");
    c.beginPath(); c.arc(mx, my, MARBLE.R, 0, Math.PI * 2); c.fillStyle = mg; c.fill();
    c.lineWidth = 1; c.strokeStyle = "rgba(12,74,110,0.8)"; c.stroke();
}
function spinMarble() {
    const n = rItems.length, arc = Math.PI * 2 / n;
    const tease = rouletteTeaseOn(), mult = rouletteSpeedMult();
    const winner = roulettePickWinnerIndex(n);
    const T1 = (tease ? 6200 : 5000) * mult, S = (tease ? 3600 : 2600) * mult, T = T1 + S;   // 走る時間と、くぼみで跳ねる時間
    const Ssec = S / 1000, D = Math.PI * 2 * (tease ? 6 : 4.5);
    const omega = Math.PI * 2 * 1.5 / Ssec, gamma = 5 / Ssec;
    // 落ちたあと、行き過ぎてから戻る幅（焦らし演出の時は、隣の区画まで行きかけます）
    const amp = Math.min(tease ? 1.0 : 0.5, arc * (tease ? 1.7 + Math.random() * 0.6 : 0.9 + Math.random() * 0.5));
    const v1 = amp * omega / 0.55;
    const c1 = Math.max(0.04, Math.min(0.6, v1 * (T1 / 1000) / D));
    const psiF = (winner + 0.5) * arc;
    const theta0 = rAngle, Wv = 1.0;
    rMarbleWin = -1;
    rMarble = { a: 0, r: MARBLE.TRACK, trail: [] };
    rSpinning = true;
    rouletteTickReset();
    const t0 = performance.now();
    const step = now => {
        const ms = Math.max(0, Math.min(T, now - t0)), tsec = ms / 1000, Tsec = T / 1000;
        rAngle = theta0 - Wv * (tsec - tsec * tsec / (2 * Tsec));        // 円盤は、ゆっくり逆向きに回って、止まります
        let psi, r;
        if (ms < T1) {
            const u = ms / T1;
            const p = (1 - c1) * (1 - Math.pow(1 - u, 2.5)) + c1 * u;
            psi = psiF - D * (1 - p); r = MARBLE.TRACK;
        } else {
            const s = (ms - T1) / 1000;
            psi = psiF + Math.exp(-gamma * s) * (v1 / omega) * Math.sin(omega * s);
            const k = s / Ssec;
            r = ms >= T ? MARBLE.POCKET : MARBLE.POCKET + (MARBLE.TRACK - MARBLE.POCKET) * Math.exp(-4.5 * k) * Math.abs(Math.cos(Math.PI * 3.5 * k));
        }
        if (ms >= T) { psi = psiF; r = MARBLE.POCKET; }
        const a = rAngle + psi;
        rMarble.trail.push({ a: rMarble.a || a, r: rMarble.r });
        if (rMarble.trail.length > 5) rMarble.trail.shift();
        rMarble.a = a; rMarble.r = r;
        rouletteTick(Math.floor((((psi % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / arc));   // 区画の仕切りを越えるたびに、鳴ります
        if (ms >= T) rMarble.trail = [];
        drawRoulette();
        if (ms < T) { rAnimationFrame = requestAnimationFrame(step); return; }
        rSpinning = false;
        rMarbleWin = winner;
        drawRoulette();
        rouletteWinSound();
        finishRoulette(winner);
    };
    rAnimationFrame = requestAnimationFrame(step);
}

// ==========================================
// 円盤を、ドラッグして、はじいて回す（円盤の、ふつうの見た目だけ）
// 指やマウスで、円盤をつかんで回せます。時計回りに、すばやくはじくと、その強さで回り出します
// ==========================================
let rDrag = null;
function rouletteDragSetup() {
    const cv = $id("rouletteCanvas");
    if (!cv || cv.dataset.drag) return;
    cv.dataset.drag = "1";
    cv.style.cursor = "grab";
    const ang = e => { const r = cv.getBoundingClientRect(); return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)); };
    cv.addEventListener("pointerdown", e => {
        if (rSpinning || rouletteIsReel() || rouletteIsMarble() || !rItems.length) return;
        if (e.pointerType === "mouse" && e.button !== 0) return;
        try { initAudio(); } catch (error) { /* 音が出せなくても、回せます */ }
        try { cv.setPointerCapture(e.pointerId); } catch (error) { /* 何もしない */ }
        rDrag = { id: e.pointerId, last: ang(e), total: 0, samples: [{ t: performance.now(), a: 0 }] };
        rouletteTickReset();
        cv.style.cursor = "grabbing";
        e.preventDefault();
    });
    cv.addEventListener("pointermove", e => {
        if (!rDrag || e.pointerId !== rDrag.id) return;
        const a = ang(e);
        let d = a - rDrag.last;
        if (d > Math.PI) d -= Math.PI * 2;
        if (d < -Math.PI) d += Math.PI * 2;
        rDrag.last = a; rDrag.total += d; rAngle += d;
        rouletteWheelTick();
        drawRoulette();
        const now = performance.now();
        rDrag.samples.push({ t: now, a: rDrag.total });
        while (rDrag.samples.length > 2 && now - rDrag.samples[0].t > 120) rDrag.samples.shift();
    });
    const end = e => {
        if (!rDrag || (e && e.pointerId !== undefined && e.pointerId !== rDrag.id)) return;
        const s = rDrag.samples, now = performance.now();
        rDrag = null;
        cv.style.cursor = "grab";
        if (s.length < 2 || now - s[s.length - 1].t > 100) return;      // 止めてから離した時は、回しません
        const dt = Math.max(16, s[s.length - 1].t - s[0].t);
        const vFrame = (s[s.length - 1].a - s[0].a) / dt * (1000 / 60);   // 1コマあたりに進む角度
        if (vFrame < 0.05) return;
        spinRoulette(Math.max(0.15, Math.min(0.45, vFrame)));
    };
    cv.addEventListener("pointerup", end);
    cv.addEventListener("pointercancel", end);
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "roulette",
    name: "巨大ルーレット",
    version: "1.20",
    description: "指名の時、大きなルーレットで決めます。円盤と縦に流れる名前の列（柔道ルーレットのような見た目）を切り替えられます。焦らし演出がONの時は、最初にじわじわ加速して、止まる直前に「進む」「戻る」「そのまま留まる」を、ランダムにくり返してから止まります。",
    backupKeys: [ROULETTE_STYLE_KEY, ROULETTE_SPEED_KEY, ROULETTE_SOUND_KEY],
    stubs: ["drawRoulette", "spinRoulette"],
    mount(app) {
        rouletteAddStyle();
        const o = $id("rouletteOverlay"), wrap = o && o.querySelector(".roulette-wrapper");
        if (!o || !wrap) return;
        wrap.insertAdjacentHTML("afterend", '<div id="rouletteReelWrap" data-plugin="roulette"><canvas id="rouletteReelCanvas" width="1100" height="440"></canvas></div>');
        rReelCanvas = $id("rouletteReelCanvas");
        rReelCtx = rReelCanvas.getContext("2d");
        const spin = $id("btnSpinRoulette");
        if (spin && spin.parentNode) spin.insertAdjacentHTML("afterend", '<button type="button" data-plugin="roulette" class="btn-secondary" id="btnRouletteStyle" onclick="toggleRouletteStyle()"></button>');
        if (spin && spin.parentNode) {
            spin.parentNode.insertAdjacentHTML("afterend", '<div id="rouletteOptions" data-plugin="roulette"><label id="rouletteSpeedLabel">回る時間　<select id="rouletteSpeedSelect" onchange="setRouletteSpeed(this.value)"><option value="short">短め</option><option value="normal">普通</option><option value="long">長め</option></select></label><button type="button" class="btn-secondary" id="btnRouletteSound" onclick="toggleRouletteSound()"></button><label id="roulettePointerLabel" data-wheel-only="1">針　<select id="roulettePointerSelect" onchange="setRoulettePointer(this.value)"></select></label><span id="rouletteDragNote" class="roulette-note" data-wheel-only="1"></span></div>');
            $id("roulettePointerSelect").innerHTML = Object.keys(POINTER_SKINS).map(k => '<option value="' + k + '">' + POINTER_SKINS[k].label + "</option>").join("");
            $id("roulettePointerSelect").value = roulettePointerSkin();
            if (typeof makeInfoTip === "function") $id("rouletteDragNote").appendChild(makeInfoTip("円盤は指やマウスでつかんで回せます。時計回りにすばやくはじくとその強さで回り出します。焦らし演出がONの時は、はじくと焦らし演出で回ります。"));
            rouletteDragSetup();
            $id("rouletteSpeedSelect").value = rouletteSpeedName();
            if (typeof makeInfoTip === "function") $id("rouletteSpeedLabel").appendChild(makeInfoTip("回る時間の目安です。円盤は短めが約4秒、普通が約9秒、長めが約12秒です。ビー玉は短めが約5秒、普通が約8秒、長めが約11秒です。縦スクロールは短めが約6秒、普通が約10秒、長めが約15秒です。"));
            rouletteUpdateSoundButton();
        }
        rouletteApplyStyle();
        app.insertInto("guide-faq", "<li><strong>ルーレットを縦に流れる形にしたい</strong>：ルーレットの画面で「縦スクロールにする」を押します。名前の列が上から下へ流れて、だんだん遅くなって止まり、当たった名前だけが光ります。ボタンを押すたびに円盤・ビー玉・縦スクロールの順に切り替わります。回る時間は画面の下の「回る時間」で、短め・普通・長めから選べます。名前が流れる時の「カチカチ」という音は「音」のボタンであり・なしを切り替えられます。</li>");
        app.insertInto("guide-faq", "<li><strong>ルーレットをビー玉にしたい／円盤をはじきたい／針を変えたい</strong>：ルーレットの画面のボタンで「ビー玉にする」を選ぶと円盤の上をビー玉が転がって、区画に落ちます。円盤の見た目の時は円盤を指やマウスでつかんで回せて、時計回りにすばやくはじくと、その強さで回ります。「針」ではピン・指さしの手・チョーク・ミニ先生から選べます。焦らし演出がONの時は、円盤の針が突起に引っ掛かって戻ったり、引っ掛かっても乗り越えたり、何もなくそのまま止まったりします。止まる位置も区画の真ん中だけでなく、端に近い所になることがあります。</li>");
    }
});
