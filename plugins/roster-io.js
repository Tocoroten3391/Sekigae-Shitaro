// ==========================================
// 名簿の読み込みと書き出しプラグイン（必須）：名簿の取り込み、書き出し、最初の画面、出席番号順のリセットです。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
function downloadAsCSV() {
    if (currentStudents.length === 0) { 
        showToast("座席表が空です。", "error"); 
        return; 
    }
    const cSel = $id("columnSelect");
    const rSel = $id("rowSelect");
    const cols = cSel ? parseInt(cSel.value, 10) : 6;
    const rows = rSel ? parseInt(rSel.value, 10) : 6;
    let csvRows = [];
    
    for (let r = 0; r < rows; r++) { 
        let csvRow = []; 
        for (let c = 0; c < cols; c++) { 
            const seat = currentStudents[r * cols + c]; 
            csvRow.push(!seat || seat.type === "EMPTY_SPACE" ? "" : seat.type === "MANUAL_EMPTY" ? "✕ 空席" : (seat.text || "").replace(/\[休\]/g, "").trim()); 
        } 
        csvRows.push(csvRow.join(",")); 
    }
    
    const a = document.createElement("a"); 
    a.href = URL.createObjectURL(new Blob(["\uFEFF" + csvRows.join("\n")], { type: "text/csv;charset=utf-8;" })); 
    a.download = `${getSelectedPresetName() || "座席表"}.csv`; 
    document.body.appendChild(a); 
    a.click(); 
    document.body.removeChild(a); 
    showToast("CSVファイルとしてダウンロードしました。", "success");
}

// 名簿の書き出し：座席・わがままの指定や欠席などの印は付けず、「番号.名前」だけを出す。

function getRosterNamesForExport() {
    return (lastRawList || []).map(s => String(s)
        .replace(/\[休\]/g, "").replace(/<[^>]*>/g, "").replace(/\[[^\]]*\]/g, "").replace(/\{[^}]*\}/g, "")
        .replace(/\s+/g, " ").trim()).filter(s => s !== "");
}

function exportRosterFile(kind) {
    const names = getRosterNamesForExport();
    if (names.length === 0) {
        showToast("書き出せる名簿がありません。", "error");
        return;
    }
    const baseName = getSelectedPresetName() || ($id("presetNameInput") && $id("presetNameInput").value.trim()) || "名簿";
    let content, mime, ext;
    if (kind === "csv") {
        const q = v => /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
        const hasFuri = names.some(n => furiganaMap[getCleanStudentKey(n)]);
        const lines = [hasFuri ? "番号,名前,ふりがな" : "番号,名前"];
        names.forEach((n, i) => {
            const m = n.match(/^(\d+)\.(.*)$/);
            const no = m ? m[1] : String(i + 1);
            const nm = (m ? m[2] : n).replace(/[（(][^）)]*[）)]/g, "").trim();
            lines.push(`${no},${q(nm)}` + (hasFuri ? `,${q(furiganaMap[getCleanStudentKey(n)] || "")}` : ""));
        });
        content = "\uFEFF" + lines.join("\r\n"); // Excelで文字化けしないようBOM付き
        mime = "text/csv;charset=utf-8;";
        ext = "csv";
    } else {
        content = names.join("\r\n");
        mime = "text/plain;charset=utf-8;";
        ext = "txt";
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type: mime }));
    a.download = `${baseName}_名簿.${ext}`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    showToast(`名簿${names.length}人分を、${ext.toUpperCase()}で書き出しました。`, "success");
}

// ==========================================
// 名簿を作る・直す：表の形で、名簿を作ったり、直したりする
// ==========================================

function importOfflineFile(input) {
    const file = input.files[0]; 
    if (!file) return; 
    endTrialIfActive(true);
    
    const reader = new FileReader();
    reader.onload = function(e) { 
        const text = decodeRosterFileBuffer(e.target.result);
        const exported = parseRosterFileText(text);
        if (!exported) {
            const table = detectRosterTable(text);
            if (table) { openRosterMapModal(table); input.value = ""; return; }
        }
        let cleanedNames = exported ? exported : text.split(/[\n\r,、\t]+/).map((name, index) => { 
            if (name == null) return null; 
            let clean = String(name).trim(); 
            if (!clean) return null; 
            clean = clean.replace(/ /g, " ").replace(/\s+/g, " "); 
            return clean.match(/^\d+\./) ? clean : `${index + 1}.${clean}`; 
        }).filter(n => n !== null); 
        
        const sInput = $id("studentInput");
        if(sInput) sInput.value = cleanedNames.join(", "); 
        
        lastRawList = [...cleanedNames]; 
        parseAndSetSeats(cleanedNames, false, "initial"); 
        showToast("ファイルから名簿を取り込みました。", "success"); 
        const fileIssues = analyzeRosterStrings(cleanedNames).filter(i => i.level === "warn");
        if (fileIssues.length) showToast(`名簿に注意があります。${fileIssues[0].title}`, "error");
        input.value = ""; 
    }; 
    reader.readAsArrayBuffer(file);
}

