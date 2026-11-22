// ==========================================
// 座席表の表示プラグイン（必須）：座席表を画面に描きます。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
let compareOn = false;

// 比べる相手は、ひとつ前に記録された席替え。列数が今と違うと、席の位置が比べられないので使わない

function getGridRows() {
    const rowSel = $id("rowSelect");
    return rowSel ? parseInt(rowSel.value, 10) || 6 : 6;
}

function getSeatDisplayParts(text) {
    const t = String(text || "").replace(/\[休\]/g, "").replace(/<[^>]*>/g, "").replace(/\[[^\]]*\]/g, "").replace(/\{[^}]*\}/g, "").replace(/[（\(].*?[）\)]/g, "").replace(/\s+/g, " ").trim();
    const m = t.match(/^(\d+)\.(.*)$/);
    return m ? { no: m[1], name: m[2].trim() } : { no: "", name: t };
}

// 画面には出さずに、席替え1回分の結果を作る（離す設定・前と同じ席/隣は、できるだけ避ける）

let furiganaMap = {}; // { "田中太郎": "たなかたろう" }

let furiganaShow = false;

function renderClassroom(animMode = "initial") {
    // 「離す」設定の引き直し中は描画しない（ちらつき防止）。最後に一度だけ描画する。
    if (suppressSeatRender) return;
    scheduleWorkAutosave();

    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) : 6;
    
    const rowSel = $id("rowSelect");
    const rows = rowSel ? parseInt(rowSel.value, 10) : 6;
    
    const classroom = $id("classroom"); 
    if (!classroom) return;

    // 「スライド移動」用：描き直す前に、今の座席の位置を覚えておく
    let glideOld = null;
    if (animMode === "glide") {
        glideOld = new Map();
        classroom.querySelectorAll(".seat[data-seat-key]").forEach(n => {
            const k = n.dataset.seatKey;
            if (k && !glideOld.has(k)) glideOld.set(k, n.getBoundingClientRect());
        });
    }

    classroom.innerHTML = ""; 
    void classroom.offsetWidth; 
    
    if (typeof updateColumns === "function") updateColumns();
    updateSeatPickerOptions(cols, rows);
    renderSeparationList();
    
    const hasList = lastRawList && lastRawList.length > 0;
    const isBlackboard = document.body.classList.contains("blackboard-active");
    
    const btnMain = $id("btnMainShuffle");
    const btnNominate = $id("btnMainNominate");
    const btnMega = $id("btnMegaRoulette");

    if (btnMain) btnMain.style.display = (hasList && !isBlackboard) ? 'inline-block' : 'none'; 
    const btnPreview = $id("btnPreviewShuffle");
    if (btnPreview) btnPreview.style.display = (hasList && !isBlackboard && !yaochoMode) ? 'inline-block' : 'none'; 
    const btnAnnounce = $id("btnAnnounceShuffle");
    if (btnAnnounce) btnAnnounce.style.display = (hasList && !isBlackboard) ? 'inline-block' : 'none'; 
    if (btnNominate) btnNominate.style.display = (hasList && !isBlackboard) ? 'inline-block' : 'none'; 
    if (btnMega) btnMega.style.display = (hasList && !isBlackboard) ? 'inline-block' : 'none'; 
    const btnNominateMenu = $id("btnNominateMenu");
    if (btnNominateMenu) btnNominateMenu.style.display = (hasList && !isBlackboard) ? 'inline-block' : 'none';
    const btnMoreMenu = $id("btnMoreMenu");
    if (btnMoreMenu) btnMoreMenu.style.display = (hasList && !isBlackboard) ? 'inline-block' : 'none';
    
    updateUndoButton(); 
    updateCompareButton();
    updateSeatCheckButton();
    updateNominationProgress();

    if (currentStudents.length === 0 || !hasList) { 
        classroom.innerHTML = buildWelcomeCardHtml();
        return; 
    }
    
    const isNumberOnly = isNumberOnlyMode();
    if (isNumberOnly !== lastNumberOnlyState) { lastNumberOnlyState = isNumberOnly; applyAccessibilitySettings(); }
    
    let delayCounter = 0; 
    const delayMap = new Array(currentStudents.length).fill(0); 
    for (let c = cols - 1; c >= 0; c--) { 
        for (let r = 0; r < rows; r++) { 
            const index = r * cols + c; 
            if (index < currentStudents.length) { 
                delayMap[index] = delayCounter; 
                delayCounter++; 
            } 
        } 
    }
    
    let randomDelayMap = Array.from({length: currentStudents.length}, (_, i) => i); 
    for (let i = randomDelayMap.length - 1; i > 0; i--) { 
        const j = Math.floor(Math.random() * (i + 1)); 
        [randomDelayMap[i], randomDelayMap[j]] = [randomDelayMap[j], randomDelayMap[i]]; 
    }
    
    let cx = (cols - 1) / 2, cy = (rows - 1) / 2, maxDist = 0; 
    for (let i = 0; i < currentStudents.length; i++) { 
        let rr = Math.floor(i / cols), cc = i % cols; 
        let d = Math.max(Math.abs(rr - cy), Math.abs(cc - cx)); 
        if (d > maxDist) maxDist = d; 
    }
    
    const colorToggle = $id("groupColorToggle");
    const showGroupColor = colorToggle ? colorToggle.checked : false;
    
    const typeSelect = $id("groupTypeSelect");
    const groupType = typeSelect ? typeSelect.value : "column";

    currentStudents.forEach((seatData, index) => {
        const el = document.createElement("div"); 
        el.className = "seat"; 
        const currentLabel = getSeatLabel(index, cols); 
        let r = Math.floor(index / cols), c = index % cols;
        el.style.gridRow = `${r + 1} / span 1`;
        el.style.gridColumn = `${c + 1} / span 1`;
        
        el.dataset.seatIndex = index;
        
        el.draggable = true;
        el.ondragstart = function(e) { 
            if (document.body.classList.contains("nomination-active") || document.body.classList.contains("blackboard-active")) { 
                e.preventDefault(); 
                return; 
            } 
            e.dataTransfer.effectAllowed = "move"; 
            e.dataTransfer.setData("text/plain", index); 
            el.classList.add("dragging"); 
        };
        el.ondragover = function(e) { 
            e.preventDefault(); 
            e.dataTransfer.dropEffect = "move"; 
            el.classList.add("drag-over"); 
        };
        el.ondragleave = function(e) { 
            el.classList.remove("drag-over"); 
        };
        el.ondrop = function(e) { 
            e.preventDefault(); 
            el.classList.remove("drag-over"); 
            const fromIndex = parseInt(e.dataTransfer.getData("text/plain"), 10); 
            if (!isNaN(fromIndex) && fromIndex !== index) { 
                saveSeatHistory(); 
                swapSeats(fromIndex, index, cols); 
            } 
        };
        el.ondragend = function(e) { 
            el.classList.remove("dragging"); 
            document.querySelectorAll('.seat').forEach(s => s.classList.remove('drag-over')); 
        };
        setupSeatTouchDrag(el, index, cols);
        el.onclick = function(ev) { 
            if (el.dataset.justDragged === "true") { el.dataset.justDragged = ""; return; }
            if (ev.shiftKey) return; 
            if (document.body.classList.contains("blackboard-active")) return; 
            if (groupColorModeActive) { applyGroupColorToSeat(currentLabel); return; }
            handleSeatClick(currentLabel); 
        };
        
        if (isNumberOnly) el.classList.add("number-only-huge");
        
        if (showGroupColor && seatData && seatData.type === "STUDENT" && seatData.text !== "") {
            let groupNumber = 0;
            if (groupType === "manual") {
                groupNumber = manualGroupMap[currentLabel] || 0; 
            } else {
                groupNumber = computeGroupNumber(groupType, r, c, cols, Math.max(1, Math.ceil(currentStudents.length / cols)));
            }
            if (groupNumber > 0) {
                const shownGroup = ((groupNumber - 1) % seatGroupCount) + 1;
                el.classList.add(`group-${shownGroup}`);
                el.dataset.groupNo = String(shownGroup);
            }
        }

        if (seatData && seatData.text && nominatedHistoryList.includes(seatData.text)) {
            el.classList.add("is-already-nominated");
        }
        
        if (!seatData) { 
            classroom.appendChild(el); 
            return; 
        }
        if (seatData.type === "EMPTY_SPACE") { 
            el.style.visibility = "hidden"; 
            classroom.appendChild(el); 
            return; 
        }
        
        const posSpan = document.createElement("span"); 
        posSpan.classList.add("seat-position"); 
        posSpan.textContent = currentLabel; 
        posSpan.onclick = function(ev) { 
            if (ev.shiftKey) { 
                ev.stopPropagation(); 
                if (document.body.classList.contains("nomination-active")) {
                    toggleNominationExclusion(currentLabel);
                } else {
                    openSecretModal(currentLabel); 
                }
            } 
        }; 
        el.appendChild(posSpan);
        
        if (seatData.type === "MANUAL_EMPTY") { 
            el.classList.add("is-empty-target"); 
            const crossSpan = document.createElement("span"); 
            crossSpan.classList.add("seat-name"); 
            crossSpan.textContent = "✕ 空席"; 
            el.appendChild(crossSpan); 
            classroom.appendChild(el); 
            return; 
        }
        
        if (!seatData.text) { 
            classroom.appendChild(el); 
            return; 
        }
        el.dataset.seatKey = getCleanStudentKey(seatData.text);
        if (seatData.isAbsent) {
            el.classList.add("is-absent");
        }
        if (seatData.isFixed || seatData.fixedType === 'area') {
            el.classList.add("is-fixed");
        }
        if (seatData.memo) {
            const memoIcon = document.createElement("span");
            memoIcon.className = "seat-memo-icon";
            memoIcon.textContent = "メモ";
            memoIcon.title = seatData.memo;
            el.appendChild(memoIcon);
        }
        
        let cleanNameText = seatData.text.replace(/\[休\]/g, "").replace(/\[行\d+\]/g, "").replace(/\[列[A-Za-z]\]/gi, "").replace(/\[範囲[A-Za-z]\d+-[A-Za-z]\d+\]/g, "").replace(/\[自由(?:行列|席):[^\]]*\]/g, "").replace(/[（\(].*?[）\)]/g, "").trim();
        let noText = "", nameText = cleanNameText; 
        if (cleanNameText.includes(".")) { 
            const parts = cleanNameText.split("."); 
            noText = parts[0].trim() + "番"; 
            nameText = parts[1] ? parts[1].trim() : ""; 
        }
        
        const noSpan = document.createElement("span"); 
        noSpan.className = isNumberOnly ? "seat-name" : "seat-no"; 
        noSpan.textContent = isNumberOnly ? (noText || "番号なし") : noText; 
        el.appendChild(noSpan);
        
        if (!isNumberOnly) { 
            const furi = getFuriganaFor(seatData.text);
            if (furi) {
                const furiSpan = document.createElement("span");
                furiSpan.className = "seat-furi";
                furiSpan.textContent = furi;
                el.appendChild(furiSpan);
            }
            const nameSpan = document.createElement("span"); 
            nameSpan.classList.add("seat-name"); 
            nameSpan.textContent = nameText; 
            el.appendChild(nameSpan); 
        }
        classroom.appendChild(el);
    });
    fitNumberOnlyFont();

    // わがまま（行・列）指定がある行・列の座席全体を、外側からオレンジの線で囲む。
    // 個々の座席の「固定済み」枠とは別に、行・列そのものが指定されていることを示す。
    const wagamamaRows = new Set();
    const wagamamaCols = new Set();
    lastRawList.forEach(s => {
        const rowMatch = s.match(/\[行(\d+)\]/);
        if (rowMatch) wagamamaRows.add(rowMatch[1]);
        const colMatch = s.match(/\[列([A-Za-z])\]/i);
        if (colMatch) wagamamaCols.add(colMatch[1].toUpperCase());
    });
    // カスタム指定も同じオレンジの線で囲む。
    // カスタム指定は、となり合う席をひとつながりにして、席の形に沿った1本の線で囲む。
    const customArea = new Set();   // 行・列・優先席で指定された場所（"行,列" の位置）
    const customSeat = new Set();   // 個別に選んだ席
    lastRawList.forEach(s => {
        const customMatch = s.match(/\[自由(行列|席):([^\]]*)\]/);
        if (customMatch) {
            const area = parseCustomArea((customMatch[1] === "席" ? "席:" : "") + customMatch[2]);
            const addRows = (from, to) => { for (let r = from; r <= to; r++) for (let c = 1; c <= cols; c++) customArea.add(`${r},${c}`); };
            if (area.front > 0) addRows(1, Math.min(area.front, rows));
            if (area.back > 0) addRows(Math.max(1, rows - area.back + 1), rows);
            area.rows.forEach(r => { if (/^\d+$/.test(r)) { const n = parseInt(r, 10); if (n >= 1 && n <= rows) addRows(n, n); } });
            area.cols.forEach(l => {
                if (!/^[A-Z]$/.test(l)) return;
                const g = cols - (l.charCodeAt(0) - 65);
                if (g >= 1 && g <= cols) for (let r = 1; r <= rows; r++) customArea.add(`${r},${g}`);
            });
            area.seats.forEach(label => {
                const idx = getIndexFromLabel(label, cols);
                if (idx !== null && idx < rows * cols) customSeat.add(`${Math.floor(idx / cols) + 1},${(idx % cols) + 1}`);
            });
        }
    });
    wagamamaRows.forEach(rowNum => {
        if (parseInt(rowNum, 10) < 1 || parseInt(rowNum, 10) > rows) return;
        const zone = document.createElement("div");
        zone.className = "wagamama-zone-outline";
        zone.style.gridRow = `${rowNum} / span 1`;
        zone.style.gridColumn = `1 / -1`;
        classroom.appendChild(zone);
    });
    wagamamaCols.forEach(colLetter => {
        const gridCol = cols - (colLetter.charCodeAt(0) - 65);
        if (gridCol < 1 || gridCol > cols) return;
        const zone = document.createElement("div");
        zone.className = "wagamama-zone-outline";
        zone.style.gridColumn = `${gridCol} / span 1`;
        zone.style.gridRow = `1 / -1`;
        classroom.appendChild(zone);
    });
    classroom._wgData = { area: Array.from(customArea), seat: Array.from(customSeat), rows: rows, cols: cols };
  
    applyCompareBadges(); // 「前回と比べる」がONなら、各席に印を付ける
    if (typeof fitClassroomToScreen === "function") fitClassroomToScreen(); // 名前の長さに合わせて、座席の横幅を整える
    wagamamaDrawCustomFrames();
    if (!classroom._wgObserver && typeof ResizeObserver !== "undefined") {   // 座席の大きさが変わったら、囲み線も描き直す
        classroom._wgObserver = new ResizeObserver(() => {
            if (classroom._wgRaf) return;
            classroom._wgRaf = requestAnimationFrame(() => { classroom._wgRaf = 0; wagamamaDrawCustomFrames(); });
        });
        classroom._wgObserver.observe(classroom);
    }
    if (typeof SekigaeApp !== "undefined") SekigaeApp._run("afterRender"); // プラグインの後処理（付箋メモなど）

    setTimeout(() => {
        requestAnimationFrame(() => {
            const seatNodes = classroom.querySelectorAll('.seat');
            // 「ディール」「花火」は、座席の画面上の位置が必要なので、先にまとめて測っておく
            let fxRects = [], fxDeck = { x: 0, y: 0, bottom: 0 }, fxMid = { x: 0, y: 0 };
            if (animMode === "deal" || animMode === "firework" || animMode === "glide" || animMode === "warp") {
                const cr = classroom.getBoundingClientRect();
                fxMid = { x: cr.left + cr.width / 2, y: cr.top + cr.height / 2 };
                fxRects = Array.from(seatNodes).map(n => n.getBoundingClientRect());
                fxDeck = { x: cr.left + cr.width / 2, y: cr.top - 30, bottom: cr.bottom };
            }
            seatNodes.forEach((el, index) => {
                let r = Math.floor(index / cols), c = index % cols;
                if (!document.body.classList.contains("no-animation")) {
                    let delay = 0;
                    if (animMode === "fade") { 
                        el.classList.add("anim-fade"); 
                        delay = delayMap[index] * 0.045; 
                    } else if (animMode === "wave") { 
                        el.classList.add("anim-wave"); 
                        let colReverseIndex = cols - 1 - c; 
                        delay = colReverseIndex * 0.085 + r * 0.035; 
                    } else if (animMode === "initial") { 
                        el.classList.add("anim-active"); 
                        delay = index * 0.01; 
                    } else if (animMode === "pop") { 
                        el.classList.add("anim-pop"); 
                        el.style.setProperty('--pp-r', `${(Math.random() < 0.5 ? -1 : 1) * (8 + Math.random() * 12)}deg`); 
                        delay = randomDelayMap[index] * 0.035; 
                    } else if (animMode === "typhoon") { 
                        el.classList.add("anim-typhoon"); 
                        let d = Math.max(Math.abs(r - cy), Math.abs(c - cx)); 
                        // 外側から渦を巻いて中へ。リングごとに回る向きを変える
                        el.style.setProperty('--ty-x', `${(c - cx) * 110}px`); 
                        el.style.setProperty('--ty-y', `${(r - cy) * 110}px`); 
                        el.style.setProperty('--ty-r', `${(Math.round(d) % 2 === 0 ? 1 : -1) * 330}deg`); 
                        delay = (maxDist - d) * 0.14 + Math.random() * 0.08; 
                    } else if (animMode === "laser") { 
                        el.classList.add("anim-laser"); 
                        delay = c * 0.15; 
                    } else if (animMode === "meteor") { 
                        el.classList.add("anim-meteor"); 
                        delay = (r + (cols - 1 - c)) * 0.06; 
                    } else if (animMode === "bigbang") { 
                        el.classList.add("anim-bigbang"); 
                        el.style.setProperty('--bb-x', `${(c - cx) * 70}px`); 
                        el.style.setProperty('--bb-y', `${(r - cy) * 70}px`); 
                        delay = Math.sqrt(Math.pow(c - cx, 2) + Math.pow(r - cy, 2)) * 0.14; 
                    } else if (animMode === "hurricane") { 
                        el.classList.add("anim-hurricane"); 
                        let dist = Math.max(Math.abs(r - cy), Math.abs(c - cx)); 
                        let angle = Math.atan2(r - cy, c - cx) + Math.PI; 
                        delay = (maxDist - dist) * 0.22 + (angle / (Math.PI * 2)) * 0.35; 
                    } else if (animMode === "roulette") { 
                        el.classList.add("anim-roulette"); 
                        delay = randomDelayMap[index] * 0.045; 
                    } else if (animMode === "flip") { 
                        el.classList.add("anim-flip"); 
                        delay = (r * cols + c) * 0.035; 
                    } else if (animMode === "skydive") { 
                        el.classList.add("anim-skydive"); 
                        delay = randomDelayMap[index] * 0.045; 
                    } else if (animMode === "galaxy") { 
                        el.classList.add("anim-galaxy"); 
                        let angle = Math.atan2(r - cy, c - cx); 
                        el.style.setProperty('--gal-x', `${Math.cos(angle) * 160}px`); 
                        el.style.setProperty('--gal-y', `${Math.sin(angle) * 160}px`); 
                        el.style.setProperty('--gal-rot', `${angle * (180 / Math.PI) - 360}deg`); 
                        delay = Math.sqrt(Math.pow(c - cx, 2) + Math.pow(r - cy, 2)) * 0.15; 
                    } else if (animMode === "thunder") { 
                        el.classList.add("anim-thunder"); 
                        delay = randomDelayMap[index] * 0.05; 
                    } else if (animMode === "leaf") { 
                        el.classList.add("anim-leaf"); 
                        let swing = (c % 2 === 0) ? -60 : 60; 
                        el.style.setProperty('--lf-x', `${swing}px`); 
                        el.style.setProperty('--lf-x2', `${-swing * 0.6}px`); 
                        el.style.setProperty('--lf-x3', `${swing * 0.2}px`); 
                        delay = (rows - 1 - r) * 0.12 + c * 0.05; 
                    } else if (animMode === "deal") { 
                        // 教卓（座席表の上の中央）から、カードを1枚ずつ配るように飛んでくる
                        el.classList.add("anim-deal"); 
                        const rc = fxRects[index];
                        const z = currentZoomLevel || 1;
                        el.style.setProperty('--dl-x', `${(fxDeck.x - (rc.left + rc.width / 2)) / z}px`); 
                        el.style.setProperty('--dl-y', `${(fxDeck.y - (rc.top + rc.height / 2)) / z}px`); 
                        el.style.setProperty('--dl-r', `${(Math.random() < 0.5 ? -1 : 1) * (200 + Math.random() * 160)}deg`); 
                        delay = (r * cols + c) * 0.055; 
                    } else if (animMode === "firework") { 
                        // 下から打ち上がって、ドーン！と開く
                        el.classList.add("anim-firework"); 
                        const rc = fxRects[index];
                        const z = currentZoomLevel || 1;
                        el.style.setProperty('--fw-y', `${Math.max(120, (fxDeck.bottom - rc.top) + 40) / z}px`); 
                        el.style.setProperty('--fw-x', `${(fxDeck.x - (rc.left + rc.width / 2)) * 0.25 / z}px`); 
                        delay = randomDelayMap[index] * 0.055; 
                    } else if (animMode === "domino") { 
                        // 1行ごとに、ジグザグの順で、ドミノのようにパタパタと立ち上がる
                        el.classList.add("anim-domino"); 
                        const order = (r % 2 === 0) ? c : (cols - 1 - c); 
                        delay = (r * cols + order) * 0.045; 
                    } else if (animMode === "glide") { 
                        // 名前が、前の席から新しい席へ、すーっと滑って移動する
                        const key = el.dataset.seatKey;
                        const oldRc = glideOld && key ? glideOld.get(key) : null;
                        const nowRc = fxRects[index];
                        const z = currentZoomLevel || 1;
                        const dx = oldRc ? (oldRc.left + oldRc.width / 2 - (nowRc.left + nowRc.width / 2)) / z : 0;
                        const dy = oldRc ? (oldRc.top + oldRc.height / 2 - (nowRc.top + nowRc.height / 2)) / z : 0;
                        if (!oldRc || Math.hypot(dx, dy) < 2) { 
                            el.classList.add("anim-none"); 
                        } else { 
                            el.classList.add("anim-glide"); 
                            el.style.setProperty('--gl-x', `${dx}px`); 
                            el.style.setProperty('--gl-y', `${dy}px`); 
                            el.style.setProperty('--gl-r', `${Math.max(-6, Math.min(6, dx / 40))}deg`); 
                            delay = Math.min(index * 0.012, 0.5); 
                        }
                    } else if (animMode === "spiral") { 
                        // 中心から外へ、うずまき状に順番に現れる
                        el.classList.add("anim-spiral"); 
                        const dist = Math.hypot(c - cx, r - cy); 
                        const ang = (Math.atan2(r - cy, c - cx) + Math.PI * 2) % (Math.PI * 2); 
                        el.style.setProperty('--sp-r', `${(ang < Math.PI ? -1 : 1) * 200}deg`); 
                        delay = dist * 0.12 + (ang / (Math.PI * 2)) * 0.45; 
                    } else if (animMode === "bubble") { 
                        // 下からふわふわ浮かんで、ぽんっと弾ける
                        el.classList.add("anim-bubble"); 
                        el.style.setProperty('--bu-x', `${(Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 22)}px`); 
                        el.style.setProperty('--bu-y', `${90 + Math.random() * 90}px`); 
                        delay = randomDelayMap[index] * 0.05 + Math.random() * 0.1; 
                    } else if (animMode === "bounce") {
                        // 上から落ちて、ボールのように何度かはずむ
                        el.classList.add("anim-bounce");
                        el.style.setProperty('--bn-y', `${-(230 + Math.random() * 120)}px`);
                        delay = randomDelayMap[index] * 0.05;
                    } else if (animMode === "pendulum") {
                        // 上の辺からぶら下がって、振り子のように揺れて止まる
                        el.classList.add("anim-pendulum");
                        el.style.setProperty('--pd-r', `${(c % 2 === 0 ? 1 : -1) * (62 + Math.random() * 18)}deg`);
                        delay = c * 0.1 + r * 0.04;
                    } else if (animMode === "coin") {
                        // コインのようにくるくる回って、ぴたっと止まる
                        el.classList.add("anim-coin");
                        delay = randomDelayMap[index] * 0.05;
                    } else if (animMode === "curtain") {
                        // 中央の列から左右へ、カーテンが開くように現れる
                        el.classList.add("anim-curtain");
                        delay = Math.abs(c - cx) * 0.16 + r * 0.03;
                    } else if (animMode === "scan") {
                        // 前の行から後ろの行へ、スキャナーのように上から下へ現れる
                        el.classList.add("anim-scan");
                        delay = r * 0.22 + (c / Math.max(1, cols)) * 0.12;
                    } else if (animMode === "ice") {
                        // 凍った名前が、ぷるぷるっと震えて、とけて現れる
                        el.classList.add("anim-ice");
                        delay = randomDelayMap[index] * 0.05;
                    } else if (animMode === "rainbow") {
                        // 斜めに、虹色に光りながら順番に現れる
                        el.classList.add("anim-rainbow");
                        el.style.setProperty('--rb-h', `${((r + c) * 47) % 360}deg`);
                        delay = (r + c) * 0.09;
                    } else if (animMode === "stamp") {
                        // 大きなスタンプが、ぽんっと押されるように、1席ずつ現れる
                        el.classList.add("anim-stamp");
                        delay = randomDelayMap[index] * 0.05;
                    } else if (animMode === "glitch") {
                        // 画面が乱れるように、ちらついてから、元の姿に戻る
                        el.classList.add("anim-glitch");
                        el.style.setProperty('--gc-x', `${(Math.random() < 0.5 ? -1 : 1) * (5 + Math.random() * 8)}px`);
                        delay = randomDelayMap[index] * 0.04;
                    } else if (animMode === "stardust") {
                        // 小さな光が、くるくる回りながら大きくなって、きらっと現れる
                        el.classList.add("anim-stardust");
                        el.style.setProperty('--sd-r', `${(Math.random() < 0.5 ? -1 : 1) * (140 + Math.random() * 80)}deg`);
                        delay = randomDelayMap[index] * 0.05;
                    } else if (animMode === "jelly") {
                        // 後ろの行から前の行へ、ゼリーのようにぷるんと揺れて現れる
                        el.classList.add("anim-jelly");
                        delay = (rows - 1 - r) * 0.14 + c * 0.03;
                    } else if (animMode === "gacha") {
                        // 席がカプセルになって転がり出て、ぱかっと開いて名前が現れる。あとに開く席ほど、レアが出にくい
                        el.classList.add("anim-gacha");
                        const gcColors = ["#f87171", "#60a5fa", "#34d399", "#fbbf24", "#a78bfa", "#f472b6"];
                        el.style.setProperty('--gc-c', gcColors[(index * 5 + r) % gcColors.length]);
                        const luck = 1 - randomDelayMap[index] / Math.max(1, seatNodes.length);
                        const roll = Math.random();
                        if (roll < 0.05 * luck + 0.005) el.classList.add("gc-r2");
                        else if (roll < 0.28 * luck + 0.03) el.classList.add("gc-r1");
                        delay = randomDelayMap[index] * 0.05;
                    } else if (animMode === "warp") {
                        // 中央の1点から、ワープしてきたように、外へ飛び出して席に着く
                        el.classList.add("anim-warp");
                        const nowRc = fxRects[index];
                        const z = currentZoomLevel || 1;
                        el.style.setProperty('--wp-x', `${(fxMid.x - (nowRc.left + nowRc.width / 2)) / z}px`);
                        el.style.setProperty('--wp-y', `${(fxMid.y - (nowRc.top + nowRc.height / 2)) / z}px`);
                        delay = Math.hypot(c - cx, r - cy) * 0.09;
                    } else if (animMode === "impact") {
                        el.classList.add("anim-impact");
                        delay = Math.hypot(c - cx, r - cy) * 0.035; 
                    } else if (animMode === "slotlock") { 
                        if (slotLockCols.has(c)) el.classList.add("anim-slotlock"); 
                        else el.classList.add("anim-none"); 
                    } else { 
                        el.classList.add("anim-none"); 
                    }
                    el.style.animationDelay = `${Math.max(0, delay)}s`;
                } else {
                    el.classList.add("anim-none");
                }
            });
            // 人数が多くても、演出全体が最長5秒で終わるように、始まるタイミングを詰める
            capSeatAnimationTime(seatNodes);
            if (animMode !== "none") cleanSeatAnimationEffects();
        });
    }, 20);
}

