// ==========================================
// 記録・統計プラグイン（必須）：指名と座席の履歴をためて、表やグラフで見られるようにします。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
function loadHistoryLogs() {
    try { nominationHistoryLog = JSON.parse(localStorage.getItem("nomination_history_log") || "{}"); } catch (error) { nominationHistoryLog = {}; }
    try { seatHistoryLog = JSON.parse(localStorage.getItem("seat_history_log") || "{}"); } catch (error) { seatHistoryLog = {}; }
}

function getCleanStudentKey(text) {
    let clean = getCleanNameForMatch(text || "").replace(/[（\(].*?[）\)]/g, "").trim();
    if (clean.includes(".")) { const parts = clean.split("."); clean = parts.slice(1).join(".").trim() || clean; }
    return clean;
}

function recordNominationHistory(rawText) {
    const key = getCleanStudentKey(rawText);
    if (!key) return null;
    const prev = nominationHistoryLog[key] ? { ...nominationHistoryLog[key] } : null; // 取り消す時に戻す、記録の前の姿
    if (!nominationHistoryLog[key]) nominationHistoryLog[key] = { count: 0, lastAt: 0 };
    nominationHistoryLog[key].count++;
    nominationHistoryLog[key].lastAt = Date.now();
    localStorage.setItem("nomination_history_log", JSON.stringify(nominationHistoryLog));
    return { key: key, prev: prev };
}

function recordSeatHistory() {
    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) : 6;
    currentStudents.forEach((seat, idx) => {
        if (!seat || seat.type !== "STUDENT" || !seat.text) return;
        const key = getCleanStudentKey(seat.text);
        if (!key) return;
        const label = getSeatLabel(idx, cols);
        if (!seatHistoryLog[key]) seatHistoryLog[key] = {};
        seatHistoryLog[key][label] = (seatHistoryLog[key][label] || 0) + 1;
    });
    localStorage.setItem("seat_history_log", JSON.stringify(seatHistoryLog));
    recordSeatLayout();
    recordSeatTimeline();
    if (typeof SekigaeApp !== "undefined") SekigaeApp._run("afterShuffle"); // 席替えが終わった後の記録（運の貯金など）
    updateCompareButton();
    updateSeatCheckButton();
    applyCompareBadges(); // 今の席替えが「前回」から見てどう変わったかを、印に反映する
}

function getMostFrequentSeat(key, seatLog) {
    const seats = (seatLog || seatHistoryLog)[key];
    if (!seats) return "-";
    let best = null, bestCount = 0;
    for (const label in seats) {
        if (seats[label] > bestCount) { best = label; bestCount = seats[label]; }
    }
    return best ? `${best}　${bestCount}回` : "-";
}

