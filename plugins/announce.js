// ==========================================
// 席替え発表モードプラグイン：電子黒板で、1人ずつ席を発表していきます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="announce" で結びついていて、自動で隠れます）
// ==========================================
let announceState = { open: false, snapshot: [], cols: 6, order: [], cursor: 0, lucky: -1 };
function isAnnounceOpen() { return announceState.open; }
function openAnnounce() {
    if (!currentStudents || !currentStudents.some(seat => seat && seat.type === "STUDENT" && seat.text)) {
        showToast("座席表が空です", "error");
        return;
    }
    const colSel = $id("columnSelect");
    announceState.cols = colSel ? parseInt(colSel.value, 10) || 6 : 6;
    announceState.snapshot = JSON.parse(JSON.stringify(currentStudents));
    const orderSel = $id("announceOrder"), soundTog = $id("announceSound");
    try {
        const savedOrder = localStorage.getItem("announce_order");
        if (orderSel && savedOrder && Array.from(orderSel.options).some(o => o.value === savedOrder)) orderSel.value = savedOrder;
        if (soundTog) soundTog.checked = localStorage.getItem("announce_sound") !== "false";
        const styleSel = $id("announceStyle"), savedStyle = localStorage.getItem("announce_style");
        if (styleSel && savedStyle && Array.from(styleSel.options).some(o => o.value === savedStyle)) styleSel.value = savedStyle;
    } catch (error) { /* 保存済みの設定が読めなくても、そのまま続ける */ }
    announceState.open = true;
    const overlay = $id("announceOverlay");
    if (overlay) overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    buildAnnounceOrder();
    renderAnnounce();
}
function closeAnnounce(event) {
    if (event) event.stopPropagation();
    announceState.open = false;
    const overlay = $id("announceOverlay");
    if (overlay) overlay.style.display = "none";
    document.body.style.overflow = "";
    if (document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen(); } catch (error) { /* 何もしない */ } }
}
function buildAnnounceOrder() {
    const cols = announceState.cols;
    const orderSel = $id("announceOrder");
    const mode = orderSel ? orderSel.value : "front";
    const idxs = [];
    announceState.snapshot.forEach((seat, idx) => {
        if (seat && seat.type === "STUDENT" && seat.text && !seat.isAbsent) idxs.push(idx);
    });
    if (mode === "random") {
        for (let i = idxs.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [idxs[i], idxs[j]] = [idxs[j], idxs[i]]; }
    } else if (mode === "number") {
        const noOf = idx => { const p = getSeatDisplayParts(announceState.snapshot[idx].text); return p.no ? parseInt(p.no, 10) : 99999 + idx; };
        idxs.sort((a, b) => noOf(a) - noOf(b));
    } else if (mode === "back") {
        idxs.sort((a, b) => (Math.floor(b / cols) - Math.floor(a / cols)) || ((a % cols) - (b % cols)));
    } else {
        idxs.sort((a, b) => a - b);
    }
    announceState.order = idxs;
    announceState.cursor = 0;
    announceState.lucky = -1;
}
function announceRestart() {
    const orderSel = $id("announceOrder"), soundTog = $id("announceSound");
    try {
        if (orderSel) localStorage.setItem("announce_order", orderSel.value);
        if (soundTog) localStorage.setItem("announce_sound", String(soundTog.checked));
        const styleSel = $id("announceStyle");
        if (styleSel) localStorage.setItem("announce_style", styleSel.value);
    } catch (error) { /* 何もしない */ }
    if (orderSel) orderSel.blur();
    const styleBlur = $id("announceStyle");
    if (styleBlur) styleBlur.blur();
    buildAnnounceOrder();
    renderAnnounce();
}
function playAnnounceSound(isFinish) {
    const soundTog = $id("announceSound");
    if (!soundTog || !soundTog.checked || isSilentTestMode) return;
    try {
        initAudio();
        if (!audioCtx) return;
        const now = audioCtx.currentTime + 0.02;
        if (isFinish) {
            playBell(1046.5, now, 1.4, 0.9, 0.4);
            playBell(1318.5, now + 0.18, 1.4, 0.7, 0.4);
            playBell(1568, now + 0.36, 1.8, 0.7, 0.4);
        } else {
            playTone(880, now, 0.12, "triangle", { attack: 0.004, release: 0.08, vol: 0.55, wet: 0.2 });
            playTone(1318.5, now + 0.09, 0.2, "triangle", { attack: 0.004, release: 0.14, vol: 0.5, wet: 0.25 });
        }
    } catch (error) { /* 音が鳴らなくても、発表は続ける */ }
}
function announceNext(event) {
    if (event) event.stopPropagation();
    if (!announceState.open) return;
    if (announceState.cursor >= announceState.order.length) return;
    announceState.cursor++;
    playAnnounceSound(announceState.cursor >= announceState.order.length);
    renderAnnounce();
}
function announcePrev(event) {
    if (event) event.stopPropagation();
    if (!announceState.open || announceState.cursor <= 0) return;
    announceState.cursor--;
    announceState.lucky = -1;
    renderAnnounce();
}
function announceRevealAll(event) {
    if (event) event.stopPropagation();
    if (!announceState.open) return;
    announceState.cursor = announceState.order.length;
    renderAnnounce();
}
function announceReset(event) {
    if (event) event.stopPropagation();
    if (!announceState.open) return;
    buildAnnounceOrder();
    renderAnnounce();
}
function toggleAnnounceFullscreen(event) {
    if (event) event.stopPropagation();
    const overlay = $id("announceOverlay");
    if (!overlay) return;
    try {
        if (document.fullscreenElement) document.exitFullscreen();
        else if (overlay.requestFullscreen) overlay.requestFullscreen();
    } catch (error) { showToast("全画面にできませんでした", "error"); }
}
function capNameHtml(text, p) {
    const furi = getFuriganaFor(text);
    const name = escapeStatsHtml(p.name || p.no);
    return furi ? `<ruby>${name}<rt>${escapeStatsHtml(furi)}</rt></ruby>` : name;
}

