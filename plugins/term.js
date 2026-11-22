// ==========================================
// 学期のまとめプラグイン：記録・統計の「まとめ」タブ。指名の偏りと、席の偏りを、ひと目で見る
// このファイルを index.html から外すと、「まとめ」タブも、使い方の説明も、まとめて消えます
// ==========================================
let statsSummaryPeriod = "all";
function setStatsSummaryPeriod(v) { statsSummaryPeriod = v || "all"; renderStatsDashboard(); }
function timelineEntriesForPeriod(period) {
    return seatTimeline.filter(e => {
        if (period === "all") return true;
        return period.startsWith("t:") && getTermInfoFor(e.at).key === period.slice(2);
    });
}
// 席替えの履歴から、同じ隣になった回数と、いちばん前・後ろの列になった回数を数える
function summarizeSeatTimeline(entries) {
    const pairCount = {}, front = {}, back = {}, seen = {};
    entries.forEach(e => {
        const cols = e.cols, atIdx = {};
        let lastRow = 0;
        e.n.forEach((raw, idx) => {
            if (e.f.charAt(idx) !== "s") return;
            const k = getCleanStudentKey(raw);
            if (!k) return;
            atIdx[idx] = k;
            lastRow = Math.max(lastRow, Math.floor(idx / cols));
        });
        Object.keys(atIdx).forEach(i => {
            const idx = parseInt(i, 10), k = atIdx[idx];
            seen[k] = true;
            const r = Math.floor(idx / cols);
            if (r === 0) front[k] = (front[k] || 0) + 1;
            if (lastRow > 0 && r === lastRow) back[k] = (back[k] || 0) + 1;
            const link = o => { if (o !== undefined) { const pk = [k, o].sort().join("\u0001"); pairCount[pk] = (pairCount[pk] || 0) + 1; } };
            if (idx % cols < cols - 1) link(atIdx[idx + 1]);
            link(atIdx[idx + cols]);
        });
    });
    return { pairCount: pairCount, front: front, back: back, seen: Object.keys(seen) };
}
function renderStatsSummary(data) {
    const body = $id("statsSummaryBody"), sel = $id("statsSummaryPeriod");
    if (!body) return;
    const esc = escapeStatsHtml;
    const terms = new Map();
    seatTimeline.forEach(e => { const t = getTermInfoFor(e.at); terms.set(t.key, { name: t.name, n: (terms.get(t.key) || { n: 0 }).n + 1 }); });
    if (sel) {
        sel.innerHTML = `<option value="all">すべて　${seatTimeline.length}回</option>` + Array.from(terms.entries()).map(([k, v]) => `<option value="t:${k}">${esc(v.name)}　${v.n}回</option>`).join("");
        if (!Array.from(sel.options).some(o => o.value === statsSummaryPeriod)) statsSummaryPeriod = "all";
        sel.value = statsSummaryPeriod;
        sel.parentElement.style.display = data.isArchive ? "none" : "";
    }
    const card = (num, label) => `<div class="stats-trend-card"><strong>${num}</strong><span>${label}</span></div>`;
    const topList = (entries, unit) => entries.map(([name, n]) => `<div class="stats-trend-row"><span class="stats-trend-name">${esc(name)}</span><span class="stats-trend-meta">${n}${unit}</span></div>`).join("");
    let html = "";

    // 指名
    const order = data.names.map(name => ({ name: name, count: ((data.nom[name] || {}).count) || 0 }));
    html += '<label class="input-label">指名の偏り</label>';
    if (order.length === 0) {
        html += '<p class="stats-empty">' + (data.isArchive ? "このアーカイブに記録はありません。" : "名簿にまだ誰もいません。") + "</p>";
    } else {
        const total = order.reduce((a, r) => a + r.count, 0);
        const never = order.filter(r => r.count === 0);
        const max = Math.max.apply(null, order.map(r => r.count)), min = Math.min.apply(null, order.map(r => r.count));
        html += '<div class="stats-trend-summary">' + card(total, "総指名回数") + card(max + "回", "いちばん多い人") + card(min + "回", "いちばん少ない人") + "</div>";
        let verdict;
        if (total === 0) verdict = "まだ指名の記録がありません。";
        else if (never.length > 0) verdict = `まだ一度も当たっていない人が、${never.length}人います。`;
        else if (max - min <= 1) verdict = "全員が、ほぼ同じ回数で当たっています。";
        else verdict = `多い人と少ない人で、${max - min}回の差があります。`;
        html += `<p class="stats-note">${esc(verdict)}</p>`;
        const most = order.slice().sort((a, b) => b.count - a.count).filter(r => r.count > 0).slice(0, 5).map(r => [r.name, r.count]);
        if (most.length) html += '<div class="stats-sub">多い順</div><div class="stats-trend-list stats-list-short">' + topList(most, "回") + "</div>";
        if (never.length) html += '<div class="stats-sub">まだ当たっていない人</div><p class="stats-note">' + esc(never.slice(0, 20).map(r => r.name).join("、")) + (never.length > 20 ? `　ほか${never.length - 20}人` : "") + "</p>";
    }

    // 席
    html += '<label class="input-label" style="margin-top: 16px;">席の偏り</label>';
    if (data.isArchive) {
        html += '<p class="stats-empty">アーカイブには、席替えの履歴が入っていません。「現在の記録」を選ぶと、見られます。</p>';
    } else {
        const entries = timelineEntriesForPeriod(statsSummaryPeriod);
        if (entries.length === 0) {
            html += '<p class="stats-empty">この期間の席替えの記録が、まだありません。</p>';
        } else {
            const sm = summarizeSeatTimeline(entries);
            html += `<p class="stats-note">${entries.length}回分の席替えを、集計しました。</p>`;
            const pairs = Object.keys(sm.pairCount).filter(k => sm.pairCount[k] >= 2).sort((a, b) => sm.pairCount[b] - sm.pairCount[a]).slice(0, 8)
                .map(k => [k.split("\u0001").join("・"), sm.pairCount[k]]);
            html += '<div class="stats-sub">何度も同じ隣になった組</div>';
            html += entries.length < 2 ? '<p class="stats-note">席替えが2回分たまると、調べられます。</p>'
                : (pairs.length ? '<div class="stats-trend-list stats-list-short">' + topList(pairs, "回") + "</div>" : '<p class="stats-note">2回以上、同じ隣になった組は、ありません。</p>');
            const frontTop = Object.keys(sm.front).sort((a, b) => sm.front[b] - sm.front[a]).slice(0, 5).map(k => [k, sm.front[k]]);
            const backTop = Object.keys(sm.back).sort((a, b) => sm.back[b] - sm.back[a]).slice(0, 5).map(k => [k, sm.back[k]]);
            html += '<div class="stats-sub">いちばん前の列になった回数が多い人</div>' + (frontTop.length ? '<div class="stats-trend-list stats-list-short">' + topList(frontTop, "回") + "</div>" : '<p class="stats-note">記録がありません。</p>');
            html += '<div class="stats-sub">いちばん後ろの列になった回数が多い人</div>' + (backTop.length ? '<div class="stats-trend-list stats-list-short">' + topList(backTop, "回") + "</div>" : '<p class="stats-note">記録がありません。</p>');
            if (entries.length >= 3) {
                const noFront = sm.seen.filter(k => !sm.front[k]);
                html += '<div class="stats-sub">一度もいちばん前の列になっていない人</div><p class="stats-note">' + (noFront.length ? esc(noFront.slice(0, 20).join("、")) + (noFront.length > 20 ? `　ほか${noFront.length - 20}人` : "") : "全員が、一度は前の列になっています。") + "</p>";
            }
        }
    }
    body.innerHTML = html;
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "term",
    requires: ["history"],   // 前提のプラグイン（無いと使えません）
    name: "学期のまとめ",
    version: "1.1",
    description: "記録・統計の画面に、「まとめ」のタブを出します。学期の終わりに、指名や席が偏っていなかったかを確かめられます。",
    statsTabs: [{
        id: "summary",
        label: "🧾 まとめ",
        hideReset: true,
        hideCsv: true,
        paneHtml: "            <p style=\"font-size: 12px; color: var(--text-sub); margin: 0 0 10px; line-height: 1.6;\">学期の終わりに、指名や席が偏っていなかったかを確かめます。席の集計は、席替えの履歴から数えています。</p>\n            <div style=\"margin-bottom: 10px;\">\n                <label for=\"statsSummaryPeriod\" class=\"input-label\">席を集計する期間：</label>\n                <select id=\"statsSummaryPeriod\" onchange=\"setStatsSummaryPeriod(this.value)\"></select>\n            </div>\n            <div id=\"statsSummaryBody\" class=\"stats-summary-body\"></div>\n        ",
        render: data => renderStatsSummary(data)
    }],
    mount(app) {
        app.insertInto("guide-stats", "<li><strong>まとめ</strong>：学期の終わりに、指名の偏りと、席の偏りを確かめます。まだ当たっていない人、何度も同じ隣になった組、いちばん前や後ろの列になった回数が分かります。</li>", "beforebegin");
    }
});
