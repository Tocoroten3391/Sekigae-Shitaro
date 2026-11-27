// ==========================================
// ロックプラグイン（必須）：暗証番号を入れるまで、席替えや設定の変更ができなくなります。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
let appLocked = false;

let lockModalMode = "unlock"; // "setup" | "settings" | "unlock"

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
    const show = (id, on) => { const el = $id(id); if (el) el.style.display = on ? "" : "none"; };
    const title = $id("lockModalTitle"), desc = $id("lockModalDesc"), ok = $id("lockModalOkBtn");
    show("lockCurrentRow", mode === "unlock" || (mode === "settings" && hasLockPin()));
    show("lockNewRows", mode !== "unlock");
    show("lockOptionRows", mode !== "unlock");
    if (mode === "unlock") {
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
    setTimeout(() => { const f = $id(mode === "setup" ? "lockNewPinInput" : "lockPinInput"); if (f && f.offsetParent !== null) f.focus(); else { const n = $id("lockNewPinInput"); if (n) n.focus(); } }, 50);
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
        if (await checkLockPin(val("lockPinInput"))) { closeLockModal(); unlockApp(); return; }
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
    version: "1.0",
    required: true,
    description: "暗証番号を入れるまで席替えや設定の変更ができなくなります。"
});
