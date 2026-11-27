// ==========================================
// 動作の診断プラグイン：起動にかかった時間、描画の速さ、メモリの目安を測って、動きが重い時の、対処を勧めます。
// 軽量モード、全体アニメーション演出のオフ、使う機能を減らす構成への切りかえを、画面のボタンで試せます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります。席替えやタイマーは、これまでどおりに動きます
// ==========================================
const DIAG_KEY = "diag_last_v1";   // 前回の診断結果
let diagBusy = false;
let diagResult = null;

function diagEsc(t) { return String(t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])); }

// 起動にかかった時間（ミリ秒）
function diagStartup() {
    try {
        const nav = performance.getEntriesByType("navigation")[0];
        if (nav && nav.loadEventEnd > 0) return Math.round(nav.loadEventEnd);
        if (nav && nav.domContentLoadedEventEnd > 0) return Math.round(nav.domContentLoadedEventEnd);
    } catch (e) { /* 何もしない */ }
    try { const t = performance.timing; if (t.loadEventEnd > 0) return t.loadEventEnd - t.navigationStart; } catch (e) { /* 何もしない */ }
    return null;
}
// 計算の速さ：決まった量の計算にかかった時間（ミリ秒）。この端末で、同じ作業が何倍かかるかの目安です
function diagCpu() {
    const t0 = performance.now();
    let x = 0;
    const arr = [];
    for (let i = 0; i < 400000; i++) { x += Math.sqrt(i) * Math.sin(i); if (i % 8 === 0) arr.push(x); }
    arr.sort((a, b) => a - b);
    return Math.round(performance.now() - t0);
}
// 描画の速さ：画面の外で、たくさんの四角を動かして、1秒間のコマの間隔をはかります
function diagFrames(done) {
    const box = document.createElement("div");
    box.style.cssText = "position:fixed;left:-9999px;top:0;width:600px;height:400px;pointer-events:none;";
    const items = [];
    for (let i = 0; i < 80; i++) {
        const d = document.createElement("div");
        d.style.cssText = "position:absolute;width:40px;height:40px;border-radius:8px;background:#3b82f6;box-shadow:0 4px 10px rgba(0,0,0,.3);left:" + (i % 10) * 50 + "px;top:" + Math.floor(i / 10) * 45 + "px;";
        box.appendChild(d); items.push(d);
    }
    document.body.appendChild(box);
    const stamps = [];
    const start = performance.now();
    const step = now => {
        stamps.push(now);
        const k = (now - start) / 1000;
        items.forEach((d, i) => { d.style.transform = "translate(" + Math.sin(k * 3 + i) * 20 + "px," + Math.cos(k * 3 + i) * 20 + "px) rotate(" + (k * 90 + i) + "deg)"; });
        if (now - start < 1200 && !document.hidden) requestAnimationFrame(step);
        else {
            box.remove();
            const gaps = [];
            for (let i = 1; i < stamps.length; i++) gaps.push(stamps[i] - stamps[i - 1]);
            const sec = (stamps[stamps.length - 1] - stamps[0]) / 1000;
            done(gaps.length && sec > 0.3 ? { fps: Math.round(gaps.length / sec), slow: gaps.filter(g => g > 33).length, worst: Math.round(Math.max.apply(null, gaps)) } : null);
        }
    };
    requestAnimationFrame(step);
}
function diagStorageKB() {
    let n = 0;
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += (k.length + (localStorage.getItem(k) || "").length) * 2; } } catch (e) { return null; }
    return Math.round(n / 1024);
}
function diagMemory() {
    const out = { heapMB: null, limitMB: null, deviceGB: navigator.deviceMemory || null, cores: navigator.hardwareConcurrency || null };
    try { if (performance.memory) { out.heapMB = Math.round(performance.memory.usedJSHeapSize / 1048576); out.limitMB = Math.round(performance.memory.jsHeapSizeLimit / 1048576); } } catch (e) { /* 何もしない */ }
    return out;
}

