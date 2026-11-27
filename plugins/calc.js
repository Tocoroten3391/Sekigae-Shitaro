// ==========================================
// 電卓プラグイン：電卓、関数電卓、連立方程式、表とグラフ、電話のプッシュ音
// このファイルを index.html から外すと、電卓のボタンも、設定も、説明も、まとめて消えます
// ==========================================
const CALC_PLUGIN_HTML = {
    "button": "<button type=\"button\" onclick=\"toggleCalculator()\" class=\"btn-config-toggle btn-calc-toggle\" id=\"calcOpenBtn\" aria-haspopup=\"dialog\" aria-expanded=\"false\">🧮 電卓</button>",
    "setting": "<div class=\"switch-container\" style=\"margin-top: 8px;\"><label class=\"switch\"><input type=\"checkbox\" id=\"calcBtnToggle\" onchange=\"onCalcBtnToggle()\"><span class=\"slider\"></span></label><span class=\"switch-label\">画面の左に電卓のボタンを出す</span></div>",
    "guide": [
        "<li>電卓の分数、文字式、メモリのボタンは上の段の「🧰 メニュー」にまとまっています。押すとメニューが開き、ボタンを押すか、他の場所を押すと閉じます。「分数 ⁄」「帯分数」「📦 入れ子」「➡️ 出る」「🔁 表示」、関数電卓の「🧩 展開」から「🔗 連立方程式」まで「MC」から「📞 鳴らす」まで関数電卓の「x」「y」「a」「b」のキーとその値を入れる欄がここにあります。以下の説明の中のボタンは、全て、このメニューを開いて押します。</li>",
        "<li>画面の左上にある「🧮 電卓」を押すと電卓の窓が開きます。窓の上の部分をつかむと、好きな場所へ動かせます。位置は覚えています。</li>",
        "<li>「🔬 関数電卓」に切り替えると、sin、cos、tan、log、ln、√、べき乗、階乗、π、e なども使えます。角度は「度」のキーでラジアンに切り替えられます。</li>",
        "<li>分数は「分数 ⁄」のキーで入れます。押すと分子と分母の四角い枠が上下に並んで出ます。分子を入れて、もう一度「分数 ⁄」を押すと分母に移ります。「1」「分数 ⁄」「2」の順に押しても、1/2 になります。</li>",
        "<li>分子や分母の枠の中にも、sin、cos、√ などの関数や、かっこ、π、演算を入れられます。たとえば「分数 ⁄」「√」「2」「分数 ⁄」「2」の順に押すと、√2/2 になります。分母の中で「＋」「−」「×」「÷」を押すと分母の中で計算を続けます。「1/(1+√2)」は、「分数 ⁄」「1」「分数 ⁄」「1」「＋」「√」「2」の順で入ります。</li>",
        "<li>分母が書き終わったら、「➡️ 出る」を押すと分数の外に出ます。右向きの矢印のキーでも出られます。分母の中で「分数 ⁄」を押すとそこまでの数が新しい分数の分子になるので、「1」「分数 ⁄」「2」「＋」「1」「分数 ⁄」「3」のように分数を続けて足せます。「)」、%、x² などを押した時も、分数の外に出ます。</li>",
        "<li>入れる所は枠を直接押しても選べます。パソコンでは矢印のキーでも移れます。選んでいる枠は青く光ります。</li>",
        "<li>分数の中に分数を入れるには、入力中の枠で「📦 入れ子」を押します。たとえば「分数 ⁄」「📦 入れ子」「1」「分数 ⁄」「2」の順に押すと分子が 1/2 の分数になります。分子が書き終わったら、「分数 ⁄」で一つ外の枠に戻り、もう一度「分数 ⁄」で分母に移ります。「➡️ 出る」は、一つ外の枠に出ます。</li>",
        "<li>関数電卓の「🔗 連立方程式」では、xとyの2本の式を解けます。1本目の式（例　2x＋y＝5）を入れて押し、2本目の式（例　x－y＝1）を入れてもう一度押すと、xとyの値が出ます。解が無いときや、無数にある時もそのとおりに出ます。aやbの入った式は、aやbを使った形で出ます。途中でやめる時は、Cを押します。</li>",
        "<li>電卓の「📞 鳴らす」を押すと答えの数字を電話のボタンの音で順に鳴らします。小数点はほし、マイナスはシャープの音になります。鳴っている間にもう一度押すと止まります。</li>",
        "<li>帯分数は整数の後に「帯分数」を押すと分数の枠が出ます。「1」「帯分数」「1」「分数 ⁄」「2」の順に入れると、1と1/2 になります。分数のまま正確に計算して、約分もします。</li>",
        "<li>答えの分数や帯分数も分子と分母が上下に並ぶ形で出ます。√2/2 のような √ を含む分数も同じです。計算の履歴の中の分数も、同じ形で出ます。「🔁 表示」を押すたびに分数、帯分数、小数の順に切り替わります。</li>",
        "<li>「分数 ⁄」は、かっこや関数の後にも使えます。「sin(30)」「分数 ⁄」「cos(60)」の順に押すと、sin(30)÷cos(60) を分数の形で計算します。</li>",
        "<li>√を含む数も、正確に計算します。√2 は「√2」、√8 は「2√2」と出て、「1+√2」や「√3/2」のような足し算、かけ算、わり算もできます。</li>",
        "<li>sin、cos、tan は、15度の倍数の角度なら、正確な値で出ます。sin(45) は「√2/2」、tan(15) は「2−√3」です。ラジアンでも、π/6 や π/4 のような角度なら同じです。sin⁻¹、cos⁻¹、tan⁻¹ も、正確な値の時は角度がきれいに出ます。</li>",
        "<li>それ以外の角度や、log、ln、πを含む計算は、小数で答えます。「🔁 表示」で、√の形と小数を切り替えられます。</li>",
        "<li>「↩️ 元に戻す」を押すと一つ前の状態にもどります。100回前までさかのぼれます。「=」を押す前にもどすことも、メモリの操作をもどすこともできます。「↪️ やり直し」を押すともどした操作をやり直せます。パソコンでは、Ctrl キーと Z で元に戻し、Ctrl キーと Y でやり直せます。</li>",
        "<li>「🔬 関数電卓」には、x、y、a、b のキーがあります。「2x+1」のように式に入れると関数の計算ができます。キーの下の「値を入れる」を押して、値を電卓のキーで入れ、「=」を押すとその値が入ります。分数や √ の値も入れられます。もう一度「値を入れる」を押すと入力をやめます。値が入っている文字には、「🗑️」のボタンが出て、押すとその値を消せます。値は覚えておきます。値が入っていない文字は、文字のまま計算します。「(x+1)(x−1)」は「x²−1」、「x/2+x/3」は「5x/6」と出ます。値が入っている文字だけは、数として計算します。パソコンのキーボードでも、x、y、a、b を打てます。かけ算は「*」のキーです。「🧩 展開」と「✂️ 因数分解」で、文字式を展開した形と因数分解した形で答えを出せます。整数は素数のかけ算に分けます。「⚖️ 等号 ＝」で方程式を入れて「🔎 方程式を解く」を押すと解が出ます。等号のある式は「=」でも解けます。解く文字は式に x があれば x、なければ y、a、b の順です。2次方程式は √ の形で、3次以上は近い値で出ます。出た解を押すと式に入れられます。「📈 表とグラフ」は、「2x+1」のような文字が1つの式を、x を動かした値の表と、グラフにします。はじめ、おわり、きざみは入れ替えられます。グラフの上をなぞるとその場所の値が出ます。</li>",
        "<li>MC、MR、M+、M− のメモリのキー、履歴、答えのコピーも使えます。パソコンのキーボードでも入力できます。</li>",
        "<li>電卓のボタンは「表示モードと画面の部品」のスイッチで出すかどうかを選べます。ロック中は使えません。</li>"
    ],
    "faq": "<li><strong>ちょっとした計算をしたい</strong>：画面の左上の「🧮 電卓」を押してください。</li>"
};

// ==========================================
// 電卓と関数電卓：画面の左のボタンから開く。動かせる小さな窓で、授業の邪魔になりません
// 分数は、正確な分数のまま計算します。答えは、分数、帯分数、小数で見られます
// ==========================================
const CALC_KEYS_SCI = [
    ["deg", "度", "角度の単位を切り替える", "ck-unit"], ["sin", "sin", "サイン"], ["cos", "cos", "コサイン"], ["tan", "tan", "タンジェント"], ["pi", "π", "円周率"],
    ["asin", "sin⁻¹", "アークサイン"], ["acos", "cos⁻¹", "アークコサイン"], ["atan", "tan⁻¹", "アークタンジェント"], ["log", "log", "常用対数"], ["ln", "ln", "自然対数"],
    ["sq", "x²", "2乗"], ["sqrt", "√", "平方根"], ["pow", "xʸ", "べき乗"], ["pow10", "10ˣ", "10のべき乗"], ["exp", "eˣ", "eのべき乗"],
    ["fact", "n!", "階乗"], ["inv", "1/x", "逆数"], ["abs", "|x|", "絶対値"], ["e", "e", "ネイピア数"], ["ans", "Ans", "前の答え"]
];
// 文字の変数：式の中では、関数の名前（asin や abs）と区別できるように、全角の ｘ ｙ ａ ｂ で持ちます。画面には、ふつうの x y a b で出します
const CALC_VAR_CH = { x: "ｘ", y: "ｙ", a: "ａ", b: "ｂ" };
const CALC_VAR_NAMES = ["x", "y", "a", "b"];
function calcDisp(t) { return t.replace(/ｘ/g, "x").replace(/ｙ/g, "y").replace(/ａ/g, "a").replace(/ｂ/g, "b"); }
const CALC_KEYS_MAIN = [
    ["clear", "C", "全部消す", "ck-fn"], ["(", "(", "かっこを開く", "ck-fn"], [")", ")", "かっこを閉じる", "ck-fn"], ["bs", "⌫", "一つ消す", "ck-fn"],
    ["7", "7"], ["8", "8"], ["9", "9"], ["/", "÷", "わる", "ck-op"],
    ["4", "4"], ["5", "5"], ["6", "6"], ["*", "×", "かける", "ck-op"],
    ["1", "1"], ["2", "2"], ["3", "3"], ["-", "−", "ひく", "ck-op"],
    ["neg", "±", "正負を入れ替える", "ck-fn"], ["0", "0"], [".", ".", "小数点"], ["+", "+", "たす", "ck-op"],
    ["%", "%", "パーセント", "ck-fn"], ["eq", "=", "答えを出す", "ck-eq"]
];
const calc = { expr: "", done: false, ans: null, ansV: null, ansFrac: false, mem: null, hasMem: false, hist: [], open: false, sci: false, deg: true, histOpen: false, err: false, view: "auto", phone: false, phoneDigits: "", keyLog: "", slot: null, undo: [], redo: [], vars: { x: null, y: null, a: null, b: null }, assign: null, saved: null, ansFF: null, sol: null, graph: null, sys: null, menu: false };

// ---- 数の表し方：分数や√のまま持つ「正確な数」と、小数の「近い数」 ----
// 正確な数は、分数 {r:true}、または 係数×√の和 {s:true}。小数は {r:false, x}
const CALC_MATH = { math: true };
const CALC_BIG = { big: true }; // 正確に持てない程大きくなった時は、小数に切り替えます
const calcAbsB = a => (a < 0n ? -a : a);
function calcGcd(a, b) { a = calcAbsB(a); b = calcAbsB(b); while (b) { const t = a % b; a = b; b = t; } return a; }
function calcGcdN(a, b) { while (b) { const t = a % b; a = b; b = t; } return a; }
function calcIsqrt(n) {
    if (n < 2n) return n;
    let x = 1n << BigInt((n.toString(2).length + 1) >> 1);
    for (;;) { const y = (x + n / x) >> 1n; if (y >= x) return x; x = y; }
}
function calcToFloat(V) {
    if (V.p) throw CALC_MATH;
    if (V.r) {
        const f = Number(V.n) / Number(V.d);
        if (!isFinite(f)) throw CALC_MATH;
        return f;
    }
    if (V.s) {
        let x = 0;
        V.t.forEach(([b, n, d]) => { x += Number(n) / Number(d) * Math.sqrt(b); });
        if (!isFinite(x)) throw CALC_MATH;
        return x;
    }
    return V.x;
}
function calcF(x) { if (typeof x !== "number" || !isFinite(x)) throw CALC_MATH; return { r: false, x }; }
function calcR(n, d) {
    if (d === 0n) throw CALC_MATH;
    if (d < 0n) { n = -n; d = -d; }
    const g = calcGcd(n, d) || 1n;
    n /= g; d /= g;
    if (n.toString().length > 400 || d.toString().length > 400) return calcF(Number(n) / Number(d));
    return { r: true, n, d };
}
function calcLit(s) {
    const m = /^(\d*)\.?(\d*)$/.exec(s);
    const frac = m[2] || "";
    return calcR(BigInt((m[1] || "0") + frac), 10n ** BigInt(frac.length));
}
const calcIsExact = V => V.r || V.s;
const CALC_MAX_RAD = 1e15, CALC_MAX_TERMS = 8;
// n = k²×b の形に分けて、[k, b] を返す（b は平方数で割り切れない）
function calcSqFree(n) {
    let k = 1, b = n;
    for (let p = 2; p * p <= b; p++) {
        if (p > 1e6) throw CALC_BIG;
        const pp = p * p;
        while (b % pp === 0) { b /= pp; k *= p; }
    }
    return [k, b];
}
function calcTermsOf(V) { return V.r ? [[1, V.n, V.d]] : V.t; }
function calcMapAdd(m, b, n, d) {
    const cur = m.get(b);
    let nn = n, dd = d;
    if (cur) { nn = cur[0] * d + n * cur[1]; dd = cur[1] * d; }
    const g = calcGcd(nn, dd) || 1n;
    m.set(b, [nn / g, dd / g]);
}
function calcFromMap(m) {
    const t = [];
    Array.from(m.keys()).sort((a, b) => a - b).forEach(b => { const [n, d] = m.get(b); if (n !== 0n) t.push([b, n, d]); });
    if (!t.length) return { r: true, n: 0n, d: 1n };
    if (t.length === 1 && t[0][0] === 1) return calcR(t[0][1], t[0][2]);
    if (t.length > CALC_MAX_TERMS) throw CALC_BIG;
    t.forEach(([b, n, d]) => { if (n.toString().length > 60 || d.toString().length > 60) throw CALC_BIG; });
    return { r: false, s: true, t };
}
function calcSurdAdd(A, B, sign) {
    const m = new Map();
    calcTermsOf(A).forEach(([b, n, d]) => calcMapAdd(m, b, n, d));
    calcTermsOf(B).forEach(([b, n, d]) => calcMapAdd(m, b, sign < 0 ? -n : n, d));
    return calcFromMap(m);
}
function calcSurdMul(A, B) {
    const m = new Map();
    calcTermsOf(A).forEach(([ba, na, da]) => {
        calcTermsOf(B).forEach(([bb, nb, db]) => {
            const g = calcGcdN(ba, bb);
            const bp = (ba / g) * (bb / g);
            if (bp > CALC_MAX_RAD) throw CALC_BIG;
            calcMapAdd(m, bp, na * nb * BigInt(g), da * db);
        });
    });
    return calcFromMap(m);
}
function calcSurdDiv(A, B) {
    const tb = calcTermsOf(B);
    if (tb.length === 1) { // c√b の逆数は √b ÷ (c×b)
        const [b, n, d] = tb[0];
        let num = d, den = n * BigInt(b);
        if (den < 0n) { num = -num; den = -den; }
        const inv = b === 1 ? calcR(num, den) : { r: false, s: true, t: [[b, num / calcGcd(num, den), den / calcGcd(num, den)]] };
        return calcSurdMul(A, inv);
    }
    if (tb.length === 2) { // 2つの項の和は、符号を変えた組をかけて、分母を有理化します
        const [[b1, n1, d1], [b2, n2, d2]] = tb;
        const conj = calcFromMap(new Map([[b1, [n1, d1]], [b2, [-n2, d2]]]));
        const den = calcR(n1 * n1 * BigInt(b1) * d2 * d2 - n2 * n2 * BigInt(b2) * d1 * d1, d1 * d1 * d2 * d2);
        if (den.n === 0n) throw CALC_MATH;
        return calcSurdMul(calcSurdMul(A, conj), calcR(den.d, den.n));
    }
    throw CALC_BIG;
}
function calcExactOr(exact, approx) {
    try { return exact(); } catch (e) { if (e === CALC_BIG) return approx(); throw e; }
}
function calcAddN(a, b) {
    if (a.r && b.r) return calcR(a.n * b.d + b.n * a.d, a.d * b.d);
    if (calcIsExact(a) && calcIsExact(b)) return calcExactOr(() => calcSurdAdd(a, b, 1), () => calcF(calcToFloat(a) + calcToFloat(b)));
    return calcF(calcToFloat(a) + calcToFloat(b));
}
function calcSubVN(a, b) {
    if (a.r && b.r) return calcR(a.n * b.d - b.n * a.d, a.d * b.d);
    if (calcIsExact(a) && calcIsExact(b)) return calcExactOr(() => calcSurdAdd(a, b, -1), () => calcF(calcToFloat(a) - calcToFloat(b)));
    return calcF(calcToFloat(a) - calcToFloat(b));
}
function calcMulN(a, b) {
    if (a.r && b.r) return calcR(a.n * b.n, a.d * b.d);
    if (calcIsExact(a) && calcIsExact(b)) return calcExactOr(() => calcSurdMul(a, b), () => calcF(calcToFloat(a) * calcToFloat(b)));
    return calcF(calcToFloat(a) * calcToFloat(b));
}
function calcDivN(a, b) {
    if (a.r && b.r) { if (b.n === 0n) throw CALC_MATH; return calcR(a.n * b.d, a.d * b.n); }
    if (calcIsExact(a) && calcIsExact(b)) return calcExactOr(() => calcSurdDiv(a, b), () => calcF(calcToFloat(a) / calcToFloat(b)));
    const y = calcToFloat(b);
    if (y === 0) throw CALC_MATH;
    return calcF(calcToFloat(a) / y);
}
function calcNegV(a) {
    if (a.p) return polyNegV(a);
    if (a.r) return { r: true, n: -a.n, d: a.d };
    if (a.s) return { r: false, s: true, t: a.t.map(([b, n, d]) => [b, -n, d]) };
    return calcF(-a.x);
}
function calcAbsV(a) { return calcToFloat(a) < 0 ? calcNegV(a) : a; }
function calcPowInt(a, e) { // e は整数。√を含む数も、正確にべき乗します
    const neg = e < 0;
    let n = Math.abs(e), r = { r: true, n: 1n, d: 1n }, base = a;
    while (n > 0) { if (n & 1) r = calcMul(r, base); n >>= 1; if (n > 0) base = calcMul(base, base); }
    return neg ? calcDiv({ r: true, n: 1n, d: 1n }, r) : r;
}
function calcPowVN(a, b) {
    if (a.r && b.r && b.d === 1n && calcAbsB(b.n) <= 1000n) {
        const e = calcAbsB(b.n);
        if ((a.n.toString().length + a.d.toString().length) * Number(e) <= 2000) {
            const n = a.n ** e, d = a.d ** e;
            if (b.n >= 0n) return calcR(n, d);
            if (n === 0n) throw CALC_MATH;
            return calcR(d, n);
        }
    }
    if (a.s && b.r && b.d === 1n && calcAbsB(b.n) <= 16n) return calcExactOr(() => calcPowInt(a, Number(b.n)), () => calcF(Math.pow(calcToFloat(a), Number(b.n))));
    if (calcIsExact(a) && b.r && b.d === 2n && calcAbsB(b.n) <= 31n) { // 1/2乗は平方根として正確に
        const sq = calcSqrtV(a);
        return calcIsExact(sq) ? calcPowV(sq, { r: true, n: b.n, d: 1n }) : calcF(Math.pow(calcToFloat(a), calcToFloat(b)));
    }
    return calcF(Math.pow(calcToFloat(a), calcToFloat(b)));
}
function calcSqrtV(a) {
    if (a.r) {
        if (a.n < 0n) throw CALC_MATH;
        const nd = a.n * a.d;
        if (nd <= 1000000000000000n) {
            const v = Number(nd), root = Math.round(Math.sqrt(v));
            if (root * root === v) return calcR(BigInt(root), a.d);
            try {
                const [k, b] = calcSqFree(v);
                return calcFromMap(new Map([[b, [BigInt(k), a.d]]]));
            } catch (e) { if (e !== CALC_BIG) throw e; }
        } else {
            const sn = calcIsqrt(a.n), sd = calcIsqrt(a.d);
            if (sn * sn === a.n && sd * sd === a.d) return calcR(sn, sd);
        }
    }
    const x = calcToFloat(a);
    if (x < 0) throw CALC_MATH;
    return calcF(Math.sqrt(x));
}
function calcFactV(a) {
    if (a.p) throw CALC_MATH;
    if (!a.r || a.d !== 1n || a.n < 0n || a.n > 170n) throw CALC_MATH;
    let r = 1n;
    for (let k = 2n; k <= a.n; k++) r *= k;
    return calcR(r, 1n);
}

