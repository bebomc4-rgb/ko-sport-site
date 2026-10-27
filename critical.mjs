// critical.mjs — يطلّع من store.css بس القواعد يلي بتلزم لأول رسمة للصفحة (الهيدر، السلايدر، الفوتر، الألوان والثيمات)
// السيرفر بيحطها جوّا الصفحة، وباقي الملف بينزل بعدها. بلا مكتبات خارجية.
// القاعدة بتنحفظ إذا كل الكلاسات والـ ids يلي فيها موجودين بالـ HTML يلي بيرسمو السيرفر (index.html + قوالب _worker.js).
// أي شي مشكوك فيه (attributes، :is/:has، ثيمات على html) بينحفظ احتياطاً، فأول رسمة دايماً صح.

// كلاسات بيركّبها السيرفر بالكود (مو مكتوبة كاملة بنص واحد)
const EXTRA = ["sh-full", "sh-round", "sh-curve", "sh-peek", "has-img", "hero-stats", "logo-ko", "logo-sport", "ann-x", "hsec", "hs-slider",
  "slider", "sl-track", "slide", "sl-text", "sl-btns", "btn", "btn-red", "btn-light", "hero", "loading", "ssr", "ssr-l", "on", "reduce", "anim", "small",
  // شريط التنقل تحت: بينرسم من نسخة محفوظة قبل أول رسمة
  "bn-fx", "bn-cur-ic", "bn-dark", "bn-cur", "bn-hide", "sun", "moon", "lb-day", "lb-night", "hint", "syp"];

