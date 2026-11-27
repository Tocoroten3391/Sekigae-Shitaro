// ==========================================
// スプレッドシート連携プラグイン（必須）：スプレッドシートへの接続、名簿の読み込み、結果の保存です。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
// ==========================================
// 同期の失敗の原因を、日本語とエラーコードで出す部分
// 種類：通信（E-NET）／権限（E-AUTH）／シート（E-SHEET）／URL（E-URL）／GAS（E-GAS）／データ（E-DATA）
// 失敗すると、通知とボタンの近くの「最後に起きたエラー」に、原因と、直し方を出します（コードは、問い合わせのときに伝えられます）
// ==========================================
const GAS_ERR_KEY = "gas_last_error_v1";
const GAS_TIMEOUT_MS = 15000;
const GAS_ERRORS = {
    "E-URL-01": { kind: "URL", title: "GASのURLの形が正しくありません", cause: "URLが空か途中で切れています。", fix: "GASの「デプロイ」→「ウェブアプリ」にある https://script.google.com/…/exec のURLを全部コピーして貼り付けてください。" },
    "E-URL-02": { kind: "URL", title: "テスト用の /dev のURLが入っています", cause: "「テストデプロイ」のURLは自分以外の端末では使えません。", fix: "「新しいデプロイ」で作った末尾が /exec のURLを使ってください。" },
    "E-NET-01": { kind: "通信", title: "GASに通信できませんでした", cause: "インターネットにつながっていないか、学校のネットワークが script.google.com を止めているか、URLが違うかのどれかです。", fix: "他のWebページが開けるか確認してください。開けるならURLを見直して、学校のネットワークの担当の先生に「script.google.com を許可できるか」を聞いてください。" },
    "E-NET-02": { kind: "通信", title: "この端末は今オフラインです", cause: "端末がインターネットにつながっていません。", fix: "Wi-Fiを確認してください。オフラインでも座席表と前回の名簿のキャッシュは使えます。" },
    "E-NET-03": { kind: "通信", title: "GASから時間内に返事がありませんでした", cause: "通信が遅いかGASの処理に時間がかかっています。", fix: "少し待ってもう一度試してください。続く時はスプレッドシートの行数が多すぎないか確認してください。" },
    "E-AUTH-01": { kind: "権限", title: "GASがデータではなく別のページを返しました", cause: "GASのサーバーには届きましたが、データではなくWebページが返りました。多くはウェブアプリの公開範囲が合っていないためで、ログイン画面や権限の確認画面が返っています。URLの間違いやGAS側の実行エラーでも起きます。", fix: "まずURLが今のデプロイのものか確認してください。次にGASの「デプロイを管理」で「実行するユーザー：自分」「アクセスできるユーザー：全員」になっているか確認してください。学校のアカウントだけで使う場合は、その組織を選びます。変えたら「新しいバージョン」でデプロイし直します。このブラウザでGoogleにログインしているかも確認してください。" },
    "E-AUTH-02": { kind: "権限", title: "GASが権限が足りないと返しました", cause: "GASがスプレッドシートを開く許可をまだ承認していません。", fix: "GASのエディタで一度「実行」して権限を承認し、その後デプロイし直してください。" },
    "E-SHEET-01": { kind: "シート", title: "名簿をシートから取れませんでした", cause: "名簿のシートが空か、見ている列に名前がありません。", fix: "スプレッドシートの名簿のシートに、名前が入っているか確認してください。" },
    "E-SHEET-02": { kind: "シート", title: "このクラスの保存データがシートにありません", cause: "このクラス名ではまだクラウドに保存していないか、クラス名を変えました。", fix: "先に「シートに保存」を押してください。クラス名を変えた場合は、もとの名前で保存した履歴を確認してください。" },
    "E-SHEET-03": { kind: "シート", title: "GASがシートの処理でエラーを返しました", cause: "タブ名や列がGASのプログラムの想定と違います。", fix: "下の「詳しい内容」を見て、スプレッドシートのタブ名や列がGASのプログラムと合っているか確認してください。" },
    "E-SHEET-04": { kind: "シート", title: "シートに保存できませんでした", cause: "GASが保存できたと返しませんでした。シートが閲覧専用かGASの実行エラーです。", fix: "スプレッドシートが編集できる状態か確認してください。" },
    "E-GAS-01": { kind: "GAS", title: "GASがエラーを返しました", cause: "GASのプログラムの中でエラーが起きました。", fix: "下の「詳しい内容」をGASを作った人に伝えてください。GASの「実行数」からログも見られます。" },
    "E-DATA-01": { kind: "データ", title: "GASからの返事を読み取れませんでした", cause: "返ってきたデータの形がアプリの想定と違います。GASのプログラムが古い可能性があります。", fix: "GASのプログラムが最新か確認してください。" }
};
const GAS_ACTION_NAMES = { save: "シートに保存", load: "前回を復元", history: "履歴の一覧", loadHistoryItem: "履歴から復元", specialSlots: "特別保存／接続の確認", saveSpecial: "特別保存", loadSpecial: "特別保存から復元", names: "名簿の読み込み" };
let gasLastToastAt = 0;
const gasPending = {};

