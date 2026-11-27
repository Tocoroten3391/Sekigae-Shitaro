// ==========================================
// バックアップと復元プラグイン（必須）：設定・記録の書き出し、自動バックアップ、復元、バックアップのお知らせです。
// アプリの土台になる部分を、役割ごとに分けたファイルです。オフにはできません
// ==========================================
const BACKUP_KEYS = [
    "seat_shuffler_presets", "seat_history_log", "nomination_history_log", "seat_layout_log", "pair_history_log", "stats_archives",
    "separation_pairs", "near_pairs", "furigana_map", "furigana_show", "furigana_auto",
    "smooth_animation", "lite_mode", "warning_percentage", "use_12hour_clock", "clock_12h_ampm", "show_milliseconds", "show_hours_format",
    "timer_presets", "timer_end_anim", "timer_adds", "timer_step_sets_v1", "step_auto_advance", "continuous_alarm", "silent_test_mode",
    "seat_group_count", "nominate_specific_excluded", "nominate_specific_exclude_enabled", "nominate_favor_recent",
    "classroom_zoom", "app_theme", "season_deco", "follow_system_dark", "timer_gauge_type", "timer_gauge_bold", "timer_mini_bar", "group_number_order", "group_mark_scope", "fav_settings", "condition_priority", "auto_upload_after_shuffle", "auto_sync_enabled",
    "avoid_same_seat", "avoid_neighbor", "avoid_depth", "avoid_repeat_pairs", "announce_sound", "announce_order", "announce_style", "shuffle_anim_type", "shuffle_sound",
    "shuffle_anim_speed", "random_anim_scope", "softkeypad_on", "softkeypad_shuffle", "shuffle_anim_favs", "shuffle_anim_presets", "compare_on", "seat_timeline",
    "group_mark_on", "seat_text_scale", "app_title_text", "app_title_show", "class_records_v1", "active_class_id", "roster_map_memory", "plugins_disabled"
];

const BACKUP_MAX_BYTES = 8 * 1024 * 1024;

let pendingBackup = null;

function isBackupKey(key) { return BACKUP_KEYS.includes(key) || /^group_color_[1-8]$/.test(key); }

function openBackupModal() {
    if (isAppLocked()) { showLockedToast(); return; }
    pendingBackup = null;
    const info = $id("backupImportInfo"), apply = $id("backupApplyBtn"), file = $id("backupFileInput");
    if (info) info.textContent = "";
    if (apply) apply.style.display = "none";
    if (file) file.value = "";
    hideBackupReminder();
    updateBackupStatusText();
    const overlay = $id("backupModalOverlay");
    if (overlay) overlay.style.display = "flex";
}

function closeBackupModal() {
    const overlay = $id("backupModalOverlay");
    if (overlay) overlay.style.display = "none";
    pendingBackup = null;
}

