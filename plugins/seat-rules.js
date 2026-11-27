// ==========================================
// 席の指定の読み取りプラグイン（必須）：名簿の読み取りと、「この席は〇〇」といった席の指定を読み取ります。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
// 名簿の文字列を、カンマで区切って、1人ずつに分けます。
// 「[自由席:A1,B2]」のように、印のカッコの中にあるカンマでは、区切りません（切ると、別の人ができてしまうため）
function splitRosterRaw(text, seps) {
    const str = String(text || "");
    const sepSet = seps || ",";
    const prot = [];
    const re = /\[[^\]]*\]|\{[^}]*\}|<[^>]*>/g;
    let m;
    while ((m = re.exec(str)) !== null) prot.push([m.index, m.index + m[0].length]);
    const out = [];
    let start = 0, pi = 0;
    for (let i = 0; i < str.length; i++) {
        if (sepSet.indexOf(str[i]) < 0) continue;
        while (pi < prot.length && prot[pi][1] <= i) pi++;
        if (pi < prot.length && prot[pi][0] <= i && i < prot[pi][1]) continue;
        out.push(str.slice(start, i));
        start = i + 1;
    }
    out.push(str.slice(start));
    return out;
}

function getCleanNameForMatch(text) { 
    return text ? text.replace(/\[休\]/g, "").replace(/\[.*?\]/g, "").replace(/\{.*?\}/g, "").replace(/<[^>]*>/g, "").trim() : ""; 
}

function getSeatLabel(index, cols) { 
    return String.fromCharCode(65 + (cols - 1 - (index % cols))) + (Math.floor(index / cols) + 1); 
}

function getIndexFromLabel(label, cols) { 
    if (!label) return null; 
    const r = parseInt(label.slice(1), 10) - 1;
    const c = cols - 1 - (label.charAt(0).toUpperCase().charCodeAt(0) - 65); 
    return (r < 0 || c < 0 || c >= cols) ? null : r * cols + c; 
}

function getParsedStudentsList(rawList, cols) {
    return rawList.map(item => {
        let originalStr = item;
        let isAbsent = false; 
        
        if (originalStr.includes("[休]")) { 
            isAbsent = true; 
            originalStr = originalStr.replace(/\[休\]/g, "").trim(); 
        }

        // 固定理由のメモ（<...>）。座席の固定・わがまま設定と一緒に持ち運ぶ。
        let memo = "";
        const matchMemo = originalStr.match(/<([^>]*)>/);
        if (matchMemo) {
            memo = matchMemo[1];
            originalStr = originalStr.replace(/<[^>]*>/, "").trim();
        }
        
        const matchNormal = originalStr.match(/\[([A-Za-z]\d+)\]/);
        const matchSecret = originalStr.match(/\{([A-Za-z]\d+)\}/);
        const matchRow = originalStr.match(/\[行(\d+)\]/);
        const matchCol = originalStr.match(/\[列([A-Za-z])\]/i);
        const matchRange = originalStr.match(/\[範囲([A-Za-z]\d+)-([A-Za-z]\d+)\]/);
        const matchCustom = originalStr.match(/\[自由(行列|席):([^\]]*)\]/);
        
        if (matchNormal) {
            return { original: originalStr.replace(/\[[A-Za-z]\d+\]/, "").trim(), fixedLabel: matchNormal[1].toUpperCase(), type: 'fixed', isAbsent: isAbsent, memo: memo };
        } else if (matchSecret) {
            return { original: originalStr.replace(/\{[A-Za-z]\d+\}/, "").trim(), fixedLabel: matchSecret[1].toUpperCase(), type: 'secret', isAbsent: isAbsent, memo: memo };
        } else if (matchRow) {
            return { original: originalStr.replace(/\[行\d+\]/, "").trim(), areaVal: matchRow[1], type: 'row', isAbsent: isAbsent, memo: memo };
        } else if (matchCol) {
            return { original: originalStr.replace(/\[列[A-Za-z]\]/i, "").trim(), areaVal: matchCol[1].toUpperCase(), type: 'col', isAbsent: isAbsent, memo: memo };
        } else if (matchCustom) {
            return { original: originalStr.replace(/\[自由(?:行列|席):[^\]]*\]/, "").trim(), areaVal: (matchCustom[1] === "席" ? "席:" : "") + matchCustom[2].toUpperCase(), type: 'custom', isAbsent: isAbsent, memo: memo };
        } else if (matchRange) {
            // 範囲指定は、なくなりました。古い名簿に残っている印は、取り除いて、指定なしとして読みます
            return { original: originalStr.replace(/\[範囲[A-Za-z]\d+-[A-Za-z]\d+\]/, "").trim(), type: 'normal', isAbsent: isAbsent, memo: memo };
        } else {
            return { original: originalStr.trim(), type: 'normal', isAbsent: isAbsent, memo: memo };
        }
    });
}

// カスタム範囲：「行1,2;列A,C」（指定した行・列のどれかに入る席）、「席:A1,B3」（個別に選んだ席）、
// 「前3」（前から3行目まで）、「後2」（後ろから2行目まで）＝優先席。前・後は他の指定と「;」でつないで組み合わせられる。