// 天気予報風の発表：席の位置から、天気とひとこと予報を決める
const ANNOUNCE_WX = {
    front: [
        { e: "☀️", t: "前の席は快晴です。黒板がくっきり見えるでしょう" },
        { e: "🌞", t: "日ざしが強く、先生の視線がよく届く予報です" },
        { e: "⚡", t: "ところにより、先生の指名が落ちるおそれがあります" }
    ],
    middle: [
        { e: "🌤️", t: "おだやかな晴れ間が広がるでしょう" },
        { e: "⛅", t: "くもり時々ノート、板書が増える見込みです" },
        { e: "🍃", t: "そよ風が吹き、集中しやすい一日になりそうです" }
    ],
    back: [
        { e: "🌈", t: "後ろの席は虹がかかる予報です。見晴らしは抜群です" },
        { e: "🔭", t: "遠くまで見わたせる、見晴らし良好の席です" },
        { e: "🌙", t: "夜のように静かでおだやかな席です" }
    ]
};
function announceHash(idx) { return (idx * 7919 + 131) % 9973; }
function isAnnounceWeather() {
    const sel = $id("announceStyle");
    return !!sel && sel.value === "weather";
}
function announceWxInfo(idx) {
    const { snapshot, cols } = announceState;
    const rows = Math.max(1, Math.ceil(snapshot.length / cols));
    const row = Math.floor(idx / cols), col = idx % cols;
    const zone = Math.min(2, Math.floor(row * 3 / rows));
    const list = ANNOUNCE_WX[["front", "middle", "back"][zone]];
    const h = announceHash(idx);
    const base = list[h % list.length];
    let extra = "";
    if (col === 0 || col === cols - 1) extra = "かべ際で風通しがよいでしょう。";
    else if (cols >= 5 && Math.abs(col - (cols - 1) / 2) <= 0.5) extra = "教室の中心でまわりの人とよく話せそうです。";
    return { emoji: base.e, text: base.t, extra, pct: (h % 9 + 1) * 10 };
}

