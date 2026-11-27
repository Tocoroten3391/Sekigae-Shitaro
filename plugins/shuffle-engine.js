// ==========================================
// 席替えの条件と抽選プラグイン（必須）：離す・近くに置く、前と同じ席の回避、席の抽選、八百長モードの確定です。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
function loadSeparationPairs() {
    try { separationPairs = JSON.parse(localStorage.getItem("separation_pairs") || "[]"); } catch (error) { separationPairs = []; }
    if (!Array.isArray(separationPairs)) separationPairs = [];
}

function saveSeparationPairs() {
    localStorage.setItem("separation_pairs", JSON.stringify(separationPairs));
}

// 座席インデックス同士が「隣」かどうか。上下左右と斜めを隣とみなす。

function areSeatsAdjacent(idxA, idxB, cols) {
    const rA = Math.floor(idxA / cols), cA = idxA % cols;
    const rB = Math.floor(idxB / cols), cB = idxB % cols;
    return Math.abs(rA - rB) <= 1 && Math.abs(cA - cB) <= 1 && !(rA === rB && cA === cB);
}

// 今の配置が「離す」設定を何組破っているかを数える。
// 隣同士だけでなく、班の色分けが有効なら同じ班に入っている場合も違反とみなす。

function countSeparationViolations(seats, ctx) {
    if (separationPairs.length === 0) return 0;

    const colSel = $id("columnSelect");
    const cols = ctx ? ctx.cols : (colSel ? parseInt(colSel.value, 10) : 6);

    const indexByName = {};
    seats.forEach((seat, idx) => {
        if (seat && seat.type === "STUDENT" && seat.text) {
            const key = getCleanStudentKey(seat.text);
            if (key) indexByName[key] = idx;
        }
    });

    const colorTog = ctx ? null : $id("groupColorToggle");
    const useGroups = ctx ? ctx.useGroups : (colorTog ? colorTog.checked : false);

    let violations = 0;
    separationPairs.forEach(pair => {
        const idxA = indexByName[pair.a];
        const idxB = indexByName[pair.b];
        if (idxA === undefined || idxB === undefined) return;
        if (areSeatsAdjacent(idxA, idxB, cols)) { violations++; return; }
        if (useGroups && getGroupNumberForIndex(idxA, cols) > 0 && getGroupNumberForIndex(idxA, cols) === getGroupNumberForIndex(idxB, cols)) violations++;
    });
    return violations;
}

// ==========================================
// 「近くに置く」設定：この2人を、隣同士（斜めを含む）になるようにする
// ==========================================

function loadNearPairs() {
    try { nearPairs = JSON.parse(localStorage.getItem("near_pairs") || "[]"); } catch (error) { nearPairs = []; }
    if (!Array.isArray(nearPairs)) nearPairs = [];
}

function saveNearPairs() {
    try { localStorage.setItem("near_pairs", JSON.stringify(nearPairs)); } catch (error) { /* 何もしない */ }
}

function addNearPair() {
    const selA = $id("nearSelectA"), selB = $id("nearSelectB");
    if (!selA || !selB) return;
    const a = selA.value, b = selB.value;
    if (!a || !b) { showToast("2人とも選んでください。", "error"); return; }
    if (a === b) { showToast("同じ人同士は指定できません。", "error"); return; }
    const same = p => (p.a === a && p.b === b) || (p.a === b && p.b === a);
    if (nearPairs.some(same)) { showToast("その組み合わせはすでに登録されています。", "error"); return; }
    if (separationPairs.some(same)) { showToast("その2人は「離す設定」に入っています。先に解除してください。", "error"); return; }
    nearPairs.push({ a: a, b: b });
    saveNearPairs();
    renderNearList();
    showToast(`${a} と ${b} を近くに置く設定にしました。`, "success");
}

function removeNearPair(index) {
    nearPairs.splice(index, 1);
    saveNearPairs();
    renderNearList();
    showToast("近くに置く設定を解除しました。", "success");
}