function parseCustomArea(val) {
    const v = String(val || "");
    if (v.startsWith("席:")) {
        return { seats: v.slice(2).split(",").map(x => x.trim().toUpperCase()).filter(x => x), rows: [], cols: [], front: 0, back: 0 };
    }
    const rows = [], cols = [];
    let front = 0, back = 0;
    v.split(";").forEach(part => {
        const t = part.trim();
        if (t.startsWith("行")) t.slice(1).split(",").forEach(x => { if (x.trim()) rows.push(x.trim()); });
        else if (t.startsWith("列")) t.slice(1).split(",").forEach(x => { if (x.trim()) cols.push(x.trim().toUpperCase()); });
        else if (t.startsWith("前")) front = Math.max(front, parseInt(t.slice(1), 10) || 0);
        else if (t.startsWith("後")) back = Math.max(back, parseInt(t.slice(1), 10) || 0);
    });
    return { seats: [], rows: rows, cols: cols, front: front, back: back };
}

// 「前N」「後N」を、実際の行番号（文字列）の一覧にする。totalRows は今の座席表の行数。

function expandPriorityRows(area, totalRows) {
    const out = [];
    if (!totalRows) return out;
    for (let r = 1; r <= Math.min(area.front, totalRows); r++) out.push(String(r));
    for (let r = Math.max(1, totalRows - area.back + 1); area.back > 0 && r <= totalRows; r++) out.push(String(r));
    return out;
}

function isSeatInCustom(seat, val, totalRows) {
    const a = parseCustomArea(val);
    if (a.seats.length > 0) return a.seats.includes(seat.col + seat.row);
    return a.rows.includes(String(seat.row)) || a.cols.includes(seat.col) || expandPriorityRows(a, totalRows).includes(String(seat.row));
}

function getCustomRuleText(val) {
    const a = parseCustomArea(val);
    if (a.seats.length > 0) return `${a.seats.join("・")} のどれか`;
    const parts = [];
    if (a.front) parts.push(`前から${a.front}行目まで`);
    if (a.back) parts.push(`後ろから${a.back}行目まで`);
    if (a.rows.length) parts.push(`${a.rows.join("・")}行目`);
    if (a.cols.length) parts.push(`${a.cols.join("・")}列目`);
    const isPriority = (a.front || a.back) && !a.rows.length && !a.cols.length;
    return `${parts.join("／")}${isPriority ? "の優先席" : " の中"}`;
}

