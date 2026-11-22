// ==========================================
// プラグイン一覧のそろえ・点検の道具（開発用です。アプリには、読み込まれません）
//
// plugins/README.md の表を、正しい元とします。次の2つのことができます。
//   node tools/sync_plugin_catalog.js          点検だけ（ちがう所があると、内容を出して、終了コード 1 で終わります）
//   node tools/sync_plugin_catalog.js --write  script.js の PLUGIN_CATALOG_BUILTIN を、README.md の表のとおりに書き直します
//
// 点検の内容
//   1. README.md の表と、script.js の PLUGIN_CATALOG_BUILTIN が、同じ（ファイル名・必須か・説明）
//   2. plugins フォルダにある .js が、すべて README.md の表に載っている（表にあるのに、ファイルが無いものも見つけます）
//   3. index.html の <script src="plugins/…"> が、すべて README.md の表に載っている
//   4. 各プラグインの requires / suggests に書いた id が、plugins フォルダに実在する
// ==========================================
const fs = require("fs");
const path = require("path");
const root = path.resolve(__dirname, "..");
const write = process.argv.includes("--write");

const readme = fs.readFileSync(path.join(root, "plugins", "README.md"), "utf8");
const scriptPath = path.join(root, "script.js");
const script = fs.readFileSync(scriptPath, "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

// script.js の SekigaeApp.parsePluginCatalog と、同じ読み方です
function parseReadme(text) {
    const rows = [];
    let req = null;
    text.split(/\r?\n/).forEach(line => {
        if (line.startsWith("## ")) req = line.includes("必須のプラグイン") ? true : (line.includes("オン・オフできるプラグイン") ? false : null);
        const m = line.match(/^\|\s*`([\w-]+\.js)`\s*\|\s*(.*?)\s*\|\s*$/);
        if (m && req !== null) rows.push([m[1], req, m[2].replace(/`/g, "")]);
    });
    return rows;
}
const rows = parseReadme(readme);

const startTag = "const PLUGIN_CATALOG_BUILTIN = [\n";
const si = script.indexOf(startTag);
if (si < 0) { console.error("script.js に PLUGIN_CATALOG_BUILTIN が見つかりません"); process.exit(2); }
const bodyStart = si + startTag.length;
const ei = script.indexOf("\n];", bodyStart);
if (ei < 0) { console.error("PLUGIN_CATALOG_BUILTIN の終わりが見つかりません"); process.exit(2); }
const body = script.slice(bodyStart, ei);
const wanted = rows.map(r => "    [" + JSON.stringify(r[0]) + ", " + r[1] + ", " + JSON.stringify(r[2]) + "],").join("\n").replace(/,$/, "");
// 今の中身（JSON として読めるように、行ごとに読む）
const current = [];
body.split("\n").forEach(line => {
    const t = line.trim().replace(/,$/, "");
    if (!t) return;
    try { current.push(JSON.parse(t)); } catch (e) { current.push(["(読めない行)", false, t]); }
});

const problems = [];
const key = r => r[0];
const curMap = new Map(current.map(r => [key(r), r])), readMap = new Map(rows.map(r => [key(r), r]));
rows.forEach(r => {
    const c = curMap.get(key(r));
    if (!c) problems.push("script.js の一覧に無い: " + r[0]);
    else if (c[1] !== r[1]) problems.push("必須かどうかがちがう: " + r[0] + "（README " + r[1] + " / script.js " + c[1] + "）");
    else if (c[2] !== r[2]) problems.push("説明がちがう: " + r[0]);
});
current.forEach(c => { if (!readMap.has(key(c))) problems.push("README.md の表に無い（script.js だけにある）: " + c[0]); });
if (current.length === rows.length && rows.some((r, i) => key(r) !== key(current[i]))) problems.push("並び順がちがいます（--write で、README.md と同じ順になります）");

// 2. plugins フォルダと README.md の表
const files = fs.readdirSync(path.join(root, "plugins")).filter(f => f.endsWith(".js")).sort();
const inReadme = new Set(rows.map(r => r[0]));
files.forEach(f => { if (!inReadme.has(f)) problems.push("plugins にあるのに、README.md の表に無い: " + f); });
rows.forEach(r => { if (!files.includes(r[0])) problems.push("README.md の表にあるのに、plugins にファイルが無い: " + r[0]); });

// 3. index.html の script タグ
const tags = [...html.matchAll(/<script\s+src="plugins\/([^"]+\.js)"/g)].map(m => m[1]);
tags.forEach(f => { if (!inReadme.has(f)) problems.push("index.html にあるのに、README.md の表に無い: " + f); });
if (new Set(tags).size !== tags.length) problems.push("index.html に、同じプラグインの script タグが2回あります");

// 4. requires / suggests に書いた id が、plugins フォルダにあるプラグインの id か（id は、ファイル名から .js を除いたもの）
files.forEach(f => {
    const text = fs.readFileSync(path.join(root, "plugins", f), "utf8");
    ["requires", "suggests"].forEach(k => {
        const m = text.match(new RegExp("\\b" + k + ":\\s*\\[([^\\]]*)\\]"));
        if (!m) return;
        (m[1].match(/"([\w-]+)"/g) || []).map(x => x.replace(/"/g, "")).forEach(id => {
            if (!files.includes(id + ".js")) problems.push(f + " の " + k + " に書かれた「" + id + "」が、plugins フォルダにありません");
        });
    });
});

if (write) {
    const out = script.slice(0, bodyStart) + wanted + script.slice(ei);
    if (out !== script) { fs.writeFileSync(scriptPath, out); console.log("script.js の PLUGIN_CATALOG_BUILTIN を書き直しました（" + rows.length + "件）"); }
    else console.log("script.js は、すでに README.md と同じです（" + rows.length + "件）");
    // 書き直したあとで、残りの点検（2・3）を出す
    const rest = problems.filter(p => !/^(script\.js の一覧|必須かどうか|説明がちがう|README\.md の表に無い（script|並び順)/.test(p));
    rest.forEach(p => console.log("要確認: " + p));
    process.exit(rest.length ? 1 : 0);
}
if (problems.length) { console.log("ちがう所が " + problems.length + " 件あります：\n- " + problems.join("\n- ")); process.exit(1); }
console.log("OK：README.md の表 " + rows.length + " 件が、script.js と plugins フォルダと index.html に、すべてそろっています。");
