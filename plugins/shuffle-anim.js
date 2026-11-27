// ==========================================
// 席替えの演出プラグイン（必須）：スロット、ドラムロールなどの演出と、その効果音です。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
let shuffleAnimating = false;

let shuffleAnimSafetyTimer = null;

let slotLockCols = new Set(); // 「slotlock」描画で、ちょうど止まった列

function beginShuffleAnim(safetyMs) {
    shuffleAnimating = true;
    if (shuffleAnimSafetyTimer) clearTimeout(shuffleAnimSafetyTimer);
    // 万一、途中で止まっても、演出中のままで固まらないようにする
    shuffleAnimSafetyTimer = setTimeout(() => { endShuffleAnim(); const c = $id("classroom"); if (c) c.classList.remove("shuffling-shake", "shuffling-shake-hard", "drum-hold", "slot-spinning"); }, safetyMs || 12000);
}

let slotStopCleanup = null; // 自分で止めるスロットの後片付け（ボタンの帯・キー操作・タイマー）

function endShuffleAnim() {
    shuffleAnimating = false;
    if (slotStopCleanup) { const fn = slotStopCleanup; slotStopCleanup = null; try { fn(); } catch (e) { /* 何もしない */ } }
    if (shuffleAnimSafetyTimer) { clearTimeout(shuffleAnimSafetyTimer); shuffleAnimSafetyTimer = null; }
}

function getShuffleAnimationValues() {
    const sel = $id("animationSelect");
    return sel ? Array.from(sel.options).map(o => o.value).filter(v => v !== "none" && v !== "random") : ["initial"];
}

let lastRandomShuffleAnim = "";

function pickRandomShuffleAnimation() {
    let list = getShuffleAnimationValues().filter(v => v !== "slotstop"); // ボタンを押す演出は、おまかせには入れない
    const favs = getFavAnims().filter(v => list.includes(v));
    if (favs.length > 0) list = favs; // お気に入りがあれば、その中から選ぶ
    else if (getRandomScope() !== "all") { // お気に入りがなければ、選んだグループの中から選ぶ
        const sel = $id("animationSelect");
        const inScope = new Set(sel ? Array.from(sel.querySelectorAll('optgroup[data-scope="' + getRandomScope() + '"] option'), o => o.value) : []);
        const scoped = list.filter(v => inScope.has(v));
        if (scoped.length > 0) list = scoped;
    }
    if (list.length > 1) list = list.filter(v => v !== lastRandomShuffleAnim); // 前回と同じ演出は続けて出さない
    const pick = list[Math.floor(Math.random() * list.length)] || "initial";
    lastRandomShuffleAnim = pick;
    return pick;
}

function onShuffleAnimationChange() {
    const sel = $id("animationSelect");
    if (sel) lsSet("shuffle_anim_type", sel.value);
}

function loadShuffleAnimationSettings() {
    const sel = $id("animationSelect");
    const saved = lsGet("shuffle_anim_type", "");
    if (sel && saved && Array.from(sel.options).some(o => o.value === saved)) sel.value = saved;
    const snd = $id("shuffleSoundToggle");
    if (snd) snd.checked = lsGet("shuffle_sound", "true") !== "false";
    const spd = $id("animSpeedSelect");
    if (spd) spd.value = String(getAnimSpeed());
    refreshFavAnimUI();
    refreshMyAnimUI();
}

function toggleShuffleSound() {
    const snd = $id("shuffleSoundToggle");
    lsSet("shuffle_sound", String(!!(snd && snd.checked)));
    if (snd && snd.checked) playShuffleAnimationSound("pop");
}

// ---- 効果音（Web Audio）

let noiseBuffer = null;

function shuffleSoundOn() {
    const snd = $id("shuffleSoundToggle");
    if (!snd || !snd.checked || isSilentTestMode) return false;
    try { initAudio(); } catch (error) { return false; }
    return !!audioCtx && !!getAudioBus();
}

function getNoiseBuffer() {
    if (noiseBuffer && noiseBuffer.sampleRate === audioCtx.sampleRate) return noiseBuffer;
    const len = Math.floor(audioCtx.sampleRate * 2);
    noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuffer;
}

// ノイズを、フィルターを通して鳴らす（太鼓・シンバル・風切り音に使う）

