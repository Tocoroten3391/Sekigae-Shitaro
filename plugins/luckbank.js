// ==========================================
// 運の貯金プラグイン：前の席・後ろの席に座った回数を、生徒ごとに覚えます。後ろの席が続いた生徒は「運が貯まっている」ことにして、
// 次の席替えで、後ろの席になりにくくします（使うかどうかは、スイッチで選べます）
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります。席替えは、これまでどおりに動きます
// ==========================================
const LUCK_KEY = "luck_bank";            // { クラス名: [ { at: 時刻, z: { 生徒の目印: "f"（前）／"m"（中）／"b"（後ろ） } } ] } 新しい順
const LUCK_USE_KEY = "luck_use";          // "1" なら、席替えで運の貯金を使う
const LUCK_WINDOW_KEY = "luck_window";    // 数える回数（直近の何回分か）
const LUCK_TH_KEY = "luck_threshold";     // 何回分たまったら使うか
const LUCK_KEEP = 40;                      // 覚えておく席替えの回数

let luckCache = null;                     // { cls, bal: { 目印: 貯金 }, th }

function luckClassName() {
    try { return (typeof getSelectedPresetName === "function" && getSelectedPresetName()) || ""; } catch (e) { return ""; }
}
function luckLoadAll() {
    try { const v = JSON.parse(lsGet(LUCK_KEY, "{}")); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
}
function luckEntries() {
    const list = luckLoadAll()[luckClassName()];
    return Array.isArray(list) ? list.filter(e => e && e.z && typeof e.z === "object") : [];
}
function luckSaveEntries(list) {
    const all = luckLoadAll();
    const cls = luckClassName();
    if (list.length) all[cls] = list.slice(0, LUCK_KEEP); else delete all[cls];
    lsSet(LUCK_KEY, JSON.stringify(all));
    luckCache = null;
}
function luckSetting(key, def, allowed) {
    const v = lsGet(key, def);
    return allowed.includes(v) ? v : def;
}
function luckWindow() { return parseInt(luckSetting(LUCK_WINDOW_KEY, "10", ["5", "10", "20", "40"]), 10); }
function luckThreshold() { return parseInt(luckSetting(LUCK_TH_KEY, "2", ["1", "2", "3"]), 10); }
function luckUseOn() { return lsGet(LUCK_USE_KEY, "0") === "1"; }

// 生徒ごとの、前に座った回数（f）・後ろに座った回数（b）・貯金（後ろ − 前）。直近の数回分だけを数えます
function luckBalances() {
    const out = {};
    luckEntries().slice(0, luckWindow()).forEach(e => {
        Object.keys(e.z).forEach(k => {
            const o = out[k] || (out[k] = { f: 0, m: 0, b: 0, n: 0, bal: 0 });
            const z = e.z[k];
            if (z === "f" || z === "m" || z === "b") { o[z]++; o.n++; }
        });
    });
    Object.keys(out).forEach(k => { out[k].bal = out[k].b - out[k].f; });
    return out;
}

// 座席の場所を「前・中・後ろ」に分けます。座席表の行数を3つに分けて、いちばん上の行（黒板側）を前、いちばん下の行を後ろとします
function luckZoneOf(idx, cols, total) {
    const rows = Math.ceil(total / cols);
    if (rows < 3) return "m";
    const band = Math.max(1, Math.floor(rows / 3));
    const row = Math.floor(idx / cols);
    if (row < band) return "f";
    if (row >= rows - band) return "b";
    return "m";
}

function luckBuildCache() {
    const cls = luckClassName();
    if (luckCache && luckCache.cls === cls && luckCache.th === luckThreshold() && luckCache.win === luckWindow()) return luckCache;
    const bal = {};
    const b = luckBalances();
    Object.keys(b).forEach(k => { bal[k] = b[k].bal; });
    const th = luckThreshold();
    luckCache = { cls: cls, th: th, win: luckWindow(), bal: bal, active: Object.keys(bal).some(k => bal[k] >= th || bal[k] <= -(th + 1)) };
    return luckCache;
}

// 席替えの計算から呼ばれます（本体には、何もしない同じ名前の関数があります）
function luckActive() {
    return luckUseOn() && luckBuildCache().active;
}
// 今の席の配置で、運の貯金に合っていない席の数
//   ・貯金が しきい値 以上の生徒が、後ろの席にいる
//   ・貯金が しきい値+2 以上の生徒が、前の席にいない
//   ・貯金が −（しきい値+1）以下の生徒（前が続いた生徒）が、前の席にいる
function luckPenalty(seats, cols) {
    const c = luckBuildCache();
    const th = c.th;
    let pen = 0;
    (seats || []).forEach((seat, idx) => {
        if (!seat || seat.type !== "STUDENT" || !seat.text) return;
        if (seat.isFixed || seat.fixedType !== "none") return; // 席を指定している人は、動かせません
        const key = getCleanStudentKey(seat.text);
        const bal = c.bal[key];
        if (bal === undefined) return;
        const z = luckZoneOf(idx, cols, seats.length);
        if (bal >= th && z === "b") pen++;
        else if (bal >= th + 2 && z !== "f") pen++;
        else if (bal <= -(th + 1) && z === "f") pen++;
    });
    return pen;
}

// 席替えが終わった時に、誰がどこに座ったかを記録します
function luckRecord() {
    const seats = currentStudents || [];
    const cols = typeof getGridCols === "function" ? getGridCols() : 6;
    // 記録する前に、運の貯金が効いたか確かめて、先生に知らせます
    if (luckActive()) {
        const c = luckBuildCache();
        let helped = 0, unmet = 0;
        seats.forEach((seat, idx) => {
            if (!seat || seat.type !== "STUDENT" || !seat.text || seat.isAbsent) return;
            const bal = c.bal[getCleanStudentKey(seat.text)];
            if (bal === undefined || bal < c.th) return;
            if (luckZoneOf(idx, cols, seats.length) === "b") unmet++; else helped++;
        });
        if (helped > 0 || unmet > 0) {
            showToast("運の貯金：後ろが続いていた" + helped + "人は、後ろの席を避けました。" + (unmet ? unmet + "人は、席の都合で後ろのままです。" : ""), unmet ? "info" : "success");
        }
    }
    const z = {};
    seats.forEach((seat, idx) => {
        if (!seat || seat.type !== "STUDENT" || !seat.text || seat.isAbsent) return;
        const key = getCleanStudentKey(seat.text);
        if (key && !(key in z)) z[key] = luckZoneOf(idx, cols, seats.length);
    });
    if (!Object.keys(z).length) return;
    const list = luckEntries();
    list.unshift({ at: Date.now(), z: z });
    luckSaveEntries(list);
    if (luckModalOpen()) renderLuckModal();
}

function luckNameOf(key) {
    const hit = (currentStudents || []).find(s => s && s.type === "STUDENT" && s.text && getCleanStudentKey(s.text) === key);
    if (hit && typeof getSeatDisplayParts === "function") { const p = getSeatDisplayParts(hit.text); return (p.no ? p.no + "番 " : "") + (p.name || key); }
    return key;
}
function luckEsc(t) { return String(t).replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch])); }