function gasUrlProblem(url) {
    const u = String(url || "").trim();
    if (!/^https?:\/\/[^\s/]{2,}/i.test(u)) return "E-URL-01";
    if (/script\.google\.com/i.test(u) && /\/dev\/?(\?|$)/.test(u)) return "E-URL-02";
    return "";
}
function gasReadLast() { try { return JSON.parse(localStorage.getItem(GAS_ERR_KEY) || "null"); } catch (e) { return null; } }

function gasFail(code, opts) {
    opts = opts || {};
    const info = GAS_ERRORS[code] || GAS_ERRORS["E-GAS-01"];
    const rec = { t: Date.now(), code, action: opts.action || "", detail: String(opts.detail || "").slice(0, 300) };
    try { localStorage.setItem(GAS_ERR_KEY, JSON.stringify(rec)); } catch (e) { /* 保存できなくても、通知は出す */ }
    updateStatus("error", info.kind + "エラー " + code);
    // 自動同期は、数秒おきに確認します。通知は、10分に1回だけにします
    const quiet = opts.quiet && Date.now() - gasLastToastAt < 600000;
    if (!quiet && !opts.noToast) {
        gasLastToastAt = Date.now();
        showToast(info.title + "。エラーコード " + code + (opts.note ? " " + opts.note : ""), "error");
    }
    gasErrRender();
}
function gasErrClearFor(action) {
    const r = gasReadLast();
    if (r && (!action || r.action === action)) { try { localStorage.removeItem(GAS_ERR_KEY); } catch (e) { } gasErrRender(); }
}
function gasErrEsc(t) { return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function gasErrText(r) {
    const info = GAS_ERRORS[r.code] || GAS_ERRORS["E-GAS-01"];
    return ["【席替えし太郎 同期エラー】", "エラーコード：" + r.code, "種類：" + info.kind, "内容：" + info.title,
        "操作：" + (GAS_ACTION_NAMES[r.action] || r.action || "-"), "日時：" + new Date(r.t).toLocaleString("ja-JP"),
        "詳しい内容：" + (r.detail || "-"), "バージョン：" + (typeof APP_VERSION !== "undefined" ? APP_VERSION : "")].join("\n");
}
function gasErrRender() {
    const box = $id("gasErrBox");
    if (!box) return;
    const r = gasReadLast();
    if (!r) { box.style.display = "none"; box.innerHTML = ""; return; }
    const info = GAS_ERRORS[r.code] || GAS_ERRORS["E-GAS-01"];
    box.style.display = "";
    box.innerHTML =
        '<div class="gas-err-head"><span class="gas-err-kind gas-err-kind-' + gasErrEsc(r.code.split("-")[1]) + '">' + gasErrEsc(info.kind) + '</span>' +
        '<span class="gas-err-title">' + gasErrEsc(info.title) + '</span><span class="gas-err-code">' + gasErrEsc(r.code) + '</span></div>' +
        '<div class="gas-err-body"><p><b>原因</b>　' + gasErrEsc(info.cause) + '</p><p><b>対処</b>　' + gasErrEsc(info.fix) + '</p>' +
        (r.detail ? '<p><b>詳しい内容</b>　' + gasErrEsc(r.detail) + '</p>' : "") +
        '<p class="gas-err-meta">' + gasErrEsc(new Date(r.t).toLocaleString("ja-JP")) + (r.action ? "　操作：" + gasErrEsc(GAS_ACTION_NAMES[r.action] || r.action) : "") + '</p></div>' +
        '<div class="gas-err-btns"><button type="button" class="btn-secondary btn-compact" data-gaserr="copy">内容をコピー</button><button type="button" class="btn-secondary btn-compact" data-gaserr="clear">消す</button>' + (typeof openFeedback === "function" ? '<button type="button" class="btn-secondary btn-compact" data-gaserr="report">このエラーを報告</button>' : "") + '</div>';
}
document.addEventListener("click", ev => {
    const b = ev.target.closest ? ev.target.closest("[data-gaserr]") : null;
    if (!b) return;
    if (b.dataset.gaserr === "clear") gasErrClearFor("");
    else if (b.dataset.gaserr === "report") {
        const r = gasReadLast();
        if (r && typeof openFeedback === "function") openFeedback({ kind: "bug", text: "同期（スプレッドシート）で、エラーが出ました。\nエラーコード：" + r.code + (r.action ? "\n操作：" + (GAS_ACTION_NAMES[r.action] || r.action) : "") + "\n\n起きた時の様子：" });
    }
    else if (b.dataset.gaserr === "copy") {
        const r = gasReadLast();
        if (!r) return;
        const txt = gasErrText(r);
        const done = () => showToast("エラーの内容をコピーしました。", "success");
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done, () => showToast(txt, "error"));
        else showToast(txt, "error");
    }
});
window.addEventListener("DOMContentLoaded", gasErrRender);
setTimeout(gasErrRender, 800);