// 今日のラッキー席：発表が終わったあとに、1席だけ選んで発表する
const LUCKY_ITEMS = ["赤いペン", "青いハンカチ", "けしゴム", "水筒", "えんぴつ", "みどり色の付せん", "じょうぎ", "ノート", "ハンカチ", "まる付け用の色えんぴつ"];
const LUCKY_ADVICE = ["今日は元気に手をあげると、いいことがありそうです", "となりの人にあいさつすると、運気が上がります", "姿勢をよくすると集中力が上がります", "最初の授業でノートをていねいに書くと、一日うまくいきます", "休み時間にふだん話さない人に話しかけてみましょう"];
function announceLucky(event) {
    if (event) event.stopPropagation();
    if (!announceState.open) return;
    const { order, cursor } = announceState;
    if (order.length === 0 || cursor < order.length) return;
    announceState.lucky = order[Math.floor(Math.random() * order.length)];
    playAnnounceSound(true);
    renderAnnounce();
}
function announceLuckyInfo(idx) {
    const h = announceHash(idx);
    return { item: LUCKY_ITEMS[h % LUCKY_ITEMS.length], advice: LUCKY_ADVICE[(h >> 3) % LUCKY_ADVICE.length] };
}
function renderAnnounce() {
    const { snapshot, cols, order, cursor } = announceState;
    const grid = $id("announceGrid");
    if (!grid) return;
    const revealedSet = new Set(order.slice(0, cursor));
    const currentIdx = cursor > 0 ? order[cursor - 1] : -1;
    const colorOn = $id("groupColorToggle") ? $id("groupColorToggle").checked : false;
    const weatherOn = isAnnounceWeather();
    const announceShowGroup = colorOn && lsGet("group_mark_on", "0") === "1" && getGroupMarkScope() !== "seat";

    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    grid.style.setProperty("--an-fs", `${(84 / (cols * 4.4)).toFixed(2)}vw`);
    grid.style.gridTemplateRows = `repeat(${Math.max(1, Math.ceil(snapshot.length / cols))}, minmax(0, 1fr))`;

    grid.innerHTML = snapshot.map((seat, idx) => {
        const label = getSeatLabel(idx, cols);
        if (!seat || seat.type !== "STUDENT" || !seat.text) {
            return `<div class="an-cell is-empty"><span class="an-label">${label}</span></div>`;
        }
        const p = getSeatDisplayParts(seat.text);
        const nameText = p.name || p.no;
        if (seat.isAbsent) {
            return `<div class="an-cell is-absent"><span class="an-label">${label}</span><span class="an-name">${escapeStatsHtml(nameText)}</span><span class="an-absent-tag">お休み</span></div>`;
        }
        if (!revealedSet.has(idx)) {
            return `<div class="an-cell is-hidden"><span class="an-label">${label}</span><span class="an-q">？</span></div>`;
        }
        const len = Array.from(nameText).length;
        const sizeCls = len > 6 ? " is-xlong" : (len > 4 ? " is-long" : "");
        let gAttr = "", gCls = "";
        if (announceShowGroup) {
            const gn = getShownGroupNoForIndex(idx, cols);
            if (gn > 0) { gCls = ` group-${gn}`; gAttr = ` data-group-no="${gn}"`; }
        }
        const furi = getFuriganaFor(seat.text);
        const wxMark = weatherOn ? `<span class="an-wx">${announceWxInfo(idx).emoji}</span>` : "";
        const luckyMark = idx === announceState.lucky ? `<span class="an-lucky-mark">🍀</span>` : "";
        return `<div class="an-cell is-revealed${idx === currentIdx ? " is-current" : ""}${idx === announceState.lucky ? " is-lucky" : ""}${sizeCls}${gCls}"${gAttr}><span class="an-label">${label}</span>${p.no ? `<span class="an-no">${escapeStatsHtml(p.no)}番</span>` : ""}${furi ? `<span class="an-furi">${escapeStatsHtml(furi)}</span>` : ""}<span class="an-name">${escapeStatsHtml(nameText)}</span>${wxMark}${luckyMark}</div>`;
    }).join("");

    const cap = $id("announceCaption");
    if (cap) {
        const luckyIdx = announceState.lucky;
        if (order.length === 0) cap.innerHTML = `<span class="an-cap-sub">発表する人がいません</span>`;
        else if (luckyIdx >= 0 && snapshot[luckyIdx]) {
            const p = getSeatDisplayParts(snapshot[luckyIdx].text);
            const info = announceLuckyInfo(luckyIdx);
            cap.innerHTML = `<span class="an-cap-sub an-cap-lucky">🍀 今日のラッキー席は <strong>${getSeatLabel(luckyIdx, cols)}</strong> です！</span><span class="an-cap-name">${capNameHtml(snapshot[luckyIdx].text, p)}</span><span class="an-cap-sub">さん、<strong>大吉</strong>です！</span><span class="an-cap-wx">ラッキーアイテムは「${escapeStatsHtml(info.item)}」。${escapeStatsHtml(info.advice)}。</span>`;
        } else if (cursor === 0) {
            cap.innerHTML = weatherOn
                ? `<span class="an-cap-sub">☁️ 席替え天気予報、まもなく始まります。「発表スタート」を押してください</span>`
                : `<span class="an-cap-sub">「発表スタート」を押すか、スペースキーで席の発表が始まります</span>`;
        } else {
            const p = getSeatDisplayParts(snapshot[currentIdx].text);
            const done = cursor >= order.length;
            let html = `<span class="an-cap-name">${capNameHtml(snapshot[currentIdx].text, p)}</span><span class="an-cap-sub">さんは <strong>${getSeatLabel(currentIdx, cols)}</strong> の席です${done && !weatherOn ? "。　全員の発表が終わりました！" : ""}</span>`;
            if (weatherOn) {
                const w = announceWxInfo(currentIdx);
                html += `<span class="an-cap-wx">${w.emoji} ${escapeStatsHtml(w.text)}。${escapeStatsHtml(w.extra)}おしゃべり注意報は ${w.pct}% です。${done ? "　以上、席替え予報でした。" : ""}</span>`;
            }
            cap.innerHTML = html;
        }
    }
    const luckyBtn = $id("announceLuckyBtn");
    if (luckyBtn) luckyBtn.disabled = order.length === 0 || cursor < order.length;
    const prog = $id("announceProgress");
    if (prog) prog.textContent = `${Math.min(cursor, order.length)} / ${order.length}`;
    const nextBtn = $id("announceNextBtn");
    if (nextBtn) {
        const done = cursor >= order.length;
        nextBtn.disabled = done;
        nextBtn.textContent = order.length === 0 ? "発表する人がいません" : (done ? "発表おわり" : (cursor === 0 ? "▶️ 発表スタート" : "▶️ 次の人"));
    }
    const prevBtn = $id("announcePrevBtn");
    if (prevBtn) prevBtn.disabled = cursor <= 0;
    fitAnnounceText();
}

