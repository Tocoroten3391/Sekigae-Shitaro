// ==========================================
// 構成プリセットプラグイン：使う機能の組み合わせを、ワンタッチで切りかえます。
// 「かんたん」「授業用」「年度はじめ」「電子黒板」「指名・発表」「フル」のほかに、いまの構成に名前をつけて、保存できます。
// 画面に出る部品が減るので、動きも、少し軽くなります。切りかえは、再読み込みのあとに反映されます
// このファイルを index.html から外しても、プラグインのオン・オフは、これまでどおりに使えます
// ==========================================
const PRESET_KEY = "plugin_presets_v1";   // [{ id, name, off: [オフにするプラグインの id] }]
// 絵文字に目印をつけます。画面スタイルが「シンプル」「黒板」のときは、線のアイコンに置きかわります
const PRESET_ICO = { "🌱": "sprout", "🎒": "bag", "🌸": "flower", "📺": "monitor", "🎤": "mic", "🧰": "toolbox", "💾": "save", "📤": "export", "📥": "import" };
function presetIco(e) { const k = PRESET_ICO[e]; return k ? '<span class="pico" data-pico="' + k + '" aria-hidden="true">' + e + '</span>' : e; }
const PRESET_BUILTIN = [
    { id: "easy", name: "簡単", icon: "🌱", note: "席替えとタイマーだけ。名簿を作る機能、欠席者の選択、結果のチェック、画像・PDFの保存、案内ツアーだけを足しています。はじめて使う先生向けです。",
      on: ["timer", "absent", "roster", "seatcheck", "print", "seat-export", "tour"] },
    { id: "class", name: "授業用", icon: "🎒", note: "毎日の授業で使う機能だけ。席替えの確認、発表、印刷、共有、タイマー、プログラムタイマー、指名の偏り防止、席の公平性レポート、画像・PDFの保存、席替えの予約、座席の希望メモが入っています。",
      on: ["timer", "program-timer", "absent", "roster", "softkeypad", "seatcheck", "compare", "preview", "announce", "roulette", "nomination-balance", "seat-fairness", "seatnote", "history", "term", "print", "share", "seat-export", "schedule", "seat-wishes", "menu-groups", "display-scale", "settings-extras"] },
    { id: "start", name: "年度はじめ", icon: "🌸", note: "新しいクラスの座席を決める時の構成です。名簿づくり、席替えの確認、前回との比較、教室の配置、座席の希望メモ、座席表の保存と共有が入っています。",
      on: ["roster", "absent", "seatcheck", "compare", "preview", "roomlayout", "seat-wishes", "seatnote", "reasons", "seat-fairness", "history", "print", "seat-export", "share", "schedule", "settings-extras"] },
    { id: "board", name: "電子黒板", icon: "📺", note: "電子黒板や大型モニターを使う授業の構成です。拡張画面、画面の大きさ、席替えの発表、タイマー、プログラムタイマー、ルーレット、指名の偏り防止が入っています。",
      on: ["second-screen", "display-scale", "announce", "timer", "program-timer", "roulette", "nomination-balance", "absent", "seatcheck", "preview", "roomlayout", "seat-export", "settings-extras", "menu-groups"] },
    { id: "speak", name: "指名・発表", icon: "🎤", note: "指名や発表が中心の授業の構成です。指名の偏り防止、ルーレット、タイマー、画面のテンキー、拡張画面が入っています。",
      on: ["nomination-balance", "roulette", "timer", "softkeypad", "absent", "announce", "second-screen", "display-scale", "seatnote"] },
    { id: "full", name: "フル", icon: "🧰", note: "入っている機能を、全てオンにします。", on: null }
];

function presetEsc(t) { return String(t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])); }
function presetLoadCustom() {
    try { const v = JSON.parse(lsGet(PRESET_KEY, "[]")); return Array.isArray(v) ? v.filter(p => p && p.id && p.name && Array.isArray(p.off)) : []; } catch (e) { return []; }
}
function presetSaveCustom(list) { lsSet(PRESET_KEY, JSON.stringify(list)); }

