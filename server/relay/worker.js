// ==========================================
// 席替えし太郎：不具合・要望の中継役（Cloudflare Workers）
// アプリから届いた報告を、GitHubの Issue にします。GitHubのトークンは、この中継役だけが持ちます（アプリには入れません）
// 設定のしかたは、同じフォルダの「設定の手順.md」を見てください
//
// 必要な設定（Cloudflareの画面で入れます）
//   変数  GH_OWNER : Tocoroten3391
//   変数  GH_REPO  : Sekigae-Shitaro_Apps
//   シークレット  GH_TOKEN : GitHubのトークン（Issues の読み書きだけを許可したもの）
//   （おすすめ）KV の名前空間を、名前 RATE で結びつける ← 回数の制限と、スクリーンショットの保管に使います
//     スクリーンショットは、KV に、180日だけ置かれます（GitHub には置きません）
//   報告の状況（受付中・対応済み・管理者の返信）は、GET /status?n=4,5 で返します（アプリの「送った報告」が使います）
// ==========================================

const LIMIT_PER_HOUR = 20;     // 1つの接続元が、1時間に送れる数
const MAX_IMAGES = 3;          // 1件に付けられる画像の数
const MAX_IMAGE_BYTES = 500000; // 画像1枚の大きさ（アプリ側で、縮めて送ります）
const IMAGE_TTL = 60 * 60 * 24 * 180; // 画像を置いておく日数（秒）
const MAX_BODY = 2400000;      // 受け取れる、全体の大きさ
const LIMIT_PER_DAY = 100;
const STATUS_MAX = 10;         // 状況を1回で調べられる報告の数
const STATUS_LIMIT_PER_HOUR = 120; // 1つの接続元が、1時間に状況を調べられる回数
const STATUS_CACHE_SEC = 60;   // 同じ報告の状況を、使い回す秒数
const REPLY_MAX = 300;         // 返信として見せる文字数     // 全体で、1日に作る Issue の数（荒らし対策）
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

function buildIssue(p, imageUrls, imageNote) {
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
    (imageUrls && imageUrls.length ? "\n\n**添付画像**\n\n" + imageUrls.map((u, i) => "![画像" + (i + 1) + "](" + u + ")").join("\n\n") : "") +
    (imageNote ? "\n\n*" + imageNote + "*" : "") +
    (rows.length ? "\n\n| 項目 | 内容 |\n|---|---|\n" + rows.join("\n") : "") + errs +
    "\n\n---\n*アプリの「不具合・要望を送る」から送られました。*";
  return { title, body, labels: [kind.label, "アプリから"] };
}

