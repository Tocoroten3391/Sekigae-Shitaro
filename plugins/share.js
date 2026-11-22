// ==========================================
// 座席表の共有プラグイン：座席表を、テキスト・画像・スマホで見やすいHTML・QRコードにして、配ったり見せたりできます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画像にする部分は、「印刷・画像保存」プラグインの機能を使います。オフのときは、画像のボタンは出ません）
// ==========================================

// ---- QRコードを作る（バイトモード、誤り訂正レベルはM、入りきらなければL）----
const QR_ECC_PER_BLOCK = {
    L: [7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
};
const QR_NUM_BLOCKS = {
    L: [1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
};
function qrRawModules(ver) {
    let r = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
        const n = Math.floor(ver / 7) + 2;
        r -= (25 * n - 10) * n - 55;
        if (ver >= 7) r -= 36;
    }
    return r;
}
function qrDataCodewords(ver, ecl) {
    return Math.floor(qrRawModules(ver) / 8) - QR_ECC_PER_BLOCK[ecl][ver - 1] * QR_NUM_BLOCKS[ecl][ver - 1];
}
function qrGfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11D);
        z ^= ((y >>> i) & 1) * x;
    }
    return z;
}
function qrRsDivisor(degree) {
    const result = new Array(degree).fill(0);
    result[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
        for (let j = 0; j < degree; j++) {
            result[j] = qrGfMul(result[j], root);
            if (j + 1 < degree) result[j] ^= result[j + 1];
        }
        root = qrGfMul(root, 0x02);
    }
    return result;
}
function qrRsRemainder(data, divisor) {
    const result = divisor.map(() => 0);
    for (const b of data) {
        const factor = b ^ result.shift();
        result.push(0);
        divisor.forEach((coef, i) => { result[i] ^= qrGfMul(coef, factor); });
    }
    return result;
}
// 文字列から、QRコードのマス目（true が黒）を作ります。入りきらないときは null を返します
function qrMake(text, onlyLevel) {
    const bytes = Array.from(new TextEncoder().encode(text));
    let ecl = null, ver = 0;
    for (const level of (onlyLevel ? [onlyLevel] : ["M", "L"])) {
        for (let v = 1; v <= 40; v++) {
            const cap = qrDataCodewords(v, level) * 8;
            const used = 4 + (v <= 9 ? 8 : 16) + bytes.length * 8;
            if (used <= cap) { ecl = level; ver = v; break; }
        }
        if (ecl) break;
    }
    if (!ecl) return null;
    // データのビット列
    const bits = [];
    const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(0x4, 4);
    put(bytes.length, ver <= 9 ? 8 : 16);
    bytes.forEach(b => put(b, 8));
    const capBits = qrDataCodewords(ver, ecl) * 8;
    put(0, Math.min(4, capBits - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < capBits; pad ^= 0xEC ^ 0x11) put(pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
        let v = 0;
        for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j];
        data.push(v);
    }
    // ブロックに分けて、誤り訂正を付ける
    const numBlocks = QR_NUM_BLOCKS[ecl][ver - 1], eccLen = QR_ECC_PER_BLOCK[ecl][ver - 1];
    const raw = Math.floor(qrRawModules(ver) / 8);
    const numShort = numBlocks - raw % numBlocks, shortLen = Math.floor(raw / numBlocks);
    const divisor = qrRsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < numBlocks; i++) {
        const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
        k += dat.length;
        const ecc = qrRsRemainder(dat, divisor);
        if (i < numShort) dat.push(0);
        blocks.push(dat.concat(ecc));
    }
    const all = [];
    for (let i = 0; i < blocks[0].length; i++) {
        blocks.forEach((blk, j) => { if (i !== shortLen - eccLen || j >= numShort) all.push(blk[i]); });
    }
    // マス目
    const size = ver * 4 + 17;
    const mod = Array.from({ length: size }, () => new Array(size).fill(false));
    const fn = Array.from({ length: size }, () => new Array(size).fill(false));
    const setFn = (x, y, dark) => { mod[y][x] = dark; fn[y][x] = true; };
    for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
    const finder = (cx, cy) => {
        for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
            const dist = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
            if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, dist !== 2 && dist !== 4);
        }
    };
    finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
    const align = [];
    if (ver > 1) {
        const n = Math.floor(ver / 7) + 2;
        const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
        align.push(6);
        for (let pos = size - 7; align.length < n; pos -= step) align.splice(1, 0, pos);
    }
    align.forEach((ax, i) => align.forEach((ay, j) => {
        if ((i === 0 && j === 0) || (i === 0 && j === align.length - 1) || (i === align.length - 1 && j === 0)) return;
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    const formatBits = ecl === "L" ? 1 : 0;
    const drawFormat = mask => {
        const d = (formatBits << 3) | mask;
        let rem = d;
        for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
        const b = ((d << 10) | rem) ^ 0x5412;
        const bit = i => ((b >>> i) & 1) !== 0;
        for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
        setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8));
        for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
        for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
        for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
        setFn(8, size - 8, true);
    };
    drawFormat(0);
    if (ver >= 7) {
        let rem = ver;
        for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
        const b = (ver << 12) | rem;
        for (let i = 0; i < 18; i++) {
            const bit = ((b >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3);
            setFn(a, c, bit); setFn(c, a, bit);
        }
    }
    // データを置く
    let idx = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (let vert = 0; vert < size; vert++) {
            for (let j = 0; j < 2; j++) {
                const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
                if (!fn[y][x] && idx < all.length * 8) { mod[y][x] = ((all[idx >>> 3] >>> (7 - (idx & 7))) & 1) !== 0; idx++; }
            }
        }
    }
    // マスクを選ぶ
    const maskFn = [
        (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
        (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
        (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0
    ];
    const applyMask = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[m](x, y)) mod[y][x] = !mod[y][x]; };
    const penalty = () => {
        let p = 0;
        for (let pass = 0; pass < 2; pass++) {
            for (let a = 0; a < size; a++) {
                let run = 1;
                for (let b = 1; b < size; b++) {
                    const cur = pass ? mod[b][a] : mod[a][b], prev = pass ? mod[b - 1][a] : mod[a][b - 1];
                    if (cur === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1;
                }
            }
        }
        for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
            const c = mod[y][x];
            if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) p += 3;
        }
        let dark = 0;
        mod.forEach(row => row.forEach(c => { if (c) dark++; }));
        p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
        return p;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) {
        applyMask(m); drawFormat(m);
        const p = penalty();
        if (p < bestP) { best = m; bestP = p; }
        applyMask(m);
    }
    applyMask(best); drawFormat(best);
    return { size, mod, version: ver, level: ecl, bytes: bytes.length };
}
function qrDrawTo(canvas, qr, px) {
    const quiet = 4, n = qr.size + quiet * 2;
    const cell = Math.max(1, Math.floor(px / n));
    canvas.width = canvas.height = cell * n;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) if (qr.mod[y][x]) ctx.fillRect((x + quiet) * cell, (y + quiet) * cell, cell, cell);
}

