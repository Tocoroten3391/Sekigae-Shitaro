// ==========================================
// 席替えし太郎：不具合・要望の中継役（Cloudflare Workers）
// アプリから届いた報告を、GitHubの Issue にします。GitHubのトークンは、この中継役だけが持ちます（アプリには入れません）
// 設定のしかたは、同じフォルダの「設定の手順.md」を見てください
//
// 必要な設定（Cloudflareの画面で入れます）
//   変数  GH_OWNER : Tocoroten3391
//   変数  GH_REPO  : Sekigae-Shitaro_Apps
//   シークレット  GH_TOKEN : GitHubのトークン（Issues の読み書きだけを許可したもの）
//   （おすすめ）KV の名前空間を、名前 RATE で結びつける ← 回数の制限に使います
// ==========================================

const LIMIT_PER_HOUR = 5;      // 1つの接続元が、1時間に送れる数
const LIMIT_PER_DAY = 100;     // 全体で、1日に作る Issue の数（荒らし対策）
const KINDS = {
  bug: { label: "不具合", tag: "[不具合]" },
  idea: { label: "要望", tag: "[要望]" },
  question: { label: "質問", tag: "[質問]" }
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400"
};
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });

// 文字を整える：制御文字をなくし、長さを切る。@ を無効にして、無関係な人に通知が飛ぶのを防ぐ
function clean(s, max) {
  return String(s == null ? "" : s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/@/g, "@​")
    .slice(0, max);
}
function inline(s, max) { return clean(s, max).replace(/[\r\n`|]/g, " ").trim(); }

// 回数の制限（KV があるときは確実に、ないときは、この中継役のメモリの中だけで）
const memo = new Map();
async function hit(env, key, limit, ttl) {
  if (env.RATE) {
    const cur = parseInt((await env.RATE.get(key)) || "0", 10);
    if (cur >= limit) return false;
    await env.RATE.put(key, String(cur + 1), { expirationTtl: ttl });
    return true;
  }
  const now = Date.now();
  const rec = memo.get(key);
  if (rec && rec.until > now) { if (rec.n >= limit) return false; rec.n++; return true; }
  memo.set(key, { n: 1, until: now + ttl * 1000 });
  return true;
}

function buildIssue(p, ip) {
  const kind = KINDS[p.kind] || KINDS.bug;
  const text = clean(p.text, 2000).trim();
  const firstLine = text.split(/\r?\n/)[0].replace(/\s+/g, " ").slice(0, 50);
  const title = kind.tag + " " + (firstLine || "（無題）");
  const e = (p.env && typeof p.env === "object") ? p.env : {};
  const rows = [];
  const add = (k, v) => { if (v !== undefined && v !== null && String(v) !== "") rows.push("| " + k + " | " + inline(v, 160) + " |"); };
  add("バージョン", e.version);
  add("画面スタイル", e.style);
  add("開き方", e.mode);
  add("ブラウザ", e.ua);
  add("画面の大きさ", e.screen);
  add("通信", e.online);
  add("直前の同期エラー", e.gasError);
  if (Array.isArray(e.plugins) && e.plugins.length) add("使っている部品", e.plugins.slice(0, 80).join(", "));
  let errs = "";
  if (Array.isArray(e.errors) && e.errors.length) errs = "\n\n<details><summary>直前の内部エラー</summary>\n\n```\n" + e.errors.slice(0, 5).map(x => clean(x, 200).replace(/`/g, "'")).join("\n") + "\n```\n</details>";
  const quoted = text.split(/\r?\n/).map(l => "> " + l).join("\n");
  const body =
    "**種類**：" + kind.label + "\n\n" + quoted +
    (rows.length ? "\n\n| 項目 | 内容 |\n|---|---|\n" + rows.join("\n") : "") + errs +
    "\n\n---\n*アプリの「不具合・要望を送る」から送られました。*";
  return { title, body, labels: [kind.label, "アプリから"] };
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method === "GET") return json({ ok: true, name: "sekigae-feedback-relay" });
    if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
    if (!env.GH_TOKEN || !env.GH_OWNER || !env.GH_REPO) return json({ ok: false, error: "not_configured" }, 500);

    const len = parseInt(request.headers.get("content-length") || "0", 10);
    if (len > 20000) return json({ ok: false, error: "too_large" }, 413);
    let p;
    try { p = JSON.parse(await request.text()); } catch (e) { return json({ ok: false, error: "bad_json" }, 400); }
    if (!p || typeof p !== "object") return json({ ok: false, error: "bad_json" }, 400);

    // ボットよけ：人には見えない欄に、何か入っていたら、受け付けた振りをして、捨てます
    if (p.hp) return json({ ok: true, number: 0, url: "" });

    const text = String(p.text || "").trim();
    if (text.length < 10) return json({ ok: false, error: "too_short" }, 400);
    if (text.length > 2000) return json({ ok: false, error: "too_long" }, 400);

    const ip = request.headers.get("cf-connecting-ip") || "unknown";
    if (!(await hit(env, "h:" + ip, LIMIT_PER_HOUR, 3600))) return json({ ok: false, error: "rate_limit" }, 429);
    const day = new Date().toISOString().slice(0, 10);
    if (!(await hit(env, "d:" + day, LIMIT_PER_DAY, 86400))) return json({ ok: false, error: "busy" }, 429);

    const issue = buildIssue(p, ip);
    let r;
    try {
      r = await fetch("https://api.github.com/repos/" + encodeURIComponent(env.GH_OWNER) + "/" + encodeURIComponent(env.GH_REPO) + "/issues", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.GH_TOKEN,
          "Accept": "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "User-Agent": "sekigae-feedback-relay",
          "Content-Type": "application/json"
        },
        body: JSON.stringify(issue)
      });
    } catch (e) { return json({ ok: false, error: "github_unreachable" }, 502); }
    if (!r.ok) {
      // トークンや権限の問題は、詳しくは返さない（アプリには「受け付けられなかった」とだけ伝える）
      return json({ ok: false, error: "github_" + r.status }, 502);
    }
    const d = await r.json();
    return json({ ok: true, number: d.number, url: d.html_url });
  }
};