function renderNearList() {
    const selA = $id("nearSelectA"), selB = $id("nearSelectB");
    const names = [...new Set(lastRawList.map(x => getCleanStudentKey(x)).filter(x => x))];
    [selA, selB].forEach(sel => {
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = '<option value="">-- 生徒を選ぶ --</option>' + names.map(n => `<option value="${escapeStatsHtml(n)}">${escapeStatsHtml(n)}</option>`).join("");
        if (names.includes(prev)) sel.value = prev;
    });
    const body = $id("nearListBody");
    if (!body) return;
    if (nearPairs.length === 0) {
        body.innerHTML = '<p style="color: var(--text-sub); font-size: 12px; padding: 6px 0;">まだ設定されていません。</p>';
        return;
    }
    body.innerHTML = nearPairs.map((p, i) => `
        <div class="history-row">
            <span>${escapeStatsHtml(p.a)} ↔ ${escapeStatsHtml(p.b)}</span>
            <button onclick="removeNearPair(${i})" class="btn-delete-mini btn-rounded-box btn-compact" style="width: auto; padding: 5px 12px; font-size: 12px; margin: 0;">🔓 解除</button>
        </div>
    `).join("");
}

// 「近くに置く」2人が、隣り合えていない組の数と、離れ具合（隣まであと何席ぶんか）を数える。
// forScore が true の時は、2人とも席を動かせない（席の指定やエリア指定がある）組は、数えない（良くしようがないため）。

function countNearViolations(seats, ctx, forScore) {
    if (nearPairs.length === 0) return { unmet: 0, dist: 0 };
    const cols = ctx.cols;
    const indexByName = {};
    seats.forEach((seat, idx) => {
        if (seat && seat.type === "STUDENT" && seat.text) {
            const key = getCleanStudentKey(seat.text);
            if (key) indexByName[key] = idx;
        }
    });
    let unmet = 0, dist = 0;
    nearPairs.forEach(pair => {
        const a = indexByName[pair.a], b = indexByName[pair.b];
        if (a === undefined || b === undefined) return;
        if (forScore && seats[a].fixedType !== "none" && seats[b].fixedType !== "none") return;
        const d = Math.max(Math.abs(Math.floor(a / cols) - Math.floor(b / cols)), Math.abs((a % cols) - (b % cols)));
        if (d > 1) { unmet++; dist += d - 1; }
    });
    return { unmet: unmet, dist: dist };
}

// ==========================================
// 席替えの履歴を使った「前と同じ席・前と同じ隣」の回避
// ==========================================

const SEAT_LAYOUT_KEEP = 5; // 覚えておく席替えの回数（最大）

let seatLayoutLog = []; // 新しい順: [{ at, cols, pos: { "田中": 7 } }]

function loadSeatLayoutLog() {
    try {
        const list = JSON.parse(localStorage.getItem("seat_layout_log") || "[]");
        seatLayoutLog = Array.isArray(list) ? list.filter(l => l && l.pos && l.cols).slice(0, SEAT_LAYOUT_KEEP) : [];
    } catch (error) { seatLayoutLog = []; }
}

// 席替えが終わるたびに、「誰がどの席に座ったか」を覚えておく

function recordSeatLayout() {
    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) || 6 : 6;
    const pos = {};
    (currentStudents || []).forEach((seat, idx) => {
        if (!seat || seat.type !== "STUDENT" || !seat.text) return;
        const key = getCleanStudentKey(seat.text);
        if (key && !(key in pos)) pos[key] = idx;
    });
    if (Object.keys(pos).length === 0) return;
    seatLayoutLog.unshift({ at: Date.now(), cols: cols, pos: pos });
    seatLayoutLog = seatLayoutLog.slice(0, SEAT_LAYOUT_KEEP);
    try { localStorage.setItem("seat_layout_log", JSON.stringify(seatLayoutLog)); } catch (error) { /* 保存できなくても、席替え自体は続ける */ }
    updateAvoidInfo();
}

function clearSeatLayoutLog(showMessage) {
    seatLayoutLog = [];
    try { localStorage.removeItem("seat_layout_log"); } catch (error) { /* 何もしない */ }
    updateAvoidInfo();
    if (showMessage) showToast("席替えの履歴を消しました。", "success");
}


function getAvoidSettings() {
    const same = $id("avoidSameSeatToggle"), side = $id("avoidNeighborToggle"), depth = $id("avoidDepthSelect");
    return {
        sameSeat: !!(same && same.checked),
        neighbor: !!(side && side.checked),
        depth: Math.min(SEAT_LAYOUT_KEEP, Math.max(1, depth ? parseInt(depth.value, 10) || 2 : 2))
    };
}

