/* KO SPORT — برامج التدريب (حسابي ← برامج تدريب)
 * صاحب المتجر (17 تشرين التاني 2026): «حطلي بقسم حسابي برامج تدريب مع رسومات توضيحية متحركة للكالستنكس وكمال الأجسام والقوة البدنية والملاكمة والمصارعة».
 * الرسومات: شخصية 3D بعضلات مبنية ومحرّكة بالكود هون (canvas)، بين وضعيات (زوايا مفاصل)، بلا صور من برّا.
 * التقدّم (شو خلّص الزبون) بينحفظ عالجهاز بس (localStorage: ko_train).
 */
(function () {
  "use strict";
  const L = { torso: 26, neck: 8, ua: 14, fa: 13, th: 17, sh: 17 }, GY = 92;
  const rad = (d) => d * Math.PI / 180, V = (a, l) => [l * Math.sin(rad(a)), l * Math.cos(rad(a))], add = (p, v) => [p[0] + v[0], p[1] + v[1]];
  // زوايا مطلقة: 0 = لتحت، 90 = لقدّام (يمين)، 180 = لفوق، -90 = لورا
  const ST = { p: [60, 58], t: 180, a1: [0, 0], a2: [0, 0], l1: [0, 0], l2: [0, 0] };
  function fk(P) {
    const p = P.p, n = add(p, V(P.t, L.torso)), h = add(n, V(P.hd ?? P.t, L.neck));
    const e1 = add(n, V(P.a1[0], L.ua)), w1 = add(e1, V(P.a1[1], L.fa)), e2 = add(n, V(P.a2[0], L.ua)), w2 = add(e2, V(P.a2[1], L.fa));
    const k1 = add(p, V(P.l1[0], L.th)), f1 = add(k1, V(P.l1[1], L.sh)), k2 = add(p, V(P.l2[0], L.th)), f2 = add(k2, V(P.l2[1], L.sh));
    return { p, n, h, e1, w1, e2, w2, k1, f1, k2, f2 };
  }
  function place(J, ex) {
    let dx = 0, dy = 0; const an = ex.anchor || "ground";
    if (Array.isArray(an)) { const q = J[an[0]]; dx = an[1] - q[0]; dy = an[2] - q[1]; }
    else if (an === "ground") { dy = GY - Math.max(J.f1[1], J.f2[1], J.k1[1], J.k2[1], J.w1[1], J.w2[1], J.p[1] + 2, J.h[1] + 6); }
    if (dx || dy) for (const k in J) J[k] = [J[k][0] + dx, J[k][1] + dy];
    return J;
  }
  const mix = (A, B, u) => { const o = {}; for (const k in A) o[k] = Array.isArray(A[k]) ? A[k].map((x, i) => x + (B[k][i] - x) * u) : A[k] + ((B[k] ?? A[k]) - A[k]) * u; return o; };
  const P = (o) => ({ ...ST, ...o });

  // ---------- الوضعيات ----------
  const GUARD = P({ t: 176, a1: [35, 165], a2: [25, 168], l1: [14, 4], l2: [-16, -8] });
  const EX = {
    // كالستنكس
    pushup: { n: "ضغط (Push-up)", how: ["إيديك تحت كتافك وجسمك خط مستقيم من راسك لكعبك", "انزل لحد ما صدرك يقرب عالأرض، وارجع ادفش لفوق"], err: "لا تنزّل وسطك ولا ترفع طيزك", anchor: ["f1", 22, GY],
      poses: [P({ t: 116.7, a1: [0, 0], a2: [2, 2], l1: [-63.3, -63.3], l2: [-62, -62] }), P({ t: 100.6, hd: 106, a1: [-100, 5], a2: [-98, 7], l1: [-79.4, -79.4], l2: [-78.4, -78.4] })] },
    pullup: { n: "عقلة (Pull-up)", how: ["امسك العارضة أوسع من كتافك شوي وانزل لتحت لآخر الطريق", "اسحب حالك لحد ما دقنك يطلع فوق العارضة، ونزول بهدوء"], err: "لا تتمرجح ولا تكمّل نص حركة", anchor: ["w1", 60, 9], prop: "bar",
      poses: [P({ t: 180, a1: [180, 180], a2: [178, 178], l1: [15, -45], l2: [20, -40] }), P({ t: 172, a1: [28, 172], a2: [32, 170], l1: [25, -10], l2: [30, -6] })] },
    dips: { n: "متوازي (Dips)", how: ["اسند حالك عالمتوازي وإيديك ممدودين", "انزل لحد ما كوعك يصير زاوية 90 تقريباً، وادفش لفوق"], err: "لا تنزل كتير إذا كتفك بيوجعك", anchor: ["w1", 62, 52], prop: "dip",
      poses: [P({ t: 174, a1: [0, 0], a2: [2, 2], l1: [12, -55], l2: [16, -50] }), P({ t: 162, a1: [-62, 6], a2: [-60, 8], l1: [20, -50], l2: [24, -45] })] },
    squat: { n: "سكوات (Squat)", how: ["رجليك بعرض كتافك وإيديك لقدّام", "نزّل وسطك لورا كأنك عم تقعد على كرسي لحد ما فخدك يصير موازي للأرض، وقوم"], err: "ركبتك ما تفوت لجوا، وكعبك ما يرتفع", anchor: ["f1", 62, GY],
      poses: [P({ a1: [90, 90], a2: [88, 88] }), P({ t: 146, a1: [100, 96], a2: [98, 94], l1: [80, -12], l2: [82, -10] })] },
    plank: { n: "بلانك (Plank)", how: ["اسند على كوعك وأطراف رجليك", "شدّ بطنك وطيزك وخلّي جسمك خط مستقيم، وتنفّس بهدوء"], err: "لا ترفع وسطك ولا تنزّلو", anchor: ["f1", 22, GY], hold: true,
      poses: [P({ t: 103.5, hd: 112, a1: [0, 90], a2: [2, 92], l1: [-76.5, -76.5], l2: [-75.5, -75.5] }), P({ t: 104.5, hd: 112, a1: [0, 90], a2: [2, 92], l1: [-75.5, -75.5], l2: [-74.5, -74.5] })] },
    lunge: { n: "طعنات (Lunge)", how: ["اعمل خطوة كبيرة لقدّام ونزّل ركبتك الورانية لتقرب عالأرض", "ادفش برجلك القدّامية وارجع لوقفتك، وبدّل الرجل"], err: "ركبتك القدّامية ما تتعدّى أصابع رجلك كتير", anchor: "ground",
      poses: [P({ a1: [0, 0], a2: [3, 3] }), P({ t: 178, a1: [5, 5], a2: [8, 8], l1: [72, 0], l2: [-18, -82] })] },
    kneeraise: { n: "رفع الركب معلّق", how: ["تعلّق بالعارضة وإيديك ممدودين", "ارفع ركبك لعند صدرك ببطء ونزّلن بهدوء"], err: "لا تتمرجح، الحركة من البطن", anchor: ["w1", 60, 9], prop: "bar",
      poses: [P({ t: 180, a1: [180, 180], a2: [178, 178], l1: [12, -38], l2: [16, -32] }), P({ t: 172, a1: [180, 180], a2: [178, 178], l1: [105, 10], l2: [108, 14] })] },
    climber: { n: "متسلّق الجبال (Mountain climber)", how: ["وقفة ضغط وإيديك ممدودين", "جيب ركبة لعند صدرك ورجّعها وبدّل بسرعة"], err: "خلّي وسطك ثابت وما ترفعو", anchor: ["w1", 92, GY],
      poses: [P({ t: 116.7, a1: [0, 0], a2: [2, 2], l1: [-63.3, -63.3], l2: [40, -75] }), P({ t: 116.7, a1: [0, 0], a2: [2, 2], l1: [40, -75], l2: [-63.3, -63.3] })] },
    // كمال أجسام
    bench: { n: "بنش برس (Bench press)", how: ["انسدح عالبنش ورجليك عالأرض، وامسك البار أوسع من كتافك", "نزّل البار لعند نص صدرك ببطء، وادفشو لفوق لتمدّ إيديك"], err: "لا تنتّع البار عن صدرك، والأحسن يكون معك حدا يسندك", anchor: "none", prop: "bench", plate: "w1",
      poses: [P({ p: [44, 66], t: 90, hd: 96, a1: [180, 180], a2: [178, 178], l1: [-48, 2], l2: [-44, 4] }), P({ p: [44, 66], t: 90, hd: 96, a1: [12, 178], a2: [14, 176], l1: [-48, 2], l2: [-44, 4] })] },
    curl: { n: "بايسبس دمبل (Curl)", how: ["وقوف وإيديك جنبك والدمبل بإيدك", "اطوي كوعك وارفع الدمبل لعند كتفك، ونزّلو ببطء"], err: "كوعك ثابت جنبك، وما تتمرجح بضهرك", anchor: ["f1", 60, GY], db: ["w1"],
      poses: [P({ a1: [4, 4], a2: [8, 8] }), P({ a1: [4, 160], a2: [8, 8] })] },
    ohp: { n: "ضغط كتف دمبل (Shoulder press)", how: ["الدمبلات بمستوى كتافك", "ادفش لفوق لحد ما إيديك ينمدّو، ورجّعن بهدوء"], err: "لا تقوّس ضهرك لورا", anchor: ["f1", 60, GY], db: ["w1"],
      poses: [P({ a1: [62, 172], a2: [58, 172] }), P({ a1: [176, 178], a2: [174, 176] })] },
    row: { n: "تجديف بار (Barbell row)", how: ["انحني لقدّام وضهرك مستقيم وركبك مطويين شوي", "اسحب البار لعند بطنك وضمّ كتافك لورا، ونزّلو"], err: "ضهرك ما يتقوّس أبداً", anchor: ["f1", 62, GY], plate: "w1",
      poses: [P({ t: 112, hd: 120, a1: [0, 0], a2: [2, 2], l1: [24, -8], l2: [26, -6] }), P({ t: 112, hd: 120, a1: [-50, 15], a2: [-48, 17], l1: [24, -8], l2: [26, -6] })] },
    triceps: { n: "ترايسبس فوق الراس", how: ["امسك الدمبل بإيدينك فوق راسك", "نزّل الدمبل ورا راسك بطوي الكوع بس، وارجع مدّ"], err: "كوعك يضل لفوق وما يفتح لبرّا", anchor: ["f1", 60, GY], db: ["w1"],
      poses: [P({ a1: [172, 178], a2: [170, 176] }), P({ a1: [172, -20], a2: [170, -18] })] },
    // قوة بدنية
    bsquat: { n: "سكوات بالبار", how: ["البار على عضلات ضهرك فوق، ورجليك بعرض كتافك", "انزل لحد ما فخدك يصير موازي للأرض أو أوطى شوي، وقوم بقوة"], err: "صدرك لفوق وضهرك مستقيم", anchor: ["f1", 62, GY], plate: "n", plateOff: [-7, 3],
      poses: [P({ a1: [-40, 120], a2: [-36, 124] }), P({ t: 140, a1: [-70, 90], a2: [-66, 94], l1: [82, -14], l2: [84, -12] })] },
    deadlift: { n: "ديدلفت (Deadlift)", how: ["البار فوق نص رجلك، انحني وامسكو وضهرك مستقيم", "قوم بدفش رجليك بالأرض لحد ما توقف منتصب، ونزّلو بنفس الطريق"], err: "ضهرك ما يتقوّس، والبار يضل لازق برجليك", anchor: ["f1", 60, GY], plate: "w1",
      poses: [P({ t: 120, hd: 135, a1: [2, 2], a2: [4, 4], l1: [66, -16], l2: [68, -14] }), P({ a1: [2, 2], a2: [4, 4] })] },
    press: { n: "ضغط كتف بالبار", how: ["البار عند كتافك قدّام، قاعد أو واقف وضهرك ثابت", "ادفش البار لفوق راسك لتمدّ إيديك، ونزّلو لعند كتافك"], err: "شدّ بطنك وما ترجع بضهرك لورا", anchor: ["f1", 60, GY], plate: "w1",
      poses: [P({ a1: [28, 176], a2: [26, 174] }), P({ a1: [178, 180], a2: [176, 178] })] },
    swing: { n: "كيتل بل سوينغ", how: ["رجليك أعرض من كتافك، والكيتل بإيدينك", "انحني لورا بوسطك وبعدين ادفش وسطك لقدّام بقوة لتطلع الكيتل لمستوى صدرك"], err: "القوة من الوسط مو من الإيدين", anchor: ["f1", 62, GY], plate: "w1", plateR: 6,
      poses: [P({ t: 130, hd: 145, a1: [-22, -26], a2: [-20, -24], l1: [40, -14], l2: [42, -12] }), P({ a1: [92, 92], a2: [90, 90] })] },
    farmer: { n: "مشي المزارع", how: ["دمبل تقيل بكل إيد وكتافك لورا", "امشي بخطوات قصيرة وثابتة للمسافة المطلوبة"], err: "لا تميل لجنب، وظهرك منتصب", anchor: "ground", db: ["w1"],
      poses: [P({ a1: [2, 2], a2: [4, 4], l1: [18, 4], l2: [-16, -6] }), P({ a1: [2, 2], a2: [4, 4], l1: [-16, -6], l2: [18, 4] })] },
    // ملاكمة
    jab: { n: "جاب (Jab)", how: ["وقفة الحراسة: الإيد القدّامية قدّام وجّك والورانية عند دقنك", "ادفش الإيد القدّامية دغري لقدّام وارجعها بسرعة لوجّك"], err: "لا تنزّل الإيد التانية عن وجّك", anchor: ["f2", 46, GY], prop: "bag", fast: true,
      poses: [GUARD, P({ ...GUARD, t: 172, a1: [88, 90] })] },
    cross: { n: "كروس (Cross)", how: ["من وقفة الحراسة", "لفّ وسطك وكتفك ودوّر رجلك الورانية، واضرب بالإيد الورانية دغري"], err: "رجّع الإيد لوجّك فوراً", anchor: ["f2", 46, GY], prop: "bag", fast: true,
      poses: [GUARD, P({ ...GUARD, t: 168, a1: [40, 168], a2: [90, 92], l2: [-22, -2] })] },
    upper: { n: "أبركت (Uppercut)", how: ["نزّل حالك شوي بركبك", "ادفش من رجليك ولفّ وسطك، والإيد بتطلع من تحت لفوق"], err: "لا تنزّل إيدك كتير قبل الضربة، بيبيّن", anchor: ["f2", 46, GY], prop: "bag", fast: true,
      poses: [P({ ...GUARD, l1: [22, -2], l2: [-10, -18] }), P({ ...GUARD, t: 172, a2: [48, 175], l1: [12, 4], l2: [-16, -6] })] },
    combo: { n: "شادو 1-2 (جاب كروس)", how: ["تحرّك عالأرض بوقفة الحراسة", "جاب، رجوع، كروس، رجوع — وتنفّس مع كل ضربة"], err: "خلّي ذقنك لتحت وإيديك فوق", anchor: ["f2", 46, GY], fast: true,
      poses: [GUARD, P({ ...GUARD, t: 172, a1: [88, 90] }), GUARD, P({ ...GUARD, t: 168, a1: [40, 168], a2: [90, 92], l2: [-22, -2] })] },
    rope: { n: "نط حبل", how: ["إيديك جنب وسطك والحبل ورا رجليك", "دوّر الحبل من رسغك ونطّ نطّات صغيرة على أطراف رجليك"], err: "لا تنطّ عالي، نطّة صغيرة بتكفي", anchor: "none", prop: "rope", fast: true,
      poses: [P({ p: [60, 54], a1: [20, 55], a2: [24, 58], l1: [4, -4], l2: [6, -2] }), P({ p: [60, 58], a1: [20, 55], a2: [24, 58], l1: [2, 0], l2: [4, 2] })] },
    // مصارعة
    sprawl: { n: "سبرول (Sprawl)", how: ["من الوقفة، ارمي رجليك لورا بسرعة", "نزّل وسطك عالأرض وإيديك قدّام، وارجع وقّف"], err: "وسطك يلزق بالأرض مو ركبك", anchor: "ground",
      poses: [P({ t: 160, hd: 170, a1: [40, 0], a2: [42, 2], l1: [40, -20], l2: [44, -16] }), P({ t: 97, hd: 115, a1: [-30, 20], a2: [-28, 22], l1: [-84, -86], l2: [-83, -85] })] },
    shot: { n: "دخلة الرجلين (Double-leg)", how: ["من الوقفة، انزل بمستواك وخطوة كبيرة لقدّام", "ركبتك القدّامية بتقرب عالأرض وإيديك بتلفّ ورا ركب الخصم"], err: "راسك لفوق وضهرك مستقيم", anchor: ["f2", 34, GY],
      poses: [P({ t: 160, hd: 170, a1: [50, 120], a2: [48, 118], l1: [30, -8], l2: [-12, -18] }), P({ t: 122, hd: 140, a1: [92, 70], a2: [90, 68], l1: [64, -2], l2: [-30, -86] })] },
    bridge: { n: "جسر الوسط (Hip bridge)", how: ["انسدح على ضهرك وركبك مطويين", "ارفع وسطك لفوق لحد ما يصير جسمك خط من كتافك لركبك، ونزّل"], err: "الضغط من طيزك مو من ضهرك", anchor: ["n", 84, GY - 1],
      poses: [P({ t: 90, hd: 94, a1: [-90, -90], a2: [-88, -88], l1: [-140, 2], l2: [-136, 4] }), P({ t: 70, hd: 88, a1: [-92, -90], a2: [-90, -88], l1: [-118, 8], l2: [-114, 10] })] },
    jsquat: { n: "سكوات بالنط", how: ["انزل سكوات", "انطّ لفوق بكل قوتك، وانزل بهدوء على ركبك المطويين"], err: "انزل على أطراف رجليك وركبك مطويين", anchor: "none",
      poses: [P({ p: [52, 72], t: 146, a1: [-30, -30], a2: [-28, -28], l1: [80, -12], l2: [82, -10] }), P({ p: [60, 50], a1: [170, 175], a2: [168, 172] })] },
  };
  EX.bsquat.plateR = 7;

  // ---------- البرامج ----------
  const S = (k, sets, rep, rest) => ({ k, sets, rep, rest });
  const PROGS = [
    { k: "cal", n: "كالستنكس", ic: "🤸", q: "عقلة", desc: "تمارين بوزن جسمك: بتبني قوة وتحكّم، وبتنعمل بالبيت أو بالحديقة.",
      lv: [
        { n: "مبتدئ", w: "3 أيام بالأسبوع (يوم ويوم لأ)", days: [
          { n: "اليوم 1 — الجسم كلو", ex: [S("squat", 3, "12", "60 ثانية"), S("pushup", 3, "6–10", "90 ثانية"), S("lunge", 3, "8 لكل رجل", "60 ثانية"), S("plank", 3, "20–30 ثانية", "45 ثانية")] },
          { n: "اليوم 2 — سحب وبطن", ex: [S("pullup", 4, "3–5 (أو تعلّق 20 ثانية)", "2 دقيقة"), S("kneeraise", 3, "8", "60 ثانية"), S("climber", 3, "20 ثانية", "45 ثانية")] },
          { n: "اليوم 3 — دفش ورجلين", ex: [S("dips", 3, "4–8", "90 ثانية"), S("squat", 3, "15", "60 ثانية"), S("pushup", 3, "8–12", "90 ثانية"), S("plank", 2, "30 ثانية", "45 ثانية")] }] },
        { n: "متوسط", w: "4 أيام بالأسبوع", days: [
          { n: "دفش", ex: [S("pushup", 4, "15–20", "90 ثانية"), S("dips", 4, "8–12", "2 دقيقة"), S("plank", 3, "45 ثانية", "45 ثانية")] },
          { n: "سحب", ex: [S("pullup", 5, "6–8", "2 دقيقة"), S("kneeraise", 4, "12", "60 ثانية")] },
          { n: "رجلين", ex: [S("squat", 4, "20", "60 ثانية"), S("lunge", 4, "12 لكل رجل", "60 ثانية"), S("jsquat", 3, "10", "90 ثانية")] },
          { n: "الجسم كلو", ex: [S("pullup", 3, "أقصى عدد", "2 دقيقة"), S("pushup", 3, "أقصى عدد", "90 ثانية"), S("climber", 4, "30 ثانية", "30 ثانية")] }] },
        { n: "متقدّم", w: "5 أيام بالأسبوع", days: [
          { n: "دفش تقيل", ex: [S("dips", 5, "12–15", "2 دقيقة"), S("pushup", 5, "25", "90 ثانية")] },
          { n: "سحب تقيل", ex: [S("pullup", 6, "10–12", "2 دقيقة"), S("kneeraise", 4, "15", "60 ثانية")] },
          { n: "رجلين", ex: [S("jsquat", 5, "12", "90 ثانية"), S("lunge", 4, "15 لكل رجل", "60 ثانية"), S("squat", 3, "30", "60 ثانية")] },
          { n: "تحمّل", ex: [S("climber", 6, "40 ثانية", "20 ثانية"), S("pushup", 4, "20", "60 ثانية"), S("plank", 3, "60 ثانية", "45 ثانية")] },
          { n: "الجسم كلو", ex: [S("pullup", 4, "أقصى عدد", "2 دقيقة"), S("dips", 4, "أقصى عدد", "2 دقيقة"), S("squat", 4, "25", "60 ثانية")] }] }] },
    { k: "bb", n: "كمال أجسام", ic: "💪", q: "دمبل", desc: "تضخيم وتنشيف العضلات بالأوزان، مع تقسيم للعضلات على أيام الأسبوع.",
      lv: [
        { n: "مبتدئ", w: "3 أيام (الجسم كلو)", days: [
          { n: "اليوم 1", ex: [S("squat", 3, "12", "90 ثانية"), S("bench", 3, "10", "2 دقيقة"), S("row", 3, "10", "90 ثانية"), S("curl", 2, "12", "60 ثانية")] },
          { n: "اليوم 2", ex: [S("deadlift", 3, "8", "2 دقيقة"), S("ohp", 3, "10", "90 ثانية"), S("triceps", 2, "12", "60 ثانية"), S("plank", 3, "30 ثانية", "45 ثانية")] },
          { n: "اليوم 3", ex: [S("lunge", 3, "10 لكل رجل", "90 ثانية"), S("bench", 3, "10", "2 دقيقة"), S("row", 3, "10", "90 ثانية"), S("curl", 2, "12", "60 ثانية")] }] },
        { n: "متوسط", w: "4 أيام (فوق/تحت)", days: [
          { n: "فوق A", ex: [S("bench", 4, "8", "2 دقيقة"), S("row", 4, "8", "2 دقيقة"), S("ohp", 3, "10", "90 ثانية"), S("curl", 3, "12", "60 ثانية")] },
          { n: "تحت A", ex: [S("bsquat", 4, "8", "2–3 دقايق"), S("lunge", 3, "12 لكل رجل", "90 ثانية"), S("plank", 3, "45 ثانية", "45 ثانية")] },
          { n: "فوق B", ex: [S("ohp", 4, "8", "2 دقيقة"), S("pullup", 4, "6–8", "2 دقيقة"), S("triceps", 3, "12", "60 ثانية"), S("dips", 3, "10", "90 ثانية")] },
          { n: "تحت B", ex: [S("deadlift", 4, "6", "3 دقايق"), S("squat", 3, "15", "90 ثانية"), S("kneeraise", 3, "12", "60 ثانية")] }] },
        { n: "متقدّم", w: "5 أيام (تقسيم عضلات)", days: [
          { n: "صدر", ex: [S("bench", 5, "6–10", "2 دقيقة"), S("dips", 4, "10–12", "90 ثانية"), S("pushup", 3, "أقصى عدد", "60 ثانية")] },
          { n: "ضهر", ex: [S("deadlift", 4, "5", "3 دقايق"), S("row", 4, "8–10", "2 دقيقة"), S("pullup", 4, "8–10", "2 دقيقة")] },
          { n: "رجلين", ex: [S("bsquat", 5, "6–10", "3 دقايق"), S("lunge", 4, "12 لكل رجل", "90 ثانية")] },
          { n: "كتاف", ex: [S("ohp", 5, "8–10", "2 دقيقة"), S("press", 3, "8", "2 دقيقة")] },
          { n: "إيدين وبطن", ex: [S("curl", 4, "10–12", "60 ثانية"), S("triceps", 4, "10–12", "60 ثانية"), S("kneeraise", 4, "15", "60 ثانية")] }] }] },
    { k: "str", n: "القوة البدنية", ic: "🏋️", q: "بار", desc: "قوة حقيقية بالتمارين الكبيرة: تكرارات قليلة وأوزان تقيلة وراحة أطول.",
      lv: [
        { n: "مبتدئ", w: "3 أيام (A / B بالتناوب)", days: [
          { n: "تمرين A", ex: [S("bsquat", 3, "5", "3 دقايق"), S("bench", 3, "5", "3 دقايق"), S("row", 3, "5", "2 دقيقة")] },
          { n: "تمرين B", ex: [S("bsquat", 3, "5", "3 دقايق"), S("press", 3, "5", "3 دقايق"), S("deadlift", 1, "5", "—")] },
          { n: "ملاحظة", note: "زيد الوزن 2.5 كيلو كل تمرين إذا خلّصت كل التكرارات بتكنيك صح." }] },
        { n: "متوسط", w: "4 أيام", days: [
          { n: "سكوات", ex: [S("bsquat", 5, "5", "3 دقايق"), S("lunge", 3, "8 لكل رجل", "2 دقيقة")] },
          { n: "بنش", ex: [S("bench", 5, "5", "3 دقايق"), S("dips", 3, "8", "2 دقيقة")] },
          { n: "ديدلفت", ex: [S("deadlift", 5, "3", "3–4 دقايق"), S("row", 3, "6", "2 دقيقة")] },
          { n: "ضغط وقوة عامة", ex: [S("press", 5, "5", "3 دقايق"), S("swing", 4, "15", "90 ثانية"), S("farmer", 4, "30 متر", "2 دقيقة")] }] },
        { n: "متقدّم", w: "4 أيام (ثقيل / خفيف)", days: [
          { n: "سكوات ثقيل", ex: [S("bsquat", 6, "2–3", "4 دقايق"), S("jsquat", 4, "5", "2 دقيقة")] },
          { n: "بنش ثقيل", ex: [S("bench", 6, "2–3", "4 دقايق"), S("press", 3, "6", "2 دقيقة")] },
          { n: "ديدلفت ثقيل", ex: [S("deadlift", 5, "1–3", "4–5 دقايق"), S("row", 4, "5", "2 دقيقة")] },
          { n: "سرعة وتحمّل", ex: [S("swing", 5, "20", "90 ثانية"), S("farmer", 5, "40 متر", "2 دقيقة"), S("plank", 3, "60 ثانية", "60 ثانية")] }] }] },
    { k: "box", n: "ملاكمة", ic: "🥊", q: "قفاز ملاكمة", desc: "تكنيك ولياقة: ضربات، نفس، وسرعة. الجولة 3 دقايق وراحة دقيقة.",
      lv: [
        { n: "مبتدئ", w: "3 أيام", days: [
          { n: "تكنيك", ex: [S("rope", 3, "2 دقيقة", "60 ثانية"), S("jab", 3, "جولة", "60 ثانية"), S("cross", 3, "جولة", "60 ثانية"), S("plank", 2, "30 ثانية", "45 ثانية")] },
          { n: "لياقة", ex: [S("rope", 4, "2 دقيقة", "60 ثانية"), S("squat", 3, "15", "60 ثانية"), S("pushup", 3, "10", "60 ثانية")] },
          { n: "شادو وكيس", ex: [S("combo", 4, "جولة", "60 ثانية"), S("upper", 2, "جولة", "60 ثانية")] }] },
        { n: "متوسط", w: "4 أيام", days: [
          { n: "كيس", ex: [S("rope", 3, "3 دقايق", "60 ثانية"), S("combo", 5, "جولة", "60 ثانية"), S("upper", 3, "جولة", "60 ثانية")] },
          { n: "قوة الضربة", ex: [S("swing", 4, "15", "90 ثانية"), S("jsquat", 4, "10", "90 ثانية"), S("pushup", 4, "15", "60 ثانية")] },
          { n: "شادو", ex: [S("combo", 6, "جولة", "60 ثانية"), S("climber", 4, "30 ثانية", "30 ثانية")] },
          { n: "نفس", ex: [S("rope", 6, "3 دقايق", "60 ثانية"), S("plank", 3, "45 ثانية", "45 ثانية")] }] },
        { n: "متقدّم", w: "5 أيام", days: [
          { n: "كيس ثقيل", ex: [S("rope", 3, "3 دقايق", "45 ثانية"), S("combo", 8, "جولة", "60 ثانية")] },
          { n: "سرعة", ex: [S("jab", 4, "جولة", "45 ثانية"), S("cross", 4, "جولة", "45 ثانية"), S("upper", 4, "جولة", "45 ثانية")] },
          { n: "قوة", ex: [S("deadlift", 4, "5", "3 دقايق"), S("swing", 5, "20", "90 ثانية"), S("pullup", 4, "8", "2 دقيقة")] },
          { n: "تحمّل", ex: [S("rope", 8, "3 دقايق", "45 ثانية"), S("climber", 5, "40 ثانية", "20 ثانية")] },
          { n: "شادو تكتيك", ex: [S("combo", 6, "جولة", "60 ثانية"), S("plank", 3, "60 ثانية", "45 ثانية")] }] }] },
    { k: "wr", n: "مصارعة", ic: "🤼", q: "مصارعة", desc: "دخلات ودفاع وقوة وسط ونفس طويل، تمارين بتنعمل لحالك.",
      lv: [
        { n: "مبتدئ", w: "3 أيام", days: [
          { n: "حركة", ex: [S("shot", 3, "8 لكل رجل", "60 ثانية"), S("sprawl", 3, "8", "60 ثانية"), S("bridge", 3, "12", "45 ثانية")] },
          { n: "قوة", ex: [S("squat", 3, "15", "60 ثانية"), S("pushup", 3, "10", "60 ثانية"), S("pullup", 3, "4", "2 دقيقة")] },
          { n: "نفس", ex: [S("sprawl", 4, "30 ثانية", "30 ثانية"), S("climber", 4, "30 ثانية", "30 ثانية"), S("plank", 3, "30 ثانية", "45 ثانية")] }] },
        { n: "متوسط", w: "4 أيام", days: [
          { n: "دخلات", ex: [S("shot", 5, "10 لكل رجل", "60 ثانية"), S("sprawl", 5, "10", "60 ثانية")] },
          { n: "قوة", ex: [S("deadlift", 4, "5", "3 دقايق"), S("pullup", 4, "8", "2 دقيقة"), S("bridge", 4, "15", "45 ثانية")] },
          { n: "انفجار", ex: [S("jsquat", 4, "10", "90 ثانية"), S("swing", 4, "15", "90 ثانية")] },
          { n: "نفس", ex: [S("sprawl", 6, "40 ثانية", "20 ثانية"), S("climber", 5, "40 ثانية", "20 ثانية")] }] },
        { n: "متقدّم", w: "5 أيام", days: [
          { n: "دخلات سرعة", ex: [S("shot", 6, "12 لكل رجل", "45 ثانية"), S("sprawl", 6, "12", "45 ثانية")] },
          { n: "قوة تقيلة", ex: [S("deadlift", 5, "3", "3–4 دقايق"), S("bsquat", 4, "5", "3 دقايق"), S("row", 4, "6", "2 دقيقة")] },
          { n: "وسط ورقبة", ex: [S("bridge", 5, "20", "45 ثانية"), S("kneeraise", 4, "15", "60 ثانية"), S("plank", 4, "60 ثانية", "45 ثانية")] },
          { n: "انفجار", ex: [S("jsquat", 5, "12", "90 ثانية"), S("swing", 5, "20", "90 ثانية"), S("farmer", 4, "40 متر", "2 دقيقة")] },
          { n: "نفس", ex: [S("sprawl", 8, "45 ثانية", "15 ثانية"), S("climber", 6, "45 ثانية", "15 ثانية")] }] }] },
  ];

  // ---------- الرسم ----------
  // صاحب المتجر (17 تشرين التاني 2026): «بدي شخصية إنسان كاملة بعضلات، إنت تحرّكها حسب التمرين، مو صورتين بيتبدّلوا».
  // شخصية 3D مبنية بالكود فوق الهيكل العظمي (المفاصل من fk): كل عضلة مجسّم بيضاوي (صدر، بطن، دالية، بايسبس، ترايسبس، فخد، بطة…)،
  // راس أصلع ولحية طويلة وشورت. الرسم بمحرّك صغير منّا (canvas، z-buffer وإضاءة)، بلا مكتبات وبلا صور من برّا.
  // العضلات يلي عم تشتغل بالتمرين بتتلوّن أحمر (TGT).
  function frame(ex, u) {
    const ps = ex.poses, n = ps.length, x = u * n, i = Math.floor(x) % n, f = x - Math.floor(x), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2;
    return place(fk(mix(ps[i], ps[(i + 1) % n], ex.hold ? e : Math.min(1, e * (ex.fast ? 1.25 : 1)))), ex);
  }
  for (const k in EX) EX[k].key = k;
  for (const k of ["jab", "cross", "upper", "combo"]) EX[k].glv = true;
  EX.bench.sup = EX.bridge.sup = true; // منسدح على ضهرو: الصدر والوجّ لفوق
  EX.bsquat.plateOff = [-3.5, 1.5];
  const TGT = { pushup: ["chest", "triceps", "delts"], pullup: ["lats", "biceps", "back"], dips: ["triceps", "chest", "delts"], squat: ["quads", "glutes"], plank: ["abs"], lunge: ["quads", "glutes", "hams"], kneeraise: ["abs"], climber: ["abs", "quads"],
    bench: ["chest", "triceps", "delts"], curl: ["biceps", "forearms"], ohp: ["delts", "triceps"], row: ["lats", "back", "biceps"], triceps: ["triceps"], bsquat: ["quads", "glutes", "hams"], deadlift: ["hams", "lowback", "glutes", "traps"], press: ["delts", "triceps", "traps"],
    swing: ["glutes", "hams", "lowback"], farmer: ["forearms", "traps"], jab: ["delts", "triceps"], cross: ["delts", "chest", "abs"], upper: ["delts", "biceps", "abs"], combo: ["delts", "chest", "abs"], rope: ["calves"], sprawl: ["abs", "quads", "delts"], shot: ["quads", "glutes"], bridge: ["glutes", "hams", "lowback"], jsquat: ["quads", "calves", "glutes"] };
  const SKIN = [.84, .6, .44], RED = [.9, .2, .15], BLK = [.1, .1, .12], BRD = [.15, .1, .07], GRY = [.6, .62, .66], DRK = [.2, .2, .23], BAG = [.72, .1, .13], EYE = [.05, .04, .04], GLV = [.82, .08, .1], GLT = [.5, .09, .09];
  const IX = [1, 0, 0], IY = [0, 1, 0], IZ = [0, 0, 1];
  function build(ex, J) {
    const P = [], T = TGT[ex.key] || [], c = (t) => (T.includes(t) ? RED : SKIN), sg = ex.sup ? -1 : 1, q = (p, z) => [p[0], -p[1], z];
    const B = (A, C, tor) => { const dx = C[0] - A[0], dy = C[1] - A[1], L = Math.hypot(dx, dy) || 1, Y = [dx / L, dy / L, 0]; return { o: A, Y, X: tor ? [Y[1] * tor, -Y[0] * tor, 0] : [-Y[1], Y[0], 0], L }; };
    const put = (b, fx, t, wz, rx, ry, rz, col, sp) => P.push({ c: [b.o[0] + b.X[0] * fx + b.Y[0] * t * b.L, b.o[1] + b.X[1] * fx + b.Y[1] * t * b.L, b.o[2] + wz], ax: b.X, ay: b.Y, az: IZ, r: [rx, ry, rz], col, sp: sp ?? .16 });
    const raw = (cx, cy, cz, ax, ay, az, r, col, cyl) => P.push({ c: [cx, cy, cz], ax, ay, az, r, col, cyl, sp: .3 });
    // ظل عالأرض
    { const xs = [J.h, J.p, J.f1, J.f2, J.w1].map((p) => p[0]), x0 = Math.min(...xs), x1 = Math.max(...xs); P.push({ c: [(x0 + x1) / 2, -(GY + 1.6), 0], ax: IX, ay: IY, az: IZ, r: [(x1 - x0) / 2 + 9, .5, 12], shadow: 1 }); }
    // الجذع
    const tb = B(q(J.p, 0), q(J.n, 0), sg);
    put(tb, 0, .03, 0, 5, 5.4, 7.4, BLK, .05);
    put(tb, .2, .33, 0, 4.3, 7, 6, SKIN); put(tb, 0, .68, 0, 5.4, 7.6, 8, SKIN);
    for (const s of [1, -1]) {
      put(tb, -3.2, -.03, s * 3.2, 3.6, 4.2, 3.7, T.includes("glutes") ? GLT : BLK, .05);
      for (const t of [.2, .32, .44]) put(tb, 3.9, t, s * 1.75, 1.5, 1.75, 1.75, c("abs"));
      put(tb, 1, .3, s * 5.3, 2.8, 4.6, 1.8, c("abs")); put(tb, 4.3, .76, s * 3.7, 2.9, 3.5, 3.9, c("chest"));
      put(tb, -2.2, .56, s * 6.7, 3.3, 6.8, 3.2, c("lats")); put(tb, -4.4, .76, s * 2.7, 2.4, 5, 3, c("back"));
      put(tb, -3.7, .3, s * 1.7, 1.9, 4.4, 1.8, c("lowback")); put(tb, -1.4, .97, s * 3.4, 2.9, 2.5, 3.8, c("traps"));
    }
    // الرقبة والراس (أصلع، لحية طويلة)
    const nb = B(q(J.n, 0), q(J.h, 0), sg), hb = { o: q(J.h, 0), X: nb.X, Y: nb.Y, L: 1 };
    put(nb, 0, .35, 0, 2.7, 5, 2.8, SKIN);
    put(hb, 0, .6, 0, 5.7, 6.1, 5.2, SKIN, .3); put(hb, 1.4, -2.2, 0, 4.2, 3.8, 4.2, SKIN); put(hb, 5.7, -.3, 0, 1.3, 1.5, 1, SKIN);
    put(hb, 3.6, -4.6, 0, 3.5, 3.4, 4.3, BRD, .05); put(hb, 5, -9.6, 0, 2.5, 6.4, 3, BRD, .05); put(hb, 5.6, -2.3, 0, 1.1, .8, 2.5, BRD, .05);
    for (const s of [1, -1]) { put(hb, -.6, -.2, s * 5.1, 1.1, 1.8, .7, SKIN); put(hb, 5, 1, s * 2.1, .75, .6, .9, EYE, .5); put(hb, 5.2, 2.2, s * 2.2, .8, .5, 1.7, BRD, .05); put(hb, 1.4, -2.8, s * 3.6, 2.8, 3.2, 1.5, BRD, .05); }
    // الإيدين والرجلين
    const W3 = {};
    for (const s of [1, -1]) {
      const i = s > 0 ? 1 : 2, z = s * 9.8, Sh = [tb.o[0] + tb.Y[0] * (tb.L - 1.5), tb.o[1] + tb.Y[1] * (tb.L - 1.5), z], E = q(J["e" + i], z), Wr = q(J["w" + i], z);
      const ub = B(Sh, E), fb = B(E, Wr); W3[i] = { p: Wr, b: fb };
      put(ub, .2, .1, s * .8, 3.6, 4.3, 3.5, c("delts")); put(ub, 0, .52, 0, 2.3, 7.6, 2.4, SKIN); put(ub, 1.5, .5, 0, 2.6, 5, 2.5, c("biceps")); put(ub, -1.6, .48, 0, 2.6, 5.4, 2.5, c("triceps")); put(ub, 0, 1, 0, 2.2, 2.2, 2.2, SKIN);
      put(fb, .3, .34, 0, 2.6, 5.4, 2.4, c("forearms")); put(fb, 0, .74, 0, 1.8, 4.2, 1.7, SKIN);
      if (ex.glv) put(fb, 0, 1.1, 0, 3.4, 3.8, 3.3, GLV, .35); else put(fb, 0, 1.08, 0, 2, 2.6, 1.6, SKIN);
      const zl = s * 4.7, Hp = q(J.p, zl), K = q(J["k" + i], zl), F = q(J["f" + i], zl), kb = B(Hp, K), sb = B(K, F);
      put(kb, 0, .2, 0, 4.5, 5.8, 4.5, BLK, .05); put(kb, 0, .55, 0, 3.3, 8.6, 3.4, SKIN); put(kb, 1.6, .5, 0, 3.2, 6.6, 3.4, c("quads")); put(kb, -1.8, .55, 0, 2.9, 6.4, 3.1, c("hams")); put(kb, .3, 1, 0, 2.7, 2.7, 2.7, SKIN);
      put(sb, 0, .5, 0, 2.2, 8.8, 2.2, SKIN); put(sb, -1.4, .3, 0, 2.7, 5, 2.6, c("calves")); put(sb, 2.4, 1.02, 0, 4.6, 1.9, 2.3, DRK, .3);
    }
    // الأدوات
    if (ex.prop === "bar") { raw(60, -9, 0, IX, IZ, IY, [.9, 24, .9], GRY, 1); for (const s of [1, -1]) raw(60, -4.5, s * 24, IX, IY, IZ, [.9, 5, .9], GRY, 1); }
    if (ex.prop === "dip") for (const s of [1, -1]) { raw(63, -52.6, s * 9.8, IY, IX, IZ, [.9, 13, .9], GRY, 1); raw(73, -(52.6 + GY) / 2, s * 9.8, IX, IY, IZ, [.9, (GY - 52.6) / 2, .9], GRY, 1); }
    if (ex.prop === "bench") { raw(60, -71.6, 0, IX, IY, IZ, [32, 2.2, 7], DRK); for (const x of [34, 86]) raw(x, -(73.5 + GY) / 2, 0, IX, IY, IZ, [1, (GY - 73.5) / 2, 1], GRY, 1); }
    if (ex.prop === "bag") { raw(103, -36, 0, IX, IY, IZ, [7, 20, 7], BAG, 1); raw(103, -16, 0, IX, IY, IZ, [7, 3, 7], BAG); raw(103, -56, 0, IX, IY, IZ, [7, 3, 7], BAG); raw(103, -6.5, 0, IX, IY, IZ, [.4, 7, .4], GRY, 1); }
    if (ex.plate) { const o = ex.plateOff || [0, 0], x = J[ex.plate][0] + o[0], y = -(J[ex.plate][1] + o[1]);
      if (ex.plateR === 6) { raw(x, y - 3.5, 0, IX, IY, IZ, [4.6, 4.6, 4.6], DRK); raw(x, y, 0, IX, IZ, IY, [.7, 9.8, .7], DRK, 1); }
      else { const R = ex.key === "bsquat" ? 8 : 9; raw(x, y, 0, IX, IZ, IY, [.8, 27, .8], GRY, 1); for (const s of [1, -1]) { raw(x, y, s * 21.5, IX, IZ, IY, [R, 1.3, R], DRK, 1); raw(x, y, s * 24, IX, IZ, IY, [R * .72, 1, R * .72], DRK, 1); } } }
    if (ex.db) for (const i of [1, 2]) { const w = W3[i], b = w.b, h = [w.p[0] + b.Y[0] * 1.2, w.p[1] + b.Y[1] * 1.2, w.p[2]];
      raw(h[0], h[1], h[2], b.Y, b.X, IZ, [.7, 3.6, .7], GRY, 1); for (const s of [1, -1]) raw(h[0] + b.X[0] * 3.6 * s, h[1] + b.X[1] * 3.6 * s, h[2], b.Y, b.X, IZ, [2.4, 1.4, 2.4], DRK, 1); }
    return { P, W3 };
  }
  // المحرّك: إسقاط متعامد بزاوية 3/4، z-buffer لكل بكسل، إضاءة منتشرة + لمعة
  const CA = Math.cos(-.5), SA = Math.sin(-.5), CB = Math.cos(.16), SB = Math.sin(.16), LX = -.36, LY = .74, LZ = .57;
  const rot = (v) => { const x = v[0] * CA + v[2] * SA, z = -v[0] * SA + v[2] * CA; return [x, v[1] * CB - z * SB, v[1] * SB + z * CB]; };
  const view = (p) => rot([p[0] - 60, p[1] + 50, p[2]]);
  function render(cv, ex, u) {
    const W = cv.width, H = cv.height, S = W / 120 * .86, CX = W / 2 / S, CY = H * .53 / S, ctx = cv.__ctx || (cv.__ctx = cv.getContext("2d")), img = cv.__img || (cv.__img = ctx.createImageData(W, H)), D = img.data, zb = cv.__zb || (cv.__zb = new Float32Array(W * H));
    D.fill(0); zb.fill(1e9);
    const J = frame(ex, u), { P, W3 } = build(ex, J);
    for (const pr of P) {
      const c = view(pr.c), ax = rot(pr.ax), ay = rot(pr.ay), az = rot(pr.az), rx = pr.r[0], ry = pr.r[1], rz = pr.r[2];
      const ex2 = pr.cyl ? Math.abs(ax[0]) * rx + Math.abs(ay[0]) * ry + Math.abs(az[0]) * rz : Math.hypot(ax[0] * rx, ay[0] * ry, az[0] * rz), ey2 = pr.cyl ? Math.abs(ax[1]) * rx + Math.abs(ay[1]) * ry + Math.abs(az[1]) * rz : Math.hypot(ax[1] * rx, ay[1] * ry, az[1] * rz);
      const x0 = Math.max(0, Math.floor((c[0] - ex2 + CX) * S)), x1 = Math.min(W - 1, Math.ceil((c[0] + ex2 + CX) * S)), y0 = Math.max(0, Math.floor((CY - c[1] - ey2) * S)), y1 = Math.min(H - 1, Math.ceil((CY - c[1] + ey2) * S));
      const dx = -ax[2] / rx, dy = -ay[2] / ry, dz = -az[2] / rz, col = pr.col, sp = pr.sp || 0;
      for (let py = y0; py <= y1; py++) {
        const ry_ = CY - (py + .5) / S - c[1];
        for (let px = x0; px <= x1; px++) {
          const rx_ = (px + .5) / S - CX - c[0];
          const ox = (rx_ * ax[0] + ry_ * ax[1] - c[2] * ax[2]) / rx, oy = (rx_ * ay[0] + ry_ * ay[1] - c[2] * ay[2]) / ry, oz = (rx_ * az[0] + ry_ * az[1] - c[2] * az[2]) / rz;
          let t, nx, ny, nz;
          if (!pr.cyl) {
            const a = dx * dx + dy * dy + dz * dz, b = ox * dx + oy * dy + oz * dz, cc = ox * ox + oy * oy + oz * oz - 1, ds = b * b - a * cc; if (ds < 0) continue;
            t = (-b - Math.sqrt(ds)) / a; const lx = (ox + t * dx) / rx, ly = (oy + t * dy) / ry, lz = (oz + t * dz) / rz;
            nx = ax[0] * lx + ay[0] * ly + az[0] * lz; ny = ax[1] * lx + ay[1] * ly + az[1] * lz; nz = ax[2] * lx + ay[2] * ly + az[2] * lz;
          } else {
            let hit = 0; const a = dx * dx + dz * dz;
            if (a > 1e-9) { const b = ox * dx + oz * dz, cc = ox * ox + oz * oz - 1, ds = b * b - a * cc; if (ds < 0) continue; t = (-b - Math.sqrt(ds)) / a; const yy = oy + t * dy;
              if (yy >= -1 && yy <= 1) { const lx = (ox + t * dx) / rx, lz = (oz + t * dz) / rz; nx = ax[0] * lx + az[0] * lz; ny = ax[1] * lx + az[1] * lz; nz = ax[2] * lx + az[2] * lz; hit = 1; } }
            if (!hit) { if (Math.abs(dy) < 1e-9) continue; const s = dy > 0 ? -1 : 1; t = (s - oy) / dy; const xx = ox + t * dx, zz = oz + t * dz; if (xx * xx + zz * zz > 1) continue; nx = ay[0] * s; ny = ay[1] * s; nz = ay[2] * s; }
          }
          const k = py * W + px;
          if (pr.shadow) { if (zb[k] > 1e8) { const o = k * 4; D[o] = D[o + 1] = D[o + 2] = 0; D[o + 3] = 46; } continue; }
          if (t >= zb[k]) continue; zb[k] = t;
          const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
          const df = Math.max(0, nx * LX + ny * LY + nz * LZ), hz = LZ + 1, hl = Math.hypot(LX, LY, hz), sh = Math.max(0, (nx * LX + ny * LY + nz * hz) / hl), spc = sp * Math.pow(sh, 26);
          const li = (.36 + .78 * df) * (.7 + .3 * Math.max(0, nz)), o = k * 4;
          D[o] = Math.min(255, (col[0] * li + spc) * 255); D[o + 1] = Math.min(255, (col[1] * li + spc) * 255); D[o + 2] = Math.min(255, (col[2] * li + spc) * 255); D[o + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);
    if (ex.prop === "rope") { // الحبل: خط مرسوم فوق الصورة بين الإيدين
      const pj = (p) => { const v = view(p); return [(v[0] + CX) * S, (CY - v[1]) * S]; }, a = pj(W3[1].p), b = pj(W3[2].p), ang = u * Math.PI * 2 * ex.poses.length, m = pj([60 + Math.sin(ang) * 16, -(50 - Math.cos(ang) * 46), 0]);
      ctx.strokeStyle = "#c9a45c"; ctx.lineWidth = S * .9; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.quadraticCurveTo(m[0] * 2 - (a[0] + b[0]) / 2, m[1] * 2 - (a[1] + b[1]) / 2, b[0], b[1]); ctx.stroke(); }
  }
  // التحريك: بس الرسومات يلي ظاهرة عالشاشة (توفير بطارية)، 30 صورة بالثانية، وبلا حركة إذا الجهاز طالب «تقليل الحركة»
  const VIS = new Set(); let raf = 0, t0 = 0, last = 0;
  const still = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => { for (const e of es) { const t = e.target; if (t.tagName === "VIDEO") { if (e.isIntersecting) { const p = t.play(); if (p && p.catch) p.catch(() => {}); } else t.pause(); continue; } e.isIntersecting ? VIS.add(t) : VIS.delete(t); } kick(); }, { rootMargin: "60px" }) : null;
  function kick() { if (!raf && VIS.size && !still) raf = requestAnimationFrame(tick); }
  function tick(t) { raf = 0; t0 = t0 || t; if (t - last >= 30) { last = t; for (const s of VIS) { if (!s.isConnected) { VIS.delete(s); if (io) io.unobserve(s); continue; } const ex = s.__ex, per = (ex.fast ? 1.1 : ex.hold ? 2.6 : 2.2) * 1000 * (ex.poses.length > 2 ? ex.poses.length / 2 : 1); render(s, ex, ((t - t0) % per) / per); } } kick(); }
  // صاحب المتجر (17 تشرين التاني 2026): «بدي شي احترافي». شخصية وحركات احترافية من Mixamo (Adobe، مجانية ومسموحة تجارياً، ممنوع توزيع ملفات الموديل الخام —
  // فمنعرضها فيديو بس). الفيديوهات معمولة من ملفات FBX (شخصية Brute) بـ three.js على السيرفر، بالأدوات (دمبل، بار، كيتل بل، قفازات). يلي ما إلو حركة بـ Mixamo بيضل عالشخصية المرسومة بالكود تحت.
  const VID = new Set(["pushup", "squat", "plank", "curl", "bsquat", "swing"]), VV = 1; // الملاكمة (jab/cross/upper/combo) شلناها: صاحب المتجر قال حركات Mixamo غلط، رجعت عالشخصية المرسومة لحد ما نختار حركات صح
  function figOf(k, big) {
    if (VID.has(k)) { const v = document.createElement("video"); v.className = "tr-fig tr-vid" + (big ? " big" : ""); v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute("playsinline", ""); v.setAttribute("muted", ""); v.preload = big ? "auto" : "metadata";
      v.poster = `/assets/train/${k}.jpg?v=${VV}`; v.src = `/assets/train/${k}.mp4?v=${VV}`; v.setAttribute("aria-hidden", "true");
      if (still) return v; if (io) io.observe(v); else v.autoplay = true; return v; }
    const cv = document.createElement("canvas"), S = big ? 5 : 2.5; cv.width = 120 * S; cv.height = 100 * S; cv.className = "tr-fig" + (big ? " big" : ""); cv.setAttribute("aria-hidden", "true"); cv.__ex = EX[k];
    render(cv, EX[k], 0); if (io) io.observe(cv); else { VIS.add(cv); kick(); } return cv;
  }
  // ---------- الصفحة ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const st = (() => { try { return JSON.parse(localStorage.getItem("ko_train") || "{}") || {}; } catch { return {}; } })();
  const save = () => { try { localStorage.setItem("ko_train", JSON.stringify(st)); } catch {} };
  function mount(root) {
    let pk = PROGS.some((x) => x.k === st.p) ? st.p : "cal", lv = Math.min(2, Math.max(0, +st.l || 0)), dy = +st.d || 0;
    const render = () => {
      const pr = PROGS.find((x) => x.k === pk), L2 = pr.lv[lv], D = L2.days[Math.min(dy, L2.days.length - 1)], dk = pk + lv + "-" + dy, done = (st.done && st.done[dk]) || {};
      root.innerHTML = `<div class="tr">
        <h1 class="page-title">برامج التدريب</h1>
        <p class="tr-sub">اختار الرياضة ومستواك، وكل تمرين معو رسمة متحركة بتورجيك كيف ينعمل. كبوس على أي تمرين لتشوف الشرح.</p>
        <div class="tr-tabs">${PROGS.map((x) => `<button type="button" data-p="${x.k}" class="${x.k === pk ? "on" : ""}"><span>${x.ic}</span>${esc(x.n)}</button>`).join("")}</div>
        <p class="tr-desc">${esc(pr.desc)}</p>
        <div class="tr-lv">${pr.lv.map((x, i) => `<button type="button" data-l="${i}" class="${i === lv ? "on" : ""}">${esc(x.n)}</button>`).join("")}</div>
        <div class="tr-w">📅 ${esc(L2.w)}</div>
        <div class="tr-days">${L2.days.map((x, i) => `<button type="button" data-d="${i}" class="${i === dy ? "on" : ""}">${esc(x.n.split(" — ")[0])}</button>`).join("")}</div>
        <h2 class="tr-dn">${esc(D.n)}</h2>
        ${D.note ? `<div class="tr-note">💡 ${esc(D.note)}</div>` : ""}
        <div class="tr-warm">🔥 قبل ما تبلّش: 5–10 دقايق إحماء (مشي سريع، نط حبل خفيف، لفّ مفاصل).</div>
        <div class="tr-list">${(D.ex || []).map((x, i) => { const e = EX[x.k]; return `<div class="tr-ex ${done[i] ? "ok" : ""}" data-i="${i}" data-k="${x.k}"><div class="tr-fw" data-open="${x.k}"></div><div class="tr-in" data-open="${x.k}"><b>${esc(e.n)}</b><span class="tr-sr">${x.sets === 1 ? "مجموعة وحدة" : x.sets + " مجموعات"} × ${esc(x.rep)}</span><small>راحة: ${esc(x.rest)}</small></div><button type="button" class="tr-ck" data-ck="${i}" aria-label="خلّصت">${done[i] ? "✓" : ""}</button></div>`; }).join("")}</div>
        ${(D.ex || []).length ? `<div class="tr-prog"><span style="width:${Math.round(Object.values(done).filter(Boolean).length * 100 / D.ex.length)}%"></span></div>` : ""}
        <a class="tr-shop" href="#/search/${encodeURIComponent(pr.q)}">🛒 شوف معدات ${esc(pr.n)} بالمتجر ›</a>
        <p class="tr-safe">ملاحظة: إذا عندك إصابة أو مرض، اسأل دكتور أو مدرّب قبل ما تبلّش. ووقّف أي تمرين إذا حسّيت بوجع حاد.</p>
      </div>`;
      root.querySelectorAll(".tr-ex").forEach((el) => { el.querySelector(".tr-fw").appendChild(figOf(el.dataset.k)); });
    };
    const sheet = (k) => {
      const e = EX[k], o = document.createElement("div"); o.className = "tr-sh";
      o.innerHTML = `<div class="tr-shb" role="dialog" aria-modal="true"><button type="button" class="tr-x" aria-label="سكّر">✕</button><div class="tr-big"></div><h3>${esc(e.n)}</h3><ol>${e.how.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><div class="tr-err">⚠️ ${esc(e.err)}</div></div>`;
      o.querySelector(".tr-big").appendChild(figOf(k, true)); document.body.appendChild(o); requestAnimationFrame(() => o.classList.add("on"));
      const close = () => { o.classList.remove("on"); setTimeout(() => o.remove(), 220); };
      o.addEventListener("click", (ev) => { if (ev.target === o || ev.target.closest(".tr-x")) close(); });
    };
    root.onclick = (ev) => {
      const b = ev.target.closest("[data-p],[data-l],[data-d],[data-ck],[data-open]"); if (!b) return;
      if (b.dataset.p) { pk = b.dataset.p; lv = 0; dy = 0; }
      else if (b.dataset.l !== undefined) { lv = +b.dataset.l; dy = 0; }
      else if (b.dataset.d !== undefined) dy = +b.dataset.d;
      else if (b.dataset.ck !== undefined) { const dk = pk + lv + "-" + dy; st.done ||= {}; const m = (st.done[dk] ||= {}); m[b.dataset.ck] = !m[b.dataset.ck]; }
      else if (b.dataset.open) { sheet(b.dataset.open); return; }
      Object.assign(st, { p: pk, l: lv, d: dy }); save(); render();
    };
    render();
  }
  window.KOTrain = { mount, EX, PROGS, _fk: { frame, build, render, figOf } };
})();
