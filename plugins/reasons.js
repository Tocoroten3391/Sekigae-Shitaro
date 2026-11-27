// ==========================================
// 固定理由メモの一覧プラグイン：座席の固定やわがまま指定に付けたメモを、まとめて確認・編集できます。
// このファイルを index.html から外すと、この機能は、まとめて使えなくなります
// （画面の部品は、index.html の data-plugin="reasons" で結びついていて、自動で隠れます）
// ==========================================
function getMemoRuleLabel(st) {
    if (st.type === 'fixed') return `${st.fixedLabel} 席に固定`;
    if (st.type === 'secret') return `ひみつの席 ${st.fixedLabel}`;
    if (st.type === 'row') return `${st.areaVal}行目の中`;
    if (st.type === 'col') return `${st.areaVal}列目の中`;
    if (st.type === 'custom') return getCustomRuleText(st.areaVal);
    return "指定なし";
}
function openMemoListModal() {
    const body = $id("memoListBody");
    if (!body) return;
    body.innerHTML = "";

    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) : 6;
    let count = 0;

    getParsedStudentsList(lastRawList, cols).forEach((st, idx) => {
        if (!st.memo) return;
        count++;
        let displayName = st.original.replace(/\[休\]/g, "").replace(/[（\(].*?[）\)]/g, "");
        displayName = displayName.includes(".") ? displayName.split(".").slice(1).join(".").trim() : displayName.trim();

        const item = document.createElement("div");
        item.className = "memo-list-item";

        const head = document.createElement("div");
        head.className = "memo-list-head";
        const nameEl = document.createElement("strong");
        nameEl.textContent = displayName;
        const ruleEl = document.createElement("span");
        ruleEl.textContent = getMemoRuleLabel(st);
        head.append(nameEl, ruleEl);

        const input = document.createElement("input");
        input.type = "text";
        input.value = st.memo;
        input.setAttribute("aria-label", `${displayName}の固定理由`);
        input.onchange = () => updateMemoFromList(idx, input.value);

        item.append(head, input);
        body.appendChild(item);
    });

    if (count === 0) {
        body.innerHTML = '<p class="stats-empty">固定理由のメモはまだありません。座席設定で「固定理由」を入力するとここに一覧表示されます。</p>';
    }
    const countEl = $id("memoListCount");
    if (countEl) countEl.textContent = count > 0 ? `${count}件` : "";

    const overlay = $id("memoListModalOverlay");
    if (overlay) overlay.style.display = "flex";
}
function closeMemoListModal() {
    const overlay = $id("memoListModalOverlay");
    if (overlay) overlay.style.display = "none";
}

// 一覧の入力欄で書き換えたメモを名簿に反映する。空にするとメモだけを消す（固定は残る）。
function updateMemoFromList(targetIdx, newMemo) {
    saveSeatHistory();
    const text = newMemo.replace(/[<>]/g, "").trim();
    const original = lastRawList[targetIdx] || "";
    const stripped = original.replace(/<[^>]*>/, "").trim();
    lastRawList[targetIdx] = text ? `${stripped}<${text}>` : stripped;

    const input = $id("studentInput");
    if (input) input.value = lastRawList.join(", ");
    showToast(text ? "固定理由を更新しました。" : "固定理由を削除しました。", "success");
    onLayoutChange();
    openMemoListModal();
}
function openWagamamaModal() {
    const tbody = $id("wagamamaTableBody"); 
    if (!tbody) return; 
    tbody.innerHTML = ""; 
    
    const colSel = $id("columnSelect");
    const cols = colSel ? parseInt(colSel.value, 10) : 6; 
    let count = 0;
    
    getParsedStudentsList(lastRawList, cols).forEach((st, idx) => {
        if (st.type === 'row' || st.type === 'col' || st.type === 'custom') {
            count++; 
            const tr = document.createElement("tr");
            
            const tdName = document.createElement("td"); 
            let displayName = st.original.replace(/\[休\]/g, "").replace(/[（\(].*?[）\)]/g, ""); 
            tdName.textContent = displayName.includes(".") ? displayName.split(".")[1].trim() : displayName; 
            tdName.style.fontWeight = "bold";
            
            const tdRule = document.createElement("td"); 
            if (st.type === 'row') tdRule.textContent = `${st.areaVal}行目の中`; 
            if (st.type === 'col') tdRule.textContent = `${st.areaVal}列目の中`; 
            if (st.type === 'custom') tdRule.textContent = getCustomRuleText(st.areaVal); 
            tdRule.style.color = "var(--uis-head, #0284c7)";
            if (st.memo) { tdRule.textContent += " メモあり"; tdRule.title = "理由: " + st.memo; }
            
            const tdAction = document.createElement("td");
            const btn = document.createElement("button"); 
            btn.textContent = "✕ 解除"; 
            btn.className = "btn-delete-mini btn-rounded-box"; 
            btn.style.margin = "0 auto"; 
            btn.onclick = () => removeWagamamaTag(idx); 
            tdAction.appendChild(btn); 
            
            tr.appendChild(tdName); 
            tr.appendChild(tdRule); 
            tr.appendChild(tdAction); 
            tbody.appendChild(tr);
        }
    });
    
    if (count === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="color:#94a3b8; padding: 20px;">わがまま設定されている生徒はいません</td></tr>`;
    }
    
    document.body.style.overflow = "hidden"; 
    const overlay = $id("wagamamaModalOverlay");
    if (overlay) overlay.style.display = "flex";
}
function closeWagamamaModal() { 
    document.body.style.overflow = ""; 
    const overlay = $id("wagamamaModalOverlay");
    if (overlay) overlay.style.display = "none"; 
}
function removeWagamamaTag(targetIdx) { 
    saveSeatHistory(); 
    let cleanName = lastRawList[targetIdx].replace(/\[行\d+\]/g, "").replace(/\[列[A-Za-z]\]/gi, "").replace(/\[範囲[A-Za-z]\d+-[A-Za-z]\d+\]/g, "").replace(/\[自由(?:行列|席):[^\]]*\]/g, "").trim(); 
    lastRawList[targetIdx] = cleanName; 
    
    const input = $id("studentInput");
    if (input) input.value = lastRawList.join(", "); 
    
    let displayName = cleanName.replace(/\[休\]/g, "").replace(/[（\(].*?[）\)]/g, ""); 
    if (displayName.includes(".")) displayName = displayName.split(".")[1].trim(); 
    
    showToast(`${displayName} のわがまま指定を解除しました`, "success"); 
    openWagamamaModal(); 
    onLayoutChange(); 
}

// ---- 本体への登録 ----
SekigaeApp.registerPlugin({
    id: "reasons",
    name: "固定理由メモの一覧",
    version: "1.1",
    description: "座席の固定やわがまま指定に付けたメモを、まとめて確認・編集できます。",
    stubs: []
});
