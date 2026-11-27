// ==========================================
// クラウド連携の補助プラグイン：自動同期、履歴から復元、特別保存を使えます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="cloud" で結びついていて、自動で隠れます）
// ==========================================
let autoSyncTimer = null;
function isBusyForAutoSync() {
    if (isNominating || rSpinning) return true;
    if (document.body.classList.contains("nomination-active")) return true;
    const overlayIds = ["seatModalOverlay", "secretModalOverlay", "rouletteOverlay", "wagamamaModalOverlay", "memoListModalOverlay", "cacheRestoreModalOverlay", "statsModalOverlay", "deleteModalOverlay"];
    return overlayIds.some(id => { const el = $id(id); return el && el.style.display !== "none" && el.style.display !== ""; });
}
function checkForRemoteUpdate() {
    const gInput = $id("gasUrlInput");
    const url = gInput ? gInput.value.trim() : "";
    const presetName = getSelectedPresetName() || ($id("presetNameInput") ? $id("presetNameInput").value.trim() : "");
    if (!url || !presetName) return;
    if (isBusyForAutoSync()) return;

    sendServerRequest(url, { action: "load", presetName: presetName }, "handleAutoSyncResult", function(res) {
        if (!res || !res.found) return;
        const incoming = res.fullJsonData || "";
        if (incoming === "" || incoming === lastSyncedSnapshot) return;

        // キャッシュから復元した未保存の座席表がある間は、GASの内容で上書きしない。
        if (protectRestoredSeatsFromAutoSync) return;
        // まだ一度もGASと同期していないのに座席表がある時（キャッシュ復元の直後など）は、
        // 最初の同期で座席表を書き換えない。クラウドの内容は「確認済み」として記録するだけにして、
        // これ以降に他の端末で変更された時だけ取り込む。
        if (lastSyncedSnapshot === null && currentStudents.some(s => s && s.type === "STUDENT" && s.text)) {
            lastSyncedSnapshot = incoming;
            return;
        }

        applySpreadsheetResult(res);
        showToast("他の端末の座席を取り込みました", "success");
    });
}

// ==========================================
// 履歴から復元
// ==========================================
function openHistoryModal() {
    const gInput = $id("gasUrlInput");
    const url = gInput ? gInput.value.trim() : "";
    const presetName = getSelectedPresetName() || ($id("presetNameInput") ? $id("presetNameInput").value.trim() : "");
    if (!url || !presetName) { showToast("URLとクラス名が必要です。", "error"); return; }

    const overlay = $id("historyModalOverlay");
    const body = $id("historyListBody");
    if (body) body.innerHTML = '<p style="color: var(--text-sub); font-size: 13px; padding: 8px 0;">読み込み中...</p>';
    if (overlay) overlay.style.display = "flex";

    renderSpecialSlots();

    sendServerRequest(url, { action: "history", presetName: presetName }, "handleHistoryList", function(res) {
        if (!body) return;
        if (!res || !res.found || !res.items || res.items.length === 0) {
            body.innerHTML = '<p style="color: var(--text-sub); font-size: 13px; padding: 8px 0;">まだ保存履歴がありません。</p>';
            return;
        }
        body.innerHTML = res.items.map(item => `
            <div class="history-row">
                <span>${formatRelativeTime(item.savedAt)}<br><small style="color: var(--text-sub);">${new Date(item.savedAt).toLocaleString('ja-JP')}</small></span>
                <button onclick="restoreHistoryItem('${item.historyId}')" class="btn-secondary btn-compact" style="width: auto; padding: 6px 12px; font-size: 12px;">↩️ この状態に戻す</button>
            </div>
        `).join("");
    });
}
function restoreHistoryItem(historyId) {
    const gInput = $id("gasUrlInput");
    const url = gInput ? gInput.value.trim() : "";
    const presetName = getSelectedPresetName() || ($id("presetNameInput") ? $id("presetNameInput").value.trim() : "");
    if (!url || !presetName) return;
    if (!confirmOverwriteRestoredSeats()) { showToast("復元をやめました。今の座席表はそのままです。", "success"); return; }

    updateStatus("connecting", "復元中...");
    sendServerRequest(url, { action: "loadHistoryItem", presetName: presetName, historyId: historyId }, "handleHistoryItemResult", function(res) {
        if (applySpreadsheetResult(res)) {
            updateStatus("connected", "接続完了");
            showToast(`${formatRelativeTime(res.savedAt)}の座席を復元しました。`, "success");
            closeHistoryModal();
        } else {
            gasFail("E-SHEET-02", { action: "loadHistoryItem", detail: "この履歴は見つかりませんでした" });
        }
    });
}
function closeHistoryModal() {
    const overlay = $id("historyModalOverlay");
    if (overlay) overlay.style.display = "none";
}

