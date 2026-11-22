// ==========================================
// 更新情報プラグイン：新しいバージョンの知らせを確かめます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="updateinfo" で結びついていて、自動で隠れます）
// ==========================================
let latestKnownChangelogVersion = null;

// バージョン文字列（"3.26.0" や "α4.0.0" 等）を比較する。数字部分だけを見るので、
// 先頭にα等の接頭辞が付いていても大小関係は数字で判断する。
function compareVersions(a, b) {
    const parse = v => (v || "").replace(/^[^\d]*/, "").split(".").map(n => parseInt(n, 10) || 0);
    const pa = parse(a), pb = parse(b);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const diff = (pa[i] || 0) - (pb[i] || 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

// スプレッドシートの行の並び順（開発者が一番上に挿入する想定）に頼らず、
// 実際のバージョン番号の大小で新しい順に並べ直す。行を下に追加してしまっても正しく検知できるように。
function sortChangelogEntriesDesc(entries) {
    return [...entries].sort((a, b) => compareVersions(b.version, a.version));
}
// 更新情報の取り先：自前のサーバー（script.js の CHANGELOG_JSON_URL）があればそれ、なければ GAS
function changelogSource() { return CHANGELOG_JSON_URL || CHANGELOG_GAS_URL; }
// 通信できないとき、設定されていないときは、アプリの中の履歴（changelog.js）を出します
function showLocalChangelog() {
    const body = $id("updateInfoBody");
    if (typeof LOCAL_CHANGELOG === "undefined" || !LOCAL_CHANGELOG.length) {
        if (body) body.innerHTML = '<p style="color: var(--text-sub); font-size: 13px;">更新情報を取得できませんでした。</p>';
        return;
    }
    renderUpdateInfoModal(sortChangelogEntriesDesc(LOCAL_CHANGELOG));
}
// 取り先が .json のURL（GitHub など）なら、そのまま読みます。それ以外（updates.php や GAS）は、JSONP で読みます
function changelogRequest(callbackName, onDone, onFail) {
    const src = changelogSource();
    if (/\.json(\?.*)?$/i.test(src)) {
        fetch(src, { cache: "no-store" })
            .then(r => { if (!r.ok) throw new Error("http " + r.status); return r.json(); })
            .then(list => onDone({ found: Array.isArray(list) && list.length > 0, entries: Array.isArray(list) ? list : [] }))
            .catch(() => onFail && onFail());
        return;
    }
    sendServerRequest(src, { action: "changelog" }, callbackName, onDone);
}
function checkForAppUpdates() {
    if (!changelogSource()) return;
    changelogRequest("handleChangelogAutoCheck", function(res) {
        if (!res || !res.found || !res.entries || res.entries.length === 0) return;
        const sorted = sortChangelogEntriesDesc(res.entries);
        latestKnownChangelogVersion = sorted[0].version || null;
        if (latestKnownChangelogVersion && compareVersions(latestKnownChangelogVersion, APP_VERSION) > 0) {
            // 既読かどうかに関わらず、新しいバージョンがある間はバッジを出し続ける。
            showUpdateBadge();
            // ポップアップは起動して情報が取れたタイミングで毎回表示する。
            // ただし「このバージョンを無視する」を押した版（またはそれ以前）の場合だけは出さない。
            // それより新しいバージョンが出れば、また表示する。
            renderNewUpdateModal(sorted[0]);
            if (!isUpdatePopupIgnored(latestKnownChangelogVersion)) {
                const overlay = $id("newUpdateModalOverlay");
                if (overlay) overlay.style.display = "flex";
            }
        }
    });
}

// 「このバージョンを無視する」で記録したバージョン以下なら、ポップアップを出さない。
function isUpdatePopupIgnored(version) {
    try {
        const ignored = localStorage.getItem("ignored_update_version");
        return !!ignored && compareVersions(version, ignored) <= 0;
    } catch (error) { return false; }
}
function ignoreThisUpdateVersion() {
    const version = latestKnownChangelogVersion;
    if (version) {
        try { localStorage.setItem("ignored_update_version", version); } catch (error) {}
    }
    closeNewUpdateModal();
    showToast(`Ver.${version || ""} のお知らせポップアップを表示しないようにしました。新しいバージョンが出ると、また表示します。`, "success");
}
function renderNewUpdateModal(latestEntry) {
    const titleEl = $id("newUpdateTitle");
    if (titleEl) titleEl.textContent = `最新アップデート「Ver.${latestEntry.version}」が見つかりました`;
    const curEl = $id("newUpdateCurrentVer");
    if (curEl) curEl.textContent = "Ver." + APP_VERSION;
    const latEl = $id("newUpdateLatestVer");
    if (latEl) latEl.textContent = "Ver." + latestEntry.version;
    const notesEl = $id("newUpdateNotes");
    if (notesEl) notesEl.textContent = latestEntry.notes || "";
}
function closeNewUpdateModal() {
    const overlay = $id("newUpdateModalOverlay");
    if (overlay) overlay.style.display = "none";
}

// 設定メニューの「更新履歴を見る」から呼ばれる。常に最新を取りに行って表示する。
// 最新バージョンの配布ページ（GitHub の Releases）を新しいタブで開く
function openLatestVersionPage() {
    window.open(LATEST_VERSION_URL, "_blank", "noopener,noreferrer");
}
function openUpdateInfoModal(forceRefresh) {
    const body = $id("updateInfoBody");
    const overlay = $id("updateInfoModalOverlay");
    if (!changelogSource()) {
        if (overlay) overlay.style.display = "flex";
        showLocalChangelog();
        return;
    }
    if (body) body.innerHTML = '<p style="color: var(--text-sub); font-size: 13px;">読み込み中...</p>';
    if (overlay) overlay.style.display = "flex";

    changelogRequest("handleChangelogManual", function(res) {
        if (!res || !res.found || !res.entries || res.entries.length === 0) { showLocalChangelog(); return; }
        const sorted = sortChangelogEntriesDesc(res.entries);
        latestKnownChangelogVersion = sorted[0].version || null;
        renderUpdateInfoModal(sorted);
    }, showLocalChangelog);
}

// 更新情報の日付を yyyy/mm/dd だけの表記に揃える（時刻が混ざっていても取り除く）。
// GAS側でも整形しているが、テキスト直打ちのセルなどで時刻付きの文字列が来た場合の保険。
function formatChangelogDate(dateStr) {
    if (!dateStr) return "";
    const isoLike = dateStr.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (isoLike) {
        const y = isoLike[1], m = isoLike[2].padStart(2, "0"), d = isoLike[3].padStart(2, "0");
        return `${y}/${m}/${d}`;
    }
    const parsed = new Date(dateStr);
    if (!isNaN(parsed.getTime())) {
        const y = parsed.getFullYear(), m = String(parsed.getMonth() + 1).padStart(2, "0"), d = String(parsed.getDate()).padStart(2, "0");
        return `${y}/${m}/${d}`;
    }
    return dateStr;
}
function renderUpdateInfoModal(entries) {
    const body = $id("updateInfoBody");
    if (!body) return;
    const escapeHtml = s => stripEmoji(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const entryHtml = e => `
        <div class="update-entry">
            <div class="update-entry-header">
                <span class="update-entry-version">Ver.${escapeHtml(e.version)}</span>
                <span class="update-entry-date">${escapeHtml(formatChangelogDate(e.date))}</span>
            </div>
            <div class="update-entry-notes">${escapeHtml(e.notes)}</div>
        </div>`;

    // 今のバージョンより新しいものがあれば、ポップアップと同じ内容を一番上に出し、その下にすべての履歴を並べる。
    const latest = entries[0];
    if (latest && compareVersions(latest.version, APP_VERSION) > 0) {
        body.innerHTML = `
            <div class="update-highlight">
                <div class="update-highlight-title">最新アップデート「Ver.${escapeHtml(latest.version)}」が見つかりました</div>
                <p class="update-highlight-lead">席替えし太郎の新しいバージョンが利用可能です。</p>
                <div class="update-highlight-ver">Ver.${escapeHtml(APP_VERSION)} → <span>Ver.${escapeHtml(latest.version)}</span></div>
                <div class="update-entry-notes">${escapeHtml(latest.notes)}</div>
            </div>
            <div class="update-all-title">すべての更新履歴</div>
            ${entries.map(entryHtml).join("")}`;
    } else {
        body.innerHTML = entries.map(entryHtml).join("");
    }
}

// 開いていたのを実際に閉じた時点で「読んだ」ことにする。検知しただけの時点では既読にしない。
function closeUpdateInfoModal() {
    const overlay = $id("updateInfoModalOverlay");
    if (overlay) overlay.style.display = "none";
}
function showUpdateBadge() {
    const toggleBtn = $id("configMenuBtn");
    if (toggleBtn) toggleBtn.classList.add("has-update-badge");
    const openBtn = $id("updateInfoOpenBtn");
    if (openBtn) openBtn.classList.add("has-update-badge");
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "updateinfo",
    name: "更新情報",
    version: "1.1",
    description: "新しいバージョンの知らせを確かめます。自前のサーバーか GAS から取り、通信できないときは、アプリの中の履歴を出します。",
    stubs: ["checkForAppUpdates"]
});
