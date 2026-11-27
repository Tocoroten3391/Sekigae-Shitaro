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
            renderNewUpdateModal(sorted[0], sorted);
            // 設定で「設定ボタンの印だけ」を選んでいる時は、ポップアップを出さない
            if (updNoticeMode() === "popup" && !isUpdatePopupIgnored(latestKnownChangelogVersion) && !updSnoozed(latestKnownChangelogVersion)) {
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
// ---- 更新の説明文を、「新機能・改善・修正」に分けて見せる ----
// 説明文に【新機能】【改善】【修正】と書いてあれば、それを使います。書いていない古い履歴は、言葉から、およその種類を決めます
const UPD_CATS = { "new": "新機能", "improve": "改善", "fix": "修正" };
const UPD_TAG_MAP = { "新機能": "new", "改善": "improve", "修正": "fix", "その他": "improve" };
function updEsc(t) { return stripEmoji(t || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function updGuessCat(text) {
    if (/(修正|直し|なおし|不具合|崩れ|見えにく|問題)/.test(text)) return "fix";
    if (/(できるように|使えるように|作れるように|選べるように|ようになりました|新機能|新しく|ができました|を作りました|を入れました)/.test(text)) return "new";
    return "improve";
}
function updParseNotes(notes) {
    const out = [];
    String(notes || "").split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line) return;
        // 1行に「／」で、いくつも並べてある古い書き方は、文の終わりの「／」だけで分ける
        line.split(/(?<=(?:ました|ました。|修正|追加|変更|統一|そろえた|置きかえ|です|ます|した))／/).forEach(part => {
            part = part.trim();
            if (!part) return;
            let cat = null;
            const m = part.match(/^【(新機能|改善|修正|その他)】\s*/);
            if (m) { cat = UPD_TAG_MAP[m[1]]; part = part.slice(m[0].length); }
            if (!part) return;
            out.push({ cat: cat || updGuessCat(part), text: part });
        });
    });
    return out;
}
// 新機能の説明から、その機能の設定を探すためのことば（説明の中に、左の言葉があれば、「設定を開く」を付けます）
const UPD_TRY = [
    [/条件セット/, "条件セット"], [/クラスごとに持/, "クラスごとの設定"], [/保存履歴/, "保存履歴"], [/順番リスト/, "順番リスト"],
    [/まとめて進級|全クラス/, "クラスのまとめ"], [/ふりがな/, "ふりがな"], [/拡張画面/, "拡張画面"], [/席替えの予約/, "予約"],
    [/公平性/, "公平性"], [/運の貯金/, "運の貯金"], [/希望|配慮/, "希望"], [/テスト用/, "テスト用座席"], [/席ラベル|名札/, "席ラベル"],
    [/教室の配置/, "教室の配置"], [/更新のお知らせ/, "更新のお知らせ"], [/プログラムタイマー|時間割/, "プログラムタイマー"],
    [/偏り防止|発言バランス/, "偏り防止"], [/画面スタイル/, "画面スタイル"], [/バックアップ/, "バックアップ"], [/タイマー/, "タイマー"]
];
function updTryQuery(text) {
    for (const [re, q] of UPD_TRY) if (re.test(text)) return q;
    return "";
}
// 設定を開いて、さがす欄に言葉を入れる
function updTry(q) {
    closeNewUpdateModal(); closeWhatsNewModal();
    const o = $id("updateInfoModalOverlay");
    if (o) o.style.display = "none";
    const cc = $id("configContainer");
    if (cc && !cc.classList.contains("open") && typeof toggleConfigMenu === "function") toggleConfigMenu();
    const input = $id("configSearchInput");
    if (!input) return;
    input.value = q;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    try { if (typeof ssRun === "function") { ssIndex = null; ssRun(); } } catch (e) { /* 検索が使えなくても、言葉は入っています */ }
    input.focus();
}
function updTryHtml(it) {
    if (it.cat !== "new") return "";
    const q = updTryQuery(it.text);
    return q ? ` <button type="button" class="upd-try" data-q="${updEsc(q)}">設定を開く</button>` : "";
}
function updBulletsHtml(entry, filter, query) {
    const q = (query || "").trim().toLowerCase();
    const whole = q && ((entry.version || "") + " " + (entry.date || "")).toLowerCase().includes(q);
    const items = updParseNotes(entry.notes).filter(it =>
        (!filter || filter === "all" || it.cat === filter) && (!q || whole || it.text.toLowerCase().includes(q)));
    if (!items.length) return "";
    return '<ul class="upd-list">' + items.map(it =>
        `<li><span class="upd-tag upd-${it.cat}">${UPD_CATS[it.cat]}</span><span class="upd-txt">${updEsc(it.text)}${updTryHtml(it)}</span></li>`).join("") + "</ul>";
}

