// ==========================================
// 画面のテンキープラグイン：数字を入れる欄を押すと、画面の下にテンキーが出ます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="softkeypad" で結びついていて、自動で隠れます）
// ==========================================
const SOFTKEYPAD_KEY = "softkeypad_on";
function isSoftKeypadOn() { return lsGet(SOFTKEYPAD_KEY, "1") !== "0"; }
let skpInput = null, skpFresh = false, skpBuf = "", skpSetupDone = false;
function skpIsTarget(el) {
    if (!el || el.tagName !== "INPUT" || el.readOnly || el.disabled) return false;
    return el.type === "number" || el.type === "time" || el.dataset.skp === "1" || el.getAttribute("inputmode") === "numeric";
}
// 画面のテンキーを使う欄には、OSのキーボードが出ないようにする（元の指定は、あとで戻せるように覚えておく）
function skpMark(el) {
    if (!skpIsTarget(el) || el.dataset.skp === "1" && el.getAttribute("inputmode") === "none") return;
    if (el.dataset.skp !== "1") { el.dataset.skp = "1"; el.dataset.skpIm = el.getAttribute("inputmode") || ""; }
    el.setAttribute("inputmode", "none");
}
function skpUnmarkAll() {
    document.querySelectorAll('input[data-skp="1"]').forEach(el => {
        if (el.dataset.skpIm) el.setAttribute("inputmode", el.dataset.skpIm); else el.removeAttribute("inputmode");
    });
}
function skpPad() { return $id("softKeypad"); }

