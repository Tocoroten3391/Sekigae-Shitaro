// ==========================================
// 設定の検索プラグイン：設定のさがすを、項目ごとの検索に強化します。
// ひらがな・カタカナ・半角のちがいを無視して、設定、ダイアログの中のボタン、プラグイン、使い方まで探せます。
// 結果を押すと、その場所へ移って、光らせます。「/」キーで、いつでも検索に移れます。
// このファイルを index.html から外しても、これまでの区分ごとの検索が、そのまま使えます
// ==========================================
const SS_RECENT_KEY = "cfg_search_recent_v1";
const SS_MAX_RESULTS = 60;
const SS_SUGGEST = ["音", "班", "ロック", "バックアップ", "印刷", "タイマー", "欠席", "色", "保存"];

// 検索で開けるダイアログ：ダイアログの id → 開く関数の名前（その関数が無い時は、対象にしません）
const SS_DIALOGS = {
    seatSettingsModalOverlay: "openSeatSettingsModal",
    wishModalOverlay: "openWishModal",
    presetIoOverlay: "openPresetIo",
    stepSetModalOverlay: "openStepSetModal",
    chartExportModalOverlay: "openChartExportModal",
    absentModalOverlay: "openAbsentModal",
    furiganaModalOverlay: "openFuriganaModal",
    backupModalOverlay: "openBackupModal",
    wagamamaModalOverlay: "openWagamamaModal",
    memoListModalOverlay: "openMemoListModal",
    statsModalOverlay: "openStatsModal",
    seatCheckModalOverlay: "openSeatCheck",
    historyModalOverlay: "openHistoryModal",
    updateInfoModalOverlay: "openUpdateInfoModal",
    rosterEditorModalOverlay: "openRosterEditor",
    rosterPasteModalOverlay: "openRosterPasteModal",
    promoteModalOverlay: "openPromoteModal",
    shareModalOverlay: "openShareModal",
    luckModalOverlay: "openLuckModal",
    fortuneModalOverlay: "openFortuneModal",
    ptModalOverlay: "openProgramTimer",
    nbModalOverlay: "openNomBalance",
    fairModalOverlay: "openFairness",
    diagModalOverlay: "openDiagnostics",
    stickyListOverlay: "openStickyList"
};

