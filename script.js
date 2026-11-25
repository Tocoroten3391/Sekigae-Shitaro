const $id = id => document.getElementById(id);

// アプリのバージョン。ここを更新すれば設定メニューの表示にも自動で反映される。
// SemVer（メジャー.マイナー.パッチ）方式：メジャー=大きな仕様変更、マイナー=新機能、パッチ=不具合修正。
const APP_VERSION = "4.63.0";
const LATEST_VERSION_URL = "https://github.com/Tocoroten3391/Sekigae-Shitaro_Apps/releases/latest";
// 自前で更新情報を配信するときのURL。空の間は、下のGASを使います。
// GitHub なら、changelog.json のURL（末尾が .json）を書きます。server/updates.php のURLでも使えます。
const CHANGELOG_JSON_URL = "https://tocoroten3391.github.io/Sekigae-Shitaro_Updates-info/changelog.json";
// 更新情報を配信するGAS Web AppのURL（開発者自身のスプレッドシート）。
// 未設定（空文字）の間は更新チェックを静かにスキップする。
const CHANGELOG_GAS_URL = "https://script.google.com/a/macros/tosu.ed.jp/s/AKfycbyFyqeVpOsaLoYqfmnAQsNrPQKIHnyjupSdLUyAKZUFnlGPLizaIFgz0ImtWUKq4PcC/exec";

