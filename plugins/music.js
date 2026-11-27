// ==========================================
// plugins/music.js : 音楽プレーヤー
// 授業中の音楽（BGM）を流します。自分のパソコンの音楽ファイルを追加して、再生・一時停止・前へ・次へ・シャッフル・くり返しができます。
// 追加した曲は、このパソコンのブラウザの中（IndexedDB）に残るので、次に開いた時も、そのまま使えます。
// 曲のファイルに入っている情報（曲名・歌手・アルバム・作曲者・年・ジャンル・表紙）を読み取って、表示します。
// 足りない情報は、Apple の iTunes 検索（曲名と歌手名だけを送ります）で、探すこともできます。
// ==========================================
const MUSIC_DB_NAME = "sekigae_music";
const MUSIC_STORE = "tracks";
const MUSIC_META_STORE = "meta";                 // 曲の情報（曲名・歌手など）と表紙の画像
const MUSIC_GROUP_KEY = "music_group";           // 一覧の分け方：none（そのまま）／album（アルバムごと）／artist（歌手ごと）
const MUSIC_AUTO_KEY = "music_auto_lookup";      // 曲を追加した時に、自動でネットで調べる（1＝する）
const MUSIC_VOL_KEY = "music_volume";
const MUSIC_SHUFFLE_KEY = "music_shuffle";
const MUSIC_REPEAT_KEY = "music_repeat";        // off（くり返さない）／all（全部をくり返す）／one（1曲をくり返す）
const MUSIC_OPEN_KEY = "music_panel_open";
const MUSIC_EXTS = /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|weba|webm|mp4)$/i;
const MUSIC_FADE_MS = 260;
const MUSIC_TAG_MAX = 12 * 1024 * 1024;          // 曲の情報として読む大きさの上限
const MUSIC_COVER_MAX = 6 * 1024 * 1024;         // 表紙の画像の大きさの上限
const MUSIC_LOOKUP_GAP_MS = 3200;                // まとめて調べる時の、1曲ごとの間隔（iTunes は 1分に20回くら今で）

let musicTracks = [];            // { id, name, size, blob, url, meta }  meta は曲の情報。まだ読んでいない時は null
let musicIndex = -1;             // 今流れている（または選ばれている）曲
let musicAudio = null;
let musicDbPromise = null;
let musicHistory = [];           // 「前へ」で戻るための、聞いた順
let musicBag = [];               // シャッフルの時の、これから流す曲の順番
let musicSeeking = false;
let musicFadeTimer = null;
let musicDbOk = true;
let musicEditing = null;         // 曲の情報を直している時の状態
let musicAlb = null;             // アルバムでまとめて調べている時の状態
let musicBatchBusy = false;      // まとめて調べている最中
let musicBatchStop = false;
let musicEnrichRunning = false;
let musicCoverCache = { id: "", blob: null, url: "" };

function musicEsc(t) {
    return String(t).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function musicFmt(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ":" + String(s).padStart(2, "0");
}
function musicGet(key, def) { try { return lsGet(key, def); } catch (e) { return def; } }
function musicSet(key, val) { try { lsSet(key, val); } catch (e) { /* 何もしない */ } }
function musicVolumeBase() {
    const v = parseFloat(musicGet(MUSIC_VOL_KEY, "0.6"));
    return isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.6;
}
// 曲ごとの音量そろえを入れた、実際に鳴らす音量
function musicVolumeFor(t) { return Math.min(1, Math.max(0, musicVolumeBase() * musicNormOf(t))); }
function musicVolume() { return musicVolumeFor(musicTracks[musicIndex]); }
function musicShuffleOn() { return musicGet(MUSIC_SHUFFLE_KEY, "0") === "1"; }
function musicRepeatMode() { const r = musicGet(MUSIC_REPEAT_KEY, "all"); return r === "off" || r === "one" ? r : "all"; }

// ---- 保存（IndexedDB）
function musicOpenDb() {
    if (musicDbPromise) return musicDbPromise;
    musicDbPromise = new Promise(resolve => {
        try {
            if (!window.indexedDB) { resolve(null); return; }
            const req = indexedDB.open(MUSIC_DB_NAME, 3);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(MUSIC_STORE)) db.createObjectStore(MUSIC_STORE, { keyPath: "id" });
                if (!db.objectStoreNames.contains(MUSIC_META_STORE)) db.createObjectStore(MUSIC_META_STORE, { keyPath: "id" });
                if (!db.objectStoreNames.contains("pads")) db.createObjectStore("pads", { keyPath: "id" });   // 取り込んだ効果音
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => resolve(null);
            req.onblocked = () => resolve(null);
        } catch (e) { resolve(null); }
    });
    return musicDbPromise;
}
function musicDbRun(mode, fn) {
    return musicOpenDb().then(db => new Promise(resolve => {
        if (!db) { resolve({ ok: false }); return; }
        try {
            const tx = db.transaction([MUSIC_STORE, MUSIC_META_STORE], mode);
            const r = fn(tx.objectStore(MUSIC_STORE), tx.objectStore(MUSIC_META_STORE));
            tx.oncomplete = () => resolve({ ok: true, result: r && r.result });
            tx.onerror = tx.onabort = () => resolve({ ok: false });
        } catch (e) { resolve({ ok: false }); }
    }));
}

// ---- 曲の情報（タグ）の読み取り：MP3（ID3）・M4A（MP4）・FLAC・Ogg（Vorbis／Opus）・WAV
function musicEmptyMeta() {
    return { title: "", artist: "", album: "", composer: "", year: "", genre: "", track: "", disc: "", cover: null, coverRemote: "", src: "", looked: false };
}
function musicMetaFromRecord(r) {
    const m = musicEmptyMeta();
    ["title", "artist", "album", "composer", "year", "genre", "track", "disc", "coverRemote", "src"].forEach(k => { if (r && typeof r[k] === "string") m[k] = r[k]; });
    if (r && r.cover instanceof Blob) m.cover = r.cover;
    m.looked = !!(r && r.looked);
    if (r && typeof r.loud === "number" && isFinite(r.loud)) m.loud = r.loud;
    if (r && Array.isArray(r.cues)) m.cues = [0, 1, 2, 3].map(i => (r.cues[i] === null || r.cues[i] === undefined || !isFinite(Number(r.cues[i]))) ? null : Number(r.cues[i]));
    return m;
}
function musicHasInfo(m) { return !!(m && (m.title || m.artist || m.album || m.composer)); }
function musicNeedsInfo(m) { return !m || !m.title || !m.artist || !m.album; }
function musicTitle(t) { return (t && t.meta && t.meta.title) || (t ? t.name : ""); }
function musicSubText(t, mode) {
    const m = t && t.meta;
    if (!m) return "";
    if (mode === "album") return m.artist || "";          // アルバムごとの時は、アルバム名が見出しにあるので、歌手だけ
    if (mode === "artist") return m.album || "";
    return [m.artist, m.album].filter(Boolean).join(" ・ ");
}

function musicSlice(file, start, end) { return file.slice(start, end).arrayBuffer(); }
function musicU32(b, o) { return ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0; }
function musicU32le(b, o) { return ((b[o + 3] << 24) | (b[o + 2] << 16) | (b[o + 1] << 8) | b[o]) >>> 0; }
function musicSynch(b, o) { return ((b[o] & 0x7f) << 21) | ((b[o + 1] & 0x7f) << 14) | ((b[o + 2] & 0x7f) << 7) | (b[o + 3] & 0x7f); }
function musicLatin(b, o, n) { let s = ""; for (let i = o; i < o + n && i < b.length; i++) s += String.fromCharCode(b[i]); return s; }
function musicUtf8(b) { try { return new TextDecoder("utf-8").decode(b); } catch (e) { return ""; } }
function musicUnsync(b) {
    const out = new Uint8Array(b.length);
    let n = 0;
    for (let i = 0; i < b.length; i++) { out[n++] = b[i]; if (b[i] === 0xFF && b[i + 1] === 0) i++; }
    return out.subarray(0, n);
}
// 文字の種類：0＝ISO-8859-1（日本の古いファイルは Shift_JIS のことが多い）、1＝UTF-16（BOMあり）、2＝UTF-16BE、3＝UTF-8
function musicDecodeText(bytes, enc) {
    try {
        let s;
        if (enc === 1) {
            if (bytes[0] === 0xFE && bytes[1] === 0xFF) s = new TextDecoder("utf-16be").decode(bytes.subarray(2));
            else if (bytes[0] === 0xFF && bytes[1] === 0xFE) s = new TextDecoder("utf-16le").decode(bytes.subarray(2));
            else s = new TextDecoder("utf-16le").decode(bytes);
        } else if (enc === 2) s = new TextDecoder("utf-16be").decode(bytes);
        else if (enc === 3) s = new TextDecoder("utf-8").decode(bytes);
        else {
            let high = false;
            for (let i = 0; i < bytes.length; i++) if (bytes[i] >= 0x80) { high = true; break; }
            if (!high) s = musicLatin(bytes, 0, bytes.length);
            else {
                s = null;
                try { s = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch (e) { /* 次へ */ }
                if (s === null) { try { s = new TextDecoder("shift_jis", { fatal: true }).decode(bytes); } catch (e) { /* 次へ */ } }
                if (s === null) s = new TextDecoder("windows-1252").decode(bytes);
            }
        }
        return s.split("\u0000").map(x => x.trim()).filter(Boolean).join("、").slice(0, 200);
    } catch (e) { return ""; }
}
function musicNumOf(v) { const m = /^\s*(\d{1,4})/.exec(String(v || "")); return m && Number(m[1]) > 0 ? String(Number(m[1])) : ""; }
function musicYearOf(v) { const m = /\d{4}/.exec(String(v || "")); return m ? m[0] : ""; }
function musicGenreOf(v) { const g = String(v || "").replace(/\(\d+\)/g, "").trim(); return /^\d*$/.test(g) ? "" : g.slice(0, 80); }
function musicImageType(b, fallback) {
    if (b[0] === 0xFF && b[1] === 0xD8) return "image/jpeg";
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47) return "image/png";
    if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return "image/gif";
    if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return "image/webp";
    return /^image\//.test(fallback || "") ? fallback : "";
}
function musicMakeCover(data, mime) {
    if (!data || data.length < 16 || data.length > MUSIC_COVER_MAX) return null;
    const type = musicImageType(data, mime);
    return type ? new Blob([data], { type }) : null;
}
function musicFindTerm(b, from, enc) {
    if (enc === 1 || enc === 2) { for (let i = from; i + 1 < b.length; i += 2) if (b[i] === 0 && b[i + 1] === 0) return i; return -1; }
    for (let i = from; i < b.length; i++) if (b[i] === 0) return i;
    return -1;
}

async function musicParseId3v2(file) {
    const head = new Uint8Array(await musicSlice(file, 0, 10));
    if (musicLatin(head, 0, 3) !== "ID3") return null;
    const ver = head[3], flags = head[5];
    const size = musicSynch(head, 6);
    let buf = new Uint8Array(await musicSlice(file, 10, 10 + Math.min(size, MUSIC_TAG_MAX)));
    if (flags & 0x80) buf = musicUnsync(buf);
    let pos = 0;
    if ((flags & 0x40) && ver >= 3) pos = ver === 3 ? 4 + musicU32(buf, 0) : musicSynch(buf, 0);
    const idLen = ver === 2 ? 3 : 4, hdr = ver === 2 ? 6 : 10;
    const out = {};
    let pic = null, picType = -1;
    while (pos + hdr <= buf.length) {
        if (buf[pos] === 0) break;
        const id = musicLatin(buf, pos, idLen);
        let fsz;
        if (ver === 2) fsz = (buf[pos + 3] << 16) | (buf[pos + 4] << 8) | buf[pos + 5];
        else if (ver === 3) fsz = musicU32(buf, pos + 4);
        else fsz = musicSynch(buf, pos + 4);
        const ff = ver >= 3 ? (buf[pos + 8] << 8) | buf[pos + 9] : 0;
        const start = pos + hdr, end = start + fsz;
        if (fsz <= 0 || end > buf.length) break;
        pos = end;
        let body = buf.subarray(start, end);
        if (ver === 3 && (ff & 0x00C0)) continue;          // 圧縮・暗号化は読まない
        if (ver === 4 && (ff & 0x000C)) continue;
        if (ver === 4 && (ff & 0x0001)) body = body.subarray(4);
        if (ver === 4 && (ff & 0x0002)) body = musicUnsync(body);
        if (!body.length) continue;
        const text = () => musicDecodeText(body.subarray(1), body[0]);
        if (id === "TIT2" || id === "TT2") out.title = text();
        else if (id === "TPE1" || id === "TP1") out.artist = text();
        else if ((id === "TPE2" || id === "TP2") && !out.albumArtist) out.albumArtist = text();
        else if (id === "TALB" || id === "TAL") out.album = text();
        else if (id === "TCOM" || id === "TCM") out.composer = text();
        else if (id === "TDRC" || id === "TYER" || id === "TYE" || id === "TDRL") { if (!out.year) out.year = musicYearOf(text()); }
        else if (id === "TCON" || id === "TCO") out.genre = musicGenreOf(text());
        else if (id === "TRCK" || id === "TRK") out.track = musicNumOf(text());
        else if (id === "TPOS" || id === "TPA") out.disc = musicNumOf(text());
        else if (id === "APIC" || id === "PIC") {
            try {
                const enc = body[0];
                let p = 1, mime = "";
                if (id === "PIC") { mime = "image/" + musicLatin(body, 1, 3).toLowerCase(); p = 4; }
                else { const z = body.indexOf(0, p); if (z < 0) continue; mime = musicLatin(body, p, z - p); p = z + 1; }
                const type = body[p++];
                const z2 = musicFindTerm(body, p, enc);
                if (z2 < 0) continue;
                p = z2 + ((enc === 1 || enc === 2) ? 2 : 1);
                if (pic === null || (type === 3 && picType !== 3)) { pic = { data: body.subarray(p), mime }; picType = type; }
            } catch (e) { /* 次へ */ }
        }
    }
    if (!out.artist && out.albumArtist) out.artist = out.albumArtist;
    out.cover = pic ? musicMakeCover(pic.data, pic.mime) : null;
    return out;
}
async function musicParseId3v1(file) {
    if (file.size < 128) return null;
    const b = new Uint8Array(await musicSlice(file, file.size - 128, file.size));
    if (musicLatin(b, 0, 3) !== "TAG") return null;
    const f = (o, n) => musicDecodeText(b.subarray(o, o + n), 0);
    return { title: f(3, 30), artist: f(33, 30), album: f(63, 30), year: musicYearOf(musicLatin(b, 93, 4)) };
}

function musicMp4Children(b, s, e) {
    const out = [];
    let p = s;
    while (p + 8 <= e) {
        let len = musicU32(b, p), hs = 8;
        const type = musicLatin(b, p + 4, 4);
        if (len === 1) { if (p + 16 > e) break; len = musicU32(b, p + 8) * 4294967296 + musicU32(b, p + 12); hs = 16; }
        else if (len === 0) len = e - p;
        if (len < hs || p + len > e) break;
        out.push({ type, s: p + hs, e: p + len });
        p += len;
    }
    return out;
}
async function musicParseMp4(file) {
    let pos = 0, moov = null;
    for (let guard = 0; guard < 200 && pos + 8 <= file.size; guard++) {
        const h = new Uint8Array(await musicSlice(file, pos, Math.min(pos + 16, file.size)));
        let len = musicU32(h, 0), hs = 8;
        const type = musicLatin(h, 4, 4);
        if (len === 1) { if (h.length < 16) break; len = musicU32(h, 8) * 4294967296 + musicU32(h, 12); hs = 16; }
        else if (len === 0) len = file.size - pos;
        if (len < hs) break;
        if (type === "moov") {
            if (len - hs > MUSIC_TAG_MAX * 2) return null;
            moov = new Uint8Array(await musicSlice(file, pos + hs, pos + len));
            break;
        }
        pos += len;
    }
    if (!moov) return null;
    const find = (list, type) => list.find(x => x.type === type);
    const top = musicMp4Children(moov, 0, moov.length);
    const udta = find(top, "udta");
    let metaBox = udta ? find(musicMp4Children(moov, udta.s, udta.e), "meta") : null;
    if (!metaBox) metaBox = find(top, "meta");
    if (!metaBox) return null;
    const ilst = find(musicMp4Children(moov, metaBox.s + 4, metaBox.e), "ilst");
    if (!ilst) return null;
    const out = {};
    let cover = null;
    musicMp4Children(moov, ilst.s, ilst.e).forEach(item => {
        const d = find(musicMp4Children(moov, item.s, item.e), "data");
        if (!d || d.e - d.s <= 8) return;
        const val = moov.subarray(d.s + 8, d.e);
        const text = () => musicUtf8(val).trim().slice(0, 200);
        if (item.type === "©nam") out.title = text();
        else if (item.type === "©ART") out.artist = text();
        else if (item.type === "aART") out.albumArtist = text();
        else if (item.type === "©alb") out.album = text();
        else if (item.type === "©wrt") out.composer = text();
        else if (item.type === "©day") out.year = musicYearOf(text());
        else if (item.type === "©gen") out.genre = musicGenreOf(text());
        else if (item.type === "trkn" && val.length >= 4) out.track = musicNumOf(val[2] * 256 + val[3]);
        else if (item.type === "disk" && val.length >= 4) out.disc = musicNumOf(val[2] * 256 + val[3]);
        else if (item.type === "covr" && !cover) cover = musicMakeCover(val, "");
    });
    if (!out.artist && out.albumArtist) out.artist = out.albumArtist;
    out.cover = cover;
    return out;
}

function musicFlacPicture(b) {
    try {
        let p = 4;
        const ml = musicU32(b, p); p += 4;
        const mime = musicLatin(b, p, ml); p += ml;
        const dl = musicU32(b, p); p += 4 + dl + 16;
        const len = musicU32(b, p); p += 4;
        if (p + len > b.length) return null;
        return { type: musicU32(b, 0), data: b.subarray(p, p + len), mime };
    } catch (e) { return null; }
}
function musicVorbisComments(b, p) {
    const tags = {}, pics = [];
    try {
        p += 4 + musicU32le(b, p);
        const n = musicU32le(b, p); p += 4;
        for (let i = 0; i < n && p + 4 <= b.length; i++) {
            const l = musicU32le(b, p); p += 4;
            if (p + l > b.length) break;
            const s = musicUtf8(b.subarray(p, p + l)); p += l;
            const eq = s.indexOf("=");
            if (eq < 0) continue;
            const k = s.slice(0, eq).toUpperCase(), v = s.slice(eq + 1);
            if (k === "METADATA_BLOCK_PICTURE") {
                try {
                    const bin = atob(v), u = new Uint8Array(bin.length);
                    for (let j = 0; j < bin.length; j++) u[j] = bin.charCodeAt(j);
                    const pic = musicFlacPicture(u);
                    if (pic) pics.push(pic);
                } catch (e) { /* 次へ */ }
            } else if (!(k in tags)) tags[k] = v;
        }
    } catch (e) { /* 読めた分だけ */ }
    return { tags, pics };
}
function musicFromVorbis(r) {
    const t = r.tags, one = k => String(t[k] || "").trim().slice(0, 200);
    let pic = r.pics.find(x => x.type === 3) || r.pics[0] || null;
    return {
        title: one("TITLE"), artist: one("ARTIST") || one("ALBUMARTIST"), album: one("ALBUM"), composer: one("COMPOSER"),
        year: musicYearOf(t.DATE || t.YEAR), genre: musicGenreOf(t.GENRE),
        track: musicNumOf(t.TRACKNUMBER), disc: musicNumOf(t.DISCNUMBER),
        cover: pic ? musicMakeCover(pic.data, pic.mime) : null
    };
}
async function musicParseFlac(file) {
    let pos = 4, tags = null;
    const pics = [];
    for (let guard = 0; guard < 64 && pos + 4 <= file.size; guard++) {
        const h = new Uint8Array(await musicSlice(file, pos, pos + 4));
        const last = h[0] & 0x80, type = h[0] & 0x7f, len = (h[1] << 16) | (h[2] << 8) | h[3];
        if (type === 4 && len <= MUSIC_TAG_MAX) {
            const r = musicVorbisComments(new Uint8Array(await musicSlice(file, pos + 4, pos + 4 + len)), 0);
            tags = r.tags; r.pics.forEach(x => pics.push(x));
        } else if (type === 6 && len <= MUSIC_TAG_MAX) {
            const pic = musicFlacPicture(new Uint8Array(await musicSlice(file, pos + 4, pos + 4 + len)));
            if (pic) pics.push(pic);
        }
        pos += 4 + len;
        if (last) break;
    }
    return tags || pics.length ? musicFromVorbis({ tags: tags || {}, pics }) : null;
}
async function musicParseOgg(file) {
    const b = new Uint8Array(await musicSlice(file, 0, Math.min(file.size, MUSIC_TAG_MAX)));
    const packets = [];
    let cur = [], p = 0;
    const join = chunks => { let n = 0; chunks.forEach(c => { n += c.length; }); const o = new Uint8Array(n); let q = 0; chunks.forEach(c => { o.set(c, q); q += c.length; }); return o; };
    outer: while (p + 27 <= b.length && musicLatin(b, p, 4) === "OggS") {
        const nseg = b[p + 26];
        if (p + 27 + nseg > b.length) break;
        let dp = p + 27 + nseg;
        for (let i = 0; i < nseg; i++) {
            const l = b[p + 27 + i];
            cur.push(b.subarray(dp, dp + l)); dp += l;
            if (l < 255) { packets.push(join(cur)); cur = []; if (packets.length >= 2) break outer; }
        }
        p = dp;
    }
    if (packets.length < 2 && cur.length) packets.push(join(cur));
    const pk = packets[1];
    if (!pk) return null;
    let off = -1;
    if (pk[0] === 3 && musicLatin(pk, 1, 6) === "vorbis") off = 7;
    else if (musicLatin(pk, 0, 8) === "OpusTags") off = 8;
    return off < 0 ? null : musicFromVorbis(musicVorbisComments(pk, off));
}
async function musicParseWav(file) {
    let pos = 12;
    const out = {};
    for (let guard = 0; guard < 64 && pos + 8 <= file.size; guard++) {
        const h = new Uint8Array(await musicSlice(file, pos, Math.min(pos + 12, file.size)));
        const id = musicLatin(h, 0, 4), len = musicU32le(h, 4);
        if (id === "LIST" && musicLatin(h, 8, 4) === "INFO") {
            const lb = new Uint8Array(await musicSlice(file, pos + 12, pos + 8 + Math.min(len, 65536)));
            let q = 0;
            while (q + 8 <= lb.length) {
                const sid = musicLatin(lb, q, 4), sl = musicU32le(lb, q + 4);
                const v = musicDecodeText(lb.subarray(q + 8, q + 8 + sl), 0);
                if (sid === "INAM") out.title = v; else if (sid === "IART") out.artist = v; else if (sid === "IPRD") out.album = v;
                else if (sid === "ICRD") out.year = musicYearOf(v); else if (sid === "IGNR") out.genre = musicGenreOf(v); else if (sid === "ITRK") out.track = musicNumOf(v);
                q += 8 + sl + (sl & 1);
            }
        }
        pos += 8 + len + (len & 1);
    }
    return out.title || out.artist || out.album ? out : null;
}
// ファイルの先頭の目印で、種類を見分けて読みます。読めなければ空の情報を返します。
async function musicReadTags(file) {
    const m = musicEmptyMeta();
    try {
        const head = new Uint8Array(await musicSlice(file, 0, 12));
        const s4 = musicLatin(head, 0, 4);
        let r = null, other = false;
        if (s4.slice(0, 3) === "ID3") r = await musicParseId3v2(file);
        else if (s4 === "fLaC") { other = true; r = await musicParseFlac(file); }
        else if (s4 === "OggS") { other = true; r = await musicParseOgg(file); }
        else if (musicLatin(head, 4, 4) === "ftyp") { other = true; r = await musicParseMp4(file); }
        else if (s4 === "RIFF") { other = true; r = await musicParseWav(file); }
        if (!other && !(r && r.title)) {
            const v1 = await musicParseId3v1(file);
            if (v1) r = Object.assign({}, v1, r ? Object.fromEntries(Object.entries(r).filter(([, v]) => v)) : {});
        }
        if (r) ["title", "artist", "album", "composer", "year", "genre", "track", "disc"].forEach(k => { if (typeof r[k] === "string") m[k] = r[k].trim(); });
        if (r && r.cover instanceof Blob) m.cover = r.cover;
    } catch (e) { /* 読めない時は、ファイル名だけで使います */ }
    if (musicHasInfo(m)) m.src = "tag";
    return m;
}
function musicMetaRecord(t) { return Object.assign({ id: t.id }, t.meta); }
function musicSaveMeta(t) {
    if (!t || !t.meta) return Promise.resolve();
    return musicDbRun("readwrite", (st, ms) => ms.put(musicMetaRecord(t)));
}
// まだ曲の情報を読んでいない曲を、順番に読む
async function musicEnrichPending() {
    if (musicEnrichRunning) return;
    musicEnrichRunning = true;
    try {
        let n = 0;
        for (const t of musicTracks.slice()) {
            if (t.meta) continue;
            t.meta = await musicReadTags(t.blob);
            if (musicTracks.includes(t)) await musicSaveMeta(t);
            if (++n % 4 === 0) { musicRenderList(); musicRenderNow(); }
        }
    } finally {
        musicEnrichRunning = false;
        musicRefreshAll();
    }
}