// 結果から、勧めることを作ります
function diagAdvise(r) {
    const list = [];
    const lite = document.body.classList.contains("lite-mode");
    const animOn = !!($id("smoothAnimToggle") && $id("smoothAnimToggle").checked);
    const slow = (r.cpu !== null && r.cpu > 400) || (r.frames && (r.frames.fps < 40 || r.frames.slow > 12)) || (r.startup !== null && r.startup > 4000);
    const veryslow = (r.cpu !== null && r.cpu > 900) || (r.frames && r.frames.fps < 25);
    if (slow && !lite) list.push({ t: "軽量モードをオンにすると、ぼかしや影を減らして、動きが軽くなります。", b: "軽量モードをオンにする", a: "diagLite" });
    if (veryslow && animOn) list.push({ t: "全体アニメーション演出をオフにすると、席替えの演出がかなり軽くなります。", b: "全体アニメーションをオフにする", a: "diagAnim" });
    if (slow && SekigaeApp.plugins.filter(p => !p.required && SekigaeApp.isEnabled(p.id)).length > 25 && typeof presetApply === "function")
        list.push({ t: "使う機能を減らすと読み込みと画面の部品が減ります。「簡単」か「授業用」が、お勧めです。", b: "「授業用」に切りかえる", a: "diagPreset" });
    if (r.storageKB !== null && r.storageKB > 3000) list.push({ t: "保存してあるデータが多めです（" + Math.round(r.storageKB / 1024 * 10) / 10 + "MB）。設定のバックアップを取ってから、使わない記録を整理すると、軽くなることがあります。" });
    if (r.mem.deviceGB && r.mem.deviceGB <= 4) list.push({ t: "この端末のメモリは少なめです（" + r.mem.deviceGB + "GB以下）。他のタブやアプリを閉じると、動きが安定します。" });
    if (!list.length) list.push({ t: "今のところ、重くなる原因は見つかりませんでした。動きが重い時は他のタブやアプリを閉じてから、もう一度、診断してみてください。" });
    return list;
}
function diagLite() { const t = $id("liteModeToggle"); if (t) { t.checked = true; toggleLiteMode(); } diagRender(); }
function diagAnim() { const t = $id("smoothAnimToggle"); if (t) { t.checked = false; if (typeof toggleSmoothAnimation === "function") toggleSmoothAnimation(); } diagRender(); }
function diagPreset() { if (typeof presetApply === "function") presetApply("class"); }