function formatRelativeTime(ts) {
    if (!ts) return "-";
    const diffMin = Math.floor((Date.now() - ts) / 60000);
    if (diffMin < 1) return "たった今";
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}時間前`;
    return `${Math.floor(diffHour / 24)}日前`;
}

// ---- 統計の表示元（現在の記録 / 学期アーカイブ）とタブ

let statsViewSource = "current"; // "current" か、アーカイブのid

let statsTab = "table"; // "table" | "chart" | "archive"

function loadStatsArchives() {
    try {
        const list = JSON.parse(localStorage.getItem("stats_archives") || "[]");
        return Array.isArray(list) ? list : [];
    } catch (error) { return []; }
}

function saveStatsArchives(list) {
    localStorage.setItem("stats_archives", JSON.stringify(list));
}

// 日付から「年度・学期」を求める（4〜7月＝1学期、8〜12月＝2学期、1〜3月＝3学期）

function getTermInfoFor(ts) {
    const d = new Date(ts);
    const month = d.getMonth() + 1;
    const schoolYear = month >= 4 ? d.getFullYear() : d.getFullYear() - 1;
    const term = month >= 4 && month <= 7 ? 1 : (month >= 8 ? 2 : 3);
    return { schoolYear, term, key: `${schoolYear}-${term}`, name: `${schoolYear}年度 ${term}学期` };
}

function getDefaultTermName() {
    return getTermInfoFor(Date.now()).name;
}

function formatStatsDate(ts) {
    if (!ts) return "-";
    const d = new Date(ts);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// 今表示している記録の元データ。現在の記録なら名簿の全員、アーカイブなら記録のある全員を対象にする。

function getStatsData() {
    if (statsViewSource !== "current") {
        const archive = loadStatsArchives().find(a => a.id === statsViewSource);
        if (archive) {
            const names = archive.names && archive.names.length ? archive.names : [...new Set([...Object.keys(archive.nom || {}), ...Object.keys(archive.seat || {})])];
            return { nom: archive.nom || {}, seat: archive.seat || {}, names: names, isArchive: true, title: archive.name };
        }
        statsViewSource = "current";
    }
    const names = [...new Set(lastRawList.map(s => getCleanStudentKey(s)).filter(s => s))];
    return { nom: nominationHistoryLog, seat: seatHistoryLog, names: names, isArchive: false, title: "現在の記録" };
}

// 直前の指名の取り消し：指名済みの印と、指名の回数を、指名する前に戻す

let nominationUndoStack = [];

function setStatsTab(tab) {
    statsTab = tab;
    renderStatsDashboard();
}

function setStatsViewSource(id) {
    statsViewSource = id || "current";
    renderStatsDashboard();
}

function renderStatsDashboard() {
    const container = $id("statsDashboardBody");
    if (!container) return;

    const data = getStatsData();

    // タブ表示
    ["table", "chart", "trend"].concat(SekigaeApp.statsTabIds(), ["archive", "timeline"]).forEach(t => {
        const btn = $id("statsTabBtn_" + t);
        const pane = $id("statsPane_" + t);
        if (btn) btn.classList.toggle("is-active", statsTab === t);
        if (pane) pane.style.display = statsTab === t ? "block" : "none";
    });

    // 表示する記録の選択肢
    const archives = loadStatsArchives();
    const srcSel = $id("statsSourceSelect");
    if (srcSel) {
        srcSel.innerHTML = '<option value="current">現在の記録</option>' + archives.map(a => `<option value="${a.id}">${escapeStatsHtml(a.name)}</option>`).join("");
        srcSel.value = data.isArchive ? statsViewSource : "current";
    }
    const resetBtn = $id("statsResetBtn");
    if (resetBtn) resetBtn.style.display = (data.isArchive || statsTab === "timeline" || SekigaeApp.statsTabFlag(statsTab, "hideReset")) ? "none" : "";
    const srcRow = $id("statsSourceRow");
    if (srcRow) srcRow.style.display = statsTab === "timeline" ? "none" : "";
    const csvBtn = document.querySelector('#statsModalOverlay button[onclick="downloadStatsCsv()"]');
    if (csvBtn) csvBtn.style.display = (statsTab === "timeline" || SekigaeApp.statsTabFlag(statsTab, "hideCsv")) ? "none" : "";
    if (statsTab === "timeline") renderTimeline();
    SekigaeApp.renderStatsTab(statsTab, data);

    const rows = data.names.map(name => {
        const nom = data.nom[name] || { count: 0, lastAt: 0 };
        return { name, count: nom.count, lastAt: nom.lastAt, seatInfo: getMostFrequentSeat(name, data.seat) };
    });
    rows.sort((a, b) => b.count - a.count);

    // 表
    if (rows.length === 0) {
        container.innerHTML = '<tr><td colspan="4" style="color: var(--text-sub);">' + (data.isArchive ? "このアーカイブに記録はありません。" : "名簿にまだ誰もいません。") + '</td></tr>';
    } else {
        container.innerHTML = rows.map(r =>
            `<tr><td>${escapeStatsHtml(r.name)}</td><td>${r.count}回</td><td>${data.isArchive ? formatStatsDate(r.lastAt) : formatRelativeTime(r.lastAt)}</td><td>${r.seatInfo}</td></tr>`
        ).join("");
    }

    renderStatsCharts(data, rows);
    renderStatsTrend(data, rows);
    renderStatsArchiveList(archives);
}


// 指名の傾向：しばらく当たっていない順に並べ、偏りが分かるようにする

function getNominationRecencyOrder(names, nomLog) {
    const list = names.map(name => {
        const nom = (nomLog && nomLog[name]) || { count: 0, lastAt: 0 };
        return { name: name, count: nom.count || 0, lastAt: nom.lastAt || 0 };
    });
    // 一度も当たっていない人（lastAt=0）が先頭。次に、最後に当たったのが古い順。同じなら回数が少ない順
    list.sort((a, b) => (a.lastAt - b.lastAt) || (a.count - b.count));
    return list;
}

function renderStatsTrend(data, rows) {
    const summary = $id("statsTrendSummary");
    const listBox = $id("statsTrendList");
    if (!summary || !listBox) return;
    const order = getNominationRecencyOrder(data.names, data.nom);
    if (order.length === 0) {
        summary.innerHTML = "";
        listBox.innerHTML = '<p class="stats-empty">' + (data.isArchive ? "このアーカイブに記録はありません。" : "名簿にまだ誰もいません。") + '</p>';
        return;
    }
    const total = order.reduce((sum, r) => sum + r.count, 0);
    const never = order.filter(r => r.count === 0).length;
    const avg = total / order.length;
    summary.innerHTML =
        `<div class="stats-trend-card"><strong>${total}</strong><span>総指名回数</span></div>` +
        `<div class="stats-trend-card"><strong>${never}</strong><span>まだ当たっていない人</span></div>` +
        `<div class="stats-trend-card"><strong>${avg.toFixed(1)}</strong><span>1人あたりの平均回数</span></div>`;
    const now = Date.now();
    listBox.innerHTML = order.map((r, i) => {
        let badge, meta;
        if (r.count === 0) {
            badge = '<span class="stats-trend-badge is-never">未指名</span>';
            meta = "0回";
        } else {
            const days = Math.floor((now - r.lastAt) / 86400000);
            const when = data.isArchive ? formatStatsDate(r.lastAt) : (days <= 0 ? "今日" : `${days}日前`);
            badge = r.count > avg * 1.5 && r.count >= 3 ? '<span class="stats-trend-badge is-recent">多め</span>' : "";
            meta = `${r.count}回・最後は${when}`;
        }
        return `<div class="stats-trend-row"><span class="stats-trend-rank">${i + 1}</span><span class="stats-trend-name">${escapeStatsHtml(r.name)}</span>${badge}<span class="stats-trend-meta">${meta}</span></div>`;
    }).join("");
}

// 「最近当たっていない人を当たりやすく」：指名の記録をもとに、当たりやすさ（重み）をつけて1人選ぶ。
// 古く当たった／回数の少ない人ほど重みが大きい（最大で約4倍）。完全に固定にはせず、全員にチャンスを残す。

function escapeStatsHtml(text) {
    return String(text).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
}

// グラフ：指名回数の棒グラフと、座席ごとの利用回数ヒートマップ

function renderStatsCharts(data, rows) {
    const barBox = $id("statsBarChart");
    if (barBox) {
        const max = rows.reduce((m, r) => Math.max(m, r.count), 0);
        if (rows.length === 0 || max === 0) {
            barBox.innerHTML = '<p class="stats-empty">指名の記録がまだありません。</p>';
        } else {
            barBox.innerHTML = rows.map(r => {
                const pct = Math.round((r.count / max) * 100);
                return `<div class="stats-bar-row"><span class="stats-bar-name">${escapeStatsHtml(r.name)}</span><span class="stats-bar-track"><span class="stats-bar-fill" style="width:${pct}%"></span></span><span class="stats-bar-value">${r.count}</span></div>`;
            }).join("");
        }
    }

    const sel = $id("statsHeatmapStudent");
    if (sel) {
        const keep = sel.value;
        sel.innerHTML = '<option value="">全員の合計</option>' + data.names.map(n => `<option value="${escapeStatsHtml(n)}">${escapeStatsHtml(n)}</option>`).join("");
        sel.value = data.names.includes(keep) ? keep : "";
    }
    const heatBox = $id("statsHeatmap");
    if (heatBox) {
        const target = sel ? sel.value : "";
        const counts = {};
        const addSeats = seats => { for (const lb in seats) counts[lb] = (counts[lb] || 0) + seats[lb]; };
        if (target) addSeats(data.seat[target] || {});
        else data.names.forEach(n => addSeats(data.seat[n] || {}));

        const colSel = $id("columnSelect"), rowSel = $id("rowSelect");
        let maxCol = colSel ? parseInt(colSel.value, 10) : 6, maxRow = rowSel ? parseInt(rowSel.value, 10) : 6;
        let maxCount = 0;
        Object.keys(counts).forEach(lb => {
            const m = lb.match(/^([A-Z])(\d+)$/);
            if (!m) return;
            maxCol = Math.max(maxCol, m[1].charCodeAt(0) - 64);
            maxRow = Math.max(maxRow, parseInt(m[2], 10));
            maxCount = Math.max(maxCount, counts[lb]);
        });
        if (maxCount === 0) {
            heatBox.innerHTML = '<p class="stats-empty">座席の記録がまだありません。</p>';
        } else {
            let html = `<div class="stats-heatmap-grid" style="grid-template-columns: repeat(${maxCol}, minmax(0, 1fr));">`;
            for (let r = 1; r <= maxRow; r++) {
                for (let cIdx = maxCol - 1; cIdx >= 0; cIdx--) { // 右端がA列になるよう、列を右から左へ並べる
                    const lb = String.fromCharCode(65 + cIdx) + r;
                    const n = counts[lb] || 0;
                    const strength = n === 0 ? 0 : Math.round(15 + (n / maxCount) * 75);
                    html += `<div class="stats-heat-cell" style="background: color-mix(in srgb, var(--c-green) ${strength}%, transparent);" title="${lb}：${n}回"><span class="stats-heat-label">${lb}</span><span class="stats-heat-count">${n || ""}</span></div>`;
                }
            }
            heatBox.innerHTML = html + "</div>";
        }
    }
}

// ---- 学期アーカイブ

function renderStatsArchiveList(archives) {
    const box = $id("statsArchiveList");
    if (!box) return;
    if (archives.length === 0) {
        box.innerHTML = '<p class="stats-empty">まだアーカイブはありません。</p>';
        return;
    }
    box.innerHTML = archives.slice().reverse().map(a => {
        const total = Object.values(a.nom || {}).reduce((sum, v) => sum + (v.count || 0), 0);
        return `<div class="stats-archive-item"><div class="stats-archive-info"><strong>${escapeStatsHtml(a.name)}</strong><span>${formatStatsDate(a.savedAt)} 保存・指名 ${total}回</span></div><div class="stats-archive-actions"><button type="button" class="btn-secondary btn-compact" onclick="viewStatsArchive('${a.id}')">👀 見る</button><button type="button" class="btn-delete-mini btn-compact" onclick="deleteStatsArchive('${a.id}')">🗑️ 削除</button></div></div>`;
    }).join("");
}

function saveStatsArchive() {
    const hasData = Object.keys(nominationHistoryLog).length > 0 || Object.keys(seatHistoryLog).length > 0;
    if (!hasData) { showToast("アーカイブできる記録がまだありません。", "error"); return; }
    const nameInput = $id("statsArchiveName");
    const name = (nameInput && nameInput.value.trim()) || getDefaultTermName();
    const resetToggle = $id("statsArchiveResetToggle");

    const names = [...new Set(lastRawList.map(s => getCleanStudentKey(s)).filter(s => s))];
    const archives = loadStatsArchives();
    archives.push({
        id: "arc_" + Date.now().toString(36),
        name: name,
        savedAt: Date.now(),
        names: names,
        nom: JSON.parse(JSON.stringify(nominationHistoryLog)),
        seat: JSON.parse(JSON.stringify(seatHistoryLog))
    });
    saveStatsArchives(archives);

    if (resetToggle && resetToggle.checked) {
        nominationHistoryLog = {};
        seatHistoryLog = {};
        localStorage.removeItem("nomination_history_log");
        localStorage.removeItem("seat_history_log");
        clearSeatLayoutLog(false);
    }
    if (nameInput) nameInput.value = "";
    showBackupReminder("archive");
    showToast(`「${name}」としてアーカイブしました。` + (resetToggle && resetToggle.checked ? "現在の記録は新しい学期用にリセットしました。" : ""), "success");
    renderStatsDashboard();
}

function viewStatsArchive(id) {
    statsViewSource = id;
    statsTab = "table";
    renderStatsDashboard();
}

function deleteStatsArchive(id) {
    const archives = loadStatsArchives();
    const target = archives.find(a => a.id === id);
    if (!target) return;
    if (!confirm(`アーカイブ「${target.name}」を削除します。元に戻せません。よろしいですか？`)) return;
    saveStatsArchives(archives.filter(a => a.id !== id));
    if (statsViewSource === id) statsViewSource = "current";
    renderStatsDashboard();
    showToast("アーカイブを削除しました。", "success");
}

// 今表示している記録をCSVで保存する（Excelで開けるようBOM付き）

function downloadStatsCsv() {
    const data = getStatsData();
    const q = v => `"${String(v).replace(/"/g, '""')}"`;
    const lines = [["名前", "指名回数", "最終指名", "よく座る席"].map(q).join(",")];
    data.names.forEach(name => {
        const nom = data.nom[name] || { count: 0, lastAt: 0 };
        lines.push([name, nom.count, nom.lastAt ? formatStatsDate(nom.lastAt) : "", getMostFrequentSeat(name, data.seat)].map(q).join(","));
    });
    const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `席替えし太郎_記録_${data.title}.csv`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}

function resetHistoryLogs() {
    nominationHistoryLog = {};
    seatHistoryLog = {};
    localStorage.removeItem("nomination_history_log");
    localStorage.removeItem("seat_history_log");
    clearSeatLayoutLog(false);
    renderStatsDashboard();
    showToast("記録をリセットしました。", "success");
}

function openStatsModal() {
    updateStatsClassNote();
    statsViewSource = "current";
    statsTab = "table";
    const nameInput = $id("statsArchiveName");
    if (nameInput) nameInput.placeholder = getDefaultTermName();
    renderStatsDashboard();
    const overlay = $id("statsModalOverlay");
    if (overlay) overlay.style.display = "flex";
}

function closeStatsModal() {
    const overlay = $id("statsModalOverlay");
    if (overlay) overlay.style.display = "none";
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "stats",
    name: "記録・統計",
    version: "1.0",
    required: true,
    description: "指名と座席の履歴をためて、表やグラフで見られるようにします。"
});