// ---- 画面 ----
function luckModalOpen() { const o = $id("luckModalOverlay"); return !!o && o.style.display !== "none"; }
function openLuckModal() {
    if (typeof closePopMenus === "function") closePopMenus();
    $id("luckUseToggle").checked = luckUseOn();
    $id("luckWindowSelect").value = String(luckWindow());
    $id("luckThresholdSelect").value = String(luckThreshold());
    renderLuckModal();
    $id("luckModalOverlay").style.display = "flex";
}
function closeLuckModal() { const o = $id("luckModalOverlay"); if (o) o.style.display = "none"; }
function luckSaveSettings() {
    lsSet(LUCK_USE_KEY, $id("luckUseToggle").checked ? "1" : "0");
    lsSet(LUCK_WINDOW_KEY, $id("luckWindowSelect").value);
    lsSet(LUCK_TH_KEY, $id("luckThresholdSelect").value);
    luckCache = null;
    renderLuckModal();
}
function renderLuckModal() {
    const entries = luckEntries();
    const cls = luckClassName();
    $id("luckInfo").textContent = (cls ? "クラス：" + cls + "　" : "") + "記録：" + entries.length + "回分" + (entries.length > luckWindow() ? "（数えるのは、直近の" + luckWindow() + "回分）" : "");
    const bal = luckBalances();
    const keys = Object.keys(bal).sort((a, b) => bal[b].bal - bal[a].bal || a.localeCompare(b, "ja"));
    const th = luckThreshold();
    const body = $id("luckList");
    if (!keys.length) {
        body.innerHTML = '<p class="config-note" data-keep="1">まだ記録がありません。席替えをするたびに、自動で記録します。</p>';
    } else {
        body.innerHTML = keys.map(k => {
            const o = bal[k];
            const tag = o.bal >= th ? `<span class="luck-tag luck-save">🍀 貯金 ${o.bal}</span>` : (o.bal <= -(th + 1) ? `<span class="luck-tag luck-used">使い切り</span>` : `<span class="luck-tag">普通</span>`);
            const bar = "🟦".repeat(Math.min(o.f, 10)) + "🟥".repeat(Math.min(o.b, 10));
            return `<div class="luck-row"><span class="luck-name">${luckEsc(luckNameOf(k))}</span><span class="luck-count">前 ${o.f}・中 ${o.m}・後ろ ${o.b}</span><span class="luck-bar">${bar}</span>${tag}</div>`;
        }).join("");
    }
    $id("luckUndoBtn").style.display = entries.length ? "" : "none";
    $id("luckClearBtn").style.display = entries.length ? "" : "none";
}
function luckUndoLast() {
    const list = luckEntries();
    if (!list.length) return;
    list.shift();
    luckSaveEntries(list);
    renderLuckModal();
    showToast("最後の記録を、取り消しました。", "success");
}
function luckClearAll() {
    if (!confirm("このクラスの、運の貯金の記録を、全て消します。よろしいですか？")) return;
    luckSaveEntries([]);
    renderLuckModal();
    showToast("運の貯金の記録を、全て消しました。", "success");
}