// 返事が来るまでの見張り（時間切れ・Webページが返った場合）
function gasWatchStart(key, info) {
    gasWatchDone(key);
    gasPending[key] = { info: info || {}, timer: setTimeout(() => gasWatchFail(key, navigator.onLine === false ? "E-NET-02" : "E-NET-03", ""), GAS_TIMEOUT_MS), suspect: null };
}
function gasWatchDone(key) {
    const p = gasPending[key];
    if (!p) return;
    clearTimeout(p.timer); clearTimeout(p.suspect);
    delete gasPending[key];
}
function gasWatchFail(key, code, detail) {
    const p = gasPending[key];
    if (!p) return;
    gasWatchDone(key);
    const script = $id(key + "Script") || (key === "handleData" ? $id("gasScript") : null);
    if (script) script.remove();
    if (typeof p.info.onFail === "function" && p.info.onFail(code, detail)) return;
    gasFail(code, { action: p.info.action, detail, quiet: p.info.quiet });
}
// 読み込みに失敗したとき、「通信できない」のか「届いたが、データではなかった（権限など）」のかを、見分けます
// （パラメーターを付けずに、同じURLへ、もう一度だけ、中身を読まない形で問い合わせます。届けば、通信はできています）
function gasProbe(src, cb) {
    let done = false;
    const fin = v => { if (!done) { done = true; cb(v); } };
    setTimeout(() => fin(false), 6000);
    try {
        const base = String(src).split("?")[0];
        fetch(base, { mode: "no-cors", cache: "no-store" }).then(() => fin(true), () => fin(false));
    } catch (e) { fin(false); }
}
function gasLoadFailed(key, src) {
    if (navigator.onLine === false) { gasWatchFail(key, "E-NET-02", ""); return; }
    gasProbe(src, reached => {
        if (reached) gasWatchFail(key, "E-AUTH-01", "GASには届きましたが、データではなくWebページが返りました");
        else gasWatchFail(key, "E-NET-01", "");
    });
}
// GASが、データではなくWebページ（ログインなど）を返すと、そのページを読み込んだ時に「Script error.」が起きます
window.addEventListener("error", ev => {
    if (!ev || !/^Script error/i.test(ev.message || "") || ev.filename) return;
    Object.keys(gasPending).forEach(key => {
        const p = gasPending[key];
        if (!p || p.suspect) return;
        // 本当の返事が、すぐあとに届く場合もあるので、少しだけ待ってから決めます
        p.suspect = setTimeout(() => gasWatchFail(key, "E-AUTH-01", "返事がデータではなくWebページでした"), 1200);
    });
});
// 返事の中身がエラーのとき、原因の種類を決める
function gasResponseProblem(res, action) {
    if (!res || typeof res !== "object" || Array.isArray(res)) return null;
    if (!res.error && res.success !== false) return null;
    const msg = typeof res.error === "string" ? res.error : (res.error ? JSON.stringify(res.error) : String(res.message || ""));
    let code = (!msg && action && /^save/.test(action)) ? "E-SHEET-04" : "E-GAS-01";
    if (/権限|認証|承認|authoriz|permission|access denied|アクセス権/i.test(msg)) code = "E-AUTH-02";
    else if (/シート|sheet|spreadsheet|range|範囲|タブ/i.test(msg)) code = "E-SHEET-03";
    return { code, detail: msg };
}

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
    const bad = gasUrlProblem(url);
    if (bad) { gasFail(bad, { detail: url.slice(0, 80) }); return; }
    localStorage.setItem("saved_gas_url", url);
    
    const pInput = $id("presetNameInput");
    const pName = getSelectedPresetName() || (pInput ? pInput.value.trim() : "default") || "default";
    
    shouldAutoLoadResult = false; 
    fetchStudentData(url, pName);
}