// wordSources: scripts that may add elements before the full stylesheet arrives (fx.js, media.js, pwa.js):
// every word in them counts as a possible class name, to be safe.
export function criticalCss(css, htmlSources, extra = [], wordSources = []) {
  const tokens = new Set([...EXTRA, ...extra]);
  const prefixes = [];
  for (const src of wordSources) for (const line of src.split("\n")) {
    if (!/class/i.test(line)) continue; // className = "…" / classList.add("…") / class="…"
    for (const m of line.matchAll(/["'`]([^"'`]*)["'`]/g)) for (const w of m[1].split(/\s+/)) {
      if (/^[A-Za-z_][\w-]*-$/.test(w)) prefixes.push(w); else if (/^[A-Za-z_][\w-]*$/.test(w)) tokens.add(w);
    }
  }
  tokens.has = ((has) => (t) => has(t) || prefixes.some((p) => t.startsWith(p)))(tokens.has.bind(tokens));
  for (const src of htmlSources) {
    // class="…" / class=\"…\" بقوالب السيرفر و index.html
    for (const m of src.matchAll(/class=\\?"([^"\\]*)/g)) for (const w of m[1].replace(/\$\{[^}]*\}?/g, " ").split(/\s+/)) if (w) tokens.add(w);
    for (const m of src.matchAll(/\bid="([\w-]+)"/g)) tokens.add(m[1]);
  }
  const nodes = parse(css);
  const keep = filter(nodes, tokens);
  // @keyframes بس يلي القواعد المحفوظة بتستعملها
  const used = new Set();
  const scanAnim = (list) => { for (const n of list) { if (n.type === "rule") for (const m of n.body.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) for (const w of m[1].split(/[\s,]+/)) used.add(w); else if (n.children) scanAnim(n.children); } };
  scanAnim(keep);
  const out = (list) => list.map((n) => {
    if (n.type === "rule") return `${n.sel}{${n.body}}`;
    if (n.type === "stmt") return n.text;
    if (n.children) return `${n.prelude}{${out(n.children)}}`;
    if (/^@(-webkit-)?keyframes\s/i.test(n.prelude)) return used.has(n.prelude.split(/\s+/)[1]) ? `${n.prelude}{${n.body}}` : "";
    return `${n.prelude}{${n.body}}`;
  }).join("");
  return out(keep);
}

function filter(nodes, tokens) {
  const res = [];
  for (const n of nodes) {
    if (n.type === "rule") {
      const parts = splitTop(n.sel, ",").filter((p) => ok(p, tokens));
      if (parts.length) res.push({ ...n, sel: parts.join(",") });
    } else if (n.children) {
      const ch = filter(n.children, tokens);
      if (ch.length) res.push({ ...n, children: ch });
    } else res.push(n);
  }
  return res;
}

// كل .class و #id برّا [..] وبرّا :not()/:is()/:where()/:has() لازم يكون موجود
function ok(sel, tokens) {
  let s = sel, out = "", depth = 0, br = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "[") br++; else if (c === "]") br--;
    else if (c === "(") depth++; else if (c === ")") depth--;
    else if (!br && !depth) { out += c; continue; }
    out += " ";
  }
  for (const m of out.matchAll(/([.#])(-?[_a-zA-Z\u00A0-\uFFFF][\w\u00A0-\uFFFF-]*)/g)) if (!tokens.has(m[2])) return false;
  return true;
}

function splitTop(s, ch) {
  const parts = []; let depth = 0, br = 0, q = null, cur = "";
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { cur += c; if (c === "\\") { cur += s[++i] || ""; } else if (c === q) q = null; continue; }
    if (c === '"' || c === "'") { q = c; cur += c; continue; }
    if (c === "(") depth++; else if (c === ")") depth--; else if (c === "[") br++; else if (c === "]") br--;
    if (c === ch && !depth && !br) { parts.push(cur.trim()); cur = ""; continue; }
    cur += c;
  }
  if (cur.trim()) parts.push(cur.trim());
  return parts;
}

// محلّل CSS صغير: قواعد، @media/@supports/@container/@layer (فيهن قواعد)، وباقي الـ @ متل ما هي
function parse(css) {
  let i = 0;
  const n = css.length;
  const skipWsComments = () => { for (;;) { while (i < n && /\s/.test(css[i])) i++; if (css.startsWith("/*", i)) { const e = css.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; } else break; } };
  const readUntil = (stops) => { // نص لحد { أو ; أو } (برّا النصوص والأقواس)
    let s = "", depth = 0, q = null;
    while (i < n) {
      const c = css[i];
      if (q) { s += c; if (c === "\\") { s += css[i + 1] || ""; i += 2; continue; } if (c === q) q = null; i++; continue; }
      if (c === '"' || c === "'") { q = c; s += c; i++; continue; }
      if (css.startsWith("/*", i)) { const e = css.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
      if (c === "(") depth++; else if (c === ")") depth--;
      if (!depth && stops.includes(c)) break;
      s += c; i++;
    }
    return s.trim();
  };
  const readBlockBody = () => { // بعد { لحد } المطابق
    let s = "", depth = 1, q = null;
    while (i < n) {
      const c = css[i];
      if (q) { s += c; if (c === "\\") { s += css[i + 1] || ""; i += 2; continue; } if (c === q) q = null; i++; continue; }
      if (c === '"' || c === "'") { q = c; s += c; i++; continue; }
      if (css.startsWith("/*", i)) { const e = css.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; continue; }
      if (c === "{") depth++;
      else if (c === "}") { depth--; if (!depth) { i++; break; } }
      s += c; i++;
    }
    return s;
  };
  const block = (top) => {
    const list = [];
    for (;;) {
      skipWsComments();
      if (i >= n) break;
      if (css[i] === "}") { if (!top) { i++; break; } i++; continue; }
      const prelude = readUntil(["{", ";", "}"]);
      if (css[i] === ";") { i++; if (prelude) list.push({ type: "stmt", text: prelude + ";" }); continue; }
      if (css[i] === "}") { continue; }
      i++; // {
      if (/^@(media|supports|container|layer|document)\b/i.test(prelude)) list.push({ type: "at", prelude, children: block(false) });
      else if (prelude.startsWith("@")) list.push({ type: "at", prelude, body: readBlockBody() });
      else list.push({ type: "rule", sel: prelude, body: readBlockBody().trim() });
    }
    return list;
  };
  return block(true);
}