const LUCK_HTML = `
<div id="luckModalOverlay" class="modal-overlay" style="display: none;">
    <div class="modal-content" style="max-width: 560px; width: 95%;">
        <h4 style="color: #16a34a;">🍀 運の貯金</h4>
        <p class="config-note" data-keep="1" style="margin: -6px 0 10px;">後ろの席が続いた生徒には、運が貯まっていきます。席替えで、その生徒を後ろの席にしにくくします。<span data-lbtip="座席表を、前（黒板側）・中・後ろの3つに分けて、席替えのたびに、誰がどこに座ったかを覚えます。貯金は、後ろに座った回数から、前に座った回数を引いた数です。貯金がしきい値以上の生徒は、後ろの席を避け、さらに2回分多い生徒は、前の席を優先します。前が続いた生徒は、前の席を避けます。名簿で席を決めている生徒は、動かしません。他の条件（離す・近くに置く・前と同じ席を避ける）が、いつも先です。"></span></p>
        <div class="switch-container">
            <label class="switch"><input type="checkbox" id="luckUseToggle" onchange="luckSaveSettings()"><span class="slider"></span></label>
            <span class="switch-label">席替えで、運の貯金を使う</span>
        </div>
        <div class="layout-grid-fields" style="margin: 10px 0;">
            <div><label for="luckWindowSelect">数える回数</label>
                <select id="luckWindowSelect" onchange="luckSaveSettings()"><option value="5">直近5回</option><option value="10">直近10回</option><option value="20">直近20回</option><option value="40">覚えている分全て</option></select></div>
            <div><label for="luckThresholdSelect">使い始める貯金</label>
                <select id="luckThresholdSelect" onchange="luckSaveSettings()"><option value="1">1回分から</option><option value="2">2回分から</option><option value="3">3回分から</option></select></div>
        </div>
        <p id="luckInfo" class="config-note" style="margin: 0 0 8px;"></p>
        <div id="luckList" class="luck-list"></div>
        <div class="modal-btn-row">
            <button id="luckUndoBtn" onclick="luckUndoLast()" class="btn-secondary">↩️ 最後の記録を取り消す</button>
            <button id="luckClearBtn" onclick="luckClearAll()" class="btn-delete">🗑️ 全て消す</button>
            <button onclick="closeLuckModal()" class="btn-secondary">閉じる</button>
        </div>
    </div>
</div>`;

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "luckbank",
    name: "運の貯金",
    version: "1.0",
    description: "前の席・後ろの席に座った回数を、生徒ごとに覚えます。後ろの席が続いた生徒は、次の席替えで、後ろの席になりにくくなります。",
    backupKeys: [LUCK_KEY, LUCK_USE_KEY, LUCK_WINDOW_KEY, LUCK_TH_KEY],
    searchWords: "運 貯金 運の貯金 公平 後ろの席 前の席 ふこうへい 不公平",
    stubs: ["luckActive", "luckPenalty"],
    mount(app) {
        document.body.insertAdjacentHTML("beforeend", LUCK_HTML);
        document.querySelectorAll("#luckModalOverlay [data-lbtip]").forEach(el => {
            if (typeof makeInfoTip === "function") el.replaceWith(makeInfoTip(el.dataset.lbtip)); else el.remove();
        });
        app.insertInto("settings-rules", '<button type="button" onclick="openLuckModal()" class="btn-secondary" id="btnLuckBank" style="margin-top: 10px;">運の貯金</button>');
        app.insertInto("guide-faq", "<li><strong>後ろの席が続く生徒がいる</strong>：設定の「運の貯金」を開いて、「席替えで、運の貯金を使う」をオンにします。席替えのたびに前・中・後ろを記録して、後ろの席が続いた生徒を、次は後ろにしにくくします。</li>");
    },
    afterShuffle() { luckRecord(); }
});
document.addEventListener("keydown", e => {
    if (e.key === "Escape" && luckModalOpen()) closeLuckModal();
});