function parseAndSetSeats(rawList, shouldShuffle = false, animMode = "initial", isVisualShuffling = false, preserveCurrentPositions = false) {
    if (!isVisualShuffling) { try { harvestFuriganaFromRoster(rawList, false); } catch (error) { console.error("ふりがなの取り込みでエラー:", error); } }
    const colSel = $id("columnSelect");
    let cols = colSel ? parseInt(colSel.value, 10) : 6;
    if (isNaN(cols)) cols = 6;
    
    const rowSel = $id("rowSelect");
    let rows = rowSel ? parseInt(rowSel.value, 10) : 6;
    if (isNaN(rows)) rows = 6;
    
    const empInput = $id("emptySeatsInput");
    const emptyLabels = empInput ? empInput.value.split(",").map(s => s.trim().toUpperCase()).filter(s => s !== "") : [];
    
    if (rawList.length + emptyLabels.length > rows * cols) { 
        rows = Math.ceil((rawList.length + emptyLabels.length) / cols); 
        if (rowSel) {
            if (!Array.from(rowSel.options).some(opt => opt.value == rows)) { 
                const newOpt = document.createElement("option"); 
                newOpt.value = rows; 
                newOpt.textContent = rows + "行"; 
                rowSel.appendChild(newOpt); 
            } 
            rowSel.value = rows; 
        }
    }
    
    const totalGridSeats = rows * cols;
    const classroomResult = new Array(totalGridSeats).fill(null);

    // 席替え後に「お休み指定」など一部だけの変更をした時、まだ「絶対固定」されていない生徒（通常配置・わがまま指定の生徒）が
    // 席替えボタンを押すまでは動かないよう、直前の描画内容から「名前 → 今いる座席」を控えておく。
    // isFixed/fixedTypeはここでは変えないので、班の色を消してしまう「is-fixed」表示に影響しない。
    const previousIndexByName = {};
    if (preserveCurrentPositions && Array.isArray(currentStudents)) {
        currentStudents.forEach((seat, idx) => {
            if (seat && seat.type === "STUDENT" && (seat.fixedType === "none" || seat.fixedType === "area")) {
                const key = getCleanNameForMatch(seat.text);
                if (key && !(key in previousIndexByName)) previousIndexByName[key] = idx;
            }
        });
    }
    
    emptyLabels.forEach(label => { 
        const idx = getIndexFromLabel(label, cols); 
        if (idx !== null && idx < totalGridSeats) {
            classroomResult[idx] = { type: "MANUAL_EMPTY" }; 
        }
    });
    
    const studentsToPlace = { row: {}, col: {}, custom: {}, normal: [] };
    
    getParsedStudentsList(rawList, cols).forEach(student => {
        const idx = getIndexFromLabel(student.fixedLabel, cols);
        if (idx !== null && idx < totalGridSeats && classroomResult[idx] === null && !isVisualShuffling) { 
            classroomResult[idx] = { type: "STUDENT", text: student.original, isFixed: (student.type !== 'secret'), fixedType: 'seat', isAbsent: student.isAbsent, memo: student.memo || "" }; 
        } else {
            if (student.type === 'row' && !isVisualShuffling) { 
                if (!studentsToPlace.row[student.areaVal]) studentsToPlace.row[student.areaVal] = []; 
                studentsToPlace.row[student.areaVal].push({ text: student.original, isFixed: false, isAbsent: student.isAbsent, memo: student.memo || "" }); 
            } else if (student.type === 'custom' && !isVisualShuffling) { 
                if (!studentsToPlace.custom[student.areaVal]) studentsToPlace.custom[student.areaVal] = []; 
                studentsToPlace.custom[student.areaVal].push({ text: student.original, isFixed: false, isAbsent: student.isAbsent, memo: student.memo || "" }); 
            } else if (student.type === 'col' && !isVisualShuffling) { 
                if (!studentsToPlace.col[student.areaVal]) studentsToPlace.col[student.areaVal] = []; 
                studentsToPlace.col[student.areaVal].push({ text: student.original, isFixed: false, isAbsent: student.isAbsent, memo: student.memo || "" }); 
            } else { 
                studentsToPlace.normal.push({ text: student.original, isFixed: false, isAbsent: student.isAbsent, memo: student.memo || "" }); 
            }
        }
    });

    let availableSeats = []; 
    for (let c = 0; c < cols; c++) { 
        for (let r = 0; r < rows; r++) { 
            const label = String.fromCharCode(65 + c) + (r + 1);
            const idx = getIndexFromLabel(label, cols); 
            if (idx !== null && idx < totalGridSeats && classroomResult[idx] === null) {
                availableSeats.push({ idx: idx, row: (r + 1).toString(), col: String.fromCharCode(65 + c) }); 
            }
        } 
    }

    const assignArea = (groupDict, areaKey) => {
        for (let val in groupDict) {
            let stList = groupDict[val]; 
            if (shouldShuffle) stList.sort(() => Math.random() - 0.5); 
            
            let validSeats = (areaKey === 'custom' ? availableSeats.filter(s => isSeatInCustom(s, val, rows)) : availableSeats.filter(s => s[areaKey] === val)); 
            if (shouldShuffle) validSeats.sort(() => Math.random() - 0.5); 
            
            stList.forEach(st => { 
                let chosen = null;
                if (preserveCurrentPositions && !shouldShuffle) {
                    const key = getCleanNameForMatch(st.text);
                    const prevIdx = key ? previousIndexByName[key] : undefined;
                    if (prevIdx !== undefined) {
                        const pos = validSeats.findIndex(s => s.idx === prevIdx);
                        if (pos !== -1) chosen = validSeats.splice(pos, 1)[0];
                    }
                }
                if (!chosen && validSeats.length > 0) chosen = validSeats.pop();
                if (chosen) { 
                    classroomResult[chosen.idx] = { type: "STUDENT", text: st.text, isFixed: true, fixedType: 'area', isAbsent: st.isAbsent, memo: st.memo || "" }; 
                    availableSeats = availableSeats.filter(s => s.idx !== chosen.idx); 
                } else { 
                    studentsToPlace.normal.push(st); 
                } 
            });
        }
    };
    
    assignArea(studentsToPlace.row, 'row'); 
    assignArea(studentsToPlace.col, 'col');
    assignArea(studentsToPlace.custom, 'custom');
    
    if (shouldShuffle) { 
        studentsToPlace.normal.sort(() => Math.random() - 0.5); 
        availableSeats.sort(() => Math.random() - 0.5); 
    }
    
    studentsToPlace.normal.forEach(st => { 
        let chosen = null; 
        if (preserveCurrentPositions && !shouldShuffle) { 
            const key = getCleanNameForMatch(st.text); 
            const prevIdx = key ? previousIndexByName[key] : undefined; 
            if (prevIdx !== undefined) { 
                const pos = availableSeats.findIndex(s => s.idx === prevIdx); 
                if (pos !== -1) chosen = availableSeats.splice(pos, 1)[0]; 
            } 
        } 
        if (!chosen) chosen = availableSeats.shift(); 
        if (chosen) { 
            classroomResult[chosen.idx] = { type: "STUDENT", text: st.text, isFixed: false, fixedType: 'none', isAbsent: st.isAbsent, memo: st.memo || "" }; 
        } 
    });
    
    currentStudents = classroomResult; 
    renderClassroom(animMode);
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "seat-rules",
    name: "席の指定の読み取り",
    version: "1.0",
    required: true,
    description: "名簿の読み取りと「この席は〇〇」といった席の指定を読み取ります。"
});