function backupStamp(d) { return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`; }
// バックアップの中身を作ります。手動の書き出しと、自動バックアップの両方で使います。

function buildBackupData(includeGas) {
    const items = {};
    const keys = BACKUP_KEYS.concat([1, 2, 3, 4, 5, 6, 7, 8].map(n => `group_color_${n}`));
    if (includeGas) keys.push("saved_gas_url");
    keys.forEach(k => { const v = lsGet(k, null); if (v !== null) items[k] = v; });
    const rec = getBackupRecordState();
    CLASS_RECORD_KEYS.forEach(k => { delete items[k]; if (rec.main[k] !== undefined) items[k] = rec.main[k]; });
    items.class_records_v1 = JSON.stringify(rec.store);
    items.active_class_id = rec.id;
    const data = { app: "seat-shuffler-backup", appVersion: APP_VERSION, createdAt: new Date().toISOString(), includesGasUrl: !!includeGas, items: items };
    return { data, count: Object.keys(items).length };
}

function exportBackup() {
    if (isAppLocked()) { showLockedToast(); return; }
    const gasChk = $id("backupIncludeGas");
    const includeGas = !!(gasChk && gasChk.checked);
    const { data, count } = buildBackupData(includeGas);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
    a.download = `席替えし太郎_バックアップ_${backupStamp(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
    lsSet("last_backup_at", String(Date.now()));
    lsSet("backup_snooze_until", "0");
    hideBackupReminder();
    updateBackupStatusText();
    showToast(`設定・記録${count}件をバックアップしました。`, "success");
}

// ==========================================
// 自動バックアップ（決めたフォルダへ、決めた間隔で書き出す）
// ==========================================
// フォルダへの書き込みに対応したブラウザ（ChromeやEdge）で使えます。
// アプリを開いている時に、前回から決めた間隔がたっていれば、自動でファイルを保存します。
// 書き込みの許可が切れていた時は、お知らせの帯でボタンを出し、押してもらって保存します。
// どのパソコンやフォルダでも保存できるよう、ファイル名は半角の英数字にします。

const AUTO_BACKUP_PREFIX = "seat-shuffler-auto-backup_";

const AUTO_BACKUP_KEEP = 10;

const AUTO_BACKUP_CHOICES = [0, 1, 7, 14];

let autoBackupDirHandle = null;

let autoBackupBusy = false;

function autoBackupSupported() { return typeof window.showDirectoryPicker === "function" && typeof indexedDB !== "undefined"; }

function getAutoBackupDays() {
    const v = parseInt(lsGet("auto_backup_days", "0"), 10);
    return AUTO_BACKUP_CHOICES.includes(v) ? v : 0;
}

function getAutoBackupLastAt() { const n = Number(lsGet("auto_backup_at", "")); return Number.isFinite(n) && n > 0 ? n : 0; }

function autoBackupIdb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open("seat_shuffler_fs", 1);
        req.onupgradeneeded = () => req.result.createObjectStore("handles");
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function autoBackupIdbRun(mode, fn) {
    const db = await autoBackupIdb();
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction("handles", mode);
            const req = fn(tx.objectStore("handles"));
            tx.oncomplete = () => resolve(req ? req.result : undefined);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    } finally { db.close(); }
}

async function loadAutoBackupHandle() {
    if (autoBackupDirHandle) return autoBackupDirHandle;
    if (!autoBackupSupported()) return null;
    try { autoBackupDirHandle = (await autoBackupIdbRun("readonly", st => st.get("backupDir"))) || null; } catch (error) { autoBackupDirHandle = null; }
    return autoBackupDirHandle;
}

async function saveAutoBackupHandle(handle) {
    autoBackupDirHandle = handle;
    try { await autoBackupIdbRun("readwrite", st => st.put(handle, "backupDir")); } catch (error) { /* 保存できなくても、開いている間は使えます */ }
}

async function clearAutoBackupHandle() {
    autoBackupDirHandle = null;
    try { await autoBackupIdbRun("readwrite", st => st.delete("backupDir")); } catch (error) { /* 何もしません */ }
}

async function autoBackupPermission(handle, interactive) {
    try {
        const opts = { mode: "readwrite" };
        let p = handle.queryPermission ? await handle.queryPermission(opts) : "granted";
        if (p === "granted") return true;
        if (!interactive || !handle.requestPermission) return false;
        p = await handle.requestPermission(opts);
        return p === "granted";
    } catch (error) { return false; }
}

async function pruneAutoBackups(dir) {
    const names = [];
    for await (const [name, entry] of dir.entries()) {
        if (entry.kind === "file" && name.startsWith(AUTO_BACKUP_PREFIX) && name.endsWith(".json")) names.push(name);
    }
    names.sort().reverse();
    for (const name of names.slice(AUTO_BACKUP_KEEP)) { try { await dir.removeEntry(name); } catch (error) { /* 消せなくても続けます */ } }
}

function isAutoBackupDue() {
    const days = getAutoBackupDays();
    if (days <= 0 || !hasBackupWorthyData()) return false;
    return Date.now() - getAutoBackupLastAt() >= days * DAY_MS;
}
// interactive：ボタンを押した直後など、許可を求めてよい時。force：間隔にかかわらず、今すぐ保存する時。

async function runAutoBackup(interactive, force) {
    if (autoBackupBusy || !autoBackupSupported()) return false;
    const handle = await loadAutoBackupHandle();
    if (!handle) return false;
    if (!force && !isAutoBackupDue()) return false;
    autoBackupBusy = true;
    try {
        if (!(await autoBackupPermission(handle, interactive))) {
            if (!interactive) showBackupReminder("autoPermission");
            return false;
        }
        const { data } = buildBackupData(false);
        const name = `${AUTO_BACKUP_PREFIX}${backupStamp(new Date())}.json`;
        const fileHandle = await handle.getFileHandle(name, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(data));
        await writable.close();
        await pruneAutoBackups(handle);
        const now = String(Date.now());
        lsSet("last_backup_at", now);
        lsSet("auto_backup_at", now);
        lsSet("backup_snooze_until", "0");
        hideBackupReminder();
        updateBackupStatusText();
        if (!isAppLocked()) showToast("自動バックアップを保存しました。", "success");
        return true;
    } catch (error) {
        if (interactive) showToast("自動バックアップを保存できませんでした。保存先のフォルダを選び直してください。", "error");
        else showBackupReminder("autoFail");
        return false;
    } finally { autoBackupBusy = false; }
}

function checkAutoBackup() {
    if (getAutoBackupDays() <= 0 || !autoBackupSupported()) return;
    runAutoBackup(false, false);
}

async function chooseAutoBackupFolder() {
    if (!autoBackupSupported()) { showToast("このブラウザではフォルダへの自動保存は使えません。", "error"); return; }
    let handle;
    try { handle = await window.showDirectoryPicker({ mode: "readwrite", id: "seat-shuffler-backup" }); }
    catch (error) { return; }
    await saveAutoBackupHandle(handle);
    if (getAutoBackupDays() <= 0) lsSet("auto_backup_days", "7");
    updateBackupStatusText();
    await runAutoBackup(true, true);
    updateBackupStatusText();
}

async function onAutoBackupIntervalChange() {
    const sel = $id("autoBackupSelect");
    if (!sel) return;
    const v = parseInt(sel.value, 10);
    if (!AUTO_BACKUP_CHOICES.includes(v)) return;
    lsSet("auto_backup_days", String(v));
    if (v > 0 && !(await loadAutoBackupHandle())) showToast("保存先のフォルダを選んでください。", "success");
    else if (v > 0) await runAutoBackup(true, false);
    else showToast("自動バックアップを止めました。", "success");
    updateBackupStatusText();
}

async function autoBackupNowFromModal() {
    if (!(await loadAutoBackupHandle())) { showToast("先に保存先のフォルダを選んでください。", "error"); return; }
    await runAutoBackup(true, true);
    updateBackupStatusText();
}

async function releaseAutoBackupFolder() {
    await clearAutoBackupHandle();
    lsSet("auto_backup_days", "0");
    updateBackupStatusText();
    showToast("保存先を解除し、自動バックアップを止めました。", "success");
}

async function updateAutoBackupUi() {
    const supported = autoBackupSupported();
    const box = $id("autoBackupBox");
    if (!box) return;
    const note = $id("autoBackupSupportNote"), ctrl = $id("autoBackupControls");
    if (note) note.hidden = supported;
    if (ctrl) ctrl.hidden = !supported;
    if (!supported) return;
    const sel = $id("autoBackupSelect");
    if (sel) sel.value = String(getAutoBackupDays());
    const handle = await loadAutoBackupHandle();
    const folder = $id("autoBackupFolderText");
    if (folder) folder.textContent = handle ? (handle.name || "選んだフォルダ") : "まだ決めていません";
    const last = getAutoBackupLastAt();
    const lastEl = $id("autoBackupLastText");
    if (lastEl) lastEl.textContent = last ? `${formatBackupDate(last)}　${Math.max(0, Math.floor((Date.now() - last) / DAY_MS)) <= 0 ? "今日" : Math.floor((Date.now() - last) / DAY_MS) + "日前"}` : "まだありません";
    const rel = $id("autoBackupReleaseBtn");
    if (rel) rel.hidden = !handle;
}

// ==========================================
// クラスごとの記録
// ==========================================
// 指名・座席・結果・履歴・アーカイブの記録は、クラスごとに分けて持つ。
// いま使っているクラスの記録は、これまでと同じ保存場所に置き、ほかのクラスの記録は class_records_v1 に控える。
// クラスを切り替える時に、いまの記録を控えに戻して、切り替え先の記録を取り出す。

function getBackupRecordState() {
    const store = readClassRecordStore();
    delete store[TRIAL_CLASS_ID];
    let id = activeClassId, main;
    if (id === TRIAL_CLASS_ID) {
        id = lsGet("trial_return_class", "");
        main = store[id] || {};
    } else {
        main = snapshotMainRecords();
    }
    delete store[id];
    return { id: id, main: main, store: store };
}

// ---- バックアップのお知らせ ----

const BACKUP_REMIND_DEFAULT_DAYS = 30;

const BACKUP_REMIND_CHOICES = [0, 14, 30, 60, 90];

const BACKUP_SNOOZE_LATER_DAYS = 3;

const DAY_MS = 24 * 60 * 60 * 1000;

function getBackupRemindDays() {
    const v = parseInt(lsGet("backup_remind_days", String(BACKUP_REMIND_DEFAULT_DAYS)), 10);
    return BACKUP_REMIND_CHOICES.includes(v) ? v : BACKUP_REMIND_DEFAULT_DAYS;
}

function getBackupLastAt() { const n = Number(lsGet("last_backup_at", "")); return Number.isFinite(n) && n > 0 ? n : 0; }

function hasBackupWorthyData() {
    return ["seat_shuffler_presets", "seat_history_log", "nomination_history_log", "seat_layout_log", "stats_archives", "furigana_map", "separation_pairs", "near_pairs", "pair_history_log", "class_records_v1"]
        .some(k => countJsonEntries(lsGet(k, "")) > 0);
}

function formatBackupDate(ms) {
    const d = new Date(ms), wd = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
    return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}(${wd})`;
}
// バックアップが、いまどういう状態か。ok、warn、bad、none のどれか。

function getBackupHealth() {
    if (!hasBackupWorthyData()) return { level: "none", text: "記録がまだないのでバックアップは要りません。" };
    const last = getBackupLastAt();
    if (!last) return { level: "bad", text: "バックアップをまだ取っていません。" };
    const n = Math.max(0, Math.floor((Date.now() - last) / DAY_MS));
    const when = n <= 0 ? "今日" : n + "日前";
    const autoDays = getAutoBackupDays(), remind = getBackupRemindDays();
    const limit = autoDays > 0 ? autoDays * 2 : (remind > 0 ? remind : 30);
    if (n > limit) {
        return { level: "warn", text: autoDays > 0
            ? `最後のバックアップは${when}です。自動バックアップが動いていないかもしれません。保存先を確認してください。`
            : `最後のバックアップは${when}です。そろそろ取りましょう。` };
    }
    return { level: "ok", text: `最後のバックアップは${when}です。` };
}

function renderBackupHealth() {
    const h = getBackupHealth();
    ["backupHealthMain", "backupHealthModal"].forEach(id => {
        const el = $id(id);
        if (!el) return;
        el.textContent = h.text;
        el.className = "backup-health is-" + h.level;
    });
}
// 自動バックアップの保存先を、実際に開いて確かめる。ファイルがあるか、新しいか、中身が読めるか。

async function checkAutoBackupFolder() {
    const out = $id("autoBackupCheckResult");
    const show = (level, text) => { if (out) { out.textContent = text; out.className = "backup-health is-" + level; out.hidden = false; } };
    if (!autoBackupSupported()) { show("bad", "このブラウザではフォルダへの自動保存は使えません。"); return; }
    show("none", "確認しています。");
    const handle = await loadAutoBackupHandle();
    if (!handle) { show("bad", "保存先のフォルダがまだ決まっていません。"); return; }
    if (!(await autoBackupPermission(handle, true))) { show("bad", "フォルダに書き込む許可がありません。「今すぐ自動保存する」を押して、許可してください。"); return; }
    try {
        const files = [];
        for await (const [name, entry] of handle.entries()) {
            if (entry.kind === "file" && name.startsWith(AUTO_BACKUP_PREFIX) && name.endsWith(".json")) {
                const f = await entry.getFile();
                files.push({ name: name, at: f.lastModified, file: f });
            }
        }
        if (files.length === 0) { show("warn", "保存先のフォルダに自動バックアップのファイルがありません。「今すぐ自動保存する」を押してください。"); return; }
        files.sort((a, b) => b.at - a.at);
        const d = new Date(files[0].at);
        const stamp = `${formatBackupDate(files[0].at)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
        let items = -1;
        try {
            const data = JSON.parse(await files[0].file.text());
            if (data && data.app === "seat-shuffler-backup" && data.items && typeof data.items === "object") items = Object.keys(data.items).length;
        } catch (error) { items = -1; }
        if (items < 0) { show("bad", `一番新しいファイルが読めませんでした。「今すぐ自動保存する」で、保存し直してください。`); return; }
        show("ok", `確認しました。自動バックアップのファイルが${files.length}個あります。一番新しいのは${stamp}のもので中身も正しく読めました。設定・記録${items}件が入っています。`);
    } catch (error) {
        show("bad", "保存先のフォルダを読めませんでした。保存先を選び直してください。");
    }
}

