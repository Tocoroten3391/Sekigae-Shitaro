// ==========================================
// 名札シールプラグイン：座席表の生徒の「名札シール」や「席ラベル」を、市販のラベル用紙（A4）に合わせて印刷します
// ラベル用紙の寸法（面数）を選ぶと、1枚ずつの位置を計算して並べます。使いかけの用紙は、「最初の○枚は飛ばす」で使えます
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります（設定は、ブラウザに残ります）
// ==========================================
const SLB_KEY = "seat_labels_cfg_v1";   // { sheet, kind, order, skip, copies, border, dx, dy, custom: {cols, rows, w, h, mt, ml, gx, gy} }
// A4（210×297mm）のラベル用紙の、目安の寸法です（用紙の商品によって、少しずれます。ずれるときは、「位置の微調整」を使ってください）
const SLB_SHEETS = [
    { id: "10", label: "10面（2×5）86.4×50.8mm", cols: 2, rows: 5, w: 86.4, h: 50.8, mt: 21.5, ml: 18.6, gx: 0, gy: 0 },
    { id: "12", label: "12面（2×6）86.4×42.3mm", cols: 2, rows: 6, w: 86.4, h: 42.3, mt: 21.6, ml: 18.6, gx: 0, gy: 0 },
    { id: "14", label: "14面（2×7）99.1×38.1mm", cols: 2, rows: 7, w: 99.1, h: 38.1, mt: 15.1, ml: 5.9, gx: 0, gy: 0 },
    { id: "18", label: "18面（3×6）63.5×46.6mm", cols: 3, rows: 6, w: 63.5, h: 46.6, mt: 8.7, ml: 9.75, gx: 0, gy: 0 },
    { id: "21", label: "21面（3×7）70×42.3mm", cols: 3, rows: 7, w: 70, h: 42.3, mt: 0.5, ml: 0, gx: 0, gy: 0 },
    { id: "24", label: "24面（3×8）70×36mm", cols: 3, rows: 8, w: 70, h: 36, mt: 4.5, ml: 0, gx: 0, gy: 0 },
    { id: "27", label: "27面（3×9）63.5×29.6mm", cols: 3, rows: 9, w: 63.5, h: 29.6, mt: 15.3, ml: 9.75, gx: 0, gy: 0 },
    { id: "40", label: "40面（4×10）45.7×25.4mm", cols: 4, rows: 10, w: 45.7, h: 25.4, mt: 21.5, ml: 13.6, gx: 0, gy: 0 },
    { id: "65", label: "65面（5×13）38.1×21.2mm", cols: 5, rows: 13, w: 38.1, h: 21.2, mt: 10.7, ml: 9.75, gx: 0, gy: 0 },
    { id: "custom", label: "自分で寸法を決める" }
];
const SLB_DEFAULT = { sheet: "24", kind: "name", order: "no", skip: 0, copies: 1, border: false, dx: 0, dy: 0,
    custom: { cols: 3, rows: 8, w: 70, h: 36, mt: 4.5, ml: 0, gx: 0, gy: 0 } };
const SLB_KINDS = [
    { id: "name", label: "番号＋名前（名札シール）" },
    { id: "seat", label: "席＋名前（席ラベル）" },
    { id: "nameonly", label: "名前だけ" },
    { id: "numonly", label: "番号だけ" },
    { id: "seatonly", label: "席だけ（B3など）" }
];