function saveAvoidSettings() {
    const st = getAvoidSettings();
    try {
        localStorage.setItem("avoid_same_seat", String(st.sameSeat));
        localStorage.setItem("avoid_neighbor", String(st.neighbor));
        localStorage.setItem("avoid_depth", String(st.depth));
    } catch (error) { /* 何もしない */ }
    updateAvoidInfo();
}

function loadAvoidSettings() {
    const same = $id("avoidSameSeatToggle"), side = $id("avoidNeighborToggle"), depth = $id("avoidDepthSelect");
    if (same) same.checked = localStorage.getItem("avoid_same_seat") === "true";
    if (side) side.checked = localStorage.getItem("avoid_neighbor") === "true";
    const d = localStorage.getItem("avoid_depth");
    if (depth && d && Array.from(depth.options).some(o => o.value === d)) depth.value = d;
    updateAvoidInfo();
}

function updateAvoidInfo() {
    const el = $id("avoidLayoutInfo");
    if (!el) return;
    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) || 6 : 6;
    const usable = seatLayoutLog.filter(l => l.cols === cols).length;
    el.textContent = seatLayoutLog.length === 0
        ? "席替えの履歴：まだありません。席替えをするたびに自動で覚えます。"
        : `席替えの履歴：${seatLayoutLog.length}回分を覚えています` + (usable < seatLayoutLog.length ? `。今の列数と同じなのは${usable}回分です。` : "");
}

// 席替えの計算に使う「過去の席」の準備。設定がOFFや、履歴がない時は null を返す（＝何も避けない）

function getAvoidContext() {
    const st = getAvoidSettings();
    if (!st.sameSeat && !st.neighbor) return null;
    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) || 6 : 6;
    const layouts = seatLayoutLog.filter(l => l.cols === cols).slice(0, st.depth).map(l => {
        const keyAt = {};
        Object.keys(l.pos).forEach(k => { keyAt[l.pos[k]] = k; });
        const pairs = new Set();
        Object.keys(keyAt).forEach(i => {
            const idx = parseInt(i, 10);
            if (idx % cols < cols - 1 && keyAt[idx + 1] !== undefined) pairs.add([keyAt[idx], keyAt[idx + 1]].sort().join("|"));
            if (keyAt[idx + cols] !== undefined) pairs.add([keyAt[idx], keyAt[idx + cols]].sort().join("|"));
        });
        return { pos: l.pos, pairs: pairs };
    });
    if (layouts.length === 0) return null;
    return { cols: cols, sameSeat: st.sameSeat, neighbor: st.neighbor, depth: st.depth, layouts: layouts };
}

// 今の配置が、過去の席替えと「同じ席」「同じ隣」になっている件数を数える。
// 名簿で席を指定している人（絶対固定）は、動かせないので数えない。

function countAvoidPenalty(seats, ctx) {
    if (!ctx) return { same: 0, pairs: 0, total: 0 };
    const cols = ctx.cols;
    let same = 0, pairs = 0;
    const keyAt = {};
    seats.forEach((seat, idx) => {
        if (!seat || seat.type !== "STUDENT" || !seat.text) return;
        const key = getCleanStudentKey(seat.text);
        if (!key) return;
        keyAt[idx] = { key: key, locked: seat.isFixed && seat.fixedType === "seat" };
        if (ctx.sameSeat && !keyAt[idx].locked) {
            ctx.layouts.forEach(l => { if (l.pos[key] === idx) same++; });
        }
    });
    if (ctx.neighbor) {
        Object.keys(keyAt).forEach(i => {
            const idx = parseInt(i, 10);
            const me = keyAt[idx];
            const check = other => {
                if (!other || (me.locked && other.locked)) return;
                const k = [me.key, other.key].sort().join("|");
                ctx.layouts.forEach(l => { if (l.pairs.has(k)) pairs++; });
            };
            if (idx % cols < cols - 1) check(keyAt[idx + 1]);
            check(keyAt[idx + cols]);
        });
    }
    return { same: same, pairs: pairs, total: same + pairs };
}

// 席替えの結果を、少しずつ入れ替えて良くしていく（山登り法）。
// 動かせるのは、席の指定もエリアの指定もない人だけ。空いている席への移動もできる。