function updateBackupStatusText() {
    renderBackupHealth();
    const t = $id("backupLastText"), sel = $id("backupRemindSelect");
    const last = getBackupLastAt();
    if (t) {
        if (!last) t.textContent = "まだありません";
        else { const n = Math.floor((Date.now() - last) / DAY_MS); t.textContent = `${formatBackupDate(last)}　${n <= 0 ? "今日" : n + "日前"}`; }
    }
    if (sel) sel.value = String(getBackupRemindDays());
    updateAutoBackupUi();
}

function onBackupRemindChange() {
    const sel = $id("backupRemindSelect");
    if (!sel) return;
    const v = parseInt(sel.value, 10);
    if (!BACKUP_REMIND_CHOICES.includes(v)) return;
    lsSet("backup_remind_days", String(v));
    lsSet("backup_snooze_until", "0");
    showToast(v === 0 ? "バックアップのお知らせを止めました。" : "バックアップのお知らせの間隔を変えました。", "success");
}

function shouldRemindBackup() {
    const days = getBackupRemindDays();
    if (days <= 0 || !hasBackupWorthyData()) return false;
    let ref = getBackupLastAt();
    if (!ref) {
        ref = Number(lsGet("backup_ref_at", ""));
        if (!Number.isFinite(ref) || ref <= 0) { lsSet("backup_ref_at", String(Date.now())); return false; }
    }
    if (Number(lsGet("backup_snooze_until", "0")) > Date.now()) return false;
    return Date.now() - ref >= days * DAY_MS;
}

