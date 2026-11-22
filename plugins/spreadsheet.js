// ==========================================
// スプレッドシート連携プラグイン（必須）：スプレッドシートへの接続、名簿の読み込み、結果の保存です。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
function maybeAutoUploadAfterShuffle() {
    const toggle = $id("autoUploadAfterShuffleToggle");
    if (!toggle || !toggle.checked) return;
    const gInput = $id("gasUrlInput");
    if (!gInput || !gInput.value.trim()) return;
    saveResultToSpreadsheet();
}

function toggleAutoUploadAfterShuffle() {
    const toggle = $id("autoUploadAfterShuffleToggle");
    localStorage.setItem("auto_upload_after_shuffle", (toggle && toggle.checked) ? "true" : "false");
}

function saveAndConnectGas() {
    const gInput = $id("gasUrlInput");
    const url = gInput ? gInput.value.trim() : ""; 
    if (!url) { 
        showToast("GASのURLを入力してください。", "error"); 
        return; 
    } 
    localStorage.setItem("saved_gas_url", url);
    
    const pInput = $id("presetNameInput");
    const pName = getSelectedPresetName() || (pInput ? pInput.value.trim() : "default") || "default";
    
    shouldAutoLoadResult = false; 
    fetchStudentData(url, pName);
}

// GASに接続できるかを確かめるだけのボタン。名簿も座席表も一切変更せず、接続状態の表示だけ更新する。
// （読み取り専用の「特別保存の一覧」を問い合わせて、応答があれば接続できたとみなす）

let gasConnectOnlyTimer = null;

function connectGasOnly() {
    const gInput = $id("gasUrlInput");
    const url = gInput ? gInput.value.trim() : "";
    if (!url) {
        showToast("GASのURLを入力してください。", "error");
        return;
    }
    localStorage.setItem("saved_gas_url", url);

    const pInput = $id("presetNameInput");
    const pName = getSelectedPresetName() || (pInput ? pInput.value.trim() : "default") || "default";

    updateStatus("connecting", "接続中...");
    clearTimeout(gasConnectOnlyTimer);
    let finished = false;
    gasConnectOnlyTimer = setTimeout(() => {
        if (finished) return;
        finished = true;
        updateStatus("error", "接続エラー");
        showToast("GASから応答がありませんでした。URLを確認してください。", "error");
    }, 12000);

    sendServerRequest(url, { action: "specialSlots", presetName: pName }, "handleConnectOnlyResult", function(res) {
        if (finished) return;
        finished = true;
        clearTimeout(gasConnectOnlyTimer);
        if (res && res.found) {
            updateStatus("connected", "接続完了");
            showToast("GASに接続しました。座席表はそのままです。", "success");
        } else {
            updateStatus("error", "接続エラー");
            showToast("GASには届きましたが、正しい応答ではありませんでした。", "error");
        }
    });
}