// 言いかえ・読み：「言葉|言いかえ…」。その言葉を含む項目に、言いかえも付けて探せるようにします
const SS_ALIAS_RAW = `音|おと おんりょう さいせい べる みゅーと サウンド
音量|おんりょう ぼりゅーむ おと
音楽|おんがく みゅーじっく べーじーえむ bgm
座席|ざせき せき いす 席
席替え|せきがえ せきかえ しゃっふる 席がえ
席|せき ざせき
指名|しめい あてる 当てる るーれっと 発表
班|はん ぐるーぷ グループ
グループ|ぐるーぷ はん 班
名簿|めいぼ なまえ 名前 一覧 らいん
生徒|せいと 児童 じどう
欠席|けっせき おやすみ 休み やすみ 欠席者
休み|やすみ おやすみ 欠席
番号|ばんごう ばんごう 出席番号
出席番号|しゅっせきばんごう ばんごう 番号
保存|ほぞん せーぶ しまう セーブ
復元|ふくげん もどす りすとあ 元に戻す
削除|さくじょ けす でりーと 消す
初期化|しょきか りせっと 元に戻す リセット
リセット|りせっと しょきか 初期化 もどす
印刷|いんさつ ぷりんと pdf プリント
共有|きょうゆう しぇあ 送る
色|いろ からー カラー
背景|はいけい ばっく
テーマ|てーま だーく ダーク 着せ替え きせかえ
画面|がめん ひょうじ
表示|ひょうじ みせる
拡大|かくだい ずーむ おおきく 大きく
文字|もじ ふぉんと フォント 大きさ
ロック|ろっく ぱすわーど パスワード かぎ 鍵 管理者
パスワード|ぱすわーど あんしょう 暗証番号 ロック
管理者|かんりしゃ あどみん ロック
バックアップ|ばっくあっぷ ほぞん ふくげん 保存 復元
スプレッドシート|すぷれっどしーと ぐーぐる google gas クラウド 同期
クラウド|くらうど どらいぶ 同期 ねっと
タイマー|た今ー 時計 とけい すとっぷうぉっち かうんとだうん
時間|じかん 時刻 じこく
チャイム|ちゃいむ かね 鐘 予鈴 よれい
アラーム|あらーむ おと 音 ベル
八百長|やおちょう しこみ 仕込み ひみつ 隠し
仕込み|しこみ やおちょう 八百長 ひみつ
わがまま|わがまま 指定席 してい 指定
固定|こてい ふくせき 指定席
空席|くうせき あき 空き
列|れつ たて 縦
行|ぎょう よこ 横
班長|はんちょう りーだー
ふりがな|ふりがな よみ よみがな るび 読み
履歴|りれき ろぐ きろく 記録
記録|きろく 履歴 ろぐ
統計|とうけい ぐらふ グラフ 集計
軽量|けいりょう かるく らいと 軽く 重い
動作|どうさ うごき
演出|えんしゅつ あにめ えふぇくと アニメーション
アニメーション|あにめーしょん えんしゅつ 動き
プラグイン|ぷらぐいん 機能 きのう おんおふ
機能|きのう ぷらぐいん
診断|しんだん ちぇっく ちょうし 調子
公平|こうへい ふこうへい ばらんす バランス
偏り|かたより ばらんす 公平
発言|はつげん
進級|しんきゅう ねんど 年度 学年
年度|ねんど がくねん 進級
学年|がくねん ねんど
クラス|くらす がっきゅう 学級 組
更新|こうしん あっぷでーと バージョン ばーじょん
使い方|つかいかた へるぷ ヘルプ 説明 せつめい
説明|せつめい へるぷ 使い方
検索|けんさく さがす 探す
csv|しーえすぶい えくせる エクセル 書き出し
書き出し|かきだし えくすぽーと 出力 ダウンロード
読み込み|よみこみ いんぽーと 取り込み 入力
貼り付け|はりつけ ぺーすと
ファイル|ふぁいる
画像|がぞう いめーじ png 写真
ルーレット|るーれっと 抽選 ちゅうせん くじ
くじ|くじ ふうとう 封筒 抽選
占い|うらない うらなう
運|うん らっく
貯金|ちょきん ばんく
付箋|ふせん めも メモ
メモ|めも ふせん 付箋
電卓|でんたく けいさん 計算
黒板|こくばん ぶらっくぼーど でんし 電子
全画面|ぜんがめん ふるすくりーん
スタート|すたーと かいし 開始
一時停止|いちじていし ぽーず
確認|かくにん ちぇっく チェック
比較|ひかく くらべる 前回
予告|よこく ぷれびゅー プレビュー
プレビュー|ぷれびゅー よこく 確定前
旅|たび
着せ替え|きせかえ てーま テーマ
季節|きせつ はる なつ あき ふゆ
オフライン|おふらいん ねっと なし
キーパッド|きーぱっど てんきー テンキー 数字
テンキー|てんきー きーぱっど 数字`;

let ssAliasTable = null;
let ssIndex = null;
let ssResults = [];
let ssTerms = [];
let ssActive = -1;
let ssOpen = false;
let ssFlashTimer = null;

// ---- 文字をそろえる（半角・全角、大文字・小文字、カタカナ・ひらがな、空白や記号を無視） ----
function ssFold(x) {
    if (/[\s、。・「」『』()\[\]:!?,.]/.test(x)) return "";
    const k = x.charCodeAt(0);
    return (k >= 0x30A1 && k <= 0x30F6) ? String.fromCharCode(k - 0x60) : x;
}
function ssNorm(t) {
    let s = "";
    for (const x of String(t || "").normalize("NFKC").toLowerCase()) s += ssFold(x);
    return s;
}
// そろえた文字が、元の文字の何文字目だったかも、いっしょに返します（光らせる位置のため）
function ssNormMap(t) {
    const str = String(t || "");
    let s = "";
    const idx = [];
    for (let i = 0; i < str.length; i++) {
        for (const x of str[i].normalize("NFKC").toLowerCase()) {
            const f = ssFold(x);
            for (let j = 0; j < f.length; j++) { s += f[j]; idx.push(i); }
        }
    }
    return { s, idx };
}
function ssEsc(t) { return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }
function ssClean(t) { return String(t || "").replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/\s+/g, " ").trim(); }
function ssTextOf(el) {
    const c = el.cloneNode(true);
    c.querySelectorAll(".info-tip, .fav-star, .slider, script, style").forEach(x => x.remove());
    return ssClean(c.textContent);
}
function ssAliasFor(normText) {
    if (!ssAliasTable) {
        ssAliasTable = SS_ALIAS_RAW.split("\n").map(line => { const i = line.indexOf("|"); return i < 0 ? null : [ssNorm(line.slice(0, i)), ssNorm(line.slice(i + 1))]; }).filter(Boolean);
    }
    let out = "";
    ssAliasTable.forEach(([k, a]) => { if (k && normText.includes(k)) out += a; });
    return out;
}