function canShowBackupReminderNow() {
    if (isAppLocked()) return false;
    const b = document.body;
    if (b.classList.contains("nomination-active") || b.classList.contains("blackboard-active")) return false;
    if (Array.from(document.querySelectorAll(".modal-overlay")).some(o => getComputedStyle(o).display !== "none")) return false;
    return !["rouletteOverlay", "giantTimeOverlay"].some(id => { const e = $id(id); return e && getComputedStyle(e).display !== "none"; });
}

function showBackupReminder(reason) {
    const bar = $id("backupReminderBar"), msg = $id("backupReminderMsg"), btn = $id("backupReminderPrimaryBtn");
    const isAuto = reason === "autoPermission" || reason === "autoFail";
    if (!bar || !msg || isAppLocked() || (!isAuto && getBackupRemindDays() <= 0) || !hasBackupWorthyData()) return;
    if (isAuto && !canShowBackupReminderNow()) return;
    const last = getBackupLastAt();
    if (reason === "autoPermission") msg.textContent = "自動バックアップの保存先に、書き込む許可が必要です。ボタンを押すと今すぐ保存します。";
    else if (reason === "autoFail") msg.textContent = "自動バックアップを保存できませんでした。保存先のフォルダを選び直してください。";
    else if (reason === "archive") msg.textContent = "学期の記録を保存しました。念のため、バックアップも取っておきませんか。";
    else if (last) msg.textContent = `前回のバックアップから${Math.floor((Date.now() - last) / DAY_MS)}日たちました。記録を守るためにファイルに書き出しておきませんか。`;
    else msg.textContent = "バックアップをまだ取っていません。記録はこのブラウザの中にだけ保存されています。ファイルに書き出しておくと安心です。";
    bar.dataset.reason = reason || "";
    if (btn) btn.textContent = reason === "autoPermission" ? "💾 今すぐ保存する" : (reason === "autoFail" ? "📁 保存先を選び直す" : "💾 バックアップする");
    bar.hidden = false;
}