// ==========================================
// プラグインの窓口
// 機能を、別ファイル（plugins フォルダ）に分けて、index.html から読み込む形にするための仕組みです。
// プラグインは、SekigaeApp.registerPlugin({ id, name, backupKeys, searchWords, mount, ready }) で、自分を登録します。
//   mount(app)：画面の部品（ボタン・設定・説明）を、本体の決まった場所に入れる。設定画面を整える前に呼ばれます
//   ready(app)：本体の準備ができた後に呼ばれます
//   backupKeys：バックアップに入れる、保存データの名前
//   searchWords：設定の「さがす」で見つかるようにする言葉
//   stubs：本体から呼ばれる関数の名前（オフの時は、本体のからっぽの関数に戻します）
// index.html の部品に data-plugin="id" を付けると、そのプラグインが入っていない・オフの時に、隠れます
// 場所（スロット）は、index.html の data-plugin-slot で決まっています：
//   settings-system（設定 7 の中）／guide-tools（使い方の道具の説明）／guide-faq（使い方の困った時）／guide-stats（使い方の記録・統計）
//   記録・統計の画面には、statsTabs: [{ id, label, paneHtml, render(data), hideReset, hideCsv }] でタブを足せます
// プラグインのファイルを index.html から外せば、そのプラグインの機能は、まとめて消えます。
// ==========================================
// plugins/README.md の表（ファイル名・必須か・内容）の写しです。README.md を直接読めない時（file:// で開いた時など）に使います。
// README.md の表を直したら、ここも同じに直します（開発用の道具 tools/sync_plugin_catalog.js --write で、自動で直せます。道具だけで点検もできます）
const PLUGIN_CATALOG_BUILTIN = [
    ["calc.js", false, "電卓、関数電卓、連立方程式、表とグラフ、電話のプッシュ音"],
    ["music.js", false, "授業中の音楽を流します。自分のパソコンの音楽ファイルを追加して、再生・一時停止・前へ・次へ・シャッフル・くり返しができます。曲名・歌手・作曲者・表紙を、ファイルから読み取って表示し、足りない情報は、ネットで自動検索もできます。アルバムごと・歌手ごとに並べたり、アルバム単位でまとめて調べたりもできます。イコライザーと、DJ機能（曲の重ね・速さ・フィルター・エコー・ループ・効果音）も使えます。席替えの演出に合わせて曲を流したり、名前が止まった人を指名する「ストップ指名」、場面ごとの曲の組み合わせ、曲ごとの音量そろえ、バックアップの書き出し・読み込みもできます。外から取り込んだ効果音を、ぽちぽち押して鳴らす効果音パッドもあります。曲は、このパソコンのブラウザに残ります。"],
    ["term.js", false, "記録・統計の「まとめ」タブ（学期のまとめ）"],
    ["announce.js", false, "席替え発表モード"],
    ["print.js", false, "座席表の印刷・画像保存"],
    ["share.js", false, "座席表の共有（テキストでコピー、画像、スマホで見やすいHTML、QRコード）。画像は、print.js の機能を使います"],
    ["seatnote.js", false, "座席の付箋メモ。生徒ごとにメモを付けられます。席替えをしても、メモは生徒について行きます。指名中は、メモを隠します"],
    ["luckbank.js", false, "運の貯金。前・中・後ろの席に座った回数を、生徒ごとに覚えて、後ろの席が続いた生徒を、次の席替えで後ろにしにくくします。席替えの点数を、luckActive と luckPenalty で受け取ります"],
    ["fortune.js", false, "席替え占い。席替えのあとに、生徒ごとの今日の運勢（星・ラッキーアイテム・ラッキーカラー・ひとこと）を出します"],
    ["roomlayout.js", false, "教室の配置。黒板・電子黒板・教卓・ドア・窓・通り道などを、座席表のまわりに置いて、ドラッグで動かせます。クラスごとに保存します"],
    ["envelope.js", false, "封筒くじ。席替えの結果を、封筒を選んで開く形で、1人ずつ発表します。どの封筒を選んでも、呼ばれた人の席が出ます"],
    ["seatjourney.js", false, "座席の旅。ひとりの生徒が、これまで座ってきた席を、座席表の上に線でつないで見せます。席替え履歴の記録を使います"],
    ["seatskin.js", false, "座席表の着せ替え。席を、映画館・電車・回転寿司の見た目に変えます。印刷と共有の画像には、ふくまれません"],
    ["preview.js", false, "席替えの確定前プレビュー"],
    ["absent.js", false, "今日の欠席者をまとめて選ぶ"],
    ["reasons.js", false, "固定理由メモの一覧、わがまま指定の一覧"],
    ["roster.js", false, "名簿を作る・直す、名簿を貼り付ける、列を指定して取り込む"],
    ["softkeypad.js", false, "画面のテンキー"],
    ["seatcheck.js", false, "席替え結果のチェック"],
    ["compare.js", false, "前回との比較"],
    ["history.js", false, "席替え履歴（記録・統計のタブ）"],
    ["furigana.js", false, "ふりがな。名前の上に、ふりがなを出します。大きさを選べて、「ほかの操作」から表示を切り替えられます。"],
    ["yaocho.js", false, "八百長モード（席を指定する隠し機能）"],
    ["roulette.js", false, "巨大ルーレット"],
    ["updateinfo.js", false, "更新情報。新しいバージョンの知らせを、自前のサーバー（server/updates.php）か GAS から取ります。通信できないときは、アプリの中の履歴（changelog.js）を出します"],
    ["animextra.js", false, "演出のお気に入り、マイ演出、演出とテーマの一覧"],
    ["cloud.js", false, "自動同期、履歴から復元、特別保存"],
    ["timer.js", false, "タイマー、ストップウォッチ、ステップタイマー、アラーム。タイマーの画面から「時計だけ表示」で、日付と時刻だけを大きく出せます"],
    ["program-timer.js", false, "プログラムタイマー。曜日ごとの時間割を登録しておくと、決めた時刻に、自動でチャイムが鳴ります。予鈴、始まりと終わりのチャイム、いまの授業の残り時間の表示、授業の始まりでタイマーを自動で始める機能があります"],
    ["plugin-presets.js", false, "構成プリセット。使う機能の組み合わせを、「かんたん」「授業用」「年度はじめ」「電子黒板」「指名・発表」「フル」などに、ワンタッチで切りかえます。いまの構成に名前をつけて、保存もできます。保存した構成は、ファイルに書き出して、ほかの先生に配れます。もらったファイルは、読み込めます"],
    ["nomination-balance.js", false, "発言・指名の偏り防止。指名と発言の回数を数えて、まだ当たっていない人を、先に指名できます。座席を押して発言を数える「発言モード」、座席表の回数表示、記録・統計の「偏り」タブがあります"],
    ["nomination-queue.js", false, "指名の順番リスト。指名する人を、あらかじめ順番に決めておけます。「次を指名する！」を押すたびに、上の人から当たります。"],
    ["class-bulk.js", false, "クラスのまとめ操作。全クラスを1つのファイルに書き出す・読み込む、まとめて進級させる、ができます。"],
    ["rule-sets.js", false, "席替えの条件セット。前の席を避ける・離す／近くに置く・優先順位などに名前をつけて保存し、ワンタップで切り替えられます。"],
    ["class-settings.js", false, "クラスごとの設定。席替えの条件・演出・テーマ・指名のしかたを、クラスごとに持てます。"],
    ["class-history.js", false, "クラスの保存履歴。クラスを保存するたびに、前の状態を自動で残して、あとから戻せます。"],
    ["seat-fairness.js", false, "席の公平性レポート。前列・後列・窓側・廊下側・角・教卓の前に、何回座ったかを、生徒ごとに数えて、表のコピーと印刷ができます。偏りが続いた人は、次の席替えで調整できます。席替えの点数を、fairActive と fairPenalty で受け取ります"],
    ["diagnostics.js", false, "動作の診断。起動にかかった時間、計算と描画の速さ、メモリの目安を測って、動きが重い時の対処を勧めます。軽量モードや全体アニメーションのオフを、画面のボタンで試せます"],
    ["settings-search.js", false, "設定の検索。設定のさがすを、項目ごとの検索に強化します。ひらがな・カタカナのちがいを無視して、設定、ダイアログの中のボタン、プラグイン、使い方まで探せます。結果を押すと、その場所に移って光らせます。「/」キーで、いつでも検索に移れます。"],
    ["plugin-menu.js", false, "プラグインメニュー強化。「プラグインの設定」に、名前や説明で絞る検索（一致した文字に色が付いて、その場所に移って光ります）、グループの折りたたみ、画面の下に固定する「変更が N 件あります」と「今すぐ再読み込み」、起動の準備にかかった時間から出す「軽い・ふつう・重い」の目安、広い画面での目次と2列の一覧、名前を押して設定の中の場所へ移る動き、60日使っていない機能の印とまとめてオフを足します。使った回数は、この端末の中だけで数えます"],
    ["settings-extras.js", false, "設定の仕上げ。設定を開いた時に、前回見ていた位置まで戻ります。表示、テーマ、タイマー、班の見た目などの区分の下に「この区分を初期値に戻す」を足します（名簿や座席表は、そのままです）"],
    ["menu-groups.js", false, "演出まとめ。「ほかの操作」の中の、封筒くじ・座席の旅・席替え占いを、「演出」の枠にまとめて、メニューを短くします"],
    ["display-scale.js", false, "画面の大きさ。画面全体の文字やボタンの大きさを、設定の1か所で、100%から200%までそろえて変えられます。「画面に合わせる」を選ぶと、画面の広さから自動で選びます。大型モニターや電子黒板向けです"],
    ["second-screen.js", false, "拡張画面。電子黒板などの拡張画面に、座席表を映します。巨大タイマーと、指名の名前も映せます。席替えや指名は、手元のパソコンで、いつもどおり操作できます。付箋・希望のしるし・発言の回数は映りません。拡張画面がつながると、画面の上にボタンが出ます。席替えの結果を、確認してから映すこともできます"],
    ["seat-export.js", false, "座席表のかんたん保存。「ほかの操作」から、ワンタッチで、PNGの画像やPDFに保存します。「印刷・画像保存」の前回の設定を使い、PDFは、外部のライブラリなしで作ります"],
    ["schedule.js", false, "席替えの予約。次の席替え日と、くりかえし（毎週・2週間ごと・毎月）を決めておくと、その日と前の日に、画面の上で知らせます（起動した時と、開いたままの時）。席替えをすると、次の日付に進みます"],
    ["seat-wishes.js", false, "座席の希望・配慮メモ。生徒ごとに、前の席・後ろの席・窓側・廊下側の希望と避けたい場所、近くがいい人、配慮メモを書けます。席替えで、できるだけ守り、守れているかは「結果のチェック」で確かめられます。席に、希望のしるしを出すこともできます"],
    ["tour.js", false, "案内ツアー。はじめて使う人に、席替えから、結果の確認、保存まで、画面の上で順に案内します。はじめて開いた時と、「かんたん」に切りかえた時に、たずねます。設定の「しくみ」から、もう一度見られます"],
    ["ui-styles.js", false, "画面スタイル。画面全体の見た目を、設定の「画面スタイル」で、「シンプル」「黒板」から選べます。幅900px以上の画面では、UI改良案と同じ並びにします。Aは左のツールバー、上の帯の時計とクラス、操作バー、「黒板」つきの座席カード、下の帯、Bは黒板の上の帯とチョーク受け、机の座席です。指名中は、Aは右に名前のパネルと指名済みの一覧、Bは大きな黒板に名前を出します。ボタンの絵文字は、案と同じ線のアイコンか、文字だけに置き換えます。設定は全画面で開き、左の分類を選ぶと、右にカードが2列で並びます。上には「よく使う」を置きます。シンプルの色は、選んだテーマに合わせて変わります（黒板は、この案の色のままです）。上のクラス名を押すと、クラスを切り替えられます。タイマー・電卓・音楽プレーヤーも、選んだ画面スタイルの色と形にそろえます。設定のクレジットは、設定を開いている間だけ表示します。シンプルでは、タイマーの残り時間を、左の「タイマー」ボタンを囲む円で見せ、タイマーの画面は、左のバーの横に出る横長のリボンになります。「ほかの操作」などのメニュー、中央に出る入力の画面、タイマーの巨大表示も、シンプルと黒板の色づかいにそろえます。黒板でも、タイマーの残り時間がボタンを囲む枠で見え、タイマーの画面がチョーク受けの下に横長で開きます。音楽プレーヤーも、タイマーと同じように、横長のリボンで開き、流れている間は「音楽」ボタンを囲む枠で曲の進みが見えます。通知も新しいデザインになります。幅900px未満では、左のバーが下の操作バーに変わります。設定を開いている間は、指名の画面を引っ込めて、設定に被らないようにします。案内ツアー、サンプルで試し中の帯、全画面表示の「通常モードに戻る」ボタン、入力の画面に残っていた古い色、ルーレット画面のボタンの形、付箋モードの帯、固定した席、数字キーパッド、全画面表示の座席も、新しいデザインにそろえます。ふりがなは、名前の大きさに合わせて大きく、濃く表示します。拡張画面の暗い表示のふりがな、ロック中のボタン、教室の配置の編集画面、キーボードで選んだ場所の枠も、新しいデザインにそろえます。タッチ操作の画面では、小さなボタンを押しやすい大きさにし、幅480px以下で横にはみ出ていた余白も直します。プラグイン設定や、時間割・公平性レポート・座席の旅などのボタンや目印の色は、ここで決めた色の変数を読んで変わります。画面の見出しの色も、どの画面でも同じ色にそろえます。席替えや指名のしくみは変わりません。文字だけの指名は、これまでの見た目のままです。見出しの絵文字（座席の旅、封筒くじ、着せ替え、付箋メモなど）と、席の理由チップ、トースト通知の印（成功、エラー、注意、お知らせ）も、線のアイコンにします。バックアップのお知らせ、音楽の再生ボタンと音量、付箋モードの帯、席替えの予約、教室の配置、進級、共有、運の貯金の取り消し、座席の旅、指名のやり直し、部品を消すボタンも、線のアイコンにします。"],
    ["ui-parts.js", true, "「i」の補足説明、「★ よく使う設定」の星、ポップアップメニュー"],
    ["settings-menu.js", true, "設定メニューの開け閉め、さがす、拡大表示、Enterキー"],
    ["appearance.js", true, "テーマ、季節の飾り、画面の大きさ、タイトル、見やすさ"],
    ["seat-style.js", true, "座席表の文字の大きさ、番号だけの表示、班の印"],
    ["sound.js", true, "音を鳴らすしくみ"],
    ["lock.js", true, "ロック"],
    ["backup.js", true, "バックアップ、自動バックアップ、復元、お知らせ"],
    ["work-state.js", true, "作業の自動保存と、閉じてしまった時の復元"],
    ["class-records.js", true, "クラスごとの記録、進級"],
    ["class-presets.js", true, "名簿の保存、クラス一覧、去年度のクラス"],
    ["roster-io.js", true, "名簿の読み込み、書き出し、最初の画面、出席番号順のリセット"],
    ["spreadsheet.js", true, "スプレッドシート連携"],
    ["seat-layout.js", true, "列の数、画面に合わせた大きさ調整"],
    ["groups.js", true, "班の数、色、名前"],
    ["seat-rules.js", true, "名簿と席の指定の読み取り"],
    ["seat-render.js", true, "座席表を画面に描く"],
    ["seat-modal.js", true, "席をタップした時の設定画面、優先エリア"],
    ["seat-edit.js", true, "席の入れ替え（ドラッグ）、取り消しとやり直し"],
    ["shuffle-engine.js", true, "離す・近くに置く、前と同じ席の回避、抽選、八百長モードの確定"],
    ["shuffle-anim.js", true, "席替えの演出と効果音"],
    ["nomination.js", true, "指名の抽選、指名モード、取り消し、除外、進み具合"],
    ["stats.js", true, "記録・統計"]
];