function improveSeatsLocally(seats, scoreOf, iterations) {
    const movable = [], free = [];
    seats.forEach((seat, idx) => {
        if (seat && seat.type === "STUDENT" && !seat.isFixed && seat.fixedType === "none") movable.push(idx);
        else if (!seat) free.push(idx);
    });
    if (movable.length === 0 || movable.length + free.length < 2) return scoreOf(seats);
    const targets = movable.concat(free);
    let current = scoreOf(seats);
    for (let it = 0; it < iterations && current > 0; it++) {
        const a = movable[Math.floor(Math.random() * movable.length)];
        const b = targets[Math.floor(Math.random() * targets.length)];
        if (a === b) continue;
        const tmp = seats[a]; seats[a] = seats[b]; seats[b] = tmp;
        const next = scoreOf(seats);
        if (next <= current) current = next; // 同じ点なら動かして、別の配置も試す
        else { seats[b] = seats[a]; seats[a] = tmp; }
    }
    return current;
}

// 席替えを何通りか作って、「離す設定」「近くに置く設定」「前と同じ」が一番少ないものを選ぶ。
// 条件がぶつかったとき、どれを先に守るか（点数の重み）

const CONDITION_PRIORITY_WEIGHTS = {
    separate: { v: 1000, n: 100, a: 1 },
    near: { v: 100, n: 1000, a: 1 },
    avoid: { v: 100, n: 10, a: 1000 },
    equal: { v: 100, n: 100, a: 100 }
};

function getConditionPriority() {
    const v = lsGet("condition_priority", "separate");
    return CONDITION_PRIORITY_WEIGHTS[v] ? v : "separate";
}

function onConditionPriorityChange() {
    const sel = $id("conditionPrioritySelect");
    if (!sel) return;
    lsSet("condition_priority", sel.value);
    showToast("条件の優先順位を変えました。次の席替えから、使います。", "success");
}

function applyConditionPriorityUi() {
    const sel = $id("conditionPrioritySelect");
    if (sel) sel.value = getConditionPriority();
}

const LUCK_SCORE_WEIGHT = 0.5; // 運の貯金の点数の重み（他の条件より、必ず軽くします）
const FAIR_SCORE_WEIGHT = 0.25; // 席の公平性（プラグイン）の点数の重み。運の貯金より、さらに軽くします
const WISH_ENGINE_WEIGHT = 30; // 座席の希望（プラグイン）の点数の重み。離す・近くに置く設定よりは弱く、運の貯金や公平性よりは強くします
function wishIsOn() { return typeof wishActive === "function" && wishActive(); } // 座席の希望のプラグインが無くても、動きます
function fairIsOn() { return typeof fairActive === "function" && fairActive(); } // 席の公平性のプラグインが無くても、動きます

function computeShuffleScore(seats, ctx, avoid) {
    const w = CONDITION_PRIORITY_WEIGHTS[getConditionPriority()];
    const v = countSeparationViolations(seats, ctx);
    const n = countNearViolations(seats, ctx, true);
    const a = countAvoidPenalty(seats, avoid);
    // 運の貯金（プラグイン）：後ろの席が続いた生徒を、また後ろにしないための、いちばん弱い条件です
    const l = luckActive() ? luckPenalty(seats, ctx.cols) : 0;
    // 席の公平性（プラグイン）：同じような席が続いた生徒を、また同じ席にしないための、いちばん弱い条件です
    const f = fairIsOn() ? fairPenalty(seats, ctx.cols) : 0;
    // 座席の希望（プラグイン）：「前の席がいい」「窓側は避けたい」などを、できるだけ守るための条件です
    const wi = wishIsOn() ? wishPenalty(seats, ctx.cols) : 0;
    return { v: v, n: n, a: a, l: l, f: f, w: wi, score: v * w.v + n.dist * w.n + a.total * w.a + l * LUCK_SCORE_WEIGHT + f * FAIR_SCORE_WEIGHT + wi * WISH_ENGINE_WEIGHT };
}

