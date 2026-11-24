// ==========================================
// クラスのまとめ操作プラグイン：全クラスを1つのファイルに書き出す・読み込む、まとめて進級させる、ができます。
// 書き出したファイルには、生徒の名前が入っています。取りあつかいに気をつけてください。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります。クラスの保存・切り替えは、これまでどおりに動きます
// ==========================================
const CB_FORMAT = "sekigae-classes";
const CB_MAX_BYTES = 20 * 1024 * 1024;

function cbEsc(t) { return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function cbToday() { const d = new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0"); }
function cbDownload(name, text, type) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type }));
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
function cbUniqueName(base, presets) {
    if (!Object.prototype.hasOwnProperty.call(presets, base)) return base;
    let n = 2, nm = base + "（取り込み）";
    while (Object.prototype.hasOwnProperty.call(presets, nm)) nm = base + "（取り込み" + (n++) + "）";
    return nm;
}
function cbList(rows) {
    const box = document.createElement("div");
    box.className = "cb-list";
    rows.forEach(r => box.appendChild(r));
    return box;
}

// ---------- 全クラスの書き出し ----------
function cbExportAll() {
    const presets = readPresetsSafe();
    const names = Object.keys(presets);
    if (!names.length) { showToast("書き出せるクラスがありません。先に、クラスを保存してください。", "error"); return; }
    presetDialog({
        title: "全クラスを書き出す",
        message: `保存してある ${names.length} クラスの、名簿と設定を、1つのファイルにまとめます。生徒の名前が入るので、ファイルの取りあつかいに気をつけてください。`,
        check: { label: "これまでの記録（指名・席の履歴）も、入れる", checked: true },
        buttons: [
            { label: "キャンセル", value: "cancel", cls: "btn-secondary" },
            { label: "書き出す", value: "ok", cls: "btn-connect is-primary", primary: true }
        ]
    }, (v, r) => {
        if (v !== "ok") return;
        const queueRaw = typeof nqRaw === "function" ? nqRaw() : { lists: {} };
        const classes = names.map(name => {
            const item = { name: name, preset: presets[name] };
            if (r.checked) { try { item.records = getRecordsForClass(name) || {}; } catch (e) { item.records = {}; } }
            if (queueRaw.lists && queueRaw.lists[name]) item.queue = queueRaw.lists[name];
            try { const c = localStorage.getItem("gas_student_cache_" + name); if (c !== null) item.gasCache = c; } catch (e) { /* 入れない */ }
            return item;
        });
        const data = { format: CB_FORMAT, version: 1, exportedAt: new Date().toISOString(), appVersion: (typeof APP_VERSION !== "undefined" ? APP_VERSION : ""), classes: classes };
        cbDownload("席替えし太郎_全クラス_" + cbToday() + ".json", JSON.stringify(data), "application/json");
        showToast(names.length + " クラスを書き出しました。", "success");
    });
}