// ---- 曲の追加・削除
function musicIsAudioFile(f) {
    return f && ((f.type && f.type.indexOf("audio/") === 0) || MUSIC_EXTS.test(f.name || ""));
}
function musicTrackName(f) { return String(f.name || "曲").replace(/\.[^.]+$/, ""); }
async function musicAddFiles(fileList) {
    const files = Array.from(fileList || []).filter(musicIsAudioFile).sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, "ja", { numeric: true }));
    if (!files.length) { showToast("音楽のファイルが見つかりませんでした", "error"); return; }
    let added = 0, saveFailed = false;
    const newOnes = [];
    const wasEmpty = musicTracks.length === 0;
    for (const f of files) {
        if (musicTracks.some(t => t.name === musicTrackName(f) && t.size === f.size)) continue;
        const t = { id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name: musicTrackName(f), size: f.size, blob: f, url: "", order: Date.now() + added, meta: null };
        musicTracks.push(t);
        newOnes.push(t);
        added++;
        const res = await musicDbRun("readwrite", st => st.put({ id: t.id, name: t.name, size: t.size, blob: t.blob, order: t.order }));
        if (!res.ok) saveFailed = true;
    }
    musicRenderList();
    if (wasEmpty && musicTracks.length && musicIndex < 0) { musicIndex = 0; musicRenderNow(); }
    if (added === 0) showToast("すでに入っている曲でした", "info");
    else if (saveFailed) showToast(`${added}曲を追加しました。このパソコンには保存できなかったので、今回だけ使えます。`, "info");
    else showToast(`${added}曲を追加しました`, "success");
    if (added) {
        await musicEnrichPending();
        musicNormAnalyzeAll();
        if (musicAutoLookupOn()) musicLookupBatch(newOnes, true);
    }
}
function musicRemove(i) {
    const t = musicTracks[i];
    if (!t) return;
    const playing = i === musicIndex;
    if (t.url) { try { URL.revokeObjectURL(t.url); } catch (e) { /* 何もしない */ } }
    musicDbRun("readwrite", (st, ms) => { st.delete(t.id); ms.delete(t.id); });
    musicPlForgetTrack(t.id);
    musicTracks.splice(i, 1);
    musicHistory = musicHistory.filter(x => x !== i).map(x => x > i ? x - 1 : x);
    musicBag = musicBag.filter(x => x !== i).map(x => x > i ? x - 1 : x);
    if (playing) {
        musicStopNow();
        musicIndex = musicTracks.length ? Math.min(i, musicTracks.length - 1) : -1;
    } else if (i < musicIndex) musicIndex--;
    musicRenderList();
    musicRenderNow();
}
function musicClearAll() {
    if (!musicTracks.length) return;
    if (!confirm("追加した曲を全て消します。よろしいですか？")) return;
    musicStopNow();
    musicTracks.forEach(t => { if (t.url) { try { URL.revokeObjectURL(t.url); } catch (e) { /* 何もしない */ } } });
    musicTracks = [];
    musicIndex = -1; musicHistory = []; musicBag = [];
    musicDbRun("readwrite", (st, ms) => { st.clear(); ms.clear(); });
    musicPlSave(musicPlLoad().map(p => Object.assign({}, p, { ids: [] })));
    musicRenderList();
    musicRenderNow();
    showToast("曲を全て消しました", "success");
}

// ---- 再生
function musicFade(to, ms, done) {
    if (!musicAudio) return;
    if (musicFadeTimer) { clearInterval(musicFadeTimer); musicFadeTimer = null; }
    const from = musicAudio.volume;
    if (ms <= 0 || Math.abs(from - to) < 0.01) { musicAudio.volume = to; if (done) done(); return; }
    const t0 = performance.now();
    musicFadeTimer = setInterval(() => {
        const u = Math.min(1, (performance.now() - t0) / ms);
        try { musicAudio.volume = Math.min(1, Math.max(0, from + (to - from) * u)); } catch (e) { /* 何もしない */ }
        if (u >= 1) { clearInterval(musicFadeTimer); musicFadeTimer = null; if (done) done(); }
    }, 30);
}
function musicStopNow() {
    musicCancelXfade(); musicClearSpin(); musicLoopClear();
    if (musicFadeTimer) { clearInterval(musicFadeTimer); musicFadeTimer = null; }
    if (musicAudio) {
        try { musicAudio.pause(); } catch (e) { /* 何もしない */ }
        musicAudio.removeAttribute("src");
        try { musicAudio.load(); } catch (e) { /* 何もしない */ }
        musicAudio.volume = musicVolume();
    }
    musicUpdateUi();
}
function musicPlayIndex(i) {
    const t = musicTracks[i];
    if (!t || !musicAudio) return;
    musicCancelXfade(); musicClearSpin(); musicLoopClear();
    if (musicEqOn()) musicEngineEnsure(); else musicEngineResume();
    if (musicIndex >= 0 && musicIndex !== i && musicTracks[musicIndex] && musicTracks[musicIndex].url) {
        try { URL.revokeObjectURL(musicTracks[musicIndex].url); } catch (e) { /* 何もしない */ }
        musicTracks[musicIndex].url = "";
    }
    musicIndex = i;
    if (!t.url) t.url = URL.createObjectURL(t.blob);
    musicAudio.src = t.url;
    musicAudio.volume = 0;
    const p = musicAudio.play();
    const ok = () => { musicFade(musicVolume(), MUSIC_FADE_MS); musicUpdateUi(); musicMediaSession(); };
    if (p && p.then) p.then(ok).catch(err => {
        musicUpdateUi();
        if (err && err.name === "AbortError") return;      // すぐに別の曲へ切り替えた時は、エラーにしない
        if (err && err.name === "NotAllowedError") showToast("再生できませんでした。もう一度、再生ボタンを押してください。", "error");
        else showToast(`「${t.name}」を再生できませんでした`, "error");
    }); else ok();
    musicRenderList();
    musicRenderNow();
}
function musicRefillBag() {
    const ids = musicQueue().filter(i => i !== musicIndex);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
    musicBag = ids;
}
// 次に流す曲の番号。止まる時は -1
function musicNextIndex(autoEnded) {
    const q = musicQueue(), n = q.length;
    if (!n) return -1;
    if (musicShuffleOn() && n > 1) {
        if (!musicBag.length) {
            if (autoEnded && musicRepeatMode() === "off") return -1;
            musicRefillBag();
        }
        return musicBag.length ? musicBag.shift() : -1;
    }
    const pos = q.indexOf(musicIndex);
    if (pos < 0) return q[0];
    if (pos + 1 >= n) {
        if (autoEnded && musicRepeatMode() === "off") return -1;
        return q[0];
    }
    return q[pos + 1];
}
function musicNext(autoEnded) {
    const j = musicNextIndex(autoEnded);
    if (j < 0) { musicStopNow(); musicRenderNow(); return; }
    if (musicIndex >= 0) musicHistory.push(musicIndex);
    if (musicHistory.length > 200) musicHistory.shift();
    musicPlayIndex(j);
}
function musicPrev() {
    const q = musicQueue();
    if (!q.length) return;
    if (musicAudio && musicAudio.currentTime > 3) { musicAudio.currentTime = 0; return; }
    let j;
    if (musicHistory.length) j = musicHistory.pop();
    else {
        const pos = q.indexOf(musicIndex);
        j = musicShuffleOn() ? musicIndex : (pos > 0 ? q[pos - 1] : q[q.length - 1]);
    }
    if (j < 0 || j >= musicTracks.length) j = 0;
    musicPlayIndex(j);
}
function musicIsPlaying() { return !!(musicAudio && musicAudio.src && !musicAudio.paused && !musicAudio.ended); }
function musicToggle() {
    if (!musicTracks.length) { showToast("まず、「曲を追加」から、音楽のファイルを入れてください", "info"); return; }
    if (musicIsPlaying()) {
        musicFade(0, MUSIC_FADE_MS, () => { try { musicAudio.pause(); } catch (e) { /* 何もしない */ } musicAudio.volume = musicVolume(); musicUpdateUi(); });
        return;
    }
    musicClearSpin();
    if (musicEqOn()) musicEngineEnsure(); else musicEngineResume();
    if (musicAudio.src && musicIndex >= 0 && !musicAudio.ended) {
        musicAudio.volume = 0;
        const p = musicAudio.play();
        const ok = () => { musicFade(musicVolume(), MUSIC_FADE_MS); musicUpdateUi(); };
        if (p && p.then) p.then(ok).catch(() => musicUpdateUi()); else ok();
        return;
    }
    const q = musicQueue();
    if (!q.length) { showToast("この場面には曲が入っていません。「✎ この場面を直す」で入れてください。", "info"); return; }
    musicPlayIndex(q.includes(musicIndex) ? musicIndex : q[0]);
}
function musicOnEnded() {
    if (musicRepeatMode() === "one") { musicAudio.currentTime = 0; musicAudio.play().catch(() => {}); return; }
    musicNext(true);
}
function musicToggleShuffle() {
    musicSet(MUSIC_SHUFFLE_KEY, musicShuffleOn() ? "0" : "1");
    musicBag = [];
    musicUpdateUi();
}
function musicCycleRepeat() {
    const order = ["all", "one", "off"];
    musicSet(MUSIC_REPEAT_KEY, order[(order.indexOf(musicRepeatMode()) + 1) % order.length]);
    musicUpdateUi();
}
function musicMediaSession() {
    try {
        if (!("mediaSession" in navigator) || !musicTracks[musicIndex]) return;
        const t = musicTracks[musicIndex], cover = musicCoverSrc(t);
        const md = { title: musicTitle(t), artist: (t.meta && t.meta.artist) || "席替えし太郎", album: (t.meta && t.meta.album) || "" };
        if (cover) md.artwork = [{ src: cover, sizes: "300x300" }];
        navigator.mediaSession.metadata = new MediaMetadata(md);
        navigator.mediaSession.setActionHandler("play", () => { if (!musicIsPlaying()) musicToggle(); });
        navigator.mediaSession.setActionHandler("pause", () => { if (musicIsPlaying()) musicToggle(); });
        navigator.mediaSession.setActionHandler("previoustrack", () => musicPrev());
        navigator.mediaSession.setActionHandler("nexttrack", () => musicNext(false));
    } catch (e) { /* 何もしない */ }
}