// カスタム指定の囲み線：指定された席の外周を、席の形に沿った1本の線でたどって描く。
function wagamamaDrawCustomFrames() {
    const classroom = $id("classroom");
    if (!classroom) return;
    classroom.querySelectorAll(".wagamama-custom-svg").forEach(e => e.remove());
    const d = classroom._wgData;
    if (!d || (!d.area.length && !d.seat.length)) return;
    const seats = classroom.querySelectorAll(":scope > .seat");
    if (seats.length < d.rows * d.cols) return;
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("class", "wagamama-custom-svg");
    svg.style.cssText = "grid-column: 1 / -1; grid-row: 1 / -1; width: 100%; height: 100%; position: relative; z-index: 5; overflow: visible; pointer-events: none; margin: 0;";
    classroom.appendChild(svg);
    const ox = seats[0].offsetLeft, oy = seats[0].offsetTop;   // 線を描く場所の左上は、いちばん左上の席と同じ
    const rect = (r, c) => {
        const el = seats[(r - 1) * d.cols + (c - 1)];
        const L = el.offsetLeft - ox, T = el.offsetTop - oy;
        return { L: L, T: T, R: L + el.offsetWidth, B: T + el.offsetHeight };
    };
    const areaSet = new Set(d.area), all = new Set(d.area.concat(d.seat));
    const has = (r, c) => all.has(`${r},${c}`);
    // 外周の辺を、時計回りに集める（格子の線の番号で表す）
    const edges = [], byStart = new Map();
    const push = (x, y, dx, dy, cell) => {
        const e = { x: x, y: y, dx: dx, dy: dy, cell: cell, used: false };
        edges.push(e);
        const k = `${x},${y}`;
        if (!byStart.has(k)) byStart.set(k, []);
        byStart.get(k).push(e);
    };
    all.forEach(key => {
        const [r, c] = key.split(",").map(Number);
        if (!has(r - 1, c)) push(c - 1, r - 1, 1, 0, key);
        if (!has(r, c + 1)) push(c, r - 1, 0, 1, key);
        if (!has(r + 1, c)) push(c, r, -1, 0, key);
        if (!has(r, c - 1)) push(c - 1, r, 0, -1, key);
    });
    const loops = [];
    edges.forEach(e0 => {
        if (e0.used) return;
        const loop = [];
        let cur = e0;
        while (cur && !cur.used) {
            cur.used = true;
            loop.push(cur);
            const cands = (byStart.get(`${cur.x + cur.dx},${cur.y + cur.dy}`) || []).filter(e => !e.used);
            // 斜めに接する席は、つなげずに別々の線にする（右に曲がるものを先に選ぶ）
            cur = cands.find(e => e.dx === -cur.dy && e.dy === cur.dx) || cands.find(e => e.dx === cur.dx && e.dy === cur.dy) || cands[0];
        }
        loops.push(loop);
    });
    loops.forEach(loop => {
        const solid = loop.some(e => areaSet.has(e.cell));
        const e = solid ? 6.5 : 2.5, R = solid ? 18 : 14;
        // 同じ向きに続く辺は、ひとつにまとめる
        const segs = [];
        loop.forEach(ed => {
            const last = segs[segs.length - 1];
            if (last && last.dx === ed.dx && last.dy === ed.dy) return;
            segs.push(ed);
        });
        if (segs.length > 1 && segs[0].dx === segs[segs.length - 1].dx && segs[0].dy === segs[segs.length - 1].dy) segs.pop();
        const coord = sg => {
            const [r, c] = sg.cell.split(",").map(Number), q = rect(r, c);
            if (sg.dy === 0) return sg.dx > 0 ? q.T - e : q.B + e;   // 横の辺：上か下
            return sg.dy > 0 ? q.R + e : q.L - e;                     // 縦の辺：右か左
        };
        const pts = segs.map((sg, i) => {
            const prev = segs[(i + segs.length - 1) % segs.length];
            return sg.dy === 0 ? { x: coord(prev), y: coord(sg) } : { x: coord(sg), y: coord(prev) };
        });
        const n = pts.length;
        if (n < 4) return;
        let dstr = "";
        pts.forEach((p, i) => {
            const a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
            const la = Math.hypot(a.x - p.x, a.y - p.y), lb = Math.hypot(b.x - p.x, b.y - p.y);
            const rr = Math.max(0, Math.min(R, la / 2, lb / 2));
            const p1 = { x: p.x + (a.x - p.x) / (la || 1) * rr, y: p.y + (a.y - p.y) / (la || 1) * rr };
            const p2 = { x: p.x + (b.x - p.x) / (lb || 1) * rr, y: p.y + (b.y - p.y) / (lb || 1) * rr };
            dstr += `${i === 0 ? "M" : "L"}${p1.x.toFixed(1)},${p1.y.toFixed(1)} Q${p.x.toFixed(1)},${p.y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)} `;
        });
        const path = document.createElementNS(NS, "path");
        path.setAttribute("d", dstr + "Z");
        path.setAttribute("fill", "none");
        path.style.stroke = "var(--wagamama-color, #f97316)";
        path.setAttribute("stroke-width", "3");
        path.setAttribute("stroke-linejoin", "round");
        if (!solid) path.setAttribute("stroke-dasharray", "8 5");
        svg.appendChild(path);
    });
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "seat-render",
    name: "座席表の表示",
    version: "1.3",
    required: true,
    description: "座席表を画面に描きます。"
});