// ---- 画像 ----
function randomId() {
  const a = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(a).map(b => b.toString(16).padStart(2, "0")).join("");
}
// 受け取った画像（base64）を確かめて、バイト列にします。JPEG だけ受け付けます（アプリが、必ず JPEG にして送ります）
function decodeImage(b64) {
  if (typeof b64 !== "string" || b64.length < 100 || b64.length > Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 8) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return null;
  let bin;
  try { bin = atob(b64); } catch (e) { return null; }
  if (bin.length > MAX_IMAGE_BYTES) return null;
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  if (!(u[0] === 0xFF && u[1] === 0xD8 && u[2] === 0xFF)) return null;
  return u;
}
async function saveImages(env, origin, list) {
  const store = env.IMG || env.RATE;
  if (!store) return { urls: [], note: "画像は、保管場所（KV）がまだ結びつけられていないため、付けられませんでした。", error: "no_store" };
  const urls = [];
  for (const b64 of list.slice(0, MAX_IMAGES)) {
    const bytes = decodeImage(b64);
    if (!bytes) return { urls, note: "画像のうち、受け付けられないものがありました。", error: "bad_image" };
    const id = randomId();
    try { await store.put("img:" + id, bytes, { expirationTtl: IMAGE_TTL }); }
    catch (e) { return { urls, note: "画像を保管できませんでした。", error: "store_failed" }; }
    urls.push(origin + "/img/" + id + ".jpg");
  }
  return { urls, note: "", error: "" };
}
async function serveImage(env, pathname) {
  const store = env.IMG || env.RATE;
  const m = pathname.match(/^\/img\/([0-9a-f]{24})\.jpg$/);
  if (!store || !m) return new Response("not found", { status: 404, headers: CORS });
  const buf = await store.get("img:" + m[1], "arrayBuffer");
  if (!buf) return new Response("not found", { status: 404, headers: CORS });
  return new Response(buf, { status: 200, headers: { ...CORS, "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}

// ---- 報告の状況 ----
const statusMemo = new Map();
async function ghGet(env, path) {
  return fetch("https://api.github.com/repos/" + encodeURIComponent(env.GH_OWNER) + "/" + encodeURIComponent(env.GH_REPO) + path, {
    headers: { "Authorization": "Bearer " + env.GH_TOKEN, "Accept": "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "sekigae-feedback-relay" }
  });
}
// 1件の状況：受付中／対応済み／見送りと、管理者（持ち主・共同作業者）の、いちばん新しい返信。アプリから送られた報告以外は、返しません
async function issueStatus(env, n) {
  const memo = statusMemo.get(n);
  if (memo && memo.until > Date.now()) return memo.v;
  let v = { found: false };
  const r = await ghGet(env, "/issues/" + n);
  if (r.ok) {
    const d = await r.json();
    const mine = !d.pull_request && Array.isArray(d.labels) && d.labels.some(l => l && l.name === "アプリから");
    if (mine) {
      let replies = 0, last = null;
      if (d.comments > 0) {
        // コメントは古い順に返るので、最後のほうだけ取ります
        const page = Math.max(1, Math.ceil(d.comments / 30));
        const cr = await ghGet(env, "/issues/" + n + "/comments?per_page=30&page=" + page);
        if (cr.ok) {
          const cs = (await cr.json()).filter(c => ["OWNER", "MEMBER", "COLLABORATOR"].includes(c.author_association));
          if (cs.length) last = cs[cs.length - 1];
          replies = cs.length;
        }
      }
      v = {
        found: true,
        state: d.state === "closed" ? (d.state_reason === "not_planned" ? "wontfix" : "done") : "open",
        comments: d.comments || 0,
        replies,
        reply: last ? clean(last.body, REPLY_MAX).replace(/\s+/g, " ").trim() : "",
        replyAt: last ? last.created_at : ""
      };
    }
  } else if (r.status !== 404) {
    return { found: false, error: "github_" + r.status };
  }
  statusMemo.set(n, { v, until: Date.now() + STATUS_CACHE_SEC * 1000 });
  if (statusMemo.size > 200) statusMemo.clear();
  return v;
}
async function serveStatus(request, env, url) {
  if (!env.GH_TOKEN || !env.GH_OWNER || !env.GH_REPO) return json({ ok: false, error: "not_configured" }, 500);
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  if (!(await hit(env, "s:" + ip, STATUS_LIMIT_PER_HOUR, 3600))) return json({ ok: false, error: "rate_limit" }, 429);
  const list = Array.from(new Set(String(url.searchParams.get("n") || "").split(",").map(x => parseInt(x, 10)).filter(x => x > 0 && x < 10000000))).slice(0, STATUS_MAX);
  if (!list.length) return json({ ok: false, error: "no_numbers" }, 400);
  const items = {};
  for (const n of list) {
    try { items[n] = await issueStatus(env, n); } catch (e) { items[n] = { found: false, error: "failed" }; }
  }
  return json({ ok: true, items });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (request.method === "GET") {
      const u = new URL(request.url);
      if (u.pathname.startsWith("/img/")) return serveImage(env, u.pathname);
      if (u.pathname === "/status") return serveStatus(request, env, u);
      return json({ ok: true, name: "sekigae-feedback-relay", images: !!(env.IMG || env.RATE) });
    }
    if (request.method !== "POST") return json({ ok: false, error: "method" }, 405);
    if (!env.GH_TOKEN || !env.GH_OWNER || !env.GH_REPO) return json({ ok: false, error: "not_configured" }, 500);

    const len = parseInt(request.headers.get("content-length") || "0", 10);
    if (len > MAX_BODY) return json({ ok: false, error: "too_large" }, 413);
    let p;
    try { const raw = await request.text(); if (raw.length > MAX_BODY) return json({ ok: false, error: "too_large" }, 413); p = JSON.parse(raw); } catch (e) { return json({ ok: false, error: "bad_json" }, 400); }
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

    // 画像：うまく保管できなくても、文章の報告は、Issue にします（画像だけ、付かなかったと伝えます）
    let img = { urls: [], note: "", error: "" };
    const wanted = Array.isArray(p.images) ? p.images.filter(x => typeof x === "string") : [];
    if (wanted.length) img = await saveImages(env, new URL(request.url).origin, wanted);
    const issue = buildIssue(p, img.urls, img.note);
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
    return json({ ok: true, number: d.number, url: d.html_url, images: img.urls.length, imageError: img.error || undefined });
  }
};
