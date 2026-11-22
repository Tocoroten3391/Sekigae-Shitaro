// ==========================================
// 名簿の作成・取り込みプラグイン：名簿を表の形で作ったり、貼り付けたり、ファイルの列を指定して取り込めます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="roster" で結びついていて、自動で隠れます）
// ==========================================
let rosterEditorRows = []; // { no: "1", name: "田中太郎", furi: "たなかたろう", origFuri: "たなかたろう" }
let rosterEditorUndo = [], rosterEditorRedo = [], rosterEditorLast = "";
const ROSTER_EDITOR_UNDO_MAX = 60;
// 表が変わったら呼ぶ。変わる前の状態を、元に戻す用に残す。
function commitRosterEditorState() {
    const now = JSON.stringify(rosterEditorRows);
    if (now === rosterEditorLast) return;
    rosterEditorUndo.push(rosterEditorLast);
    if (rosterEditorUndo.length > ROSTER_EDITOR_UNDO_MAX) rosterEditorUndo.shift();
    rosterEditorRedo = [];
    rosterEditorLast = now;
    updateRosterEditorUndoButtons();
}
function resetRosterEditorHistory() {
    rosterEditorUndo = []; rosterEditorRedo = [];
    rosterEditorLast = JSON.stringify(rosterEditorRows);
    updateRosterEditorUndoButtons();
}
function updateRosterEditorUndoButtons() {
    const u = $id("reUndoBtn"), r = $id("reRedoBtn");
    if (u) u.disabled = rosterEditorUndo.length === 0;
    if (r) r.disabled = rosterEditorRedo.length === 0;
}
function undoRosterEditor() {
    if (rosterEditorUndo.length === 0) return;
    rosterEditorRedo.push(rosterEditorLast);
    rosterEditorLast = rosterEditorUndo.pop();
    rosterEditorRows = JSON.parse(rosterEditorLast);
    renderRosterEditor();
    updateRosterEditorUndoButtons();
}
function redoRosterEditor() {
    if (rosterEditorRedo.length === 0) return;
    rosterEditorUndo.push(rosterEditorLast);
    rosterEditorLast = rosterEditorRedo.pop();
    rosterEditorRows = JSON.parse(rosterEditorLast);
    renderRosterEditor();
    updateRosterEditorUndoButtons();
}
const KANA_PAREN_RE = /[（(]\s*[ぁ-ゖァ-ヺー・ヽヾ 　]+\s*[）)]/g;
function makeEditorRow(no, name, furi, origFuri) { return { no: no == null ? "" : String(no), name: name || "", furi: furi || "", origFuri: origFuri || "" }; }
function rosterEditorRowsFromList(list) {
    return list.map((raw, i) => {
        const m = /^(\d+)\.(.*)$/.exec(String(raw).trim());
        const no = m ? m[1] : String(i + 1);
        const rest = (m ? m[2] : String(raw)).replace(KANA_PAREN_RE, "").trim();
        const key = getCleanStudentKey(raw);
        const furi = (key && furiganaMap[key]) ? String(furiganaMap[key]) : (extractFuriganaFromRosterText(raw) || "");
        return makeEditorRow(no, rest, furi, (key && furiganaMap[key]) ? String(furiganaMap[key]) : "");
    });
}
function openRosterEditor() {
    if (isAppLocked()) { showLockedToast(); return; }
    const inp = $id("studentInput");
    const list = (inp && inp.value ? splitRosterRaw(inp.value) : (lastRawList || [])).map(x => x.trim()).filter(x => x);
    rosterEditorRows = list.length ? rosterEditorRowsFromList(list) : [];
    if (rosterEditorRows.length === 0) for (let i = 1; i <= 5; i++) rosterEditorRows.push(makeEditorRow(i, "", "", ""));
    const overlay = $id("rosterEditorModalOverlay");
    if (overlay) overlay.style.display = "flex";
    resetRosterEditorHistory();
    renderRosterEditor();
}
function closeRosterEditor() {
    const overlay = $id("rosterEditorModalOverlay");
    if (overlay) overlay.style.display = "none";
}
function renderRosterEditor() {
    const box = $id("reRows");
    if (!box) return;
    box.innerHTML = "";
    rosterEditorRows.forEach((row, i) => {
        const div = document.createElement("div");
        div.className = "re-row";
        const mk = (cls, val, ph, label, onIn) => {
            const el = document.createElement("input");
            el.type = "text"; el.className = cls; el.value = val; el.placeholder = ph; el.setAttribute("aria-label", label);
            el.addEventListener("input", () => { onIn(el.value); updateRosterEditorCheck(); });
            el.addEventListener("change", commitRosterEditorState);
            return el;
        };
        const no = mk("re-no", row.no, "番号", `${i + 1}行目の番号`, v => { row.no = v; });
        no.inputMode = "numeric";
        const name = mk("re-name", row.name, "名前", `${i + 1}行目の名前`, v => { row.name = v; });
        name.addEventListener("paste", ev => onRosterEditorPaste(ev, i));
        const furi = mk("re-furi", row.furi, "ふりがな", `${i + 1}行目のふりがな`, v => { row.furi = v; });
        const ops = document.createElement("div");
        ops.className = "re-ops";
        const btn = (txt, title, fn) => { const b = document.createElement("button"); b.type = "button"; b.textContent = txt; b.title = title; b.setAttribute("aria-label", title); b.addEventListener("click", fn); return b; };
        ops.append(btn("⬆️ 上へ", "上へ動かす", () => moveEditorRow(i, -1)), btn("⬇️ 下へ", "下へ動かす", () => moveEditorRow(i, 1)), btn("🗑️ 消す", "この行を消す", () => deleteEditorRow(i)));
        div.append(no, name, furi, ops);
        box.appendChild(div);
    });
    updateRosterEditorCheck();
}
function moveEditorRow(i, d) {
    const j = i + d;
    if (j < 0 || j >= rosterEditorRows.length) return;
    const t = rosterEditorRows[i]; rosterEditorRows[i] = rosterEditorRows[j]; rosterEditorRows[j] = t;
    renderRosterEditor();
    commitRosterEditorState();
}
function deleteEditorRow(i) {
    rosterEditorRows.splice(i, 1);
    renderRosterEditor();
    commitRosterEditorState();
}
function addEditorRows(n) {
    const nos = rosterEditorRows.map(r => parseInt(r.no, 10)).filter(x => Number.isFinite(x));
    let next = (nos.length ? Math.max.apply(null, nos) : 0) + 1;
    for (let k = 0; k < n; k++) rosterEditorRows.push(makeEditorRow(next++, "", "", ""));
    renderRosterEditor();
    commitRosterEditorState();
    const rows = document.querySelectorAll("#reRows .re-name");
    if (rows.length) rows[rows.length - n].focus();
}
function renumberEditorRows() {
    let n = 1;
    rosterEditorRows.forEach(r => { r.no = r.name.trim() ? String(n++) : ""; });
    renderRosterEditor();
    commitRosterEditorState();
    showToast("名前のある行に、上から順に番号をつけ直しました。", "success");
}
function sortEditorRowsByReading() {
    const keyOf = r => (r.furi || r.name || "").trim();
    const filled = rosterEditorRows.filter(r => r.name.trim());
    const blanks = rosterEditorRows.filter(r => !r.name.trim());
    filled.sort((a, b) => keyOf(a).localeCompare(keyOf(b), "ja"));
    rosterEditorRows = filled.concat(blanks);
    renumberEditorRows();
}
function clearEditorRows() {
    if (rosterEditorRows.some(r => r.name.trim()) && !confirm("表の中身を、すべて消します。よろしいですか？")) return;
    rosterEditorRows = [];
    for (let i = 1; i <= 5; i++) rosterEditorRows.push(makeEditorRow(i, "", "", ""));
    renderRosterEditor();
    commitRosterEditorState();
}
// 表計算ソフトの列を貼り付けたとき：複数の行があれば、その行から下に、まとめて入れる
function onRosterEditorPaste(ev, startIdx) {
    const text = (ev.clipboardData || window.clipboardData) ? (ev.clipboardData || window.clipboardData).getData("text") : "";
    if (!/[\n\t]/.test(text.replace(/\n$/, ""))) return; // 1つだけなら、ふつうの貼り付け
    ev.preventDefault();
    const lines = normalizeRosterText(text).split("\n").map(l => l.replace(/\s+$/, "")).filter(l => l.trim() !== "");
    let at = startIdx;
    lines.forEach(line => {
        const cols = line.split("\t").map(x => x.trim());
        let no = "", name = "", furi = "";
        if (cols.length >= 2 && /^\d+$/.test(cols[0])) { no = cols[0]; name = cols[1]; furi = cols[2] || ""; }
        else if (cols.length >= 2) { name = cols[0]; furi = cols[1]; }
        else {
            const m = /^(\d{1,3})\s*[.、,\s]\s*(.+)$/.exec(cols[0]);
            if (m) { no = m[1]; name = m[2]; } else name = cols[0];
        }
        name = name.replace(KANA_PAREN_RE, "").trim();
        if (!name) return;
        const row = makeEditorRow(no, name, furi, "");
        if (at < rosterEditorRows.length) rosterEditorRows[at] = Object.assign(row, { origFuri: rosterEditorRows[at].origFuri });
        else rosterEditorRows.push(row);
        at++;
    });
    let n = 1;
    rosterEditorRows.forEach(r => { if (r.name.trim() && !r.no) r.no = String(n); n++; });
    renderRosterEditor();
    commitRosterEditorState();
    showToast(`${lines.length}行を、表に入れました。`, "success");
}
function getRosterEditorList() {
    const named = rosterEditorRows.filter(r => r.name.trim());
    return named.map((r, i) => {
        const no = /^\d+$/.test(String(r.no).trim()) ? parseInt(r.no, 10) : i + 1;
        return `${no}.${r.name.trim().replace(/\s+/g, " ")}`;
    });
}
function updateRosterEditorCheck() {
    const sum = $id("reSummary"), ul = $id("reIssues"), go = $id("btnRosterEditorGo");
    if (!sum || !ul) return;
    const list = getRosterEditorList();
    ul.innerHTML = "";
    if (go) go.disabled = list.length === 0;
    if (list.length === 0) { sum.textContent = "名前を入れてください。"; sum.className = "rp-summary"; return; }
    // 表では、ふりがなが別の欄なので、姓と名の間の空白の注意は出さない
    const issues = analyzeRosterStrings(list).filter(i => !i.title.startsWith("名前に空白が入っている行"));
    const warn = issues.filter(i => i.level === "warn").length;
    sum.textContent = `${list.length}人です。` + (warn ? `　注意が${warn}件あります。` : "　おかしな所は見つかりませんでした。");
    sum.className = "rp-summary " + (warn ? "is-warn" : "is-ok");
    issues.forEach(i => {
        const li = document.createElement("li");
        li.className = "rp-issue rp-" + i.level;
        const b = document.createElement("strong");
        b.textContent = (i.level === "warn" ? "注意　" : "お知らせ　") + i.title;
        const d = document.createElement("span");
        d.textContent = i.detail;
        li.append(b, d);
        ul.appendChild(li);
    });
}
function applyRosterEditor() {
    if (isAppLocked()) { showLockedToast(); return; }
    const list = getRosterEditorList();
    if (list.length === 0) return;
    // ふりがな：入れた分を保存し、表で空にした分は消す
    let setCount = 0;
    const named = rosterEditorRows.filter(r => r.name.trim());
    named.forEach((r, i) => {
        const key = getCleanStudentKey(list[i]);
        if (!key) return;
        const f = r.furi.trim();
        if (f) { furiganaMap[key] = f; setCount++; }
        else if (r.origFuri && furiganaMap[key] === r.origFuri) delete furiganaMap[key];
    });
    if (setCount > 0 && lsGet("furigana_show", null) === null) furiganaShow = true;
    saveFurigana();
    applyRosterList(list, `${list.length}人の名簿にしました。` + (setCount ? `ふりがな${setCount}人分も、保存しました。` : ""));
    closeRosterEditor();
}
function downloadTextFile(name, text, mime) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
function downloadRosterTemplate() {
    const lines = ["番号,名前,ふりがな", "1,青木太郎,あおきたろう", "2,伊藤花子,いとうはなこ", "3,上田一郎,うえだいちろう"];
    downloadTextFile("席替えし太郎_名簿のひな形.csv", "﻿" + lines.join("\r\n"), "text/csv;charset=utf-8;");
    showToast("ひな形を書き出しました。表計算ソフトで開いて、書き換えてください。", "success");
}
function exportRosterEditor(kind) {
    const named = rosterEditorRows.filter(r => r.name.trim());
    if (named.length === 0) { showToast("書き出せる名簿がありません。", "error"); return; }
    const list = getRosterEditorList();
    const base = ($id("presetNameInput") && $id("presetNameInput").value.trim()) || "名簿";
    if (kind === "txt") {
        const lines = named.map((r, i) => list[i] + (r.furi.trim() ? `（${r.furi.trim()}）` : ""));
        downloadTextFile(`${base}_名簿.txt`, lines.join("\r\n"), "text/plain;charset=utf-8;");
    } else {
        const q = v => /[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v;
        const hasFuri = named.some(r => r.furi.trim());
        const lines = [hasFuri ? "番号,名前,ふりがな" : "番号,名前"];
        named.forEach((r, i) => {
            const no = (/^(\d+)\./.exec(list[i]) || [])[1] || String(i + 1);
            lines.push(`${no},${q(r.name.trim())}` + (hasFuri ? `,${q(r.furi.trim())}` : ""));
        });
        downloadTextFile(`${base}_名簿.csv`, "\uFEFF" + lines.join("\r\n"), "text/csv;charset=utf-8;");
    }
    showToast(`名簿${named.length}人分を、${kind === "txt" ? "TXT" : "CSV"}で書き出しました。`, "success");
}

// ==========================================
// 名簿を貼り付ける：読み取って、おかしな所を教える
// ==========================================
function normalizeRosterText(text) {
    return String(text == null ? "" : text).replace(/^﻿/, "").replace(/\r/g, "")
        .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/[．]/g, ".").replace(/ /g, " ");
}
// 貼り付けた文章を、「番号.名前」の形の一覧にします。
function parseRosterPaste(text) {
    const norm = normalizeRosterText(text);
    let lines = norm.split("\n").map(l => l.trim()).filter(l => l !== "");
    let skippedHeader = false;
    if (lines.length === 1 && /[,、，]/.test(lines[0])) lines = splitRosterRaw(lines[0], ",、，").map(l => l.trim()).filter(l => l !== "");
    if (lines.length > 0 && /^"?(出席)?番号"?\s*[,\t、]\s*"?(名前|氏名)"?/.test(lines[0])) { lines = lines.slice(1); skippedHeader = true; }
    const entries = [];
    lines.forEach(line => {
        let no = null, rest = line;
        const m = /^(\d{1,3})\s*(?:[.\t,、，]|\s)\s*(.+)$/.exec(line);
        if (m) { no = parseInt(m[1], 10); rest = m[2]; }
        // 表の列（タブや「,」区切り）が続く時は、最初の列を名前にする
        const cols = rest.split(/[\t,，]/).map(c => c.replace(/^"|"$/g, "").trim()).filter(c => c !== "");
        const name = (cols[0] || "").replace(/\s+/g, " ").trim();
        if (!name) return;
        entries.push({ no, name });
    });
    const list = entries.map((e, i) => `${e.no !== null ? e.no : i + 1}.${e.name}`);
    return { list, skippedHeader };
}
// 「番号.名前」の一覧を調べて、気をつけたい点を返します。level は warn（注意）か info（お知らせ）。
function analyzeRosterStrings(list) {
    const items = [];
    const parts = list.map(s => { const m = /^(\d+)\.(.*)$/.exec(String(s)); return m ? { no: parseInt(m[1], 10), name: m[2].trim() } : { no: null, name: String(s).trim() }; });
    const joinTop = (arr, n) => arr.slice(0, n).join("、") + (arr.length > n ? `　ほか${arr.length - n}件` : "");
    const clean = name => name.replace(/\[休\]/g, "").trim();

    const byName = {};
    parts.forEach(p => { const k = clean(p.name).replace(/\s/g, ""); if (!k) return; (byName[k] = byName[k] || []).push(p); });
    const dupNames = Object.keys(byName).filter(k => byName[k].length > 1);
    if (dupNames.length) items.push({ level: "warn", title: `同じ名前の人がいます：${joinTop(dupNames.map(k => `${clean(byName[k][0].name)}は${byName[k].length}人`), 5)}`, detail: "同じ人を2回入れていないか、確認してください。同姓同名なら、名前を区別してください。" });

    const byNo = {};
    parts.forEach(p => { if (p.no === null) return; (byNo[p.no] = byNo[p.no] || []).push(p); });
    const dupNos = Object.keys(byNo).filter(k => byNo[k].length > 1).map(Number).sort((a, b) => a - b);
    if (dupNos.length) items.push({ level: "warn", title: `同じ番号があります：${joinTop(dupNos.map(n => `${n}番`), 8)}`, detail: "番号のない行は、並んだ順の番号になります。そのせいで重なることもあります。" });

    const spaced = parts.filter(p => /\s/.test(clean(p.name)));
    if (spaced.length) items.push({ level: "warn", title: `名前に空白が入っている行があります：${joinTop(spaced.map(p => clean(p.name)), 4)}`, detail: "ふりがなが続いていないか、確認してください。姓と名の間の空白なら、そのままで構いません。" });

    const longNames = parts.filter(p => Array.from(clean(p.name)).length > 12);
    if (longNames.length) items.push({ level: "warn", title: `名前が長い行があります：${joinTop(longNames.map(p => clean(p.name)), 3)}`, detail: "別の列が入っていないか、確認してください。" });

    const nos = parts.map(p => p.no).filter(n => n !== null);
    if (nos.length) {
        const max = Math.max.apply(null, nos);
        if (max <= 200) {
            const have = new Set(nos);
            const missing = [];
            for (let i = 1; i <= max; i++) if (!have.has(i)) missing.push(`${i}番`);
            if (missing.length) items.push({ level: "info", title: `番号が飛んでいます：${joinTop(missing, 8)}`, detail: "転校などで、欠番があるなら、そのままで構いません。" });
        }
    }
    return items;
}
function openRosterPasteModal() {
    if (isAppLocked()) { showLockedToast(); return; }
    const t = $id("rosterPasteInput");
    if (t) t.value = "";
    updateRosterPasteCheck();
    const overlay = $id("rosterPasteModalOverlay");
    if (overlay) overlay.style.display = "flex";
    if (t) t.focus();
}
function closeRosterPasteModal() {
    const overlay = $id("rosterPasteModalOverlay");
    if (overlay) overlay.style.display = "none";
}
function updateRosterPasteCheck() {
    const t = $id("rosterPasteInput"), sum = $id("rosterPasteSummary"), ul = $id("rosterPasteIssues"), pv = $id("rosterPastePreview"), go = $id("btnRosterPasteGo");
    if (!t || !sum || !ul || !pv) return;
    const { list, skippedHeader } = parseRosterPaste(t.value);
    if (go) go.disabled = list.length === 0;
    ul.innerHTML = "";
    pv.innerHTML = "";
    if (list.length === 0) {
        sum.textContent = t.value.trim() ? "名簿を読み取れませんでした。" : "名簿を貼り付けてください。";
        sum.className = "rp-summary";
        return;
    }
    const issues = analyzeRosterStrings(list);
    const warn = issues.filter(i => i.level === "warn").length;
    sum.textContent = `${list.length}人を読み取りました。` + (skippedHeader ? "見出しの行は、飛ばしました。" : "") + (warn ? `　注意が${warn}件あります。` : "　おかしな所は見つかりませんでした。");
    sum.className = "rp-summary " + (warn ? "is-warn" : "is-ok");
    issues.forEach(i => {
        const li = document.createElement("li");
        li.className = "rp-issue rp-" + i.level;
        const b = document.createElement("strong");
        b.textContent = (i.level === "warn" ? "注意　" : "お知らせ　") + i.title;
        const d = document.createElement("span");
        d.textContent = i.detail;
        li.append(b, d);
        ul.appendChild(li);
    });
    const shown = list.slice(0, 80);
    shown.forEach(s => {
        const m = /^(\d+)\.(.*)$/.exec(s);
        const chip = document.createElement("span");
        chip.className = "rp-chip";
        const n = document.createElement("b");
        n.textContent = m ? m[1] : "";
        chip.append(n, document.createTextNode(m ? m[2] : s));
        pv.appendChild(chip);
    });
    if (list.length > shown.length) {
        const more = document.createElement("span");
        more.className = "rp-more";
        more.textContent = `ほか${list.length - shown.length}人`;
        pv.appendChild(more);
    }
}
function applyRosterList(list, message) {
    endTrialIfActive(true);
    const sInput = $id("studentInput");
    if (sInput) sInput.value = list.join(", ");
    lastRawList = [...list];
    parseAndSetSeats(list, false, "initial");
    showToast(message, "success");
}
function applyRosterPaste() {
    if (isAppLocked()) { showLockedToast(); return; }
    const t = $id("rosterPasteInput");
    if (!t) return;
    const { list } = parseRosterPaste(t.value);
    if (list.length === 0) return;
    applyRosterList(list, `${list.length}人の名簿を取り込みました。`);
    closeRosterPasteModal();
}