function calcAdd(a, b) { return (a.p || b.p) ? polyAddV(a, b, 1) : calcAddN(a, b); }
function calcSubV(a, b) { return (a.p || b.p) ? polyAddV(a, b, -1) : calcSubVN(a, b); }
function calcMul(a, b) { return (a.p || b.p) ? polyMulV(a, b) : calcMulN(a, b); }
function calcDiv(a, b) { return (a.p || b.p) ? polyDivV(a, b) : calcDivN(a, b); }
function calcPowV(a, b) { return (a.p || b.p) ? polyPowV(a, b) : calcPowVN(a, b); }

// ---- 文字式：値が決まっていない変数は、文字のまま計算します ----
// 文字式の値は {p:true, n, d}：分子 n と分母 d（どちらも多項式）。多項式は、項の Map（キー → {m:[[文字, 次数]…], c:係数}）。係数は、ふつうの数
const CALC_ONE = { r: true, n: 1n, d: 1n };
const CALC_POLY_MAX_TERMS = 240, CALC_POLY_MAX_DEG = 60;
const polyZeroC = c => (c.r ? c.n === 0n : (c.s ? false : c.x === 0));
const polyKey = m => m.map(([a, e]) => a + "^" + e).join("*");
const polyConstP = c => { const P = new Map(); if (!polyZeroC(c)) P.set("", { m: [], c }); return P; };
const polyIsConstP = P => P.size === 1 && P.has("");
const polyAllRat = P => { for (const t of P.values()) if (!t.c.r) return false; return true; };
function polyAddTerm(P, m, c) {
    const k = polyKey(m), cur = P.get(k);
    if (cur) { const nc = calcAddN(cur.c, c); if (polyZeroC(nc)) P.delete(k); else P.set(k, { m, c: nc }); }
    else if (!polyZeroC(c)) P.set(k, { m, c });
}
function polyAddP(A, B, sg) { const R = new Map(A); B.forEach(t => polyAddTerm(R, t.m, sg < 0 ? calcNegV(t.c) : t.c)); return R; }
function polyNegP(A) { const R = new Map(); A.forEach((t, k) => R.set(k, { m: t.m, c: calcNegV(t.c) })); return R; }
function polyMonoMul(m1, m2) {
    const out = []; let i = 0, j = 0;
    while (i < m1.length || j < m2.length) {
        if (j >= m2.length || (i < m1.length && m1[i][0] < m2[j][0])) out.push(m1[i++]);
        else if (i >= m1.length || m2[j][0] < m1[i][0]) out.push(m2[j++]);
        else { out.push([m1[i][0], m1[i][1] + m2[j][1]]); i++; j++; }
    }
    if (out.some(t => t[1] > CALC_POLY_MAX_DEG)) throw CALC_MATH;
    return out;
}
function polyMonoDiv(m1, m2) { // m1 ÷ m2。割り切れない時は null
    const out = [];
    for (const [a, e] of m1) {
        const f = m2.find(t => t[0] === a), r = e - (f ? f[1] : 0);
        if (r < 0) return null;
        if (r > 0) out.push([a, r]);
    }
    for (const [a] of m2) if (!m1.some(t => t[0] === a)) return null;
    return out;
}
function polyMonoMin(m1, m2) {
    const out = [];
    for (const [a, e] of m1) { const f = m2.find(t => t[0] === a); if (f) out.push([a, Math.min(e, f[1])]); }
    return out;
}
function polyMulP(A, B) {
    if (A.size * B.size > CALC_POLY_MAX_TERMS * 40) throw CALC_MATH;
    const R = new Map();
    A.forEach(a => B.forEach(b => polyAddTerm(R, polyMonoMul(a.m, b.m), calcMulN(a.c, b.c))));
    if (R.size > CALC_POLY_MAX_TERMS) throw CALC_MATH;
    return R;
}
function polyEqP(A, B) {
    if (A.size !== B.size) return false;
    for (const [k, t] of A) { const u = B.get(k); if (!u) return false; const d = calcSubVN(t.c, u.c); if (!(d.r && d.n === 0n)) return false; }
    return true;
}
// 辞書式の順で、いちばん大きい項
function polyLexCmp(m1, m2) {
    const atoms = Array.from(new Set(m1.map(t => t[0]).concat(m2.map(t => t[0])))).sort();
    for (const a of atoms) {
        const e1 = (m1.find(t => t[0] === a) || [0, 0])[1], e2 = (m2.find(t => t[0] === a) || [0, 0])[1];
        if (e1 !== e2) return e1 - e2;
    }
    return 0;
}
function polyLead(P) { let best = null; P.forEach(t => { if (!best || polyLexCmp(t.m, best.m) > 0) best = t; }); return best; }
function polyDivExact(N, D) { // 割り切れる時だけ、商を返します（係数は有理数のみ）
    const dl = polyLead(D);
    let R = N;
    const Q = new Map();
    for (let it = 0; it < 400 && R.size; it++) {
        const rl = polyLead(R);
        const qm = polyMonoDiv(rl.m, dl.m);
        if (!qm) return null;
        const qc = calcDivN(rl.c, dl.c);
        polyAddTerm(Q, qm, qc);
        const sub = new Map();
        D.forEach(t => polyAddTerm(sub, polyMonoMul(t.m, qm), calcMulN(t.c, qc)));
        R = polyAddP(R, sub, -1);
    }
    return R.size ? null : Q;
}
// 文字が1つだけの多項式どうしの、最大公約式
function polyAtomsOf(P, set) { P.forEach(t => t.m.forEach(([a]) => set.add(a))); return set; }
function polyToArr(P) {
    let deg = 0;
    P.forEach(t => { if (t.m.length) deg = Math.max(deg, t.m[0][1]); });
    const arr = [];
    for (let i = 0; i <= deg; i++) arr.push({ r: true, n: 0n, d: 1n });
    P.forEach(t => { arr[t.m.length ? t.m[0][1] : 0] = t.c; });
    return arr;
}
const polyTrim = a => { while (a.length && polyZeroC(a[a.length - 1])) a.pop(); return a; };
function polyArrRem(a, b) {
    a = polyTrim(a.slice());
    const lb = b[b.length - 1];
    while (a.length >= b.length) {
        const f = calcDivN(a[a.length - 1], lb), sh = a.length - b.length;
        for (let i = 0; i < b.length; i++) a[sh + i] = calcSubVN(a[sh + i], calcMulN(f, b[i]));
        a.pop(); polyTrim(a);
    }
    return a;
}
function polyGcdUni(n, d) {
    const atoms = polyAtomsOf(d, polyAtomsOf(n, new Set()));
    if (atoms.size !== 1) return null;
    const at = Array.from(atoms)[0];
    let a = polyTrim(polyToArr(n)), b = polyTrim(polyToArr(d));
    if (a.length > 40 || b.length > 40) return null;
    while (b.length) { const r = polyArrRem(a, b); a = b; b = r; }
    if (a.length <= 1) return null;
    const G = new Map();
    a.forEach((c, e) => { if (!polyZeroC(c)) polyAddTerm(G, e ? [[at, e]] : [], c); });
    return G;
}
// 係数を整数にそろえて、約分します。分母の先頭の係数は、プラスにします
function polyIntNorm(n, d) {
    let L = 1n;
    [n, d].forEach(P => P.forEach(t => { L = L / calcGcd(L, t.c.d) * t.c.d; }));
    let g = 0n;
    const sc = P => { const R = new Map(); P.forEach((t, k) => { const v = t.c.n * (L / t.c.d); g = calcGcd(g, v); R.set(k, { m: t.m, v }); }); return R; };
    const n1 = sc(n), d1 = sc(d);
    if (!g) g = 1n;
    const out = P => { const R = new Map(); P.forEach((t, k) => R.set(k, { m: t.m, c: calcR(t.v / g, 1n) })); return R; };
    let nn = out(n1), dd = out(d1);
    if (polyOrder(dd)[0].c.n < 0n) { nn = polyNegP(nn); dd = polyNegP(dd); }
    return [nn, dd];
}
function polyFinish(n, d) {
    if (!d.size) throw CALC_MATH;
    if (!n.size) return calcR(0n, 1n);
    if (polyIsConstP(d)) {
        const dc = d.get("").c;
        if (!(dc.r && dc.n === 1n && dc.d === 1n)) { const R = new Map(); n.forEach((t, k) => R.set(k, { m: t.m, c: calcDivN(t.c, dc) })); n = R; }
        d = polyConstP(CALC_ONE);
        if (polyIsConstP(n)) return n.get("").c;
    }
    return { p: true, n, d };
}
function polyMake(n, d) {
    if (!d.size) throw CALC_MATH;
    if (!n.size) return calcR(0n, 1n);
    if (!polyIsConstP(d)) {
        let com = null;
        [n, d].forEach(P => P.forEach(t => { com = com === null ? t.m : polyMonoMin(com, t.m); }));
        if (com && com.length) {
            const dv = P => { const R = new Map(); P.forEach(t => { const m = polyMonoDiv(t.m, com); R.set(polyKey(m), { m, c: t.c }); }); return R; };
            n = dv(n); d = dv(d);
        }
        if (!polyIsConstP(d) && polyAllRat(n) && polyAllRat(d)) {
            let q = polyDivExact(n, d);
            if (q) { n = q; d = polyConstP(CALC_ONE); }
            else {
                q = polyDivExact(d, n);
                if (q) { d = q; n = polyConstP(CALC_ONE); }
                else {
                    const g = polyGcdUni(n, d);
                    if (g) { const a = polyDivExact(n, g), b = polyDivExact(d, g); if (a && b) { n = a; d = b; } }
                }
            }
            if (!polyIsConstP(d)) [n, d] = polyIntNorm(n, d);
        }
    }
    return polyFinish(n, d);
}
const polyOf = V => (V.p ? V : { p: true, n: polyConstP(V), d: polyConstP(CALC_ONE) });
function polyAtom(a) { return { p: true, n: new Map([[polyKey([[a, 1]]), { m: [[a, 1]], c: CALC_ONE }]]), d: polyConstP(CALC_ONE) }; }
function polyAddV(a, b, sg) {
    const A = polyOf(a), B = polyOf(b);
    if (polyEqP(A.d, B.d)) return polyMake(polyAddP(A.n, B.n, sg), A.d);
    return polyMake(polyAddP(polyMulP(A.n, B.d), polyMulP(B.n, A.d), sg), polyMulP(A.d, B.d));
}
function polyMulV(a, b) { const A = polyOf(a), B = polyOf(b); return polyMake(polyMulP(A.n, B.n), polyMulP(A.d, B.d)); }
function polyDivV(a, b) { const A = polyOf(a), B = polyOf(b); return polyMake(polyMulP(A.n, B.d), polyMulP(A.d, B.n)); }
function polyNegV(a) { return { p: true, n: polyNegP(a.n), d: a.d }; }
// 文字の式を、式に入れ直せる文字にします（変数は全角）
// 1つの項の中の並び：π e、a b、x y、そのほか（「2πax」のように）
const polyOrderRank = a => ({ "π": 0, "e": 0, "ａ": 1, "ｂ": 2, "ｘ": 3, "ｙ": 4 }[a] ?? 5);
const polyAtomCmp = (a, b) => polyOrderRank(a) - polyOrderRank(b) || (a < b ? -1 : a > b ? 1 : 0);
// 項どうしの並び：次数の大きい順。同じ次数では、x y a b のある項を先に、π e のある項を後に
const polyTermRank = a => ({ "ｘ": 0, "ｙ": 1, "ａ": 2, "ｂ": 3, "π": 5, "e": 5 }[a] ?? 4);
const polyTermCmp = (a, b) => polyTermRank(a) - polyTermRank(b) || (a < b ? -1 : a > b ? 1 : 0);
function polyOrder(P) { // 表示する順：次数の大きい項から
    const deg = t => t.m.reduce((s, x) => s + x[1], 0);
    return Array.from(P.values()).sort((s, t) => {
        const ds = deg(s), dt = deg(t);
        if (ds !== dt) return dt - ds;
        const atoms = Array.from(new Set(s.m.map(x => x[0]).concat(t.m.map(x => x[0])))).sort(polyTermCmp);
        for (const a of atoms) {
            const e1 = (s.m.find(x => x[0] === a) || [0, 0])[1], e2 = (t.m.find(x => x[0] === a) || [0, 0])[1];
            if (e1 !== e2) return e2 - e1;
        }
        return 0;
    });
}
const polyOuterParen = s => {
    if (s.charAt(0) !== "(") return false;
    let dep = 0;
    for (let i = 0; i < s.length; i++) { if (s[i] === "(") dep++; else if (s[i] === ")") { dep--; if (dep === 0) return i === s.length - 1; } }
    return false;
};
const polyUnwrap = s => (polyOuterParen(s) ? s.slice(1, -1) : s);
function polySumIns(P) {
    let out = "";
    polyOrder(P).forEach((t, i) => {
        const c = t.c;
        let neg = false, ac = c;
        if (c.r) { neg = c.n < 0n; ac = neg ? { r: true, n: -c.n, d: c.d } : c; }
        else if (!c.s) { neg = c.x < 0; ac = neg ? { r: false, x: -c.x } : c; }
        const mono = t.m.slice().sort((p, q) => polyAtomCmp(p[0], q[0])).map(([a, e]) => (e > 1 ? a + "^" + e : a)).join("×");
        const one = ac.r && ac.n === 1n && ac.d === 1n;
        const body = (one && mono) ? mono : (mono ? calcInsertText(ac) + "×" + mono : calcInsertText(ac));
        out += (neg ? "−" : (i ? "+" : "")) + body;
    });
    return out || "0";
}
function polyInsert(V) {
    const simple = s => /^[ｘｙａｂπe]$/.test(s);
    if (polyIsConstP(V.d) && V.d.get("").c.n === 1n) { const t = polySumIns(V.n); return simple(t) ? t : "(" + t + ")"; }
    return "((" + polySumIns(V.n) + ")÷(" + polySumIns(V.d) + "))";
}
// 文字を含む関数・べき乗は、1つの文字のように扱います
function polyFnAtom(name, V) { return polyAtom((name === "sqrt" ? "√" : name) + "(" + polyUnwrap(calcInsertText(V)) + ")"); }
function polyPowAtom(a, b) { return polyAtom("(" + calcInsertText(a) + "^" + calcInsertText(b) + ")"); }
function polyPowV(a, b) {
    if (!b.p && b.r && b.d === 1n && calcAbsB(b.n) <= BigInt(CALC_POLY_MAX_DEG)) {
        let e = Number(calcAbsB(b.n)), r = CALC_ONE, base = a;
        while (e > 0) { if (e & 1) r = polyMulV(r, base); e >>= 1; if (e > 0) base = polyMulV(base, base); }
        return b.n < 0n ? polyDivV(CALC_ONE, r) : r;
    }
    return polyPowAtom(a, b);
}
// π と e だけの式は、数として計算します
function polyConstOnly(V) {
    const atoms = polyAtomsOf(V.d, polyAtomsOf(V.n, new Set()));
    for (const a of atoms) if (a !== "π" && a !== "e") return false;
    return true;
}
function polyNum(V) {
    const ev = P => { let s = 0; P.forEach(t => { let x = calcToFloat(t.c); t.m.forEach(([a, e]) => { x *= Math.pow(a === "π" ? Math.PI : Math.E, e); }); s += x; }); return s; };
    return calcF(ev(V.n) / ev(V.d));
}
// ---- 文字式の表示 ----
const CALC_SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const calcSup = n => String(n).replace(/\d/g, d => CALC_SUP[+d]);
const polyAtomDisp = a => calcDisp(a).replace(/\^(\d+)/g, (m, d) => calcSup(d)).replace(/×/g, "·");
function polyMonoText(m) {
    const list = m.slice().sort((p, q) => polyAtomCmp(p[0], q[0]));
    let out = "", prevLong = false;
    list.forEach(([a, e], i) => {
        const long = a.length > 1;
        if (i && (long || prevLong)) out += "·";
        out += polyAtomDisp(a) + (e > 1 ? calcSup(e) : "");
        prevLong = long;
    });
    return out;
}
function polySumText(P) {
    let out = "";
    polyOrder(P).forEach((t, i) => {
        const c = t.c, mono = polyMonoText(t.m);
        let neg = false, coef = "", dot = false;
        if (c.r) {
            neg = c.n < 0n;
            const an = calcAbsB(c.n);
            coef = c.d === 1n ? ((an === 1n && mono) ? "" : an.toString()) : "(" + an + "/" + c.d + ")";
        } else if (c.s) {
            const s = calcSurdText(c);
            if (/[+−\/]/.test(s.slice(1))) coef = "(" + s + ")";
            else { neg = s.charAt(0) === "−"; coef = neg ? s.slice(1) : s; dot = !!mono; }
        } else {
            neg = c.x < 0;
            const f = Math.abs(c.x);
            coef = (f === 1 && mono) ? "" : calcFmt(f);
        }
        out += (neg ? "−" : (i ? "+" : "")) + coef + (dot ? "·" : "") + mono;
    });
    return out || "0";
}
function polyIntForm(P) { // 係数が全て有理数なら、分母をそろえて「(分子)/分母」にします
    if (!polyAllRat(P)) return polySumText(P);
    let L = 1n;
    P.forEach(t => { L = L / calcGcd(L, t.c.d) * t.c.d; });
    if (L === 1n) return polySumText(P);
    const R = new Map();
    P.forEach((t, k) => R.set(k, { m: t.m, c: calcR(t.c.n * (L / t.c.d), 1n) }));
    const s = polySumText(R);
    return (R.size > 1 ? "(" + s + ")" : s) + "/" + L;
}
function polyText(V) {
    if (polyIsConstP(V.d)) return polyIntForm(V.n);
    const nt = polySumText(V.n), dt = polySumText(V.d);
    const dsingle = V.d.size === 1 && (() => { const t = V.d.values().next().value; return t.m.length === 1 && t.c.r && t.c.n === 1n && t.c.d === 1n; })();
    return (V.n.size > 1 ? "(" + nt + ")" : nt) + "/" + (dsingle ? dt : "(" + dt + ")");
}

