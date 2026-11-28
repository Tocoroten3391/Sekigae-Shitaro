// ==========================================
// ロックプラグイン（必須）：暗証番号を入れるまで、席替えや設定の変更ができなくなります。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
let appLocked = false;

let lockModalMode = "unlock"; // "setup" | "settings" | "unlock" | "recover"

let lockIdleTimer = null;

function isAppLocked() { return appLocked; }

function showLockedToast() { showToast("ロック中です。解除するには右上の「ロック解除」を押してください。", "error"); }

function hasLockPin() { return !!lsGet("lock_pin_hash", ""); }

async function hashLockPin(pin) {
    let salt = lsGet("lock_salt", "");
    if (!salt) { salt = Math.random().toString(36).slice(2) + Date.now().toString(36); lsSet("lock_salt", salt); }
    const data = new TextEncoder().encode(salt + ":" + pin);
    if (window.crypto && window.crypto.subtle) {
        try {
            const buf = await window.crypto.subtle.digest("SHA-256", data);
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
        } catch (error) { /* 下の簡易計算を使う */ }
    }
    let h = 2166136261;
    data.forEach(b => { h ^= b; h = Math.imul(h, 16777619) >>> 0; });
    return "f" + h.toString(16);
}

// ---- 復旧コード：暗証番号を忘れた時に、これで解除して、新しい暗証番号を決められます ----
// 読み間違えやすい文字（0とO、1とIとL など）を使わない、10文字のコードです。端末の中には、コードそのものではなく、混ぜた値だけを置きます
const LOCK_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
let lockRecoveryPending = null; // { code, optional }

function makeRecoveryCode() {
    const a = new Uint8Array(10);
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(a);
    else for (let i = 0; i < a.length; i++) a[i] = Math.floor(Math.random() * 256);
    const raw = Array.from(a).map(n => LOCK_CODE_CHARS[n % LOCK_CODE_CHARS.length]).join("");
    return raw.slice(0, 5) + "-" + raw.slice(5);
}

// 入力のゆれ（小文字、空白、ハイフン、0とO、1とI）をそろえる
function normalizeRecoveryCode(s) {
    return String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/O/g, "0").replace(/[IL]/g, "1");
}

async function hashRecoveryCode(code) { return hashLockPin("recovery:" + normalizeRecoveryCode(code)); }

function hasRecoveryCode() { return !!lsGet("lock_recovery_hash", ""); }

async function checkRecoveryCode(code) {
    const stored = lsGet("lock_recovery_hash", "");
    if (!stored || normalizeRecoveryCode(code).length < 10) return false;
    return (await hashRecoveryCode(code)) === stored;
}