function playNoise(start, dur, o) {
    const bus = getAudioBus();
    const vol = alarmVolume * (o.vol !== undefined ? o.vol : 1);
    if (!bus || vol <= 0) return;
    const src = audioCtx.createBufferSource();
    src.buffer = getNoiseBuffer();
    src.loop = true;
    const filt = audioCtx.createBiquadFilter();
    filt.type = o.type || "bandpass";
    filt.frequency.setValueAtTime(o.freq || 1000, start);
    if (o.freqEnd) filt.frequency.exponentialRampToValueAtTime(o.freqEnd, start + dur);
    filt.Q.value = o.q || 1;
    const attack = Math.min(o.attack !== undefined ? o.attack : 0.005, dur / 3);
    const release = Math.min(o.release !== undefined ? o.release : 0.05, dur);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(vol, start + attack);
    gain.gain.setValueAtTime(vol, Math.max(start + attack, start + dur - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    src.connect(filt); filt.connect(gain); gain.connect(bus.dry);
    if (o.wet) { const w = audioCtx.createGain(); w.gain.value = o.wet; gain.connect(w); w.connect(bus.wet); }
    src.start(start, Math.random());
    src.stop(start + dur + 0.05);
}

// 低い「ドン」（周波数がすっと下がる太鼓）

function playKick(start, vol, f0, f1, dur) {
    const bus = getAudioBus();
    const v = alarmVolume * vol;
    if (!bus || v <= 0) return;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f0, start);
    osc.frequency.exponentialRampToValueAtTime(f1, start + dur);
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(v, start + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(gain); gain.connect(bus.dry);
    osc.start(start); osc.stop(start + dur + 0.05);
}

// ドラムロール：だんだん速く、大きくなる

function playDrumRollSound(seconds) {
    if (!shuffleSoundOn()) return;
    const t0 = audioCtx.currentTime + 0.03;
    let t = 0, hit = 0;
    while (t < seconds) {
        const p = t / seconds;
        playNoise(t0 + t, 0.07, { type: "bandpass", freq: 1700 + (hit % 2) * 300, q: 0.8, vol: 0.14 + 0.5 * p, attack: 0.002, release: 0.05 });
        if (hit % 2 === 0) playKick(t0 + t, 0.12 + 0.3 * p, 190, 110, 0.09);
        t += 0.09 - 0.055 * Math.pow(p, 0.8);
        hit++;
    }
}

// 最後の「ジャン！」：シンバル＋大きな「ドン」

function playDrumImpactSound() {
    if (!shuffleSoundOn()) return;
    const t = audioCtx.currentTime + 0.02;
    playNoise(t, 1.7, { type: "highpass", freq: 5200, q: 0.6, vol: 0.55, attack: 0.002, release: 1.6, wet: 0.4 });
    playNoise(t, 0.5, { type: "bandpass", freq: 3200, q: 0.5, vol: 0.4, attack: 0.002, release: 0.4 });
    playKick(t, 1.0, 150, 42, 0.42);
    playBell(1046.5, t + 0.05, 1.2, 0.5, 0.4);
}

function playSlotTickSound(level) {
    if (!shuffleSoundOn()) return;
    const t = audioCtx.currentTime + 0.005;
    playTone(1500 + level * 120, t, 0.03, "square", { filter: 3800, attack: 0.001, release: 0.02, vol: 0.12 });
}

function playSlotLockSound(level) {
    if (!shuffleSoundOn()) return;
    const t = audioCtx.currentTime + 0.005;
    playKick(t, 0.55, 260, 90, 0.16);
    playNoise(t, 0.05, { type: "highpass", freq: 3000, q: 0.7, vol: 0.25, attack: 0.001, release: 0.04 });
    playTone(660 + level * 90, t + 0.02, 0.18, "triangle", { attack: 0.003, release: 0.12, vol: 0.35, decay: true, wet: 0.25 });
}

function playSlotFinishSound() {
    if (!shuffleSoundOn()) return;
    const t = audioCtx.currentTime + 0.05;
    [784, 988, 1175, 1568].forEach((f, i) => playBell(f, t + i * 0.09, 1.1, 0.55, 0.4));
}

// ドラムロール・スロット以外の演出：動きに合わせた短い音

function playShuffleAnimationSound(mode) {
    if (!shuffleSoundOn()) return;
    const t = audioCtx.currentTime + 0.02;
    const whoosh = (dur, f0, f1, vol) => playNoise(t, dur, { type: "bandpass", freq: f0, freqEnd: f1, q: 1.2, vol: vol, attack: 0.05, release: dur * 0.5, wet: 0.2 });
    if (mode === "firework") {
        whoosh(0.7, 500, 3500, 0.35);
        playKick(t + 0.62, 0.7, 140, 50, 0.3);
        playNoise(t + 0.62, 0.7, { type: "highpass", freq: 4500, q: 0.7, vol: 0.4, attack: 0.002, release: 0.6, wet: 0.4 });
        [1568, 2093, 2637].forEach((f, i) => playBell(f, t + 0.7 + i * 0.07, 0.9, 0.3, 0.5));
    } else if (mode === "bigbang" || mode === "thunder" || mode === "impact") {
        playKick(t, 0.9, 130, 40, 0.4);
        playNoise(t, 0.6, { type: "lowpass", freq: 900, freqEnd: 120, q: 0.8, vol: 0.6, attack: 0.002, release: 0.5 });
    } else if (mode === "galaxy" || mode === "laser" || mode === "meteor") {
        whoosh(0.9, 400, 4200, 0.3);
        [1175, 1568, 2093].forEach((f, i) => playTone(f, t + 0.15 + i * 0.1, 0.4, "sine", { attack: 0.005, release: 0.25, vol: 0.25, decay: true, wet: 0.4 }));
    } else if (mode === "bubble") {
        for (let i = 0; i < 8; i++) playTone(900 + Math.random() * 900, t + 0.1 + i * 0.11, 0.09, "sine", { attack: 0.003, release: 0.07, vol: 0.28, decay: true, wet: 0.3 });
    } else if (mode === "glide") {
        whoosh(0.9, 250, 1800, 0.28);
    } else if (mode === "spiral") {
        whoosh(1.0, 300, 3200, 0.28);
        [880, 1109, 1319, 1760].forEach((f, i) => playTone(f, t + 0.2 + i * 0.12, 0.35, "sine", { attack: 0.005, release: 0.22, vol: 0.22, decay: true, wet: 0.4 }));
    } else if (mode === "bounce") {
        [0.05, 0.5, 0.82, 1.04, 1.2].forEach((o, i) => playKick(t + o, 0.7 - i * 0.12, 170 - i * 12, 60, 0.2));
    } else if (mode === "pendulum") {
        [988, 784, 659, 523].forEach((f, i) => playBell(f, t + i * 0.34, 1.1, 0.32 - i * 0.04, 0.5));
    } else if (mode === "coin") {
        playTone(988, t, 0.09, "square", { filter: 3200, attack: 0.002, release: 0.05, vol: 0.16 });
        playTone(1319, t + 0.09, 0.55, "square", { filter: 3200, attack: 0.002, release: 0.4, vol: 0.16, decay: true, wet: 0.3 });
    } else if (mode === "curtain") {
        whoosh(1.0, 220, 1400, 0.3);
        playNoise(t + 0.1, 0.7, { type: "lowpass", freq: 700, freqEnd: 200, q: 0.8, vol: 0.25, attack: 0.05, release: 0.5 });
    } else if (mode === "scan") {
        whoosh(1.4, 500, 5200, 0.22);
        for (let i = 0; i < 6; i++) playTone(1800 + i * 150, t + 0.1 + i * 0.2, 0.05, "square", { filter: 4000, attack: 0.001, release: 0.03, vol: 0.1 });
    } else if (mode === "ice") {
        playNoise(t, 0.5, { type: "bandpass", freq: 3500, q: 2, vol: 0.18, attack: 0.02, release: 0.3 });
        for (let i = 0; i < 8; i++) playTone(2200 + Math.random() * 2200, t + 0.4 + i * 0.11, 0.25, "sine", { attack: 0.002, release: 0.2, vol: 0.18, decay: true, wet: 0.5 });
    } else if (mode === "rainbow") {
        [523, 587, 659, 784, 880, 1047, 1175, 1319].forEach((f, i) => playTone(f, t + i * 0.1, 0.4, "triangle", { attack: 0.004, release: 0.3, vol: 0.22, decay: true, wet: 0.4 }));
    } else if (mode === "stamp") {
        [0.05, 0.3, 0.52, 0.72, 0.9, 1.06].forEach((o, i) => playKick(t + o, 0.5, 150 - i * 6, 60, 0.28));
        playNoise(t, 0.12, { type: "lowpass", freq: 1200, q: 0.8, vol: 0.2, attack: 0.002, release: 0.1 });
    } else if (mode === "glitch") {
        for (let i = 0; i < 12; i++) playNoise(t + i * 0.07 + Math.random() * 0.03, 0.04, { type: "highpass", freq: 3000 + Math.random() * 3000, q: 0.8, vol: 0.2, attack: 0.001, release: 0.03 });
        [440, 880, 330, 990].forEach((f, i) => playTone(f, t + 0.12 + i * 0.16, 0.06, "square", { filter: 3000, attack: 0.001, release: 0.04, vol: 0.1 }));
    } else if (mode === "stardust") {
        for (let i = 0; i < 10; i++) playTone(1500 + Math.random() * 2400, t + 0.05 + i * 0.1, 0.3, "sine", { attack: 0.002, release: 0.22, vol: 0.2, decay: true, wet: 0.5 });
    } else if (mode === "jelly") {
        [330, 392, 349, 370].forEach((f, i) => playTone(f * 1.5, t + 0.05 + i * 0.16, 0.22, "sine", { attack: 0.004, release: 0.18, vol: 0.26, decay: true, wet: 0.3 }));
        playNoise(t, 0.3, { type: "lowpass", freq: 600, q: 0.8, vol: 0.12, attack: 0.02, release: 0.25 });
    } else if (mode === "gacha") {
        for (let i = 0; i < 7; i++) playNoise(t + i * 0.075, 0.04, { type: "bandpass", freq: 1800 + i * 120, q: 1.6, vol: 0.22, attack: 0.001, release: 0.03 }); // ハンドルを回す音
        playKick(t + 0.62, 0.5, 200, 80, 0.25); // コロンと出てくる音
        playTone(880, t + 0.92, 0.1, "triangle", { attack: 0.003, release: 0.07, vol: 0.35, wet: 0.2 }); // ぱかっ
        [1175, 1568, 2093].forEach((f, i) => playBell(f, t + 1.0 + i * 0.08, 0.8, 0.3, 0.4));
    } else if (mode === "warp") {
        whoosh(1.0, 200, 5000, 0.3);
        playTone(220, t, 0.9, "sawtooth", { filter: 1600, attack: 0.05, release: 0.5, vol: 0.12, decay: true, wet: 0.3 });
        [1319, 1760].forEach((f, i) => playBell(f, t + 0.85 + i * 0.1, 0.8, 0.3, 0.4));
    } else if (mode === "deal" || mode === "domino" || mode === "flip") {
        for (let i = 0; i < 9; i++) playNoise(t + i * 0.085, 0.045, { type: "bandpass", freq: 2600 + (i % 3) * 500, q: 1.5, vol: 0.22, attack: 0.001, release: 0.035 });
    } else if (mode === "typhoon" || mode === "hurricane" || mode === "leaf" || mode === "skydive") {
        whoosh(1.1, 300, 1600, 0.3);
    } else {
        playTone(740, t, 0.1, "triangle", { attack: 0.004, release: 0.07, vol: 0.4, wet: 0.2 });
        playTone(1109, t + 0.07, 0.18, "triangle", { attack: 0.004, release: 0.12, vol: 0.35, wet: 0.3 });
    }
}

// ---- 画面フラッシュ

function flashShuffleScreen() {
    const flash = document.createElement("div");
    flash.className = "shuffle-flash";
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 700);
}

// ---- 席の入れ替え演出の共通部品

function getGridCols() {
    const colSel = $id("columnSelect");
    return colSel ? parseInt(colSel.value, 10) || 6 : 6;
}

// 画面には出さずに、席替えの結果だけを先に作る。演出は、この結果に向かって進める。

function computeShuffleFinal() {
    const prev = suppressSeatRender;
    suppressSeatRender = true;
    try { finalizeShuffleResult("none"); } finally { suppressSeatRender = prev; }
    return currentStudents;
}

function isRealStudentSeat(seat) { return !!seat && seat.type === "STUDENT" && !!seat.text; }

// 回転中の見た目用：名前だけを、ランダムに入れ替えた座席表を作る（お休みの席は、そのまま）

function makeSpinFrame(finalSeats, pool, keepCol, cols) {
    const names = pool.slice();
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    let n = 0;
    return finalSeats.map((seat, idx) => {
        if (!isRealStudentSeat(seat) || seat.isAbsent) return seat;
        if (keepCol && keepCol(idx % cols)) return seat;
        return Object.assign({}, seat, { text: names[n++ % names.length], isFixed: false, fixedType: "none", memo: "" });
    });
}

// 回転中（まだ止まっていない列）の座席に、ぼかしの見た目を付ける

function markSlotReels(cols, isLockedCol) {
    document.querySelectorAll("#classroom .seat").forEach((el, i) => {
        if (!isLockedCol(i % cols)) el.classList.add("slot-reel");
    });
}

// スロット：全体が回転 → 左の列から1列ずつ「ガチャン」と止まる

function runSlotAnimation(onDone, finalOverride) {
    const finalSeats = finalOverride || computeShuffleFinal();
    const cols = getGridCols();
    const pool = finalSeats.filter(seat => isRealStudentSeat(seat) && !seat.isAbsent).map(seat => seat.text);
    const classroom = $id("classroom");
    beginShuffleAnim();
    if (classroom) classroom.classList.add("slot-spinning");
    const startAt = performance.now();
    const spinMs = 800;
    const lockGap = Math.max(60, Math.min(320, 1800 / cols));
    const forceLockMs = 3800; // 5秒を超えないように、これを過ぎたら残りの列を一気に止める
    let lockedPrev = 0;
    const finish = () => {
        if (classroom) classroom.classList.remove("slot-spinning");
        playSlotFinishSound();
        endShuffleAnim();
        onDone();
    };
    const step = () => {
        try {
            const elapsed = performance.now() - startAt;
            const locked = elapsed < spinMs ? 0 : (elapsed >= forceLockMs ? cols : Math.min(cols, Math.floor((elapsed - spinMs) / lockGap) + 1));
            const isLockedCol = c => c < locked;
            if (locked >= cols) {
                currentStudents = finalSeats;
                slotLockCols = new Set(Array.from({ length: cols - lockedPrev }, (_, k) => lockedPrev + k));
                renderClassroom("slotlock");
                playSlotLockSound(cols);
                setTimeout(finish, 450);
                return;
            }
            currentStudents = makeSpinFrame(finalSeats, pool, isLockedCol, cols);
            if (locked > lockedPrev) {
                slotLockCols = new Set(Array.from({ length: locked - lockedPrev }, (_, k) => lockedPrev + k));
                renderClassroom("slotlock");
                playSlotLockSound(locked);
                lockedPrev = locked;
            } else {
                renderClassroom("none");
                playSlotTickSound(locked);
            }
            markSlotReels(cols, isLockedCol);
            setTimeout(step, Math.min(160, 70 + locked * 14));
        } catch (error) {
            console.error("スロット演出でエラー:", error);
            currentStudents = finalSeats;
            if (classroom) classroom.classList.remove("slot-spinning");
            renderClassroom("none");
            endShuffleAnim();
            onDone();
        }
    };
    step();
}

// 自分で止めるスロット：列ごとにバラバラの速さで回り続ける。座席表の下の赤いボタンを押した列だけが止まる。
//    この演出だけは、自分で止める時間が必要なので、上限を30秒にしている（ほかの演出は5秒）。
//    押さなくても、30秒以内に終わるよう、時間が来たら残りの列は左から自動で止まる。

function runSlotStopAnimation(onDone, finalOverride) {
    const finalSeats = finalOverride || computeShuffleFinal();
    const cols = getGridCols();
    const pool = finalSeats.filter(seat => isRealStudentSeat(seat) && !seat.isAbsent).map(seat => seat.text);
    const classroom = $id("classroom");
    const AUTO_START_MS = 28000; // これを過ぎたら、残りの列を左から自動で止める（全体で30秒以内に終わる）
    const AUTO_GAP_MS = 90;
    const HOLD_MS = 400;
    const TICK_MS = 90;
    beginShuffleAnim(35000);
    if (classroom) classroom.classList.add("slot-spinning");

    // 回す必要のない列（空席・お休みだけの列）は、最初から止めておく
    const lockedCols = new Set();
    const hasReel = Array.from({ length: cols }, () => false);
    finalSeats.forEach((seat, idx) => { if (isRealStudentSeat(seat) && !seat.isAbsent) hasReel[idx % cols] = true; });
    hasReel.forEach((v, c) => { if (!v) lockedCols.add(c); });

    // 列ごとに「何回に1回だけ絵が変わるか」を変えて、バラバラの速さにする（時々、速さも入れ替わる）
    const randPeriods = () => Array.from({ length: cols }, () => [1, 1, 2, 3][Math.floor(Math.random() * 4)]);
    let periods = randPeriods();
    let frame = null;
    let tick = 0;
    let finished = false;
    let tickTimer = null;
    const startAt = performance.now();

    // ---- ボタンの帯（座席表の外に置く。座席表は何度も描き直されるため）
    const bar = document.createElement("div");
    bar.id = "slotStopBar";
    bar.innerHTML = `<div class="slot-stop-btns"></div><div class="slot-stop-timer"><div class="slot-stop-timer-fill"></div></div><div class="slot-stop-msg"></div>`;
    document.body.appendChild(bar);
    const btnWrap = bar.querySelector(".slot-stop-btns");
    const fill = bar.querySelector(".slot-stop-timer-fill");
    const msg = bar.querySelector(".slot-stop-msg");
    const letterOf = c => String.fromCharCode(65 + (cols - 1 - c)); // 席の列名：Aが一番右
    const btns = [];
    for (let c = 0; c < cols; c++) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "slot-stop-btn";
        b.innerHTML = `<b>${letterOf(c)}</b><small>ストップ</small>`;
        b.setAttribute("aria-label", `${letterOf(c)}列を止める`);
        if (lockedCols.has(c)) { b.disabled = true; b.classList.add("done"); }
        b.addEventListener("pointerdown", e => { e.preventDefault(); e.stopPropagation(); stopColumn(c); });
        b.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); stopColumn(c); } });
        btnWrap.appendChild(b);
        btns.push(b);
    }
    const layoutBar = () => {
        const seats = document.querySelectorAll("#classroom .seat");
        if (!seats.length) return;
        const left = Array(cols).fill(Infinity), right = Array(cols).fill(-Infinity);
        let bottom = -Infinity;
        seats.forEach((el, i) => {
            const r = el.getBoundingClientRect(), c = i % cols;
            left[c] = Math.min(left[c], r.left); right[c] = Math.max(right[c], r.right); bottom = Math.max(bottom, r.bottom);
        });
        const minLeft = Math.min(...left.filter(isFinite)), maxRight = Math.max(...right.filter(isFinite));
        bar.style.left = `${minLeft + window.scrollX}px`;
        bar.style.width = `${maxRight - minLeft}px`;
        bar.style.top = `${bottom + window.scrollY + 10}px`;
        btns.forEach((b, c) => {
            if (!isFinite(left[c])) return;
            b.style.left = `${left[c] - minLeft}px`;
            b.style.width = `${Math.max(24, right[c] - left[c])}px`;
            b.classList.toggle("narrow", right[c] - left[c] < 64);
        });
    };

    // ---- 今の状態を座席表に描く
    const draw = newlyLocked => {
        const isLockedCol = c => lockedCols.has(c);
        const fresh = makeSpinFrame(finalSeats, pool, isLockedCol, cols);
        if (!frame) frame = fresh.slice();
        for (let idx = 0; idx < finalSeats.length; idx++) {
            const c = idx % cols;
            if (isLockedCol(c)) frame[idx] = finalSeats[idx];
            else if (tick % periods[c] === 0) frame[idx] = fresh[idx];
        }
        currentStudents = frame.slice();
        if (newlyLocked && newlyLocked.length) {
            slotLockCols = new Set(newlyLocked);
            renderClassroom("slotlock");
            playSlotLockSound(lockedCols.size);
        } else {
            renderClassroom("none");
            playSlotTickSound(lockedCols.size);
        }
        markSlotReels(cols, isLockedCol);
        layoutBar();
    };

    const cleanup = () => {
        if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
        document.removeEventListener("keydown", onKey, true);
        window.removeEventListener("resize", layoutBar);
        bar.remove();
    };
    slotStopCleanup = cleanup;

    const finish = () => {
        if (classroom) classroom.classList.remove("slot-spinning");
        playSlotFinishSound();
        endShuffleAnim(); // 後片付け（ボタンの帯など）も、ここで行われる
        onDone();
    };
    const allLocked = () => lockedCols.size >= cols;
    const finishSoon = () => {
        if (finished) return;
        finished = true;
        if (tickTimer) { clearTimeout(tickTimer); tickTimer = null; }
        btns.forEach(b => { b.disabled = true; });
        fill.style.transform = "scaleX(0)";
        msg.textContent = "全部の列が止まりました！";
        currentStudents = finalSeats;
        setTimeout(finish, HOLD_MS);
    };
    function stopColumn(c) {
        if (finished || lockedCols.has(c) || c < 0 || c >= cols) return;
        lockedCols.add(c);
        btns[c].disabled = true;
        btns[c].classList.add("done");
        draw([c]);
        if (allLocked()) finishSoon();
    }
    function onKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
        if (e.key.length !== 1 || !/[a-z]/i.test(e.key)) return;
        const c = cols - 1 - (e.key.toUpperCase().charCodeAt(0) - 65);
        if (c < 0 || c >= cols) return;
        e.preventDefault(); e.stopImmediatePropagation();
        stopColumn(c);
    }
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", layoutBar);

    const step = () => {
        try {
            if (finished) return;
            const elapsed = performance.now() - startAt;
            // 時間が来たら、残りの列を左から順に自動で止める
            const newly = [];
            if (elapsed >= AUTO_START_MS) {
                const target = Math.floor((elapsed - AUTO_START_MS) / AUTO_GAP_MS) + 1;
                for (let c = 0; c < cols && newly.length < target; c++) {
                    if (!lockedCols.has(c)) { lockedCols.add(c); newly.push(c); btns[c].disabled = true; btns[c].classList.add("done"); }
                }
            }
            if (tick > 0 && tick % 12 === 0) periods = randPeriods();
            draw(newly);
            const remain = Math.max(0, AUTO_START_MS - elapsed);
            fill.style.transform = `scaleX(${remain / AUTO_START_MS})`;
            msg.textContent = remain > 0
                ? `赤いボタンで、その列だけ止まります。あと${(remain / 1000).toFixed(1)}秒で自動ストップします。`
                : "時間になったので、自動で止めています…";
            tick++;
            if (allLocked()) { finishSoon(); return; }
            tickTimer = setTimeout(step, TICK_MS);
        } catch (error) {
            console.error("自分で止めるスロット演出でエラー:", error);
            finished = true;
            currentStudents = finalSeats;
            if (classroom) classroom.classList.remove("slot-spinning");
            renderClassroom("none");
            endShuffleAnim();
            onDone();
        }
    };
    step();
    try { bar.scrollIntoView({ block: "nearest", behavior: "smooth" }); } catch (e) { /* 何もしない */ }
}