// ---- 因数分解と方程式：係数が有理数の多項式を、整数の範囲で分けます ----
const polyIsZeroV = v => (v.p ? false : polyZeroC(v));
const polyFromMono = (m, c) => (polyZeroC(c) ? calcR(0n, 1n) : polyFinish(new Map([[polyKey(m), { m, c }]]), polyConstP(CALC_ONE)));
function polyCoeffsIn(P, u) { // 文字 u の次数ごとの係数（他の文字を含む式もあります）
    const cs = [];
    P.forEach(t => {
        let e = 0;
        const rest = [];
        t.m.forEach(([a, k]) => { if (a === u) e = k; else rest.push([a, k]); });
        const v = polyFromMono(rest, t.c);
        cs[e] = cs[e] ? calcAdd(cs[e], v) : v;
    });
    for (let i = 0; i < cs.length; i++) if (!cs[i]) cs[i] = calcR(0n, 1n);
    return cs;
}
function polySubstV(P, atom, V) { // 文字 atom に、値 V を入れた結果
    let sum = calcR(0n, 1n);
    P.forEach(t => {
        let term = t.c;
        const rest = [];
        t.m.forEach(([a, e]) => { if (a === atom) term = calcMul(term, calcPowV(V, calcR(BigInt(e), 1n))); else rest.push([a, e]); });
        if (rest.length) term = calcMul(term, polyFromMono(rest, CALC_ONE));
        sum = calcAdd(sum, term);
    });
    return sum;
}
const polyMonoP = (m, c) => new Map([[polyKey(m), { m, c: c || CALC_ONE }]]);
// 完全平方式の平方根。ならない時は null
function polySqrtExact(P) {
    if (!P.size) return new Map();
    if (!polyAllRat(P)) return null;
    const lead = polyLead(P);
    if (lead.c.n <= 0n) return null;
    const sm = [];
    for (const [a, e] of lead.m) { if (e % 2) return null; sm.push([a, e / 2]); }
    const sn = calcIsqrt(lead.c.n), sd = calcIsqrt(lead.c.d);
    if (sn * sn !== lead.c.n || sd * sd !== lead.c.d) return null;
    const sc = calcR(sn, sd);
    const S = polyMonoP(sm, sc);
    let R = polyAddP(P, polyMulP(S, S), -1);
    const two = calcR(2n, 1n);
    for (let it = 0; it < 200 && R.size; it++) {
        const rl = polyLead(R);
        const q = polyMonoDiv(rl.m, sm);
        if (!q) return null;
        polyAddTerm(S, q, calcDivN(rl.c, calcMulN(two, sc)));
        R = polyAddP(P, polyMulP(S, S), -1);
    }
    return R.size ? null : S;
}
function calcSqrtSym(D) { // 文字を含む式の平方根：ぴったり開けない時は、√ のついた文字
    if (!D.p) return calcSqrtV(D);
    const sn = polySqrtExact(D.n), sd = polySqrtExact(D.d);
    if (sn && sd) return polyMake(sn, sd);
    return polyFnAtom("sqrt", D);
}
// ---- 整数係数の1変数多項式（低い次数から並べた BigInt の配列） ----
function calcDivisors(n) {
    n = calcAbsB(n);
    if (n === 0n || n > 1000000000000n) return null;
    const v = Number(n), out = [];
    for (let i = 1; i * i <= v; i++) { if (v % i === 0) { out.push(BigInt(i)); if (i * i !== v) out.push(BigInt(v / i)); } }
    return out.length > 400 ? null : out;
}
function uniEval(a, p, q) { // a(p/q) × q^n
    const n = a.length - 1;
    let s = 0n;
    for (let i = n; i >= 0; i--) s = s * p + a[i] * q ** BigInt(n - i);
    return s;
}
function uniDivLinear(a, p, q) { // (q u − p) で割った商。割り切れなければ null
    const n = a.length - 1, r = a.slice(), b = new Array(n).fill(0n);
    for (let i = n; i >= 1; i--) {
        if (r[i] % q !== 0n) return null;
        const c = r[i] / q;
        b[i - 1] = c; r[i] -= c * q; r[i - 1] += c * p;
    }
    return r[0] === 0n ? b : null;
}
function uniGcdAll(a) { let g = 0n; a.forEach(x => { g = calcGcd(g, x); }); return g || 1n; }
function uniFactor(a0) { // 分けた結果：[{a, mult}]。a0 は、整数で先頭が正で約分済み
    let cur = a0.slice();
    const out = [];
    const add = (a, m) => { const f = out.find(x => x.a.length === a.length && x.a.every((v, i) => v === a[i])); if (f) f.mult += m; else out.push({ a, mult: m }); };
    // 0 を根に持つ（u で割り切れる）
    let z = 0;
    while (cur.length > 1 && cur[0] === 0n) { cur.shift(); z++; }
    if (z) add([0n, 1n], z);
    if (cur.length > 41) { add(cur, 1); return out; }
    // 有理数の根
    for (;;) {
        if (cur.length < 2) break;
        const dp = calcDivisors(cur[0]), dq = calcDivisors(cur[cur.length - 1]);
        if (!dp || !dq) break;
        let found = false;
        for (const p0 of dp) for (const sg of [1n, -1n]) for (const q of dq) {
            if (found) break;
            const p = p0 * sg;
            if (calcGcd(p, q) !== 1n) continue;
            if (uniEval(cur, p, q) === 0n) {
                const nx = uniDivLinear(cur, p, q);
                if (nx) { cur = nx; add([-p, q], 1); found = true; }
            }
        }
        if (!found) break;
    }
    if (cur.length > 1) {
        // u の何乗かの形（たとえば u⁴−4）：u^d を1つの文字として分けてみます
        const deg = cur.length - 1;
        let k = 0;
        cur.forEach((c, i) => { if (c !== 0n) k = Number(calcGcd(BigInt(k), BigInt(i))); });
        let done = false;
        for (let d = 2; d <= k && !done; d++) {
            if (k % d || deg / d < 2) continue;
            const Q = [];
            for (let i = 0; i <= deg; i += d) Q.push(cur[i]);
            const fq = uniFactor(Q);
            if (fq.length > 1 || fq[0].mult > 1) {
                fq.forEach(f => {
                    const g = new Array((f.a.length - 1) * d + 1).fill(0n);
                    f.a.forEach((c, i) => { g[i * d] = c; });
                    uniFactor(g).forEach(h => add(h.a, h.mult * f.mult));
                });
                done = true;
            }
        }
        if (!done) add(cur, 1);
    }
    return out;
}
// 多項式（Map）を、整数係数の配列にします。文字は1つだけ
function polyToIntArr(P) {
    let L = 1n;
    P.forEach(t => { L = L / calcGcd(L, t.c.d) * t.c.d; });
    let deg = 0;
    P.forEach(t => { if (t.m.length) deg = Math.max(deg, t.m[0][1]); });
    const a = new Array(deg + 1).fill(0n);
    P.forEach(t => { a[t.m.length ? t.m[0][1] : 0] = t.c.n * (L / t.c.d); });
    return a;
}
function intArrToP(a, atom) {
    const P = new Map();
    a.forEach((c, i) => { if (c !== 0n) polyAddTerm(P, i ? [[atom, i]] : [], calcR(c, 1n)); });
    return P;
}
// 係数が有理数の多項式を分けます。{ c: 全体の係数, factors: [{P, mult}] }
function polyFactorP(P) {
    const L0 = polyOrder(P);
    let L = 1n, g = 0n;
    P.forEach(t => { L = L / calcGcd(L, t.c.d) * t.c.d; });
    P.forEach(t => { g = calcGcd(g, t.c.n * (L / t.c.d)); });
    const sign = L0[0].c.n < 0n ? -1n : 1n;
    const out = { c: calcR(sign * g, L), factors: [] };
    let R = new Map();
    P.forEach((t, k) => R.set(k, { m: t.m, c: calcR(sign * t.c.n * (L / t.c.d) / g, 1n) }));
    const push = (F, mult) => { const f = out.factors.find(x => polyEqP(x.P, F)); if (f) f.mult += mult; else out.factors.push({ P: F, mult }); };
    let com = null;
    R.forEach(t => { com = com === null ? t.m : polyMonoMin(com, t.m); });
    if (com && com.length) {
        const dv = new Map();
        R.forEach(t => { const m = polyMonoDiv(t.m, com); dv.set(polyKey(m), { m, c: t.c }); });
        R = dv;
        com.forEach(([a, e]) => push(polyMonoP([[a, 1]]), e));
    }
    const core = (Q, mult) => {
        const atoms = Array.from(polyAtomsOf(Q, new Set())).sort(polyTermCmp);
        if (!atoms.length) return;
        const S = polySqrtExact(Q);
        if (S && S.size) { core(S, mult * 2); return; }
        if (atoms.length === 1) {
            uniFactor(polyToIntArr(Q)).forEach(f => push(intArrToP(f.a, atoms[0]), f.mult * mult));
            return;
        }
        if (atoms.length === 2) { // 2つの文字で、全ての項の次数が同じ：片方を1として分け、後でもどします
            const degs = new Set();
            Q.forEach(t => degs.add(t.m.reduce((s, x) => s + x[1], 0)));
            if (degs.size === 1) {
                const [a1, a2] = atoms, D = Array.from(degs)[0];
                const arr = new Array(D + 1).fill(0n);
                Q.forEach(t => { const e = (t.m.find(x => x[0] === a1) || [0, 0])[1]; arr[e] = t.c.n; });
                if (arr[D] > 0n && arr[0] !== 0n && uniGcdAll(arr) === 1n) {
                    const fs = uniFactor(arr);
                    if (fs.length > 1 || fs[0].mult > 1) {
                        fs.forEach(f => {
                            const k = f.a.length - 1, F = new Map();
                            f.a.forEach((c, i) => { if (c !== 0n) polyAddTerm(F, polyMonoMul(i ? [[a1, i]] : [], (k - i) ? [[a2, k - i]] : []), calcR(c, 1n)); });
                            push(F, f.mult * mult);
                        });
                        return;
                    }
                }
            }
        }
        push(Q, mult);
    };
    core(R, 1);
    const fkey = F => { // 文字だけの因数が先。次に次数・先頭の係数・定数項の大きさ（マイナスが先）の順
        const o = polyOrder(F), lead = o[0], cst = F.get("");
        return [F.size === 1 ? 0 : 1, lead.m.reduce((x, y) => x + y[1], 0), Number(calcAbsB(lead.c.n)), cst ? Number(calcAbsB(cst.c.n)) : 0, cst && cst.c.n < 0n ? 0 : 1, polySumText(F).replace(/−/g, "\u0001")];
    };
    out.factors.sort((s, t) => {
        const a = fkey(s.P), b = fkey(t.P);
        for (let i = 0; i < 5; i++) if (a[i] !== b[i]) return a[i] - b[i];
        return a[5] < b[5] ? -1 : a[5] > b[5] ? 1 : 0;
    });
    return out;
}
// 整数を、素数のかけ算に分けます。大きすぎる時は null
function calcPrimes(n) {
    n = calcAbsB(n);
    if (n < 2n || n > 1000000000000000n) return n < 2n ? [] : null;
    let v = Number(n);
    const out = [];
    for (let p = 2; p * p <= v; p += (p === 2 ? 1 : 2)) {
        if (v % p === 0) { let m = 0; while (v % p === 0) { v /= p; m++; } out.push([BigInt(p), m]); }
    }
    if (v > 1) out.push([BigInt(v), 1]);
    return out;
}
// 因数分解した形：{ text, ins }。できない時は null、分けられない時は same:true
function calcFactorForm(V) {
    const sup = (txt, m) => txt + (m > 1 ? calcSup(m) : "");
    const insP = (txt, m) => (m > 1 ? txt + "^" + m : txt);
    if (V.r) { // 整数と分数：素数に分けます
        const pn = calcPrimes(V.n), pd = calcPrimes(V.d);
        if (pn === null || pd === null) return null;
        if (V.n === 0n || (pn.length <= 1 && (!pn.length || pn[0][1] === 1) && pd.length <= 1 && (!pd.length || pd[0][1] === 1))) return { same: true };
        const neg = V.n < 0n;
        const join = l => l.map(([p, m]) => sup(p.toString(), m)).join("×");
        const joinI = l => l.map(([p, m]) => insP(p.toString(), m)).join("×");
        const nt = join(pn) || "1", dt = join(pd);
        const text = (neg ? "−" : "") + (dt ? nt + "/" + (pd.length > 1 ? "(" + dt + ")" : dt) : nt);
        const ni = joinI(pn) || "1", di = joinI(pd);
        const ins = "(" + (neg ? "−" : "") + (di ? "(" + ni + ")÷(" + di + ")" : ni) + ")";
        return { text, ins, same: false };
    }
    if (!V.p) return null;
    if (!polyAllRat(V.n) || !polyAllRat(V.d)) return null;
    const fn = polyFactorP(V.n), fd = polyIsConstP(V.d) ? { c: calcR(1n, 1n), factors: [] } : polyFactorP(V.d);
    const C = calcDivN(fn.c, fd.c);
    const long = P => { const t = P.values().next().value; return P.size === 1 && t.m.length === 1 && t.m[0][0].length > 1; };
    const fText = list => {
        let out = "", prev = false;
        list.forEach(f => {
            const single = f.P.size === 1 && f.P.values().next().value.m.length === 1 && f.P.values().next().value.c.n === 1n && f.P.values().next().value.c.d === 1n;
            const body = single ? polyMonoText(f.P.values().next().value.m) : "(" + polySumText(f.P) + ")";
            const lg = long(f.P);
            if (out && (lg || prev)) out += "·";
            out += sup(body, f.mult);
            prev = lg;
        });
        return out;
    };
    const fIns = list => list.map(f => { const t = polyInsert({ p: true, n: f.P, d: polyConstP(CALC_ONE) }); return insP(t, f.mult); });
    const cn = C.n, cd = C.d, neg = cn < 0n, an = calcAbsB(cn);
    const numPieces = (an !== 1n || !fn.factors.length ? [an.toString()] : []).concat(fText(fn.factors) ? [fText(fn.factors)] : []);
    let nt = numPieces.join("");
    if (!nt) nt = "1";
    let dt = (cd !== 1n ? cd.toString() : "") + fText(fd.factors);
    const manyD = fd.factors.length + (cd !== 1n ? 1 : 0) > 1;
    const text = (neg ? "−" : "") + (dt ? nt + "/" + (manyD ? "(" + dt + ")" : dt) : nt);
    const nI = (an !== 1n || !fn.factors.length ? [an.toString()] : []).concat(fIns(fn.factors)).join("×");
    const dI = (cd !== 1n ? [cd.toString()] : []).concat(fIns(fd.factors)).join("×");
    const ins = "(" + (neg ? "−" : "") + (dI ? "(" + nI + ")÷(" + dI + ")" : nI) + ")";
    const same = fn.factors.length + fd.factors.length === 0 || (fn.factors.length === 1 && fn.factors[0].mult === 1 && !fd.factors.length && an === 1n && polyEqP(fn.factors[0].P, V.n));
    return { text, ins, same };
}
// ---- 方程式を解く ----
function calcDKRoots(a) { // 整数係数 a（低い次数から）の、実数の根の近い値
    const n = a.length - 1, lead = Number(a[n]);
    const co = a.map(x => Number(x) / lead);
    let rs = [];
    const R = 1 + Math.max(...co.slice(0, n).map(Math.abs));
    for (let i = 0; i < n; i++) rs.push([R * Math.cos(2 * Math.PI * i / n + 0.4), R * Math.sin(2 * Math.PI * i / n + 0.4)]);
    const mul = (p, q) => [p[0] * q[0] - p[1] * q[1], p[0] * q[1] + p[1] * q[0]];
    const sub = (p, q) => [p[0] - q[0], p[1] - q[1]];
    const div = (p, q) => { const d = q[0] * q[0] + q[1] * q[1]; return [(p[0] * q[0] + p[1] * q[1]) / d, (p[1] * q[0] - p[0] * q[1]) / d]; };
    const ev = z => { let s = [1, 0]; for (let i = n - 1; i >= 0; i--) s = [mul(s, z)[0] + co[i], mul(s, z)[1]]; return s; };
    for (let it = 0; it < 500; it++) {
        let mv = 0;
        rs = rs.map((z, i) => {
            let den = [1, 0];
            rs.forEach((w, j) => { if (j !== i) den = mul(den, sub(z, w)); });
            const d = div(ev(z), den);
            mv = Math.max(mv, Math.abs(d[0]) + Math.abs(d[1]));
            return sub(z, d);
        });
        if (mv < 1e-13) break;
    }
    return rs.filter(z => Math.abs(z[1]) < 1e-7 * Math.max(1, Math.abs(z[0]))).map(z => z[0]).sort((x, y) => x - y);
}
const solSame = (a, b) => { const d = calcSubV(a, b); return d.p ? false : (d.r ? d.n === 0n : (d.s ? false : Math.abs(d.x) < 1e-9)); };
// f を 0 にする u の値：{ roots:[{V, approx}], excluded:[V], noreal:bool, unsolved:bool }
function calcSolveFor(f, u) {
    const res = { roots: [], excluded: [], noreal: false, unsolved: false };
    const addRoot = (V, approx) => { if (!res.roots.some(r => solSame(r.V, V))) res.roots.push({ V, approx: !!approx }); };
    const fac = polyAllRat(f.n) ? polyFactorP(f.n) : { c: CALC_ONE, factors: [{ P: f.n, mult: 1 }] };
    fac.factors.forEach(({ P }) => {
        const cs = polyCoeffsIn(P, u);
        let deg = cs.length - 1;
        while (deg > 0 && polyIsZeroV(cs[deg])) deg--;
        if (deg < 1) return;
        if (deg === 1) { addRoot(calcDiv(calcNegV(cs[0]), cs[1])); return; }
        if (deg === 2) {
            const a = cs[2], b = cs[1], c = cs[0];
            const D = calcSubV(calcMul(b, b), calcMul(calcR(4n, 1n), calcMul(a, c)));
            if (!D.p && calcToFloat(D) < 0) { res.noreal = true; return; }
            const two = calcMul(calcR(2n, 1n), a);
            if (!D.p && calcToFloat(D) === 0) { addRoot(calcDiv(calcNegV(b), two)); return; }
            let S;
            try { S = calcSqrtSym(D); } catch (e) { if (e === CALC_MATH) { res.noreal = true; return; } throw e; }
            addRoot(calcDiv(calcSubV(calcNegV(b), S), two));
            addRoot(calcDiv(calcAdd(calcNegV(b), S), two));
            return;
        }
        const atoms = polyAtomsOf(P, new Set());
        if (atoms.size === 1 && polyAllRat(P)) {
            const rs = calcDKRoots(polyToIntArr(P));
            if (!rs.length) res.noreal = true;
            rs.forEach(x => addRoot(calcF(x), true));
            return;
        }
        res.unsolved = true;
    });
    // 分母が 0 になる値は、除きます
    if (!polyIsConstP(f.d)) {
        res.roots = res.roots.filter(r => {
            let z;
            try { z = polySubstV(f.d, u, r.V); } catch (e) { return true; }
            const zero = z.p ? false : (z.r ? z.n === 0n : (z.s ? false : Math.abs(z.x) < 1e-9));
            if (zero) res.excluded.push(r.V);
            return !zero;
        });
    }
    const allNum = res.roots.every(r => !r.V.p);
    if (allNum) res.roots.sort((x, y) => calcToFloat(x.V) - calcToFloat(y.V));
    return res;
}

// ---- 三角関数：15度の倍数の角度は、正確な値で計算します ----
const CALC_SIN15 = (() => {
    const mk = list => calcFromMap(new Map(list.map(([b, n, d]) => [b, [BigInt(n), BigInt(d)]])));
    return [
        mk([]),
        mk([[2, -1, 4], [6, 1, 4]]), // sin 15度
        mk([[1, 1, 2]]),             // sin 30度
        mk([[2, 1, 2]]),             // sin 45度
        mk([[3, 1, 2]]),             // sin 60度
        mk([[2, 1, 4], [6, 1, 4]]), // sin 75度
        mk([[1, 1, 1]])              // sin 90度
    ];
})();
function calcSinDeg(a) {
    a = ((a % 360) + 360) % 360;
    let neg = false;
    if (a > 180) { a -= 180; neg = true; }
    if (a > 90) a = 180 - a;
    const v = CALC_SIN15[a / 15];
    return neg ? calcNegV(v) : v;
}
// 角度として読み取れた時だけ、度の数を返します
function calcAngleOf(V) {
    if (calc.deg) {
        if (V.r && V.d === 1n && calcAbsB(V.n) < 10000000n && Number(V.n) % 15 === 0) return Number(V.n);
        return null;
    }
    if (V.r) return V.n === 0n ? 0 : null;
    if (V.r === false && !V.s) {
        const x = V.x, unit = Math.PI / 12, k = Math.round(x / unit);
        if (Math.abs(k) <= 2400 && Math.abs(x - k * unit) < 1e-9 * Math.max(1, Math.abs(x))) return 15 * k;
    }
    return null;
}
function calcEqExact(A, B) { const d = calcSubV(A, B); return d.r && d.n === 0n; }
function calcTrigExact(name, V) {
    if (name === "sin" || name === "cos" || name === "tan") {
        const a = calcAngleOf(V);
        if (a === null) return null;
        if (name === "sin") return calcSinDeg(a);
        if (name === "cos") return calcSinDeg(a + 90);
        const c = calcSinDeg(a + 90);
        if (c.r && c.n === 0n) throw CALC_MATH;
        return calcDiv(calcSinDeg(a), c);
    }
    if (!calc.deg || !calcIsExact(V)) return null;
    const x = calcToFloat(V);
    if (name === "asin" || name === "acos") {
        if (x < -1 || x > 1) throw CALC_MATH;
        const deg = (name === "asin" ? Math.asin(x) : Math.acos(x)) * 180 / Math.PI, k = Math.round(deg / 15);
        if (Math.abs(deg - 15 * k) < 1e-9 && calcEqExact(name === "asin" ? calcSinDeg(15 * k) : calcSinDeg(15 * k + 90), V)) return calcR(BigInt(15 * k), 1n);
        return null;
    }
    if (name === "atan") {
        const deg = Math.atan(x) * 180 / Math.PI, k = Math.round(deg / 15);
        if (Math.abs(deg - 15 * k) < 1e-9 && Math.abs(k) <= 5 && calcEqExact(calcTrigExact("tan", calcR(BigInt(15 * k), 1n)), V)) return calcR(BigInt(15 * k), 1n);
        return null;
    }
    return null;
}

