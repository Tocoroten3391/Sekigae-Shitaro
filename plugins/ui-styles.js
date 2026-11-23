// ==========================================
// 画面スタイルプラグイン：画面全体の見た目を、「シンプル」「黒板」から選べます。
// 設定の「画面スタイル」で切り替えます。席替えや指名のしくみは変わらず、見た目だけが変わります
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります（見た目は、このプラグインを入れる前の元の画面に戻ります）
// ==========================================
const UIS_KEY = "ui_style";
const UIS_CHOICES = [
    { v: "a", label: "シンプル（白とブルーの、落ち着いた画面）" },
    { v: "b", label: "黒板（黒板と机の、教室らしい画面）" }
];
const UIS_NOTES = {
    a: "上の帯と操作ボタンを整えて、左にツールバーを置きます。指名中の画面も、このスタイルになります。設定は、左に分類、右に内容の2列で開きます。色は、選んでいるテーマ（ダークなど）に合わせます。",
    b: "画面の上を黒板、ボタンをチョーク受け、座席を机の見た目にして、左にツールバーを置きます。指名中の画面も、このスタイルになります。設定は、左に分類、右に内容の2列で開きます。色は、このスタイルの色に固定されます。"
};

// 色の用意（A）：テーマの色が、そのまま使えるように、style.css より前に置きます
const UIS_CSS_PALETTE = `
body.ui-style-a { --body-bg: #F3F5F8; --card-bg: #FFFFFF; --text-main: #0F172A; --text-sub: #475569; --accent-color: #2457D6; --seat-border: #D5DAE3; }`;

// 電卓・音楽・タイマーを、「シンプル」と「黒板」の色づかいにそろえます（どの画面の幅でも）
function uisToolsCss() {
    const T = {
        a: {
            S: "body.ui-style-a",
            surf: "var(--card-bg)", text: "var(--text-main)", border: "1px solid var(--uis-line2)", shadow: "0 14px 36px rgba(15,23,42,0.22)", radius: "16px",
            screen: "var(--uis-soft)", screenText: "var(--text-main)", sub: "var(--uis-mute)",
            key: "var(--card-bg)", keyText: "var(--text-main)", keyBd: "1px solid var(--uis-line2)",
            fn: "var(--uis-soft2)", op: "var(--uis-tint)", opText: "var(--uis-ink)", eq: "var(--accent-color)", eqText: "var(--uis-on-accent)",
            soft: "var(--uis-soft)", soft2: "var(--uis-soft2)", spec: "var(--uis-tint)", specText: "var(--uis-ink)",
            acc: "var(--accent-color)", accText: "var(--uis-on-accent)", line: "var(--uis-line2)", err: "#DC2626", focus: "var(--accent-color)",
            del: "color-mix(in srgb, #DC2626 14%, var(--card-bg))", delText: "color-mix(in srgb, #B91C1C 45%, var(--text-main))"
        },
        b: {
            S: "body.ui-style-b.ui-style-b",
            surf: "#FBF4E2", text: "#2B2118", border: "2px solid #C9A978", shadow: "0 14px 30px rgba(0,0,0,0.38)", radius: "8px",
            screen: "#2F4A3E", screenText: "#F6F3E8", sub: "#D8E2D4",
            key: "#F3EAD2", keyText: "#2B2118", keyBd: "1px solid #C9A978",
            fn: "#E8DBBA", op: "#C9A978", opText: "#2B2118", eq: "#2F4A3E", eqText: "#F6F3E8",
            soft: "#EFE3C6", soft2: "#E8DBBA", spec: "#E8DBBA", specText: "#2B2118",
            acc: "#2F4A3E", accText: "#F6F3E8", line: "#C9A978", err: "#FFB4A6", focus: "#B8863A",
            del: "#F1D2C8", delText: "#7A2E1E"
        }
    };
    let c = "";
    ["a", "b"].forEach(k => {
        const t = T[k], S = t.S, P = S + " #calcPanel";
        const sub = t.sub;
        const lab = k === "a" ? "var(--text-sub)" : "#6B5A3E";
        c += `
${P} { background: ${t.surf}; color: ${t.text}; border: ${t.border}; border-radius: ${t.radius}; box-shadow: ${t.shadow}; }
${P} button { background: ${t.key}; color: ${t.keyText}; border: ${t.keyBd}; box-sizing: border-box; }
${P} button:active { background: ${t.soft2}; }
${P} button:focus-visible { outline: 3px solid ${t.focus}; }
${P} .calc-grip { color: ${t.line}; }
${P} .calc-modes button, ${P} .calc-mini, ${P} .calc-memrow .calc-mem, ${P} .calc-toolrow .calc-tool, ${P} .calc-hist-clear, ${P} .cg-back, ${P} .calc-sci button, ${P} .cv-val, ${P} .ph-fn { background: ${t.soft}; color: ${t.keyText}; }
${P} .calc-modes button.is-on, ${P} .cv-val.is-on, ${P} .calc-toolrow .calc-menubtn.is-on, ${P} .ph-key.is-down { background: ${t.acc}; color: ${t.accText}; border-color: ${t.acc}; box-shadow: none; }
${P} .calc-screen, ${P} .calc-hist, ${P} .cg-title, ${P} .cg-table { background: ${t.screen}; color: ${t.screenText}; }
${P} .calc-expr, ${P} .calc-sub, ${P} .cg-y, ${P} .cg-read, ${P} .cg-table .cg-none, ${P} .calc-hist-empty, ${P} .calc-hist-item span, ${P} .calc-sol-item i, ${P} .calc-sol-item em, ${P} .ph-key small { color: ${k === "a" ? t.sub : (t.sub)}; }
${P} .calc-screen .cf, ${P} .calc-screen .cf-w, ${P} .calc-screen .cf-f, ${P} .cg-title .cf { color: inherit; }
${P} .cf-bar { border-top-color: currentColor; }
${P} .cf-n.cf-empty, ${P} .cf-d.cf-empty { border-color: ${sub}; }
${P} .cf-n.cf-on, ${P} .cf-d.cf-on { border-color: ${k === "a" ? t.acc : "#F6C86A"}; background: rgba(127,127,127,0.18); }
${P} .calc-result.is-err { color: ${t.err}; }
${P} .calc-memmark { color: ${k === "a" ? "var(--uis-ink)" : "#B8863A"}; }
${P} .calc-main .ck-fn { background: ${t.fn}; color: ${t.keyText}; }
${P} .calc-main .ck-op { background: ${t.op}; color: ${t.opText}; border-color: transparent; }
${P} .calc-main .ck-eq { background: ${t.eq}; color: ${t.eqText}; border-color: transparent; }
${P} .calc-sci .ck-unit, ${P} .calc-fracrow .calc-frac, ${P} .calc-fracrow .calc-view, ${P} .calc-toolrow .calc-menubtn, ${P} .ph-wide, ${P} .calc-algrow .calc-alg, ${P} .cv-key { background: ${t.spec}; color: ${t.specText}; border-color: transparent; }
${P} .cv-del { background: ${t.del}; color: ${t.delText}; border-color: transparent; }
${P} .ph-back { background: ${t.surf}; color: ${t.text}; border: ${t.keyBd}; }
${P} .calc-hist-item:hover, ${P} .calc-sol-item:hover { background: ${t.soft2} !important; }
${P} .calc-sol-item { background: ${t.soft} !important; color: ${t.text}; }
${P} .calc-menu { background: ${t.surf}; border: ${t.border}; box-shadow: ${t.shadow}; }
${P} .cg-range input { background: ${t.surf}; color: ${t.text}; border: 1px solid ${t.line}; }
${P} .cg-range input:focus { outline-color: ${t.focus}; }
${P} .cg-msg { color: ${k === "a" ? "#B45309" : "#8A5A12"}; }
${P} .cg-table th { background: ${t.soft2}; color: ${t.text}; }
${P} .cg-table td { border-top-color: ${t.line}; }
${S} #musicPanel { border: ${t.border}; border-radius: ${t.radius}; box-shadow: ${t.shadow}; backdrop-filter: none; }
${S} #musicPanel .music-cover, ${S} #musicPanel .music-edit-cover, ${S} #musicPanel .music-cand-img { background: ${t.acc}; color: ${t.accText}; }
${S} #musicPanel .music-chip.is-sel { background: ${t.acc}; border-color: ${t.acc}; color: ${t.accText}; }
${S} #musicPanel .music-pad { background: ${t.spec}; color: ${t.specText}; border-color: ${t.line}; }
${S} #musicPlayerBtn.is-playing { background-color: ${t.acc}; }
${S} #musicPanel .music-head b { font-weight: 800; }
${S} #musicPanel input[type="range"] { background: linear-gradient(to right, ${k === "a" ? "var(--accent-color)" : "#2F4A3E"} var(--val, 0%), ${k === "a" ? "var(--uis-line2, #CBD2DC)" : "#E0D2AE"} var(--val, 0%)) !important; box-shadow: none; }
${S} #musicPanel .music-x { color: ${lab}; }
${S} #musicPanel .music-x:hover { background: ${t.soft2}; }
${S} #musicPanel button:not(.music-chip):not(.music-x):not(.music-play):not(.music-cover) { border-color: ${t.line}; }
${S} #timerPanel { background: ${t.surf}; color: ${t.text}; border: ${t.border}; border-radius: ${t.radius}; box-shadow: ${t.shadow}; backdrop-filter: none; }
${S} #timerPanel #timerDisplay { color: ${t.text}; font-weight: 700; }
${S} #timerPanel button { text-align: center; justify-content: center; }
${S} #timerPanel button { background: ${t.soft} !important; color: ${t.keyText} !important; border: 1px solid ${t.line} !important; border-radius: 8px !important; box-shadow: none !important; font-weight: 700 !important; }
${S} #timerPanel button:hover { background: ${t.soft2} !important; }
${S} #timerPanel button:focus-visible { outline: 3px solid ${t.focus}; }
${S} #timerPanel .btn-connect { background: ${k === "a" ? "var(--uis-acc-btn, var(--accent-color))" : t.acc} !important; color: ${t.accText} !important; border-color: ${k === "a" ? "var(--uis-acc-btn, var(--accent-color))" : t.acc} !important; }
${S} #timerPanel button.btn-connect:hover { background: ${k === "a" ? "var(--uis-acc-btn, var(--accent-color))" : t.acc} !important; filter: brightness(1.12); }
${S} #timerPanel button.btn-delete:hover { background: ${t.del} !important; filter: brightness(0.94); }
${S} #timerPanel button.mode-switch-btn:hover { background: ${t.spec} !important; filter: brightness(0.94); }
${S} #timerPanel .btn-delete { background: ${t.del} !important; color: ${t.delText} !important; border-color: transparent !important; }
${S} #timerPanel .mode-switch-btn { background: ${t.spec} !important; color: ${k === "a" ? "color-mix(in srgb, " + t.specText + " 55%, var(--text-main))" : t.specText} !important; border: 1px solid ${t.line} !important; }
${S} #timerPanel .timer-section-label { color: ${lab} !important; font-weight: 700; }
${S} #timerPanel input, ${S} #timerPanel select { background: ${t.surf}; color: ${t.text}; border: 1px solid ${t.line} !important; border-radius: 8px; }
${S} #timerPanel input:focus, ${S} #timerPanel select:focus { outline: 2px solid ${t.focus}; outline-offset: 0; }
${S} #timerPanel .timer-mini-bar { background: ${t.soft2}; }
${S} #timerPanel .timer-mini-bar[data-state="ok"] .timer-mini-fill { background: ${t.acc}; }
`;
    });
    // 位置：左のバー（シンプル）に重ならないように、右へずらします。設定の画面より後ろに置きます
    c += `
body.ui-style-a #musicPanel, body.ui-style-b.ui-style-b #musicPanel { left: auto; right: 16px; top: auto; bottom: 44px; z-index: 140; max-height: calc(100vh - 196px); }
body.ui-style-b.ui-style-b #musicPanel { max-height: calc(100vh - 276px); }

body.ui-style-a #calcPanel, body.ui-style-b.ui-style-b #calcPanel { z-index: 140; }
.uis-rb, .uis-rb-g, .uis-mr-l, .uis-mr-r { display: contents; }
.uis-ring { display: none; }
@keyframes uisRibbonIn { from { opacity: 0; transform: translateX(-28px); } to { opacity: 1; transform: none; } }
@keyframes uisRibbonDown { from { opacity: 0; transform: translateY(-16px); } to { opacity: 1; transform: none; } }
@keyframes uisRingOver { 50% { opacity: 0.35; } }
@media (min-width: 900px) {
body.ui-style-a #compactTimerBar { display: none; }
body.ui-style-a .uis-ring { position: absolute; left: 50%; top: 50%; width: 76px; height: 76px; margin: -38px 0 0 -38px; pointer-events: none; transform: rotate(-90deg); overflow: visible; }
body.ui-style-a .btn-config-toggle.has-ring .uis-ring { display: block; }
body.ui-style-a .uis-ring circle { fill: none; stroke-width: 4; }
body.ui-style-a .uis-ring-bg { stroke: var(--uis-line2, #CBD2DC); }
body.ui-style-a .uis-ring-fg { stroke: var(--accent-color); stroke-linecap: round; transition: stroke-dasharray 0.25s linear, stroke-dashoffset 0.25s linear; }
body.ui-style-a #uisRailTimer[data-ring="warn"] .uis-ring-fg { stroke: #F59E0B; }
body.ui-style-a #uisRailTimer[data-ring="over"] .uis-ring-fg { stroke: #EF4444; animation: uisRingOver 1s ease-in-out infinite; }
body.ui-style-a #timerPanel { position: fixed; left: 84px; right: auto; top: var(--uis-rb-top, 220px); width: auto; max-width: calc(100vw - 96px); box-sizing: border-box; padding: 12px 20px 10px 16px; border-left: 0; border-radius: 0 18px 18px 0; max-height: none; overflow-x: auto; overflow-y: hidden; transform: none; text-align: left; animation: uisRibbonIn 0.22s ease-out both !important; }
body.ui-style-a #timerPanel .uis-rb { display: flex; align-items: stretch; gap: 0; width: max-content; }
body.ui-style-a #timerPanel .uis-rb-g { display: flex; flex-direction: column; gap: 8px; padding: 0 18px; border-left: 1px solid var(--uis-line2, #CBD2DC); flex: 0 0 auto; }
body.ui-style-a #timerPanel .uis-rb-g:first-child { padding-left: 0; border-left: 0; }
body.ui-style-a #timerPanel .uis-rb-g:last-child { padding-right: 0; }
body.ui-style-a #timerPanel .timer-section-label { order: 9; margin: auto 0 0; padding-top: 2px; text-align: center; font-size: 12px; white-space: nowrap; }
body.ui-style-a #timerPanel .uis-rb-main { display: grid; grid-template-columns: 1fr auto; grid-auto-rows: min-content; align-content: start; gap: 8px; width: 276px; }
body.ui-style-a #timerPanel .uis-rb-main > * { grid-column: 1 / -1; margin: 0; }
body.ui-style-a #timerPanel .uis-rb-main .timer-panel-header { grid-column: 1 / -1; grid-row: 5; margin: 0; }
body.ui-style-a #timerPanel .uis-rb-main .timer-panel-header > button { flex: 1; white-space: nowrap; }
body.ui-style-a #timerPanel .uis-rb-main :is(#timerModeSwitchBtn, .timer-panel-header > button) { display: inline-flex; align-items: center; justify-content: center; text-align: center; }
body.ui-style-a #timerPanel .uis-rb-main #timerModeSwitchBtn { grid-column: 1 / -1; grid-row: 4; margin: 0 !important; padding: 8px 4px !important; font-size: 12px; white-space: nowrap; }
body.ui-style-a #timerPanel .uis-rb-main #timerIcon { display: none; }
body.ui-style-a #timerPanel .uis-rb-main .btn-giant-mode, .btn-clock-mode { padding: 8px 12px !important; font-size: 13px !important; }
body.ui-style-a #timerPanel #timerDisplay { font-size: 36px; line-height: 1.1; margin: 0; text-align: center; }
body.ui-style-a #timerPanel .timer-mini-bar { margin: 0; }
body.ui-style-a #timerPanel .timer-btn-row button { padding: 9px 0 !important; }
body.ui-style-a #timerPanel .quick-preset-row { display: grid; grid-template-columns: repeat(2, 72px); gap: 6px; }
body.ui-style-a #timerPanel .quick-preset-row button { min-width: 0; padding: 9px 0 !important; font-size: 13px !important; }
body.ui-style-a #timerPanel .quick-add-row { display: grid; grid-template-columns: repeat(3, 72px); gap: 6px; }
body.ui-style-a #timerPanel .quick-add-row button { min-width: 0; padding: 9px 0 !important; font-size: 13px !important; white-space: nowrap; }
body.ui-style-a #timerPanel .custom-time-row { margin: 0; justify-content: flex-start; }
body.ui-style-a #timerPanel .custom-time-row input { width: 46px !important; padding: 7px 4px !important; }
body.ui-style-a #timerPanel .clock-target-row { flex-direction: column; align-items: stretch; margin: 0; gap: 8px; }
body.ui-style-a #timerPanel .clock-target-row input[type="time"] { padding: 8px 6px !important; }
body.ui-style-a #timerPanel .uis-rb-stp { width: 250px; }
body.ui-style-a #timerPanel .step-set-row { margin: 0 !important; flex-wrap: nowrap; justify-content: flex-start; }
body.ui-style-a #timerPanel .step-set-row select { flex: 1 1 0; min-width: 0; width: 0; padding: 8px 6px; }
body.ui-style-a #timerPanel .step-set-row button { padding: 8px 12px !important; white-space: nowrap; }
body.ui-style-a #timerPanel .step-auto-row { margin: 0; }
body.ui-style-a #timerPanel .step-progress { margin: 0; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb { display: flex; align-items: stretch; gap: 0; width: max-content; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-g { display: flex; flex-direction: column; gap: 8px; padding: 0 18px; border-left: 1px solid var(--uis-line2, #CBD2DC); flex: 0 0 auto; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-g:first-child { padding-left: 0; border-left: 0; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-g:last-child { padding-right: 0; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .timer-section-label { order: 9; margin: auto 0 0; padding-top: 2px; text-align: center; font-size: 12px; white-space: nowrap; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-main { display: grid; grid-template-columns: 1fr auto; grid-auto-rows: min-content; align-content: start; gap: 8px; width: 276px; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-main > * { grid-column: 1 / -1; margin: 0; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-main .timer-panel-header { grid-column: 1 / -1; grid-row: 5; margin: 0; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-main .timer-panel-header > button { flex: 1; white-space: nowrap; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-main :is(#timerModeSwitchBtn, .timer-panel-header > button) { display: inline-flex; align-items: center; justify-content: center; text-align: center; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-main #timerModeSwitchBtn { grid-column: 1 / -1; grid-row: 4; margin: 0 !important; padding: 8px 4px !important; font-size: 12px; white-space: nowrap; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-main #timerIcon { display: none; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-main .btn-giant-mode, .btn-clock-mode { padding: 8px 12px !important; font-size: 13px !important; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel #timerDisplay { font-size: 36px; line-height: 1.1; margin: 0; text-align: center; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .timer-mini-bar { margin: 0; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .timer-btn-row button { padding: 9px 0 !important; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .quick-preset-row { display: grid; grid-template-columns: repeat(2, 72px); gap: 6px; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .quick-preset-row button { min-width: 0; padding: 9px 0 !important; font-size: 13px !important; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .quick-add-row { display: grid; grid-template-columns: repeat(3, 72px); gap: 6px; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .quick-add-row button { min-width: 0; padding: 9px 0 !important; font-size: 13px !important; white-space: nowrap; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .custom-time-row { margin: 0; justify-content: flex-start; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .custom-time-row input { width: 46px !important; padding: 7px 4px !important; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .clock-target-row { flex-direction: column; align-items: stretch; margin: 0; gap: 8px; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .clock-target-row input[type="time"] { padding: 8px 6px !important; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-stp { width: 250px; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .step-set-row { margin: 0 !important; flex-wrap: nowrap; justify-content: flex-start; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .step-set-row select { flex: 1 1 0; min-width: 0; width: 0; padding: 8px 6px; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .step-set-row button { padding: 8px 12px !important; white-space: nowrap; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .step-auto-row { margin: 0; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .step-progress { margin: 0; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel { position: fixed; left: 18px; right: 18px; top: var(--uis-rb-top-b, 232px); width: auto; max-width: none; box-sizing: border-box; padding: 12px 22px 10px; border-radius: 0 0 12px 12px; max-height: none; overflow-x: auto; overflow-y: hidden; transform: none; text-align: left; animation: uisRibbonDown 0.22s ease-out both !important; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb { justify-content: space-between; width: 100%; min-width: max-content; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-g { border-left-color: #C9A978; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #timerPanel .uis-rb-main #timerIcon { display: none; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #compactTimerBar { display: none; }
body.ui-style-a #musicPanel { position: fixed; left: 84px; right: auto; top: var(--uis-mb-top, 150px); bottom: auto; width: auto; max-width: calc(100vw - 96px); max-height: calc(100vh - var(--uis-mb-top, 150px) - 16px); box-sizing: border-box; padding: 14px 52px 14px 20px; border-left: 0; border-radius: 0 18px 18px 0; overflow-x: hidden; overflow-y: auto; z-index: 140; animation: uisRibbonIn 0.22s ease-out both; }
body.ui-style-a #musicPanel > .music-head:first-child { position: absolute; right: 12px; top: 10px; margin: 0; z-index: 2; }
body.ui-style-a #musicPanel > .music-head:first-child b { display: none; }
body.ui-style-a #musicMain:not([hidden]) { display: grid; grid-template-columns: minmax(170px, 250px) minmax(200px, 1fr) minmax(110px, 190px) minmax(240px, 320px); column-gap: 26px; row-gap: 6px; align-items: center; }
body.ui-style-a #musicMain > .music-nowbox { grid-column: 1; grid-row: 1 / span 2; margin: 0; }
body.ui-style-a #musicMain > .music-seek { grid-column: 2; grid-row: 1; }
body.ui-style-a #musicMain > .music-ctrl { grid-column: 2; grid-row: 2; justify-content: center; margin: 0; }
body.ui-style-a #musicMain > .music-vol { grid-column: 3; grid-row: 1 / span 2; margin: 0; }
body.ui-style-a #musicMain > .music-tabs { grid-column: 4; grid-row: 1 / span 2; margin: 0; }
body.ui-style-a #musicMain > #musicLibrary, body.ui-style-a #musicMain > #musicEqView, body.ui-style-a #musicMain > #musicDjView, body.ui-style-a #musicMain > #musicPadView, body.ui-style-a #musicMain > #musicLinkView { grid-column: 1 / -1; grid-row: 3; margin-top: 8px; padding-top: 12px; border-top: 1px solid var(--uis-line2, #CBD2DC); max-height: 300px; overflow-y: auto; }
body.ui-style-a #musicLibrary:not([hidden]) { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); column-gap: 28px; align-items: start; }
body.ui-style-a .uis-mr-l, body.ui-style-a .uis-mr-r { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
body.ui-style-a #musicPadEdit, body.ui-style-a #musicPlEdit { max-width: 440px; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicPanel { position: fixed; left: 18px; right: 18px; top: var(--uis-rb-top-b, 232px); bottom: auto; width: auto; max-width: none; max-height: calc(100vh - var(--uis-rb-top-b, 232px) - 16px); box-sizing: border-box; padding: 14px 52px 14px 22px; border-radius: 0 0 12px 12px; overflow-x: hidden; overflow-y: auto; z-index: 140; animation: uisRibbonDown 0.22s ease-out both; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicPanel > .music-head:first-child { position: absolute; right: 12px; top: 10px; margin: 0; z-index: 2; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicPanel > .music-head:first-child b { display: none; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicMain:not([hidden]) { display: grid; grid-template-columns: minmax(170px, 250px) minmax(200px, 1fr) minmax(110px, 190px) minmax(240px, 320px); column-gap: 26px; row-gap: 6px; align-items: center; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicMain > .music-nowbox { grid-column: 1; grid-row: 1 / span 2; margin: 0; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicMain > .music-seek { grid-column: 2; grid-row: 1; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicMain > .music-ctrl { grid-column: 2; grid-row: 2; justify-content: center; margin: 0; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicMain > .music-vol { grid-column: 3; grid-row: 1 / span 2; margin: 0; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicMain > .music-tabs { grid-column: 4; grid-row: 1 / span 2; margin: 0; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicMain > #musicLibrary, body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicMain > #musicEqView, body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicMain > #musicDjView, body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicMain > #musicPadView, body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicMain > #musicLinkView { grid-column: 1 / -1; grid-row: 3; margin-top: 8px; padding-top: 12px; border-top: 1px solid #C9A978; max-height: 300px; overflow-y: auto; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicLibrary:not([hidden]) { display: grid; grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr); column-gap: 28px; align-items: start; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) .uis-mr-l, body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) .uis-mr-r { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicPadEdit, body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active) #musicPlEdit { max-width: 440px; }
body.ui-style-b .uis-tray-btn { position: relative; overflow: visible; }
body.ui-style-b .uis-ring-rect { position: absolute; left: -6px; top: -6px; pointer-events: none; overflow: visible; }
body.ui-style-b .uis-ring-rect path { fill: none; stroke-width: 4; }
body.ui-style-b .uis-ring-rect .uis-ring-bg { stroke: rgba(0,0,0,0.28); }
body.ui-style-b .uis-ring-rect .uis-ring-fg { stroke: #FFE082; stroke-linecap: round; transition: stroke-dasharray 0.25s linear, stroke-dashoffset 0.25s linear; }
body.ui-style-b .uis-tray-btn.has-ring .uis-ring { display: block; }
body.ui-style-b #uisTrayTimer[data-ring="warn"] .uis-ring-fg { stroke: #F59E0B; }
body.ui-style-b #uisTrayTimer[data-ring="over"] .uis-ring-fg { stroke: #EF4444; animation: uisRingOver 1s ease-in-out infinite; }
}
`;
    c += uisPartsCss(T);
    return c;
}

