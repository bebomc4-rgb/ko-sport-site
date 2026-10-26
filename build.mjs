// build.mjs — يبني الموقع: src → dist/_worker.js (كل الملفات جوّا ملف واحد) → ko-sport.zip
// التشغيل:  node build.mjs        (بيحتاج Node 18+؛ esbuild بينزل لحاله أول مرة عن طريق npx)
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto"; import { execSync } from "node:child_process";
const root = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const src = path.join(root, "src"), tmp = path.join(root, ".build"), out = path.join(root, "dist");
fs.rmSync(tmp, { recursive: true, force: true }); fs.cpSync(src, tmp, { recursive: true });
// 1) minify js/css
const min = [...fs.readdirSync(path.join(tmp, "assets")).filter((f) => /\.(js|css)$/.test(f)).map((f) => path.join(tmp, "assets", f)), path.join(tmp, "sw.js")];
const ESB = process.env.ESBUILD || "npx --yes esbuild@0.24.0";
let minOk = true;
for (const f of min) { if (!minOk) break; try { execSync(`${ESB} "${f}" --minify --charset=utf8 ${f.endsWith(".js") ? "--target=es2020" : ""} --allow-overwrite --outfile="${f}" --log-level=error`, { stdio: "inherit" }); } catch { minOk = false; console.warn("⚠️ ما قدرت صغّر الملفات (esbuild)، كمّلت بدون تصغير"); fs.rmSync(tmp, { recursive: true, force: true }); fs.cpSync(src, tmp, { recursive: true }); } }
// 2) embed every static file into _worker.js
const CT = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json; charset=utf-8", ".txt": "text/plain; charset=utf-8" };
const files = {};
const walk = (d) => { for (const n of fs.readdirSync(d)) { const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else { const rel = "/" + path.relative(tmp, p).split(path.sep).join("/"); if (rel === "/_worker.js" || !CT[path.extname(n)]) continue; const b = fs.readFileSync(p); files[rel] = [b.toString("base64"), CT[path.extname(n)], '"' + crypto.createHash("sha1").update(b).digest("hex").slice(0, 16) + '"']; } } };
walk(tmp);
let w = fs.readFileSync(path.join(tmp, "_worker.js"), "utf8");
const emb = "const __EMB = " + JSON.stringify(files) + ";\n" + fs.readFileSync(path.join(root, "embed-runtime.js"), "utf8");
const a = "    const env = Object.assign({}, rawEnv);\n";
if (!w.includes(a)) throw new Error("worker entry not found");
w = w.replace(a, a + "    env.ASSETS = __embAssets(rawEnv.ASSETS);\n");
// stamp the build time so /api/diag can say which copy is actually live
if (!w.includes("__BUILD_AT__")) throw new Error("build stamp placeholder not found");
w = w.replace("__BUILD_AT__", new Date().toISOString().slice(0, 16).replace("T", " ") + "Z");
fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, "_worker.js"), emb + w);
execSync(`node --check "${path.join(out, "_worker.js")}"`, { stdio: "inherit" });
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`✓ dist/_worker.js — ${Object.keys(files).length} files embedded, ${(fs.statSync(path.join(out, "_worker.js")).size / 1024).toFixed(0)} KB`);
console.log("للرفع: npx wrangler pages deploy dist --project-name ko-sport   (أو ارفع dist/_worker.js بملف zip من لوحة Cloudflare)");