// ---- 更新のしかた ----
function updHowtoHtml() {
    const web = /^https?:/.test(location.protocol);
    const last = typeof getBackupLastAt === "function" ? getBackupLastAt() : 0;
    const lastTxt = last ? `最後のバックアップ：${typeof formatBackupDate === "function" ? formatBackupDate(last) : new Date(last).toLocaleDateString()}` : "まだ、バックアップを取っていません。";
    const steps = web
        ? ["「バックアップを開く」で、今のデータを書き出して、とっておきます。", "このページを再読み込みします。新しい版が自動で入ります。", "変わらない時はもう一度、再読み込みします。"]
        : ["「バックアップを開く」で、今のデータを書き出して、とっておきます。", "「最新バージョンはこちら」で、新しい版のzipをダウンロードして、展開します。", "展開してできたファイルを、今使っているフォルダに上書きして、アプリを開き直します。"];
    return `<details class="upd-howto"><summary>更新のしかた</summary><ol>${steps.map(t => `<li>${t}</li>`).join("")}</ol>
        <div class="upd-howto-last${last ? "" : " is-warn"}">${updEsc(lastTxt)}</div>
        <button type="button" class="btn-secondary upd-howto-btn">バックアップを開く</button></details>`;
}
const UPD_SNOOZE_KEY = "update_snooze_v1";   // { until: 時刻, ver: そのとき知らせていた版 }
function updSnoozed(ver) {
    try {
        const s = JSON.parse(localStorage.getItem(UPD_SNOOZE_KEY) || "null");
        return !!s && s.ver === ver && Date.now() < s.until;
    } catch (e) { return false; }
}
function updSnoozeFor(days) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    try { localStorage.setItem(UPD_SNOOZE_KEY, JSON.stringify({ until: d.getTime(), ver: latestKnownChangelogVersion })); } catch (e) { /* 何もしない */ }
    closeNewUpdateModal();
    showToast(days === 1 ? "今日はもう知らせません。明日、また知らせます。" : `${days}日後にまた知らせます。`, "success");
}
function updSnoozeAsk() {
    if (typeof presetDialog !== "function") { updSnoozeFor(3); return; }
    presetDialog({
        title: "後で知らせる",
        message: "いつ、また知らせますか？",
        buttons: [
            { label: "やめる", value: "cancel", cls: "btn-secondary" },
            { label: "今日は出さない", value: "1", cls: "btn-secondary" },
            { label: "3日後", value: "3", cls: "btn-connect is-primary", primary: true }
        ]
    }, v => { if (v === "1" || v === "3") updSnoozeFor(Number(v)); });
}

