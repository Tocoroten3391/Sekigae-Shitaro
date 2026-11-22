// ==========================================
// 席の設定画面プラグイン（必須）：席をタップしたときの設定画面と、優先エリアの選択です。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
function updateSeatPickerOptions(cols, rows) {
    const picker = $id("seatPickerSelect");
    if (!picker) return;
    const prevValue = picker.value;
    picker.innerHTML = "";
    for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
            const label = String.fromCharCode(65 + c) + (r + 1);
            const opt = document.createElement("option");
            opt.value = label;
            opt.textContent = label;
            picker.appendChild(opt);
        }
    }
    if (Array.from(picker.options).some(o => o.value === prevValue)) picker.value = prevValue;
}

// 座席モーダルの「②生徒を配置」で、プルダウンをスクロールしなくても
// 番号（出席番号の「15.」のような接頭辞）か名前の一部を入力してその生徒を選べるようにする。
// 「秘密の指定席コマンド」と同じ判定ルール（数字だけなら番号前方一致、それ以外は名前部分一致）。

function findStudentInModalByQuery() {
    const input = $id("modalStudentQuickInput");
    const select = $id("modalStudentSelect");
    if (!input || !select) return;

    const query = input.value.trim();
    if (!query) return;

    let foundIdx = -1;
    lastRawList.forEach((s, idx) => {
        if (foundIdx !== -1) return;
        const cleanName = s.replace(/\[休\]/g, "").replace(/\[[A-Za-z]\d+\]/, "").replace(/\{[A-Za-z]\d+\}/, "").replace(/\[行\d+\]/g, "").replace(/\[列[A-Za-z]\]/gi, "").replace(/\[範囲[A-Za-z]\d+-[A-Za-z]\d+\]/g, "").replace(/\[自由(?:行列|席):[^\]]*\]/g, "").replace(/[（\(].*?[）\)]/g, "").trim();
        if ((query.match(/^\d+$/) && cleanName.startsWith(query + ".")) || cleanName.includes(query)) {
            foundIdx = idx;
        }
    });

    if (foundIdx === -1) {
        showToast(`「${query}」に当てはまる生徒がいません。`, "error");
        return;
    }

    select.value = foundIdx;
    if (typeof select.onchange === "function") select.onchange();
    showToast(`「${select.options[select.selectedIndex].textContent}」を選択しました。`, "success");
}

function openSeatModalFromPicker() {
    const picker = $id("seatPickerSelect");
    const label = picker ? picker.value : "";
    if (!label) { showToast("座席を選んでください。", "error"); return; }

    const container = $id("configContainer");
    const btn = $id("configMenuBtn");
    if (container && container.classList.contains("open")) {
        container.classList.remove("open");
        if (btn) { btn.textContent = "⚙️ 設定"; btn.classList.remove("is-open"); }
    }
    closeSeatSettingsModal();
    handleSeatClick(label);
}