// ---- 索引づくり ----
function ssHidden(el, root) {
    for (let p = el; p && p !== root; p = p.parentElement) {
        if (p.hidden || (p.style && p.style.display === "none")) return true;
    }
    return false;
}
function ssPluginWords(el) {
    const host = el.closest("[data-plugin]");
    const def = host && SekigaeApp.plugins.find(p => p.id === host.dataset.plugin);
    return def ? (def.name || "") + " " + (def.searchWords || "") : "";
}
function ssMakeItem(base) {
    const it = Object.assign({ d: "", kw: "", bonus: 0 }, base);
    it.finish = function () {
        this.n = ssNorm(this.label);
        this.p = ssNorm(this.path);
        this.dn = ssNorm(this.d);
        this.k = ssNorm(this.kw) + ssAliasFor(this.n + this.p);
        return this;
    };
    return it;
}
// 設定の区分、または、ダイアログの中から、項目を集めます
function ssExtract(root, ctx, add) {
    const sel = "h3, h4, summary, .switch-container, button, label.input-label, label[for], p, .config-note, [data-tip]";
    let last = null, pending = "";
    root.querySelectorAll(sel).forEach(el => {
        if (el.closest("[data-plugin-off]")) return;
        if (el.closest(".fav-star, #favSection, .config-search, #configWideNav, .usage-section, #adminSection, #cfgSearchPanel")) return;
        if (ssHidden(el, root)) return;
        const tip = el.dataset && el.dataset.tip ? el.dataset.tip : "";
        const isPart = el.matches("h3, h4, summary, .switch-container, button, label, p, .config-note");
        if (el.classList.contains("info-tip") || el.closest(".info-tip") || !isPart) { if (last && tip) last.d += " " + tip; return; }
        if (el.matches("button") && (el.classList.contains("fav-star") || el.classList.contains("config-section-toggle"))) return;
        if (el.matches("p, .config-note")) {
            const text = ssClean(el.textContent);
            if (!text) return;
            const nx = el.nextElementSibling;
            if (nx && nx.matches(".switch-container, button, label, .input-group-row, .layout-grid-fields, select")) pending += " " + text;
            else if (last) last.d += " " + text;
            return;
        }
        if (el.matches("h3") && el.parentElement === root) return;
        if (el.matches("h4") && el === root.querySelector("h4")) return;
        let label = "", type = "control";
        if (el.matches(".switch-container")) { const l = el.querySelector(".switch-label"); label = l ? ssTextOf(l) : ""; }
        else if (el.matches("h3, h4, summary")) { label = ssTextOf(el).replace(/^[∧∨]\s*/, "").replace(/\s*[∧∨]$/, ""); type = "heading"; }
        else label = ssTextOf(el);
        if (!label || label.length > 60 || /^(閉じる|キャンセル|やめる|戻る|✕|×|☆|★|i|OK)$/.test(label)) return;
        const it = ssMakeItem({
            label, type, kind: ctx.kind, where: ctx.where, el, sec: ctx.sec || null, overlayId: ctx.overlayId || "",
            path: ctx.path, kw: (ctx.kw || "") + " " + ssPluginWords(el), d: ((pending ? pending + " " : "") + tip).trim(), bonus: type === "heading" ? 4 : 0
        });
        pending = "";
        if (add(it)) last = it; else last = null;
    });
}
function ssBuildIndex() {
    const items = [];
    const seen = new Set();
    const counts = {};
    const add = it => {
        it.key = (it.overlayId || (it.sec && it.sec.dataset.sec) || it.kind) + "|" + it.type + "|" + ssNorm(it.label);
        if (seen.has(it.key)) return false;
        const bucket = it.overlayId || (it.sec && it.sec.dataset.sec) || it.kind;
        counts[bucket] = (counts[bucket] || 0) + 1;
        if (counts[bucket] > 80) return false;
        seen.add(it.key);
        items.push(it);
        return true;
    };
    // 1. 設定のパネル
    document.querySelectorAll("#configContainer > .config-section[data-sec]").forEach(sec => {
        if (sec.hasAttribute("data-plugin-off") || sec.id === "adminSection" || sec.classList.contains("usage-section")) return;
        const title = ssClean(configSectionTitle(sec));
        const group = sec.dataset.group || "";
        const ctx = { kind: "setting", where: "panel", sec, path: (group ? group + " › " : "") + title, kw: sec.dataset.kw || "" };
        add(ssMakeItem({ label: title, type: "section", kind: "setting", where: "panel", el: sec.querySelector(":scope > h3") || sec, sec, overlayId: "", path: group, kw: sec.dataset.kw || "", bonus: 8 }).finish());
        const before = items.length;
        ssExtract(sec, ctx, it => add(it.finish()));
        void before;
    });
    // 2. ダイアログ
    Object.keys(SS_DIALOGS).forEach(id => {
        const ov = $id(id);
        if (!ov || ov.closest("[data-plugin-off]") || typeof window[SS_DIALOGS[id]] !== "function") return;
        const mc = ov.querySelector(".modal-content") || ov;
        const h = mc.querySelector("h4");
        const title = ssClean(h ? h.textContent : id);
        const ctx = { kind: "dialog", where: "dialog", overlayId: id, path: title, kw: ssPluginWords(ov) };
        add(ssMakeItem({ label: title, type: "section", kind: "dialog", where: "dialog", el: h || mc, overlayId: id, path: "ダイアログ", kw: ssPluginWords(ov), bonus: 8 }).finish());
        ssExtract(mc, ctx, it => add(it.finish()));
    });
    // 3. プラグイン
    SekigaeApp.plugins.filter(p => !p.required).forEach(p => {
        const g = (SekigaeApp.groups || []).find(x => x.ids.includes(p.id));
        add(ssMakeItem({ label: p.name || p.id, type: "control", kind: "plugin", where: "plugin", el: null, pluginId: p.id, overlayId: "", path: "プラグインの設定 › " + (g ? g.title : "そのほか"), d: p.description || "", kw: p.searchWords || "", bonus: -20 }).finish());
    });
    // 4. 使い方
    document.querySelectorAll("#usageSection .usage-guide .usage-group").forEach(g => {
        const gt = g.querySelector(".usage-group-title");
        g.querySelectorAll(":scope > details").forEach(d => {
            const s = d.querySelector("summary");
            const label = s ? ssClean(s.textContent) : "";
            if (!label) return;
            const c = d.cloneNode(true);
            const cs = c.querySelector("summary");
            if (cs) cs.remove();
            add(ssMakeItem({ label, type: "control", kind: "guide", where: "panel", el: d, sec: document.getElementById("usageSection"), overlayId: "", path: "使い方 › " + (gt ? ssClean(gt.textContent) : ""), d: ssClean(c.textContent), bonus: -60 }).finish());
        });
    });
    return items;
}