function hideBackupReminder() { const bar = $id("backupReminderBar"); if (bar) bar.hidden = true; }

function snoozeBackupReminder(days) { lsSet("backup_snooze_until", String(Date.now() + days * DAY_MS)); }

function backupReminderBackupNow() {
    const bar = $id("backupReminderBar");
    const reason = bar ? bar.dataset.reason : "";
    if (reason === "autoPermission") { runAutoBackup(true, true).then(ok => { if (!ok) openBackupModal(); }); return; }
    if (reason === "autoFail") { hideBackupReminder(); openBackupModal(); return; }
    snoozeBackupReminder(1); openBackupModal();
}

function backupReminderLater() { snoozeBackupReminder(BACKUP_SNOOZE_LATER_DAYS); hideBackupReminder(); }

function backupReminderStop() {
    lsSet("backup_remind_days", "0");
    hideBackupReminder();
    showToast("お知らせを止めました。バックアップの画面でいつでも戻せます。", "success");
}

function checkBackupReminder() {
    const bar = $id("backupReminderBar");
    if (!bar || !bar.hidden) return;
    if (shouldRemindBackup() && canShowBackupReminderNow()) showBackupReminder("overdue");
}

function countJsonEntries(text) {
    try { const v = JSON.parse(text); return Array.isArray(v) ? v.length : (v && typeof v === "object" ? Object.keys(v).length : 0); } catch (error) { return 0; }
}