// ---------- 読み込み ----------
function cbPickFile() {
    if (isAppLocked()) { showLockedToast(); return; }
    const inp = $id("classBulkFile");
    if (!inp) return;
    inp.value = "";
    inp.click();
}
function cbText(v, max) { return typeof v === "string" ? v.slice(0, max) : ""; }
function cbObj(v) { return v && typeof v === "object" && !Array.isArray(v) ? v : {}; }
// ファイルの中の、クラス1件を、安全な形に整えます（知らない項目は、捨てます）
function cbCleanPreset(p) {
    p = cbObj(p);
    const out = {
        gasUrl: cbText(p.gasUrl, 500),
        cols: String(Math.max(1, Math.min(12, parseInt(p.cols, 10) || 6))),
        rows: String(Math.max(1, Math.min(12, parseInt(p.rows, 10) || 6))),
        emptySeats: cbText(p.emptySeats, 500),
        students: cbText(p.students, 200000),
        groupType: cbText(p.groupType, 20) || "column",
        groupColorToggle: p.groupColorToggle === true,
        groupNames: {}, groupColors: {}, manualGroupMap: {}
    };
    const gc = parseInt(p.groupCount, 10);
    if (gc >= 2 && gc <= 8) out.groupCount = gc;
    const gn = cbObj(p.groupNames), gcol = cbObj(p.groupColors), mm = cbObj(p.manualGroupMap);
    for (let i = 1; i <= 8; i++) {
        if (typeof gn[i] === "string") out.groupNames[i] = gn[i].slice(0, 40);
        if (typeof gcol[i] === "string" && /^#[0-9a-fA-F]{3,8}$/.test(gcol[i])) out.groupColors[i] = gcol[i];
    }
    Object.keys(mm).slice(0, 2000).forEach(k => { if (typeof mm[k] === "number" || typeof mm[k] === "string") out.manualGroupMap[k.slice(0, 100)] = mm[k]; });
    if (p.archived === true) out.archived = true;
    if (p.pinned === true) out.pinned = true;
    if (typeof p.lastUsed === "number" && isFinite(p.lastUsed)) out.lastUsed = p.lastUsed;
    return out;
}
function cbCleanRecords(r) {
    r = cbObj(r);
    const out = {};
    CLASS_RECORD_KEYS.forEach(k => { if (typeof r[k] === "string" && r[k].length < 8 * 1024 * 1024) out[k] = r[k]; });
    return out;
}
function cbParse(text) {
    let d = null;
    try { d = JSON.parse(text); } catch (e) { return { error: "ファイルを読めませんでした。「全クラスを書き出す」で作ったファイルを選んでください。" }; }
    if (!d || d.format !== CB_FORMAT || !Array.isArray(d.classes)) return { error: "このファイルは、「全クラスを書き出す」で作ったものではないようです。" };
    const list = [];
    const seen = new Set();
    d.classes.slice(0, 200).forEach(c => {
        const name = c && typeof c.name === "string" ? c.name.trim().slice(0, 60) : "";
        if (!name || name === TRIAL_CLASS_ID || name === "__proto__" || seen.has(name)) return;
        seen.add(name);
        list.push({
            name: name,
            preset: cbCleanPreset(c.preset),
            records: c.records ? cbCleanRecords(c.records) : null,
            queue: Array.isArray(c.queue) ? c.queue.filter(x => typeof x === "string" && x).slice(0, 200) : null,
            gasCache: typeof c.gasCache === "string" && c.gasCache.length < 2 * 1024 * 1024 ? c.gasCache : null
        });
    });
    if (!list.length) return { error: "ファイルの中に、読み込めるクラスがありませんでした。" };
    return { classes: list };
}
function cbHandleFile(file) {
    if (!file) return;
    if (file.size > CB_MAX_BYTES) { showToast("ファイルが大きすぎて、読み込めません。", "error"); return; }
    const fr = new FileReader();
    fr.onload = () => {
        const res = cbParse(String(fr.result || ""));
        if (res.error) { showToast(res.error, "error"); return; }
        cbImportDialog(res.classes);
    };
    fr.onerror = () => showToast("ファイルを読めませんでした。", "error");
    fr.readAsText(file);
}
function cbImportDialog(classes) {
    const presets = readPresetsSafe();
    const body = document.createElement("div");
    const rows = classes.map((c, i) => {
        const lab = document.createElement("label");
        lab.className = "cb-row";
        const exists = Object.prototype.hasOwnProperty.call(presets, c.name);
        const cnt = (() => { try { return splitRosterRaw(c.preset.students).filter(x => x.trim()).length; } catch (e) { return 0; } })();
        lab.innerHTML = '<input type="checkbox" data-i="' + i + '" checked><span class="cb-name">' + cbEsc(c.name) + '</span>'
            + '<span class="cb-meta">' + (cnt ? cnt + "人" : "名簿なし") + (c.records && Object.keys(c.records).length ? "・記録あり" : "") + '</span>'
            + (exists ? '<span class="cb-tag">同じ名前あり</span>' : "");
        return lab;
    });
    body.appendChild(cbList(rows));
    const pol = document.createElement("div");
    pol.className = "cb-policy";
    pol.innerHTML = '<div class="cb-policy-title">同じ名前のクラスが、すでにあるとき</div>'
        + '<label><input type="radio" name="cbPolicy" value="rename" checked> 別の名前で追加する（おすすめ）</label>'
        + '<label><input type="radio" name="cbPolicy" value="overwrite"> ファイルの内容で、上書きする</label>'
        + '<label><input type="radio" name="cbPolicy" value="skip"> 読み込まない</label>';
    body.appendChild(pol);
    presetDialog({
        title: "クラスを読み込む",
        message: "読み込むクラスを選んでください。",
        bodyEl: body,
        buttons: [
            { label: "キャンセル", value: "cancel", cls: "btn-secondary" },
            { label: "読み込む", value: "ok", cls: "btn-connect is-primary", primary: true }
        ]
    }, v => {
        if (v !== "ok") return;
        const picked = [...body.querySelectorAll(".cb-row input:checked")].map(e => classes[parseInt(e.dataset.i, 10)]).filter(Boolean);
        const policy = (body.querySelector('input[name="cbPolicy"]:checked') || {}).value || "rename";
        cbApplyImport(picked, policy);
    });
}
function cbApplyImport(picked, policy) {
    if (!picked.length) { showToast("読み込むクラスが選ばれていません。", "error"); return; }
    if (isAppLocked()) { showLockedToast(); return; }
    const presets = readPresetsSafe();
    const store = readClassRecordStore();
    const queueRaw = typeof nqRaw === "function" ? nqRaw() : null;
    let added = 0, over = 0, renamed = 0, skipped = 0, busy = 0;
    picked.forEach(c => {
        let name = c.name;
        const exists = Object.prototype.hasOwnProperty.call(presets, name);
        if (exists) {
            if (policy === "skip") { skipped++; return; }
            if (policy === "overwrite") {
                if (name === activeClassId) { busy++; return; }   // いま開いているクラスは、上書きしません
                over++;
            } else { name = cbUniqueName(name, presets); renamed++; }
        } else added++;
        presets[name] = c.preset;
        if (c.records) store[name] = c.records;
        if (queueRaw && c.queue) queueRaw.lists[name] = c.queue;
        try { if (c.gasCache !== null) localStorage.setItem("gas_student_cache_" + name, c.gasCache); } catch (e) { /* そのまま続ける */ }
    });
    savePresetsObject(presets);
    writeClassRecordStore(store);
    if (queueRaw && typeof nqWriteRaw === "function") nqWriteRaw(queueRaw);
    updatePresetRadioButtons();
    const parts = [];
    const total = added + over + renamed;
    parts.push(total + " クラスを読み込みました");
    if (renamed) parts.push(renamed + " 件は、同じ名前があったので、別の名前で追加");
    if (over) parts.push(over + " 件は上書き");
    if (skipped) parts.push(skipped + " 件は読み込まず");
    if (busy) parts.push(busy + " 件は、いま開いているクラスなので、上書きせず");
    showToast(parts.join("。") + "。", total ? "success" : "error");
}

// ---------- まとめて進級 ----------
function cbPromoteAll() {
    if (isAppLocked()) { showLockedToast(); return; }
    const presets = readPresetsSafe();
    const names = Object.keys(presets).filter(n => !presets[n].archived);
    if (!names.length) { showToast("進級させられるクラスがありません。", "error"); return; }
    const body = document.createElement("div");
    const rows = names.map((n, i) => {
        const row = document.createElement("div");
        row.className = "cb-row cb-promo-row";
        const sug = suggestNextGradeName(n);
        row.innerHTML = '<label class="cb-promo-pick"><input type="checkbox" data-i="' + i + '"' + (sug ? " checked" : "") + '><span class="cb-name">' + cbEsc(n) + '</span></label>'
            + '<span class="cb-arrow" aria-hidden="true">→</span>'
            + '<input type="text" class="cb-newname" data-i="' + i + '" value="' + cbEsc(sug) + '" placeholder="新しいクラス名" aria-label="' + cbEsc(n) + 'の、新しいクラス名">';
        return row;
    });
    body.appendChild(cbList(rows));
    const opt = document.createElement("div");
    opt.className = "cb-policy";
    opt.innerHTML = '<label><input type="checkbox" id="cbPromoArchive" checked> 古いクラスは、「去年度のクラス」にする</label>'
        + '<label><input type="checkbox" id="cbPromoRoster"> 名簿も、新しいクラスにコピーする（はずすと、名簿は空から）</label>'
        + '<div class="cb-note">座席の数や班の設定は、コピーされます。記録（指名・席の履歴）は、古いクラスに残り、新しいクラスは、まっさらから始まります。名前の「1年」のような数字は、自動で次の学年にしています。</div>';
    body.appendChild(opt);
    const ask = (err) => presetDialog({
        title: "まとめて進級",
        message: err || "進級させるクラスにチェックを入れて、新しいクラスの名前を決めてください。",
        bodyEl: body,
        buttons: [
            { label: "キャンセル", value: "cancel", cls: "btn-secondary" },
            { label: "進級させる", value: "ok", cls: "btn-connect is-primary", primary: true }
        ]
    }, v => {
        if (v !== "ok") return;
        const sel = [...body.querySelectorAll(".cb-promo-pick input:checked")].map(e => parseInt(e.dataset.i, 10));
        if (!sel.length) { showToast("進級させるクラスが選ばれていません。", "error"); return; }
        const used = new Set(Object.keys(readPresetsSafe()));
        const pairs = [];
        for (const i of sel) {
            const nn = (body.querySelector('.cb-newname[data-i="' + i + '"]').value || "").trim();
            let err = "";
            if (!nn) err = "「" + names[i] + "」の、新しいクラス名を入れてください。";
            else if (nn === TRIAL_CLASS_ID || nn === "__proto__") err = "「" + nn + "」は、名前に使えません。";
            else if (used.has(nn)) err = "「" + nn + "」というクラスは、もうあります。別の名前にしてください。";
            if (err) { ask(err); return; }
            used.add(nn);
            pairs.push([names[i], nn]);
        }
        cbApplyPromote(pairs, !!body.querySelector("#cbPromoArchive").checked, !!body.querySelector("#cbPromoRoster").checked);
    });
    ask("");
}
function cbApplyPromote(pairs, archiveOld, copyRoster) {
    const presets = readPresetsSafe();
    pairs.forEach(([old, next]) => {
        if (!presets[old]) return;
        // いま開いているクラスは、画面の内容（保存前の変更も）を元にします
        const base = (old === activeClassId && typeof buildPresetFromUI === "function") ? buildPresetFromUI(presets[old]) : presets[old];
        const copy = JSON.parse(JSON.stringify(base));
        delete copy.archived; delete copy.pinned; delete copy.lastUsed;
        if (!copyRoster) { copy.students = ""; copy.manualGroupMap = {}; }
        presets[next] = copy;
        if (archiveOld) presets[old].archived = true;
    });
    savePresetsObject(presets);
    updatePresetRadioButtons();
    showToast(pairs.length + " クラスを、進級させました。" + (archiveOld ? "古いクラスは、「去年度のクラス」に移しています。" : ""), "success");
}

const CB_CSS = `
.cb-list { display: flex; flex-direction: column; gap: 6px; max-height: 36vh; overflow-y: auto; margin: 4px 0 12px; padding-right: 2px; }
.cb-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border: 1px solid var(--seat-border); border-radius: 10px; background: var(--input-bg); color: var(--input-text); font-size: 14px; font-weight: 700; cursor: pointer; }
.cb-row .cb-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cb-row .cb-meta { flex: none; font-size: 12px; font-weight: 600; color: var(--text-sub); }
.cb-row .cb-tag { flex: none; font-size: 11px; font-weight: 800; color: #b45309; border: 1px solid currentColor; border-radius: 999px; padding: 0 7px; }
.cb-promo-row { cursor: default; }
.cb-stack { grid-template-columns: 1fr !important; }
.cb-promo-pick { display: flex; align-items: center; gap: 8px; flex: 1 1 50%; min-width: 0; margin: 0; cursor: pointer; }
.cb-arrow { flex: none; color: var(--text-sub); }
.cb-newname { flex: 1 1 50%; min-width: 0; width: auto !important; margin: 0 !important; padding: 6px 8px !important; font-size: 14px !important; }
.cb-policy { display: flex; flex-direction: column; gap: 8px; margin-bottom: 12px; font-size: 13px; font-weight: 600; color: var(--text-main); }
.cb-policy label { display: flex; align-items: center; gap: 8px; cursor: pointer; }
.cb-policy-title { font-weight: 800; }
.cb-note { font-size: 12px; color: var(--text-sub); line-height: 1.6; font-weight: 600; }
.cb-row input[type="checkbox"], .cb-policy input[type="checkbox"] { width: 18px; height: 18px; flex: none; margin: 0; }
.cb-policy input[type="radio"] { width: 16px; height: 16px; flex: none; margin: 0; }
`;
const CB_HTML = `
<div class="preset-manage-row cb-stack">
    <button type="button" id="btnClassBulkExport" onclick="cbExportAll()" class="btn-secondary">全クラスを書き出す</button>
    <button type="button" id="btnClassBulkImport" onclick="cbPickFile()" class="btn-secondary">ファイルからクラスを読み込む</button>
</div>
<div class="preset-manage-row cb-stack">
    <button type="button" id="btnClassBulkPromote" onclick="cbPromoteAll()" class="btn-secondary">まとめて進級</button>
</div>
<input type="file" id="classBulkFile" accept=".json,application/json" hidden>`;

SekigaeApp.registerPlugin({
    id: "class-bulk",
    name: "クラスのまとめ操作",
    version: "1.0",
    description: "全クラスを1つのファイルに書き出す・読み込む、まとめて進級させる、ができます。",
    searchWords: "クラス まとめて 一括 書き出し 読み込み バックアップ 引っ越し 進級 年度 新学期 去年度 取り込み",
    mount(app) {
        const st = document.createElement("style");
        st.id = "cbStyle";
        st.textContent = CB_CSS;
        document.head.appendChild(st);
        app.insertInto("settings-classes", CB_HTML);
        const inp = $id("classBulkFile");
        if (inp) inp.addEventListener("change", () => cbHandleFile(inp.files && inp.files[0]));
    }
});