// ==========================================
// 列を指定して取り込む：表の形のファイルで、どの列が何かを選ぶ
// ==========================================

const WELCOME_SAMPLE_NAMES = ["青木", "石川", "井上", "遠藤", "大野", "岡田", "小川", "加藤", "木村", "小林", "近藤", "斉藤", "坂本", "佐藤", "鈴木", "高橋", "田中", "千葉", "中村", "西村", "野口", "長谷川", "林", "原田", "藤井", "松本", "森", "山田", "吉田", "渡辺"];

function buildWelcomeCardHtml() {
    return `<div class="welcome-card welcome-guide">
        <div class="welcome-title">はじめまして、席替えし太郎です</div>
        <p class="welcome-lead">名簿を用意すると、席替えと指名が使えます。まずは試してみましょう。</p>
        <div class="welcome-quick">
            <input type="number" id="welcomeCountInput" min="1" max="100" placeholder="人数" aria-label="人数" onkeydown="if(event.key==='Enter'){welcomeStartWithCount();}">
            <button type="button" class="welcome-btn welcome-btn-primary" onclick="welcomeStartWithCount()">👥 人数だけで始める</button>
        </div>
        <div class="welcome-actions">
            <button type="button" class="welcome-btn" onclick="welcomeStartSample()">🧪 サンプルのクラスで試す</button>
            <button type="button" class="welcome-btn" onclick="welcomeImportFile()">📄 名簿ファイルを読み込む</button>
            <button type="button" class="welcome-btn" onclick="welcomeOpenRoster()">📝 設定から名簿を用意する</button>
        </div>
        <ol class="welcome-steps">
            <li><strong>名簿を用意します。</strong>上のボタンで、すぐに始められます。</li>
            <li><strong>「席替えスタート！」を押します。</strong>席が決まります。</li>
            <li><strong>「指名する」を押します。</strong>授業で、ランダムに指名できます。</li>
        </ol>
        <p class="welcome-note">サンプルで試した記録は、本物のクラスには入りません。試したあとは、設定の「名簿」で、本物の名簿に入れ替えられます。</p>
    </div>`;
}

function welcomeStartWithCount() {
    if (isAppLocked()) { showLockedToast(); return; }
    const w = $id("welcomeCountInput"), q = $id("quickCountInput");
    if (!w || !q) return;
    q.value = w.value;
    generateNumbersOnlyList();
    if (currentStudents && currentStudents.some(isRealStudentSeat)) showToast("「席替えスタート！」を押すと、席が決まります。", "success");
}

function welcomeStartSample() {
    if (isAppLocked()) { showLockedToast(); return; }
    startTrialClass();
    const list = WELCOME_SAMPLE_NAMES.map((name, i) => `${i + 1}.${name}`);
    const sInput = $id("studentInput");
    if (sInput) sInput.value = list.join(", ");
    lastRawList = [...list];
    parseAndSetSeats(list, false, "initial");
    showToast("サンプルのクラスです。「席替えスタート！」を押してみてください。", "success");
}

function welcomeImportFile() {
    if (isAppLocked()) { showLockedToast(); return; }
    const f = $id("offlineFileInput");
    if (f) f.click();
}

function welcomeOpenRoster() {
    if (isAppLocked()) { showLockedToast(); return; }
    const container = $id("configContainer");
    if (container && !container.classList.contains("open")) toggleConfigMenu();
    clearConfigSearch();
    const sec = document.querySelector("#configContainer .config-section-roster");
    if (sec) { setConfigSectionCollapsed(sec, false); sec.scrollIntoView({ block: "start", behavior: "smooth" }); }
}

function generateNumbersOnlyList() {
    const qInput = $id("quickCountInput");
    const count = qInput ? parseInt(qInput.value, 10) : 0; 
    if (!count || count < 1 || count > 100) { 
        showToast("1〜100の範囲で入力してください。", "error"); 
        return; 
    }
    endTrialIfActive(true);
    
    let temporaryList = []; 
    for (let i = 1; i <= count; i++) {
        temporaryList.push(`${i}.${i}番`); 
    }
    
    const sInput = $id("studentInput");
    if(sInput) sInput.value = temporaryList.join(", "); 
    
    lastRawList = [...temporaryList]; 
    parseAndSetSeats(temporaryList, false, "initial"); 
    showToast(`${count}人分の名簿を生成しました。`, "success"); 
    
    if(qInput) qInput.value = "";
}

