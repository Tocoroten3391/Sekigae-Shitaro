// ==========================================
// 八百長モードプラグイン：席を指定する、隠し機能です。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="yaocho" で結びついていて、自動で隠れます）
// ==========================================
function toggleYaochoMode() {
    const toggle = $id("yaochoModeToggle");
    yaochoMode = toggle ? toggle.checked : false;
    localStorage.setItem("yaocho_mode", yaochoMode ? "true" : "false");
    const btnPreview = $id("btnPreviewShuffle");
    if (btnPreview && btnPreview.style.display !== "none" && yaochoMode) btnPreview.style.display = "none";
    else if (btnPreview && !yaochoMode && lastRawList && lastRawList.length > 0 && !document.body.classList.contains("blackboard-active")) btnPreview.style.display = "inline-block";
    if (yaochoMode && !yaochoRiggedResult) {
        showToast("八百長モードをONにしました。仕込み結果も保存してください。", "success");
    } else {
        showToast(yaochoMode ? "八百長モードをONにしました。" : "八百長モードをOFFにしました。", "success");
    }
}
function toggleYaochoShowFixed() {
    const toggle = $id("yaochoShowFixedToggle");
    yaochoShowFixed = toggle ? toggle.checked : false;
    localStorage.setItem("yaocho_show_fixed", yaochoShowFixed ? "true" : "false");
    showToast(yaochoShowFixed ? "八百長モード中も指定席を表示します。次の席替えから反映されます。" : "八百長モード中は指定席の表示を行いません。", "success");
}
function saveYaochoResult() {
    if (!currentStudents || currentStudents.length === 0) { showToast("座席データがありません", "error"); return; }
    yaochoRiggedResult = JSON.parse(JSON.stringify(currentStudents));
    localStorage.setItem("yaocho_rigged_result", JSON.stringify(yaochoRiggedResult));
    updateYaochoStatusText();
    showToast("今の配置を仕込み結果として保存しました", "success");
}
function clearYaochoResult() {
    yaochoRiggedResult = null;
    localStorage.removeItem("yaocho_rigged_result");
    updateYaochoStatusText();
    showToast("仕込み結果を削除しました", "success");
}
function updateYaochoStatusText() {
    const el = $id("yaochoStatusText");
    if (!el) return;
    el.textContent = yaochoRiggedResult ? "仕込み結果：保存済み" : "仕込み結果：未保存";
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "yaocho",
    name: "八百長モード",
    version: "1.0",
    description: "席を指定する、隠し機能です。",
    stubs: ["updateYaochoStatusText"]
});