// 復元の前に、バックアップと、いまの端末の中身を並べて見せます。

const RESTORE_PREVIEW_ROWS = [
    ["クラスプリセット", "seat_shuffler_presets", "件"],
    ["指名の記録", "nomination_history_log", "人分"],
    ["座席の記録", "seat_history_log", "人分"],
    ["席替えの履歴", "seat_layout_log", "回分"],
    ["学期のアーカイブ", "stats_archives", "件"],
    ["離す設定", "separation_pairs", "組"],
    ["近くに置く設定", "near_pairs", "組"],
    ["ふりがな", "furigana_map", "人分"],
    ["他のクラスの記録", "class_records_v1", "クラス分"]
];

// ---- 復元する内容を選ぶ（クラスと記録／席替えの条件／見た目・演出などの設定）----
const RESTORE_GROUPS = [
    { id: "classes", label: "クラスと記録", note: "クラス、名簿、指名や座席の記録、席替えの履歴、希望メモなど" },
    { id: "rules", label: "席替えの条件", note: "前の席を避ける、離す・近くに置く、優先順位、条件セットなど" },
    { id: "settings", label: "見た目・演出・タイマーなどの設定", note: "テーマ、演出、タイマー、音、プラグインの選び方など" }
];
const RESTORE_CLASS_KEYS = ["seat_shuffler_presets", "seat_history_log", "nomination_history_log", "seat_layout_log", "pair_history_log", "stats_archives", "class_records_v1", "active_class_id", "roster_map_memory", "furigana_map", "seat_timeline", "class_history_v1", "nominate_queue_v1", "seat_wishes_v1", "seat_notes"];
const RESTORE_RULE_KEYS = ["avoid_same_seat", "avoid_neighbor", "avoid_depth", "avoid_repeat_pairs", "separation_pairs", "near_pairs", "condition_priority", "seat_fair_v1", "seat_rule_sets_v1", "class_settings_on_v1", "class_settings_cats_v1"];
function restoreGroupOf(key) {
    if (RESTORE_CLASS_KEYS.includes(key) || (typeof CLASS_RECORD_KEYS !== "undefined" && CLASS_RECORD_KEYS.includes(key))) return "classes";
    if (RESTORE_RULE_KEYS.includes(key) || /^luck_/.test(key)) return "rules";
    return "settings";
}
function buildRestoreGroupsHtml(items) {
    const count = {};
    Object.keys(items).forEach(k => { const g = restoreGroupOf(k); count[g] = (count[g] || 0) + 1; });
    const active = RESTORE_GROUPS.filter(g => count[g.id]);
    if (active.length < 2) return "";
    return `<div class="rp-groups"><div class="rp-groups-title">復元する内容を選べます</div>`
        + active.map(g => `<label class="rp-group"><input type="checkbox" class="rp-group-cb" data-group="${g.id}" checked onchange="onRestoreGroupChange()"><span><b>${g.label}</b>　${count[g.id]}件<br><small>${g.note}</small></span></label>`).join("")
        + `</div>`;
}
function selectedRestoreGroups() {
    const boxes = document.querySelectorAll(".rp-group-cb");
    if (!boxes.length) return null;   // 選ぶ欄が無い時は、全て
    const set = new Set();
    boxes.forEach(b => { if (b.checked) set.add(b.dataset.group); });
    return set;
}
function onRestoreGroupChange() {
    const sel = selectedRestoreGroups();
    const apply = $id("backupApplyBtn");
    if (apply) { apply.disabled = !!sel && sel.size === 0; apply.style.opacity = apply.disabled ? "0.5" : ""; }
}

