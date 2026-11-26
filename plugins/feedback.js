// ==========================================
// 不具合・要望を送るプラグイン：アプリの中から、不具合の報告や、機能の要望を送ります
// 送った内容は、中継役（Cloudflare Workers）を通って、GitHubの Issue（公開）になります。GitHubのトークンは、アプリには入っていません
// 生徒の名前などが入らないよう、送る前に、名簿の名前・メールアドレス・電話番号を探して、見つかったら送れないようにします
// 「画面の状態」（版・画面スタイル・ブラウザ・直前のエラーコード）は、チェックを入れたときだけ付き、送る前に、全部見られます
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// ==========================================
const FB_RELAY_URL = "https://sekigae-feedback.tocoroten3391.workers.dev/";   // 中継役の URL（例：https://sekigae-feedback.xxxx.workers.dev）。空のときは、送らずに、コピーとGitHubで開く方法だけを出します
const FB_REPO = "Tocoroten3391/Sekigae-Shitaro_Apps";
const FB_DRAFT_KEY = "feedback_draft_v1";
const FB_SENT_KEY = "feedback_sent_v1";
const FB_KINDS = [
    { id: "bug", label: "不具合", hint: "うまく動かない・おかしい" },
    { id: "idea", label: "要望", hint: "こんな機能がほしい・ここを直してほしい" },
    { id: "question", label: "質問", hint: "使い方が分からない" }
];
const FB_ERRORS = {
    "F-NET": "通信できませんでした。内容は、下書きとして残してあります。通信できる場所で、もう一度送ってください。",
    "F-RATE": "短い時間に、たくさん送られました。1時間ほど、あけてから送ってください。",
    "F-BUSY": "いま、受け付けが混み合っています。明日、もう一度送ってください。",
    "F-SHORT": "内容が短すぎます。10文字以上で、書いてください。",
    "F-LONG": "内容が長すぎます。2000文字までに、まとめてください。",
    "F-SRV": "受け付けられませんでした。時間をおいて、もう一度ためしてください。続くときは、下の「GitHubで開く」を使ってください。"
};

const fbErrBuf = [];   // 直前の内部エラー（メッセージだけ。最大5件）
let fbKind = "bug";
let fbSending = false;

