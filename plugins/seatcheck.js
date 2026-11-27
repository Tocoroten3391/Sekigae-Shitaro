// ==========================================
// 結果のチェックプラグイン：席替えの結果に、気になる点がないかを確かめます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="seatcheck" で結びついていて、自動で隠れます）
// ==========================================
function seatCheckPairKey(a, b) { return a < b ? a + "\u0001" + b : b + "\u0001" + a; }
function seatCheckPairText(key) { return key.split("\u0001").join("・"); }

// 左右・上下で隣り合っている2人の組を、すべて集める。posMap は「名前 → 席の番号」
function collectSidePairs(posMap, cols) {
    const byIdx = {};
    Object.keys(posMap).forEach(k => { byIdx[posMap[k]] = k; });
    const pairs = new Set();
    Object.keys(posMap).forEach(k => {
        const i = posMap[k];
        if ((i % cols) + 1 < cols && byIdx[i + 1] !== undefined) pairs.add(seatCheckPairKey(k, byIdx[i + 1]));
        if (byIdx[i + cols] !== undefined) pairs.add(seatCheckPairKey(k, byIdx[i + cols]));
    });
    return pairs;
}

// 今の座席表を、前回までの席替えや各種の設定と照らし合わせて、チェック結果の一覧を作る
function buildSeatCheckReport() {
    const cols = getGridCols(), rows = getGridRows();
    const posOf = {}, seatOf = {};
    (currentStudents || []).forEach((seat, idx) => {
        if (!isRealStudentSeat(seat)) return;
        const key = getCleanStudentKey(seat.text);
        if (!key || key in posOf) return;
        posOf[key] = idx;
        seatOf[key] = seat;
    });
    const names = Object.keys(posOf);
    const items = [];
    const add = (level, title, lines, hint) => items.push({ level: level, title: title, lines: lines || [], hint: hint || "" });
    if (names.length === 0) return { items: items, warn: 0 };
    const avoidSt = getAvoidSettings();
    const avoidHint = (avoidSt.sameSeat || avoidSt.neighbor)
        ? "避ける設定を入れていても、条件が多いと避けきれないことがあります。もう一度席替えするか、優先順位を変えてください。"
        : "設定の「前回までと同じ席や隣を避ける」を入れて席替えすると減らせます。";
    const sepNearHint = "もう一度席替えすると守れることがあります。守りたい条件を先にするには、優先順位を変えてください。席の数に対して条件が多いと、全ては守れません。";

    // 0. この席替えの決め方
    if (lastShuffleInfo) {
        if (lastShuffleInfo.sig === seatSignatureOf(currentStudents)) {
            const li = lastShuffleInfo, how = [];
            if (!li.needSearch) how.push("条件の指定がなかったので、ランダムに決めました。");
            else if (li.perfect) how.push(`${li.tried}通り目で全ての条件を守れる席ができたので、それに決めました。`);
            else how.push(`${li.tried}通りの席を作り、条件を一番守れたものを選びました。`);
            const used = [];
            if (li.sep > 0) used.push(`離す設定${li.sep}組`);
            if (li.near > 0) used.push(`近くに置く設定${li.near}組`);
            if (li.sameSeat) used.push(`直近${li.depth}回分の同じ席を避ける`);
            if (li.neighbor) used.push(`直近${li.depth}回分の同じ隣を避ける`);
            if (used.length > 0) how.push("使った条件：" + used.join("、"));
            if (li.rules > 0) how.push(`わがまま指定${li.rules}人分を反映しています。`);
            if (used.length >= 2) {
                const sel = $id("conditionPrioritySelect");
                const opt = sel ? Array.from(sel.options).find(o => o.value === li.priority) : null;
                if (opt) how.push(`条件がぶつかった時の優先順位：${opt.textContent.trim()}`);
            }
            add("info", "この席替えの決め方", how);
        } else {
            add("info", "この座席表は席替えの後で変わっています", ["席替えの決め方は変わる前の席についてのものなので、表示しません。"]);
        }
    }

    // 過去の席替え。いちばん新しい記録が今の座席表と同じなら、それは「今」なので数えない。列数が違うものは比べられない
    const latest = seatLayoutLog[0];
    const sameAsLatest = !!latest && latest.cols === cols && names.every(n => latest.pos[n] === posOf[n]);
    const past = (sameAsLatest ? seatLayoutLog.slice(1) : seatLayoutLog.slice()).filter(l => l && l.pos && l.cols === cols);

    const parsed = getParsedStudentsList(lastRawList || [], cols);
    const ruleOf = {};
    parsed.forEach(p => { const k = getCleanStudentKey(p.original); if (k) ruleOf[k] = p; });
    const isFixedKey = k => !!(seatOf[k] && seatOf[k].isFixed) || !!(ruleOf[k] && (ruleOf[k].type === "fixed" || ruleOf[k].type === "secret"));

    // 1. 前回と同じ席
    if (past.length === 0) {
        add("info", "前回と同じ席：比べられる前回の席替えが、まだありません", []);
    } else {
        const same = names.filter(n => past[0].pos[n] === posOf[n] && !isFixedKey(n));
        if (same.length > 0) add("warn", "前回と同じ席の人がいます", [same.join("、")], avoidHint);
        else add("ok", "前回と同じ席の人はいません", []);
    }

    // 2. 前回と同じ隣
    const curPairs = collectSidePairs(posOf, cols);
    const bothFixed = key => key.split("\u0001").every(isFixedKey);
    if (past.length === 0) {
        add("info", "前回と同じ隣：比べられる前回の席替えが、まだありません", []);
    } else {
        const prevPairs = collectSidePairs(past[0].pos, cols);
        const repeated = Array.from(curPairs).filter(k => prevPairs.has(k) && !bothFixed(k));
        if (repeated.length > 0) add("warn", "前回と同じ隣の組があります", repeated.map(seatCheckPairText), avoidHint);
        else add("ok", "前回と同じ隣の組はありません", []);
    }

    // 3. 何度も隣になった組
    if (past.length < 2) {
        add("info", "何度も同じ隣になっていないか：席替えが3回分たまると調べられます", []);
    } else {
        const recent = past.slice(0, 4);
        const pastPairSets = recent.map(l => collectSidePairs(l.pos, cols));
        const often = [];
        curPairs.forEach(k => {
            if (bothFixed(k)) return;
            const n = pastPairSets.filter(s => s.has(k)).length;
            if (n >= 2) often.push(`${seatCheckPairText(k)}　過去${recent.length}回のうち${n}回`);
        });
        if (often.length > 0) add("warn", "過去の席替えで何度も隣になった組があります", often, avoidHint);
        else add("ok", "何度も隣になった組はありません", []);
    }

    // 4. 離す設定
    if (!separationPairs || separationPairs.length === 0) {
        add("info", "離す設定：登録されていません", []);
    } else {
        const colorTog = $id("groupColorToggle");
        const useGroups = !!(colorTog && colorTog.checked);
        const bad = [];
        separationPairs.forEach(p => {
            const ia = posOf[p.a], ib = posOf[p.b];
            if (ia === undefined || ib === undefined) return;
            if (areSeatsAdjacent(ia, ib, cols)) bad.push(`${p.a}・${p.b}　隣です`);
            else if (useGroups) {
                const ga = getGroupNumberForIndex(ia, cols);
                if (ga > 0 && ga === getGroupNumberForIndex(ib, cols)) bad.push(`${p.a}・${p.b}　同じ班です`);
            }
        });
        if (bad.length > 0) add("warn", "離す設定を守れていない組があります", bad, sepNearHint + (useGroups ? "班の色を使っている時は、同じ班も避けるため、守りにくくなります。" : ""));
        else add("ok", "離す設定は全て守れています", []);
    }

    // 5. 近くに置く設定
    if (!nearPairs || nearPairs.length === 0) {
        add("info", "近くに置く設定：登録されていません", []);
    } else {
        const far = [];
        nearPairs.forEach(p => {
            const ia = posOf[p.a], ib = posOf[p.b];
            if (ia === undefined || ib === undefined) return;
            if (!areSeatsAdjacent(ia, ib, cols)) far.push(`${p.a}・${p.b}　離れています`);
        });
        if (far.length > 0) add("warn", "近くに置けていない組があります", far, sepNearHint);
        else add("ok", "近くに置く設定は全て守れています", []);
    }

    // 6. わがまま指定
    const targets = parsed.filter(p => p.type !== "normal");
    if (targets.length === 0) {
        add("info", "わがまま指定：登録されていません", []);
    } else {
        const ng = [];
        let counted = 0;
        targets.forEach(p => {
            const k = getCleanStudentKey(p.original), idx = posOf[k];
            if (idx === undefined) return;
            counted++;
            const label = getSeatLabel(idx, cols);
            const seat = { col: label.charAt(0), row: label.slice(1) };
            let ok = true, text = "";
            if (p.type === "fixed" || p.type === "secret") { ok = label === p.fixedLabel; text = p.type === "secret" ? "ひみつの固定席" : `${p.fixedLabel}に固定`; }
            else if (p.type === "row") { ok = seat.row === String(p.areaVal); text = `${p.areaVal}行目`; }
            else if (p.type === "col") { ok = seat.col === p.areaVal; text = `${p.areaVal}列目`; }
            else if (p.type === "custom") { ok = isSeatInCustom(seat, p.areaVal, rows); text = getCustomRuleText(p.areaVal).replace(/^\S+ /, ""); }
            if (!ok) ng.push(`${k}　${text}`);
        });
        if (ng.length > 0) add("warn", "わがまま指定を守れていない人がいます", ng, "指定した席や範囲を他の人と取り合っていないか、名簿を確認してください。");
        else add("ok", `わがまま指定は、${counted}人全て守れています`, []);
    }

    // 7・8. 2回続けて、いちばん前やいちばん後ろの列になった人
    if (past.length === 0) {
        add("info", "2回続けて前や後ろの列：比べられる前回の席替えが、まだありません", []);
    } else {
        const rowOf = idx => Math.floor(idx / cols);
        const lastNow = Math.max.apply(null, names.map(n => rowOf(posOf[n])));
        const prevPos = past[0].pos;
        const lastPrev = Math.max.apply(null, Object.keys(prevPos).map(n => rowOf(prevPos[n])));
        const front = names.filter(n => !isFixedKey(n) && rowOf(posOf[n]) === 0 && prevPos[n] !== undefined && rowOf(prevPos[n]) === 0);
        const back = lastNow === 0 ? [] : names.filter(n => !isFixedKey(n) && rowOf(posOf[n]) === lastNow && prevPos[n] !== undefined && rowOf(prevPos[n]) === lastPrev && lastPrev > 0);
        if (front.length > 0) add("warn", "2回続けて、一番前の列の人がいます", [front.join("、")], "もう一度席替えすると変わることがあります。");
        else add("ok", "2回続けて、一番前の列の人はいません", []);
        if (back.length > 0) add("warn", "2回続けて、一番後ろの列の人がいます", [back.join("、")], "もう一度席替えすると変わることがあります。");
        else add("ok", "2回続けて、一番後ろの列の人はいません", []);
    }

    // 9. 座席の希望・配慮メモ（プラグインがあるとき）
    if (typeof wishAddToReport === "function" && SekigaeApp.isEnabled("seat-wishes")) wishAddToReport(add, posOf, cols, rows);

    return { items: items, warn: items.filter(it => it.level === "warn").length };
}
function updateSeatCheckButton() {
    const btn = $id("btnSeatCheck");
    if (!btn) return;
    const isBlackboard = document.body.classList.contains("blackboard-active");
    const hasSeats = !!(currentStudents && currentStudents.some(isRealStudentSeat));
    const more = $id("btnMoreMenu");
    btn.style.display = (hasSeats && !isBlackboard) ? "block" : "none";
    let warn = 0;
    if (hasSeats) {
        const r = buildSeatCheckReport();
        warn = r.warn;
        btn.textContent = warn > 0 ? `⚠️ 結果のチェック　注意${warn}件` : "結果のチェック";
        btn.classList.toggle("has-warn", warn > 0);
    }
    // 「ほかの操作」のメニューを閉じていても、注意があることが分かるように、ボタンに印を付けます
    if (more) {
        more.classList.toggle("has-warn", warn > 0);
        more.title = warn > 0 ? "結果のチェックに注意が" + warn + "件あります" : "";
    }
    syncSeatToolsRow();
}