// 更新のお知らせポップアップ。いまの版より新しい版が、いくつもあるときは、まとめて見せます
function renderNewUpdateModal(latestEntry, allSorted) {
    let newer = Array.isArray(allSorted) ? allSorted.filter(e => compareVersions(e.version, APP_VERSION) > 0) : [];
    if (!newer.length) newer = [latestEntry];
    const titleEl = $id("newUpdateTitle");
    if (titleEl) titleEl.textContent = `新しいバージョン Ver.${latestEntry.version} があります`;
    const curEl = $id("newUpdateCurrentVer");
    if (curEl) curEl.textContent = "Ver." + APP_VERSION;
    const latEl = $id("newUpdateLatestVer");
    if (latEl) latEl.textContent = "Ver." + latestEntry.version;
    const cntEl = $id("newUpdateCount");
    if (cntEl) cntEl.textContent = newer.length > 1 ? `${newer.length}回分の更新があります` : "";
    const notesEl = $id("newUpdateNotes");
    if (!notesEl) return;
    const SHOW = 5;
    const multi = newer.length > 1;
    let html = newer.slice(0, SHOW).map(e => {
        const list = updBulletsHtml(e) || '<p class="upd-none">この版の説明はありません。</p>';
        return multi
            ? `<div class="upd-ver"><div class="upd-ver-head"><span class="upd-ver-no">Ver.${updEsc(e.version)}</span><span class="upd-ver-date">${updEsc(formatChangelogDate(e.date))}</span></div>${list}</div>`
            : list;
    }).join("");
    if (newer.length > SHOW) html += `<p class="upd-more">ほか ${newer.length - SHOW}回分の更新は「更新履歴を見る」で見られます。</p>`;
    notesEl.innerHTML = html;
    const howto = $id("newUpdateHowto");
    if (howto) howto.innerHTML = updHowtoHtml();
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
// ---- 更新履歴：検索・種類の絞り込み・折りたたみ ----
let updHist = { entries: [], filter: "all", query: "" };
function renderUpdateInfoModal(entries) {
    updHist.entries = entries || [];
    updHist.filter = "all";
    updHist.query = "";
    const tools = $id("updateInfoTools");
    if (tools) {
        tools.innerHTML = `
            <input type="search" id="updateInfoSearch" class="upd-search" placeholder="言葉でさがす　例：タイマー、指名" autocomplete="off">
            <div class="upd-chips" role="group" aria-label="種類で絞りこむ">
                ${[["all", "全て"], ["new", "新機能"], ["improve", "改善"], ["fix", "修正"]].map(c => `<button type="button" class="upd-chip${c[0] === "all" ? " is-on" : ""}" data-filter="${c[0]}">${c[1]}</button>`).join("")}
            </div>`;
        const input = $id("updateInfoSearch");
        if (input) input.addEventListener("input", () => { updHist.query = input.value; renderUpdateInfoList(); });
        tools.querySelectorAll(".upd-chip").forEach(btn => btn.addEventListener("click", () => {
            updHist.filter = btn.dataset.filter;
            tools.querySelectorAll(".upd-chip").forEach(b => b.classList.toggle("is-on", b === btn));
            renderUpdateInfoList();
        }));
    }
    renderUpdateInfoList();
}
function renderUpdateInfoList() {
    const body = $id("updateInfoBody");
    if (!body) return;
    const { entries, filter, query } = updHist;
    const filtering = filter !== "all" || !!query.trim();
    let html = "";
    const latest = entries[0];
    if (latest && compareVersions(latest.version, APP_VERSION) > 0) {
        html += `<div class="upd-banner">新しいバージョン <b>Ver.${updEsc(latest.version)}</b> があります（今 Ver.${updEsc(APP_VERSION)}）</div>` + updHowtoHtml();
    }
    let shown = 0;
    entries.forEach((e, i) => {
        const bullets = updBulletsHtml(e, filter, query);
        if (!bullets) return;
        shown++;
        const cmp = compareVersions(e.version, APP_VERSION);
        const mark = cmp > 0 ? '<span class="upd-mark upd-mark-new">新着</span>' : (cmp === 0 ? '<span class="upd-mark upd-mark-now">今使用中</span>' : "");
        const first = updParseNotes(e.notes)[0];
        const preview = first ? `<span class="upd-prev">${updEsc(first.text)}</span>` : "";
        const open = filtering || cmp >= 0 || shown <= 3;
        html += `<details class="upd-entry"${open ? " open" : ""}>
            <summary><span class="upd-sum-main"><span class="upd-ver-no">Ver.${updEsc(e.version)}</span>${mark}<span class="upd-ver-date">${updEsc(formatChangelogDate(e.date))}</span></span>${preview}</summary>
            ${bullets}
        </details>`;
    });
    if (!shown) html += `<p class="upd-none">${filtering ? "あてはまる更新はありません。" : "更新情報はありません。"}</p>`;
    else html += `<p class="upd-count-line">${filtering ? "あてはまる更新：" : "全"}${shown}件</p>`;
    body.innerHTML = html;
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

// ---- 更新のお知らせの出し方（設定）と、更新したあとの「変わったところ」 ----
const UPD_MODE_KEY = "update_notice_mode";       // "popup"（既定）／"badge"（設定ボタンの印だけ）
const UPD_SEEN_KEY = "last_seen_app_version";    // 前に起動した時の版。更新したかどうかを知るため
function updNoticeMode() {
    try { return localStorage.getItem(UPD_MODE_KEY) === "badge" ? "badge" : "popup"; } catch (e) { return "popup"; }
}
function setUpdateNoticeMode(v) {
    try { localStorage.setItem(UPD_MODE_KEY, v === "badge" ? "badge" : "popup"); } catch (e) { /* 何もしない */ }
    showToast(v === "badge" ? "更新のお知らせは設定ボタンの印だけにしました。" : "更新のお知らせをポップアップで出します。", "success");
}
function updSaveSeen() { try { localStorage.setItem(UPD_SEEN_KEY, APP_VERSION); } catch (e) { /* 何もしない */ } }
function updAnyModalOpen() {
    return Array.from(document.querySelectorAll(".modal-overlay")).some(o => getComputedStyle(o).display !== "none");
}
function closeWhatsNewModal() {
    const o = $id("whatsNewModalOverlay");
    if (o) o.style.display = "none";
}
// 更新して、はじめて起動した時に、1回だけ、変わったところを見せる（アプリの中の履歴を使うので、通信は要りません）
function updCheckWhatsNew(retried) {
    let last = null;
    try { last = localStorage.getItem(UPD_SEEN_KEY); } catch (e) { return; }
    if (!last) { updSaveSeen(); return; }   // はじめての起動：何も出さない
    const cmp = compareVersions(APP_VERSION, last);
    if (cmp <= 0) { if (cmp < 0) updSaveSeen(); return; }
    if (updNoticeMode() === "badge" || typeof LOCAL_CHANGELOG === "undefined") { updSaveSeen(); return; }
    const items = sortChangelogEntriesDesc(LOCAL_CHANGELOG).filter(e => compareVersions(e.version, last) > 0 && compareVersions(e.version, APP_VERSION) <= 0);
    if (!items.length) { updSaveSeen(); return; }
    if (updAnyModalOpen()) {
        // ほかのポップアップが出ている間は、待つ。それでも出ていたら、次の起動で見せる
        if (!retried) setTimeout(() => updCheckWhatsNew(true), 5000);
        return;
    }
    let overlay = $id("whatsNewModalOverlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "whatsNewModalOverlay";
        overlay.className = "modal-overlay";
        overlay.style.display = "none";
        overlay.innerHTML = `<div class="modal-content" style="max-width: 480px; width: 95%;">
            <h4 id="whatsNewTitle" class="update-title"></h4>
            <p id="whatsNewLead" class="upd-lead"></p>
            <div id="whatsNewBody" class="upd-notes-scroll"></div>
            <div class="modal-btn-row">
                <button type="button" class="btn-secondary" id="whatsNewHistoryBtn">更新履歴を見る</button>
                <button type="button" class="btn-save" id="whatsNewCloseBtn">閉じる</button>
            </div>
        </div>`;
        document.body.appendChild(overlay);
        $id("whatsNewCloseBtn").addEventListener("click", closeWhatsNewModal);
        $id("whatsNewHistoryBtn").addEventListener("click", () => { closeWhatsNewModal(); openUpdateInfoModal(true); });
        overlay.addEventListener("click", e => { if (e.target === overlay) closeWhatsNewModal(); });
    }
    $id("whatsNewTitle").textContent = `Ver.${APP_VERSION} に、アップデートされました`;
    $id("whatsNewLead").textContent = items.length > 1 ? `前に使った Ver.${last} から、${items.length}回分の変わったところです。` : `前に使った Ver.${last} からの、変わったところです。`;
    const SHOW = 6;
    const multi = items.length > 1;
    let html = items.slice(0, SHOW).map(e => {
        const list = updBulletsHtml(e) || "";
        return multi
            ? `<div class="upd-ver"><div class="upd-ver-head"><span class="upd-ver-no">Ver.${updEsc(e.version)}</span><span class="upd-ver-date">${updEsc(formatChangelogDate(e.date))}</span></div>${list}</div>`
            : list;
    }).join("");
    if (items.length > SHOW) html += `<p class="upd-more">ほか ${items.length - SHOW}回分は「更新履歴を見る」で見られます。</p>`;
    $id("whatsNewBody").innerHTML = html;
    overlay.style.display = "flex";
    updSaveSeen();
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "updateinfo",
    name: "更新情報",
    version: "1.2",
    description: "新しいバージョンの知らせを確かめます。自前のサーバーか GAS から取り、通信できない時はアプリの中の履歴を出します。更新した後に変わったところも見せます。",
    stubs: ["checkForAppUpdates"],
    backupKeys: [UPD_MODE_KEY],
    mount() {
        const sel = $id("updateNoticeMode");
        if (sel) sel.value = updNoticeMode();
        setTimeout(updCheckWhatsNew, 1800);
        document.addEventListener("click", e => {
            const t = e.target.closest && e.target.closest(".upd-try");
            if (t) { updTry(t.dataset.q || ""); return; }
            const h = e.target.closest && e.target.closest(".upd-howto-btn");
            if (h) {
                closeNewUpdateModal(); closeWhatsNewModal();
                const o = $id("updateInfoModalOverlay");
                if (o) o.style.display = "none";
                if (typeof openBackupModal === "function") openBackupModal();
            }
        });
    }
});