// GASに接続できるかを確かめるだけのボタン。名簿も座席表も一切変更せず、接続状態の表示だけ更新する。
// （読み取り専用の「特別保存の一覧」を問い合わせて、応答があれば接続できたとみなす）


function connectGasOnly() {
    const gInput = $id("gasUrlInput");
    const url = gInput ? gInput.value.trim() : "";
    if (!url) {
        showToast("GASのURLを入力してください。", "error");
        return;
    }
    const bad = gasUrlProblem(url);
    if (bad) { gasFail(bad, { detail: url.slice(0, 80) }); return; }
    localStorage.setItem("saved_gas_url", url);

    const pInput = $id("presetNameInput");
    const pName = getSelectedPresetName() || (pInput ? pInput.value.trim() : "default") || "default";

    updateStatus("connecting", "接続中...");
    sendServerRequest(url, { action: "specialSlots", presetName: pName }, "handleConnectOnlyResult", function(res) {
        if (res && res.found) {
            updateStatus("connected", "接続完了");
            gasErrClearFor("");
            showToast("GASに接続しました。座席表はそのままです。", "success");
        } else {
            gasFail("E-GAS-01", { action: "specialSlots", detail: "GASには届きましたが、返事の形が違いました" });
        }
    });
}

function fetchStudentData(url, presetName = "default") {
    activeLoadingPresetName = presetName || "default"; 
    updateStatus("connecting", "接続中..."); 
    
    const oldScript = $id("gasScript"); 
    if (oldScript) oldScript.remove();
    
    // 通信できないときは、前に読み込んだ名簿（キャッシュ）があれば、それを使います
    const useCache = code => {
        const cachedData = localStorage.getItem(`gas_student_cache_${activeLoadingPresetName}`); 
        if (!cachedData) return false;
        gasFail(code, { action: "names", noToast: true });
        updateStatus("connected", "キャッシュ復元"); 
        showToast(`通信できないためクラス【${activeLoadingPresetName}】の前の名簿を使いました。エラーコード ${code}`, "success"); 
        applyStudentListToApp(JSON.parse(cachedData)); 
        return true;
    };
    gasWatchStart("handleData", { action: "names", onFail: (code) => ((code.startsWith("E-NET") || code === "E-AUTH-01") ? useCache(code) : false) });
    
    const script = document.createElement("script"); 
    script.id = "gasScript"; 
    script.src = `${url}${url.includes("?") ? "&" : "?"}callback=handleData&_=${Date.now()}`;
    script.onerror = function() { 
        gasLoadFailed("handleData", script.src);
    }; 
    document.body.appendChild(script);
}