function resetToNumberOrder() {
    const sInput = $id("studentInput");
    if(!sInput) return;
    
    const inputText = sInput.value; 
    if (!inputText) { 
        showToast("名簿データがありません。", "error"); 
        return; 
    }
    
    let cleanList = splitRosterRaw(inputText).map(name => name.replace(/\[休\]/g, "").replace(/\[[A-Za-z]\d+\]/, "").replace(/\{[A-Za-z]\d+\}/, "").trim()).filter(name => name !== ""); 
    lastRawList = [...cleanList]; 
    sInput.value = cleanList.join(", "); 
    
    parseAndSetSeats(cleanList, false, document.body.classList.contains("no-animation") ? "none" : "initial"); 
    showToast("出席番号順にリセットしました。", "success");
}

function handleAdminToggle() {
    const tog = $id("adminToggle");
    const isMenuOn = tog ? tog.checked : false; 
    
    const pArea = $id("passwordArea");
    if(pArea) pArea.style.display = isMenuOn ? "flex" : "none";
    
    if (!isMenuOn) { 
        const aSec = $id("adminSection");
        if(aSec) aSec.style.display = "none"; 
        
        const pInput = $id("passwordInput");
        if(pInput) pInput.value = ""; 
        isAuthorized = false; 
    }
}

function checkPassword() {
    const pInput = $id("passwordInput");
    if (!pInput) return;
    
    if (pInput.value === ADMIN_PASSWORD) { 
        isAuthorized = true; 
        
        const pArea = $id("passwordArea");
        if(pArea) pArea.style.display = "none"; 
        
        const aSec = $id("adminSection");
        if(aSec) aSec.style.display = "block"; 
        
        showToast("管理者認証に成功しました。", "success"); 
    } 
    else { 
        showToast("パスワードが違います。", "error"); 
        const tog = $id("adminToggle");
        if(tog) tog.checked = false; 
        
        const pArea = $id("passwordArea");
        if(pArea) pArea.style.display = "none"; 
    }
}

function cleanAndFormatNameList(rawNames) {
    return rawNames.map((name, index) => { 
        if (name == null) return null; 
        let clean = String(name).trim(); 
        if (!clean) return null; 
        clean = clean.replace(/ /g, " ").replace(/\s+/g, " "); 
        return clean.match(/^\d+\./) ? clean : `${index + 1}.${clean}`; 
    }).filter(n => n !== null);
}

function applyStudentListToApp(studentList) {
    endTrialIfActive(true);
    const sInput = $id("studentInput");
    const currentInputText = sInput ? sInput.value : "";
    
    const updatedList = cleanAndFormatNameList(studentList).map(newName => {
        const escapedName = newName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); 
        let res = newName;
        
        if (currentInputText) {
            const match1 = currentInputText.match(new RegExp(escapedName + '\\s*\\[([A-Za-z]\\d+)\\]'));
            const match2 = currentInputText.match(new RegExp(escapedName + '\\s*\\{([A-Za-z]\\d+)\\}'));
            const match3 = currentInputText.match(new RegExp(escapedName + '\\s*\\[行(\\d+)\\]'));
            const match4 = currentInputText.match(new RegExp(escapedName + '\\s*\\[列([A-Za-z])\\]', 'i'));
            const match7 = currentInputText.match(new RegExp(escapedName + '\\s*(\\[自由(?:行列|席):[^\\]]*\\])'));
            
            if (match1) res = `${newName} [${match1[1]}]`;
            else if (match2) res = `${newName} {${match2[1]}}`;
            else if (match3) res = `${newName} [行${match3[1]}]`;
            else if (match4) res = `${newName} [列${match4[1].toUpperCase()}]`;
            else if (match7) res = `${newName} ${match7[1]}`;
        }
        
        const match5 = currentInputText ? currentInputText.match(new RegExp(escapedName + '.*?\\[休\\]')) : null;
        return res + (match5 ? " [休]" : "");
    });
    
    if(sInput) sInput.value = updatedList.join(", "); 
    lastRawList = [...updatedList]; 
    const furiCount = harvestFuriganaFromRoster(updatedList, true); // GASの名簿のフリガナを、ふりがなとして取り込む
    parseAndSetSeats(updatedList, false, "initial");
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "roster-io",
    name: "名簿の読み込みと書き出し",
    version: "1.0",
    required: true,
    description: "名簿の取り込み、書き出し、最初の画面、出席番号順のリセットです。"
});
