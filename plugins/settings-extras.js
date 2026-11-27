// ==========================================
// 設定の仕上げプラグイン：設定を開いたとき、前回の位置に戻ります。区分ごとに「初期値に戻す」ボタンも付きます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// ==========================================
const SX_POS_KEY = "settings_last_pos_v1";

// 初期値に戻せる区分と、その区分が覚えている設定の名前です（名簿や座席表などの大事なデータは、入れません）
const SX_RESET_MAP = {
    title: ["app_title_text", "app_title_show"],
    theme: ["app_theme", "season_deco", "follow_system_dark"],
    seatview: ["seat_text_scale", "classroom_zoom"],
    display: ["ui_scale"],
    perf: ["smooth_animation", "lite_mode"],
    timerview: ["timer_gauge_type", "timer_gauge_bold", "timer_mini_bar", "show_milliseconds", "show_hours_format", "use_12hour_clock", "clock_12h_ampm", "warning_percentage", "timer_end_anim"],
    alarm: ["continuous_alarm", "silent_test_mode"],
    anim: ["shuffle_anim_type", "shuffle_anim_speed", "shuffle_sound", "random_anim_scope"],
    groupview: ["group_mark_on", "group_mark_scope", "group_number_order", "group_color_1", "group_color_2", "group_color_3", "group_color_4", "group_color_5", "group_color_6", "group_color_7", "group_color_8"]
};

function sxReadPos() {
    try { return JSON.parse(lsGet(SX_POS_KEY, "{}")) || {}; } catch (e) { return {}; }
}

function sxWritePos(patch) {
    const cur = sxReadPos();
    Object.keys(patch).forEach(k => { cur[k] = patch[k]; });
    lsSet(SX_POS_KEY, JSON.stringify(cur));
}

function sxSearching() {
    const input = $id("configSearchInput");
    return !!(input && input.value.trim());
}

// 設定を開いたときに、前回見ていた位置まで、スクロールを戻します
function sxRestorePosition() {
    const cc = $id("configContainer");
    if (!cc || !cc.classList.contains("open") || sxSearching()) return;
    const pos = sxReadPos();
    const apply = () => {
        if (typeof isConfigWide === "function" && isConfigWide()) {
            const act = cc.querySelector(":scope > .config-section.is-wide-active");
            if (act) act.scrollTop = pos.wideTop || 0;
        } else {
            cc.scrollTop = pos.top || 0;
        }
    };
    apply();
    requestAnimationFrame(() => { apply(); setTimeout(apply, 60); });
}

function sxSectionTitle(sec) {
    return typeof configSectionTitle === "function" ? configSectionTitle(sec) : (sec.querySelector("h3") ? sec.querySelector("h3").textContent.trim() : "");
}

function sxResetSection(secId) {
    if (isAppLocked()) { showLockedToast(); return; }
    const sec = document.querySelector('#configContainer > .config-section[data-sec="' + secId + '"]');
    const keys = SX_RESET_MAP[secId];
    if (!sec || !keys) return;
    const title = sxSectionTitle(sec).replace(/^[^\p{L}\p{N}\s]+\s*/u, "");
    if (!confirm("「" + title + "」の設定を、初期値に戻します。名簿や座席表は、そのままです。画面を読み込み直します。よろしいですか？")) return;
    keys.forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* 何もしない */ } });
    showToast("初期値に戻しました。画面を読み込み直します。", "success");
    setTimeout(() => SekigaeApp.reloadNow(), 500);
}

function sxBuildResetRows() {
    Object.keys(SX_RESET_MAP).forEach(secId => {
        const sec = document.querySelector('#configContainer > .config-section[data-sec="' + secId + '"]');
        if (!sec || sec.querySelector(":scope .sx-reset-row")) return;
        const row = document.createElement("div");
        row.className = "sx-reset-row";
        row.setAttribute("data-plugin", "settings-extras");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "sx-reset-btn btn-compact";
        btn.textContent = "この区分を初期値に戻す";
        btn.onclick = () => sxResetSection(secId);
        row.appendChild(btn);
        if (typeof makeInfoTip === "function") row.appendChild(makeInfoTip("この区分の設定だけを、はじめの状態に戻します。名簿や座席表、他の区分の設定は、そのままです。"));
        sec.appendChild(row);
    });
}

function sxTrackScroll() {
    const cc = $id("configContainer");
    if (!cc || cc.dataset.sxTrack) return;
    cc.dataset.sxTrack = "1";
    let timer = null;
    cc.addEventListener("scroll", ev => {
        if (!cc.classList.contains("open") || sxSearching()) return;
        const t = ev.target;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = null;
            if (t === cc) sxWritePos({ top: cc.scrollTop });
            else if (t.classList && t.classList.contains("is-wide-active")) sxWritePos({ wideTop: t.scrollTop });
        }, 150);
    }, true);
}

SekigaeApp.registerPlugin({
    id: "settings-extras",
    name: "設定の仕上げ",
    version: "1.0",
    description: "設定を開いた時、前回の位置に戻ります。区分ごとに「初期値に戻す」ボタンが付きます。",
    searchWords: "設定 位置 前回 初期値 リセット 戻す 初期化",
    mount(app) {
        app.insertInto("guide-faq", "<li data-plugin=\"settings-extras\"><strong>設定を、もとの状態に戻したい</strong>：設定の、各区分の一番下にある「この区分を初期値に戻す」を押します。名簿や座席表は、そのままです。</li>");
        const style = document.createElement("style");
        style.id = "settingsExtrasStyle";
        style.textContent = `
.sx-reset-row { display: flex; align-items: center; gap: 6px; justify-content: flex-end; margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--seat-border, #cbd5e1); }
.config-container .sx-reset-row button.sx-reset-btn { width: auto !important; margin-top: 0; padding: 4px 12px; font-size: 12px; height: 30px; background: transparent; color: var(--text-sub, #64748b); border: 1px solid var(--seat-border, #cbd5e1); }
.config-container .sx-reset-row button.sx-reset-btn:hover { background: rgba(100,116,139,0.12); }`;
        document.head.appendChild(style);
        sxBuildResetRows();
        sxTrackScroll();
        if (typeof window.toggleConfigMenu === "function" && !window.toggleConfigMenu._sx) {
            const orig = window.toggleConfigMenu;
            const wrapped = function () {
                const r = orig.apply(this, arguments);
                sxRestorePosition();
                return r;
            };
            wrapped._sx = true;
            window.toggleConfigMenu = wrapped;
        }
    }
});