// ---- 座席表の中身を集める ----
function shareEsc(t) { return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function shareOptions() {
    const v = id => { const e = $id(id); return e ? e.value : ""; };
    const c = id => { const e = $id(id); return e ? e.checked : false; };
    return { title: v("shareTitle").trim(), nameMode: v("shareNameMode") || "both", flip: v("shareView") === "student", showFront: c("shareFront") };
}
function shareDefaultTitle() {
    if (typeof getChartDefaultTitle === "function") return getChartDefaultTitle();
    const name = (typeof getSelectedPresetName === "function" && getSelectedPresetName()) || "";
    return name ? `${name} 座席表` : "座席表";
}
function shareDateText() { const d = new Date(); return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`; }
function shareHasSeats() { return !!(currentStudents && currentStudents.some(s => s && s.type === "STUDENT" && s.text)); }
// 座席を、縦横の表にします（生徒の側から見る向きなら、上下左右をひっくり返します）
function shareGrid(opts) {
    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) || 6 : 6;
    const seats = currentStudents || [];
    const rows = Math.max(1, Math.ceil(seats.length / cols));
    const grid = Array.from({ length: rows }, () => new Array(cols).fill(null));
    seats.forEach((seat, idx) => {
        let r = Math.floor(idx / cols), c = idx % cols;
        if (opts.flip) { r = rows - 1 - r; c = cols - 1 - c; }
        if (!(seat && seat.type === "STUDENT" && seat.text)) return;
        const p = getSeatDisplayParts(seat.text);
        let label;
        if (opts.nameMode === "number") label = p.no ? p.no : p.name;
        else if (opts.nameMode === "name" || !p.no) label = p.name || p.no;
        else label = `${p.no} ${p.name}`;
        grid[r][c] = { label, name: p.name || "", no: p.no || "", absent: !!seat.isAbsent };
    });
    return { grid, rows, cols };
}
function shareText(opts, compact) {
    const { grid } = shareGrid(opts);
    const lines = [];
    lines.push(`${opts.title || "座席表"}（${shareDateText()}）`);
    if (opts.showFront && !opts.flip) lines.push("【前：黒板】");
    const cells = grid.map(row => row.map(c => c ? c.label + (c.absent ? "(休)" : "") : "－"));
    cells.forEach(row => lines.push(row.join(compact ? "｜" : " ｜ ")));
    if (opts.showFront && opts.flip) lines.push("【前：黒板】");
    return lines.join("\n");
}
function shareHtml(opts) {
    const { grid, cols } = shareGrid(opts);
    const title = shareEsc(opts.title || "座席表");
    const front = opts.showFront ? '<div class="front">前：黒板</div>' : "";
    const cells = grid.map(row => row.map(c => {
        if (!c) return '<div class="seat empty"></div>';
        const parts = opts.nameMode === "number" ? `<b>${shareEsc(c.no || c.name)}</b>`
            : (opts.nameMode === "name" || !c.no) ? `<b>${shareEsc(c.name || c.no)}</b>`
            : `<small>${shareEsc(c.no)}番</small><b>${shareEsc(c.name)}</b>`;
        return `<div class="seat${c.absent ? " absent" : ""}">${parts}${c.absent ? "<i>休</i>" : ""}</div>`;
    }).join("")).join("\n");
    return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
body{margin:0;padding:16px;font-family:"Hiragino Sans","Yu Gothic","Meiryo","Noto Sans JP",sans-serif;background:#f8fafc;color:#111827}
h1{font-size:20px;text-align:center;margin:4px 0}
.date{text-align:center;color:#6b7280;font-size:13px;margin-bottom:12px}
.front{background:#374151;color:#fff;text-align:center;border-radius:8px;padding:8px;margin:0 auto 10px;max-width:960px;font-weight:700;font-size:14px}
.grid{display:grid;grid-template-columns:repeat(${cols},minmax(0,1fr));gap:6px;max-width:960px;margin:0 auto}
.seat{position:relative;background:#fff;border:1.5px solid #374151;border-radius:10px;padding:8px 2px;min-height:54px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;overflow:hidden}
.seat small{font-size:11px;color:#6b7280}
.seat b{font-size:clamp(11px,2.6vw,20px);line-height:1.25;word-break:break-all}
.seat.empty{border:1.5px dashed #d1d5db;background:transparent}
.seat.absent{background:#f3f4f6;border-color:#d1d5db;color:#9ca3af}
.seat i{position:absolute;top:3px;right:6px;font-size:11px;color:#b45309;font-style:normal;font-weight:700}
@media print{body{background:#fff}}
</style></head><body>
<h1>${title}</h1><div class="date">${shareDateText()}</div>
${opts.flip ? "" : front}
<div class="grid">
${cells}
</div>
${opts.flip ? '<div style="height:10px"></div>' + front : ""}
</body></html>`;
}

// ---- 画面（設定画面のボタンと、共有の画面）----
function shareImageAvailable() {
    return typeof renderSeatChartCanvas === "function" && SekigaeApp.plugins.some(p => p.id === "print") && SekigaeApp.isEnabled("print");
}
function shareCanvas() {
    const o = shareOptions();
    return renderSeatChartCanvas({ title: o.title, nameMode: o.nameMode, showFront: o.showFront, showDate: true, showLabel: false, fadeAbsent: true, showGroup: false, flip: o.flip, nameScale: 1 });
}
function shareFileName(ext) { return `${(shareOptions().title || "座席表").replace(/[\\/:*?"<>|]/g, "_")}.${ext}`; }
function shareDownload(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
function openShareModal() {
    if (!shareHasSeats()) { showToast("座席表が空です。", "error"); return; }
    const t = $id("shareTitle");
    if (t && !t.value) t.value = shareDefaultTitle();
    const imgBox = $id("shareImageBtns");
    if (imgBox) imgBox.hidden = !shareImageAvailable();
    const sBtn = $id("shareNativeBtn");
    if (sBtn) sBtn.hidden = !(navigator.share && shareImageAvailable());
    $id("shareQrBox").hidden = true;
    $id("shareModalOverlay").style.display = "flex";
    shareRefreshPreview();
}
function closeShareModal() {
    const o = $id("shareModalOverlay");
    if (o) o.style.display = "none";
}
function shareRefreshPreview() {
    const pre = $id("sharePreview");
    if (pre && shareHasSeats()) pre.textContent = shareText(shareOptions(), false);
    const qr = $id("shareQrBox");
    if (qr && !qr.hidden) shareShowQr();
}
async function shareCopyText() {
    const text = shareText(shareOptions(), false);
    try { await navigator.clipboard.writeText(text); showToast("座席表をテキストでコピーしました。", "success"); }
    catch (e) {
        const pre = $id("sharePreview");
        if (pre) { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
        showToast("自動でコピーできませんでした。選んだ文字を、コピーしてください。", "error");
    }
}
function shareCanvasBlob() {
    return new Promise(resolve => shareCanvas().toBlob(resolve, "image/png"));
}
async function shareCopyImage() {
    const blob = await shareCanvasBlob();
    if (!blob) { showToast("画像を作れませんでした。", "error"); return; }
    try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        showToast("座席表を画像でコピーしました。", "success");
    } catch (e) {
        shareDownload(blob, shareFileName("png"));
        showToast("この環境では、画像をコピーできませんでした。画像を保存しました。", "info");
    }
}
async function shareSaveImage() {
    const blob = await shareCanvasBlob();
    if (!blob) { showToast("画像を作れませんでした。", "error"); return; }
    shareDownload(blob, shareFileName("png"));
    showToast("座席表を画像で保存しました。", "success");
}
async function shareNative() {
    const blob = await shareCanvasBlob();
    if (!blob) { showToast("画像を作れませんでした。", "error"); return; }
    const file = new File([blob], shareFileName("png"), { type: "image/png" });
    const data = { files: [file], title: shareOptions().title || "座席表" };
    try {
        if (navigator.canShare && !navigator.canShare(data)) { shareDownload(blob, shareFileName("png")); showToast("共有に使えなかったので、画像を保存しました。", "info"); return; }
        await navigator.share(data);
    } catch (e) {
        if (e && e.name === "AbortError") return;
        shareDownload(blob, shareFileName("png"));
        showToast("共有できなかったので、画像を保存しました。", "info");
    }
}
function shareSaveHtml() {
    shareDownload(new Blob([shareHtml(shareOptions())], { type: "text/html" }), shareFileName("html"));
    showToast("スマホでも見やすいHTMLで保存しました。", "success");
}
function shareShowQr() {
    const box = $id("shareQrBox"), canvas = $id("shareQrCanvas"), note = $id("shareQrNote");
    const opts = shareOptions();
    let qr = qrMake(shareText(opts, true));
    let mode = "";
    if (!qr || qr.version > 25) {
        const small = Object.assign({}, opts, { nameMode: "number" });
        const q2 = qrMake(shareText(small, true));
        if (q2 && (!qr || q2.version < qr.version)) { qr = q2; mode = "number"; }
    }
    box.hidden = false;
    if (!qr) {
        canvas.hidden = true;
        note.textContent = "人数が多くて、QRコードに入りきりません。画像かHTMLで共有してください。";
        return;
    }
    canvas.hidden = false;
    qrDrawTo(canvas, qr, 360);
    note.textContent = (mode === "number" ? "入りきらないので、番号だけにしました。" : "") + (qr.version > 20 ? "文字が多いので、画面を大きく見せて、読み取ってください。" : "カメラで読み取ると、座席表の文字が出ます。");
}
function shareToggleQr() {
    const box = $id("shareQrBox");
    if (!box.hidden) { box.hidden = true; return; }
    shareShowQr();
}

const SHARE_MODAL_HTML = `
<div id="shareModalOverlay" class="modal-overlay" style="display: none;">
    <div class="modal-content" style="max-width: 520px; width: 95%;">
        <h4 style="color: #0ea5e9;">座席表を共有する</h4>
        <label class="input-label" for="shareTitle">タイトル：</label>
        <input type="text" id="shareTitle" oninput="shareRefreshPreview()" style="margin-bottom: 10px;">
        <div class="share-opt-row">
            <label for="shareNameMode">名前の出し方：</label>
            <select id="shareNameMode" onchange="shareRefreshPreview()">
                <option value="both">番号と名前</option>
                <option value="name">名前だけ</option>
                <option value="number">番号だけ</option>
            </select>
        </div>
        <div class="share-opt-row">
            <label for="shareView">向き：</label>
            <select id="shareView" onchange="shareRefreshPreview()">
                <option value="teacher">先生の側から（黒板が上）</option>
                <option value="student">生徒の側から（黒板が下）</option>
            </select>
        </div>
        <div class="switch-container" style="margin: 8px 0 12px;">
            <label class="switch"><input type="checkbox" id="shareFront" checked onchange="shareRefreshPreview()"><span class="slider"></span></label>
            <span class="switch-label">「前：黒板」を入れる</span>
        </div>
        <pre id="sharePreview" class="share-preview"></pre>
        <div class="share-btns">
            <button type="button" class="btn-secondary" onclick="shareCopyText()">📋 テキストでコピー</button>
            <button type="button" class="btn-secondary" onclick="shareSaveHtml()">📄 スマホで見やすいHTMLで保存</button>
            <button type="button" class="btn-secondary" onclick="shareToggleQr()">🔳 QRコードで見せる</button>
        </div>
        <div id="shareImageBtns" class="share-btns">
            <button type="button" class="btn-secondary" onclick="shareCopyImage()">🖼️ 画像をコピー</button>
            <button type="button" class="btn-secondary" onclick="shareSaveImage()">💾 画像で保存</button>
            <button type="button" class="btn-secondary" id="shareNativeBtn" onclick="shareNative()" hidden>📲 共有メニューを開く</button>
        </div>
        <div id="shareQrBox" class="share-qr" hidden>
            <canvas id="shareQrCanvas" width="10" height="10"></canvas>
            <p id="shareQrNote" class="config-note"></p>
        </div>
        <div class="modal-btn-row">
            <button onclick="closeShareModal()" class="btn-secondary">閉じる</button>
        </div>
    </div>
</div>`;

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "share",
    requires: ["print"],   // 前提のプラグイン（無いと使えません）
    name: "座席表の共有",
    version: "1.1",
    description: "座席表を、テキスト、画像、スマホで見やすいHTML、QRコードにして、配ったり見せたりできます。",
    searchWords: "共有 QR コード テキスト コピー 画像 HTML スマホ 配る",
    stubs: [],
    mount(app) {
        document.body.insertAdjacentHTML("beforeend", SHARE_MODAL_HTML);
        const btn = '<button type="button" onclick="openShareModal()" class="btn-secondary" id="btnShareChart" style="margin-top: 10px;">座席表を共有する</button>';
        const printBtn = document.querySelector('button[data-plugin="print"][onclick*="openChartExportModal"]');
        if (printBtn) printBtn.insertAdjacentHTML("afterend", btn); else app.insertInto("settings-export", btn);
        const more = $id("moreMenu");
        if (more) more.insertAdjacentHTML("beforeend", '<button type="button" onclick="closePopMenus(); openShareModal()" class="pop-item pop-item-gray" id="btnShareMenu">座席表を共有する</button>');
        const printLi = document.querySelector('li[data-plugin="print"]');
        const li = "<li>「座席表を共有する」で、座席表を、テキスト、画像、スマホで見やすいHTML、QRコードにできます。テキストは、メールやチャットにそのまま貼り付けられます。QRコードは、カメラで読み取ると座席表の文字が出ます。</li>";
        if (printLi) printLi.insertAdjacentHTML("afterend", li); else app.insertInto("guide-faq", li);
    }
});
document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const o = $id("shareModalOverlay");
    if (o && o.style.display !== "none") closeShareModal();
});