// ---- 画面 ----
function diagModalOpen() { const o = $id("diagModalOverlay"); return !!o && o.style.display !== "none"; }
function openDiagnostics() {
    if (typeof closePopMenus === "function") closePopMenus();
    $id("diagModalOverlay").style.display = "flex";
    let last = null;
    try { last = JSON.parse(lsGet(DIAG_KEY, "null")); } catch (e) { last = null; }
    diagResult = last && last.cpu !== undefined ? last : null;
    diagRender();
}
function closeDiagnostics() { const o = $id("diagModalOverlay"); if (o) o.style.display = "none"; }
function diagRun() {
    if (diagBusy) return;
    diagBusy = true;
    $id("diagRunBtn").disabled = true;
    $id("diagBody").innerHTML = '<p class="config-note" data-keep="1">測っています。2秒程、お待ちください…</p>';
    // 画面が切りかわってから、測ります
    setTimeout(() => {
        const cpu = diagCpu();
        diagFrames(frames => {
            diagResult = {
                at: Date.now(), startup: diagStartup(), cpu: cpu, frames: frames, mem: diagMemory(), storageKB: diagStorageKB(),
                plugins: SekigaeApp.plugins.filter(p => SekigaeApp.isEnabled(p.id)).length, pluginsAll: SekigaeApp.plugins.length,
                seats: (currentStudents || []).length, lite: document.body.classList.contains("lite-mode")
            };
            lsSet(DIAG_KEY, JSON.stringify(diagResult));
            diagBusy = false;
            $id("diagRunBtn").disabled = false;
            diagRender();
        });
    }, 60);
}
function diagLevel(kind, v) {
    if (v === null || v === undefined) return "none";
    if (kind === "startup") return v < 2500 ? "good" : (v < 5000 ? "mid" : "bad");
    if (kind === "cpu") return v < 250 ? "good" : (v < 600 ? "mid" : "bad");
    if (kind === "fps") return v >= 50 ? "good" : (v >= 30 ? "mid" : "bad");
    return "none";
}
function diagRender() {
    const body = $id("diagBody");
    if (!body || diagBusy) return;
    const r = diagResult;
    if (!r) { body.innerHTML = '<p class="config-note" data-keep="1">「診断する」を押すとこの端末での動きの速さを測ります。</p>'; $id("diagCopyBtn").disabled = true; return; }
    $id("diagCopyBtn").disabled = false;
    const card = (label, value, level, note) => '<div class="diag-card diag-' + level + '"><span class="diag-label">' + label + '</span><strong>' + value + '</strong><span class="diag-note">' + note + "</span></div>";
    const lvl = { good: "速い", mid: "普通", bad: "遅め", none: "測れませんでした" };
    const sl = diagLevel("startup", r.startup), cl = diagLevel("cpu", r.cpu), fl = diagLevel("fps", r.frames ? r.frames.fps : null);
    let html = '<div class="diag-grid">' +
        card("起動の時間", r.startup === null ? "-" : (r.startup / 1000).toFixed(1) + "秒", sl, lvl[sl]) +
        card("計算の速さ", r.cpu + "ミリ秒", cl, lvl[cl]) +
        card("描画の速さ", r.frames ? r.frames.fps + " コマ/秒" : "-", fl, r.frames ? lvl[fl] + (r.frames.slow ? "　カクつき " + r.frames.slow + " 回" : "") : lvl.none) +
        card("メモリ", r.mem.heapMB !== null ? r.mem.heapMB + "MB" : "-", "none", (r.mem.heapMB !== null ? "このアプリが使っている量" : "この端末では測れません") + (r.mem.deviceGB ? "　端末 " + r.mem.deviceGB + "GB" : "")) +
        "</div>";
    html += '<p class="config-note" data-keep="1" style="margin: 8px 0;">使っている機能：' + r.plugins + " / " + r.pluginsAll + "個　座席：" + r.seats + "席　保存データ：" + (r.storageKB === null ? "-" : (r.storageKB / 1024).toFixed(1) + "MB") + "　軽量モード：" + (document.body.classList.contains("lite-mode") ? "オン" : "オフ") + "　測った時刻：" + new Date(r.at).toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) + "</p>";
    // 起動の準備に、時間がかかった機能（プラグインのメニューの「重さの目安」と同じ測り方です）
    try {
        const cost = SekigaeApp.plugins.filter(p => !p.required && SekigaeApp.isEnabled(p.id)).map(p => [p.name || p.id, (p._t_mount || 0) + (p._t_ready || 0)]).sort((a, b) => b[1] - a[1]).slice(0, 3).filter(c => c[1] >= 0.5);
        if (cost.length) html += '<p class="config-note" data-keep="1" style="margin: 8px 0;">起動の準備に時間がかかった機能：' + cost.map(c => diagEsc(c[0]) + " " + c[1].toFixed(1) + "ミリ秒").join("、") + '。使わない機能は「プラグインの設定」でオフにできます。</p>';
    } catch (e) { /* 何もしない */ }
    html += '<label class="input-label">お勧め</label><div class="diag-advice">' + diagAdvise(r).map(a => '<div class="diag-adv"><span>' + diagEsc(a.t) + "</span>" + (a.b ? '<button type="button" class="btn-secondary" onclick="' + a.a + '()">' + diagEsc(a.b) + "</button>" : "") + "</div>").join("") + "</div>";
    body.innerHTML = html;
}
function diagCopy() {
    const r = diagResult;
    if (!r) return;
    const text = ["席替えし太郎 動作の診断（" + new Date(r.at).toLocaleString("ja-JP") + "）",
        "起動の時間：" + (r.startup === null ? "-" : (r.startup / 1000).toFixed(1) + "秒"), "計算の速さ：" + r.cpu + "ミリ秒（小さい程速い）",
        "描画の速さ：" + (r.frames ? r.frames.fps + " コマ/秒、カクつき " + r.frames.slow + " 回、最大 " + r.frames.worst + "ミリ秒" : "-"),
        "メモリ：" + (r.mem.heapMB !== null ? r.mem.heapMB + "MB" : "-") + "　端末：" + (r.mem.deviceGB ? r.mem.deviceGB + "GB" : "-") + "　CPUコア：" + (r.mem.cores || "-"),
        "使っている機能：" + r.plugins + "/" + r.pluginsAll + "　座席：" + r.seats + "席　保存データ：" + (r.storageKB === null ? "-" : r.storageKB + "KB") + "　軽量モード：" + (r.lite ? "オン" : "オフ")].join("\n");
    const done = () => showToast("診断の結果をコピーしました。", "success");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => showToast("コピーできませんでした。", "error"));
    else showToast("コピーできませんでした。", "error");
}

