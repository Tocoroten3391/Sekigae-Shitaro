// ==========================================
// 音の土台プラグイン（必須）：アラームや効果音の元になる、音を鳴らすしくみです。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
function updateVolumeUI() {
    const slider = $id('alarmVolumeSlider');
    const text = $id('volumeValueText');
    if (!slider || !text) return;
    
    alarmVolume = parseFloat(slider.value);
    text.textContent = Math.round(alarmVolume * 100) + '%';
    
    const percent = ((alarmVolume - parseFloat(slider.min)) / (parseFloat(slider.max) - parseFloat(slider.min))) * 100;
    slider.style.setProperty('--val', percent + '%');
}

function initAudio() {
    if (!audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
            audioCtx = new AudioContext();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// 全ての音をまとめる出力経路。音量が大きい時や音が重なった時の割れ（クリップ）をコンプレッサーで抑え、
// 響き（リバーブ）用の経路も用意する。

let audioBus = null;

let audioBusCtx = null;

function makeReverbImpulse(ctx, seconds = 1.8, decay = 2.6) {
    const rate = ctx.sampleRate;
    const length = Math.floor(rate * seconds);
    const buf = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
        }
    }
    return buf;
}

function getAudioBus() {
    if (!audioCtx) return null;
    if (audioBus && audioBusCtx === audioCtx) return audioBus;
    const comp = audioCtx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 20;
    comp.ratio.value = 10;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    const master = audioCtx.createGain();
    master.gain.value = 0.85;
    comp.connect(master);
    master.connect(audioCtx.destination);

    const dry = audioCtx.createGain();
    dry.connect(comp);

    const wet = audioCtx.createGain();
    const conv = audioCtx.createConvolver();
    conv.buffer = makeReverbImpulse(audioCtx);
    wet.connect(conv);
    conv.connect(comp);

    audioBus = { dry: dry, wet: wet };
    audioBusCtx = audioCtx;
    return audioBus;
}

// 1つの音を鳴らす。クリック音が出ないよう、立ち上がりと余韻をなめらかにしている。
// opts: attack(立ち上がり秒) / release(消える秒) / decay(true: 叩いた直後から自然に減衰) /
//       vol(音量倍率) / filter(ローパス周波数) / detune(セント。少しずらした音を重ねて厚みを出す) /
//       harm(1オクターブ上の倍音の強さ) / wet(響きの量 0〜1)

function playTone(freq, startTime, duration, type = "sine", opts = {}) {
    if (!audioCtx) return;
    const bus = getAudioBus();
    if (!bus) return;

    const vol = alarmVolume * (opts.vol !== undefined ? opts.vol : 1);
    if (vol <= 0) return;
    const attack = Math.min(opts.attack !== undefined ? opts.attack : 0.012, duration / 3);
    const release = Math.min(opts.release !== undefined ? opts.release : 0.06, duration / 2);
    const endTime = startTime + duration;

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.linearRampToValueAtTime(vol, startTime + attack);
    if (opts.decay) {
        gain.gain.exponentialRampToValueAtTime(0.0001, endTime);
    } else {
        gain.gain.setValueAtTime(vol, Math.max(startTime + attack, endTime - release));
        gain.gain.linearRampToValueAtTime(0.0001, endTime);
    }

    let node = gain;
    if (opts.filter) {
        const lp = audioCtx.createBiquadFilter();
        lp.type = "lowpass";
        lp.frequency.value = opts.filter;
        lp.Q.value = 0.7;
        lp.connect(gain);
        node = lp;
    }
    gain.connect(bus.dry);
    if (opts.wet) {
        const send = audioCtx.createGain();
        send.gain.value = opts.wet;
        gain.connect(send);
        send.connect(bus.wet);
    }

    const addOsc = (f, t, level, cents) => {
        const osc = audioCtx.createOscillator();
        osc.type = t;
        osc.frequency.value = f;
        if (cents) osc.detune.value = cents;
        if (level === 1) {
            osc.connect(node);
        } else {
            const g = audioCtx.createGain();
            g.gain.value = level;
            osc.connect(g);
            g.connect(node);
        }
        osc.start(startTime);
        osc.stop(endTime + 0.03);
    };
    const main = opts.detune ? 0.6 : 1;
    addOsc(freq, type, main, 0);
    if (opts.detune) addOsc(freq, type, main, opts.detune);
    if (opts.harm) addOsc(freq * 2, "sine", opts.harm, 0);
}

// ベルや鐘の音。基本の音に、鐘らしい倍音（整数倍ではない音）を重ね、それぞれ違う速さで減衰させる。

function playBell(freq, startTime, ringTime = 2.0, vol = 1, wet = 0.55) {
    const partials = [
        { ratio: 1.0,  amp: 1.0,  life: 1.0 },
        { ratio: 2.0,  amp: 0.45, life: 0.75 },
        { ratio: 2.76, amp: 0.3,  life: 0.55 },
        { ratio: 4.07, amp: 0.16, life: 0.4 },
        { ratio: 5.4,  amp: 0.1,  life: 0.28 }
    ];
    partials.forEach(pt => {
        playTone(freq * pt.ratio, startTime, ringTime * pt.life, "sine", { attack: 0.004, decay: true, vol: vol * pt.amp * 0.55, wet: wet });
    });
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "sound",
    name: "音の土台",
    version: "1.0",
    required: true,
    description: "アラームや効果音の元になる、音を鳴らすしくみです。"
});