// ---- ネットで調べる（Apple の iTunes 検索。曲名と歌手名だけを送ります。曲のファイルは送りません）
function musicOffline() { const c = $id("offlineModeToggle"); return !!(c && c.checked); }
function musicAutoLookupOn() { return musicGet(MUSIC_AUTO_KEY, "0") === "1"; }
function musicSleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function musicWithTimeout(p, ms) { return Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]); }
function musicNorm(s) {
    return String(s || "").normalize("NFKC").toLowerCase().replace(/[\s"'`~!@#$%^&*()_+\-=[\]{};:,.<>/?\\|・、。「」『』【】〜～…]/g, "");
}
// ファイル名から、曲名と歌手名を推測する。例：「01 YOASOBI - 夜に駆ける」
function musicGuessFromName(name) {
    let s = String(name || "").replace(/_/g, " ").replace(/^\s*\d{1,3}\s*[-.)\s]+\s*/, "").trim();
    const m = /^(.+?)\s+[-－―]\s+(.+)$/.exec(s);
    if (m) return { artist: m[1].trim(), title: m[2].trim() };
    return { artist: "", title: s };
}
function musicItunesGet(path, params) {
    const qs = Object.keys(params).map(k => k + "=" + encodeURIComponent(params[k])).join("&");
    const url = "https://itunes.apple.com/" + path + "?" + qs + "&country=JP&lang=ja_jp";
    const viaFetch = () => fetch(url, { cache: "no-store" }).then(r => {
        if (!r.ok) { const e = new Error("http " + r.status); e.status = r.status; throw e; }
        return r.json();
    });
    // ブラウザの制限で fetch が通らない時は、スクリプト読み込み方式（JSONP）で、もう一度試します
    const viaJsonp = () => new Promise((resolve, reject) => {
        const cb = "musicJsonp" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        const s = document.createElement("script");
        const clean = () => { try { delete window[cb]; } catch (e) { window[cb] = undefined; } s.remove(); clearTimeout(tm); };
        const tm = setTimeout(() => { clean(); reject(new Error("timeout")); }, 10000);
        window[cb] = d => { clean(); resolve(d); };
        s.onerror = () => { clean(); reject(new Error("jsonp")); };
        s.src = url + "&callback=" + cb;
        document.head.appendChild(s);
    });
    return musicWithTimeout(viaFetch(), 9000)
        .catch(e => (e && e.status) ? Promise.reject(e) : viaJsonp())
        .then(d => (d && Array.isArray(d.results)) ? d.results : []);
}
function musicBigCover(u) { return u ? String(u).replace(/\d+x\d+bb/, "300x300bb") : ""; }
function musicItunesSearch(term) {
    return musicItunesGet("search", { term, media: "music", entity: "song", limit: 8 })
        .then(list => list.filter(r => r && r.trackName).map(r => ({
            title: String(r.trackName || ""), artist: String(r.artistName || ""), album: String(r.collectionName || ""),
            year: musicYearOf(r.releaseDate), genre: String(r.primaryGenreName || ""),
            track: musicNumOf(r.trackNumber), disc: musicNumOf(r.discNumber),
            thumb: r.artworkUrl100 || "", cover: musicBigCover(r.artworkUrl100)
        })));
}
// アルバムを探す
function musicItunesAlbums(term) {
    return musicItunesGet("search", { term, media: "music", entity: "album", limit: 8 })
        .then(list => list.filter(r => r && r.collectionId && r.collectionName).map(r => ({
            id: String(r.collectionId), name: String(r.collectionName), artist: String(r.artistName || ""),
            year: musicYearOf(r.releaseDate), genre: String(r.primaryGenreName || ""), count: Number(r.trackCount) || 0,
            thumb: r.artworkUrl100 || "", cover: musicBigCover(r.artworkUrl100)
        })));
}
// アルバムに入っている曲の一覧
function musicItunesAlbumSongs(id) {
    return musicItunesGet("lookup", { id, entity: "song", limit: 200 })
        .then(list => list.filter(r => r && r.trackName && (r.wrapperType === "track" || r.kind === "song")).map(r => ({
            title: String(r.trackName), artist: String(r.artistName || ""), track: Number(r.trackNumber) || 0, disc: Number(r.discNumber) || 1
        })).sort((a, b) => a.disc - b.disc || a.track - b.track));
}
async function musicFetchCover(url) {
    if (!url) return null;
    try {
        const r = await musicWithTimeout(fetch(url), 8000);
        if (!r.ok) return null;
        const b = await r.blob();
        return b && b.size > 16 && b.size <= MUSIC_COVER_MAX ? b : null;
    } catch (e) { return null; }
}
function musicBuildQuery(title, artist, fileName) {
    const g = musicGuessFromName(fileName);
    const ti = title || g.title, ar = artist || (title ? "" : g.artist);
    return ((ar ? ar + " " : "") + ti).trim();
}
function musicMatches(c, title, artist) {
    const tn = musicNorm(c.title), want = musicNorm(title);
    if (tn.length < 1 || want.length < 1) return false;
    if (!(tn === want || (want.length >= 2 && tn.includes(want)) || (tn.length >= 2 && want.includes(tn)))) return false;
    const an = musicNorm(artist);
    if (!an) return true;
    const ca = musicNorm(c.artist);
    return !!ca && (ca.includes(an) || an.includes(ca));
}
// 1曲を調べて、空いている所だけ埋める。戻り値：found／none／limit／error
async function musicLookupOne(t) {
    if (!t.meta) t.meta = await musicReadTags(t.blob);
    const m = t.meta, g = musicGuessFromName(t.name);
    const title = m.title || g.title, artist = m.artist || g.artist;
    let cands;
    try {
        cands = await musicItunesSearch(musicBuildQuery(m.title, m.artist, t.name));
        if (!cands.length && artist && !m.title) cands = await musicItunesSearch(title);
    } catch (e) {
        return e && (e.status === 403 || e.status === 429) ? "limit" : "error";
    }
    const pick = cands.find(c => musicMatches(c, title, artist));
    if (!musicTracks.includes(t)) return "none";
    if (!pick) { m.looked = true; await musicSaveMeta(t); return "none"; }
    ["title", "artist", "album", "year", "genre", "track", "disc"].forEach(k => { if (!m[k]) m[k] = pick[k]; });
    if (!m.cover && !m.coverRemote && pick.cover) {
        const b = await musicFetchCover(pick.cover);
        if (b) m.cover = b; else m.coverRemote = pick.cover;
    }
    if (!m.src) m.src = "online";
    m.looked = true;
    if (musicTracks.includes(t)) await musicSaveMeta(t);
    return "found";
}
function musicSetStatus(text) { const e = $id("musicStatus"); if (e) e.textContent = text || ""; }
function musicUpdateBatchBtn() {
    const b = $id("musicBatchBtn");
    if (!b) return;
    b.textContent = musicBatchBusy ? "⏹ 調べるのを止める" : "まとめて調べる";
}
async function musicLookupBatch(list, auto) {
    if (musicBatchBusy) { musicBatchStop = true; return; }
    if (musicOffline()) { if (!auto) showToast("オフラインモードの間は、ネットで調べられません", "info"); return; }
    const targets = list.filter(t => t.meta && !t.meta.looked && musicNeedsInfo(t.meta));
    if (!targets.length) { if (!auto) showToast("調べる曲はありません。曲の情報はそろっています。", "info"); return; }
    musicBatchBusy = true; musicBatchStop = false; musicUpdateBatchBtn();
    let found = 0, none = 0, fail = "";
    for (let k = 0; k < targets.length; k++) {
        if (musicBatchStop) break;
        musicSetStatus(`ネットで調べています… ${k + 1} / ${targets.length}`);
        const r = await musicLookupOne(targets[k]);
        if (r === "found") found++; else if (r === "none") none++; else { fail = r; break; }
        musicRenderList(); musicRenderNow(); musicMediaSession();
        if (k < targets.length - 1 && !musicBatchStop) await musicSleep(MUSIC_LOOKUP_GAP_MS);
    }
    const stopped = musicBatchStop;
    musicBatchBusy = false; musicBatchStop = false; musicUpdateBatchBtn();
    musicRefreshAll();
    let msg;
    if (fail === "limit") msg = `調べすぎでしばらく止められました。少し待ってから、もう一度やってください。見つかった曲：${found}`;
    else if (fail) msg = `ネットにつながらず、途中で止まりました。見つかった曲：${found}`;
    else if (stopped) msg = `止めました。見つかった曲：${found}`;
    else msg = `調べ終わりました。見つかった曲：${found}、見つからなかった曲：${none}`;
    musicSetStatus(msg);
    if (!auto || found || fail) showToast(msg, fail ? "error" : "success");
}

// ---- 一覧の分け方（そのまま／アルバムごと／歌手ごと）
function musicGroupMode() { const g = musicGet(MUSIC_GROUP_KEY, "none"); return g === "album" || g === "artist" ? g : "none"; }
function musicGroupInfo(t, mode) {
    const m = (t && t.meta) || {};
    const name = mode === "album" ? (m.album || "") : (m.artist || "");
    return { name, unknown: !name, key: name || "\u0000", label: name || (mode === "album" ? "アルバムが分からない曲" : "歌手が分からない曲") };
}
function musicOrderNum(m, k, def) { const n = Number(m && m[k]); return n > 0 ? n : def; }
// 分け方に合わせて、曲の並びを入れ替える（再生の順番も、この並びです）。いま流れている曲は、そのままです。
function musicApplyOrder() {
    const mode = musicGroupMode();
    const old = musicTracks.slice();
    const base = (a, b) => (a.order || 0) - (b.order || 0);
    const sorted = old.slice().sort((a, b) => {
        if (mode === "none") return base(a, b);
        const ga = musicGroupInfo(a, mode), gb = musicGroupInfo(b, mode);
        if (ga.unknown !== gb.unknown) return ga.unknown ? 1 : -1;
        const c = ga.name.localeCompare(gb.name, "ja", { numeric: true });
        if (c) return c;
        if (mode === "artist") {
            const al = String((a.meta && a.meta.album) || "").localeCompare(String((b.meta && b.meta.album) || ""), "ja", { numeric: true });
            if (al) return al;
        }
        const d = musicOrderNum(a.meta, "disc", 1) - musicOrderNum(b.meta, "disc", 1);
        if (d) return d;
        const n = musicOrderNum(a.meta, "track", 9999) - musicOrderNum(b.meta, "track", 9999);
        return n || base(a, b);
    });
    if (sorted.every((t, i) => t === old[i])) return;
    const newIdx = new Map(sorted.map((t, i) => [t, i]));
    const remap = list => list.map(i => newIdx.get(old[i])).filter(i => i !== undefined);
    const cur = old[musicIndex];
    musicTracks = sorted;
    musicIndex = cur ? newIdx.get(cur) : musicIndex;
    musicHistory = remap(musicHistory);
    musicBag = remap(musicBag);
}
function musicRefreshAll() { musicApplyOrder(); musicRenderList(); musicRenderNow(); musicMediaSession(); }

// ---- アルバムでまとめて調べる
function musicShowView(name) {
    const tab = name === "main" || name === "eq" || name === "dj" || name === "pad" || name === "link" ? name : null;
    if (tab) musicTab = tab;
    [["musicMain", !!tab], ["musicEdit", name === "edit"], ["musicAlbum", name === "album"], ["musicPlEdit", name === "pl"], ["musicPadEdit", name === "padedit"]].forEach(([id, on]) => { const e = $id(id); if (e) e.hidden = !on; });
    if (!tab) return;
    [["musicLibrary", "main"], ["musicEqView", "eq"], ["musicDjView", "dj"], ["musicPadView", "pad"], ["musicLinkView", "link"]].forEach(([id, k]) => { const e = $id(id); if (e) e.hidden = k !== tab; });
    document.querySelectorAll("#musicTabs [data-tab]").forEach(b => { const on = b.dataset.tab === tab; b.classList.toggle("is-sel", on); b.setAttribute("aria-selected", String(on)); });
    if (tab === "link") musicLinkRefreshOptions();
    if (tab === "pad") { musicPadRender(); musicPadPrepare(); }
    if (tab === "eq" || tab === "dj") { musicEngineEnsure(); musicEqRefreshUi(); musicCuesRefreshUi(); musicLoopUpdateUi(); musicSpecStart(); }
}
function musicTrackNumberOf(t) {
    const n = Number(t.meta && t.meta.track);
    if (n > 0) return n;
    const m = /^\s*(\d{1,3})(?!\d)/.exec(t.name || "");
    return m ? Number(m[1]) : 0;
}
function musicAlbumMatch(tracks, songs) {
    const used = new Set(), res = new Map();
    const titleOf = t => musicNorm((t.meta && t.meta.title) || musicGuessFromName(t.name).title);
    tracks.forEach(t => {
        const tn = titleOf(t);
        if (!tn) return;
        const s = songs.find(x => {
            if (used.has(x)) return false;
            const sn = musicNorm(x.title);
            if (sn === tn) return true;
            const lo = Math.min(sn.length, tn.length), hi = Math.max(sn.length, tn.length);
            return lo >= 2 && lo / hi >= 0.5 && (sn.includes(tn) || tn.includes(sn));
        });
        if (s) { used.add(s); res.set(t.id, s); }
    });
    tracks.forEach(t => {
        if (res.has(t.id)) return;
        const n = musicTrackNumberOf(t), d = musicOrderNum(t.meta, "disc", 1);
        if (!n) return;
        const s = songs.find(x => !used.has(x) && x.track === n && x.disc === d);
        if (s) { used.add(s); res.set(t.id, s); }
    });
    return res;
}
function musicAlbumSeedQuery(tracks) {
    const withAlbum = tracks.find(t => t.meta && t.meta.album);
    if (withAlbum) return (withAlbum.meta.album + " " + (withAlbum.meta.artist || "")).trim();
    const withArtist = tracks.find(t => t.meta && t.meta.artist);
    if (withArtist) return withArtist.meta.artist;
    const g = tracks.length ? musicGuessFromName(tracks[0].name) : { artist: "" };
    return g.artist || "";
}
function musicAlbRenderTargets() {
    const box = $id("musicAlbTargets");
    if (!box || !musicAlb) return;
    const a = musicAlb;
    box.innerHTML = musicTracks.filter(t => a.initial.includes(t.id) || a.match.has(t.id)).map(t => {
        const s = a.match.get(t.id);
        const arrow = a.album ? (s ? `→ ${musicEsc((s.track ? s.track + ". " : "") + s.title)}` : "→ 合う曲が見つかりません") : "";
        return `<label class="music-alb-row${a.album && !s ? " is-none" : ""}"><input type="checkbox" data-id="${musicEsc(t.id)}"${a.checked.has(t.id) ? " checked" : ""}${a.album && !s ? " disabled" : ""}><span class="music-alb-text"><span class="music-alb-name">${musicEsc(musicTitle(t))}</span>${arrow ? `<small>${arrow}</small>` : ""}</span></label>`;
    }).join("");
    const btn = $id("musicAlbApply");
    if (btn) btn.disabled = !(a.album && [...a.checked].some(id => a.match.has(id)));
}
function musicOpenAlbum(targets, seed) {
    musicAlb = { checked: new Set(targets.map(t => t.id)), initial: targets.map(t => t.id), album: null, songs: [], match: new Map(), cover: null };
    $id("musicAlbQ").value = seed || "";
    $id("musicAlbMsg").textContent = "アルバム名や歌手名で探してください";
    $id("musicAlbCands").innerHTML = "";
    $id("musicAlbSel").textContent = "";
    $id("musicAlbOverwrite").checked = false;
    musicAlbRenderTargets();
    musicShowView("album");
    try { $id("musicAlbQ").focus(); } catch (e) { /* 何もしない */ }
}
function musicCloseAlbum() { musicAlb = null; musicShowView(musicTab); }
async function musicAlbSearch() {
    if (!musicAlb) return;
    const msg = $id("musicAlbMsg"), box = $id("musicAlbCands");
    if (musicOffline()) { msg.textContent = "オフラインモードの間は、ネットで調べられません。設定でオンラインモードにしてください。"; return; }
    const q = $id("musicAlbQ").value.trim();
    if (!q) { msg.textContent = "アルバム名か歌手名を入れてください"; return; }
    const btn = $id("musicAlbSearchBtn");
    btn.disabled = true; msg.textContent = "ネットで調べています…"; box.innerHTML = "";
    try {
        const list = await musicItunesAlbums(q);
        if (!musicAlb) return;
        if (!list.length) { msg.textContent = "見つかりませんでした。アルバム名や歌手名を直して、もう一度調べてみてください。"; return; }
        msg.textContent = "このアルバムだ、と思うものを選んでください";
        box.innerHTML = list.map((c, k) => `<button type="button" class="music-cand" data-k="${k}"><span class="music-cand-img">${c.thumb ? `<img src="${musicEsc(c.thumb)}" alt="" loading="lazy">` : "💿"}</span><span class="music-cand-text"><b>${musicEsc(c.name)}</b><small>${musicEsc(c.artist)}${c.year ? " ・ " + musicEsc(c.year) : ""}${c.count ? " ・ " + c.count + "曲" : ""}</small></span></button>`).join("");
        box._cands = list;
    } catch (e) {
        msg.textContent = e && (e.status === 403 || e.status === 429) ? "調べすぎでしばらく使えません。少し待ってから、もう一度やってください。" : "ネットにつながりませんでした。つながってから、もう一度やってください。";
    } finally { btn.disabled = false; }
}
async function musicAlbPick(k) {
    const box = $id("musicAlbCands"), c = box && box._cands && box._cands[k];
    if (!c || !musicAlb) return;
    const a = musicAlb, msg = $id("musicAlbMsg");
    msg.textContent = "アルバムの曲を取り寄せています…";
    let songs;
    try { songs = await musicItunesAlbumSongs(c.id); } catch (e) { msg.textContent = "ネットにつながりませんでした。もう一度やってください。"; return; }
    if (musicAlb !== a) return;
    if (!songs.length) { msg.textContent = "このアルバムの曲が取れませんでした。他のアルバムを選んでください。"; return; }
    a.album = c; a.songs = songs; a.cover = null;
    const first = a.initial.map(id => musicTracks.find(t => t.id === id)).filter(Boolean);
    const rest = musicTracks.filter(t => !a.initial.includes(t.id));
    a.match = musicAlbumMatch(first.concat(rest), songs);
    a.checked = new Set(a.initial.filter(id => a.match.has(id)));
    $id("musicAlbSel").textContent = `選んだアルバム：${c.name}（${c.artist}）　${songs.length}曲`;
    const hit = a.checked.size;
    msg.textContent = `${first.length}曲のうち、${hit}曲がアルバムの曲と合いました。入れる曲にチェックを付けて、「入れる」を押してください。`;
    musicAlbRenderTargets();
    const b = await musicFetchCover(c.cover);
    if (musicAlb === a && a.album === c) a.cover = b;
}
async function musicAlbApply() {
    const a = musicAlb;
    if (!a || !a.album) return;
    const over = $id("musicAlbOverwrite").checked;
    let n = 0;
    for (const t of musicTracks.slice()) {
        if (!a.checked.has(t.id)) continue;
        const s = a.match.get(t.id);
        if (!s) continue;
        const m = t.meta || (t.meta = musicEmptyMeta());
        const set = (key, v) => { if (v && (over || !m[key])) m[key] = String(v); };
        set("title", s.title); set("artist", s.artist || a.album.artist); set("album", a.album.name);
        set("year", a.album.year); set("genre", a.album.genre);
        if (s.track) { set("track", s.track); set("disc", s.disc); }
        if (over || (!m.cover && !m.coverRemote)) {
            if (a.cover) { m.cover = a.cover; m.coverRemote = ""; }
            else if (a.album.cover) { m.cover = null; m.coverRemote = a.album.cover; }
        }
        if (!m.src) m.src = "online";
        m.looked = true;
        await musicSaveMeta(t);
        n++;
    }
    const skipped = a.initial.filter(id => !a.checked.has(id) || !a.match.has(id)).length;
    musicCloseAlbum();
    musicRefreshAll();
    showToast(n ? `${n}曲にアルバムの情報を入れました。${skipped ? "（入れなかった曲：" + skipped + "）" : ""}` : "入れる曲がありませんでした。", n ? "success" : "info");
}

// ---- 曲の情報を見る・直す画面
const MUSIC_FIELDS = [["title", "musicFTitle"], ["artist", "musicFArtist"], ["album", "musicFAlbum"], ["composer", "musicFComposer"], ["year", "musicFYear"], ["genre", "musicFGenre"]];
function musicEditShow(open) {
    musicShowView(open ? "edit" : musicTab);
    if (!open) musicEditing = null;
}
function musicEditCoverRender() {
    const box = $id("musicEditCover");
    if (!box || !musicEditing) return;
    let src = "";
    if (musicEditing.cover) { if (musicEditing.coverUrl) URL.revokeObjectURL(musicEditing.coverUrl); musicEditing.coverUrl = URL.createObjectURL(musicEditing.cover); src = musicEditing.coverUrl; }
    else src = musicEditing.coverRemote || "";
    box.textContent = "♪";
    if (src) {
        const im = new Image();
        im.alt = "";
        im.onload = () => { if (musicEditing) { box.textContent = ""; box.appendChild(im); } };
        im.src = src;
    }
}
function musicOpenEdit(i) {
    const t = musicTracks[i];
    if (!t) return;
    const m = t.meta || musicEmptyMeta();
    musicEditing = { id: t.id, cover: m.cover || null, coverRemote: m.coverRemote || "", coverUrl: "", looked: m.looked };
    MUSIC_FIELDS.forEach(([k, id]) => { const e = $id(id); if (e) e.value = m[k] || ""; });
    $id("musicEditFile").textContent = "ファイル：" + t.name;
    $id("musicCands").innerHTML = "";
    $id("musicEditMsg").textContent = "";
    const sb = $id("musicSearchBtn");
    if (sb) sb.disabled = false;
    musicEditShow(true);
    musicEditCoverRender();
    try { $id("musicFTitle").focus(); } catch (e) { /* 何もしない */ }
}
function musicCloseEdit() {
    if (musicEditing && musicEditing.coverUrl) { try { URL.revokeObjectURL(musicEditing.coverUrl); } catch (e) { /* 何もしない */ } }
    musicEditShow(false);
}
async function musicEditSave() {
    if (!musicEditing) return;
    const t = musicTracks.find(x => x.id === musicEditing.id);
    if (!t) { musicCloseEdit(); return; }
    const m = t.meta || musicEmptyMeta();
    MUSIC_FIELDS.forEach(([k, id]) => { const e = $id(id); m[k] = e ? e.value.trim().slice(0, 200) : ""; });
    m.year = musicYearOf(m.year);
    m.cover = musicEditing.cover || null;
    m.coverRemote = musicEditing.cover ? "" : (musicEditing.coverRemote || "");
    if (musicEditing.track) { m.track = musicEditing.track; if (musicEditing.disc) m.disc = musicEditing.disc; }
    m.src = "manual"; m.looked = true;
    t.meta = m;
    await musicSaveMeta(t);
    musicCloseEdit();
    musicRefreshAll();
    showToast("曲の情報を保存しました", "success");
}
async function musicEditSearch() {
    if (!musicEditing) return;
    const msg = $id("musicEditMsg"), box = $id("musicCands");
    const t = musicTracks.find(x => x.id === musicEditing.id);
    if (musicOffline()) { msg.textContent = "オフラインモードの間は、ネットで調べられません。設定でオンラインモードにしてください。"; return; }
    const q = musicBuildQuery($id("musicFTitle").value.trim(), $id("musicFArtist").value.trim(), t ? t.name : "");
    if (!q) { msg.textContent = "曲名か歌手名を入れてください"; return; }
    const sb = $id("musicSearchBtn");
    sb.disabled = true; msg.textContent = "ネットで調べています…"; box.innerHTML = "";
    try {
        const list = await musicItunesSearch(q);
        if (!musicEditing) return;
        if (!list.length) { msg.textContent = "見つかりませんでした。曲名や歌手名を直して、もう一度調べてみてください。"; return; }
        msg.textContent = "これだ、と思うものを選んでください";
        box.innerHTML = list.map((c, k) => `<button type="button" class="music-cand" data-k="${k}"><span class="music-cand-img">${c.thumb ? `<img src="${musicEsc(c.thumb)}" alt="" loading="lazy">` : "♪"}</span><span class="music-cand-text"><b>${musicEsc(c.title)}</b><small>${musicEsc([c.artist, c.album].filter(Boolean).join(" ・ "))}${c.year ? "（" + musicEsc(c.year) + "）" : ""}</small></span></button>`).join("");
        box._cands = list;
    } catch (e) {
        msg.textContent = e && (e.status === 403 || e.status === 429) ? "調べすぎでしばらく使えません。少し待ってから、もう一度やってください。" : "ネットにつながりませんでした。つながってから、もう一度やってください。";
    } finally { sb.disabled = false; }
}
async function musicPickCandidate(k) {
    const box = $id("musicCands"), c = box && box._cands && box._cands[k];
    if (!c || !musicEditing) return;
    const set = (id, v) => { const e = $id(id); if (e && v) e.value = v; };
    set("musicFTitle", c.title); set("musicFArtist", c.artist); set("musicFAlbum", c.album); set("musicFYear", c.year); set("musicFGenre", c.genre);
    musicEditing.coverRemote = c.cover || "";
    musicEditing.cover = null;
    musicEditing.track = c.track || ""; musicEditing.disc = c.disc || "";
    musicEditCoverRender();
    $id("musicEditMsg").textContent = "入れました。よければ「保存」を押してください。作曲者は検索では出ないので分かる時は直接入れてください。";
    const id = musicEditing.id;
    const b = await musicFetchCover(c.cover);
    if (b && musicEditing && musicEditing.id === id && musicEditing.coverRemote === c.cover) { musicEditing.cover = b; musicEditCoverRender(); }
}

// ---- エフェクト：イコライザー・DJ（Web Audio）
const MUSIC_EQ_ON_KEY = "music_eq_on";
const MUSIC_EQ_GAINS_KEY = "music_eq_gains";     // 10本の音の高さごとの上げ下げ（dB）をカンマでつないだもの
const MUSIC_EQ_PRE_KEY = "music_eq_pre";         // 全体の音量（dB）
const MUSIC_XFADE_KEY = "music_xfade";           // 曲のつなぎ目を重ねる秒数（0＝重ねない）
const MUSIC_EQ_FREQS = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
const MUSIC_EQ_LABELS = ["32", "64", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"];
const MUSIC_EQ_PRESETS = [
    ["flat", "フラット（そのまま）", [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]],
    ["bass", "低い音を強く", [6, 5, 4, 2, 0, 0, 0, 0, 0, 0]],
    ["treble", "高い音を強く", [0, 0, 0, 0, 0, 1, 2, 4, 5, 6]],
    ["voice", "声をはっきり", [-2, -2, -1, 1, 3, 4, 3, 1, 0, -1]],
    ["class", "教室向け（にぎやかでも聞こえる）", [-3, -2, 0, 1, 2, 3, 3, 2, 1, 0]],
    ["loud", "小さい音でも聞きやすく", [6, 4, 1, 0, -1, 0, -1, 0, 3, 5]],
    ["pop", "ポップ", [-1, 1, 3, 4, 3, 0, -1, -1, 1, 2]],
    ["rock", "ロック", [5, 4, 2, -1, -2, -1, 2, 3, 4, 4]],
    ["jazz", "ジャズ", [3, 2, 1, 2, -2, -2, 0, 1, 2, 3]],
    ["classic", "クラシック", [0, 0, 0, 0, 0, 0, -3, -3, -3, -4]]
];
let musicDecks = [];             // 音を鳴らす入れ物が2つ。曲のつなぎ目を重ねる時に、交代で使います
let musicEngine = null;          // Web Audio の部品
let musicEngineFailed = false;
let musicTab = "main";           // main（曲）／eq（イコライザー）／dj
let musicXfading = null;         // 重ねている最中の状態
let musicLoop = { a: null, b: null, on: false, timer: null };
let musicSpinTimer = null;
let musicSpecRaf = 0;
let musicSpeed = 1;              // 再生の速さ（1＝普通）
let musicKeepPitch = true;       // 速さを変えても、音の高さを変えない
let musicEchoOn = false;
let musicDuckTimer = null;
let musicNoiseBuf = null;

function musicEqOn() { return musicGet(MUSIC_EQ_ON_KEY, "0") === "1"; }
function musicEqGains() {
    const a = String(musicGet(MUSIC_EQ_GAINS_KEY, "")).split(",");
    return MUSIC_EQ_FREQS.map((_, i) => { const v = a[i] === undefined || a[i] === "" ? 0 : Number(a[i]); return isFinite(v) ? Math.max(-12, Math.min(12, Math.round(v))) : 0; });
}
function musicEqPre() { const v = Number(musicGet(MUSIC_EQ_PRE_KEY, "0")); return isFinite(v) ? Math.max(-12, Math.min(12, Math.round(v))) : 0; }
function musicXfadeSec() { const v = Number(musicGet(MUSIC_XFADE_KEY, "0")); return isFinite(v) ? Math.max(0, Math.min(12, Math.round(v))) : 0; }
function musicDb(db) { return Math.pow(10, db / 20); }

// ---- 音の通り道（最初に使う時に作ります。使わない間は、ふつうに鳴らします）
function musicEngineResume() {
    if (musicEngine && musicEngine.ctx.state === "suspended") { try { musicEngine.ctx.resume().catch(() => {}); } catch (e) { /* 何もしない */ } }
}
function musicEngineEnsure() {
    if (musicEngine) { musicEngineResume(); return musicEngine; }
    if (musicEngineFailed) return null;
    try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC || musicDecks.length < 2) throw new Error("no audio");
        const ctx = new AC();
        const mix = ctx.createGain();
        const pre = ctx.createGain();
        const last = MUSIC_EQ_FREQS.length - 1;
        const filters = MUSIC_EQ_FREQS.map((f, i) => {
            const b = ctx.createBiquadFilter();
            b.type = i === 0 ? "lowshelf" : (i === last ? "highshelf" : "peaking");
            b.frequency.value = f; b.Q.value = 1.1; b.gain.value = 0;
            return b;
        });
        const dj = ctx.createBiquadFilter(); dj.type = "allpass";
        const dry = ctx.createGain();
        const delay = ctx.createDelay(1.5); delay.delayTime.value = 0.36;
        const fb = ctx.createGain(); fb.gain.value = 0.42;
        const wet = ctx.createGain(); wet.gain.value = 0;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -8; comp.knee.value = 12; comp.ratio.value = 6; comp.attack.value = 0.004; comp.release.value = 0.25;
        const master = ctx.createGain();
        const analyser = ctx.createAnalyser(); analyser.fftSize = 128; analyser.smoothingTimeConstant = 0.8; analyser.minDecibels = -85; analyser.maxDecibels = -5;
        musicDecks.forEach(d => { ctx.createMediaElementSource(d).connect(mix); });
        mix.connect(pre);
        let node = pre;
        filters.forEach(f => { node.connect(f); node = f; });
        node.connect(dj);
        dj.connect(dry); dry.connect(comp);
        dj.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(comp);
        comp.connect(master); master.connect(analyser); analyser.connect(ctx.destination);
        musicEngine = { ctx, mix, pre, filters, dj, wet, delay, comp, master, analyser };
        musicEngineApplyEq();
        musicEngineApplyEcho();
        musicEngineResume();
        return musicEngine;
    } catch (e) {
        musicEngineFailed = true; musicEngine = null;
        return null;
    }
}
function musicEngineApplyEq() {
    const e = musicEngine;
    if (!e) return;
    const on = musicEqOn(), g = musicEqGains(), t = e.ctx.currentTime;
    e.filters.forEach((f, i) => f.gain.setTargetAtTime(on ? g[i] : 0, t, 0.03));
    e.pre.gain.setTargetAtTime(on ? musicDb(musicEqPre()) : 1, t, 0.03);
}
function musicEqPresetOf(gains) {
    const p = MUSIC_EQ_PRESETS.find(x => x[2].every((v, i) => v === gains[i]));
    return p ? p[0] : "custom";
}
function musicEqRefreshUi() {
    const g = musicEqGains();
    document.querySelectorAll("#musicEqView .music-eq-slider").forEach(s => {
        const i = Number(s.dataset.band);
        s.value = String(g[i]);
        const d = $id("musicEqDb" + i);
        if (d) d.textContent = (g[i] > 0 ? "+" : "") + g[i];
    });
    const on = $id("musicEqOn"); if (on) on.checked = musicEqOn();
    const sel = $id("musicEqPreset"); if (sel) sel.value = musicEqPresetOf(g);
    const pre = $id("musicEqPre"); if (pre) pre.value = String(musicEqPre());
    const pv = $id("musicEqPreVal"); if (pv) pv.textContent = (musicEqPre() > 0 ? "+" : "") + musicEqPre() + " dB";
    const tab = document.querySelector('#musicTabs [data-tab="eq"]');
    if (tab) tab.classList.toggle("is-fx-on", musicEqOn());
}
function musicEqChanged() { musicEngineApplyEq(); musicEqRefreshUi(); }
function musicSetEqOn(on) {
    musicSet(MUSIC_EQ_ON_KEY, on ? "1" : "0");
    if (on) musicEngineEnsure();
    musicEqChanged();
}
function musicSetBand(i, v) {
    const g = musicEqGains();
    g[i] = Math.max(-12, Math.min(12, Math.round(Number(v) || 0)));
    musicSet(MUSIC_EQ_GAINS_KEY, g.join(","));
    if (!musicEqOn()) { musicSet(MUSIC_EQ_ON_KEY, "1"); musicEngineEnsure(); }
    musicEqChanged();
}
function musicApplyPreset(id) {
    const p = MUSIC_EQ_PRESETS.find(x => x[0] === id);
    if (!p) return;
    musicSet(MUSIC_EQ_GAINS_KEY, p[2].join(","));
    if (!musicEqOn() && id !== "flat") { musicSet(MUSIC_EQ_ON_KEY, "1"); }
    if (musicEqOn()) musicEngineEnsure();
    musicEqChanged();
}
function musicSetPre(v) {
    musicSet(MUSIC_EQ_PRE_KEY, String(Math.max(-12, Math.min(12, Math.round(Number(v) || 0)))));
    if (!musicEqOn()) { musicSet(MUSIC_EQ_ON_KEY, "1"); musicEngineEnsure(); }
    musicEqChanged();
}
function musicEqReset() { musicSet(MUSIC_EQ_GAINS_KEY, ""); musicSet(MUSIC_EQ_PRE_KEY, "0"); musicEqChanged(); }

// ---- スペクトラム（音の高さごとの大きさを、棒で見せる）
function musicSpecStart() {
    if (musicSpecRaf) return;
    const draw = () => {
        musicSpecRaf = 0;
        const panel = $id("musicPanel");
        if (!panel || panel.hidden || (musicTab !== "eq" && musicTab !== "dj")) return;
        document.querySelectorAll("#musicPanel .music-spec").forEach(cv => {
            if (!cv.offsetParent) return;
            const c = cv.getContext("2d"), w = cv.width, h = cv.height;
            c.clearRect(0, 0, w, h);
            const e = musicEngine;
            if (!e) return;
            const buf = new Uint8Array(e.analyser.frequencyBinCount);
            e.analyser.getByteFrequencyData(buf);
            const n = 32, bw = w / n;
            c.fillStyle = getComputedStyle(cv).color || "#3b82f6";
            for (let i = 0; i < n; i++) {
                const v = buf[Math.min(buf.length - 1, Math.floor(i * buf.length / n * 0.8))] / 255;
                const bh = Math.max(2, v * h);
                c.fillRect(i * bw + 1, h - bh, bw - 2, bh);
            }
        });
        musicSpecRaf = requestAnimationFrame(draw);
    };
    musicSpecRaf = requestAnimationFrame(draw);
}

// ---- 曲の切り替えを重ねる（クロスフェード）
function musicMaybeCrossfade() {
    const sec = musicXfadeSec();
    if (!sec || musicXfading || !musicAudio || !musicIsPlaying() || musicRepeatMode() === "one" || musicLoop.on) return;
    const d = musicAudio.duration, c = musicAudio.currentTime;
    if (!isFinite(d) || d < sec * 2 + 1) return;
    const remain = (d - c) / (musicAudio.playbackRate || 1);
    if (remain > sec) return;
    const j = musicNextIndex(true);
    if (j < 0) return;
    musicCrossfadeTo(j, Math.min(sec * 1000, remain * 1000 - 200));
}
function musicCrossfadeTo(j, ms) {
    const t = musicTracks[j];
    if (!t || musicXfading) return;
    const from = musicAudio, to = musicDecks.find(d => d !== from);
    if (!to) return;
    ms = Math.max(300, ms);
    const oldTrack = musicTracks[musicIndex];
    if (!t.url) t.url = URL.createObjectURL(t.blob);
    to.src = t.url;
    to.volume = 0;
    const x = { from, to, track: t, oldTrack, timer: null };
    const v = musicVolumeFor(t), fromVol = from.volume;
    const abort = () => { if (musicXfading === x) musicCancelXfade(); };
    const p = to.play();
    if (p && p.catch) p.catch(abort);
    musicXfading = x;
    const t0 = performance.now();
    x.timer = setInterval(() => {
        const u = Math.min(1, (performance.now() - t0) / ms);
        try { from.volume = Math.max(0, fromVol * Math.cos(u * Math.PI / 2)); to.volume = Math.min(1, v * Math.sin(u * Math.PI / 2)); } catch (e) { /* 何もしない */ }
        if (u < 1) return;
        clearInterval(x.timer);
        const ni = musicTracks.indexOf(t), oi = musicTracks.indexOf(oldTrack);
        if (musicXfading !== x) return;
        if (ni < 0) { musicCancelXfade(); return; }
        try { from.pause(); } catch (e) { /* 何もしない */ }
        from.removeAttribute("src");
        try { from.load(); } catch (e) { /* 何もしない */ }
        if (oldTrack && oldTrack.url && oldTrack !== t) { try { URL.revokeObjectURL(oldTrack.url); } catch (e) { /* 何もしない */ } oldTrack.url = ""; }
        if (oi >= 0) musicHistory.push(oi);
        if (musicHistory.length > 200) musicHistory.shift();
        musicAudio = to;
        musicIndex = ni;
        to.volume = v; from.volume = v;
        musicXfading = null;
        musicLoopClear();
        musicRenderList(); musicRenderNow(); musicUpdateUi(); musicUpdateTime(); musicMediaSession();
    }, 30);
}
function musicCancelXfade() {
    const x = musicXfading;
    if (!x) return;
    clearInterval(x.timer);
    musicXfading = null;
    try { x.to.pause(); } catch (e) { /* 何もしない */ }
    x.to.removeAttribute("src");
    try { x.to.load(); } catch (e) { /* 何もしない */ }
    if (x.track && x.track !== musicTracks[musicIndex] && x.track.url) { try { URL.revokeObjectURL(x.track.url); } catch (e) { /* 何もしない */ } x.track.url = ""; }
    try { x.from.volume = musicVolume(); } catch (e) { /* 何もしない */ }
}