// 読み込んだファイルの文字を、名簿の1人ずつの並びにする。
// このアプリが書き出したCSV（「番号,名前」か「番号,名前,ふりがな」）は、番号と名前をつなぎ直して読む。
function parseCsvLine(line) { return parseDelimitedLine(line, ","); }
function parseDelimitedLine(line, delim) {
    const out = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQ) {
            if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
            else cur += ch;
        } else if (ch === '"') inQ = true;
        else if (ch === delim) { out.push(cur.trim()); cur = ""; }
        else cur += ch;
    }
    out.push(cur.trim());
    return out;
}
function parseRosterFileText(text) {
    const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).map(l => l.trim()).filter(l => l !== "");
    const hasHeader = lines.length > 0 && /^"?番号"?\s*,\s*"?名前"?(\s*,\s*"?(ふりがな|フリガナ)"?)?\s*$/.test(lines[0]);
    const body = hasHeader ? lines.slice(1) : lines;
    const cols = body.map(parseCsvLine);
    const kanaOnly = v => v === "" || /^[\u3041-\u3096\u30A1-\u30FA\u30FC\u30FB\u30FD\u30FE \u3000]+$/.test(v);
    if (cols.some(cc => cc.length === 3 && !kanaOnly(cc[2]))) return null; // 3列目がふりがなでなければ、列の指定に回す
    if (hasHeader || (cols.length > 0 && cols.every(cc => /^\d+$/.test(cc[0]) && cc.length >= 2 && cc.length <= 3))) {
        return cols.map((cc, i) => {
            if (!/^\d+$/.test(cc[0])) return body[i];
            const furi = (cc[2] || "").trim();
            return `${cc[0]}.${cc[1]}` + (furi ? `（${furi}）` : "");
        });
    }
    return null;
}

