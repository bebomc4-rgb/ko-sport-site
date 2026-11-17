/* KO SPORT — برامج التدريب (حسابي ← برامج تدريب)
 * صاحب المتجر (17 تشرين التاني 2026): «حطلي بقسم حسابي برامج تدريب مع رسومات توضيحية متحركة للكالستنكس وكمال الأجسام والقوة البدنية والملاكمة والمصارعة».
 * الرسومات: مجسّم بسيط بلون المتجر (SVG) بيتحرك بين وضعيات (زوايا مفاصل)، مرسوم بالكود هون، بلا صور من برّا.
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
    pullup: { n: "عقلة (Pull-up)", how: ["امسك العارضة أوسع من كتافك شوي وانزل لتحت لآخر الطريق", "اسحب حالك لحد ما دقنك يطلع فوق العارضة، ونزول بهدوء"], err: "لا تتمرجح ولا تكمّل نص حركة", anchor: ["w1", 60, 16], prop: "bar",
      poses: [P({ t: 180, a1: [180, 180], a2: [178, 178], l1: [15, -45], l2: [20, -40] }), P({ t: 172, a1: [28, 172], a2: [32, 170], l1: [25, -10], l2: [30, -6] })] },
    dips: { n: "متوازي (Dips)", how: ["اسند حالك عالمتوازي وإيديك ممدودين", "انزل لحد ما كوعك يصير زاوية 90 تقريباً، وادفش لفوق"], err: "لا تنزل كتير إذا كتفك بيوجعك", anchor: ["w1", 62, 52], prop: "dip",
      poses: [P({ t: 174, a1: [0, 0], a2: [2, 2], l1: [12, -55], l2: [16, -50] }), P({ t: 162, a1: [-62, 6], a2: [-60, 8], l1: [20, -50], l2: [24, -45] })] },
    squat: { n: "سكوات (Squat)", how: ["رجليك بعرض كتافك وإيديك لقدّام", "نزّل وسطك لورا كأنك عم تقعد على كرسي لحد ما فخدك يصير موازي للأرض، وقوم"], err: "ركبتك ما تفوت لجوا، وكعبك ما يرتفع", anchor: ["f1", 62, GY],
      poses: [P({ a1: [90, 90], a2: [88, 88] }), P({ t: 146, a1: [100, 96], a2: [98, 94], l1: [80, -12], l2: [82, -10] })] },
    plank: { n: "بلانك (Plank)", how: ["اسند على كوعك وأطراف رجليك", "شدّ بطنك وطيزك وخلّي جسمك خط مستقيم، وتنفّس بهدوء"], err: "لا ترفع وسطك ولا تنزّلو", anchor: ["f1", 22, GY], hold: true,
      poses: [P({ t: 103.5, hd: 112, a1: [0, 90], a2: [2, 92], l1: [-76.5, -76.5], l2: [-75.5, -75.5] }), P({ t: 104.5, hd: 112, a1: [0, 90], a2: [2, 92], l1: [-75.5, -75.5], l2: [-74.5, -74.5] })] },
    lunge: { n: "طعنات (Lunge)", how: ["اعمل خطوة كبيرة لقدّام ونزّل ركبتك الورانية لتقرب عالأرض", "ادفش برجلك القدّامية وارجع لوقفتك، وبدّل الرجل"], err: "ركبتك القدّامية ما تتعدّى أصابع رجلك كتير", anchor: "ground",
      poses: [P({ a1: [0, 0], a2: [3, 3] }), P({ t: 178, a1: [5, 5], a2: [8, 8], l1: [72, 0], l2: [-18, -82] })] },
    kneeraise: { n: "رفع الركب معلّق", how: ["تعلّق بالعارضة وإيديك ممدودين", "ارفع ركبك لعند صدرك ببطء ونزّلن بهدوء"], err: "لا تتمرجح، الحركة من البطن", anchor: ["w1", 60, 16], prop: "bar",
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
    press: { n: "ضغط عسكري بالبار", how: ["البار عند كتافك قدّام، ووقف ثابت", "ادفش البار لفوق راسك لتمدّ إيديك، ونزّلو لعند كتافك"], err: "شدّ بطنك وما ترجع بضهرك لورا", anchor: ["f1", 60, GY], plate: "w1",
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
  const NS = "http://www.w3.org/2000/svg";
  // المجسّم (صاحب المتجر 17 تشرين التاني 2026: «بدي ياه يشبه الإنسان، أصلع، ولحية طويلة، وعضلات»):
  // رياضي بلون بشرة، أطرافو معضّلة (عرض بيتغيّر مع بطن العضلة)، صدر وبطن مرسومين، شورت أسود، راس أصلع ولحية طويلة. الطرف البعيد أغمق (عمق).
  const LIMBS = [["n", "e2", 6.4, 4.9, 1.7, 1], ["e2", "w2", 4.9, 3.3, 1, 1], ["p", "k2", 8.8, 5.8, 1.6, 1], ["k2", "f2", 5.7, 3.4, 1.6, 1], ["p", "k1", 9, 6, 1.7, 0], ["k1", "f1", 5.9, 3.5, 1.7, 0], ["n", "e1", 6.8, 5.1, 1.9, 0], ["e1", "w1", 5.1, 3.4, 1.1, 0]];
  for (const k of ["jab", "cross", "upper", "combo"]) EX[k].glv = true;
  EX.bench.sup = EX.bridge.sup = true; // منسدح على ضهرو: الصدر والوجّ لفوق
  function frame(ex, u) {
    const ps = ex.poses, n = ps.length, x = u * n, i = Math.floor(x) % n, f = x - Math.floor(x), e = f < 0.5 ? 2 * f * f : 1 - Math.pow(-2 * f + 2, 2) / 2; // سهولة بالدخول والخروج
    return place(fk(mix(ps[i], ps[(i + 1) % n], ex.hold ? e : Math.min(1, e * (ex.fast ? 1.25 : 1)))), ex);
  }
  function svgOf(ex, big) {
    const s = document.createElementNS(NS, "svg"); s.setAttribute("viewBox", "0 0 120 100"); s.setAttribute("class", "tr-fig" + (big ? " big" : "")); s.setAttribute("aria-hidden", "true");
    let h = `<line x1="4" y1="${GY + 1.5}" x2="116" y2="${GY + 1.5}" class="tr-gnd"/>`;
    if (ex.prop === "bar") h += `<line x1="32" y1="16" x2="88" y2="16" class="tr-prop" stroke-width="2.4"/><line x1="34" y1="16" x2="34" y2="6" class="tr-prop"/><line x1="86" y1="16" x2="86" y2="6" class="tr-prop"/>`;
    if (ex.prop === "dip") h += `<line x1="50" y1="53" x2="76" y2="53" class="tr-prop" stroke-width="2.4"/><line x1="72" y1="53" x2="72" y2="${GY}" class="tr-prop"/><line x1="54" y1="53" x2="54" y2="${GY}" class="tr-prop"/>`;
    if (ex.prop === "bench") h += `<rect x="28" y="69.5" width="64" height="4" rx="1.5" class="tr-propf"/><line x1="34" y1="73" x2="34" y2="${GY}" class="tr-prop"/><line x1="86" y1="73" x2="86" y2="${GY}" class="tr-prop"/>`;
    if (ex.prop === "bag") h += `<line x1="103" y1="0" x2="103" y2="14" class="tr-prop"/><rect x="96" y="14" width="14" height="44" rx="6" class="tr-bag"/>`;
    const lb = (i) => `<g class="lb${LIMBS[i][5] ? " far" : ""}" data-l="${i}"><path class="b"/><path class="sd"/><path class="hl"/></g>`, gl = ex.glv ? " glv" : "", hr = ex.glv ? 3.7 : 2.8;
    h += `<g class="tr-body">${lb(0)}${lb(1)}<circle class="hd far${gl}" data-j="w2" r="${hr}"/>${lb(2)}<line class="st far" data-s="2"/>${lb(3)}<line class="ft far" data-f="2"/>`
      + `<path class="nk"/><path class="to"/><path class="pec"/><path class="abs"/><path class="sht"/>`
      + `${lb(4)}<line class="st" data-s="1"/>${lb(5)}<line class="ft" data-f="1"/>`
      + `<circle class="hd0" r="6.3"/><path class="ear"/><path class="brd"/><path class="brw"/><circle class="eye" r=".75"/><path class="nose"/>`
      + `${lb(6)}${lb(7)}<circle class="hd${gl}" data-j="w1" r="${hr + .1}"/></g>`;
    if (ex.plate) h += `<circle class="tr-plate" r="${ex.plateR || 9}"/>`;
    if (ex.db) h += `<g class="tr-db"><rect width="9" height="3.4" rx="1" x="-4.5" y="-1.7"/><rect width="2.6" height="6.4" rx=".8" x="-5.6" y="-3.2"/><rect width="2.6" height="6.4" rx=".8" x="3" y="-3.2"/></g>`;
    if (ex.prop === "rope") h += `<path class="tr-rope"/>`;
    s.innerHTML = h; s.__ex = ex; draw(s, 0); return s;
  }
  const f1 = (x) => x.toFixed(1), setL = (l, A, B) => { l.setAttribute("x1", f1(A[0])); l.setAttribute("y1", f1(A[1])); l.setAttribute("x2", f1(B[0])); l.setAttribute("y2", f1(B[1])); };
  const pp = (q) => f1(q[0]) + " " + f1(q[1]);
  function draw(s, u) {
    const ex = s.__ex, J = frame(ex, u), B = s.querySelector(".tr-body"), sg = ex.sup ? -1 : 1;
    for (const g of B.querySelectorAll(".lb")) {
      const [a, b, wa, wb, bg] = LIMBS[+g.dataset.l], A = J[a], C = J[b], dx = C[0] - A[0], dy = C[1] - A[1], ln = Math.hypot(dx, dy) || 1;
      let nx = -dy / ln, ny = dx / ln; if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; } // n = الجهة الفوقانية (الضو من فوق)
      const M = [A[0] + dx * .38, A[1] + dy * .38], hw = (wa + wb) / 4 + bg, o = (q, k) => [q[0] + nx * k, q[1] + ny * k], ra = wa / 2, rb = wb / 2, [pb, sd, hl] = g.children;
      // بطن العضلة أقرب للمفصل الفوقاني، والأطراف مدوّرة عند المفاصل
      pb.setAttribute("d", `M${pp(o(A, ra))} Q${pp(o(M, hw + .6))} ${pp(o(C, rb))} Q${pp([C[0] + dx / ln * rb * 1.7, C[1] + dy / ln * rb * 1.7])} ${pp(o(C, -rb))} Q${pp(o(M, -hw))} ${pp(o(A, -ra))} Q${pp([A[0] - dx / ln * ra * 1.7, A[1] - dy / ln * ra * 1.7])} ${pp(o(A, ra))}Z`);
      sd.setAttribute("d", `M${pp(o(A, -ra * .55))} Q${pp(o(M, -hw * .8))} ${pp(o(C, -rb * .55))}`);
      hl.setAttribute("d", `M${pp(o([A[0] + dx * .12, A[1] + dy * .12], ra * .45))} Q${pp(o(M, hw * .75))} ${pp(o([C[0] - dx * .25, C[1] - dy * .25], rb * .4))}`);
    }
    for (const c of B.querySelectorAll("[data-j]")) { const q = J[c.dataset.j]; c.setAttribute("cx", f1(q[0])); c.setAttribute("cy", f1(q[1])); }
    for (const st of B.querySelectorAll(".st")) { const K = J["k" + st.dataset.s]; setL(st, J.p, [J.p[0] + (K[0] - J.p[0]) * .5, J.p[1] + (K[1] - J.p[1]) * .5]); } // الشورت
    for (const ft of B.querySelectorAll(".ft")) { const i = ft.dataset.f, K = J["k" + i], F = J["f" + i], dx = F[0] - K[0], dy = F[1] - K[1], ln = Math.hypot(dx, dy) || 1; let fx = -dy / ln, fy = dx / ln; if (fx < 0) { fx = -fx; fy = -fy; } setL(ft, [F[0] - fx * 1.2, F[1] - fy * 1.2], [F[0] + fx * 6.4, F[1] + fy * 6.4]); }
    // الجذع (منظر جانبي): صدر نافر لقدّام، ضهر عريض، خصر رفيع
    { const P0 = J.p, N0 = J.n, dx = N0[0] - P0[0], dy = N0[1] - P0[1], ln = Math.hypot(dx, dy) || 1, ux = dx / ln, uy = dy / ln, fx = -uy * sg, fy = ux * sg;
      const pt = (b2, al, sd2) => [b2[0] + ux * al + fx * sd2, b2[1] + uy * al + fy * sd2];
      B.querySelector(".to").setAttribute("d", `M${pp(pt(P0, -1, 4.6))} Q${pp(pt(P0, 6, 3.2))} ${pp(pt(P0, 12, 4.4))} Q${pp(pt(N0, -8, 9))} ${pp(pt(N0, -1, 4.8))} Q${pp(pt(N0, 2.6, 0))} ${pp(pt(N0, -1, -5))} Q${pp(pt(N0, -9, -7.4))} ${pp(pt(P0, 7, -3.9))} L${pp(pt(P0, -1, -4.4))}Z`);
      B.querySelector(".pec").setAttribute("d", `M${pp(pt(N0, -9.2, 6.3))} Q${pp(pt(N0, -11, 4))} ${pp(pt(N0, -9.6, 1.2))}`);
      B.querySelector(".abs").setAttribute("d", `M${pp(pt(P0, 11.6, 3.9))} L${pp(pt(P0, 11.2, 1))} M${pp(pt(P0, 8.4, 3.5))} L${pp(pt(P0, 8.1, .8))} M${pp(pt(P0, 5.3, 3.3))} L${pp(pt(P0, 5.1, .8))}`);
      B.querySelector(".sht").setAttribute("d", `M${pp(pt(P0, 3.4, 4.2))} L${pp(pt(P0, 3.2, -4.3))} L${pp(pt(P0, -4.2, -4.8))} L${pp(pt(P0, -4.4, 5))}Z`);
      const d2x = J.h[0] - N0[0], d2y = J.h[1] - N0[1], l2 = Math.hypot(d2x, d2y) || 1, ex2 = -d2y / l2, ey2 = d2x / l2, nk = (q, k) => [q[0] + ex2 * k, q[1] + ey2 * k];
      B.querySelector(".nk").setAttribute("d", `M${pp(nk(N0, 3.4))} L${pp(nk(J.h, 2.6))} L${pp(nk(J.h, -2.6))} L${pp(nk(N0, -3.6))}Z`); }
    // الراس: أصلع، أدن، عين وحاجب، أنف، ولحية طويلة نازلة عالصدر
    { const H = J.h, dx = H[0] - J.n[0], dy = H[1] - J.n[1], ln = Math.hypot(dx, dy) || 1, ux = dx / ln, uy = dy / ln, fx = -uy * sg, fy = ux * sg, hp = (al, sd2) => [H[0] + ux * al + fx * sd2, H[1] + uy * al + fy * sd2];
      const hd = B.querySelector(".hd0"); hd.setAttribute("cx", f1(H[0])); hd.setAttribute("cy", f1(H[1]));
      B.querySelector(".brd").setAttribute("d", `M${pp(hp(-1, 6))} Q${pp(hp(-9, 9))} ${pp(hp(-16.5, 4))} Q${pp(hp(-11, -.5))} ${pp(hp(-5.4, -3.4))} L${pp(hp(-.6, -3.2))} Q${pp(hp(-3.6, 1.6))} ${pp(hp(-1, 6))}Z`);
      B.querySelector(".ear").setAttribute("d", `M${pp(hp(1.2, -1.6))} Q${pp(hp(.4, -3.4))} ${pp(hp(-1.4, -1.8))}`);
      B.querySelector(".brw").setAttribute("d", `M${pp(hp(2.5, 2.6))} L${pp(hp(2.1, 5.2))}`);
      const ey = hp(1, 4.1), e = B.querySelector(".eye"); e.setAttribute("cx", f1(ey[0])); e.setAttribute("cy", f1(ey[1]));
      B.querySelector(".nose").setAttribute("d", `M${pp(hp(.9, 6))} L${pp(hp(-.7, 7.7))} L${pp(hp(-1.3, 5.9))}Z`); }
    const pl = s.querySelector(".tr-plate"); if (pl) { const q = J[ex.plate], o = ex.plateOff || [0, 0]; pl.setAttribute("cx", (q[0] + o[0]).toFixed(1)); pl.setAttribute("cy", (q[1] + o[1]).toFixed(1)); }
    const db = s.querySelector(".tr-db"); if (db) db.setAttribute("transform", `translate(${J.w1[0].toFixed(1)} ${J.w1[1].toFixed(1)})`);
    const rp = s.querySelector(".tr-rope"); if (rp) { const ang = u * Math.PI * 2 * ex.poses.length, cy = 50 - Math.cos(ang) * 46, cx = 60 + Math.sin(ang) * 14; rp.setAttribute("d", `M${J.w1[0].toFixed(1)} ${J.w1[1].toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${J.w2[0].toFixed(1)} ${J.w2[1].toFixed(1)}`); }
  }
  // التحريك: بس الرسومات يلي ظاهرة عالشاشة (توفير بطارية)، وبلا حركة إذا الجهاز طالب «تقليل الحركة»
  const VIS = new Set(); let raf = 0, t0 = 0;
  const still = (() => { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } })();
  const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => { for (const e of es) e.isIntersecting ? VIS.add(e.target) : VIS.delete(e.target); kick(); }, { rootMargin: "60px" }) : null;
  function kick() { if (!raf && VIS.size && !still) { t0 = t0 || performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(t) { raf = 0; for (const s of VIS) { if (!s.isConnected) { VIS.delete(s); continue; } const ex = s.__ex, per = (ex.fast ? 1.1 : ex.hold ? 2.6 : 2.2) * 1000 * (ex.poses.length > 2 ? ex.poses.length / 2 : 1); draw(s, ((t - t0) % per) / per); } kick(); }
  const watch = (s) => { if (io) io.observe(s); else { VIS.add(s); kick(); } };

  // ---------- الصفحة ----------
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const st = (() => { try { return JSON.parse(localStorage.getItem("ko_train") || "{}") || {}; } catch { return {}; } })();
  const save = () => { try { localStorage.setItem("ko_train", JSON.stringify(st)); } catch {} };
  function trDefs() {
    if (document.getElementById("trDefs")) return;
    const d = document.createElementNS(NS, "svg"); d.id = "trDefs"; d.setAttribute("width", "0"); d.setAttribute("height", "0"); d.setAttribute("aria-hidden", "true"); d.style.position = "absolute";
    d.innerHTML = `<defs><radialGradient id="trSkin" cx=".42" cy=".3" r=".8"><stop offset="0" stop-color="#f6cfa6"/><stop offset=".55" stop-color="#d9a273"/><stop offset="1" stop-color="#a66f45"/></radialGradient>
      <linearGradient id="trTo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3c79c"/><stop offset=".5" stop-color="#d9a273"/><stop offset="1" stop-color="#a87148"/></linearGradient></defs>`;
    document.body.appendChild(d);
  }
  function mount(root) {
    trDefs();
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
      root.querySelectorAll(".tr-ex").forEach((el) => { const s = svgOf(EX[el.dataset.k]); el.querySelector(".tr-fw").appendChild(s); watch(s); });
    };
    const sheet = (k) => {
      const e = EX[k], o = document.createElement("div"); o.className = "tr-sh";
      o.innerHTML = `<div class="tr-shb" role="dialog" aria-modal="true"><button type="button" class="tr-x" aria-label="سكّر">✕</button><div class="tr-big"></div><h3>${esc(e.n)}</h3><ol>${e.how.map((x) => `<li>${esc(x)}</li>`).join("")}</ol><div class="tr-err">⚠️ ${esc(e.err)}</div></div>`;
      const s = svgOf(e, true); o.querySelector(".tr-big").appendChild(s); document.body.appendChild(o); watch(s); requestAnimationFrame(() => o.classList.add("on"));
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
  window.KOTrain = { mount, EX, PROGS, _fk: { fk, place, frame, mix, svgOf, draw, trDefs } };
})();