const SekigaeApp = {
    version: APP_VERSION,
    plugins: [],
    _lastReg: (typeof performance !== "undefined" && performance.now) ? performance.now() : 0,
    registerPlugin(def) {
        if (!def || !def.id || this.plugins.some(p => p.id === def.id)) return;
        // ファイルを読み込んで、動かすまでにかかった時間（ミリ秒）の目安です。前のプラグインの登録からの差で見ます（プラグインのメニューの「重さの目安」に使います）
        try { const now = performance.now(); def._load = Math.max(0, now - (this._lastReg || now)); this._lastReg = now; } catch (e) { /* 何もしない */ }
        // どのファイルから読み込まれたかを覚えます（「入っていないプラグイン」の一覧に使います）
        if (!def.file) {
            try { const cs = document.currentScript; if (cs && cs.src) def.file = decodeURIComponent(cs.src.split("?")[0].split("#")[0].split("/").pop()); } catch (e) { /* 何もしない */ }
        }
        this.plugins.push(def);
        // オフのプラグインは、本体から呼ばれる関数を、からっぽの関数に戻します
        if (!this.isEnabled(def.id) && Array.isArray(def.stubs) && typeof SEKIGAE_STUBS !== "undefined") {
            def.stubs.forEach(n => { if (SEKIGAE_STUBS[n]) window[n] = SEKIGAE_STUBS[n]; });
        }
        if (Array.isArray(def.backupKeys) && typeof BACKUP_KEYS !== "undefined") {
            def.backupKeys.forEach(k => { if (!BACKUP_KEYS.includes(k)) BACKUP_KEYS.push(k); });
        }
    },
    slot(name) { return document.querySelector('[data-plugin-slot="' + name + '"]'); },
    // スロットに、HTMLを入れます。where は insertAdjacentHTML と同じ（省略すると、スロットの中の最後）
    insertInto(name, html, where) {
        const el = this.slot(name);
        if (el) el.insertAdjacentHTML(where || "beforeend", html);
        return el;
    },
    _run(hook) {
        // プラグインが画面に足した部品に、どのプラグインのものかの印（data-plugin-src）を付けます。「設定へのジャンプ」と「使った回数」に使います
        let mo = null;
        try { if (typeof MutationObserver !== "undefined" && document.body) { mo = new MutationObserver(() => { }); mo.observe(document.body, { childList: true, subtree: true }); } } catch (e) { mo = null; }
        this.plugins.forEach(p => {
            if (typeof p[hook] !== "function" || !this.isEnabled(p.id)) return;
            if (mo) mo.takeRecords();
            const t0 = performance.now();
            try { p[hook](this); } catch (e) { console.error("プラグイン「" + (p.name || p.id) + "」の " + hook + " でエラー:", e); }
            p["_t_" + hook] = performance.now() - t0;
            if (mo) this._tagAdded(p.id, mo.takeRecords());
        });
        if (mo) mo.disconnect();
    },
    _tagAdded(id, recs) {
        recs.forEach(r => r.addedNodes.forEach(n => {
            if (n.nodeType === 1 && !n.hasAttribute("data-plugin") && !n.hasAttribute("data-plugin-src")) n.setAttribute("data-plugin-src", id);
        }));
    },
    // 起動の準備にかかった時間（ミリ秒）の目安：読み込み＋mount＋ready
    pluginCost(id) {
        const p = this.plugins.find(x => x.id === id);
        return p ? (p._load || 0) + (p._t_mount || 0) + (p._t_ready || 0) : 0;
    },
    // 画面の部品（index.html の data-plugin）のうち、入っていない・オフのプラグインのものを隠します
    _applyPluginVisibility() {
        document.querySelectorAll("[data-plugin]").forEach(el => {
            const p = this.plugins.find(x => x.id === el.dataset.plugin);
            if (!p || !this.isEnabled(p.id)) el.setAttribute("data-plugin-off", "");
        });
    },
    mountPlugins() {
        this._baseDisabled = this.disabledIds().slice();   // 読み込んだ時点でオフだったもの（「変更が N 件」の数え方の基準）
        this._applyPluginVisibility();
        this._run("mount");
        this._mountStatsTabs();
        const sec = this.slot("settings-system") && this.slot("settings-system").closest(".config-section");
        if (sec) {
            const words = this.plugins.filter(p => this.isEnabled(p.id)).map(p => p.searchWords).filter(Boolean).join(" ");
            if (words) sec.dataset.kw = (sec.dataset.kw ? sec.dataset.kw + " " : "") + words;
        }
        this.renderPluginList();
    },
    readyPlugins() { this._run("ready"); },
    // プラグインのオン・オフ（切り替えたものは、再読み込みのあとに反映されます）
    disabledIds() { try { const a = JSON.parse(lsGet("plugins_disabled", "[]")); return Array.isArray(a) ? a : []; } catch (e) { return []; } },
    // 必須のプラグイン（required: true）は、いつもオンで、切り替えられません
    isRequired(id) { const p = this.plugins.find(x => x.id === id); return !!(p && p.required); },
    isEnabled(id) { return this.isRequired(id) || !this.disabledIds().includes(id); },
    setEnabled(id, on) {
        if (this.isRequired(id)) return;
        const a = this.disabledIds().filter(x => x !== id);
        if (!on) a.push(id);
        lsSet("plugins_disabled", JSON.stringify(a));
        const note = $id("pluginReloadNote");
        if (note) note.hidden = false;
    },
    // プラグインの設定画面の、グループ分け（ここに無いプラグインは、「そのほか」に入ります）
    groups: [
        { title: "席替え・指名のくふう", color: "#d97706", ids: ["announce", "preview", "compare", "seatcheck", "yaocho", "roulette", "absent", "reasons", "animextra", "seatnote", "luckbank", "fortune", "roomlayout", "envelope", "seatjourney", "seat-wishes", "menu-groups", "seatskin", "nomination-balance", "nomination-queue", "seat-fairness", "rule-sets"] },
        { title: "名簿・入力", color: "#16a34a", ids: ["roster", "furigana", "softkeypad", "class-bulk", "class-settings", "class-history"] },
        { title: "記録・印刷・クラウド", color: "#0ea5e9", ids: ["history", "term", "print", "share", "seat-export", "schedule", "cloud", "updateinfo"] },
        { title: "道具", color: "#7c3aed", ids: ["timer", "program-timer", "calc", "music", "diagnostics", "plugin-presets", "settings-search", "plugin-menu", "settings-extras", "display-scale", "second-screen", "ui-styles", "tour"] }
    ],
    // オフのままの前提（入っているもの）を、前提の前提までたどって、返します
    requirementsOff(pid, seen) {
        seen = seen || new Set([pid]);
        const out = [];
        const p = this.plugins.find(x => x.id === pid);
        if (!p || !Array.isArray(p.requires)) return out;
        p.requires.forEach(id => {
            if (seen.has(id)) return;
            seen.add(id);
            const d = this.plugins.find(x => x.id === id);
            if (!d) return;
            if (!this.isEnabled(id)) out.push(id);
            this.requirementsOff(id, seen).forEach(x => out.push(x));
        });
        return Array.from(new Set(out));
    },
    nameOf(id) { const d = this.plugins.find(x => x.id === id); return d ? (d.name || id) : id; },
    // 前提のプラグインを、まとめてオンにします（「前提もオンにする」ボタン）
    enableRequirements(pid) {
        if (typeof isAppLocked === "function" && isAppLocked()) { if (typeof showLockedToast === "function") showLockedToast(); return; }
        const need = this.requirementsOff(pid);
        need.forEach(id => this.setEnabled(id, true));
        if (need.length) showToast("前提の「" + need.map(id => this.nameOf(id)).join("」「") + "」をオンにしました。再読み込みのあとに反映されます。", "success");
        this.renderPluginList();
    },
    renderPluginList() {
        const box = $id("pluginList");
        if (!box) return;
        if (!this.plugins.length) {
            box.innerHTML = '<p class="config-note" data-keep="1">読み込まれているプラグインは、ありません。</p>';
            return;
        }
        if (!this.groupOpen) this.groupOpen = {};
        if (!this.depsOpen) this.depsOpen = {};
        if (!box._pluginBound) {
            box._pluginBound = true;
            // グループと「関連」の、開き閉じを覚えます（一覧を描きなおしても、そのままにするため）
            box.addEventListener("toggle", e => {
                const d = e.target;
                if (!d || !d.classList) return;
                if (d.classList.contains("plugin-group") && !box.classList.contains("pm-searching")) this.groupOpen[d.dataset.group] = d.open;
                else if (d.classList.contains("plugin-deps-box")) this.depsOpen[d.dataset.depsBox] = d.open;
            }, true);
            box.addEventListener("click", e => {
                const b = e.target.closest("[data-plugin-fix]");
                if (b) this.enableRequirements(b.dataset.pluginFix);
            });
        }
        const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
        const optional = this.plugins.filter(p => !p.required);
        const required = this.plugins.filter(p => p.required);
        const used = new Set();
        // 前提のプラグインの、今の様子（オン・オフ・入っていない）
        const depState = id => {
            const d = this.plugins.find(x => x.id === id);
            if (!d) return { name: id + ".js", cls: "is-missing", mark: "入っていません", ok: false };
            const on = this.isEnabled(id);
            return { name: d.name || id, cls: on ? "is-ok" : "is-off", mark: on ? "オン" : "オフ", ok: on };
        };
        // 逆向き：このプラグインを、前提にしている・あわせて使うと便利にしている、プラグイン
        const usersOf = (id, key) => this.plugins.filter(x => x.id !== id && Array.isArray(x[key]) && x[key].includes(id));
        const userChip = x => { const on = this.isEnabled(x.id); return '<span class="plugin-dep ' + (on ? "is-use-on" : "is-use-off") + '">' + esc(x.name || x.id) + '：' + (on ? "オン" : "オフ") + '</span>'; };
        // 前提・連携は、「関連 N」に畳みます。前提がそろっていない時の警告だけは、畳まずに見せます
        const depsHtml = p => {
            const req = Array.isArray(p.requires) ? p.requires : [], sug = Array.isArray(p.suggests) ? p.suggests : [];
            const reqBy = usersOf(p.id, "requires"), sugBy = usersOf(p.id, "suggests");
            const total = req.length + sug.length + reqBy.length + sugBy.length;
            if (!total) return "";
            const chip = id => { const d = depState(id); return '<span class="plugin-dep ' + d.cls + '">' + esc(d.name) + '：' + d.mark + '</span>'; };
            const bad = req.filter(id => !depState(id).ok);
            const broken = bad.length > 0 && this.isEnabled(p.id);
            let h = "";
            if (broken) {
                const fixable = bad.some(id => this.plugins.some(x => x.id === id));
                const gone = bad.filter(id => !this.plugins.some(x => x.id === id));
                h += '<div class="plugin-deps-warn-row"><span class="plugin-deps-warn">前提がそろっていないので、使えません</span>' +
                    (fixable ? '<button type="button" class="btn-compact plugin-fix" data-plugin-fix="' + esc(p.id) + '">前提もオンにする</button>' : "") +
                    (gone.length ? '<span class="plugin-deps-gone">入っていない前提：' + gone.map(id => esc(id + ".js")).join("・") + '</span>' : "") + '</div>';
            }
            let inner = '';
            if (req.length) inner += '<span class="plugin-deps-label">前提</span>' + req.map(chip).join("");
            if (sug.length) inner += '<span class="plugin-deps-label">あわせて使うと便利</span>' + sug.map(chip).join("");
            if (reqBy.length) inner += '<span class="plugin-deps-label plugin-deps-break">これを前提にするプラグイン</span>' + reqBy.map(userChip).join("");
            if (sugBy.length) inner += '<span class="plugin-deps-label plugin-deps-break">これと一緒に使うと便利になるプラグイン</span>' + sugBy.map(userChip).join("");
            return h + '<details class="plugin-deps-box' + (broken ? " is-warn" : "") + '" data-deps-box="' + esc(p.id) + '"' + (this.depsOpen[p.id] ? " open" : "") + '><summary>関連 ' + total + '</summary>' +
                '<div class="plugin-deps' + (broken ? " is-warn" : "") + '" data-plugin-deps="' + esc(p.id) + '">' + inner + '</div></details>';
        };
        const rowHtml = p => {
            const id = "pluginToggle_" + p.id;
            return '<div class="plugin-row" data-plugin-row="' + esc(p.id) + '"><div class="switch-container"><label class="switch"><input type="checkbox" id="' + esc(id) + '" data-plugin-id="' + esc(p.id) + '"' + (this.isEnabled(p.id) ? " checked" : "") + '><span class="slider"></span></label>' +
                '<span class="switch-label" data-plugin-label="' + esc(p.id) + '">' + esc(p.name || p.id) + (p.version ? " " + esc(p.version) : "") + '</span></div>' + depsHtml(p) + '</div>';
        };
        const groupHtml = (title, color, list) => {
            if (!list.length) return "";
            const on = list.filter(p => this.isEnabled(p.id)).length;
            return '<details class="plugin-group" data-group="' + esc(title) + '"' + (this.groupOpen[title] === false ? "" : " open") + '><summary class="plugin-group-title" style="color: var(--uis-head, ' + color + ');">' + esc(title) +
                '<span class="plugin-group-count">' + on + ' / ' + list.length + '</span></summary><div class="plugin-group-body">' + list.map(rowHtml).join("") + '</div></details>';
        };
        let html = this.groups.map(g => {
            const list = g.ids.map(id => optional.find(p => p.id === id)).filter(Boolean);
            list.forEach(p => used.add(p.id));
            return groupHtml(g.title, g.color, list);
        }).join("");
        html += groupHtml("そのほか", "#64748b", optional.filter(p => !used.has(p.id)));
        if (required.length) {
            html += '<details class="plugin-required-box"><summary>🔒 必須のプラグイン（' + required.length + '）</summary><p class="config-note" data-keep="1">アプリの土台になる部分です。オフにはできません。</p>' +
                required.map(p => '<div class="switch-container plugin-required-item"><label class="switch" title="必須なので、切り替えられません"><input type="checkbox" checked disabled aria-label="' + esc(p.name || p.id) + '（必須）"><span class="slider"></span></label>' +
                    '<span class="switch-label" data-plugin-label="' + esc(p.id) + '">' + esc(p.name || p.id) + (p.version ? " " + esc(p.version) : "") + '</span></div>').join("") + '</details>';
        }
        box.innerHTML = html;
        // 説明は、名前の横のⓘに入れます
        this.plugins.forEach(p => {
            const label = box.querySelector('[data-plugin-label="' + p.id + '"]');
            if (label && p.description) { label.appendChild(document.createTextNode(" ")); label.appendChild(makeInfoTip(p.description)); }
        });
        box.querySelectorAll("input[data-plugin-id]").forEach(inp => {
            inp.addEventListener("change", () => {
                if (typeof isAppLocked === "function" && isAppLocked()) { inp.checked = !inp.checked; showLockedToast(); return; }
                const pid = inp.dataset.pluginId;
                // オンにする時に、前提がオフのままなら、一緒にオンにするか聞きます
                if (inp.checked) {
                    const need = this.requirementsOff(pid);
                    if (need.length && confirm("「" + this.nameOf(pid) + "」は、次のプラグインを前提にしています。\n" + need.map(id => "・" + this.nameOf(id)).join("\n") + "\n\n一緒にオンにしますか？")) {
                        need.forEach(id => this.setEnabled(id, true));
                    }
                }
                this.setEnabled(pid, inp.checked);
                // オフにしたプラグインを、前提にしているものが、使えなくなることを知らせます
                if (!inp.checked) {
                    const users = this.plugins.filter(x => this.isEnabled(x.id) && Array.isArray(x.requires) && x.requires.includes(pid)).map(x => x.name || x.id);
                    if (users.length) showToast(users.join("・") + "は、このプラグインを前提にしているので、使えなくなります。", "info");
                }
                this.renderPluginList();
            });
        });
    },
    // README.md の表から、プラグインの一覧を作ります（ファイル名・必須か・内容）
    parsePluginCatalog(text) {
        const rows = [];
        let req = null;
        String(text || "").split(/\r?\n/).forEach(line => {
            if (line.startsWith("## ")) req = line.includes("必須のプラグイン") ? true : (line.includes("オン・オフできるプラグイン") ? false : null);
            const m = line.match(/^\|\s*`([\w-]+\.js)`\s*\|\s*(.*?)\s*\|\s*$/);
            if (m && req !== null) rows.push({ file: m[1], required: req, desc: m[2].replace(/`/g, "") });
        });
        return rows;
    },
    // plugins/README.md を読みます。file:// で開いている時などは、ブラウザが読ませないので、本体に入れてある写しを使います
    async loadPluginCatalog() {
        try {
            const res = await fetch("plugins/README.md", { cache: "no-store" });
            if (res.ok) {
                const rows = this.parsePluginCatalog(await res.text());
                if (rows.length) return { rows: rows, source: "readme" };
            }
        } catch (e) { /* 読めない時は、写しを使います */ }
        return { rows: PLUGIN_CATALOG_BUILTIN.map(r => ({ file: r[0], required: r[1], desc: r[2] })), source: "builtin" };
    },
    loadedPluginFiles() { return new Set(this.plugins.map(p => p.file).filter(Boolean)); },
    // 設定の「プラグイン」に、入っていないプラグインの一覧を出します
    async renderMissingPlugins() {
        const box = $id("pluginMissing");
        if (!box) return;
        const cat = await this.loadPluginCatalog();
        const have = this.loadedPluginFiles();
        const missing = cat.rows.filter(r => !have.has(r.file));
        const esc = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
        const src = cat.source === "readme" ? "plugins/README.md から読み込みました。" : "README.md を直接は読めないので、本体に入れてある一覧を使いました。";
        if (!missing.length) {
            box.innerHTML = '<p class="config-note plugin-missing-none" data-keep="1">📦 入っていないプラグインは、ありません。すべて入っています。</p>';
            return;
        }
        box.innerHTML = '<details class="plugin-missing-box"><summary>📦 入っていないプラグイン（' + missing.length + '）</summary>' +
            '<p class="config-note" data-keep="1">使うには、ファイルを plugins フォルダに入れて、index.html に &lt;script src="plugins/ファイル名"&gt;&lt;/script&gt; の行を足します。' + esc(src) + '</p>' +
            missing.map(r => '<div class="plugin-missing-item"><code>' + esc(r.file) + '</code>' + (r.required ? '<span class="plugin-missing-req">必須</span>' : '') + '<span class="plugin-missing-desc">' + esc(r.desc) + '</span></div>').join("") + '</details>';
    },
    // 必須のプラグインが、1つでも読み込まれていないとき（ファイルが足りないとき）の、知らせ
    missingRequired() {
        const need = ["ui-parts","settings-menu","appearance","seat-style","sound","lock","backup","work-state","class-records","class-presets","roster-io","spreadsheet","seat-layout","groups","seat-rules","seat-render","seat-modal","seat-edit","shuffle-engine","shuffle-anim","nomination","stats"];
        return need.filter(id => !this.plugins.some(p => p.id === id));
    },
    reloadNow() { location.reload(); },
    // 記録・統計の画面に、タブを足すプラグイン用：statsTabs: [{ id, label, paneHtml, render(data), hideReset, hideCsv }]
    statsTabs() {
        const out = [];
        this.plugins.forEach(p => { if (this.isEnabled(p.id) && Array.isArray(p.statsTabs)) p.statsTabs.forEach(t => out.push(t)); });
        return out;
    },
    statsTabIds() { return this.statsTabs().map(t => t.id); },
    statsTabFlag(id, flag) { const t = this.statsTabs().find(x => x.id === id); return !!(t && t[flag]); },
    renderStatsTab(id, data) {
        const t = this.statsTabs().find(x => x.id === id);
        if (t && typeof t.render === "function") {
            try { t.render(data); } catch (e) { console.error("記録・統計のタブ「" + id + "」でエラー:", e); }
        }
    },
    _mountStatsTabs() {
        this.statsTabs().forEach(t => {
            this.insertInto("stats-tabs", '<button type="button" id="statsTabBtn_' + t.id + '" class="stats-tab" onclick="setStatsTab(\'' + t.id + '\')">' + t.label + '</button>', "beforebegin");
            this.insertInto("stats-panes", '<div id="statsPane_' + t.id + '" style="display: none;">' + t.paneHtml + '</div>', "beforebegin");
        });
    }
};

const ADMIN_PASSWORD = "secret"; 
let currentStudents = [];
let isAuthorized = false; 
let lastRawList = []; 
let activeTargetSeatLabel = ""; 
let animationCleanTimer = null; 
let nominatedHistoryList = [];
let nominateInterval = null;
let isNominating = false;
let seatHistory = [];

let groupNames = { 1: "1班", 2: "2班", 3: "3班", 4: "4班", 5: "5班", 6: "6班", 7: "7班", 8: "8班" };
let manualGroupMap = {}; 
let groupColorModeActive = false;
let seatGroupCount = 8;
// 「この2人は離す」設定。[{a: "田中", b: "鈴木"}, ...] の形で名前（クリーン済み）を持つ。
let separationPairs = [];
let nearPairs = []; // 「近くに置く」設定： [{ a, b }]
// 八百長モード：ONの時、席替えの見た目はランダムに見えるが、実際は事前に仕込んだ結果になる。
let yaochoMode = false;
let yaochoShowFixed = false;
let yaochoShowFixedSeats = new Set(); // 座席ごとに「八百長中も指定席として表示」を選んだ座席ラベル
let yaochoRiggedResult = null;
let selectedGroupColorTarget = 1;
let activeLoadingPresetName = "default";
let shouldAutoLoadResult = false;

let timerMilliseconds = 0; 
let initialTimerMilliseconds = 0; 
let hasPlayedAlarm = false;       
let timerIntervalId = null;
let isTimerRunning = false;
let isStopwatchMode = false;
let lastTickTime = 0;
let showMilliseconds = true; 
let showHoursFormat = false; // 60分を超えたら「時:分:秒」形式で表示する
let use12HourClock = false; // 時計を12時間制（午前/午後）で表示する
let clock12hUseAmPm = false; // 12時間制の表示を「午前/午後」ではなく「AM/PM」にする
let warningPercentage = 20; 
let isContinuousAlarm = false; 
let continuousAlarmInterval = null; 
let isSilentTestMode = false; 

let alarmType = "beep";
let alarmVolume = 0.5;
let audioCtx = null;
let timerEndAnimType = "flash"; 

let customTimerPresets = [
    { value: 3, unit: "min" }, { value: 5, unit: "min" },
    { value: 10, unit: "min" }, { value: 15, unit: "min" }
];
let customTimerAdds = [
    { value: 30, unit: "sec" }, { value: 1, unit: "min" }, { value: 5, unit: "min" }
];
let currentEditingBtnType = "preset"; 
let currentZoomLevel = 1;

let routineQueue = []; 
let currentPhaseLabel = "";
let hasPlayedHalfBell = false;
let hasPlayedOneMinBell = false;
let isBlindModeActive = false;
let lapTimes = [];

let rCanvas, rCtx, rAngle = 0, rSpinning = false, rVelocity = 0, rItems = [], rAnimationFrame;
let rPendingWinner = null; // 直前の当選者。次にスピンを押したとき除外する（除外設定ON時）

let specificallyExcludedStudents = new Set();
// 座席表のラベル順（A1→A2...→A6→B1→...）でcurrentStudentsを並べ直す。
// 配列のインデックス順は座席ラベルの並びと一致しないため、ルーレット等の表示順に使う。
function stripEmoji(text) {
    return String(text == null ? "" : text).replace(/[\u2300-\u23ff\u2600-\u2604\u2606-\u2714\u2717-\u27bf\u2900-\u297f\u2b00-\u2bff\u{1F000}-\u{1FFFF}\uFE0F]/gu, "").replace(/^[ \u3000]+/, "").replace(/[ \u3000]{2,}/g, " ");
}
function showToast(message, type = "error") {
    const container = $id("toastContainer");
    if (!container) return;
    const text = stripEmoji(message);
    const hideToast = t => { clearTimeout(t._tid); t.classList.add("hide"); setTimeout(() => t.remove(), 400); };
    const live = Array.from(container.children).filter(t => !t.classList.contains("hide"));
    // 同じ内容の通知が出ているときは、積み重ねず、表示の時間だけのばします
    const same = live.find(t => t.textContent === text);
    if (same) { clearTimeout(same._tid); same._tid = setTimeout(() => hideToast(same), 4000); return; }
    // 通知は同時に3つまで。多いときは、古いものから消します
    while (live.length >= 3) hideToast(live.shift());
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.textContent = text;
    container.appendChild(toast);
    toast._tid = setTimeout(() => hideToast(toast), 4000);
}

// ==========================================
// テキストボックスの Enter キーで内容を適用する
// ==========================================
// 各入力欄の id と、Enter を押したときに実行する処理を対応づける。
// IME（日本語入力）の変換確定用 Enter では実行しないようガードする。
window.onload = function() {
    // 必須のプラグインのファイルが足りないと、アプリは動かないので、知らせて止めます
    const missing = SekigaeApp.missingRequired();
    if (missing.length) {
        document.body.innerHTML = '<div style="max-width:560px;margin:60px auto;padding:24px;font-family:sans-serif;line-height:1.8;"><h2>ファイルが足りません</h2><p>「plugins」フォルダの中のファイルが、そろっていません。ダウンロードした「script.js」「index.html」「style.css」「plugins」フォルダを、すべて同じ場所に置いてください。</p><p style="color:#64748b;font-size:13px;">足りないもの：' + missing.join("、") + '</p></div>';
        return;
    }
    try {
        const versionEl = $id("appVersionText");
        if (versionEl) versionEl.textContent = "席替えし太郎 Ver." + APP_VERSION;
        SekigaeApp.mountPlugins();
        checkForAppUpdates();
        setupConfigSectionToggles();
        setupInfoTips();
        setupFavoriteSettings();
        initConfigWide();
        setupAdvBoxes();
        applyAccessibilitySettings();
        applyGroupOrderSetting();
        applyTimerVisualSettings();
        setTimeout(checkAutoBackup, 2500);
        setTimeout(renderBackupHealth, 600);
        setTimeout(checkBackupReminder, 4000);
        setInterval(() => { checkAutoBackup(); checkBackupReminder(); renderBackupHealth(); const ts = $id("themeSelect"); if (ts && ts.value === "theme-auto") applyTheme(); }, 10 * 60 * 1000);
        document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") checkAutoBackup(); });
        try { specificallyExcludedStudents = new Set(JSON.parse(localStorage.getItem("nominate_specific_excluded") || "[]")); } catch (error) { specificallyExcludedStudents = new Set(); }
        const specificExcludeToggle = $id("nominateSpecificExcludeToggle");
        if (specificExcludeToggle) { specificExcludeToggle.checked = localStorage.getItem("nominate_specific_exclude_enabled") === "true"; toggleSpecificExclude(); }
        initClassRecords();
        updatePresetRadioButtons();
        loadHistoryLogs();
        loadSeparationPairs();
        loadNearPairs();
        loadFurigana();
        loadShuffleAnimationSettings();
        loadRandomScope();
        setupEmojiA11y();
        setupSoftKeypad();
        SekigaeApp.readyPlugins();
        loadYaochoState();
        const autoSyncToggle = $id("autoSyncToggle");
        if (autoSyncToggle) {
            autoSyncToggle.checked = localStorage.getItem("auto_sync_enabled") === "true";
            if (autoSyncToggle.checked) startAutoSync();
        }
        loadStepSets();
        const stepAutoToggle = $id("stepAutoToggle");
        if (stepAutoToggle) stepAutoToggle.checked = localStorage.getItem("step_auto_advance") !== "false";
        loadSeatLayoutLog();
        loadSeatTimeline();
        compareOn = lsGet("compare_on", "false") === "true";
        loadAvoidSettings();
        applyConditionPriorityUi();
        initLock();
        const favorRecentToggle = $id("nominateFavorRecentToggle");
        if (favorRecentToggle) favorRecentToggle.checked = localStorage.getItem("nominate_favor_recent") === "true";
        const autoUploadToggle = $id("autoUploadAfterShuffleToggle");
        if (autoUploadToggle) autoUploadToggle.checked = localStorage.getItem("auto_upload_after_shuffle") === "true";
        loadGroupColorsFromStorage();
        const savedGroupCount = parseInt(localStorage.getItem("seat_group_count"), 10);
        if (savedGroupCount >= 2 && savedGroupCount <= 8) {
            seatGroupCount = savedGroupCount;
            const countSel = $id("groupCountSelect");
            if (countSel) countSel.value = String(savedGroupCount);
        }
        initGroupNamesUI(); 
        
        const savedTheme = localStorage.getItem("app_theme");
        if (savedTheme && $id("themeSelect")) $id("themeSelect").value = savedTheme;
        applyTheme();
        setTimeout(() => document.body.classList.remove("no-theme-transition"), 700);

        const savedZoom = localStorage.getItem("classroom_zoom");
        if (savedZoom) {
            currentZoomLevel = parseFloat(savedZoom);
            if ($id("zoomSlider")) $id("zoomSlider").value = currentZoomLevel;
        }
        updateZoom(); 

        if ($id("alarmVolumeSlider")) updateVolumeUI();

        const savedUrl = localStorage.getItem("saved_gas_url");
        if (savedUrl && $id("gasUrlInput")) $id("gasUrlInput").value = savedUrl;
        if ($id("gasUrlInput")) $id("gasUrlInput").addEventListener("input", updateStatusBadgeVisibility);
        updateStatusBadgeVisibility();
        
        if (localStorage.getItem("smooth_animation") === "false") {
            if ($id("smoothAnimToggle")) $id("smoothAnimToggle").checked = false;
            document.body.classList.add("no-animation");
        }

        if (localStorage.getItem("show_milliseconds") === "false") {
            showMilliseconds = false;
        }

        if (localStorage.getItem("show_hours_format") === "true") {
            showHoursFormat = true;
        }

        if (localStorage.getItem("use_12hour_clock") === "true") {
            use12HourClock = true;
        }

        if (localStorage.getItem("clock_12h_ampm") === "true") {
            clock12hUseAmPm = true;
        }
        
        const savedWarningPct = localStorage.getItem("warning_percentage");
        if (savedWarningPct) {
            warningPercentage = parseInt(savedWarningPct, 10);
        }
        
        if (localStorage.getItem("continuous_alarm") === "true") {
            isContinuousAlarm = true;
        }
        if (localStorage.getItem("silent_test_mode") === "true") {
            isSilentTestMode = true;
        }

        if ($id("msToggle")) $id("msToggle").checked = showMilliseconds;
        if ($id("hoursFormatToggle")) $id("hoursFormatToggle").checked = showHoursFormat;
        if ($id("clock12hToggle")) $id("clock12hToggle").checked = use12HourClock;
        if ($id("clock12hAmPmToggle")) $id("clock12hAmPmToggle").checked = clock12hUseAmPm;
        updateAmPmRowVisibility();
        if ($id("continuousAlarmToggle")) $id("continuousAlarmToggle").checked = isContinuousAlarm;
        if ($id("warningPctInput")) $id("warningPctInput").value = warningPercentage;
        if ($id("silentTestModeToggle")) $id("silentTestModeToggle").checked = isSilentTestMode;

        const savedTimerEndAnim = localStorage.getItem("timer_end_anim");
        if (savedTimerEndAnim) {
            timerEndAnimType = savedTimerEndAnim;
            if ($id("timerEndAnimSelect")) $id("timerEndAnimSelect").value = timerEndAnimType;
        }
        
        const savedPresets = localStorage.getItem("timer_presets");
        if (savedPresets) {
            customTimerPresets = JSON.parse(savedPresets);
        }
        const savedAdds = localStorage.getItem("timer_adds");
        if (savedAdds) {
            customTimerAdds = JSON.parse(savedAdds);
        }

        renderTimerButtons();
        syncOfflineButtons();
        updateColumns();
        renderClassroom("initial"); 
        restoreWorkState();
        if (typeof restoreSeatUndo === "function") restoreSeatUndo();

        if ($id("secretStudentInput")) {
            $id("secretStudentInput").addEventListener("keydown", function(event) {
                if (event.key === "Enter") {
                    event.preventDefault();
                    applySecretFromModal();
                }
            });
        }

        // テキストボックスで Enter を押したら内容を適用できるようにする
        initEnterKeyHandlers();

        updateClock();
        setInterval(updateClock, 1000);
        updateTimerDisplay();
    } catch (error) {
        console.error("初期化エラーが発生しました:", error);
    }
};

// ==========================================
// UIスライダー・テーマ切り替え
// ==========================================
function lsGet(key, fallback) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch (error) { return fallback; } }
function lsSet(key, value) { try { localStorage.setItem(key, value); } catch (error) { /* 保存できなくても、そのまま続ける */ } }

function closeAnnounce() { }
function isAnnounceOpen() { return false; }
function openAnnounce() { }
function analyzeRosterStrings() { }
function decodeRosterFileBuffer() { }
function detectRosterTable() { }
function openRosterMapModal() { }
function parseRosterFileText() { }
function setupSoftKeypad() { }
function syncSeatToolsRow() { }
function updateSeatCheckButton() { }
function applyCompareBadges() { }
function updateCompareButton() { }
function loadSeatTimeline() { }
function recordSeatTimeline() { }
function renderTimeline() { }
function extractFuriganaFromRosterText() { return ""; }
function getFuriganaFor() { return ""; }
function harvestFuriganaFromRoster() { return 0; }
function loadFurigana() { }
function saveFurigana() { }
function updateYaochoStatusText() { }
function drawRoulette() { }
function spinRoulette() { }
function checkForAppUpdates() { }
function getAnimSpeed() { return 1; }
function getFavAnims() { return []; }
function refreshFavAnimUI() { }
function refreshMyAnimUI() { }
function confirmSlotNameAndSave() { }
function startAutoSync() { }
function applyTimerVisualSettings() { }
function handleCustomTimeSet() { }
function loadStepSets() { }
function renderTimerButtons() { }
function setTimerToClockTime() { }
function updateAlarmSettings() { }
// 時計（日付と時刻）。タイマーのプラグインがオフ・なしでも、時計は出ます
function getClockParts(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dt = String(d.getDate()).padStart(2, "0");
    const day = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
    const rawH = d.getHours();
    const min = String(d.getMinutes()).padStart(2, "0");
    const sec = String(d.getSeconds()).padStart(2, "0");
    let timeStr;
    if (use12HourClock) {
        const h12 = String(rawH % 12 === 0 ? 12 : rawH % 12).padStart(2, "0");
        if (clock12hUseAmPm) timeStr = `${h12}:${min}:${sec} ${rawH < 12 ? "AM" : "PM"}`;
        else timeStr = `${rawH < 12 ? "午前" : "午後"} ${h12}:${min}:${sec}`;
    } else {
        timeStr = `${String(rawH).padStart(2, "0")}:${min}:${sec}`;
    }
    return { dateStr: `${y}/${m}/${dt}(${day})`, timeStr };
}
function updateClock() {
    const clockEl = $id("realtimeClock");
    if (!clockEl) return;
    const p = getClockParts(new Date());
    clockEl.innerHTML = `🕒 ${p.dateStr} ${p.timeStr}`;
}
function toggle12HourClock() {
    const tog = $id("clock12hToggle");
    if (!tog) return;
    use12HourClock = tog.checked;
    localStorage.setItem("use_12hour_clock", use12HourClock);
    const styleLabel = clock12hUseAmPm ? "AM/PM" : "午前/午後";
    showToast(use12HourClock ? `12時間制で表示します。表記は${styleLabel}です。` : "24時間制で表示します。", "success");
    updateAmPmRowVisibility();
    updateClock();
}
function toggle12HourAmPm() {
    const tog = $id("clock12hAmPmToggle");
    if (!tog) return;
    clock12hUseAmPm = tog.checked;
    localStorage.setItem("clock_12h_ampm", clock12hUseAmPm);
    showToast(clock12hUseAmPm ? "AM/PM 表記で表示します。" : "午前/午後 表記で表示します。", "success");
    updateClock();
}
// 12時間制がONのときだけ「AM/PM表記」トグルを表示する
function updateAmPmRowVisibility() {
    const row = $id("clock12hAmPmRow");
    if (row) row.style.display = use12HourClock ? "flex" : "none";
}
// 時計を押すと、タイマーのパネルが開きます（タイマーのプラグインがオフ・なしの時は、何もしません）
function onClockClick() {
    if (typeof toggleTimerPanel === "function" && SekigaeApp.plugins.some(p => p.id === "timer") && SekigaeApp.isEnabled("timer")) toggleTimerPanel();
}
function updateTimerDisplay() { }
function updateWarningPct() { }
function luckActive() { return false; }
function luckPenalty() { return 0; }
const SEKIGAE_STUBS = { closeAnnounce, isAnnounceOpen, openAnnounce, analyzeRosterStrings, decodeRosterFileBuffer, detectRosterTable, openRosterMapModal, parseRosterFileText, setupSoftKeypad, syncSeatToolsRow, updateSeatCheckButton, applyCompareBadges, updateCompareButton, loadSeatTimeline, recordSeatTimeline, renderTimeline, extractFuriganaFromRosterText, getFuriganaFor, harvestFuriganaFromRoster, loadFurigana, saveFurigana, updateYaochoStatusText, drawRoulette, spinRoulette, checkForAppUpdates, getAnimSpeed, getFavAnims, refreshFavAnimUI, refreshMyAnimUI, confirmSlotNameAndSave, startAutoSync, applyTimerVisualSettings, handleCustomTimeSet, loadStepSets, renderTimerButtons, setTimerToClockTime, updateAlarmSettings, updateAmPmRowVisibility, updateClock, updateTimerDisplay, updateWarningPct, luckActive, luckPenalty };

// プラグインの設定画面（座席設定のような、設定の画面です）
function openPluginModal() {
    const overlay = $id("pluginModalOverlay");
    if (!overlay) return;
    if (typeof closePopMenus === "function") closePopMenus();
    overlay.style.display = "flex";
    if (typeof SekigaeApp !== "undefined") SekigaeApp.renderMissingPlugins();
}
function closePluginModal() {
    const overlay = $id("pluginModalOverlay");
    if (overlay) overlay.style.display = "none";
}
document.addEventListener("keydown", e => {
    if (e.key !== "Escape") return;
    const o = $id("pluginModalOverlay");
    if (o && o.style.display !== "none") closePluginModal();
});