// ---- DJ：速さ
function musicApplyRate(d) {
    d.defaultPlaybackRate = musicSpeed;
    d.playbackRate = musicSpeed;
    d.preservesPitch = musicKeepPitch;
    d.webkitPreservesPitch = musicKeepPitch;
}
function musicSetSpeed(pct) {
    musicSpeed = Math.max(0.5, Math.min(1.5, Number(pct) / 100 || 1));
    musicDecks.forEach(musicApplyRate);
    const v = $id("musicSpeedVal"); if (v) v.textContent = "×" + musicSpeed.toFixed(2);
    const s = $id("musicSpeed"); if (s && Number(s.value) !== Math.round(musicSpeed * 100)) s.value = String(Math.round(musicSpeed * 100));
}
// ---- DJ：フィルター（左：低い音だけ、右：高い音だけ）
function musicSetDjFilter(v) {
    v = Math.max(-100, Math.min(100, Number(v) || 0));
    const e = musicEngineEnsure();
    const lab = $id("musicDjFilterVal");
    if (lab) lab.textContent = Math.abs(v) < 4 ? "なし" : (v < 0 ? "低い音だけ " + Math.abs(Math.round(v)) : "高い音だけ " + Math.round(v));
    if (!e) return;
    const t = e.ctx.currentTime;
    if (Math.abs(v) < 4) { e.dj.type = "allpass"; return; }
    if (v < 0) { e.dj.type = "lowpass"; e.dj.Q.setTargetAtTime(2.2, t, 0.02); e.dj.frequency.setTargetAtTime(20000 * Math.pow(0.01, Math.abs(v) / 100), t, 0.03); }
    else { e.dj.type = "highpass"; e.dj.Q.setTargetAtTime(2.2, t, 0.02); e.dj.frequency.setTargetAtTime(20 * Math.pow(250, v / 100), t, 0.03); }
}
// ---- DJ：エコー
function musicEngineApplyEcho() {
    const e = musicEngine;
    if (!e) return;
    const amt = Number(($id("musicEchoAmt") || {}).value);
    e.wet.gain.setTargetAtTime(musicEchoOn ? (isFinite(amt) ? amt : 50) / 100 * 0.9 : 0, e.ctx.currentTime, 0.04);
}
function musicSetEcho(on) {
    musicEchoOn = !!on;
    if (musicEchoOn) musicEngineEnsure();
    musicEngineApplyEcho();
    const b = $id("musicEchoBtn");
    if (b) { b.classList.toggle("is-on", musicEchoOn); b.setAttribute("aria-pressed", String(musicEchoOn)); b.textContent = musicEchoOn ? "エコー：オン" : "エコー：オフ"; }
}
// ---- DJ：レコードを止める・回し始める
function musicClearSpin() {
    if (!musicSpinTimer) return;
    clearInterval(musicSpinTimer); musicSpinTimer = null;
    if (musicAudio) { musicApplyRate(musicAudio); try { musicAudio.volume = musicVolume(); } catch (e) { /* 何もしない */ } }
}
function musicSpinStop() {
    if (!musicAudio || !musicIsPlaying()) return;
    musicClearSpin();
    const a = musicAudio, r0 = a.playbackRate, v0 = musicVolume(), t0 = performance.now(), ms = 1300;
    a.preservesPitch = false; a.webkitPreservesPitch = false;
    musicSpinTimer = setInterval(() => {
        const u = Math.min(1, (performance.now() - t0) / ms);
        try { a.playbackRate = Math.max(0.0625, r0 * Math.pow(1 - u, 1.6)); a.volume = v0 * (1 - 0.7 * u); } catch (e) { /* 何もしない */ }
        if (u < 1) return;
        clearInterval(musicSpinTimer); musicSpinTimer = null;
        try { a.pause(); } catch (e) { /* 何もしない */ }
        musicApplyRate(a); a.volume = v0;
        musicUpdateUi();
    }, 30);
}
function musicSpinStart() {
    if (!musicTracks.length) { showToast("まず、曲を追加してください", "info"); return; }
    if (!musicAudio.src || musicIndex < 0) { musicToggle(); return; }
    if (musicIsPlaying()) return;
    musicClearSpin();
    const a = musicAudio, v0 = musicVolume(), target = musicSpeed;
    a.preservesPitch = false; a.webkitPreservesPitch = false;
    a.playbackRate = 0.0625; a.volume = v0;
    const p = a.play();
    const run = () => {
        const t0 = performance.now(), ms = 900;
        musicSpinTimer = setInterval(() => {
            const u = Math.min(1, (performance.now() - t0) / ms);
            try { a.playbackRate = Math.max(0.0625, 0.0625 + (target - 0.0625) * Math.pow(u, 0.6)); } catch (e) { /* 何もしない */ }
            if (u < 1) return;
            clearInterval(musicSpinTimer); musicSpinTimer = null;
            musicApplyRate(a); musicUpdateUi();
        }, 30);
        musicUpdateUi();
    };
    if (p && p.then) p.then(run).catch(() => { musicApplyRate(a); musicUpdateUi(); }); else run();
}
// ---- DJ：ループ
function musicLoopUpdateUi() {
    const e = $id("musicLoopInfo");
    if (e) e.textContent = musicLoop.on ? `ループ中：${musicFmt(musicLoop.a)} → ${musicFmt(musicLoop.b)}` : (musicLoop.a !== null ? `IN：${musicFmt(musicLoop.a)}（OUT を押してください）` : "ループはしていません。");
    const o = $id("musicLoopClear"); if (o) o.disabled = !musicLoop.on && musicLoop.a === null;
}
function musicLoopStartTimer() {
    if (musicLoop.timer) return;
    musicLoop.timer = setInterval(() => {
        if (!musicLoop.on || !musicAudio) return;
        if (!musicAudio.paused && musicAudio.currentTime >= musicLoop.b) { try { musicAudio.currentTime = musicLoop.a; } catch (e) { /* 何もしない */ } }
    }, 40);
}
function musicLoopClear() {
    musicLoop.a = null; musicLoop.b = null; musicLoop.on = false;
    if (musicLoop.timer) { clearInterval(musicLoop.timer); musicLoop.timer = null; }
    musicLoopUpdateUi();
}
function musicLoopIn() {
    if (!musicAudio || !musicAudio.src) return;
    musicLoop.a = musicAudio.currentTime; musicLoop.b = null; musicLoop.on = false;
    musicLoopUpdateUi();
}
function musicLoopOut() {
    if (!musicAudio || !musicAudio.src || musicLoop.a === null) return;
    const b = musicAudio.currentTime;
    if (b < musicLoop.a + 0.2) { showToast("OUT は、IN より、あとの場所にしてください", "info"); return; }
    musicLoop.b = b; musicLoop.on = true;
    musicLoopStartTimer(); musicLoopUpdateUi();
}
function musicLoopSeconds(sec) {
    if (!musicAudio || !musicAudio.src) return;
    const a = musicAudio.currentTime, d = musicAudio.duration;
    musicLoop.a = a; musicLoop.b = isFinite(d) ? Math.min(d - 0.05, a + sec) : a + sec;
    if (musicLoop.b < a + 0.2) { musicLoop.a = null; musicLoop.b = null; musicLoopUpdateUi(); return; }
    musicLoop.on = true;
    musicLoopStartTimer(); musicLoopUpdateUi();
}
// ---- DJ：キュー（曲の中の、すぐ戻れる目印）
function musicCuesOf(t) { return (t && t.meta && Array.isArray(t.meta.cues)) ? t.meta.cues : [null, null, null, null]; }
function musicCuesRefreshUi() {
    const t = musicTracks[musicIndex], cues = musicCuesOf(t);
    document.querySelectorAll("#musicDjView .music-cue").forEach(b => {
        const c = cues[Number(b.dataset.cue)];
        b.classList.toggle("is-set", c !== null && c !== undefined);
        b.textContent = (Number(b.dataset.cue) + 1) + "：" + (c === null || c === undefined ? "－" : musicFmt(c));
    });
}
function musicCue(n, clear) {
    const t = musicTracks[musicIndex];
    if (!t || !musicAudio || !musicAudio.src) { showToast("曲を選んで再生してから使ってください", "info"); return; }
    if (!t.meta) t.meta = musicEmptyMeta();
    const cues = musicCuesOf(t).slice();
    while (cues.length < 4) cues.push(null);
    if (clear) { cues[n] = null; t.meta.cues = cues; musicSaveMeta(t); musicCuesRefreshUi(); return; }
    if (cues[n] === null || cues[n] === undefined) { cues[n] = Math.round(musicAudio.currentTime * 10) / 10; t.meta.cues = cues; musicSaveMeta(t); musicCuesRefreshUi(); return; }
    try { musicAudio.currentTime = cues[n]; } catch (e) { /* 何もしない */ }
    if (!musicIsPlaying()) musicToggle();
}
// ---- DJ：効果音パッド（その場で作った音を鳴らします。音のファイルは使いません）
function musicNoise(ctx) {
    if (!musicNoiseBuf || musicNoiseBuf.sampleRate !== ctx.sampleRate) {
        const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        musicNoiseBuf = b;
    }
    return musicNoiseBuf;
}
function musicPadTone(ctx, o) {
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = o.type; osc.frequency.setValueAtTime(o.f0, o.t);
    if (o.f1) osc.frequency.exponentialRampToValueAtTime(o.f1, o.t + o.dur);
    if (o.detune) osc.detune.value = o.detune;
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.exponentialRampToValueAtTime(o.vol, o.t + (o.attack || 0.012));
    g.gain.setValueAtTime(o.vol, o.t + Math.max(0.02, o.dur * (o.hold === undefined ? 0.6 : o.hold)));
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(o.t); osc.stop(o.t + o.dur + 0.05);
}
function musicPadNoise(ctx, o) {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = musicNoise(ctx);
    f.type = o.type || "highpass"; f.frequency.value = o.freq || 3000; f.Q.value = o.q || 0.7;
    g.gain.setValueAtTime(0.0001, o.t);
    g.gain.exponentialRampToValueAtTime(o.vol, o.t + (o.attack || 0.004));
    g.gain.exponentialRampToValueAtTime(0.0001, o.t + o.dur);
    src.connect(f); f.connect(g); g.connect(ctx.destination);
    src.start(o.t, Math.random()); src.stop(o.t + o.dur + 0.05);
}
const MUSIC_PADS = {
    fanfare: { sec: 1.6, play(ctx, t) {
        [[523.25, 0, 0.16], [659.25, 0.17, 0.16], [783.99, 0.34, 0.16], [1046.5, 0.52, 1.0]].forEach(([f, d, len]) => {
            musicPadTone(ctx, { type: "sawtooth", f0: f, t: t + d, dur: len, vol: 0.2 });
            musicPadTone(ctx, { type: "square", f0: f / 2, t: t + d, dur: len, vol: 0.1 });
        });
    } },
    drumroll: { sec: 2.8, play(ctx, t) {
        const n = 56;
        for (let i = 0; i < n; i++) musicPadNoise(ctx, { t: t + i * 0.036, dur: 0.05, vol: 0.12 + 0.4 * (i / n), type: "bandpass", freq: 220 + i * 6, q: 0.8 });
        const end = t + n * 0.036 + 0.1;
        musicPadNoise(ctx, { t: end, dur: 1.4, vol: 0.5, type: "highpass", freq: 5200, attack: 0.002 });
        musicPadTone(ctx, { type: "sine", f0: 140, f1: 40, t: end, dur: 0.5, vol: 0.7, attack: 0.002, hold: 0.1 });
    } },
    horn: { sec: 1.6, play(ctx, t) {
        [[0, 0.22], [0.3, 0.22], [0.6, 0.8]].forEach(([d, len]) => {
            musicPadTone(ctx, { type: "sawtooth", f0: 329.6, t: t + d, dur: len, vol: 0.28, attack: 0.02 });
            musicPadTone(ctx, { type: "sawtooth", f0: 329.6, detune: 25, t: t + d, dur: len, vol: 0.2, attack: 0.02 });
            musicPadTone(ctx, { type: "square", f0: 164.8, t: t + d, dur: len, vol: 0.12, attack: 0.02 });
        });
    } },
    siren: { sec: 4.2, play(ctx, t) {
        const osc = ctx.createOscillator(), g = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(700, t);
        for (let k = 0; k < 4; k++) { osc.frequency.linearRampToValueAtTime(1300, t + k + 0.5); osc.frequency.linearRampToValueAtTime(700, t + k + 1); }
        g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.05);
        g.gain.setValueAtTime(0.3, t + 3.8); g.gain.exponentialRampToValueAtTime(0.0001, t + 4.1);
        osc.connect(g); g.connect(ctx.destination); osc.start(t); osc.stop(t + 4.2);
    } },
    laser: { sec: 0.9, play(ctx, t) {
        [0, 0.24, 0.48].forEach(d => musicPadTone(ctx, { type: "sawtooth", f0: 2600, f1: 140, t: t + d, dur: 0.22, vol: 0.22, attack: 0.004, hold: 0.2 }));
    } },
    clap: { sec: 1.6, play(ctx, t) {
        for (let i = 0; i < 18; i++) {
            const d = i < 4 ? i * 0.05 : 0.2 + Math.random() * 1.0;
            musicPadNoise(ctx, { t: t + d, dur: 0.07 + Math.random() * 0.04, vol: 0.28 + Math.random() * 0.15, type: "bandpass", freq: 1500 + Math.random() * 1200, q: 1.2, attack: 0.002 });
        }
    } }
};
function musicPad(kind) {
    const p = MUSIC_PADS[kind];
    const e = musicEngineEnsure();
    if (!p || !e) { if (!e) showToast("この ブラウザでは、効果音を鳴らせませんでした", "error"); return; }
    try { p.play(e.ctx, e.ctx.currentTime + 0.02); } catch (err) { return; }
    // 効果音の間は、音楽を小さくする
    const t = e.ctx.currentTime;
    e.mix.gain.cancelScheduledValues(t);
    e.mix.gain.setTargetAtTime(0.3, t, 0.04);
    if (musicDuckTimer) clearTimeout(musicDuckTimer);
    musicDuckTimer = setTimeout(() => { musicDuckTimer = null; if (musicEngine) musicEngine.mix.gain.setTargetAtTime(musicPadDuckWanted() ? 0.3 : 1, musicEngine.ctx.currentTime, 0.35); }, p.sec * 1000);
}

// ---- 画面の切り替え（曲／イコライザー／DJ）と、操作の取り付け
function musicFxBind() {
    $id("musicTabs").addEventListener("click", e => {
        const b = e.target.closest("[data-tab]");
        if (b) musicShowView(b.dataset.tab);
    });
    $id("musicEqOn").addEventListener("change", e => musicSetEqOn(e.target.checked));
    $id("musicEqPreset").addEventListener("change", e => { if (e.target.value !== "custom") musicApplyPreset(e.target.value); });
    $id("musicEqView").addEventListener("input", e => {
        const s = e.target.closest(".music-eq-slider");
        if (s) musicSetBand(Number(s.dataset.band), s.value);
    });
    $id("musicEqPre").addEventListener("input", e => musicSetPre(e.target.value));
    $id("musicEqReset").addEventListener("click", musicEqReset);
    const speed = $id("musicSpeed");
    speed.addEventListener("input", () => musicSetSpeed(Number(speed.value)));
    $id("musicSpeedReset").addEventListener("click", () => musicSetSpeed(100));
    $id("musicKeepPitch").addEventListener("change", e => { musicKeepPitch = e.target.checked; musicDecks.forEach(musicApplyRate); });
    const flt = $id("musicDjFilter");
    flt.addEventListener("input", () => musicSetDjFilter(Number(flt.value)));
    $id("musicDjFilterReset").addEventListener("click", () => { flt.value = "0"; musicSetDjFilter(0); });
    flt.addEventListener("dblclick", () => { flt.value = "0"; musicSetDjFilter(0); });
    $id("musicEchoBtn").addEventListener("click", () => musicSetEcho(!musicEchoOn));
    $id("musicEchoAmt").addEventListener("input", () => { if (musicEngine) musicEngineApplyEcho(); });
    $id("musicSpinStop").addEventListener("click", musicSpinStop);
    $id("musicSpinStart").addEventListener("click", musicSpinStart);
    $id("musicLoopIn").addEventListener("click", musicLoopIn);
    $id("musicLoopOut").addEventListener("click", musicLoopOut);
    $id("musicLoop4").addEventListener("click", () => musicLoopSeconds(4));
    $id("musicLoopClear").addEventListener("click", musicLoopClear);
    $id("musicDjView").addEventListener("click", e => {
        const c = e.target.closest(".music-cue");
        if (c) { musicCue(Number(c.dataset.cue), e.shiftKey); return; }
        const p = e.target.closest(".music-pad");
        if (p) musicPad(p.dataset.pad);
    });
    $id("musicDjView").addEventListener("contextmenu", e => {
        const c = e.target.closest(".music-cue");
        if (c) { e.preventDefault(); musicCue(Number(c.dataset.cue), true); }
    });
    $id("musicToStart").addEventListener("click", () => { if (musicAudio && musicAudio.src) { try { musicAudio.currentTime = 0; } catch (e) { /* 何もしない */ } } });
    const xf = $id("musicXfade");
    xf.value = String(musicXfadeSec());
    const xfLabel = () => { const v = Number(xf.value); $id("musicXfadeVal").textContent = v ? v + "秒" : "なし"; };
    xf.addEventListener("input", () => { musicSet(MUSIC_XFADE_KEY, xf.value); xfLabel(); });
    xfLabel();
    musicEqRefreshUi();
    musicLoopUpdateUi();
    musicCuesRefreshUi();
}

// ---- 画面
function musicCoverSrc(t) {
    const m = t && t.meta;
    if (!m) return "";
    if (m.cover) {
        if (musicCoverCache.id !== t.id || musicCoverCache.blob !== m.cover) {
            if (musicCoverCache.url) { try { URL.revokeObjectURL(musicCoverCache.url); } catch (e) { /* 何もしない */ } }
            musicCoverCache = { id: t.id, blob: m.cover, url: URL.createObjectURL(m.cover) };
        }
        return musicCoverCache.url;
    }
    return m.coverRemote || "";
}
function musicRenderList() {
    const ul = $id("musicList");
    if (!ul) return;
    musicRenderScenes();
    if (!musicTracks.length) { ul.innerHTML = '<li class="music-empty">曲はまだありません</li>'; return; }
    const vis = new Set(musicQueue());
    if (!vis.size) { ul.innerHTML = '<li class="music-empty">この場面には曲が入っていません。「✎ この場面を直す」で入れてください。</li>'; return; }
    const mode = musicGroupMode();
    let last = null, pos = 0;
    ul.innerHTML = musicTracks.map((t, i) => {
        if (!vis.has(i)) return "";
        pos++;
        const cur = i === musicIndex, title = musicTitle(t), sub = musicSubText(t, mode);
        let head = "";
        if (mode !== "none") {
            const g = musicGroupInfo(t, mode);
            if (g.key !== last) {
                last = g.key;
                const members = musicTracks.filter((x, xi) => vis.has(xi) && musicGroupInfo(x, mode).key === g.key);
                let gsub = "";
                if (mode === "album") gsub = [...new Set(members.map(x => x.meta && x.meta.artist).filter(Boolean))].slice(0, 2).join("、");
                else { const n = new Set(members.map(x => x.meta && x.meta.album).filter(Boolean)).size; gsub = n ? "アルバム " + n + "枚" : ""; }
                head = `<li class="music-group" data-gi="${i}"><span class="music-group-text"><b>${musicEsc(g.label)}</b>${gsub ? `<small>${musicEsc(gsub)}</small>` : ""}</span><span class="music-group-count">${members.length}曲</span>${mode === "album" ? `<button type="button" class="music-group-btn" data-album-gi="${i}" title="このアルバムの情報をまとめて調べる" aria-label="「${musicEsc(g.label)}」の情報をまとめて調べる">💿</button>` : ""}</li>`;
            }
        }
        return head + `<li class="music-item${cur ? " is-current" : ""}" data-i="${i}" data-n="${pos}"><button type="button" class="music-item-play" data-i="${i}" title="${musicEsc(title + (sub ? "　" + sub : ""))}"><span class="music-item-mark">${cur && musicIsPlaying() ? "♪" : pos}</span><span class="music-item-text"><span class="music-item-name">${musicEsc(title)}</span>${sub ? `<span class="music-item-sub">${musicEsc(sub)}</span>` : ""}</span></button><button type="button" class="music-item-edit" data-edit="${i}" aria-label="「${musicEsc(title)}」の情報を見る・直す" title="曲の情報を見る・直す">✎</button><button type="button" class="music-item-del" data-del="${i}" aria-label="「${musicEsc(title)}」を消す" title="消す">✕</button></li>`;
    }).join("");
}
function musicRenderNow() {
    const now = $id("musicNow");
    if (!now) return;
    const t = musicTracks[musicIndex], m = t && t.meta;
    now.textContent = t ? musicTitle(t) : (musicTracks.length ? "曲を選んでください" : "曲を追加してください");
    now.title = t ? musicTitle(t) : "";
    const sub = $id("musicNowSub"), comp = $id("musicNowComp");
    if (sub) {
        const line = [m && m.artist, m && m.album, m && m.year].filter(Boolean).join(" ・ ");
        sub.textContent = line; sub.hidden = !line;
    }
    if (comp) {
        const line = m && m.composer ? "作曲：" + m.composer : "";
        comp.textContent = line; comp.hidden = !line;
    }
    musicCuesRefreshUi();
    const cover = $id("musicCover");
    if (cover) {
        const src = musicCoverSrc(t);
        if (cover.dataset.src !== src) {
            cover.dataset.src = src;
            cover.textContent = "♪";
            if (src) {
                const im = new Image();
                im.alt = "";
                im.onload = () => { if (cover.dataset.src === src) { cover.textContent = ""; cover.appendChild(im); } };
                im.src = src;
            }
        }
    }
}
function musicUpdateUi() {
    const playing = musicIsPlaying();
    const play = $id("musicPlayBtn");
    if (play) { play.textContent = playing ? "⏸" : "▶"; play.setAttribute("aria-label", playing ? "一時停止" : "再生"); }
    const shuf = $id("musicShuffleBtn");
    if (shuf) { shuf.classList.toggle("is-on", musicShuffleOn()); shuf.setAttribute("aria-pressed", String(musicShuffleOn())); shuf.title = musicShuffleOn() ? "シャッフル：オン" : "シャッフル：オフ"; }
    const rep = $id("musicRepeatBtn");
    if (rep) {
        const m = musicRepeatMode();
        rep.textContent = m === "one" ? "🔂" : "🔁";
        rep.classList.toggle("is-on", m !== "off");
        rep.title = m === "one" ? "くり返し：1曲" : (m === "all" ? "くり返し：全部" : "くり返し：しない");
        rep.setAttribute("aria-label", rep.title);
    }
    const btn = $id("musicPlayerBtn");
    if (btn) btn.classList.toggle("is-playing", playing);
    document.querySelectorAll("#musicList .music-item").forEach(li => {
        const i = Number(li.dataset.i), mark = li.querySelector(".music-item-mark");
        if (mark) mark.textContent = i === musicIndex && playing ? "♪" : (li.dataset.n || String(i + 1));
    });
    musicRenderScenes();
}
// つまみの動きに、色のついた部分（進んだ分・音量）を合わせます（全体の見た目は style.css の --val を使います）
function musicPaintRange(el) {
    if (!el) return;
    const mn = Number(el.min || 0), mx = Number(el.max || 100), v = Number(el.value);
    const pct = mx > mn && isFinite(v) ? Math.max(0, Math.min(100, (v - mn) / (mx - mn) * 100)) : 0;
    el.style.setProperty("--val", pct.toFixed(1) + "%");
}
function musicPaintRanges() {
    document.querySelectorAll("#musicPanel input[type=\"range\"]").forEach(musicPaintRange);
}
function musicUpdateTime() {
    if (!musicAudio) return;
    const dur = musicAudio.duration, cur = musicAudio.currentTime;
    const c = $id("musicCur"), d = $id("musicDur"), s = $id("musicSeek");
    if (c) c.textContent = musicFmt(cur);
    if (d) d.textContent = isFinite(dur) ? musicFmt(dur) : "0:00";
    if (s && !musicSeeking) s.value = isFinite(dur) && dur > 0 ? String(Math.round(cur / dur * 1000)) : "0";
    musicPaintRange(s);
}
function musicSetPanel(open) {
    const p = $id("musicPanel"), b = $id("musicPlayerBtn");
    if (!p) return;
    p.hidden = !open;
    if (open) musicPaintRanges();
    if (b) { b.setAttribute("aria-expanded", String(open)); b.classList.toggle("is-open-panel", open); }
    musicSet(MUSIC_OPEN_KEY, open ? "1" : "0");
}
function musicTogglePanel() { const p = $id("musicPanel"); musicSetPanel(!!(p && p.hidden)); }

