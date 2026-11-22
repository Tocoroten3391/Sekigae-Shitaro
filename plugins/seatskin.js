// ==========================================
// 座席表の着せ替えプラグイン：座席表の席を、映画館・電車・回転寿司の見た目に変えます。画面に出ている座席表だけが変わります
// 印刷や、共有の画像には、ふくまれません
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// ==========================================
const SKIN_KEY = "seat_skin";
const SKINS = [
    { id: "none", icon: "▢", name: "ふつう", desc: "いつもの席です" },
    { id: "cinema", icon: "🎬", name: "映画館", desc: "赤いビロードの席です" },
    { id: "train", icon: "🚃", name: "電車", desc: "青い座席シートです" },
    { id: "sushi", icon: "🍣", name: "回転寿司", desc: "お皿がならびます" },
    { id: "map", icon: "📍", name: "地図", desc: "席が地図のピンになります" }
];
// 地図のピン（赤いしずく形）。席の下にならべます
const SKIN_PIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 36 50'%3E%3Cpath d='M18 49C18 49 3 31 3 17.5A15 15 0 1 1 33 17.5C33 31 18 49 18 49Z' fill='%23ea4335' stroke='%23a52714' stroke-width='1.5'/%3E%3Ccircle cx='18' cy='17.5' r='6' fill='%238c1c13'/%3E%3C/svg%3E\")";