function searchBestShuffle(rawList) {
    const avoid = getAvoidContext();
    const colSel = $id("columnSelect");
    const colorTog = $id("groupColorToggle");
    const ctx = { cols: colSel ? parseInt(colSel.value, 10) || 6 : 6, useGroups: colorTog ? colorTog.checked : false };
    const needSearch = !!avoid || separationPairs.length > 0 || nearPairs.length > 0 || luckActive() || fairIsOn() || wishIsOn();
    const attempts = needSearch ? 30 : 1;
    const scoreParts = seats => computeShuffleScore(seats, ctx, avoid);
    let best = null, bestScore = Infinity, bestInfo = { violations: 0, nearUnmet: 0, same: 0, pairs: 0, luck: 0, fair: 0 }, tried = 0;
    const prevSuppress = suppressSeatRender;
    suppressSeatRender = true;
    try {
        for (let i = 0; i < attempts; i++) {
            tried = i + 1;
            parseAndSetSeats(rawList, true, "none", false);
            if (needSearch) improveSeatsLocally(currentStudents, seats => scoreParts(seats).score, 500);
            const r = scoreParts(currentStudents);
            if (r.score < bestScore) {
                bestScore = r.score;
                best = currentStudents.slice();
                bestInfo = { violations: r.v, nearUnmet: countNearViolations(currentStudents, ctx, false).unmet, same: r.a.same, pairs: r.a.pairs, luck: r.l, fair: r.f };
            }
            if (r.score === 0) break;
        }
    } finally {
        suppressSeatRender = prevSuppress;
    }
    return { seats: best || [], violations: bestInfo.violations, nearUnmet: bestInfo.nearUnmet, same: bestInfo.same, pairs: bestInfo.pairs, avoiding: !!avoid, tried: tried, perfect: bestScore - bestInfo.luck * LUCK_SCORE_WEIGHT - bestInfo.fair * FAIR_SCORE_WEIGHT === 0, needSearch: needSearch };
}

// 班の番号の数え方。"rtl"：右上から下へ進み、下まで行ったら左の列へ。"ltr"：左上から右へ進み、右まで行ったら下の行へ。

function getGroupOrder() { return lsGet("group_number_order", "rtl") === "ltr" ? "ltr" : "rtl"; }

function applyGroupOrderSetting() {
    const sel = $id("groupOrderSelect");
    if (sel) sel.value = getGroupOrder();
}

function onGroupOrderChange() {
    const sel = $id("groupOrderSelect");
    lsSet("group_number_order", sel && sel.value === "ltr" ? "ltr" : "rtl");
    renderClassroom("none");
}
// r：上から数えた行（0から）、c：左から数えた列（0から）。班の組み方と数え方から、班番号を返す。

function computeGroupNumber(groupType, r, c, cols, rows) {
    const fromRight = cols - 1 - c;
    if (groupType === "column") return getGroupOrder() === "rtl" ? fromRight + 1 : c + 1;
    if (groupType === "row") return r + 1;
    if (groupType === "block") {
        if (getGroupOrder() === "rtl") {
            const blocksInCol = Math.ceil(rows / 2);
            return (Math.floor(fromRight / 2) * blocksInCol) + Math.floor(r / 2) + 1;
        }
        const blocksInRow = Math.ceil(cols / 2);
        return (Math.floor(r / 2) * blocksInRow) + Math.floor(c / 2) + 1;
    }
    return 0;
}

// 座席インデックスから、今の班分け設定における班番号を求める（renderClassroomと同じ規則）。

function getGroupNumberForIndex(idx, cols) {
    const typeSelect = $id("groupTypeSelect");
    const groupType = typeSelect ? typeSelect.value : "column";
    const r = Math.floor(idx / cols), c = idx % cols;
    if (groupType === "manual") return manualGroupMap[getSeatLabel(idx, cols)] || 0;
    const rows = Math.max(1, Math.ceil(currentStudents.length / cols));
    return computeGroupNumber(groupType, r, c, cols, rows);
}

function addSeparationPair() {
    const selA = $id("separationSelectA");
    const selB = $id("separationSelectB");
    if (!selA || !selB) return;
    const a = selA.value, b = selB.value;
    if (!a || !b) { showToast("2人とも選んでください。", "error"); return; }
    if (a === b) { showToast("同じ人同士は指定できません。", "error"); return; }
    if (separationPairs.some(p => (p.a === a && p.b === b) || (p.a === b && p.b === a))) {
        showToast("その組み合わせはすでに登録されています。", "error"); return;
    }
    if (nearPairs.some(p => (p.a === a && p.b === b) || (p.a === b && p.b === a))) {
        showToast("その2人は「近くに置く設定」に入っています。先に解除してください。", "error"); return;
    }
    separationPairs.push({ a: a, b: b });
    saveSeparationPairs();
    renderSeparationList();
    showToast(`${a} と ${b} を離す設定にしました。`, "success");
}