// ドラムロール：だんだん加速して揺れが強くなる → 一瞬の静けさ → ドン！と一斉に決まる

function runDrumrollAnimation(onDone, finalOverride) {
    const finalSeats = finalOverride || computeShuffleFinal();
    const cols = getGridCols();
    const pool = finalSeats.filter(seat => isRealStudentSeat(seat) && !seat.isAbsent).map(seat => seat.text);
    const classroom = $id("classroom");
    const rollMs = 1900, holdMs = 520;
    beginShuffleAnim();
    if (classroom) classroom.classList.add("shuffling-shake");
    playDrumRollSound(rollMs / 1000);
    const startAt = performance.now();
    const reveal = () => {
        if (classroom) classroom.classList.remove("shuffling-shake", "shuffling-shake-hard", "drum-hold");
        currentStudents = finalSeats;
        flashShuffleScreen();
        playDrumImpactSound();
        renderClassroom("impact");
        endShuffleAnim();
        onDone();
    };
    const step = () => {
        try {
            const p = Math.min(1, (performance.now() - startAt) / rollMs);
            if (p >= 1) {
                if (classroom) { classroom.classList.remove("shuffling-shake", "shuffling-shake-hard"); classroom.classList.add("drum-hold"); }
                setTimeout(reveal, holdMs);
                return;
            }
            if (p > 0.6 && classroom) classroom.classList.add("shuffling-shake-hard");
            currentStudents = makeSpinFrame(finalSeats, pool, null, cols);
            renderClassroom("none");
            setTimeout(step, 125 - 80 * Math.pow(p, 1.1));
        } catch (error) {
            console.error("ドラムロール演出でエラー:", error);
            if (classroom) classroom.classList.remove("shuffling-shake", "shuffling-shake-hard", "drum-hold");
            currentStudents = finalSeats;
            renderClassroom("none");
            endShuffleAnim();
            onDone();
        }
    };
    step();
}