// 座席表の席と、見本の席の、両方に同じ見た目を当てる
function skinSel(id, tail) {
    const base = ' .seat:not([class*="group-"]):not(.is-empty-target):not(.is-absent):not(.is-fixed)';
    const t = tail || "";
    return 'body:not(.blackboard-active).sk-' + id + ' #classroom' + base + t + ', .skin-sample.sk-' + id + base + t;
}
// 班の色を付けた席は、色はそのままにして、飾りだけを重ねる
function skinSelG(id, tail) {
    const base = ' .seat[class*="group-"]:not(.is-absent)';
    const t = tail || "";
    return 'body:not(.blackboard-active).sk-' + id + ' #classroom' + base + t + ', .skin-sample.sk-' + id + base + t;
}
function skinCss() {
    const texts = id => skinSel(id, " .seat-name") + ", " + skinSel(id, " .seat-no") + ", " + skinSel(id, " .seat-position");
    return `
@media screen {
${skinSel("cinema")} { background: linear-gradient(90deg, #3f0a16 0 9%, #7f1d2d 9% 91%, #3f0a16 91% 100%); border: 2px solid #2b0710; border-radius: 16px 16px 6px 6px; box-shadow: inset 0 -10px 0 rgba(0,0,0,0.28), inset 0 8px 10px rgba(255,255,255,0.12), 0 2px 5px rgba(0,0,0,0.35); }
${texts("cinema")} { color: #fde68a !important; text-shadow: 0 1px 2px rgba(0,0,0,0.55); }
${skinSelG("cinema")} { background-image: linear-gradient(90deg, rgba(127,29,45,0.6) 0 9%, transparent 9% 91%, rgba(127,29,45,0.6) 91% 100%); border-radius: 16px 16px 6px 6px; box-shadow: inset 0 -10px 0 rgba(0,0,0,0.18), 0 2px 5px rgba(0,0,0,0.3); }
${skinSelG("train")} { background-image: radial-gradient(circle, rgba(30,58,138,0.45) 1.6px, transparent 2px); background-size: 12px 12px; border-radius: 10px; box-shadow: inset 0 -8px 0 rgba(23,37,84,0.25), 0 2px 4px rgba(0,0,0,0.25); }
${skinSelG("sushi")} { background-image: radial-gradient(ellipse 46% 40% at 50% 52%, #ffffff 0 78%, #e2e8f0 80% 92%, transparent 94%); }
${skinSel("train")} { background-color: #1e3a8a; background-image: radial-gradient(circle, #60a5fa 1.6px, transparent 2px), radial-gradient(circle, #3b82f6 1.2px, transparent 1.6px); background-size: 12px 12px, 12px 12px; background-position: 0 0, 6px 6px; border: 2px solid #0f1f4d; border-radius: 10px; box-shadow: inset 0 -8px 0 #172554, 0 2px 4px rgba(0,0,0,0.3); }
${texts("train")} { color: #ffffff !important; text-shadow: 0 1px 2px rgba(0,0,0,0.6); }
${skinSel("sushi")} { background-color: #a16207; background-image: radial-gradient(ellipse 46% 40% at 50% 52%, #ffffff 0 78%, #e2e8f0 80% 92%, transparent 94%), repeating-linear-gradient(90deg, rgba(0,0,0,0.08) 0 6px, transparent 6px 12px); border: 2px solid #713f12; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
${texts("sushi")} { color: #7f1d1d !important; }
${skinSel("map", ":not(:empty)")} { background-color: #e9f1e1; background-image: ${SKIN_PIN}, linear-gradient(90deg, transparent 0 22%, #ffffff 22% 29%, transparent 29% 100%), linear-gradient(0deg, transparent 0 58%, #fde68a 58% 66%, transparent 66% 100%), linear-gradient(135deg, transparent 0 70%, #bfdbfe 70% 100%); background-repeat: no-repeat; background-size: 15px 21px, 100% 100%, 100% 100%, 100% 100%; background-position: 50% calc(100% - 3px), 0 0, 0 0, 0 0; padding-bottom: 20px; border: 2px solid #94a3b8; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.25); }
${skinSelG("map", ":not(:empty)")} { background-image: ${SKIN_PIN}; background-repeat: no-repeat; background-size: 15px 21px; background-position: 50% calc(100% - 3px); padding-bottom: 20px; border-radius: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.25); }
${skinSel("map", " .seat-name")}, ${skinSelG("map", " .seat-name")} { background: #ffffff; border: 1px solid #94a3b8; border-radius: 10px; padding: 1px 8px; box-shadow: 0 2px 3px rgba(0,0,0,0.22); color: #1f2937 !important; }
${skinSel("sushi", " .seat-position")} { color: #fef3c7 !important; }
.skin-sample { display: flex; gap: 6px; justify-content: center; }
.skin-sample .seat { position: relative; width: 62px; height: 50px; display: flex; flex-direction: column; align-items: center; justify-content: center; border: 1px solid #cbd5e1; border-radius: 8px; background: #fff; }
.skin-sample.sk-map .seat { height: 64px; }
.skin-sample .seat-no { font-size: 10px; font-weight: 600; margin: 0; }
.skin-sample .seat-name { font-size: 13px; font-weight: 700; margin: 0; }
}
.skin-overlay { position: fixed; inset: 0; z-index: 2900; display: none; align-items: center; justify-content: center; background: rgba(15,23,42,0.55); padding: 12px; }
.skin-box { width: min(94vw, 560px); max-height: 94vh; overflow-y: auto; background: #fff; color: #1f2937; border-radius: 16px; padding: 18px; box-shadow: 0 20px 50px rgba(0,0,0,0.4); }
.skin-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; }
.skin-head h3 { margin: 0; font-size: 18px; }
.skin-x { border: none; background: #e5e7eb; border-radius: 8px; padding: 5px 12px; font-weight: 700; cursor: pointer; }
.skin-list { display: grid; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); gap: 10px; }
.skin-card { display: flex; flex-direction: column; gap: 6px; align-items: center; border: 2px solid #e2e8f0; border-radius: 12px; padding: 10px; cursor: pointer; background: #f8fafc; text-align: center; }
.skin-card.is-on { border-color: #2563eb; background: #eff6ff; }
.skin-card b { font-size: 15px; }
.skin-card small { color: #64748b; }
`;
}
function skinAddStyle() {
    let st = $id("skinStyle");
    if (st) return;
    st = document.createElement("style");
    st.id = "skinStyle";
    st.textContent = skinCss();
    document.head.appendChild(st);
}
function skinCurrent() {
    const v = lsGet(SKIN_KEY, "none");
    return SKINS.some(s => s.id === v) ? v : "none";
}
function skinApply(id) {
    SKINS.forEach(s => document.body.classList.remove("sk-" + s.id));
    if (id && id !== "none") document.body.classList.add("sk-" + id);
}
function setSeatSkin(id) {
    if (!SKINS.some(s => s.id === id)) id = "none";
    lsSet(SKIN_KEY, id);
    skinApply(id);
    skinRenderList();
    if (typeof fitClassroomToScreen === "function") { try { fitClassroomToScreen(); } catch (e) { } }
}
function skinRenderList() {
    const cur = skinCurrent();
    $id("skinList").innerHTML = SKINS.map(s => {
        const sample = '<div class="skin-sample sk-' + s.id + '"><div class="seat"><span class="seat-no">5</span><span class="seat-name">山田</span></div><div class="seat group-2"><span class="seat-no">12</span><span class="seat-name">佐藤</span></div></div>';
        return '<div class="skin-card' + (s.id === cur ? " is-on" : "") + '" data-skin="' + s.id + '" role="button" tabindex="0"><b>' + s.icon + ' ' + s.name + '</b>' + sample + '<small>' + s.desc + '</small></div>';
    }).join("");
    $id("skinList").querySelectorAll(".skin-card").forEach(c => {
        c.onclick = () => setSeatSkin(c.dataset.skin);
        c.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSeatSkin(c.dataset.skin); } };
    });
}
function openSeatSkin() {
    if (typeof closePopMenus === "function") closePopMenus();
    skinAddStyle();
    skinRenderList();
    $id("skinOverlay").style.display = "flex";
}
function closeSeatSkin() { $id("skinOverlay").style.display = "none"; }