function removeSeparationPair(index) {
    separationPairs.splice(index, 1);
    saveSeparationPairs();
    renderSeparationList();
    showToast("離す設定を解除しました。", "success");
}

function renderSeparationList() {
    renderNearList();
    const selA = $id("separationSelectA");
    const selB = $id("separationSelectB");
    const names = [...new Set(lastRawList.map(s => getCleanStudentKey(s)).filter(s => s))];
    [selA, selB].forEach(sel => {
        if (!sel) return;
        const prev = sel.value;
        sel.innerHTML = '<option value="">-- 生徒を選ぶ --</option>' + names.map(n => `<option value="${n}">${n}</option>`).join("");
        if (names.includes(prev)) sel.value = prev;
    });

    const body = $id("separationListBody");
    if (!body) return;
    if (separationPairs.length === 0) {
        body.innerHTML = '<p style="color: var(--text-sub); font-size: 12px; padding: 6px 0;">まだ設定されていません。</p>';
        return;
    }
    body.innerHTML = separationPairs.map((p, i) => `
        <div class="history-row">
            <span>${p.a} ↔ ${p.b}</span>
            <button onclick="removeSeparationPair(${i})" class="btn-delete-mini btn-rounded-box btn-compact" style="width: auto; padding: 5px 12px; font-size: 12px; margin: 0;">🔓 解除</button>
        </div>
    `).join("");
}

let suppressSeatRender = false;

// ==========================================
// 八百長モード
// ==========================================

function loadYaochoState() {
    yaochoMode = localStorage.getItem("yaocho_mode") === "true";
    yaochoShowFixed = localStorage.getItem("yaocho_show_fixed") === "true";
    try {
        const savedSeats = JSON.parse(localStorage.getItem("yaocho_show_fixed_seats") || "[]");
        yaochoShowFixedSeats = new Set(Array.isArray(savedSeats) ? savedSeats : []);
    } catch (error) {
        yaochoShowFixedSeats = new Set();
    }
    try {
        const saved = localStorage.getItem("yaocho_rigged_result");
        yaochoRiggedResult = saved ? JSON.parse(saved) : null;
    } catch (error) {
        yaochoRiggedResult = null;
    }
}

function openSeatSettingsModal() {
    if (isAppLocked()) { showLockedToast(); return; }
    const toggle = $id("yaochoModeToggle");
    if (toggle) toggle.checked = yaochoMode;
    const showFixedToggle = $id("yaochoShowFixedToggle");
    if (showFixedToggle) showFixedToggle.checked = yaochoShowFixed;
    updateYaochoStatusText();
    renderSeparationList();
    updateAvoidInfo();
    const overlay = $id("seatSettingsModalOverlay");
    if (overlay) overlay.style.display = "flex";
}

function closeSeatSettingsModal() {
    const overlay = $id("seatSettingsModalOverlay");
    if (overlay) overlay.style.display = "none";
}

function saveYaochoShowFixedSeats() {
    localStorage.setItem("yaocho_show_fixed_seats", JSON.stringify(Array.from(yaochoShowFixedSeats)));
}