function ensureLockRecoveryUi() {
    if ($id("lockRecoveryOverlay")) return;
    // 暗証番号の画面に、「忘れた時」「コードを入れる欄」「コードの作り直し」を足す
    const cur = $id("lockCurrentRow");
    if (cur) {
        cur.insertAdjacentHTML("afterend",
            '<div id="lockForgotRow" style="display:none; margin-top:8px;"><button type="button" id="lockForgotBtn" class="lock-link-btn" onclick="lockStartRecover()">暗証番号を忘れた時</button></div>' +
            '<div id="lockRecoveryRow" style="display:none;"><label for="lockRecoveryInput" class="input-label">復旧コード：</label><input type="text" id="lockRecoveryInput" autocomplete="off" spellcheck="false" maxlength="14" placeholder="例：AB3CD-EF4GH"></div>');
    }
    const opts = $id("lockOptionRows");
    if (opts) opts.insertAdjacentHTML("beforeend", '<div id="lockRegenRow" style="display:none; margin-top:10px;"><button type="button" class="lock-link-btn" onclick="lockRegenRecovery()">復旧コードを作り直す</button><span id="lockRegenNote" style="display:block; font-size:12px; color:var(--text-sub); margin-top:2px;"></span></div>');
    if (!$id("lockRecoveryStyle")) {
        const st = document.createElement("style");
        st.id = "lockRecoveryStyle";
        st.textContent = `
/* ロック中は、ほかの画面を隠す決まりがあるので、復旧コードの画面だけは、出るようにします */
body.app-locked #lockRecoveryOverlay.modal-overlay[style*="flex"] { display: flex !important; }
#lockRecoveryInput { text-transform: uppercase; letter-spacing: 2px; font-family: ui-monospace, Consolas, monospace; }
#lockModalOverlay .lock-link-btn { width: auto !important; height: auto !important; margin: 0 !important; padding: 2px 0 !important; border: 0 !important; background: transparent !important; color: var(--accent-color) !important; font-size: 12px !important; font-weight: 600; text-decoration: underline; cursor: pointer; }
#lockRecoveryOverlay .lock-code-box { margin: 10px 0; padding: 14px 10px; text-align: center; font: 700 30px/1.2 ui-monospace, Consolas, monospace; letter-spacing: 3px; color: var(--text-main); background: var(--body-bg); border: 2px dashed var(--accent-color); border-radius: 12px; user-select: all; }
#lockRecoveryOverlay .lock-code-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 10px; }
#lockRecoveryOverlay .lock-code-row button { width: auto !important; margin: 0 !important; padding: 0 14px !important; height: 36px; }`;
        document.head.appendChild(st);
    }
    document.body.insertAdjacentHTML("beforeend",
        '<div id="lockRecoveryOverlay" class="modal-overlay" style="display: none; z-index: 4100;"><div class="modal-content" style="max-width: 420px; width: 95%;">' +
        '<h4 style="color: var(--lbl-orange);">復旧コード</h4>' +
        '<p style="font-size: 12.5px; color: var(--text-sub); margin: -8px 0 4px; line-height: 1.7;">暗証番号を忘れた時に、このコードで解除できます。紙に書くか、ファイルに保存して、生徒に見えない所に置いてください。この画面は、もう一度は出ません。</p>' +
        '<div id="lockCodeBox" class="lock-code-box"></div>' +
        '<div class="lock-code-row"><button type="button" class="btn-secondary" onclick="lockCopyRecoveryCode()">コピー</button><button type="button" class="btn-secondary" onclick="lockSaveRecoveryCode()">ファイルに保存</button></div>' +
        '<label class="chart-opt" style="margin: 4px 0;"><input type="checkbox" id="lockCodeSaved" onchange="lockRecoveryUpdateBtn()"> 控えました</label>' +
        '<div class="modal-btn-row"><button type="button" id="lockCodeLaterBtn" class="btn-secondary" onclick="lockRecoveryLater()" style="display:none;">あとで</button><button type="button" id="lockCodeDoneBtn" class="btn-save" onclick="lockRecoveryDone()" disabled>完了</button></div>' +
        '</div></div>');
}

// 復旧コードを作って、見せます。optional が true の時は、「あとで」が使えます（すでに暗証番号を使っている人への案内）
async function showRecoveryCode(optional) {
    ensureLockRecoveryUi();
    lockRecoveryPending = { code: makeRecoveryCode(), optional: !!optional };
    $id("lockCodeBox").textContent = lockRecoveryPending.code;
    $id("lockCodeSaved").checked = false;
    $id("lockCodeDoneBtn").disabled = true;
    $id("lockCodeLaterBtn").style.display = optional ? "" : "none";
    $id("lockRecoveryOverlay").style.display = "flex";
}

function lockRecoveryUpdateBtn() {
    const b = $id("lockCodeDoneBtn"), c = $id("lockCodeSaved");
    if (b && c) b.disabled = !c.checked;
}

async function lockRecoveryDone() {
    if (!lockRecoveryPending || !$id("lockCodeSaved").checked) return;
    lsSet("lock_recovery_hash", await hashRecoveryCode(lockRecoveryPending.code));
    lockRecoveryPending = null;
    $id("lockRecoveryOverlay").style.display = "none";
    showToast("復旧コードを保存しました。", "success");
}

function lockRecoveryLater() {
    lockRecoveryPending = null;
    $id("lockRecoveryOverlay").style.display = "none";
}

function lockCopyRecoveryCode() {
    if (!lockRecoveryPending) return;
    const code = lockRecoveryPending.code;
    const done = () => showToast("コピーしました。", "success");
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(code).then(done, () => showToast("コピーできませんでした。手で書き写してください。", "error"));
    else showToast("コピーできませんでした。手で書き写してください。", "error");
}