const SKIN_HTML = `
<div id="skinOverlay" class="skin-overlay" onclick="if(event.target===this)closeSeatSkin()">
    <div class="skin-box">
        <div class="skin-head"><h3>🚃 座席表の着せ替え</h3><button type="button" class="skin-x" onclick="closeSeatSkin()">とじる</button></div>
        <div class="skin-list" id="skinList"></div>
        <p style="font-size:12px; color:#64748b; margin:10px 0 0;">班の色を付けた席や、黒板モードは、そのままの見た目です。印刷と、共有の画像は、ふつうの見た目になります。</p>
    </div>
</div>`;

SekigaeApp.registerPlugin({
    id: "seatskin",
    name: "座席表の着せ替え",
    version: "1.1",
    description: "座席表の席を、映画館・電車・回転寿司の見た目に変えます。画面に出ている座席表だけが変わり、印刷や共有の画像には、ふくまれません。",
    backupKeys: [SKIN_KEY],
    searchWords: "着せ替え スキン 見た目 映画館 電車 回転寿司 デザイン テーマ",
    stubs: [],
    mount(app) {
        skinAddStyle();
        document.body.insertAdjacentHTML("beforeend", SKIN_HTML);
        app.insertInto("settings-seatview", '<button type="button" onclick="openSeatSkin()" class="btn-secondary" id="btnSeatSkin" style="margin-top: 10px;">座席表の着せ替え</button>');
        app.insertInto("guide-faq", "<li><strong>座席表の見た目を変えたい</strong>：設定の「座席の見え方」の「座席表の着せ替え」を押して、映画館・電車・回転寿司・地図から選びます。画面だけが変わり、印刷と共有の画像は、ふつうの見た目です。</li>");
        skinApply(skinCurrent());
    }
});
document.addEventListener("keydown", e => {
    const o = $id("skinOverlay");
    if (e.key === "Escape" && o && o.style.display === "flex") closeSeatSkin();
});