// 数字のキーの並びを入れ替える（設定で、しない・暗証番号のときだけ・いつも）
function getSoftKeypadShuffle() { const v = lsGet("softkeypad_shuffle", "off"); return v === "pin" || v === "all" ? v : "off"; }
function skpArrangeDigits(inp) {
    const d = skpPad();
    if (!d) return;
    const mode = getSoftKeypadShuffle();
    const doShuffle = mode === "all" || (mode === "pin" && inp && inp.type === "password");
    const btns = Array.from(d.querySelectorAll(".skp-grid button")).filter(b => /^\d$/.test(b.dataset.skpKey));
    const digits = ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0"]; // ふだんの並び（画面の上から下、左から右）
    if (doShuffle) {
        for (let i = digits.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [digits[i], digits[j]] = [digits[j], digits[i]]; }
    }
    // btns は、ふだんの並びの位置にあるボタン。キーと表示を割り当て直す
    btns.sort((a, b) => ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0"].indexOf(a.dataset.skpSlot) - ["7", "8", "9", "4", "5", "6", "1", "2", "3", "0"].indexOf(b.dataset.skpSlot));
    btns.forEach((b, i) => { b.dataset.skpKey = digits[i]; b.textContent = digits[i]; });
    const sb = d.querySelector(".skp-shuf");
    if (sb) sb.hidden = !doShuffle;
}
function onSoftKeypadShuffleChange() {
    const s = $id("softKeypadShuffleSelect");
    if (!s) return;
    lsSet("softkeypad_shuffle", s.value);
    const d = skpPad();
    if (d && skpInput) skpArrangeDigits(skpInput);
    showToast(s.value === "off" ? "テンキーの数字は、ふだんの並びにしました。" : (s.value === "pin" ? "暗証番号の時だけ、数字をバラバラにします。" : "テンキーの数字を、いつもバラバラにします。"), "success");
}
function skpBuild() {
    let d = skpPad();
    if (d) return d;
    d = document.createElement("div");
    d.id = "softKeypad";
    d.hidden = true;
    d.dataset.side = lsGet("softkeypad_side", "right") === "left" ? "left" : "right";
    d.setAttribute("role", "group");
    d.setAttribute("aria-label", "数字のキー");
    const key = (k, label, cls, aria) => `<button type="button" data-skp-key="${k}"${/^\d$/.test(k) ? ` data-skp-slot="${k}"` : ""} class="${cls || ""}"${aria ? ` aria-label="${aria}"` : ""}>${label}</button>`;
    d.innerHTML = `<div class="skp-head"><span class="skp-title" id="skpTitle"></span><span class="skp-value" id="skpValue" aria-live="polite"></span>` +
        key("shuf", "🔀", "skp-side skp-shuf", "数字の並びを入れ替える") + key("side", "⇄", "skp-side", "左右に動かす") + `</div><div class="skp-grid">` +
        ["7", "8", "9"].map(n => key(n, n)).join("") + key("bs", "⌫", "skp-fn", "一つ消す") +
        ["4", "5", "6"].map(n => key(n, n)).join("") + key("clear", "クリア", "skp-fn", "全部消す") +
        ["1", "2", "3"].map(n => key(n, n)).join("") + key("ok", "決定", "skp-ok", "決定") +
        key("0", "0", "skp-zero") + key("close", "✕ 閉じる", "skp-fn", "閉じる") + `</div>`;
    d.addEventListener("mousedown", ev => ev.preventDefault()); // 入力欄から、フォーカスを外さない
    d.addEventListener("click", ev => {
        const b = ev.target.closest("button[data-skp-key]");
        if (b) skpPress(b.dataset.skpKey);
    });
    document.body.appendChild(d);
    return d;
}
function skpTitleOf(inp) {
    let t = inp.getAttribute("aria-label") || "";
    if (!t && inp.labels && inp.labels[0]) t = inp.labels[0].textContent;
    if (!t) { const p = inp.previousElementSibling; if (p && p.tagName === "LABEL") t = p.textContent; }
    if (!t) t = inp.placeholder || "";
    return t.replace(/[\s:：]+$/, "").trim().slice(0, 14);
}
function skpRefresh() {
    const inp = skpInput;
    const v = $id("skpValue"), t = $id("skpTitle");
    if (!inp || !v) return;
    if (t) t.textContent = skpTitleOf(inp);
    const val = inp.value || "";
    v.textContent = inp.type === "password" ? "●".repeat(val.length) : (val || "　");
}
function skpShow(inp) {
    if (!isSoftKeypadOn()) return;
    const d = skpBuild();
    skpInput = inp;
    skpFresh = inp.type !== "time";
    skpBuf = "";
    skpArrangeDigits(inp);
    d.hidden = false;
    skpRefresh();
    requestAnimationFrame(() => skpAvoid(inp));
}
// テンキーが入力欄にかぶる時は、反対側に寄せるか、欄が見える位置までスクロールする
function skpAvoid(inp) {
    const d = skpPad();
    if (!d || d.hidden || !inp.isConnected) return;
    const overlap = (r, k) => r.bottom > k.top && r.top < k.bottom && r.right > k.left && r.left < k.right;
    const r = inp.getBoundingClientRect(), k = d.getBoundingClientRect();
    if (!overlap(r, k)) return;
    const other = d.dataset.side === "left" ? "right" : "left";
    const vw = document.documentElement.clientWidth, w = k.width;
    const alt = other === "left" ? { left: 12, right: 12 + w, top: k.top, bottom: k.bottom } : { left: vw - 12 - w, right: vw - 12, top: k.top, bottom: k.bottom };
    if (!overlap(r, alt)) { d.dataset.side = other; return; }
    try { inp.scrollIntoView({ block: "center", inline: "nearest" }); } catch (e) { /* 何もしない */ }
    requestAnimationFrame(() => {
        const r2 = inp.getBoundingClientRect(), k2 = d.getBoundingClientRect();
        if (overlap(r2, k2) && !overlap(r2, alt)) d.dataset.side = other;
    });
}
function skpHide() {
    const d = skpPad();
    if (d) d.hidden = true;
    skpInput = null;
}
function skpEmit(inp, type) { inp.dispatchEvent(new Event(type, { bubbles: true })); }
function skpSet(inp, v) { inp.value = v; skpEmit(inp, "input"); skpRefresh(); }
function skpPress(k) {
    const inp = skpInput;
    if (!inp || !inp.isConnected) { skpHide(); return; }
    if (k === "close") { skpEmit(inp, "change"); skpHide(); try { inp.blur(); } catch (e) { /* 何もしない */ } return; }
    if (k === "shuf") { skpArrangeDigits(inp); return; }
    if (k === "side") {
        const d = skpPad();
        d.dataset.side = d.dataset.side === "left" ? "right" : "left";
        lsSet("softkeypad_side", d.dataset.side);
        return;
    }
    if (k === "ok") {
        skpEmit(inp, "change");
        inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true, cancelable: true }));
        if (skpInput === inp) { skpHide(); try { inp.blur(); } catch (e) { /* 何もしない */ } }
        return;
    }
    if (inp.type === "time") { skpPressTime(inp, k); return; }
    if (k === "clear") { skpFresh = false; skpSet(inp, ""); return; }
    if (k === "bs") { skpFresh = false; skpSet(inp, (inp.value || "").slice(0, -1)); return; }
    if (!/^\d$/.test(k)) return;
    let v = inp.value || "";
    if (skpFresh) { v = ""; skpFresh = false; } // 開いてすぐの1回目は、今の数字を置き換える
    const maxLen = parseInt(inp.getAttribute("maxlength") || "0", 10) || 6;
    if (v.length >= maxLen) { skpRefresh(); return; }
    const next = v + k;
    const max = inp.getAttribute("max");
    if (max !== null && max !== "" && inp.type === "number" && Number(next) > Number(max)) { skpRefresh(); return; } // 最大を超える数は入れない
    skpSet(inp, next);
}
// 時刻の欄：数字を4つまで並べて、「10:45」の形にする
function skpPressTime(inp, k) {
    if (k === "clear") { skpBuf = ""; skpSet(inp, ""); return; }
    if (k === "bs") { skpBuf = skpBuf.slice(0, -1); } else if (/^\d$/.test(k)) { if (skpBuf.length >= 4) return; skpBuf += k; } else return;
    if (skpBuf === "") { skpSet(inp, ""); return; }
    const b = skpBuf;
    const hh = b.length <= 2 ? b : b.slice(0, b.length - 2);
    const mm = b.length <= 2 ? "00" : b.slice(-2);
    const h = parseInt(hh, 10), m = parseInt(mm, 10);
    if (h > 23 || m > 59) { skpBuf = skpBuf.slice(0, -1); return; } // ありえない時刻は入れない
    skpSet(inp, `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
}
function onSoftKeypadToggle() {
    const t = $id("softKeypadToggle");
    if (!t) return;
    lsSet(SOFTKEYPAD_KEY, t.checked ? "1" : "0");
    if (t.checked) { document.querySelectorAll('input[type="number"], input[type="time"], input[inputmode="numeric"]').forEach(skpMark); showToast("数字を入れる欄を押すと、画面のテンキーが出ます。", "success"); }
    else { skpHide(); skpUnmarkAll(); showToast("画面のテンキーは出さないようにしました。", "success"); }
}
function setupSoftKeypad() {
    if (skpSetupDone) return;
    skpSetupDone = true;
    const t = $id("softKeypadToggle");
    if (t) t.checked = isSoftKeypadOn();
    const sh = $id("softKeypadShuffleSelect");
    if (sh) sh.value = getSoftKeypadShuffle();
    if (isSoftKeypadOn()) document.querySelectorAll('input[type="number"], input[type="time"], input[inputmode="numeric"]').forEach(skpMark);
    // あとから作られる欄は、押した時に印を付ける（OSのキーボードが出る前に間に合わせる）
    document.addEventListener("pointerdown", ev => { if (isSoftKeypadOn() && skpIsTarget(ev.target)) skpMark(ev.target); }, true);
    document.addEventListener("focusin", ev => {
        if (!isSoftKeypadOn()) return;
        if (skpIsTarget(ev.target)) { skpMark(ev.target); if (skpInput !== ev.target) skpShow(ev.target); }
    });
    document.addEventListener("focusout", () => {
        setTimeout(() => { if (skpInput && !skpIsTarget(document.activeElement)) skpHide(); }, 0);
    });
    document.addEventListener("keydown", ev => { if (ev.key === "Escape" && skpInput) skpHide(); });
    // 入力欄が閉じたり消えたりした時は、テンキーも閉じる
    setInterval(() => { if (skpInput && (!skpInput.isConnected || skpInput.offsetParent === null)) skpHide(); }, 800);
    // 外のキーボードで入力した時も、テンキーの表示を合わせる
    document.addEventListener("input", ev => { if (ev.target === skpInput) skpRefresh(); });
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "softkeypad",
    name: "画面のテンキー",
    version: "1.0",
    description: "数字を入れる欄を押すと、画面の下にテンキーが出ます。",
    stubs: ["setupSoftKeypad"]
});