const DIAG_CSS = `
.diag-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(135px, 1fr)); gap: 8px; margin: 6px 0; }
.diag-card { display: flex; flex-direction: column; gap: 2px; padding: 10px 12px; border-radius: 12px; background: var(--input-bg, #f2f2f7); color: var(--input-text, #1c1c1e); border-left: 5px solid #94a3b8; }
.diag-card strong { font-size: 18px; }
.diag-label { font-size: 12px; color: var(--text-sub, #64748b); }
.diag-note { font-size: 12px; }
.diag-good { border-left-color: #16a34a; }
.diag-mid { border-left-color: #f59e0b; }
.diag-bad { border-left-color: #dc2626; }
.diag-advice { display: flex; flex-direction: column; gap: 6px; margin-top: 4px; }
.diag-adv { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 8px 10px; border-radius: 10px; background: var(--input-bg, #f2f2f7); color: var(--input-text, #1c1c1e); font-size: 13px; line-height: 1.6; }
.diag-adv span { flex: 1 1 220px; }
.diag-adv button { width: auto; margin: 0; padding: 6px 12px; font-size: 12px; }
`;
const DIAG_HTML = `
<div id="diagModalOverlay" class="modal-overlay" style="display: none;">
    <div class="modal-content" style="max-width: 600px; width: 95%; max-height: 92vh; overflow-y: auto;">
        <h4 style="color: #0f766e;">🩺 動作の診断 <span data-diagtip="この端末での、起動の時間、計算の速さ、描画の速さ、メモリの使用量を測ります。測っている間（2秒程）は、画面を触らないでください。結果をもとに軽量モードなどの対処を勧めます。目安なのでその時の、他のアプリの使い方でも、変わります。"></span></h4>
        <div class="modal-btn-row" style="justify-content: flex-start; margin: 4px 0 8px;">
            <button type="button" id="diagRunBtn" class="btn-save" onclick="diagRun()">▶️ 診断する</button>
        </div>
        <div id="diagBody"></div>
        <div class="modal-btn-row">
            <button type="button" id="diagCopyBtn" onclick="diagCopy()" class="btn-secondary">📋 結果をコピー</button>
            <button type="button" onclick="closeDiagnostics()" class="btn-secondary">閉じる</button>
        </div>
    </div>
</div>`;

SekigaeApp.registerPlugin({
    id: "diagnostics",
    name: "動作の診断",
    version: "1.0",
    description: "起動にかかった時間、計算と描画の速さ、メモリの目安を測って、動きが重い時の対処を勧めます。軽量モードや、全体アニメーションのオフを、画面のボタンで試せます。",
    backupKeys: [DIAG_KEY],
    suggests: ["plugin-presets"],
    searchWords: "診断 動作 重い もっさり 遅い 速度 メモリ 軽量 起動 時間 フレーム カクつき 原因 パフォーマンス",
    mount(app) {
        const st = document.createElement("style");
        st.id = "diagStyle";
        st.textContent = DIAG_CSS;
        document.head.appendChild(st);
        document.body.insertAdjacentHTML("beforeend", DIAG_HTML);
        document.querySelectorAll("#diagModalOverlay [data-diagtip]").forEach(el => el.replaceWith(makeInfoTip(el.dataset.diagtip)));
        app.insertInto("settings-perf", '<button type="button" onclick="openDiagnostics()" class="btn-secondary" id="btnDiagnostics" style="margin-top: 10px;">動作の診断</button>');
        app.insertInto("guide-tools-items", '<li><strong>動作の診断</strong>：設定の「動作の軽さ」の「動作の診断」で、この端末での、起動の時間、計算と描画の速さ、メモリの目安を測ります。動きが重い時に軽量モードなどの対処を、ボタンで試せます。</li>');
    }
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && diagModalOpen() && !diagBusy) closeDiagnostics();
});