// ==========================================
// 1席ずつ止まるスロット：全部の席が回って、座席表の左上から順に、1席ずつ名前が止まります
// 出席番号が7・17・27…の人が、同じ行か同じ列に3人そろうと「ラッキーセブン」で、紙吹雪が出ます（隣り合う2人は「リーチ」）
// ==========================================
function slotSeatNo(text) {
    const m = /^\s*(\d+)\s*[.．]/.exec(text || "");
    return m ? parseInt(m[1], 10) : null;
}
// 出席番号が「7」で終わる人の席と、そろい方を調べる
function slotSevenInfo(finalSeats, cols) {
    const set = new Set(), rows = {}, colsMap = {};
    finalSeats.forEach((seat, i) => {
        if (!isRealStudentSeat(seat) || seat.isAbsent) return;
        const no = slotSeatNo(seat.text);
        if (no === null || no % 10 !== 7) return;
        set.add(i);
        const r = Math.floor(i / cols), c = i % cols;
        rows[r] = (rows[r] || 0) + 1; colsMap[c] = (colsMap[c] || 0) + 1;
    });
    const list = Array.from(set);
    const jackpot = Object.values(rows).some(n => n >= 3) || Object.values(colsMap).some(n => n >= 3);
    let reach = false;
    for (let a = 0; a < list.length && !reach; a++) for (let b = a + 1; b < list.length; b++) {
        if (Math.abs(Math.floor(list[a] / cols) - Math.floor(list[b] / cols)) <= 1 && Math.abs(list[a] % cols - list[b] % cols) <= 1) { reach = true; break; }
    }
    return { set: set, jackpot: jackpot, reach: reach };
}
function slotSeatAddStyle() {
    if ($id("slotSeatStyle")) return;
    const st = document.createElement("style");
    st.id = "slotSeatStyle";
    st.textContent = `
@keyframes slotSeatLock { 0% { transform: scale(1.14); } 100% { transform: scale(1); } }
@keyframes slotSeven { 0%, 100% { box-shadow: 0 0 0 3px rgba(250,204,21,0.95), 0 0 18px rgba(250,204,21,0.9); } 50% { box-shadow: 0 0 0 6px rgba(250,204,21,0.95), 0 0 34px rgba(250,204,21,1); } }
#classroom .seat.slot-seat-lock { animation: slotSeatLock 0.28s cubic-bezier(0.2, 1.6, 0.4, 1) both !important; }
#classroom .seat.slot-seat-seven { animation: slotSeven 0.9s ease-in-out 3 !important; z-index: 2; }
.confetti-layer { position: fixed; inset: 0; z-index: 4800; pointer-events: none; overflow: hidden; }
.confetti-piece { position: absolute; top: -4%; opacity: 0; animation-name: confettiFall; animation-timing-function: linear; animation-fill-mode: forwards; }
@keyframes confettiFall { 0% { opacity: 1; transform: translate3d(0, 0, 0) rotate(0deg); } 85% { opacity: 1; } 100% { opacity: 0; transform: translate3d(var(--cx, 0px), 108vh, 0) rotate(var(--cr, 540deg)); } }
`;
    document.head.appendChild(st);
}
// 紙吹雪：3.5秒ほどで、すべて消えます
function launchConfetti(count) {
    slotSeatAddStyle();
    const layer = document.createElement("div");
    layer.className = "confetti-layer";
    const colors = ["#ef4444", "#f59e0b", "#facc15", "#22c55e", "#3b82f6", "#a855f7", "#ec4899"];
    for (let i = 0; i < count; i++) {
        const p = document.createElement("i");
        p.className = "confetti-piece";
        const w = 6 + Math.random() * 7;
        p.style.cssText = "left:" + (Math.random() * 100).toFixed(1) + "%;width:" + w.toFixed(1) + "px;height:" + (w * (0.5 + Math.random() * 0.9)).toFixed(1) + "px;background:" + colors[i % colors.length] + ";border-radius:" + (Math.random() < 0.3 ? "50%" : "2px") + ";animation-duration:" + (1.8 + Math.random() * 1.6).toFixed(2) + "s;animation-delay:" + (Math.random() * 0.5).toFixed(2) + "s;--cx:" + Math.round(-90 + Math.random() * 180) + "px;--cr:" + Math.round(360 + Math.random() * 720) + "deg;";
        layer.appendChild(p);
    }
    document.body.appendChild(layer);
    setTimeout(() => layer.remove(), 4200);
}
function playSlotJackpotSound() {
    if (!shuffleSoundOn()) return;
    const t = audioCtx.currentTime + 0.05;
    [523, 659, 784, 1047, 1319, 1568, 2093].forEach((f, i) => playBell(f, t + i * 0.08, 1.0, 0.5, 0.4));
}
// 回っている間の見た目用：止まった席は、ほんとうの名前のまま、ほかの席の名前を入れ替える
function makeSpinFrameSeats(finalSeats, pool, lockedSet) {
    const names = pool.slice();
    for (let i = names.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [names[i], names[j]] = [names[j], names[i]]; }
    let n = 0;
    return finalSeats.map((seat, idx) => {
        if (!isRealStudentSeat(seat) || seat.isAbsent) return seat;
        if (lockedSet.has(idx)) return seat;
        return Object.assign({}, seat, { text: names[n++ % names.length], isFixed: false, fixedType: "none", memo: "" });
    });
}
function runSlotSeatAnimation(onDone, finalOverride) {
    const finalSeats = finalOverride || computeShuffleFinal();
    const cols = getGridCols();
    const real = [];
    finalSeats.forEach((seat, i) => { if (isRealStudentSeat(seat) && !seat.isAbsent) real.push(i); });
    const pool = real.map(i => finalSeats[i].text);
    const classroom = $id("classroom");
    const sevens = slotSevenInfo(finalSeats, cols);
    beginShuffleAnim();
    slotSeatAddStyle();
    if (classroom) classroom.classList.add("slot-spinning");
    const startAt = performance.now();
    const spinMs = 700, forceMs = 4200;                                         // 5秒を超えないように、これを過ぎたら残りの席を一気に止める
    const gap = Math.max(30, Math.min(150, 3000 / Math.max(1, real.length)));
    let lockedPrev = 0;
    const finish = () => {
        if (classroom) classroom.classList.remove("slot-spinning");
        if (sevens.jackpot) { playSlotJackpotSound(); launchConfetti(120); showToast("🎰 ラッキーセブン！7がそろいました！", "success"); }
        else if (sevens.reach) { playSlotFinishSound(); launchConfetti(36); showToast("リーチ！7が2つ並びました。", "success"); }
        else playSlotFinishSound();
        endShuffleAnim();
        onDone();
    };
    const step = () => {
        try {
            const elapsed = performance.now() - startAt;
            const locked = elapsed < spinMs ? 0 : (elapsed >= forceMs ? real.length : Math.min(real.length, Math.floor((elapsed - spinMs) / gap) + 1));
            if (locked >= real.length) {
                currentStudents = finalSeats;
                renderClassroom("none");
                const els = document.querySelectorAll("#classroom .seat");
                real.forEach((idx, k) => {
                    const el = els[idx];
                    if (!el) return;
                    if (k >= lockedPrev) el.classList.add("slot-seat-lock");
                    if (sevens.set.has(idx) && (sevens.jackpot || sevens.reach)) el.classList.add("slot-seat-seven");
                });
                playSlotLockSound(8);
                setTimeout(finish, 450);
                return;
            }
            const lockedSet = new Set(real.slice(0, locked));
            currentStudents = makeSpinFrameSeats(finalSeats, pool, lockedSet);
            renderClassroom("none");
            const els = document.querySelectorAll("#classroom .seat");
            real.forEach((idx, k) => {
                const el = els[idx];
                if (!el) return;
                if (k >= locked) el.classList.add("slot-reel");
                else if (k >= lockedPrev) el.classList.add("slot-seat-lock");
            });
            if (locked > lockedPrev) { playSlotLockSound(Math.min(8, Math.floor(locked * 8 / real.length))); lockedPrev = locked; }
            else playSlotTickSound(locked);
            setTimeout(step, 70);
        } catch (error) {
            console.error("1席ずつ止まるスロットでエラー:", error);
            currentStudents = finalSeats;
            if (classroom) classroom.classList.remove("slot-spinning");
            renderClassroom("none");
            endShuffleAnim();
            onDone();
        }
    };
    step();
}