// ==========================================
// 特別保存（3枠）：テスト用配置などを、通常の履歴の間引きに巻き込まれず
// 明示的に上書きするまでずっと残しておける専用スロット。
// ==========================================
function renderSpecialSlots() {
    const gInput = $id("gasUrlInput");
    const url = gInput ? gInput.value.trim() : "";
    const presetName = getSelectedPresetName() || ($id("presetNameInput") ? $id("presetNameInput").value.trim() : "");
    const body = $id("specialSlotsBody");
    if (!body) return;
    if (!url || !presetName) { body.innerHTML = ""; return; }

    body.innerHTML = '<p style="color: var(--text-sub); font-size: 12px;">読み込み中...</p>';
    sendServerRequest(url, { action: "specialSlots", presetName: presetName }, "handleSpecialSlots", function(res) {
        if (!res || !res.slots) { body.innerHTML = ""; return; }
        body.innerHTML = res.slots.map(slot => `
            <div class="history-row">
                <span>
                    <strong>枠${slot.slotIndex}</strong>：${slot.occupied ? slot.label : "空き"}
                    ${slot.occupied ? `<br><small style="color: var(--text-sub);">${formatRelativeTime(slot.savedAt)}保存</small>` : ""}
                </span>
                <span style="display: flex; gap: 6px; flex-shrink: 0;">
                    ${slot.occupied ? `<button onclick="restoreSpecialSlot(${slot.slotIndex})" class="btn-secondary btn-compact" style="width: auto; padding: 6px 10px; font-size: 12px;">♻️ 復元</button>` : ""}
                    <button onclick="saveToSpecialSlot(${slot.slotIndex})" class="btn-secondary btn-compact" style="width: auto; padding: 6px 10px; font-size: 12px; background-color: #d97706;">💾 保存</button>
                </span>
            </div>
        `).join("");
    });
}
let pendingSpecialSlotIndex = null;
function saveToSpecialSlot(slotIndex) {
    const gInput = $id("gasUrlInput");
    const url = gInput ? gInput.value.trim() : "";
    const presetName = getSelectedPresetName() || ($id("presetNameInput") ? $id("presetNameInput").value.trim() : "");
    if (!url || !presetName) { showToast("URLとクラス名が必要です。", "error"); return; }
    if (currentStudents.length === 0) { showToast("座席データがありません。", "error"); return; }

    pendingSpecialSlotIndex = slotIndex;
    const titleEl = $id("slotNameModalTitle");
    if (titleEl) titleEl.textContent = `枠${slotIndex}に保存`;
    const input = $id("slotNameInput");
    if (input) input.value = `特別保存${slotIndex}`;
    const overlay = $id("slotNameModalOverlay");
    if (overlay) overlay.style.display = "flex";
    if (input) setTimeout(() => input.focus(), 50);
}
function closeSlotNameModal() {
    pendingSpecialSlotIndex = null;
    const overlay = $id("slotNameModalOverlay");
    if (overlay) overlay.style.display = "none";
}
function confirmSlotNameAndSave() {
    const slotIndex = pendingSpecialSlotIndex;
    if (!slotIndex) { closeSlotNameModal(); return; }

    const input = $id("slotNameInput");
    const label = (input ? input.value.trim() : "") || `特別保存${slotIndex}`;

    const gInput = $id("gasUrlInput");
    const url = gInput ? gInput.value.trim() : "";
    const presetName = getSelectedPresetName() || ($id("presetNameInput") ? $id("presetNameInput").value.trim() : "");
    if (!url || !presetName) { showToast("URLとクラス名が必要です。", "error"); return; }

    const cSel = $id("columnSelect");
    const rSel = $id("rowSelect");
    const eInput = $id("emptySeatsInput");

    closeSlotNameModal();
    updateStatus("connecting", "保存中...");
    sendServerRequest(url, {
        action: "saveSpecial",
        presetName: presetName,
        slotIndex: slotIndex,
        label: label,
        cols: cSel ? cSel.value : "6",
        rows: rSel ? rSel.value : "6",
        emptySeats: eInput ? eInput.value.trim() : "",
        fullJsonData: buildFullJsonDataString()
    }, "handleSaveSpecial", function(res) {
        if (res && res.success) {
            updateStatus("connected", "接続完了");
            showToast(`枠${slotIndex}に保存しました。`, "success");
            renderSpecialSlots();
        } else {
            gasFail("E-SHEET-04", { action: "saveSpecial", detail: "返事に success がありませんでした" });
        }
    });
}
function restoreSpecialSlot(slotIndex) {
    const gInput = $id("gasUrlInput");
    const url = gInput ? gInput.value.trim() : "";
    const presetName = getSelectedPresetName() || ($id("presetNameInput") ? $id("presetNameInput").value.trim() : "");
    if (!url || !presetName) return;
    if (!confirmOverwriteRestoredSeats()) { showToast("復元をやめました。今の座席表はそのままです。", "success"); return; }

    updateStatus("connecting", "復元中...");
    sendServerRequest(url, { action: "loadSpecial", presetName: presetName, slotIndex: slotIndex }, "handleLoadSpecial", function(res) {
        if (applySpreadsheetResult(res)) {
            updateStatus("connected", "接続完了");
            showToast(`「${res.label}」を復元しました。`, "success");
            closeHistoryModal();
        } else {
            showToast("この枠はまだ空です。", "error");
        }
    });
}
function startAutoSync() {
    stopAutoSync();
    checkForRemoteUpdate();
    autoSyncTimer = setInterval(checkForRemoteUpdate, 8000);
}
function stopAutoSync() {
    if (autoSyncTimer) { clearInterval(autoSyncTimer); autoSyncTimer = null; }
}
function toggleAutoSync() {
    const toggle = $id("autoSyncToggle");
    const enabled = toggle ? toggle.checked : false;
    localStorage.setItem("auto_sync_enabled", enabled ? "true" : "false");
    if (enabled) { startAutoSync(); showToast("自動同期をONにしました。", "success"); } 
    else { stopAutoSync(); showToast("自動同期をOFFにしました。", "success"); }
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "cloud",
    name: "クラウド連携の補助",
    version: "1.0",
    description: "自動同期、履歴から復元、特別保存を使えます。",
    stubs: ["confirmSlotNameAndSave", "startAutoSync"]
});
