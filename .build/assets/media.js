/* KO SPORT media engine
 *  1) videos from almost any link (YouTube, Vimeo, Facebook, Instagram, TikTok, Dailymotion, Twitch, Streamable,
 *     Google Drive, Loom, X, direct .mp4/.webm/.m3u8 files and uploaded files) that start by themselves when they appear
 *  2) background music (direct audio file, uploaded file or YouTube link) with a small mute button
 *  3) UI sound effects made in the browser (no files to download)
 * Browsers only allow SOUND after the visitor has touched the page once. Until then videos start muted with a
 * "tap for sound" button, and the first tap anywhere turns the sound on.
 */
(() => {
  "use strict";
  if (window.KOMedia) return;
  const KO = (window.KOMedia = {});
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };

  // ---------- link recognition ----------
  const FILE_V = /\.(mp4|m4v|webm|ogv|mov)(?=$|[?#])/i;
  const FILE_A = /\.(mp3|m4a|aac|ogg|oga|opus|wav|flac|weba)(?=$|[?#])/i;
  const NAMES = { yt: "YouTube", vimeo: "Vimeo", fb: "Facebook", ig: "Instagram", tt: "TikTok", dm: "Dailymotion", tw: "Twitch", st: "Streamable", gd: "Drive", loom: "Loom", x: "X", file: "ملف", hls: "بث", frame: "رابط" };
  function ytTime(v) {
    if (!v) return 0;
    if (/^\d+$/.test(v)) return +v;
    const m = String(v).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
    return m ? (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0) : 0;
  }
  function parse(raw) {
    let u = String(raw || "").trim();
    if (!u) return null;
    if (/^\/media\/[a-z0-9]+$/i.test(u)) return { kind: "file", src: u };
    if (/^(javascript|data|vbscript|blob|file):/i.test(u)) return null;
    if (/^\/\//.test(u)) u = "https:" + u;
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(u)) u = "https://" + u.replace(/^\/+/, "");
    u = u.replace(/^http:\/\//i, "https://");
    let x; try { x = new URL(u); } catch { return null; }
    const h = x.hostname.toLowerCase().replace(/^(www|m|music|web|mobile)\./, ""), p = x.pathname, q = x.searchParams;
    let m;
    if (h === "youtu.be" || h === "youtube.com" || h === "youtube-nocookie.com") {
      let id = h === "youtu.be" ? p.slice(1).split("/")[0] : q.get("v") || ((m = p.match(/^\/(?:shorts|embed|live|v)\/([\w-]{11})/)) && m[1]) || "";
      id = /^[\w-]{11}$/.test(id) ? id : "";
      const list = /^[\w-]{10,60}$/.test(q.get("list") || "") ? q.get("list") : "";
      if (id || list) return { kind: "yt", id, list, start: ytTime(q.get("t") || q.get("start")), vertical: /^\/shorts\//.test(p) };
    }
    if (h === "vimeo.com" || h === "player.vimeo.com") {
      m = p.match(/(?:video\/|^\/(?:channels\/[^/]+\/|groups\/[^/]+\/videos\/)?)(\d{6,})(?:\/([0-9a-f]{6,}))?/);
      if (m) return { kind: "vimeo", id: m[1], hash: m[2] || q.get("h") || "" };
    }
    if (h === "facebook.com" || h === "fb.watch" || h === "fb.com") return { kind: "fb", href: u };
    if (h === "instagram.com" && (m = p.match(/\/(p|reels?|tv)\/([\w-]+)/))) return { kind: "ig", src: `https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/embed`, vertical: true };
    if (h === "tiktok.com" && (m = p.match(/\/video\/(\d+)/))) return { kind: "tt", id: m[1], vertical: true };
    if (h === "dailymotion.com" && (m = p.match(/\/video\/([a-z0-9]+)/i))) return { kind: "dm", id: m[1] };
    if (h === "dai.ly") return { kind: "dm", id: p.slice(1).split("/")[0] };
    if (h === "twitch.tv" || h === "clips.twitch.tv") {
      if ((m = p.match(/\/videos\/(\d+)/))) return { kind: "tw", qs: "video=v" + m[1] };
      if (h === "clips.twitch.tv" && (m = p.match(/^\/([\w-]+)/))) return { kind: "tw", clip: m[1] };
      if ((m = p.match(/\/clip\/([\w-]+)/))) return { kind: "tw", clip: m[1] };
      if ((m = p.match(/^\/([\w]+)\/?$/))) return { kind: "tw", qs: "channel=" + m[1] };
    }
    if (h === "streamable.com" && (m = p.match(/^\/(?:e\/)?([a-z0-9]+)/i))) return { kind: "st", id: m[1] };
    if (h === "drive.google.com" && (m = p.match(/\/file\/d\/([\w-]+)/))) return { kind: "gd", id: m[1] };
    if (h === "loom.com" && (m = p.match(/\/(?:share|embed)\/([a-f0-9]+)/i))) return { kind: "loom", id: m[1] };
    if ((h === "x.com" || h === "twitter.com") && (m = p.match(/\/status\/(\d+)/))) return { kind: "x", id: m[1] };
    if (/\.m3u8(?=$|[?#])/i.test(p)) return { kind: "hls", src: u };
    if (FILE_V.test(p) || FILE_A.test(p)) return { kind: "file", src: u };
    return { kind: "frame", src: u };
  }
  KO.parse = parse;
  KO.kindName = (u) => { const d = parse(u); return d ? NAMES[d.kind] || "" : ""; };

  // ---------- lazy third-party scripts ----------
  const loaded = {};
  function loadScript(src) {
    return (loaded[src] ||= new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.async = true; s.onload = res; s.onerror = () => rej(new Error("load " + src)); document.head.appendChild(s); }));
  }
  let ytReady;
  function ytApi() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    return (ytReady ||= new Promise((res, rej) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { try { prev && prev(); } catch {} res(window.YT); };
      loadScript("https://www.youtube.com/iframe_api").catch(rej);
    }));
  }

  // ---------- has the visitor touched the page yet? ----------
  let unlocked = !!(navigator.userActivation && navigator.userActivation.hasBeenActive);
  const unlockers = [];
  KO.onUnlock = (fn) => (unlocked ? fn() : unlockers.push(fn));
  KO.unlocked = () => unlocked;
  let firstTap = true;
  function unlock() {
    unlocked = true;
    if (firstTap) {
      firstTap = false;
      while (unlockers.length) { try { unlockers.shift()(); } catch {} }
      players.forEach((pl) => { if (pl.mounted && pl.muted && pl.opts.sound && pl.inView) soundOn(pl); });
    }
    music.forEach((m) => { if (!m.playing) m.apply(); });
  }
  ["pointerup", "touchend", "click", "keydown"].forEach((ev) => addEventListener(ev, (e) => { if (e.isTrusted) unlock(); }, { capture: true, passive: true }));

  // ---------- videos ----------
  const players = new Set();
  let audible = 0; // videos currently playing with sound → background music steps aside
  function setAudible(pl, on) { if (!!pl.audible === on) return; pl.audible = on; audible += on ? 1 : -1; music.forEach((m) => m.apply()); }
  KO.videoIsAudible = () => audible > 0;

  /** HTML for one video tile. Hydrated by KOMedia.scan(). opts: {auto, sound, loop, controls} */
  KO.video = function (url, opts) {
    const d = parse(url); if (!d) return "";
    opts = opts || {};
    const o = { auto: opts.auto !== false, sound: opts.sound !== false, loop: !!opts.loop, ctl: opts.controls !== false };
    const poster = d.kind === "yt" && d.id ? `<img class="vp-poster" src="https://i.ytimg.com/vi/${d.id}/hqdefault.jpg" alt="" loading="lazy" width="480" height="360">` : "";
    return `<div class="video vp${d.vertical && d.kind !== "yt" ? " tall" : ""}" data-vp="${esc(JSON.stringify({ d, o }))}">${poster}<span class="play" aria-label="تشغيل">▶</span></div>`;
  };

  const io = "IntersectionObserver" in window ? new IntersectionObserver((ents) => {
    ents.forEach((en) => {
      const pl = en.target.__vp; if (!pl) return;
      pl.inView = en.intersectionRatio >= 0.45;
      if (pl.inView) { if (!pl.mounted && pl.opts.auto) mount(pl, unlocked && pl.opts.sound); else resume(pl); }
      else if (en.intersectionRatio < 0.1) pause(pl);
    });
  }, { threshold: [0, 0.1, 0.45, 0.8], rootMargin: "120px 0px" }) : null;

  KO.scan = function (root) {
    $$("[data-vp]", root || document).forEach((el) => {
      if (el.__vp) return;
      let cfg; try { cfg = JSON.parse(el.dataset.vp); } catch { return; }
      const pl = { el, d: cfg.d, opts: cfg.o, mounted: false, muted: true, inView: false, node: null, api: null, audible: false };
      el.__vp = pl; players.add(pl);
      // a tap on the poster always starts it, with sound (a tap is allowed to)
      el.addEventListener("click", (e) => { if (pl.mounted || e.target.closest(".vp-snd")) return; mount(pl, true); });
      if (io && pl.opts.auto) io.observe(el);
    });
    // forget players whose page was replaced
    players.forEach((pl) => { if (!document.contains(pl.el)) { setAudible(pl, false); players.delete(pl); } });
  };

  function frameSrc(pl, muted) {
    const d = pl.d, o = pl.opts, m = muted ? 1 : 0, host = location.hostname;
    switch (d.kind) {
      case "vimeo": return `https://player.vimeo.com/video/${d.id}?${d.hash ? "h=" + d.hash + "&" : ""}autoplay=1&muted=${m}&playsinline=1&loop=${o.loop ? 1 : 0}&controls=${o.ctl ? 1 : 0}&dnt=1`;
      case "fb": return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(d.href)}&show_text=false&autoplay=true&mute=${m}`;
      case "ig": return d.src;
      case "tt": return `https://www.tiktok.com/embed/v2/${d.id}?autoplay=1&muted=${m}`;
      case "dm": return `https://www.dailymotion.com/embed/video/${d.id}?autoplay=1&mute=${m}&controls=${o.ctl ? 1 : 0}`;
      case "tw": return d.clip ? `https://clips.twitch.tv/embed?clip=${d.clip}&parent=${host}&autoplay=true&muted=${muted}` : `https://player.twitch.tv/?${d.qs}&parent=${host}&autoplay=true&muted=${muted}`;
      case "st": return `https://streamable.com/e/${d.id}?autoplay=1&muted=${m}&loop=${o.loop ? 1 : 0}`;
      case "gd": return `https://drive.google.com/file/d/${d.id}/preview`;
      case "loom": return `https://www.loom.com/embed/${d.id}?autoplay=1&muted=${m}&hide_owner=true&hide_share=true&hide_title=true`;
      case "x": return `https://platform.twitter.com/embed/Tweet.html?id=${d.id}`;
      default: return d.src;
    }
  }
  const ALLOW = "autoplay; fullscreen; encrypted-media; picture-in-picture; clipboard-write";

  function mount(pl, withSound) {
    const el = pl.el, d = pl.d, o = pl.opts;
    if (pl.mounted) return;
    pl.mounted = true; pl.muted = !withSound;
    el.classList.add("on");
    const addBtn = () => {
      if (!o.sound || !pl.muted || el.querySelector(".vp-snd")) return;
      const b = document.createElement("button"); b.type = "button"; b.className = "vp-snd"; b.innerHTML = "🔊 <span>اضغط للصوت</span>";
      b.addEventListener("click", (e) => { e.stopPropagation(); soundOn(pl); });
      el.appendChild(b);
    };
    if (d.kind === "yt") {
      el.querySelector(".play") && el.querySelector(".play").remove();
      const holder = document.createElement("div"); holder.className = "vp-yt"; el.appendChild(holder); pl.node = holder;
      ytApi().then((YT) => {
        if (!pl.mounted) return;
        const vars = { autoplay: 1, mute: pl.muted ? 1 : 0, playsinline: 1, rel: 0, modestbranding: 1, controls: o.ctl ? 1 : 0, start: d.start || 0, origin: location.origin };
        if (o.loop && d.id) { vars.loop = 1; vars.playlist = d.id; }
        if (d.list) { vars.listType = "playlist"; vars.list = d.list; if (o.loop) vars.loop = 1; }
        pl.api = new YT.Player(holder, {
          host: "https://www.youtube-nocookie.com", ...(d.id ? { videoId: d.id } : {}), width: "100%", height: "100%", playerVars: vars,
          events: {
            onReady: (e) => { try { if (pl.muted) { e.target.mute(); addBtn(); } else { e.target.unMute(); e.target.setVolume(100); } if (pl.inView || !io) e.target.playVideo(); } catch {} },
            onStateChange: (e) => { setAudible(pl, !pl.muted && e.data === 1); },
            onAutoplayBlocked: () => { pl.muted = true; try { pl.api.mute(); pl.api.playVideo(); } catch {} addBtn(); },
          },
        });
      }).catch(() => { holder.remove(); pl.mounted = false; frameFallback(pl); });
      return;
    }
    if (d.kind === "file" || d.kind === "hls") {
      el.querySelector(".play") && el.querySelector(".play").remove();
      const v = document.createElement("video");
      v.playsInline = true; v.setAttribute("playsinline", ""); v.preload = "auto"; v.loop = !!o.loop; v.controls = o.ctl; v.muted = pl.muted; v.autoplay = true;
      el.appendChild(v); pl.node = v;
      const src = d.src;
      const go = () => {
        if (d.kind === "hls" && !v.canPlayType("application/vnd.apple.mpegurl")) {
          loadScript("https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.13/hls.min.js").then(() => { if (window.Hls && Hls.isSupported()) { const h = new Hls(); h.loadSource(src); h.attachMedia(v); pl.hls = h; } else v.src = src; }).catch(() => { v.src = src; });
        } else v.src = src;
        const p = v.play(); if (p && p.catch) p.catch(() => { v.muted = true; pl.muted = true; v.play().catch(() => {}); addBtn(); });
      };
      v.addEventListener("playing", () => { setAudible(pl, !v.muted); if (v.muted) addBtn(); });
      v.addEventListener("pause", () => setAudible(pl, false));
      v.addEventListener("volumechange", () => { pl.muted = v.muted; if (!v.muted) { const b = el.querySelector(".vp-snd"); b && b.remove(); } setAudible(pl, !v.muted && !v.paused); });
      v.addEventListener("error", () => { el.classList.add("bad"); if (!el.querySelector(".vp-err")) { const s = document.createElement("div"); s.className = "vp-err"; s.textContent = "ما قدرنا نشغّل الفيديو"; el.appendChild(s); } });
      go();
      return;
    }
    // everything else: an iframe (muted until the visitor has touched the page)
    el.querySelector(".play") && el.querySelector(".play").remove();
    const f = document.createElement("iframe");
    f.src = frameSrc(pl, pl.muted); f.title = "video"; f.allow = ALLOW; f.allowFullscreen = true; f.setAttribute("referrerpolicy", "strict-origin-when-cross-origin");
    if (d.kind === "frame") f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox");
    el.appendChild(f); pl.node = f;
    if (d.kind === "vimeo") f.addEventListener("load", () => { f.contentWindow && f.contentWindow.postMessage(JSON.stringify({ method: "addEventListener", value: "play" }), "*"); });
    if (d.kind !== "x" && d.kind !== "gd" && d.kind !== "frame" && d.kind !== "ig") { addBtn(); }
    setAudible(pl, !pl.muted && ["vimeo", "fb", "tt", "dm", "tw", "st", "loom"].includes(d.kind));
  }
  function frameFallback(pl) {
    // YouTube's script did not load (blocked network): use a plain embed
    const d = pl.d, el = pl.el; if (pl.mounted) return;
    pl.mounted = true; pl.muted = !unlocked || !pl.opts.sound;
    const f = document.createElement("iframe");
    f.src = `https://www.youtube-nocookie.com/embed/${d.id || ""}?autoplay=1&mute=${pl.muted ? 1 : 0}&playsinline=1&rel=0${d.list ? "&listType=playlist&list=" + d.list : ""}`;
    f.title = "video"; f.allow = ALLOW; f.allowFullscreen = true; el.appendChild(f); pl.node = f; pl.api = null;
    setAudible(pl, !pl.muted);
  }
  function unmount(pl) {
    if (!pl.mounted) return;
    setAudible(pl, false);
    try { pl.api && pl.api.destroy && pl.api.destroy(); } catch {}
    try { pl.hls && pl.hls.destroy(); } catch {}
    pl.api = null; pl.hls = null; pl.node = null; pl.mounted = false;
    pl.el.classList.remove("on", "bad");
    [...pl.el.children].forEach((c) => { if (!c.classList.contains("vp-poster")) c.remove(); });
    if (!pl.el.querySelector(".play")) pl.el.insertAdjacentHTML("beforeend", '<span class="play" aria-label="تشغيل">▶</span>');
  }
  function pause(pl) {
    if (!pl.mounted) return;
    const d = pl.d;
    if (d.kind === "yt") { try { pl.api && pl.api.pauseVideo && pl.api.pauseVideo(); } catch {} }
    else if (d.kind === "file" || d.kind === "hls") { try { pl.node.pause(); } catch {} }
    else if (d.kind === "vimeo") { try { pl.node.contentWindow.postMessage(JSON.stringify({ method: "pause" }), "*"); } catch {} }
    else unmount(pl); // other embeds can't be paused from outside: close them so they don't keep playing
    setAudible(pl, false);
  }
  function resume(pl) {
    if (!pl.mounted || !pl.inView) return;
    const d = pl.d;
    if (d.kind === "yt") { try { pl.api && pl.api.playVideo && pl.api.playVideo(); } catch {} }
    else if (d.kind === "file" || d.kind === "hls") { try { const p = pl.node.play(); p && p.catch && p.catch(() => {}); } catch {} }
    else if (d.kind === "vimeo") { try { pl.node.contentWindow.postMessage(JSON.stringify({ method: "play" }), "*"); } catch {} }
  }
  function soundOn(pl) {
    if (!pl.mounted) return;
    const d = pl.d, btn = pl.el.querySelector(".vp-snd");
    if (d.kind === "yt" && pl.api && pl.api.unMute) { try { pl.api.unMute(); pl.api.setVolume(100); pl.api.playVideo(); pl.muted = false; btn && btn.remove(); setAudible(pl, true); } catch {} return; }
    if (d.kind === "file" || d.kind === "hls") { try { pl.node.muted = false; pl.node.volume = 1; const p = pl.node.play(); p && p.catch && p.catch(() => {}); pl.muted = false; btn && btn.remove(); } catch {} return; }
    if (d.kind === "vimeo") { try { const w = pl.node.contentWindow; w.postMessage(JSON.stringify({ method: "setMuted", value: false }), "*"); w.postMessage(JSON.stringify({ method: "setVolume", value: 1 }), "*"); w.postMessage(JSON.stringify({ method: "play" }), "*"); pl.muted = false; btn && btn.remove(); setAudible(pl, true); } catch {} return; }
    // other embeds: reload them without the mute flag (allowed now that the visitor tapped)
    unmount(pl); mount(pl, true);
  }

  // ---------- background music ----------
  const music = new Set();
  /** Music controller. cfg: {src, volume 0-100, loop}. opts: {button, persist} */
  KO.music = function (cfg, opts) {
    opts = opts || {};
    const m = { cfg, playing: false, off: opts.persist && opts.button !== false && lsGet("ko_music") === "off", ducked: false, ready: false, err: false, onstate: null, destroyed: false };
    const d = parse(cfg.src);
    const vol = Math.min(1, Math.max(0, (cfg.volume == null || cfg.volume === "" ? 40 : +cfg.volume) / 100));
    const loop = cfg.loop !== false;
    let el = null, yt = null, ytHolder = null, ytWant = false, fade = 0, btn = null;
    const active = () => (isYT ? ytWant : !!el && !el.paused);
    const isYT = d && d.kind === "yt";
    const emit = () => { if (btn) { btn.classList.toggle("on", m.playing); btn.classList.toggle("off", m.off); const duck = !m.off && audible > 0; btn.classList.toggle("duck", duck); btn.classList.toggle("wait", !m.off && !m.playing && !m.err && !duck); btn.setAttribute("aria-pressed", String(m.playing)); } m.onstate && m.onstate(m); };
    function ramp(to, ms) {
      clearInterval(fade);
      const set = (v) => { try { if (el) el.volume = Math.min(1, Math.max(0, v)); if (yt && yt.setVolume) yt.setVolume(Math.round(Math.min(1, Math.max(0, v)) * 100)); } catch {} };
      const from = el ? el.volume : 0, t0 = Date.now();
      fade = setInterval(() => { const k = Math.min(1, (Date.now() - t0) / ms); set(from + (to - from) * k); if (k >= 1) clearInterval(fade); }, 50);
    }
    function make() {
      if (m.ready || !d) return;
      m.ready = true;
      if (isYT) return; // created on the first tap
      el = new Audio(); el.preload = "auto"; el.loop = loop; el.volume = 0; el.src = d.src || cfg.src;
      el.addEventListener("error", () => { m.err = true; m.playing = false; emit(); });
      el.addEventListener("playing", () => { m.playing = true; emit(); });
      el.addEventListener("pause", () => { m.playing = false; emit(); });
      el.addEventListener("ended", () => { if (!loop) { m.playing = false; emit(); } });
    }
    function makeYT() {
      if (yt || !isYT) return;
      const holder = (ytHolder = document.createElement("div")); holder.className = "snd-yt"; holder.innerHTML = "<div></div>"; document.body.appendChild(holder);
      ytApi().then((YT) => {
        if (m.destroyed) return;
        const vars = { autoplay: 1, playsinline: 1, controls: 0, rel: 0, origin: location.origin };
        if (d.id) { vars.loop = 1; vars.playlist = d.id; } else { vars.listType = "playlist"; vars.list = d.list; vars.loop = 1; }
        yt = new YT.Player(holder.firstChild, {
          host: "https://www.youtube-nocookie.com", ...(d.id ? { videoId: d.id } : {}), width: 200, height: 200, playerVars: vars,
          events: {
            onReady: (e) => { try { e.target.setVolume(0); e.target.unMute(); if (ytWant) { e.target.playVideo(); ramp(vol, 1200); } } catch {} },
            onStateChange: (e) => { if (e.data === 1) { m.playing = true; emit(); } else if (e.data === 2 || e.data === -1) { /* paused / unstarted */ } if (e.data === 0 && loop) { try { e.target.playVideo(); } catch {} } },
            onError: () => { m.err = true; emit(); },
          },
        });
      }).catch(() => { m.err = true; emit(); });
    }
    function play() {
      if (!d || m.err) return;
      make();
      if (isYT) {
        ytWant = true; makeYT();
        if (yt && yt.playVideo) { try { yt.unMute(); yt.playVideo(); ramp(vol, 1200); } catch {} }
        emit(); return;
      }
      const p = el.play();
      ramp(vol, 1200);
      if (p && p.catch) p.catch((e) => { m.playing = false; if (e && e.name === "NotSupportedError") m.err = true; emit(); });
    }
    function stop() {
      ytWant = false; clearInterval(fade);
      try { if (el) el.pause(); if (yt && yt.pauseVideo) yt.pauseVideo(); } catch {}
      m.playing = false; emit();
    }
    m.apply = () => {
      if (m.destroyed) return;
      const should = !m.off && !m.err && !document.hidden && audible === 0 && (unlocked || !isYT);
      if (should && !m.playing && !active()) { m.autoAt = Date.now(); play(); } else if (!should && (m.playing || active())) stop();
      emit();
    };
    m.toggle = () => {
      if (m.err || Date.now() - (m.autoAt || 0) < 800) return; // the same tap just started it
      if (m.playing || active()) { m.off = true; if (opts.persist) lsSet("ko_music", "off"); stop(); }
      else { m.off = false; if (opts.persist) lsSet("ko_music", "on"); unlocked = true; play(); }
      emit();
    };
    m.destroy = () => { m.destroyed = true; stop(); music.delete(m); document.removeEventListener("visibilitychange", m.apply); try { if (el) { el.removeAttribute("src"); el.load(); } if (yt && yt.destroy) yt.destroy(); } catch {} ytHolder && ytHolder.remove(); btn && btn.remove(); };
    if (opts.button !== false && d) {
      btn = document.createElement("button"); btn.type = "button"; btn.className = "snd-btn"; btn.dataset.snd = "";
      btn.setAttribute("aria-label", "تشغيل أو إيقاف الموسيقى");
      btn.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path class="w1" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path class="mx" d="m16 9 5 6m0-6-5 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg><span class="snd-t">اضغط لتشغيل الموسيقى</span>';
      btn.addEventListener("click", (e) => { e.stopPropagation(); m.toggle(); });
      document.body.appendChild(btn);
    }
    music.add(m);
    document.addEventListener("visibilitychange", m.apply);
    // try straight away (works for returning visitors on some browsers); otherwise it starts with the first tap
    if (d && !m.off) { make(); if (!isYT) { m.autoAt = Date.now(); play(); } else if (unlocked) m.apply(); }
    emit();
    return m;
  };

  // ---------- sound effects (synthesised: nothing to download) ----------
  let ctx = null;
  function ac() {
    if (!ctx) { const A = window.AudioContext || window.webkitAudioContext; if (!A) return null; try { ctx = new A(); } catch { return null; } }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    return ctx;
  }
  // each note: [type, freq, at(s), dur(s), gain, freqEnd]; "n" = filtered noise burst [ "n", lowpassHz, at, dur, gain ]
  const BELL = (f, at, g) => [["sine", f, at, 1.1, g], ["sine", f * 2.76, at, 0.7, g * 0.45], ["sine", f * 5.4, at, 0.35, g * 0.2]];
  const FX = {
    soft: {
      tap: [["sine", 900, 0, 0.05, 0.5, 600]],
      pop: [["sine", 520, 0, 0.09, 0.7, 780], ["sine", 880, 0.07, 0.12, 0.55]],
      success: [["sine", 523, 0, 0.25, 0.6], ["sine", 659, 0.12, 0.25, 0.6], ["sine", 784, 0.24, 0.45, 0.6]],
      error: [["sine", 300, 0, 0.18, 0.6, 200]],
    },
    arcade: {
      tap: [["square", 1300, 0, 0.035, 0.22]],
      pop: [["square", 988, 0, 0.07, 0.25], ["square", 1319, 0.07, 0.28, 0.25]],
      success: [["square", 523, 0, 0.09, 0.25], ["square", 659, 0.09, 0.09, 0.25], ["square", 784, 0.18, 0.09, 0.25], ["square", 1047, 0.27, 0.4, 0.25]],
      error: [["sawtooth", 200, 0, 0.25, 0.3, 90]],
    },
    boxing: {
      tap: [["sine", 200, 0, 0.07, 0.8, 90], ["n", 1800, 0, 0.03, 0.25]],
      pop: [["sine", 130, 0, 0.18, 1, 45], ["n", 700, 0, 0.12, 0.7]],
      success: [...BELL(880, 0, 0.5), ...BELL(880, 0.42, 0.5)],
      error: [["sine", 120, 0, 0.3, 0.9, 50]],
    },
  };
  KO.sfxStyles = Object.keys(FX);
  let sfxCfg = null;
  let lastFx = 0;
  KO.sfx = function (name, over) {
    const cfg = over || sfxCfg; if (!cfg || cfg.on === false) return;
    const c = ac(); if (!c) return;
    const set = FX[cfg.style] || FX.soft, notes = set[name]; if (!notes) return;
    const now = performance.now(); if (name === "tap" && now - lastFx < 60) return; lastFx = now;
    const master = c.createGain();
    master.gain.value = 0.55 * Math.min(1, Math.max(0, (cfg.volume == null || cfg.volume === "" ? 60 : +cfg.volume) / 100));
    master.connect(c.destination);
    const t0 = c.currentTime + 0.01;
    notes.forEach((n) => {
      if (n[0] === "n") {
        const len = Math.max(1, Math.floor(c.sampleRate * n[3])), buf = c.createBuffer(1, len, c.sampleRate), ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const s = c.createBufferSource(); s.buffer = buf;
        const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = n[1];
        const g = c.createGain(); g.gain.value = n[4];
        s.connect(f); f.connect(g); g.connect(master); s.start(t0 + n[2]); return;
      }
      const o = c.createOscillator(), g = c.createGain(), t = t0 + n[2], dur = n[3];
      o.type = n[0]; o.frequency.setValueAtTime(n[1], t);
      if (n[5]) o.frequency.exponentialRampToValueAtTime(Math.max(20, n[5]), t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, n[4]), t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
    });
  };

  // ---------- site wiring ----------
  let siteMusic = null;
  KO.init = function (audio) {
    audio = audio || {};
    const mc = audio.music || {}, sc = audio.sfx || {};
    sfxCfg = sc.on ? sc : null;
    const key = mc.on && mc.src ? JSON.stringify([mc.src, mc.volume, mc.loop, mc.button]) : "";
    if (siteMusic && siteMusic.key !== key) { siteMusic.destroy(); siteMusic = null; }
    if (key && !siteMusic) { siteMusic = KO.music(mc, { button: mc.button === true, persist: true }); siteMusic.key = key; }
    if (!KO._tap) {
      KO._tap = true;
      document.addEventListener("click", (e) => {
        if (!sfxCfg || !e.isTrusted) return;
        const t = e.target; if (!t.closest) return;
        if (t.closest("[data-add],[data-buynow],[data-buy],.snd-btn,.vp,video,iframe,[data-nosfx]")) return;
        if (t.closest("a,button,.card,.cat-tile,label.pay,.chip,summary,[role=button]")) KO.sfx("tap");
      }, true);
    }
  };
})();
