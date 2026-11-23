/* أيقونات مكتبة التمارين (21/11/2026): مجسّم للعضلة المشغّلة (بتنبض بالذهبي) ورمز لكل أداة.
   مرسومة بالكود (SVG)، بلا صور ولا مكتبات. بتنحمّل بس لما تنفتح #/exlib (store.js: exlLoad).
   window.KOExl.m(مفتاح العضلة) و window.KOExl.e(مفتاح الأداة) بيرجعو نص SVG. */
(function () {
  "use strict";
  // جسم بشري مبسّط (40×56): الرأس والجذع والأطراف بشفافية، والعضلة المشغّلة فوقو بصنف hi (لونو من CSS: --exl-hi)
  var BASE = '<g class="bd"><circle cx="20" cy="6" r="4.2"/><path d="M12 14.5Q20 12 28 14.5L26.5 34Q20 36.5 13.5 34Z"/>' +
    '<path fill="none" stroke-width="4.4" stroke-linecap="round" d="M9.5 16.5 6.5 27 5.5 38M30.5 16.5 33.5 27 34.5 38M16.5 37 15.5 46 15.5 55M23.5 37 24.5 46 24.5 55"/></g>';
  var ARMS_UP = '<path d="M8.8 19 7.2 25.5M31.2 19 32.8 25.5" fill="none" stroke-width="3.8"/>';
  var THIGH = '<path d="M16.3 39.5 15.7 45.5M23.7 39.5 24.3 45.5" fill="none" stroke-width="4.2"/>';
  var CALF = '<path d="M15.5 48.5 15.5 53.5M24.5 48.5 24.5 53.5" fill="none" stroke-width="3.6"/>';
  var FRONT = {
    Chest: '<ellipse cx="15.5" cy="19.5" rx="5" ry="3.6"/><ellipse cx="24.5" cy="19.5" rx="5" ry="3.6"/>',
    Shoulders: '<circle cx="10.2" cy="16.4" r="3.4"/><circle cx="29.8" cy="16.4" r="3.4"/>',
    Biceps: ARMS_UP, "Upper Arms": ARMS_UP,
    Forearms: '<path d="M6.2 29.5 5.5 37M33.8 29.5 34.5 37" fill="none" stroke-width="3.6"/>',
    Waist: '<rect x="16" y="24.5" width="8" height="10" rx="3"/>',
    Hips: '<ellipse cx="20" cy="36.5" rx="7.5" ry="3"/>',
    Quadriceps: THIGH, Thighs: THIGH, Calves: CALF,
    Neck: '<rect x="17.2" y="9.8" width="5.6" height="4.6" rx="2"/><path d="M14 14.5 20 13 26 14.5 20 16Z"/>'
  };
  var BACK = {
    Back: '<path d="M13 15.5Q20 13.5 27 15.5L25 31Q20 33 15 31Z"/>',
    Triceps: ARMS_UP,
    Hamstrings: THIGH
  };
  var SPECIAL = {
    Cardio: '<path class="hi pulse" d="M20 44C7 34 8 20 15.5 20 17.5 20 19.3 21.2 20 23 20.7 21.2 22.5 20 24.5 20 32 20 33 34 20 44Z"/>',
    "Full Body": '<g class="hi"><circle cx="20" cy="6" r="4.2"/><path d="M12 14.5Q20 12 28 14.5L26.5 34Q20 36.5 13.5 34Z"/><path fill="none" stroke-width="4.4" stroke-linecap="round" d="M9.5 16.5 6.5 27 5.5 38M30.5 16.5 33.5 27 34.5 38M16.5 37 15.5 46 15.5 55M23.5 37 24.5 46 24.5 55"/></g>',
    Plyometrics: '<g class="hi"><path d="M20 6 11 20h6v16h6V20h6Z"/><path fill="none" stroke-width="3" stroke-linecap="round" d="M7 47h26"/></g>',
    Stretching: '<g class="hi"><circle cx="20" cy="12" r="3.6"/><path fill="none" stroke-width="4" stroke-linecap="round" d="M20 19V37M20 23 10 9M20 23 30 9M20 37 13 53M20 37 27 53"/></g>',
    Yoga: '<g class="hi"><circle cx="20" cy="13" r="3.8"/><path fill="none" stroke-width="4" stroke-linecap="round" d="M20 20V33M20 24 11 37M20 24 29 37M7 45Q20 35 33 45"/></g>',
    Weightlifting: '<g class="hi"><path fill="none" stroke-width="3" stroke-linecap="round" d="M5 28H35"/><rect x="8" y="18" width="4" height="20" rx="1.5"/><rect x="28" y="18" width="4" height="20" rx="1.5"/><rect x="3" y="23" width="3.2" height="10" rx="1"/><rect x="33.8" y="23" width="3.2" height="10" rx="1"/></g>',
    Other: '<g class="hi"><circle cx="9" cy="28" r="3.2"/><circle cx="20" cy="28" r="3.2"/><circle cx="31" cy="28" r="3.2"/></g>'
  };
  // صور حقيقية (أيقونات صاحب المتجر 21/11/2026) بـ /assets/exl/: لما تتوفر صورة للمفتاح بتنعرض، وإلا بيرجع الرسم SVG
  var PM = { Back: "Back", Biceps: "Biceps", "Upper Arms": "Biceps", Calves: "Calves", Cardio: "Cardio", Chest: "Chest", Forearms: "Forearms", Hamstrings: "Hamstrings", Hips: "Hips", Neck: "Neck", Quadriceps: "Quadriceps", Thighs: "Quadriceps", Shoulders: "Shoulders", Triceps: "Triceps", Waist: "Waist" };
  var PE = { Band: "Band", Barbell: "Barbell", "Olympic barbell": "Barbell", "Battling Rope": "Battling_Rope", "Body weight": "Body_weight", "Bosu ball": "Bosu_ball", Cable: "Cable", Dumbbell: "Dumbbell", "EZ Barbell": "EZ_Barbell", Kettlebell: "Kettlebell", "Leverage machine": "Leverage_machine", "Medicine Ball": "Medicine_Ball", "Power Sled": "Power_Sled", "Resistance Band": "Resistance_Band", Roll: "Roll", Rollball: "Rollball", Rope: "Rope", "Sled machine": "Sled_machine", "Smith machine": "Smith_machine", "Stability ball": "Stability_ball", Suspension: "Suspension", "Trap bar": "Trap_bar", Weighted: "Weighted", "Wheel roller": "Wheel_roller" };
  function ph(t, f) { return '<img class="exl-ph exl-p' + t + '" src="/assets/exl/' + t + "_" + f + '.webp?v=365" alt="" width="192" height="192" loading="lazy" decoding="async">'; }
  function m(k) {
    if (PM[k]) return ph("m", PM[k]);
    var inner;
    if (SPECIAL[k]) inner = SPECIAL[k];
    else if (BACK[k]) inner = BASE + '<g class="hi">' + BACK[k] + "</g>";
    else inner = BASE + '<g class="hi">' + (FRONT[k] || FRONT.Chest) + "</g>";
    return '<svg class="exl-sv exl-sm" viewBox="0 0 40 56" aria-hidden="true" focusable="false">' + inner + "</svg>";
  }
  var DB = '<path d="M8 12h8M5.5 8v8M8 6v12M18.5 8v8M16 6v12"/>';
  var E = {
    Barbell: '<path d="M3 12h18M6 7v10M18 7v10M3.5 9.5v5M20.5 9.5v5"/>',
    "Olympic barbell": '<path d="M2 12h20M7 5v14M17 5v14M4.5 8v8M19.5 8v8"/>',
    "EZ Barbell": '<path d="M3 12h3.5l2-2.5 3 5 3-5 2 2.5H21M5 8v8M19 8v8"/>',
    "Trap bar": '<path d="M7 5h10l3 7-3 7H7l-3-7zM2 12h2M20 12h2"/>',
    "Smith machine": '<path d="M5 3v18M19 3v18M2.5 14h19M9 14v-3M15 14v-3"/>',
    Dumbbell: DB,
    Hammer: '<rect x="5" y="4" width="14" height="5" rx="1"/><path d="M12 9v11"/>',
    Kettlebell: '<path d="M8.5 9.5V8a3.5 3.5 0 0 1 7 0v1.5"/><circle cx="12" cy="15" r="5.5"/>',
    Cable: '<circle cx="12" cy="5" r="2.5"/><path d="M12 7.5V15M9 15h6l-1 5h-4z"/>',
    "Leverage machine": '<path d="M4 20h16M7 20V6h6M7 12h10l3 4M17 12v8"/>',
    "Cardio machine": '<path d="M3 18h14l3-3M5 18v3M15 18v3M17 15V6h3"/><circle cx="10" cy="4.3" r="1.6"/><path d="M10 6.4 9.3 11l2.2 3-.5 3.8M9.3 11l-1.8 2.6L6 16.8M9.8 8l2.7 1.6M9.8 8 7.4 9.6"/>',
    "Sled machine": '<path d="M3 17h18M4 17c0 2 1 3 3 3M6 17l2-7h8l2 7M10 10V6M14 10V6"/>',
    "Power Sled": '<path d="M3 18h18M4 18c0 2 1 3 3 3M7 18l1.5-6h7L17 18M9 12V7M15 12V7M7 7h10"/>',
    Band: '<ellipse cx="12" cy="12" rx="8" ry="4.5"/><circle cx="4" cy="12" r="1.6"/><circle cx="20" cy="12" r="1.6"/>',
    "Resistance Band": '<circle cx="4" cy="12" r="2"/><circle cx="20" cy="12" r="2"/><path d="M6 12c1.5-4 3-4 4 0s2.5 4 4 0 2-4 4 0"/>',
    "Battling Rope": '<path d="M3 8c3-3 5 3 9 0s6-3 9 0M3 15c3-3 5 3 9 0s6-3 9 0"/>',
    Rope: '<path d="M4 20c2-8 6-2 8-8s5 0 8-8M3 21l2-2M19 5l2-2"/>',
    "Body weight": '<circle cx="12" cy="5" r="2.2"/><path d="M12 8v7M7 11l5-2 5 2M9 21l3-6 3 6"/>',
    Assisted: '<circle cx="9" cy="6" r="2"/><path d="M9 9v6M5 12l4-2 4 2M7 21l2-6 2 6M19 20V8M16 11l3-3 3 3"/>',
    "Bosu ball": '<path d="M3 17a9 8 0 0 1 18 0zM3 20h18"/>',
    "Medicine Ball": '<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c-3 3-3 14 0 17M12 3.5c3 3 3 14 0 17"/>',
    "Stability ball": '<circle cx="12" cy="12" r="9"/><path d="M5 8c4 2 10 2 14 0M5 16c4-2 10-2 14 0"/>',
    Rollball: '<circle cx="12" cy="12" r="5.5"/><path d="M8 10c2 1 6 1 8 0"/>',
    Roll: '<rect x="3" y="8" width="18" height="8" rx="4"/><path d="M8 8v8M12 8v8M16 8v8"/>',
    Stick: '<path d="M4 20 20 4M3 21l2-2"/>',
    Suspension: '<path d="M12 3v3M5 6h14M7 6l-2 14M17 6l2 14M4.5 20h3M16.5 20h3"/>',
    "Vibrate Plate": '<rect x="4" y="14" width="16" height="4" rx="1.5"/><path d="M8 10V8M12 11V6M16 10V8"/>',
    Weighted: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2.5"/>',
    "Wheel roller": '<circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="1.5"/><path d="M2 12h4M18 12h4"/>'
  };
  function e(k) {
    if (PE[k]) return ph("e", PE[k]);
    return '<svg class="exl-sv exl-se" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' + (E[k] || DB) + "</svg>";
  }
  window.KOExl = { m: m, e: e };
})();
