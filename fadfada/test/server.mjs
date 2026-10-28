// Local test server: runs public/_worker.js with an SQLite stand-in for D1 and a fake AI.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
const root = path.resolve(process.argv[2] || "public"), port = +process.argv[3] || 8790;
const worker = (await import(path.join(root, "_worker.js") + "?t=" + Date.now())).default;
const db = new DatabaseSync(process.env.DBFILE || ":memory:");
class Stmt {
  constructor(sql, args = []) { this.sql = sql; this.args = args; }
  bind(...a) { return new Stmt(this.sql, a); }
  async first() { return db.prepare(this.sql).get(...this.args) ?? null; }
  async all() { return { results: db.prepare(this.sql).all(...this.args) }; }
  async run() { const r = db.prepare(this.sql).run(...this.args); return { meta: { last_row_id: Number(r.lastInsertRowid), changes: r.changes } }; }
}
const DB = { prepare: (sql) => new Stmt(sql), async batch(list) { const out = []; for (const s of list) out.push(await s.run()); return out; } };
const AI = { async run(model, { messages }) { const last = messages[messages.length - 1].content; return { response: `(تجربة) سمعتك لما قلت «${last.slice(0, 40)}». كيف حاسس هلق؟` }; } };
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };
const ASSETS = { async fetch(req) { let p = new URL(req.url).pathname; if (p === "/") p = "/index.html"; const f = path.join(root, p); if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return new Response("not found", { status: 404 }); return new Response(fs.readFileSync(f), { headers: { "content-type": types[path.extname(f)] || "application/octet-stream" } }); } };
const env = { DB, AI, ASSETS, ADMIN_PASSWORD: "test123" };
http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const r = new Request("http://localhost:" + port + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : Buffer.concat(chunks) });
  try { const out = await worker.fetch(r, env, { waitUntil(p) { Promise.resolve(p).catch(() => {}); } }); res.writeHead(out.status, Object.fromEntries(out.headers)); res.end(Buffer.from(await out.arrayBuffer())); }
  catch (e) { console.error(e); res.writeHead(500); res.end(String(e)); }
}).listen(port, () => console.log("up", port));