function calcFmt(v) {
    if (v === null || !isFinite(v)) return "エラー";
    const r = Number(v.toPrecision(12));
    if (r === 0) return "0";
    const a = Math.abs(r);
    if (a >= 1e12 || a < 1e-6) return String(Number(v.toPrecision(10)).toExponential()).replace("e+", "e");
    return String(r);
}
function calcPlain(v) {
    const r = Number(v.toPrecision(12));
    let t = String(r);
    if (/e/i.test(t)) t = r.toLocaleString("fullwide", { useGrouping: false, maximumFractionDigits: 20 });
    return t;
}
// 式に入れ直す時の文字：分数は「(3⁄4)」、√を含む数は「(1⁄2×√(2)+1)」の形
function calcInsertText(V) {
    if (V.p) return polyInsert(V);
    if (V.s) {
        let out = "";
        V.t.forEach(([b, n, d], i) => {
            const an = calcAbsB(n);
            const coef = d === 1n ? an.toString() : an.toString() + "⁄" + d.toString();
            const core = b === 1 ? coef : (an === 1n && d === 1n ? "" : coef + "×") + "√(" + b + ")";
            out += (n < 0n ? "−" : (i === 0 ? "" : "+")) + core;
        });
        return "(" + out + ")";
    }
    if (V.r) {
        if (V.d === 1n && V.n.toString().length <= 15) return V.n < 0n ? "(−" + (-V.n).toString() + ")" : V.n.toString();
        return (V.n < 0n ? "(−" : "(") + calcAbsB(V.n).toString() + "⁄" + V.d.toString() + ")";
    }
    const t = calcPlain(V.x);
    return V.x < 0 ? "(−" + t.replace("-", "") + ")" : t;
}
// 答えの見せ方：分数、帯分数、√の形、小数。まだ指定がない時は、式に分数が入っていれば分数、なければ小数。√を含む数は、√の形
function calcEffView(V, hasFrac, view) {
    if (V.s) return view === "dec" ? "dec" : "exact";
    if (!V.r || V.d === 1n) return "dec";
    if (view !== "auto") return view === "mixed" && calcAbsB(V.n) < V.d ? "frac" : view;
    return hasFrac ? "frac" : "dec";
}
// √を含む数の文字：通分して、「√2/2」や「(1+√3)/2」の形にします
function calcSurdText(V) {
    let D = 1n;
    V.t.forEach(([b, n, d]) => { D = D / calcGcd(D, d) * d; });
    const nums = V.t.map(([b, n, d]) => [b, n * (D / d)]);
    let g = D;
    nums.forEach(([b, n]) => { g = calcGcd(g, n); });
    const Dn = D / g;
    let s = "";
    nums.forEach(([b, n], i) => {
        const m = n / g, an = calcAbsB(m);
        const core = b === 1 ? an.toString() : (an === 1n ? "" : an.toString()) + "√" + b;
        s += (m < 0n ? "−" : (i === 0 ? "" : "+")) + core;
    });
    if (Dn !== 1n) s = nums.length > 1 ? "(" + s + ")/" + Dn : s + "/" + Dn;
    return s;
}
function calcShow(V, hasFrac, view) {
    const r = calcShowRaw(V, hasFrac, view);
    r.main = r.main.replace(/^-/, "−");
    return r;
}
function calcShowRaw(V, hasFrac, view) {
    if (V.p) return { main: polyText(V), sub: "文字のまま計算しています", eff: "sym" };
    const eff = calcEffView(V, hasFrac, view);
    if (!V.r && !V.s) return { main: calcFmt(V.x), sub: "", eff: "dec" };
    const dec = calcFmt(calcToFloat(V));
    if (V.s) return eff === "dec" ? { main: dec, sub: "", eff } : { main: calcSurdText(V), sub: "≈ " + dec, eff };
    if (V.d === 1n) return { main: V.n.toString().length > 12 ? dec : V.n.toString().replace("-", "−"), sub: "", eff: "dec" };
    if (eff === "dec") return { main: dec, sub: "", eff };
    const sign = V.n < 0n ? "−" : "";
    const an = calcAbsB(V.n);
    if (eff === "mixed") {
        const w = an / V.d, r = an % V.d;
        return { main: sign + w.toString() + " " + r.toString() + "/" + V.d.toString(), sub: "≈ " + dec, eff };
    }
    return { main: sign + an.toString() + "/" + V.d.toString(), sub: "≈ " + dec, eff };
}
const CALC_VIEW_NAME = { dec: "小数", frac: "分数", mixed: "帯分数", exact: "√の形", sym: "文字式" };

// 式を計算する。evalは使わず、自分で読み取ります。読み取れない時は null、計算できない時は "math" を返します
// 枠の始まり ⦅ の位置 i から、対応する ⦆ の位置。なければ -1
function calcMatchClose(e, i) {
    let d = 0;
    for (let k = i; k < e.length; k++) { if (e[k] === "⦅") d++; else if (e[k] === "⦆") { d--; if (d === 0) return k; } }
    return -1;
}
// 枠の終わり ⦆ の位置 j から、対応する ⦅ の位置。なければ -1
function calcMatchOpen(e, j) {
    let d = 0;
    for (let k = j; k >= 0; k--) { if (e[k] === "⦆") d++; else if (e[k] === "⦅") { d--; if (d === 0) return k; } }
    return -1;
}
function calcMixedFlat(src) {
    const re = /(\d+) ⦅/g;
    let out = "", last = 0, m;
    while ((m = re.exec(src))) {
        const open = m.index + m[1].length + 1;
        const c1 = calcMatchClose(src, open);
        if (c1 < 0 || src[c1 + 1] !== "⁄" || src[c1 + 2] !== "⦅") continue;
        const c2 = calcMatchClose(src, c1 + 2);
        if (c2 < 0) continue;
        out += src.slice(last, m.index) + "(" + m[1] + "+" + calcMixedFlat(src.slice(open, c2 + 1)) + ")";
        last = c2 + 1; re.lastIndex = last;
    }
    return out + src.slice(last);
}
function calcFlat(src) {
    if (!/[⦅⦆]/.test(src)) return src;
    src = calcMixedFlat(src); // 帯分数：整数 + 分数
    let out = "";
    const st = []; // 枠ごとの、閉じていないかっこの数
    for (const ch of src) {
        if (ch === "⦅") { st.push(0); out += "("; }
        else if (ch === "⦆") { if (!st.length) continue; out += ")".repeat(st.pop()) + ")"; }
        else if (ch === "(") { if (st.length) st[st.length - 1]++; out += "("; }
        else if (ch === ")") { if (!st.length) out += ")"; else if (st[st.length - 1] > 0) { st[st.length - 1]--; out += ")"; } }
        else out += ch;
    }
    while (st.length) out += ")".repeat(st.pop()) + ")";
    return out;
}
function calcEvaluate(src, symConst) {
    const origSrc = src;
    let usedConst = false;
    src = calcFlat(src);
    const text = src.replace(/×/g, "*").replace(/÷/g, "/").replace(/−/g, "-").replace(/√/g, "sqrt");
    const re = /(?:(\d+ \d+⁄\d+)|(\d+⁄\d+)|(\d+\.?\d*|\.\d+)|(Ans|asin|acos|atan|sin|cos|tan|log|ln|sqrt|abs|π|e)|([ｘｙａｂ])|([-+*\/^!%()⁄]))/y;
    const toks = [];
    let pos = 0;
    while (pos < text.length) {
        re.lastIndex = pos;
        const m = re.exec(text);
        if (!m) return null;
        pos = re.lastIndex;
        try {
            if (m[1] !== undefined) { const q = /^(\d+) (\d+)⁄(\d+)$/.exec(m[1]); const d = BigInt(q[3]); if (d === 0n) return "math"; toks.push({ t: "n", v: calcR(BigInt(q[1]) * d + BigInt(q[2]), d) }); }
            else if (m[2] !== undefined) { const q = /^(\d+)⁄(\d+)$/.exec(m[2]); if (BigInt(q[2]) === 0n) return "math"; toks.push({ t: "n", v: calcR(BigInt(q[1]), BigInt(q[2])) }); }
            else if (m[3] !== undefined) toks.push({ t: "n", v: calcLit(m[3]) });
            else if (m[4] !== undefined) toks.push({ t: "i", v: m[4] });
            else if (m[5] !== undefined) toks.push({ t: "v", v: m[5] });
            else toks.push({ t: "o", v: m[6] });
        } catch (e) { return null; }
    }
    if (!toks.length) return null;
    let open = 0;
    for (const k of toks) { if (k.t === "o" && k.v === "(") open++; else if (k.t === "o" && k.v === ")") { open--; if (open < 0) return null; } }
    for (; open > 0; open--) toks.push({ t: "o", v: ")" });
    let i = 0;
    const peek = () => toks[i];
    const isOp = v => peek() && peek().t === "o" && peek().v === v;
    const toRad = x => calc.deg ? x * Math.PI / 180 : x;
    const fromRad = x => calc.deg ? x * 180 / Math.PI : x;
    const clean = x => (Math.abs(x) < 1e-14 ? 0 : x);
    const fn = (name, V) => {
        if (V.p) return polyConstOnly(V) ? fn0(name, polyNum(V)) : polyFnAtom(name, V);
        return fn0(name, V);
    };
    const fn0 = (name, V) => {
        if (name === "sqrt") return calcSqrtV(V);
        if (name === "abs") return calcAbsV(V);
        const exact = calcTrigExact(name, V);
        if (exact) return exact;
        const x = calcToFloat(V);
        switch (name) {
            case "sin": return calcF(clean(Math.sin(toRad(x))));
            case "cos": return calcF(clean(Math.cos(toRad(x))));
            case "tan": {
                if (calc.deg && Math.abs(((x % 180) + 180) % 180 - 90) < 1e-9) throw CALC_MATH;
                const r = Math.tan(toRad(x));
                if (Math.abs(r) > 1e14) throw CALC_MATH;
                return calcF(clean(r));
            }
            case "asin": return calcF(fromRad(Math.asin(x)));
            case "acos": return calcF(fromRad(Math.acos(x)));
            case "atan": return calcF(fromRad(Math.atan(x)));
            case "log": return calcF(Math.log10(x));
            case "ln": return calcF(Math.log(x));
        }
        throw CALC_MATH;
    };
    function parseExpr() {
        let v = parseTerm();
        while (isOp("+") || isOp("-")) { const op = toks[i++].v; const r = parseTerm(); v = op === "+" ? calcAdd(v, r) : calcSubV(v, r); }
        return v;
    }
    function startsFactor() {
        const k = peek();
        return !!k && (k.t === "n" || k.t === "i" || k.t === "v" || (k.t === "o" && k.v === "("));
    }
    // 分数の線：かっこや関数にも使えます。かけ算やわり算より、先に計算します
    function parseBar() {
        let v = parseUnary();
        while (isOp("⁄")) { i++; const r = parseUnary(); v = calcDiv(v, r); }
        return v;
    }
    function parseTerm() {
        let v = parseBar();
        for (;;) {
            if (isOp("*") || isOp("/")) { const op = toks[i++].v; const r = parseBar(); v = op === "*" ? calcMul(v, r) : calcDiv(v, r); }
            else if (startsFactor()) { v = calcMul(v, parseBar()); }
            else break;
        }
        return v;
    }
    function parseUnary() {
        if (isOp("-")) { i++; return calcNegV(parseUnary()); }
        if (isOp("+")) { i++; return parseUnary(); }
        return parsePower();
    }
    function parsePower() {
        let base = parsePostfix();
        if (isOp("^")) { i++; const ex = parseUnary(); base = calcPowV(base, ex); }
        return base;
    }
    function parsePostfix() {
        let v = parsePrimary();
        while (isOp("!") || isOp("%")) { const op = toks[i++].v; v = op === "!" ? calcFactV(v) : calcDiv(v, calcR(100n, 1n)); }
        return v;
    }
    function parsePrimary() {
        const k = toks[i++];
        if (!k) throw new Error("end");
        if (k.t === "n") return k.v;
        if (k.t === "v") {
            const name = Object.keys(CALC_VAR_CH).find(n => CALC_VAR_CH[n] === k.v);
            return calc.vars[name] || polyAtom(k.v);
        }
        if (k.t === "i") {
            if (k.v === "π") { usedConst = true; return symConst ? polyAtom("π") : calcF(Math.PI); }
            if (k.v === "e") { usedConst = true; return symConst ? polyAtom("e") : calcF(Math.E); }
            if (k.v === "Ans") { if (calc.ansV === null) throw new Error("noans"); return calc.ansV; }
            if (!isOp("(")) throw new Error("fn");
            i++;
            const inner = parseExpr();
            if (!isOp(")")) throw new Error("paren");
            i++;
            return fn(k.v, inner);
        }
        if (k.v === "(") {
            const v = parseExpr();
            if (!isOp(")")) throw new Error("paren");
            i++;
            return v;
        }
        throw new Error("bad");
    }
    try {
        const v = parseExpr();
        if (i < toks.length) return null;
        if (v.p && usedConst && !symConst) return calcEvaluate(origSrc, true); // π や e も、文字として残します
        return v;
    } catch (e) { return e === CALC_MATH ? "math" : null; }
}
// 結果の判定：数なら ok、計算できないなら math、まだ途中なら ok も math もなし
function calcTry(src) {
    const V = calcEvaluate(src);
    if (V === null) return { ok: false };
    if (V === "math") return { ok: false, math: true };
    return { ok: true, V };
}
const CALC_TAIL = /[-+×÷−^ ⁄]+$/;

// いま画面に出す答え：{ V, hasFrac } か、なければ null
function calcCurrent() {
    if (calc.done && !calc.err && calc.ansV) return { V: calc.ansV, hasFrac: calc.ansFrac };
    if (!calc.expr) return null;
    let r = calcTry(calc.expr);
    if (!r.ok && !r.math) {
        const trimmed = calc.expr.replace(CALC_TAIL, "");
        if (trimmed && trimmed !== calc.expr) r = calcTry(trimmed);
    }
    return r.ok ? { V: r.V, hasFrac: /⁄/.test(calc.expr) } : null;
}
// 答えの表示：分数や帯分数は、分子と分母が上下に並ぶ形で出します（文字としては「3/4」のまま）
// 分数の線は、かっこの外にある「/」が1つだけの時です。文字式の分数も、同じように並べます
function calcSplitFrac(text) {
    const m = /^(−?)(\d+ )?([^ ＝、≈]+)$/.exec(text);
    if (!m) return null;
    const body = m[3];
    let dep = 0, at = -1, cnt = 0;
    for (let i = 0; i < body.length; i++) {
        const ch = body.charAt(i);
        if (ch === "(") dep++;
        else if (ch === ")") dep--;
        else if (ch === "/" && dep === 0) { at = i; cnt++; }
    }
    if (cnt !== 1 || at < 1 || at >= body.length - 1) return null;
    return { sign: m[1], whole: m[2], num: body.slice(0, at), den: body.slice(at + 1) };
}
function calcRenderResult(el, text, inHist) {
    el.textContent = "";
    el.classList.remove("has-frac");
    const m = (inHist || !calc.err) ? calcSplitFrac(text) : null;
    if (!m) { el.textContent = text; return; }
    const mk = (cls, txt) => { const x = document.createElement("span"); x.className = cls; if (txt !== undefined) x.textContent = txt; return x; };
    const side = (cls, t) => {
        const box = mk(cls);
        if (polyOuterParen(t)) { box.appendChild(mk("cf-hid", "(")); box.appendChild(document.createTextNode(t.slice(1, -1))); box.appendChild(mk("cf-hid", ")")); }
        else box.textContent = t;
        return box;
    };
    const fr = mk("cf-f");
    fr.appendChild(side("cf-n", m.num)); fr.appendChild(mk("cf-bar", "/")); fr.appendChild(side("cf-d", m.den));
    const f = mk("cf");
    if (m.whole) f.appendChild(mk("cf-w", m.whole));
    f.appendChild(fr);
    if (m.sign) el.appendChild(document.createTextNode(m.sign));
    el.appendChild(f);
    el.classList.add("has-frac");
}
// 方程式の解：1つずつ、押すと式に入れられます
function calcRenderSol() {
    const box = $id("calcSol");
    if (!box) return;
    const sol = calc.done && !calc.err && calc.sol && calc.sol.items.length ? calc.sol : null;
    box.hidden = !sol;
    box.textContent = "";
    if (!sol) return;
    sol.items.forEach(it => {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "calc-sol-item";
        b.dataset.val = it.ins;
        const nm = document.createElement("i"); nm.textContent = (it.name || sol.u) + " ＝";
        const v = document.createElement("span");
        calcRenderResult(v, it.text, true);
        b.appendChild(nm); b.appendChild(v);
        if (it.dec) { const d = document.createElement("em"); d.textContent = it.dec; b.appendChild(d); }
        b.setAttribute("aria-label", (it.name || sol.u) + " ＝ " + it.text.replace("≈ ", "およそ ") + "。押すと式に入れます");
        box.appendChild(b);
    });
}
function calcRender() {
    const p = $id("calcPanel");
    if (!p || calcQuiet) return;
    if (calc.phone) { calcPhoneRender(); return; }
    if (calc.graph) return;
    const exprEl = $id("calcExpr"), resEl = $id("calcResult"), subEl = $id("calcSub");
    calcRenderExpr(exprEl);
    if (calc.assign) { exprEl.insertBefore(document.createTextNode(calc.assign + "＝"), exprEl.firstChild); exprEl.scrollLeft = exprEl.scrollWidth; }
    let res = "", sub = "";
    const cur = calcCurrent();
    if (calc.err) res = "エラー";
    else if (calc.done && calc.sol) { res = calc.sol.main; sub = calc.sol.sub; }
    else if (!calc.expr) res = "0";
    else if (calc.done && calc.ansFF) { res = calc.ansFF.text; sub = "因数分解した形です"; }
    else if (cur) { const s = calcShow(cur.V, cur.hasFrac, calc.view); res = s.main; sub = s.sub; }
    calcRenderResult(resEl, res === "" ? "　" : res);
    resEl.classList.toggle("is-err", calc.err);
    resEl.style.fontSize = res.length > 14 ? "20px" : res.length > 10 ? "26px" : "";
    if (!sub && calc.assign) sub = "「=」で " + calc.assign + " に入れます";
    if (calc.sys && !calc.done) sub = "1本目 " + calcSysText(calc.sys) + "　2本目を入れて、もう一度押します";
    if (subEl) subEl.textContent = sub || "　";
    calcRenderSol();
    CALC_VAR_NAMES.forEach(n => {
        const c = p.querySelector('[data-ck="s' + n + '"]');
        if (!c) return;
        const t = calcVarText(n);
        c.textContent = calc.assign === n ? "入力中" : (t ? "＝" + t : "値を入れる");
        c.classList.toggle("is-on", calc.assign === n);
        const d = p.querySelector('[data-ck="d' + n + '"]');
        if (d) d.hidden = !t;
        c.setAttribute("aria-pressed", calc.assign === n ? "true" : "false");
        c.setAttribute("aria-label", n + " の値。" + (calc.assign === n ? "今入力中です。もう一度押すとやめます" : t ? "今は " + t + " です。押すと新しい値を入れます" : "まだ入っていません。押すと値を入れる入力になります"));
    });
    p.dataset.sci = calc.sci ? "1" : "0";
    const u = p.querySelector('[data-ck="deg"]');
    if (u) { u.textContent = calc.deg ? "度" : "ラジアン"; u.setAttribute("aria-label", "角度の単位。今は" + (calc.deg ? "度" : "ラジアン") + "です"); }
    const vb = p.querySelector('[data-ck="view"]');
    if (vb) {
        const eff = cur && cur.V.p ? "sym" : cur && ((cur.V.r && cur.V.d !== 1n) || cur.V.s) ? calcEffView(cur.V, cur.hasFrac, calc.view) : (calc.view === "auto" || calc.view === "exact" ? "dec" : calc.view);
        vb.textContent = "表示 " + CALC_VIEW_NAME[eff];
        vb.setAttribute("aria-label", "答えの表示を切り替える。今は" + CALC_VIEW_NAME[eff] + "です");
    }
    const ub = p.querySelector('[data-ck="undo"]');
    if (ub) ub.disabled = !calc.undo.length || !!calc.assign;
    const rb = p.querySelector('[data-ck="redo"]');
    if (rb) rb.disabled = !calc.redo.length || !!calc.assign;
    const ob = p.querySelector('[data-ck="out"]');
    if (ob) ob.disabled = !calcSlot();
    const nb = p.querySelector('[data-ck="nest"]');
    if (nb) nb.disabled = !calcSlot();
    const m = $id("calcMemMark");
    if (m) m.hidden = !calc.hasMem;
    p.querySelectorAll("[data-cmode]").forEach(b => { const on = (b.dataset.cmode === "sci") === calc.sci; b.classList.toggle("is-on", on); b.setAttribute("aria-pressed", on ? "true" : "false"); });
    const hl = $id("calcHist");
    if (hl) {
        hl.hidden = !calc.histOpen;
        const clr = p.querySelector(".calc-hist-clear");
        if (clr) clr.hidden = !calc.histOpen || !calc.hist.length;
        hl.innerHTML = calc.hist.length ? "" : '<div class="calc-hist-empty">まだ計算していません。</div>';
        calc.hist.slice().reverse().forEach(h => {
            const b = document.createElement("button");
            b.type = "button";
            b.className = "calc-hist-item";
            b.dataset.val = h.plain;
            b.innerHTML = "<span></span><b></b>";
            calcFillExpr(b.firstChild, h.expr, false);
            b.firstChild.appendChild(document.createTextNode(" ="));
            calcRenderResult(b.lastChild, h.text, true);
            b.setAttribute("aria-label", calcDisp(h.expr.replace(/[⦅⦆]/g, "")) + " の答え " + h.text + "。押すと式に入れます");
            hl.appendChild(b);
        });
    }
}

