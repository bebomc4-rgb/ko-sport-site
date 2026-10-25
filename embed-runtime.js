
const __EMB_CACHE = new Map();
function __embGet(p) {
  let e = __EMB[p]; if (!e && p.endsWith("/")) e = __EMB[(p = p + "index.html")];
  if (!e && !/\.[a-z0-9]+$/i.test(p) && __EMB[p + ".html"]) e = __EMB[(p = p + ".html")];
  if (!e) return null;
  let bytes = __EMB_CACHE.get(p);
  if (!bytes) { const s = atob(e[0]); bytes = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i); __EMB_CACHE.set(p, bytes); }
  return { bytes, type: e[1], etag: e[2] };
}
function __embAssets(real) {
  return {
    async fetch(req, init) {
      const r = typeof req === "string" || req instanceof URL ? new Request(req, init) : req;
      const m = r.method || "GET";
      if (m === "GET" || m === "HEAD") {
        const f = __embGet(new URL(r.url).pathname);
        if (f) {
          const h = { "content-type": f.type, etag: f.etag };
          if (r.headers.get("if-none-match") === f.etag) return new Response(null, { status: 304, headers: h });
          return new Response(m === "HEAD" ? null : f.bytes, { status: 200, headers: h });
        }
      }
      if (real && real.fetch) return real.fetch(req, init);
      return new Response("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
    },
  };
}