// ---- 検索と並べ替え ----
function ssParseTerms(q) { return String(q || "").split(/[\s　]+/).map(ssNorm).filter(Boolean); }
function ssSearch(q) {
    const terms = ssParseTerms(q);
    if (!terms.length || !ssIndex) return { terms, list: [] };
    const scored = [];
    for (const it of ssIndex) {
        let sc = 0, ok = true;
        for (const t of terms) {
            let s = -1;
            if (it.n.startsWith(t)) s = 130;
            else if (it.n.includes(t)) s = 100;
            else if (it.k.includes(t)) s = 70;
            else if (it.p.includes(t)) s = 40;
            else if (it.dn.includes(t)) s = 20;
            if (s < 0) { ok = false; break; }
            sc += s;
        }
        if (!ok) continue;
        if (terms.length === 1 && it.n === terms[0]) sc += 50;
        sc += it.bonus - Math.min(it.n.length, 40) / 10;
        scored.push([sc, it]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return { terms, list: scored.map(x => x[1]) };
}

// ---- 結果の表示 ----
function ssMarkHtml(text, terms) {
    const m = ssNormMap(text);
    const ranges = [];
    terms.forEach(t => {
        let from = 0;
        for (;;) {
            const i = m.s.indexOf(t, from);
            if (i < 0) break;
            ranges.push([m.idx[i], m.idx[i + t.length - 1] + 1]);
            from = i + t.length;
        }
    });
    if (!ranges.length) return ssEsc(text);
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    ranges.forEach(r => { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push(r.slice()); });
    let out = "", pos = 0;
    merged.forEach(r => { out += ssEsc(text.slice(pos, r[0])) + "<mark>" + ssEsc(text.slice(r[0], r[1])) + "</mark>"; pos = r[1]; });
    return out + ssEsc(text.slice(pos));
}
function ssSnippet(text, terms) {
    const m = ssNormMap(text);
    let at = -1, len = 0;
    for (const t of terms) { const i = m.s.indexOf(t); if (i >= 0 && (at < 0 || i < at)) { at = i; len = t.length; } }
    if (at < 0) return "";
    const from = Math.max(0, m.idx[at] - 16), to = Math.min(text.length, m.idx[at + len - 1] + 44);
    return (from > 0 ? "…" : "") + ssMarkHtml(text.slice(from, to), terms) + (to < text.length ? "…" : "");
}
const SS_KIND_LABEL = { setting: "設定", dialog: "ダイアログ", plugin: "プラグイン", guide: "使い方" };

function ssRender() {
    const panel = $id("cfgSearchPanel"), cc = $id("configContainer"), input = $id("configSearchInput");
    if (!panel || !cc) return;
    if (!ssOpen) {
        panel.hidden = true;
        cc.classList.remove("cfg-searching");
        if (input) { input.setAttribute("aria-expanded", "false"); input.removeAttribute("aria-activedescendant"); }
        return;
    }
    panel.hidden = false;
    cc.classList.add("cfg-searching");
    if (input) input.setAttribute("aria-expanded", "true");
    const q = input ? input.value.trim() : "";
    const chips = list => list.map(w => '<button type="button" class="ss-chip btn-compact" data-q="' + ssEsc(w) + '">' + ssEsc(w) + "</button>").join("");
    if (!ssTerms.length) {
        const rec = ssLoadRecent();
        panel.innerHTML = '<div class="ss-head"><span class="ss-count">さがしたい言葉を入れてください。ひらがなでも、カタカナでも探せます。</span></div>' +
            (rec.length ? '<div class="ss-sub">最近の検索</div><div class="ss-chips">' + chips(rec) + "</div>" : "") +
            '<div class="ss-sub">よく使う言葉</div><div class="ss-chips">' + chips(SS_SUGGEST) + "</div>" +
            '<p class="ss-hint">「/」キーを押すと、いつでもここに移れます。</p>';
        return;
    }
    const head = '<div class="ss-head"><span class="ss-count">「' + ssEsc(q) + "」の結果　" + ssResults.length + '件</span><button type="button" class="ss-clear btn-compact" data-act="clear">検索を解除</button></div>';
    if (!ssResults.length) {
        panel.innerHTML = head + '<p class="ss-empty">見つかりませんでした。別の言葉で試してください。</p><div class="ss-sub">こんな言葉はどうでしょう</div><div class="ss-chips">' + chips(SS_SUGGEST) + "</div>";
        return;
    }
    const shown = ssResults.slice(0, SS_MAX_RESULTS);
    const rows = shown.map((it, i) => {
        const hitInLabel = ssTerms.every(t => it.n.includes(t));
        const snip = !hitInLabel && it.d ? ssSnippet(it.d, ssTerms) : "";
        return '<li class="ss-item' + (i === ssActive ? " is-current" : "") + '" role="option" id="ssOpt' + i + '" data-i="' + i + '" aria-selected="' + (i === ssActive) + '">' +
            '<span class="ss-kind ss-k-' + it.kind + '">' + SS_KIND_LABEL[it.kind] + "</span>" +
            '<span class="ss-main"><span class="ss-label">' + ssMarkHtml(it.label, ssTerms) + '</span><span class="ss-path">' + ssEsc(it.path) + "</span>" +
            (snip ? '<span class="ss-snip">' + snip + "</span>" : "") + "</span></li>";
    }).join("");
    panel.innerHTML = head + '<ul class="ss-list" id="cfgSearchList" role="listbox" aria-label="検索の結果">' + rows + "</ul>" +
        (ssResults.length > shown.length ? '<p class="ss-hint">他に ' + (ssResults.length - shown.length) + " 件あります。言葉をふやして、しぼってください。</p>" : "");
    if (input && ssActive >= 0) input.setAttribute("aria-activedescendant", "ssOpt" + ssActive);
}
function ssSetActive(i, scroll) {
    const panel = $id("cfgSearchPanel");
    if (!panel || !ssResults.length) return;
    const max = Math.min(ssResults.length, SS_MAX_RESULTS) - 1;
    ssActive = Math.max(0, Math.min(max, i));
    panel.querySelectorAll(".ss-item").forEach(li => { const on = Number(li.dataset.i) === ssActive; li.classList.toggle("is-current", on); li.setAttribute("aria-selected", String(on)); });
    const input = $id("configSearchInput");
    if (input) input.setAttribute("aria-activedescendant", "ssOpt" + ssActive);
    const cur = panel.querySelector(".ss-item.is-current");
    if (cur && scroll) cur.scrollIntoView({ block: "nearest" });
}

// ---- 最近の検索 ----
function ssLoadRecent() {
    try { const v = JSON.parse(lsGet(SS_RECENT_KEY, "[]")); return Array.isArray(v) ? v.filter(x => typeof x === "string").slice(0, 5) : []; } catch (e) { return []; }
}
function ssRemember() {
    const input = $id("configSearchInput");
    const q = input ? input.value.trim() : "";
    if (!q) return;
    const list = ssLoadRecent().filter(x => x !== q);
    list.unshift(q);
    try { lsSet(SS_RECENT_KEY, JSON.stringify(list.slice(0, 5))); } catch (e) {}
}

// ---- 入力の処理 ----
function ssRun() {
    const input = $id("configSearchInput");
    if (!input) return;
    if (!ssIndex) ssIndex = ssBuildIndex();
    const r = ssSearch(input.value);
    ssTerms = r.terms;
    ssResults = r.list;
    ssActive = ssResults.length ? 0 : -1;
    ssOpen = true;
    ssRender();
}
function ssReset() {
    const input = $id("configSearchInput");
    if (input) input.value = "";
    ssTerms = []; ssResults = []; ssActive = -1; ssOpen = false; ssIndex = null;
    ssRender();
}
function ssFocus() {
    const cc = $id("configContainer");
    if (cc && !cc.classList.contains("open")) toggleConfigMenu();
    if (!cc || !cc.classList.contains("open")) return;
    const input = $id("configSearchInput");
    if (!input) return;
    ssIndex = null;
    input.focus();
    input.select();
    ssRun();
}

// ---- 移動と光らせる ----
const ssWait = ms => new Promise(r => setTimeout(r, ms));
function ssFlash(el) {
    if (!el) return;
    document.querySelectorAll(".ss-flash").forEach(x => x.classList.remove("ss-flash"));
    void el.offsetWidth;
    el.classList.add("ss-flash");
    clearTimeout(ssFlashTimer);
    ssFlashTimer = setTimeout(() => el.classList.remove("ss-flash"), 2300);
}
function ssReveal(el) {
    if (!el) return;
    let d = el.parentElement;
    while (d) { if (d.tagName === "DETAILS") d.open = true; d = d.parentElement; }
    el.scrollIntoView({ block: "center" });
    ssFlash(el);
    setTimeout(() => { if (document.contains(el)) el.scrollIntoView({ block: "center" }); }, 420);
}
async function ssOpenDialog(id) {
    const ov = $id(id);
    if (!ov) return false;
    const vis = () => getComputedStyle(ov).display !== "none";
    if (vis()) return true;
    const fn = window[SS_DIALOGS[id]];
    try { if (typeof fn === "function") fn(); } catch (e) { console.error(e); }
    for (let i = 0; i < 8 && !vis(); i++) await ssWait(50);
    return vis();
}
function ssAlive(el) { return !!el && document.contains(el); }
function ssFindAgain(it) {
    const fresh = ssBuildIndex().find(x => x.key === it.key);
    return fresh ? fresh.el : null;
}
async function ssGo(it) {
    if (!it) return;
    ssRemember();
    ssOpen = false;
    ssRender();
    if (it.kind === "plugin") {
        if (typeof openPluginModal === "function") openPluginModal();
        await ssWait(200);
        if (typeof pmRevealRow === "function") { pmRevealRow(it.pluginId); return; }
        const lab = document.querySelector('#pluginList [data-plugin-label="' + it.pluginId + '"]');
        ssReveal(lab ? lab.closest(".switch-container") : null);
        return;
    }
    if (it.where === "dialog") {
        if (!(await ssOpenDialog(it.overlayId))) { showToast("ダイアログを開けませんでした。", "error"); return; }
        await ssWait(220);
        ssReveal(ssAlive(it.el) ? it.el : ssFindAgain(it));
        return;
    }
    const cc = $id("configContainer");
    if (cc && !cc.classList.contains("open")) toggleConfigMenu();
    if (!cc || !cc.classList.contains("open")) return;
    if (it.sec) {
        setConfigSectionCollapsed(it.sec, false);
        if (isConfigWide()) { const i = configWideSections().indexOf(it.sec); if (i >= 0) selectConfigWideSection(i); }
    }
    await ssWait(isConfigWide() ? 120 : 60);
    ssReveal(ssAlive(it.el) ? it.el : ssFindAgain(it));
}

const SS_CSS = `
#cfgSearchPanel { padding: 2px 0 14px; }
#cfgSearchPanel[hidden] { display: none; }
body:not(.config-wide) #configContainer.cfg-searching > .config-section, #configContainer.cfg-searching > .config-group-title, #configContainer.cfg-searching > #configWideNav { display: none !important; }
body.config-wide #configContainer.cfg-searching > .config-credit { display: none; }
body.config-wide #cfgSearchPanel { grid-column: 1; grid-row: 2; align-self: start; max-height: calc(100vh - 150px); overflow-y: auto; position: sticky; top: 64px; scrollbar-width: thin; }
.ss-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; padding: 6px 4px 8px; font-size: 12px; color: var(--text-sub); line-height: 1.5; }
.ss-count { font-weight: 700; flex: 1 1 auto; min-width: 0; }
.config-container .ss-clear, .config-container .ss-chip { width: auto !important; height: 28px; min-height: 28px; margin: 0 !important; padding: 0 12px !important; border-radius: 999px !important; font-size: 12px !important; font-weight: 600; cursor: pointer; background: var(--input-bg, #f2f2f7) !important; color: var(--text-main, #1c1c1e) !important; border: 1px solid var(--seat-border, #e2e8f0) !important; box-shadow: none !important; }
.config-container .ss-clear { flex: 0 0 auto; }
.config-container .ss-chip:hover, .config-container .ss-clear:hover { border-color: var(--accent-color, #3b82f6) !important; }
.ss-sub { margin: 10px 4px 6px; font-size: 11px; font-weight: 800; letter-spacing: 0.06em; color: var(--text-sub); }
.ss-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 4px; }
.ss-hint, .ss-empty { margin: 10px 4px 0; font-size: 12px; color: var(--text-sub); line-height: 1.6; }
.ss-list { margin: 0; padding: 0; list-style: none; }
.ss-item { display: flex; align-items: flex-start; gap: 8px; padding: 9px 8px; border-radius: 10px; cursor: pointer; }
.ss-item:hover, .ss-item.is-current { background: rgba(59, 130, 246, 0.13); }
.ss-kind { flex: 0 0 auto; margin-top: 2px; padding: 2px 7px; border-radius: 999px; font-size: 10px; font-weight: 800; white-space: nowrap; }
.ss-k-setting { background: rgba(59, 130, 246, 0.16); color: #2563eb; }
.ss-k-dialog { background: rgba(217, 119, 6, 0.16); color: #b45309; }
.ss-k-plugin { background: rgba(124, 58, 237, 0.16); color: #7c3aed; }
.ss-k-guide { background: rgba(16, 185, 129, 0.16); color: #047857; }
.ss-main { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.ss-label { font-size: 14px; font-weight: 600; color: var(--text-main); line-height: 1.4; word-break: break-all; }
.ss-path { font-size: 11px; color: var(--text-sub); }
.ss-snip { font-size: 12px; color: var(--text-sub); line-height: 1.5; word-break: break-all; }
.ss-item mark { background: rgba(245, 158, 11, 0.38); color: inherit; border-radius: 3px; padding: 0 1px; }
.ss-flash { outline: 3px solid transparent; outline-offset: 3px; border-radius: 8px; animation: ssFlash 2.2s ease-in-out 1; }
@keyframes ssFlash { 0%, 100% { outline-color: transparent; box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); } 12%, 70% { outline-color: #f59e0b; box-shadow: 0 0 22px 6px rgba(245, 158, 11, 0.5); } }
body.lite-mode .ss-flash { animation: none; outline-color: #f59e0b; box-shadow: none; }
`;

SekigaeApp.registerPlugin({
    id: "settings-search",
    name: "設定の検索",
    version: "1.1",
    description: "設定のさがすを、項目ごとの検索に強化します。ひらがな・カタカナのちがいを無視して、設定、ダイアログの中のボタン、プラグイン、使い方まで探せます。結果を押すと、その場所に移って光らせます。「/」キーで、いつでも検索に移れます。",
    searchWords: "検索 さがす 探す けんさく ひらがな カタカナ 表記ゆれ ショートカット キーボード 結果 ジャンプ",
    mount(app) {
        const st = document.createElement("style");
        st.id = "settingsSearchStyle";
        st.textContent = SS_CSS;
        document.head.appendChild(st);

        // 設定の検索：結果の一覧を入れる場所と、入力の処理
        const bar = document.querySelector("#configContainer > .config-search");
        const input = $id("configSearchInput");
        if (bar && input) {
            bar.insertAdjacentHTML("afterend", '<div id="cfgSearchPanel" hidden></div>');
            input.setAttribute("role", "combobox");
            input.setAttribute("aria-autocomplete", "list");
            input.setAttribute("aria-expanded", "false");
            input.setAttribute("aria-controls", "cfgSearchPanel");
            window.onConfigSearch = function () { ssRun(); };
            window.clearConfigSearch = function () { ssReset(); };
            input.addEventListener("focus", () => { ssIndex = null; ssRun(); });
            input.addEventListener("click", () => { if (!ssOpen) { ssIndex = null; ssRun(); } });
            input.addEventListener("keydown", e => {
                if (e.isComposing || e.keyCode === 229) return;
                if (e.key === "ArrowDown") { e.preventDefault(); if (!ssOpen) ssRun(); else ssSetActive(ssActive + 1, true); }
                else if (e.key === "ArrowUp") { e.preventDefault(); ssSetActive(ssActive - 1, true); }
                else if (e.key === "Enter") { if (ssResults.length) { e.preventDefault(); ssGo(ssResults[Math.max(0, ssActive)]); } }
                else if (e.key === "Escape") {
                    e.preventDefault();
                    if (input.value) { input.value = ""; ssRun(); } else { ssOpen = false; ssRender(); input.blur(); }
                }
            });
            const panel = $id("cfgSearchPanel");
            panel.addEventListener("mousedown", e => { if (e.target.closest(".ss-item, .ss-chip, .ss-clear")) e.preventDefault(); });
            panel.addEventListener("click", e => {
                const li = e.target.closest(".ss-item");
                if (li) { ssGo(ssResults[Number(li.dataset.i)]); return; }
                const chip = e.target.closest(".ss-chip");
                if (chip) { input.value = chip.dataset.q; input.focus(); ssRun(); return; }
                if (e.target.closest(".ss-clear")) { ssReset(); input.focus(); ssRun(); }
            });
            panel.addEventListener("mousemove", e => { const li = e.target.closest(".ss-item"); if (li && Number(li.dataset.i) !== ssActive) ssSetActive(Number(li.dataset.i), false); });
            document.addEventListener("pointerdown", e => {
                if (ssOpen && !ssTerms.length && !e.target.closest("#cfgSearchPanel, .config-search")) { ssOpen = false; ssRender(); }
            });
            // 設定を閉じたら、検索も解除します
            const origToggle = window.toggleConfigMenu;
            window.toggleConfigMenu = function () {
                const r = origToggle.apply(this, arguments);
                const cc = $id("configContainer");
                if (cc && !cc.classList.contains("open")) ssReset();
                return r;
            };
            // 「/」キーで、検索に移ります
            document.addEventListener("keydown", e => {
                if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
                const t = e.target;
                if (t && (t.closest("input, textarea, select, [contenteditable='true']"))) return;
                if (document.body.classList.contains("nomination-active") || document.body.classList.contains("blackboard-active")) return;
                if (Array.from(document.querySelectorAll(".modal-overlay")).some(o => getComputedStyle(o).display !== "none")) return;
                e.preventDefault();
                ssFocus();
            });
        }

        app.insertInto("guide-tools", '<li><strong>設定の検索</strong>：設定の一番上の「設定をさがす」に言葉を入れると、設定、ダイアログの中のボタン、プラグイン、使い方から、項目ごとに探せます。ひらがなでも、カタカナでも探せます。結果を押すと、その場所に移って光ります。「/」キーを押すと、いつでも検索に移れます。上下の矢印で選び、Enterで移ります。</li>');
    }
});