function fetchStudentData(url, presetName = "default") {
    activeLoadingPresetName = presetName || "default"; 
    updateStatus("connecting", "接続中..."); 
    
    const oldScript = $id("gasScript"); 
    if (oldScript) oldScript.remove();
    
    const script = document.createElement("script"); 
    script.id = "gasScript"; 
    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=handleData&_=${Date.now()}`;
    script.onerror = function() { 
        const cachedData = localStorage.getItem(`gas_student_cache_${activeLoadingPresetName}`); 
        if (cachedData) { 
            updateStatus("connected", "キャッシュ復元"); 
            showToast(`オフラインのためクラス【${activeLoadingPresetName}】のキャッシュを復元しました。`, "success"); 
            applyStudentListToApp(JSON.parse(cachedData)); 
        } else { 
            updateStatus("error", "接続エラー"); 
            showToast(`GAS接続に失敗しました。`, "error"); 
        } 
    }; 
    document.body.appendChild(script);
}

window.handleData = function(studentList) {
    try { 
        if (studentList && studentList.length > 0) { 
            localStorage.setItem(`gas_student_cache_${activeLoadingPresetName}`, JSON.stringify(studentList)); 
            updateStatus("connected", "接続完了"); 
            showToast(`クラス【${activeLoadingPresetName}】の名簿を同期しました。`, "success"); 
            applyStudentListToApp(studentList); 
        } else { 
            updateStatus("error", "データ空欄"); 
            showToast("シートにデータが見つかりませんでした。", "error"); 
        } 
    } catch (e) { 
        updateStatus("error", "解析エラー"); 
        console.error(e); 
    }
};

function sendServerRequest(url, params, callbackName, callbackFn) {
    window[callbackName] = function(res) { 
        callbackFn(res); 
        const scriptEl = $id(callbackName + "Script"); 
        if (scriptEl) scriptEl.remove(); 
    };
    
    const script = document.createElement("script"); 
    script.id = callbackName + "Script"; 
    
    let query = []; 
    for (let key in params) { 
        query.push(key + "=" + encodeURIComponent(params[key])); 
    } 
    script.src = url + (url.includes("?") ? "&" : "?") + query.join("&") + "&callback=" + callbackName;
    script.onerror = function() { 
        // 更新情報の確認は、クラスのGASとは別です。起動時の自動確認が失敗しても、何も出しません
        if (callbackName === "handleChangelogAutoCheck") return;
        if (callbackName === "handleChangelogManual") {
            if (typeof showLocalChangelog === "function") { showLocalChangelog(); return; }
            const infoBody = $id("updateInfoBody");
            if (infoBody) infoBody.innerHTML = '<p style="color: var(--text-sub); font-size: 13px;">更新情報を取得できませんでした。通信できる場所で、もう一度ためしてください。</p>';
            return;
        }
        updateStatus("error", "通信エラー"); 
        showToast("サーバー通信に失敗しました。", "error"); 
    }; 
    document.body.appendChild(script);
}

function buildFullJsonDataString() {
    return currentStudents.map(s => { 
        if (!s) return ""; 
        if (s.type === "EMPTY_SPACE") return "ES"; 
        if (s.type === "MANUAL_EMPTY") return "ME"; 
        return (s.isFixed ? "F:" : "S:") + (s.text || "").replace(/\[休\]/g, "").replace(/[（\(].*?[）\)]/g, "").trim() + (s.isAbsent ? " [休]" : ""); 
    }).join(",");
}

function saveResultToSpreadsheet() {
    const gInput = $id("gasUrlInput");
    const url = gInput ? gInput.value.trim() : ""; 
    if (!url) { 
        showToast("GASのURLを設定してください。", "error"); 
        return; 
    } 
    if (currentStudents.length === 0) { 
        showToast("座席データがありません。", "error"); 
        return; 
    }
    
    updateStatus("connecting", "保存中...");
    
    const pInput = $id("presetNameInput");
    const pName = getSelectedPresetName() || (pInput ? pInput.value.trim() : "未設定クラス") || "未設定クラス";
    
    const cSel = $id("columnSelect");
    const rSel = $id("rowSelect");
    const eInput = $id("emptySeatsInput");
    const cTog = $id("groupColorToggle");
    const tSel = $id("groupTypeSelect");
    
    const fullJsonDataStr = buildFullJsonDataString();
    const workSnapAtSave = JSON.stringify(captureWorkSnapshot());
    
    sendServerRequest(url, { 
        action: "save", 
        presetName: pName, 
        cols: cSel ? cSel.value : "6", 
        rows: rSel ? rSel.value : "6", 
        emptySeats: eInput ? eInput.value.trim() : "", 
        data: currentStudents.map(s => { 
            if (!s) return ""; 
            if (s.type === "EMPTY_SPACE") return "EMPTY_SPACE"; 
            if (s.type === "MANUAL_EMPTY") return "MANUAL_EMPTY"; 
            return (s.text || "").replace(/\[休\]/g, "").replace(/[（\(].*?[）\)]/g, "").trim(); 
        }).join(","), 
        fullJsonData: fullJsonDataStr, 
        studentsText: "", 
        groupColorToggle: cTog ? cTog.checked : false, 
        groupType: tSel ? tSel.value : "column", 
        manualGroupMap: JSON.stringify(manualGroupMap) 
    }, "handleSaveResult", function(res) { 
        if (res && res.success) { 
            updateStatus("connected", "接続完了"); 
            showToast(`クラウドに結果を保存しました。`, "success"); 
            lastSyncedSnapshot = fullJsonDataStr;
            protectRestoredSeatsFromAutoSync = false;
            markWorkSyncedToCloud(workSnapAtSave);
        } 
    });
}

function applySpreadsheetResult(res) {
    if (!res || !res.found) return false;
    const cSel = $id("columnSelect");
    if (cSel) cSel.value = res.cols;

    const rSel = $id("rowSelect");
    if (rSel) {
        if (!Array.from(rSel.options).some(opt => opt.value == res.rows)) {
            const newOpt = document.createElement("option");
            newOpt.value = res.rows;
            newOpt.textContent = res.rows + "行";
            rSel.appendChild(newOpt);
        }
        rSel.value = res.rows;
    }

    const eInput = $id("emptySeatsInput");
    if (eInput) eInput.value = res.emptySeats || "";

    updateColumns();
    if (res.fullJsonData && res.fullJsonData !== "") {
        currentStudents = splitRosterRaw(res.fullJsonData).map(item => {
            if (item === "ES") return { type: "EMPTY_SPACE" };
            if (item === "ME") return { type: "MANUAL_EMPTY" };

            let isFixed = item.startsWith("F:");
            let rawName = item.slice(2);
            let cleanRawName = rawName.replace(/\[休\]/g, "").trim();
            let matchedFullData = lastRawList.find(fullName => fullName.replace(/\[休\]/g, "").replace(/[（\(].*?[）\)]/g, "").trim() === cleanRawName);
            let finalText = matchedFullData || cleanRawName;

            return { type: "STUDENT", text: finalText + (rawName.includes("[休]") ? " [休]" : ""), isFixed: isFixed, isAbsent: rawName.includes("[休]") };
        });
        renderClassroom("initial");
    }
    lastSyncedSnapshot = res.fullJsonData || "";
    protectRestoredSeatsFromAutoSync = false; // 自分で読み込んだ（または取り込みを許可した）ので、保護は解除
    return true;
}

// キャッシュから復元した「まだGASに保存していない座席表」がある時に、手動の読み込みで上書きしてよいか確認する。
// 「キャンセル」なら読み込まず、座席表はそのまま残す。

function confirmOverwriteRestoredSeats() {
    if (!protectRestoredSeatsFromAutoSync) return true;
    return confirm("キャッシュから復元した座席表は、まだクラウドのGASに保存されていません。\nクラウドの内容で上書きしてもよいですか？\n\n「キャンセル」を押すと、今の座席表をそのまま残します。");
}

function loadResultFromSpreadsheet() {
    const gInput = $id("gasUrlInput");
    const pInput = $id("presetNameInput");
    const url = gInput ? gInput.value.trim() : "";
    const presetName = getSelectedPresetName() || (pInput ? pInput.value.trim() : "default");
    
    if (!url || !presetName) { 
        showToast("URLとクラス名が必要です。", "error"); 
        return; 
    } 
    if (!confirmOverwriteRestoredSeats()) { showToast("読み込みをやめました。今の座席表はそのままです。", "success"); return; }
    updateStatus("connecting", "読込中...");
    
    sendServerRequest(url, { action: "load", presetName: presetName }, "handleLoadResult", function(res) {
        if (applySpreadsheetResult(res)) {
            updateStatus("connected", "接続完了"); 
            showToast(res.savedAt ? `クラウドから座席を呼び戻しました。${formatRelativeTime(res.savedAt)}に保存したものです。` : `クラウドから座席を呼び戻しました。`, "success");
        }
    });
}

// ==========================================
// 自動同期（購読モード）：複数端末での共同作業用
// ==========================================

let lastSyncedSnapshot = null;
// キャッシュから復元した「まだGASに保存していない座席表」を、自動同期で上書きしないためのフラグ。
// GASへ保存した時、または「前回を復元」など自分で読み込んだ時に解除する。

let protectRestoredSeatsFromAutoSync = false;

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "spreadsheet",
    name: "スプレッドシート連携",
    version: "1.0",
    required: true,
    description: "スプレッドシートへの接続、名簿の読み込み、結果の保存です。"
});