// ==========================================
// 演出の「速さ」「お気に入り」「マイ演出」
// ==========================================

function previewShuffleAnimation(forcedType) {
    if (isAppLocked()) { showLockedToast(); return; }
    if (shuffleAnimating) return;
    if (!currentStudents || !currentStudents.some(isRealStudentSeat)) { showToast("先に席替えをするか、名簿を用意してください。", "error"); return; }
    const sel = $id("animationSelect");
    let type = forcedType || (sel ? sel.value : "initial");
    if (type === "none" || document.body.classList.contains("no-animation")) { showToast("演出なしか、全体アニメーションがOFFになっています。", "error"); return; }
    if (type === "random") type = pickRandomShuffleAnimation();
    const base = currentStudents;
    if (type === "slot") { runSlotAnimation(() => {}, base); return; }
    if (type === "slotstop") { runSlotStopAnimation(() => {}, base); return; }
    if (type === "slotseat") { runSlotSeatAnimation(() => {}, base); return; }
    if (type === "drumroll") { runDrumrollAnimation(() => {}, base); return; }
    if (type === "glide") {
        // 席順は変えないので、いったん名前をばらして、元の席へ滑って戻す
        const finalSeats = base;
        const pool = finalSeats.filter(seat => isRealStudentSeat(seat) && !seat.isAbsent).map(seat => seat.text);
        currentStudents = makeSpinFrame(finalSeats, pool, null, getGridCols());
        renderClassroom("none");
        setTimeout(() => { currentStudents = finalSeats; renderClassroom("glide"); playShuffleAnimationSound("glide"); }, 450);
        return;
    }
    renderClassroom(type);
    playShuffleAnimationSound(type);
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "shuffle-anim",
    name: "席替えの演出",
    version: "1.1",
    required: true,
    description: "スロット、ドラムロールなどの演出と、その効果音です。",
    mount(app) {
        // 演出の一覧に、「1席ずつ止まるスロット」を足します
        const group = document.querySelector('#animationSelect optgroup[data-scope="basic"]');
        if (group && !group.querySelector('option[value="slotseat"]')) group.insertAdjacentHTML("beforeend", '<option value="slotseat">🎰 38. 1席ずつ止まるスロット</option>');
        app.insertInto("guide-faq", "<li><strong>1席ずつ止まるスロットで、紙吹雪を出したい</strong>：席替えの演出で「1席ずつ止まるスロット」を選びます。座席表の左上から、1席ずつ名前が止まります。出席番号が7・17・27…の人が、同じ行か同じ列に3人そろうと、「ラッキーセブン」で紙吹雪が出ます。隣り合う2人は「リーチ」で、小さな紙吹雪です。</li>");
    }
});
