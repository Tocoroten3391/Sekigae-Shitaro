// ==========================================
// 画面を撮るプラグイン：いまの画面を、アプリの中で、画像にします。
// ・名簿の名前とふりがなは、撮るときに、すべて「✕」にします（✕は、文字の数だけ並びます）
// ・撮った画像は、保存・コピー・不具合として送る、ができます
// ・不具合・要望を送る画面からも、「いまの画面を撮る」で、そのまま付けられます
// 画面を画像にする部品は、lib/html-to-image.js です。初めて撮るときだけ、読み込みます
// ==========================================

const SHOT_LIB = "lib/html-to-image.js";
const SHOT_SKIP_IDS = ["shotBusy", "shotOverlay"];
const SHOT_KEEP = ["席替えし太郎"];   // 名前にしない言葉
let shotRunning = false;
let shotLast = null;   // 直前に撮った画像（canvas）

function shotLoadLib() {
    if (window.htmlToImage) return Promise.resolve();
    return new Promise((ok, ng) => {
        const s = document.createElement("script");
        s.src = SHOT_LIB;
        s.onload = () => (window.htmlToImage ? ok() : ng(new Error("lib")));
        s.onerror = () => ng(new Error("lib"));
        document.head.appendChild(s);
    });
}

// ---- 名前の集め方 ----
// いまのクラスの名簿・保存してあるすべてのクラスの名簿・ふりがなを、集めます
function shotCollectNames() {
    const out = new Set();
    const addRaw = raw => {
        let n = "";
        try { n = typeof getSeatDisplayParts === "function" ? getSeatDisplayParts(raw).name : String(raw || ""); } catch (e) { n = String(raw || ""); }
        n = String(n || "").trim();
        if (!n) return;
        addName(n);
    };
    const addName = n => {
        const plain = n.replace(/\s+/g, "");
        [n, plain].forEach(v => { if (v.replace(/\s/g, "").length >= 2) out.add(v); });
        n.split(/\s+/).forEach(part => { if (part.length >= 2) out.add(part); });
    };
    try { (typeof lastRawList !== "undefined" && lastRawList ? lastRawList : []).forEach(addRaw); } catch (e) { /* 何もしない */ }
    try { (typeof currentStudents !== "undefined" && currentStudents ? currentStudents : []).forEach(s => { if (s && s.text) addRaw(s.text); }); } catch (e) { /* 何もしない */ }
    try {
        const pr = JSON.parse(localStorage.getItem("seat_shuffler_presets") || "{}") || {};
        Object.keys(pr).forEach(k => {
            const st = pr[k] && pr[k].students;
            if (typeof st === "string") st.split(/[\n,]/).forEach(addRaw);
            else if (Array.isArray(st)) st.forEach(addRaw);
        });
    } catch (e) { /* 何もしない */ }
    try {
        if (typeof furiganaMap === "object" && furiganaMap) Object.keys(furiganaMap).forEach(k => { addName(k); if (furiganaMap[k]) addName(String(furiganaMap[k])); });
    } catch (e) { /* 何もしない */ }
    return Array.from(out).slice(0, 4000);
}
function shotXml(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function shotRegEsc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

// 画像にする前の文章（SVG）の中の名前を、✕にします。画面そのものは、変えません
function shotMaskSvg(svg, names) {
    const list = [];
    names.forEach(n => { list.push(n); const x = shotXml(n); if (x !== n) list.push(x); });
    list.sort((a, b) => b.length - a.length);
    if (!list.length) return { svg, count: 0 };
    let count = 0;
    // アプリの名前など、名前と同じ文字が入っている決まった言葉は、✕にしません（「太郎」さんがいても、「席替えし太郎」は、そのまま）
    const keep = SHOT_KEEP.map((w, i) => [w, "\uE000" + i + "\uE001"]);
    let base = svg;
    keep.forEach(k => { base = base.split(k[0]).join(k[1]); });
    const re = new RegExp(list.map(shotRegEsc).join("|"), "g");
    let out = base.replace(re, m => { count++; return m.replace(/\S/g, "✕"); });
    keep.forEach(k => { out = out.split(k[1]).join(k[0]); });
    return { svg: out, count };
}

function shotLoadImg(src) {
    return new Promise((ok, ng) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => ng(new Error("img")); im.src = src; });
}