const MUSIC_CSS = `
#musicPlayerBtn { top: 109px; background-color: #1e293b; }
#musicPlayerBtn.is-playing { background-color: #7c3aed; }
#musicPlayerBtn.is-playing::after { content: " ♪"; }
#configMenuBtn.is-open ~ #musicPlayerBtn { left: var(--config-w, 340px); }
#musicPanel { position: fixed; top: 150px; left: 12px; z-index: 170; box-sizing: border-box; width: min(330px, calc(100vw - 24px)); max-height: calc(100vh - 170px); overflow-y: auto; padding: 12px 14px 14px; border-radius: 16px; background: var(--card-bg); color: var(--text-main); border: 1px solid var(--seat-border); box-shadow: 0 12px 36px rgba(0, 0, 0, 0.22); backdrop-filter: blur(20px); text-align: left; transition: left 0.4s ease; font-size: 13px; }
#configMenuBtn.is-open ~ #musicPanel { left: calc(var(--config-w, 340px) + 12px); }
#musicPanel[hidden] { display: none; }
#musicPanel .music-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
#musicPanel button { font-family: inherit; }
#musicPanel .music-x { border: none; background: transparent; color: var(--text-sub); font-size: 16px; cursor: pointer; padding: 2px 6px; border-radius: 6px; }
#musicPanel .music-x:hover { background: rgba(127, 127, 127, 0.18); }
#musicPanel .music-nowbox { display: flex; align-items: center; gap: 10px; margin: 2px 0 8px; }
#musicPanel .music-cover, #musicPanel .music-edit-cover, #musicPanel .music-cand-img { flex: 0 0 auto; display: flex; align-items: center; justify-content: center; overflow: hidden; background: linear-gradient(135deg, #6366f1, #a855f7); color: rgba(255, 255, 255, 0.85); font-size: 22px; }
#musicPanel .music-cover { width: 54px; height: 54px; border-radius: 10px; }
#musicPanel .music-cover img, #musicPanel .music-edit-cover img, #musicPanel .music-cand-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
#musicPanel .music-nowtext { flex: 1 1 auto; min-width: 0; }
#musicPanel .music-now { font-size: 15px; font-weight: 700; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#musicPanel .music-sub { font-size: 12px; color: var(--text-sub); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.5; }
#musicPanel [hidden] { display: none !important; }
#musicPanel .music-seek { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--text-sub); font-variant-numeric: tabular-nums; }
#musicPanel input[type="range"] { flex: 1 1 auto; min-width: 0; accent-color: var(--accent-color, #3b82f6); margin: 0; }
#musicPanel .music-ctrl { display: flex; align-items: center; justify-content: center; gap: 8px; margin: 10px 0 6px; }
#musicPanel .music-ctrl button { width: 40px; height: 40px; border-radius: 50%; border: 1px solid var(--seat-border); background: transparent; color: var(--text-main); font-size: 17px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; padding: 0; }
#musicPanel .music-ctrl button:hover { background: rgba(127, 127, 127, 0.16); }
#musicPanel .music-ctrl button.music-play { width: 52px; height: 52px; font-size: 22px; background: var(--accent-color, #3b82f6); border-color: var(--accent-color, #3b82f6); color: #fff; }
#musicPanel .music-ctrl button.is-on { background: rgba(59, 130, 246, 0.18); border-color: var(--accent-color, #3b82f6); }
#musicPanel .music-ctrl .music-sep { width: 1px; height: 24px; background: var(--seat-border); margin: 0 2px; }
#musicPanel .music-vol { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
#musicPanel .music-list { list-style: none; margin: 0; padding: 0; max-height: 200px; overflow-y: auto; border: 1px solid var(--seat-border); border-radius: 10px; }
#musicPanel .music-item { display: flex; align-items: center; border-bottom: 1px solid var(--seat-border); }
#musicPanel .music-item:last-child { border-bottom: none; }
#musicPanel .music-item.is-current { background: rgba(59, 130, 246, 0.14); }
#musicPanel .music-item-play { flex: 1 1 auto; min-width: 0; display: flex; align-items: center; gap: 8px; text-align: left; border: none; background: transparent; color: inherit; padding: 8px 10px; cursor: pointer; font-size: 13px; }
#musicPanel .music-item-mark { flex: 0 0 22px; text-align: center; color: var(--text-sub); font-variant-numeric: tabular-nums; }
#musicPanel .music-item.is-current .music-item-mark { color: var(--accent-color, #3b82f6); font-weight: 700; }
#musicPanel .music-item-text { display: flex; flex-direction: column; min-width: 0; }
#musicPanel .music-item-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#musicPanel .music-item-sub { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; color: var(--text-sub); }
#musicPanel .music-item-edit { flex: 0 0 auto; border: none; background: transparent; color: var(--text-sub); cursor: pointer; padding: 8px 6px; font-size: 13px; }
#musicPanel .music-item-edit:hover { color: var(--accent-color, #3b82f6); }
#musicPanel .music-tabs { display: flex; gap: 4px; margin: 2px 0 8px; padding: 3px; border-radius: 12px; background: rgba(127, 127, 127, 0.14); }
#musicPanel .music-tabs button { flex: 1 1 0; min-width: 0; padding: 7px 2px; border: none; border-radius: 9px; background: transparent; color: var(--text-sub); font-size: 11px; font-weight: 600; cursor: pointer; white-space: nowrap; }
#musicPanel .music-tabs button.is-sel { background: var(--card-bg); color: var(--text-main); box-shadow: 0 1px 4px rgba(0, 0, 0, 0.18); }
#musicPanel .music-tabs button.is-fx-on::after { content: " ●"; color: #22c55e; font-size: 9px; }
#musicPanel .music-spec { display: block; width: 100%; height: 44px; margin: 0 0 8px; border-radius: 8px; background: rgba(127, 127, 127, 0.1); color: var(--accent-color, #3b82f6); }
#musicPanel .music-eq-top { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
#musicPanel .music-eq-on { display: flex; align-items: center; gap: 6px; flex: 0 0 auto; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
#musicPanel .music-eq-top select { flex: 1 1 auto; min-width: 0; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--seat-border); background: var(--card-bg); color: var(--text-main); font-size: 12px; font-family: inherit; }
#musicPanel .music-eq-bands { display: flex; justify-content: space-between; gap: 2px; }
#musicPanel .music-eq-band { flex: 1 1 0; display: flex; flex-direction: column; align-items: center; gap: 4px; min-width: 0; }
#musicPanel .music-eq-wrap { position: relative; width: 26px; height: 112px; }
#musicPanel .music-eq-wrap input { position: absolute; left: 9px; top: 112px; width: 112px !important; height: 8px !important; margin: 0 !important; transform-origin: 0 0; transform: rotate(-90deg); }
#musicPanel .music-eq-db { font-size: 10px; color: var(--text-sub); font-variant-numeric: tabular-nums; }
#musicPanel .music-eq-hz { font-size: 10px; color: var(--text-sub); }
#musicPanel .music-eq-scale { display: flex; justify-content: space-between; font-size: 11px; color: var(--text-sub); margin: 2px 0 6px; }
#musicPanel .music-eq-pre { display: flex; align-items: center; gap: 8px; font-size: 12px; }
#musicPanel .music-eq-pre > span:first-child { flex: 0 0 auto; white-space: nowrap; }
#musicPanel .music-eq-pre > span:last-child { flex: 0 0 auto; min-width: 48px; text-align: right; font-variant-numeric: tabular-nums; color: var(--text-sub); }
#musicPanel .music-dj-sec { margin: 0 0 10px; padding: 8px 10px 10px; border: 1px solid var(--seat-border); border-radius: 12px; }
#musicPanel .music-dj-sec h4 { margin: 0 0 6px; font-size: 12px; color: var(--text-sub); font-weight: 700; }
#musicPanel .music-dj-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 4px; }
#musicPanel .music-dj-row input[type="range"] { flex: 1 1 90px; min-width: 70px; }
#musicPanel .music-dj-row .music-btn { flex: 0 0 auto; padding: 7px 10px; white-space: nowrap; }
#musicPanel .music-dj-val { flex: 0 0 auto; min-width: 54px; text-align: right; font-size: 12px; font-variant-numeric: tabular-nums; }
#musicPanel .music-btn.is-on, #musicPanel .music-cue.is-set { background: rgba(59, 130, 246, 0.2); border-color: var(--accent-color, #3b82f6); }
#musicPanel .music-pads { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; }
#musicPanel .music-pad { padding: 12px 8px; border-radius: 12px; border: 1px solid var(--seat-border); background: linear-gradient(135deg, rgba(99, 102, 241, 0.18), rgba(168, 85, 247, 0.18)); color: var(--text-main); font-size: 13px; font-weight: 700; cursor: pointer; }
#musicPanel .music-pad:active { transform: scale(0.97); }
#musicPanel .music-group-sel > span { flex: 0 0 auto; white-space: nowrap; }
#musicPanel .music-alb-q .music-btn { flex: 0 0 auto; white-space: nowrap; }
#musicPanel .music-group-sel { display: flex; align-items: center; gap: 8px; margin: 0 0 6px; font-size: 12px; color: var(--text-sub); }
#musicPanel .music-group-sel select { flex: 1 1 auto; min-width: 0; padding: 6px 8px; border-radius: 8px; border: 1px solid var(--seat-border); background: var(--card-bg); color: var(--text-main); font-size: 13px; font-family: inherit; }
#musicPanel .music-group { display: flex; align-items: center; gap: 8px; padding: 6px 10px; background: rgba(127, 127, 127, 0.12); border-bottom: 1px solid var(--seat-border); }
#musicPanel .music-group-text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
#musicPanel .music-group-text b { font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#musicPanel .music-group-text small { font-size: 11px; color: var(--text-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#musicPanel .music-group-count { flex: 0 0 auto; font-size: 11px; color: var(--text-sub); }
#musicPanel .music-group-btn { flex: 0 0 auto; border: 1px solid var(--seat-border); background: transparent; border-radius: 8px; padding: 3px 7px; font-size: 14px; cursor: pointer; }
#musicPanel .music-group-btn:hover { background: rgba(59, 130, 246, 0.16); }
#musicPanel .music-alb-targets { display: flex; flex-direction: column; margin-top: 8px; max-height: 210px; overflow-y: auto; border: 1px solid var(--seat-border); border-radius: 10px; }
#musicPanel .music-alb-row { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--seat-border); cursor: pointer; font-size: 12px; }
#musicPanel .music-alb-row:last-child { border-bottom: none; }
#musicPanel .music-alb-row.is-none { opacity: 0.55; cursor: default; }
#musicPanel .music-alb-text { display: flex; flex-direction: column; min-width: 0; }
#musicPanel .music-alb-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#musicPanel .music-alb-text small { color: var(--text-sub); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#musicPanel .music-alb-sel { margin: 6px 0 0; font-size: 12px; font-weight: 600; overflow-wrap: anywhere; }
#musicPanel .music-alb-over { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; cursor: pointer; }
#musicPanel .music-alb-q { display: flex; gap: 6px; }
#musicPanel .music-alb-q input { flex: 1 1 auto; min-width: 0; padding: 7px 9px; border-radius: 8px; border: 1px solid var(--seat-border); background: transparent; color: var(--text-main); font-size: 13px; font-family: inherit; }
#musicPanel .music-auto { display: flex; align-items: center; gap: 6px; margin-top: 8px; font-size: 12px; color: var(--text-main); cursor: pointer; }
#musicPanel .music-status { margin: 6px 0 0; min-height: 1em; font-size: 12px; color: var(--text-sub); line-height: 1.5; }
#musicPanel .music-edit-file { font-size: 12px; color: var(--text-sub); margin: 0 0 4px; overflow-wrap: anywhere; }
#musicPanel .music-edit-top { display: flex; gap: 10px; align-items: center; margin-bottom: 4px; }
#musicPanel .music-edit-cover { width: 72px; height: 72px; border-radius: 10px; }
#musicPanel .music-form label { display: block; font-size: 12px; color: var(--text-sub); margin: 6px 0 2px; }
#musicPanel .music-form input[type="text"] { width: 100%; box-sizing: border-box; padding: 7px 9px; border-radius: 8px; border: 1px solid var(--seat-border); background: transparent; color: var(--text-main); font-size: 13px; font-family: inherit; }
#musicPanel .music-btn { padding: 8px 12px; border-radius: 10px; border: 1px solid var(--seat-border); background: transparent; color: var(--text-main); font-size: 12px; font-weight: 600; cursor: pointer; }
#musicPanel .music-btn:hover { background: rgba(127, 127, 127, 0.14); }
#musicPanel .music-btn:disabled { opacity: 0.5; cursor: default; }
#musicPanel .music-btn.primary { background: var(--accent-color, #3b82f6); border-color: var(--accent-color, #3b82f6); color: #fff; }
#musicPanel .music-edit-actions { display: flex; gap: 8px; margin-top: 10px; }
#musicPanel .music-edit-actions .music-btn { flex: 1 1 auto; }
#musicPanel .music-cands { display: flex; flex-direction: column; gap: 4px; margin-top: 6px; max-height: 190px; overflow-y: auto; }
#musicPanel .music-cand { display: flex; align-items: center; gap: 8px; text-align: left; padding: 6px 8px; border-radius: 10px; border: 1px solid var(--seat-border); background: transparent; color: inherit; cursor: pointer; font-size: 12px; }
#musicPanel .music-cand:hover { background: rgba(59, 130, 246, 0.12); }
#musicPanel .music-cand-img { width: 38px; height: 38px; border-radius: 6px; font-size: 16px; }
#musicPanel .music-cand-text { display: flex; flex-direction: column; min-width: 0; }
#musicPanel .music-cand-text b, #musicPanel .music-cand-text small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
#musicPanel .music-cand-text small { color: var(--text-sub); }
#musicPanel .music-item-del { flex: 0 0 auto; border: none; background: transparent; color: var(--text-sub); cursor: pointer; padding: 8px 10px; font-size: 13px; }
#musicPanel .music-item-del:hover { color: #dc2626; }
#musicPanel .music-empty { padding: 12px; text-align: center; color: var(--text-sub); }
#musicPanel .music-add { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
#musicPanel .music-add > * { flex: 1 1 auto; text-align: center; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--seat-border); background: transparent; color: var(--text-main); font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; }
#musicPanel .music-add > *:hover { background: rgba(127, 127, 127, 0.14); }
#musicPanel.is-drop { outline: 3px dashed var(--accent-color, #3b82f6); outline-offset: -6px; }
#musicPanel .music-note { margin: 8px 0 0; font-size: 12px; color: var(--text-sub); line-height: 1.6; }
.toast-info { border-left: 5px solid #3b82f6; }
body.nomination-active #musicPlayerBtn, body.nomination-active #musicPanel { display: none !important; }
body.config-wide:has(#configContainer.open) #musicPlayerBtn, body.config-wide:has(#configContainer.open) #musicPanel { display: none !important; }
@media print { #musicPlayerBtn, #musicPanel { display: none !important; } }
@media (max-width: 600px) { #musicPlayerBtn { top: 109px; } #musicPanel { top: 150px; } }
#musicPanel .music-scenes { display: flex; flex-wrap: wrap; gap: 5px; margin: 0 0 8px; }
#musicPanel .music-chip { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; padding: 5px 10px; border: 1px solid var(--seat-border); border-radius: 999px; background: transparent; color: var(--text-main); font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
#musicPanel .music-chip small { opacity: 0.65; font-weight: 500; }
#musicPanel .music-chip:hover { background: rgba(127, 127, 127, 0.14); }
#musicPanel .music-chip.is-sel { background: #7c3aed; border-color: #7c3aed; color: #fff; }
#musicPanel .music-chip-add { border-style: dashed; color: var(--text-sub); font-weight: 500; }
#musicPanel .music-backup { margin-top: 8px; }
#musicPanel .music-form select, #musicPanel .music-form input[type="number"] { width: 100%; box-sizing: border-box; padding: 7px 9px; border-radius: 8px; border: 1px solid var(--seat-border); background: transparent; color: var(--text-main); font-size: 13px; font-family: inherit; }
#musicPanel .music-form select option { color: #111; }
.music-stop { position: fixed; inset: 0; z-index: 100000; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.88); font-family: inherit; }
.music-stop[hidden] { display: none; }
.music-stop-inner { width: min(760px, 92vw); text-align: center; color: #fff; }
.music-stop-hint { min-height: 1.6em; font-size: clamp(16px, 2.6vw, 24px); font-weight: 700; opacity: 0.9; }
.music-stop-name { margin: 18px 0 26px; padding: 26px 12px; border-radius: 24px; background: rgba(255, 255, 255, 0.1); border: 3px solid rgba(255, 255, 255, 0.25); font-size: clamp(36px, 9vw, 96px); font-weight: 900; line-height: 1.15; word-break: keep-all; overflow-wrap: anywhere; min-height: 1.2em; }
.music-stop-name.is-decided { background: #facc15; color: #1e293b; border-color: #fff; box-shadow: 0 0 60px rgba(250, 204, 21, 0.8); animation: musicStopPop 0.5s ease-out; }
@keyframes musicStopPop { 0% { transform: scale(0.8); } 60% { transform: scale(1.08); } 100% { transform: scale(1); } }
.music-stop-btn { padding: 18px 64px; border: none; border-radius: 999px; background: #ef4444; color: #fff; font-size: clamp(24px, 4vw, 40px); font-weight: 900; letter-spacing: 0.06em; cursor: pointer; box-shadow: 0 8px 0 #991b1b; }
.music-stop-btn:active { transform: translateY(6px); box-shadow: 0 2px 0 #991b1b; }
.music-stop-actions { margin-top: 26px; display: flex; gap: 12px; justify-content: center; }
.music-stop-actions button { padding: 10px 22px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.5); background: transparent; color: #fff; font-size: 16px; font-weight: 700; cursor: pointer; }
.music-stop-actions button[hidden], .music-stop-btn[hidden] { display: none; }
#musicPanel .music-padgrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 4px 0 10px; }
#musicPanel .music-padgrid-empty { grid-column: 1 / -1; }
#musicPanel .music-spad-wrap { position: relative; }
#musicPanel .music-spad { position: relative; width: 100%; min-height: 76px; box-sizing: border-box; padding: 8px 4px 6px; border: none; border-radius: 14px; background: var(--pc, #3b82f6); color: #fff; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 3px; cursor: pointer; box-shadow: 0 4px 0 rgba(0, 0, 0, 0.28); font-weight: 700; transition: transform 0.05s, box-shadow 0.05s; }
#musicPanel .music-spad:active, #musicPanel .music-spad.is-ringing { transform: translateY(3px); box-shadow: 0 1px 0 rgba(0, 0, 0, 0.28), 0 0 0 3px rgba(255, 255, 255, 0.85), 0 0 16px var(--pc, #3b82f6); }
#musicPanel .music-spad.is-loading { opacity: 0.6; }
#musicPanel .music-spad-emoji { font-size: 24px; line-height: 1; }
#musicPanel .music-spad-name { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; max-width: 100%; font-size: 11px; line-height: 1.25; text-align: center; word-break: break-all; }
#musicPanel .music-spad kbd { position: absolute; top: 4px; left: 6px; padding: 0 5px; border-radius: 5px; background: rgba(0, 0, 0, 0.3); color: #fff; font: 700 10px/16px inherit; font-family: inherit; }
#musicPanel .music-spad-edit { position: absolute; top: 3px; right: 3px; width: 22px; height: 22px; padding: 0; border: none; border-radius: 50%; background: rgba(0, 0, 0, 0.3); color: #fff; font-size: 11px; cursor: pointer; line-height: 22px; }
#musicPanel .music-spad-edit:hover { background: rgba(0, 0, 0, 0.55); }
#musicPanel .music-emoji-row { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
#musicPanel .music-emoji-btn { width: 34px; height: 34px; padding: 0; border: 1px solid var(--seat-border); border-radius: 10px; background: transparent; font-size: 18px; cursor: pointer; }
#musicPanel .music-emoji-btn:hover { background: rgba(127, 127, 127, 0.18); }
#musicPanel .music-swatch { width: 30px; height: 30px; padding: 0; border: 3px solid transparent; border-radius: 50%; background: var(--pc); cursor: pointer; box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.2); }
#musicPanel .music-swatch.is-sel { border-color: var(--card-bg); box-shadow: 0 0 0 3px var(--text-main); }
`;

// 音を鳴らす入れ物の、イベントの取り付け。いま鳴らしている方のイベントだけを、使います。
// ---- 場面ボタンと、プレイリスト
const MUSIC_PL_KEY = "music_playlists";          // [{ id, name, ids:[曲の番号札], shuffle }] の JSON
const MUSIC_PL_ACTIVE_KEY = "music_pl_active";   // 今選んでいる場面の id（空＝全ての曲）
let musicPlEditing = null;
function musicPlLoad() {
    try {
        const a = JSON.parse(musicGet(MUSIC_PL_KEY, "[]"));
        return Array.isArray(a) ? a.filter(p => p && p.id && typeof p.name === "string").map(p => ({ id: String(p.id), name: p.name.slice(0, 30), ids: Array.isArray(p.ids) ? p.ids.map(String) : [], shuffle: !!p.shuffle })) : [];
    } catch (e) { return []; }
}
function musicPlSave(list) { musicSet(MUSIC_PL_KEY, JSON.stringify(list)); }
function musicActivePl() {
    const id = musicGet(MUSIC_PL_ACTIVE_KEY, "");
    return id ? (musicPlLoad().find(p => p.id === id) || null) : null;
}
// いま流す曲の番号の並び（場面を選んでいる時は、その場面の曲だけ）
function musicQueue() {
    const all = musicTracks.map((_, i) => i), pl = musicActivePl();
    if (!pl) return all;
    const set = new Set(pl.ids);
    return all.filter(i => set.has(musicTracks[i].id));
}
function musicRenderScenes() {
    const box = $id("musicScenes");
    if (!box) return;
    const list = musicPlLoad(), act = musicActivePl(), playing = musicIsPlaying();
    const count = p => { const s = new Set(p.ids); return musicTracks.filter(t => s.has(t.id)).length; };
    box.innerHTML = `<button type="button" class="music-chip${act ? "" : " is-sel"}" data-pl="">全て</button>`
        + list.map(p => `<button type="button" class="music-chip${act && act.id === p.id ? " is-sel" : ""}" data-pl="${musicEsc(p.id)}" title="${musicEsc(p.name)}">${act && act.id === p.id && playing ? "♪ " : ""}${musicEsc(p.name)}<small>${count(p)}</small></button>`).join("")
        + `<button type="button" class="music-chip music-chip-add" data-pl-new>＋ 場面を作る</button>`
        + (act ? `<button type="button" class="music-chip music-chip-add" data-pl-edit>✎ この場面を直す</button>` : "");
}
function musicSceneClick(id) {
    const cur = musicActivePl();
    if ((cur ? cur.id : "") === id) {
        if (!musicQueue().length) return;
        const q = musicQueue();
        if (!q.includes(musicIndex) && !musicIsPlaying()) { musicPlayIndex(q[0]); return; }
        musicToggle();
        return;
    }
    musicSet(MUSIC_PL_ACTIVE_KEY, id);
    const pl = musicActivePl();
    if (pl) musicSet(MUSIC_SHUFFLE_KEY, pl.shuffle ? "1" : "0");
    musicBag = []; musicHistory = [];
    musicRefreshAll();
    const q = musicQueue();
    if (!q.length) { showToast(pl ? "この場面には曲が入っていません。「✎ この場面を直す」で入れてください。" : "曲がまだありません。", "info"); return; }
    musicPlayIndex(pl && pl.shuffle ? q[Math.floor(Math.random() * q.length)] : q[0]);
}
function musicPlTrackRows() {
    const box = $id("musicPlTracks");
    if (!box || !musicPlEditing) return;
    box.innerHTML = musicTracks.map(t => `<label class="music-alb-row"><input type="checkbox" data-id="${musicEsc(t.id)}"${musicPlEditing.ids.has(t.id) ? " checked" : ""}><span class="music-alb-text"><span class="music-alb-name">${musicEsc(musicTitle(t))}</span>${musicSubText(t) ? `<small>${musicEsc(musicSubText(t))}</small>` : ""}</span></label>`).join("") || '<div class="music-empty">曲はまだありません</div>';
}
function musicOpenPlEdit(id) {
    const pl = id ? musicPlLoad().find(p => p.id === id) : null;
    musicPlEditing = { id: pl ? pl.id : null, ids: new Set(pl ? pl.ids : []) };
    $id("musicPlName").value = pl ? pl.name : "";
    $id("musicPlShuffle").checked = pl ? pl.shuffle : false;
    $id("musicPlDelete").hidden = !pl;
    musicPlTrackRows();
    musicShowView("pl");
    try { $id("musicPlName").focus(); } catch (e) { /* 何もしない */ }
}
function musicClosePlEdit() { musicPlEditing = null; musicShowView(musicTab); }
function musicPlEditSave() {
    if (!musicPlEditing) return;
    const list = musicPlLoad();
    let name = $id("musicPlName").value.trim().slice(0, 30);
    if (!name) name = "場面" + (list.length + 1);
    const ids = musicTracks.filter(t => musicPlEditing.ids.has(t.id)).map(t => t.id);
    const shuffle = $id("musicPlShuffle").checked;
    let id = musicPlEditing.id;
    const ex = id ? list.find(p => p.id === id) : null;
    if (ex) { ex.name = name; ex.ids = ids; ex.shuffle = shuffle; }
    else { id = "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5); list.push({ id, name, ids, shuffle }); }
    musicPlSave(list);
    musicSet(MUSIC_PL_ACTIVE_KEY, id);
    musicBag = [];
    musicClosePlEdit();
    musicRefreshAll();
    showToast(`場面「${name}」を保存しました`, "success");
}
function musicPlEditDelete() {
    if (!musicPlEditing || !musicPlEditing.id) return;
    const list = musicPlLoad(), p = list.find(x => x.id === musicPlEditing.id);
    if (!p || !confirm(`場面「${p.name}」を消します。曲そのものは消えません。よろしいですか？`)) return;
    musicPlSave(list.filter(x => x.id !== p.id));
    if (musicGet(MUSIC_PL_ACTIVE_KEY, "") === p.id) musicSet(MUSIC_PL_ACTIVE_KEY, "");
    musicBag = [];
    musicClosePlEdit();
    musicRefreshAll();
}
function musicPlForgetTrack(id) {
    const list = musicPlLoad();
    let changed = false;
    list.forEach(p => { const n = p.ids.filter(x => x !== id); if (n.length !== p.ids.length) { p.ids = n; changed = true; } });
    if (changed) musicPlSave(list);
}

// ---- 曲ごとの音量そろえ
const MUSIC_NORM_KEY = "music_norm";
const MUSIC_NORM_MAX_BYTES = 25 * 1024 * 1024;   // これより大きいファイルは、調べません（メモリを使いすぎるため）
let musicNormRunning = false;
function musicNormOn() { return musicGet(MUSIC_NORM_KEY, "0") === "1"; }
// 基準：曲たちの音量の、小さい方から4分の1あたり。これより大きい曲だけを、小さくします
function musicNormTarget() {
    const v = musicTracks.map(t => t.meta && t.meta.loud).filter(x => typeof x === "number" && isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return -20;
    return Math.max(-30, Math.min(-14, v[Math.floor((v.length - 1) * 0.25)]));
}
function musicNormOf(t) {
    if (!musicNormOn() || !t || !t.meta || typeof t.meta.loud !== "number") return 1;
    return Math.max(0.1, Math.min(1, Math.pow(10, (musicNormTarget() - t.meta.loud) / 20)));
}
async function musicAnalyzeLoud(blob) {
    const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!AC || blob.size > MUSIC_NORM_MAX_BYTES) return null;
    try {
        const ab = await new AC(1, 44100, 44100).decodeAudioData(await blob.arrayBuffer());
        const win = Math.max(8, Math.floor(ab.sampleRate * 0.4)), chs = [];
        for (let c = 0; c < ab.numberOfChannels; c++) chs.push(ab.getChannelData(c));
        let sum = 0, cnt = 0;
        for (let s = 0; s + win <= ab.length; s += win) {
            let e = 0;
            chs.forEach(ch => { for (let i = s; i < s + win; i += 4) e += ch[i] * ch[i]; });
            e /= (win / 4) * chs.length;
            if (10 * Math.log10(e + 1e-12) > -55) { sum += e; cnt++; }
        }
        return cnt ? Math.round(100 * Math.log10(sum / cnt)) / 10 : null;
    } catch (e) { return null; }
}
async function musicNormAnalyzeAll() {
    if (musicNormRunning || !musicNormOn()) return;
    musicNormRunning = true;
    try {
        const todo = musicTracks.filter(t => t.meta && typeof t.meta.loud !== "number" && t.blob.size <= MUSIC_NORM_MAX_BYTES);
        for (let k = 0; k < todo.length && musicNormOn(); k++) {
            const t = todo[k];
            musicSetStatus(`音量を調べています… ${k + 1} / ${todo.length}`);
            const v = await musicAnalyzeLoud(t.blob);
            if (v !== null && musicTracks.includes(t)) { t.meta.loud = v; await musicSaveMeta(t); }
        }
        musicSetStatus(todo.length ? "音量を調べ終わりました。" : "");
    } finally {
        musicNormRunning = false;
        if (musicAudio && !musicFadeTimer && !musicXfading && musicIsPlaying()) { try { musicAudio.volume = musicVolume(); } catch (e) { /* 何もしない */ } }
    }
}

// ---- バックアップ（ZIP）：曲と、曲の情報と、場面と、設定を、ひとつのファイルにまとめます
const MUSIC_SETTING_KEYS = ["music_volume", "music_shuffle", "music_repeat", "music_auto_lookup", "music_group", "music_eq_on", "music_eq_gains", "music_eq_pre", "music_xfade", "music_norm", "music_seat_on", "music_seat_start", "music_seat_result", "music_seat_after", "music_seat_delay", "music_stop_start", "music_stop_norepeat", "music_pad_vol", "music_pad_duck", "music_pad_keys"];
const MUSIC_MIME = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", opus: "audio/ogg", flac: "audio/flac", jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp" };
const MUSIC_CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
    return t;
})();
async function musicBlobCrc(blob) {
    let c = 0xFFFFFFFF;
    for (let off = 0; off < blob.size; off += 4 * 1024 * 1024) {
        const b = new Uint8Array(await blob.slice(off, off + 4 * 1024 * 1024).arrayBuffer());
        for (let i = 0; i < b.length; i++) c = MUSIC_CRC_TABLE[(c ^ b[i]) & 255] ^ (c >>> 8);
    }
    return (c ^ 0xFFFFFFFF) >>> 0;
}
// 圧縮しない（保存だけの）ZIP。音楽のファイルは、もともと圧縮されているので、これで十分です
async function musicZipBuild(entries, onProgress) {
    const enc = new TextEncoder(), parts = [], central = [];
    let offset = 0, cdSize = 0;
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (let k = 0; k < entries.length; k++) {
        const e = entries[k], nameB = enc.encode(e.name), size = e.blob.size;
        if (size > 0xFFFFFFFF || offset > 0xFFFFFFF0) throw new Error("too big");
        if (onProgress) onProgress(k + 1, entries.length);
        const crc = await musicBlobCrc(e.blob);
        const h = new DataView(new ArrayBuffer(30));
        h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
        h.setUint16(10, dosTime, true); h.setUint16(12, dosDate, true); h.setUint32(14, crc, true); h.setUint32(18, size, true); h.setUint32(22, size, true);
        h.setUint16(26, nameB.length, true); h.setUint16(28, 0, true);
        parts.push(h.buffer, nameB, e.blob);
        const c = new DataView(new ArrayBuffer(46));
        c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(10, 0, true);
        c.setUint16(12, dosTime, true); c.setUint16(14, dosDate, true); c.setUint32(16, crc, true); c.setUint32(20, size, true); c.setUint32(24, size, true);
        c.setUint16(28, nameB.length, true); c.setUint32(42, offset, true);
        central.push(c.buffer, nameB);
        cdSize += 46 + nameB.length;
        offset += 30 + nameB.length + size;
    }
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, cdSize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [end.buffer]), { type: "application/zip" });
}
async function musicZipRead(file) {
    const tail = Math.min(file.size, 65557);
    const tb = new Uint8Array(await file.slice(file.size - tail).arrayBuffer());
    let p = -1;
    for (let i = tb.length - 22; i >= 0; i--) if (tb[i] === 0x50 && tb[i + 1] === 0x4b && tb[i + 2] === 5 && tb[i + 3] === 6) { p = i; break; }
    if (p < 0) throw new Error("zip");
    const dv = new DataView(tb.buffer, tb.byteOffset, tb.byteLength);
    const cnt = dv.getUint16(p + 10, true), cdSize = dv.getUint32(p + 12, true), cdOff = dv.getUint32(p + 16, true);
    if (cdOff === 0xFFFFFFFF) throw new Error("zip64");
    const cd = new Uint8Array(await file.slice(cdOff, cdOff + cdSize).arrayBuffer());
    const cv = new DataView(cd.buffer);
    const out = new Map();
    let q = 0;
    for (let k = 0; k < cnt && q + 46 <= cd.length; k++) {
        if (cv.getUint32(q, true) !== 0x02014b50) break;
        const method = cv.getUint16(q + 10, true), csize = cv.getUint32(q + 20, true), nl = cv.getUint16(q + 28, true), el = cv.getUint16(q + 30, true), cl = cv.getUint16(q + 32, true), lo = cv.getUint32(q + 42, true);
        out.set(new TextDecoder().decode(cd.subarray(q + 46, q + 46 + nl)), { method, csize, lo, start: 0 });
        q += 46 + nl + el + cl;
    }
    for (const e of out.values()) {
        const lh = new DataView(await file.slice(e.lo, e.lo + 30).arrayBuffer());
        if (lh.getUint32(0, true) !== 0x04034b50) throw new Error("zip");
        e.start = e.lo + 30 + lh.getUint16(26, true) + lh.getUint16(28, true);
    }
    return out;
}
function musicExtOf(name, type) {
    const m = /\.([A-Za-z0-9]{2,5})$/.exec(name || "");
    if (m) return m[1].toLowerCase();
    const hit = Object.keys(MUSIC_MIME).find(k => MUSIC_MIME[k] === type);
    return hit || "bin";
}
function musicPersistTrack(t) {
    return musicDbRun("readwrite", (st, ms) => { st.put({ id: t.id, name: t.name, size: t.size, blob: t.blob, order: t.order }); if (t.meta) ms.put(musicMetaRecord(t)); });
}
async function musicExportBackup() {
    if (!musicTracks.length && !musicPads.length) { showToast("書き出す曲や効果音がありません", "info"); return; }
    const btn = $id("musicExportBtn");
    if (btn) btn.disabled = true;
    try {
        const entries = [], manifest = { app: "sekigae-music", format: 1, savedAt: new Date().toISOString(), tracks: [], playlists: musicPlLoad(), pads: [], settings: {} };
        musicTracks.forEach((t, i) => {
            const n = String(i + 1).padStart(3, "0"), file = "tracks/" + n + "." + musicExtOf(t.blob && t.blob.name, t.blob && t.blob.type);
            entries.push({ name: file, blob: t.blob });
            const m = t.meta || musicEmptyMeta(), rec = { id: t.id, file, name: t.name, size: t.size, order: t.order, meta: { title: m.title, artist: m.artist, album: m.album, composer: m.composer, year: m.year, genre: m.genre, track: m.track, disc: m.disc, src: m.src, looked: m.looked, cues: m.cues || null, loud: typeof m.loud === "number" ? m.loud : null } };
            if (m.cover) { rec.cover = "covers/" + n + "." + musicExtOf("", m.cover.type); entries.push({ name: rec.cover, blob: m.cover }); }
            else if (m.coverRemote) rec.coverRemote = m.coverRemote;
            manifest.tracks.push(rec);
        });
        musicPads.forEach((p, i) => {
            const file = "pads/" + String(i + 1).padStart(3, "0") + "." + musicExtOf(p.blob && p.blob.name, p.blob && p.blob.type);
            entries.push({ name: file, blob: p.blob });
            manifest.pads.push({ id: p.id, file, name: p.name, size: p.size, order: p.order, emoji: p.emoji, color: p.color, vol: p.vol, mode: p.mode });
        });
        MUSIC_SETTING_KEYS.forEach(k => { const v = musicGet(k, null); if (typeof v === "string") manifest.settings[k] = v; });
        entries.unshift({ name: "manifest.json", blob: new Blob([JSON.stringify(manifest)], { type: "application/json" }) });
        const zip = await musicZipBuild(entries, (k, n) => musicSetStatus(`書き出しています… ${k} / ${n}`));
        const d = new Date(), ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
        const a = document.createElement("a");
        a.href = URL.createObjectURL(zip); a.download = "sekigae_music_backup_" + ymd + ".zip";
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 120000);
        const what = `${musicTracks.length}曲と効果音${musicPads.length}個`;
        musicSetStatus(`${what}を、書き出しました。`);
        showToast(`${what}を、バックアップのファイルに書き出しました`, "success");
    } catch (e) {
        musicSetStatus("");
        showToast(e && e.message === "too big" ? "大きすぎて、書き出せませんでした。曲を減らして、もう一度やってください。" : "書き出しに失敗しました。", "error");
    } finally { if (btn) btn.disabled = false; }
}
async function musicImportBackup(file) {
    if (!file) return;
    let entries, m;
    try {
        entries = await musicZipRead(file);
        const mf = entries.get("manifest.json");
        m = JSON.parse(await file.slice(mf.start, mf.start + mf.csize).text());
        if (!m || m.app !== "sekigae-music" || !Array.isArray(m.tracks)) throw new Error("format");
    } catch (e) { showToast("このファイルは席替えし太郎の音楽バックアップではないようです", "error"); return; }
    const padCount = Array.isArray(m.pads) ? m.pads.length : 0;
    if (!confirm(`このバックアップから、${m.tracks.length}曲と効果音${padCount}個を読み込みます。同じ曲（名前と大きさが同じ）は、そのままにします。場面と設定はバックアップの内容になります。よろしいですか？`)) return;
    const idMap = new Map();
    let added = 0;
    for (let k = 0; k < m.tracks.length; k++) {
        const tr = m.tracks[k], e = entries.get(tr.file);
        musicSetStatus(`読み込んでいます… ${k + 1} / ${m.tracks.length}`);
        if (!e || e.method !== 0) continue;
        let t = musicTracks.find(x => x.name === tr.name && x.size === tr.size);
        if (!t) {
            const ext = musicExtOf(tr.file, "");
            const blob = new File([file.slice(e.start, e.start + e.csize)], tr.name + "." + ext, { type: MUSIC_MIME[ext] || "" });
            const meta = musicMetaFromRecord(tr.meta || {});
            if (tr.cover && entries.get(tr.cover)) { const c = entries.get(tr.cover); meta.cover = new Blob([file.slice(c.start, c.start + c.csize)], { type: MUSIC_MIME[musicExtOf(tr.cover, "")] || "image/jpeg" }); }
            if (tr.coverRemote) meta.coverRemote = String(tr.coverRemote);
            t = { id: "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name: tr.name, size: tr.size, blob, url: "", order: Date.now() + k, meta };
            musicTracks.push(t);
            await musicPersistTrack(t);
            added++;
        }
        idMap.set(tr.id, t.id);
    }
    const padMap = new Map();
    let padsAdded = 0;
    for (const pr of (Array.isArray(m.pads) ? m.pads : [])) {
        const e = entries.get(pr.file);
        if (!e || e.method !== 0 || !pr.name) continue;
        let p = musicPads.find(x => x.name === pr.name && x.size === pr.size);
        if (!p && musicPads.length < MUSIC_PAD_MAX) {
            const ext = musicExtOf(pr.file, "");
            p = musicPadFromRecord(Object.assign({}, pr, { id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), order: Date.now() + padsAdded, blob: new File([file.slice(e.start, e.start + e.csize)], pr.name + "." + ext, { type: MUSIC_MIME[ext] || "" }) }));
            musicPads.push(p);
            await musicPadSave(p);
            padsAdded++;
        }
        if (p) padMap.set(String(pr.id), p.id);
    }
    const list = musicPlLoad();
    (Array.isArray(m.playlists) ? m.playlists : []).forEach(p => {
        if (!p || typeof p.name !== "string") return;
        const ids = (Array.isArray(p.ids) ? p.ids : []).map(x => idMap.get(String(x))).filter(Boolean);
        const ex = list.find(x => x.name === p.name);
        if (ex) ex.ids = Array.from(new Set(ex.ids.concat(ids)));
        else list.push({ id: "p" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), name: p.name.slice(0, 30), ids, shuffle: !!p.shuffle });
    });
    musicPlSave(list);
    if (m.settings && typeof m.settings === "object") MUSIC_SETTING_KEYS.forEach(k => { if (typeof m.settings[k] === "string") musicSet(k, m.settings[k]); });
    const rr = musicGet(MUSIC_SEAT_RESULT_KEY, "fanfare");
    if (rr.startsWith("pad:")) musicSet(MUSIC_SEAT_RESULT_KEY, padMap.has(rr.slice(4)) ? "pad:" + padMap.get(rr.slice(4)) : "fanfare");
    musicPadRender();
    musicBag = []; musicHistory = [];
    musicSyncControls();
    musicRefreshAll();
    musicSetStatus("");
    showToast(`バックアップから、${added}曲と効果音${padsAdded}個を読み込みました`, "success");
    if (musicNormOn()) musicNormAnalyzeAll();
    musicEngineApplyEq();
}