// 切りかえの対象になるプラグイン（必須ではないもの。このプラグイン自身と、プラグインメニュー強化は、いつもオンのままにします）
function presetTargets() {
    return SekigaeApp.plugins.filter(p => !p.required && p.id !== "plugin-presets" && p.id !== "plugin-menu");
}
function presetOffListOf(preset) {
    const ids = presetTargets().map(p => p.id);
    if (preset.on === null) return [];
    if (Array.isArray(preset.on)) return ids.filter(id => !preset.on.includes(id));
    return ids.filter(id => preset.off.includes(id));
}
function presetCurrentOff() {
    return presetTargets().map(p => p.id).filter(id => !SekigaeApp.isEnabled(id));
}
function presetSameSet(a, b) { return a.length === b.length && a.every(x => b.includes(x)); }
function presetMatchName() {
    const cur = presetCurrentOff();
    const hit = PRESET_BUILTIN.concat(presetLoadCustom()).find(p => presetSameSet(presetOffListOf(p), cur));
    return hit ? hit.name : "";
}

function presetApply(id) {
    if (typeof isAppLocked === "function" && isAppLocked()) { if (typeof showLockedToast === "function") showLockedToast(); return; }
    const p = PRESET_BUILTIN.concat(presetLoadCustom()).find(x => x.id === id);
    if (!p) return;
    const off = presetOffListOf(p);
    const before = presetCurrentOff();
    if (presetSameSet(off, before)) { showToast("今の構成と、同じです。", "info"); return; }
    presetTargets().forEach(pl => SekigaeApp.setEnabled(pl.id, !off.includes(pl.id)));
    // 「かんたん」は、案内ツアーとセットです。次に読み込んだ時に、案内をはじめるか、たずねます
    if (p.id === "easy") { lsSet("tour_force_v1", "1"); try { localStorage.removeItem("tour_done_v1"); } catch (e) { /* 何もしない */ } }
    renderPresetBox();
    SekigaeApp.renderPluginList();
    const on = presetTargets().length - off.length;
    if (confirm("「" + p.name + "」に切りかえます（機能は " + on + " 個がオン）。\n反映するには、再読み込みが必要です。今再読み込みしますか？")) {
        SekigaeApp.reloadNow();
    } else {
        showToast("「" + p.name + "」を選びました。再読み込みの後に、反映されます。", "success");
    }
}
function presetSaveCurrent() {
    const name = (prompt("今の構成に、名前を付けます。\n例：5年1組用") || "").trim();
    if (!name) return;
    const list = presetLoadCustom();
    if (list.length >= 8) { showToast("保存できる構成は、最大8個までです。", "error"); return; }
    list.push({ id: "pc_" + Date.now().toString(36), name: name.slice(0, 20), off: presetCurrentOff() });
    presetSaveCustom(list);
    renderPresetBox();
    showToast("「" + name.slice(0, 20) + "」を保存しました。", "success");
}
function presetDelete(id) {
    const list = presetLoadCustom();
    const p = list.find(x => x.id === id);
    if (!p || !confirm("保存した構成「" + p.name + "」を削除します。よろしいですか？")) return;
    presetSaveCustom(list.filter(x => x.id !== id));
    renderPresetBox();
}

// ---- 構成の書き出し・読み込み（ファイルにして、ほかの先生に配れます） ----
const PRESET_FILE_KIND = "sekigae-plugin-config";
const PRESET_MAX = 8;
const PRESET_SELF = ["plugin-presets", "plugin-menu"];
let presetImported = null;      // 読み込んだファイルの中身（確かめたあと）

const PRESET_IO_HTML = `
<div id="presetIoOverlay" class="modal-overlay" style="display: none;" onclick="if (event.target === this) closePresetIo()">
    <div class="modal-content" style="max-width: 520px; width: 95%;">
        <h4 style="color: var(--uis-head, #0891b2);" id="presetIoTitle">構成の書き出し・読み込み</h4>
        <div id="presetIoExport">
            <p class="config-note" data-keep="1" style="margin: -6px 0 10px;">選んだ構成を、ファイルにして保存します。そのファイルを、学年のほかの先生に渡すと、同じ構成を読み込めます。</p>
            <div id="presetIoChoices"></div>
            <div class="modal-btn-row"><button type="button" class="btn-secondary" onclick="presetDoExport()">${presetIco("📤")} 書き出す</button></div>
        </div>
        <div id="presetIoImport">
            <p class="config-note" data-keep="1" style="margin: -6px 0 10px;">書き出した構成のファイル（.json）を選びます。読み込んでも、すぐには切りかわりません。内容を見てから、「保存する」か「この構成に切りかえる」を選べます。</p>
            <input type="file" id="presetIoFile" accept=".json,application/json" style="display: none;" onchange="presetReadFile(this)">
            <div class="modal-btn-row"><button type="button" class="btn-secondary" onclick="document.getElementById('presetIoFile').click()">${presetIco("📥")} ファイルをえらぶ</button></div>
            <div id="presetIoPreview"></div>
        </div>
        <div class="modal-btn-row"><button type="button" class="btn-secondary" onclick="closePresetIo()">閉じる</button></div>
    </div>
</div>`;

