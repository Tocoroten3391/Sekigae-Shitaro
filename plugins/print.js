// ==========================================
// 印刷・画像保存プラグイン：座席表を、印刷用の画像にして、印刷やPNG保存ができます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="print" で結びついていて、自動で隠れます）
// ==========================================
function getChartDefaultTitle() {
    const name = getSelectedPresetName() || ($id("presetNameInput") && $id("presetNameInput").value.trim()) || "";
    return name ? `${name} 座席表` : "座席表";
}
function openChartExportModal() {
    if (!currentStudents || currentStudents.length === 0 || !currentStudents.some(s => s && s.type === "STUDENT")) {
        showToast("座席表が空です。", "error");
        return;
    }
    const t = $id("chartExportTitle");
    if (t && !t.value) t.value = getChartDefaultTitle();
    const gOpt = $id("chartOptGroup");
    if (gOpt) {
        const colorOn = $id("groupColorToggle") ? $id("groupColorToggle").checked : false;
        gOpt.checked = colorOn && lsGet("group_mark_on", "0") === "1" && getGroupMarkScope() === "all";
    }
    const overlay = $id("chartExportModalOverlay");
    if (overlay) overlay.style.display = "flex";
    document.body.style.overflow = "hidden";
    renderChartExportPreview();
}
function closeChartExportModal() {
    const overlay = $id("chartExportModalOverlay");
    if (overlay) overlay.style.display = "none";
    document.body.style.overflow = "";
}
function getChartExportOptions() {
    const on = id => { const el = $id(id); return el ? el.checked : false; };
    const nameSel = $id("chartOptName");
    const titleEl = $id("chartExportTitle");
    return {
        title: titleEl ? titleEl.value.trim() : "",
        nameMode: nameSel ? nameSel.value : "both",
        showFront: on("chartOptFront"),
        showDate: on("chartOptDate"),
        showLabel: on("chartOptLabel"),
        fadeAbsent: on("chartOptAbsent"),
        showGroup: on("chartOptGroup"),
        flip: (($id("chartOptView") || {}).value === "teacher"),
        nameScale: parseFloat(($id("chartOptSize") || {}).value) || 1
    };
}
function fitCanvasText(ctx, text, maxWidth, startSize, minSize, weight) {
    let size = startSize;
    ctx.font = `${weight} ${size}px "Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif`;
    while (size > minSize && ctx.measureText(text).width > maxWidth) {
        size -= 1;
        ctx.font = `${weight} ${size}px "Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif`;
    }
    let out = text;
    while (out.length > 1 && ctx.measureText(out).width > maxWidth) out = out.slice(0, -1);
    return out === text ? text : out.slice(0, -1) + "…";
}
function mixHexWithWhite(hex, ratio) {
    const m = /^#?([0-9a-f]{6})$/i.exec((hex || "").trim());
    if (!m) return "#ffffff";
    const n = parseInt(m[1], 16);
    const mix = v => Math.round(v * ratio + 255 * (1 - ratio));
    return `rgb(${mix((n >> 16) & 255)}, ${mix((n >> 8) & 255)}, ${mix(n & 255)})`;
}
// 班の模様（画面の座席表と同じ種類：1班は無地、2〜8班は線や点）
function drawGroupPatternOnCanvas(ctx, x, y, w, h, no, roundRect) {
    if (no < 2) return;
    ctx.save();
    roundRect(x, y, w, h, 10); ctx.clip();
    ctx.strokeStyle = "rgba(15,23,42,0.26)"; ctx.fillStyle = "rgba(15,23,42,0.32)"; ctx.lineWidth = 1.3;
    const step = 8;
    const lines = (dx, dy) => { // 向きdx,dyの平行線
        ctx.beginPath();
        if (dx === 0) { for (let yy = y; yy <= y + h; yy += step) { ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); } }
        else if (dy === 0) { for (let xx = x; xx <= x + w; xx += step) { ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); } }
        else {
            const sign = dx * dy > 0 ? 1 : -1;
            for (let k = -h; k <= w + h; k += step * 1.4) {
                if (sign > 0) { ctx.moveTo(x + k, y + h); ctx.lineTo(x + k + h, y); }
                else { ctx.moveTo(x + k, y); ctx.lineTo(x + k + h, y + h); }
            }
        }
        ctx.stroke();
    };
    if (no === 2) lines(1, 1);
    else if (no === 3) { for (let xx = x + 4; xx < x + w; xx += 9) for (let yy = y + 4; yy < y + h; yy += 9) { ctx.beginPath(); ctx.arc(xx, yy, 1.5, 0, Math.PI * 2); ctx.fill(); } }
    else if (no === 4) lines(0, 1);
    else if (no === 5) lines(1, 0);
    else if (no === 6) lines(1, -1);
    else if (no === 7) { lines(0, 1); lines(1, 0); }
    else if (no === 8) { for (let xx = x, i = 0; xx < x + w; xx += 12, i++) for (let yy = y, j = 0; yy < y + h; yy += 12, j++) { if ((i + j) % 2 === 0) ctx.fillRect(xx, yy, 12, 12); } ctx.globalAlpha = 1; }
    ctx.restore();
}
function renderSeatChartCanvas(opts) {
    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) || 6 : 6;
    const seats = currentStudents || [];
    const rows = Math.max(1, Math.ceil(seats.length / cols));
    const ns = opts.nameScale || 1;
    const cellW = Math.round(150 * Math.max(1, ns)), cellH = Math.round(92 * Math.max(1, ns)), gap = 10, margin = 36, scale = 2;
    const dy = (cellH - 92) / 2; // 席が大きいとき、文字を中央に寄せる分
    const date = new Date();
    const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    const headerH = (opts.title || opts.showDate) ? (opts.title ? 54 : 0) + (opts.showDate ? 28 : 0) + 10 : 0;
    const frontH = opts.showFront ? 46 : 0;
    const gridW = cols * cellW + (cols - 1) * gap;
    const W = Math.max(gridW + margin * 2, 420);
    const H = margin * 2 + headerH + frontH + rows * cellH + (rows - 1) * gap;
    const canvas = document.createElement("canvas");
    canvas.width = W * scale; canvas.height = H * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H);
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    const FONT = '"Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif';

    let y = margin;
    if (opts.title) {
        ctx.fillStyle = "#111827";
        ctx.font = `700 32px ${FONT}`;
        ctx.fillText(fitCanvasText(ctx, opts.title, W - margin * 2, 32, 18, 700), W / 2, y + 24);
        y += 54;
    }
    if (opts.showDate) {
        ctx.fillStyle = "#6b7280"; ctx.font = `400 16px ${FONT}`;
        ctx.fillText(dateStr, W / 2, y + 12);
        y += 28;
    }
    if (headerH) y += 10;

    const roundRect = (x, yy, w, hh, r) => { ctx.beginPath(); ctx.moveTo(x + r, yy); ctx.arcTo(x + w, yy, x + w, yy + hh, r); ctx.arcTo(x + w, yy + hh, x, yy + hh, r); ctx.arcTo(x, yy + hh, x, yy, r); ctx.arcTo(x, yy, x + w, yy, r); ctx.closePath(); };
    const gridX = (W - gridW) / 2;

    const drawFront = fy => {
        ctx.fillStyle = "#374151";
        roundRect(gridX, fy, gridW, 34, 8); ctx.fill();
        ctx.fillStyle = "#ffffff"; ctx.font = `700 16px ${FONT}`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("前：黒板", W / 2, fy + 17);
    };
    if (opts.showFront && !opts.flip) { drawFront(y); y += frontH; }
    if (opts.showFront && opts.flip) drawFront(y + rows * cellH + (rows - 1) * gap + 12);

    seats.forEach((seat, idx) => {
        let r = Math.floor(idx / cols), c = idx % cols;
        if (opts.flip) { r = rows - 1 - r; c = cols - 1 - c; } // 生徒の側から見た向き
        const x = gridX + c * (cellW + gap), yy = y + r * (cellH + gap), ty = yy + dy;
        const isStudent = seat && seat.type === "STUDENT" && seat.text;
        ctx.lineWidth = 1.5;
        if (!isStudent) {
            ctx.setLineDash([5, 4]); ctx.strokeStyle = "#d1d5db";
            roundRect(x, yy, cellW, cellH, 10); ctx.stroke(); ctx.setLineDash([]);
            return;
        }
        const faded = opts.fadeAbsent && seat.isAbsent;
        const gNo = opts.showGroup ? getShownGroupNoForIndex(idx, cols) : 0;
        ctx.strokeStyle = faded ? "#d1d5db" : "#374151";
        ctx.fillStyle = faded ? "#f3f4f6" : (gNo ? mixHexWithWhite(getCurrentGroupColor(gNo), 0.3) : "#ffffff");
        roundRect(x, yy, cellW, cellH, 10); ctx.fill();
        if (gNo && !faded) { drawGroupPatternOnCanvas(ctx, x, yy, cellW, cellH, gNo, roundRect); roundRect(x, yy, cellW, cellH, 10); }
        ctx.stroke();

        const p = getSeatDisplayParts(seat.text);
        const textColor = faded ? "#9ca3af" : "#111827", subColor = faded ? "#c0c4cc" : "#6b7280";
        const maxW = cellW - 16, cx = x + cellW / 2;
        if (opts.nameMode === "number") {
            ctx.fillStyle = textColor;
            ctx.fillText(fitCanvasText(ctx, p.no || p.name, maxW, Math.round(40 * ns), 16, 700), cx, yy + cellH / 2);
        } else if (opts.nameMode === "name" || !p.no) {
            const furi = getFuriganaFor(seat.text);
            if (furi) {
                ctx.fillStyle = subColor;
                ctx.fillText(fitCanvasText(ctx, furi, maxW, 13, 8, 400), cx, ty + 28);
            }
            ctx.fillStyle = textColor;
            ctx.fillText(fitCanvasText(ctx, p.name || p.no, maxW, Math.round(28 * ns), 12, 700), cx, furi ? ty + 60 : yy + cellH / 2);
        } else {
            const furi = getFuriganaFor(seat.text);
            ctx.fillStyle = subColor; ctx.font = `400 15px ${FONT}`;
            ctx.fillText(`${p.no}番`, cx, ty + (furi ? 20 : 26));
            if (furi) {
                ctx.fillStyle = subColor;
                ctx.fillText(fitCanvasText(ctx, furi, maxW, 12, 8, 400), cx, ty + 41);
            }
            ctx.fillStyle = textColor;
            ctx.fillText(fitCanvasText(ctx, p.name, maxW, Math.round(28 * ns), 12, 700), cx, ty + (furi ? 66 : 58));
        }
        if (seat.isAbsent) {
            ctx.fillStyle = faded ? "#9ca3af" : "#b45309"; ctx.font = `700 13px ${FONT}`;
            ctx.textAlign = "right"; ctx.fillText("休", x + cellW - 8, gNo ? yy + cellH - 12 : yy + 14); ctx.textAlign = "center";
        }
        if (gNo) {
            const bx = x + cellW - 16, by = yy + 15;
            ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.arc(bx, by, 11, 0, Math.PI * 2); ctx.fill();
            ctx.lineWidth = 1.5; ctx.strokeStyle = "#ffffff"; ctx.stroke();
            ctx.fillStyle = "#ffffff"; ctx.font = `800 13px ${FONT}`; ctx.textAlign = "center";
            ctx.fillText(String(gNo), bx, by + 1);
        }
        if (opts.showLabel) {
            ctx.fillStyle = "#9ca3af"; ctx.font = `400 11px ${FONT}`;
            ctx.textAlign = "left"; ctx.fillText(getSeatLabel(idx, cols), x + 8, yy + 14); ctx.textAlign = "center";
        }
    });
    return canvas;
}
function renderChartExportPreview() {
    const img = $id("chartExportImg");
    if (!img) return;
    img.src = renderSeatChartCanvas(getChartExportOptions()).toDataURL("image/png");
}
function saveChartAsPng() {
    const opts = getChartExportOptions();
    const canvas = renderSeatChartCanvas(opts);
    canvas.toBlob(blob => {
        if (!blob) { showToast("画像を作れませんでした。", "error"); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = `${(opts.title || "座席表").replace(/[\\/:*?"<>|]/g, "_")}.png`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
        showToast("座席表を画像で保存しました。", "success");
    }, "image/png");
}
async function printSeatChart() {
    const canvas = renderSeatChartCanvas(getChartExportOptions());
    const img = $id("printSheetImg");
    if (!img) return;
    img.src = canvas.toDataURL("image/png");
    // 用紙は、座席表の縦横に合わせて向きを決める
    let style = $id("printPageStyle");
    if (!style) { style = document.createElement("style"); style.id = "printPageStyle"; document.head.appendChild(style); }
    const paperSel = $id("chartOptPaper"), dirSel = $id("chartOptDir");
    const paper = paperSel && paperSel.value === "A3" ? "A3" : "A4";
    const dir = dirSel && dirSel.value !== "auto" ? dirSel.value : (canvas.width >= canvas.height ? "landscape" : "portrait");
    style.textContent = `@page { size: ${paper} ${dir}; margin: 10mm; }`;
    try { await img.decode(); } catch (error) { /* 読み込み待ちに失敗しても、そのまま印刷する */ }
    window.print();
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "print",
    suggests: ["furigana"],   // あわせて使うと便利なプラグイン
    name: "印刷・画像保存",
    version: "1.1",
    description: "座席表を、印刷用の画像にして、印刷やPNG保存ができます。",
    stubs: []
});