// ---- 席替えの演出と連動する
const MUSIC_SEAT_ON_KEY = "music_seat_on";
const MUSIC_SEAT_START_KEY = "music_seat_start";     // keep／pl:場面のid／track:曲の番号札
const MUSIC_SEAT_RESULT_KEY = "music_seat_result";   // none／fanfare／clap／horn／drumroll
const MUSIC_SEAT_AFTER_KEY = "music_seat_after";     // keep／quiet／stop
const MUSIC_SEAT_DELAY_KEY = "music_seat_delay";
const MUSIC_STOP_START_KEY = "music_stop_start";
const MUSIC_STOP_NOREPEAT_KEY = "music_stop_norepeat";
let musicSeatTimer = null;
function musicSeatOn() { return musicGet(MUSIC_SEAT_ON_KEY, "0") === "1"; }
// 「いまの曲のまま」「場面」「特定の曲」のどれかで、曲を流し始める
function musicStartFromSetting(v) {
    v = String(v || "keep");
    if (v.startsWith("pl:")) {
        const id = v.slice(3), pl = musicPlLoad().find(p => p.id === id);
        if (pl) {
            if (musicGet(MUSIC_PL_ACTIVE_KEY, "") !== id) { musicSet(MUSIC_PL_ACTIVE_KEY, id); musicBag = []; musicHistory = []; musicRefreshAll(); }
            const q = musicQueue();
            if (q.length) { musicPlayIndex(pl.shuffle ? q[Math.floor(Math.random() * q.length)] : q[0]); return true; }
        }
        return false;
    }
    if (v.startsWith("track:")) {
        const i = musicTracks.findIndex(t => t.id === v.slice(6));
        if (i >= 0) { musicPlayIndex(i); return true; }
        return false;
    }
    if (!musicTracks.length) return false;
    if (musicIsPlaying()) return true;
    if (musicAudio && musicAudio.src && musicIndex >= 0 && !musicAudio.ended) { musicToggle(); return true; }
    const q = musicQueue();
    if (!q.length) return false;
    musicPlayIndex(q.includes(musicIndex) ? musicIndex : q[0]);
    return true;
}
function musicSeatStart(anim) {
    if (!musicSeatOn() || anim === "none") return;
    if (musicSeatTimer) { clearTimeout(musicSeatTimer); musicSeatTimer = null; }
    musicStartFromSetting(musicGet(MUSIC_SEAT_START_KEY, "keep"));
}
function musicSeatDone(anim) {
    if (!musicSeatOn()) return;
    if (musicSeatTimer) { clearTimeout(musicSeatTimer); musicSeatTimer = null; }
    // スロットやドラムロールは、演出が終わってから呼ばれる。それ以外は、決めた秒数のあとに知らせる
    const direct = anim === "none" || anim === "slot" || anim === "slotstop" || anim === "slotseat" || anim === "drumroll" || anim === "test";
    const sec = Math.max(1, Math.min(30, Number(musicGet(MUSIC_SEAT_DELAY_KEY, "4")) || 4));
    if (direct) musicSeatFinish(); else musicSeatTimer = setTimeout(() => { musicSeatTimer = null; musicSeatFinish(); }, sec * 1000);
}
function musicSeatFinish() {
    const kind = musicGet(MUSIC_SEAT_RESULT_KEY, "fanfare");
    if (kind.startsWith("pad:")) { if (musicPadFind(kind.slice(4))) musicPadPlay(kind.slice(4)); }
    else if (kind !== "none" && MUSIC_PADS[kind]) musicPad(kind);
    const after = musicGet(MUSIC_SEAT_AFTER_KEY, "keep");
    if (!musicIsPlaying()) return;
    if (after === "stop") setTimeout(() => musicFade(0, 1500, () => { try { musicAudio.pause(); } catch (e) { /* 何もしない */ } musicAudio.volume = musicVolume(); musicUpdateUi(); }), 1200);
    else if (after === "quiet") setTimeout(() => musicFade(musicVolume() * 0.35, 800), 1200);
}

// ---- ストップ指名：曲が流れている間、名前が高速で入れ替わる。止めた瞬間に出ていた人に当たる
let musicStopState = null;
function musicStopCandidates() {
    let list = [];
    try {
        if (typeof getNominationCandidates === "function") list = getNominationCandidates();
        else list = (currentStudents || []).filter(s => s && s.type === "STUDENT" && s.text && !s.isAbsent);
    } catch (e) { list = []; }
    return list.map(s => {
        const p = typeof nominationNameParts === "function" ? nominationNameParts(s.text) : { no: "", name: String(s.text) };
        return (p.no ? p.no + "番 " : "") + p.name;
    }).filter(Boolean);
}
function musicStopBuild() {
    if ($id("musicStopOverlay")) return;
    const o = document.createElement("div");
    o.id = "musicStopOverlay";
    o.className = "music-stop";
    o.hidden = true;
    o.setAttribute("role", "dialog");
    o.setAttribute("aria-modal", "true");
    o.setAttribute("aria-label", "ストップ指名");
    o.innerHTML = `<div class="music-stop-inner"><div class="music-stop-hint" id="musicStopHint" aria-live="polite"></div><div class="music-stop-name" id="musicStopName">　</div><button type="button" class="music-stop-btn" id="musicStopBtn">STOP!</button><div class="music-stop-actions"><button type="button" id="musicStopAgain" hidden>🔁 もう一回</button><button type="button" id="musicStopClose">とじる</button></div></div>`;
    document.body.appendChild(o);
    $id("musicStopBtn").addEventListener("click", musicStopPress);
    $id("musicStopAgain").addEventListener("click", musicStopRound);
    $id("musicStopClose").addEventListener("click", musicStopClose);
}
function musicStopRound() {
    const s = musicStopState;
    if (!s) return;
    s.stopped = false; s.shown = "";
    $id("musicStopHint").textContent = "曲が流れています。止めたい時に、STOP！を押すか、Spaceキーを押します。";
    $id("musicStopName").className = "music-stop-name";
    $id("musicStopBtn").hidden = false; $id("musicStopAgain").hidden = true;
    try { $id("musicStopBtn").focus(); } catch (e) { /* 何もしない */ }
    if (musicTracks.length) { if (!musicStartFromSetting(musicGet(MUSIC_STOP_START_KEY, "keep"))) $id("musicStopHint").textContent = "曲が流せないので音なしで進めます。止めたい時に、STOP！を押してください。"; }
    else $id("musicStopHint").textContent = "曲が入っていないので音なしで進めます。止めたい時に、STOP！を押してください。";
    clearInterval(s.timer);
    const nameEl = $id("musicStopName");
    s.timer = setInterval(() => {
        let pool = s.cands.filter(x => x !== s.shown);
        if (s.last && s.noRepeat && pool.length > 1) pool = pool.filter(x => x !== s.last);
        if (!pool.length) pool = s.cands;
        s.shown = pool[Math.floor(Math.random() * pool.length)];
        nameEl.textContent = s.shown;
    }, 85);
}
function musicStopPress() {
    const s = musicStopState;
    if (!s || s.stopped || !s.shown) return;
    s.stopped = true;
    clearInterval(s.timer);
    s.last = s.shown;
    $id("musicStopName").textContent = s.shown;
    $id("musicStopName").className = "music-stop-name is-decided";
    $id("musicStopHint").textContent = "🎯 当たったのは…";
    $id("musicStopBtn").hidden = true; $id("musicStopAgain").hidden = false;
    if (musicIsPlaying()) musicSpinStop();
    musicPad("fanfare");
    setTimeout(() => { const b = $id("musicStopAgain"); if (b && !b.hidden) { try { b.focus(); } catch (e) { /* 何もしない */ } } }, 400);
}
function musicStopOpen() {
    const cands = musicStopCandidates();
    if (!cands.length) { showToast("指名できる人がいません。名簿と座席表を確認してください。", "error"); return; }
    musicStopBuild();
    musicStopState = { cands, timer: null, shown: "", last: musicStopState ? musicStopState.last : "", stopped: false, noRepeat: musicGet(MUSIC_STOP_NOREPEAT_KEY, "1") === "1" };
    $id("musicStopOverlay").hidden = false;
    musicStopRound();
}
function musicStopClose() {
    if (musicStopState) clearInterval(musicStopState.timer);
    musicStopState = null;
    const o = $id("musicStopOverlay");
    if (o) o.hidden = true;
}

// ---- 画面の部品の、中身を、保存してある設定に合わせる
function musicLinkRefreshOptions() {
    const fill = (id, withKeep) => {
        const sel = $id(id);
        if (!sel) return;
        const cur = sel.value;
        const opts = [`<option value="keep">今の曲のまま</option>`]
            .concat(musicPlLoad().map(p => `<option value="pl:${musicEsc(p.id)}">場面：${musicEsc(p.name)}</option>`))
            .concat(musicTracks.map(t => `<option value="track:${musicEsc(t.id)}">曲：${musicEsc(musicTitle(t))}</option>`));
        sel.innerHTML = opts.join("");
        const want = musicGet(id === "musicSeatStart" ? MUSIC_SEAT_START_KEY : MUSIC_STOP_START_KEY, "keep");
        sel.value = Array.from(sel.options).some(o => o.value === want) ? want : (Array.from(sel.options).some(o => o.value === cur) ? cur : "keep");
    };
    fill("musicSeatStart"); fill("musicStopStart");
    const rs = $id("musicSeatResult");
    if (rs) {
        const want = musicGet(MUSIC_SEAT_RESULT_KEY, "fanfare");
        rs.innerHTML = `<option value="fanfare">ファンファーレ</option><option value="clap">拍手</option><option value="horn">ホーン</option><option value="drumroll">ドラムロール</option>`
            + musicPads.map(p => `<option value="pad:${musicEsc(p.id)}">取り込み：${musicEsc(p.name)}</option>`).join("") + `<option value="none">なし</option>`;
        rs.value = Array.from(rs.options).some(o => o.value === want) ? want : "fanfare";
    }
}
function musicSyncControls() {
    const set = (id, fn) => { const e = $id(id); if (e) fn(e); };
    set("musicGroupSel", e => { e.value = musicGroupMode(); });
    set("musicVol", e => { e.value = String(Math.round(musicVolumeBase() * 100)); });
    set("musicAutoLookup", e => { e.checked = musicAutoLookupOn(); });
    set("musicNormOn", e => { e.checked = musicNormOn(); });
    set("musicXfade", e => { e.value = String(musicXfadeSec()); const v = $id("musicXfadeVal"); if (v) v.textContent = musicXfadeSec() ? musicXfadeSec() + "秒" : "なし"; });
    set("musicSeatOn", e => { e.checked = musicSeatOn(); });
    set("musicSeatAfter", e => { e.value = musicGet(MUSIC_SEAT_AFTER_KEY, "keep"); if (!e.value) e.value = "keep"; });
    set("musicSeatDelay", e => { e.value = String(Math.max(1, Math.min(30, Number(musicGet(MUSIC_SEAT_DELAY_KEY, "4")) || 4))); });
    set("musicStopNoRepeat", e => { e.checked = musicGet(MUSIC_STOP_NOREPEAT_KEY, "1") === "1"; });
    musicLinkRefreshOptions();
    musicEqRefreshUi();
    if (musicAudio && !musicFadeTimer && !musicXfading && musicIsPlaying()) { try { musicAudio.volume = musicVolume(); } catch (e) { /* 何もしない */ } }
    musicUpdateUi();
}
function musicV14Bind() {
    $id("musicScenes").addEventListener("click", e => {
        const b = e.target.closest("button");
        if (!b) return;
        if (b.hasAttribute("data-pl-new")) { musicOpenPlEdit(null); return; }
        if (b.hasAttribute("data-pl-edit")) { const a = musicActivePl(); if (a) musicOpenPlEdit(a.id); return; }
        if (b.hasAttribute("data-pl")) musicSceneClick(b.dataset.pl);
    });
    $id("musicPlBack").addEventListener("click", musicClosePlEdit);
    $id("musicPlCancel").addEventListener("click", musicClosePlEdit);
    $id("musicPlSave").addEventListener("click", musicPlEditSave);
    $id("musicPlDelete").addEventListener("click", musicPlEditDelete);
    $id("musicPlAll").addEventListener("click", () => { if (musicPlEditing) { musicTracks.forEach(t => musicPlEditing.ids.add(t.id)); musicPlTrackRows(); } });
    $id("musicPlNone").addEventListener("click", () => { if (musicPlEditing) { musicPlEditing.ids.clear(); musicPlTrackRows(); } });
    $id("musicPlTracks").addEventListener("change", e => {
        const c = e.target.closest("input[data-id]");
        if (c && musicPlEditing) { if (c.checked) musicPlEditing.ids.add(c.dataset.id); else musicPlEditing.ids.delete(c.dataset.id); }
    });
    $id("musicPlEdit").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.id === "musicPlName") { e.preventDefault(); musicPlEditSave(); } });
    $id("musicNormOn").addEventListener("change", e => {
        musicSet(MUSIC_NORM_KEY, e.target.checked ? "1" : "0");
        if (e.target.checked) musicNormAnalyzeAll(); else musicSetStatus("");
        if (musicAudio && !musicFadeTimer && musicIsPlaying()) { try { musicAudio.volume = musicVolume(); } catch (err) { /* 何もしない */ } }
    });
    $id("musicExportBtn").addEventListener("click", musicExportBackup);
    $id("musicImportInput").addEventListener("change", e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; musicImportBackup(f); });
    $id("musicSeatOn").addEventListener("change", e => musicSet(MUSIC_SEAT_ON_KEY, e.target.checked ? "1" : "0"));
    $id("musicSeatStart").addEventListener("change", e => musicSet(MUSIC_SEAT_START_KEY, e.target.value));
    $id("musicSeatResult").addEventListener("change", e => musicSet(MUSIC_SEAT_RESULT_KEY, e.target.value));
    $id("musicSeatAfter").addEventListener("change", e => musicSet(MUSIC_SEAT_AFTER_KEY, e.target.value));
    $id("musicSeatDelay").addEventListener("change", e => { const v = Math.max(1, Math.min(30, Math.round(Number(e.target.value) || 4))); e.target.value = String(v); musicSet(MUSIC_SEAT_DELAY_KEY, String(v)); });
    $id("musicSeatTest").addEventListener("click", () => {
        const was = musicSeatOn();
        musicSet(MUSIC_SEAT_ON_KEY, "1");
        musicSeatStart("test");
        setTimeout(() => { musicSeatDone("test"); musicSet(MUSIC_SEAT_ON_KEY, was ? "1" : "0"); }, 2500);
    });
    $id("musicStopStart").addEventListener("change", e => musicSet(MUSIC_STOP_START_KEY, e.target.value));
    $id("musicStopNoRepeat").addEventListener("change", e => musicSet(MUSIC_STOP_NOREPEAT_KEY, e.target.checked ? "1" : "0"));
    $id("musicStopOpen").addEventListener("click", musicStopOpen);
    document.addEventListener("sekigae:shuffle-start", e => musicSeatStart((e.detail && e.detail.anim) || ""));
    document.addEventListener("sekigae:shuffle-done", e => musicSeatDone((e.detail && e.detail.anim) || ""));
    document.addEventListener("keydown", e => {
        const o = $id("musicStopOverlay");
        if (!o || o.hidden) return;
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); musicStopClose(); return; }
        if ((e.key === " " || e.key === "Spacebar" || e.key === "Enter") && musicStopState && !musicStopState.stopped) { e.preventDefault(); e.stopPropagation(); musicStopPress(); }
    }, true);
    musicSyncControls();
}