function fbRelayUrl() {
    try { const o = localStorage.getItem("feedback_relay_url"); if (o) return o; } catch (e) { /* 何もしない */ }
    return FB_RELAY_URL;
}
function fbEsc(t) { return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function fbLoad(key, def) { try { const v = JSON.parse(localStorage.getItem(key) || "null"); return v == null ? def : v; } catch (e) { return def; } }
function fbSave(key, v) { try { localStorage.setItem(key, JSON.stringify(v)); } catch (e) { /* 保存できなくても、続ける */ } }

function fbPushError(msg) {
    const m = String(msg || "").replace(/https?:\/\/\S+/g, "<URL>").replace(/\s+/g, " ").slice(0, 160);
    if (!m) return;
    fbErrBuf.push(m);
    while (fbErrBuf.length > 5) fbErrBuf.shift();
}
window.addEventListener("error", ev => { fbPushError(ev && ev.message); });
window.addEventListener("unhandledrejection", ev => { const r = ev && ev.reason; fbPushError("Promise: " + (r && r.message ? r.message : r)); });

// ---- 画面の状態 ----
function fbBrowserName() {
    const ua = navigator.userAgent || "";
    const m = ua.match(/(Edg|Chrome|Firefox|Safari|CriOS)\/([\d.]+)/);
    const os = /CrOS/.test(ua) ? "Chromebook" : /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "Mac" : /Linux/.test(ua) ? "Linux" : "";
    return (m ? m[1].replace("Edg", "Edge").replace("CriOS", "Chrome") + " " + m[2].split(".")[0] : "不明") + (os ? "／" + os : "");
}
function fbEnv() {
    const e = {};
    e.version = typeof APP_VERSION !== "undefined" ? APP_VERSION : "";
    try { e.style = localStorage.getItem("ui_style") || "a"; } catch (x) { e.style = ""; }
    const standalone = (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) || navigator.standalone;
    e.mode = location.protocol === "file:" ? "ファイルを直接開いている" : (standalone ? "インストールしたアプリ" : "Webのページ");
    e.ua = fbBrowserName();
    e.screen = window.innerWidth + "×" + window.innerHeight;
    e.online = navigator.onLine === false ? "オフライン" : "オンライン";
    try { const r = typeof gasReadLast === "function" ? gasReadLast() : null; if (r && r.code) e.gasError = r.code; } catch (x) { /* 何もしない */ }
    try { e.plugins = SekigaeApp.plugins.filter(p => SekigaeApp.isEnabled(p.id)).map(p => p.id); } catch (x) { e.plugins = []; }
    e.errors = fbErrBuf.slice();
    return e;
}
function fbEnvLines(e) {
    const L = [];
    L.push("バージョン：" + e.version);
    L.push("画面スタイル：" + e.style);
    L.push("開き方：" + e.mode);
    L.push("ブラウザ：" + e.ua);
    L.push("画面の大きさ：" + e.screen);
    L.push("通信：" + e.online);
    if (e.gasError) L.push("直前の同期エラー：" + e.gasError);
    L.push("使っている部品：" + (e.plugins.length ? e.plugins.join(", ") : "なし"));
    L.push("直前の内部エラー：" + (e.errors.length ? "\n  " + e.errors.join("\n  ") : "なし"));
    return L;
}

// ---- 個人情報の見張り ----
function fbRosterNames() {
    const set = new Set();
    try {
        (currentStudents || []).forEach(s => {
            if (!s || s.type !== "STUDENT" || !s.text) return;
            const n = (getSeatDisplayParts(s.text).name || "").replace(/\s+/g, "");
            if (n.length >= 2) set.add(n);
        });
    } catch (e) { /* 何もしない */ }
    return Array.from(set);
}
function fbCheckText(text) {
    const t = String(text || "");
    const flat = t.replace(/\s+/g, "");
    const problems = [];
    const names = fbRosterNames().filter(n => flat.includes(n));
    if (names.length) problems.push("名簿の名前（" + names.slice(0, 3).join("、") + (names.length > 3 ? "など" : "") + "）が入っています。『ある生徒』のように、書きかえてください。");
    if (/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/.test(t)) problems.push("メールアドレスらしいものが入っています。消してください。");
    if (/0\d{1,4}[-ー−\s]?\d{1,4}[-ー−\s]?\d{3,4}/.test(t)) problems.push("電話番号らしいものが入っています。消してください。");
    const warns = [];
    try {
        const cls = Object.keys(JSON.parse(localStorage.getItem("seat_shuffler_presets") || "{}")).filter(n => n && n.length >= 3 && flat.includes(n.replace(/\s+/g, "")));
        if (cls.length) warns.push("クラス名（" + cls.slice(0, 2).join("、") + "）が入っています。学校が分かる場合は、消すことをおすすめします。");
    } catch (e) { /* 何もしない */ }
    return { problems, warns };
}

// ---- 送信 ----
function fbGithubUrl(kind, text, envLines) {
    const k = FB_KINDS.find(x => x.id === kind) || FB_KINDS[0];
    const first = String(text).split(/\r?\n/)[0].slice(0, 50);
    const body = "**種類**：" + k.label + "\n\n" + String(text).split(/\r?\n/).map(l => "> " + l).join("\n") + (envLines ? "\n\n```\n" + envLines.join("\n") + "\n```" : "");
    return "https://github.com/" + FB_REPO + "/issues/new?labels=" + encodeURIComponent(k.label) + "&title=" + encodeURIComponent("[" + k.label + "] " + first) + "&body=" + encodeURIComponent(body.slice(0, 5500));
}
async function fbSend() {
    if (fbSending) return;
    const ta = $id("fbText");
    const text = ta ? ta.value.trim() : "";
    const chk = fbCheckText(text);
    if (text.length < 10) { fbShowMsg(FB_ERRORS["F-SHORT"] + "（F-SHORT）", true); return; }
    if (text.length > 2000) { fbShowMsg(FB_ERRORS["F-LONG"] + "（F-LONG）", true); return; }
    if (chk.problems.length) { fbShowMsg(chk.problems.join("\n"), true); return; }
    const url = fbRelayUrl();
    if (!url) { fbShowMsg("送り先を準備中です。「内容をコピー」か「GitHubで開く」を使ってください。", true); return; }
    const withEnv = $id("fbWithEnv") && $id("fbWithEnv").checked;
    fbSending = true;
    fbSetBusy(true);
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = setTimeout(() => { if (ctl) ctl.abort(); }, 15000);
    try {
        // 「text/plain」で送ると、ブラウザの事前確認（プリフライト）が要らず、ファイルを直接開いていても送れます
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain;charset=UTF-8" }, body: JSON.stringify({ kind: fbKind, text, env: withEnv ? fbEnv() : {}, hp: ($id("fbHp") || {}).value || "" }), signal: ctl ? ctl.signal : undefined });
        let d = null;
        try { d = await res.json(); } catch (e) { d = null; }
        if (d && d.ok) {
            const sent = fbLoad(FB_SENT_KEY, []);
            if (d.number) sent.unshift({ n: d.number, url: d.url, kind: fbKind, title: text.split(/\r?\n/)[0].slice(0, 40), t: Date.now() });
            fbSave(FB_SENT_KEY, sent.slice(0, 20));
            try { localStorage.removeItem(FB_DRAFT_KEY); } catch (e) { /* 何もしない */ }
            fbShowDone(d);
        } else {
            const err = d && d.error;
            const code = err === "rate_limit" ? "F-RATE" : err === "busy" ? "F-BUSY" : err === "too_short" ? "F-SHORT" : err === "too_long" ? "F-LONG" : "F-SRV";
            fbShowMsg(FB_ERRORS[code] + "（" + code + (err && code === "F-SRV" ? "／" + err : "") + "）", true);
        }
    } catch (e) {
        fbSaveDraft();
        fbShowMsg(FB_ERRORS["F-NET"] + "（F-NET）", true);
    } finally {
        clearTimeout(timer);
        fbSending = false;
        fbSetBusy(false);
    }
}
function fbSetBusy(b) { const bt = $id("fbSendBtn"); if (bt) { bt.disabled = b; bt.textContent = b ? "送っています…" : "送る"; } }
function fbShowMsg(msg, isErr) {
    const m = $id("fbMsg");
    if (!m) return;
    m.className = "fb-msg" + (isErr ? " fb-msg-err" : "");
    m.textContent = msg;
    m.style.display = msg ? "" : "none";
}
function fbShowDone(d) {
    const body = $id("fbBody");
    if (!body) return;
    body.innerHTML = '<div class="fb-done"><div class="fb-done-title">送りました。ありがとうございます。</div>' +
        (d.number ? '<p>報告の番号は <b>#' + fbEsc(d.number) + '</b> です。返事や対応の様子は、「送った報告」で見られます。</p>' : "") +
        '<p>公開の場所（GitHub）に載ります。生徒の名前などは、入っていないはずですが、もし入っていたら、すぐに、お知らせください。</p></div>';
    const bar = $id("fbBtns"); if (bar) bar.style.display = "none";
}

// ---- 下書き ----
function fbSaveDraft() {
    const ta = $id("fbText");
    if (!ta) return;
    if (!ta.value.trim()) { try { localStorage.removeItem(FB_DRAFT_KEY); } catch (e) { /* 何もしない */ } return; }
    fbSave(FB_DRAFT_KEY, { kind: fbKind, text: ta.value, t: Date.now() });
}

// ---- 画面 ----
const FB_CSS = `
#fbOverlay .modal-content { max-width: 600px; width: 95%; }
#fbOverlay .fb-notice { background: #fffbeb; border: 1px solid #fcd34d; color: #78350f; border-radius: 10px; padding: 8px 12px; font-size: 12.5px; line-height: 1.7; margin: 0 0 10px; }
#fbOverlay .fb-notice b { color: #b45309; }
#fbOverlay .fb-kinds { display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0; }
#fbOverlay .fb-kind { padding: 6px 14px; border-radius: 999px; border: 1px solid var(--seat-border); background: var(--card-bg); color: var(--text-main); cursor: pointer; font-size: 13px; font-weight: 700; }
#fbOverlay .modal-content .fb-kind { height: auto !important; min-height: 34px; width: auto !important; margin: 0 !important; }
#fbOverlay .modal-content .fb-kind.on { background: var(--accent-color) !important; color: #fff !important; border-color: var(--accent-color) !important; }
#fbOverlay .fb-kind-hint { font-size: 12px; color: var(--text-sub); margin: 0 0 6px; }
#fbOverlay textarea#fbText { width: 100%; min-height: 130px; box-sizing: border-box; padding: 10px; border-radius: 10px; border: 1px solid var(--seat-border); font-size: 14px; line-height: 1.6; font-family: inherit; resize: vertical; }
#fbOverlay .modal-content #fbSendBtn { background: var(--accent-color) !important; color: #fff !important; border-color: var(--accent-color) !important; }
#fbOverlay .fb-count { text-align: right; font-size: 12px; color: var(--text-sub); }
#fbOverlay .fb-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 8px 0; font-size: 13px; }
#fbOverlay .fb-row label { display: inline-flex; align-items: center; gap: 4px; }
#fbOverlay pre.fb-env { white-space: pre-wrap; word-break: break-all; background: var(--body-bg); border: 1px solid var(--seat-border); border-radius: 8px; padding: 8px 10px; font-size: 12px; margin: 6px 0; max-height: 180px; overflow: auto; }
#fbOverlay .fb-msg { border-radius: 10px; padding: 8px 12px; font-size: 13px; line-height: 1.6; margin: 8px 0; white-space: pre-line; background: #ecfdf5; color: #065f46; border: 1px solid #6ee7b7; }
#fbOverlay .fb-msg-err { background: #fef2f2; color: #7f1d1d; border-color: #fca5a5; }
#fbOverlay .fb-warn { background: #fff7ed; color: #9a3412; border: 1px solid #fdba74; border-radius: 10px; padding: 6px 12px; font-size: 12.5px; margin: 6px 0; }
#fbOverlay .fb-done { text-align: center; padding: 16px 4px; }
#fbOverlay .fb-done-title { font-size: 17px; font-weight: 800; margin-bottom: 8px; }
#fbOverlay .fb-sent { list-style: none; margin: 6px 0; padding: 0; font-size: 13px; }
#fbOverlay .fb-sent li { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding: 6px 0; border-bottom: 1px solid var(--seat-border); }
#fbOverlay .fb-hp { position: absolute; left: -9999px; width: 1px; height: 1px; opacity: 0; }
body.theme-dark #fbOverlay .fb-notice, body.theme-blackboard #fbOverlay .fb-notice, body.theme-game #fbOverlay .fb-notice { background: #3a2a05; border-color: #92400e; color: #fde68a; }
`;

function fbModalHtml() {
    return `<div id="fbOverlay" class="modal-overlay" style="display: none;">
  <div class="modal-content">
    <h4>不具合・要望を送る</h4>
    <div id="fbBody"></div>
    <div class="modal-btn-row" id="fbBtns"><button type="button" id="fbSendBtn" data-fb="send">送る</button><button type="button" data-fb="close">閉じる</button></div>
  </div>
</div>`;
}
function fbRender(prefill) {
    const body = $id("fbBody");
    if (!body) return;
    const draft = fbLoad(FB_DRAFT_KEY, null);
    const text = prefill && prefill.text != null ? prefill.text : (draft ? draft.text : "");
    if (prefill && prefill.kind) fbKind = prefill.kind; else if (draft && draft.kind) fbKind = draft.kind;
    const k = FB_KINDS.find(x => x.id === fbKind) || FB_KINDS[0];
    const hasRelay = !!fbRelayUrl();
    const sent = fbLoad(FB_SENT_KEY, []);
    const bar = $id("fbBtns");
    if (bar) { bar.style.display = ""; const sb = $id("fbSendBtn"); if (sb) sb.style.display = hasRelay ? "" : "none"; }
    body.innerHTML =
        '<div class="fb-notice"><b>この内容は、公開されます（GitHub）。</b>児童生徒の名前・名簿・メールアドレス・電話番号は、書かないでください。送る前に、名前などが入っていないか、アプリが確認します。</div>' +
        '<div class="fb-kinds">' + FB_KINDS.map(x => '<button type="button" class="fb-kind' + (x.id === fbKind ? " on" : "") + '" data-fb-kind="' + x.id + '">' + x.label + '</button>').join("") + '</div>' +
        '<p class="fb-kind-hint" id="fbKindHint">' + fbEsc(k.hint) + '</p>' +
        '<textarea id="fbText" maxlength="2000" placeholder="' + (fbKind === "bug" ? "どの画面で、何をしたら、どうなりましたか？（例：席替えスタートを押すと、画面が止まる）" : fbKind === "idea" ? "どんなときに、どんな機能があると、助かりますか？" : "知りたいことを、書いてください。") + '">' + fbEsc(text) + '</textarea>' +
        '<div class="fb-count"><span id="fbCount">0</span> / 2000</div>' +
        '<input type="text" id="fbHp" class="fb-hp" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<div class="fb-row"><label><input type="checkbox" id="fbWithEnv" checked> 画面の状態もつける（版・ブラウザ・直前のエラーなど）</label></div>' +
        '<details><summary style="cursor:pointer;font-size:13px;">付ける内容を見る</summary><pre class="fb-env" id="fbEnvPre"></pre></details>' +
        '<div id="fbWarn"></div>' +
        '<div class="fb-msg" id="fbMsg" style="display:none;"></div>' +
        '<div class="fb-row"><button type="button" class="btn-secondary" data-fb="copy">内容をコピー</button><button type="button" class="btn-secondary" data-fb="github">GitHubで開く</button>' +
        (hasRelay ? '' : '<span style="font-size:12px;color:var(--text-sub);">（送り先を準備中です）</span>') + '</div>' +
        (sent.length ? '<h5 style="margin:14px 0 4px;font-size:14px;">送った報告</h5><ul class="fb-sent">' + sent.slice(0, 5).map(s =>
            '<li><span>#' + fbEsc(s.n) + '</span><span>' + fbEsc(s.title) + '</span><a href="' + fbEsc(s.url) + '" target="_blank" rel="noopener">開く</a><span class="fb-state" data-n="' + fbEsc(s.n) + '"></span></li>').join("") +
            '</ul><button type="button" class="btn-secondary btn-compact" data-fb="status">状況を見る</button>' : '');
    fbUpdateLive();
}
function fbUpdateLive() {
    const ta = $id("fbText");
    if (!ta) return;
    const c = $id("fbCount"); if (c) c.textContent = ta.value.length;
    const pre = $id("fbEnvPre"); if (pre) pre.textContent = fbEnvLines(fbEnv()).join("\n");
    const w = $id("fbWarn");
    if (w) {
        const r = fbCheckText(ta.value);
        w.innerHTML = r.problems.map(p => '<div class="fb-msg fb-msg-err">' + fbEsc(p) + '</div>').join("") + r.warns.map(p => '<div class="fb-warn">' + fbEsc(p) + '</div>').join("");
    }
}
async function fbStatus() {
    const els = document.querySelectorAll("#fbOverlay .fb-state");
    for (const el of els) {
        const n = el.dataset.n;
        el.textContent = "確認中…";
        try {
            const r = await fetch("https://api.github.com/repos/" + FB_REPO + "/issues/" + encodeURIComponent(n), { headers: { "Accept": "application/vnd.github+json" } });
            if (!r.ok) { el.textContent = "（確認できませんでした）"; continue; }
            const d = await r.json();
            const done = d.state === "closed";
            el.textContent = (done ? (d.state_reason === "not_planned" ? "対応しない／見送り" : "対応済み") : "受付中") + (d.comments ? "・返信 " + d.comments + " 件" : "");
        } catch (e) { el.textContent = "（通信できませんでした）"; }
    }
}
function openFeedback(opts) {
    opts = opts || {};
    if (typeof closeConfigMenuIfOpen === "function") closeConfigMenuIfOpen();
    fbRender(opts);
    const o = $id("fbOverlay");
    if (o) o.style.display = "flex";
    const ta = $id("fbText"); if (ta) ta.focus();
}
function closeFeedback() { fbSaveDraft(); const o = $id("fbOverlay"); if (o) o.style.display = "none"; }

SekigaeApp.registerPlugin({
    id: "feedback",
    name: "不具合・要望を送る",
    version: "1.0",
    description: "アプリの中から、不具合の報告や機能の要望を送ります。内容は、公開のGitHub（Issue）になります。名簿の名前などが入っていないか、送る前に確認します。",
    searchWords: "不具合 バグ 報告 要望 機能 リクエスト 問い合わせ 質問 フィードバック 意見 ご意見 送る",
    stubs: [],
    mount(app) {
        const st = document.createElement("style");
        st.id = "feedbackStyle";
        st.textContent = FB_CSS;
        document.head.appendChild(st);
        document.body.insertAdjacentHTML("beforeend", fbModalHtml());
        app.insertInto("settings-system", '<button type="button" id="fbOpenBtn" class="btn-secondary" style="margin-top: 10px;">不具合・要望を送る</button>');
        app.insertInto("guide-faq", "<li><strong>不具合を見つけた・こんな機能がほしい</strong>：設定の「機能・プラグイン」にある「不具合・要望を送る」から送れます。同期のエラーが出たときは、エラーの欄の「このエラーを報告」からも送れます。内容は公開されるので、生徒の名前は書かないでください。</li>");
        document.addEventListener("click", ev => {
            const t = ev.target.closest ? ev.target.closest("#fbOpenBtn, [data-fb], [data-fb-kind]") : null;
            if (!t) return;
            if (t.id === "fbOpenBtn") { openFeedback(); return; }
            if (t.dataset.fbKind) {
                fbSaveDraft();
                const text = ($id("fbText") || {}).value || "";
                fbKind = t.dataset.fbKind;
                fbRender({ kind: fbKind, text });
                return;
            }
            const act = t.dataset.fb;
            if (act === "close") closeFeedback();
            else if (act === "send") fbSend();
            else if (act === "status") fbStatus();
            else if (act === "copy" || act === "github") {
                const text = (($id("fbText") || {}).value || "").trim();
                const chk = fbCheckText(text);
                if (chk.problems.length) { fbShowMsg(chk.problems.join("\n"), true); return; }
                if (!text) { fbShowMsg("内容を書いてください。", true); return; }
                const withEnv = $id("fbWithEnv") && $id("fbWithEnv").checked;
                const lines = withEnv ? fbEnvLines(fbEnv()) : null;
                const k = FB_KINDS.find(x => x.id === fbKind) || FB_KINDS[0];
                if (act === "github") { window.open(fbGithubUrl(fbKind, text, lines), "_blank", "noopener"); return; }
                const all = "【" + k.label + "】\n" + text + (lines ? "\n\n" + lines.join("\n") : "");
                if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(all).then(() => fbShowMsg("内容をコピーしました。", false), () => fbShowMsg("コピーできませんでした。", true));
                else fbShowMsg("コピーできませんでした。", true);
            }
        });
        document.addEventListener("input", ev => {
            if (ev.target && ev.target.id === "fbText") { fbShowMsg("", false); fbUpdateLive(); fbSaveDraft(); }
            if (ev.target && ev.target.id === "fbWithEnv") fbUpdateLive();
        });
        document.addEventListener("keydown", ev => {
            if (ev.key !== "Escape") return;
            const o = $id("fbOverlay");
            if (o && o.style.display !== "none") closeFeedback();
        });
    }
});
