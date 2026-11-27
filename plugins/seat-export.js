// ==========================================
// 座席表のかんたん保存プラグイン：座席表を、ワンタッチで、PNGの画像や、PDFにして保存します。
// 「印刷・画像保存」の、前回の設定（名前の表示や向きなど）を、そのまま使います
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// ==========================================
const SE_PDF_MARGIN = 28;

function seHasChart() {
    return !!(currentStudents && currentStudents.length && currentStudents.some(s => s && s.type === "STUDENT"));
}

function seFileBase() {
    const opts = getChartExportOptions();
    const title = (opts.title || getChartDefaultTitle() || "座席表").replace(/[\\/:*?"<>|]/g, "_");
    const d = new Date();
    const stamp = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    return title + "_" + stamp;
}

// 印刷・画像保存の窓を開かなくても、前回の設定で、座席表の画像を作ります
function seMakeCanvas() {
    const opts = getChartExportOptions();
    if (!opts.title) opts.title = getChartDefaultTitle();
    return renderSeatChartCanvas(opts);
}

function seDownload(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

function seSavePng() {
    closePopMenus();
    if (!seHasChart()) { showToast("座席表が空です", "error"); return; }
    const canvas = seMakeCanvas();
    canvas.toBlob(blob => {
        if (!blob) { showToast("画像を作れませんでした", "error"); return; }
        seDownload(blob, seFileBase() + ".png");
        showToast("座席表を画像で保存しました", "success");
    }, "image/png");
}

// JPEG の画像 1枚だけを入れた、PDF を作ります（外部のライブラリは、使いません）
function seBuildPdf(jpeg, imgW, imgH) {
    const landscape = imgW >= imgH;
    const PW = landscape ? 841.89 : 595.28, PH = landscape ? 595.28 : 841.89;
    const m = SE_PDF_MARGIN;
    const sc = Math.min((PW - m * 2) / imgW, (PH - m * 2) / imgH);
    const w = imgW * sc, h = imgH * sc;
    const x = (PW - w) / 2, y = (PH - h) / 2;
    const enc = new TextEncoder();
    const parts = [];
    const offsets = [];
    let len = 0;
    const push = data => { const b = typeof data === "string" ? enc.encode(data) : data; parts.push(b); len += b.length; };
    const obj = (n, body) => { offsets[n] = len; push(n + " 0 obj\n" + body + "\nendobj\n"); };
    push("%PDF-1.4\n");
    obj(1, "<< /Type /Catalog /Pages 2 0 R >>");
    obj(2, "<< /Type /Pages /Kids [3 0 R] /Count 1 >>");
    obj(3, "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " + PW.toFixed(2) + " " + PH.toFixed(2) + "] /Contents 4 0 R /Resources << /XObject << /Im0 5 0 R >> >> >>");
    const content = "q " + w.toFixed(2) + " 0 0 " + h.toFixed(2) + " " + x.toFixed(2) + " " + y.toFixed(2) + " cm /Im0 Do Q";
    obj(4, "<< /Length " + content.length + " >>\nstream\n" + content + "\nendstream");
    offsets[5] = len;
    push("5 0 obj\n<< /Type /XObject /Subtype /Image /Width " + imgW + " /Height " + imgH + " /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " + jpeg.length + " >>\nstream\n");
    push(jpeg);
    push("\nendstream\nendobj\n");
    const xref = len;
    let table = "xref\n0 6\n0000000000 65535 f \n";
    for (let i = 1; i <= 5; i++) table += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    push(table + "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n" + xref + "\n%%EOF\n");
    return new Blob(parts, { type: "application/pdf" });
}

function seSavePdf() {
    closePopMenus();
    if (!seHasChart()) { showToast("座席表が空です", "error"); return; }
    const canvas = seMakeCanvas();
    canvas.toBlob(async blob => {
        if (!blob) { showToast("PDFを作れませんでした", "error"); return; }
        try {
            const jpeg = new Uint8Array(await blob.arrayBuffer());
            seDownload(seBuildPdf(jpeg, canvas.width, canvas.height), seFileBase() + ".pdf");
            showToast("座席表をPDFで保存しました", "success");
        } catch (error) {
            showToast("PDFを作れませんでした", "error");
        }
    }, "image/jpeg", 0.95);
}

SekigaeApp.registerPlugin({
    id: "seat-export",
    name: "座席表の簡単保存",
    version: "1.0",
    description: "座席表をワンタッチで、PNGの画像や、PDFにして保存します。",
    requires: ["print"],
    searchWords: "保存 画像 PDF ピーディーエフ PNG 書き出し 座席表 ワンタッチ ダウンロード",
    mount(app) {
        app.insertInto("guide-faq", "<li data-plugin=\"seat-export\"><strong>座席表をすぐに画像やPDFにしたい</strong>：「他の操作」の「画像で保存」か「PDFで保存」を押します。名前の表示や向きは「座席表を印刷・画像保存」で前に選んだ設定を使います。</li>");
        const more = $id("moreMenu");
        if (!more || $id("seatExportRow")) return;
        const st = document.createElement("style");
        st.id = "seatExportStyle";
        st.textContent = `
.pop-item-split { display: flex; gap: 8px; }
.pop-item-split .pop-item { flex: 1 1 0; width: auto; min-width: 0; padding-left: 8px; padding-right: 8px; }`;
        document.head.appendChild(st);
        const row = document.createElement("div");
        row.id = "seatExportRow";
        row.className = "pop-item-split";
        row.setAttribute("data-plugin", "seat-export");
        row.innerHTML = '<button type="button" class="pop-item pop-item-gray" id="btnSavePng" onclick="seSavePng()">画像で保存</button>' +
            '<button type="button" class="pop-item pop-item-gray" id="btnSavePdf" onclick="seSavePdf()">PDFで保存</button>';
        const share = $id("btnShareMenu");
        if (share) more.insertBefore(row, share); else more.appendChild(row);
    }
});