// 名前がマスや画面に収まりきらないとき、文字の大きさを自動で小さくし、必要なら2〜3行に折り返して、全文が見えるようにする
function fitAnnounceText() {
    const grid = $id("announceGrid");
    if (grid) {
        grid.querySelectorAll(".an-cell").forEach(cell => {
            const nameEl = cell.querySelector(".an-name");
            if (!nameEl) return;
            const cw = cell.clientWidth, ch = cell.clientHeight;
            if (!cw || !ch) return;
            const noEl = cell.querySelector(".an-no"), furiEl = cell.querySelector(".an-furi");
            const isAbsent = cell.classList.contains("is-absent");
            cell.classList.toggle("is-compact", cw < 92 || ch < 72);
            const maxW = cw * 0.92;
            // いちど大きめ（100px）にして、名前・ふりがなが1行でどれだけ幅を取るかを測る
            nameEl.style.whiteSpace = "nowrap"; nameEl.style.wordBreak = "normal";
            cell.style.setProperty("--an-f", "100px");
            const w100 = Math.max(1, nameEl.scrollWidth);
            const wf100 = furiEl ? Math.max(1, furiEl.scrollWidth) : 0; // ふりがなは0.4倍で表示するので、100pxの名前の横で40px相当
            const extra = (noEl ? 0.55 : 0) + (furiEl ? 0.45 : 0) + (isAbsent ? 0.5 : 0);
            let best = { f: 0, n: 1 };
            const maxLines = Array.from(nameEl.textContent).length <= 5 ? 1 : 3; // 短い名前は途中で折り返さない
            for (let n = 1; n <= maxLines; n++) {
                let f = Math.min(maxW * n / w100 * 100 * (n > 1 ? 0.9 : 1), (ch * 0.84) / (1.15 * n + extra), cw * 0.34 * (isAbsent ? 0.7 : 1));
                if (f > best.f * 1.08 || best.f === 0) best = { f, n }; // 行を増やすのは、はっきり大きくなる時だけ
            }
            const f = Math.max(6, best.f);
            cell.style.setProperty("--an-f", `${f.toFixed(1)}px`);
            if (best.n > 1) { nameEl.style.whiteSpace = "normal"; nameEl.style.wordBreak = "break-all"; nameEl.style.textAlign = "center"; nameEl.style.overflow = "visible"; }
            else { nameEl.style.whiteSpace = "nowrap"; nameEl.style.wordBreak = "normal"; nameEl.style.overflow = "hidden"; }
            if (furiEl) {
                const ff = Math.max(5, Math.min(f * 0.4, maxW / wf100 * 40));
                furiEl.style.fontSize = `${ff.toFixed(1)}px`;
            }
        });
    }
    const cap = $id("announceCaption");
    const capName = cap ? cap.querySelector(".an-cap-name") : null;
    if (capName) {
        capName.style.fontSize = "";
        const avail = cap.clientWidth * 0.96;
        const w = capName.scrollWidth;
        if (w > avail) {
            const cur = parseFloat(getComputedStyle(capName).fontSize) || 40;
            capName.style.fontSize = `${Math.max(14, cur * avail / w * 0.97).toFixed(1)}px`;
        }
    }
}
window.addEventListener("resize", () => { if (announceState.open) fitAnnounceText(); });
document.addEventListener("fullscreenchange", () => { if (announceState.open) setTimeout(fitAnnounceText, 120); });
document.addEventListener("keydown", function(event) {
    if (!announceState.open) return;
    const tag = document.activeElement ? document.activeElement.tagName : "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (event.code === "Space" || event.key === " " || event.key === "Enter" || event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault();
        announceNext();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "Backspace") {
        event.preventDefault();
        announcePrev();
    } else if (event.key === "Escape") {
        event.preventDefault();
        closeAnnounce();
    }
});

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "announce",
    suggests: ["furigana"],   // あわせて使うと便利なプラグイン
    name: "席替え発表モード",
    version: "1.1",
    description: "電子黒板で、1人ずつ席を発表していきます。",
    stubs: ["closeAnnounce", "isAnnounceOpen", "openAnnounce"]
});