// ---- 効果音パッド：外から取り込んだ効果音を、ぽちぽち押して鳴らす
const MUSIC_PAD_STORE = "pads";
const MUSIC_PAD_VOL_KEY = "music_pad_vol";        // 効果音ぜんたいの音量（0〜100）
const MUSIC_PAD_DUCK_KEY = "music_pad_duck";      // 鳴らす間、音楽を小さくする（1＝する）
const MUSIC_PAD_KEYS_KEY = "music_pad_keys";      // 数字キーで鳴らす（1＝する）
const MUSIC_PAD_MAX = 40;
const MUSIC_PAD_MAX_BYTES = 10 * 1024 * 1024;     // 1つの効果音の大きさの上限
const MUSIC_PAD_MAX_SEC = 120;                    // 1つの効果音の長さの上限
const MUSIC_PAD_COLORS = ["#3b82f6", "#ef4444", "#f59e0b", "#22c55e", "#a855f7", "#ec4899", "#14b8a6", "#64748b"];
const MUSIC_PAD_EMOJI = ["🔔", "🥁", "🎺", "👏", "🎉", "😂", "😱", "✨", "🚨", "🎵", "🐶", "🐱"];
const MUSIC_PAD_KEYCHARS = "1234567890";
let musicPads = [];              // { id, name, size, blob, order, emoji, color, vol, mode, buf, voices }
let musicPadEditing = null;
function musicPadMaster() { const v = Number(musicGet(MUSIC_PAD_VOL_KEY, "100")); return isFinite(v) ? Math.max(0, Math.min(100, v)) / 100 : 1; }
function musicPadDuckOn() { return musicGet(MUSIC_PAD_DUCK_KEY, "1") === "1"; }
function musicPadKeysOn() { return musicGet(MUSIC_PAD_KEYS_KEY, "0") === "1"; }
function musicPadRecord(p) { return { id: p.id, name: p.name, size: p.size, blob: p.blob, order: p.order, emoji: p.emoji, color: p.color, vol: p.vol, mode: p.mode }; }
function musicPadFromRecord(r) {
    const mode = r.mode === "overlap" || r.mode === "loop" ? r.mode : "once";
    const vol = Number(r.vol);
    return { id: String(r.id), name: String(r.name || "効果音").slice(0, 30), size: Number(r.size) || 0, blob: r.blob, order: Number(r.order) || 0, emoji: String(r.emoji || "🔔").slice(0, 4), color: MUSIC_PAD_COLORS.includes(r.color) ? r.color : MUSIC_PAD_COLORS[0], vol: isFinite(vol) ? Math.max(0, Math.min(200, vol)) : 100, mode, buf: null, voices: new Set(), decoding: null };
}
function musicPadDbRun(mode, fn) {
    return musicOpenDb().then(db => new Promise(resolve => {
        if (!db || !db.objectStoreNames.contains(MUSIC_PAD_STORE)) { resolve({ ok: false }); return; }
        try {
            const tx = db.transaction([MUSIC_PAD_STORE], mode);
            const r = fn(tx.objectStore(MUSIC_PAD_STORE));
            tx.oncomplete = () => resolve({ ok: true, result: r && r.result });
            tx.onerror = tx.onabort = () => resolve({ ok: false });
        } catch (e) { resolve({ ok: false }); }
    }));
}
function musicPadSave(p) { return musicPadDbRun("readwrite", st => st.put(musicPadRecord(p))); }
async function musicPadLoadSaved() {
    const res = await musicPadDbRun("readonly", st => st.getAll());
    if (!res.ok || !Array.isArray(res.result)) return;
    const have = new Set(musicPads.map(p => p.id));
    res.result.filter(r => r && r.blob && !have.has(r.id)).sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(r => musicPads.push(musicPadFromRecord(r)));
    musicPadRender();
    musicLinkRefreshOptions();
}
function musicPadFind(id) { return musicPads.find(p => p.id === id) || null; }
function musicPadAnyRinging() { return musicPads.some(p => p.voices.size); }
function musicPadDuckWanted() { return musicPadDuckOn() && musicPads.some(p => p.mode !== "loop" && p.voices.size); }
function musicPadDuckUpdate() {
    const e = musicEngine;
    if (!e) return;
    const want = musicPadDuckWanted(), t = e.ctx.currentTime;
    e.mix.gain.cancelScheduledValues(t);
    e.mix.gain.setTargetAtTime(want ? 0.3 : 1, t, want ? 0.04 : 0.3);
}
function musicPadUiUpdate() {
    document.querySelectorAll("#musicPadGrid .music-spad").forEach(b => { const p = musicPadFind(b.dataset.spad); b.classList.toggle("is-ringing", !!(p && p.voices.size)); });
    const st = $id("musicPadStopAll");
    if (st) st.disabled = !musicPadAnyRinging();
}
function musicPadRender() {
    const g = $id("musicPadGrid");
    if (!g) return;
    const keys = musicPadKeysOn();
    if (!musicPads.length) g.innerHTML = '<div class="music-empty music-padgrid-empty">効果音はまだありません。「効果音を追加」から、音のファイルを入れてください。</div>';
    else g.innerHTML = musicPads.map((p, i) => `<div class="music-spad-wrap"><button type="button" class="music-spad${p.voices.size ? " is-ringing" : ""}" data-spad="${musicEsc(p.id)}" style="--pc:${p.color}" title="${musicEsc(p.name)}" aria-label="${musicEsc(p.name)}を鳴らす"><span class="music-spad-emoji" aria-hidden="true">${musicEsc(p.emoji)}</span><span class="music-spad-name">${musicEsc(p.name)}</span>${keys && i < 10 ? `<kbd>${MUSIC_PAD_KEYCHARS[i]}</kbd>` : ""}</button><button type="button" class="music-spad-edit" data-spad-edit="${musicEsc(p.id)}" aria-label="「${musicEsc(p.name)}」を直す" title="直す">✎</button></div>`).join("");
    musicPadUiUpdate();
}
async function musicPadBuffer(p) {
    if (p.buf) return p.buf;
    if (p.decoding) return p.decoding;
    const e = musicEngineEnsure();
    if (!e) return null;
    p.decoding = (async () => {
        try {
            const ab = await p.blob.arrayBuffer();
            const buf = await new Promise((res, rej) => { const r = e.ctx.decodeAudioData(ab, res, rej); if (r && r.then) r.then(res, rej); });
            if (!buf || buf.duration > MUSIC_PAD_MAX_SEC) return null;
            p.buf = buf;
            return buf;
        } catch (err) { return null; } finally { p.decoding = null; }
    })();
    return p.decoding;
}
// 開いた時に、順番に読み込んでおく（押した瞬間に鳴らすため）
async function musicPadPrepare() {
    if (!musicPads.length) return;
    for (const p of musicPads.slice()) { if (!p.buf && !p.failed) { const b = await musicPadBuffer(p); if (!b) p.failed = true; } }
}
function musicPadStopOne(p) {
    const e = musicEngine;
    Array.from(p.voices).forEach(v => {
        try { const t = e.ctx.currentTime; v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, 0.012); v.src.stop(t + 0.09); } catch (err) { /* 何もしない */ }
    });
}
function musicPadStopAll() { musicPads.forEach(musicPadStopOne); }
async function musicPadPlay(id, opts) {
    const p = musicPadFind(id);
    if (!p) return;
    const e = musicEngineEnsure();
    if (!e) { showToast("この ブラウザでは、効果音を鳴らせませんでした", "error"); return; }
    const mode = (opts && opts.mode) || p.mode;
    if (mode === "loop" && p.voices.size && !(opts && opts.test)) { musicPadStopOne(p); return; }
    if (mode === "once" && p.voices.size) musicPadStopOne(p);
    let buf = p.buf;
    if (!buf) {
        const btn = document.querySelector(`#musicPadGrid .music-spad[data-spad="${CSS.escape(p.id)}"]`);
        if (btn) btn.classList.add("is-loading");
        buf = await musicPadBuffer(p);
        if (btn) btn.classList.remove("is-loading");
    }
    if (!buf) { p.failed = true; showToast(`「${p.name}」を読み込めませんでした。長さは2分まで大きさは10MBまでです。`, "error"); return; }
    const ctx = e.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = mode === "loop";
    const g = ctx.createGain();
    const vol = opts && typeof opts.vol === "number" ? opts.vol : p.vol;
    g.gain.value = Math.max(0, vol / 100 * musicPadMaster());
    src.connect(g); g.connect(ctx.destination);
    const v = { src, g };
    p.voices.add(v);
    src.onended = () => { p.voices.delete(v); try { g.disconnect(); } catch (err) { /* 何もしない */ } musicPadUiUpdate(); musicPadDuckUpdate(); };
    src.start(ctx.currentTime + 0.005);
    musicPadUiUpdate();
    musicPadDuckUpdate();
}
async function musicPadAdd(fileList) {
    const files = Array.from(fileList || []).filter(musicIsAudioFile).sort((a, b) => a.name.localeCompare(b.name, "ja", { numeric: true }));
    if (!files.length) { showToast("音のファイルが見つかりませんでした", "error"); return; }
    let added = 0, big = 0, full = false, dup = 0, bad = 0;
    for (const f of files) {
        if (musicPads.length >= MUSIC_PAD_MAX) { full = true; break; }
        if (f.size > MUSIC_PAD_MAX_BYTES) { big++; continue; }
        const name = musicTrackName(f).slice(0, 30);
        if (musicPads.some(p => p.name === name && p.size === f.size)) { dup++; continue; }
        const p = musicPadFromRecord({ id: "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7), name, size: f.size, blob: f, order: Date.now() + added, emoji: MUSIC_PAD_EMOJI[musicPads.length % MUSIC_PAD_EMOJI.length], color: MUSIC_PAD_COLORS[musicPads.length % MUSIC_PAD_COLORS.length], vol: 100, mode: "once" });
        musicPads.push(p);
        added++;
        await musicPadSave(p);
    }
    musicPadRender();
    musicLinkRefreshOptions();
    const notes = [];
    if (dup) notes.push(`${dup}個はすでに入っています`);
    if (big) notes.push(`${big}個は、10MBより大きいので入れていません`);
    if (full) notes.push(`効果音は、${MUSIC_PAD_MAX}個までです`);
    showToast(added ? `${added}個の効果音を追加しました。${notes.length ? notes.join("。") + "。" : ""}` : (notes.join("。") || "追加できる効果音がありませんでした。") + (notes.length ? "。" : ""), added ? "success" : "info");
    if (added) {
        for (const p of musicPads.slice(-added)) { const b = await musicPadBuffer(p); if (!b) { bad++; p.failed = true; } }
        if (bad) showToast(`${bad}個は読み込めませんでした。長さは2分まで音のファイルだけです。`, "error");
    }
}
function musicPadClearAll() {
    if (!musicPads.length) return;
    if (!confirm("取り込んだ効果音を全て消します。よろしいですか？")) return;
    musicPadStopAll();
    musicPads = [];
    musicPadDbRun("readwrite", st => st.clear());
    musicPadRender();
    musicLinkRefreshOptions();
    showToast("効果音を全て消しました", "success");
}
// ---- 効果音を直す
function musicPadEditFill() {
    const ed = musicPadEditing, p = ed && musicPadFind(ed.id);
    if (!p) return;
    $id("musicPadEditFile").textContent = `${p.name}　${(p.size / 1024 < 1024 ? Math.round(p.size / 1024) + " KB" : (p.size / 1048576).toFixed(1) + " MB")}${p.buf ? "　" + p.buf.duration.toFixed(1) + "秒" : ""}`;
    $id("musicPadName").value = ed.name; $id("musicPadEmoji").value = ed.emoji;
    $id("musicPadVolEach").value = String(ed.vol); $id("musicPadVolEachVal").textContent = ed.vol + "%";
    $id("musicPadMode").value = ed.mode;
    document.querySelectorAll("#musicPadColors .music-swatch").forEach(b => { const on = b.dataset.color === ed.color; b.classList.toggle("is-sel", on); b.setAttribute("aria-pressed", String(on)); });
    const i = musicPads.indexOf(p);
    $id("musicPadPrev").disabled = i <= 0; $id("musicPadNext").disabled = i >= musicPads.length - 1;
}
function musicOpenPadEdit(id) {
    const p = musicPadFind(id);
    if (!p) return;
    musicPadEditing = { id: p.id, name: p.name, emoji: p.emoji, color: p.color, vol: p.vol, mode: p.mode };
    musicPadEditFill();
    musicShowView("padedit");
    musicPadBuffer(p).then(() => { if (musicPadEditing && musicPadEditing.id === p.id) musicPadEditFill(); });
    try { $id("musicPadName").focus(); } catch (e) { /* 何もしない */ }
}
function musicClosePadEdit() { if (musicPadEditing) { const p = musicPadFind(musicPadEditing.id); if (p) musicPadStopOne(p); } musicPadEditing = null; musicShowView("pad"); }
async function musicPadEditSave() {
    const ed = musicPadEditing, p = ed && musicPadFind(ed.id);
    if (!p) { musicClosePadEdit(); return; }
    p.name = ($id("musicPadName").value.trim() || p.name).slice(0, 30);
    p.emoji = ($id("musicPadEmoji").value.trim() || "🔔").slice(0, 4);
    p.color = ed.color; p.vol = ed.vol; p.mode = ed.mode;
    await musicPadSave(p);
    musicClosePadEdit();
    musicPadRender();
    musicLinkRefreshOptions();
    showToast("効果音を保存しました", "success");
}
function musicPadEditDelete() {
    const ed = musicPadEditing, p = ed && musicPadFind(ed.id);
    if (!p || !confirm(`効果音「${p.name}」を消します。よろしいですか？`)) return;
    musicPadStopOne(p);
    musicPadDbRun("readwrite", st => st.delete(p.id));
    musicPads = musicPads.filter(x => x !== p);
    if (musicGet(MUSIC_SEAT_RESULT_KEY, "") === "pad:" + p.id) musicSet(MUSIC_SEAT_RESULT_KEY, "fanfare");
    musicPadEditing = null;
    musicShowView("pad");
    musicPadRender();
    musicLinkRefreshOptions();
}
async function musicPadMove(dir) {
    const ed = musicPadEditing, p = ed && musicPadFind(ed.id);
    if (!p) return;
    const i = musicPads.indexOf(p), j = i + dir;
    if (j < 0 || j >= musicPads.length) return;
    const q = musicPads[j], o = p.order;
    p.order = q.order; q.order = o;
    if (p.order === q.order) { p.order = j; q.order = i; }
    musicPads[i] = q; musicPads[j] = p;
    await musicPadSave(p); await musicPadSave(q);
    musicPadRender(); musicPadEditFill();
}
function musicPadBind() {
    $id("musicPadGrid").addEventListener("click", e => {
        const ed = e.target.closest("[data-spad-edit]");
        if (ed) { musicOpenPadEdit(ed.dataset.spadEdit); return; }
        const b = e.target.closest("[data-spad]");
        if (b) musicPadPlay(b.dataset.spad);
    });
    $id("musicPadFileInput").addEventListener("change", e => { const f = e.target.files; musicPadAdd(f).then(() => { }); e.target.value = ""; });
    $id("musicPadStopAll").addEventListener("click", musicPadStopAll);
    $id("musicPadClear").addEventListener("click", musicPadClearAll);
    const mv = $id("musicPadMaster");
    mv.value = String(Math.round(musicPadMaster() * 100));
    mv.addEventListener("input", () => { musicSet(MUSIC_PAD_VOL_KEY, mv.value); $id("musicPadMasterVal").textContent = mv.value + "%"; });
    $id("musicPadMasterVal").textContent = mv.value + "%";
    $id("musicPadDuckOn").checked = musicPadDuckOn();
    $id("musicPadDuckOn").addEventListener("change", e => { musicSet(MUSIC_PAD_DUCK_KEY, e.target.checked ? "1" : "0"); musicPadDuckUpdate(); });
    $id("musicPadKeysOn").checked = musicPadKeysOn();
    $id("musicPadKeysOn").addEventListener("change", e => { musicSet(MUSIC_PAD_KEYS_KEY, e.target.checked ? "1" : "0"); musicPadRender(); });
    $id("musicPadEmojiQuick").innerHTML = MUSIC_PAD_EMOJI.map(m => `<button type="button" class="music-emoji-btn" data-emoji="${m}" aria-label="${m}">${m}</button>`).join("");
    $id("musicPadColors").innerHTML = MUSIC_PAD_COLORS.map((c, k) => `<button type="button" class="music-swatch" data-color="${c}" style="--pc:${c}" aria-label="色${k + 1}" aria-pressed="false"></button>`).join("");
    $id("musicPadEmojiQuick").addEventListener("click", e => { const b = e.target.closest("[data-emoji]"); if (b && musicPadEditing) { musicPadEditing.emoji = b.dataset.emoji; $id("musicPadEmoji").value = b.dataset.emoji; } });
    $id("musicPadEmoji").addEventListener("input", e => { if (musicPadEditing) musicPadEditing.emoji = e.target.value.trim().slice(0, 4) || "🔔"; });
    $id("musicPadName").addEventListener("input", e => { if (musicPadEditing) musicPadEditing.name = e.target.value; });
    $id("musicPadColors").addEventListener("click", e => { const b = e.target.closest("[data-color]"); if (b && musicPadEditing) { musicPadEditing.color = b.dataset.color; musicPadEditFill(); } });
    $id("musicPadVolEach").addEventListener("input", e => { if (musicPadEditing) { musicPadEditing.vol = Number(e.target.value); $id("musicPadVolEachVal").textContent = e.target.value + "%"; } });
    $id("musicPadMode").addEventListener("change", e => { if (musicPadEditing) musicPadEditing.mode = e.target.value; });
    $id("musicPadTest").addEventListener("click", () => { if (musicPadEditing) musicPadPlay(musicPadEditing.id, { vol: musicPadEditing.vol, mode: "overlap", test: true }); });
    $id("musicPadPrev").addEventListener("click", () => musicPadMove(-1));
    $id("musicPadNext").addEventListener("click", () => musicPadMove(1));
    $id("musicPadBack").addEventListener("click", musicClosePadEdit);
    $id("musicPadCancel").addEventListener("click", musicClosePadEdit);
    $id("musicPadSaveBtn").addEventListener("click", musicPadEditSave);
    $id("musicPadDelete").addEventListener("click", musicPadEditDelete);
    $id("musicPadEdit").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type === "text") { e.preventDefault(); musicPadEditSave(); } });
    document.addEventListener("keydown", e => {
        if (!musicPadKeysOn() || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
        const i = MUSIC_PAD_KEYCHARS.indexOf(e.key);
        if (e.key.length !== 1 || i < 0 || !musicPads[i]) return;
        const t = e.target, tag = t && t.tagName;
        if (tag === "TEXTAREA" || tag === "SELECT" || (t && t.isContentEditable)) return;
        if (tag === "INPUT" && !["checkbox", "radio", "button", "range", "file"].includes(t.type)) return;      // 文字を打つ欄では、鳴らさない
        const o = $id("musicStopOverlay");
        if (o && !o.hidden) return;
        e.preventDefault();
        musicPadPlay(musicPads[i].id);
    });
}

function musicWireDeck(el) {
    const only = fn => () => { if (el === musicAudio) fn(); };
    el.addEventListener("timeupdate", only(() => { musicUpdateTime(); musicMaybeCrossfade(); }));
    el.addEventListener("loadedmetadata", only(musicUpdateTime));
    el.addEventListener("durationchange", only(musicUpdateTime));
    el.addEventListener("play", only(musicUpdateUi));
    el.addEventListener("pause", only(musicUpdateUi));
    el.addEventListener("ended", only(musicOnEnded));
    el.addEventListener("error", only(() => {
        if (!musicAudio.getAttribute("src")) return;
        const t = musicTracks[musicIndex];
        showToast(`「${t ? t.name : "この曲"}」を再生できませんでした。他の曲へ進みます。`, "error");
        if (musicTracks.length > 1) musicNext(true); else musicStopNow();
    }));
}