window.handleData = function(studentList) {
    gasWatchDone("handleData");
    try { 
        const bad = gasResponseProblem(studentList, "names");
        if (bad) { gasFail(bad.code, { action: "names", detail: bad.detail }); return; }
        if (Array.isArray(studentList) && studentList.length > 0) { 
            localStorage.setItem(`gas_student_cache_${activeLoadingPresetName}`, JSON.stringify(studentList)); 
            updateStatus("connected", "接続完了"); 
            gasErrClearFor("names");
            showToast(`クラス【${activeLoadingPresetName}】の名簿を同期しました。`, "success"); 
            applyStudentListToApp(studentList); 
        } else if (Array.isArray(studentList) || !studentList) { 
            gasFail("E-SHEET-01", { action: "names", detail: "名簿が、0人でした" });
        } else {
            gasFail("E-DATA-01", { action: "names", detail: "返事の形：" + typeof studentList });
        } 
    } catch (e) { 
        gasFail("E-DATA-01", { action: "names", detail: String(e && e.message || e) });
        console.error(e); 
    }
};

function sendServerRequest(url, params, callbackName, callbackFn) {
    // 更新情報の確認は、クラスのGASとは別です。失敗しても、エラー表示は出しません
    const isChangelog = callbackName === "handleChangelogAutoCheck" || callbackName === "handleChangelogManual";
    const action = (params && params.action) || "";
    const quiet = callbackName === "handleAutoSyncResult";
    if (!isChangelog) gasWatchStart(callbackName, { action, quiet });
    window[callbackName] = function(res) { 
        const scriptEl = $id(callbackName + "Script"); 
        if (scriptEl) scriptEl.remove(); 
        if (!isChangelog) {
            gasWatchDone(callbackName);
            const bad = gasResponseProblem(res, action);
            if (bad) { gasFail(bad.code, { action, detail: bad.detail, quiet }); return; }
            gasErrClearFor(action);
        }
        callbackFn(res); 
    };
    
    const script = document.createElement("script"); 
    script.id = callbackName + "Script"; 
    
    let query = []; 
    for (let key in params) { 
        query.push(key + "=" + encodeURIComponent(params[key])); 
    } 
    script.src = url + (url.includes("?") ? "&" : "?") + query.join("&") + "&callback=" + callbackName;
    script.onerror = function() { 
        if (callbackName === "handleChangelogAutoCheck") return;
        if (callbackName === "handleChangelogManual") {
            if (typeof showLocalChangelog === "function") { showLocalChangelog(); return; }
            const infoBody = $id("updateInfoBody");
            if (infoBody) infoBody.innerHTML = '<p style="color: var(--text-sub); font-size: 13px;">更新情報を取得できませんでした。通信できる場所でもう一度試してください。</p>';
            return;
        }
        gasLoadFailed(callbackName, script.src);
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
        } else {
            gasFail("E-SHEET-04", { action: "save", detail: "返事に success がありませんでした" });
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
    protectRestoredSeatsFromAutoSync = false; // 自分で読み込んだ（または取り込みを許可した）ので保護は解除
    return true;
}

// キャッシュから復元した「まだGASに保存していない座席表」がある時に、手動の読み込みで上書きしてよいか確認する。
// 「キャンセル」なら読み込まず、座席表はそのまま残す。

function confirmOverwriteRestoredSeats() {
    if (!protectRestoredSeatsFromAutoSync) return true;
    return confirm("キャッシュから復元した座席表は、まだクラウドのGASに保存されていません。\nクラウドの内容で上書きしてもよいですか？\n\n「キャンセル」を押すと今の座席表をそのまま残します。");
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
        } else {
            gasFail("E-SHEET-02", { action: "load", detail: "クラス名：" + presetName });
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