// ---- 式の表示：分数は、分子と分母の枠が上下に並ぶ形で出します ----
// 式の中身は「3⁄4」「1 2⁄3」のままです。見た目だけを、枠つきの分数にします
// 分数の枠は、式の中では「⦅分子⦆⁄⦅分母⦆」の形で持ちます（⦅ ⦆ は、枠の始まりと終わりの目印で、画面には出ません）
// 枠の中には、数だけでなく、関数や √ や かっこ も入れられます
// 式の終わりにある分数の枠：[全体, 整数の部分, 分子, 分母] と index。枠の中に枠があってもかまいません
function calcTailTpl(e) {
    if (e.charAt(e.length - 1) !== "⦆") return null;
    const dClose = e.length - 1, dOpen = calcMatchOpen(e, dClose);
    if (dOpen < 2 || e[dOpen - 1] !== "⁄" || e[dOpen - 2] !== "⦆") return null;
    const nClose = dOpen - 2, nOpen = calcMatchOpen(e, nClose);
    if (nOpen < 0) return null;
    const wm = /(\d+ )$/.exec(e.slice(0, nOpen));
    const whole = wm ? wm[1] : undefined, start = nOpen - (whole ? whole.length : 0);
    const m = [e.slice(start), whole, e.slice(nOpen + 1, nClose), e.slice(dOpen + 1, dClose)];
    m.index = start;
    return m;
}
function calcExprParts(e) {
    const parts = [];
    const txt = x => calcDisp(x.replace(/[⦅⦆]/g, ""));
    const plain = (seg, prevCh) => { // 枠のない所：「3⁄4」のような書き方は分数の形にします
        const re = /(\d+ )?(\d*)⁄(\d*)/g;
        let l = 0, m;
        while ((m = re.exec(seg))) {
            const prev = m.index > 0 ? seg[m.index - 1] : prevCh;
            if (prev && /[\w.π)⁄⦆]/.test(prev)) continue; // かっこや関数のあとなどは、横に並べた「⁄」のまま
            if (m.index > l) parts.push({ t: "text", s: txt(seg.slice(l, m.index)) });
            parts.push({ t: "frac", whole: m[1] || "", num: m[2], den: m[3], tail: false });
            l = m.index + m[0].length;
        }
        if (l < seg.length) parts.push({ t: "text", s: txt(seg.slice(l)) });
    };
    let last = 0, i = 0;
    while (i < e.length) {
        if (e[i] === "⦅") {
            const c1 = calcMatchClose(e, i);
            if (c1 > 0 && e[c1 + 1] === "⁄" && e[c1 + 2] === "⦅") {
                const c2 = calcMatchClose(e, c1 + 2);
                if (c2 > 0) {
                    let ts = i, whole = "";
                    const wm = /(\d+ )$/.exec(e.slice(last, i));
                    if (wm) { whole = wm[1]; ts = i - whole.length; }
                    if (ts > last) plain(e.slice(last, ts), last > 0 ? "⦆" : "");
                    parts.push({ t: "frac", whole, num: e.slice(i + 1, c1), den: e.slice(c1 + 3, c2), tail: c2 + 1 === e.length });
                    last = c2 + 1; i = last;
                    continue;
                }
            }
        }
        i++;
    }
    if (last < e.length) plain(e.slice(last), last > 0 ? "⦆" : "");
    return parts;
}
// いま入力中の枠の道すじ：["num"]、入れ子なら ["num", "den"] のように、外の枠から順に。入力中でなければ null
function calcSlotPath() {
    if (!calc.slot || calc.done) return null;
    const path = calc.slot.split(">");
    let e = calc.expr;
    for (const key of path) {
        if (key !== "num" && key !== "den") return null;
        const t = calcTailTpl(e);
        if (!t) return null;
        e = key === "num" ? t[2] : t[3];
    }
    return path;
}
// いま入力中の枠。「num」は分子、「den」は分母（いちばん内側の枠）、入力中でなければ null
function calcSlot() {
    const p = calcSlotPath();
    return p ? p[p.length - 1] : null;
}
// 式を、枠つきの分数の形で el に並べる。live を true にすると、入力中の枠が光って、押して選べる
function calcFillExpr(el, e, live) {
    el.textContent = "";
    return calcFillInto(el, e, live, live ? calcSlotPath() : null, live ? [] : null, 0);
}
function calcFillInto(el, e, live, act, tailPath, depth) {
    let has = false;
    const mk = (cls, txt) => { const x = document.createElement("span"); x.className = cls; if (txt) x.textContent = txt; return x; };
    calcExprParts(e).forEach(p => {
        if (p.t === "text") { el.appendChild(document.createTextNode(p.s)); return; }
        has = true;
        const on = live && p.tail && !calc.done && tailPath !== null;
        const here = on && act && act.length ? act : null;
        const f = mk("cf");
        if (p.whole) f.appendChild(mk("cf-w", p.whole));
        const box = mk("cf-f");
        const side = (key, content) => {
            let c = content;
            if (!live) c += ")".repeat(Math.max(0, calcOpenCount(c))); // 履歴では、閉じていないかっこを閉じて見せます
            const s = mk("cf-" + (key === "num" ? "n" : "d") + (content === "" ? " cf-empty" : "") + (here && here.length === 1 && here[0] === key ? " cf-on" : ""));
            if (/⦅/.test(c)) {
                const sub = here && here[0] === key && here.length > 1 ? here.slice(1) : null;
                calcFillInto(s, c, live, sub, on ? tailPath.concat(key) : null, depth + 1);
            } else if (c !== "") s.textContent = calcDisp(c);
            if (live) s.setAttribute("aria-label", (key === "num" ? "分子 " : "分母 ") + (content === "" ? "まだ空" : calcDisp(content.replace(/[⦅⦆]/g, ""))));
            if (on) s.dataset.fslot = tailPath.concat(key).join(">");
            return s;
        };
        const n = side("num", p.num), d = side("den", p.den);
        if (on) f.classList.add("cf-live");
        box.appendChild(n); box.appendChild(mk("cf-bar", "⁄")); box.appendChild(d);
        f.appendChild(box);
        el.appendChild(f);
    });
    return has;
}
function calcRenderExpr(el) {
    const e = calc.expr;
    if (!e) { el.textContent = "　"; el.classList.remove("has-frac"); return; }
    const has = calcFillExpr(el, e, true);
    if (calc.done && !calc.err) el.appendChild(document.createTextNode(" ="));
    el.classList.toggle("has-frac", has);
    el.scrollLeft = el.scrollWidth;
}
// 分子と分母の入力先を切り替える。切り替えられたら true（入れ子の分数では、いちばん内側の枠の分子と分母）
function calcFracMove(toNum) {
    if (calc.done || !calcTailTpl(calc.expr)) return false;
    const p = calcSlotPath() || [];
    calc.slot = p.slice(0, -1).concat(toNum ? "num" : "den").join(">");
    calcRender();
    return true;
}
// 枠を直接押して、入れる所を選びます
function calcFracGoto(path) {
    if (calc.done || !path) return false;
    const old = calc.slot;
    calc.slot = path;
    if (!calcSlotPath()) { calc.slot = old; return false; }
    calcRender();
    return true;
}
// 矢印の左右：分子 → 分母 → ひとつ外の枠、いちばん外では分数の外
function calcFracStep(right) {
    if (calc.done || !calcTailTpl(calc.expr)) return false;
    const cur = calcSlotPath();
    if (right) {
        if (!cur) calc.slot = null;
        else if (cur[cur.length - 1] === "num") calc.slot = cur.slice(0, -1).concat("den").join(">");
        else calc.slot = cur.slice(0, -1).join(">") || null;
    } else if (!cur) calc.slot = "den";
    else calc.slot = cur.slice(0, -1).concat(cur[cur.length - 1] === "den" ? "num" : "num").join(">");
    calcRender();
    return true;
}
function calcLastNum(e) { const m = /[\d.]*$/.exec(e); return m ? m[0] : ""; }
function calcOpenCount(e) { return (e.match(/\(/g) || []).length - (e.match(/\)/g) || []).length; }
function calcNewIfDone() { if (calc.done) { calc.expr = ""; calc.done = false; calc.slot = null; } calc.err = false; }
const CALC_OPERAND_END = /[\dπe)s!%⦆ｘｙａｂ]/;
const CALC_NUM_TAIL2 = /(\d+ \d+⁄\d+|\d+⁄\d+|\d*\.?\d+|Ans|[ｘｙａｂ])$/;
// 式の終わりの数のまとまり（分数の枠も、ひとまとまり）。{ index, 1: 文字 } か null
function calcNumTail(e) {
    const t = calcTailTpl(e);
    if (t) return { index: t.index, 1: t[0] };
    return CALC_NUM_TAIL2.exec(e);
}

let calcQuiet = false;
// 分母の中で「分数」を押したとき：分母の終わりの数（や、足したあとの演算）を外に出して、そこから新しい分数を始める。できたら true
function calcDenSplit() {
    const t = calcTailTpl(calc.expr);
    if (!t) return false;
    const content = t[3], pre = calc.expr.slice(0, t.index), whole = t[1] || "";
    const head = x => pre + whole + "⦅" + t[2] + "⦆⁄⦅" + x + "⦆";
    const isOp = ch => "+−×÷".includes(ch);
    // (a) 分母が「2+」のように演算で終わっている：演算を外に出して、空の分数を始める
    if (content.length > 1 && isOp(content.slice(-1))) {
        const before = content.slice(0, -1);
        if (calcOpenCount(before) <= 0 && CALC_OPERAND_END.test(before.slice(-1))) {
            calc.expr = head(before) + content.slice(-1) + "⦅⦆⁄⦅⦆"; calc.slot = "num"; return true;
        }
    }
    // (b) 分母が「2+3」のように、演算のあとに数が続く：その数を分子にして、新しい分数を始める
    const st = calcTailOperand(content);
    if (st > 1 && isOp(content[st - 1])) {
        const before = content.slice(0, st - 1);
        if (calcOpenCount(before) <= 0 && CALC_OPERAND_END.test(before.slice(-1))) {
            calc.expr = head(before) + content[st - 1] + "⦅" + content.slice(st) + "⦆⁄⦅⦆"; calc.slot = "den"; return true;
        }
    }
    return false;
}
// 式の終わりの「分数にできる数」の始まりの位置。数、Ans、π、e、かっこや関数のまとまり。なければ -1
function calcTailOperand(e) {
    let j = e.length;
    while (j > 0 && (e[j - 1] === "!" || e[j - 1] === "%")) j--;
    if (j === 0) return -1;
    const c = e[j - 1];
    if (c === ")") {
        let d = 0, k = j - 1;
        for (; k >= 0; k--) { if (e[k] === ")") d++; else if (e[k] === "(") { d--; if (d === 0) break; } }
        if (k < 0) return -1;
        const fm = /(?:asin|acos|atan|sin|cos|tan|log|ln|abs|√)$/.exec(e.slice(0, k));
        return fm ? k - fm[0].length : k;
    }
    if (/[\d.]/.test(c)) { const m = /[\d.]+$/.exec(e.slice(0, j)); return j - m[0].length; }
    if (e.slice(0, j).endsWith("Ans")) return j - 3;
    if ("ｘｙａｂ".includes(c)) return j - 1;
    if (c === "π" || c === "e") return j - 1;
    return -1;
}
// 分数のあとに、べき乗や ! などを足すときは、分数ぜんたいをかっこでまとめます
function calcWrapTail() {
    const t = calcTailTpl(calc.expr);
    if (t) calc.expr = calc.expr.slice(0, t.index) + "(" + t[0] + ")";
}
// 分子や分母に入力中のキー：枠の中身だけを式として扱って、いつもの入力のしかたをそのまま使います
const CALC_EXIT_KEYS = [")", "%", "fact", "sq", "pow", "inv"];
function calcPressInSlot(k) {
    const path = calcSlotPath();
    const t = calcTailTpl(calc.expr);
    const which = path[0], rest = path.slice(1), inner = rest.length === 0;
    const content = which === "num" ? t[2] : t[3];
    const pre = calc.expr.slice(0, t.index);
    const whole = t[1] || "";
    // 分母が書き終わっているときに、「)」や ! や x² などを押すと、分数ぜんたいにかかるように、分数の外に出ます。+ − × ÷ は、分母の中に入ります
    if (inner && which === "den" && CALC_EXIT_KEYS.includes(k) && content !== "" && calcOpenCount(content) <= 0 && CALC_OPERAND_END.test(content.slice(-1))) {
        calc.slot = null; calcPress(k); return;
    }
    if (inner && k === "bs" && content === "") {
        if (which === "den") calc.slot = "num";
        else { calc.expr = pre + whole.replace(/ $/, ""); calc.slot = null; }
        calcRender(); return;
    }
    if (inner && content === "" && (k === "+" || k === "*" || k === "/" || k === "^" || k === ")" || k === "%" || k === "fact" || k === "sq" || k === "pow" || k === "inv")) return;
    // 枠の中身だけを式として扱います。入れ子の枠は、中の枠の道すじを渡して、同じしくみで入力します
    calc.expr = content; calc.done = false;
    calc.slot = inner ? null : rest.join(">");
    const q0 = calcQuiet;
    calcQuiet = true;
    try { calcPress(inner && k === "nest" ? "frac" : k); } finally { calcQuiet = q0; }
    const c2 = calc.expr, sub = calc.slot;
    calc.expr = pre + whole + "⦅" + (which === "num" ? c2 : t[2]) + "⦆⁄⦅" + (which === "den" ? c2 : t[3]) + "⦆";
    calc.slot = sub ? which + ">" + sub : which;
    calc.done = false; calc.err = false;
    calcRender();
}

// ---- 元に戻す：式を変える操作の前の状態を、100回まで取っておきます ----
let calcDepth = 0;
const CALC_NO_UNDO = ["menu", "sys", "close", "hist", "histclear", "copy", "ring", "mode", "deg", "view", "undo", "redo", "out"];
function calcSnap(key) {
    return { key, expr: calc.expr, done: calc.done, err: calc.err, slot: calc.slot, ans: calc.ans, ansV: calc.ansV, ansFrac: calc.ansFrac, ansFF: calc.ansFF, sol: calc.sol, mem: calc.mem, hasMem: calc.hasMem, hist: calc.hist.slice() };
}
function calcSnapSame(a) {
    return a.expr === calc.expr && a.done === calc.done && a.err === calc.err && a.slot === calc.slot && a.mem === calc.mem && a.hasMem === calc.hasMem && a.ansV === calc.ansV && a.ansFF === calc.ansFF && a.sol === calc.sol && a.hist.length === calc.hist.length;
}
// ---- 変数の値：x y a b に入れる値は、式とは別に、電卓のキーで入れます ----
function calcVarsSave() {
    const o = {};
    CALC_VAR_NAMES.forEach(n => { if (calc.vars[n]) o[n] = calcInsertText(calc.vars[n]); });
    lsSet("calc_vars", JSON.stringify(o));
}
function calcVarsLoad() {
    try {
        const o = JSON.parse(lsGet("calc_vars", "{}")) || {};
        CALC_VAR_NAMES.forEach(n => {
            if (typeof o[n] !== "string") return;
            const V = calcEvaluate(o[n]);
            if (V && V !== "math" && !V.p) calc.vars[n] = V;
        });
    } catch (e) { /* 何もしない */ }
}
function calcVarText(n) {
    const V = calc.vars[n];
    return V ? calcShow(V, true, "auto").main : "";
}
// 値を入れる入力を、始める・やめる
function calcAssignStart(n) {
    if (calc.assign) calcAssignCancel(true);
    calc.saved = { expr: calc.expr, done: calc.done, err: calc.err, slot: calc.slot };
    calc.expr = ""; calc.done = false; calc.err = false; calc.slot = null; calc.view = "auto";
    calc.assign = n;
    calcRender();
}
function calcAssignCancel(quiet) {
    if (!calc.assign) return;
    const a = calc.saved;
    calc.assign = null; calc.saved = null;
    if (a) { calc.expr = a.expr; calc.done = a.done; calc.err = a.err; calc.slot = a.slot; }
    calc.view = "auto";
    if (!quiet) calcRender();
}
function calcAssignCommit() {
    const n = calc.assign;
    const r = calcTry(calc.expr);
    if (!r.ok) { showToast("値を計算できません。式を直してください。", "warn"); return; }
    if (r.V.p) { showToast("値は数で入れてください。文字が残る式は入れられません。", "warn"); return; }
    calc.vars[n] = r.V;
    calcVarsSave();
    calcAssignCancel(true);
    calcRender();
    showToast(n + " に " + calcVarText(n) + " を入れました。", "success");
}