function finalizeShuffleResult(animMode) {
    if (yaochoMode && yaochoRiggedResult) {
        lastShuffleInfo = null; // 仕込み結果の時は、決め方を残さない
        // 仕込み結果に「固定済み」の生徒が含まれていても、見た目でバレないよう固定色は付けない。
        currentStudents = JSON.parse(JSON.stringify(yaochoRiggedResult)).map(seat => {
            if (seat && seat.type === "STUDENT") { seat.isFixed = false; seat.fixedType = "none"; }
            return seat;
        });
        // 「指定席を表示」がONなら、名簿で座席を指定（[A1]形式）している生徒が、その席に座っている場合だけ固定表示にする。
        if (yaochoShowFixed) {
            const colSel = $id("columnSelect");
            const cols = colSel ? parseInt(colSel.value, 10) : 6;
            const designated = {};
            getParsedStudentsList(lastRawList, cols).forEach(st => {
                if (st.type === 'fixed' && st.fixedLabel) {
                    const key = getCleanNameForMatch(st.original);
                    if (key) designated[key] = getIndexFromLabel(st.fixedLabel, cols);
                }
            });
            // 座席メニューなどで指定した席に仕込み結果の座り方が合わない場合は、指定席を優先して入れ替える。
            Object.keys(designated).forEach(key => {
                const target = designated[key];
                if (target === null || target === undefined || target >= currentStudents.length) return;
                const from = currentStudents.findIndex(seat => seat && seat.type === "STUDENT" && getCleanNameForMatch(seat.text) === key);
                if (from === -1 || from === target) return;
                const occupant = currentStudents[target];
                // 席が空席扱いの場所や、他の指定席に座っている人とは入れ替えない
                if (occupant && occupant.type !== "STUDENT") return;
                if (occupant && occupant.type === "STUDENT" && designated[getCleanNameForMatch(occupant.text)] === target) return;
                const tmp = currentStudents[from];
                currentStudents[from] = occupant || null;
                currentStudents[target] = tmp;
            });
            currentStudents.forEach((seat, idx) => {
                if (!seat || seat.type !== "STUDENT") return;
                const key = getCleanNameForMatch(seat.text);
                if (key && designated[key] === idx) { seat.isFixed = true; seat.fixedType = "seat"; }
            });
        }
        // 座席ごとに「指定席として表示」を選んだ席は、八百長モード中でも固定済みとして表示する。
        if (yaochoShowFixedSeats.size > 0) {
            const colSelSeat = $id("columnSelect");
            const colsSeat = colSelSeat ? parseInt(colSelSeat.value, 10) : 6;
            yaochoShowFixedSeats.forEach(lb => {
                const idx = getIndexFromLabel(lb, colsSeat);
                const seat = idx !== null ? currentStudents[idx] : null;
                if (seat && seat.type === "STUDENT") { seat.isFixed = true; seat.fixedType = "seat"; }
            });
        }
        renderClassroom(animMode);
        return;
    }
    shuffleWithSeparation(lastRawList, animMode);
}

// 最後の席替えを、どう決めたか。結果のチェックで見せる。席が手で動かされたら、sigが合わなくなる。

let lastShuffleInfo = null;

function seatSignatureOf(seats) {
    const parts = [];
    (seats || []).forEach((seat, idx) => {
        if (!isRealStudentSeat(seat)) return;
        const k = getCleanStudentKey(seat.text);
        if (k) parts.push(`${k}@${idx}`);
    });
    return parts.join("|");
}

function recordShuffleInfo(result) {
    const ctx = getAvoidContext();
    let rules = 0;
    try { rules = getParsedStudentsList(lastRawList || [], getGridCols()).filter(x => x.type !== "normal").length; } catch (error) { rules = 0; }
    lastShuffleInfo = {
        sig: seatSignatureOf(currentStudents),
        tried: result ? result.tried : 1,
        perfect: result ? !!result.perfect : true,
        needSearch: result ? !!result.needSearch : false,
        sep: separationPairs.length,
        near: nearPairs.length,
        sameSeat: !!(ctx && ctx.sameSeat),
        neighbor: !!(ctx && ctx.neighbor),
        depth: ctx ? ctx.layouts.length : 0,
        rules: rules,
        priority: getConditionPriority()
    };
}

function shuffleWithSeparation(rawList, animMode) {
    if (separationPairs.length === 0 && nearPairs.length === 0 && !getAvoidContext() && !luckActive() && !fairIsOn() && !wishIsOn()) {
        parseAndSetSeats(rawList, true, animMode, false);
        recordShuffleInfo(null);
        return;
    }

    const result = searchBestShuffle(rawList);
    if (result.seats.length > 0) currentStudents = result.seats;
    renderClassroom(animMode);
    recordShuffleInfo(result);

    if (result.violations > 0) {
        showToast(`離す設定のうち${result.violations}組は、席の都合で離せませんでした。`, "error");
    }
    if (result.nearUnmet > 0) {
        showToast(`近くに置く設定のうち${result.nearUnmet}組は、席の都合で近くにできませんでした。`, "error");
    }
    if (result.avoiding && (result.same + result.pairs) > 0) {
        showToast(`前回までと同じ席・同じ隣を、${result.same + result.pairs}件は避けきれませんでした。`, "success");
    }
}

function shuffleAndAnnounce() { shuffleSeats({ announce: true }); }