function lockSaveRecoveryCode() {
    if (!lockRecoveryPending) return;
    const text = "席替えし太郎 ロックの復旧コード\r\n\r\n" + lockRecoveryPending.code + "\r\n\r\n暗証番号を忘れた時に、ロック解除の画面で「暗証番号を忘れた時」を押して、このコードを入れてください。\r\n生徒に見えない所に置いてください。\r\n";
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = "席替えし太郎_ロック復旧コード.txt";
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// 解除の画面から「暗証番号を忘れた時」へ
function lockStartRecover() {
    if (!hasRecoveryCode()) {
        lockModalError("この端末には、復旧コードがありません。暗証番号を思い出してください。");
        return;
    }
    openLockModal("recover");
}

// 設定の画面から、復旧コードを作り直す（今の暗証番号が必要）
async function lockRegenRecovery() {
    const pin = $id("lockPinInput") ? $id("lockPinInput").value.trim() : "";
    if (!/^\d{4,8}$/.test(pin) || !(await checkLockPin(pin))) { lockModalError("作り直すには、今の暗証番号を入れてください。"); return; }
    lockModalError("");
    showRecoveryCode(false);
}

function getLockOptions() {
    return {
        allowTimer: lsGet("lock_allow_timer", "true") !== "false",
        allowNominate: lsGet("lock_allow_nominate", "true") !== "false",
        allowFullscreen: lsGet("lock_allow_fullscreen", "true") !== "false",
        autoMinutes: parseInt(lsGet("lock_auto_minutes", "0"), 10) || 0
    };
}

function applyLockState() {
    const opts = getLockOptions();
    document.body.classList.toggle("app-locked", appLocked);
    document.body.classList.toggle("lock-allow-timer", opts.allowTimer);
    document.body.classList.toggle("lock-allow-nominate", opts.allowNominate);
    document.body.classList.toggle("lock-allow-fullscreen", opts.allowFullscreen);
    closePopMenus();
    syncSeatToolsRow();
    const btn = $id("btnLock");
    if (btn) {
        btn.textContent = appLocked ? "🔓 ロック解除" : "ロック";
        btn.classList.toggle("is-locked", appLocked);
        btn.title = appLocked ? "暗証番号を入れて、ロックを解除します" : "イタズラ防止のため、操作をロックします";
    }
    resetLockIdleTimer();
}

// 画面に出ているメニューと発表モードを、ロックする時に閉じる

function closeAllPanelsForLock() {
    if (isAnnounceOpen()) closeAnnounce();
    const cfg = $id("configContainer");
    if (cfg && cfg.classList.contains("open")) {
        cfg.classList.remove("open");
        const b = $id("configMenuBtn");
        if (b) { b.textContent = "⚙️ 設定"; b.classList.remove("is-open"); }
    }
    // 開いているダイアログは、ロック中はCSSで隠れる（解除すると元に戻る）。「復元しますか」などの確認も、ロック中は操作できない。
}

function lockApp() {
    if (appLocked) return;
    closeAllPanelsForLock();
    appLocked = true;
    lsSet("app_locked", "true");
    applyLockState();
    showToast("ロックしました。解除には暗証番号が必要です。", "success");
}

function unlockApp() {
    appLocked = false;
    lsSet("app_locked", "false");
    lsSet("lock_fail_count", "0");
    lsSet("lock_until", "0");
    applyLockState();
    showToast("ロックを解除しました。", "success");
}

function onLockButton() {
    if (appLocked) { openLockModal("unlock"); return; }
    if (!hasLockPin()) { openLockModal("setup"); return; }
    lockApp();
}

function openLockModal(mode) {
    lockModalMode = mode;
    const opts = getLockOptions();
    const set = (id, v) => { const el = $id(id); if (el) el.value = v; };
    set("lockPinInput", ""); set("lockNewPinInput", ""); set("lockConfirmPinInput", "");
    const timerChk = $id("lockAllowTimer"), nomChk = $id("lockAllowNominate"), autoSel = $id("lockAutoMinutes");
    if (timerChk) timerChk.checked = opts.allowTimer;
    if (nomChk) nomChk.checked = opts.allowNominate;
    const fsChk = $id("lockAllowFullscreen");
    if (fsChk) fsChk.checked = opts.allowFullscreen;
    if (autoSel) autoSel.value = String(opts.autoMinutes);
    ensureLockRecoveryUi();
    set("lockRecoveryInput", "");
    const show = (id, on) => { const el = $id(id); if (el) el.style.display = on ? "" : "none"; };
    const title = $id("lockModalTitle"), desc = $id("lockModalDesc"), ok = $id("lockModalOkBtn");
    show("lockCurrentRow", mode === "unlock" || (mode === "settings" && hasLockPin()));
    show("lockForgotRow", mode === "unlock");
    show("lockRecoveryRow", mode === "recover");
    show("lockNewRows", mode !== "unlock");
    show("lockOptionRows", mode !== "unlock" && mode !== "recover");
    const regen = $id("lockRegenRow");
    if (regen) {
        regen.style.display = mode === "settings" && hasLockPin() ? "" : "none";
        const note = $id("lockRegenNote"); if (note) note.textContent = hasRecoveryCode() ? "今ある復旧コードは、作り直すと使えなくなります。" : "復旧コードは、まだありません。";
    }
    if (mode === "recover") {
        if (title) title.textContent = "暗証番号を忘れた時";
        if (desc) desc.textContent = "復旧コードと、新しい暗証番号を入れてください。";
        if (ok) ok.textContent = "🔓 解除して、番号を決め直す";
    } else if (mode === "unlock") {
        if (title) title.textContent = "ロックを解除";
        if (desc) desc.textContent = "暗証番号を入れてください。";
        if (ok) ok.textContent = "🔓 解除する";
    } else if (mode === "setup") {
        if (title) title.textContent = "ロックの暗証番号を決める";
        if (desc) desc.textContent = "はじめに解除用の暗証番号を決めてください。4〜8桁の数字にしてください。忘れないようにしてください。";
        if (ok) ok.textContent = "🔒 設定してロックする";
    } else {
        if (title) title.textContent = "ロックの設定";
        if (desc) desc.textContent = hasLockPin() ? "暗証番号を変えない場合は、新しい暗証番号は空のままにしてください。" : "暗証番号を決めてください。4〜8桁の数字にしてください。";
        if (ok) ok.textContent = "💾 保存する";
    }
    const err = $id("lockModalError"); if (err) err.textContent = "";
    const overlay = $id("lockModalOverlay");
    if (overlay) overlay.style.display = "flex";
    setTimeout(() => { const f = $id(mode === "setup" ? "lockNewPinInput" : mode === "recover" ? "lockRecoveryInput" : "lockPinInput"); if (f && f.offsetParent !== null) f.focus(); else { const n = $id("lockNewPinInput"); if (n) n.focus(); } }, 50);
}

function closeLockModal() {
    const overlay = $id("lockModalOverlay");
    if (overlay) overlay.style.display = "none";
}

function lockModalError(message) { const el = $id("lockModalError"); if (el) el.textContent = message; }

// 間違えた回数が多い時は、しばらく試せないようにする（総当たりでの解除を防ぐ）

function getLockWaitSeconds() {
    const until = parseInt(lsGet("lock_until", "0"), 10) || 0;
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
}

async function checkLockPin(pin) {
    const stored = lsGet("lock_pin_hash", "");
    if (!stored) return true;
    return (await hashLockPin(pin)) === stored;
}

async function submitLockModal() {
    const val = id => { const el = $id(id); return el ? el.value.trim() : ""; };
    const validPin = pin => /^\d{4,8}$/.test(pin);

    if (lockModalMode === "unlock") {
        const wait = getLockWaitSeconds();
        if (wait > 0) { lockModalError(`間違いが続いたため、あと${wait}秒お待ちください。`); return; }
        if (!validPin(val("lockPinInput"))) { lockModalError("4〜8桁の数字を入れてください。"); return; }
        if (await checkLockPin(val("lockPinInput"))) {
            closeLockModal(); unlockApp();
            // 暗証番号を使っているのに、復旧コードがまだない人には、解除できた今、一度だけ案内する
            if (!hasRecoveryCode()) showRecoveryCode(true);
            return;
        }
        const fails = (parseInt(lsGet("lock_fail_count", "0"), 10) || 0) + 1;
        lsSet("lock_fail_count", String(fails));
        if (fails >= 5) {
            lsSet("lock_until", String(Date.now() + 30000));
            lsSet("lock_fail_count", "0");
            lockModalError("5回続けて間違えました。30秒たってから、もう一度お試しください。");
        } else {
            lockModalError(`暗証番号が違います。あと${5 - fails}回でしばらく試せなくなります。`);
        }
        const f = $id("lockPinInput"); if (f) { f.value = ""; f.focus(); }
        return;
    }

    if (lockModalMode === "recover") {
        const wait = getLockWaitSeconds();
        if (wait > 0) { lockModalError(`間違いが続いたため、あと${wait}秒お待ちください。`); return; }
        const np = val("lockNewPinInput"), cp = val("lockConfirmPinInput");
        if (normalizeRecoveryCode(val("lockRecoveryInput")).length < 10) { lockModalError("復旧コードを、10文字で入れてください。"); return; }
        if (!validPin(np)) { lockModalError("新しい暗証番号は、4〜8桁の数字にしてください。"); return; }
        if (np !== cp) { lockModalError("確認用の暗証番号が一致しません。"); return; }
        if (!(await checkRecoveryCode(val("lockRecoveryInput")))) {
            const fails = (parseInt(lsGet("lock_fail_count", "0"), 10) || 0) + 1;
            lsSet("lock_fail_count", String(fails));
            if (fails >= 5) {
                lsSet("lock_until", String(Date.now() + 30000));
                lsSet("lock_fail_count", "0");
                lockModalError("5回続けて間違えました。30秒たってから、もう一度お試しください。");
            } else {
                lockModalError(`復旧コードが違います。あと${5 - fails}回でしばらく試せなくなります。`);
            }
            return;
        }
        lsSet("lock_pin_hash", await hashLockPin(np));
        lsSet("lock_recovery_hash", ""); // 使ったコードは、使えなくする
        closeLockModal();
        unlockApp();
        showToast("解除して、新しい暗証番号を決めました。新しい復旧コードを作ります。", "success");
        showRecoveryCode(false);
        return;
    }

    // setup / settings
    const newPin = val("lockNewPinInput"), confirmPin = val("lockConfirmPinInput");
    if (lockModalMode === "settings" && hasLockPin()) {
        if (!(await checkLockPin(val("lockPinInput")))) { lockModalError("今の暗証番号が違います。"); return; }
    }
    const needNew = lockModalMode === "setup" || !hasLockPin();
    if (needNew && !newPin) { lockModalError("暗証番号を入れてください。"); return; }
    if (newPin) {
        if (!validPin(newPin)) { lockModalError("暗証番号は、4〜8桁の数字にしてください。"); return; }
        if (newPin !== confirmPin) { lockModalError("確認用の暗証番号が一致しません。"); return; }
        lsSet("lock_pin_hash", await hashLockPin(newPin));
    }
    const timerChk = $id("lockAllowTimer"), nomChk = $id("lockAllowNominate"), autoSel = $id("lockAutoMinutes");
    lsSet("lock_allow_timer", String(!!(timerChk && timerChk.checked)));
    lsSet("lock_allow_nominate", String(!!(nomChk && nomChk.checked)));
    const fsChk2 = $id("lockAllowFullscreen");
    lsSet("lock_allow_fullscreen", String(!!(fsChk2 && fsChk2.checked)));
    lsSet("lock_auto_minutes", autoSel ? autoSel.value : "0");
    const wasSetup = lockModalMode === "setup";
    closeLockModal();
    applyLockState();
    if (wasSetup) lockApp();
    else showToast("ロックの設定を保存しました。", "success");
    // 暗証番号を新しく決めた時は、復旧コードも、一緒に作る
    if (newPin && !hasRecoveryCode()) showRecoveryCode(false);
}

// 自動ロック：しばらく何も操作がなかったら、ロックする

function resetLockIdleTimer() {
    if (lockIdleTimer) { clearTimeout(lockIdleTimer); lockIdleTimer = null; }
    const opts = getLockOptions();
    if (appLocked || !opts.autoMinutes || !hasLockPin()) return;
    lockIdleTimer = setTimeout(() => {
        const busy = Array.from(document.querySelectorAll(".modal-overlay")).some(o => o.style.display === "flex");
        if (busy) { resetLockIdleTimer(); return; }
        lockApp();
    }, opts.autoMinutes * 60 * 1000);
}

function initLock() {
    appLocked = lsGet("app_locked", "false") === "true" && hasLockPin();
    if (!appLocked) lsSet("app_locked", "false");
    applyLockState();
    ["pointerdown", "keydown", "touchstart"].forEach(ev => document.addEventListener(ev, () => { if (!appLocked) resetLockIdleTimer(); }, { passive: true }));
    ensureLockRecoveryUi();
    const rc = $id("lockRecoveryInput");
    if (rc) {
        rc.addEventListener("input", () => { rc.value = rc.value.toUpperCase().replace(/[^A-Z0-9-]/g, "").slice(0, 14); });
        rc.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submitLockModal(); } else if (e.key === "Escape") closeLockModal(); });
    }
    const pinFields = ["lockPinInput", "lockNewPinInput", "lockConfirmPinInput"];
    pinFields.forEach(id => {
        const el = $id(id);
        if (!el) return;
        el.addEventListener("input", () => { el.value = el.value.replace(/\D/g, "").slice(0, 8); });
        el.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); submitLockModal(); } else if (e.key === "Escape") closeLockModal(); });
    });
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "lock",
    name: "ロック",
    version: "1.1",
    required: true,
    description: "暗証番号を入れるまで席替えや設定の変更ができなくなります。暗証番号を忘れた時は、復旧コードで解除できます。"
});