function calcRestore(a) {
    calc.expr = a.expr; calc.done = a.done; calc.err = a.err; calc.slot = a.slot;
    calc.ans = a.ans; calc.ansV = a.ansV; calc.ansFrac = a.ansFrac; calc.ansFF = a.ansFF; calc.sol = a.sol; calc.mem = a.mem; calc.hasMem = a.hasMem;
    if (["eq", "factor", "expand", "solve"].includes(a.key)) calc.hist = a.hist;
    calc.view = "auto"; calc.keyLog = "";
}
function calcUndo() {
    if (calc.phone) return;
    if (calc.assign) { showToast("値を入れている間は元に戻せません。", "warn"); return; }
    const a = calc.undo.pop();
    if (!a) { showToast("もどせる操作がありません。", "warn"); return; }
    calc.redo.push(calcSnap(a.key)); // やり直す時のために、今の状態を取っておく
    calcRestore(a);
    calcRender();
}
function calcRedo() {
    if (calc.phone) return;
    if (calc.assign) { showToast("値を入れている間はやり直せません。", "warn"); return; }
    const a = calc.redo.pop();
    if (!a) { showToast("やり直せる操作がありません。", "warn"); return; }
    calc.undo.push(calcSnap(a.key));
    calcRestore(a);
    calcRender();
}
function calcPress(k) {
    if (k === "menu") { calcMenuSet(!calc.menu); return; }
    if (calc.menu) calcMenuSet(false);
    if (k === "undo") { calcUndo(); return; }
    if (k === "redo") { calcRedo(); return; }
    if (calc.phone || calc.assign || calcDepth > 0 || calcQuiet || CALC_NO_UNDO.includes(k) || /^[sd][xyab]$/.test(k)) {
        calcDepth++;
        try { calcPressCore(k); } finally { calcDepth--; }
        return;
    }
    const snap = calcSnap(k);
    calcDepth++;
    try { calcPressCore(k); } finally { calcDepth--; }
    if (calcSnapSame(snap)) return; // 何も変わらなかった押し間違いは、取っておきません
    calc.undo.push(snap);
    if (calc.undo.length > 100) calc.undo.shift();
    calc.redo = [];
    calcRender();
}
// 答えを出す。form が "factor" なら、因数分解した形で出します。"expand" なら、展開した形です
function calcDoEq(form) {
    let r = { ok: false };
    if (calc.done && !calc.err && calc.ansV && form && !calc.sol) r = { ok: true, V: calc.ansV };
    else r = calcTry(calc.expr);
    if (!r.ok) { calc.err = true; calc.done = true; calc.ansFF = null; calc.sol = null; calcRender(); return; }
    let ff = null;
    if (form === "factor") {
        ff = calcFactorForm(r.V);
        if (!ff) { showToast(r.V.p ? "この式は因数分解できません。" : "この答えは因数分解できません。大きすぎるか、小数や √ を含みます。", "warn"); return; }
        if (ff.same) { showToast("これ以上は因数分解できません。", "warn"); ff = null; }
    }
    if (form === "expand" && !r.V.p) showToast("展開する文字式ではありません。", "warn");
    let f;
    try { f = r.V.p ? NaN : calcToFloat(r.V); } catch (e) { calc.err = true; calc.done = true; calcRender(); return; }
    const hasFrac = /⁄/.test(calc.expr);
    const wasDone = calc.done;
    calc.ans = f; calc.ansV = r.V; calc.ansFrac = hasFrac; calc.done = true; calc.err = false; calc.ansFF = ff; calc.sol = null;
    const text = ff ? ff.text : calcShow(r.V, hasFrac, "auto").main;
    if (!(wasDone && form === "expand" && calc.hist.length && calc.hist[calc.hist.length - 1].text === text)) {
        calc.hist.push({ expr: calc.expr, text, plain: ff ? ff.ins : calcInsertText(r.V) });
        if (calc.hist.length > 30) calc.hist.shift();
    }
    calcRender();
}
// 方程式を解く：「=」で左と右に分け、「左−右＝0」を解きます。等号がなければ、式＝0 として解きます
function calcSolveKey() {
    if (calc.assign || !calc.expr) return;
    const e = calc.expr, i = e.indexOf("=");
    const side = t => { t = t.replace(CALC_TAIL, ""); return t ? calcEvaluate(t) : null; };
    const L = side(i < 0 ? e : e.slice(0, i)), Rr = i < 0 ? calcR(0n, 1n) : side(e.slice(i + 1));
    if (L === null || Rr === null) { showToast("式を最後まで入れてから、解きます。", "warn"); return; }
    if (L === "math" || Rr === "math") { showToast("計算できない式です。", "warn"); return; }
    let f;
    try { f = calcSubV(L, Rr); } catch (er) { showToast("計算できない式です。", "warn"); return; }
    const fin = (sol, sub, text, plain, V) => {
        calc.sol = sol; calc.ansFF = null; calc.done = true; calc.err = false; calc.slot = null;
        if (V) { calc.ansV = V; calc.ans = V.p ? NaN : calcToFloat(V); calc.ansFrac = true; }
        calc.hist.push({ expr: e, text, plain });
        if (calc.hist.length > 30) calc.hist.shift();
        calcRender();
    };
    if (!f.p && !/[ｘｙａｂ]/.test(e)) { showToast("解く文字が式にありません。x y a b のどれかを入れてください。", "warn"); return; }
    if (!f.p) {
        const have = CALC_VAR_NAMES.filter(n => e.includes(CALC_VAR_CH[n]) && calc.vars[n]);
        if (have.length && have.length === CALC_VAR_NAMES.filter(n => e.includes(CALC_VAR_CH[n])).length) { showToast(have.join(" と ") + " には、値が入っています。値を消すと文字のまま解けます。", "warn"); return; }
        const z = f.r ? f.n === 0n : (f.s ? false : Math.abs(f.x) < 1e-12);
        fin({ u: "", items: [], main: z ? "全ての値" : "解なし", sub: z ? "どんな値でも成り立ちます" : "成り立つ値はありません" }, "", z ? "全ての値" : "解なし", "", null);
        return;
    }
    const atoms = polyAtomsOf(f.n, new Set());
    const un = ["ｘ", "ｙ", "ａ", "ｂ"].find(a => atoms.has(a));
    if (!un) { showToast("解く文字が式にありません。x y a b のどれかを入れてください。", "warn"); return; }
    let res;
    try { res = calcSolveFor(f, un); } catch (er) { showToast("この式は解けませんでした。", "warn"); return; }
    { // 元の式に入れて、分母が 0 になる値は除きます（約分で消えた分母もここで見つかります）
        const nm = CALC_VAR_NAMES.find(n => CALC_VAR_CH[n] === un), keep = [];
        const lhsS = (i < 0 ? e : e.slice(0, i)).replace(CALC_TAIL, ""), rhsS = i < 0 ? "" : e.slice(i + 1).replace(CALC_TAIL, "");
        res.roots.forEach(r => {
            calc.vars[nm] = r.V;
            let bad = false;
            try { bad = calcEvaluate(lhsS) === "math" || (rhsS && calcEvaluate(rhsS) === "math"); } finally { calc.vars[nm] = null; }
            if (bad) res.excluded.push(r.V); else keep.push(r);
        });
        res.roots = keep;
    }
    if (res.unsolved && !res.roots.length) { showToast("この式はまだ解けません。3次以上で文字を含む式です。", "warn"); return; }
    const name = calcDisp(un);
    const items = res.roots.map(r => ({
        V: r.V, approx: r.approx,
        text: r.approx ? "≈ " + calcFmt(r.V.x) : calcShow(r.V, true, "auto").main,
        ins: calcInsertText(r.V),
        dec: !r.approx && !r.V.p && (r.V.s || (r.V.r && r.V.d !== 1n)) ? "≈ " + calcFmt(calcToFloat(r.V)) : ""
    }));
    let sub = name + " について解きました";
    if (res.excluded.length) sub += "。" + res.excluded.map(v => name + "＝" + calcShow(v, true, "auto").main).join("、") + " は、分母が 0 になるので除きます";
    else if (res.unsolved) sub += "。解けない部分が残っています";
    else if (res.noreal && items.length) sub += "。他は実数の解がありません";
    const main = items.length ? "解は " + items.length + " つ" : "解なし";
    if (!items.length) sub = res.excluded.length ? res.excluded.map(v => name + "＝" + calcShow(v, true, "auto").main).join("、") + " は、分母が 0 になるので、解はありません" : res.noreal ? "実数の解はありません" : "解はありません";
    const text = items.length ? name + "＝" + items.map(x => x.text.replace("≈ ", "≈")).join("、") : "解なし";
    fin({ u: name, items, main, sub }, sub, text, items.length ? items[0].ins : "", items.length ? items[0].V : null);
}
// ==========================================
// 連立方程式：1本目の式を入れて押し、2本目の式を入れてもう一度押すと、x と y を解きます
// ==========================================
function calcSysText(e) { return calcDisp(String(e).replace(/⦅/g, "(").replace(/⦆/g, ")").replace(/⁄/g, "/")); }
const calcIsZ = V => !!V && !V.p && (V.r ? V.n === 0n : V.s ? false : Math.abs(V.x) < 1e-12);
function calcSubstAtom(f, atom, V) {
    if (!f.p) return f;
    return calcDiv(polySubstV(f.n, atom, V), polySubstV(f.d, atom, V));
}
// 式 f を a·x + b·y + c の形にする。そうならなければ null
function calcLinXY(f) {
    try {
        const at = (xv, yv) => calcSubstAtom(calcSubstAtom(f, "ｘ", calcR(BigInt(xv), 1n)), "ｙ", calcR(BigInt(yv), 1n));
        const g = at(0, 0), a = calcSubV(at(1, 0), g), b = calcSubV(at(0, 1), g);
        const chk = (v, w) => calcIsZ(calcSubV(v, w));
        const m = (k, V) => calcMul(calcR(BigInt(k), 1n), V);
        if (!chk(calcSubV(at(2, 0), g), m(2, a)) || !chk(calcSubV(at(0, 2), g), m(2, b)) || !chk(calcSubV(at(1, 1), g), calcAdd(a, b)) || !chk(calcSubV(at(-1, 3), g), calcAdd(m(-1, a), m(3, b)))) return null;
        return { a, b, k: calcNegV(g) };
    } catch (er) { return null; }
}
function calcSysKey() {
    if (calc.assign) return;
    const e = calc.expr;
    if (!e) { showToast(calc.sys ? "2本目の式を入れてください。" : "1本目の式を入れてください。例　2x＋y＝5", "warn"); return; }
    const i = e.indexOf("=");
    if (i < 0) { showToast("等号 ＝ のある式を入れてください。", "warn"); return; }
    const side = t => { t = t.replace(CALC_TAIL, ""); return t ? calcEvaluate(t) : null; };
    const L = side(e.slice(0, i)), Rr = side(e.slice(i + 1));
    if (L === null || Rr === null) { showToast("式を最後まで入れてから、押します。", "warn"); return; }
    if (L === "math" || Rr === "math") { showToast("計算できない式です。", "warn"); return; }
    if (!calc.sys || calc.done) {
        calc.sys = e; calc.expr = ""; calc.done = false; calc.err = false; calc.slot = null; calc.sol = null; calc.ansFF = null;
        calcRender(); return;
    }
    const e1 = calc.sys, j = e1.indexOf("=");
    let f1, f2;
    try {
        const s1 = e1.slice(0, j).replace(CALC_TAIL, ""), s2 = e1.slice(j + 1).replace(CALC_TAIL, "");
        f1 = calcSubV(calcEvaluate(s1), calcEvaluate(s2)); f2 = calcSubV(L, Rr);
    } catch (er) { showToast("計算できない式です。", "warn"); return; }
    if (!/[ｘｙ]/.test(e1 + e)) { showToast("x か y の入った式を入れてください。", "warn"); return; }
    const q1 = calcLinXY(f1), q2 = calcLinXY(f2);
    if (!q1 || !q2) { showToast("x と y の1次式だけ解けます。x² や x×y は、まだ解けません。", "warn"); return; }
    const D = calcSubV(calcMul(q1.a, q2.b), calcMul(q2.a, q1.b));
    const Dx = calcSubV(calcMul(q1.k, q2.b), calcMul(q2.k, q1.b));
    const Dy = calcSubV(calcMul(q1.a, q2.k), calcMul(q2.a, q1.k));
    const items = [];
    let main, sub = "", plain = "", V0 = null;
    const bad = q => calcIsZ(q.a) && calcIsZ(q.b) && !calcIsZ(q.k);
    if (calcIsZ(D)) {
        const infinite = !bad(q1) && !bad(q2) && calcIsZ(Dx) && calcIsZ(Dy);
        main = infinite ? "解は無数" : "解なし";
        sub = infinite ? "2本の式が同じ関係を表しています" : "2本の式を同時に成り立たせる値は、ありません";
    } else {
        const xV = calcDiv(Dx, D), yV = calcDiv(Dy, D);
        [["x", xV], ["y", yV]].forEach(([name, V]) => items.push({
            name, V, approx: false,
            text: calcShow(V, true, "auto").main,
            ins: calcInsertText(V),
            dec: !V.p && (V.s || (V.r && V.d !== 1n)) ? "≈ " + calcFmt(calcToFloat(V)) : ""
        }));
        main = "x ＝ " + items[0].text + "、y ＝ " + items[1].text;
        sub = D.p ? "文字を含むので分母が 0 になる場合は、別に考えます" : "x と y を、1組の解として求めました";
        plain = items[0].ins; V0 = xV;
    }
    const text = items.length ? "x＝" + items[0].text + "、y＝" + items[1].text : main;
    calc.sol = { u: "", items, main, sub };
    calc.sys = null; calc.ansFF = null; calc.done = true; calc.err = false; calc.slot = null;
    if (V0) { calc.ansV = V0; calc.ans = V0.p ? NaN : calcToFloat(V0); calc.ansFrac = true; }
    calc.hist.push({ expr: e1 + "、" + e, text, plain });
    if (calc.hist.length > 30) calc.hist.shift();
    calcRender();
}
function calcPressCore(k) {
    if (k === "out") { const op = calcSlotPath(); if (op) { calc.slot = op.slice(0, -1).join(">") || null; calcRender(); } return; } // 分数の枠から出る。入れ子なら、一つ外の枠へ
    if (/^d[xyab]$/.test(k)) { // 変数の値を消す
        const n = k.charAt(1);
        if (!calc.vars[n]) return;
        calc.vars[n] = null;
        calcVarsSave();
        if (calc.assign === n) calcAssignCancel(true);
        calcRender();
        showToast(n + " の値を消しました。", "success");
        return;
    }
    if (/^s[xyab]$/.test(k)) { // 変数の値の欄：押すと値を入れる入力になる。入れている間にもう一度押すと、やめる
        const n = k.charAt(1);
        if (calc.assign === n) calcAssignCancel(); else calcAssignStart(n);
        return;
    }
    if (k === "close") { closeCalculator(); return; }
    if (k === "hist") { calc.histOpen = !calc.histOpen; calcRender(); return; }
    if (k === "histclear") { calc.hist = []; calcRender(); return; }
    if (k === "copy") { calcCopy(); return; }
    if (k === "ring") { calcRing(); return; }
    if (k === "sys") { calcSysKey(); return; }
    if (k === "mode") return;
    if (k === "deg") { calc.deg = !calc.deg; lsSet("calc_deg", calc.deg ? "1" : "0"); calcRender(); return; }
    if (k === "view") {
        const cur = calcCurrent();
        if (!cur) return;
        if (cur.V.p) { showToast("文字を含む答えは「展開」と「因数分解」で切り替えます。", "warn"); return; }
        if (!cur.V.r && !cur.V.s) { showToast("この答えは分数や√の形にできません。", "warn"); return; }
        if (cur.V.r && cur.V.d === 1n) { showToast("整数なので分数にしても同じです。", "warn"); return; }
        const eff = calcEffView(cur.V, cur.hasFrac, calc.view);
        const order = cur.V.s ? ["exact", "dec"] : (calcAbsB(cur.V.n) > cur.V.d ? ["frac", "mixed", "dec"] : ["frac", "dec"]);
        calc.view = order[(order.indexOf(eff) + 1) % order.length];
        calcRender(); return;
    }
    if (calcSlot() && (k === "nest" || !["mc", "mp", "mm", "eq", "clear", "frac", "mixed", "out", "expand", "factor", "solve", "equ", "graph", "sys"].includes(k) || (k === "frac" && calcSlotPath().length > 1))) { calcPressInSlot(k); return; }
    if (/^v[xyab]$/.test(k)) { // 変数のキー
        calc.keyLog = "";
        calc.view = "auto"; calc.slot = null;
        calcNewIfDone();
        calc.expr += CALC_VAR_CH[k.charAt(1)]; calcRender(); return;
    }
    // 押したキーの記録。隠し機能の合図は、先頭の0もふくめた押した順で見ます
    if (/^\d$/.test(k)) calc.keyLog = (calc.keyLog + k).slice(-8);
    else if (k !== "eq") calc.keyLog = "";
    // ここから下は、式を変える操作。答えの見せ方は、もとに戻します
    calc.view = "auto";
    if (!(k === "bs" || k === "frac" || k === "mixed")) calc.slot = null;
    if (k === "mc") { calc.mem = null; calc.hasMem = false; calcRender(); return; }
    if (k === "mr") {
        calcNewIfDone();
        if (!calc.hasMem) { calcRender(); return; }
        calc.expr += calcInsertText(calc.mem);
        calcRender(); return;
    }
    if (k === "mp" || k === "mm") {
        let V = null;
        if (calc.done && calc.ansV) V = calc.ansV;
        else { const r = calcTry(calc.expr.replace(CALC_TAIL, "")); if (r.ok) V = r.V; }
        if (!V) { showToast("先に計算できる式を入れてください。", "warn"); return; }
        try {
            const base = calc.hasMem ? calc.mem : calcR(0n, 1n);
            calc.mem = k === "mp" ? calcAdd(base, V) : calcSubV(base, V);
            calc.hasMem = true;
        } catch (e) { showToast("メモリに入れられない数です。", "warn"); }
        calcRender(); return;
    }
    if (k === "clear") { calc.expr = ""; calc.done = false; calc.err = false; calc.slot = null; calc.sys = null; calcRender(); return; }
    if (k === "bs") {
        if (!calc.done && !calc.slot && calcTailTpl(calc.expr)) { calc.slot = "den"; calcRender(); return; } // 書き終えた分数に、もどって直す
        calc.err = false;
        calc.done = false;
        calc.expr = calc.expr.replace(/(?:asin|acos|atan|sin|cos|tan|log|ln|abs|√)\($|Ans$|[\s\S]$/u, "");
        calcRender(); return;
    }
    if (k === "eq") {
        if (calc.assign) { if (calc.expr) calcAssignCommit(); return; }
        if (!calc.expr) return;
        const secret = calc.keyLog === "0051" && calc.expr === "51" && !calc.done; // 隠し機能の合図
        calc.keyLog = "";
        if (secret) { calcPhoneEnter(); return; }
        if (calc.expr.includes("=")) { calcSolveKey(); return; } // 等号のある式は、方程式として解きます
        calcDoEq(null); return;
    }
    if (k === "equ") { // 方程式の等号
        calc.slot = null;
        calcNewIfDone();
        const last = calc.expr.slice(-1);
        if (!calc.expr || calc.expr.includes("=") || !CALC_OPERAND_END.test(last)) { calcRender(); return; }
        calc.expr += "="; calcRender(); return;
    }
    if (k === "solve") { calcSolveKey(); return; }
    if (k === "graph") { calcGraphOpen(); return; }
    if (k === "expand" || k === "factor") {
        if (calc.assign || !calc.expr) return;
        if (calc.expr.includes("=")) { showToast("等号のある式は「方程式を解く」で解きます。", "warn"); return; }
        calcDoEq(k); return;
    }
    if (/^\d$/.test(k)) {
        calcNewIfDone();
        if (calcLastNum(calc.expr) === "0") calc.expr = calc.expr.slice(0, -1);
        calc.expr += k; calcRender(); return;
    }
    if (k === ".") {
        calcNewIfDone();
        const n = calcLastNum(calc.expr);
        const before = calc.expr.slice(0, calc.expr.length - n.length).slice(-1);
        if (n.includes(".") || before === "⁄" || before === " " || calc.expr.slice(-1) === "⁄") { calcRender(); return; }
        calc.expr += n === "" ? "0." : "."; calcRender(); return;
    }
    if (k === "frac" || k === "mixed") {
        calcNewIfDone();
        if (calcTailTpl(calc.expr)) {
            if (k === "frac" && calcSlot()) { // 分子 → 分母。分母では新しい分数を始める
                if (calc.slot === "num") calc.slot = "den";
                else if (!calcDenSplit()) calc.slot = null;
            }
            calcRender(); return;
        }
        const n = calcLastNum(calc.expr);
        const before = calc.expr.slice(0, calc.expr.length - n.length).slice(-1);
        const last = calc.expr.slice(-1);
        const atStart = !last || "+−×÷^(".includes(last); // 式の始めや、演算のあと：何もない所に枠を出す
        if (k === "frac") {
            if (atStart) { calc.expr += "⦅⦆⁄⦅⦆"; calc.slot = "num"; calcRender(); return; }
            // 数だけでなく、かっこや関数のあとにも使えます。そこまでの数や関数が、分子になります
            const st = CALC_OPERAND_END.test(last) ? calcTailOperand(calc.expr) : -1;
            if (st < 0) { calcRender(); return; }
            calc.expr = calc.expr.slice(0, st) + "⦅" + calc.expr.slice(st) + "⦆⁄⦅⦆"; calc.slot = "den"; calcRender(); return;
        }
        if (atStart) { calc.expr += "0 ⦅⦆⁄⦅⦆"; calc.slot = "num"; calcRender(); return; } // 整数がなければ 0 にします
        if (!n || n.includes(".") || before === "⁄" || before === " ") { calcRender(); return; }
        calc.expr += " ⦅⦆⁄⦅⦆"; calc.slot = "num"; calcRender(); return;
    }
    if (k === "+" || k === "-" || k === "*" || k === "/" || k === "^") {
        const sym = { "+": "+", "-": "−", "*": "×", "/": "÷", "^": "^" }[k];
        calc.err = false;
        if (calc.done) { calc.expr = calc.ansV ? "Ans" : ""; calc.done = false; }
        if (!calc.expr) {
            if (sym === "−") calc.expr = "−";
            else if (calc.ansV) calc.expr = "Ans" + sym;
            else calc.expr = "0" + sym;
            calcRender(); return;
        }
        const last = calc.expr.slice(-1);
        if (last === " " || last === "⁄") { calcRender(); return; }
        if ("+−×÷^".includes(last)) {
            if (sym === "−" && "×÷^".includes(last)) { calc.expr += "−"; calcRender(); return; }
            const stripped = calc.expr.replace(/[-+×÷−^]+$/, "");
            if (!stripped || stripped.endsWith("(")) { if (sym === "−") calc.expr = stripped + "−"; calcRender(); return; }
            calc.expr = stripped + sym; calcRender(); return;
        }
        if (last === "(") { if (sym === "−") calc.expr += "−"; calcRender(); return; }
        calc.expr += sym; calcRender(); return;
    }
    if (k === "(") { calcNewIfDone(); calc.expr += "("; calcRender(); return; }
    if (k === ")") {
        const last = calc.expr.slice(-1);
        if (calc.done || calcOpenCount(calc.expr) <= 0 || "+−×÷^( ⁄".includes(last) || !last) { calcRender(); return; }
        calc.expr += ")"; calcRender(); return;
    }
    if (k === "%" || k === "fact") {
        if (calc.done) { calc.expr = "Ans"; calc.done = false; }
        const last = calc.expr.slice(-1);
        if (!last || !CALC_OPERAND_END.test(last)) { calcRender(); return; }
        calcWrapTail();
        calc.expr += k === "%" ? "%" : "!"; calcRender(); return;
    }
    if (k === "neg") {
        calc.err = false;
        if (calc.done) { calc.expr = calc.ansV ? "Ans" : ""; calc.done = false; }
        let m = /\(−(\d+ \d+⁄\d+|\d+⁄\d+|\d*\.?\d+|Ans|[ｘｙａｂ])\)$/.exec(calc.expr);
        if (m) { calc.expr = calc.expr.slice(0, m.index) + m[1]; calcRender(); return; }
        if (calc.expr.endsWith(")")) { // (−分数の枠) は、マイナスをはずします
            let d = 0, j = calc.expr.length - 1;
            for (; j >= 0; j--) { if (calc.expr[j] === ")") d++; else if (calc.expr[j] === "(") { d--; if (d === 0) break; } }
            if (j >= 0 && calc.expr[j + 1] === "−") {
                const inner = calc.expr.slice(j + 2, -1), t = calcTailTpl(inner);
                if (t && t.index === 0) { calc.expr = calc.expr.slice(0, j) + inner; calcRender(); return; }
            }
        }
        m = calcNumTail(calc.expr);
        if (m) { calc.expr = calc.expr.slice(0, m.index) + "(−" + m[1] + ")"; calcRender(); return; }
        calc.expr += "−"; calcRender(); return;
    }
    const fnMap = { sin: "sin(", cos: "cos(", tan: "tan(", asin: "asin(", acos: "acos(", atan: "atan(", log: "log(", ln: "ln(", sqrt: "√(", abs: "abs(" };
    if (fnMap[k]) { calcNewIfDone(); calc.expr += fnMap[k]; calcRender(); return; }
    if (k === "pi" || k === "e") { calcNewIfDone(); calc.expr += k === "pi" ? "π" : "e"; calcRender(); return; }
    if (k === "ans") {
        if (!calc.ansV) { showToast("前の答えがまだありません。", "warn"); return; }
        calcNewIfDone(); calc.expr += "Ans"; calcRender(); return;
    }
    if (k === "sq" || k === "pow" || k === "inv") {
        if (calc.done) { calc.expr = "Ans"; calc.done = false; }
        calc.err = false;
        const last = calc.expr.slice(-1);
        if (!last || !CALC_OPERAND_END.test(last)) { calcRender(); return; }
        calcWrapTail();
        calc.expr += k === "sq" ? "^2" : k === "pow" ? "^" : "^(−1)";
        calcRender(); return;
    }
    if (k === "pow10" || k === "exp") {
        calcNewIfDone();
        const last = calc.expr.slice(-1);
        calc.expr += (last && CALC_OPERAND_END.test(last) ? "×" : "") + (k === "pow10" ? "10^(" : "e^(");
        calcRender(); return;
    }
}

async function calcCopy() {
    const cur = calcCurrent();
    if (!cur) { showToast("コピーできる答えがまだありません。", "warn"); return; }
    const t = calcShow(cur.V, cur.hasFrac, calc.view).main.replace("−", "-");
    try { await navigator.clipboard.writeText(t); showToast("答えをコピーしました。", "success"); }
    catch (e) { showToast("コピーできませんでした。", "warn"); }
}

// 機能メニュー：分数、文字式、メモリのボタンを、ひとつのメニューにまとめています
function calcMenuSet(on) {
    calc.menu = !!on;
    const m = $id("calcMenu"), b = document.querySelector('#calcPanel [data-ck="menu"]');
    if (m) m.hidden = !calc.menu;
    if (b) { b.classList.toggle("is-on", calc.menu); b.setAttribute("aria-expanded", calc.menu ? "true" : "false"); }
}

// 答えの数字を、電話のプッシュ音で順に鳴らします。小数点は ＊、マイナスは ＃ の音です
let calcRingTimer = null;
function calcRingStop() {
    if (calcRingTimer) { clearTimeout(calcRingTimer); calcRingTimer = null; }
    document.querySelectorAll("#calcPanel .calc-ring").forEach(b => { b.textContent = "鳴らす"; });
}
function calcRing() {
    if (calcRingTimer) { calcRingStop(); return; }
    const cur = calcCurrent();
    if (!cur || cur.V.p) { showToast("数の答えが出ている時だけ、鳴らせます。", "warn"); return; }
    const text = calcShow(cur.V, cur.hasFrac, "dec").main;
    const digits = Array.from(text).map(ch => ch === "−" || ch === "-" ? "#" : ch === "." ? "*" : /[0-9]/.test(ch) ? ch : "").join("").slice(0, 20);
    if (!digits) { showToast("鳴らせる数字がありません。", "warn"); return; }
    calc.lastRing = digits;
    initAudio();
    const step = 0.26;
    if (audioCtx) {
        const t0 = audioCtx.currentTime + 0.05;
        Array.from(digits).forEach((ch, i) => calcToneAt(ch, t0 + i * step, 0.16));
    }
    document.querySelectorAll("#calcPanel .calc-ring").forEach(b => { b.textContent = "⏹ とめる"; });
    calcRingTimer = setTimeout(calcRingStop, digits.length * step * 1000 + 200);
}

// ==========================================
// 表とグラフ：式の文字（x など）を動かして、値の表と、グラフを出します
// ==========================================
let calcGraphTimer = null;
const SVGNS = "http://www.w3.org/2000/svg";
// 小数の文字を、数にする。読み取れなければ null
function calcParseNum(t) {
    const m = /^\s*(-|−)?\s*(\d+\.?\d*|\.\d+)\s*$/.exec(String(t));
    if (!m) return null;
    const v = calcLit(m[2]);
    return m[1] ? calcNegV(v) : v;
}
function calcGraphEval(g, xv) { // 式の文字に、値を入れて計算します。計算できなければ null
    const prev = calc.vars[g.u];
    calc.vars[g.u] = xv;
    try {
        const V = calcEvaluate(g.src);
        return V === null || V === "math" || V.p ? null : V;
    } catch (e) { return null; } finally { calc.vars[g.u] = prev; }
}
function calcGraphOpen() {
    if (calc.assign || calc.phone || calc.graph) return;
    const e = calc.expr.replace(CALC_TAIL, "");
    if (!e) { showToast("先に式を入れてください。たとえば 2x+1 です。", "warn"); return; }
    if (e.includes("=")) { showToast("グラフには等号のない式を使います。", "warn"); return; }
    const names = CALC_VAR_NAMES.filter(n => e.includes(CALC_VAR_CH[n]) && !calc.vars[n]);
    if (!names.length) { showToast("グラフにする文字が式にありません。x y a b のどれかを入れてください。", "warn"); return; }
    if (names.length > 1) { showToast(names.join(" と ") + " の2つの文字があります。片方に値を入れてください。", "warn"); return; }
    const V = calcEvaluate(e);
    if (V === null) { showToast("式を最後まで入れてから、開きます。", "warn"); return; }
    let lo = "-5", hi = "5", step = "1";
    try { const o = JSON.parse(lsGet("calc_graph", "null")); if (o && calcParseNum(o.lo) && calcParseNum(o.hi) && calcParseNum(o.step)) { lo = String(o.lo); hi = String(o.hi); step = String(o.step); } } catch (er) { /* 何もしない */ }
    calc.graph = { u: names[0], src: e, lo, hi, step };
    const p = $id("calcPanel");
    if (p) p.dataset.graph = "1";
    const box = $id("calcGraph");
    if (box) {
        box.hidden = false;
        $id("cgLo").value = lo; $id("cgHi").value = hi; $id("cgStep").value = step;
        $id("cgU").textContent = names[0];
        calcFillExpr($id("cgExpr"), e, false);
    }
    calcGraphDraw();
    try { box.querySelector("input").focus({ preventScroll: true }); } catch (er) { /* 何もしない */ }
}
function calcGraphClose() {
    if (!calc.graph) return;
    calc.graph = null;
    const p = $id("calcPanel");
    if (p) { p.dataset.graph = "0"; try { p.focus({ preventScroll: true }); } catch (er) { /* 何もしない */ } }
    const box = $id("calcGraph");
    if (box) box.hidden = true;
    calcRender();
}
function calcNiceStep(range, count) {
    const raw = range / count, mag = Math.pow(10, Math.floor(Math.log10(raw))), r = raw / mag;
    return (r < 1.5 ? 1 : r < 3.5 ? 2 : r < 7.5 ? 5 : 10) * mag;
}
const calcTickText = t => String(Number(t.toPrecision(10))).replace("-", "−");
function calcGraphDraw() {
    const g = calc.graph;
    if (!g) return;
    const lo = calcParseNum($id("cgLo").value), hi = calcParseNum($id("cgHi").value), st = calcParseNum($id("cgStep").value);
    const msg = $id("cgMsg"), svg = $id("cgSvg"), tbl = $id("cgTable");
    svg.textContent = ""; tbl.textContent = "";
    $id("cgRead").textContent = "グラフの上をなぞると値が出ます";
    if (!lo || !hi || !st) { msg.textContent = "はじめ、おわり、きざみには数を入れてください。"; return; }
    const lof = calcToFloat(lo), hif = calcToFloat(hi), stf = calcToFloat(st);
    if (!(hif > lof)) { msg.textContent = "おわりははじめより大きい数にしてください。"; return; }
    if (!(stf > 0)) { msg.textContent = "きざみは、0 より大きい数にしてください。"; return; }
    g.lo = $id("cgLo").value; g.hi = $id("cgHi").value; g.step = $id("cgStep").value;
    lsSet("calc_graph", JSON.stringify({ lo: g.lo, hi: g.hi, step: g.step }));
    // 表
    const rows = Math.floor((hif - lof) / stf + 1e-9) + 1, shown = Math.min(rows, 200);
    msg.textContent = rows > 200 ? "表ははじめの 200 行までです。" : "";
    const tb = document.createElement("table");
    const hd = document.createElement("tr");
    [g.u, "y"].forEach(h => { const th = document.createElement("th"); th.textContent = h; hd.appendChild(th); });
    tb.appendChild(hd);
    for (let i = 0; i < shown; i++) {
        const xv = calcAddN(lo, calcMulN(calcR(BigInt(i), 1n), st));
        const V = calcGraphEval(g, xv);
        const tr = document.createElement("tr");
        const tx = document.createElement("td"), ty = document.createElement("td");
        calcRenderResult(tx, calcShow(xv, true, "auto").main, true);
        if (V) calcRenderResult(ty, calcShow(V, true, "auto").main, true);
        else { ty.textContent = "なし"; ty.className = "cg-none"; }
        tr.appendChild(tx); tr.appendChild(ty); tb.appendChild(tr);
    }
    tbl.appendChild(tb);
    // グラフ
    const W = 340, H = 230, ml = 40, mr = 10, mt = 10, mb = 24, N = 240;
    const ys = [], pts = [];
    for (let i = 0; i < N; i++) {
        const x = lof + (hif - lof) * i / (N - 1);
        const V = calcGraphEval(g, calcF(x));
        let y = null;
        if (V) { try { y = calcToFloat(V); } catch (er) { y = null; } if (y !== null && (!isFinite(y) || Math.abs(y) > 1e12)) y = null; }
        pts.push([x, y]);
        if (y !== null) ys.push(y);
    }
    const mk = (tag, a, txt) => { const e = document.createElementNS(SVGNS, tag); Object.keys(a || {}).forEach(k => e.setAttribute(k, a[k])); if (txt !== undefined) e.textContent = txt; svg.appendChild(e); return e; };
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("aria-label", "y＝" + calcDisp(g.src.replace(/[⦅⦆]/g, "")) + " のグラフ");
    if (!ys.length) { mk("text", { x: W / 2, y: H / 2, "text-anchor": "middle", fill: "#9ca3af", "font-size": 13 }, "この範囲ではグラフにできません"); return; }
    const sorted = ys.slice().sort((a, b) => a - b);
    let ymin = sorted[0], ymax = sorted[sorted.length - 1];
    const q = (p) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))))];
    const q1 = q(0.03), q2 = q(0.97);
    if (ymax - ymin > 20 * Math.max(q2 - q1, 1e-9)) { ymin = q1; ymax = q2; } // 急に大きくなる所は、見える範囲を絞ります
    if (ymax - ymin < 1e-9) { ymin -= 1; ymax += 1; }
    const pad = (ymax - ymin) * 0.08; ymin -= pad; ymax += pad;
    const sx = x => ml + (x - lof) / (hif - lof) * (W - ml - mr);
    const sy = y => mt + (ymax - y) / (ymax - ymin) * (H - mt - mb);
    mk("rect", { x: ml, y: mt, width: W - ml - mr, height: H - mt - mb, fill: "#111827", stroke: "#374151" });
    const xs = calcNiceStep(hif - lof, 5), ysp = calcNiceStep(ymax - ymin, 5);
    for (let t = Math.ceil(lof / xs) * xs; t <= hif + 1e-9; t += xs) {
        const X = sx(t);
        mk("line", { x1: X, y1: mt, x2: X, y2: H - mb, stroke: "#374151", "stroke-width": 1 });
        mk("text", { x: X, y: H - 8, "text-anchor": "middle", fill: "#9ca3af", "font-size": 12.5 }, calcTickText(t));
    }
    for (let t = Math.ceil(ymin / ysp) * ysp; t <= ymax + 1e-9; t += ysp) {
        const Y = sy(t);
        mk("line", { x1: ml, y1: Y, x2: W - mr, y2: Y, stroke: "#374151", "stroke-width": 1 });
        mk("text", { x: ml - 4, y: Y + 4, "text-anchor": "end", fill: "#9ca3af", "font-size": 12.5 }, calcTickText(t));
    }
    if (lof <= 0 && hif >= 0) mk("line", { x1: sx(0), y1: mt, x2: sx(0), y2: H - mb, stroke: "#9ca3af", "stroke-width": 1.5 });
    if (ymin <= 0 && ymax >= 0) mk("line", { x1: ml, y1: sy(0), x2: W - mr, y2: sy(0), stroke: "#9ca3af", "stroke-width": 1.5 });
    let d = "", pen = false;
    pts.forEach(([x, y]) => {
        if (y === null || y < ymin - (ymax - ymin) * 3 || y > ymax + (ymax - ymin) * 3) { pen = false; return; }
        d += (pen ? "L" : "M") + sx(x).toFixed(1) + " " + sy(Math.max(ymin - pad, Math.min(ymax + pad, y))).toFixed(1) + " ";
        pen = true;
    });
    mk("path", { d, fill: "none", stroke: "#38bdf8", "stroke-width": 2.4, "stroke-linejoin": "round", "clip-path": "url(#cgClip)" });
    const defs = document.createElementNS(SVGNS, "defs"), cp = document.createElementNS(SVGNS, "clipPath");
    cp.setAttribute("id", "cgClip");
    const cr = document.createElementNS(SVGNS, "rect");
    cr.setAttribute("x", ml); cr.setAttribute("y", mt); cr.setAttribute("width", W - ml - mr); cr.setAttribute("height", H - mt - mb);
    cp.appendChild(cr); defs.appendChild(cp); svg.insertBefore(defs, svg.firstChild);
    const dot = mk("circle", { r: 5, fill: "#fbbf24", stroke: "#111827", "stroke-width": 1.5, visibility: "hidden" });
    // なぞった所の値
    const read = ev => {
        const r = svg.getBoundingClientRect();
        const px = (ev.clientX - r.left) / r.width * W;
        const x = lof + Math.max(0, Math.min(1, (px - ml) / (W - ml - mr))) * (hif - lof);
        const V = calcGraphEval(g, calcF(x));
        let y = null;
        if (V) { try { y = calcToFloat(V); } catch (er) { y = null; } }
        const xt = calcFmt(x), rd = $id("cgRead");
        if (y === null || !isFinite(y)) { dot.setAttribute("visibility", "hidden"); rd.textContent = g.u + " ＝ " + xt + " では、値がありません"; return; }
        rd.textContent = g.u + " ＝ " + xt + "　y ＝ " + calcFmt(y);
        if (y >= ymin && y <= ymax) { dot.setAttribute("cx", sx(x)); dot.setAttribute("cy", sy(y)); dot.setAttribute("visibility", "visible"); }
        else dot.setAttribute("visibility", "hidden");
    };
    svg.onpointermove = read;
    svg.onpointerdown = read;
}
function calcGraphWire(p) {
    ["cgLo", "cgHi", "cgStep"].forEach(id => {
        const el = p.querySelector("#" + id);
        el.addEventListener("input", () => { clearTimeout(calcGraphTimer); calcGraphTimer = setTimeout(calcGraphDraw, 120); });
        el.addEventListener("keydown", ev => { ev.stopPropagation(); if (ev.key === "Escape") { calcGraphClose(); ev.preventDefault(); } });
    });
    p.querySelector('[data-gk="back"]').addEventListener("click", calcGraphClose);
}