// ---- 撮影 ----
// opts.skip：写さない部品の id（例：不具合・要望の窓）
async function shotCapture(opts) {
    opts = opts || {};
    await shotLoadLib();
    const W = Math.max(1, window.innerWidth), H = Math.max(1, window.innerHeight);
    const skip = new Set(SHOT_SKIP_IDS.concat(opts.skip || []));
    const filter = n => {
        if (n.nodeType !== 1) return true;
        const t = n.tagName;
        if (t === "SCRIPT" || t === "NOSCRIPT" || t === "IFRAME" || t === "VIDEO" || t === "AUDIO") return false;
        if (n.id && skip.has(n.id)) return false;
        if (n === document.body) return true;
        try {
            const cs = getComputedStyle(n);
            if (cs.display === "none") return false;
            // 画面の外にある部品は、写らないので、省きます（左に隠れている設定の画面などを、含めないため。画像の大きさと、時間が、ぐっと減ります）
            const r = n.getBoundingClientRect();
            if (r.width > 0 && r.height > 0 && (r.right <= 0 || r.left >= W || r.bottom <= 0 || r.top >= H)) return false;
            return true;
        } catch (e) { return true; }
    };
    const url = await window.htmlToImage.toSvg(document.body, {
        width: W, height: H, skipFonts: true, filter,
        style: { transform: "translate(" + (-window.scrollX) + "px, " + (-window.scrollY) + "px)" }
    });
    const prefix = url.slice(0, url.indexOf(",") + 1);
    const masked = shotMaskSvg(decodeURIComponent(url.slice(prefix.length)), shotCollectNames());
    const img = await shotLoadImg(prefix + encodeURIComponent(masked.svg));
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const x = c.getContext("2d");
    let bg = "";
    try { bg = getComputedStyle(document.body).backgroundColor; if (!bg || /rgba\(.*,\s*0\)$|transparent/.test(bg)) bg = getComputedStyle(document.documentElement).backgroundColor; } catch (e) { /* 何もしない */ }
    x.fillStyle = (bg && !/rgba\(.*,\s*0\)$|transparent/.test(bg)) ? bg : "#ffffff";
    x.fillRect(0, 0, W, H);
    x.drawImage(img, 0, 0, W, H);
    c.shotMasked = masked.count;
    return c;
}

function shotBusy(on, text) {
    let b = $id("shotBusy");
    if (!on) { if (b) b.remove(); return; }
    if (!b) {
        b = document.createElement("div");
        b.id = "shotBusy";
        b.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;background:#0f172a;color:#fff;padding:10px 18px;border-radius:999px;font-size:14px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.3);";
        document.body.appendChild(b);
    }
    b.textContent = text || "撮影しています";
}

const SHOT_ERR = "撮影できませんでした。もう一度試してください。続く時は不具合として送ってください。F-SHOT";

// 撮って、結果の画面を出します
async function shotRun(opts) {
    if (shotRunning) return;
    shotRunning = true;
    try {
        if (typeof closeConfigMenuIfOpen === "function") closeConfigMenuIfOpen();
        shotBusy(true, "撮影しています");
        await new Promise(r => setTimeout(r, 450));   // 設定のメニューが、閉じ終わるのを待つ
        const c = await shotCapture(opts);
        shotLast = c;
        shotBusy(false);
        shotShow(c);
    } catch (e) {
        shotBusy(false);
        if (typeof showToast === "function") showToast(SHOT_ERR, "error");
    } finally { shotRunning = false; }
}