function handleSeatClick(label) {
    activeTargetSeatLabel = label; 
    const modalTitle = $id("modalTitle");
    if (modalTitle) modalTitle.textContent = `座席 ${label} の設定`;
    const quickInput = $id("modalStudentQuickInput");
    if (quickInput) quickInput.value = "";
    
    const rowStr = label.slice(1);
    const colStr = label.charAt(0);
    
    const input = $id("emptySeatsInput");
    const emptyArray = input ? input.value.split(",").map(s => s.trim().toUpperCase()).filter(s => s !== "") : [];
    const isEmpty = emptyArray.indexOf(label) > -1;
    
    const emptyBtn = $id("modalEmptyBtn");
    if (emptyBtn) { 
        if (isEmpty) { 
            emptyBtn.textContent = "普通の席に戻す"; 
            emptyBtn.className = "btn-connect"; 
        } else { 
            emptyBtn.textContent = "この場所を空席にする"; 
            emptyBtn.className = "btn-delete"; 
        } 
    }

    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) : 6;
    const seatIndex = getIndexFromLabel(label, cols);
    const currentSeatData = currentStudents[seatIndex];
    
    let currentSitterCleanName = null;
    if (currentSeatData && currentSeatData.type === "STUDENT" && currentSeatData.text) {
        currentSitterCleanName = currentSeatData.text.replace(/\[休\]/g, "").replace(/\[[A-Za-z]\d+\]/, "").replace(/\{[A-Za-z]\d+\}/, "").replace(/\[行\d+\]/g, "").replace(/\[列[A-Za-z]\]/gi, "").replace(/\[範囲[A-Za-z]\d+-[A-Za-z]\d+\]/g, "").replace(/\[自由(?:行列|席):[^\]]*\]/g, "").replace(/[（\(].*?[）\)]/g, "").trim();
    }

    const select = $id("modalStudentSelect"); 
    let selectedIdx = -1, isFixedHere = false, isCurrentlyAbsent = false, currentMemo = "";
    
    if (select) {
        select.innerHTML = '<option value="">-- ランダムに決める --</option>';
        lastRawList.forEach((student, idx) => {
            const isAb = student.includes("[休]");
            const cleanName = student.replace(/\[休\]/g, "").replace(/\[[A-Za-z]\d+\]/, "").replace(/\{[A-Za-z]\d+\}/, "").replace(/\[行\d+\]/g, "").replace(/\[列[A-Za-z]\]/gi, "").replace(/\[範囲[A-Za-z]\d+-[A-Za-z]\d+\]/g, "").replace(/\[自由(?:行列|席):[^\]]*\]/g, "").replace(/<[^>]*>/g, "").replace(/[（\(].*?[）\)]/g, "").trim();
            const match = student.match(/\[([A-Za-z]\d+)\]/); 
            let isThisFixed = match && match[1].toUpperCase() === label;
            const memoMatch = student.match(/<([^>]*)>/);
            
            if (isThisFixed) { 
                selectedIdx = idx; 
                isFixedHere = true; 
                isCurrentlyAbsent = isAb; 
                currentMemo = memoMatch ? memoMatch[1] : ""; 
            } else if (!isFixedHere && currentSitterCleanName && cleanName === currentSitterCleanName) { 
                selectedIdx = idx; 
                isCurrentlyAbsent = isAb; 
                currentMemo = memoMatch ? memoMatch[1] : ""; 
            }
            
            const opt = document.createElement("option"); 
            opt.value = idx; 
            opt.textContent = cleanName; 
            select.appendChild(opt);
        });
        
        if (selectedIdx !== -1) select.value = selectedIdx; 
        select.disabled = isEmpty;
    }

    const absentToggle = $id("modalAbsentToggle");
    if (absentToggle) { 
        absentToggle.checked = isCurrentlyAbsent; 
        absentToggle.disabled = isEmpty || selectedIdx === -1; 
    }
    
    const areaSelect = $id("modalAreaSelect");
    const reasonSection = $id("modalReasonSection");
    const reasonInput = $id("modalReasonInput");
    if (areaSelect) {
        let currentAreaVal = "none";
        if (selectedIdx !== -1) { 
            const st = lastRawList[selectedIdx]; 
            if (st.match(/\[([A-Za-z]\d+)\]/)) currentAreaVal = "fixed"; 
            else if (st.match(/\[行\d+\]/)) currentAreaVal = "row"; 
            else if (st.match(/\[列[A-Za-z]\]/i)) currentAreaVal = "col"; 
            else if (st.match(/\[自由行列:(?:前|後)\d+\]/)) currentAreaVal = "priority"; 
            else if (st.match(/\[自由行列:/)) currentAreaVal = "customRC"; 
            else if (st.match(/\[自由席:/)) currentAreaVal = "customSeats"; 
        }
        areaSelect.innerHTML = `<option value="none">🔄 どこかの席でランダム</option><option value="fixed">📌 この席 ${label} で絶対固定</option><option value="row">${rowStr}行目の中でランダム</option><option value="col">${colStr}列目の中でランダム</option><option value="priority">優先席：視力・身長などのための前列・後列</option><option value="customRC">カスタム：行・列を複数選んでランダム</option><option value="customSeats">カスタム：座席を個別に選んでランダム</option>`;
        areaSelect.value = currentAreaVal; 
        areaSelect.disabled = isEmpty || selectedIdx === -1;
        syncModalRangeSection(label, selectedIdx !== -1 ? lastRawList[selectedIdx] : "");
        const showFixedSeatToggle = $id("modalYaochoShowFixedToggle");
        if (showFixedSeatToggle) {
            showFixedSeatToggle.checked = yaochoShowFixedSeats.has(label);
            showFixedSeatToggle.disabled = isEmpty;
        }
        if (reasonSection) reasonSection.style.display = (currentAreaVal !== "none") ? "block" : "none";
        if (reasonInput) reasonInput.value = currentMemo;
        areaSelect.onchange = function() {
            syncModalRangeSection(label, "");
            if (reasonSection) reasonSection.style.display = (this.value !== "none") ? "block" : "none";
        };
    }
    
    if (select) {
        select.onchange = function() {
            if (this.value === "") { 
                if (absentToggle) absentToggle.disabled = true; 
                if (areaSelect) areaSelect.disabled = true; 
                if (reasonSection) reasonSection.style.display = "none"; 
                if (reasonInput) reasonInput.value = ""; 
            } else {
                if (absentToggle) { 
                    absentToggle.disabled = false; 
                    absentToggle.checked = lastRawList[this.value].includes("[休]"); 
                }
                if (areaSelect) { 
                    areaSelect.disabled = false; 
                    const st = lastRawList[this.value]; 
                    if (st.match(/\[([A-Za-z]\d+)\]/)) areaSelect.value = "fixed"; 
                    else if (st.match(/\[行\d+\]/)) areaSelect.value = "row"; 
                    else if (st.match(/\[列[A-Za-z]\]/i)) areaSelect.value = "col";
                    else if (st.match(/\[自由行列:(?:前|後)\d+\]/)) areaSelect.value = "priority";
                    else if (st.match(/\[自由行列:/)) areaSelect.value = "customRC";
                    else if (st.match(/\[自由席:/)) areaSelect.value = "customSeats"; 
                    else areaSelect.value = "none"; 
                    syncModalRangeSection(label, st);
                    if (reasonSection) reasonSection.style.display = (areaSelect.value !== "none") ? "block" : "none"; 
                    if (reasonInput) { const m = st.match(/<([^>]*)>/); reasonInput.value = m ? m[1] : ""; } 
                }
            }
        };
    }
    
    const groupSection = $id("modalGroupSection");
    const typeSelect = $id("groupTypeSelect");
    
    if (groupSection && typeSelect) {
        if (typeSelect.value === "manual" && !isEmpty) {
            groupSection.style.display = "block"; 
            const groupSelect = $id("modalGroupSelect");
            if (groupSelect) { 
                groupSelect.innerHTML = '<option value="0">-- 班を指定しない --</option>'; 
                for (let i = 1; i <= seatGroupCount; i++) { 
                    const opt = document.createElement("option"); 
                    opt.value = i; 
                    opt.textContent = groupNames[i] || `${i}班`; 
                    if (manualGroupMap[label] === i) opt.selected = true; 
                    groupSelect.appendChild(opt); 
                } 
            }
        } else { 
            groupSection.style.display = "none"; 
        }
    }

    document.body.style.overflow = "hidden"; 
    const overlay = $id("seatModalOverlay");
    if (overlay) overlay.style.display = "flex";
}

function closeSeatModal() { 
    document.body.style.overflow = ""; 
    const overlay = $id("seatModalOverlay");
    if (overlay) overlay.style.display = "none"; 
    activeTargetSeatLabel = ""; 
}

function toggleEmptyFromModal() {
    saveSeatHistory(); 
    const label = activeTargetSeatLabel; 
    const input = $id("emptySeatsInput");
    if (!input) return;
    
    let emptyArray = input.value.split(",").map(s => s.trim().toUpperCase()).filter(s => s !== "");
    const existIndex = emptyArray.indexOf(label);
    
    if (existIndex > -1) { 
        emptyArray.splice(existIndex, 1); 
        showToast(`座席 ${label} の空席指定を解除しました。`, "success"); 
    } else {
        emptyArray.push(label);
        lastRawList = lastRawList.map(s => { 
            const match1 = s.match(/\[([A-Za-z]\d+)\]/);
            const match2 = s.match(/\{([A-Za-z]\d+)\}/); 
            if (match1 && match1[1].toUpperCase() === label) return s.replace(/\[[A-Za-z]\d+\]/, "").trim(); 
            if (match2 && match2[1].toUpperCase() === label) return s.replace(/\{[A-Za-z]\d+\}/, "").trim(); 
            return s; 
        });
        const sInput = $id("studentInput");
        if (sInput) sInput.value = lastRawList.join(", "); 
        showToast(`座席 ${label} を空席に指定しました。`, "success"); 
        if (manualGroupMap[label]) delete manualGroupMap[label];
    }
    input.value = emptyArray.join(", "); 
    closeSeatModal(); 
    onLayoutChange();
}

function applyStudentFromModal() {
    // カスタム範囲は、行・列（または座席）が1つも選ばれていないと意味がないので、先に確かめる
    let customTag = "";
    const preAreaSel = $id("modalAreaSelect"), preStudentSel = $id("modalStudentSelect");
    if (preStudentSel && preStudentSel.value !== "" && preAreaSel && (preAreaSel.value === "customRC" || preAreaSel.value === "customSeats" || preAreaSel.value === "priority")) {
        customTag = preAreaSel.value === "priority" ? readPriorityPicker() : readCustomPickers(preAreaSel.value);
        if (!customTag) { showToast("カスタム範囲の行・列か座席を1つ以上選んでください。", "error"); return; }
    }
    saveSeatHistory(); 
    const label = activeTargetSeatLabel;
    const select = $id("modalStudentSelect");
    const selectedIdx = select ? select.value : "";
    const areaSelect = $id("modalAreaSelect");
    const areaRule = areaSelect ? areaSelect.value : "fixed";
    
    lastRawList = lastRawList.map(s => { 
        const match1 = s.match(/\[([A-Za-z]\d+)\]/);
        const match2 = s.match(/\{([A-Za-z]\d+)\}/); 
        if (match1 && match1[1].toUpperCase() === label) return s.replace(/\[[A-Za-z]\d+\]/, "").replace(/<[^>]*>/, "").trim(); 
        if (match2 && match2[1].toUpperCase() === label) return s.replace(/\{[A-Za-z]\d+\}/, "").replace(/<[^>]*>/, "").trim(); 
        return s; 
    });

    if (selectedIdx !== "") {
        const targetIdx = parseInt(selectedIdx, 10);
        let cleanName = lastRawList[targetIdx].replace(/\[休\]/g, "").replace(/\[[A-Za-z]\d+\]/, "").replace(/\{[A-Za-z]\d+\}/, "").replace(/\[行\d+\]/g, "").replace(/\[列[A-Za-z]\]/gi, "").replace(/\[範囲[A-Za-z]\d+-[A-Za-z]\d+\]/g, "").replace(/\[自由(?:行列|席):[^\]]*\]/g, "").trim();
        let rowStr = label.slice(1);
        let colStr = label.charAt(0);
        
        let displayName = cleanName.replace(/[（\(].*?[）\)]/g, ""); 
        if (displayName.includes(".")) displayName = displayName.split(".")[1].trim();
        
        const abToggle = $id("modalAbsentToggle");
        const isAbsent = abToggle ? abToggle.checked : false; 
        if (isAbsent) cleanName = cleanName + " [休]";

        const reasonInputEl = $id("modalReasonInput");
        const reasonText = (areaRule !== "none" && reasonInputEl) ? reasonInputEl.value.trim() : "";
        const reasonTag = reasonText ? `<${reasonText}>` : "";

        if (areaRule === "fixed") { 
            lastRawList[targetIdx] = `${cleanName} [${label}]${reasonTag}`; 
            showToast(`${displayName} を座席 ${label} に固定${isAbsent?'し、欠席にし':'し'}ました。`, "success"); 
        } else if (areaRule === "row") { 
            lastRawList[targetIdx] = `${cleanName} [行${rowStr}]${reasonTag}`; 
            showToast(`${displayName} を ${rowStr}行目 でランダム指定${isAbsent?'し、欠席にし':'し'}ました。`, "success"); 
        } else if (areaRule === "col") { 
            lastRawList[targetIdx] = `${cleanName} [列${colStr}]${reasonTag}`; 
            showToast(`${displayName} を ${colStr}列目 でランダム指定${isAbsent?'し、欠席にし':'し'}ました。`, "success"); 
        } else if (areaRule === "customRC" || areaRule === "customSeats" || areaRule === "priority") { 
            lastRawList[targetIdx] = `${cleanName} ${customTag}${reasonTag}`; 
            const customVal = customTag.replace(/^\[自由(?:行列|席):/, (areaRule === "customSeats" ? "席:" : "")).replace(/\]$/, "");
            if (areaRule === "priority") {
                showToast(`${displayName} を ${getCustomRuleText(customVal).replace(/^\S+ /, "").replace("の優先席", "")} の優先席にし${isAbsent?'、欠席にし':''}ました。`, "success"); 
            } else {
                showToast(`${displayName} を ${getCustomRuleText(customVal).replace(/^\S+ /, "")} でランダム指定${isAbsent?'し、欠席にし':'し'}ました。`, "success"); 
            }
        } else { 
            lastRawList[targetIdx] = cleanName; 
            showToast(`${displayName} の設定を更新${isAbsent?'し、欠席にし':'し'}ました。`, "success"); 
        }

        // この座席に今まさに配置した生徒が、次の再描画（onLayoutChange）で
        // 元いた座席や名簿順に戻ってしまわないよう、表示上の位置をこの座席に更新しておく。
        // わがまま（行・列）指定にしても、実際に席替えを押すまではこの場所から動かさない。
        const colSelForPick = $id("columnSelect");
        const colsForPick = colSelForPick ? parseInt(colSelForPick.value, 10) : 6;
        const seatIdx = getIndexFromLabel(label, colsForPick);
        if (seatIdx !== null && Array.isArray(currentStudents)) {
            const matchKey = getCleanNameForMatch(cleanName);
            currentStudents.forEach((seat, idx) => {
                if (seat && seat.type === "STUDENT" && (seat.fixedType === "none" || seat.fixedType === "area") && getCleanNameForMatch(seat.text) === matchKey) {
                    currentStudents[idx] = null;
                }
            });
            currentStudents[seatIdx] = { type: "STUDENT", text: cleanName.replace(/\[休\]/g, "").trim(), isFixed: false, fixedType: "none", isAbsent: isAbsent, memo: reasonText };
        }
    } else { 
        showToast(`座席 ${label} の指定を解除しました。`, "success"); 
    }

    const showFixedSeatEl = $id("modalYaochoShowFixedToggle");
    if (showFixedSeatEl) {
        if (showFixedSeatEl.checked && selectedIdx !== "") yaochoShowFixedSeats.add(label);
        else yaochoShowFixedSeats.delete(label);
        saveYaochoShowFixedSeats();
    }

    const typeSel = $id("groupTypeSelect");
    if (typeSel && typeSel.value === "manual") { 
        const grSelect = $id("modalGroupSelect");
        const groupVal = grSelect ? parseInt(grSelect.value, 10) : 0; 
        if (groupVal > 0) manualGroupMap[label] = groupVal; 
        else if (manualGroupMap[label]) delete manualGroupMap[label]; 
    }
    
    const sInput = $id("studentInput");
    if (sInput) sInput.value = lastRawList.join(", "); 
    closeSeatModal(); 
    onLayoutChange();
}

// 席を選ぶ欄（カスタム）と、優先席の欄を作り直します。

function syncModalRangeSection(startLabel, selectedTag) {
    const colSel = $id("columnSelect"), rowSel = $id("rowSelect");
    const cols = colSel ? parseInt(colSel.value, 10) : 6;
    const rows = rowSel ? parseInt(rowSel.value, 10) : 6;
    buildCustomPickers(startLabel, selectedTag, cols, rows);
    buildPriorityPicker(selectedTag, rows);
}

// 優先席（前から／後ろから ○行目まで）の選択欄。「優先席」が選ばれている時だけ表示する。

function buildPriorityPicker(tag, rows) {
    const areaSel = $id("modalAreaSelect");
    const sec = $id("modalPrioritySection"), dirSel = $id("modalPriorityDir"), numSel = $id("modalPriorityRows");
    if (!areaSel || !sec || !dirSel || !numSel) return;
    sec.style.display = areaSel.value === "priority" ? "block" : "none";
    const m = tag ? String(tag).match(/\[自由行列:(前|後)(\d+)\]/) : null;
    const keepNum = m ? parseInt(m[2], 10) : (parseInt(numSel.value, 10) || 2);
    if (m) dirSel.value = m[1];
    numSel.innerHTML = "";
    for (let r = 1; r <= rows; r++) {
        const opt = document.createElement("option");
        opt.value = String(r);
        opt.textContent = `${r}行目まで`;
        numSel.appendChild(opt);
    }
    numSel.value = String(Math.min(Math.max(keepNum, 1), rows));
}

function readPriorityPicker() {
    const dirSel = $id("modalPriorityDir"), numSel = $id("modalPriorityRows");
    if (!dirSel || !numSel) return "";
    return `[自由行列:${dirSel.value}${parseInt(numSel.value, 10) || 1}]`;
}

// 固定理由のよくある例を、ワンタップで入力する

function fillReasonChip(text) {
    const input = $id("modalReasonInput");
    if (input) { input.value = text; input.focus(); }
}

// カスタム範囲（行・列を複数／座席を個別）の選択欄を作る。表示は選ばれているルールに合わせて切り替える。

function buildCustomPickers(startLabel, tag, cols, rows) {
    const areaSel = $id("modalAreaSelect");
    const rcSec = $id("modalCustomRCSection"), seatSec = $id("modalCustomSeatsSection");
    const rowBox = $id("modalCustomRows"), colBox = $id("modalCustomCols"), grid = $id("modalCustomSeatGrid");
    if (!areaSel || !rcSec || !seatSec || !rowBox || !colBox || !grid) return;
    rcSec.style.display = areaSel.value === "customRC" ? "block" : "none";
    seatSec.style.display = areaSel.value === "customSeats" ? "block" : "none";

    // 同じ座席のメニューを開いている間は、選び直したくなくても、チェックを消さない
    const builtKey = `${startLabel}|${cols}|${rows}`;
    if (!tag && grid.dataset.builtKey === builtKey) return;
    grid.dataset.builtKey = builtKey;

    const selRows = new Set(), selCols = new Set(), selSeats = new Set();
    const m = tag ? String(tag).match(/\[自由(行列|席):([^\]]*)\]/) : null;
    if (m) {
        const a = parseCustomArea((m[1] === "席" ? "席:" : "") + m[2]);
        a.seats.forEach(x => selSeats.add(x)); a.rows.forEach(x => selRows.add(x)); a.cols.forEach(x => selCols.add(x));
    } else {
        selSeats.add(startLabel);
        selRows.add(startLabel.slice(1));
    }

    const makeChip = (text, value, on, kind) => {
        const lab = document.createElement("label");
        lab.className = "custom-chip" + (on ? " is-on" : "");
        const cb = document.createElement("input");
        cb.type = "checkbox"; cb.value = value; cb.checked = on; cb.dataset.kind = kind;
        cb.onchange = () => lab.classList.toggle("is-on", cb.checked);
        lab.append(cb, document.createTextNode(text));
        return lab;
    };
    rowBox.innerHTML = ""; colBox.innerHTML = ""; grid.innerHTML = "";
    for (let r = 1; r <= rows; r++) rowBox.appendChild(makeChip(`${r}行目`, String(r), selRows.has(String(r)), "row"));
    for (let c = cols - 1; c >= 0; c--) { const L = String.fromCharCode(65 + c); colBox.appendChild(makeChip(`${L}列目`, L, selCols.has(L), "col")); }
    // 座席の並びは、右端がA列
    grid.style.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
    for (let r = 1; r <= rows; r++) {
        for (let c = cols - 1; c >= 0; c--) {
            const lb = String.fromCharCode(65 + c) + r;
            grid.appendChild(makeChip(lb, lb, selSeats.has(lb), "seat"));
        }
    }
}

function readCustomPickers(kind) {
    const pick = id => Array.from(document.querySelectorAll(`#${id} input:checked`)).map(i => i.value);
    if (kind === "customSeats") {
        const seats = pick("modalCustomSeatGrid").sort((a, b) => a.charCodeAt(0) - b.charCodeAt(0) || parseInt(a.slice(1), 10) - parseInt(b.slice(1), 10));
        return seats.length ? `[自由席:${seats.join(",")}]` : "";
    }
    const rows = pick("modalCustomRows").sort((a, b) => a - b);
    const cols = pick("modalCustomCols").sort();
    const parts = [];
    if (rows.length) parts.push(`行${rows.join(",")}`);
    if (cols.length) parts.push(`列${cols.join(",")}`);
    return parts.length ? `[自由行列:${parts.join(";")}]` : "";
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "seat-modal",
    name: "席の設定画面",
    version: "1.0",
    required: true,
    description: "席をタップしたときの設定画面と、優先エリアの選択です。"
});