let pendingRestoreLoss = [];   // [{ g: 内容の種類, t: 文 }]

function getObjectKeysFromJsonText(text) {
    try { const v = JSON.parse(text); return (v && typeof v === "object" && !Array.isArray(v)) ? Object.keys(v) : []; } catch (error) { return []; }
}

function buildRestorePreviewHtml(items, data, when, n) {
    const cur = buildBackupData(false).data.items;
    const clearsRecords = items.class_records_v1 !== undefined;
    const rows = [], loss = [];
    RESTORE_PREVIEW_ROWS.forEach(([label, key, unit]) => {
        const willClear = items[key] === undefined && clearsRecords && CLASS_RECORD_KEYS.includes(key);
        if (items[key] === undefined && !willClear) return;
        const b = items[key] !== undefined ? countJsonEntries(items[key]) : 0;
        const c = cur[key] !== undefined ? countJsonEntries(cur[key]) : 0;
        if (b === 0 && c === 0) return;
        const less = b < c;
        if (less) loss.push({ g: restoreGroupOf(key), t: `${label}が、${c}${unit}から${b}${unit}に減ります。` });
        rows.push(`<tr${less ? ' class="rp-less"' : ""}><th>${escapeStatsHtml(label)}</th><td>${b}${unit}</td><td>${c}${unit}</td></tr>`);
    });
    const notes = [];
    if (items.seat_shuffler_presets !== undefined) {
        const bNames = getObjectKeysFromJsonText(items.seat_shuffler_presets);
        const cNames = getObjectKeysFromJsonText(cur.seat_shuffler_presets || "{}");
        const lost = cNames.filter(x => !bNames.includes(x));
        const added = bNames.filter(x => !cNames.includes(x));
        if (lost.length) { loss.push({ g: "classes", t: `今の端末にだけあるクラス「${lost.join("」「")}」が消えます。` }); notes.push(`<li class="rp-warn">今の端末にだけあるクラスが、消えます：${escapeStatsHtml(lost.join("、"))}</li>`); }
        if (added.length) notes.push(`<li>バックアップにだけあるクラスが、増えます：${escapeStatsHtml(added.join("、"))}</li>`);
    }
    let days = 0;
    try { const d = new Date(data.createdAt); if (!isNaN(d)) days = Math.floor((Date.now() - d.getTime()) / DAY_MS); } catch (error) { /* 日数は出さない */ }
    if (days >= 30) notes.push(`<li class="rp-warn">このバックアップは保存してから${days}日たっています。今の端末のほうが新しいことはありませんか。</li>`);
    if (loss.length && !notes.some(x => x.includes("rp-warn"))) notes.push(`<li class="rp-warn">減る項目があります。復元の前に今の内容を書き出しておくと安心です。</li>`);
    pendingRestoreLoss = loss;
    const ver = data.appVersion ? `　バージョン ${escapeStatsHtml(String(data.appVersion))}` : "";
    return `<strong>${when ? escapeStatsHtml(when) + " のバックアップ" : "バックアップ"}　${n}件${ver}</strong>`
        + (rows.length ? `<table class="rp-table"><thead><tr><th></th><th>バックアップ</th><th>今の端末</th></tr></thead><tbody>${rows.join("")}</tbody></table>` : "")
        + (notes.length ? `<ul class="rp-notes">${notes.join("")}</ul>` : "")
        + `<button type="button" class="btn-secondary btn-compact" onclick="exportBackup()" style="width: auto; margin-top: 6px; padding: 6px 12px; font-size: 12px;">📤 復元の前に、今の内容を書き出す</button>`
        + buildRestoreGroupsHtml(items)
        + `<br><span style="color:#dc2626;">復元すると選んだ内容はこのバックアップの内容で上書きされます。</span>`;
}

