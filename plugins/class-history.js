// ==========================================
// クラスの保存履歴プラグイン：クラスを保存して上書きするたびに、前の状態を自動で残して、あとから戻せます。
// 名簿を消してしまった、座席数を変えすぎた、という時の保険です。1クラスにつき、直近8回分を残します。
// このファイルを index.html から外すと、履歴は残らなくなり、見られなくなります。クラスの保存は、これまでどおり使えます
// ==========================================
const CHIST_KEY = "class_history_v1";   // { クラス名: [ { t: 保存した時刻, p: その時のクラスの内容 } ] }（新しい順）
const CHIST_MAX = 8;
const CHIST_FIELDS = ["gasUrl", "cols", "rows", "emptySeats", "students", "groupType", "groupColorToggle", "groupNames", "groupColors", "groupCount", "manualGroupMap"];

function chistEsc(t) { return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function chistAll() {
    try {
        const v = JSON.parse(localStorage.getItem(CHIST_KEY) || "{}");
        return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch (e) { return {}; }
}
function chistWrite(all) {
    // 空きが足りない時は、古い履歴から減らして、もう一度ためす
    for (let i = 0; i < 6; i++) {
        try { localStorage.setItem(CHIST_KEY, JSON.stringify(all)); return true; } catch (e) {
            let longest = null;
            Object.keys(all).forEach(k => { if (!longest || all[k].length > all[longest].length) longest = k; });
            if (!longest || all[longest].length <= 1) return false;
            all[longest] = all[longest].slice(0, Math.max(1, Math.floor(all[longest].length / 2)));
        }
    }
    return false;
}
function chistContent(p) {
    const o = {};
    CHIST_FIELDS.forEach(k => { if (p && p[k] !== undefined) o[k] = JSON.parse(JSON.stringify(p[k])); });
    return o;
}
function chistSig(p) {
    try { return presetSignature(p, true); } catch (e) { return JSON.stringify(CHIST_FIELDS.map(k => p ? p[k] : null)); }
}

// 保存される前に、変わるクラスの「いまの状態」を、履歴に残す
function chistRecord(next) {
    const old = readPresetsSafe();
    const all = chistAll();
    let changed = false;
    Object.keys(next || {}).forEach(name => {
        const o = old[name], n = next[name];
        if (!o || !n || chistSig(o) === chistSig(n)) return;
        const list = Array.isArray(all[name]) ? all[name] : [];
        if (list.length && chistSig(list[0].p) === chistSig(o)) return;
        list.unshift({ t: Date.now(), p: chistContent(o) });
        all[name] = list.slice(0, CHIST_MAX);
        changed = true;
    });
    if (changed) chistWrite(all);
}
function chistRenameClass(oldName, newName) {
    const all = chistAll();
    if (all[oldName]) { all[newName] = all[oldName]; delete all[oldName]; chistWrite(all); }
}
function chistRemoveClass(name) {
    const all = chistAll();
    if (all[name]) { delete all[name]; chistWrite(all); }
}

function chistCount(p) { try { return splitRosterRaw((p && p.students) || "").filter(x => x.trim()).length; } catch (e) { return 0; } }
function chistWhen(t) {
    const d = new Date(t);
    return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
}
function chistSummary(p) {
    const n = chistCount(p);
    return `名簿 ${n}人・座席 ${p.cols || 6}列×${p.rows || 6}行`;
}
// いまのクラスとの違い
function chistDiff(p, cur) {
    const out = [];
    const a = chistCount(p), b = chistCount(cur);
    if (((p.students || "").trim()) !== ((cur.students || "").trim())) out.push(a === b ? "名簿" : `名簿（${a}人 → 今${b}人）`);
    if (String(p.cols || 6) !== String(cur.cols || 6) || String(p.rows || 6) !== String(cur.rows || 6)) out.push(`座席数（${p.cols || 6}×${p.rows || 6} → 今${cur.cols || 6}×${cur.rows || 6}）`);
    if ((p.emptySeats || "") !== (cur.emptySeats || "")) out.push("空席");
    const grp = x => JSON.stringify([x.groupType || "column", !!x.groupColorToggle, x.groupCount || 8, x.groupNames || {}, x.groupColors || {}, x.manualGroupMap || {}]);
    if (grp(p) !== grp(cur)) out.push("班の設定");
    if ((p.gasUrl || "") !== (cur.gasUrl || "")) out.push("GASのURL");
    return out;
}

function chistOpen() {
    const name = typeof getSelectedPresetName === "function" ? getSelectedPresetName() : "";
    if (!name || !readPresetsSafe()[name]) { showToast("履歴を見たいクラスを選んでください", "error"); return; }
    const list = chistAll()[name] || [];
    const cur = readPresetsSafe()[name];
    const body = document.createElement("div");
    body.className = "chist-list";
    if (!list.length) {
        const p = document.createElement("p");
        p.className = "chist-empty";
        p.textContent = "まだ、履歴はありません。クラスを保存して内容が変わるたびに、前の状態を自動で残します。";
        body.appendChild(p);
    }
    list.forEach((e, i) => {
        const row = document.createElement("div");
        row.className = "chist-row";
        const main = document.createElement("div");
        main.className = "chist-main";
        const t = document.createElement("div");
        t.className = "chist-when";
        t.textContent = chistWhen(e.t) + "より前の状態";
        main.appendChild(t);
        const s = document.createElement("div");
        s.className = "chist-sum";
        s.textContent = chistSummary(e.p);
        main.appendChild(s);
        const d = chistDiff(e.p, cur);
        const dd = document.createElement("div");
        dd.className = "chist-diff";
        dd.textContent = d.length ? "今との違い：" + d.join("、") : "今と同じ内容です";
        main.appendChild(dd);
        row.appendChild(main);
        const b = document.createElement("button");
        b.type = "button";
        b.className = "btn-secondary chist-restore";
        b.textContent = "戻す";
        b.disabled = !d.length;
        b.addEventListener("click", () => {
            const c = document.querySelector('#presetDialogOverlay button[data-value="close"]');
            if (c) c.click();
            chistConfirmRestore(name, i);
        });
        row.appendChild(b);
        body.appendChild(row);
    });
    presetDialog({
        title: `クラス「${name}」の保存履歴`,
        message: list.length ? "戻したい状態の「戻す」を押してください。今の状態も履歴に残ります。" : "",
        bodyEl: body,
        buttons: [{ label: "閉じる", value: "close", cls: "btn-secondary", primary: true }]
    }, () => {});
}

function chistConfirmRestore(name, idx) {
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return; }
    const e = (chistAll()[name] || [])[idx];
    if (!e) return;
    presetDialog({
        title: "この状態に戻しますか？",
        message: `クラス「${name}」を、${chistWhen(e.t)}より前の状態（${chistSummary(e.p)}）に戻します。今の状態は履歴に残るのであとから戻せます。画面で変えて、まだ保存していない内容は、消えます。`,
        buttons: [
            { label: "やめる", value: "cancel", cls: "btn-secondary" },
            { label: "戻す", value: "ok", cls: "btn-connect is-primary", primary: true }
        ]
    }, v => {
        if (v !== "ok") { chistOpen(); return; }
        chistRestore(name, idx);
    });
}

function chistRestore(name, idx) {
    const e = (chistAll()[name] || [])[idx];
    const presets = readPresetsSafe();
    const cur = presets[name];
    if (!e || !cur) return;
    const keep = {};
    ["archived", "pinned", "lastUsed", "csettings"].forEach(k => { if (cur[k] !== undefined) keep[k] = cur[k]; });
    presets[name] = { ...keep, ...chistContent(e.p) };
    savePresetsObject(presets);   // ここで、今の状態が履歴に残ります
    loadPreset(name);
    if (typeof updatePresetRadioButtons === "function") updatePresetRadioButtons();
    showToast(`クラス「${name}」を、${chistWhen(e.t)}より前の状態に戻しました`, "success");
}

const CHIST_CSS = `
.chist-list { display: flex; flex-direction: column; gap: 8px; max-height: 50vh; overflow-y: auto; margin: 8px 0 12px; text-align: left; }
.chist-empty { margin: 0; color: var(--text-sub); font-size: 13px; font-weight: 600; line-height: 1.6; }
.chist-row { display: flex; align-items: center; gap: 10px; padding: 8px 8px 8px 12px; border: 1px solid var(--seat-border); border-radius: 12px; background: var(--card-bg, var(--input-bg)); }
.chist-main { flex: 1; min-width: 0; }
.chist-when { font-weight: 800; font-size: 14px; color: var(--input-text); }
.chist-sum { margin-top: 2px; font-size: 12px; font-weight: 700; color: var(--input-text); }
.chist-diff { margin-top: 2px; font-size: 12px; font-weight: 600; color: var(--text-sub); line-height: 1.5; }
.modal-content .chist-row button.chist-restore { flex: none; width: auto !important; min-width: 64px !important; height: 36px !important; min-height: 36px !important; padding: 0 14px !important; margin: 0 !important; font-size: 14px !important; font-weight: 700 !important; }
.modal-content .chist-row button.chist-restore:disabled { opacity: 0.4; }
.chist-title { margin: 16px 0 4px; font-size: 14px; font-weight: 700; color: var(--text-main); }
#chistBtn { margin-top: 10px; }
`;
const CHIST_HTML = `
<div class="chist-block">
    <h4 class="chist-title">クラスの保存履歴</h4>
    <p class="config-note">クラスを保存して内容が変わるたびに、前の状態を自動で残します（直近${CHIST_MAX}回分）。名簿を消してしまった時などに、戻せます。</p>
    <button type="button" id="chistBtn" onclick="chistOpen()" class="btn-secondary">選んでいるクラスの履歴を見る</button>
</div>`;

SekigaeApp.registerPlugin({
    id: "class-history",
    name: "クラスの保存履歴",
    version: "1.0",
    description: "クラスを保存するたびに、前の状態を自動で残して、あとから戻せます。名簿や座席数を変えすぎた時の保険です。",
    backupKeys: [CHIST_KEY],
    searchWords: "クラス 保存 履歴 戻す 元に戻す 復元 バックアップ 名簿 間違えて 消した やり直し 前の状態",
    mount(app) {
        const st = document.createElement("style");
        st.id = "chistStyle";
        st.textContent = CHIST_CSS;
        document.head.appendChild(st);
        app.insertInto("settings-classes", CHIST_HTML);
        // クラスの保存データが書きかわる前に、前の状態を履歴に残す
        const prevSave = window.savePresetsObject;
        window.savePresetsObject = function (presets) {
            try { if (SekigaeApp.isEnabled("class-history")) chistRecord(presets); } catch (e) { /* 履歴が残せなくても、保存はそのまま続ける */ }
            return prevSave.apply(this, arguments);
        };
    }
});