function calcBuild() {
    let p = $id("calcPanel");
    if (p) return p;
    p = document.createElement("div");
    p.id = "calcPanel";
    p.hidden = true;
    p.tabIndex = -1;
    p.setAttribute("role", "dialog");
    p.setAttribute("aria-label", "電卓");
    const btn = (k, label, aria, cls) => `<button type="button" data-ck="${k}" class="${cls || ""}"${aria ? ` aria-label="${aria}"` : ""}>${label}</button>`;
    p.innerHTML =
        `<div class="calc-head" id="calcHead"><span class="calc-grip" aria-hidden="true">⠿</span>` +
        `<div class="calc-modes" role="group" aria-label="電卓の種類"><button type="button" data-cmode="basic" data-ck="mode">電卓</button><button type="button" data-cmode="sci" data-ck="mode">関数電卓</button></div>` +
        btn("close", "✕", "電卓を閉じる", "calc-mini") + `</div>` +
        `<div class="calc-toolrow">` + btn("undo", "元に戻す", "一つ前にもどす", "calc-tool") + btn("redo", "やり直し", "もどした操作をやり直す", "calc-tool") + btn("hist", "履歴", "計算の履歴を開く", "calc-tool") + btn("menu", "メニュー", "分数、文字式、メモリの機能メニューを開く", "calc-tool calc-menubtn") + `</div>` +
        `<div class="calc-hist" id="calcHist" hidden></div>` +
        `<button type="button" data-ck="histclear" class="calc-hist-clear" hidden>履歴を消す</button>` +
        `<div class="calc-screen"><div class="calc-expr" id="calcExpr">　</div><div class="calc-result" id="calcResult" aria-live="polite">0</div><div class="calc-sub" id="calcSub">　</div></div>` +
        `<div class="calc-sol" id="calcSol" hidden></div>` +
        `<div class="calc-graph" id="calcGraph" hidden><div class="cg-title"><span class="cg-y">y ＝</span><span class="cg-expr" id="cgExpr"></span></div>` +
        `<div class="cg-range"><b id="cgU">x</b><span>を</span><input id="cgLo" type="text" inputmode="decimal" aria-label="はじめの値"><span>から</span><input id="cgHi" type="text" inputmode="decimal" aria-label="おわりの値"><span>まで</span><input id="cgStep" type="text" inputmode="decimal" aria-label="きざみ"><span>ずつ</span></div>` +
        `<div class="cg-msg" id="cgMsg" role="status"></div><svg class="cg-svg" id="cgSvg" role="img" aria-label="グラフ"></svg><div class="cg-read" id="cgRead" aria-live="polite">グラフの上をなぞると値が出ます</div>` +
        `<div class="cg-table" id="cgTable"></div><button type="button" data-gk="back" class="cg-back">電卓にもどる</button></div>` +
        `<div class="calc-menu" id="calcMenu" hidden>` +
        `<div class="calc-fracrow">` + btn("frac", "分数 ⁄", "分数の枠を出す。分子を入れたら、もう一度押すと分母に移る", "calc-frac") + btn("mixed", "帯分数", "整数の後に分数の枠を出す", "calc-frac") + btn("nest", "入れ子", "今入力中の枠の中に分数の枠を出す。分数の中の分数を作る", "calc-frac") + btn("out", "出る", "分数の枠から出る。入れ子の分数では一つ外の枠に出る", "calc-frac") + btn("view", "表示 小数", "答えの表示を切り替える", "calc-frac calc-view") + `</div>` +
        `<div class="calc-algrow">` + btn("expand", "展開", "文字式を展開した形で答えを出す", "calc-alg ca-2") + btn("factor", "因数分解", "因数分解した形で答えを出す", "calc-alg ca-2") + btn("equ", "等号 ＝", "方程式の等号を入れる", "calc-alg ca-2") + btn("solve", "方程式を解く", "方程式を解く。等号がなければ、式＝0 として解く", "calc-alg ca-3") + btn("graph", "表とグラフ", "式の文字を動かして、値の表とグラフを出す", "calc-alg ca-3") + btn("sys", "連立方程式", "1本目の式を入れて押し、2本目の式を入れてもう一度押すと、xとyを解く", "calc-alg ca-6") + `</div>` +
        `<div class="calc-memrow"><span class="calc-memmark" id="calcMemMark" hidden>M</span>` +
        btn("mc", "MC", "メモリを消す", "calc-mem") + btn("mr", "MR", "メモリの数を入れる", "calc-mem") + btn("mp", "M+", "メモリに足す", "calc-mem") + btn("mm", "M−", "メモリから引く", "calc-mem") +
        btn("copy", "コピー", "答えをコピーする", "calc-mem calc-copy") + btn("ring", "鳴らす", "答えの数字を電話のボタンの音で鳴らす。小数点はほし、マイナスはシャープの音です", "calc-mem calc-ring") + `</div>` +
        `<div class="calc-vars">` + CALC_VAR_NAMES.map(n => `<div class="cv-cell">` + btn("v" + n, n, n + " を式に入れる", "cv-key") + `<div class="cv-row">` + btn("s" + n, "値を入れる", n + " の値を入れる", "cv-val") + btn("d" + n, "🗑️", n + " の値を消す", "cv-del") + `</div></div>`).join("") + `</div>` + `</div>` +
        `<div class="calc-phone" id="calcPhone" hidden>` + CALC_PHONE_KEYS.map(a => `<button type="button" class="ph-key" data-ph="${a[0]}" aria-label="${a[0] === "*" ? "ほし" : a[0] === "#" ? "シャープ" : a[0]}"><b>${a[0]}</b><small>${a[1]}</small></button>`).join("") +
        `<button type="button" class="ph-fn" data-phfn="bs" aria-label="一つ消す">⌫</button><button type="button" class="ph-fn ph-wide" data-phfn="play" aria-label="押した順に鳴らす">順に鳴らす</button><button type="button" class="ph-fn" data-phfn="clear" aria-label="全部消す">C</button>` +
        `<button type="button" class="ph-fn ph-back" data-phfn="exit">電卓にもどる</button></div>` +
        `<div class="calc-sci">` + CALC_KEYS_SCI.map(a => btn(a[0], a[1], a[2], "ck-sci " + (a[3] || ""))).join("") + `</div>` +
        `<div class="calc-main">` + CALC_KEYS_MAIN.map(a => btn(a[0], a[1], a[2], a[3] || "ck-num")).join("") + `</div>`;
    p.addEventListener("mousedown", ev => { if (ev.target.closest("button")) ev.preventDefault(); });
    calcPhoneWire(p);
    calcGraphWire(p);
    p.addEventListener("click", ev => {
        if (calc.menu && !ev.target.closest(".calc-menu, [data-ck=\"menu\"]")) calcMenuSet(false);
        const fs = ev.target.closest("[data-fslot]");
        if (fs) { calcFracGoto(fs.dataset.fslot); return; } // 枠を直接押して、入れる所を選ぶ
        const h = ev.target.closest(".calc-hist-item, .calc-sol-item");
        if (h) { const snap = calcSnap("hist"); calc.view = "auto"; calcNewIfDone(); calc.expr += h.dataset.val; if (!calc.assign && !calcSnapSame(snap)) { calc.undo.push(snap); calc.redo = []; if (calc.undo.length > 100) calc.undo.shift(); } calcRender(); return; }
        const b = ev.target.closest("button[data-ck]");
        if (!b) return;
        if (b.dataset.cmode) { calc.sci = b.dataset.cmode === "sci"; lsSet("calc_mode", calc.sci ? "sci" : "basic"); calcRender(); calcClamp(); return; }
        calcPress(b.dataset.ck);
    });
    // 見出しをつかんで動かす
    const head = p.querySelector("#calcHead");
    let drag = null;
    head.addEventListener("pointerdown", ev => {
        if (ev.target.closest("button")) return;
        const r = p.getBoundingClientRect();
        drag = { dx: ev.clientX - r.left, dy: ev.clientY - r.top };
        try { head.setPointerCapture(ev.pointerId); } catch (e) { /* 何もしない */ }
        ev.preventDefault();
    });
    head.addEventListener("pointermove", ev => {
        if (!drag) return;
        p.style.left = Math.round(ev.clientX - drag.dx) + "px";
        p.style.top = Math.round(ev.clientY - drag.dy) + "px";
        p.style.right = "auto"; p.style.bottom = "auto";
        calcClamp();
    });
    const endDrag = () => {
        if (!drag) return;
        drag = null;
        lsSet("calc_pos", JSON.stringify({ l: parseInt(p.style.left, 10), t: parseInt(p.style.top, 10) }));
    };
    head.addEventListener("pointerup", endDrag);
    head.addEventListener("pointercancel", endDrag);
    document.body.appendChild(p);
    return p;
}
// 窓が画面の外に出てしまわないようにする
function calcClamp() {
    const p = $id("calcPanel");
    if (!p || p.hidden || p.style.left === "") return;
    const r = p.getBoundingClientRect();
    const vw = document.documentElement.clientWidth, vh = window.innerHeight;
    let l = parseInt(p.style.left, 10), t = parseInt(p.style.top, 10);
    if (isNaN(l) || isNaN(t)) return;
    l = Math.max(60 - r.width, Math.min(l, vw - 60));
    t = Math.max(0, Math.min(t, vh - 40));
    p.style.left = l + "px"; p.style.top = t + "px";
}
function openCalculator() {
    if (isAppLocked()) { showLockedToast(); return; }
    const p = calcBuild();
    calc.open = true;
    p.hidden = false;
    calcMenuSet(false);
    try {
        const pos = JSON.parse(lsGet("calc_pos", "null"));
        if (pos && typeof pos.l === "number" && typeof pos.t === "number") { p.style.left = pos.l + "px"; p.style.top = pos.t + "px"; p.style.right = "auto"; p.style.bottom = "auto"; }
    } catch (e) { /* 何もしない */ }
    calcRender();
    calcClamp();
    const b = $id("calcOpenBtn");
    if (b) { b.classList.add("is-on"); b.setAttribute("aria-expanded", "true"); }
    try { p.focus({ preventScroll: true }); } catch (e) { /* 何もしない */ }
}
function closeCalculator() {
    const p = $id("calcPanel");
    if (calc.assign) calcAssignCancel(true);
    if (calc.phone) calcPhoneExit();
    if (calc.graph) calcGraphClose();
    if (p) p.hidden = true;
    calc.open = false;
    const b = $id("calcOpenBtn");
    if (b) { b.classList.remove("is-on"); b.setAttribute("aria-expanded", "false"); }
    if (p && document.activeElement && p.contains(document.activeElement)) { try { document.activeElement.blur(); } catch (e) { /* 何もしない */ } }
}
function toggleCalculator() { if (calc.open) closeCalculator(); else openCalculator(); }
function onCalcBtnToggle() {
    const t = $id("calcBtnToggle");
    if (!t) return;
    lsSet("calc_btn", t.checked ? "1" : "0");
    document.body.classList.toggle("calc-btn-off", !t.checked);
}
function setupCalculator() {
    calc.sci = lsGet("calc_mode", "basic") === "sci";
    calcVarsLoad();
    calc.deg = lsGet("calc_deg", "1") !== "0";
    const on = lsGet("calc_btn", "1") !== "0";
    const t = $id("calcBtnToggle");
    if (t) t.checked = on;
    document.body.classList.toggle("calc-btn-off", !on);
    const keyMap = { "*": "*", "/": "/", "+": "+", "-": "-", "^": "^", "(": "(", ")": ")", "!": "fact", "%": "%", ".": ".", ",": "." };
    document.addEventListener("keydown", ev => {
        if (!calc.open) return;
        const p = $id("calcPanel");
        const a = document.activeElement;
        if (!p || !(a === document.body || p.contains(a))) return;
        if (calc.graph) { if (ev.key === "Escape") { calcGraphClose(); ev.preventDefault(); } return; }
        if ((ev.ctrlKey || ev.metaKey) && !ev.altKey && (ev.key === "z" || ev.key === "Z" || ev.key === "y" || ev.key === "Y")) {
            ev.preventDefault();
            if (!calc.phone) { if (ev.key === "y" || ev.key === "Y" || ev.shiftKey) calcRedo(); else calcUndo(); }
            return;
        }
        if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
        const onBtn = a && a.tagName === "BUTTON" && p.contains(a);
        if (calc.phone) {
            if (ev.key === "Escape") { calcPhoneExit(); ev.preventDefault(); return; }
            if (ev.key === "Backspace") { calcPhoneFn("bs"); ev.preventDefault(); return; }
            if (/^[0-9*#]$/.test(ev.key)) { ev.preventDefault(); if (!ev.repeat) calcPhoneDown(ev.key); }
            return;
        }
        if (ev.key === "Escape") { if (calc.assign) calcAssignCancel(); else closeCalculator(); ev.preventDefault(); return; }
        if (ev.key === "ArrowUp" || ev.key === "ArrowLeft" || ev.key === "ArrowDown" || ev.key === "ArrowRight") {
            let moved = false;
            if (!onBtn) {
                if (ev.key === "ArrowUp") moved = calcFracMove(true);
                else if (ev.key === "ArrowDown") moved = calcFracMove(false);
                else moved = calcFracStep(ev.key === "ArrowRight");
            }
            if (moved) ev.preventDefault();
            return;
        }
        let k = null;
        if (/^\d$/.test(ev.key)) k = ev.key;
        else if (keyMap[ev.key]) k = keyMap[ev.key];
        else if (ev.key === "Enter" || ev.key === "=") { if (onBtn && ev.key === "Enter") return; k = "eq"; }
        else if (ev.key === "Backspace") k = "bs";
        else if (ev.key === "Delete" || ev.key === "c" || ev.key === "C") k = "clear";
        else if (ev.key === "p" || ev.key === "P") k = "pi";
        else if (/^[xyabXYAB]$/.test(ev.key)) k = "v" + ev.key.toLowerCase();
        else if (ev.key === "f" || ev.key === "F") k = "frac";
        if (!k) return;
        ev.preventDefault();
        calcPress(k);
    });
    document.addEventListener("keyup", ev => { if (calc.phone && /^[0-9*#]$/.test(ev.key)) calcPhoneUp(); });
    window.addEventListener("resize", () => calcClamp());
}

// ==========================================
// 電卓の隠し機能：電話のプッシュ音（DTMF）が鳴るキーパッド
// 電卓で 0 0 5 1 を入れて = を押すと切り替わります。もどるときは「電卓にもどる」
// ==========================================
const CALC_PHONE_KEYS = [["1", ""], ["2", "ABC"], ["3", "DEF"], ["4", "GHI"], ["5", "JKL"], ["6", "MNO"], ["7", "PQRS"], ["8", "TUV"], ["9", "WXYZ"], ["*", ""], ["0", "+"], ["#", ""]];
const CALC_DTMF_ROW = [697, 770, 852, 941];
const CALC_DTMF_COL = [1209, 1336, 1477];
const CALC_DTMF_POS = { "1": [0, 0], "2": [0, 1], "3": [0, 2], "4": [1, 0], "5": [1, 1], "6": [1, 2], "7": [2, 0], "8": [2, 1], "9": [2, 2], "*": [3, 0], "0": [3, 1], "#": [3, 2] };
let calcToneNow = null, calcPlayTimer = null;

// 低い音と高い音を同時に鳴らすと、電話のプッシュ音になります。start/dur を渡すと、決まった長さで鳴らします
function calcToneAt(ch, start, dur) {
    const pos = CALC_DTMF_POS[ch];
    if (!pos || !audioCtx) return null;
    const bus = getAudioBus();
    if (!bus) return null;
    const vol = alarmVolume * 0.4;
    if (vol <= 0) return null;
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(vol, start + 0.006);
    const o1 = audioCtx.createOscillator(), o2 = audioCtx.createOscillator();
    o1.type = o2.type = "sine";
    o1.frequency.value = CALC_DTMF_ROW[pos[0]];
    o2.frequency.value = CALC_DTMF_COL[pos[1]];
    o1.connect(g); o2.connect(g); g.connect(bus.dry);
    o1.start(start); o2.start(start);
    const tone = { g, o1, o2, t0: start };
    if (dur) calcToneRelease(tone, start + dur);
    return tone;
}
function calcToneRelease(tone, at) {
    const end = Math.max(at, audioCtx.currentTime);
    try {
        tone.g.gain.setValueAtTime(Math.max(tone.g.gain.value, 0.0001), end);
        tone.g.gain.linearRampToValueAtTime(0.0001, end + 0.02);
        tone.o1.stop(end + 0.03); tone.o2.stop(end + 0.03);
    } catch (e) { /* 何もしない */ }
}
function calcPhoneDown(ch) {
    if (!CALC_DTMF_POS[ch]) return;
    initAudio();
    if (calcToneNow) calcPhoneUp(true);
    if (audioCtx) calcToneNow = calcToneAt(ch, audioCtx.currentTime, 0);
    if (calc.phoneDigits.length < 24) calc.phoneDigits += ch;
    const b = document.querySelector('#calcPhone [data-ph="' + ch.replace(/["\\]/g, "") + '"]');
    if (b) b.classList.add("is-down");
    calcRender();
}
function calcPhoneUp(now) {
    document.querySelectorAll("#calcPhone .is-down").forEach(b => b.classList.remove("is-down"));
    if (!calcToneNow) return;
    calcToneRelease(calcToneNow, now ? audioCtx.currentTime : calcToneNow.t0 + 0.12); // 短く押しても、聞こえる長さは鳴らす
    calcToneNow = null;
}
function calcPhoneFn(fn) {
    if (fn === "exit") { calcPhoneExit(); return; }
    if (fn === "bs") { calc.phoneDigits = calc.phoneDigits.slice(0, -1); calcRender(); return; }
    if (fn === "clear") { calc.phoneDigits = ""; calcPhoneStopPlay(); calcRender(); return; }
    if (fn === "play") {
        if (calcPlayTimer) { calcPhoneStopPlay(); return; }
        const digits = calc.phoneDigits;
        if (!digits) return;
        initAudio();
        if (!audioCtx) return;
        const t0 = audioCtx.currentTime + 0.05;
        const step = 0.26;
        Array.from(digits).forEach((ch, i) => calcToneAt(ch, t0 + i * step, 0.16));
        const btn = document.querySelector('#calcPhone [data-phfn="play"]');
        if (btn) btn.textContent = "⏹ とめる";
        calcPlayTimer = setTimeout(calcPhoneStopPlay, digits.length * step * 1000 + 200);
    }
}
function calcPhoneStopPlay() {
    if (calcPlayTimer) { clearTimeout(calcPlayTimer); calcPlayTimer = null; }
    const btn = document.querySelector('#calcPhone [data-phfn="play"]');
    if (btn) btn.textContent = "順に鳴らす";
}
function calcPhoneWire(p) {
    const pad = p.querySelector("#calcPhone");
    pad.addEventListener("pointerdown", ev => {
        const b = ev.target.closest("[data-ph]");
        if (!b) return;
        ev.preventDefault();
        calcPhoneDown(b.dataset.ph);
    });
    ["pointerup", "pointercancel", "pointerleave"].forEach(t => pad.addEventListener(t, ev => { if (ev.target.closest && ev.target.closest("[data-ph]") || t !== "pointerleave") calcPhoneUp(); }));
    pad.addEventListener("click", ev => { const f = ev.target.closest("[data-phfn]"); if (f) { ev.stopPropagation(); calcPhoneFn(f.dataset.phfn); } });
    pad.addEventListener("keydown", ev => { // ボタンにフォーカスがあっても、Enterとスペースで鳴らせます
        const b = ev.target.closest("[data-ph]");
        if (b && (ev.key === "Enter" || ev.key === " ") && !ev.repeat) { ev.preventDefault(); ev.stopPropagation(); calcPhoneDown(b.dataset.ph); }
    });
    pad.addEventListener("keyup", ev => { if (ev.target.closest("[data-ph]") && (ev.key === "Enter" || ev.key === " ")) calcPhoneUp(); });
}
function calcPhoneEnter() {
    calc.phone = true;
    calc.phoneDigits = "";
    calc.histOpen = false;
    calc.expr = ""; calc.done = false; calc.err = false;
    const p = $id("calcPanel");
    if (p) p.dataset.phone = "1";
    const ph = $id("calcPhone");
    if (ph) ph.hidden = false;
    initAudio();
    if (audioCtx) { const t = audioCtx.currentTime + 0.02; Array.from("0051").forEach((ch, i) => calcToneAt(ch, t + i * 0.2, 0.12)); }
    calcRender();
}
function calcPhoneExit() {
    calcPhoneUp(true);
    calcPhoneStopPlay();
    calc.phone = false;
    calc.phoneDigits = "";
    const p = $id("calcPanel");
    if (p) p.dataset.phone = "0";
    const ph = $id("calcPhone");
    if (ph) ph.hidden = true;
    calcRender();
}
function calcPhoneRender() {
    const exprEl = $id("calcExpr"), resEl = $id("calcResult"), subEl = $id("calcSub");
    if (exprEl) exprEl.textContent = "📞 プッシュ音キーパッド";
    const d = calc.phoneDigits;
    if (resEl) {
        resEl.textContent = d || "　";
        resEl.classList.remove("is-err", "has-frac");
        resEl.style.fontSize = d.length > 14 ? "20px" : d.length > 10 ? "26px" : "";
    }
    if (subEl) subEl.textContent = "　";
}

// ---- 本体への登録 ----
// mount：画面の部品（ボタン・設定・説明）を、本体の決まった場所に入れます。本体の設定画面ができる前に呼ばれます
// ready：本体の準備ができた後に呼ばれます
SekigaeApp.registerPlugin({
    id: "calc",
    name: "電卓",
    version: "1.0",
    description: "画面の左に電卓のボタンを出します。関数電卓、分数、連立方程式、表とグラフも使えます。",
    backupKeys: ["calc_mode", "calc_deg", "calc_btn", "calc_vars"],
    searchWords: "電卓 関数電卓 計算",
    mount(app) {
        const cfg = $id("configMenuBtn");
        if (cfg) cfg.insertAdjacentHTML("afterend", CALC_PLUGIN_HTML.button);
        app.insertInto("settings-display", CALC_PLUGIN_HTML.setting);
        app.insertInto("guide-tools", "<details><summary>電卓</summary><ul>" + CALC_PLUGIN_HTML.guide.map(x => "\n" + x).join("") + "\n</ul></details>", "beforebegin");
        app.insertInto("guide-faq", CALC_PLUGIN_HTML.faq);
    },
    ready() { setupCalculator(); }
});