// 座席表の上の道具ボタンの列。見えるボタンが1つもない時は、列ごと隠して、余白も出さない
function syncSeatToolsRow() {
    const row = $id("seatToolsRow");
    if (!row) return;
    const any = Array.from(row.children).some(b => b.style.display !== "none" && getComputedStyle(b).display !== "none");
    row.style.display = any ? "flex" : "none";
}

// 「指名する」「⋯ ほかの操作」のまとめメニュー
document.addEventListener("click", e => { if (!e.target.closest(".pop-wrap")) closePopMenus(); });
document.addEventListener("keydown", e => { if (e.key === "Escape") closePopMenus(); });
function openSeatCheck() {
    const body = $id("seatCheckBody"), sum = $id("seatCheckSummary"), overlay = $id("seatCheckModalOverlay");
    if (!body || !overlay) return;
    const r = buildSeatCheckReport();
    if (sum) {
        sum.textContent = r.warn > 0 ? `注意が${r.warn}件あります。` : "気になる点はありませんでした。";
        sum.className = "seatcheck-summary " + (r.warn > 0 ? "is-warn" : "is-ok");
    }
    const mark = { ok: "✅", warn: "⚠️", info: "ℹ️" };
    body.innerHTML = r.items.map(it =>
        `<div class="seatcheck-item is-${it.level}"><span class="seatcheck-mark">${mark[it.level]}</span><div class="seatcheck-main"><div class="seatcheck-title">${escapeStatsHtml(it.title)}</div>` +
        it.lines.map(l => `<div class="seatcheck-line">${escapeStatsHtml(l)}</div>`).join("") +
        (it.hint ? `<div class="seatcheck-hint">${escapeStatsHtml(it.hint)}</div>` : "") + `</div></div>`
    ).join("");
    // 守れなかった条件があるときは、優先順位を、その場で選べるようにする
    const prioRow = $id("seatCheckPrioRow"), prioSel = $id("seatCheckPrioSelect"), srcSel = $id("conditionPrioritySelect");
    const hasConds = separationPairs.length > 0 || nearPairs.length > 0 || !!getAvoidContext() || avoidAnyOn();
    if (prioRow && prioSel && srcSel) {
        prioSel.innerHTML = srcSel.innerHTML;
        prioSel.value = getConditionPriority();
        prioRow.style.display = (r.warn > 0 && hasConds) ? "" : "none";
    }
    const again = $id("seatCheckAgainBtn");
    if (again) again.style.display = isAppLocked() ? "none" : "";
    overlay.style.display = "flex";
}
function avoidAnyOn() { const st = getAvoidSettings(); return !!(st.sameSeat || st.neighbor); }
function onSeatCheckPriorityChange() {
    const sel = $id("seatCheckPrioSelect");
    if (!sel) return;
    lsSet("condition_priority", sel.value);
    applyConditionPriorityUi();
    showToast("優先順位を変えました。「もう一度席替えする」から、使います。", "success");
}
function closeSeatCheck() {
    const overlay = $id("seatCheckModalOverlay");
    if (overlay) overlay.style.display = "none";
}
function reshuffleFromCheck() {
    if (isAppLocked()) { showLockedToast(); return; }
    closeSeatCheck();
    shuffleSeats();
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "seatcheck",
    name: "結果のチェック",
    version: "1.0",
    description: "席替えの結果に気になる点がないかを確かめます。",
    stubs: ["syncSeatToolsRow", "updateSeatCheckButton"]
});