// 「ほかの操作」などのメニュー、中央に出る入力の画面、タイマーの巨大表示を、「シンプル」「黒板」の色づかいにそろえます
function uisPartsCss(T) {
    let c = "";
    c += `@keyframes uisToastIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
@keyframes uisToastOut { to { opacity: 0; transform: translateY(8px); } }
`;
    ["a", "b"].forEach(k => {
        const t = T[k], S = t.S;
        const a = k === "a";
        const menuBg = a ? "var(--card-bg)" : "#FBF4E2";
        const hov = a ? "var(--uis-soft)" : "#EFE3C6";
        const flag = a ? "var(--uis-tint)" : "#2F4A3E";
        const flagText = a ? "var(--uis-ink)" : "#F6F3E8";
        const warn = a ? "#FEF3C7" : "#EBD27A", warnText = a ? "#92400E" : "#2B2118";
        const mb = `${S} .modal-content button:not(.stats-tab):not([style*="background"])`;
        const gl = a ? "rgba(255,255,255,0.14)" : "rgba(246,243,232,0.14)";
        const gb = a ? "rgba(255,255,255,0.32)" : "rgba(246,243,232,0.4)";
        const gt = a ? "#F8FAFC" : "#F6F3E8";
        c += `
${S} .pop-menu { background: ${menuBg}; border: ${t.border}; border-radius: ${a ? "14px" : "8px"}; box-shadow: ${t.shadow}; padding: 8px; gap: 2px; min-width: 224px; backdrop-filter: none; }
${S} .pop-menu .pop-item { background: transparent !important; color: ${t.text} !important; border: 0 !important; box-shadow: none; border-radius: ${a ? "10px" : "6px"} !important; height: 44px; min-height: 44px; font-size: 15px; font-weight: 700; justify-content: flex-start; text-align: left; padding: 0 14px; }
${S} .pop-menu .pop-item:hover, ${S} .pop-menu .pop-item:focus-visible { background: ${hov} !important; color: ${t.text} !important; }
${S} .pop-menu .pop-item:focus-visible { outline: 2px solid ${t.focus}; outline-offset: -2px; }
${S} .pop-menu .pop-item-purple { background: ${flag} !important; color: ${flagText} !important; }
${S} .pop-menu .pop-item-purple:hover { background: ${flag} !important; color: ${flagText} !important; filter: brightness(1.08); }
${S} .pop-menu .pop-item-yellow, ${S} #btnSeatCheck.pop-item.has-warn { background: ${warn} !important; color: ${warnText} !important; }
${S} .pop-menu .pop-item-split { gap: 2px; }
${S} .pop-menu .pop-item-split .pop-item { justify-content: center; text-align: center; }
${S} .pop-menu .pop-item-split .pop-item:not(:hover) { background: ${a ? "var(--uis-soft)" : "#EFE3C6"} !important; }
${S} .pop-menu .pop-item:disabled { opacity: 0.45; }
${S} .modal-overlay { background-color: ${a ? "rgba(15,23,42,0.45)" : "rgba(30,22,14,0.55)"}; backdrop-filter: none; }
${S} .modal-content { background: ${t.surf}; color: ${t.text}; border: ${t.border}; border-radius: ${a ? "20px" : "10px"}; box-shadow: ${t.shadow}; backdrop-filter: none; }
${S} .modal-content h4 { text-align: left; font-size: 17px; font-weight: 800; color: var(--uis-head) !important; border-bottom: 1px solid ${t.line}; }
${S} .modal-content p, ${S} .modal-content .input-label, ${S} .modal-content label { color: ${a ? "var(--text-sub)" : "#6B5A3E"}; }
${S} .modal-content input[type="text"], ${S} .modal-content input[type="password"], ${S} .modal-content input[type="number"], ${S} .modal-content input[type="time"], ${S} .modal-content input[type="search"], ${S} .modal-content select, ${S} .modal-content textarea { background: ${t.soft} !important; color: ${t.text} !important; border: 1px solid ${t.line} !important; border-radius: 10px; }
${S} .modal-content input:focus, ${S} .modal-content select:focus, ${S} .modal-content textarea:focus { background: ${t.surf} !important; border-color: ${t.focus} !important; outline: 2px solid ${t.focus}; outline-offset: 0; }
${S} .switch { height: 26px; width: 44px; }
${S} .slider { border: 0; background-color: ${a ? "var(--uis-line2)" : "var(--toggle-off)"}; }
${S} .slider:before { width: 20px; height: 20px; left: 3px; bottom: 3px; box-shadow: none; }
${S} input:checked + .slider { background-color: ${t.acc}; }
${S} input:checked + .slider:before { transform: translateX(18px); }
${mb} { background: var(--uis-b-bg) !important; color: var(--uis-b-fg) !important; border: 1px solid var(--uis-b-line) !important; box-shadow: none !important; font-weight: 700; }
${mb}:hover { background: var(--uis-b-hover-bg) !important; }
${mb}.btn-main, ${mb}.btn-save, ${mb}.btn-connect, ${mb}.btn-connect-mini, ${mb}.btn-nominate, ${mb}.btn-unlock-mini, ${mb}.plugin-fix { background: var(--uis-b-on-bg) !important; color: var(--uis-b-on-fg) !important; border-color: var(--uis-b-on-bg) !important; }
${mb}.btn-main:hover, ${mb}.btn-save:hover, ${mb}.btn-connect:hover, ${mb}.btn-connect-mini:hover, ${mb}.btn-nominate:hover, ${mb}.plugin-fix:hover { background: var(--uis-b-on-bg) !important; filter: brightness(1.1); }
${mb}.btn-delete, ${mb}.btn-delete-mini { background: ${t.del} !important; color: ${t.delText} !important; border-color: transparent !important; }
${S} #configContainer :is(button[onclick="savePreset()"], button[onclick="openStatsModal()"], #connectGasBtn, #saveSpreadsheetBtn) { background: var(--uis-b-on-bg) !important; color: var(--uis-b-on-fg) !important; border: 1px solid var(--uis-b-on-bg) !important; box-shadow: none !important; font-weight: 700 !important; height: auto !important; min-height: 44px !important; box-sizing: border-box !important; padding-top: 6px !important; padding-bottom: 6px !important; }
${S} #configContainer :is(button[onclick="savePreset()"], button[onclick="openStatsModal()"], #connectGasBtn, #saveSpreadsheetBtn):hover { background: var(--uis-b-on-bg) !important; color: var(--uis-b-on-fg) !important; filter: brightness(1.1); }
${S} #configContainer :is(#connectOnlyGasBtn, #loadSpreadsheetBtn, button[onclick="downloadAsCSV()"], button[onclick*="openHistoryModal"], button[onclick*="openCacheRestoreModal"], button[onclick*="openBackupModal"], #btnSchedClear, #btnSsPause, #btnRenameClass, #btnDuplicateClass, #btnArchiveClass, #btnExportYearCsv) { background: var(--uis-b-bg) !important; color: var(--uis-b-fg) !important; border: 1px solid var(--uis-b-line) !important; box-shadow: none !important; font-weight: 700 !important; height: auto !important; min-height: 44px !important; box-sizing: border-box !important; padding-top: 6px !important; padding-bottom: 6px !important; }
${S} #configContainer :is(#connectOnlyGasBtn, #loadSpreadsheetBtn, button[onclick="downloadAsCSV()"], button[onclick*="openHistoryModal"], button[onclick*="openCacheRestoreModal"], button[onclick*="openBackupModal"], #btnSchedClear, #btnSsPause, #btnRenameClass, #btnDuplicateClass, #btnArchiveClass, #btnExportYearCsv):hover { background: var(--uis-b-hover-bg) !important; color: var(--uis-b-fg) !important; border-color: var(--uis-b-hover-line) !important; }
${S} #configContainer :is(#connectOnlyGasBtn, #loadSpreadsheetBtn, #connectGasBtn, #saveSpreadsheetBtn, #btnSchedClear, #btnSsPause, #btnRenameClass, #btnDuplicateClass, #btnArchiveClass, #btnExportYearCsv, #btnSsOpen, #btnRosterExportMenu, #btnShareChart, button[onclick="downloadAsCSV()"], button[onclick="savePreset()"], button[onclick="openStatsModal()"], button[onclick*="openHistoryModal"], button[onclick*="openCacheRestoreModal"], button[onclick*="openBackupModal"], button[onclick*="openChartExportModal"], button[onclick*="openRosterEditor()"], button[onclick*="openRosterPasteModal"], button[onclick*="offlineFileInput"], button[onclick*="openAbsentModal"]) { font-size: 15px !important; padding-left: 10px !important; padding-right: 10px !important; }
${S} #configContainer .layout-grid-fields:has(#saveSpreadsheetBtn) { grid-template-columns: 1fr !important; gap: 8px !important; }
${S} #configContainer :is(#saveSpreadsheetBtn, #loadSpreadsheetBtn) { white-space: nowrap; padding-left: 10px !important; padding-right: 10px !important; }
${S} #configContainer :is(button, #connectGasBtn, #saveSpreadsheetBtn):disabled, ${S} #configContainer :is(button, #connectGasBtn, #saveSpreadsheetBtn):disabled:hover { background: ${t.soft2} !important; color: ${a ? t.sub : "#7A6C52"} !important; border: 1px solid ${t.line} !important; opacity: 0.6; cursor: not-allowed; filter: none !important; box-shadow: none !important; }
${S} #configContainer button[onclick="deletePreset()"] { background: ${t.del} !important; color: ${t.delText} !important; border: 1px solid transparent !important; box-shadow: none !important; font-weight: 700; }
${S} #configContainer button[onclick="deletePreset()"]:hover { background: ${t.del} !important; color: ${t.delText} !important; filter: brightness(0.95); }
${mb}:focus-visible { outline: 3px solid ${t.focus}; outline-offset: 1px; }
${S} :is(button, a[href], input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), .pop-item):focus-visible { outline: 3px solid ${t.focus}; outline-offset: 2px; }
${S} input:focus-visible + .slider, ${S} input:focus-visible + .switch-slider { outline: 3px solid ${t.focus}; outline-offset: 2px; }
${S} input[type="range"]:focus-visible { outline: 3px solid ${t.focus}; outline-offset: 4px; }
${S} .sj-play { background: ${t.acc}; color: ${t.accText}; border-radius: ${a ? "10px" : "6px"}; }
${S} .sj-play:disabled { opacity: 0.5; cursor: default; }
${S} .room-panel { background: ${t.surf}; color: ${t.text}; border: ${t.border}; border-radius: ${a ? "16px" : "8px"}; box-shadow: ${t.shadow}; }
${S} .room-panel-head { color: ${t.text}; }
${S} .room-done { background: ${t.acc}; color: ${t.accText}; border-radius: ${a ? "999px" : "6px"}; padding: 5px 14px; }
${S} .room-help, ${S} .room-sub, ${S} .room-foot { color: ${a ? "var(--text-sub)" : "#6B5A3E"}; }
${S} .room-kinds button, ${S} .room-tpls button, ${S} .room-foot button { background: ${t.soft}; border: 1px solid ${t.line}; color: ${t.text}; border-radius: ${a ? "10px" : "6px"}; }
${S} .room-kinds button:hover, ${S} .room-tpls button:hover, ${S} .room-foot button:hover { background: ${t.soft2}; border-color: ${t.acc}; }
${S} .room-panel .room-del { color: ${t.delText}; }
${S} .room-panel input[type="text"] { background: ${t.surf}; color: ${t.text}; border: 1px solid ${t.line}; border-radius: ${a ? "10px" : "6px"}; }
${S}.room-edit .room-obj { outline: 1px dashed ${a ? "var(--uis-mute)" : "#C9A978"}; }
${S}.room-edit .room-obj.room-sel { outline: 3px solid ${t.focus}; }
${S} .room-grip { background: ${t.focus}; }
${S}.room-edit #toastContainer { right: 236px; }
${a ? "" : `${S} :is(#topBarContainer, .main-btn-wrapper) :focus-visible { outline-color: #F6F3E8; }`}
${S} #toastContainer { top: auto; bottom: 44px; left: auto; right: 24px; transform: none; width: auto; max-width: min(380px, calc(100vw - 32px)); align-items: flex-end; }
${S} .toast { display: flex; align-items: center; gap: 10px; background: ${a ? "var(--card-bg)" : "#2F4A3E"}; color: ${a ? "var(--text-main)" : "#F6F3E8"}; border: ${a ? "1px solid var(--uis-line2, #CBD2DC)" : "2px solid #C9A978"}; border-left-width: ${a ? "1px" : "2px"}; border-radius: ${a ? "12px" : "8px"}; padding: 12px 18px 12px 14px; font-size: 14px; font-weight: 700; box-shadow: ${t.shadow}; backdrop-filter: none; animation: uisToastIn 0.28s ease-out both; }
${S} .toast.hide { animation: uisToastOut 0.28s ease-in forwards; }
select.uis-bs, select.uis-bs::picker(select) { appearance: base-select; }
${S} select.uis-bs { display: flex; align-items: center; gap: 6px; }
${S} select.uis-bs.uis-bs.uis-bs > button { all: unset; display: flex; align-items: center; gap: 6px; flex: 1 1 auto; min-width: 0; cursor: pointer; padding: 0 !important; margin: 0 !important; background: none !important; border: 0 !important; box-shadow: none !important; min-height: 0 !important; height: auto !important; font: inherit !important; color: inherit !important; text-align: left !important; justify-content: flex-start !important; }
${S} select.uis-bs::picker-icon { color: currentColor; opacity: 0.7; }
${S} select.uis-bs::picker(select) { background: ${t.surf}; color: ${t.text}; border: 1px solid ${t.line}; border-radius: 10px; padding: 4px; box-shadow: ${t.shadow}; max-height: min(360px, 60vh); position-area: block-end span-inline-end; position-try-order: normal; position-try-fallbacks: flip-block; margin: 4px 0; min-width: anchor-size(width); }
${S} select.uis-bs option { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 6px; background: transparent !important; color: ${t.text} !important; cursor: pointer; font-size: 14px; }
${S} select.uis-bs option:hover, ${S} select.uis-bs option:focus-visible { background: ${t.soft2} !important; }
${S} select.uis-bs option:checked { background: ${t.spec} !important; color: ${t.specText} !important; font-weight: 700; }
${S} select.uis-bs option::checkmark { display: none; }
${S} select.uis-bs .uis-emo { display: none; }
${S} select.uis-bs optgroup > legend { display: flex; align-items: center; gap: 6px; padding: 8px 10px 4px; font-size: 12px; font-weight: 700; color: ${a ? t.sub : "#6B5A3E"}; }
${S} select.uis-bs .pico { flex: none; }
${S} button.calc-tool { white-space: nowrap; padding-left: 4px !important; padding-right: 4px !important; font-size: 11px !important; gap: 2px; }
${S} button.calc-tool .pico { width: 12px; height: 12px; margin-right: 2px; }
${S} .toast::before { content: none; }
${S} .toast > .pico { flex: none; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; background: ${a ? "var(--uis-tint)" : "#E8DBBA"}; color: ${a ? "var(--uis-ink)" : "#2F4A3E"}; }
${S} .toast-error > .pico { background: ${a ? "#FEE2E2" : "#F1D2C8"}; color: #B91C1C; }
${S} .toast-warn > .pico { background: ${a ? "#FEF3C7" : "#F6E3A8"}; color: #B45309; }
${S} .toast-info > .pico { background: ${a ? "#E0F2FE" : "#D6E4EC"}; color: ${a ? "#0369A1" : "#1E5A7A"}; }
${S} #giantTimeOverlay { ${a ? "" : "background: #2A4036;"} }
${S} #giantTimeOverlay.focus-active { background-color: #000 !important; }
${S} #giantTimeOverlay button { background: ${gl} !important; color: ${gt} !important; border: 1px solid ${gb} !important; box-shadow: none !important; font-weight: 700; }
${S} #giantTimeOverlay button:hover { background: ${a ? "rgba(255,255,255,0.24)" : "rgba(246,243,232,0.26)"} !important; }
${S} #giantTimeOverlay .btn-connect { background: ${a ? "var(--accent-color)" : "#E8DBBA"} !important; color: ${a ? "var(--uis-on-accent)" : "#2B2118"} !important; border-color: transparent !important; }
${S} #giantTimeOverlay .btn-connect:hover { filter: brightness(1.1); }
${S} #giantTimeOverlay .btn-delete { background: ${a ? "rgba(239,68,68,0.26)" : "rgba(241,210,200,0.2)"} !important; color: #FECACA !important; border-color: rgba(254,202,202,0.45) !important; }
${S} #giantTimeOverlay input { border: 0 !important; border-radius: 10px; }
`;
        // 付箋モードの案内帯
        c += `
${S} .sticky-mode-bar { width: fit-content; max-width: calc(100% - 24px); box-sizing: border-box; margin: 8px auto; padding: 8px 12px 8px 16px; border-radius: ${a ? "10px" : "6px"}; background: ${a ? "var(--uis-tint)" : "#2F4A3E"}; color: ${a ? "var(--uis-ink)" : "#F6F3E8"}; border: ${a ? "1px solid color-mix(in srgb, var(--accent-color) 35%, transparent)" : "2px solid #A97C4F"}; font-size: 14px; font-weight: 700; box-shadow: none; }
${S} .sticky-mode-bar button { margin: 0; padding: 5px 12px; border: 0; border-radius: ${a ? "8px" : "5px"}; background: ${a ? "var(--accent-color)" : "#F6F3E8"}; color: ${a ? "var(--uis-on-accent)" : "#2B2118"}; font-weight: 700; cursor: pointer; }
${S} .sticky-mode-bar button:focus-visible { outline: 3px solid ${t.focus}; outline-offset: 2px; }
`;
        // 数字キーパッド（ロックの画面など）
        const kb = a ? "var(--card-bg)" : "#2F4A3E";
        c += `
${S} #softKeypad { background: ${kb}; color: ${a ? "var(--text-main)" : "#F6F3E8"}; border: ${a ? "1px solid var(--uis-line2)" : "4px solid #A97C4F"}; border-radius: ${a ? "18px" : "10px"}; box-shadow: ${a ? "0 16px 40px rgba(15,23,42,0.22)" : "0 12px 28px rgba(0,0,0,0.4)"}; }
${S} #softKeypad .skp-title { color: ${a ? "var(--text-sub)" : "#DCE5D8"}; }
${S} #softKeypad .skp-value { color: ${a ? "var(--text-main)" : "#F9E79A"}; }
${S} #softKeypad button { border-radius: ${a ? "10px" : "6px"}; background: ${a ? t.soft : "#F3F0E6"}; color: ${a ? "var(--text-main)" : "#2B2118"}; border: ${a ? "1px solid var(--uis-line2)" : "2px solid #FFFFFF"}; box-shadow: ${a ? "none" : "0 3px 0 #B9B39E"}; font-weight: 800; }
${S} #softKeypad button:hover { background: ${a ? t.soft2 : "#FFFFFF"}; }
${S} #softKeypad button:active { background: ${a ? t.soft2 : "#E4DFCC"}; ${a ? "" : "box-shadow: 0 1px 0 #B9B39E; transform: translateY(2px);"} }
${S} #softKeypad .skp-fn, ${S} #softKeypad .skp-side { background: ${a ? t.soft2 : "#E4DFCC"}; font-size: 13px; }
${S} #softKeypad .skp-side { font-size: 16px; }
${S} #softKeypad .skp-ok { background: ${a ? "var(--accent-color)" : "#F9E79A"}; color: ${a ? "var(--uis-on-accent)" : "#2B2118"}; border-color: ${a ? "var(--accent-color)" : "#FFFFFF"}; ${a ? "" : "box-shadow: 0 3px 0 #BFA44A;"} font-size: 16px; }
${S} #softKeypad .skp-ok:hover { background: ${a ? "var(--accent-color)" : "#FFF0B0"}; filter: brightness(1.08); }
${S} #softKeypad button:focus-visible { outline: 3px solid ${t.focus}; outline-offset: 1px; }
`;
        // わがまま指定の囲み線の色
        c += `
${S} .wagamama-zone-outline { border-color: ${a ? "#F59E0B" : "#B45309"}; }
${S} { --wagamama-color: ${a ? "#F59E0B" : "#B45309"}; }
`;
        // 全画面表示（座席を大きく見せる画面）
        const BB = `${S}.blackboard-active`;
        const bbSeat = a ? "rgba(255,255,255,0.07)" : "rgba(246,243,232,0.08)";
        const bbLine = a ? "rgba(255,255,255,0.26)" : "rgba(246,243,232,0.6)";
        const bbText = a ? "#F8FAFC" : "#F6F3E8";
        const bbSub = a ? "#CBD5E1" : "#DCE5D8";
        const bbFix = a ? "#93C5FD" : "#F9E79A";
        const bbBtn = `background: ${a ? "rgba(255,255,255,0.1)" : "rgba(246,243,232,0.1)"} !important; color: ${bbSub} !important; border: 1px solid ${a ? "rgba(255,255,255,0.24)" : "rgba(246,243,232,0.5)"} !important; border-radius: ${a ? "10px" : "6px"} !important; box-shadow: none !important; font-weight: 700 !important;`;
        c += `
${BB} { background-color: ${a ? "#0F172A" : "#263B31"} !important; }
${BB} .seat.seat { background-color: ${bbSeat} !important; border: ${a ? "1px" : "2px"} solid ${bbLine} !important; ${a ? "" : "border-bottom-width: 5px !important;"} border-radius: ${a ? "14px" : "6px"}; box-shadow: none !important; }
${BB} .seat.seat .seat-name { color: ${bbText} !important; }
${BB} .seat.seat .seat-no, ${BB} .seat.seat .seat-position { color: ${bbSub} !important; }
${BB} .seat.seat .seat-furi { color: ${a ? "#E2E8F0" : "#F6F3E8"} !important; font-weight: 700; }
${BB} .seat.seat.is-empty-target { background-color: transparent !important; border-style: dashed !important; border-color: ${a ? "rgba(255,255,255,0.18)" : "rgba(246,243,232,0.28)"} !important; }
${[1, 2, 3, 4, 5, 6, 7, 8].map(n => a ? `${BB} .seat.seat.group-${n} { border-left: 6px solid var(--group-${n}-color) !important; }` : `${BB} .seat.seat.group-${n} { box-shadow: inset 0 7px 0 var(--group-${n}-color) !important; }`).join("\n")}
${BB} .seat.seat.is-fixed { border-top-color: ${bbFix} !important; border-right-color: ${bbFix} !important; border-bottom-color: ${bbFix} !important; ${a ? "" : "border-left-color: " + bbFix + " !important;"} }
${BB} #topBarContainer .app-title { display: none !important; }
${BB} #topBarContainer .btn-secondary, ${BB} #configMenuBtn, ${BB} #calcOpenBtn, ${BB} #musicPlayerBtn { ${bbBtn} }
${BB} .realtime-clock { background: ${a ? "rgba(255,255,255,0.08)" : "rgba(246,243,232,0.08)"} !important; color: ${a ? bbText : "#F9E79A"} !important; border: 1px solid ${a ? "rgba(255,255,255,0.2)" : "rgba(246,243,232,0.45)"} !important; border-radius: ${a ? "10px" : "6px"} !important; }
`;
        // ルーレットの画面のボタン：丸い形をやめて、ほかのボタンと同じ形にします
        const rr = a ? "10px" : "6px";
        c += `
${S} #rouletteOverlay button { border-radius: ${rr} !important; background: ${gl} !important; color: ${gt} !important; border: 1px solid ${gb} !important; box-shadow: none !important; font-weight: 700; margin: 0 !important; }
${S} #rouletteOverlay button:hover { background: ${a ? "rgba(255,255,255,0.24)" : "rgba(246,243,232,0.26)"} !important; }
${S} #rouletteOverlay #btnRouletteStyle, ${S} #rouletteOverlay #btnRouletteSound, ${S} #rouletteOverlay #btnRouletteUndo { height: 44px; padding: 0 18px !important; font-size: 15px !important; }
${S} #rouletteOverlay .btn-close-giant { height: 44px; padding: 0 18px !important; font-size: 15px !important; }
${S} #rouletteOverlay #btnSpinRoulette { height: ${a ? "52px" : "46px"}; padding: 0 ${a ? "28px" : "26px"} !important; font-size: ${a ? "18px" : "20px"} !important; font-weight: 800; border-radius: ${a ? "12px" : "8px"} !important; background: ${a ? "var(--accent-color)" : "#F9E79A"} !important; color: ${a ? "var(--uis-on-accent)" : "#2B2118"} !important; border: ${a ? "0" : "2px solid #FFFFFF"} !important; ${a ? "" : "box-shadow: 0 3px 0 #BFA44A !important;"} }
${S} #rouletteOverlay #btnSpinRoulette:hover { background: ${a ? "var(--accent-color)" : "#FFF0B0"} !important; filter: brightness(1.08); }
${S} #rouletteOverlay select { border-radius: ${a ? "8px" : "6px"} !important; }
${S} #rouletteOverlay button:focus-visible { outline: 3px solid ${t.focus}; outline-offset: 2px; }
`;
        // 画面に直接書かれた古い色（オレンジ・水色・紫・ピンク）を、スタイルの色にそろえます
        const HUES = ["#d97706", "#0891b2", "#7c3aed", "#f43f5e", "#0ea5e9", "#ea580c", "#b45309", "#8b5cf6"];
        const head = a ? "var(--uis-ink)" : "#2F4A3E";
        const txtSel = [".modal-content", "#configContainer"].map(r => HUES.map(h => `${S} ${r} [style*="color: ${h}"]:not([style*="background"]):not([style*="border"]), ${S} ${r} [style*="color:${h}"]:not([style*="background"]):not([style*="border"])`).join(", ")).join(", ");
        const bgSel = [".modal-content", "#configContainer"].map(r => HUES.map(h => `${S} ${r} button[style*="background-color: ${h}"], ${S} ${r} button[style*="background-color:${h}"], ${S} ${r} button[style*="background: ${h}"], ${S} ${r} button[style*="background:${h}"]`).join(", ")).join(", ");
        const wLight = a ? "var(--uis-tint)" : "#DDE8D6", wLightT = a ? "var(--uis-ink)" : "#2F4A3E";
        const wMid = a ? "#FEF3C7" : "#EBD27A", wMidT = a ? "#92400E" : "#2B2118";
        const wHeavy = a ? "#FEE2E2" : "#F1D2C8", wHeavyT = a ? "#B91C1C" : "#7A2E1E";
        c += `
${txtSel} { color: ${head} !important; }
${bgSel} { background-color: ${t.acc} !important; color: ${t.accText} !important; border-color: ${t.acc} !important; }
${S} { --uis-b-bg: ${t.soft}; --uis-b-fg: ${t.keyText}; --uis-b-line: ${t.line}; --uis-b-hover-bg: ${t.soft2}; --uis-b-hover-line: ${t.focus}; --uis-b-on-bg: ${t.acc}; --uis-b-on-fg: ${t.accText}; --uis-head: ${head}; --lbl-blue: ${head}; --lbl-green: ${head}; --lbl-purple: ${head}; --lbl-orange: ${head}; --lbl-sky: ${head}; --lbl-heading: var(--uis-b-fg); --uis-nav-hover: ${hov}; --uis-w-light-bg: ${wLight}; --uis-w-light-fg: ${wLightT}; --uis-w-mid-bg: ${wMid}; --uis-w-mid-fg: ${wMidT}; --uis-w-heavy-bg: ${wHeavy}; --uis-w-heavy-fg: ${wHeavyT}; --uis-n-bg: ${warn}; --uis-n-fg: ${warnText}; --uis-n-line: ${a ? "#FCD34D" : "#B8863A"}; --uis-n-btn-bg: ${a ? "#FFFFFF" : "#F3F0E6"}; --uis-bar-bg: ${a ? "#0F172A" : "#2F4A3E"}; --uis-bar-fg: ${a ? "#FFFFFF" : "#F6F3E8"}; --uis-bar-go-bg: ${a ? "var(--accent-color)" : "#E8DBBA"}; --uis-bar-go-fg: ${a ? "var(--uis-on-accent)" : "#2B2118"}; --uis-bar-sub-bg: ${a ? "rgba(255,255,255,0.16)" : "rgba(246,243,232,0.18)"}; --uis-s-surf: ${t.surf}; --uis-s-text: ${t.text}; --uis-s-soft: ${t.soft}; --uis-s-line: ${t.line}; --uis-s-sub: ${a ? "var(--text-sub)" : "#6B5A3E"}; --uis-focus: ${t.focus}; }
${mb}.is-on, ${mb}.is-now { background: var(--uis-b-on-bg) !important; color: var(--uis-b-on-fg) !important; border-color: var(--uis-b-on-bg) !important; }
${S} .tour-hole { box-shadow: 0 0 0 9999px ${a ? "rgba(15,23,42,0.58)" : "rgba(20,28,22,0.66)"}, 0 0 0 3px ${a ? "var(--accent-color)" : "#F6F3E8"}; border-radius: ${a ? "14px" : "8px"}; ${a ? "" : "outline: 2px dashed #C9A978; outline-offset: 5px;"} }
${S} .tour-card { background: ${t.surf}; color: ${t.text}; border: ${t.border}; border-radius: ${a ? "18px" : "10px"}; box-shadow: ${t.shadow}; padding: 18px 20px; }
${S} .tour-card .tour-count { font-size: 12px; font-weight: 800; letter-spacing: 0.06em; color: ${a ? "var(--uis-mute)" : "#6B5A3E"}; margin-bottom: 4px; }
${S} .tour-card .tour-title { font-size: 17px; font-weight: 800; color: ${t.text}; ${a ? "" : "padding-bottom: 6px; border-bottom: 1px solid #C9A978;"} }
${S} .tour-card .tour-text { color: ${a ? "var(--text-sub)" : "#4A3C28"}; }
${S} .tour-card .tour-btns button { background: ${t.soft}; color: ${t.keyText}; border: 1px solid ${t.line}; border-radius: ${a ? "10px" : "6px"}; box-shadow: none; font-weight: 700; }
${S} .tour-card .tour-btns button:hover { background: ${t.soft2}; }
${S} .tour-card .tour-btns button.tour-skip { background: transparent; border-color: transparent; color: ${a ? "var(--uis-mute)" : "#6B5A3E"}; opacity: 1; }
${S} .tour-card .tour-btns button.tour-next { background: ${t.acc}; border-color: ${t.acc}; color: ${t.accText}; }
${S} .tour-card .tour-btns button.tour-next:hover { filter: brightness(1.1); }
${S} .tour-card .tour-btns button:focus-visible { outline: 3px solid ${t.focus}; outline-offset: 1px; }
${S} #classStatusBar.is-trial { background: ${a ? "var(--uis-tint)" : "transparent"}; color: ${a ? "var(--uis-ink)" : "#F6F3E8"}; border: ${a ? "1px solid color-mix(in srgb, var(--accent-color) 40%, transparent)" : "1.5px dashed rgba(246,243,232,0.75)"}; border-radius: ${a ? "10px" : "6px"}; box-shadow: none; backdrop-filter: none; font-weight: 700; }
${S} #classStatusBar.is-trial .class-status-btn { background: ${a ? "var(--accent-color)" : "#F6F3E8"}; color: ${a ? "var(--uis-on-accent)" : "#2B2118"}; border: 0; border-radius: ${a ? "8px" : "5px"}; font-weight: 700; }
${S} #classStatusBar.is-trial .class-status-btn:hover { filter: brightness(1.08); }
`;
    });
    c += `body.ui-style-b.ui-style-b.blackboard-active { background-color: #263B31 !important; }
`;
    c += `body.uis-cfg-open #uisNomHeader, body.uis-cfg-open #nominateDisplayArea { display: none !important; }
`;
    return c;
}

// 形の指定。「通常の画面」だけに効かせます（指名モードは、これまでの見た目のままです）
// ---------- 構成ボタンなどの絵文字：シンプルと黒板のとき、線のアイコンに置きかえます（プラグインが .pico で目印をつけた絵文字）
const UIS_PICO = {
    cloud: "<path d='M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 18 9.5 4 4 0 0 1 17.5 18z'/>",
    link: "<path d='M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1'/>",
    palette: "<path d='M12 3a9 9 0 1 0 0 18c1.2 0 2-.8 2-1.8 0-1.2-.9-1.5-.9-2.5 0-.9.7-1.5 1.7-1.5H17a4 4 0 0 0 4-4c0-4.4-4-8.2-9-8.2z'/><circle cx='7.5' cy='11' r='1'/><circle cx='10' cy='7' r='1'/><circle cx='15' cy='7.5' r='1'/>",
    bolt: "<path d='M13 3 5 13h6l-1 8 8-10h-6z'/>",
    puzzle: "<path d='M10 4a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4h-4v-2a2 2 0 1 0-4 0v2H6v-4h2a2 2 0 1 0 0-4H6V6h4z'/>",
    compress: "<path d='M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'/>",
    redo: "<path d='m15 14 5-5-5-5'/><path d='M20 9H10a6 6 0 0 0 0 12h3'/>",
    hash: "<path d='M5 9h14M5 15h14M10 4 8 20M16 4l-2 16'/>",
    arrowdown: "<path d='M12 5v14M6 13l6 6 6-6'/>",
    menu: "<path d='M4 7h16M4 12h16M4 17h16'/>",
    film: "<rect x='3' y='5' width='18' height='14' rx='2'/><path d='M7 5v14M17 5v14M3 9h4M17 9h4M3 15h4M17 15h4'/>",
    qr: "<rect x='4' y='4' width='6' height='6'/><rect x='14' y='4' width='6' height='6'/><rect x='4' y='14' width='6' height='6'/><path d='M14 14h2v2h-2zM18 18h2M14 20h2'/>",
    slot: "<rect x='3' y='5' width='18' height='14' rx='2'/><path d='M9 5v14M15 5v14'/>",
    drum: "<ellipse cx='12' cy='9' rx='8' ry='3'/><path d='M4 9v7c0 1.7 3.6 3 8 3s8-1.3 8-3V9M9 3l3 6M15 3l-3 6'/>",
    fog: "<path d='M4 8h12M8 12h12M4 16h12M8 20h8'/>",
    card: "<rect x='6' y='3' width='12' height='18' rx='2'/><path d='M12 8l3 4-3 4-3-4z'/>",
    walk: "<circle cx='12' cy='5' r='2'/><path d='M12 8v6M12 14l-3 6M12 14l3 6M8 11l4-3 4 3'/>",
    radar: "<path d='M5 12a7 7 0 0 1 14 0M8 12a4 4 0 0 1 8 0'/><circle cx='12' cy='15' r='1'/><path d='M12 16v5'/>",
    joystick: "<circle cx='12' cy='6' r='3'/><path d='M12 9v6M5 20h14M7 20v-3a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3'/>",
    burst: "<path d='M12 2l2 6 6-2-3 5 5 3-6 1 1 6-5-4-5 4 1-6-6-1 5-3-3-5 6 2z'/>",
    cyclone: "<circle cx='12' cy='12' r='1'/><path d='M12 8a4 4 0 0 1 4 4M12 4a8 8 0 0 1 8 8M12 16a4 4 0 0 1-4-4M12 20a8 8 0 0 1-8-8'/>",
    meteor: "<circle cx='17' cy='7' r='3'/><path d='M14.5 9.5 4 20M12 8 3 14M16 12l-6 9'/>",
    tornado: "<path d='M4 5h16M6 9h12M8 13h8M10 17h4'/>",
    fireworks: "<path d='M12 3v5M12 16v5M3 12h5M16 12h5M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3'/>",
    ball: "<circle cx='12' cy='12' r='9'/><path d='M12 7l4 3-1.5 5h-5L8 10z'/>",
    bookmark: "<path d='M6 3h12v18l-6-4-6 4z'/>",
    rocket: "<path d='M12 3c4 2 6 6 5 11l-3 3h-4l-3-3c-1-5 1-9 5-11z'/><circle cx='12' cy='10' r='1.5'/><path d='M7 15l-3 3M17 15l3 3'/>",
    masks: "<path d='M4 5h10v7a5 5 0 0 1-10 0zM10 12h10v3a5 5 0 0 1-10 0z'/>",
    plane: "<path d='M3 20h18M5 14l14 3M8 9l3 2 6-4'/>",
    galaxy: "<circle cx='12' cy='12' r='9'/><circle cx='9' cy='10' r='1'/><circle cx='15' cy='14' r='1'/><path d='M12 5v1M17 9v1'/>",
    leaf: "<path d='M5 19c0-9 5-14 14-14 0 9-5 14-14 14zM5 19l8-8'/>",
    wave: "<path d='M3 9c3-3 6 3 9 0s6-3 9 0M3 15c3-3 6 3 9 0s6-3 9 0'/>",
    brick: "<rect x='3' y='5' width='18' height='14' rx='1'/><path d='M3 12h18M9 5v7M15 12v7'/>",
    shell: "<path d='M12 21a9 9 0 1 1 9-9c0 4-3 6-6 6s-5-2-5-5 2-4 4-4'/>",
    bubble: "<circle cx='9' cy='11' r='6'/><circle cx='18' cy='7' r='2'/><circle cx='20' cy='15' r='1'/>",
    pendulum: "<path d='M12 3v10'/><circle cx='12' cy='16' r='4'/>",
    coin: "<circle cx='12' cy='12' r='9'/><path d='M12 7v10M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4'/>",
    ice: "<rect x='5' y='5' width='14' height='14' rx='3'/><path d='M9 9l2 2'/>",
    rainbow: "<path d='M3 18a9 9 0 0 1 18 0M7 18a5 5 0 0 1 10 0'/>",
    glitch: "<path d='M6 8h12v8H6zM9 11h1M14 11h1M8 16v3M16 16v3M4 12h2M18 12h2'/>",
    jelly: "<path d='M5 19h14l-1.5-9h-11zM8 10c0-3 2-5 4-5s4 2 4 5'/>",
    ban: "<circle cx='12' cy='12' r='9'/><path d='M5.6 5.6l12.8 12.8'/>",
    gem: "<path d='M6 4h12l3 5-9 11L3 9z'/><path d='M3 9h18'/>",
    moon: "<path d='M20 14A8 8 0 1 1 10 4a6.5 6.5 0 0 0 10 10z'/>",
    snow: "<path d='M12 12L12.0 1.5M14.1 2.9L12.0 5.0L9.9 2.9M12 12L21.1 6.7M20.9 9.3L18.1 8.5L18.8 5.6M12 12L21.1 17.2M18.8 18.4L18.1 15.5L20.9 14.7M12 12L12.0 22.5M9.9 21.1L12.0 19.0L14.1 21.1M12 12L2.9 17.3M3.1 14.7L5.9 15.5L5.2 18.4M12 12L2.9 6.7M5.2 5.6L5.9 8.5L3.1 9.3'/>",
    sakura: "<path d='M12.0 10.8 C7.6 8.5 6.8 3.8 9.6 1.7 L12.0 3.2 L14.4 1.7 C17.2 3.8 16.4 8.5 12.0 10.8 ZM13.1 11.6 C14.0 6.7 18.2 4.5 21.1 6.5 L20.4 9.3 L22.5 11.1 C21.4 14.4 16.7 15.1 13.1 11.6 ZM12.7 13.0 C17.6 12.2 21.0 15.6 20.0 18.9 L17.2 19.1 L16.1 21.7 C12.6 21.7 10.5 17.4 12.7 13.0 ZM11.3 13.0 C13.5 17.4 11.4 21.7 7.9 21.7 L6.8 19.1 L4.0 18.9 C3.0 15.6 6.4 12.2 11.3 13.0 ZM10.9 11.6 C7.3 15.1 2.6 14.4 1.5 11.1 L3.6 9.3 L2.9 6.5 C5.8 4.5 10.0 6.7 10.9 11.6 Z'/>",
    pumpkin: "<path d='M12 7c-6 0-9 3-9 7s3 6 9 6 9-2 9-6-3-7-9-7zM12 7V4M9 11v3M15 11v3'/>",
    tree: "<path d='M12 3l5 7h-3l4 6H6l4-6H7zM12 16v5'/>",
    board: "<rect x='3' y='4' width='18' height='13' rx='1'/><path d='M8 21h8M12 17v4'/>",
    gamepad: "<rect x='3' y='8' width='18' height='10' rx='5'/><path d='M8 11v4M6 13h4M16 12h.01M18 14h.01'/>",
    paw: "<circle cx='7' cy='10' r='1.5'/><circle cx='12' cy='7' r='1.5'/><circle cx='17' cy='10' r='1.5'/><path d='M8 17c0-3 2-5 4-5s4 2 4 5c0 2-2 2-4 1-2 1-4 1-4-1z'/>",
    minus: "<path d='M4 12h16'/>",
    ring: "<circle cx='12' cy='12' r='8'/>",
    bulb: "<path d='M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10c1 1 1 2 1 3h6c0-1 0-2 1-3a6 6 0 0 0-4-10z'/>",
    dot: "<circle cx='12' cy='12' r='5' fill='black'/>",
    alarmclock: "<circle cx='12' cy='13' r='7'/><path d='M12 9v4l2 2M5 4 3 6M19 4l2 2'/>",
    chime: "<path d='M12 3v3M6 8h12M8 8v9M12 8v12M16 8v7'/>",
    siren: "<path d='M7 18v-6a5 5 0 0 1 10 0v6M5 18h14M12 3v2M4 7l1.5 1.5M20 7l-1.5 1.5'/>",
    sbell: "<path d='M4 17h16M6 17a6 6 0 0 1 12 0M12 7v4M10 7h4'/>",
    pin: "<path d='M12 21s-6-5.4-6-10a6 6 0 0 1 12 0c0 4.6-6 10-6 10z'/><circle cx='12' cy='11' r='2'/>",
    rows: "<rect x='3' y='5' width='18' height='14' rx='2'/><path d='M3 12h18'/>",
    cols: "<rect x='3' y='5' width='18' height='14' rx='2'/><path d='M12 5v14'/>",
    grid: "<rect x='4' y='4' width='16' height='16' rx='2'/><path d='M4 12h16M12 4v16'/>",
    sprout: "<path d='M12 21v-9'/><path d='M12 12c0-4 3-6 7-6 0 4-3 6-7 6z'/><path d='M12 14c0-3-2.5-5-6-5 0 3.5 2.5 5 6 5z'/>",
    bag: "<path d='M8 7V6a4 4 0 0 1 8 0v1'/><rect x='5' y='7' width='14' height='14' rx='3'/><path d='M9 14h6'/>",
    flower: "<circle cx='12' cy='12' r='2.5'/><path d='M12 9.5C10.5 7 10.5 4 12 3c1.5 1 1.5 4 0 6.5zM14.5 12c2.5-1.5 5.5-1.5 6.5 0-1 1.5-4 1.5-6.5 0zM12 14.5c1.5 2.5 1.5 5.5 0 6.5-1.5-1-1.5-4 0-6.5zM9.5 12C7 13.5 4 13.5 3 12c1-1.5 4-1.5 6.5 0z'/>",
    monitor: "<rect x='3' y='4' width='18' height='12' rx='2'/><path d='M8 20h8M12 16v4'/>",
    mic: "<rect x='9' y='3' width='6' height='11' rx='3'/><path d='M5 11a7 7 0 0 0 14 0M12 18v3'/>",
    toolbox: "<rect x='3' y='8' width='18' height='12' rx='2'/><path d='M9 8V6a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18'/>",
    save: "<path d='M5 3h11l3 3v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z'/><path d='M7 3v5h8V3M7 21v-7h10v7'/>",
    export: "<path d='M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3'/>",
    import: "<path d='M12 4v12M7 11l5 5 5-5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3'/>",
    copy: "<rect x='9' y='9' width='11' height='11' rx='2'/><path d='M5 15V6a2 2 0 0 1 2-2h9'/>",
    users: "<circle cx='9' cy='8' r='3.2'/><path d='M3 20v-1a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v1'/><path d='M16 4.5a3.2 3.2 0 0 1 0 6M18.5 14.5A5 5 0 0 1 21 19v1'/>",
    flask: "<path d='M9 3h6M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3'/><path d='M7.5 15h9'/>",
    file: "<path d='M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z'/><path d='M14 3v5h5M9 13h6M9 17h6'/>",
    edit: "<path d='M4 20h4L19 9l-4-4L4 16z'/><path d='m13.5 6.5 4 4'/>",
    search: "<circle cx='11' cy='11' r='6.5'/><path d='m20 20-4.2-4.2'/>",
    plus: "<path d='M12 5v14M5 12h14'/>",
    refresh: "<path d='M20 11a8 8 0 0 0-14.5-4M4 4v4h4'/><path d='M4 13a8 8 0 0 0 14.5 4M20 20v-4h-4'/>",
    megaphone: "<path d='M4 10v4h3l8 4V6L7 10z'/><path d='M18 9a4 4 0 0 1 0 6'/>",
    check: "<circle cx='12' cy='12' r='9'/><path d='m8 12.5 2.8 2.8L16 9.5'/>",
    image: "<rect x='3' y='4' width='18' height='16' rx='2'/><circle cx='9' cy='10' r='1.6'/><path d='m21 16-5-5-8 8'/>",
    printer: "<path d='M7 9V3h10v6'/><rect x='4' y='9' width='16' height='8' rx='2'/><path d='M7 14h10v7H7z'/>",
    hand: "<path d='M8 12V6a1.5 1.5 0 0 1 3 0v5M11 11V4.5a1.5 1.5 0 0 1 3 0V11M14 11V6a1.5 1.5 0 0 1 3 0v7a7 7 0 0 1-7 7h-1a6 6 0 0 1-5-3l-2-3.5a1.5 1.5 0 0 1 2.5-1.5L8 14'/>",
    type: "<path d='M4 7V5h16v2M12 5v14M9 19h6'/>",
    arrowup: "<path d='M12 19V5M6 11l6-6 6 6'/>",
    folder: "<path d='M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'/>",
    unlock: "<rect x='5' y='11' width='14' height='10' rx='2'/><path d='M8 11V8a4 4 0 0 1 7.5-2'/>",
    clipboard: "<rect x='5' y='4' width='14' height='17' rx='2'/><path d='M9 4h6v3H9zM9 12h6M9 16h6'/>",
    barchart: "<path d='M5 20V11M12 20V5M19 20v-6'/>",
    trend: "<path d='M3 17l6-6 4 4 8-8M15 7h6v6'/>",
    receipt: "<path d='M6 3h12v18l-3-2-3 2-3-2-3 2z'/><path d='M9 8h6M9 12h6'/>",
    speech: "<path d='M4 5h16v11H9l-5 4z'/>",
    archive: "<rect x='3' y='4' width='18' height='4' rx='1'/><path d='M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M10 12h4'/>",
    clock: "<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/>",
    trash: "<path d='M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3'/>",
    dice: "<rect x='3' y='3' width='18' height='18' rx='4'/><path d='M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01'/>",
    sparkle: "<path d='M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'/><path d='M19 16v4M17 18h4'/>",
    eye: "<path d='M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z'/><circle cx='12' cy='12' r='3'/>",
    star: "<path d='m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z'/>",
    skipback: "<path d='M19 5v14L8 12zM5 5v14'/>",
    play: "<path d='M7 4.5v15l12-7.5z'/>",
    back: "<path d='M17 4.5v15L5 12z'/>",
    shuffle: "<path d='M3 7h4c4 0 5 10 10 10h4M3 17h4c1.5 0 2.6-1 3.5-2.5M14 8.5C14.9 7.6 15.9 7 17 7h4M18 4l3 3-3 3M18 14l3 3-3 3'/>",
    repeat1: "<path d='M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H4M7 21l-3-3 3-3'/><path d='M11 10l1.5-1v5'/>",
    repeat: "<path d='M4 11V9a3 3 0 0 1 3-3h13M17 3l3 3-3 3M20 13v2a3 3 0 0 1-3 3H4M7 21l-3-3 3-3'/>",
    expand: "<path d='M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'/>",
    pause: "<path d='M8 5v14M16 5v14'/>",
    reset: "<path d='M4 12a8 8 0 1 0 2.6-5.9M4 4v5h5'/>",
    swap: "<path d='M4 8h15M15 4l4 4-4 4M20 16H5M9 12l-4 4 4 4'/>",
    bell: "<path d='M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 21h4'/>",
    next: "<path d='M5 5v14l11-7zM19 5v14'/>",
    close: "<path d='M6 6l12 12M18 6L6 18'/>",
    flag: "<path d='M5 21V4M5 4h11l-2 4 2 4H5'/>",
    spin: "<path d='M20 12a8 8 0 1 1-2.6-5.9M20 4v5h-5'/><circle cx='12' cy='12' r='2'/>",
    disc: "<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='3'/><path d='M12 3v4'/>",
    undo: "<path d='M9 14 4 9l5-5'/><path d='M4 9h10a6 6 0 0 1 0 12h-3'/>",
    volume: "<path d='M4 10v4h4l5 4V6l-5 4z'/><path d='M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11'/>",
    mute: "<path d='M4 10v4h4l5 4V6l-5 4z'/><path d='m17 9 5 6M22 9l-5 6'/>",
    glasses: "<circle cx='6.5' cy='14' r='3.5'/><circle cx='17.5' cy='14' r='3.5'/><path d='M10 14h4M3 14l1.5-6M21 14l-1.5-6'/>",
    ruler: "<rect x='2' y='8' width='20' height='8' rx='1.5'/><path d='M6 8v3M10 8v4M14 8v3M18 8v4'/>",
    ear: "<path d='M7 9a5 5 0 0 1 10 0c0 3-2 4-3 6a3 3 0 0 1-5.5 1.5'/><path d='M10 9a2 2 0 0 1 4 0'/>",
    thermo: "<path d='M10 14V5a2 2 0 0 1 4 0v9a4 4 0 1 1-4 0z'/><path d='M12 9v7'/>",
    alert: "<path d='M12 3.5 22 20H2z'/><path d='M12 10v5M12 17.5v.01'/>",
    info: "<circle cx='12' cy='12' r='9'/><path d='M12 11v5M12 7.5v.01'/>",
    lock: "<rect x='5' y='11' width='14' height='10' rx='2'/><path d='M8 11V8a4 4 0 0 1 8 0v3'/>",
    pulse: "<path d='M3 12h4l2-6 4 12 2-6h6'/>",
    train: "<rect x='5' y='3' width='14' height='14' rx='3'/><path d='M5 11h14M9 21l2-4M15 21l-2-4'/><path d='M9 14v.01M15 14v.01'/>",
    gift: "<rect x='3' y='8' width='18' height='4' rx='1'/><path d='M5 12v9h14v-9M12 8v13M12 8c-2-4-6-4-5-1.5 1 2 5 1.5 5 1.5zM12 8c2-4 6-4 5-1.5-1 2-5 1.5-5 1.5z'/>",
    map: "<path d='M9 4 3 6v14l6-2 6 2 6-2V4l-6 2z'/><path d='M9 4v14M15 6v14'/>",
    chair: "<path d='M7 3h10v8H7z'/><path d='M5 11h14v3H5zM8 14l-1 7M16 14l1 7'/>",
    target: "<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='5'/><path d='M12 12v.01'/>",
    bellOff: "<path d='M8.7 3A6 6 0 0 1 18 8c0 3 .6 5 1.5 6.5M6 8c0 7-3 9-3 9h13'/><path d='M10.3 21a1.9 1.9 0 0 0 3.4 0M2 2l20 20'/>",
    skipfwd: "<path d='M5 5v14l11-7zM19 5v14'/>",
    speaker: "<path d='M4 10v4h4l5 4V6l-5 4z'/>",
    calendar: "<rect x='3' y='5' width='18' height='16' rx='2'/><path d='M3 10h18M8 3v4M16 3v4'/>",
    cap: "<path d='M2 9l10-5 10 5-10 5z'/><path d='M6 11v5c3 2.5 9 2.5 12 0v-5'/>",
    share: "<circle cx='6' cy='12' r='2.5'/><circle cx='18' cy='6' r='2.5'/><circle cx='18' cy='18' r='2.5'/><path d='m8.2 10.8 7.6-3.6M8.2 13.2l7.6 3.6'/>",
    school: "<path d='M3 21V9l9-6 9 6v12z'/><path d='M9 21v-6h6v6'/>"
};
// タイマーやルーレットなど、文字が切り替わるボタンに付けるアイコン（ボタンごとに、文字から選びます）
const UIS_BTN_ICO = [
    { sel: "#btnRenameClass", map: [[/./, "edit"]] },
    { sel: "#btnDuplicateClass", map: [[/./, "copy"]] },
    { sel: "#btnArchiveClass", map: [[/去年度から戻/, "undo"], [/./, "archive"]] },
    { sel: "#btnExportYearCsv", map: [[/./, "export"]] },
    { sel: ".preset-dialog-btns button", map: [[/保存/, "save"], [/名前/, "edit"], [/複製/, "copy"]] },
    { sel: "#btnSsPause", map: [[/再開/, "play"], [/./, "pause"]] },
    { sel: ".sx-reset-btn", map: [[/./, "reset"]] },
    { sel: "#configContainer button[onclick=\"resetNominatedHistory()\"]", map: [[/./, "reset"]] },
    { sel: "#configContainer button[onclick*=\"openTimerBtnModal('preset')\"]", map: [[/./, "clock"]] },
    { sel: "#configContainer button[onclick*=\"openTimerBtnModal('add')\"]", map: [[/./, "plus"]] },
    { sel: ".announce-icon-btn", map: [[/終|やめ/, "compress"], [/./, "expand"]] },
    { sel: ".env-quit, .sj-x", map: [[/./, "close"]] },
    { sel: ".env-go", map: [[/./, "play"]] },
    { sel: "#btnMainNominate", map: [[/./, "target"]] },
    { sel: "#btnMegaRoulette", map: [[/./, "spin"]] },
    { sel: "#btnGiantNominate", map: [[/./, "target"]] },
    { sel: "#uisNomExit", map: [[/./, "close"]] },
    { sel: "button.calc-tool", map: [[/元に戻す/, "undo"], [/やり直し/, "redo"], [/履歴/, "clock"], [/メニュー/, "menu"]] },
    { sel: "#stickyModeBar button", map: [[/^やめる$/, "close"]] },
    { sel: ".modal-content button, #skinOverlay .skin-x", map: [[/^すべて開く$/, "arrowdown"], [/^すべて閉じる$/, "arrowup"], [/^重い機能だけ見る$/, "bolt"], [/^(閉じる|キャンセル|とじる)$/, "close"], [/^保存する$/, "save"], [/^すべて消す$/, "trash"], [/^元に戻す$/, "undo"], [/^やり直す$/, "redo"], [/予鈴を聞く|始まりを聞く|終わりを聞く/, "speaker"], [/この場所を空席にする/, "chair"], [/^名簿を書き出す/, "export"]] },
    { sel: "#btnEnvDraw", map: [[/./, "gift"]] },
    { sel: "#btnSeatJourney", map: [[/./, "train"]] },
    { sel: "#btnFortune", map: [[/./, "star"]] },
    { sel: "#btnNominateUndoMenu", map: [[/./, "undo"]] },
    { sel: "#btnSsMenu", map: [[/./, "monitor"]] },
    { sel: "#btnFuriToggle", map: [[/./, "type"]] },
    { sel: "#btnSavePng", map: [[/./, "image"]] },
    { sel: "#btnSavePdf", map: [[/./, "file"]] },
    { sel: "#btnShareMenu", map: [[/./, "share"]] },
    { sel: "#btnMoreStage", map: [[/./, "sparkle"]] },
    { sel: "#btnFullscreen", map: [[/終える|やめる/, "compress"], [/./, "expand"]] },
    { sel: "#configContainer button[onclick*=\"openStatsModal\"]", map: [[/./, "barchart"]] },
    { sel: "#configContainer #btnNomBalance", map: [[/./, "speech"]] },
    { sel: "#configContainer #btnFairness", map: [[/./, "receipt"]] },
    { sel: "#configContainer button[onclick*=\"openWagamamaModal\"]", map: [[/./, "hand"]] },
    { sel: "#configContainer #btnStickyList", map: [[/./, "clipboard"]] },
    { sel: "#configContainer button[onclick*=\"openAnnounce()\"]", map: [[/./, "megaphone"]] },
    { sel: "#configContainer #btnSeatSkin", map: [[/./, "palette"]] },
    { sel: "#configContainer button[onclick*=\"toggleThemeGallery\"]", map: [[/./, "image"]] },
    { sel: "#configContainer #btnSsOpen", map: [[/./, "monitor"]] },
    { sel: "#configContainer button[onclick*=\"openSeatSettingsModal\"]", map: [[/./, "chair"]] },
    { sel: "#configContainer button[onclick*=\"openLockModal\"]", map: [[/./, "lock"]] },
    { sel: "#configContainer #btnDiagnostics", map: [[/./, "pulse"]] },
    { sel: "#configContainer #btnPluginMenu", map: [[/./, "puzzle"]] },
    { sel: "#configContainer #updateInfoOpenBtn", map: [[/./, "clock"]] },
    { sel: "#configContainer #btnStartTour", map: [[/./, "map"]] },
    { sel: "#configContainer #btnProgramTimer", map: [[/./, "calendar"]] },
    { sel: "#configContainer .config-section-title", map: [[/よく使う/, "star"], [/^クラスと名簿/, "users"], [/名簿の入力/, "clipboard"], [/進級/, "cap"], [/座席のレイアウト/, "chair"], [/座席の見え方/, "eye"], [/席替えのルール/, "shuffle"], [/班のしくみ/, "users"], [/班の表示/, "palette"], [/席替えの演出/, "sparkle"], [/指名モード/, "target"], [/記録・統計/, "barchart"], [/画面のタイトル/, "type"], [/テーマと背景/, "image"], [/表示モード/, "monitor"], [/動作の軽さ/, "bolt"], [/タイマーの表示/, "clock"], [/アラーム/, "bell"], [/タイマーの特別/, "pulse"], [/バックアップ/, "save"], [/スプレッドシート/, "cloud"], [/印刷・共有/, "printer"], [/機能・プラグイン/, "puzzle"], [/ロックと管理/, "lock"], [/入力の補助/, "mic"], [/使い方/, "info"], [/管理者用/, "archive"]] },
    { sel: "#configContainer button[onclick*=\"openHistoryModal\"]", map: [[/./, "clock"]] },
    { sel: "#configContainer button[onclick*=\"openCacheRestoreModal\"]", map: [[/./, "archive"]] },
    { sel: "#configContainer button[onclick*=\"openBackupModal\"]", map: [[/./, "save"]] },
    { sel: "#configContainer #saveSpreadsheetBtn", map: [[/./, "save"]] },
    { sel: "#configContainer #loadSpreadsheetBtn", map: [[/./, "undo"]] },
    { sel: "#configContainer button[onclick=\"downloadAsCSV()\"]", map: [[/./, "export"]] },
    { sel: "#configContainer button[onclick*=\"openChartExportModal\"]", map: [[/./, "printer"]] },
    { sel: "#configContainer #btnShareChart", map: [[/./, "share"]] },
    { sel: "#configContainer #btnRosterExportMenu", map: [[/./, "export"]] },
    { sel: "#configContainer button[onclick*=\"openRosterEditor()\"]", map: [[/./, "edit"]] },
    { sel: "#configContainer button[onclick*=\"openRosterPasteModal\"]", map: [[/./, "clipboard"]] },
    { sel: "#configContainer button[onclick*=\"offlineFileInput\"]", map: [[/./, "import"]] },
    { sel: "#configContainer button[onclick*=\"openAbsentModal\"]", map: [[/./, "hand"]] },
    { sel: "#configContainer #connectGasBtn", map: [[/./, "cloud"]] },
    { sel: "#configContainer #connectOnlyGasBtn", map: [[/./, "link"]] },
    { sel: "#backupReminderBar button", map: [[/バックアップ/, "save"], [/あとで/, "clock"], [/しない/, "bellOff"]] },
    { sel: "#musicPrevBtn", map: [[/./, "skipback"]] },
    { sel: "#musicPlayBtn", map: [[/⏸/, "pause"], [/./, "play"]] },
    { sel: "#musicNextBtn", map: [[/./, "skipfwd"]] },
    { sel: ".music-vol > span", map: [[/🔈/, "speaker"], [/🔊/, "volume"]] },
    { sel: "#stickyModeBar", map: [[/^📝/, "edit"]] },
    { sel: ".sched-head", map: [[/^📅/, "calendar"]] },
    { sel: ".room-panel-head", map: [[/^🏫/, "school"]] },
    { sel: "#btnPromoteGo", map: [[/^🎓/, "cap"]] },
    { sel: "#shareNativeBtn", map: [[/^📲/, "share"]] },
    { sel: "#luckUndoBtn", map: [[/^↩/, "undo"]] },
    { sel: "#sjPlay", map: [[/^▶/, "play"]] },
    { sel: ".nom-progress-reset", map: [[/^🔁/, "repeat"]] },
    { sel: ".room-del", map: [[/^🗑/, "trash"]] },
    { sel: ".btn-giant-mode", map: [[/./, "expand"]] },
    { sel: "#timerStartBtn, #giantTimerStartBtn", map: [[/一時停止/, "pause"], [/./, "play"]] },
    { sel: "#timerPanel .btn-delete, #giantTimeOverlay .btn-delete", map: [[/リセット/, "reset"]] },
    { sel: "#timerModeSwitchBtn", map: [[/./, "swap"]] },
    { sel: "#giantLapBtn", map: [[/./, "flag"]] },
    { sel: "#timerPanel .btn-connect", map: [[/鳴らす/, "bell"], [/開始/, "play"]] },
    { sel: "#timerPanel .btn-secondary", map: [[/作成・編集/, "edit"]] },
    { sel: "#stepNextBtn", map: [[/./, "next"]] },
    { sel: ".btn-close-giant", map: [[/./, "close"]] },
    { sel: "#giantClockDisplay", at: /🕒\s*/, map: [[/./, "clock"]] },
    { sel: ".btn-clock-mode", map: [[/./, "clock"]] },
    { sel: "#giantTimeOverlay h4", map: [[/ラップ/, "flag"]] },
    { sel: "#giantEndTimeDisplay, #compactEndTimeDisplay", at: /🏁\s*/, map: [[/./, "flag"]] },
    { sel: "#btnSpinRoulette", map: [[/./, "spin"]] },
    { sel: "#btnRouletteStyle", map: [[/./, "disc"]] },
    { sel: "#btnRouletteUndo", map: [[/./, "undo"]] },
    { sel: "#btnRouletteSound", map: [[/なし/, "mute"], [/./, "volume"]] },
    { sel: "#rouletteOverlay .btn-secondary, #rouletteEditModal .btn-secondary", map: [[/^[＋+]\s*ボタンを追加/, "plus"]] }
];
// 文字の先頭に付いている、絵文字や記号（アイコンにするので取り除きます）
const UIS_BTN_LEAD = /^[\s★✖✕⏱⏳⏸▶⏮⏭🔈🔊💾🔕📝📅🏫🎓📲↩🗑🔁\ufe0f🔇🎡🥋🕒＋+]+/u;
// ボタンの先頭の絵文字と、線のアイコンの対応
const UIS_ICO_MAP = {
    "👥": "users", "🧪": "flask", "📄": "file", "📝": "edit", "🔍": "search", "🔎": "search", "➕": "plus", "🔄": "refresh", "♻": "refresh",
    "📣": "megaphone", "✅": "check", "🖼": "image", "🖨": "printer", "🙋": "hand", "✋": "hand", "🔤": "type", "⬆": "arrowup",
    "📁": "folder", "💾": "save", "🔓": "unlock", "📤": "export", "📥": "import", "📋": "clipboard", "📊": "barchart", "📈": "trend",
    "🧾": "receipt", "🗣": "speech", "🗄": "archive", "🕘": "clock", "🗑": "trash", "🎲": "dice", "🆕": "sparkle", "👁": "eye",
    "🍀": "star", "⏮": "skipback", "▶": "play", "◀": "back", "🔀": "shuffle", "🔁": "repeat", "🔂": "repeat1",
    "👓": "glasses", "📏": "ruler", "👂": "ear", "🤒": "thermo", "😷": "thermo", "↩": "undo", "🔳": "qr", "🎬": "film", "🍣": "disc", "📍": "map", "✨": "sparkle", "⚡": "bolt", "⭐": "star", "🏫": "school", "☁": "cloud", "📣": "megaphone", "🎰": "slot", "🥁": "drum", "🌫": "fog", "🃏": "card", "🚶": "walk", "📡": "radar", "🕹": "joystick", "💥": "burst", "🌀": "cyclone", "🌠": "meteor", "🌪": "tornado", "🎆": "fireworks", "⚽": "ball", "🔖": "bookmark", "🚀": "rocket", "🎭": "masks", "🛬": "plane", "🌌": "galaxy", "🍃": "leaf", "🌊": "wave", "🧱": "brick", "🐚": "shell", "💭": "bubble", "🕰": "pendulum", "🪙": "coin", "🧊": "ice", "🌈": "rainbow", "👾": "glitch", "🍮": "jelly", "🛑": "ban", "💎": "gem", "🌙": "moon", "🌸": "sakura", "🌷": "sprout", "🍂": "leaf", "⛄": "snow", "🎃": "pumpkin", "🎄": "tree", "🖍": "board", "🎮": "gamepad", "🐯": "paw", "🌱": "sprout", "🌲": "tree", "➖": "minus", "⭕": "ring", "💡": "bulb", "🔴": "dot", "⏰": "alarmclock", "🎐": "chime", "🚨": "siren", "🛎": "sbell", "⚠": "alert", "🤫": "lock", "🔔": "bell", "🩺": "pulse", "🔮": "sparkle",
    "🚃": "train", "🎁": "gift", "🗺": "map", "🪑": "chair", "🎯": "target", "📂": "folder", "📒": "file", "🔢": "hash", "🧽": "reset", "⬇": "arrowdown"
};
function uisIcoKey(s) { return UIS_ICO_MAP[String(s).replace(/[\uFE0F\u200D]/g, "")] || ""; }
// ボタンの先頭の絵文字を、線のアイコンに置きかえます
function uisBtnIconPass() {
    UIS_BTN_ICO.forEach(def => {
        let els;
        try { els = document.querySelectorAll(def.sel); } catch (e) { return; }
        els.forEach(el => {
            const text = (el.textContent || "").trim();
            const hit = def.map.find(m => m[0].test(text));
            if (!hit) return;
            const cur = el.querySelector(".pico[data-uis-btn]");
            if (cur) { if (cur.dataset.pico === hit[1]) return; cur.remove(); }
            let t = null;
            if (def.at) {
                const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
                let n;
                while ((n = w.nextNode())) { if (def.at.test(n.nodeValue)) { t = n; break; } }
                if (!t) return;
                t.nodeValue = t.nodeValue.replace(def.at, "");
            } else {
                t = uisFirstText(el);
                if (t) { const rem = t.nodeValue.replace(UIS_BTN_LEAD, ""); t.nodeValue = rem.trim() ? " " + rem : rem; }
            }
            const sp = document.createElement("span");
            sp.className = "pico";
            sp.dataset.pico = hit[1];
            sp.dataset.uisBtn = "1";
            sp.setAttribute("aria-hidden", "true");
            if (def.at && t) t.parentNode.insertBefore(sp, t); else el.insertBefore(sp, el.firstChild);
        });
    });
}
// 見出しの先頭の絵文字と、トースト通知の印を、線のアイコンにします
const UIS_HEAD_SEL = ".modal-content h2, .modal-content h3, .modal-content h4, .skin-head h3, .env-head h3, .sj-head h3, .music-dj-sec h4";
const UIS_TOAST_ICO = { success: "check", error: "close", warn: "alert", info: "info" };
function uisHeadToastPass() {
    document.querySelectorAll(UIS_HEAD_SEL).forEach(el => {
        if (el.querySelector(".pico[data-uis-head]")) return;
        const t = uisFirstText(el);
        if (!t) return;
        const m = t.nodeValue.match(UIS_EMO_RE);
        if (!m) return;
        const key = uisIcoKey(m[1]);
        if (!key) return;
        t.nodeValue = t.nodeValue.replace(UIS_EMO_RE, "");
        const sp = document.createElement("span");
        sp.className = "pico";
        sp.dataset.pico = key;
        sp.dataset.uisHead = "1";
        sp.setAttribute("aria-hidden", "true");
        t.parentNode.insertBefore(sp, t);
    });
    document.querySelectorAll("#toastContainer .toast:not(.uis-ti)").forEach(tn => {
        const ty = (tn.className.match(/toast-(\w+)/) || [])[1];
        tn.classList.add("uis-ti");
        const sp = document.createElement("span");
        sp.className = "pico";
        sp.dataset.pico = UIS_TOAST_ICO[ty] || "check";
        sp.setAttribute("aria-hidden", "true");
        tn.insertBefore(sp, tn.firstChild);
    });
}
// プルダウン（select）の項目に、線のアイコンを付けます。
// Chrome の「appearance: base-select」が使える場合だけ、項目の絵文字を線のアイコンに置きかえます。
const UIS_SEL_VAL = { modalAreaSelect: { none: "shuffle", fixed: "pin", row: "rows", col: "cols", priority: "glasses", customRC: "grid", customSeats: "target" } };
function uisSelectPass() {
    if (!(window.CSS && CSS.supports && CSS.supports("appearance", "base-select"))) return;
    document.querySelectorAll("select:not([multiple])").forEach(sel => {
        if (sel.size > 1) return;
        let any = false;
        const byVal = UIS_SEL_VAL[sel.id];
        sel.querySelectorAll("option").forEach(o => {
            if (o.querySelector(".pico")) { any = true; return; }
            const t = o.firstChild;
            if (!t || t.nodeType !== 3) return;
            let m = t.nodeValue.match(UIS_EMO_RE);
            let key = null;
            if (byVal && byVal[o.value]) {
                key = byVal[o.value];
                if (!m) m = ["", ""];
            } else {
                if (!m) return;
                key = uisIcoKey(m[1]);
            }
            if (!key) return;
            const ico = document.createElement("span");
            ico.className = "pico";
            ico.dataset.pico = key;
            ico.setAttribute("aria-hidden", "true");
            const emo = document.createElement("span");
            emo.className = "uis-emo";
            emo.textContent = m[1];
            t.nodeValue = t.nodeValue.slice(m[0].length);
            if (t.nodeValue && !/^\s/.test(t.nodeValue)) t.nodeValue = " " + t.nodeValue;
            o.insertBefore(emo, t);
            o.insertBefore(ico, emo);
            any = true;
        });
        sel.querySelectorAll("optgroup[label]").forEach(g => {
            if (g.querySelector(":scope > legend")) return;
            const m = g.label.match(UIS_EMO_RE);
            if (!m) return;
            const key = uisIcoKey(m[1]);
            if (!key) return;
            const lg = document.createElement("legend");
            const ico = document.createElement("span");
            ico.className = "pico";
            ico.dataset.pico = key;
            ico.setAttribute("aria-hidden", "true");
            lg.appendChild(ico);
            lg.appendChild(document.createTextNode(" " + g.label.slice(m[0].length).trim()));
            g.insertBefore(lg, g.firstChild);
        });
        if (!any) return;
        sel.classList.add("uis-bs");
        if (!sel.querySelector(":scope > button > selectedcontent")) {
            const b = document.createElement("button");
            b.type = "button";
            b.appendChild(document.createElement("selectedcontent"));
            sel.insertBefore(b, sel.firstChild);
        }
    });
}
// プルダウンが開いているときに、もう一度タッチ・クリックしたら閉じるようにします。
(function () {
    let wasOpen = null;
    const selOf = e => { const t = e.target; return t && t.closest && !t.closest("option, optgroup") ? t.closest("select.uis-bs") : null; };
    document.addEventListener("pointerdown", e => {
        const s = selOf(e);
        try { wasOpen = s && s.matches(":open") ? s : null; } catch (x) { wasOpen = null; }
    }, true);
    const stop = e => {
        const s = selOf(e);
        if (!s || s !== wasOpen) return;
        e.preventDefault();
        e.stopPropagation();
        const close = () => { try { if (s.matches(":open") && s.hidePicker) s.hidePicker(); } catch (x) { /* 何もしない */ } };
        [0, 30, 120].forEach(ms => setTimeout(close, ms));
    };
    document.addEventListener("mouseup", stop, true);
    document.addEventListener("touchend", e => { const s = selOf(e); if (s && s === wasOpen && e.cancelable) e.preventDefault(); }, { capture: true, passive: false });
    document.addEventListener("click", e => {
        const s = selOf(e);
        if (!s || s !== wasOpen) return;
        wasOpen = null;
        e.preventDefault();
        e.stopPropagation();
        try { if (s.matches(":open") && s.hidePicker) s.hidePicker(); } catch (x) { /* 何もしない */ }
    }, true);
})();
function uisIconPass() {
    uisBtnIconPass();
    try { uisSelectPass(); } catch (e) { /* 何もしない */ }
    uisHeadToastPass();
    document.querySelectorAll("#classroom button, .modal-content button, .modal-content label.chart-opt > span, #skinOverlay b, #announceOverlay button, #musicShuffleBtn, #musicRepeatBtn").forEach(el => {
        if (el.querySelector(":scope > .pico")) return;
        const t = uisFirstText(el);
        if (!t) return;
        const m = t.nodeValue.match(UIS_EMO_RE);
        if (!m) return;
        const key = uisIcoKey(m[1]);
        if (!key) return;
        const rest = (el.textContent || "").trim().length - m[0].trim().length;
        const keep = el.id === "musicShuffleBtn" || el.id === "musicRepeatBtn";
        if (rest <= 0 && !keep) return;
        if (el.id === "musicPlayBtn" || el.classList.contains("music-play")) return;
        const rem = t.nodeValue.replace(UIS_EMO_RE, "");
        t.nodeValue = rem.trim() ? " " + rem : rem;
        const sp = document.createElement("span");
        sp.className = "pico";
        sp.dataset.pico = key;
        sp.setAttribute("aria-hidden", "true");
        t.parentNode.insertBefore(sp, t);
    });
}
function uisPicoCss() {
    const ic = k => `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'>${UIS_PICO[k]}</svg>")`;
    let c = `body:is(.ui-style-a, .ui-style-b) .pico { font-size: 0; }\nbody:is(.ui-style-a, .ui-style-b) .pico::before { content: ""; display: inline-block; width: 16px; height: 16px; margin-right: 2px; vertical-align: -3px; background: currentColor; }\n`;
    c += `body:is(.ui-style-a, .ui-style-b) #giantTimeOverlay .pico::before { width: 30px; height: 30px; margin-right: 8px; vertical-align: -5px; }\nbody:is(.ui-style-a, .ui-style-b) #giantTimeOverlay #giantClockDisplay .pico::before { width: 56px; height: 56px; margin-right: 14px; vertical-align: 14px; }\nbody:is(.ui-style-a, .ui-style-b) #giantTimeOverlay .btn-close-giant .pico::before { width: 18px; height: 18px; margin-right: 4px; vertical-align: -3px; }\nbody:is(.ui-style-a, .ui-style-b) #giantTimeOverlay #giantEndTimeDisplay .pico::before { width: 44px; height: 44px; margin-right: 12px; vertical-align: -2px; }\nbody:is(.ui-style-a, .ui-style-b) #giantTimeOverlay h4 .pico::before { width: 20px; height: 20px; vertical-align: -3px; }\nbody:is(.ui-style-a, .ui-style-b) #rouletteOverlay .pico::before { width: 22px; height: 22px; margin-right: 6px; vertical-align: -4px; }\n`;
    c += `body:is(.ui-style-a, .ui-style-b) #giantTimeOverlay.clock-only #giantClockDisplay .pico::before { width: calc(var(--gu) * 9); height: calc(var(--gu) * 9); margin-right: calc(var(--gu) * 1.5); vertical-align: calc(var(--gu) * 0.6); }\n`;
    c += `body:is(.ui-style-a, .ui-style-b) .pico[data-uis-head]::before { width: 18px; height: 18px; margin-right: 6px; vertical-align: -3px; }\n`;
    c += `body:is(.ui-style-a, .ui-style-b) .toast > .pico::before { width: 14px; height: 14px; margin: 0; vertical-align: 0; }\n`;
    c += `body:is(.ui-style-a, .ui-style-b) #btnSpinRoulette .pico::before { width: 26px; height: 26px; margin-right: 6px; vertical-align: -5px; }\n`;
    Object.keys(UIS_PICO).forEach(k => { c += `body:is(.ui-style-a, .ui-style-b) .pico[data-pico="${k}"]::before { -webkit-mask: ${ic(k)} center/contain no-repeat; mask: ${ic(k)} center/contain no-repeat; }\n`; });
    return c;
}
function uisBuildCss() {
    const A = "body.ui-style-a:not(.blackboard-active):not(.nomination-active)";
    const B = "body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active)";
    const AS = "body.ui-style-a:not(.blackboard-active)";
    const BS = "body.ui-style-b.ui-style-b:not(.blackboard-active)";
    const AN = "body.ui-style-a.nomination-active";
    const BN = "body.ui-style-b.ui-style-b.nomination-active";
    const font = "'Hiragino Sans','Noto Sans JP','Yu Gothic','Meiryo',sans-serif";
    const fontB = "'Hiragino Maru Gothic ProN','Hiragino Sans','Noto Sans JP','Yu Gothic','Meiryo',sans-serif";
    const grp = n => ".seat.group-" + n;
    const eachGroup = fn => [1, 2, 3, 4, 5, 6, 7, 8].map(fn).join("\n");
    const notState = ":not(.is-fixed):not(.is-nominated):not(.is-shuffling-nominate)";
    let css = "";

    // ---------- A：テーマの色から、Aで使う色を作ります（古いブラウザでは、これまでの色になります）
    css += `
body.ui-style-a { --uis-on-accent: #FFFFFF; --uis-ink: #1D4ED8; --uis-accent-d: #1D4ED8; --uis-line: #DDE1E8; --uis-line2: #C9D0DB; --uis-line3: #EDF0F5; --uis-line4: #A8B1BF; --uis-soft0: #F8FAFC; --uis-soft: #F1F3F6; --uis-soft2: #E8EBF0; --uis-tint: #E8EEFC; --uis-mute: #64748B; --uis-mute2: #94A3B8; }
@supports (color: color-mix(in srgb, red, blue)) {
body.ui-style-a { --uis-line: var(--seat-border); --uis-line2: color-mix(in srgb, var(--seat-border) 92%, var(--text-main)); --uis-line3: color-mix(in srgb, var(--seat-border) 45%, var(--card-bg)); --uis-line4: color-mix(in srgb, var(--seat-border) 75%, var(--text-main)); --uis-soft0: color-mix(in srgb, var(--text-main) 3%, var(--card-bg)); --uis-soft: color-mix(in srgb, var(--text-main) 6%, var(--card-bg)); --uis-soft2: color-mix(in srgb, var(--text-main) 10%, var(--card-bg)); --uis-tint: color-mix(in srgb, var(--accent-color) 13%, var(--card-bg)); --uis-mute: color-mix(in srgb, var(--text-sub) 78%, var(--card-bg)); --uis-mute2: color-mix(in srgb, var(--text-sub) 60%, var(--card-bg)); }
}\n`;

    // ---------- 共通：「前（黒板）」の表示
    css += `#uiFrontLabel { display: none; }\n`;
    // タイマーの画面は、座席表より手前に出します（座席表のほうが前に出て、タイマーが隠れないように）
    css += `body.ui-style-a #timerPanel, body.ui-style-b #timerPanel { z-index: 140; max-height: calc(100vh - 110px); overflow-y: auto; }\n`;

    // ---------- A すっきり
    css += `
${A} { font-family: ${font}; }
${A} #topBarContainer { position: static; margin: -20px -20px 0; padding: 12px 24px 12px 128px; gap: 12px; flex-wrap: wrap; justify-content: flex-start; background: var(--card-bg); border-bottom: 1px solid var(--seat-border); }
${A} #topBarContainer .app-title { order: 0; flex: 0 1 auto; margin: 0 auto 0 0; max-width: none; font-size: 22px; font-weight: 800; letter-spacing: 0.02em; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${A} #topBarContainer .btn-secondary { background-color: var(--card-bg) !important; color: var(--text-main); border: 1px solid var(--uis-line2) !important; box-shadow: none !important; border-radius: 10px !important; padding: 8px 14px !important; font-weight: 600 !important; }
${A} #topBarContainer .btn-secondary:hover { background: rgba(100,116,139,0.12) !important; }
${A} .realtime-clock, ${A} .status-badge { box-shadow: none; backdrop-filter: none; border-radius: 10px; }
${A} .main-btn-wrapper { justify-content: flex-start; margin: 16px 0 6px !important; padding-left: 108px; gap: 12px; }
${A} .btn-main { width: auto; height: 52px; padding: 0 28px; border-radius: 12px; font-size: 18px; font-weight: 800; background-color: var(--accent-color) !important; color: var(--uis-on-accent); box-shadow: 0 1px 0 rgba(15,23,42,0.12); }
${A} .btn-main:hover { box-shadow: none; }
${A} .btn-nominate { width: auto; height: 52px; padding: 0 24px; border-radius: 12px; font-size: 17px; font-weight: 800; background-color: var(--card-bg) !important; color: var(--uis-ink); border: 1.5px solid var(--accent-color); box-shadow: none; }
${A} .btn-nominate:hover { background-color: rgba(36,87,214,0.12) !important; }
${A} .main-btn-wrapper .btn-secondary.btn-rounded-box { background-color: var(--card-bg) !important; color: var(--text-main); border: 1px solid var(--uis-line2) !important; box-shadow: none !important; height: 44px; padding: 0 16px !important; font-size: 15px !important; font-weight: 700 !important; border-radius: 10px !important; }
${A} .main-btn-wrapper .btn-secondary.btn-rounded-box:hover { background: rgba(100,116,139,0.12) !important; }
${A} #topBarContainer #btnLock.is-locked { background-color: #DC2626 !important; border: 1px solid #B91C1C !important; color: #FFFFFF !important; box-shadow: 0 0 0 3px rgba(220,38,38,0.25) !important; }
${A} #topBarContainer #btnLock.is-locked:hover { background-color: #B91C1C !important; }
${B} #topBarContainer #btnLock.is-locked { background-color: #B3402E !important; border: 2px solid #FFFFFF !important; color: #FFFFFF !important; box-shadow: 0 3px 0 #7A2E1E !important; }
${B} #topBarContainer #btnLock.is-locked:hover { background-color: #C4503D !important; }
${A} #uiFrontLabel { display: flex; align-items: center; gap: 14px; margin: 10px 0 0; color: var(--text-sub); font-size: 13px; font-weight: 700; letter-spacing: 0.3em; }
${A} #uiFrontLabel::before, ${A} #uiFrontLabel::after { content: ""; flex: 1 1 0; height: 1px; background: var(--seat-border); }
${AS} .seat { border: 1px solid var(--seat-border); border-radius: 12px; box-shadow: none; }
${AS} .seat.is-fixed { border: 2px solid var(--accent-color) !important; background-color: var(--uis-tint) !important; }
${AS} .seat.is-fixed .seat-no { color: var(--text-sub) !important; }
${AS} .seat.drag-over { border: 2px dashed var(--accent-color) !important; background-color: var(--uis-tint) !important; }
${AS} .seat[class*="group-"] .seat-name, ${AS} .seat.is-fixed .seat-name { color: var(--text-main) !important; }
${AS} .seat[class*="group-"] .seat-no { color: var(--text-sub) !important; }
${eachGroup(n => `${AS} ${grp(n)}${notState} { background-color: var(--card-bg) !important; border-color: var(--seat-border) !important; border-left: 6px solid var(--group-${n}-color) !important; }`)}
${eachGroup(n => `${AS} ${grp(n)}.is-fixed:not(.is-nominated):not(.is-shuffling-nominate) { background-color: var(--uis-tint) !important; border: 2px solid var(--accent-color) !important; border-left: 6px solid var(--group-${n}-color) !important; }`)}
`;

    // ---------- B 黒板
    css += `
${B} { font-family: ${fontB}; --body-bg: #E9DCC0; --card-bg: #FBF4E2; --text-main: #2B2118; --text-sub: #6B5A45; --accent-color: #2F4A3E; --seat-border: #C9A978; --input-bg: #FFFBEF; --input-text: #2B2118; }
${B} #topBarContainer { position: static; margin: -20px -20px 0; padding: 14px 24px 16px 128px; gap: 12px; flex-wrap: wrap; justify-content: flex-start; background: #2F4A3E; border: 10px solid #A97C4F; border-bottom: 0; box-shadow: inset 0 0 0 2px #1F3329; color: #F6F3E8; }
${B} #topBarContainer .app-title { order: 0; flex: 0 1 auto; margin: 0 auto 0 0; max-width: none; font-size: 32px; font-weight: 800; letter-spacing: 0.08em; color: #F6F3E8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
${B} #topBarContainer .btn-secondary { background-color: transparent !important; color: #DCE5D8; border: 2px solid #DCE5D8 !important; box-shadow: none !important; border-radius: 6px !important; padding: 6px 14px !important; font-weight: 700 !important; }
${B} #topBarContainer #timerPanel .btn-secondary { background-color: #F3F0E6 !important; color: #2B2118 !important; border: 1px solid #C9A978 !important; border-radius: 8px !important; box-shadow: none !important; font-weight: 700 !important; }
${B} #timerPanel { background: #FBF4E2; border: 2px solid #C9A978; border-radius: 8px; color: #2B2118; }
${B} #topBarContainer .btn-secondary:hover { background: rgba(255,255,255,0.14) !important; }
${B} .realtime-clock { background: transparent; color: #F9E79A; border: 0; box-shadow: none; backdrop-filter: none; font-size: 22px; font-weight: 700; }
${B} .status-badge { background: transparent; color: #DCE5D8; border: 1px solid rgba(220,229,216,0.5); box-shadow: none; backdrop-filter: none; border-radius: 6px; }
${B} .main-btn-wrapper { justify-content: flex-start; margin: 0 -20px 12px !important; padding: 12px 24px 12px 128px; gap: 12px; background: #8C6239; border: 10px solid #A97C4F; border-top: 4px solid #6F4A28; }
${B} .btn-main { width: auto; height: 46px; padding: 0 26px; border: 2px solid #FFFFFF; border-radius: 8px; font-size: 20px; font-weight: 800; background-color: #F9E79A !important; color: #2B2118; box-shadow: 0 3px 0 #BFA44A; }
${B} .btn-main:hover { background-color: #FFF0B0 !important; box-shadow: 0 3px 0 #BFA44A; }
${B} .btn-nominate { width: auto; height: 46px; padding: 0 22px; border: 2px solid #FFFFFF; border-radius: 8px; font-size: 18px; font-weight: 800; background-color: #F7B7C6 !important; color: #2B2118; box-shadow: 0 3px 0 #C4778B; }
${B} .btn-nominate:hover { background-color: #FBCBD6 !important; }
${B} .main-btn-wrapper .btn-secondary.btn-rounded-box { background-color: #F3F0E6 !important; color: #2B2118; border: 2px solid #FFFFFF !important; box-shadow: 0 3px 0 #B9B39E !important; height: 46px; padding: 0 18px !important; font-size: 16px !important; font-weight: 800 !important; border-radius: 8px !important; }
${B} .main-btn-wrapper .btn-secondary.btn-rounded-box:hover { background: #FFFFFF !important; }
${B} #uiFrontLabel { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; color: #6F4A28; font-size: 14px; font-weight: 800; }
${B} #uiFrontLabel::before { content: "\\25B2"; font-size: 12px; }
${BS} .seat { background-color: #FBF4E2; border: 2px solid #C9A978; border-bottom: 6px solid #B08B58; border-radius: 6px; box-shadow: none; }
${BS} .seat.is-fixed { background-color: #F3E3A8 !important; border-color: #2F4A3E !important; border-bottom-color: #1F3329 !important; }
${BS} .seat.is-fixed .seat-no { color: #6B5A45 !important; }
${BS} .seat.drag-over { background-color: #F3E3A8 !important; border: 2px dashed #2F4A3E !important; border-bottom-width: 6px !important; }
${eachGroup(n => `${BS} ${grp(n)}${notState} { background-color: #FBF4E2 !important; border-color: #C9A978 !important; border-bottom-color: #B08B58 !important; box-shadow: inset 0 7px 0 var(--group-${n}-color) !important; }`)}
${eachGroup(n => `${BS} ${grp(n)}.is-fixed:not(.is-nominated):not(.is-shuffling-nominate) { background-color: #F3E3A8 !important; border-color: #2F4A3E !important; border-bottom-color: #1F3329 !important; box-shadow: inset 0 7px 0 var(--group-${n}-color) !important; }`)}
`;

    // ---------- 広い画面（900px以上）：案の画面に合わせた並べ方
    const ICONS = {
        config: "<path d='M4 7h10M18 7h2M4 17h2M10 17h10'/><circle cx='16' cy='7' r='2'/><circle cx='8' cy='17' r='2'/>",
        calc: "<rect x='5' y='3' width='14' height='18' rx='2'/><path d='M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01'/>",
        music: "<path d='M9 18V6l10-2v12'/><circle cx='6.5' cy='18' r='2.5'/><circle cx='16.5' cy='16' r='2.5'/>",
        timer: "<circle cx='12' cy='13' r='8'/><path d='M12 9v4l3 2M9 2h6'/>",
        screen: "<rect x='3' y='4' width='18' height='12' rx='2'/><path d='M8 20h8M12 16v4'/>",
        back: "<path d='m15 18-6-6 6-6'/>",
        lock: "<rect x='5' y='11' width='14' height='9' rx='2'/><path d='M8 11V8a4 4 0 0 1 8 0v3'/>",
        expand: "<path d='M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5'/>",
        dice: "<rect x='3' y='3' width='18' height='18' rx='4'/><path d='M8 8h.01M16 8h.01M12 12h.01M8 16h.01M16 16h.01'/>",
        target: "<circle cx='12' cy='12' r='8'/><circle cx='12' cy='12' r='3'/><path d='M12 2v3M12 19v3M2 12h3M19 12h3'/>",
        undo: "<path d='M9 14 4 9l5-5'/><path d='M4 9h10a6 6 0 0 1 0 12h-3'/>",
        redo: "<path d='m15 14 5-5-5-5'/><path d='M20 9H10a6 6 0 0 0 0 12h3'/>",
        compress: "<path d='M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'/>",
        up: "<path d='m12 4-7 7M12 4l7 7M12 4v16'/>",
        down: "<path d='m6 9 6 6 6-6'/>"
    };
    const ic = k => `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'>${ICONS[k]}</svg>")`;
    const mask = k => `-webkit-mask: ${ic(k)} center/contain no-repeat; mask: ${ic(k)} center/contain no-repeat;`;
    const railIds = { configMenuBtn: ["config", "設定"], calcOpenBtn: ["calc", "電卓"], musicPlayerBtn: ["music", "音楽"], uisRailTimer: ["timer", "タイマー"], uisRailScreen: ["screen", "拡張画面"] };
    const tints = ["#FDECEC", "#FEF0E6", "#FBF3D6", "#E4F5EC", "#E3F1FF", "#F1E9F9", "#E0F5F2", "#FCE8F1"];
    const colsA = ["#E5484D", "#F76B15", "#D9A400", "#30A46C", "#0091FF", "#8E4EC6", "#12A594", "#E93D82"];
    const tapes = ["#E5726F", "#F2A25A", "#E5C646", "#7DBE7A", "#6BAEDB", "#A98AD1", "#5FB8B0", "#E58BB0"];
    const fillSel = "#classroom.uis-fill";
    css += `#uiRail, #uisClock, #uisClassChip, #uisBoardLine, #uisFooter, .uis-tray-btn, .uis-rail-btn, #uisNomHeader, #uisNomCard, #uisNomHist, #uisCfgHeader, #uisCfgFav { display: none; }\n`;
    css += `@media (min-width: 900px) {\n`;
    // --- 共通の部品
    css += [["a", A], ["b", B]].map(([k, P]) => `
${P} #uisClock { display: flex; align-items: baseline; gap: 10px; }
${P} .realtime-clock { padding: 0; margin: 0; background: transparent; border: 0; box-shadow: none; backdrop-filter: none; cursor: pointer; }
${P} .realtime-clock #realtimeClock, ${P} .realtime-clock #compactTimerStartBtn { display: none; }
${P} #smartTimerBox { order: 3; margin-left: auto; }
${P} #topBarContainer .app-title { order: 0; }
${P} #btnLock { order: 4; } ${P} #btnTopFullscreen { order: 5; }
${P} #classStatusBar:not(.is-trial) { display: none; }
${P} #classStatusBar { order: 2; }
${P} #uisClassChip { display: flex; align-items: center; gap: 8px; order: 1; cursor: pointer; font-family: inherit; }
${P} #uisClassChip::after { content: ""; width: 14px; height: 14px; background: currentColor; ${mask("down")} }
${P} .main-btn-wrapper { flex-wrap: nowrap; align-items: center; justify-content: flex-start; }
${P} #btnMainShuffle { order: 0; } ${P} #nominateMenuWrap { order: 1; } ${P} #moreMenuWrap { order: 4; }
${P} .main-btn-wrapper::after { content: ""; flex: 1 1 0; order: 8; }
${P} #btnUndo { order: 9; margin: 0 !important; } ${P} #btnRedo { order: 10; margin: 0 !important; }
${P} #btnMoreMenu { height: 52px; box-sizing: border-box; line-height: 48px; padding-top: 0; padding-bottom: 0; }
${P} #btnMainShuffle, ${P} #btnNominateMenu { line-height: 48px; padding-top: 0; padding-bottom: 0; }
${P} .pop-wrap { margin: 0; }
${P} #btnMainShuffle::before, ${P} #btnNominateMenu::before, ${P} #btnLock::before, ${P} #btnTopFullscreen::before, ${P} #btnUndo::before, ${P} #btnRedo::before { content: ""; display: inline-block; width: 16px; height: 16px; margin-right: 6px; vertical-align: -3px; background: currentColor; }
${P} #btnMainShuffle::before, ${P} #btnNominateMenu::before { width: 20px; height: 20px; margin-right: 8px; vertical-align: -4px; }
${P} #btnMainShuffle::before { ${mask("dice")} }
${P} #btnNominateMenu::before { ${mask("target")} }
${P} #btnLock::before { ${mask("lock")} }
${P} #btnTopFullscreen::before { ${mask("expand")} }
html:fullscreen ${P} #btnTopFullscreen::before { ${mask("compress")} }
${P} #btnUndo::before { ${mask("undo")} }
${P} #btnRedo::before { ${mask("redo")} }
${P} #classroom { transform: none; width: auto; box-sizing: border-box; }
${P} #classroom.uis-fill { height: var(--uis-ch, auto); box-sizing: border-box; margin-top: 0 !important; margin-bottom: 0 !important; width: auto; justify-content: stretch; align-content: stretch; grid-template-columns: repeat(var(--seat-cols, 6), minmax(0, 1fr)); grid-template-rows: repeat(var(--seat-rows, 6), minmax(0, 1fr)); }
${P} ${fillSel} .seat { aspect-ratio: auto !important; width: auto; height: auto; min-height: 0; min-width: 0; text-align: center; }
${P} ${fillSel} .seat:not(.number-only-huge) .seat-name { font-size: var(--uis-name, 22px) !important; font-weight: 800; line-height: 1.1; }
${P} ${fillSel} .seat-furi { font-size: calc(clamp(11px, calc(var(--uis-name, 20px) * 0.55), 18px) * var(--furi-k, 1)); font-weight: 600; line-height: 1.15; color: inherit; color: color-mix(in srgb, currentColor 82%, transparent); max-width: 96%; margin: 0 0 1px; letter-spacing: 0.02em; }
`).join("");
    // --- A：左のツールバー、上の帯、操作バー、座席のカード
    css += `
${A} { padding: 0 0 0 84px; }
${AS}.nomination-active .btn-config-toggle { display: flex !important; }
${AS} #uiRail { display: block; position: fixed; left: 0; top: 0; bottom: 0; width: 84px; z-index: 140; background: var(--card-bg); border-right: 1px solid var(--seat-border); }
${AS} .btn-config-toggle { position: fixed !important; left: 8px !important; top: var(--uis-top, 14px) !important; width: 68px; height: 64px; padding: 0 !important; border: 0 !important; border-radius: 12px !important; background: transparent !important; box-shadow: none !important; color: var(--text-sub) !important; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 0; z-index: 160; cursor: pointer; font-family: inherit; }
${AS} .btn-config-toggle::before { content: ""; width: 22px; height: 22px; background: currentColor; display: block; }
${AS} .btn-config-toggle::after { font-size: 12px; font-weight: 600; line-height: 1; content: ""; }
${AS} #configMenuBtn.has-update-badge::after { position: static; top: auto; right: auto; width: auto; height: auto; border-radius: 0; background: none; box-shadow: none; animation: none; }
${AS} #configMenuBtn.has-update-badge, ${AS} #configMenuBtn.has-update-badge:hover, ${AS} #configMenuBtn.has-update-badge.is-open { background-image: radial-gradient(circle at calc(50% + 15px) 14px, #ef4444 0 5px, #fff 5px 7px, transparent 7.5px) !important; }
body:has(#configMenuBtn.has-update-badge) ${AS} #uisTrayConfig, body:has(#configMenuBtn.has-update-badge) #uisTrayConfig { background-image: radial-gradient(circle at calc(100% - 8px) 8px, #ef4444 0 5px, #fff 5px 7px, transparent 7.5px) !important; }
${Object.keys(railIds).map(id => `${AS} #${id}::before { ${mask(railIds[id][0])} } ${AS} #${id}::after, ${AS} #${id}.is-playing::after, ${AS} #${id}.is-open::after { content: "${railIds[id][1]}"; }`).join("\n")}
${AS} .btn-config-toggle:hover { background: var(--uis-soft) !important; }
${AS} .btn-config-toggle.is-open, ${A} #musicPlayerBtn.is-playing { background: var(--uis-tint) !important; color: var(--uis-ink) !important; }
${AS} .btn-config-toggle.is-open::after { font-weight: 700; }
${AS} .uis-rail-btn { display: flex; }
${AS} .config-container { left: calc(-1 * var(--config-w, 340px) - 140px); } ${AS} .config-container.open { left: 84px; }
${A} #topBarContainer { margin: 0; height: 68px; box-sizing: border-box; padding: 0 28px; flex-wrap: nowrap; gap: 14px; align-items: center; justify-content: flex-start; background: transparent; border: 0; }
${A} #topBarContainer .app-title { flex: 0 0 auto; margin: 0; font-size: 22px; }
${A} #uisClassChip { height: 36px; padding: 0 14px 0 16px; border: 1px solid var(--uis-line2); border-radius: 999px; background: var(--card-bg); color: var(--text-main); font-size: 14px; font-weight: 700; }
${A} #uisClock .uis-time { font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-main); }
${A} #uisClock .uis-date { font-size: 13px; color: var(--text-main); }
${A} #topBarContainer .btn-secondary { height: 40px; box-sizing: border-box; padding: 0 14px !important; font-size: 14px !important; display: flex; align-items: center; }
${A} .main-btn-wrapper { margin: 0 !important; height: 64px; box-sizing: border-box; padding: 0 28px; gap: 12px; }
${A} #btnUndo, ${A} #btnRedo { height: 44px; box-sizing: border-box; padding: 0 14px !important; font-size: 14px !important; }
${A} #uisBoardLine { display: none; }
${A} #uiFrontLabel { display: flex; margin: 8px 28px 0; padding: 14px 22px 0; background: var(--card-bg); border: 1px solid var(--seat-border); border-bottom: 0; border-radius: 16px 16px 0 0; box-sizing: border-box; letter-spacing: 0.3em; color: var(--text-sub); }
${A} #uiFrontLabel::before, ${A} #uiFrontLabel::after { background: var(--uis-line2); }
${A} #classroom { margin: 0 28px !important; padding: 12px 22px 20px; box-sizing: border-box; background: var(--card-bg); border: 1px solid var(--seat-border); border-top: 0; border-radius: 0 0 16px 16px; gap: 12px; }
${A} #uisFooter { display: flex; height: 40px; align-items: center; justify-content: space-between; padding: 0 30px; font-size: 13px; color: var(--text-sub); }
${A} ${fillSel} .seat { display: grid; grid-template-columns: 1fr auto; grid-template-rows: auto auto 1fr auto; align-items: center; justify-items: stretch; padding: 8px 12px 6px; text-align: left; overflow: hidden; border-radius: 12px; }
${A} ${fillSel} .seat-position { position: static; grid-column: 2; grid-row: 1; justify-self: end; min-width: 22px; height: 22px; box-sizing: border-box; padding: 0 4px; margin: 0; border-radius: 6px; font-size: 12px; font-weight: 800; display: flex; align-items: center; justify-content: center; background: var(--uis-soft2); color: var(--text-main) !important; }
${A} ${fillSel} .seat-no { grid-column: 1; grid-row: 1; justify-self: start; font-size: 13px; color: var(--text-sub); font-weight: 600; }
${A} ${fillSel} .seat-furi { grid-column: 1 / -1; grid-row: 2; text-align: center; }
${A} ${fillSel} .seat:not(.number-only-huge) .seat-name { grid-column: 1 / -1; grid-row: 3; text-align: center; align-self: center; }
${A} ${fillSel} .seat::after { grid-column: 1 / -1; grid-row: 4; height: 0; font-size: 12px; text-align: center; color: var(--uis-mute); font-weight: 600; content: ""; }
${A} ${fillSel} .seat.is-fixed::after { content: "席を固定"; height: 14px; }
${A} ${fillSel} .seat.is-absent { background-color: var(--uis-soft) !important; border: 1px dashed var(--uis-line4) !important; color: var(--uis-mute); }
${A} ${fillSel} .seat.is-absent::after { content: "欠席"; height: 14px; position: static; min-width: 0; padding: 0; border-radius: 0; background: none; color: var(--uis-mute); font-size: 12px; font-weight: 600; line-height: 14px; }
${eachGroup(n => `${A} ${fillSel} ${grp(n)} .seat-position { background: ${tints[n - 1]}; background: color-mix(in srgb, var(--group-${n}-color) 22%, var(--card-bg)); }
${A} ${fillSel} ${grp(n)}${notState} { border-left-color: var(--group-${n}-color) !important; }`)}
`;
    // --- B：黒板、チョーク受け、机
    css += `
${B} { padding: 0; }
${B} #uiRail, ${B} .btn-config-toggle { display: none !important; }
${B} .config-container { left: calc(-1 * var(--config-w, 340px) - 140px); } ${B} .config-container.open { left: 0; }
${B} #topBarContainer { margin: 14px 18px 0; height: 130px; box-sizing: border-box; padding: 12px 28px 0; border: 12px solid #A97C4F; border-bottom: 0; border-radius: 6px 6px 0 0; background: #2F4A3E; box-shadow: inset 0 0 0 2px #1F3329; display: flex; flex-wrap: wrap; align-content: flex-start; align-items: center; gap: 10px 14px; position: static; }
${B} #topBarContainer .app-title { flex: 0 0 auto; margin: 0; font-size: 36px; letter-spacing: 0.08em; }
${B} #uisClassChip { height: 32px; padding: 0 16px; border: 2px solid #F6F3E8; border-radius: 6px; background: transparent; color: #F6F3E8; font-size: 16px; font-weight: 800; }
${A} #uisClassMenu { background: var(--card-bg); color: var(--text-main); border: 1px solid var(--uis-line2); border-radius: 14px; box-shadow: 0 12px 32px rgba(15,23,42,0.18); }
${A} #uisClassMenu .uis-cm-item:hover, ${A} #uisClassMenu .uis-cm-foot:hover { background: var(--uis-soft); }
${A} #uisClassMenu .uis-cm-item[aria-selected="true"] { background: var(--uis-tint); color: var(--uis-ink); }
${A} #uisClassMenu .uis-cm-head, ${A} #uisClassMenu summary, ${A} #uisClassMenu .uis-cm-n { color: var(--uis-mute); }
${B} #uisClassMenu { background: #FBF4E2; color: #2B2118; border: 2px solid #C9A978; border-radius: 8px; box-shadow: 0 10px 24px rgba(0,0,0,0.35); }
${B} #uisClassMenu .uis-cm-item:hover, ${B} #uisClassMenu .uis-cm-foot:hover { background: #EFE3C6; }
${B} #uisClassMenu .uis-cm-item[aria-selected="true"] { background: #2F4A3E; color: #F6F3E8; }
${B} #uisClassMenu .uis-cm-head, ${B} #uisClassMenu summary, ${B} #uisClassMenu .uis-cm-n { color: #7A6A52; }
${B} #uisClassMenu .uis-cm-item[aria-selected="true"] .uis-cm-n { color: #D8E2D4; }
#uisClassMenu { text-align: left; position: fixed; z-index: 4000; min-width: 260px; max-width: min(360px, 92vw); max-height: min(70vh, 520px); overflow-y: auto; padding: 8px; box-sizing: border-box; font-family: inherit; }
#uisClassMenu .uis-cm-head { padding: 6px 10px 8px; font-size: 12px; font-weight: 800; letter-spacing: 0.04em; }
#uisClassMenu button { all: unset; box-sizing: border-box; display: flex; align-items: center; gap: 10px; width: 100%; min-height: 44px; padding: 0 12px; border-radius: 10px; cursor: pointer; font-size: 15px; font-weight: 700; }
#uisClassMenu button:focus-visible { outline: 2px solid currentColor; outline-offset: -2px; }
#uisClassMenu .uis-cm-name { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#uisClassMenu .uis-cm-n { flex: none; font-size: 12px; font-weight: 600; }
#uisClassMenu .uis-cm-check { flex: none; }
#uisClassMenu summary { cursor: pointer; padding: 10px 12px; font-size: 12px; font-weight: 800; }
#uisClassMenu .uis-cm-foot { margin-top: 6px; border-top: 1px solid rgba(127,127,127,0.25); border-radius: 0 0 10px 10px; min-height: 44px; font-size: 13px; font-weight: 700; }
${B} #uisClassChip { gap: 10px; }
${B} #uisClassChip::after { width: 12px; height: 12px; }
${B} #uisClock .uis-time { font-size: 30px; font-weight: 700; color: #F9E79A; font-variant-numeric: tabular-nums; }
${B} #uisClock .uis-date { font-size: 15px; color: #DCE5D8; }
${B} #uisClock .uis-wd { display: none; }
${B} #topBarContainer .btn-secondary { height: 36px; box-sizing: border-box; padding: 0 14px !important; font-size: 14px !important; display: flex; align-items: center; }
${B} #uisBoardLine { display: block; flex: 0 0 100%; order: 9; margin: 0; text-align: left; font-size: 18px; color: #DCE5D8; }
${B} #uisBoardLine b { color: #F9E79A; font-weight: 800; }
${B} .main-btn-wrapper { margin: 0 18px !important; height: 78px; box-sizing: border-box; padding: 0 12px; gap: 14px; border: solid #A97C4F; border-width: 0 12px 12px; box-shadow: inset 0 4px 0 #6F4A28; border-radius: 0 0 6px 6px; background: #8C6239; }
${B} .btn-main { height: 46px; font-size: 20px; line-height: 42px; }
${B} #btnMoreMenu { line-height: 42px; }
${B} .btn-nominate { height: 46px; line-height: 42px; }
${B} .uis-tray-btn, ${B} #btnMoreMenu { display: block; height: 46px; box-sizing: border-box; padding: 0 18px !important; border: 2px solid #FFFFFF !important; border-radius: 8px !important; background: #F3F0E6 !important; color: #2B2118; font-size: 16px !important; font-weight: 800 !important; font-family: inherit; box-shadow: 0 3px 0 #B9B39E !important; cursor: pointer; white-space: nowrap; }
${B} #btnMoreMenu { display: none; }
${B} .uis-tray-btn:hover { background: #FFFFFF !important; }
${B} #uisTrayTimer { order: 2; background: #BFE3F4 !important; box-shadow: 0 3px 0 #7FA9BE !important; }
${B} #uisTrayConfig { order: 3; background: #C9E8C4 !important; box-shadow: 0 3px 0 #86AD81 !important; }
${B} #uisTrayCalc { order: 5; } ${B} #uisTrayMusic { order: 6; } ${B} #uisTrayScreen { order: 7; }
${B} #btnUndo, ${B} #btnRedo { height: 40px; box-sizing: border-box; padding: 0 16px !important; border: 2px dashed #F3E2C0 !important; border-radius: 8px !important; background: transparent !important; color: #F3E2C0 !important; box-shadow: none !important; font-size: 15px !important; font-weight: 700 !important; }
${B} #uiFrontLabel { display: flex; margin: 14px 18px 0; justify-content: flex-start; gap: 12px; font-size: 14px; font-weight: 800; color: #6F4A28; }
${B} #uiFrontLabel::before { content: ""; width: 18px; height: 18px; background: currentColor; ${mask("up")} }
${B} #classroom { margin: 8px 18px 0 !important; padding: 8px 0 0; box-sizing: border-box; gap: 10px 14px; }
${BS} ${fillSel} .seat { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; overflow: visible; background-color: #FBF4E2; border: 2px solid #C9A978; border-bottom: 6px solid #B08B58; border-radius: 6px; }
${B} ${fillSel} .seat { padding: 11px 0 2px; box-sizing: border-box; gap: 0; }
${B} ${fillSel} .seat .seat-no { line-height: 1.1; }
${B} ${fillSel} .seat-position { position: absolute; top: -7px; left: 50%; margin: 0 0 0 -22px; width: 44px; height: 16px; box-sizing: border-box; padding: 0; background: #E5C646; opacity: 0.92; border-radius: 0; font-size: 11px; font-weight: 800; line-height: 16px; text-align: center; color: #2B2118 !important; }
${B} ${fillSel} .seat-no { font-size: 12px; color: #6B5A45; font-weight: 700; }
${B} ${fillSel} .seat.is-absent { opacity: 0.55; border-style: dashed; }
${eachGroup(n => `${BS} ${fillSel} ${grp(n)}${notState} { box-shadow: none !important; }
${B} ${fillSel} ${grp(n)} .seat-position { background: ${tapes[n - 1]}; }`)}
`;
    // --- 指名中の画面（広い画面だけ。文字だけの指名と、電子黒板は、これまでのまま）
    const ANW = "body.ui-style-a.nomination-active:not(.blackboard-active):not(.text-only-mode)";
    const BNW = "body.ui-style-b.ui-style-b.nomination-active:not(.blackboard-active):not(.text-only-mode)";
    css += [["a", ANW], ["b", BNW]].map(([k, P]) => `
${P} #uisNomHeader { display: flex; }
${P} #uisNomCard { display: flex; }
${P} #uisNomHist { display: flex; }
${P} #nomProgressMode, ${P} #btnExitNomination { display: none !important; }
${P} .nominate-name-display { position: absolute; width: 1px; height: 1px; padding: 0 !important; margin: 0; opacity: 0; overflow: hidden; pointer-events: none; border: 0; }
${P} .nominate-display-area { translate: none; max-width: none; animation: none; z-index: 200; }
${P} .nom-giant-wrap { display: contents; }
${P} #btnNominateUndoMode { position: static; transform: none; backdrop-filter: none; }
${P} #classroom { transform: none; }
${P} #classroom.uis-fill { display: grid; height: var(--uis-ch, auto); box-sizing: border-box; width: auto; justify-content: stretch; align-content: stretch; grid-template-columns: repeat(var(--seat-cols, 6), minmax(0, 1fr)); grid-template-rows: repeat(var(--seat-rows, 6), minmax(0, 1fr)); }
${P} #classroom.uis-fill .seat { aspect-ratio: auto !important; width: auto; height: auto; min-height: 0; min-width: 0; padding: 0; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2px; opacity: 1 !important; scale: 1 !important; translate: 0 0 !important; filter: none !important; box-shadow: none !important; animation: none !important; overflow: hidden; }
${P} #classroom.uis-fill .seat-position, ${P} #classroom.uis-fill .seat-furi { display: none; }
${P} #classroom.uis-fill .seat .seat-no { font-size: 11px !important; font-weight: 700; color: inherit !important; }
${P} #classroom.uis-fill .seat:not(.number-only-huge) .seat-name { font-size: var(--uis-name, 15px) !important; font-weight: 800; color: inherit !important; line-height: 1.1; }
${P} #classroom.uis-fill .seat.is-nominated .seat-no { color: inherit !important; }
`).join("");
    css += `
${ANW} { padding: 74px 0 0 84px !important; background-color: var(--body-bg) !important; }
${ANW} #uisNomHeader { position: fixed; left: 84px; right: 0; top: 0; height: 68px; box-sizing: border-box; padding: 0 28px; align-items: center; gap: 14px; z-index: 10000; text-align: left; }
${ANW} .uis-nh-title { font-size: 22px; font-weight: 800; color: var(--text-main); }
${ANW} .uis-nh-pill { height: 32px; padding: 0 14px; border-radius: 999px; background: var(--uis-tint); color: var(--uis-ink); font-size: 14px; font-weight: 800; display: flex; align-items: center; gap: 8px; }
${ANW} .uis-nh-pill::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--accent-color); }
${ANW} .uis-nh-clock { margin-left: auto; font-size: 24px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--text-main); }
${ANW} #uisNomExit { height: 40px; padding: 0 16px; border: 1px solid var(--uis-line2); border-radius: 10px; background: var(--card-bg); color: var(--text-main); font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; }
${ANW} #uiFrontLabel { display: flex; margin: 0 468px 0 28px; padding: 14px 18px 0; background: var(--card-bg); border: 1px solid var(--seat-border); border-bottom: 0; border-radius: 16px 16px 0 0; box-sizing: border-box; letter-spacing: 0.3em; color: var(--text-sub); }
${ANW} #uiFrontLabel::before, ${ANW} #uiFrontLabel::after { background: var(--uis-line2); }
${ANW} #classroom { margin: 0 468px 0 28px !important; padding: 10px 18px 18px; box-sizing: border-box; background: var(--card-bg); border: 1px solid var(--seat-border); border-top: 0; border-radius: 0 0 16px 16px; gap: 8px; }
${ANW} .nominate-display-area { position: fixed; top: 74px; right: 28px; bottom: 24px; left: auto; width: 420px; gap: 14px; align-items: stretch; text-align: left; }
${ANW} #uisNomCard { flex-direction: column; gap: 6px; background: var(--accent-color); color: var(--uis-on-accent); border-radius: 16px; padding: 22px 24px 26px; flex: none; }
${ANW} #uisNomCard.is-rolling { background: var(--uis-tint); color: var(--uis-ink); }
${ANW} .uis-nc-cap-b { display: none; }
${ANW} .uis-nc-cap-a { font-size: 14px; font-weight: 700; opacity: 0.9; }
${ANW} .uis-nc-row { display: flex; flex-direction: column; align-items: flex-start; gap: 6px; }
${ANW} .uis-nc-no { font-size: 20px; font-weight: 700; min-height: 24px; }
${ANW} .uis-nc-nm { display: block; }
${ANW} .uis-nc-nm b { font-size: 64px; font-weight: 800; line-height: 1.1; letter-spacing: 0.04em; }
${ANW} .uis-nc-nm.is-long b { font-size: 48px; }
${ANW} .uis-nc-nm.is-prompt b { font-size: 30px; letter-spacing: 0; }
${ANW} .uis-nc-nm i { font-style: normal; font-size: 28px; margin-left: 8px; font-weight: 700; }
${ANW} .uis-nc-meta { margin-top: 10px; display: flex; gap: 8px; align-items: center; font-size: 14px; font-weight: 700; min-height: 24px; }
${ANW} .uis-nc-chip { height: 24px; padding: 0 10px; border-radius: 6px; background: var(--card-bg); color: var(--text-main); display: flex; align-items: center; }
${ANW} .nom-main-row { display: flex; flex-direction: column; align-items: stretch; gap: 14px; width: 100%; flex: 1 1 auto; min-height: 0; }
${ANW} #btnGiantNominate { height: 64px; width: 100%; padding: 0; border-radius: 14px; background: var(--text-main) !important; color: var(--card-bg); font-size: 20px; font-weight: 800; box-shadow: none; }
${ANW} #btnNominateUndoMode { height: 48px; width: 100%; border-radius: 12px; background: var(--card-bg); border: 1px solid var(--uis-line2); color: var(--text-main); font-size: 15px; font-weight: 700; }
${ANW} #uisNomHist { flex-direction: column; flex: 1 1 auto; min-height: 0; gap: 10px; background: var(--card-bg); border: 1px solid var(--seat-border); border-radius: 16px; padding: 14px 18px; overflow: hidden; }
${ANW} .uis-nh-head { display: flex; justify-content: space-between; font-size: 14px; font-weight: 800; }
${ANW} .uis-nh-head span:last-child { color: var(--text-sub); font-weight: 700; }
${ANW} .uis-nh-bar { height: 8px; border-radius: 999px; background: var(--uis-soft2); overflow: hidden; flex: none; }
${ANW} .uis-nh-bar i { display: block; height: 100%; background: var(--accent-color); }
${ANW} .uis-nh-chips { display: flex; flex-wrap: wrap; gap: 8px; align-content: flex-start; overflow: hidden; }
${ANW} .uis-nh-chips span { height: 30px; padding: 0 12px; border-radius: 999px; background: var(--uis-soft); color: var(--text-sub); font-size: 14px; font-weight: 700; display: flex; align-items: center; }
${ANW} .uis-nh-chips span.is-last { background: var(--uis-tint); color: var(--uis-ink); font-weight: 800; }
${ANW} .uis-nh-note { margin-top: auto; font-size: 13px; color: var(--uis-mute); }
${ANW} #classroom.uis-fill .seat { background: var(--card-bg) !important; color: var(--text-main); border: 1px solid var(--seat-border) !important; border-bottom: 4px solid var(--uis-gc, var(--seat-border)) !important; border-radius: 10px; }
${ANW} #classroom.uis-fill .seat.is-already-nominated { background: var(--uis-soft) !important; color: var(--uis-mute2); }
${ANW} #classroom.uis-fill .seat.is-nominated, ${ANW} #classroom.uis-fill .seat.is-shuffling-nominate { background: var(--accent-color) !important; color: var(--uis-on-accent); border-color: var(--uis-accent-d) !important; --uis-gc: var(--uis-accent-d); }
${eachGroup(n => `${ANW} #classroom.uis-fill ${grp(n)} { --uis-gc: var(--group-${n}-color); }`)}
${ANW} #classroom.uis-fill .seat.is-nominated, ${ANW} #classroom.uis-fill .seat.is-shuffling-nominate { --uis-gc: var(--uis-accent-d) !important; }

${BNW} { padding: 326px 0 0 !important; background-color: #E9DCC0 !important; }
${BNW} #uisNomHeader { position: fixed; left: 54px; right: 54px; top: 38px; height: 34px; align-items: center; justify-content: space-between; z-index: 10000; text-align: left; }
${BNW} .uis-nh-left { display: flex; gap: 12px; align-items: center; }
${BNW} .uis-nh-title { font-size: 18px; font-weight: 800; color: #F6F3E8; }
${BNW} .uis-nh-pill { height: 26px; padding: 0 12px; border: 2px solid #F9E79A; border-radius: 6px; color: #F9E79A; font-size: 14px; font-weight: 800; display: flex; align-items: center; box-sizing: border-box; }
${BNW} .uis-nh-clock { display: none; }
${BNW} #uisNomExit { height: 34px; padding: 0 14px; border: 2px solid #DCE5D8; border-radius: 6px; background: transparent; color: #DCE5D8; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer; }
${BNW} #uiFrontLabel { display: none; }
${BNW} .nominate-display-area { position: fixed; top: 14px; left: 18px; right: 18px; bottom: auto; height: 300px; width: auto; box-sizing: border-box; background: #2F4A3E; border: 12px solid #A97C4F; border-radius: 6px; box-shadow: inset 0 0 0 2px #1F3329; align-items: center; justify-content: center; gap: 0; padding-bottom: 40px; }
${BNW} #uisNomCard { flex-direction: column; align-items: center; color: #F6F3E8; }
${BNW} .uis-nc-cap-a, ${BNW} .uis-nc-meta { display: none; }
${BNW} .uis-nc-cap-b { display: block; font-size: 20px; color: #DCE5D8; font-weight: 700; margin-bottom: 8px; }
${BNW} .uis-nc-row { display: flex; align-items: baseline; justify-content: center; gap: 20px; }
${BNW} .uis-nc-no { font-size: 36px; font-weight: 700; color: #F9E79A; }
${BNW} .uis-nc-nm b { font-size: 112px; font-weight: 800; letter-spacing: 0.08em; line-height: 1.15; }
${BNW} .uis-nc-nm.is-long b { font-size: 84px; }
${BNW} .uis-nc-nm.is-prompt b { font-size: 56px; letter-spacing: 0.02em; }
${BNW} .uis-nc-nm i { font-style: normal; font-size: 40px; font-weight: 700; margin-left: 12px; }
${BNW} #uisNomCard.is-rolling .uis-nc-nm { opacity: 0.7; }
${BNW} .nom-main-row { position: absolute; left: 0; right: 0; bottom: 0; height: 56px; background: #8C6239; box-shadow: inset 0 4px 0 #6F4A28; display: flex; flex-direction: row; align-items: center; justify-content: center; gap: 16px; }
${BNW} #btnGiantNominate { height: 40px; padding: 0 28px; border: 2px solid #FFFFFF; border-radius: 8px; background: #F9E79A !important; color: #2B2118; font-size: 18px; font-weight: 800; box-shadow: 0 3px 0 #BFA44A; }
${BNW} #btnNominateUndoMode { height: 40px; padding: 0 20px; border: 2px solid #FFFFFF; border-radius: 8px; background: #F3F0E6; color: #2B2118; font-size: 15px; font-weight: 800; box-shadow: 0 3px 0 #B9B39E; }
${BNW} #uisNomHist { flex-direction: row; background: transparent; border: 0; padding: 0; margin-left: 8px; }
${BNW} .uis-nh-head { display: flex; gap: 8px; font-size: 14px; color: #F3E2C0; }
${BNW} .uis-nh-bar, ${BNW} .uis-nh-chips, ${BNW} .uis-nh-note { display: none; }
${BNW} #classroom { margin: 0 18px 0 !important; padding: 0; box-sizing: border-box; gap: 8px 12px; }
${BNW} #classroom.uis-fill .seat { background: #FBF4E2 !important; color: #2B2118; border: 2px solid #C9A978 !important; border-bottom: 5px solid #B08B58 !important; border-radius: 6px; }
${BNW} #classroom.uis-fill .seat.is-already-nominated { background: #D9CDB3 !important; color: #8A7B62; }
${BNW} #classroom.uis-fill .seat.is-nominated, ${BNW} #classroom.uis-fill .seat.is-shuffling-nominate { background: #F9E79A !important; border-color: #BFA44A !important; }
`;
    // --- 設定の画面（広い画面だけ）：全画面で開き、左に分類、右にカードを2列で並べます
    const CWA = "body.ui-style-a:not(.blackboard-active).config-wide";
    const CWB = "body.ui-style-b.ui-style-b:not(.blackboard-active).config-wide";
    css += [["a", CWA], ["b", CWB]].map(([k, P]) => `
${P} .config-container { left: -100vw; width: 100vw; max-width: none; height: 100vh; border-radius: 0; border: 0; box-shadow: none; z-index: 170; backdrop-filter: none; overflow-x: hidden; overflow-y: auto; display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); grid-template-rows: none; grid-auto-rows: auto; column-gap: 16px; row-gap: 0; align-content: start; padding: 72px 28px 24px 296px !important; text-align: left; }
${P} .config-container.open { left: 0; }
${P} .config-container:not(.open) > #uisCfgHeader, ${P} .config-container:not(.open) > .config-search, ${P} .config-container:not(.open) > #uisCfgNav { visibility: hidden; }
${P} .config-container > #uisCfgHeader { display: flex; position: fixed; left: 0; right: 0; top: 0; z-index: 8; align-items: center; gap: 16px; padding: 0 28px; box-sizing: border-box; height: 72px; }
${P} #uisCfgHeader h1 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0; }
${P} #uisCfgBack { width: auto !important; height: 40px; margin: 0 !important; padding: 0 14px 0 10px !important; display: flex; align-items: center; gap: 6px; font-size: 14px !important; font-weight: 700; font-family: inherit; cursor: pointer; }
${P} #uisCfgBack::before { content: ""; width: 16px; height: 16px; background: currentColor; -webkit-mask: ${ic("back")} center/contain no-repeat; mask: ${ic("back")} center/contain no-repeat; }
${P} .config-container > .config-search { position: fixed; top: 14px; left: 218px; z-index: 9; width: 520px; max-width: calc(100vw - 260px); margin: 0 !important; padding: 0; background: transparent; }
${P} .config-container > .config-search input[type="search"] { height: 44px; border-radius: 12px; font-size: 15px; padding: 0 14px; }
${P} #btnConfigWide, ${P} #configWideNav, ${P} .config-container > .config-group-title { display: none !important; }
${P} .config-container > #configSearchEmpty { grid-column: 1 / -1; grid-row: 2; }
${P} .config-container > #uisCfgNav { display: flex; flex-direction: column; gap: 4px; position: fixed; left: 0; top: 72px; bottom: 0; width: 280px; z-index: 7; overflow-y: auto; padding: 20px 16px 110px; box-sizing: border-box; }
${P} #configContainer:not(.open) > .config-credit { display: none !important; }
${P} #configContainer > .config-credit { display: block; position: fixed; left: 0; bottom: 0; width: 280px; box-sizing: border-box; grid-column: auto; grid-row: auto; margin: 0; padding: 14px 24px 18px; text-align: left; background: inherit; border-top: 1px dashed var(--uis-line2, #CBD2DC); z-index: 8; }
${P} .config-container.cfg-searching > .config-section, ${P} .config-container.cfg-searching > .config-section.uis-show:not(.is-search-hidden), ${P} .config-container.cfg-searching > #favSection, ${P} .config-container.cfg-searching > #uisCfgFav { display: none !important; }
${P} .config-container > #cfgSearchPanel { grid-column: 1 / -1; grid-row: auto; position: static; max-height: none; overflow: visible; padding: 18px 22px 20px; margin: 16px 0; border-radius: 16px; box-sizing: border-box; }
${P} .config-container > #cfgSearchPanel[hidden] { display: none; }
${P} .config-container > #uisCfgFav { display: flex; grid-column: 1 / -1; grid-row: 1; flex-direction: column; gap: 8px; padding: 20px 0 16px; }
${P} .uis-fav-label { font-size: 13px; font-weight: 800; }
${P} .uis-fav-row { display: flex; flex-wrap: wrap; gap: 10px; }
${P} #uisCfgFav button { width: auto !important; margin: 0 !important; height: 40px; padding: 0 16px !important; border-radius: 999px !important; font-size: 14px !important; font-weight: 700; font-family: inherit; cursor: pointer; }
${P} #uisCfgNav button.config-nav-item { height: 48px; padding: 0 14px !important; display: flex !important; align-items: center; gap: 12px; font-size: 15px !important; font-weight: 600; border: 0 !important; border-radius: 10px !important; background: transparent !important; box-shadow: none !important; margin: 0 !important; flex: none; width: 100% !important; text-align: left; font-family: inherit; cursor: pointer; }
${P} #uisCfgNav button.config-nav-item::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: var(--uis-line2, #CBD2DC); flex: none; }
${P} #uisCfgNav button.config-nav-item[aria-current="true"] { font-weight: 800; }
${P} .uis-nav-count { margin-left: auto; font-size: 12px; font-weight: 600; color: var(--uis-mute, #64748B); }
${P} .config-container > .config-section { display: none !important; }
${P} .config-container > .config-section.uis-show:not(.is-search-hidden) { display: block !important; zoom: 1; grid-column: auto; grid-row: auto; margin: 0 0 16px !important; padding: 18px 22px 20px; border-radius: 16px; box-sizing: border-box; scroll-margin-top: 88px; min-width: 0; }
${P} .uis-show > h3 { font-size: 18px; font-weight: 800; margin: 0 0 6px; cursor: default; pointer-events: none; }
${P} .uis-show > h3 .config-section-toggle { display: none !important; }
${P} .uis-show > .config-section-body { max-height: none !important; opacity: 1 !important; overflow: visible !important; }
${P} .uis-desc { display: none; }
${P} .uis-show > .uis-desc { display: block; margin: 0 0 8px; font-size: 13px; color: var(--uis-mute, #64748B); }
${P} .uis-show .switch-container:has(> label.switch:first-child) { flex-direction: row-reverse; justify-content: space-between; min-height: 52px; margin: 0 !important; border-top: 1px solid var(--uis-line3, #EDF0F5); }
${P} .uis-show .switch-container:has(> label.switch:first-child) .switch-label { flex: 1 1 auto; font-size: 15px; font-weight: 700; }
${P} .uis-show .switch-label { color: inherit !important; }
${P} .uis-show .slider-control-group { background: transparent; border: 1px solid var(--uis-line, #DDE1E8); }
${P} .uis-show .input-label { font-size: 14px; font-weight: 700; color: inherit; }
${P} .uis-show button.btn-secondary { height: 44px; box-sizing: border-box; padding: 0 18px !important; border-radius: 10px !important; font-size: 15px !important; font-weight: 700 !important; text-align: center; box-shadow: none !important; }
@keyframes uisFlash { 0% { box-shadow: 0 0 0 4px rgba(36, 87, 214, 0.45); } 100% { box-shadow: 0 0 0 0 rgba(36, 87, 214, 0); } }
${P} .config-section.uis-flash { animation: uisFlash 1.2s ease-out 1; }
`).join("");
    css += `
${CWA} .config-container { background: var(--body-bg); }
${CWA} .config-container > #uisCfgHeader { background: var(--card-bg); border-bottom: 1px solid var(--seat-border); }
${CWA} #uisCfgBack { border: 1px solid var(--uis-line2) !important; border-radius: 10px !important; background: var(--card-bg) !important; color: var(--text-main) !important; }
${CWA} .config-container > .config-search input[type="search"] { background: var(--uis-soft0); border: 1px solid var(--uis-line2); }
${CWA} #uisCfgNav button.config-nav-item { color: var(--text-main) !important; }
${CWA} #uisCfgNav button.config-nav-item:hover { background: var(--uis-soft2) !important; }
${CWA} #uisCfgNav button.config-nav-item[aria-current="true"] { background: var(--uis-tint) !important; color: var(--uis-ink) !important; }
${CWA} #uisCfgNav button.config-nav-item[aria-current="true"]::before { background: var(--accent-color); }
${CWA} .config-container > #cfgSearchPanel { background: var(--card-bg); border: 1px solid var(--seat-border); }
${CWA} .config-container > .config-section.uis-show:not(.is-search-hidden) { background: var(--card-bg) !important; border: 1px solid var(--seat-border) !important; box-shadow: none; }
${CWA} .uis-fav-label { color: var(--text-sub); }
${CWA} #uisCfgFav button { border: 1px solid var(--uis-line2) !important; background: var(--card-bg) !important; color: var(--text-main) !important; }
${CWA} .uis-show button.btn-secondary { background: var(--card-bg) !important; color: var(--text-main) !important; border: 1px solid var(--uis-line2) !important; }
${CWB} .config-container { background: #E9DCC0; padding-top: 84px !important; }
${CWB} .config-container > #uisCfgHeader { background: #2F4A3E; color: #F6F3E8; border-bottom: 12px solid #A97C4F; box-sizing: border-box; height: 84px; }
${CWB} .config-container > .config-search { top: 10px; }
${CWB} .config-container > #uisCfgNav { top: 84px; }
${CWB} #uisCfgHeader h1 { color: #F6F3E8; letter-spacing: 0.08em; }
${CWB} #uisCfgBack { border: 2px solid #DCE5D8 !important; border-radius: 6px !important; background: transparent !important; color: #DCE5D8 !important; }
${CWB} .config-container > .config-search input[type="search"] { background: #FFFBEF; border: 2px solid #C9A978; border-radius: 6px; }
${CWB} #uisCfgNav button.config-nav-item { color: #2B2118 !important; border-radius: 6px !important; }
${CWB} #uisCfgNav button.config-nav-item:hover { background: #F3E7C9 !important; }
${CWB} #uisCfgNav button.config-nav-item[aria-current="true"] { background: #2F4A3E !important; color: #F6F3E8 !important; }
${CWB} #uisCfgNav button.config-nav-item[aria-current="true"]::before { background: #F9E79A; }
${CWB} #uisCfgNav button.config-nav-item[aria-current="true"] .uis-nav-count { color: #DCE5D8; }
${CWB} .config-container > #cfgSearchPanel { background: #FBF4E2; border: 2px solid #C9A978; border-radius: 6px; color: #2B2118; }
${CWB} .config-container > .config-section.uis-show:not(.is-search-hidden) { background: #FBF4E2 !important; border: 2px solid #C9A978 !important; border-radius: 6px; box-shadow: none; }
${CWB} .uis-fav-label { color: #6F4A28; }
${CWB} #uisCfgFav button { border: 2px solid #FFFFFF !important; border-radius: 8px !important; background: #F3F0E6 !important; color: #2B2118 !important; box-shadow: 0 3px 0 #B9B39E; }
${CWB} .uis-show button.btn-secondary { background: #F3F0E6 !important; color: #2B2118 !important; border: 2px solid #C9A978 !important; }
${CWB} .uis-show .switch-container:has(> label.switch:first-child) { border-top-color: #E3D3B0; }
${CWB} .uis-show .slider-control-group { border-color: #C9A978; }
`;
    css += `}\n`;
    // 設定の2列表示（左に分類、右に内容）のなかみの色
    css += `
${AS}.config-wide .config-container button.config-nav-item { border-radius: 10px !important; }
${AS}.config-wide .config-container button.config-nav-item[aria-current="true"] { background: var(--uis-tint) !important; color: var(--uis-ink) !important; border-color: transparent !important; box-shadow: none !important; font-weight: 800; }
${BS}.config-wide .config-container button.config-nav-item { border-radius: 6px !important; }
${BS}.config-wide .config-container button.config-nav-item[aria-current="true"] { background: #2F4A3E !important; color: #F6F3E8 !important; border-color: #A97C4F !important; box-shadow: none !important; }
`;
    // ---------- 指名中の画面
    css += `
${AN} { background-color: var(--body-bg) !important; font-family: ${font}; }
${AN} .nominate-display-area { max-width: 760px; bottom: 24px; }
${AN}.text-only-mode .nominate-display-area { bottom: auto; }
${AN}.text-only-mode .nominate-name-display { font-size: 72px; padding: 28px 64px; }
${AN} .nominate-name-display { background: var(--accent-color); color: var(--uis-on-accent); text-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; border: 0; border-radius: 16px; font-size: 36px; padding: 12px 40px; box-shadow: none; }
${AN} .nominate-name-display.is-rolling { background: var(--uis-tint); color: var(--uis-ink); text-shadow: none; }
${AN} .nominate-name-display.is-decided { background: var(--accent-color); color: var(--uis-on-accent); box-shadow: none; scale: 1.04; }
${AN} .btn-nominate-giant { background-color: var(--text-main) !important; color: var(--card-bg); border-radius: 14px; font-size: 22px; font-weight: 800; padding: 16px 44px; box-shadow: none; }
${AN} .nom-record-toggle { background: var(--card-bg); color: var(--text-main); border: 1px solid var(--uis-line2); backdrop-filter: none; }
${AN} .seat.is-shuffling-nominate { box-shadow: 0 0 0 3px var(--accent-color) !important; }
${AN} .seat.is-nominated { box-shadow: 0 0 0 4px var(--accent-color) !important; animation: none !important; }
${BN} { background-color: #E9DCC0 !important; font-family: ${fontB}; }
${BN} .nominate-display-area { max-width: 820px; bottom: 16px; gap: 12px; }
${BN}.text-only-mode .nominate-display-area { bottom: auto; }
${BN}.text-only-mode .nominate-name-display { font-size: 80px; padding: 24px 72px; }
${BN} .nominate-name-display { background: #2F4A3E; color: #F6F3E8; text-shadow: none; backdrop-filter: none; -webkit-backdrop-filter: none; border: 6px solid #A97C4F; border-radius: 6px; font-size: 40px; letter-spacing: 0.08em; padding: 6px 44px; box-shadow: inset 0 0 0 2px #1F3329; }
${BN} .nominate-name-display.is-rolling { background: #2F4A3E; color: #DCE5D8; text-shadow: none; }
${BN} .nominate-name-display.is-decided { background: #2F4A3E; color: #F9E79A; box-shadow: inset 0 0 0 2px #1F3329; scale: 1.04; }
${BN} .btn-nominate-giant { background-color: #F9E79A !important; color: #2B2118; border: 2px solid #FFFFFF; border-radius: 8px; font-size: 20px; font-weight: 800; padding: 10px 40px; box-shadow: 0 3px 0 #BFA44A; }
${BN} .nom-record-toggle { background: #F3F0E6; color: #2B2118; border: 2px solid #FFFFFF; backdrop-filter: none; }
${BN} .seat { background-color: #FBF4E2; border: 2px solid #C9A978; border-bottom: 6px solid #B08B58; border-radius: 6px; }
${BN} .seat.is-shuffling-nominate, ${BN} .seat.is-nominated { background-color: #FFF3B0 !important; border-color: #BFA44A !important; box-shadow: none !important; animation: none !important; }
`;

    // --- 幅900px未満：左のバーを、下の操作バーに変えます（シンプル・黒板）
    const nSA = "body.ui-style-a:not(.blackboard-active):not(.nomination-active)";
    const nSB = "body.ui-style-b.ui-style-b:not(.blackboard-active):not(.nomination-active)";
    css += `@media (max-width: 899px) {\n`;
    css += [["a", nSA], ["b", nSB]].map(([k, P]) => {
        const a = k === "a";
        const barBg = a ? "var(--card-bg)" : "#8C6239";
        const barBorder = a ? "1px solid var(--seat-border)" : "6px solid #A97C4F";
        const idle = a ? "var(--text-sub)" : "#F3E2C0";
        const onBg = a ? "var(--uis-tint)" : "#6F4A28";
        const onText = a ? "var(--uis-ink)" : "#FFF3C4";
        return `
${P} { padding-bottom: 76px; }
${P} #topBarContainer { padding-left: 24px; }
${P} #uiRail { display: block; position: fixed; left: 0; right: 0; bottom: 0; top: auto; width: auto; height: 62px; z-index: 155; background: ${barBg}; border-top: ${barBorder}; box-sizing: border-box; }
${P} .btn-config-toggle { position: fixed !important; top: auto !important; bottom: 0 !important; left: calc(var(--uis-i, 0) * 100vw / var(--uis-n, 5)) !important; width: calc(100vw / var(--uis-n, 5)); height: 62px; margin: 0 !important; padding: 0 !important; border: 0 !important; border-radius: 0 !important; background: transparent !important; box-shadow: none !important; color: ${idle} !important; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; font-size: 0; z-index: 160; cursor: pointer; font-family: inherit; transform: none; }
${P} .btn-config-toggle::before { content: ""; width: 22px; height: 22px; background: currentColor; display: block; }
${P} .btn-config-toggle::after { font-size: 11px; font-weight: 700; line-height: 1; content: ""; }
${P} #configMenuBtn.has-update-badge::after { position: static; top: auto; right: auto; width: auto; height: auto; border-radius: 0; background: none; box-shadow: none; animation: none; }
${P} #configMenuBtn.has-update-badge, ${P} #configMenuBtn.has-update-badge:hover, ${P} #configMenuBtn.has-update-badge.is-open { background-image: radial-gradient(circle at calc(50% + 15px) 14px, #ef4444 0 5px, #fff 5px 7px, transparent 7.5px) !important; }
body:has(#configMenuBtn.has-update-badge) ${P} #uisTrayConfig, body:has(#configMenuBtn.has-update-badge) #uisTrayConfig { background-image: radial-gradient(circle at calc(100% - 8px) 8px, #ef4444 0 5px, #fff 5px 7px, transparent 7.5px) !important; }
${Object.keys(railIds).map(id => `${P} #${id}::before { ${mask(railIds[id][0])} } ${P} #${id}::after, ${P} #${id}.is-playing::after, ${P} #${id}.is-open::after { content: "${railIds[id][1]}"; }`).join("\n")}
${P} .btn-config-toggle:hover { background: ${a ? "var(--uis-soft)" : "#7A5430"} !important; }
${P} .btn-config-toggle.is-open, ${P} #musicPlayerBtn.is-playing { background: ${onBg} !important; color: ${onText} !important; }
${P} .uis-rail-btn { display: flex; }
${P} #uisRailTimer.has-ring { background: ${onBg} !important; }
${P} #calcPanel, ${P} #musicPanel, ${P} #timerPanel { position: fixed; top: auto; bottom: 72px; left: 8px; right: 8px; margin: 0 auto; width: min(400px, calc(100vw - 16px)); box-sizing: border-box; max-height: calc(100vh - 150px); overflow-y: auto; transform: none; z-index: 140; }
${P} #toastContainer { top: auto; bottom: 74px; left: 50%; right: auto; transform: translateX(-50%); align-items: center; width: calc(100vw - 24px); }
`;
    }).join("");
    css += `body.ui-style-a .config-container, body.ui-style-b .config-container { width: min(var(--config-w, 340px), 100vw); box-sizing: border-box; padding-bottom: 84px !important; }\n`;
    css += `}\n`;
    // 幅480px以下は、本体の左右の余白が12pxになるので、上の帯のはみ出しも12pxに合わせます
    css += `@media (max-width: 480px) {\n${nSA} #topBarContainer, ${nSB} #topBarContainer, ${nSB} .main-btn-wrapper { margin-left: -12px !important; margin-right: -12px !important; }\n}\n`;
    return css;
}


// ---------- 広い画面の部品（時計、クラス、フッター、左の帯とチョーク受けのボタン）と、座席表の大きさ合わせ
let uisLastSave = 0;
let uisNomSeen = [];
let uisNomLastKey = "";
let uisNomWas = false;
let uisTickTimer = null;
const UIS_WEEK = ["日", "月", "火", "水", "木", "金", "土"];

function uisWide() { return window.matchMedia("(min-width: 900px)").matches; }
function uisSetText(el, txt) { if (el && el.textContent !== txt) el.textContent = txt; }
function uisSetHtml(el, html) { if (el && el.dataset.uisH !== html) { el.dataset.uisH = html; el.innerHTML = html; } }

function uisStats() {
    let total = 0, today = 0, changed = null;
    if (typeof seatTimeline !== "undefined" && Array.isArray(seatTimeline)) {
        total = seatTimeline.length;
        const d = new Date(); d.setHours(0, 0, 0, 0);
        today = seatTimeline.filter(e => e && e.at >= d.getTime()).length;
    }
    if (typeof seatLayoutLog !== "undefined" && Array.isArray(seatLayoutLog) && seatLayoutLog.length >= 2) {
        const a = seatLayoutLog[0].pos || {}, b = seatLayoutLog[1].pos || {};
        let c = 0;
        Object.keys(a).forEach(k => { if (k in b && a[k] !== b[k]) c++; });
        changed = c;
    }
    return { total, today, changed };
}

// ---- 上の「クラス名」から、クラスを切り替える ----
function uisClassPresets() {
    try { return JSON.parse(localStorage.getItem("seat_shuffler_presets") || "{}") || {}; } catch (e) { return {}; }
}
function uisClassMenuClose() {
    const m = $id("uisClassMenu");
    if (m) m.remove();
    const chip = $id("uisClassChip");
    if (chip) chip.setAttribute("aria-expanded", "false");
    document.removeEventListener("mousedown", uisClassMenuOutside, true);
    document.removeEventListener("keydown", uisClassMenuKey, true);
}
function uisClassMenuOutside(e) {
    const m = $id("uisClassMenu"), chip = $id("uisClassChip");
    if (m && !m.contains(e.target) && !(chip && chip.contains(e.target))) uisClassMenuClose();
}
function uisClassMenuKey(e) {
    const m = $id("uisClassMenu");
    if (!m) return;
    if (e.key === "Escape") { e.stopPropagation(); uisClassMenuClose(); const c = $id("uisClassChip"); if (c) c.focus(); return; }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        const items = Array.from(m.querySelectorAll("button"));
        const i = items.indexOf(document.activeElement);
        const n = e.key === "ArrowDown" ? (i + 1) % items.length : (i <= 0 ? items.length - 1 : i - 1);
        if (items[n]) items[n].focus();
        e.preventDefault();
    }
}
function uisClassPick(name) {
    uisClassMenuClose();
    if (typeof isAppLocked === "function" && isAppLocked()) { if (typeof showLockedToast === "function") showLockedToast(); return; }
    if (name === uisClassName()) return;
    const after = () => {
        if (typeof updatePresetRadioButtons === "function") updatePresetRadioButtons();
        if (typeof showToast === "function") showToast("「" + name + "」に切り替えました。", "success");
        uisTick();
    };
    try {
        if (typeof requestClassSwitch === "function") requestClassSwitch(name, after);
        else { loadPreset(name); after(); }
    } catch (e) { console.error(e); }
}
function uisClassMenuToggle() {
    if ($id("uisClassMenu")) { uisClassMenuClose(); return; }
    const chip = $id("uisClassChip");
    if (!chip) return;
    const presets = uisClassPresets();
    const names = Object.keys(presets);
    const cur = uisClassName();
    const menu = document.createElement("div");
    menu.id = "uisClassMenu"; menu.setAttribute("data-plugin", "ui-styles"); menu.setAttribute("role", "listbox"); menu.setAttribute("aria-label", "クラスを切り替える");
    const head = document.createElement("div");
    head.className = "uis-cm-head"; head.textContent = "クラスを切り替える";
    menu.appendChild(head);
    const count = n => { try { return splitRosterRaw(presets[n].students || "").filter(x => x.trim()).length; } catch (e) { return 0; } };
    const mk = n => {
        const b = document.createElement("button");
        b.type = "button"; b.className = "uis-cm-item"; b.setAttribute("role", "option");
        b.setAttribute("aria-selected", n === cur ? "true" : "false");
        const a = document.createElement("span"); a.className = "uis-cm-name"; a.textContent = n;
        const c = document.createElement("span"); c.className = "uis-cm-n"; const k = count(n); c.textContent = k ? k + "人" : "";
        b.appendChild(a); b.appendChild(c);
        if (n === cur) { const ck = document.createElement("span"); ck.className = "uis-cm-check"; ck.textContent = "✓"; ck.style.fontWeight = "800"; b.appendChild(ck); }
        b.onclick = () => uisClassPick(n);
        return b;
    };
    const live = names.filter(n => !(presets[n] && presets[n].archived));
    const old = names.filter(n => presets[n] && presets[n].archived);
    live.forEach(n => menu.appendChild(mk(n)));
    if (!names.length) { const d = document.createElement("div"); d.className = "uis-cm-head"; d.style.fontWeight = "600"; d.textContent = "保存されたクラスはありません。"; menu.appendChild(d); }
    if (old.length) {
        const det = document.createElement("details");
        det.open = old.includes(cur);
        const sm = document.createElement("summary"); sm.textContent = "去年度のクラス　" + old.length + "件";
        det.appendChild(sm);
        old.forEach(n => det.appendChild(mk(n)));
        menu.appendChild(det);
    }
    const foot = document.createElement("button");
    foot.type = "button"; foot.className = "uis-cm-foot"; foot.textContent = "クラスの保存・管理（設定）へ";
    foot.onclick = () => {
        uisClassMenuClose();
        const cc = $id("configContainer");
        if (typeof toggleConfigMenu === "function" && !(cc && cc.classList.contains("open"))) toggleConfigMenu();
        const box = $id("presetRadioContainer"), sec = box && box.closest(".config-section");
        if (sec && typeof configWideSections === "function" && typeof selectConfigWideSection === "function") { const i = configWideSections().indexOf(sec); if (i >= 0) selectConfigWideSection(i); }
    };
    menu.appendChild(foot);
    document.body.appendChild(menu);
    const r = chip.getBoundingClientRect();
    menu.style.left = Math.max(8, Math.min(r.left, innerWidth - menu.offsetWidth - 8)) + "px";
    menu.style.top = (r.bottom + 8) + "px";
    chip.setAttribute("aria-expanded", "true");
    document.addEventListener("mousedown", uisClassMenuOutside, true);
    document.addEventListener("keydown", uisClassMenuKey, true);
    const sel = menu.querySelector('[aria-selected="true"]') || menu.querySelector("button");
    if (sel) sel.focus();
}

function uisClassName() {
    try {
        if (typeof activeClassId === "undefined" || !activeClassId) return "";
        if (typeof TRIAL_CLASS_ID !== "undefined" && activeClassId === TRIAL_CLASS_ID) return "";
        return String(activeClassId);
    } catch (e) { return ""; }
}

// Aの色：テーマの「アクセント色」に合わせて、ボタンの文字色や、文字に使う濃い色を決めます（明るい色のテーマでも、読めるように）
function uisRgb(str) {
    const el = document.createElement("i");
    el.style.color = String(str || "").trim() || "#000";
    document.body.appendChild(el);
    const m = getComputedStyle(el).color.match(/[\d.]+/g) || [0, 0, 0];
    el.remove();
    return [+m[0], +m[1], +m[2]];
}
function uisLum(c) {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
}
function uisContrast(a, b) {
    const x = uisLum(a), y = uisLum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
function uisMix(a, b, t) { return a.map((v, i) => Math.round(v * (1 - t) + b[i] * t)); }
function uisHex(c) { return "#" + c.map(v => ("0" + Math.max(0, Math.min(255, v)).toString(16)).slice(-2)).join(""); }
let uisAccentKey = "";
function uisAccent() {
    const b = document.body;
    if (!b.classList.contains("ui-style-a")) return;
    const cs = getComputedStyle(b);
    const g = n => cs.getPropertyValue(n).trim();
    const key = [g("--accent-color"), g("--card-bg"), g("--text-main")].join("|");
    if (key === uisAccentKey) return;
    uisAccentKey = key;
    try {
        const acc = uisRgb(g("--accent-color")), card = uisRgb(g("--card-bg")), text = uisRgb(g("--text-main"));
        const dark = [17, 24, 39], white = [255, 255, 255];
        const on = uisContrast(acc, white) >= uisContrast(acc, dark) ? white : dark;
        const tint = uisMix(card, acc, 0.13);
        let ink = acc, n = 0;
        while (uisContrast(ink, tint) < 4.5 && n++ < 14) ink = uisMix(ink, text, 0.12);
        const d = uisMix(acc, [0, 0, 0], 0.22);
        let ab = acc, m = 0;
        while (uisContrast(ab, on) < 4.6 && m++ < 12) ab = uisMix(ab, on === white ? [0, 0, 0] : white, 0.08);
        const st = b.style;
        st.setProperty("--uis-acc-btn", uisHex(ab));
        st.setProperty("--uis-on-accent", uisHex(on));
        st.setProperty("--uis-ink", uisHex(ink));
        st.setProperty("--uis-accent-d", uisHex(d));
    } catch (e) { /* 色が読めないときは、そのまま（A標準の色） */ }
}

function uisTick() {
    uisAccent();
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0"), mm = String(now.getMinutes()).padStart(2, "0");
    const clock = $id("uisClock");
    if (clock) uisSetHtml(clock, '<span class="uis-time">' + hh + ":" + mm + '</span><span class="uis-date">' + (now.getMonth() + 1) + "月" + now.getDate() + '日<i class="uis-wd" style="font-style:normal"> ' + UIS_WEEK[now.getDay()] + "曜日</i></span>");
    const chip = $id("uisClassChip");
    if (chip) { const n = uisClassName(); chip.style.display = n ? "" : "none"; if (n) uisSetText(chip.firstChild, n); }
    const st = uisStats();
    const foot = $id("uisFooter");
    if (foot) {
        const l = st.total > 0 ? "席替え " + st.total + "回目" + (st.changed !== null ? "　前回から " + st.changed + "席が変わりました" : "") : "まだ席替えをしていません";
        const r = uisLastSave ? "自動で保存しました " + String(new Date(uisLastSave).getHours()).padStart(2, "0") + ":" + String(new Date(uisLastSave).getMinutes()).padStart(2, "0") : "";
        uisSetHtml(foot, "<span>" + l + "</span><span>" + r + "</span>");
    }
    const line = $id("uisBoardLine");
    if (line) uisSetHtml(line, st.today > 0 ? "きょうの席替え　<b>" + st.today + "回目</b>" + (st.changed !== null ? "　前回から" + st.changed + "席が変わります" : "") : "きょうは、まだ席替えをしていません");
    uisEnsureButtons();
    uisRibbonBuild();
    uisMusicRibbonBuild();
    uisRingSync();
    uisLayoutRail();
    uisNomSync();
    uisCfgRebuild();
    uisEmojiSync();
}

// 左の帯とチョーク受けのボタン。元のボタンの働きを呼び出すだけです
// タイマーの残り時間を、左のバーの「タイマー」ボタンを囲む円で見せます（シンプルだけ）
const UIS_RING_SVG = '<svg class="uis-ring" viewBox="0 0 76 76" aria-hidden="true"><circle class="uis-ring-bg" cx="38" cy="38" r="35"/><circle class="uis-ring-fg" cx="38" cy="38" r="35" pathLength="100" stroke-dasharray="100 100"/></svg>';
const UIS_RING_RECT_SVG = '<svg class="uis-ring uis-ring-rect" aria-hidden="true"><path class="uis-ring-bg"/><path class="uis-ring-fg" pathLength="100" stroke-dasharray="100 100"/></svg>';
function uisRingRectSize(btn) {
    const w = btn.offsetWidth, h = btn.offsetHeight, svg = btn.querySelector(".uis-ring-rect");
    if (svg && svg.dataset.w !== w + "x" + h) {
        svg.dataset.w = w + "x" + h;
        svg.setAttribute("width", w + 12); svg.setAttribute("height", h + 12);
        // 上の真ん中から、時計回りに進む角丸の線
        const x = 3, y = 3, ww = w + 6, hh = h + 6, r = 12;
        const d = `M ${x + ww / 2} ${y} H ${x + ww - r} A ${r} ${r} 0 0 1 ${x + ww} ${y + r} V ${y + hh - r} A ${r} ${r} 0 0 1 ${x + ww - r} ${y + hh} H ${x + r} A ${r} ${r} 0 0 1 ${x} ${y + hh - r} V ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
        svg.querySelectorAll("path").forEach(pa => pa.setAttribute("d", d));
    }
}
function uisRingSync() {
    const box = $id("compactTimerBar"), fill = $id("compactTimerBarFill");
    ["uisRailTimer", "uisTrayTimer"].forEach(id => {
        const btn = $id(id);
        if (!btn) return;
        const fg = btn.querySelector(".uis-ring-fg");
        if (!fg || !box || !fill) return;
        const on = !box.hidden;
        btn.classList.toggle("has-ring", on);
        if (!on) return;
        const pct = Math.max(0, Math.min(100, parseFloat(fill.style.width) || 0));
        fg.setAttribute("stroke-dasharray", pct.toFixed(1) + " 100");
        fg.setAttribute("stroke-dashoffset", (pct - 100).toFixed(1));   // 残りの線の「はじまり」が、時計回りに進む
        btn.dataset.ring = box.dataset.state || "ok";
        if (id === "uisTrayTimer") uisRingRectSize(btn);
    });
    uisMusicRingSync();
}
// 音楽：流れているあいだ、「音楽」ボタンを囲む枠で、曲の進みを見せます
function uisMusicRingSync() {
    const src = $id("musicPlayerBtn");
    const on = !!src && src.classList.contains("is-playing");
    const sk = $id("musicSeek");
    const pct = Math.max(0, Math.min(100, (sk ? parseFloat(sk.value) || 0 : 0) / 10));
    if (src && !src.querySelector(".uis-ring")) src.insertAdjacentHTML("beforeend", UIS_RING_SVG);
    ["musicPlayerBtn", "uisTrayMusic"].forEach(id => {
        const btn = $id(id);
        if (!btn) return;
        const fg = btn.querySelector(".uis-ring-fg");
        if (!fg) return;
        btn.classList.toggle("has-ring", on);
        if (!on) return;
        fg.setAttribute("stroke-dasharray", pct.toFixed(1) + " 100");
        fg.setAttribute("stroke-dashoffset", "0");   // 曲の進みは、上から時計回りに伸びる
        if (id === "uisTrayMusic") uisRingRectSize(btn);
    });
}

// 音楽プレーヤーを、横長のリボンにするため、曲の一覧を、左右2つのまとまりに分けます（idは変わりません）
function uisMusicRibbonBuild() {
    const lib = $id("musicLibrary");
    if (!lib || lib.querySelector(":scope > .uis-mr-l")) return;
    const sc = $id("musicScenes"), list = $id("musicList"), gs = lib.querySelector(":scope > .music-group-sel");
    if (!sc || !list || !gs) return;
    const kids = Array.from(lib.children);
    const L = document.createElement("div"), R = document.createElement("div");
    L.className = "uis-mr-l"; R.className = "uis-mr-r";
    L.setAttribute("data-plugin", "ui-styles"); R.setAttribute("data-plugin", "ui-styles");
    lib.insertBefore(L, kids[0]);
    lib.appendChild(R);
    kids.forEach(k => { (k === sc || k === gs || k === list ? L : R).appendChild(k); });
}

// タイマーの画面を、横長のリボンにするため、中身を5つのまとまりに分けます（idは変わりません）。
// 「シンプル」以外では display: contents なので、見た目は変わりません
function uisRibbonBuild() {
    const panel = $id("timerPanel");
    if (!panel || panel.querySelector(".uis-rb")) return;
    const labels = panel.querySelectorAll(":scope > .timer-section-label");
    const head = panel.querySelector(":scope > .timer-panel-header");
    const disp = $id("timerDisplay"), bar = $id("timerMiniBar");
    const btns = panel.querySelector(":scope > .timer-btn-row"), sw = $id("timerModeSwitchBtn");
    const qp = $id("quickPresetRow"), qa = $id("quickAddRow");
    const ct = panel.querySelector(":scope > .custom-time-row"), ck = panel.querySelector(":scope > .clock-target-row");
    const steps = panel.querySelectorAll(":scope > .step-set-row");
    const auto = panel.querySelector(":scope > .step-auto-row"), prog = $id("stepProgress");
    if (labels.length !== 4 || !head || !disp || !bar || !btns || !sw || !qp || !qa || !ct || !ck || steps.length !== 2 || !auto || !prog) return;
    const mk = (cls, nodes) => {
        const g = document.createElement("div");
        g.className = "uis-rb-g " + cls;
        g.setAttribute("data-plugin", "ui-styles");
        panel.insertBefore(g, nodes[0]);
        nodes.forEach(n => g.appendChild(n));
        return g;
    };
    const row = document.createElement("div");
    row.className = "uis-rb";
    panel.insertBefore(row, head);
    const gs = [
        mk("uis-rb-main", [head, disp, bar, btns, sw]),
        mk("uis-rb-pre", [labels[0], qp]),
        mk("uis-rb-add", [labels[1], qa, ct]),
        mk("uis-rb-clk", [labels[2], ck]),
        mk("uis-rb-stp", [labels[3], steps[0], steps[1], auto, prog])
    ];
    gs.forEach(g => row.appendChild(g));
}

function uisEnsureButtons() {
    const clickOf = id => () => { const e = $id(id); if (e) e.click(); };
    const specs = [
        { rail: "uisRailTimer", tray: "uisTrayTimer", label: "タイマー", plugin: "timer", ok: () => typeof toggleTimerPanel === "function", act: () => { if (typeof onClockClick === "function") onClockClick(); } },
        { tray: "uisTrayConfig", label: "設定", ok: () => !!$id("configMenuBtn"), act: clickOf("configMenuBtn") },
        { tray: "uisTrayCalc", label: "電卓", ok: () => !!$id("calcOpenBtn"), act: clickOf("calcOpenBtn") },
        { tray: "uisTrayMusic", label: "音楽", ok: () => !!$id("musicPlayerBtn"), act: clickOf("musicPlayerBtn") },
        { rail: "uisRailScreen", tray: "uisTrayScreen", label: "拡張画面", plugin: "second-screen", ok: () => typeof scrToggle === "function", act: () => scrToggle() }
    ];
    const wrap = document.querySelector(".main-btn-wrapper");
    specs.forEach(sp => {
        let on = sp.ok();
        if (on && sp.plugin && typeof SekigaeApp.isEnabled === "function" && SekigaeApp.plugins.some(p => p.id === sp.plugin) && !SekigaeApp.isEnabled(sp.plugin)) on = false;
        [["rail", document.body, "btn-config-toggle uis-rail-btn"], ["tray", wrap, "uis-tray-btn"]].forEach(([kind, host, cls]) => {
            const id = sp[kind];
            if (!id || !host) return;
            let el = $id(id);
            if (!on) { if (el) el.remove(); return; }
            if (el) return;
            el = document.createElement("button");
            el.type = "button"; el.id = id; el.className = cls; el.textContent = sp.label;
            el.setAttribute("data-plugin", "ui-styles");
            el.onclick = sp.act;
            if (id === "uisRailTimer") el.insertAdjacentHTML("beforeend", UIS_RING_SVG);
            if (id === "uisTrayTimer" || id === "uisTrayMusic") el.insertAdjacentHTML("beforeend", UIS_RING_RECT_SVG);
            host.appendChild(el);
        });
    });
}

function uisLayoutRail() {
    const ids = ["configMenuBtn", "calcOpenBtn", "musicPlayerBtn", "uisRailTimer", "uisRailScreen"];
    let i = 0;
    ids.forEach(id => {
        const el = $id(id);
        if (!el) return;
        const pl = el.getAttribute("data-plugin");
        const off = el.hidden || (pl && pl !== "ui-styles" && typeof SekigaeApp.isEnabled === "function" && SekigaeApp.plugins.some(p => p.id === pl) && !SekigaeApp.isEnabled(pl));
        if (off || getComputedStyle(el).display === "none") { el.style.removeProperty("--uis-top"); return; }
        el.style.setProperty("--uis-top", (14 + 70 * i) + "px");
        el.style.setProperty("--uis-i", String(i));
        if (id === "uisRailTimer") document.documentElement.style.setProperty("--uis-rb-top", (14 + 70 * i - 4) + "px");
        if (id === "musicPlayerBtn") document.documentElement.style.setProperty("--uis-mb-top", (14 + 70 * i - 4) + "px");
        i++;
    });
    document.documentElement.style.setProperty("--uis-n", String(Math.max(i, 1)));
    const tray = document.querySelector(".main-btn-wrapper");
    if (tray && tray.offsetHeight) document.documentElement.style.setProperty("--uis-rb-top-b", Math.round(tray.getBoundingClientRect().bottom) + "px");
}

// 座席表を、カードいっぱいに広げます（A・Bの、広い画面の、ふだんの画面だけ）
function uisFit() {
    const b = document.body, room = $id("classroom");
    if (!room) return;
    const v = uisCurrent();
    const nom = b.classList.contains("nomination-active");
    const on = uisWide() && !b.classList.contains("blackboard-active") && !(nom && b.classList.contains("text-only-mode"));
    const fill = on && !room.querySelector(".welcome-card") && !!room.querySelector(".seat");
    room.classList.toggle("uis-fill", fill);
    if (!fill) { room.style.removeProperty("--uis-ch"); room.style.removeProperty("--uis-name"); return; }
    room.style.removeProperty("--uis-ch");
    const sc = typeof getUiScale === "function" ? (getUiScale() || 1) : 1;
    const top = (room.getBoundingClientRect().top + window.scrollY) / sc;
    const bottom = nom ? (v === "a" ? 24 : 12) : (v === "a" ? 40 : 14);
    const h = Math.max(240, window.innerHeight / sc - top - bottom);
    room.style.setProperty("--uis-ch", h + "px");
    const s = room.querySelector(".seat");
    const r = s.getBoundingClientRect();
    const k = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--seat-text-scale")) || 1;
    const nm = nom ? Math.max(12, Math.min(r.height / sc * 0.3, r.width / sc * 0.13, 28)) * k : Math.max(13, Math.min(r.height / sc * (room.querySelector(".seat-furi") ? 0.25 : 0.27), r.width / sc * 0.17, 44)) * k;
    room.style.setProperty("--uis-name", nm.toFixed(1) + "px");
}

// ---------- 指名中の画面の部品（指名された人のカード、指名済みの一覧）。元の表示は、そのまま残して、中身を写します
function uisNomParse() {
    const el = $id("nominateNameDisplay");
    const raw = el ? (el.textContent || "").replace(/\s+/g, " ").trim() : "";
    const m = raw.match(/^(\d+)番\s*(.*)$/);
    const decided = !!(el && el.classList.contains("is-decided"));
    const rolling = !!(el && el.classList.contains("is-rolling"));
    return { raw, no: m ? m[1] + "番" : "", name: m ? m[2] : raw, decided, rolling, prompt: !m && !decided };
}

function uisNomSync() {
    const b = document.body;
    const isNom = b.classList.contains("nomination-active");
    if (isNom && !uisNomWas) { uisNomSeen = []; uisNomLastKey = ""; }
    uisNomWas = isNom;
    if (!isNom) return;
    { const p0 = uisNomParse(); const key = p0.decided ? p0.raw : ""; if (key && key !== uisNomLastKey) uisNomSeen.push(key); uisNomLastKey = key; }
    const card = $id("uisNomCard");
    if (card) {
        const p = uisNomParse();
        card.classList.toggle("is-rolling", p.rolling);
        const noEl = card.querySelector(".uis-nc-no"), nmEl = card.querySelector(".uis-nc-nm"), nameB = card.querySelector(".uis-nc-nm b"), san = card.querySelector(".uis-nc-nm i");
        uisSetText(noEl, p.no);
        uisSetText(nameB, p.name);
        nmEl.classList.toggle("is-long", !p.prompt && p.name.length > 4);
        nmEl.classList.toggle("is-prompt", p.prompt || p.name === "……");
        san.style.display = p.decided && p.name ? "" : "none";
        // グループと、席の場所（座席の位置の名前から読み取ります）
        const meta = card.querySelector(".uis-nc-meta");
        let chip = "", where = "";
        if (p.decided) {
            const seat = document.querySelector("#classroom .seat.is-nominated .seat-position");
            const lab = seat ? seat.textContent.trim() : "";
            const mm = lab.match(/^([A-Za-z])(\d+)$/);
            if (mm) {
                const L = mm[1].toUpperCase();
                chip = "グループ " + L;
                where = "前から " + parseInt(mm[2], 10) + "列目・右から " + (L.charCodeAt(0) - 64) + "席目";
            }
        }
        uisSetText(meta.firstChild, chip);
        meta.firstChild.style.display = chip ? "" : "none";
        uisSetText(meta.lastChild, where);
    }
    const hist = $id("uisNomHist");
    if (hist && typeof getNominationProgress === "function") {
        const pr = getNominationProgress();
        const ex = $id("nominateExcludeToggle");
        const useApp = !!(ex && ex.checked);
        const list = useApp && typeof nominatedHistoryList !== "undefined" && Array.isArray(nominatedHistoryList) ? nominatedHistoryList : null;
        const pct = useApp && pr.total > 0 ? Math.min(100, Math.round(pr.done / pr.total * 100)) : 0;
        const esc = v => String(v).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
        const items = list ? list.slice(-24).map(t => { const q = typeof nominationNameParts === "function" ? nominationNameParts(t) : { no: "", name: String(t) }; return (q.no ? q.no + " " : "") + q.name; }) : uisNomSeen.slice(-24).map(t => t.replace(/^(\d+)番\s*/, "$1 "));
        const chips = items.map((t, i, a) => "<span" + (i === a.length - 1 ? ' class="is-last"' : "") + ">" + esc(t) + "</span>").join("");
        const cnt = useApp ? pr.done + " / " + pr.total + "人" : uisNomSeen.length + "回";
        uisSetHtml(hist, '<div class="uis-nh-head"><span>指名済み</span><span>' + cnt + '</span></div><div class="uis-nh-bar"><i style="width:' + pct + '%"></i></div><div class="uis-nh-chips">' + chips + '</div><div class="uis-nh-note">欠席の人は自動で飛ばします。</div>');
    }
    const hd = $id("uisNomHeader");
    if (hd) {
        uisSetText(hd.querySelector(".uis-nh-title"), ($id("appTitleText") ? $id("appTitleText").textContent : "席替えし太郎").trim());
        const n = new Date();
        uisSetText(hd.querySelector(".uis-nh-clock"), String(n.getHours()).padStart(2, "0") + ":" + String(n.getMinutes()).padStart(2, "0"));
    }
}


// ---------- ボタンの絵文字：広い画面のA・Bでは、取り除きます（いまのデザインに戻すと、もとに戻します）
const UIS_EMO_RE = /^[\s​]*((?:\p{Extended_Pictographic}|️|‍|⃣)+)[\s​]*/u;
const UIS_EMO_ROOTS = ["#topBarContainer", ".main-btn-wrapper", "#configContainer", "#nominateDisplayArea", "#calcPanel", "#musicPanel", "#timerPanel", "#rouletteOverlay", "#softKeypad"];
function uisFirstText(el) {
    const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = w.nextNode())) { if (n.nodeValue.trim()) return n; }
    return null;
}
function uisEmojiActive() { return true; }
function uisEmojiPass() {
    if (!uisEmojiActive()) return;
    UIS_EMO_ROOTS.forEach(sel => {
        const root = document.querySelector(sel);
        if (!root) return;
        root.querySelectorAll("button, h3, summary, .app-title, label, .switch-label, .music-head b, .timer-section-label").forEach(el => {
            if (el.matches(".fav-star, .config-section-toggle, .btn-icon, .realtime-clock, .cv-del")) return;
            const t = uisFirstText(el);
            if (!t) return;
            const m = t.nodeValue.match(UIS_EMO_RE);
            if (!m) return;
            const rest = (el.textContent || "").trim().length - m[0].trim().length;
            if (rest <= 0) return;
            el.dataset.uisEmo = m[1];
            t.nodeValue = t.nodeValue.replace(UIS_EMO_RE, "");
        });
    });
}
function uisEmojiRestore() {
    document.querySelectorAll("[data-uis-emo]").forEach(el => {
        const emo = el.dataset.uisEmo;
        delete el.dataset.uisEmo;
        const t = uisFirstText(el);
        if (t && !t.nodeValue.trim().startsWith(emo)) t.nodeValue = emo + " " + t.nodeValue.replace(/^\s+/, "");
    });
}
function uisEmojiSync() { if (uisEmojiActive()) { uisEmojiPass(); uisIconPass(); } else uisEmojiRestore(); }

// ---------- 設定の画面：左の分類を選ぶと、右にカードが並びます
const UIS_CFG_DESC = {
    class: "クラスの切り替えと、保存・削除をします。", rosterio: "名簿を作ったり、読み込んだり、書き出したりします。", year: "進級や年度がわりの作業をします。",
    layout: "座席の行と列、並べ方を決めます。", seatview: "座席の大きさや、文字の見え方を選びます。", rules: "席替えの抽選のしかたを決めます。",
    groups: "班の作り方を決めます。", groupview: "班の色や、見え方を選びます。",
    anim: "席替えの演出を選びます。", nominate: "指名のしかたを決めます。", records: "席替えの記録や、統計を見ます。",
    title: "画面のタイトルを変えます。", theme: "テーマの色や、背景を選びます。", display: "表示モードと、画面の部品を切り替えます。", perf: "動きを軽くします。",
    timerview: "タイマーの見え方を選びます。", alarm: "アラームとチャイムの音を決めます。", timerx: "タイマーの特別な機能です。",
    backup: "クラスのデータを守ります。", cloud: "スプレッドシートと連携します。", export: "印刷や、画像・PDFの保存をします。",
    plugins: "使う機能を、入れたり外したりします。", lock: "ロックと、管理者用の設定です。", keypad: "入力を助ける機能です。"
};
let uisCfgGroup = "";
let uisCfgLastActive = null;
let uisCfgSig = "";

function uisCfgOn() {
    const b = document.body;
    return uisWide() && b.classList.contains("config-wide") && !b.classList.contains("blackboard-active") && !!$id("configContainer");
}
function uisCfgAvail(sec) { return sec.style.display !== "none" && !sec.hidden && !sec.hasAttribute("data-plugin-off"); }
function uisCfgGroupOf(sec) {
    if (sec.dataset.group) return sec.dataset.group;
    const h = sec.querySelector(":scope > h3");
    const t = h ? h.textContent : "";
    if (t.includes("よく使う")) return "よく使う設定";
    return "しくみ";
}
function uisCfgTitle(sec) {
    const t = sec.querySelector(":scope > h3 .config-section-title") || sec.querySelector(":scope > h3");
    return t ? t.textContent.replace(/[∧∨]/g, "").trim() : "";
}
function uisCfgCount(secs) {
    let n = 0;
    secs.forEach(sec => { n += sec.querySelectorAll("input:not([type=hidden]):not([type=file]), select, textarea, button:not(.fav-star):not(.config-section-toggle):not(.btn-icon)").length; });
    return n;
}

function uisCfgClear() {
    document.querySelectorAll("#configContainer > .config-section.uis-show").forEach(e => e.classList.remove("uis-show"));
    const nav = $id("uisCfgNav");
    if (nav) nav.remove();
    uisCfgSig = "";
}

// 設定の検索を、からにして、結果の一覧を閉じます（検索の窓を、もう一度ひらかないように）
function uisSearchClear() {
    const input = $id("configSearchInput");
    const cc = $id("configContainer");
    const active = !!((input && input.value) || (cc && cc.classList.contains("cfg-searching")));
    if (!active) return;
    if (typeof ssReset === "function") ssReset();
    else if (typeof clearConfigSearch === "function") clearConfigSearch();
    if (input && document.activeElement === input) input.blur();
}
function uisCfgRebuild() {
    const cc = $id("configContainer");
    if (!cc) return;
    if (!uisCfgOn()) { if (cc.querySelector(".uis-show") || $id("uisCfgNav")) uisCfgClear(); return; }
    const all = Array.from(cc.querySelectorAll(":scope > .config-section")).filter(uisCfgAvail);
    const groups = [];
    const map = {};
    all.forEach(sec => {
        const g = uisCfgGroupOf(sec);
        if (!map[g]) { map[g] = []; groups.push(g); }
        map[g].push(sec);
        // カードの説明（一度だけ入れます）
        if (!sec.querySelector(":scope > .uis-desc") && UIS_CFG_DESC[sec.dataset.sec]) {
            const d = document.createElement("div");
            d.className = "uis-desc"; d.setAttribute("data-plugin", "ui-styles");
            d.textContent = UIS_CFG_DESC[sec.dataset.sec];
            const h = sec.querySelector(":scope > h3");
            if (h) h.after(d);
        }
    });
    if (!groups.length) return;
    // 元の機能が、別の設定へ移るよう指示したとき（検索や案内からの移動）は、その設定のある分類へ移ります
    const act = all.find(sec => sec.classList.contains("is-wide-active")) || null;
    let jump = null;
    if (act && act !== uisCfgLastActive) { uisCfgGroup = uisCfgGroupOf(act); jump = act; }
    uisCfgLastActive = act;
    if (!map[uisCfgGroup]) uisCfgGroup = groups[0];
    const input = $id("configSearchInput");
    // さがしている最中（結果の一覧を開いている間）は、カードは出さず、結果の一覧だけを出します
    const searching = cc.classList.contains("cfg-searching");
    cc.setAttribute("data-uis-group", uisCfgGroup);
    // 表示するカード
    cc.querySelectorAll(":scope > .config-section").forEach(sec => {
        const show = uisCfgAvail(sec) && uisCfgGroupOf(sec) === uisCfgGroup;
        sec.classList.toggle("uis-show", show);
    });
    // 左の分類
    const sig = groups.map(g => g + ":" + uisCfgCount(map[g])).join("|") + "#" + uisCfgGroup + "#" + (searching ? 1 : 0);
    let nav = $id("uisCfgNav");
    if (!nav) {
        nav = document.createElement("nav");
        nav.id = "uisCfgNav"; nav.setAttribute("data-plugin", "ui-styles"); nav.setAttribute("aria-label", "設定の分類");
        const fav = $id("uisCfgFav");
        if (fav) fav.before(nav); else cc.appendChild(nav);
        uisCfgSig = "";
    }
    if (sig !== uisCfgSig) {
        uisCfgSig = sig;
        nav.textContent = "";
        groups.forEach(g => {
            const b = document.createElement("button");
            b.type = "button"; b.className = "config-nav-item";
            b.setAttribute("aria-current", !searching && g === uisCfgGroup ? "true" : "false");
            const l = document.createElement("span"); l.textContent = g.replace(/^★\s*/, "");
            const c = document.createElement("span"); c.className = "uis-nav-count"; c.textContent = String(uisCfgCount(map[g]));
            b.appendChild(l); b.appendChild(c);
            b.onclick = () => { uisSearchClear(); uisCfgGroup = g; uisCfgRebuild(); cc.scrollTop = 0; };
            nav.appendChild(b);
        });
    }
    uisCfgFavSync(all);
    if (jump && jump.classList.contains("uis-show")) uisCfgScrollTo(jump);
}

function uisCfgScrollTo(sec) {
    const cc = $id("configContainer");
    if (!cc || !sec) return;
    requestAnimationFrame(() => {
        sec.scrollIntoView({ block: "start" });
        sec.classList.remove("uis-flash");
        void sec.offsetWidth;
        sec.classList.add("uis-flash");
    });
}

// 「よく使う」：よく使う設定へ、ひと押しで移ります
function uisCfgFavSync(all) {
    const fav = $id("uisCfgFav");
    if (!fav) return;
    const defs = [["画面の大きさ", "display"], ["テーマの色", "theme"], ["タイマーの音", "alarm"], ["拡張画面に映す", "拡張画面"]];
    const found = defs.map(([label, key]) => {
        const sec = all.find(s => s.dataset.sec === key) || all.find(s => uisCfgTitle(s).includes(key) || (s.dataset.kw || "").includes(key));
        return sec ? [label, sec] : null;
    }).filter(Boolean);
    const sig = found.map(f => f[0]).join("|");
    if (fav.dataset.sig === sig) return;
    fav.dataset.sig = sig;
    const row = fav.querySelector(".uis-fav-row");
    row.textContent = "";
    found.forEach(([label, sec]) => {
        const c = document.createElement("button");
        c.type = "button"; c.textContent = label;
        c.onclick = () => {
            const input = $id("configSearchInput");
            if (input && input.value) { input.value = ""; if (typeof onConfigSearch === "function") onConfigSearch(); }
            uisCfgGroup = uisCfgGroupOf(sec); uisCfgRebuild(); uisCfgScrollTo(sec);
        };
        row.appendChild(c);
    });
}

function uisLabelText() { return uisCurrent() === "b" ? "前（黒板がわ）" : "黒板"; }

function uisCurrent() {
    const v = lsGet(UIS_KEY, "a");
    return UIS_CHOICES.some(c => c.v === v) ? v : "a";
}

function uisApply(refit) {
    const v = uisCurrent();
    const b = document.body;
    b.classList.toggle("ui-style-a", v === "a");
    b.classList.toggle("ui-style-b", v === "b");
    const sel = $id("uiStyleSelect");
    if (sel) sel.value = v;
    const note = $id("uiStyleNote");
    if (note) note.textContent = UIS_NOTES[v] || "";
    const lab = $id("uiFrontLabel");
    if (lab) lab.textContent = uisLabelText();
    uisAccentKey = "";
    uisAccent();
    uisEmojiSync();
    uisCfgRebuild();
    uisTick();
    uisFit();
    if (refit === false) return;
    // 上の帯の高さが変わるので、座席表の大きさを合わせ直します
    if (typeof fitClassroomToScreen === "function") { fitClassroomToScreen(); requestAnimationFrame(fitClassroomToScreen); }
    window.dispatchEvent(new Event("resize"));
}

// AとBでは、設定を、左に分類・右に内容の2列で開きます（広い画面だけ）
function uisSyncSettingsLayout(v) {
    if (typeof setConfigWide !== "function" || typeof isConfigWide !== "function") return;
    if (window.innerWidth >= 820 && !isConfigWide()) { setConfigWide(true); lsSet("ui_style_wide_auto", "1"); }
}

function onUiStyleChange() {
    const sel = $id("uiStyleSelect");
    if (!sel) return;
    lsSet(UIS_KEY, sel.value);
    uisApply();
    uisSyncSettingsLayout(sel.value);
    showToast("画面スタイルを変えました。", "success");
}

SekigaeApp.registerPlugin({
    id: "ui-styles",
    name: "画面スタイル",
    version: "3.40",
    description: "画面全体の見た目を、「シンプル」「黒板」から選べます。広い画面では、UI改良案と同じ並びになります。席替えや指名のしくみは変わりません。",
    backupKeys: [UIS_KEY],
    searchWords: "画面 スタイル デザイン 見た目 シンプル すっきり 黒板 チョーク 机 モダン 切り替え 雰囲気",
    mount(app) {
        // 色の用意は、style.css より前に置きます（選んだテーマの色が、あとから勝つように）
        const pal = document.createElement("style");
        pal.id = "uiStylesPalette";
        pal.textContent = UIS_CSS_PALETTE;
        const link = document.querySelector('link[rel="stylesheet"][href="style.css"]');
        if (link && link.parentNode) link.parentNode.insertBefore(pal, link); else document.head.appendChild(pal);
        const st = document.createElement("style");
        st.id = "uiStylesStyle";
        st.textContent = uisBuildCss() + uisToolsCss() + uisPicoCss();
        document.head.appendChild(st);
        // 座席表の上の「前（黒板）」の表示
        const room = $id("classroom");
        if (room && room.parentNode && !$id("uiFrontLabel")) {
            const lab = document.createElement("div");
            lab.id = "uiFrontLabel";
            lab.setAttribute("data-plugin", "ui-styles");
            lab.setAttribute("aria-hidden", "true");
            lab.textContent = uisLabelText();
            room.parentNode.insertBefore(lab, room);
        }
        if (!$id("uiRail")) {
            const rail = document.createElement("div");
            rail.id = "uiRail";
            rail.setAttribute("data-plugin", "ui-styles");
            rail.setAttribute("aria-hidden", "true");
            document.body.appendChild(rail);
        }

        // 広い画面の部品
        const tb = $id("topBarContainer");
        if (tb && !$id("uisClassChip")) {
            const chip = document.createElement("button");
            chip.type = "button"; chip.id = "uisClassChip"; chip.setAttribute("data-plugin", "ui-styles");
            chip.appendChild(document.createTextNode(""));
            chip.setAttribute("aria-expanded", "false"); chip.title = "クラスを切り替える";
            chip.onclick = uisClassMenuToggle;
            const ttl = $id("appTitle");
            if (ttl && ttl.parentNode === tb) ttl.after(chip); else tb.appendChild(chip);
            const line = document.createElement("div");
            line.id = "uisBoardLine"; line.setAttribute("data-plugin", "ui-styles");
            tb.appendChild(line);
        }
        const rc = document.querySelector(".realtime-clock");
        if (rc && !$id("uisClock")) {
            const ck = document.createElement("span");
            ck.id = "uisClock"; ck.setAttribute("data-plugin", "ui-styles");
            rc.appendChild(ck);
        }
        if (room && room.parentNode && !$id("uisFooter")) {
            const ft = document.createElement("div");
            ft.id = "uisFooter"; ft.setAttribute("data-plugin", "ui-styles");
            room.after(ft);
        }
        // 座席表の大きさ合わせの後に、カードいっぱいに広げ直します
        if (typeof fitClassroomToScreen === "function" && !fitClassroomToScreen._uis) {
            const orig = fitClassroomToScreen;
            const wrapped = function () { const r = orig.apply(this, arguments); try { uisFit(); } catch (e) { /* 何もしない */ } return r; };
            wrapped._uis = true;
            fitClassroomToScreen = wrapped;
        }
        if (typeof musicUpdateTime === "function" && !musicUpdateTime._uis) {
            const omu = musicUpdateTime;
            const wmu = function () { const r = omu.apply(this, arguments); try { uisMusicRingSync(); } catch (e) { /* 何もしない */ } return r; };
            wmu._uis = true;
            musicUpdateTime = wmu;
        }
        if (typeof updateTimerMiniBars === "function" && !updateTimerMiniBars._uis) {
            const om = updateTimerMiniBars;
            const wm = function () { const r = om.apply(this, arguments); try { uisRingSync(); } catch (e) { /* 何もしない */ } return r; };
            wm._uis = true;
            updateTimerMiniBars = wm;
        }
        if (typeof autosaveWorkState === "function" && !autosaveWorkState._uis) {
            const o = autosaveWorkState;
            const w = function () { const r = o.apply(this, arguments); uisLastSave = Date.now(); return r; };
            w._uis = true;
            autosaveWorkState = w;
        }
        let rq = 0;
        const refit = () => { if (rq) return; rq = requestAnimationFrame(() => { rq = 0; uisFit(); }); };
        window.addEventListener("resize", refit);
        if (room && window.MutationObserver) new MutationObserver(refit).observe(room, { childList: true });
        new MutationObserver(refit).observe(document.body, { attributes: true, attributeFilter: ["class"] });
        new MutationObserver(uisAccent).observe(document.body, { attributes: true, attributeFilter: ["class"] });
        // 黒板のタイマー画面は、チョーク受けの真下に出します
        const tp = $id("timerPanel"), tray = document.querySelector(".main-btn-wrapper");
        if (tp && tray && window.MutationObserver) {
            new MutationObserver(() => {
                if (tp.style.display === "block") document.documentElement.style.setProperty("--uis-rb-top-b", Math.round(tray.getBoundingClientRect().bottom) + "px");
            }).observe(tp, { attributes: true, attributeFilter: ["style"] });
        }
        // 設定を開いている間は、指名の画面を引っ込めます（設定に被らないように）
        const ccEl = $id("configContainer");
        if (ccEl && window.MutationObserver) {
            const cfgSync = () => document.body.classList.toggle("uis-cfg-open", ccEl.classList.contains("open"));
            new MutationObserver(cfgSync).observe(ccEl, { attributes: true, attributeFilter: ["class"] });
            cfgSync();
        }
        document.addEventListener("sekigae:shuffle-done", () => { uisTick(); });
        if (!uisTickTimer) uisTickTimer = setInterval(uisTick, 1000);

        // 指名中の画面の部品
        if (!$id("uisNomHeader")) {
            const hd = document.createElement("div");
            hd.id = "uisNomHeader"; hd.setAttribute("data-plugin", "ui-styles");
            hd.innerHTML = '<div class="uis-nh-left" style="display:flex;gap:12px;align-items:center"><span class="uis-nh-title"></span><span class="uis-nh-pill">指名中</span></div><span class="uis-nh-clock"></span><button type="button" id="uisNomExit">指名を終わる</button>';
            hd.querySelector("#uisNomExit").onclick = () => { if (typeof exitNominationMode === "function") exitNominationMode(); };
            document.body.appendChild(hd);
        }
        const da = $id("nominateDisplayArea");
        if (da && !$id("uisNomCard")) {
            const cd = document.createElement("div");
            cd.id = "uisNomCard"; cd.setAttribute("data-plugin", "ui-styles");
            cd.innerHTML = '<div class="uis-nc-cap-a">いま指名されたのは</div><div class="uis-nc-cap-b">つぎは</div><div class="uis-nc-row"><div class="uis-nc-no"></div><div class="uis-nc-nm"><b></b><i>さん</i></div></div><div class="uis-nc-meta"><span class="uis-nc-chip"></span><span></span></div>';
            da.insertBefore(cd, da.firstChild);
            const row = da.querySelector(".nom-main-row");
            if (row) { const h = document.createElement("div"); h.id = "uisNomHist"; h.setAttribute("data-plugin", "ui-styles"); row.appendChild(h); }
        }
        {
            const nd = $id("nominateNameDisplay");
            let q = 0;
            const sync = () => { if (q) return; q = requestAnimationFrame(() => { q = 0; uisNomSync(); }); };
            if (nd && window.MutationObserver) new MutationObserver(sync).observe(nd, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ["class"] });
            if (room && window.MutationObserver) new MutationObserver(sync).observe(room, { subtree: true, attributes: true, attributeFilter: ["class"] });
        }

        // 設定の画面の部品（上の帯と、よく使う設定のボタン）
        const cc = $id("configContainer");
        if (cc && !$id("uisCfgHeader")) {
            const hd = document.createElement("div");
            hd.id = "uisCfgHeader"; hd.setAttribute("data-plugin", "ui-styles");
            hd.innerHTML = '<button type="button" id="uisCfgBack">もどる</button><h1>設定</h1>';
            hd.querySelector("#uisCfgBack").onclick = () => { if (typeof toggleConfigMenu === "function") toggleConfigMenu(); };
            cc.insertBefore(hd, cc.firstChild);
            const fav = document.createElement("div");
            fav.id = "uisCfgFav"; fav.setAttribute("data-plugin", "ui-styles");
            fav.innerHTML = '<div class="uis-fav-label">よく使う</div><div class="uis-fav-row"></div>';
            cc.appendChild(fav);
        }

        // 絵文字の取り除きと、設定のカード並びを、変化に合わせて直します
        {
            let q = 0;
            const run = () => { if (q) return; q = setTimeout(() => { q = 0; try { uisEmojiPass(); uisIconPass(); uisCfgRebuild(); } catch (e) { /* 何もしない */ } }, 40); };
            const mo = window.MutationObserver ? new MutationObserver(run) : null;
            UIS_EMO_ROOTS.forEach(sel => { const r = document.querySelector(sel); if (r && mo) mo.observe(r, sel === "#configContainer" ? { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ["class", "style", "hidden", "data-plugin-off"] } : { childList: true, subtree: true, characterData: true }); });
            // ダイアログなど、あとから作られるボタンの絵文字も、線のアイコンにします
            if (window.MutationObserver) {
                let q2 = 0;
                new MutationObserver(() => { if (q2) return; q2 = requestAnimationFrame(() => { q2 = 0; try { uisIconPass(); } catch (e) { /* 何もしない */ } }); }).observe(document.body, { childList: true, subtree: true });
            }
            window.addEventListener("resize", () => { uisEmojiSync(); uisCfgRebuild(); uisLayoutRail(); });
            const si = $id("configSearchInput");
            if (si) si.addEventListener("input", () => setTimeout(uisCfgRebuild, 60));
        }

        // 元の機能（検索や案内）が、設定へ移るよう指示したときも、その設定のある分類を開きます
        if (typeof selectConfigWideSection === "function" && !selectConfigWideSection._uis) {
            const orig = selectConfigWideSection;
            const w = function (i) {
                const r = orig.apply(this, arguments);
                try {
                    if (uisCfgOn()) {
                        const sec = Array.from(document.querySelectorAll("#configContainer > .config-section"))[i];
                        if (sec && uisCfgAvail(sec)) {
                            const input = $id("configSearchInput");
                            uisSearchClear();
                            uisCfgGroup = uisCfgGroupOf(sec); uisCfgLastActive = sec;
                            uisCfgRebuild(); uisCfgScrollTo(sec);
                        }
                    }
                } catch (e) { /* 何もしない */ }
                return r;
            };
            w._uis = true;
            selectConfigWideSection = w;
        }
        app.insertInto("guide-faq", "<li data-plugin=\"ui-styles\"><strong>画面の見た目を変えたい</strong>：設定の「画面スタイル」で、「シンプル」「黒板」を選べます。いつでも切り替えられます。</li>");
        const opts = UIS_CHOICES.map(c => '<option value="' + c.v + '">' + c.label + '</option>').join("");
        app.insertInto("settings-display", '<div class="ds-row" data-plugin="ui-styles"><label for="uiStyleSelect" class="switch-label">画面スタイル</label><select id="uiStyleSelect" onchange="onUiStyleChange()">' + opts + '</select></div><div class="ds-note" id="uiStyleNote" data-plugin="ui-styles"></div>');
        uisApply(false);
    },
    ready() { uisApply(false); if (typeof fitClassroomToScreen === "function") requestAnimationFrame(fitClassroomToScreen); }
});