function onBackupFileChosen(input) {
    const file = input && input.files && input.files[0];
    const info = $id("backupImportInfo"), apply = $id("backupApplyBtn");
    pendingBackup = null;
    if (apply) { apply.style.display = "none"; apply.disabled = false; apply.style.opacity = ""; }
    pendingRestoreLoss = [];
    if (!file) return;
    if (file.size > BACKUP_MAX_BYTES) { if (info) info.textContent = "ファイルが大きすぎます。バックアップのファイルを選んでください。"; return; }
    const reader = new FileReader();
    reader.onload = () => {
        let data = null;
        try { data = JSON.parse(String(reader.result)); } catch (error) { data = null; }
        if (!data || data.app !== "seat-shuffler-backup" || !data.items || typeof data.items !== "object") {
            if (info) info.textContent = "このファイルは席替えし太郎のバックアップではないようです。";
            return;
        }
        const items = {};
        Object.keys(data.items).forEach(k => {
            const v = data.items[k];
            if (typeof v !== "string") return;
            if (isBackupKey(k) || (k === "saved_gas_url" && data.includesGasUrl === true)) items[k] = v;
        });
        const n = Object.keys(items).length;
        if (n === 0) { if (info) info.textContent = "復元できる設定・記録が入っていませんでした。"; return; }
        pendingBackup = items;
        let when = "";
        try { const d = new Date(data.createdAt); if (!isNaN(d)) when = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; } catch (error) { /* 日時は表示しない */ }
        if (info) info.innerHTML = buildRestorePreviewHtml(items, data, when, n);
        if (apply) apply.style.display = "";
    };
    reader.onerror = () => { if (info) info.textContent = "ファイルを読み込めませんでした。"; };
    reader.readAsText(file);
}

function applyBackupImport() {
    if (isAppLocked()) { showLockedToast(); return; }
    if (!pendingBackup) return;
    const sel = selectedRestoreGroups();   // null なら、全て
    if (sel && sel.size === 0) { showToast("復元する内容を、1つ以上、選んでください。", "error"); return; }
    const items = {};
    Object.keys(pendingBackup).forEach(k => { if (!sel || sel.has(restoreGroupOf(k))) items[k] = pendingBackup[k]; });
    const includesClasses = !sel || sel.has("classes");
    const loss = pendingRestoreLoss.filter(x => !sel || sel.has(x.g)).map(x => x.t);
    if (loss.length && !confirm(`復元すると次のものが減ったり、消えたりします。\n・${loss.join("\n・")}\nよろしいですか？`)) return;
    let saved = 0;
    if (includesClasses) {
        if (items.class_records_v1 !== undefined) {
            // クラスごとの記録が入ったバックアップ：入っていない記録は、今の端末のものを残さない
            CLASS_RECORD_KEYS.forEach(k => { if (items[k] === undefined) { try { localStorage.removeItem(k); } catch (error) {} } });
            lsSet("legacy_records_pending", "0");
            try { localStorage.removeItem("trial_return_class"); } catch (error) {}
        } else if (activeClassId === TRIAL_CLASS_ID) {
            // 古い形式のバックアップは、サンプルではなく、元のクラスの記録として戻す
            lsSet("active_class_id", lsGet("trial_return_class", ""));
            try { localStorage.removeItem("trial_return_class"); } catch (error) {}
        }
    }
    Object.keys(items).forEach(k => { try { localStorage.setItem(k, items[k]); saved++; } catch (error) { /* 容量が足りない項目は、飛ばす */ } });
    pendingBackup = null;
    pendingRestoreLoss = [];
    closeBackupModal();
    showToast(`${saved}件の設定・記録を復元しました。画面を読み込み直します。`, "success");
    setTimeout(() => location.reload(), 900);
}

// ---- 本体への登録（必須：オン・オフの切り替えはできません） ----
SekigaeApp.registerPlugin({
    id: "backup",
    name: "バックアップと復元",
    version: "1.0",
    required: true,
    description: "設定・記録の書き出し、自動バックアップ、復元、バックアップのお知らせです。"
});