// ファイルの文字コードを見分けて、文字にする。UTF-8でなければ、Shift_JISとして読む。
function decodeRosterFileBuffer(buf) {
    try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (e) { /* 次へ */ }
    try { return new TextDecoder("shift_jis").decode(buf); } catch (e) { /* 次へ */ }
    return new TextDecoder("utf-8").decode(buf);
}
// 表の形（2行以上、2列以上）のファイルなら、行と列の並びを返す。そうでなければnull。
function detectRosterTable(text) {
    const lines = String(text).replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.trim() !== "");
    if (lines.length < 2) return null;
    const sample = lines.slice(0, 30);
    let best = null, bestScore = 0;
    ["\t", ",", ";"].forEach(d => {
        const withD = sample.filter(l => l.indexOf(d) >= 0).length;
        if (withD >= Math.ceil(sample.length * 0.6) && withD > bestScore) { best = d; bestScore = withD; }
    });
    if (!best) return null;
    const rows = lines.map(l => parseDelimitedLine(l, best));
    if (Math.max.apply(null, rows.map(r => r.length)) < 2) return null;
    return rows;
}
let rosterMapState = null; // { rows, header, map: { no, name, name2, furi, furi2 } }
const ROSTER_MAP_FIELDS = [
    { key: "no", label: "番号" },
    { key: "name", label: "名前" },
    { key: "name2", label: "名前の続き" },
    { key: "furi", label: "ふりがな" },
    { key: "furi2", label: "ふりがなの続き" }
];
function guessRosterMap(rows, header) {
    const map = { no: "", name: "", name2: "", furi: "", furi2: "" };
    const n = Math.max.apply(null, rows.map(r => r.length));
    const labels = [];
    for (let i = 0; i < n; i++) labels.push(header ? String(rows[0][i] || "") : "");
    const find = re => { for (let i = 0; i < n; i++) if (re.test(labels[i])) return String(i); return ""; };
    const used = new Set();
    const take = (key, idx) => { if (idx !== "" && !used.has(idx)) { map[key] = idx; used.add(idx); } };
    if (header) {
        take("no", find(/出席番号|番号|No|NO|ＮＯ/));
        const furiAll = find(/ふりがな|フリガナ|ﾌﾘｶﾞﾅ|よみ|読み|かな|カナ/);
        take("furi", furiAll);
        take("name", find(/氏名|名前|生徒名|児童名/) );
        if (!map.name) { take("name", find(/^(姓|氏|苗字|名字)$/)); take("name2", find(/^名$/)); }
    }
    if (!map.name) { // 見出しがなければ、数字だけの列を番号、それ以外の最初の列を名前とみなす
        const dataRows = rows.slice(header ? 1 : 0, (header ? 1 : 0) + 20);
        const isNumCol = i => dataRows.length > 0 && dataRows.every(r => /^[0-9０-９]+$/.test(String(r[i] || "").trim()));
        const kanaOnly = v => /^[\u3041-\u3096\u30A1-\u30FA\u30FC\u30FB\u30FD\u30FE \u3000]+$/.test(v);
        const isKanaCol = i => dataRows.length > 0 && dataRows.every(r => kanaOnly(String(r[i] || "").trim()));
        for (let i = 0; i < n; i++) {
            if (used.has(String(i))) continue;
            if (!map.no && isNumCol(i)) { take("no", String(i)); continue; }
            if (!map.name && !isNumCol(i) && !isKanaCol(i)) { take("name", String(i)); continue; }
            if (!map.furi && isKanaCol(i)) { take("furi", String(i)); }
        }
    }
    return map;
}
// 前回選んだ列を、見出しが同じファイルで、また使えるようにする
const ROSTER_MAP_MEMORY_MAX = 20;
function rosterMapSignature(rows, header) {
    const n = Math.max.apply(null, rows.map(r => r.length));
    return header ? "h:" + n + ":" + (rows[0] || []).map(v => String(v).trim()).join("|") : "n:" + n;
}
function readRosterMapMemory() {
    try { const v = JSON.parse(lsGet("roster_map_memory", "{}")); return (v && typeof v === "object" && !Array.isArray(v)) ? v : {}; } catch (error) { return {}; }
}
function recallRosterMap(rows, header) {
    const m = readRosterMapMemory()[rosterMapSignature(rows, header)];
    if (!m || typeof m !== "object") return null;
    const n = Math.max.apply(null, rows.map(r => r.length));
    const map = {};
    for (const f of ROSTER_MAP_FIELDS) {
        const v = m[f.key];
        if (v === "" || v === undefined) { map[f.key] = ""; continue; }
        if (!/^\d+$/.test(String(v)) || parseInt(v, 10) >= n) return null; // 列の数が合わなければ使わない
        map[f.key] = String(v);
    }
    return map.name ? map : null;
}
function rememberRosterMap() {
    if (!rosterMapState) return;
    const mem = readRosterMapMemory();
    const sig = rosterMapSignature(rosterMapState.rows, rosterMapState.header);
    delete mem[sig];
    mem[sig] = Object.assign({}, rosterMapState.map);
    const keys = Object.keys(mem);
    keys.slice(0, Math.max(0, keys.length - ROSTER_MAP_MEMORY_MAX)).forEach(k => { delete mem[k]; });
    lsSet("roster_map_memory", JSON.stringify(mem));
}
function updateRosterMapMemoNote(recalled) {
    const el = $id("rmMemoNote");
    if (el) el.textContent = recalled ? "前回と同じ形のファイルなので、前回の選び方を使いました。" : "";
}
function openRosterMapModal(rows) {
    if (isAppLocked()) { showLockedToast(); return; }
    const first = rows[0] || [];
    const header = first.length > 0 && first.every(v => !/^[0-9０-９]+$/.test(String(v).trim())) &&
        first.some(v => /番号|氏名|名前|ふりがな|フリガナ|生徒|児童|学年|組|姓|名|No/i.test(String(v)));
    const recalled = recallRosterMap(rows, header);
    rosterMapState = { rows, header, map: recalled || guessRosterMap(rows, header) };
    updateRosterMapMemoNote(!!recalled);
    const cb = $id("rmHeader");
    if (cb) cb.checked = header;
    renderRosterMapSelects();
    updateRosterMapCheck();
    const o = $id("rosterMapModalOverlay");
    if (o) o.style.display = "flex";
}
function closeRosterMapModal() {
    const o = $id("rosterMapModalOverlay");
    if (o) o.style.display = "none";
    rosterMapState = null;
}
function renderRosterMapSelects() {
    const box = $id("rmSelects");
    if (!box || !rosterMapState) return;
    const { rows, header, map } = rosterMapState;
    const n = Math.max.apply(null, rows.map(r => r.length));
    const sampleRow = rows[header ? 1 : 0] || [];
    box.innerHTML = "";
    ROSTER_MAP_FIELDS.forEach(f => {
        const wrap = document.createElement("label");
        wrap.className = "rm-field";
        const sp = document.createElement("span");
        sp.textContent = f.label;
        const sel = document.createElement("select");
        sel.dataset.key = f.key;
        const o0 = document.createElement("option");
        o0.value = ""; o0.textContent = "使わない";
        sel.appendChild(o0);
        for (let i = 0; i < n; i++) {
            const o = document.createElement("option");
            const head = header ? String(rows[0][i] || "") : "";
            const ex = String(sampleRow[i] || "");
            o.value = String(i);
            o.textContent = `${i + 1}列目　` + (head || ex || "空");
            sel.appendChild(o);
        }
        sel.value = map[f.key];
        sel.addEventListener("change", () => { rosterMapState.map[f.key] = sel.value; updateRosterMapCheck(); });
        wrap.append(sp, sel);
        box.appendChild(wrap);
    });
}
function onRosterMapHeaderChange() {
    if (!rosterMapState) return;
    rosterMapState.header = !!$id("rmHeader").checked;
    const recalled = recallRosterMap(rosterMapState.rows, rosterMapState.header);
    rosterMapState.map = recalled || guessRosterMap(rosterMapState.rows, rosterMapState.header);
    updateRosterMapMemoNote(!!recalled);
    renderRosterMapSelects();
    updateRosterMapCheck();
}
function buildMappedRoster() {
    if (!rosterMapState) return [];
    const { rows, header, map } = rosterMapState;
    const cell = (r, k) => (map[k] === "" ? "" : String(r[parseInt(map[k], 10)] || "").trim());
    const toHalf = v => v.replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
    const out = [];
    rows.slice(header ? 1 : 0).forEach(r => {
        const name = (cell(r, "name") + cell(r, "name2")).replace(/\s+/g, " ").trim();
        if (!name) return;
        const m = /\d+/.exec(toHalf(cell(r, "no")));
        const no = m ? parseInt(m[0], 10) : out.length + 1;
        const furi = (cell(r, "furi") + cell(r, "furi2")).replace(/\s+/g, " ").trim();
        out.push({ no, name, furi });
    });
    return out;
}
function updateRosterMapCheck() {
    const sum = $id("rmSummary"), ul = $id("rmIssues"), pv = $id("rmPreview"), go = $id("btnRosterMapGo");
    if (!sum || !rosterMapState) return;
    const people = buildMappedRoster();
    ul.innerHTML = "";
    pv.innerHTML = "";
    if (go) go.disabled = people.length === 0;
    if (people.length === 0) {
        sum.textContent = "名前の列を選んでください。";
        sum.className = "rp-summary is-warn";
        return;
    }
    const list = people.map(x => `${x.no}.${x.name}`);
    const issues = analyzeRosterStrings(list).filter(i => !i.title.startsWith("名前に空白が入っている行"));
    const warn = issues.filter(i => i.level === "warn").length;
    const withFuri = people.filter(x => x.furi).length;
    sum.textContent = `${people.length}人です。` + (withFuri ? `ふりがな${withFuri}人分があります。` : "") + (warn ? `　注意が${warn}件あります。` : "　おかしな所は見つかりませんでした。");
    sum.className = "rp-summary " + (warn ? "is-warn" : "is-ok");
    issues.forEach(i => {
        const li = document.createElement("li");
        li.className = "rp-issue rp-" + i.level;
        const b = document.createElement("strong");
        b.textContent = (i.level === "warn" ? "注意　" : "お知らせ　") + i.title;
        const d = document.createElement("span");
        d.textContent = i.detail;
        li.append(b, d);
        ul.appendChild(li);
    });
    const tbl = document.createElement("table");
    tbl.className = "rm-table";
    const hd = document.createElement("tr");
    ["番号", "名前", "ふりがな"].forEach(t => { const th = document.createElement("th"); th.textContent = t; hd.appendChild(th); });
    tbl.appendChild(hd);
    people.slice(0, 6).forEach(x => {
        const tr = document.createElement("tr");
        [String(x.no), x.name, x.furi].forEach(t => { const td = document.createElement("td"); td.textContent = t; tr.appendChild(td); });
        tbl.appendChild(tr);
    });
    pv.appendChild(tbl);
    if (people.length > 6) {
        const more = document.createElement("p");
        more.className = "config-note";
        more.textContent = `ほか${people.length - 6}人`;
        pv.appendChild(more);
    }
}
function applyRosterMap() {
    if (isAppLocked()) { showLockedToast(); return; }
    const people = buildMappedRoster();
    if (people.length === 0) return;
    const list = people.map(x => `${x.no}.${x.name}` + (x.furi ? `（${x.furi}）` : ""));
    rememberRosterMap();
    applyRosterList(list, `ファイルから${people.length}人の名簿を取り込みました。`);
    closeRosterMapModal();
}