function musicBuild() {
    if ($id("musicPlayerBtn")) return;
    const st = document.createElement("style");
    st.id = "musicPlayerStyle";
    st.textContent = MUSIC_CSS;
    document.head.appendChild(st);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.id = "musicPlayerBtn";
    btn.className = "btn-config-toggle btn-music-toggle";
    btn.textContent = "🎵 音楽";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "musicPanel");
    btn.addEventListener("click", musicTogglePanel);
    const anchor = $id("configMenuBtn");
    if (anchor) anchor.insertAdjacentElement("afterend", btn); else document.body.appendChild(btn);

    const panel = document.createElement("div");
    panel.id = "musicPanel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-label", "音楽プレーヤー");
    panel.hidden = true;
    panel.innerHTML = `
        <div class="music-head"><b>音楽プレーヤー</b><button type="button" class="music-x" id="musicCloseBtn" aria-label="閉じる">✕</button></div>
        <div id="musicMain">
        <div class="music-nowbox"><div class="music-cover" id="musicCover" aria-hidden="true">♪</div><div class="music-nowtext"><div class="music-now" id="musicNow">曲を追加してください</div><div class="music-sub" id="musicNowSub" hidden></div><div class="music-sub" id="musicNowComp" hidden></div></div></div>
        <div class="music-seek"><span id="musicCur">0:00</span><input type="range" id="musicSeek" min="0" max="1000" value="0" aria-label="再生の位置"><span id="musicDur">0:00</span></div>
        <div class="music-ctrl">
            <button type="button" id="musicShuffleBtn" aria-label="シャッフル">🔀</button>
            <button type="button" id="musicPrevBtn" aria-label="前の曲">⏮</button>
            <button type="button" id="musicPlayBtn" class="music-play" aria-label="再生">▶</button>
            <button type="button" id="musicNextBtn" aria-label="次の曲">⏭</button>
            <button type="button" id="musicRepeatBtn" aria-label="くり返し">🔁</button>
        </div>
        <div class="music-vol"><span aria-hidden="true">🔈</span><input type="range" id="musicVol" min="0" max="100" aria-label="音量"><span aria-hidden="true">🔊</span></div>
        <div class="music-tabs" id="musicTabs" role="tablist" aria-label="表示の切り替え"><button type="button" role="tab" data-tab="main" class="is-sel" aria-selected="true">曲</button><button type="button" role="tab" data-tab="eq" aria-selected="false">EQ</button><button type="button" role="tab" data-tab="dj" aria-selected="false">DJ</button><button type="button" role="tab" data-tab="pad" aria-selected="false">効果音</button><button type="button" role="tab" data-tab="link" aria-selected="false">連動</button></div>
        <div id="musicLibrary">
        <div class="music-scenes" id="musicScenes" aria-label="場面"></div>
        <label class="music-group-sel" for="musicGroupSel"><span>並べ方</span><select id="musicGroupSel"><option value="none">そのまま</option><option value="album">アルバムごと</option><option value="artist">歌手ごと</option></select></label>
        <ul class="music-list" id="musicList"></ul>
        <div class="music-add">
            <label for="musicFileInput">曲を追加</label>
            <label for="musicFolderInput">フォルダから追加</label>
            <button type="button" id="musicBatchBtn">まとめて調べる</button>
            <button type="button" id="musicClearBtn">全部消す</button>
        </div>
        <label class="music-auto" id="musicAutoLabel"><input type="checkbox" id="musicAutoLookup"><span>曲を追加したら、ネットで自動で調べる</span></label>
        <label class="music-auto" id="musicNormLabel"><input type="checkbox" id="musicNormOn"><span>曲ごとの音量をそろえる</span></label>
        <div class="music-add music-backup"><button type="button" id="musicExportBtn">バックアップを書き出す</button><label for="musicImportInput" tabindex="0" id="musicImportLabel">バックアップを読み込む</label></div>
        <p class="music-status" id="musicStatus" aria-live="polite"></p>
        <input type="file" id="musicImportInput" accept=".zip,application/zip" hidden>
        <input type="file" id="musicFileInput" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac" multiple hidden>
        <input type="file" id="musicFolderInput" webkitdirectory multiple hidden>
        <p class="music-note" id="musicNote">音楽のファイルはここにドラッグしても追加できます</p>
        </div>
        <div id="musicEqView" hidden>
            <canvas class="music-spec" width="600" height="72" aria-hidden="true"></canvas>
            <div class="music-eq-top"><label class="music-eq-on"><input type="checkbox" id="musicEqOn"><span>イコライザーを使う</span></label><select id="musicEqPreset" aria-label="音の作り方">${MUSIC_EQ_PRESETS.map(p => `<option value="${p[0]}">${p[1]}</option>`).join("")}<option value="custom">自分で調整</option></select></div>
            <div class="music-eq-bands">${MUSIC_EQ_FREQS.map((f, i) => `<div class="music-eq-band"><span class="music-eq-db" id="musicEqDb${i}">0</span><div class="music-eq-wrap"><input type="range" class="music-eq-slider" data-band="${i}" min="-12" max="12" step="1" value="0" aria-label="${MUSIC_EQ_LABELS[i]}ヘルツの音の大きさ"></div><span class="music-eq-hz">${MUSIC_EQ_LABELS[i]}</span></div>`).join("")}</div>
            <div class="music-eq-scale"><span>低い音</span><span>高い音</span></div>
            <div class="music-eq-pre"><span>全体の音量</span><input type="range" id="musicEqPre" min="-12" max="12" step="1" value="0" aria-label="全体の音量の調整"><span id="musicEqPreVal">0 dB</span></div>
            <div class="music-edit-actions"><button type="button" class="music-btn" id="musicEqReset">リセット</button></div>
            <p class="music-note" id="musicEqNote">上げすぎて音がわれないように、自動で抑えます</p>
        </div>
        <div id="musicDjView" hidden>
            <canvas class="music-spec" width="600" height="72" aria-hidden="true"></canvas>
            <section class="music-dj-sec"><h4>速さ</h4>
                <div class="music-dj-row"><input type="range" id="musicSpeed" min="50" max="150" step="1" value="100" aria-label="再生の速さ"><span class="music-dj-val" id="musicSpeedVal">×1.00</span><button type="button" class="music-btn" id="musicSpeedReset">もどす</button></div>
                <label class="music-alb-over"><input type="checkbox" id="musicKeepPitch" checked><span>速さを変えても音の高さは変えない</span></label></section>
            <section class="music-dj-sec"><h4>フィルター</h4>
                <div class="music-dj-row"><input type="range" id="musicDjFilter" min="-100" max="100" step="1" value="0" aria-label="フィルター"><span class="music-dj-val" id="musicDjFilterVal">なし</span><button type="button" class="music-btn" id="musicDjFilterReset">なし</button></div>
                <div class="music-eq-scale"><span>← 低い音だけ</span><span>高い音だけ →</span></div></section>
            <section class="music-dj-sec"><h4>エコー・レコード</h4>
                <div class="music-dj-row"><button type="button" class="music-btn" id="musicEchoBtn" aria-pressed="false">エコー：オフ</button><input type="range" id="musicEchoAmt" min="0" max="100" step="1" value="50" aria-label="エコーの強さ"></div>
                <div class="music-dj-row"><button type="button" class="music-btn" id="musicSpinStop">レコードストップ</button><button type="button" class="music-btn" id="musicSpinStart">スピンアップ</button></div></section>
            <section class="music-dj-sec"><h4>ループ</h4>
                <div class="music-dj-row"><button type="button" class="music-btn" id="musicLoopIn">IN</button><button type="button" class="music-btn" id="musicLoopOut">OUT</button><button type="button" class="music-btn" id="musicLoop4">4秒</button><button type="button" class="music-btn" id="musicLoopClear" disabled>解除</button></div>
                <p class="music-status" id="musicLoopInfo">ループはしていません</p></section>
            <section class="music-dj-sec"><h4>キュー</h4>
                <div class="music-dj-row"><button type="button" class="music-btn" id="musicToStart">頭</button>${[0, 1, 2, 3].map(n => `<button type="button" class="music-btn music-cue" data-cue="${n}">${n + 1}：－</button>`).join("")}</div>
                <p class="music-status">空のキューを押すと今の場所を覚えます。覚えたキューを押すとそこへ飛びます。消すには、Shift を押しながら押します。</p></section>
            <section class="music-dj-sec"><h4>曲のつなぎ目を重ねる</h4>
                <div class="music-dj-row"><input type="range" id="musicXfade" min="0" max="12" step="1" value="0" aria-label="曲のつなぎ目を重ねる秒数"><span class="music-dj-val" id="musicXfadeVal">なし</span></div></section>
            <section class="music-dj-sec"><h4>効果音パッド</h4>
                <div class="music-pads"><button type="button" class="music-pad" data-pad="fanfare">ファンファーレ</button><button type="button" class="music-pad" data-pad="drumroll">ドラムロール</button><button type="button" class="music-pad" data-pad="horn">ホーン</button><button type="button" class="music-pad" data-pad="siren">サイレン</button><button type="button" class="music-pad" data-pad="laser">レーザー</button><button type="button" class="music-pad" data-pad="clap">拍手</button></div></section>
        </div>
        <div id="musicPadView" hidden>
            <div class="music-padgrid" id="musicPadGrid"></div>
            <div class="music-add"><label for="musicPadFileInput" tabindex="0">効果音を追加</label><button type="button" id="musicPadStopAll" disabled>全部止める</button><button type="button" id="musicPadClear">全部消す</button></div>
            <input type="file" id="musicPadFileInput" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac" multiple hidden>
            <section class="music-dj-sec" style="margin-top:10px"><h4>効果音の設定</h4>
                <div class="music-dj-row"><span>音量</span><input type="range" id="musicPadMaster" min="0" max="100" step="1" value="100" aria-label="効果音ぜんたいの音量"><span class="music-dj-val" id="musicPadMasterVal">100%</span></div>
                <label class="music-alb-over" id="musicPadDuckLabel"><input type="checkbox" id="musicPadDuckOn"><span>鳴らす間は音楽を小さくする</span></label>
                <label class="music-alb-over" id="musicPadKeysLabel"><input type="checkbox" id="musicPadKeysOn"><span>数字キーで鳴らす</span></label></section>
            <p class="music-note" id="musicPadNote">音のファイルはここにドラッグしても追加できます</p>
        </div>
        <div id="musicLinkView" hidden>
            <section class="music-dj-sec"><h4 id="musicSeatHead">🪑 席替えの演出と連動</h4>
                <label class="music-eq-on"><input type="checkbox" id="musicSeatOn"><span>席替えに合わせて、曲を流す</span></label>
                <div class="music-form">
                    <label for="musicSeatStart">席替えを始めた時に流す曲</label><select id="musicSeatStart"></select>
                    <label for="musicSeatResult">結果が出た時の効果音</label><select id="musicSeatResult"><option value="fanfare">ファンファーレ</option><option value="clap">拍手</option><option value="horn">ホーン</option><option value="drumroll">ドラムロール</option><option value="none">なし</option></select>
                    <label for="musicSeatAfter">その後の曲</label><select id="musicSeatAfter"><option value="keep">そのまま流す</option><option value="quiet">小さくして流す</option><option value="stop">ゆっくり止める</option></select>
                    <label for="musicSeatDelay">スロットなど以外の演出は、何秒後に「終わった」とみなす</label><input type="number" id="musicSeatDelay" min="1" max="30" step="1" value="4">
                </div>
                <div class="music-dj-row" style="margin-top:8px"><button type="button" class="music-btn" id="musicSeatTest">試してみる</button></div>
</section>
            <section class="music-dj-sec"><h4 id="musicStopHead">🎯 ストップ指名</h4>
                <div class="music-form"><label for="musicStopStart">始める時に流す曲</label><select id="musicStopStart"></select></div>
                <label class="music-alb-over"><input type="checkbox" id="musicStopNoRepeat"><span>前回の人は続けて出さない</span></label>
                <div class="music-edit-actions" style="margin-top:8px"><button type="button" class="music-btn primary" id="musicStopOpen">ストップ指名をはじめる</button></div></section>
        </div>
        </div>
        <div id="musicPadEdit" hidden>
            <div class="music-head"><b>効果音を直す</b><button type="button" class="music-x" id="musicPadBack" aria-label="もどる">← もどる</button></div>
            <div class="music-edit-file" id="musicPadEditFile"></div>
            <div class="music-form">
                <label for="musicPadName">名前</label><input type="text" id="musicPadName" maxlength="30">
                <label for="musicPadEmoji">絵文字</label><input type="text" id="musicPadEmoji" maxlength="4">
            </div>
            <div class="music-emoji-row" id="musicPadEmojiQuick"></div>
            <div class="music-form"><label>色</label></div>
            <div class="music-emoji-row" id="musicPadColors"></div>
            <div class="music-form"><label for="musicPadVolEach">この効果音の音量</label></div>
            <div class="music-dj-row"><input type="range" id="musicPadVolEach" min="0" max="200" step="5" value="100" aria-label="この効果音の音量"><span class="music-dj-val" id="musicPadVolEachVal">100%</span></div>
            <div class="music-form"><label for="musicPadMode">鳴らし方</label><select id="musicPadMode"><option value="once">1回だけ。もう一度押すと最初から</option><option value="overlap">押すたびに重ねて鳴らす</option><option value="loop">くり返す。もう一度押すと止まる</option></select></div>
            <div class="music-edit-actions" style="margin-top:8px"><button type="button" class="music-btn" id="musicPadTest">試しに鳴らす</button><button type="button" class="music-btn" id="musicPadPrev">前へ</button><button type="button" class="music-btn" id="musicPadNext">後ろへ ▶</button></div>
            <div class="music-edit-actions" style="margin-top:8px"><button type="button" class="music-btn primary" id="musicPadSaveBtn">保存</button><button type="button" class="music-btn" id="musicPadCancel">キャンセル</button><button type="button" class="music-btn" id="musicPadDelete">この効果音を消す</button></div>
        </div>
        <div id="musicPlEdit" hidden>
            <div class="music-head"><b>場面を作る・直す</b><button type="button" class="music-x" id="musicPlBack" aria-label="もどる">← もどる</button></div>
            <div class="music-form"><label for="musicPlName">場面の名前</label><input type="text" id="musicPlName" maxlength="30" placeholder="例：朝の会、そうじ、帰りの会"></div>
            <label class="music-alb-over"><input type="checkbox" id="musicPlShuffle"><span>この場面はシャッフルして流す</span></label>
            <div class="music-edit-actions"><button type="button" class="music-btn" id="musicPlAll">全部えらぶ</button><button type="button" class="music-btn" id="musicPlNone">全部はずす</button></div>
            <div class="music-alb-targets" id="musicPlTracks"></div>
            <div class="music-edit-actions"><button type="button" class="music-btn primary" id="musicPlSave">保存</button><button type="button" class="music-btn" id="musicPlCancel">キャンセル</button><button type="button" class="music-btn" id="musicPlDelete" hidden>この場面を消す</button></div>
        </div>
        <div id="musicEdit" hidden>
            <div class="music-head"><b>✎ 曲の情報</b><button type="button" class="music-x" id="musicEditBack" aria-label="もどる">← もどる</button></div>
            <div class="music-edit-top"><div class="music-edit-cover" id="musicEditCover" aria-hidden="true">♪</div><div class="music-edit-file" id="musicEditFile"></div></div>
            <div class="music-form">
                <label for="musicFTitle">曲名</label><input type="text" id="musicFTitle" maxlength="200">
                <label for="musicFArtist">歌手・アーティスト</label><input type="text" id="musicFArtist" maxlength="200">
                <label for="musicFAlbum">アルバム</label><input type="text" id="musicFAlbum" maxlength="200">
                <label for="musicFComposer">作曲者</label><input type="text" id="musicFComposer" maxlength="200">
                <label for="musicFYear">年</label><input type="text" id="musicFYear" maxlength="4" inputmode="numeric">
                <label for="musicFGenre">ジャンル</label><input type="text" id="musicFGenre" maxlength="80">
            </div>
            <div class="music-edit-actions"><button type="button" class="music-btn" id="musicSearchBtn">ネットで調べる</button><button type="button" class="music-btn" id="musicEditAlbumBtn">アルバムで調べる</button></div>
            <div class="music-edit-actions" style="margin-top:6px"><button type="button" class="music-btn" id="musicCoverClear">表紙を消す</button></div>
            <p class="music-status" id="musicEditMsg" aria-live="polite"></p>
            <div class="music-cands" id="musicCands"></div>
            <div class="music-edit-actions"><button type="button" class="music-btn primary" id="musicEditSave">保存</button><button type="button" class="music-btn" id="musicEditCancel">キャンセル</button></div>
        </div>
        <div id="musicAlbum" hidden>
            <div class="music-head"><b>アルバムで調べる</b><button type="button" class="music-x" id="musicAlbBack" aria-label="もどる">← もどる</button></div>
            <div class="music-alb-q"><input type="text" id="musicAlbQ" maxlength="120" aria-label="アルバム名や歌手名" placeholder="アルバム名　歌手名"><button type="button" class="music-btn" id="musicAlbSearchBtn">調べる</button></div>
            <p class="music-status" id="musicAlbMsg" aria-live="polite"></p>
            <div class="music-cands" id="musicAlbCands"></div>
            <p class="music-alb-sel" id="musicAlbSel"></p>
            <div class="music-alb-targets" id="musicAlbTargets"></div>
            <label class="music-alb-over"><input type="checkbox" id="musicAlbOverwrite"><span>すでに入っている情報も、上書きする</span></label>
            <div class="music-edit-actions"><button type="button" class="music-btn primary" id="musicAlbApply" disabled>入れる</button><button type="button" class="music-btn" id="musicAlbCancel">キャンセル</button></div>
        </div>`;
    if (anchor) btn.insertAdjacentElement("afterend", panel); else document.body.appendChild(panel);
    if (typeof makeInfoTip === "function") {
        $id("musicNote").appendChild(makeInfoTip("追加した曲はこのパソコンのブラウザの中に残ります。別のパソコンや、ブラウザの履歴を消した後は、もう一度追加してください。曲のファイルはどこにも送られません。曲名・歌手・アルバムなどは、曲のファイルに入っている情報を読み取って表示します。ネットで調べる時だけ、曲名と歌手名を、Appleの検索（iTunes）に送ります。オフラインモードの間は、調べません。"));
        $id("musicAutoLabel").appendChild(makeInfoTip("オンにすると曲を追加した時に曲名や歌手名で曲の情報と表紙を探して、足りない所を埋めます。曲のファイルは送りません。最初はオフです。"));
    }

    if (typeof makeInfoTip === "function") {
        $id("musicSeatHead").appendChild(makeInfoTip("スロット、ストップボタン式スロット、ドラムロールは演出が終わった時に効果音が鳴ります。他の演出は下の秒数の後に鳴ります。演出なしの時はすぐに鳴ります。"));
        $id("musicStopHead").appendChild(makeInfoTip("曲が流れている間、画面で名前が高速に入れ替わります。「STOP！」を押すか、Spaceキーを押した時に出ていた人が、指名されます。休みの人は出ません。この指名は指名機能の履歴には残りません。"));
        $id("musicPadDuckLabel").appendChild(makeInfoTip("効果音を鳴らしている間だけ、音楽を小さくします。くり返す効果音は小さくしません。"));
        $id("musicPadKeysLabel").appendChild(makeInfoTip("オンの間は画面の入力欄の外で数字キーの 1 から 0 を押すと、左から10個までの効果音が鳴ります"));
        $id("musicPadNote").appendChild(makeInfoTip("取り込んだ効果音はこのパソコンのブラウザの中に残ります。1つ10MBまで長さ2分までです。40個まで入れられます。鳴らし方は各効果音の「✎」で選べます。席替えの結果の効果音にも使えます。"));
        $id("musicNormLabel").appendChild(makeInfoTip("大きすぎる曲だけを小さくします。小さい曲を大きくはしません。最初に曲を調べるので少し時間がかかります。大きすぎるファイルは調べません。"));
    }
    musicFxBind();
    musicDecks = [new Audio(), new Audio()];
    musicDecks.forEach(d => { d.preload = "metadata"; d.volume = musicVolume(); musicWireDeck(d); });
    musicAudio = musicDecks[0];

    $id("musicCloseBtn").addEventListener("click", () => musicSetPanel(false));
    // つまみを動かしたとき・ボタンで値が変わったときに、色のついた部分を合わせる
    {
        const pn = $id("musicPanel");
        pn.addEventListener("input", e => { if (e.target && e.target.type === "range") musicPaintRange(e.target); });
        pn.addEventListener("change", () => musicPaintRanges());
        pn.addEventListener("click", () => setTimeout(musicPaintRanges, 0));
        setTimeout(musicPaintRanges, 0);
    }
    $id("musicPlayBtn").addEventListener("click", musicToggle);
    $id("musicNextBtn").addEventListener("click", () => { if (musicTracks.length) musicNext(false); });
    $id("musicPrevBtn").addEventListener("click", musicPrev);
    $id("musicShuffleBtn").addEventListener("click", musicToggleShuffle);
    $id("musicRepeatBtn").addEventListener("click", musicCycleRepeat);
    $id("musicClearBtn").addEventListener("click", musicClearAll);
    $id("musicBatchBtn").addEventListener("click", () => musicLookupBatch(musicTracks, false));
    const autoBox = $id("musicAutoLookup");
    autoBox.checked = musicAutoLookupOn();
    autoBox.addEventListener("change", () => {
        musicSet(MUSIC_AUTO_KEY, autoBox.checked ? "1" : "0");
        showToast(autoBox.checked ? "曲を追加したら、ネットで自動で調べます。" : "自動で調べるのをやめました。", "success");
    });
    const gsel = $id("musicGroupSel");
    gsel.value = musicGroupMode();
    gsel.addEventListener("change", () => { musicSet(MUSIC_GROUP_KEY, gsel.value); musicRefreshAll(); });
    $id("musicAlbBack").addEventListener("click", musicCloseAlbum);
    $id("musicAlbCancel").addEventListener("click", musicCloseAlbum);
    $id("musicAlbSearchBtn").addEventListener("click", musicAlbSearch);
    $id("musicAlbApply").addEventListener("click", musicAlbApply);
    $id("musicAlbQ").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); musicAlbSearch(); } });
    $id("musicAlbCands").addEventListener("click", e => { const b = e.target.closest(".music-cand"); if (b) musicAlbPick(Number(b.dataset.k)); });
    $id("musicAlbTargets").addEventListener("change", e => {
        const c = e.target.closest("input[data-id]");
        if (!c || !musicAlb) return;
        if (c.checked) musicAlb.checked.add(c.dataset.id); else musicAlb.checked.delete(c.dataset.id);
        musicAlbRenderTargets();
    });
    $id("musicEditAlbumBtn").addEventListener("click", () => {
        if (!musicEditing) return;
        const t = musicTracks.find(x => x.id === musicEditing.id);
        if (!t) return;
        const album = (t.meta && t.meta.album) || $id("musicFAlbum").value.trim();
        const targets = album ? musicTracks.filter(x => x.meta && x.meta.album === album) : [t];
        if (!targets.includes(t)) targets.push(t);
        const seed = musicAlbumSeedQuery(targets) || ($id("musicFArtist").value.trim());
        musicCloseEdit();
        musicOpenAlbum(targets, seed);
    });
    $id("musicEditBack").addEventListener("click", musicCloseEdit);
    $id("musicEditCancel").addEventListener("click", musicCloseEdit);
    $id("musicEditSave").addEventListener("click", musicEditSave);
    $id("musicSearchBtn").addEventListener("click", musicEditSearch);
    $id("musicCoverClear").addEventListener("click", () => { if (musicEditing) { musicEditing.cover = null; musicEditing.coverRemote = ""; musicEditCoverRender(); } });
    $id("musicCands").addEventListener("click", e => { const b = e.target.closest(".music-cand"); if (b) musicPickCandidate(Number(b.dataset.k)); });
    $id("musicEdit").addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT") { e.preventDefault(); musicEditSearch(); } });
    const vol = $id("musicVol");
    vol.value = String(Math.round(musicVolumeBase() * 100));
    vol.addEventListener("input", () => {
        musicSet(MUSIC_VOL_KEY, String(Number(vol.value) / 100));
        if (musicFadeTimer) { clearInterval(musicFadeTimer); musicFadeTimer = null; }
        musicAudio.volume = musicVolume();
    });
    const seek = $id("musicSeek");
    seek.addEventListener("input", () => { musicSeeking = true; const d = musicAudio.duration; if (isFinite(d)) $id("musicCur").textContent = musicFmt(d * Number(seek.value) / 1000); });
    seek.addEventListener("change", () => { const d = musicAudio.duration; if (isFinite(d) && d > 0) musicAudio.currentTime = d * Number(seek.value) / 1000; musicSeeking = false; });
    $id("musicFileInput").addEventListener("change", e => { musicAddFiles(e.target.files); e.target.value = ""; });
    $id("musicFolderInput").addEventListener("change", e => { musicAddFiles(e.target.files); e.target.value = ""; });
    $id("musicList").addEventListener("click", e => {
        const del = e.target.closest("[data-del]");
        if (del) { musicRemove(Number(del.dataset.del)); return; }
        const ed = e.target.closest("[data-edit]");
        if (ed) { musicOpenEdit(Number(ed.dataset.edit)); return; }
        const alb = e.target.closest("[data-album-gi]");
        if (alb) {
            const first = musicTracks[Number(alb.dataset.albumGi)];
            if (!first) return;
            const key = musicGroupInfo(first, "album").key;
            const targets = musicTracks.filter(x => musicGroupInfo(x, "album").key === key);
            musicOpenAlbum(targets, musicAlbumSeedQuery(targets));
            return;
        }
        const play = e.target.closest(".music-item-play");
        if (play) {
            const i = Number(play.dataset.i);
            if (i === musicIndex && musicAudio.src) { musicToggle(); return; }
            if (musicIndex >= 0) musicHistory.push(musicIndex);
            musicBag = [];
            musicPlayIndex(i);
        }
    });
    panel.addEventListener("dragover", e => { e.preventDefault(); panel.classList.add("is-drop"); });
    panel.addEventListener("dragleave", () => panel.classList.remove("is-drop"));
    panel.addEventListener("drop", e => { e.preventDefault(); panel.classList.remove("is-drop"); if (e.dataTransfer && e.dataTransfer.files) { if (musicTab === "pad" && !$id("musicMain").hidden) musicPadAdd(e.dataTransfer.files); else musicAddFiles(e.dataTransfer.files); } });
    panel.addEventListener("keydown", e => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        if (musicEditing) { musicCloseEdit(); return; }
        if (musicAlb) { musicCloseAlbum(); return; }
        if (musicPlEditing) { musicClosePlEdit(); return; }
        if (musicPadEditing) { musicClosePadEdit(); return; }
        musicSetPanel(false); btn.focus();
    });

    musicV14Bind();
    musicPadBind();
    musicRenderList();
    musicRenderNow();
    musicUpdateUi();
}
async function musicLoadSaved() {
    const res = await musicDbRun("readonly", st => st.getAll());
    musicDbOk = res.ok;
    if (!res.ok || !Array.isArray(res.result)) { musicPadLoadSaved(); return; }
    const mres = await musicDbRun("readonly", (st, ms) => ms.getAll());
    const metaMap = new Map();
    if (mres.ok && Array.isArray(mres.result)) mres.result.forEach(r => { if (r && r.id) metaMap.set(r.id, r); });
    const have = new Set(musicTracks.map(t => t.id));
    res.result.sort((a, b) => (a.order || 0) - (b.order || 0)).forEach(r => {
        if (r && r.blob && !have.has(r.id)) musicTracks.push({ id: r.id, name: r.name, size: r.size, blob: r.blob, url: "", order: r.order || 0, meta: metaMap.has(r.id) ? musicMetaFromRecord(metaMap.get(r.id)) : null });
    });
    if (musicIndex < 0 && musicTracks.length) musicIndex = 0;
    musicRenderList();
    musicRenderNow();
    musicLinkRefreshOptions();
    musicPadLoadSaved();
    musicEnrichPending().then(() => musicNormAnalyzeAll());      // 前のバージョンで入れた曲は、ここで情報を読む
}

SekigaeApp.registerPlugin({
    id: "music",
    name: "音楽プレーヤー",
    version: "1.6",
    description: "授業中の音楽を流します。自分のパソコンの音楽ファイルを追加して、再生・一時停止・前へ・次へ・シャッフル・くり返しができます。曲名・歌手・作曲者・表紙を、ファイルから読み取って表示し、足りない情報はネットで自動検索もできます。アルバムごと・歌手ごとに並べたり、アルバム単位でまとめて調べたりもできます。イコライザーと、DJ機能（曲の重ね・速さ・フィルター・エコー・ループ・効果音）も使えます。席替えの演出に合わせて曲を流したり、名前が止まった人を指名する「ストップ指名」、場面ごとの曲の組み合わせ、曲ごとの音量そろえ、バックアップの書き出し・読み込みもできます。外から取り込んだ効果音を、ぽちぽち押して鳴らす効果音パッドもあります。曲はこのパソコンのブラウザに残ります。",
    backupKeys: [MUSIC_VOL_KEY, MUSIC_SHUFFLE_KEY, MUSIC_REPEAT_KEY, MUSIC_AUTO_KEY, MUSIC_GROUP_KEY, MUSIC_EQ_ON_KEY, MUSIC_EQ_GAINS_KEY, MUSIC_EQ_PRE_KEY, MUSIC_XFADE_KEY, MUSIC_NORM_KEY, MUSIC_SEAT_ON_KEY, MUSIC_SEAT_START_KEY, MUSIC_SEAT_RESULT_KEY, MUSIC_SEAT_AFTER_KEY, MUSIC_SEAT_DELAY_KEY, MUSIC_STOP_START_KEY, MUSIC_STOP_NOREPEAT_KEY, MUSIC_PAD_VOL_KEY, MUSIC_PAD_DUCK_KEY, MUSIC_PAD_KEYS_KEY],
    searchWords: "音楽 BGM 曲 プレーヤー 再生 音量 シャッフル 曲名 歌手 アーティスト 作曲 作曲者 アルバム 表紙 ジャケット 検索 タグ 並べ方 グループ 分ける イコライザー イコライザ 音質 低音 高音 DJ ディージェー クロスフェード エコー ループ キュー 効果音 ファンファーレ ドラムロール 速さ テンポ 効果音 パッド サウンドボード 取り込み ぽちぽち SE 鳴らす 席替え 連動 ストップ 指名 名前 止める 場面 プレイリスト 朝の会 帰りの会 音量 そろえる ノーマライズ バックアップ 書き出し 読み込み 引っ越し 移行 保存",
    mount(app) {
        musicBuild();
        app.insertInto("guide-faq", "<li><strong>授業中に音楽を流したい</strong>：画面の左にある「音楽」を押して、「曲を追加」から、音楽のファイルを入れます。再生・一時停止・前へ・次へ・シャッフル・くり返し・音量が使えます。曲はこのパソコンのブラウザに残るので、次に開いた時もそのまま使えます。</li><li><strong>曲名や作曲者を出したい</strong>：曲を追加するとファイルに入っている曲名・歌手・アルバム・作曲者・表紙を、自動で読み取って表示します。足りない時は曲の横の「✎」で直せます。「まとめて調べる」を押すとネットで探して、空いている所を埋めます（曲名と歌手名だけを、Appleの検索に送ります）。作曲者は検索では出ないことが多いので、直接入れてください。</li><li><strong>アルバムや歌手ごとに分けたい</strong>：「音楽」の「並べ方」を、「アルバムごと」か「歌手ごと」にすると見出しを付けて分けます。再生の順番もその並びになります。アルバムごとの見出しの「💿」を押すとそのアルバムの曲をまとめて調べて、曲名・歌手・年・表紙・曲の順番を入れられます。</li><li><strong>音の聞こえ方を変えたい</strong>：「音楽」の「🎚 イコライザー」で、低い音・高い音の大きさを、10本のつまみで変えられます。「教室向け」「声をはっきり」などの、できあいの設定もあります。</li><li><strong>DJのように音楽を流したい</strong>：「音楽」の「DJ」で、速さ・フィルター・エコー・レコードストップ・ループ・キュー・曲のつなぎ目を重ねる機能・効果音パッド（ファンファーレ、ドラムロールなど）が使えます。</li><li><strong>席替えの演出に合わせて曲を流したい</strong>：「音楽」の「連動」で「席替えに合わせて、曲を流す」をオンにします。席替えを始めると曲が流れ、結果が出た時に効果音（ファンファーレなど）が鳴ります。スロットなどは演出が終わった時に、他の演出は決めた秒数の後に鳴ります。</li><li><strong>曲を流しながら、くじのように人を指名したい</strong>：「連動」の「ストップ指名をはじめる」を押すと曲が流れて、名前が高速で入れ替わります。「STOP！」か、Spaceキーを押した時に出ていた人が指名されます。休みの人は出ません。</li><li><strong>場面ごとに曲を分けたい（朝の会・そうじ・帰りの会など）</strong>：「音楽」の「曲」の画面の上にある「＋ 場面を作る」で、場面の名前を付けて、曲を選びます。場面のボタンを押すとその場面の曲だけが流れます。「全て」で、もとにもどります。</li><li><strong>曲によって音の大きさがバラバラ</strong>：「曲ごとの音量をそろえる」をオンにすると大きすぎる曲だけを小さくします。小さい曲を大きくはしません。最初に調べる時間が少しかかります。</li><li><strong>効果音を取り込んでぽちぽち押して鳴らしたい</strong>：「音楽」の「効果音」で、「効果音を追加」から、音のファイルを入れます。四角いボタンを押すとすぐに鳴ります。ボタンの「✎」で、名前・絵文字・色・音量・鳴らし方を変えられます。鳴らし方は、1回だけ、重ねて鳴らす、くり返す、から選べます。席替えの結果の効果音にも使えます。</li><li><strong>曲ごと別のパソコンに移したい</strong>：「バックアップを書き出す」で、曲・効果音・曲の情報・場面・設定を、一つのZIPファイルにします。別のパソコンの「バックアップを読み込む」で、そのファイルを選ぶと同じ状態にもどります。</li>");
    },
    ready() {
        musicLoadSaved();
        if (musicGet(MUSIC_OPEN_KEY, "0") === "1") musicSetPanel(true);
    }
});
