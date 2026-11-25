#!/usr/bin/env node
// 更新情報を1件足す道具。
//   node tools/add_release.js "本文（改行は \n）" [バージョン] [日付 yyyy/mm/dd]
//   バージョンと日付を省くと、script.js の APP_VERSION と今日になります。
// script.js の APP_VERSION と今日の日付で、次の3つを作り直します。
//   server/changelog.json  自前のサーバーに置く、更新情報（server/updates.php が配信）
//   changelog.js           アプリの中に持つ履歴（通信できないときの「更新履歴を見る」用）
//   server/更新情報_X.Y.Z.txt  スプレッドシートに貼る用の文章
// 同じバージョンがすでにあるときは、本文を上書きします。
// 本文の各行の先頭に【新機能】【改善】【修正】と書くと、更新のお知らせと更新履歴で、その種類の印が付き、種類で絞り込めます。
//   例：node tools/add_release.js "【新機能】○○ができるようになりました。\n【修正】△△の不具合を直しました。"
//   何も書かないと、言葉から、およその種類が決まります。
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const notes = (process.argv[2] || "").replace(/\\n/g, "\n").trim();
if (!notes) { console.error("使い方: node tools/add_release.js \"本文\""); process.exit(1); }
const ver = process.argv[3] || fs.readFileSync(path.join(root, "script.js"), "utf8").match(/const APP_VERSION = "([^"]+)"/)[1];
const d = new Date(Date.now() + 9 * 3600 * 1000);
const date = process.argv[4] || d.getUTCFullYear() + "/" + String(d.getUTCMonth() + 1).padStart(2, "0") + "/" + String(d.getUTCDate()).padStart(2, "0");
const jf = path.join(root, "server", "changelog.json");
let list = [];
try { list = JSON.parse(fs.readFileSync(jf, "utf8")); } catch (e) { /* 初回 */ }
list = list.filter(e => e.version !== ver);
list.push({ version: ver, date, notes });
const cmp = (a, b) => { const p = v => v.replace(/^[^\d]*/, "").split(".").map(Number); const x = p(a), y = p(b); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) - (y[i] || 0); } return 0; };
list.sort((a, b) => cmp(b.version, a.version));
fs.writeFileSync(jf, JSON.stringify(list, null, 2) + "\n");
fs.writeFileSync(path.join(root, "changelog.js"), "// 更新履歴（tools/add_release.js が作ります。手で直さないでください）\nconst LOCAL_CHANGELOG = " + JSON.stringify(list, null, 2) + ";\n");
fs.writeFileSync(path.join(root, "server", "更新情報_" + ver + ".txt"), "Ver." + ver + "\n" + date + "\n" + notes + "\n");
console.log("追加しました: Ver." + ver + "（" + date + "）／全 " + list.length + " 件");