// 名簿がない時の最初の案内
document.addEventListener("keydown", function(event) { 
    if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA" || document.activeElement.tagName === "SELECT")) return; 
    
    if (event.code === "Space" || event.key === " ") { 
        if (isAnnounceOpen()) return;
        const rouletteOverlay = $id("rouletteOverlay");
        if (rouletteOverlay && rouletteOverlay.style.display === "flex") {
            event.preventDefault();
            spinRoulette();
            return;
        }
        if (document.body.classList.contains("nomination-active")) { 
            event.preventDefault();
            pickRandomStudent();
            return;
        }
        if (isAppLocked()) return;
        if (Array.from(document.querySelectorAll(".modal-overlay")).some(o => o.style.display === "flex")) return;
        const btnMain = $id("btnMainShuffle") || document.querySelector('.btn-main');
        if(btnMain && btnMain.style.display !== 'none') {
            event.preventDefault(); 
            shuffleSeats(); 
        }
    } 
});

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "roster",
    suggests: ["furigana", "announce"],   // あわせて使うと便利なプラグイン
    name: "名簿の作成・取り込み",
    version: "1.1",
    description: "名簿を表の形で作ったり、貼り付けたり、ファイルの列を指定して取り込めます。",
    stubs: ["analyzeRosterStrings", "decodeRosterFileBuffer", "detectRosterTable", "openRosterMapModal", "parseRosterFileText"]
});
