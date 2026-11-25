// ==========================================
// テスト用の座席プラグイン：テストや検定のために、①番号が近い人どうしが隣にならない「千鳥配置」、②A・B問題を交互に配る版の割り当て、③机に置く「受験番号札」の印刷、をします
// 席を並べ替えるのは、いま座席表にある生徒だけです（固定した席・空席・お休みの席は動かしません）。並べ替えは、「1つ前に戻す」で戻せます
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります（設定は、ブラウザに残ります）
// ==========================================
const EXAM_KEY = "exam_seats_cfg_v1";   // { show: 座席表に版を出す, pat: 版の割り当て方（check／col／row）, n: 版の数, per: 札の枚数, name: 札に名前を入れる, ver: 札に版を入れる, seat: 札に席を入れる }
const EXAM_VERS = ["A", "B", "C", "D"];
const EXAM_DEFAULT = { show: false, pat: "check", n: 2, per: 4, name: true, ver: true, seat: true };

function examCfg() {
    let c = {};
    try { c = JSON.parse(lsGet(EXAM_KEY, "{}")) || {}; } catch (e) { c = {}; }
    const r = Object.assign({}, EXAM_DEFAULT, c);
    r.n = [2, 3, 4].includes(+r.n) ? +r.n : 2;
    r.per = [1, 2, 4, 8].includes(+r.per) ? +r.per : 4;
    if (!["check", "col", "row"].includes(r.pat)) r.pat = "check";
    return r;
}
function examSetCfg(patch) {
    const c = Object.assign(examCfg(), patch);
    lsSet(EXAM_KEY, JSON.stringify(c));
    return c;
}
function examEsc(t) { return String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

// ---- 座席の読み取り ----
function examCols() { return typeof getGridCols === "function" ? getGridCols() : 6; }
function examNo(seat) {
    const p = getSeatDisplayParts(seat.text);
    const n = parseInt(p.no, 10);
    return Number.isFinite(n) ? n : null;
}
function examStudentIdx() {
    const out = [];
    (currentStudents || []).forEach((s, i) => { if (s && s.type === "STUDENT" && s.text) out.push(i); });
    return out;
}
// 番号の小さい順（番号がない人は最後に、いまの並びのまま）
function examSortedByNo(idxList) {
    return idxList.map((i, k) => ({ i, k, n: examNo(currentStudents[i]) }))
        .sort((a, b) => ((a.n === null) - (b.n === null)) || ((a.n !== null && b.n !== null) ? a.n - b.n : 0) || a.k - b.k)
        .map(o => o.i);
}

// ---- 版（A・B問題）----
function examVerOf(idx, cols, cfg) {
    const r = Math.floor(idx / cols), c = idx % cols;
    const v = cfg.pat === "col" ? c : cfg.pat === "row" ? r : (r + c);
    return EXAM_VERS[v % cfg.n];
}
function examVerCounts(cfg) {
    const cols = examCols();
    const cnt = {};
    EXAM_VERS.slice(0, cfg.n).forEach(v => { cnt[v] = 0; });
    examStudentIdx().forEach(i => { if (!currentStudents[i].isAbsent) cnt[examVerOf(i, cols, cfg)]++; });
    return cnt;
}

function examDecorate() {
    const cfg = examCfg();
    document.querySelectorAll("#classroom .seat .exam-ver").forEach(e => e.remove());
    if (!cfg.show) return;
    const cols = examCols();
    document.querySelectorAll("#classroom .seat").forEach(el => {
        if (!el.dataset.seatKey || el.dataset.seatIndex === undefined) return;
        const idx = parseInt(el.dataset.seatIndex, 10);
        const s = currentStudents[idx];
        if (!s || s.type !== "STUDENT") return;
        const v = examVerOf(idx, cols, cfg);
        const tag = document.createElement("span");
        tag.className = "exam-ver exam-ver-" + v;
        tag.textContent = v;
        el.appendChild(tag);
    });
}

// ---- 並べ替え ----
function examArrange(mode) {
    if (typeof isAppLocked === "function" && isAppLocked()) { showLockedToast(); return; }
    const cols = examCols();
    const movable = examStudentIdx().filter(i => !currentStudents[i].isFixed && !currentStudents[i].isAbsent && currentStudents[i].fixedType !== "area");
    if (movable.length < 2) { showToast("並べ替える生徒が、座席表にいません。先に席替えをしてください。", "error"); return; }
    const people0 = examSortedByNo(movable).map(i => currentStudents[i]);
    const colMajor = list => list.slice().sort((x, y) => (x % cols) - (y % cols) || x - y);
    const place = pos => { const nx = currentStudents.slice(); pos.forEach((q, k) => { nx[q] = people0[k]; }); return nx; };
    let positions;
    if (mode === "stagger") {
        // 市松模様の片方（前半の番号）→もう片方（後半の番号）の順に入れます。行ごとに数える並べ方と、列ごとに数える並べ方を比べて、隣との番号の差が大きくなるほうを選びます
        const rc = i => Math.floor(i / cols) + (i % cols);
        const make = f => { const o = f(movable); return o.filter(i => rc(i) % 2 === 0).concat(o.filter(i => rc(i) % 2 === 1)); };
        const A = make(l => l.slice()), B = make(colMajor);
        const gA = examMinNeighborGap(place(A)), gB = examMinNeighborGap(place(B));
        positions = (gB !== null && gA !== null && gB > gA) ? B : A;
    } else if (mode === "col") {
        positions = colMajor(movable);
    } else {
        positions = movable.slice();
    }
    if (typeof saveSeatHistory === "function") saveSeatHistory();
    currentStudents = place(positions);
    renderClassroom("none");
    const gap = examMinNeighborGap();
    const label = mode === "stagger" ? "千鳥配置" : mode === "col" ? "番号順（縦）" : "番号順（横）";
    showToast(label + "に並べました。" + (gap !== null ? "隣どうしの番号の差は、いちばん近くて " + gap + " です。" : ""), "success");
    examRender();
}
// 縦・横に隣り合う席の番号の差のうち、いちばん小さいもの
function examMinNeighborGap(arr) {
    const cols = examCols();
    const list = arr || currentStudents || [];
    let min = null;
    const no = i => { const s = list[i]; return s && s.type === "STUDENT" && s.text ? examNo(s) : null; };
    list.forEach((s, i) => {
        const a = no(i); if (a === null) return;
        [(i % cols < cols - 1) ? i + 1 : -1, i + cols].forEach(j => {
            if (j < 0 || j >= list.length) return;
            const b = no(j); if (b === null) return;
            const d = Math.abs(a - b);
            if (min === null || d < min) min = d;
        });
    });
    return min;
}

// ---- 受験番号札 ----
function examCardsHtml(cfg) {
    const cols = examCols();
    const idxs = examSortedByNo(examStudentIdx());
    const per = cfg.per;
    const pages = [];
    for (let k = 0; k < idxs.length; k += per) pages.push(idxs.slice(k, k + per));
    const grid = { 1: [1, 1], 2: [1, 2], 4: [2, 2], 8: [2, 4] }[per];
    return pages.map(pg => {
        const cards = pg.map(i => {
            const s = currentStudents[i];
            const p = getSeatDisplayParts(s.text);
            const no = p.no || "";
            const name = p.name || getCleanStudentKey(s.text);
            const ver = cfg.ver && cfg.show ? examVerOf(i, cols, cfg) : "";
            return '<div class="exam-card">' +
                (ver ? '<div class="exam-card-ver">' + ver + '</div>' : "") +
                '<div class="exam-card-no">' + examEsc(no || name) + '</div>' +
                (cfg.name && no ? '<div class="exam-card-name">' + examEsc(name) + '</div>' : "") +
                (cfg.seat ? '<div class="exam-card-seat">席 ' + getSeatLabel(i, cols) + '</div>' : "") +
                '</div>';
        }).join("");
        return '<div class="exam-page exam-per-' + per + '" style="grid-template-columns:repeat(' + grid[0] + ',1fr);grid-template-rows:repeat(' + grid[1] + ',1fr);">' + cards + '</div>';
    }).join("");
}

function examPrint() {
    const cfg = examCfg();
    if (!examStudentIdx().length) { showToast("座席表に、生徒がいません。", "error"); return; }
    let area = $id("examPrintArea");
    if (!area) { area = document.createElement("div"); area.id = "examPrintArea"; document.body.appendChild(area); }
    area.innerHTML = examCardsHtml(cfg);
    let st = $id("examPrintPageStyle");
    if (!st) { st = document.createElement("style"); st.id = "examPrintPageStyle"; document.head.appendChild(st); }
    st.textContent = "@page { size: A4 portrait; margin: 10mm; }";
    document.body.classList.add("exam-printing");
    const done = () => { document.body.classList.remove("exam-printing"); area.innerHTML = ""; window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    setTimeout(() => { window.print(); }, 50);
}

// ---- 画面 ----
const EXAM_CSS = `
.exam-ver { position: absolute; right: 3px; bottom: 2px; min-width: 16px; height: 16px; padding: 0 3px; box-sizing: border-box; border-radius: 8px; font-size: 11px; font-weight: 800; line-height: 16px; text-align: center; color: #fff; pointer-events: none; z-index: 3; }
.exam-ver-A { background: #2563eb; } .exam-ver-B { background: #ea580c; } .exam-ver-C { background: #16a34a; } .exam-ver-D { background: #9333ea; }
#examOverlay .modal-content { max-width: 640px; width: 95%; }
#examOverlay h5 { margin: 18px 0 6px; font-size: 14px; color: var(--text-main); }
#examOverlay .exam-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin: 6px 0; font-size: 13px; }
#examOverlay .exam-row select { height: 36px; }
#examOverlay .exam-row label { display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
#examOverlay .exam-counts { display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0; }
#examOverlay .exam-count { padding: 2px 12px; border-radius: 999px; color: #fff; font-size: 13px; font-weight: 700; }
#examOverlay .exam-preview { max-height: 400px; overflow: auto; border: 1px solid var(--seat-border); border-radius: 10px; background: #e5e7eb; padding: 8px; }
.exam-page { width: 190mm; height: 277mm; display: grid; box-sizing: border-box; background: #fff; page-break-after: always; break-after: page; margin: 0 auto 8px; }
#examOverlay .exam-preview .exam-page { zoom: 0.36; }
.exam-card { position: relative; border: 1px dashed #888; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; overflow: hidden; color: #111; font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; }
.exam-card-no { font-weight: 800; line-height: 1.05; }
.exam-card-name { margin-top: 4mm; }
.exam-card-seat { position: absolute; left: 4mm; bottom: 3mm; font-size: 12pt; color: #555; }
.exam-card-ver { position: absolute; right: 4mm; top: 3mm; border: 2px solid #111; border-radius: 50%; width: 14mm; height: 14mm; line-height: 14mm; font-size: 20pt; font-weight: 800; }
.exam-per-1 .exam-card-no { font-size: 150pt; } .exam-per-1 .exam-card-name { font-size: 36pt; }
.exam-per-2 .exam-card-no { font-size: 110pt; } .exam-per-2 .exam-card-name { font-size: 28pt; }
.exam-per-4 .exam-card-no { font-size: 72pt; } .exam-per-4 .exam-card-name { font-size: 20pt; }
.exam-per-8 .exam-card-no { font-size: 48pt; } .exam-per-8 .exam-card-name { font-size: 14pt; margin-top: 2mm; }
.exam-per-4 .exam-card-ver { width: 10mm; height: 10mm; line-height: 10mm; font-size: 15pt; } .exam-per-8 .exam-card-ver { width: 8mm; height: 8mm; line-height: 8mm; font-size: 12pt; border-width: 1.5px; }
.exam-per-8 .exam-card-seat { font-size: 9pt; }
#examPrintArea { display: none; }
@media print {
    body.exam-printing > *:not(#examPrintArea) { display: none !important; }
    body.exam-printing > #examPrintArea { display: block !important; }
    body.exam-printing .exam-page { margin: 0 auto; }
    body.exam-printing .exam-page:last-child { page-break-after: auto; break-after: auto; }
}
`;

function examModalHtml() {
    return `<div id="examOverlay" class="modal-overlay" style="display: none;">
  <div class="modal-content">
    <h4>📝 テスト用の座席</h4>
    <div id="examBody"></div>
    <div class="modal-btn-row"><button type="button" data-exam="close">閉じる</button></div>
  </div>
</div>`;
}

function examRender() {
    const body = $id("examBody");
    if (!body) return;
    const cfg = examCfg();
    const n = examStudentIdx().length;
    const counts = examVerCounts(cfg);
    const cnt = Object.keys(counts).map(v => '<span class="exam-count exam-ver-' + v + '">' + v + '問題 ' + counts[v] + '人</span>').join("");
    const gap = examMinNeighborGap();
    const opt = (v, cur, t) => '<option value="' + v + '"' + (String(v) === String(cur) ? " selected" : "") + '>' + t + '</option>';
    body.innerHTML =
        '<h5>① 席を並べる（いま座席表にいる ' + n + ' 人）</h5>' +
        '<p class="config-note" style="margin:0 0 6px;">出席番号の順に、並べます。固定した席・空席・お休みの席は、動かしません。「1つ前に戻す」で、戻せます。</p>' +
        '<div class="exam-row">' +
        '<button type="button" class="btn-secondary" data-exam="stagger">千鳥配置にする</button>' +
        '<button type="button" class="btn-secondary" data-exam="row">番号順（横）</button>' +
        '<button type="button" class="btn-secondary" data-exam="col">番号順（縦）</button></div>' +
        '<p class="config-note" style="margin:0;">千鳥配置：市松模様の片方の席に前半の番号、もう片方の席に後半の番号を入れます。縦横に隣り合う席の番号が、大きく離れます。' + (gap !== null ? '（いま、隣どうしの番号の差は、いちばん近くて ' + gap + '）' : '') + '</p>' +
        '<h5>② A・B問題の割り当て</h5>' +
        '<div class="exam-row"><label>版の数 <select data-exam-cfg="n">' + opt(2, cfg.n, "2（A・B）") + opt(3, cfg.n, "3（A・B・C）") + opt(4, cfg.n, "4（A〜D）") + '</select></label>' +
        '<label>配り方 <select data-exam-cfg="pat">' + opt("check", cfg.pat, "市松（縦横どちらの隣も違う版）") + opt("col", cfg.pat, "列ごと（左右の隣が違う版）") + opt("row", cfg.pat, "行ごと（前後が違う版）") + '</select></label></div>' +
        '<div class="exam-row"><label><input type="checkbox" data-exam-cfg="show"' + (cfg.show ? " checked" : "") + '> 座席表に、版（A・B…）を出す</label></div>' +
        '<div class="exam-counts">' + cnt + '</div>' +
        '<p class="config-note" style="margin:0;">版は、席の場所で決まります（席替えをしても、その席の版は変わりません）。問題用紙は、上の人数分を刷ってください。</p>' +
        '<h5>③ 受験番号札を印刷する</h5>' +
        '<div class="exam-row"><label>A4 1枚の札の数 <select data-exam-cfg="per">' + opt(1, cfg.per, "1枚（特大）") + opt(2, cfg.per, "2枚") + opt(4, cfg.per, "4枚") + opt(8, cfg.per, "8枚") + '</select></label></div>' +
        '<div class="exam-row"><label><input type="checkbox" data-exam-cfg="name"' + (cfg.name ? " checked" : "") + '> 名前を入れる</label>' +
        '<label><input type="checkbox" data-exam-cfg="seat"' + (cfg.seat ? " checked" : "") + '> 席（B3など）を入れる</label>' +
        '<label><input type="checkbox" data-exam-cfg="ver"' + (cfg.ver ? " checked" : "") + '> 版を入れる（②で版を出しているとき）</label></div>' +
        '<div class="exam-preview">' + (n ? examCardsHtml(cfg) : '<p class="config-note">座席表に、生徒がいません。</p>') + '</div>' +
        '<div class="exam-row"><button type="button" data-exam="print">印刷する</button></div>' +
        '<p class="config-note" style="margin:0;">点線の枠が、切り取り線です。番号の順に並んで出ます。</p>';
}
function openExamSeats() {
    if (typeof closeConfigMenuIfOpen === "function") closeConfigMenuIfOpen();
    examRender();
    const o = $id("examOverlay");
    if (o) o.style.display = "flex";
}
function closeExamSeats() { const o = $id("examOverlay"); if (o) o.style.display = "none"; }

SekigaeApp.registerPlugin({
    id: "exam-seats",
    name: "テスト用の座席",
    version: "1.0",
    description: "テストや検定のための座席づくり。番号が近い人どうしが隣にならない千鳥配置、A・B問題を交互に配る版の割り当て、机に置く受験番号札の印刷ができます。",
    backupKeys: [EXAM_KEY],
    searchWords: "テスト用座席 テスト 試験 千鳥 A問題 B問題 受験番号 番号札 検定 カンニング",
    stubs: [],
    mount(app) {
        const st = document.createElement("style");
        st.id = "examSeatsStyle";
        st.textContent = EXAM_CSS;
        document.head.appendChild(st);
        document.body.insertAdjacentHTML("beforeend", examModalHtml());
        app.insertInto("settings-seat", '<button type="button" id="examOpenBtn" class="btn-secondary" style="margin-top: 10px;">テスト用の座席（千鳥・A/B問題・番号札）</button>');
        app.insertInto("guide-faq", "<li><strong>テストのとき、隣に番号の近い人を置きたくない</strong>：設定の「座席のレイアウト」の「テスト用の座席」を開いて、「千鳥配置にする」を押します。A・B問題の割り当てや、受験番号札の印刷もできます。</li>");
        document.addEventListener("click", ev => {
            const t = ev.target.closest ? ev.target.closest("#examOpenBtn, [data-exam]") : null;
            if (!t) return;
            if (t.id === "examOpenBtn") { openExamSeats(); return; }
            const act = t.dataset.exam;
            if (act === "close") closeExamSeats();
            else if (act === "print") examPrint();
            else if (["stagger", "row", "col"].includes(act)) examArrange(act);
        });
        document.addEventListener("change", ev => {
            const t = ev.target;
            if (!t || !t.dataset || !t.dataset.examCfg) return;
            const k = t.dataset.examCfg;
            const v = t.type === "checkbox" ? t.checked : (k === "pat" ? t.value : parseInt(t.value, 10));
            examSetCfg({ [k]: v });
            examRender();
            examDecorate();
        });
        document.addEventListener("keydown", ev => {
            if (ev.key !== "Escape") return;
            const o = $id("examOverlay");
            if (o && o.style.display !== "none") closeExamSeats();
        });
    },
    ready() { examDecorate(); },
    afterRender() {
        examDecorate();
        const o = $id("examOverlay");
        if (o && o.style.display !== "none") examRender();
    }
});