// ---- 結果の画面 ----
const SHOT_CSS = `
#shotOverlay .modal-content { max-width: 920px; width: 96%; }
#shotOverlay .shot-note { font-size: 13px; color: var(--text-sub); margin: 0 0 8px; line-height: 1.6; }
#shotOverlay .shot-prev { border: 1px solid var(--seat-border); border-radius: 10px; background: #e5e7eb; padding: 6px; text-align: center; }
#shotOverlay .shot-prev img { display: block; margin: 0 auto; max-width: 100%; max-height: 58vh; width: auto; height: auto; }
#shotOverlay .modal-btn-row { flex-wrap: wrap; gap: 8px; }
#shotOverlay .modal-content .modal-btn-row button { height: auto !important; min-height: 40px; width: auto !important; margin: 0 !important; padding: 8px 16px; font-weight: 700; }
`;
function shotModalHtml() {
    return `<div id="shotOverlay" class="modal-overlay" style="display: none;">
  <div class="modal-content">
    <h4>撮った画面</h4>
    <p class="shot-note" id="shotNote"></p>
    <div class="shot-prev"><img id="shotImg" alt="撮った画面"></div>
    <div class="modal-btn-row"><button type="button" data-shot="save">画像を保存</button><button type="button" class="btn-secondary" data-shot="copy">コピー</button><button type="button" class="btn-secondary" id="shotReportBtn" data-shot="report">不具合として送る</button><button type="button" class="btn-secondary" data-shot="again">撮り直す</button><button type="button" data-shot="close">閉じる</button></div>
  </div>
</div>`;
}
function shotFeedbackOn() {
    try { return typeof openFeedback === "function" && typeof fbAttachImage === "function" && SekigaeApp.isEnabled("feedback") && !!$id("fbOverlay"); } catch (e) { return false; }
}
function shotShow(c) {
    const img = $id("shotImg");
    if (!img) return;
    img.src = c.toDataURL("image/png");
    const n = c.shotMasked || 0;
    $id("shotNote").textContent = n ? "名簿の名前を" + n + "か所✕にしました。他の人の名前や自由に書いた文字はそのままなので、送る前に見てください。" : "名簿の名前は写っていませんでした。自由に書いた文字などはそのままなので、送る前に見てください。";
    const rb = $id("shotReportBtn"); if (rb) rb.style.display = shotFeedbackOn() ? "" : "none";
    $id("shotOverlay").style.display = "flex";
}
function shotClose() { const o = $id("shotOverlay"); if (o) o.style.display = "none"; }
function shotFileName() {
    const d = new Date(), p = v => String(v).padStart(2, "0");
    return "sekigae_" + d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds()) + ".png";
}
function shotSave() {
    if (!shotLast) return;
    shotLast.toBlob(b => {
        if (!b) { if (typeof showToast === "function") showToast("画像を保存できませんでした", "error"); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = shotFileName();
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    }, "image/png");
}
function shotCopy() {
    if (!shotLast) return;
    shotLast.toBlob(async b => {
        try {
            if (!b || !navigator.clipboard || typeof ClipboardItem === "undefined") throw new Error("noclip");
            await navigator.clipboard.write([new ClipboardItem({ "image/png": b })]);
            if (typeof showToast === "function") showToast("画像をコピーしました", "success");
        } catch (e) {
            if (typeof showToast === "function") showToast("コピーできませんでした。「画像を保存」を使ってください。", "error");
        }
    }, "image/png");
}

SekigaeApp.registerPlugin({
    id: "screenshot",
    name: "画面を撮る",
    version: "1.0",
    description: "今の画面をアプリの中で画像にします。名簿の名前とふりがなは全て「✕」になります。保存・コピー・不具合として送るができます。",
    searchWords: "スクリーンショット スクショ 画面 撮る 画像 保存 キャプチャ 名前 ばつ",
    stubs: [],
    mount(app) {
        const st = document.createElement("style");
        st.id = "shotStyle";
        st.textContent = SHOT_CSS;
        document.head.appendChild(st);
        document.body.insertAdjacentHTML("beforeend", shotModalHtml());
        app.insertInto("settings-export", '<button type="button" id="shotOpenBtn" class="btn-secondary" style="margin-top: 10px;">画面を撮る</button>');
        app.insertInto("guide-faq", "<li><strong>画面を画像にしたい</strong>：設定の「画面を撮る」を押すと今の画面を画像にできます。名簿の名前とふりがなは✕になり、保存・コピー・不具合として送るができます。</li>");
        document.addEventListener("click", ev => {
            const t = ev.target.closest ? ev.target.closest("#shotOpenBtn, [data-shot]") : null;
            if (!t) return;
            if (t.id === "shotOpenBtn") { shotRun(); return; }
            const act = t.dataset.shot;
            if (act === "close") shotClose();
            else if (act === "save") shotSave();
            else if (act === "copy") shotCopy();
            else if (act === "again") { shotClose(); shotRun(); }
            else if (act === "report") {
                if (!shotLast || !shotFeedbackOn()) return;
                shotClose();
                openFeedback({ kind: "bug" });
                fbAttachImage(shotLast);
            }
        });
        document.addEventListener("keydown", ev => {
            if (ev.key !== "Escape") return;
            const o = $id("shotOverlay");
            if (o && o.style.display !== "none") shotClose();
        });
    }
});
window.SekigaeShot = { capture: shotCapture };
