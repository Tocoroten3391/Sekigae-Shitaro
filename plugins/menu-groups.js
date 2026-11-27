// ==========================================
// 演出まとめプラグイン：「ほかの操作」の中の、封筒くじ・座席の旅・席替え占いを、「演出」の枠にまとめます。
// このファイルを index.html から外すと、4つのボタンは、これまでどおり「ほかの操作」に、ならびます
// ==========================================
const MG_OPEN_KEY = "more_stage_open";
const MG_IDS = ["btnEnvDraw", "btnSeatJourney", "btnFortune"];

function mgSetOpen(open) {
    const box = $id("moreStageBox");
    const head = $id("btnMoreStage");
    if (!box || !head) return;
    box.hidden = !open;
    head.setAttribute("aria-expanded", String(open));
    head.textContent = open ? "🎭 演出 ▴" : "演出 ▾";
    lsSet(MG_OPEN_KEY, open ? "1" : "0");
}

function mgBuild() {
    const more = $id("moreMenu");
    if (!more || $id("moreStageBox")) return;
    const kids = MG_IDS.map(id => $id(id)).filter(Boolean);
    if (!kids.length) return;
    const head = document.createElement("button");
    head.type = "button";
    head.id = "btnMoreStage";
    head.className = "pop-item pop-item-gray";
    head.setAttribute("aria-expanded", "false");
    head.setAttribute("aria-controls", "moreStageBox");
    head.onclick = ev => { ev.stopPropagation(); mgSetOpen($id("moreStageBox").hidden); };
    const box = document.createElement("div");
    box.id = "moreStageBox";
    box.className = "more-stage-box";
    box.hidden = true;
    more.appendChild(head);
    more.appendChild(box);
    kids.forEach(k => box.appendChild(k));
    mgSetOpen(lsGet(MG_OPEN_KEY, "0") === "1");
}

SekigaeApp.registerPlugin({
    id: "menu-groups",
    name: "演出まとめ",
    version: "1.1",
    description: "「他の操作」の中の、封筒くじ・座席の旅・席替え占いを、「演出」の枠にまとめます。",
    searchWords: "演出 まとめ ほかの操作 メニュー 封筒 旅 占い 整理",
    suggests: ["envelope", "seatjourney", "fortune"],
    mount(app) {
        app.insertInto("guide-faq", "<li data-plugin=\"menu-groups\"><strong>封筒くじや席替え占いが見つからない</strong>：「他の操作」の中の「演出」を押すと、封筒くじ、座席の旅、席替え占いが出ます。</li>");
        if ($id("menuGroupsStyle")) return;
        const st = document.createElement("style");
        st.id = "menuGroupsStyle";
        st.textContent = `
.more-stage-box { display: flex; flex-direction: column; gap: 8px; margin-left: 14px; padding-left: 10px; border-left: 3px solid #94a3b8; }
.more-stage-box[hidden] { display: none; }
.more-stage-box .pop-item { height: 44px; min-height: 44px; font-size: 15px; }`;
        document.head.appendChild(st);
    },
    ready() { mgBuild(); }
});