function shuffleSeats(options) {
    if (isAppLocked()) { showLockedToast(); return; }
    if (shuffleAnimating) return; // 演出の最中に、もう一度押されても無視する
    const announce = !!(options && options.announce);
    const inputEl = $id("studentInput");
    if (!inputEl) { showToast("名簿を入力してください。", "error"); return; }
    
    const inputText = inputEl.value;
    lastRawList = splitRosterRaw(inputText).map(n => n.trim()).filter(n => n !== ""); 
    
    if (lastRawList.length === 0) { showToast("名簿が空っぽです。", "error"); return; }
    
    saveSeatHistory(); 
    resetNominatedHistory(false); 
    
    const animSel = $id("animationSelect");
    let animType = announce ? "none" : (animSel ? animSel.value : "initial");
    if (animType === "random") animType = pickRandomShuffleAnimation();

    // 他の機能（音楽プレーヤーなど）に、席替えの始まりと終わりを知らせる
    const seatAnim = document.body.classList.contains("no-animation") ? "none" : animType;
    const notifyShuffle = name => { try { document.dispatchEvent(new CustomEvent(name, { detail: { anim: seatAnim } })); } catch (e) { /* 何もしない */ } };
    notifyShuffle("sekigae:shuffle-start");

    // 席替えが終わった時にすること（記録・自動保存・発表モード）
    const afterShuffle = () => {
        notifyShuffle("sekigae:shuffle-done");
        showToast("席替えが完了しました。", "success"); 
        recordSeatHistory();
        maybeAutoUploadAfterShuffle();
        if (announce) openAnnounce();
    };

    if (document.body.classList.contains("no-animation") || animType === "none") { 
        finalizeShuffleResult("none"); 
        afterShuffle();
        return; 
    }

    if (animType === "slot") { 
        runSlotAnimation(afterShuffle);
    } else if (animType === "slotstop") { 
        runSlotStopAnimation(afterShuffle);
    } else if (animType === "slotseat") { 
        runSlotSeatAnimation(afterShuffle);
    } else if (animType === "drumroll") { 
        runDrumrollAnimation(afterShuffle);
    } else { 
        finalizeShuffleResult(animType); 
        playShuffleAnimationSound(animType);
        afterShuffle();
    }
}

// ==========================================
// 席替えの演出（スロット／ドラムロール／効果音／おまかせ／試しに見る）
// ==========================================

function openSecretModal(label) { 
    secretTargetSeatLabel = label; 
    
    const lEl = $id("secretTargetLabel");
    if(lEl) lEl.textContent = label; 
    
    const sInput = $id("secretStudentInput");
    if(sInput) sInput.value = ""; 
    
    document.body.style.overflow = "hidden"; 
    
    const overlay = $id("secretModalOverlay");
    if(overlay) overlay.style.display = "flex"; 
    
    setTimeout(() => { 
        if (sInput) sInput.focus(); 
    }, 100); 
}

function closeSecretModal() { 
    document.body.style.overflow = ""; 
    const overlay = $id("secretModalOverlay");
    if(overlay) overlay.style.display = "none"; 
    secretTargetSeatLabel = ""; 
}

function applySecretFromModal() { 
    const sInput = $id("secretStudentInput");
    const query = sInput ? sInput.value.trim() : ""; 
    if (query) applySecretFixedSeat(secretTargetSeatLabel, query); 
    closeSecretModal(); 
}

function applySecretFixedSeat(label, query) {
    if (!query) return; 
    
    lastRawList = lastRawList.map(s => { 
        const match = s.match(/\{([A-Za-z]\d+)\}/); 
        return (match && match[1].toUpperCase() === label) ? s.replace(/\{[A-Za-z]\d+\}/, "").trim() : s; 
    }); 
    
    let found = false;
    lastRawList = lastRawList.map(s => {
        const cleanName = s.replace(/\[休\]/g, "").replace(/\{[A-Za-z]\d+\}/, "").trim();
        if ((query.match(/^\d+$/) && cleanName.startsWith(query + ".")) || cleanName.includes(query)) { 
            if (!found) { 
                found = true; 
                return `${cleanName} {${label}}`; 
            } 
        } 
        return s;
    });
    
    if (found) { 
        const sInput = $id("studentInput");
        if(sInput) sInput.value = lastRawList.join(", "); 
        showToast("ステルスコマンドを裏でセットしました。", "success"); 
    } else { 
        showToast(`「${query}」に当てはまる生徒がいません。`, "error"); 
    }
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "shuffle-engine",
    name: "席替えの条件と抽選",
    version: "1.1",
    required: true,
    description: "離す・近くに置く、前と同じ席の回避、席の抽選、八百長モードの確定です。"
});