function openPresetIo(mode) {
    const ov = $id("presetIoOverlay");
    if (!ov) return;
    const exp = mode !== "import", imp = mode !== "export";
    $id("presetIoExport").style.display = exp ? "" : "none";
    $id("presetIoImport").style.display = imp ? "" : "none";
    $id("presetIoTitle").textContent = mode === "export" ? "構成を書き出す" : (mode === "import" ? "構成を読み込む" : "構成の書き出し・読み込み");
    presetImported = null;
    $id("presetIoPreview").innerHTML = "";
    if (exp) presetRenderExportChoices();
    ov.style.display = "flex";
}
function closePresetIo() { const ov = $id("presetIoOverlay"); if (ov) ov.style.display = "none"; }

function presetRenderExportChoices() {
    const total = presetTargets().length, cur = presetCurrentOff();
    const custom = presetLoadCustom();
    const row = (val, label, small, checked) => '<label class="preset-io-choice"><input type="radio" name="presetIoSel" value="' + presetEsc(val) + '"' + (checked ? " checked" : "") + '><span>' + presetEsc(label) + '<small>' + presetEsc(small) + '</small></span></label>';
    const same = presetMatchName();
    let h = row("now", "今の構成", "機能 " + (total - cur.length) + " / " + total + " 個がオン" + (same ? "　（「" + same + "」と同じ）" : ""), true);
    custom.forEach(p => { h += row("c:" + p.id, p.name, "保存した構成　機能 " + (total - presetOffListOf(p).length) + " 個がオン", false); });
    if (custom.length > 1) h += row("all", "保存した構成を、全てまとめて", custom.length + "個を、1つのファイルにします", false);
    $id("presetIoChoices").innerHTML = h;
}
function presetFileConfig(name, off) {
    const ids = presetTargets().map(p => p.id);
    return { name: String(name).slice(0, 20), on: ids.filter(id => !off.includes(id)), off: ids.filter(id => off.includes(id)) };
}
function presetDoExport() {
    const sel = document.querySelector('input[name="presetIoSel"]:checked');
    if (!sel) return;
    const custom = presetLoadCustom();
    let configs = [], label = "";
    if (sel.value === "now") { const nm = presetMatchName() || "今の構成"; configs = [presetFileConfig(nm, presetCurrentOff())]; label = nm; }
    else if (sel.value === "all") { configs = custom.map(p => presetFileConfig(p.name, presetOffListOf(p))); label = "まとめ"; }
    else {
        const p = custom.find(x => "c:" + x.id === sel.value);
        if (!p) return;
        configs = [presetFileConfig(p.name, presetOffListOf(p))];
        label = p.name;
    }
    const names = {};
    SekigaeApp.plugins.forEach(p => { names[p.id] = p.name || p.id; });
    const data = { kind: PRESET_FILE_KIND, format: 1, appVersion: SekigaeApp.version, exportedAt: new Date().toISOString(), names: names, configs: configs };
    const d = new Date();
    const ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }));
    a.download = "席替えし太郎_構成_" + label.replace(/[\\/:*?"<>|\s]+/g, "_") + "_" + ymd + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    showToast("構成 " + configs.length + " 個を、ファイルに書き出しました。", "success");
}

// ファイルの中身を確かめて、この端末で使える形にします（形が違うときは error を返します）
function presetParseFile(obj) {
    if (!obj || obj.kind !== PRESET_FILE_KIND || !Array.isArray(obj.configs)) return { error: "席替えし太郎の構成ファイルでは、ないようです。" };
    if (typeof obj.format === "number" && obj.format > 1) return { error: "新しい形式のファイルです。席替えし太郎を、新しい版にしてから、読み込んでください。" };
    const installed = new Set(presetTargets().map(p => p.id));
    const idOk = x => typeof x === "string" && /^[A-Za-z0-9_-]{1,60}$/.test(x);
    const list = v => Array.isArray(v) ? Array.from(new Set(v.filter(idOk))).slice(0, 300) : [];
    const names = {};
    if (obj.names && typeof obj.names === "object") Object.keys(obj.names).slice(0, 300).forEach(k => { if (idOk(k) && typeof obj.names[k] === "string") names[k] = obj.names[k].slice(0, 30); });
    const configs = obj.configs.slice(0, 20).map(c => {
        if (!c || typeof c.name !== "string") return null;
        const on = list(c.on), off = list(c.off);
        if (!on.length && !off.length) return null;
        return {
            name: c.name.trim().slice(0, 20) || "読み込んだ構成",
            on: on.filter(id => installed.has(id)),
            off: off.filter(id => installed.has(id)),
            missing: on.filter(id => !installed.has(id) && !PRESET_SELF.includes(id))     // この端末に入っていない機能
        };
    }).filter(Boolean);
    if (!configs.length) return { error: "ファイルの中に、読み込める構成が、ありませんでした。" };
    return { configs: configs, names: names };
}
function presetReadFile(input) {
    const f = input.files && input.files[0];
    input.value = "";
    if (!f) return;
    if (f.size > 300 * 1024) { showToast("ファイルが大きすぎます。構成のファイルでは、ないようです。", "error"); return; }
    const fr = new FileReader();
    fr.onload = () => {
        let obj = null;
        try { obj = JSON.parse(String(fr.result)); } catch (e) { obj = null; }
        const r = presetParseFile(obj);
        if (r.error) { presetImported = null; $id("presetIoPreview").innerHTML = '<p class="config-note" data-keep="1" style="color: #b91c1c;">' + presetEsc(r.error) + "</p>"; return; }
        presetImported = r;
        presetRenderImportPreview();
    };
    fr.onerror = () => showToast("ファイルを読めませんでした。", "error");
    fr.readAsText(f);
}
function presetRenderImportPreview() {
    const box = $id("presetIoPreview");
    if (!presetImported) { box.innerHTML = ""; return; }
    const { configs, names } = presetImported;
    let h = '<div class="divider-line" style="margin: 12px 0;"></div>';
    configs.forEach((c, i) => {
        h += '<div class="preset-io-item"><div><strong>' + presetEsc(c.name) + '</strong><small>　機能 ' + c.on.length + ' 個がオン</small></div>';
        if (c.missing.length) h += '<p class="config-note" data-keep="1" style="margin: 4px 0;">この端末に入っていない機能：' + c.missing.map(id => presetEsc(names[id] || id)).join("、") + '（これらは、オンになりません）</p>';
        h += '<div class="preset-row" style="margin-top: 6px;"><button type="button" class="btn-secondary preset-io-btn" onclick="presetImportApply(' + i + ')">この構成に切りかえる</button>' +
            '<button type="button" class="btn-secondary preset-io-btn" onclick="presetImportSave(' + i + ')">' + presetIco("💾") + ' 保存する</button></div></div>';
    });
    if (configs.length > 1) h += '<div class="preset-row" style="margin-top: 8px;"><button type="button" class="btn-secondary preset-io-btn" onclick="presetImportSaveAll()">💾 全て保存する</button></div>';
    box.innerHTML = h;
}
// 保存（保存した構成の一覧に足す）。足せたら true
function presetImportSave(i, quiet) {
    const c = presetImported && presetImported.configs[i];
    if (!c) return false;
    const list = presetLoadCustom();
    if (list.some(p => p.name === c.name && presetSameSet(p.off, c.off))) { if (!quiet) showToast("「" + c.name + "」は、すでに保存されています。", "info"); return true; }
    if (list.length >= PRESET_MAX) { if (!quiet) showToast("保存できる構成は、最大" + PRESET_MAX + "個までです。いらないものを削除してください。", "error"); return false; }
    let name = c.name, n = 2;
    while (list.some(p => p.name === name)) { name = c.name.slice(0, 16) + "（" + n + "）"; n++; }
    list.push({ id: "pc_" + Date.now().toString(36) + i, name: name, off: c.off.slice() });
    presetSaveCustom(list);
    renderPresetBox();
    if (!quiet) showToast("「" + name + "」を保存しました。", "success");
    return true;
}
function presetImportSaveAll() {
    if (!presetImported) return;
    let ok = 0;
    presetImported.configs.forEach((c, i) => { if (presetImportSave(i, true)) ok++; });
    const left = presetImported.configs.length - ok;
    showToast(ok + "個を保存しました。" + (left ? "あと" + left + "個は、上限（" + PRESET_MAX + "個）のため、保存できませんでした。" : ""), left ? "info" : "success");
}
// この構成に切りかえる（ファイルにない機能は、そのままにします）
function presetImportApply(i) {
    if (typeof isAppLocked === "function" && isAppLocked()) { if (typeof showLockedToast === "function") showLockedToast(); return; }
    const c = presetImported && presetImported.configs[i];
    if (!c) return;
    const before = presetCurrentOff().slice();
    presetTargets().forEach(pl => {
        if (c.off.includes(pl.id)) SekigaeApp.setEnabled(pl.id, false);
        else if (c.on.includes(pl.id)) SekigaeApp.setEnabled(pl.id, true);
    });
    if (presetSameSet(before, presetCurrentOff())) { showToast("今の構成と、同じです。", "info"); return; }
    renderPresetBox();
    SekigaeApp.renderPluginList();
    closePresetIo();
    const on = presetTargets().length - presetCurrentOff().length;
    if (confirm("「" + c.name + "」に切りかえます（機能は " + on + " 個がオン）。\n反映するには、再読み込みが必要です。今再読み込みしますか？")) SekigaeApp.reloadNow();
    else showToast("「" + c.name + "」を選びました。再読み込みの後に、反映されます。", "success");
}
document.addEventListener("keydown", e => {
    const o = $id("presetIoOverlay");
    if (e.key === "Escape" && o && o.style.display === "flex") { e.stopPropagation(); closePresetIo(); }
}, true);

function renderPresetBox() {
    const box = $id("presetBox");
    if (!box) return;
    const total = presetTargets().length;
    const cur = presetCurrentOff();
    const matched = presetMatchName();
    const chip = (p, custom) => {
        const off = presetOffListOf(p), on = total - off.length;
        const active = presetSameSet(off, cur);
        return '<span class="preset-item"><button type="button" class="preset-btn' + (active ? " is-now" : "") + '" onclick="presetApply(\'' + p.id + '\')" title="' + presetEsc(p.note || "保存した構成です") + '">' +
            presetIco(p.icon || "💾") + " " + presetEsc(p.name) + '<small>' + on + '個</small></button>' +
            (custom ? '<button type="button" class="preset-del" onclick="presetDelete(\'' + p.id + '\')" aria-label="削除" title="削除">✕</button>' : "") + "</span>";
    };
    box.innerHTML = '<label class="plugin-group-title" style="color: var(--uis-head, #0891b2);">構成をワンタッチで切りかえる</label>' +
        '<p class="config-note" data-keep="1" style="margin: 2px 0 8px;">今の構成：<strong>' + (matched ? presetEsc(matched) : "自分で選んだ構成") + '</strong>　（機能 ' + (total - cur.length) + ' / ' + total + ' 個がオン）</p>' +
        '<div class="preset-row">' + PRESET_BUILTIN.map(p => chip(p, false)).join("") + presetLoadCustom().map(p => chip(p, true)).join("") + "</div>" +
        '<div class="preset-row"><button type="button" class="btn-secondary" onclick="presetSaveCurrent()" style="width: auto; padding: 6px 14px; margin: 6px 0 0;">' + presetIco("💾") + ' 今の構成を保存する</button>' +
        '<button type="button" class="btn-secondary" onclick="openPresetIo(\'export\')" style="width: auto; padding: 6px 14px; margin: 6px 0 0;">' + presetIco("📤") + ' 構成を書き出す</button>' +
        '<button type="button" class="btn-secondary" onclick="openPresetIo(\'import\')" style="width: auto; padding: 6px 14px; margin: 6px 0 0;">' + presetIco("📥") + ' 構成を読み込む</button></div>' +
        '<div class="divider-line" style="margin: 12px 0;"></div>';
}

const PRESET_CSS = `
.preset-row { display: flex; flex-wrap: wrap; gap: 6px; }
.preset-item { display: inline-flex; align-items: stretch; }
.preset-btn { width: auto !important; margin: 0 !important; padding: 8px 12px !important; border-radius: 10px; border: 1px solid var(--uis-b-line, var(--seat-border, #e2e8f0)); background: var(--uis-b-bg, var(--input-bg, #f2f2f7)); color: var(--uis-b-fg, var(--input-text, #1c1c1e)); font-weight: 700; font-size: 13px; cursor: pointer; display: inline-flex; align-items: baseline; gap: 6px; }
.preset-btn small { font-weight: 400; color: var(--text-sub, #64748b); }
.preset-btn:hover { border-color: var(--uis-b-hover-line, #0891b2); }
.preset-btn.is-now { background: var(--uis-b-on-bg, #0891b2); border-color: var(--uis-b-on-bg, #0891b2); color: var(--uis-b-on-fg, #fff); }
.preset-btn.is-now small { color: rgba(255, 255, 255, 0.85); }
.preset-item .preset-btn:not(:last-child) { border-top-right-radius: 0; border-bottom-right-radius: 0; }
.preset-del { width: auto !important; margin: 0 !important; padding: 0 8px !important; border-radius: 0 10px 10px 0; border: 1px solid var(--seat-border, #e2e8f0); border-left: 0; background: var(--input-bg, #f2f2f7); color: var(--text-sub, #64748b); cursor: pointer; }
.preset-del:hover { color: #e11d48; }
.preset-io-choice { display: flex; align-items: flex-start; gap: 8px; padding: 8px 10px; margin-bottom: 6px; border: 1px solid var(--seat-border, #e2e8f0); border-radius: 10px; cursor: pointer; font-size: 14px; font-weight: 700; }
.preset-io-choice:hover { border-color: var(--uis-b-hover-line, #0891b2); }
.preset-io-choice input { margin-top: 3px; }
.preset-io-choice small { display: block; margin-top: 2px; font-weight: 400; font-size: 12px; color: var(--text-sub, #64748b); }
.preset-io-item { padding: 8px 0; }
.preset-io-item + .preset-io-item { border-top: 1px dashed var(--seat-border, #e2e8f0); }
.modal-content button.preset-io-btn { width: auto !important; margin: 0 !important; padding: 6px 14px !important; height: auto; }
`;

SekigaeApp.registerPlugin({
    id: "plugin-presets",
    name: "構成プリセット",
    version: "1.5",
    description: "使う機能の組み合わせを、ワンタッチで切りかえます。「簡単」「授業用」「年度はじめ」「電子黒板」「指名・発表」「フル」の他、今の構成に名前を付けて保存できます。保存した構成は、ファイルに書き出して、学年のほかの先生に配れます。もらったファイルは、読み込めます。切りかえは、再読み込みの後に反映されます。",
    backupKeys: [PRESET_KEY],
    searchWords: "構成 プリセット かんたん 授業用 フル 機能 まとめて 切りかえ プラグイン 軽く 配る 書き出し 読み込み ファイル 共有 エクスポート インポート 学年",
    mount(app) {
        const st = document.createElement("style");
        st.id = "presetStyle";
        st.textContent = PRESET_CSS;
        document.head.appendChild(st);
        const list = $id("pluginList");
        if (list) list.insertAdjacentHTML("beforebegin", '<div id="presetBox"></div>');
        document.body.insertAdjacentHTML("beforeend", PRESET_IO_HTML);
        // 一覧が描きなおされる（個別にオン・オフした）たびに、「いまの構成」の表示も、直します
        const orig = app.renderPluginList.bind(app);
        app.renderPluginList = function () { orig(); renderPresetBox(); };
        app.insertInto("guide-tools", '<li><strong>構成プリセット</strong>：設定の「機能・プラグイン」の「プラグインの設定」を開くと、上にある「簡単」「授業用」「フル」を押すと、使う機能の組み合わせを、まとめて切りかえます。画面の部品が減るので、少し軽くなります。今の構成に名前を付けて、保存もできます。保存した構成は、「構成を書き出す」でファイルにして、学年のほかの先生に渡せます。もらったファイルは、「構成を読み込む」で、保存するか、そのまま切りかえられます。</li>');
    },
    ready() { renderPresetBox(); }
});