function slbCfg() {
    let c = {};
    try { c = JSON.parse(lsGet(SLB_KEY, "{}")) || {}; } catch (e) { c = {}; }
    const r = Object.assign({}, SLB_DEFAULT, c);
    r.custom = Object.assign({}, SLB_DEFAULT.custom, c.custom || {});
    if (!SLB_SHEETS.some(s => s.id === r.sheet)) r.sheet = "24";
    if (!SLB_KINDS.some(k => k.id === r.kind)) r.kind = "name";
    if (r.order !== "seat") r.order = "no";
    r.skip = Math.max(0, Math.min(200, parseInt(r.skip, 10) || 0));
    r.copies = Math.max(1, Math.min(10, parseInt(r.copies, 10) || 1));
    r.dx = Math.max(-10, Math.min(10, +r.dx || 0));
    r.dy = Math.max(-10, Math.min(10, +r.dy || 0));
    return r;
}
function slbSetCfg(patch) {
    const c = slbCfg();
    Object.keys(patch).forEach(k => { if (k === "custom") c.custom = Object.assign({}, c.custom, patch.custom); else c[k] = patch[k]; });
    lsSet(SLB_KEY, JSON.stringify(c));
    return c;
}
function slbEsc(t) { return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// いまの用紙の寸法（数でない値や、用紙からはみ出す値は、安全な範囲に直します）
function slbSheetDims(cfg) {
    const base = cfg.sheet === "custom" ? cfg.custom : SLB_SHEETS.find(s => s.id === cfg.sheet);
    const n = (v, lo, hi, d) => { v = +v; return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
    const d = {
        cols: Math.round(n(base.cols, 1, 10, 3)), rows: Math.round(n(base.rows, 1, 30, 8)),
        w: n(base.w, 10, 210, 70), h: n(base.h, 8, 297, 36),
        mt: n(base.mt, 0, 200, 0), ml: n(base.ml, 0, 200, 0), gx: n(base.gx, 0, 50, 0), gy: n(base.gy, 0, 50, 0)
    };
    d.fits = d.ml + d.cols * d.w + (d.cols - 1) * d.gx <= 210.5 && d.mt + d.rows * d.h + (d.rows - 1) * d.gy <= 297.5;
    return d;
}

// ---- 生徒の読み取り ----
function slbPeople(cfg) {
    const cols = typeof getGridCols === "function" ? getGridCols() : 6;
    const list = [];
    (currentStudents || []).forEach((s, i) => {
        if (!s || s.type !== "STUDENT" || !s.text) return;
        const p = getSeatDisplayParts(s.text);
        const n = parseInt(p.no, 10);
        list.push({ i, no: p.no || "", n: Number.isFinite(n) ? n : null, name: p.name || getCleanStudentKey(s.text), seat: getSeatLabel(i, cols) });
    });
    if (cfg.order === "no") list.sort((a, b) => ((a.n === null) - (b.n === null)) || ((a.n !== null && b.n !== null) ? a.n - b.n : 0) || a.i - b.i);
    else list.sort((a, b) => a.i - b.i);
    return list;
}

// 文字の大きさ（mm）。名前の長さと、ラベルの幅・高さに合わせます
function slbFont(text, w, h, lines) {
    let len = 0;
    String(text).split("").forEach(ch => { len += /[\x20-\x7e]/.test(ch) ? 0.58 : 1; });
    len = Math.max(1, len);
    const byH = lines > 1 ? h * 0.42 : h * 0.62;
    return Math.max(2.4, Math.min(byH, (w - 5) / len));
}
function slbLabelInner(p, kind, w, h) {
    const small = Math.max(2.2, Math.min(h * 0.2, 4.2));
    const line = (t, fs, bold) => '<div style="font-size:' + fs.toFixed(2) + 'mm;line-height:1.1;' + (bold ? "font-weight:800;" : "") + '">' + slbEsc(t) + '</div>';
    if (kind === "numonly") { const t = p.no || p.name; return line(t, slbFont(t, w, h, 1), true); }
    if (kind === "nameonly") return line(p.name, slbFont(p.name, w, h, 1), true);
    if (kind === "seatonly") return line(p.seat, slbFont(p.seat, w, h, 1), true);
    if (kind === "seat") return line("席 " + p.seat, small, false) + line(p.name, slbFont(p.name, w, h, 2), true);
    // 番号＋名前
    return (p.no ? line(p.no + "番", small, false) : "") + line(p.name, slbFont(p.name, w, h, p.no ? 2 : 1), true);
}

function slbPagesHtml(cfg) {
    const d = slbSheetDims(cfg);
    const people = slbPeople(cfg);
    const per = d.cols * d.rows;
    const items = [];
    people.forEach(p => { for (let k = 0; k < cfg.copies; k++) items.push(p); });
    const slots = cfg.skip + items.length;
    const pageCount = Math.max(1, Math.ceil(slots / per));
    const pages = [];
    for (let pg = 0; pg < pageCount; pg++) {
        let html = "";
        for (let s = 0; s < per; s++) {
            const k = pg * per + s - cfg.skip;
            if (k < 0 || k >= items.length) continue;
            const r = Math.floor(s / d.cols), c = s % d.cols;
            const x = d.ml + c * (d.w + d.gx) + cfg.dx, y = d.mt + r * (d.h + d.gy) + cfg.dy;
            html += '<div class="slb-label' + (cfg.border ? " slb-border" : "") + '" style="left:' + x.toFixed(2) + 'mm;top:' + y.toFixed(2) + 'mm;width:' + d.w + 'mm;height:' + d.h + 'mm;">' +
                slbLabelInner(items[k], cfg.kind, d.w, d.h) + '</div>';
        }
        pages.push('<div class="slb-page">' + html + '</div>');
    }
    return { html: pages.join(""), pages: pageCount, count: items.length, per, d };
}

function slbPrint() {
    const cfg = slbCfg();
    if (!slbPeople(cfg).length) { showToast("座席表に生徒がいません。名簿を入れて席替えをしてください。", "error"); return; }
    const r = slbPagesHtml(cfg);
    let area = $id("slbPrintArea");
    if (!area) { area = document.createElement("div"); area.id = "slbPrintArea"; document.body.appendChild(area); }
    area.innerHTML = r.html;
    let st = $id("slbPrintPageStyle");
    if (!st) { st = document.createElement("style"); st.id = "slbPrintPageStyle"; document.head.appendChild(st); }
    st.textContent = "@page { size: A4 portrait; margin: 0; }";
    document.body.classList.add("slb-printing");
    const done = () => { document.body.classList.remove("slb-printing"); area.innerHTML = ""; window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { window.print(); }, 50);
}

// ---- 画面 ----
const SLB_CSS = `
#slbOverlay .modal-content { max-width: 640px; width: 95%; }
#slbOverlay .slb-row { display: flex; flex-wrap: wrap; gap: 8px 14px; align-items: center; margin: 8px 0; font-size: 13px; }
#slbOverlay .slb-row label { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
#slbOverlay .slb-row select, #slbOverlay .slb-row input[type=number] { height: 36px; }
#slbOverlay .slb-row input[type=number] { width: 72px !important; }
#slbOverlay .slb-warn { color: #b45309; font-size: 12px; margin: 4px 0; }
#slbOverlay .slb-preview { max-height: 420px; overflow: auto; border: 1px solid var(--seat-border); border-radius: 10px; background: #e5e7eb; padding: 8px; }
.slb-page { position: relative; width: 210mm; height: 297mm; background: #fff; overflow: hidden; page-break-after: always; break-after: page; margin: 0 auto 8px; }
#slbOverlay .slb-preview .slb-page { zoom: 0.42; }
.slb-label { position: absolute; box-sizing: border-box; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; overflow: hidden; color: #111; font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; }
.slb-label.slb-border { border: 0.2mm dashed #888; }
#slbPrintArea { display: none; }
@media print {
    body.slb-printing > *:not(#slbPrintArea) { display: none !important; }
    body.slb-printing > #slbPrintArea { display: block !important; }
    body.slb-printing .slb-page { margin: 0; }
    body.slb-printing .slb-page:last-child { page-break-after: auto; break-after: auto; }
}
`;

function slbModalHtml() {
    return `<div id="slbOverlay" class="modal-overlay" style="display: none;">
  <div class="modal-content">
    <h4>🏷️ 名札シール・席ラベルの印刷</h4>
    <div id="slbBody"></div>
    <div class="modal-btn-row"><button type="button" data-slb="close">閉じる</button></div>
  </div>
</div>`;
}

function slbRender() {
    const body = $id("slbBody");
    if (!body) return;
    const cfg = slbCfg();
    const d = slbSheetDims(cfg);
    const r = slbPagesHtml(cfg);
    const opt = (v, cur, t) => '<option value="' + v + '"' + (String(v) === String(cur) ? " selected" : "") + '>' + t + '</option>';
    const num = (k, v, step, min, max) => '<input type="number" data-slb-cust="' + k + '" value="' + v + '" step="' + step + '" min="' + min + '" max="' + max + '">';
    const cu = cfg.custom;
    body.innerHTML =
        '<div class="slb-row"><label>ラベル用紙 <select data-slb-cfg="sheet">' + SLB_SHEETS.map(s => opt(s.id, cfg.sheet, s.label)).join("") + '</select></label></div>' +
        (cfg.sheet === "custom" ?
            '<div class="slb-row"><label>列 ' + num("cols", cu.cols, 1, 1, 10) + '</label><label>行 ' + num("rows", cu.rows, 1, 1, 30) + '</label>' +
            '<label>幅mm ' + num("w", cu.w, 0.1, 10, 210) + '</label><label>高さmm ' + num("h", cu.h, 0.1, 8, 297) + '</label></div>' +
            '<div class="slb-row"><label>上の余白mm ' + num("mt", cu.mt, 0.1, 0, 200) + '</label><label>左の余白mm ' + num("ml", cu.ml, 0.1, 0, 200) + '</label>' +
            '<label>ラベルの横のすき間mm ' + num("gx", cu.gx, 0.1, 0, 50) + '</label><label>縦のすき間mm ' + num("gy", cu.gy, 0.1, 0, 50) + '</label></div>' : "") +
        (d.fits ? "" : '<p class="slb-warn">この寸法だとA4の用紙からはみ出します。寸法を見直してください。</p>') +
        '<div class="slb-row"><label>中身 <select data-slb-cfg="kind">' + SLB_KINDS.map(k => opt(k.id, cfg.kind, k.label)).join("") + '</select></label>' +
        '<label>並び順 <select data-slb-cfg="order">' + opt("no", cfg.order, "出席番号順") + opt("seat", cfg.order, "座席順（前列の左から）") + '</select></label></div>' +
        '<div class="slb-row"><label>1人あたりの枚数 <input type="number" data-slb-cfg="copies" value="' + cfg.copies + '" min="1" max="10" step="1"></label>' +
        '<label>最初の <input type="number" data-slb-cfg="skip" value="' + cfg.skip + '" min="0" max="200" step="1"> 枚は飛ばす（使いかけの用紙）</label></div>' +
        '<div class="slb-row"><label>位置の微調整 右へ <input type="number" data-slb-cfg="dx" value="' + cfg.dx + '" step="0.5" min="-10" max="10">mm</label>' +
        '<label>下へ <input type="number" data-slb-cfg="dy" value="' + cfg.dy + '" step="0.5" min="-10" max="10">mm</label>' +
        '<label><input type="checkbox" data-slb-cfg="border"' + (cfg.border ? " checked" : "") + '> 枠線も印刷する（ふつうの紙で試すとき）</label></div>' +
        '<p class="config-note" style="margin:0 0 6px;">' + r.count + ' 枚で、A4が ' + r.pages + ' 枚です。用紙の寸法は目安です。まずふつうの紙に「枠線も印刷」で試し刷りして、ラベル用紙に重ねて光に透かし、ずれを「位置の微調整」で直してください。印刷ダイアログでは倍率を、実際のサイズの100％にしてください。</p>' +
        '<div class="slb-preview">' + (r.count ? r.html : '<p class="config-note">座席表に生徒がいません。</p>') + '</div>' +
        '<div class="slb-row"><button type="button" data-slb="print">印刷する</button></div>';
}
function openSeatLabels() {
    if (typeof closeConfigMenuIfOpen === "function") closeConfigMenuIfOpen();
    slbRender();
    const o = $id("slbOverlay");
    if (o) o.style.display = "flex";
}
function closeSeatLabels() { const o = $id("slbOverlay"); if (o) o.style.display = "none"; }

SekigaeApp.registerPlugin({
    id: "seat-labels",
    name: "名札シール・席ラベル",
    version: "1.0",
    description: "座席表の生徒の名札シールや席ラベルを、市販のA4・10面から65面のラベル用紙に合わせて印刷します。用紙の寸法は自分で決められ、使いかけの用紙や位置のずれにも対応します。",
    backupKeys: [SLB_KEY],
    searchWords: "名札 シール ラベル 席ラベル 名前シール ラベル用紙 A-one エーワン 面付け 印刷",
    stubs: [],
    mount(app) {
        const st = document.createElement("style");
        st.id = "seatLabelsStyle";
        st.textContent = SLB_CSS;
        document.head.appendChild(st);
        document.body.insertAdjacentHTML("beforeend", slbModalHtml());
        app.insertInto("settings-export", '<button type="button" id="slbOpenBtn" class="btn-secondary" style="margin-top: 10px;">名札シール・席ラベルを印刷</button>');
        app.insertInto("guide-faq", "<li><strong>名札シールや席ラベルをラベル用紙に印刷したい</strong>：設定の「印刷・共有・書き出し」の「名札シール・席ラベルを印刷」を開きます。使うラベル用紙の面数を選ぶと1枚ずつの位置を合わせて並べます。使いかけの用紙は「最初の○枚は飛ばす」で使えます。</li>");
        document.addEventListener("click", ev => {
            const t = ev.target.closest ? ev.target.closest("#slbOpenBtn, [data-slb]") : null;
            if (!t) return;
            if (t.id === "slbOpenBtn") { openSeatLabels(); return; }
            if (t.dataset.slb === "close") closeSeatLabels();
            else if (t.dataset.slb === "print") slbPrint();
        });
        document.addEventListener("change", ev => {
            const t = ev.target;
            if (!t || !t.dataset) return;
            if (t.dataset.slbCfg) {
                const k = t.dataset.slbCfg;
                const v = t.type === "checkbox" ? t.checked : (t.tagName === "SELECT" && ["sheet", "kind", "order"].includes(k) ? t.value : parseFloat(t.value) || 0);
                slbSetCfg({ [k]: v });
                slbRender();
            } else if (t.dataset.slbCust) {
                slbSetCfg({ custom: { [t.dataset.slbCust]: parseFloat(t.value) || 0 } });
                slbRender();
            }
        });
        document.addEventListener("keydown", ev => {
            if (ev.key !== "Escape") return;
            const o = $id("slbOverlay");
            if (o && o.style.display !== "none") closeSeatLabels();
        });
    },
    afterRender() {
        const o = $id("slbOverlay");
        if (o && o.style.display !== "none") slbRender();
    }
});
