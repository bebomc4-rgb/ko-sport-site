(() => {
  "use strict";
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const NOIMG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 10 10'%3E%3Crect width='10' height='10' fill='%23ebe7df'/%3E%3C/svg%3E";
  const img = (u) => u || NOIMG;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const money = (n) => "$" + Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const split = (s) => String(s || "").split(/[،,]/).map((x) => x.trim()).filter(Boolean);
  const STATUS = { new: "جديد", pending_payment: "بانتظار التحويل", paid: "تم الدفع", confirmed: "تم التأكيد", shipped: "انشحن", delivered: "انسلّم", cancelled: "ملغي" };
  const ss = { get(k) { try { return localStorage.getItem(k) || ""; } catch { return ""; } }, set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch {} } };

  let pass = ss.get("ko_admin");
  let orders = [], cursor = null, statusFilter = "";
  let products = [], saved = "[]", dirty = new Set();

  let toastT;
  function toast(t) { const el = $("[data-toast]"); el.textContent = t; el.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove("show"), 3000); }

  async function api(path, opts = {}) {
    const init = { ...opts, headers: { authorization: "Bearer " + pass, ...(opts.body && !(opts.body instanceof Blob) ? { "content-type": "application/json" } : {}), ...(opts.headers || {}) } };
    // weak connection: retry up to 4 times on network errors / temporary server errors
    let r;
    for (let a = 0; ; a++) {
      try { r = await fetch(path, init); if (r.status >= 502 && r.status <= 504 && a < 3) throw new Error("retry"); break; }
      catch (e) { if (a >= 3) throw new Error("انقطع الاتصال بالسيرفر، تأكد من النت واكبس الزر كمان مرة (بيكمّل من مكان ما وقف)"); await new Promise((res) => setTimeout(res, 1500 * (a + 1))); }
    }
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { if (started) logout(); ss.set("ko_admin", ""); throw new Error("كلمة السر غلط"); }
    if (!r.ok) throw new Error(j.error || "خطأ " + r.status);
    return j;
  }

  // ---------- auth ----------
  $("[data-login]").addEventListener("submit", async (e) => {
    e.preventDefault();
    pass = $("#pw").value;
    try { await login(); }
    catch (err) { $("[data-login-msg]").textContent = err.message; }
  });
  let ROLE = "owner", ROLE_NAME = "";
  const ALLOW = { orders: ["dash", "orders", "carts", "customers"], manager: null, owner: null };
  const allowed = (tab) => { const a = ALLOW[ROLE]; if (a) return a.includes(tab); if (ROLE === "manager") return !["staff", "dev"].includes(tab); return true; };
  async function login() {
    const j = await api("/api/login", { method: "POST" });
    ROLE = j.role || "owner"; ROLE_NAME = j.name || "";
    ss.set("ko_admin", pass);
    $$("[data-tab]").forEach((b) => (b.hidden = !allowed(b.dataset.tab)));
    $$(".w-grp").forEach((g) => { let n = g.nextElementSibling, any = false; while (n && !n.classList.contains("w-grp")) { if (n.dataset.tab && !n.hidden) any = true; n = n.nextElementSibling; } g.hidden = !any; });
    const who = $("[data-who]"); if (who) who.textContent = ROLE === "owner" ? "" : `دخلت كـ ${ROLE_NAME} (${ROLE === "orders" ? "طلبات" : "مدير"})`;
    try { await loadOrders(true); } catch {}
    start();
  }
  function logout() { pass = ""; ss.set("ko_admin", ""); location.reload(); }
  $("[data-logout]").onclick = logout;

  let started = false;
  function start() {
    started = true;
    document.body.classList.add("in");
    $("[data-login]").hidden = true;
    $("[data-tabs]").hidden = false; $("[data-logout]").hidden = false;
    let first = "dash"; try { first = sessionStorage.getItem("ko_adm_tab") || "dash"; } catch {}
    const hashTab = location.hash.slice(1); if (TAB_TITLES[hashTab]) first = hashTab;
    show(TAB_TITLES[first] && allowed(first) && first !== "colledit" ? first : "dash");
    loadCarts(true).catch(() => {});
    if (ROLE !== "orders") loadReviews(true).then(() => { if (!$("[data-view=dash]").hidden) renderDash(); }).catch(() => {});
    fetch("/api/settings").then((r) => r.json()).then((st) => { const n = $("[data-store-name]"); if (n && st.store && st.store.name) n.textContent = st.store.name; }).catch(() => {});
    setInterval(() => { if (!$("[data-view=orders]").hidden) loadOrders(true).catch(() => {}); }, 60000);
  }
  const TAB_TITLES = { bot: "المجيب K FAST", colledit: "المجموعة", domain: "النطاق", legal: "الصفحات القانونية", apps: "التطبيقات", general: "الإعدادات العامة", tax: "الضريبة", staff: "الموظفون", dev: "أدوات المطورين", carts: "السلّات المتروكة", discounts: "الخصومات", pages: "الصفحات", dash: "الرئيسية", orders: "الطلبات", products: "المنتجات", collections: "المجموعات", customers: "العملاء", delivery: "الشحن", payments: "الدفع", reviews: "التقييمات", push: "الإشعارات", promos: "الإعلانات الترويجية", themes: "قوالب التصميم", appearance: "المظهر", reports: "التقارير", images: "الصور" };
  // every dashboard page is a step in the browser history, so the mouse «back» button / phone back gesture goes to the previous page
  window.addEventListener("popstate", (e) => { const t = e.state && e.state.koTab; if (t && started && !(e.state && e.state.koAp)) show(t, true); });
  function show(tab, fromHistory) {
    if (!allowed(tab)) tab = "dash";
    try {
      const cur = history.state && history.state.koTab;
      if (!fromHistory && cur !== tab) { if (cur) history.pushState({ koTab: tab }, "", "#" + tab); else history.replaceState({ koTab: tab }, "", "#" + tab); }
    } catch {}
    $("[data-menu]").hidden = true;
    document.body.classList.remove("side-open");
    const pt = $("[data-page-title]"); if (pt) pt.textContent = TAB_TITLES[tab] || "لوحة التحكم";
    try { sessionStorage.setItem("ko_adm_tab", tab); } catch {}
    window.scrollTo(0, 0);
    $$("[data-tab]").forEach((b) => b.classList.toggle("on", b.dataset.tab === tab));
    { const mo = $("[data-w-more]"); if (mo && mo.querySelector(`[data-tab="${tab}"]`)) mo.open = true; }
    $$("[data-view]").forEach((v) => (v.hidden = v.dataset.view !== tab));
    if (tab === "orders") renderOrders();
    if (tab === "products" && !products.length) loadProducts();
    if (SET_TABS.includes(tab)) openSettings(tab);
    updateSetBar();
    if (tab === "reviews") loadReviews();
    if (tab === "push") loadPush();
    if (tab === "dash") renderDash();
    if (tab === "carts") loadCarts();
    if (tab === "discounts") loadUsed();
    if (tab === "customers") loadCustomers();
    if (tab === "staff") { loadStaff(); loadStatus(); }
    if (tab === "apps") { loadStatus(); renderBotLinks(); }
    if (tab === "bot") kbotLoad(false);
    if (tab === "domain") renderDomain();
    if (tab === "general") loadStatus().then(renderGeneral);
    if (tab === "legal") renderLegal();
    if (tab === "reports") renderReports();
    if (tab === "appearance") { showAp(apCur); if (apMobile()) apClose(true); }
    if (tab === "images") { if (!products.length) loadProducts().then(migStatus); else migStatus(); }
  }
  // ---------- phones: the appearance settings work like an app — a list of sections, tap one to open it, «رجوع» to go back
  const apMobile = () => innerWidth <= 1000;
  function apOpen(btn) {
    $(".ap-wrap").classList.add("ap-open");
    const pt = $("[data-page-title]"); if (pt) pt.textContent = [...btn.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim() || "المظهر";
    if (!(history.state && history.state.koAp)) history.pushState({ koAp: 1, koTab: "appearance" }, "");
    window.scrollTo(0, 0);
  }
  function apClose(silent) {
    const w = $(".ap-wrap"); if (!w) return;
    w.classList.remove("ap-open");
    const pt = $("[data-page-title]"); if (pt && !$("[data-view=appearance]").hidden) pt.textContent = "المظهر";
    if (!silent) window.scrollTo(0, 0);
  }
  window.addEventListener("popstate", () => { const w = $(".ap-wrap"); if (w && w.classList.contains("ap-open")) apClose(); });
  // ---------- install the dashboard as an app (its own icon on the phone) ----------
  let admDP = null;
  const admStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const admIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function admInstUI() { $$("[data-adm-install]").forEach((b) => (b.hidden = admStandalone() || !(admDP || admIOS))); }
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); admDP = e; admInstUI(); });
  window.addEventListener("appinstalled", () => { admDP = null; admInstUI(); toast("📲 انضافت لوحة التحكم لشاشتك"); });
  document.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-adm-install]")) return;
    if (admDP) { admDP.prompt(); try { await admDP.userChoice; } catch {} admDP = null; admInstUI(); return; }
    alert("على الآيفون: افتح لوحة التحكم بـ Safari ← اكبس زر المشاركة (المربع مع السهم ⬆️) ← «إضافة إلى الشاشة الرئيسية» ← إضافة.");
  });
  admInstUI();
  // ---------- Wuilt-style shell ----------
  let apCur = "logo"; try { apCur = localStorage.getItem("ko_ap") || "logo"; } catch {}
  function showAp(key) {
    if (!$(`[data-ap="${key}"]`)) key = "logo";
    apCur = key; try { localStorage.setItem("ko_ap", key); } catch {}
    $$("[data-apnav]").forEach((b) => b.classList.toggle("on", b.dataset.apnav === key));
    $$("[data-ap]").forEach((p) => (p.hidden = p.dataset.ap !== key));
    if (key === "colors" || key === "layout") requestAnimationFrame(() => { if (typeof fitPreviews === "function") fitPreviews(); });
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-apnav]"); if (a) { showAp(a.dataset.apnav); if (apMobile()) apOpen(a); return; }
    if (e.target.closest("[data-ap-back]")) { if (history.state && history.state.koAp) history.back(); else apClose(); return; }
    const g = e.target.closest("[data-goto]");
    if (g) { if (g.dataset.apGo) apCur = g.dataset.apGo; show(g.dataset.goto); return; }
    if (e.target.closest("[data-side-open]")) { document.body.classList.add("side-open"); return; }
    if (e.target.closest("[data-side-close]")) document.body.classList.remove("side-open");
  });
  const normA = (x) => String(x || "").toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
  const nf = (n) => Number(n || 0).toLocaleString("ar-SY", { maximumFractionDigits: 2 });
  const live = () => orders.filter((o) => o.status !== "cancelled");
  async function loadAllOrders(btn) {
    if (btn) { btn.disabled = true; btn.textContent = "جاري التحميل…"; }
    try { let n = 0; while (cursor && n++ < 50) await loadOrders(false); toast(`تحمّلوا ${orders.length} طلب`); } catch (e) { toast(e.message); }
    if (btn) { btn.disabled = false; btn.textContent = "حمّل كل الطلبات"; }
    renderCustomers(); renderReports(); renderDash();
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-load-all-orders]"); if (b) loadAllOrders(b); });
  // dashboard home
  setInterval(() => { const s = $("[data-newcount]"), t = $("[data-tb-new]"); if (s && t) { t.hidden = s.hidden || !s.textContent.trim(); t.textContent = s.textContent; } }, 1500);
  function renderDash() {
    const box = $("[data-dash-stats]"); if (!box) return;
    const now = new Date(), today = now.toDateString(), month = now.getMonth(), year = now.getFullYear();
    const L = live();
    const newC = orders.filter((o) => o.status === "new" || o.status === "pending_payment").length;
    const todayC = L.filter((o) => new Date(o.createdAt).toDateString() === today).length;
    const monthS = L.filter((o) => { const d = new Date(o.createdAt); return d.getMonth() === month && d.getFullYear() === year; }).reduce((a, o) => a + o.total, 0);
    const pend = REVS.filter((r) => !r.ok).length;
    box.innerHTML = [["طلبات بانتظارك", nf(newC), "orders"], ["طلبات اليوم", nf(todayC), "orders"], ["مبيعات هالشهر", "$" + nf(monthS), "reports"], ["تقييمات بانتظار الموافقة", nf(pend), "reviews"]]
      .map(([t, v, go]) => `<button type="button" class="d-stat" data-goto="${go}"><span>${t}</span><b>${v}</b></button>`).join("");
    $("[data-dash-orders]").innerHTML = orders.slice(0, 6).map((o) => `<div class="d-order"><div><b dir="ltr">${esc(o.id)}</b><small>${esc(o.customer.name)} · ${new Date(o.createdAt).toLocaleDateString("ar-SY")}</small></div><span class="status ${o.status}">${STATUS[o.status] || o.status}</span><b class="d-tot">$${nf(o.total)}</b></div>`).join("") || `<p class="hint">ما في طلبات لهلق.</p>`;
  }
  // ---------- "..." menus ----------
  function openMenu(btn, items) {
    const m = $("[data-menu]");
    m.innerHTML = items.map(([label, icon, , danger], i) => `<button type="button" data-mi="${i}" class="${danger ? "danger" : ""}"><i>${icon}</i>${label}</button>`).join("");
    m.hidden = false;
    const r = btn.getBoundingClientRect();
    m.style.top = r.bottom + scrollY + 6 + "px";
    m.style.left = Math.max(8, Math.min(r.left + scrollX, innerWidth - m.offsetWidth - 8)) + "px";
    m.onclick = (e) => { const b = e.target.closest("[data-mi]"); if (b) { m.hidden = true; items[+b.dataset.mi][2](); } };
  }
  document.addEventListener("click", (e) => { const m = $("[data-menu]"); if (!m.hidden && !e.target.closest("[data-menu],[data-dots]")) m.hidden = true; }, true);
  const DOTS = (attr) => `<button type="button" class="w-dots" data-dots ${attr} aria-label="خيارات">•••</button>`;
  const MI = { edit: "✎", eye: "👁", del: "🗑", wa: "💬", block: "⛔", ok: "✓", list: "☰" };

  // ---------- customers (orders + saved info: tags, notes, blocking, manual adds, imports) ----------
  let CUST = {}, custTab = "all", custSel = new Set(), allLoaded = false;
  async function ensureAllOrders() { if (allLoaded) return; let n = 0; try { while (cursor && n++ < 80) await loadOrders(false); } catch {} allLoaded = true; }
  const ckey = (phone, email) => { const d = String(phone || "").replace(/\D/g, "").slice(-9); if (d.length >= 9) return "p" + d; const e = String(email || "").trim().toLowerCase(); return e.includes("@") ? "e" + e.slice(0, 80) : ""; };
  function custRows() {
    const m = new Map();
    for (const o of orders) {
      const k = ckey(o.customer.phone, o.customer.email) || "n" + o.customer.name;
      let c = m.get(k);
      if (!c) { c = { key: k, name: o.customer.name, phone: o.customer.phone, email: o.customer.email, gov: o.customer.governorate, address: o.customer.address, orders: [], spend: 0, last: o.createdAt, tags: [] }; m.set(k, c); }
      c.orders.push(o); if (o.status !== "cancelled") c.spend += o.total;
      if (o.createdAt > c.last) { c.last = o.createdAt; c.name = o.customer.name; }
    }
    for (const [k, x] of Object.entries(CUST)) {
      const c = m.get(k) || { key: k, orders: [], spend: 0, last: x.at };
      Object.assign(c, { name: x.name || c.name, phone: x.phone || c.phone, email: x.email || c.email, gov: x.gov || c.gov, address: x.address || c.address, tags: x.tags || [], note: x.note || "", blocked: !!x.blocked, stored: true, manual: !!x.manual });
      m.set(k, c);
    }
    return [...m.values()].sort((a, b) => String(b.last || "").localeCompare(String(a.last || "")));
  }
  async function loadCustomers() {
    const box = $("[data-cust-list]"); if (box && !box.innerHTML) box.innerHTML = `<p class="hint" style="padding:16px">جاري تحميل العملاء…</p>`;
    try { CUST = await api("/api/customers"); } catch (e) { toast(e.message); }
    await ensureAllOrders(); renderCustomers();
  }
  const ordTxt = (n) => (!n ? "لا طلبات" : n === 1 ? "طلب واحد" : n === 2 ? "طلبين" : n <= 10 ? `${nf(n)} طلبات` : `${nf(n)} طلب`);
  const initials = (n) => String(n || "؟").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  let CROWS = [];
  function renderCustomers() {
    const box = $("[data-cust-list]"); if (!box) return;
    const rows = custRows(), q = normA(($("[data-cust-q]") || {}).value || "");
    const cnt = { all: rows.length, active: rows.filter((c) => !c.blocked).length, blocked: rows.filter((c) => c.blocked).length };
    $("[data-cu-tabs]").innerHTML = [["all", "الجميع"], ["active", "نشط"], ["blocked", "محظور"]].map(([k, t]) => `<button type="button" data-cu-tab="${k}" class="${custTab === k ? "on" : ""}">${t}${k === "all" ? ` <b>${nf(cnt.all)}</b>` : ""}</button>`).join("");
    CROWS = rows.filter((c) => (custTab === "all" || (custTab === "blocked" ? c.blocked : !c.blocked)) && (!q || normA([c.name, c.phone, c.email, c.gov, (c.tags || []).join(" ")].join(" ")).includes(q)));
    custSel = new Set([...custSel].filter((k) => CROWS.some((c) => c.key === k)));
    box.innerHTML = `<div class="w-table cu-table"><div class="w-tr w-th"><span><input type="checkbox" data-cu-all ${CROWS.length && custSel.size === CROWS.length ? "checked" : ""}></span><span>بيانات العميل</span><span>المكان</span><span>حالة الحساب</span><span>تصنيفاتي</span><span>الطلبات</span><span>النفقات</span><span></span></div>` +
      CROWS.slice(0, 500).map((c) => `<div class="w-tr cu-row" data-cu="${esc(c.key)}"><span><input type="checkbox" data-cu-chk="${esc(c.key)}" ${custSel.has(c.key) ? "checked" : ""}></span>
        <span class="cu-id"><i class="cu-av">${esc(initials(c.name))}</i><span><b>${esc(c.name || "بدون اسم")}</b><small dir="ltr">${esc(c.email || c.phone || "")}</small></span></span>
        <span>${c.gov ? `Syria, ${esc(c.gov)}` : '<small class="hint">لا يوجد عنوان</small>'}</span>
        <span><em class="cu-st ${c.blocked ? "bl" : ""}">● ${c.blocked ? "محظور" : "نشط"}</em></span>
        <span>${(c.tags || []).map((t) => `<em class="cu-tag">${esc(t)}</em>`).join("") || "-"}</span>
        <span>${ordTxt(c.orders.length)}</span><span dir="ltr">US$ ${nf(c.spend)}</span><span>${DOTS(`data-cu-menu="${esc(c.key)}"`)}</span></div>`).join("") +
      `</div>${CROWS.length ? "" : `<div class="dc-empty"><b>ما في عملاء هون</b></div>`}${CROWS.length > 500 ? `<p class="hint" style="padding:10px 16px">عم نعرض أول 500. استعمل البحث.</p>` : ""}`;
    const bulk = $("[data-cu-bulk]"); bulk.hidden = !custSel.size; $("[data-cu-sel]").textContent = `${nf(custSel.size)} محدد`;
  }
  const findCust = (k) => custRows().find((c) => c.key === k);
  async function saveCust(c, patch) {
    const body = { name: c.name, phone: c.phone, email: c.email, gov: c.gov, address: c.address, tags: c.tags || [], note: c.note || "", blocked: !!c.blocked, manual: !!c.manual, ...patch, oldKey: c.stored ? c.key : undefined };
    const j = await api("/api/customers", { method: "PUT", body: JSON.stringify(body) });
    if (body.oldKey && body.oldKey !== j.key) delete CUST[body.oldKey];
    CUST[j.key] = j.customer; return j;
  }
  function custEditor(c) {
    const D = c ? { name: c.name || "", phone: c.phone || "", email: c.email || "", gov: c.gov || "", address: c.address || "", tags: (c.tags || []).join("، "), note: c.note || "", blocked: !!c.blocked } : { name: "", phone: "", email: "", gov: "", address: "", tags: "", note: "", blocked: false };
    const govs = [...new Set(((ST && ST.shipping && ST.shipping.carriers) || []).flatMap((x) => x.govs.map((g) => g.name)))];
    openX(c ? "بيانات العميل" : "إضافة عميل", {
      draft: D,
      render() {
        return `<div class="row2"><div class="field"><label>الاسم</label><input data-f="name" value="${esc(D.name)}" maxlength="80"></div><div class="field"><label>رقم الموبايل</label><input data-f="phone" value="${esc(D.phone)}" dir="ltr" maxlength="30"></div></div>
          <div class="row2"><div class="field"><label>الإيميل</label><input data-f="email" value="${esc(D.email)}" dir="ltr" maxlength="80"></div><div class="field"><label>المحافظة</label><input data-f="gov" value="${esc(D.gov)}" list="gov-list" maxlength="40"><datalist id="gov-list">${govs.map((g) => `<option>${esc(g)}</option>`).join("")}</datalist></div></div>
          <div class="field"><label>العنوان</label><input data-f="address" value="${esc(D.address)}" maxlength="160"></div>
          <div class="field"><label>تصنيفاتي (افصل بفاصلة)</label><input data-f="tags" value="${esc(D.tags)}" placeholder="مثلاً: زبون مميز، جملة"></div>
          <div class="field"><label>ملاحظة (بتشوفها إنت بس)</label><textarea data-f="note" rows="3" maxlength="500">${esc(D.note)}</textarea></div>
          ${fSw("blocked", D.blocked, "حظر العميل", "المحظور ما بيقدر يعمل طلب من الموقع")}
          ${c && c.orders.length ? `<hr class="w-hr"><h3 class="w-h3">طلباته (${nf(c.orders.length)}) · مجموع ${"$" + nf(c.spend)}</h3><div class="cu-orders">${c.orders.map((o) => `<div><b dir="ltr">${esc(o.id)}</b><span>${new Date(o.createdAt).toLocaleDateString("ar-SY")}</span><span class="status ${o.status}">${STATUS[o.status] || o.status}</span><b dir="ltr">$${nf(o.total)}</b></div>`).join("")}</div>` : ""}`;
      },
      async save() {
        if (!String(D.name).trim()) { toast("اكتب اسم العميل"); return false; }
        try { await saveCust(c || { manual: true }, { ...D, tags: String(D.tags).split(/[,،]/).map((t) => t.trim()).filter(Boolean), manual: c ? !!c.manual : true }); renderCustomers(); toast("انحفظ ✓"); }
        catch (err) { toast(err.message); return false; }
      },
    });
  }
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-cu-tab]"); if (t) { custTab = t.dataset.cuTab; custSel.clear(); renderCustomers(); return; }
    if (e.target.closest("[data-cust-add]")) { if (!ST) await openSettings("customers"); custEditor(null); return; }
    const dm = e.target.closest("[data-cu-menu]");
    if (dm) {
      const c = findCust(dm.dataset.cuMenu); if (!c) return;
      const wa = String(c.phone || "").replace(/\D/g, "").replace(/^0/, "963");
      openMenu(dm, [["تعديل", MI.edit, () => custEditor(c)],
        ...(c.orders.length ? [["طلباته", MI.list, () => { $("[data-order-q]").value = c.phone || c.name; show("orders"); renderOrders(); }]] : []),
        ...(wa ? [["واتساب", MI.wa, () => window.open("https://wa.me/" + wa, "_blank")]] : []),
        [c.blocked ? "إلغاء الحظر" : "حظر", c.blocked ? MI.ok : MI.block, async () => { try { await saveCust(c, { blocked: !c.blocked }); renderCustomers(); toast(c.blocked ? "انلغى الحظر" : "انحظر العميل"); } catch (err) { toast(err.message); } }],
        ...(c.stored ? [["إزالة البيانات المحفوظة", MI.del, async () => { if (!confirm("نحذف بيانات هالعميل المحفوظة؟ (طلباته بتضل)")) return; try { await api("/api/customers/" + encodeURIComponent(c.key), { method: "DELETE" }); delete CUST[c.key]; renderCustomers(); } catch (err) { toast(err.message); } }, true]] : [])]);
      return;
    }
    const row = e.target.closest("[data-cu]");
    if (row && !e.target.closest("input,button,a")) { const c = findCust(row.dataset.cu); if (c) { if (!ST) await openSettings("customers"); custEditor(c); } return; }
    const act = e.target.closest("[data-cu-act]");
    if (act) {
      const sel = [...custSel].map(findCust).filter(Boolean); if (!sel.length) return;
      let patch;
      if (act.dataset.cuAct === "tag") { const t = prompt("اسم التصنيف:"); if (!t || !t.trim()) return; patch = (c) => ({ tags: [...new Set([...(c.tags || []), t.trim()])] }); }
      else { const b = act.dataset.cuAct === "block"; patch = () => ({ blocked: b }); }
      let ok = 0;
      for (const c of sel) { try { await saveCust(c, patch(c)); ok++; } catch {} }
      custSel.clear(); renderCustomers(); toast(`انحدّث ${nf(ok)} عميل`);
      return;
    }
    if (e.target.closest("[data-cust-export]")) {
      const L = CROWS.length ? CROWS : custRows();
      const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const csv = "﻿" + [["الاسم", "الموبايل", "الإيميل", "المحافظة", "العنوان", "الطلبات", "النفقات", "التصنيفات", "الحالة"].map(q).join(",")]
        .concat(L.map((c) => [c.name, c.phone, c.email, c.gov, c.address, c.orders.length, c.spend, (c.tags || []).join("، "), c.blocked ? "محظور" : "نشط"].map(q).join(","))).join("\n");
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    }
  });
  document.addEventListener("change", async (e) => {
    if (e.target.matches("[data-cu-chk]")) { e.target.checked ? custSel.add(e.target.dataset.cuChk) : custSel.delete(e.target.dataset.cuChk); renderCustomers(); return; }
    if (e.target.matches("[data-cu-all]")) { custSel = e.target.checked ? new Set(CROWS.map((c) => c.key)) : new Set(); renderCustomers(); return; }
    if (!e.target.matches("[data-cust-import]") || !e.target.files[0]) return;
    try {
      const text = (await e.target.files[0].text()).replace(/^﻿/, "");
      const rows = parseCsv(text); if (rows.length < 2) throw new Error("الملف فاضي");
      const H = rows[0].map((h) => normA(h));
      const col = (...keys) => H.findIndex((h) => keys.some((k) => h.includes(k)));
      const ci = { name: col("name", "اسم", "الاسم"), first: col("first"), last: col("last"), phone: col("phone", "mobile", "هاتف", "موبايل", "جوال", "رقم"), email: col("email", "mail", "بريد", "ايميل"), gov: col("city", "state", "region", "مدينه", "محافظه", "منطقه"), address: col("address", "عنوان"), tags: col("tag", "تصنيف") };
      const list = rows.slice(1).map((r) => ({ name: ci.name >= 0 ? r[ci.name] : [r[ci.first], r[ci.last]].filter(Boolean).join(" "), phone: r[ci.phone], email: r[ci.email], gov: r[ci.gov], address: r[ci.address], tags: r[ci.tags] })).filter((x) => x.name && (x.phone || x.email));
      if (!list.length) throw new Error("ما لقينا أعمدة الاسم والرقم/الإيميل بالملف");
      const j = await api("/api/customers", { method: "POST", body: JSON.stringify({ list }) });
      toast(`انضافوا ${nf(j.added)} عميل ✓`); loadCustomers();
    } catch (err) { toast(err.message); }
    e.target.value = "";
  });
  function parseCsv(t) {
    const rows = []; let row = [], cur = "", q = false;
    const sep = (t.split("\n")[0].match(/;/g) || []).length > (t.split("\n")[0].match(/,/g) || []).length ? ";" : ",";
    for (let i = 0; i < t.length; i++) {
      const ch = t[i];
      if (q) { if (ch === '"') { if (t[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
      else if (ch === '"') q = true; else if (ch === sep) { row.push(cur.trim()); cur = ""; }
      else if (ch === "\n" || ch === "\r") { if (ch === "\r" && t[i + 1] === "\n") i++; row.push(cur.trim()); rows.push(row); row = []; cur = ""; }
      else cur += ch;
    }
    if (cur || row.length) { row.push(cur.trim()); rows.push(row); }
    return rows.filter((r) => r.some(Boolean));
  }
  document.addEventListener("input", (e) => { if (e.target.matches("[data-cust-q]")) renderCustomers(); if (e.target.matches("[data-coll-q]")) renderCollections(); });
  // reports
  let repDays = 30;
  function renderReports() {
    const box = $("[data-reports]"); if (!box) return;
    $$("[data-rr]").forEach((b) => b.classList.toggle("on", +b.dataset.rr === repDays));
    const since = Date.now() - repDays * 864e5, L = live().filter((o) => new Date(o.createdAt).getTime() >= since);
    const sales = L.reduce((a, o) => a + o.total, 0);
    const days = []; for (let i = repDays - 1; i >= 0; i--) { const d = new Date(Date.now() - i * 864e5); days.push({ k: d.toDateString(), d, v: 0 }); }
    const byDay = new Map(days.map((x) => [x.k, x]));
    L.forEach((o) => { const x = byDay.get(new Date(o.createdAt).toDateString()); if (x) x.v += o.total; });
    const max = Math.max(1, ...days.map((x) => x.v));
    const count = (f) => { const m = new Map(); L.forEach((o) => f(o).forEach(([k, n]) => m.set(k, (m.get(k) || 0) + n))); return [...m].sort((a, b) => b[1] - a[1]); };
    const top = count((o) => o.items.map((i) => [i.name, i.qty])).slice(0, 10);
    const govs = count((o) => [[o.customer.governorate || "—", 1]]).slice(0, 10);
    const pays = count((o) => [[(o.payment && o.payment.name) || "—", 1]]);
    const list = (rows, unit) => rows.length ? rows.map(([k, n]) => `<div class="r-row"><span>${esc(k)}</span><i style="--w:${(n / rows[0][1]) * 100}%"></i><b>${nf(n)} ${unit}</b></div>`).join("") : `<p class="hint">ما في بيانات.</p>`;
    box.innerHTML = `<div class="d-stats"><div class="d-stat"><span>المبيعات</span><b>$${nf(sales)}</b></div><div class="d-stat"><span>عدد الطلبات</span><b>${nf(L.length)}</b></div><div class="d-stat"><span>متوسط الطلب</span><b>$${nf(L.length ? sales / L.length : 0)}</b></div><div class="d-stat"><span>القطع المباعة</span><b>${nf(L.reduce((a, o) => a + o.items.reduce((b, i) => b + i.qty, 0), 0))}</b></div></div>
      <div class="w-card"><h3>المبيعات باليوم</h3><div class="r-bars">${days.map((x) => `<i title="${x.d.toLocaleDateString("ar-SY")}: $${nf(x.v)}" style="--h:${(x.v / max) * 100}%"></i>`).join("")}</div></div>
      <div class="d-grid"><div class="w-card"><h3>الأكثر مبيعاً</h3>${list(top, "قطعة")}</div><div class="w-card"><h3>حسب المحافظة</h3>${list(govs, "طلب")}<h3 style="margin-top:16px">طرق الدفع</h3>${list(pays, "طلب")}</div></div>
      ${cursor ? `<p class="hint">في طلبات أقدم ما انحسبت. اكبس «حمّل كل الطلبات».</p>` : ""}`;
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-rr]"); if (b) { repDays = +b.dataset.rr; renderReports(); } });
  // ---------- collections: list (Wuilt-style) + full edit page ----------
  const catMeta = (c) => (ST.design.catMeta || {})[c] || {};
  const catImg = (c) => catMeta(c).image || (products.find((p) => (p.category === c || (p.also || []).includes(c)) && (p.thumb || p.image)) || {}).thumb || NOIMG;
  const inCatA = (p, c) => p.category === c || (p.also || []).includes(c);
  function renderCollections() {
    const box = $("[data-coll-list]"); if (!box || !ST) return;
    const q = normA(($("[data-coll-q]") || {}).value || "");
    const cats = allCats().filter((c) => !q || normA(c + " " + (ST.design.catLabels?.[c] || "")).includes(q));
    box.innerHTML = `<div class="w-tr w-th"><span>المجموعات</span><span>المنتجات</span><span></span></div>` + cats.map((c) => `<div class="w-tr co-row" data-co="${esc(c)}"><span class="cu-id"><img src="${esc(catImg(c))}" alt="" loading="lazy" class="co-img"><b>${esc(ST.design.catLabels?.[c] || c)}</b></span><span>${nf(products.filter((p) => inCatA(p, c)).length)}</span><span>${DOTS(`data-co-menu="${esc(c)}"`)}</span></div>`).join("")
      + (cats.length ? "" : `<div class="dc-empty"><b>ما في مجموعات</b></div>`);
  }
  let CE = null;
  async function openColl(c) {
    if (!ST) await openSettings("colledit"); if (!products.length) await loadProducts();
    const m = c ? catMeta(c) : {}, ord = m.order || [];
    let pids = c ? products.filter((p) => inCatA(p, c)).map((p) => p.id) : [];
    if (ord.length) { const ix = new Map(ord.map((id, i) => [id, i])); pids.sort((a, b) => (ix.has(a) ? ix.get(a) : 1e6) - (ix.has(b) ? ix.get(b) : 1e6)); }
    const grp = c ? (ST.design.groups || []).findIndex((g) => g.cats.includes(c)) : -1;
    CE = { orig: c, name: c ? ST.design.catLabels?.[c] || c : "", desc: m.desc || "", image: m.image || "", slug: m.slug || "", seoTitle: m.seoTitle || "", seoDesc: m.seoDesc || "", pids, q: "", sort: false, group: grp };
    show("colledit"); renderCE();
  }
  function renderCE() {
    if (!CE) return;
    $("[data-ce-title]").textContent = CE.orig ? "تعديل المجموعة" : "إنشاء مجموعة";
    $("[data-ce-name]").value = CE.name; $("[data-ce-desc]").value = CE.desc; $("[data-ce-slug]").value = CE.slug; $("[data-ce-seot]").value = CE.seoTitle; $("[data-ce-seod]").value = CE.seoDesc;
    $("[data-ce-inner]").textContent = CE.orig && CE.orig !== CE.name ? `الاسم الأصلي بالمنتجات: ${CE.orig}` : "";
    $("[data-ce-err]").textContent = "";
    const v = $("[data-ce-view]"); v.hidden = !CE.orig; if (CE.orig) v.href = "/#/c/" + encodeURIComponent(CE.slug || CE.orig);
    $("[data-ce-url]").textContent = location.origin + "/#/c/" + (CE.slug || CE.name || "");
    $("[data-ce-img]").innerHTML = CE.image ? `<img src="${esc(CE.image)}" alt="">` : `<span>🖼</span>`;
    $("[data-ce-noimg]").hidden = !CE.image;
    const side = $(".ce-side .w-card");
    if (!side.querySelector("[data-ce-group]")) side.insertAdjacentHTML("afterend", `<div class="w-card"><h3>بالقائمة الرئيسية</h3><select data-ce-group class="ce-sel"></select><small class="hint">المجموعة بتطلع بالقائمة تحت هالقسم.</small></div>`);
    $("[data-ce-group]").innerHTML = `<option value="-1">مو بالقائمة</option>` + (ST.design.groups || []).map((g, i) => `<option value="${i}" ${CE.group === i ? "selected" : ""}>${esc(g.name)}</option>`).join("");
    renderCEList();
  }
  function renderCEList() {
    const q = normA(CE.q), L = CE.pids.map((id) => products.find((p) => p.id === id)).filter(Boolean);
    $("[data-ce-count]").textContent = `(${nf(L.length)})`;
    $("[data-ce-sort]").textContent = CE.sort ? "✓ خلص الترتيب" : "ترتيب المنتجات";
    $("[data-ce-list]").innerHTML = L.map((p, j) => (q && !normA(p.name).includes(q) ? "" : `<div class="ce-item${CE.sort ? " sorting" : ""}" ${CE.sort ? `draggable="true" data-pj="${j}"` : ""}>
        ${CE.sort ? `<span class="ws-drag">⋮⋮</span>` : ""}<img src="${esc(p.thumb || p.image || NOIMG)}" alt=""><b>${esc(p.name)}</b>
        <em class="cu-st ${p.hidden ? "bl" : ""}">● ${p.hidden ? "مخفي" : "نشط"}</em><em class="cu-st ${p.inStock ? "" : "bl"}">${p.inStock ? "في المخزون" : "خالص"}</em>
        ${CE.sort ? `<span class="ws-arrows" style="display:flex"><button type="button" data-pmv="${j}" data-d="-1" ${j ? "" : "disabled"}>↑</button><button type="button" data-pmv="${j}" data-d="1" ${j < L.length - 1 ? "" : "disabled"}>↓</button></span>` : `<button type="button" class="ce-x" data-prm="${esc(p.id)}" aria-label="شيل">✕</button>`}</div>`)).join("")
      || `<div class="dc-empty"><b>ما في منتجات</b><p class="hint">اكبس «أضف منتجات».</p></div>`;
  }
  function addProductsPicker() {
    const D = { q: "", pick: new Set() };
    let cur = { act: [], off: [] };
    openX("أضف منتجات للمجموعة", {
      draft: D,
      render() {
        // every product, none left out: active ones in one box, inactive (hidden) ones in another
        const q = normA(D.q), all = products.filter((p) => !CE.pids.includes(p.id) && (!q || normA(p.name + " " + p.category).includes(q)));
        cur = { act: all.filter((p) => !p.hidden), off: all.filter((p) => p.hidden) };
        const row = (p) => `<button type="button" data-pk="${esc(p.id)}" class="${D.pick.has(p.id) ? "on" : ""}"><img loading="lazy" decoding="async" src="${esc(p.thumb || p.image || NOIMG)}" alt=""><span>${esc(p.name)}<small>${esc(p.category)}${p.inStock ? "" : " · خالص"}</small></span>${D.pick.has(p.id) ? "✓" : ""}</button>`;
        const box = (title, list, k) => `<div class="pk-h"><b>${title} (${nf(list.length)})</b>${list.length ? `<button type="button" class="w-link" data-pk-all="${k}">${list.every((p) => D.pick.has(p.id)) ? "إلغاء تحديد الكل" : "تحديد الكل"}</button>` : ""}</div>
          <div class="dc-found pk-list">${list.map(row).join("") || `<p class="hint">ما في منتجات.</p>`}</div>`;
        return `<input data-pk-q placeholder="دوّر على منتج" value="${esc(D.q)}" class="dc-search"><small class="hint">${nf(D.pick.size)} محدد · ${nf(all.length)} منتج</small>
          <div class="pk-wrap">${box("المنتجات النشطة", cur.act, "act")}${box("المنتجات غير النشطة", cur.off, "off")}</div>`;
      },
      onInput(e) { if (e.target.matches("[data-pk-q]")) { D.q = e.target.value; renderX(); const i = $("[data-pk-q]"); i.focus(); i.setSelectionRange(D.q.length, D.q.length); } },
      click(e) {
        const w = () => $(".pk-wrap"), y = w() ? w().scrollTop : 0, keep = () => { if (w()) w().scrollTop = y; };
        const all = e.target.closest("[data-pk-all]");
        if (all) { const L = cur[all.dataset.pkAll], every = L.every((p) => D.pick.has(p.id)); L.forEach((p) => (every ? D.pick.delete(p.id) : D.pick.add(p.id))); renderX(); keep(); return; }
        const b = e.target.closest("[data-pk]"); if (b) { const id = b.dataset.pk; D.pick.has(id) ? D.pick.delete(id) : D.pick.add(id); renderX(); keep(); }
      },
      save() { CE.pids.push(...D.pick); renderCEList(); },
    });
  }
  async function saveColl() {
    const name = CE.name.trim(), err = $("[data-ce-err]");
    if (!name) { err.textContent = "عنوان المجموعة مطلوب"; $("[data-ce-name]").focus(); return; }
    const cats = allCats();
    if (!CE.orig && cats.includes(name)) { err.textContent = "في مجموعة بنفس الاسم"; return; }
    if (!CE.pids.length) { toast("ضيف منتج واحد عالأقل للمجموعة"); return; }
    const cat = CE.orig || name;
    const slug = String(CE.slug || (CE.orig ? "" : name)).trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "");
    if (slug && (Object.entries(ST.design.catMeta).some(([k, m]) => k !== cat && m.slug === slug) || (cats.includes(slug) && slug !== cat))) { toast("رابط المجموعة مستعمل"); return; }
    const want = new Set(CE.pids), stuck = [];
    for (const p of products) {
      const has = inCatA(p, cat), w = want.has(p.id);
      if (w && !has) { p.also = [...(p.also || []), cat]; dirty.add(p.id); }
      else if (!w && has) {
        if (p.category === cat) { if ((p.also || []).length) { p.category = p.also[0]; p.also = p.also.slice(1); dirty.add(p.id); } else stuck.push(p.name); }
        else { p.also = p.also.filter((x) => x !== cat); dirty.add(p.id); }
      }
    }
    if (stuck.length) { toast(`ما فينا نشيل ${stuck.length} منتج لأنو ما إلهن مجموعة تانية: ${stuck.slice(0, 2).join("، ")}…`); }
    if (CE.orig && name !== CE.orig) (ST.design.catLabels ??= {})[cat] = name; else if (ST.design.catLabels) delete ST.design.catLabels[cat];
    ST.design.catMeta[cat] = { desc: CE.desc.trim(), image: CE.image, slug, seoTitle: CE.seoTitle.trim(), seoDesc: CE.seoDesc.trim(), order: CE.pids.slice() };
    (ST.design.groups || []).forEach((g) => (g.cats = g.cats.filter((x) => x !== cat)));
    if (CE.group >= 0 && ST.design.groups[CE.group]) ST.design.groups[CE.group].cats.push(cat);
    const b = $("[data-ce-save]"); b.disabled = true; $("[data-ce-msg]").textContent = "جاري الحفظ…";
    try {
      if (dirty.size) { await api("/api/products", { method: "PUT", body: JSON.stringify(products) }); saved = JSON.stringify(products); dirty.clear(); }
      await api("/api/settings", { method: "PUT", body: JSON.stringify(ST) }); stSaved = JSON.stringify(ST);
      toast("انحفظت المجموعة ✓"); CE = null; show("collections"); renderCollections(); renderGroups();
    } catch (e2) { toast(e2.message); $("[data-ce-msg]").textContent = "ما انحفظ، جرّب كمان مرة"; }
    b.disabled = false;
  }
  async function deleteColl(c) {
    const ps = products.filter((p) => inCatA(p, c));
    if (!confirm(`حذف مجموعة «${ST.design.catLabels?.[c] || c}»؟\nالمنتجات (${ps.length}) ما بتنحذف: بتنشال من هالمجموعة بس${ps.some((p) => p.category === c && !(p.also || []).length) ? "، ويلي ما إلو مجموعة تانية بينتقل لـ «منتجات أخرى»" : ""}.`)) return;
    for (const p of ps) { if (p.category === c) { if ((p.also || []).length) { p.category = p.also[0]; p.also = p.also.slice(1); } else p.category = "منتجات أخرى"; } else p.also = p.also.filter((x) => x !== c); dirty.add(p.id); }
    (ST.design.groups || []).forEach((g) => (g.cats = g.cats.filter((x) => x !== c)));
    if (ST.design.catLabels) delete ST.design.catLabels[c]; delete ST.design.catMeta[c];
    try { await api("/api/products", { method: "PUT", body: JSON.stringify(products) }); saved = JSON.stringify(products); dirty.clear(); await api("/api/settings", { method: "PUT", body: JSON.stringify(ST) }); stSaved = JSON.stringify(ST); toast("انحذفت المجموعة"); }
    catch (e) { toast(e.message); }
    renderCollections(); renderGroups();
  }
  document.addEventListener("click", (e) => {
    if (!ST && !e.target.closest("[data-coll-new]")) return;
    if (e.target.closest("[data-coll-new]")) { openColl(null); return; }
    const dm = e.target.closest("[data-co-menu]");
    if (dm) { const c = dm.dataset.coMenu; openMenu(dm, [["تعديل", MI.edit, () => openColl(c)], ["معاينة", MI.eye, () => window.open("/#/c/" + encodeURIComponent(catMeta(c).slug || c), "_blank")], ["إزالة", MI.del, () => deleteColl(c), true]]); return; }
    const row = e.target.closest("[data-co]"); if (row && !e.target.closest("button")) { openColl(row.dataset.co); return; }
    if (!CE) return;
    if (e.target.closest("[data-ce-add]")) { addProductsPicker(); return; }
    if (e.target.closest("[data-ce-sort]")) { CE.sort = !CE.sort; renderCEList(); return; }
    const rm = e.target.closest("[data-prm]"); if (rm) { CE.pids = CE.pids.filter((x) => x !== rm.dataset.prm); renderCEList(); return; }
    const mv = e.target.closest("[data-pmv]"); if (mv) { const i = +mv.dataset.pmv, j = i + +mv.dataset.d; [CE.pids[i], CE.pids[j]] = [CE.pids[j], CE.pids[i]]; renderCEList(); return; }
    if (e.target.closest("[data-ce-noimg]")) { CE.image = ""; renderCE(); return; }
    if (e.target.closest("[data-ce-save]")) saveColl();
  });
  document.addEventListener("input", (e) => {
    if (!CE) return;
    const map = { "data-ce-name": "name", "data-ce-desc": "desc", "data-ce-slug": "slug", "data-ce-seot": "seoTitle", "data-ce-seod": "seoDesc", "data-ce-q": "q" };
    for (const [a, k] of Object.entries(map)) if (e.target.hasAttribute(a)) { CE[k] = e.target.value; if (k === "q") renderCEList(); if (k === "slug" || k === "name") $("[data-ce-url]").textContent = location.origin + "/#/c/" + (CE.slug || CE.name); }
  });
  document.addEventListener("change", async (e) => {
    if (!CE) return;
    if (e.target.matches("[data-ce-group]")) CE.group = +e.target.value;
    if (e.target.matches("[data-ce-file]") && e.target.files[0]) {
      try { toast("جاري رفع الصورة…"); CE.image = await uploadBlob(await compress(e.target.files[0], 900, 90)); renderCE(); toast("انرفعت الصورة"); } catch (err) { toast(err.message); }
      e.target.value = "";
    }
  });
  // drag to reorder products inside a collection
  let pdrag = null;
  document.addEventListener("dragstart", (e) => { const it = e.target.closest && e.target.closest("[data-pj]"); if (it) { pdrag = +it.dataset.pj; e.dataTransfer.effectAllowed = "move"; } });
  document.addEventListener("dragover", (e) => { if (pdrag != null && e.target.closest && e.target.closest("[data-pj]")) e.preventDefault(); });
  document.addEventListener("drop", (e) => { const it = pdrag != null && e.target.closest && e.target.closest("[data-pj]"); if (!it) return; e.preventDefault(); const to = +it.dataset.pj; CE.pids.splice(to, 0, CE.pids.splice(pdrag, 1)[0]); pdrag = null; renderCEList(); });
  document.addEventListener("dragend", () => { pdrag = null; });

  // ---------- generic edit window (discounts, pages) ----------
  let X = null; // {render(), save()}
  function openX(title, ctrl) { X = ctrl; $("[data-x-title]").textContent = title; renderX(); $("[data-x-dlg]").showModal(); }
  function renderX() { if (!X) return; const b = $("[data-x-body]"), y = b.scrollTop; b.innerHTML = X.render(); b.scrollTop = y; }
  function closeX() { X = null; const d = $("[data-x-dlg]"); if (d.open) d.close(); }
  document.addEventListener("click", (e) => {
    if (!X) return;
    if (e.target.closest("[data-x-cancel]")) { closeX(); return; }
    if (e.target.closest("[data-x-save]")) {
      const r = X.save();
      if (r && r.then) { const btn = $("[data-x-save]"); btn.disabled = true; r.then((ok) => { btn.disabled = false; if (ok !== false) closeX(); }); return; }
      if (r !== false) { const np = X && X.noPublish; closeX(); if (!np && stDirty()) $("[data-set-save]").click(); }
      return;
    }
    const sg = e.target.closest("[data-fs] [data-v]");
    if (sg) { X.draft[sg.closest("[data-fs]").dataset.fs] = sg.dataset.v; renderX(); return; }
    if (X.click) X.click(e);
  });
  document.addEventListener("input", (e) => {
    if (!X || !e.target.closest("[data-x-body]")) return;
    const f = e.target.dataset.f;
    if (f) X.draft[f] = e.target.type === "checkbox" ? e.target.checked : e.target.type === "number" ? (e.target.value === "" ? "" : +e.target.value) : e.target.value;
    if (X.onInput) X.onInput(e);
  });
  $("[data-x-dlg]").addEventListener("cancel", (e) => { e.preventDefault(); closeX(); });
  const fsSeg = (f, cur, opts) => `<div class="seg" data-fs="${f}">${opts.map(([v, t]) => `<button type="button" data-v="${v}" class="${String(cur) === v ? "on" : ""}">${t}</button>`).join("")}</div>`;
  const fSw = (f, on, label, hint) => `<div class="w-sw"><label class="switch"><input type="checkbox" data-f="${f}" ${on ? "checked" : ""}><span></span> ${label}</label>${hint ? `<small class="hint">${hint}</small>` : ""}</div>`;

  // ---------- discounts ----------
  let USED = {};
  const discValue = (d) => (d.kind === "percent" ? `${d.value}%` : d.kind === "fixed" ? `$${d.value}` : "شحن مجاني");
  function discState(d) {
    const now = Date.now();
    if (d.on === false) return ["موقّف", "off"];
    if (d.end && now > Date.parse(d.end) + 864e5) return ["منتهي", "off"];
    if (d.start && now < Date.parse(d.start)) return ["مجدول", "wait"];
    if (+d.limit > 0 && (USED[d.id] || 0) >= +d.limit) return ["خلص العدد", "off"];
    return ["فعّال", "ok"];
  }
  function renderDiscounts() {
    const box = $("[data-disc-list]"); if (!box || !ST) return;
    const L = ST.discounts || [];
    box.innerHTML = L.map((d, i) => { const [st, cls] = discState(d); return `<div class="dc-row">
        <span class="dc-ic">${d.type === "code" ? "🎟" : "⚡"}</span>
        <div class="dc-txt"><b>${esc(d.name)}</b><small>${d.type === "code" ? `كود: <code>${esc(d.code)}</code>` : "تلقائي"} · ${discValue(d)} · ${d.scope === "cats" ? `${(d.cats || []).length} مجموعة` : d.scope === "products" ? `${(d.pids || []).length} منتج` : "كل المنتجات"}${+d.min ? ` · فوق $${d.min}` : ""} · استُخدم ${nf(USED[d.id] || 0)}${+d.limit ? " من " + nf(d.limit) : ""} مرة${d.end ? ` · لـ ${esc(d.end)}` : ""}</small></div>
        <span class="dc-st ${cls}">${st}</span>
        <span class="ws-btns"><button type="button" class="ws-del" data-disc-del="${i}" aria-label="حذف">${TRASH}</button><button type="button" class="ws-edit" data-disc-edit="${i}">تعديل</button></span></div>`; }).join("")
      || `<div class="dc-empty"><b>ما في خصومات لهلق</b><p class="hint">مثلاً: خصم تلقائي 5% على كل الطلبات، أو كود «KO10» بيعطي 10% للي بتبعتلهم ياه.</p></div>`;
  }
  async function loadUsed() { try { USED = await api("/api/discounts/used"); } catch {} renderDiscounts(); }
  function discEditor(idx, type) {
    const base = idx != null ? JSON.parse(JSON.stringify(ST.discounts[idx])) : { id: "d" + Date.now().toString(36), type, name: type === "code" ? "كود خصم" : "خصم على الطلب", code: "", kind: "percent", value: 10, scope: "all", cats: [], pids: [], min: 0, limit: 0, start: "", end: "", badge: true, badgeText: "", on: true };
    let q = "";
    const D = base;
    openX(idx != null ? "تعديل الخصم" : type === "code" ? "كود خصم جديد" : "خصم تلقائي جديد", {
      draft: D,
      render() {
        const cats = allCats(), lab = (c) => ST.design.catLabels?.[c] || c;
        const found = q ? products.filter((p) => !p.hidden && p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 30) : [];
        const chosen = (D.pids || []).map((id) => products.find((p) => p.id === id)).filter(Boolean);
        return `<div class="field"><label>نوع الخصم</label>${fsSeg("type", D.type, [["auto", "⚡ تلقائي (بينطبق لحاله)"], ["code", "🎟 كود بيكتبه الزبون"]])}</div>
          <div class="field"><label>اسم الخصم (بيشوفه الزبون بالسلة)</label><input data-f="name" value="${esc(D.name)}" maxlength="60"></div>
          ${D.type === "code" ? `<div class="field"><label>الكود</label><div class="coupon-row"><input data-f="code" value="${esc(D.code)}" dir="ltr" maxlength="20" placeholder="KO10" style="text-transform:uppercase"><button type="button" class="btn btn-ghost sm" data-gen>توليد كود</button></div><small class="hint">حروف إنكليزية وأرقام، 3–20 حرف.</small></div>` : ""}
          <div class="field"><label>قيمة الخصم</label>${fsSeg("kind", D.kind, [["percent", "نسبة %"], ["fixed", "مبلغ ثابت $"], ["freeship", "شحن مجاني"]])}</div>
          ${D.kind !== "freeship" ? `<div class="field"><label>${D.kind === "percent" ? "النسبة (%)" : "المبلغ ($)"}</label><input type="number" data-f="value" value="${esc(D.value)}" min="0" ${D.kind === "percent" ? 'max="100"' : ""} step="0.5" dir="ltr" class="w-num"></div>` : ""}
          <div class="field"><label>بينطبق على</label>${fsSeg("scope", D.scope, [["all", "كل المنتجات"], ["cats", "مجموعات محددة"], ["products", "منتجات محددة"]])}</div>
          ${D.scope === "cats" ? `<div class="dc-chips">${cats.map((c) => `<button type="button" class="chip${(D.cats || []).includes(c) ? " on" : ""}" data-dcat="${esc(c)}">${esc(lab(c))}</button>`).join("")}</div>` : ""}
          ${D.scope === "products" ? `<div class="dc-chips">${chosen.map((p) => `<button type="button" class="chip on" data-dpid="${esc(p.id)}">${esc(p.name)} ✕</button>`).join("") || `<small class="hint">ما اخترت منتجات لهلق.</small>`}</div>
            <input data-dq placeholder="دوّر على منتج لتضيفه" value="${esc(q)}" class="dc-search"><div class="dc-found">${found.map((p) => `<button type="button" data-dpid="${esc(p.id)}" class="${(D.pids || []).includes(p.id) ? "on" : ""}"><img src="${esc(p.thumb || p.image || NOIMG)}" alt="">${esc(p.name)}</button>`).join("")}</div>` : ""}
          <div class="row2"><div class="field"><label>أقل قيمة للطلب ($، 0 = بدون)</label><input type="number" data-f="min" value="${esc(D.min)}" min="0" dir="ltr"></div>
            <div class="field"><label>كم مرة بينستخدم (0 = بلا حد)</label><input type="number" data-f="limit" value="${esc(D.limit)}" min="0" dir="ltr"><small class="hint">استُخدم ${nf(USED[D.id] || 0)} مرة لهلق</small></div></div>
          <div class="row2"><div class="field"><label>من تاريخ (اختياري)</label><input type="date" data-f="start" value="${esc(D.start)}"></div><div class="field"><label>لتاريخ (اختياري)</label><input type="date" data-f="end" value="${esc(D.end)}"></div></div>
          ${D.type === "auto" ? fSw("badge", D.badge !== false, "اعرض شارة عالمنتجات يلي عليها الخصم", "") + `<div class="field"><label>نص الشارة</label><input data-f="badgeText" value="${esc(D.badgeText)}" maxlength="40" placeholder="${D.kind === "percent" ? `خصم ${D.value}% بعد الطلب` : D.kind === "fixed" ? `خصم $${D.value}` : "شحن مجاني"}"></div>` : ""}
          ${fSw("on", D.on !== false, "الخصم مفعّل", "")}`;
      },
      onInput(e) { if (e.target.matches("[data-dq]")) { q = e.target.value; renderX(); const i = $("[data-dq]"); i.focus(); i.setSelectionRange(q.length, q.length); } },
      click(e) {
        const c = e.target.closest("[data-dcat]"); if (c) { const v = c.dataset.dcat; D.cats = (D.cats || []).includes(v) ? D.cats.filter((x) => x !== v) : [...(D.cats || []), v]; renderX(); return; }
        const p = e.target.closest("[data-dpid]"); if (p) { const v = p.dataset.dpid; D.pids = (D.pids || []).includes(v) ? D.pids.filter((x) => x !== v) : [...(D.pids || []), v]; renderX(); return; }
        if (e.target.closest("[data-gen]")) { D.code = "KO" + Math.random().toString(36).slice(2, 7).toUpperCase(); renderX(); }
      },
      save() {
        D.name = String(D.name || "").trim(); D.code = String(D.code || "").trim().toUpperCase();
        if (!D.name) { toast("اكتب اسم الخصم"); return false; }
        if (D.type === "code" && !/^[A-Z0-9_-]{3,20}$/.test(D.code)) { toast("الكود لازم يكون 3–20 حرف إنكليزي أو رقم"); return false; }
        if (D.type === "code" && ST.discounts.some((x, j) => j !== idx && x.type === "code" && String(x.code).toUpperCase() === D.code)) { toast("في كود تاني بنفس الاسم"); return false; }
        if (D.kind === "percent" && !(+D.value > 0 && +D.value <= 100)) { toast("النسبة لازم بين 1 و 100"); return false; }
        if (D.kind === "fixed" && !(+D.value > 0)) { toast("اكتب قيمة الخصم"); return false; }
        if (D.scope === "cats" && !(D.cats || []).length) { toast("اختار مجموعة وحدة عالأقل"); return false; }
        if (D.scope === "products" && !(D.pids || []).length) { toast("اختار منتج واحد عالأقل"); return false; }
        D.value = +D.value || 0; D.min = +D.min || 0; D.limit = +D.limit || 0;
        if (idx != null) ST.discounts[idx] = D; else ST.discounts.push(D);
        renderDiscounts(); updateSetBar();
      },
    });
  }
  document.addEventListener("click", (e) => {
    if (!ST) return;
    const n = e.target.closest("[data-disc-new]"); if (n) { discEditor(null, n.dataset.discNew); return; }
    const ed = e.target.closest("[data-disc-edit]"); if (ed) { discEditor(+ed.dataset.discEdit); return; }
    const del = e.target.closest("[data-disc-del]");
    if (del) { const d = ST.discounts[+del.dataset.discDel]; if (!confirm(`حذف «${d.name}»؟`)) return; ST.discounts.splice(+del.dataset.discDel, 1); renderDiscounts(); updateSetBar(); $("[data-set-save]").click(); }
  });

  // ---------- abandoned carts ----------
  let CARTS = [];
  async function loadCarts(quiet) {
    try { CARTS = await api("/api/carts"); } catch (e) { if (!quiet) toast(e.message); return; }
    const old = CARTS.filter((c) => Date.now() - Date.parse(c.at) > 20 * 60e3).length, b = $("[data-cartcount]");
    if (b) { b.textContent = old; b.hidden = !old; }
    renderCarts();
  }
  const ago = (t) => { const m = Math.round((Date.now() - Date.parse(t)) / 60e3); return m < 60 ? `قبل ${nf(m)} دقيقة` : m < 1440 ? `قبل ${nf(Math.round(m / 60))} ساعة` : `قبل ${nf(Math.round(m / 1440))} يوم`; };
  function renderCarts() {
    const box = $("[data-carts-list]"); if (!box) return;
    const store = (ST && ST.store.name) || "KO SPORT";
    box.innerHTML = CARTS.map((c) => {
      const fresh = Date.now() - Date.parse(c.at) < 20 * 60e3;
      const wa = String(c.phone).replace(/\D/g, "").replace(/^0/, "963");
      const msg = `مرحبا ${c.name || ""} 👋\nمعك ${store}. لاحظنا إنك ما كمّلت طلبك:\n${c.items.map((i) => `- ${i.name}${i.opt ? " (" + i.opt + ")" : ""} × ${i.qty}`).join("\n")}\nإذا عندك أي سؤال أو بدك نكمّل الطلب معك هون، نحنا جاهزين 🙏`;
      return `<div class="w-card ab-cart"><div class="ab-head"><div><b>${esc(c.name || "بدون اسم")}</b><small dir="ltr">${esc(c.phone)}</small><small>${esc(c.gov || "")} · ${ago(c.at)}</small></div>${fresh ? `<span class="dc-st wait">عم يعبّي الطلب هلق</span>` : ""}<b class="ab-tot">$${nf(c.total)}</b></div>
        <div class="ab-items">${c.items.map((i) => `<div><img src="${esc(i.image || NOIMG)}" alt="">${esc(i.name)}${i.opt ? ` · ${esc(i.opt)}` : ""} × ${i.qty}</div>`).join("")}</div>
        <div class="ab-acts"><a class="btn btn-red sm" target="_blank" rel="noopener" href="https://wa.me/${esc(wa)}?text=${encodeURIComponent(msg)}">📲 راسله على واتساب</a><button type="button" class="btn btn-ghost sm" data-cart-del="${esc(c.sid)}">حذف</button></div></div>`;
    }).join("") || `<div class="w-card dc-empty"><b>ما في سلّات متروكة</b><p class="hint">لما زبون يكتب رقمه بصفحة إتمام الطلب وما يكمّل، بيطلع هون.</p></div>`;
  }
  document.addEventListener("click", async (e) => {
    if (e.target.closest("[data-carts-refresh]")) { loadCarts(); return; }
    const d = e.target.closest("[data-cart-del]"); if (!d) return;
    try { await api("/api/carts/" + encodeURIComponent(d.dataset.cartDel), { method: "DELETE" }); CARTS = CARTS.filter((c) => c.sid !== d.dataset.cartDel); renderCarts(); loadCarts(true); } catch (err) { toast(err.message); }
  });

  // ---------- pages ----------
  const slugify = (t) => String(t || "").trim().replace(/\s+/g, "-").replace(/[^\p{L}\p{N}-]/gu, "").slice(0, 60) || "page";
  function renderPages() {
    const box = $("[data-pages-list]"); if (!box || !ST) return;
    box.innerHTML = (ST.pages || []).map((p, i) => (p.legal || LEGAL.includes(p.title) ? "" : `<div class="dc-row"><span class="dc-ic">📄</span><div class="dc-txt"><b>${esc(p.title)}</b><small dir="ltr">/#/page/${esc(p.slug)}</small></div>
        <span class="dc-st ${p.on === false ? "off" : "ok"}">${p.on === false ? "مسودة" : p.footer === false ? "منشورة" : "منشورة · بالفوتر"}</span>
        ${p.on === false ? "" : `<a class="btn btn-ghost sm" href="/#/page/${encodeURIComponent(p.slug)}" target="_blank">عرض</a>`}
        <span class="ws-btns"><button type="button" class="ws-del" data-page-del="${i}" aria-label="حذف">${TRASH}</button><button type="button" class="ws-edit" data-page-edit="${i}">تعديل</button></span></div>`)).join("")
      || `<div class="dc-empty"><b>ما في صفحات لهلق</b><p class="hint">اكبس «أضف الصفحات الجاهزة» لنحضّرلك من نحن، سياسة الاسترجاع، الشحن، الخصوصية والشروط كمسودات تراجعها قبل النشر.</p></div>`;
  }
  function pageEditor(idx) {
    const D = idx != null ? JSON.parse(JSON.stringify(ST.pages[idx])) : { id: "pg" + Date.now().toString(36), title: "", slug: "", body: "", on: true, footer: true };
    let slugTouched = idx != null;
    openX(idx != null ? "تعديل الصفحة" : "صفحة جديدة", {
      draft: D,
      render() {
        return `<div class="field"><label>عنوان الصفحة</label><input data-f="title" value="${esc(D.title)}" maxlength="80" placeholder="مثلاً: من نحن"></div>
          <div class="field"><label>رابط الصفحة</label><div class="coupon-row"><span class="pg-pre" dir="ltr">/#/page/</span><input data-f="slug" data-slug value="${esc(D.slug)}" maxlength="60"></div></div>
          <div class="field"><label>المحتوى</label><textarea data-f="body" rows="14" maxlength="20000">${esc(D.body)}</textarea>
            <small class="hint">سطر فاضي = فقرة جديدة · «- » ببداية السطر = نقطة بقائمة · «# » = عنوان · **نص** = عريض · الروابط بتصير قابلة للكبس لحالها.</small></div>
          ${fSw("on", D.on !== false, "منشورة (إذا مطفية بتضل مسودة ما بيشوفها حدا)", "")}${fSw("footer", D.footer !== false, "حط رابطها بالفوتر والقائمة", "")}`;
      },
      onInput(e) {
        if (e.target.matches("[data-slug]")) slugTouched = true;
        if (e.target.dataset.f === "title" && !slugTouched) { D.slug = slugify(D.title); const s = $("[data-slug]"); if (s) s.value = D.slug; }
      },
      save() {
        D.title = String(D.title || "").trim(); D.slug = slugify(D.slug || D.title);
        if (!D.title) { toast("اكتب عنوان الصفحة"); return false; }
        if (ST.pages.some((x, j) => j !== idx && x.slug === D.slug)) { toast("في صفحة تانية بنفس الرابط"); return false; }
        if (idx != null) ST.pages[idx] = D; else ST.pages.push(D);
        renderPages(); renderLegal(); updateSetBar();
      },
    });
  }
  function pageTemplates() {
    const st = ST.store, name = st.name || "KO SPORT", wa = st.whatsapp ? "+" + st.whatsapp : "";
    const carriers = ((ST.shipping && ST.shipping.carriers) || []).filter((c) => c.on !== false);
    const ship = carriers.length ? carriers.map((c) => `- **${c.name}**: ${c.type === "door" ? "توصيل لباب البيت" : "استلام من الفرع"} — ${c.govs.map((g) => g.name).join("، ")}${c.note ? ` (${c.note})` : ""}`).join("\n") : "- توصيل لكل المحافظات";
    return [
      ["من نحن", `${name} متجر سوري متخصص بالمعدات والأدوات الرياضية: الملاكمة والفنون القتالية، كمال الأجسام واللياقة، كرة القدم والسلة وأكتر.\n\nهدفنا نوصّل عدّة رياضية أصلية بجودة عالية وسعر منيح لكل المحافظات.${st.address ? `\n\n**العنوان:** ${st.address}` : ""}${wa ? `\n**واتساب:** ${wa}` : ""}`],
      ["سياسة الشحن والتوصيل", `# طرق التوصيل\n${ship}\n\n# مدة التوصيل\nمنأكد الطلب معك على الهاتف أو الواتساب، وبعدها منجهزه ومنشحنه بأسرع وقت. المدة بتختلف حسب المحافظة وشركة الشحن.\n\n# تكلفة التوصيل\nبتطلعلك بصفحة إتمام الطلب حسب المحافظة وطريقة الشحن، أو منبلّغك فيها وقت تأكيد الطلب.`],
      ["سياسة الاسترجاع والاستبدال", `فيك تطلب استبدال أو استرجاع المنتج خلال **3 أيام** من استلامه بالشروط التالية:\n\n- يكون المنتج بحالته الأصلية وما انستعمل، ومع كرتونته وكل ملحقاته.\n- المنتجات الشخصية (متل واقيات الأسنان) ما بتنرد لأسباب صحية، إلا إذا كان فيها عيب مصنعي.\n- إذا وصلك المنتج فيه عيب أو غلط، منتحمّل نحنا تكلفة الاستبدال.\n- غير هيك، تكلفة الشحن على الزبون.\n\nلتطلب استبدال أو استرجاع، راسلنا على واتساب${wa ? ` ${wa}` : ""} مع رقم الطلب وصورة المنتج.`],
      ["سياسة الخصوصية", `منحترم خصوصيتك. لما تطلب من ${name}، منحتاج اسمك ورقم موبايلك وعنوانك أو فرع الشحن لنقدر نوصّلك طلبك.\n\n- ما منبيع معلوماتك ولا منشاركها مع حدا، إلا مع شركة الشحن بالقدر اللازم للتوصيل.\n- إذا كتبت رقمك بصفحة الطلب وما كمّلت، ممكن نتواصل معك مرة لنساعدك تكمّل.\n- فيك تطلب نحذف معلوماتك بأي وقت عن طريق الواتساب.`],
      ["الشروط والأحكام", `باستخدامك لموقع ${name} وطلبك منه، إنت موافق على الشروط التالية:\n\n- الأسعار المعروضة بالموقع هي الأسعار المعتمدة وقت الطلب، وممكن تتغير بدون إشعار مسبق.\n- الطلب بيتأكد بعد ما نتواصل معك، ومنحتفظ بحق إلغاء أي طلب إذا المنتج خلص أو كان في خطأ بالسعر.\n- صور المنتجات للتوضيح، وممكن يختلف اللون شوي حسب الشاشة.\n- التوصيل والاسترجاع حسب سياسة الشحن وسياسة الاسترجاع بالموقع.`],
    ];
  }
  document.addEventListener("click", (e) => {
    if (!ST) return;
    if (e.target.closest("[data-page-new]")) { pageEditor(null); return; }
    const ed = e.target.closest("[data-page-edit]"); if (ed) { pageEditor(+ed.dataset.pageEdit); return; }
    const del = e.target.closest("[data-page-del]");
    if (del) { const p = ST.pages[+del.dataset.pageDel]; if (!confirm(`حذف «${p.title}»؟`)) return; ST.pages.splice(+del.dataset.pageDel, 1); renderPages(); updateSetBar(); $("[data-set-save]").click(); return; }
    if (e.target.closest("[data-page-tpl]")) {
      let n = 0;
      for (const [title, body] of pageTemplates()) { const slug = slugify(title); if (ST.pages.some((p) => p.slug === slug)) continue; ST.pages.push({ id: "pg" + Date.now().toString(36) + n, title, slug, body, on: false, footer: true, legal: LEGAL.includes(title) }); n++; }
      renderLegal();
      renderPages(); updateSetBar();
      toast(n ? `انضافوا ${n} صفحات كمسودات — راجع كل وحدة، عدّل يلي بدك ياه، وفعّل «منشورة» واكبس احفظ` : "الصفحات الجاهزة موجودة من قبل");
    }
  });

  // ---------- staff accounts + connections ----------
  let STAFF = [], STATUS_ = null;
  async function loadStaff() { try { STAFF = await api("/api/staff"); } catch (e) { toast(e.message); } renderStaff(); }
  function renderStaff() {
    const box = $("[data-staff-list]"); if (!box) return;
    box.innerHTML = `<div class="dc-row"><span class="dc-ic">👑</span><div class="dc-txt"><b>صاحب المتجر</b><small>كل الصلاحيات · كلمة السر من Cloudflare</small></div><span class="dc-st ok">مالك</span></div>` +
      STAFF.map((s) => `<div class="dc-row"><span class="dc-ic">${esc(initials(s.name))}</span><div class="dc-txt"><b>${esc(s.name)}</b><small>${s.role === "orders" ? "الطلبات والعملاء بس" : "مدير: كل شي ما عدا الموظفين"} · من ${new Date(s.at).toLocaleDateString("ar-SY")}</small></div>
        <span class="dc-st ${s.on === false ? "off" : "ok"}">${s.on === false ? "موقّف" : "فعّال"}</span>${DOTS(`data-st-menu="${esc(s.id)}"`)}</div>`).join("");
  }
  function staffEditor(s) {
    const D = { name: s ? s.name : "", role: s ? s.role : "orders", password: "" };
    openX(s ? "تعديل الموظف" : "إضافة موظف", {
      draft: D,
      render() {
        return `<div class="field"><label>اسم الموظف</label><input data-f="name" value="${esc(D.name)}" maxlength="40"></div>
          <div class="field"><label>الصلاحية</label>${fsSeg("role", D.role, [["orders", "الطلبات والعملاء بس"], ["manager", "مدير (كل شي)"]])}</div>
          <div class="field"><label>${s ? "كلمة سر جديدة (فاضي = بدون تغيير)" : "كلمة السر (8 أحرف عالأقل)"}</label><input data-f="password" type="text" dir="ltr" autocomplete="off" value="${esc(D.password)}"><button type="button" class="btn btn-ghost sm" data-genpass style="margin-top:6px">توليد كلمة سر قوية</button></div>
          <small class="hint">الموظف بيفوت على <b dir="ltr">${esc(location.host)}/admin</b> بكلمة سره. ابعتله ياها بطريقة آمنة.</small>`;
      },
      click(e) { if (e.target.closest("[data-genpass]")) { const a = new Uint8Array(12); crypto.getRandomValues(a); D.password = [...a].map((x) => "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"[x % 56]).join(""); renderX(); } },
      async save() {
        try { STAFF = await api("/api/staff" + (s ? "/" + encodeURIComponent(s.id) : ""), { method: "PUT", body: JSON.stringify({ name: D.name, role: D.role, ...(D.password ? { password: D.password } : {}) }) }); renderStaff(); toast("انحفظ ✓" + (D.password ? " — لا تنسى تبعت كلمة السر للموظف" : "")); }
        catch (err) { toast(err.message); return false; }
      },
    });
  }
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-tg-test]"); if (!b) return;
    const out = b.parentElement.querySelector("[data-tg-res]"); b.disabled = true; if (out) out.textContent = "عم ابعت…";
    const WHY = { token: "الـ Token غلط. خود Token جديد من @BotFather وحطّه بقيمة TELEGRAM_BOT_TOKEN، وارفع الموقع.", chat: "رقم الـ Chat ID غلط، أو ما بعتت ولا رسالة للبوت تبعك. افتح البوت بتلغرام واكبس Start، وتأكّد من الرقم من @userinfobot.", blocked: "إنت حاظر البوت. افتحه بتلغرام واكبس Start.", missing: "المتغيّرين مو موجودين بهالنسخة. ارفع الموقع من جديد.", net: "ما قدرنا نوصل لتلغرام هلّق، جرّب كمان شوي." };
    try { const r = await api("/api/telegram-test", { method: "POST" }); if (out) out.textContent = r.ok ? "✓ انبعتت. شوف تلغرام." : (WHY[r.why] || "تلغرام رفض: " + (r.desc || "")); }
    catch { if (out) out.textContent = "ما زبط، جرّب كمان مرة."; }
    b.disabled = false;
  });
  async function loadStatus() {
    try { STATUS_ = await api("/api/status"); } catch { STATUS_ = null; }
    const ok = (b) => (b ? `<span class="dc-st ok">✓ مربوط</span>` : `<span class="dc-st off">مو مربوط</span>`);
    const st = $("[data-status]");
    if (st && STATUS_) st.innerHTML = [["قاعدة البيانات (KV)", true, "لحفظ الطلبات والإعدادات"], ["إشعارات تلغرام", STATUS_.telegram, "TELEGRAM_BOT_TOKEN و TELEGRAM_CHAT_ID"], ["الذكاء الاصطناعي", STATUS_.ai, "Binding باسم AI"], ["الدومين", true, STATUS_.host]].map(([t, b, h]) => `<div class="st-tile"><b>${t}</b>${ok(b)}<small dir="auto">${esc(h)}</small></div>`).join("");
    const tg = $("[data-app-tg]"), ai = $("[data-app-ai]");
    const T = (STATUS_ && STATUS_.tg) || {}, line = (name, has, ok, bad) => `<div class="tg-chk ${has && ok ? "ok" : "no"}"><code>${name}</code><span>${!has ? (T.token || T.chat ? "✗ مو موجود أو قيمته فاضية: تأكّد إن الاسم مكتوب بالضبط هيك وإنك حاطط قيمة، وبعدين ارفع الموقع" : "✗ هالنسخة من الموقع مو شايفته") : ok ? "✓ موجود" : "⚠ " + bad}</span></div>`;
    const hashHost = STATUS_ && /^[0-9a-f]{6,}\./.test(STATUS_.host || "");
    const diag = STATUS_ && STATUS_.tg ? `<div class="tg-diag">${line("TELEGRAM_BOT_TOKEN", T.token, T.tokenOk, "شكله غلط: لازم يكون متل 123456789:AAE… (من BotFather، بلا مسافات)")}${line("TELEGRAM_CHAT_ID", T.chat, T.chatOk, "لازم يكون أرقام بس (متل 123456789)، بلا مسافات أو أحرف")}
      ${!T.token && !T.chat ? `<p class="hint"><b>الحل:</b> المتغيّرات مضافة بس النسخة الشغّالة انرفعت قبلها. بـ Cloudflare ← ko-sport ← <b>Create deployment</b> ← اختار <b>Production</b> ← ارفع الملف ← Save and Deploy. بعدين حدّث هالصفحة.</p>` : ""}
      ${hashHost ? `<p class="hint">⚠ إنت فاتح رابط نسخة قديمة (${esc(STATUS_.host)}). افتح <b>ko-sport.pages.dev/admin</b> أو دومينك.</p>` : ""}</div>` : "";
    if (tg && STATUS_) tg.innerHTML = STATUS_.telegram ? `<span class="dc-st ok">✓ مربوطة</span> <button type="button" class="w-link" data-tg-test>ابعت رسالة تجربة</button><small class="hint" data-tg-res></small>${T.tokenOk === false || T.chatOk === false ? diag : ""}` : `<span class="dc-st off">مو مربوطة</span>${diag}<ol class="steps sm"><li>بتلغرام احكي مع <b>@BotFather</b> ← /newbot ← خود الـ Token.</li><li>احكي مع البوت تبعك أي رسالة، وخود رقم الـ Chat ID من <b>@userinfobot</b>.</li><li>Cloudflare ← ko-sport ← Settings ← Variables and Secrets: ضيف <code>TELEGRAM_BOT_TOKEN</code> و <code>TELEGRAM_CHAT_ID</code> كـ Secret، وارفع الموقع من جديد.</li></ol>`;
    if (ai && STATUS_) ai.innerHTML = STATUS_.ai ? `<span class="dc-st ok">✓ شغّال</span>` : `<span class="dc-st off">مو مربوط</span><ol class="steps sm"><li>Cloudflare ← ko-sport ← Settings ← Bindings ← Add ← Workers AI.</li><li>الاسم: <code>AI</code> ← Save، وارفع الموقع من جديد.</li></ol>`;
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-staff-add]")) { staffEditor(null); return; }
    const dm = e.target.closest("[data-st-menu]"); if (!dm) return;
    const s = STAFF.find((x) => x.id === dm.dataset.stMenu); if (!s) return;
    openMenu(dm, [["تعديل / كلمة سر جديدة", MI.edit, () => staffEditor(s)],
      [s.on === false ? "تفعيل" : "إيقاف مؤقت", s.on === false ? MI.ok : MI.block, async () => { try { STAFF = await api("/api/staff/" + encodeURIComponent(s.id), { method: "PUT", body: JSON.stringify({ on: s.on === false }) }); renderStaff(); } catch (err) { toast(err.message); } }],
      ["حذف", MI.del, async () => { if (!confirm(`حذف «${s.name}»؟`)) return; try { STAFF = await api("/api/staff/" + encodeURIComponent(s.id), { method: "DELETE" }); renderStaff(); } catch (err) { toast(err.message); } }, true]]);
  });
  // legal pages (built on the pages system)
  const LEGAL = ["سياسة الخصوصية", "الشروط والأحكام", "سياسة الاسترجاع والاستبدال", "سياسة الشحن والتوصيل"];
  function renderLegal() {
    const box = $("[data-legal-list]"); if (!box || !ST) return;
    const tpl = new Map(pageTemplates().map(([t, b]) => [t, b]));
    box.innerHTML = LEGAL.map((t) => {
      const slug = slugify(t), i = ST.pages.findIndex((p) => p.slug === slug), p = ST.pages[i];
      return `<div class="dc-row"><span class="dc-ic">⚖️</span><div class="dc-txt"><b>${esc(t)}</b><small dir="ltr">/#/page/${esc(slug)}</small></div>
        <span class="dc-st ${!p ? "off" : p.on === false ? "wait" : "ok"}">${!p ? "مو موجودة" : p.on === false ? "مسودة" : "منشورة"}</span>
        ${p ? `${p.on === false ? "" : `<a class="btn btn-ghost sm" href="/#/page/${encodeURIComponent(slug)}" target="_blank">عرض</a>`}<button type="button" class="btn btn-ghost sm" data-page-edit="${i}">تعديل</button>` : `<button type="button" class="btn btn-red sm" data-legal-new="${esc(t)}">أنشئ من القالب</button>`}</div>`;
    }).join("") + `<p class="hint" style="padding:12px 4px 0">النصوص الجاهزة عامة. راجعها وعدّلها حسب طريقة شغلك قبل ما تنشرها.</p>`;
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-legal-new]"); if (!b || !ST) return;
    const t = b.dataset.legalNew, body = (pageTemplates().find(([x]) => x === t) || [])[1] || "";
    ST.pages.push({ id: "pg" + Date.now().toString(36), title: t, slug: slugify(t), body, on: false, footer: true, legal: true });
    renderLegal(); renderPages(); updateSetBar(); pageEditor(ST.pages.length - 1);
  });

  // ---------- general settings (Wuilt-style) ----------
  const LOGO_PX = { s: 30, m: 38, l: 50 };
  function renderGeneral() {
    if (!ST || !$("[data-notify-list]")) return;
    const em = ST.notify.emails;
    $("[data-notify-list]").innerHTML = em.map((e, i) => `<div class="gs-mail"><input type="email" dir="ltr" value="${esc(e)}" data-notify-i="${i}" placeholder="name@gmail.com"><button type="button" class="ws-del" data-notify-rm="${i}" aria-label="حذف">${TRASH}</button></div>`).join("") || `<p class="hint">ما في إيميلات لهلق.</p>`;
    $("[data-notify-add]").hidden = em.length >= 5;
    const ms = $("[data-mail-status]");
    if (ms) ms.innerHTML = STATUS_ && STATUS_.email ? `<span class="dc-st ok">✓ إرسال الإيميلات شغّال</span>` : `<div class="co-warn">لحتى توصلك الإيميلات فعلياً: اعمل حساب مجاني على <b>resend.com</b> ← API Keys ← Create، وحط المفتاح بـ Cloudflare ← ko-sport ← Settings ← Variables and Secrets باسم <code>RESEND_API_KEY</code> (Secret)، وارفع الموقع من جديد. بالحساب المجاني بتوصل الإيميلات لإيميلك يلي سجلت فيه بـ Resend. وتنبيهات تلغرام بتضل شغّالة كمان.</div>`;
    const d = ST.design, lg = $("[data-gs-logo]");
    if (lg) lg.innerHTML = d.logoImage ? `<img src="${esc(d.logoImage)}" alt="">` : `<b class="gs-logo-txt">${esc(d.logoText1 || (d.logoText2 || "?").slice(0, 2))}</b>`;
    const lh = $("[data-logo-hint]"); if (lh) lh.textContent = `ارتفاع الشعار بالموقع: ${LOGO_PX[d.logoSize] || 38}px`;
    const fv = $("[data-gs-fav]"); if (fv) fv.innerHTML = d.favicon ? `<img src="${esc(d.favicon)}" alt="">` : "⚽";
    const tn = $("[data-gs-tabname]"); if (tn) tn.textContent = ST.store.seoTitle || ST.store.name || "";
    const sm = $("[data-sitemap]"); if (sm) sm.value = location.origin + "/sitemap.xml";
    $$("[data-cnt]").forEach((c) => { const v = String(getK(c.dataset.cnt) || ""); c.textContent = `${v.length} / ${c.dataset.cntMax} حرف` + (c.dataset.cnt === "store.seoDescription" ? " · الأفضل بين ~155 و 300 حرف" : ""); c.classList.toggle("warn", c.dataset.cnt === "store.seoDescription" && v.length > 0 && v.length < 120); });
    const sp = $("[data-serp]"); if (sp) sp.innerHTML = `<small>معاينة نتيجة غوغل</small><cite dir="ltr">${esc(location.host)}</cite><b>${esc(ST.store.seoTitle || ST.store.name || "")}</b><p>${esc((ST.store.seoDescription || ST.store.tagline || "").slice(0, 160))}</p>`;
  }
  document.addEventListener("input", (e) => {
    if (!ST) return;
    const ni = e.target.closest("[data-notify-i]"); if (ni) { ST.notify.emails[+ni.dataset.notifyI] = ni.value.trim(); updateSetBar(); return; }
    if (e.target.matches('[data-k^="store."],[data-k^="design.logo"]')) renderGeneral();
  });
  document.addEventListener("click", (e) => {
    if (!ST) return;
    if (e.target.closest("[data-notify-add]")) { ST.notify.emails.push(""); renderGeneral(); const ins = $$("[data-notify-i]"); ins[ins.length - 1].focus(); return; }
    const nr = e.target.closest("[data-notify-rm]"); if (nr) { ST.notify.emails.splice(+nr.dataset.notifyRm, 1); renderGeneral(); updateSetBar(); return; }
    if (e.target.closest("[data-copy-sitemap]")) { navigator.clipboard?.writeText(location.origin + "/sitemap.xml").then(() => toast("انسخ الرابط ✓"), () => {}); return; }
    if (e.target.closest('[data-seg="design.logoSize"] [data-v]')) setTimeout(renderGeneral);
  });
  // ---------- domain: connected address, 301 redirects, robots.txt ----------
  function renderDomain() {
    const card = $("[data-dom-card]"); if (!card) return;
    const host = location.host, temp = /\.pages\.dev$|localhost|127\.0\.0\.1/.test(host);
    card.innerHTML = `<span class="dom-ic">🔗</span><b dir="ltr">${esc(host)}</b><span class="dc-st ${temp ? "wait" : "ok"}">● ${temp ? "عنوان مؤقت" : "تم الربط"}</span>${temp ? `<small class="hint">لسا ما ربطت ko-sport.online. شوف الخطوات تحت.</small>` : ""}<a class="w-link" href="https://${esc(host)}" target="_blank" rel="noopener">فتح ↗</a>`;
    if (!ST) return;
    const L = ST.redirects;
    $("[data-rd-list]").innerHTML = L.length ? `<div class="w-table rd-table"><div class="w-tr w-th"><span>من الرابط</span><span>إلى</span><span></span></div>${L.map((r, i) => `<div class="w-tr"><span dir="ltr">${esc(r.from)}</span><span dir="ltr">${esc(r.to)}</span><span>${DOTS(`data-rd-menu="${i}"`)}</span></div>`).join("")}</div>` : `<div class="w-empty center"><span>لم تضف أي روابط لإعادة التوجيه</span></div>`;
  }
  function rdEditor(i) {
    const D = i != null ? { ...ST.redirects[i] } : { from: "/", to: "/" };
    openX(i != null ? "تعديل إعادة التوجيه" : "رابط إعادة توجيه جديد", {
      draft: D,
      render() {
        return `<div class="field"><label>الرابط القديم (بعد اسم الدومين)</label><input data-f="from" value="${esc(D.from)}" dir="ltr" placeholder="/ar/product/old-name"></div>
          <div class="field"><label>بيتحوّل لـ</label><input data-f="to" value="${esc(D.to)}" dir="ltr" placeholder="/#/c/قفازات ملاكمة  أو  https://..."></div>
          <small class="hint">مثال: <span dir="ltr">/sale</span> ← <span dir="ltr">/#/c/عروض-الأسبوع</span>. روابط Wuilt (/ar/…) بتتحوّل لحالها، وإذا حطيت واحد هون بياخد الأولوية.</small>`;
      },
      save() {
        D.from = "/" + String(D.from || "").trim().replace(/^https?:\/\/[^/]+/, "").replace(/^\/+/, "");
        D.to = String(D.to || "").trim();
        if (D.from === "/" || /\s/.test(D.from)) { toast("اكتب الرابط القديم"); return false; }
        if (!(/^\//.test(D.to) || /^https?:\/\//.test(D.to))) { toast("الرابط الجديد لازم يبلّش بـ / أو https://"); return false; }
        if (ST.redirects.some((r, j) => j !== i && r.from.toLowerCase() === D.from.toLowerCase())) { toast("هالرابط موجود من قبل"); return false; }
        if (i != null) ST.redirects[i] = D; else ST.redirects.push(D);
        renderDomain(); updateSetBar();
      },
    });
  }
  document.addEventListener("click", (e) => {
    if (!ST) return;
    if (e.target.closest("[data-rd-add]")) { rdEditor(null); return; }
    const m = e.target.closest("[data-rd-menu]"); if (!m) return;
    const i = +m.dataset.rdMenu;
    openMenu(m, [["تعديل", MI.edit, () => rdEditor(i)], ["تجربة", MI.eye, () => window.open(ST.redirects[i].from, "_blank")], ["إزالة", MI.del, () => { ST.redirects.splice(i, 1); renderDomain(); updateSetBar(); $("[data-set-save]").click(); }, true]]);
  });

  // ---------- promotional ads ----------
  const PM_TYPE = { popup: ["🪟", "نافذة منبثقة"], card: ["🗂", "بطاقة عائمة"], banner: ["📣", "شريط علوي"] };
  const PM_TRIG = { load: "بعد الدخول", scroll: "عند التمرير", exit: "عند الخروج" };
  const PM_PRESETS = {
    sale: { badge: "عرض محدود", title: "خصم 20% على كل المعدات", text: "استخدم الكود عند إتمام الطلب. العرض لفترة محدودة!", btn: "تسوّق الآن", code: "KO20", countdown: true },
    fresh: { badge: "جديد", title: "وصلت منتجات جديدة", text: "اكتشف أحدث الأدوات الرياضية قبل الكل.", btn: "شوف الجديد", code: "", countdown: false },
    ship: { badge: "توصيل", title: "توصيل لكل المحافظات", text: "اطلب اليوم وادفع عند الاستلام.", btn: "اطلب الآن", code: "", countdown: false },
  };
  const pmState = (p) => {
    const n = Date.now(), s = p.startAt && Date.parse(p.startAt), e = p.endAt && Date.parse(p.endAt);
    if (p.on === false) return ["متوقف", "off"]; if (e && n > e) return ["منتهي", "off"]; if (s && n < s) return ["مجدول", "off"]; return ["فعّال", "ok"];
  };
  const pmLocal = (iso) => { if (!iso) return ""; const d = new Date(iso); if (isNaN(d)) return ""; const z = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`; };
  function renderPromos() {
    const box = $("[data-promo-list]"); if (!box || !ST) return;
    box.innerHTML = (ST.promos || []).map((p, i) => { const [st, cls] = pmState(p), t = PM_TYPE[p.type || "popup"]; return `<div class="dc-row">
        <span class="dc-ic">${t[0]}</span>
        <div class="dc-txt"><b>${esc(p.name || p.title || "إعلان")}</b><small>${t[1]} · ${PM_TRIG[p.trigger || "load"]}${p.code ? ` · كود <code>${esc(p.code)}</code>` : ""}${p.endAt ? ` · ينتهي ${new Date(p.endAt).toLocaleDateString("ar-SY")}` : ""}</small></div>
        <span class="dc-st ${cls}">${st}</span>
        <button type="button" class="btn btn-ghost sm" data-promo-view="${i}">معاينة</button>
        <span class="ws-btns"><button type="button" class="ws-del" data-promo-del="${i}" aria-label="حذف">${TRASH}</button><button type="button" class="ws-edit" data-promo-edit="${i}">تعديل</button></span></div>`; }).join("")
      || `<div class="dc-empty"><b>ما في إعلانات لهلق</b><p class="hint">اكبس «إعلان جديد» وابدأ من قالب جاهز (عرض، منتجات جديدة، توصيل).</p></div>`;
  }
  function promoEditor(idx) {
    const D = idx != null ? JSON.parse(JSON.stringify(ST.promos[idx])) : { id: "p" + Date.now().toString(36), on: true, name: "", type: "popup", theme: "dark", badge: "", title: "", text: "", image: "", btn: "", link: "/", code: "", countdown: false, startAt: "", endAt: "", trigger: "load", delay: 3, freq: "session", pages: "home" };
    const codes = (ST.discounts || []).filter((d) => d.type === "code" && d.code).map((d) => d.code);
    openX(idx != null ? "تعديل الإعلان" : "إعلان جديد", {
      draft: D,
      render() {
        return `${idx == null ? `<div class="pu-chips"><small class="hint">ابدأ من قالب:</small><button type="button" class="pu-chip" data-pm-tpl="sale">🔥 عرض بخصم</button><button type="button" class="pu-chip" data-pm-tpl="fresh">📦 منتجات جديدة</button><button type="button" class="pu-chip" data-pm-tpl="ship">🚚 توصيل</button></div>` : ""}
          <div class="field"><label>شكل الإعلان</label>${fsSeg("type", D.type, [["popup", "🪟 نافذة منبثقة"], ["card", "🗂 بطاقة عائمة"], ["banner", "📣 شريط علوي"]])}</div>
          <div class="field"><label>اللون</label>${fsSeg("theme", D.theme, [["dark", "داكن"], ["light", "فاتح"], ["brand", "لون المتجر"], ["gradient", "متدرّج"]])}</div>
          <div class="row2"><div class="field"><label>شارة صغيرة (اختياري)</label><input data-f="badge" value="${esc(D.badge)}" maxlength="30" placeholder="عرض محدود"></div>
            <div class="field"><label>اسم داخلي (إلك بس)</label><input data-f="name" value="${esc(D.name)}" maxlength="60" placeholder="عرض العيد"></div></div>
          <div class="field"><label>العنوان</label><input data-f="title" value="${esc(D.title)}" maxlength="80" placeholder="خصم 20% على كل المعدات"></div>
          <div class="field"><label>النص</label><textarea data-f="text" rows="2" maxlength="300" placeholder="جملة قصيرة بتشجّع على الضغط">${esc(D.text)}</textarea></div>
          ${D.type !== "banner" ? `<div class="field"><label>صورة (اختياري)</label><div class="pu-img"><label class="btn btn-ghost sm">⬆ ارفع صورة<input type="file" accept="image/*" data-promo-img hidden></label>${D.image ? `<img src="${esc(D.image)}" alt="" class="pm-thumb"><button type="button" class="btn btn-ghost sm" data-promo-imgx>إزالة</button>` : ""}</div></div>` : ""}
          <div class="row2"><div class="field"><label>نص الزر</label><input data-f="btn" value="${esc(D.btn)}" maxlength="40" placeholder="تسوّق الآن"></div>
            <div class="field"><label>الزر بيفتح</label><input data-f="link" value="${esc(D.link)}" dir="ltr" placeholder="/ أو /#/cart أو https://..."></div></div>
          <div class="field"><label>كود خصم قابل للنسخ (اختياري)</label><input data-f="code" value="${esc(D.code)}" dir="ltr" maxlength="24" placeholder="KO20" style="text-transform:uppercase">
            ${codes.length ? `<div class="dc-chips">${codes.map((c) => `<button type="button" class="chip${D.code === c ? " on" : ""}" data-pm-code="${esc(c)}">${esc(c)}</button>`).join("")}</div>` : ""}
            <small class="hint">لازم تكون أنشأت الكود من «الخصومات» حتى يشتغل بالسلة.</small></div>
          ${fSw("countdown", !!D.countdown, "اعرض عدّاد تنازلي", "بيعدّ لتاريخ الانتهاء يلي تحدده تحت.")}
          <div class="row2"><div class="field"><label>يبدأ (اختياري)</label><input type="datetime-local" data-dt="startAt" value="${esc(pmLocal(D.startAt))}"></div>
            <div class="field"><label>ينتهي (اختياري)</label><input type="datetime-local" data-dt="endAt" value="${esc(pmLocal(D.endAt))}"></div></div>
          <div class="field"><label>متى يظهر</label>${fsSeg("trigger", D.trigger, [["load", "بعد الدخول"], ["scroll", "عند التمرير"], ["exit", "عند الخروج (كمبيوتر)"]])}</div>
          ${D.trigger === "load" ? `<div class="field"><label>بعد كم ثانية</label><input type="number" data-f="delay" value="${esc(D.delay)}" min="0" max="120" dir="ltr" class="w-num"></div>` : ""}
          <div class="field"><label>كل قديش يظهر لنفس الزائر</label>${fsSeg("freq", D.freq, [["always", "كل زيارة"], ["session", "مرة بالجلسة"], ["day", "مرة باليوم"], ["week", "مرة بالأسبوع"], ["once", "مرة وحدة"]])}</div>
          <div class="field"><label>الصفحات</label>${fsSeg("pages", D.pages, [["home", "الرئيسية بس"], ["all", "كل الصفحات"]])}</div>
          ${fSw("on", D.on !== false, "الإعلان مفعّل", "")}
          <div class="pu-acts"><button type="button" class="btn btn-ghost" data-pm-prev>👁 معاينة</button></div>`;
      },
      onInput(e) { const k = e.target.dataset.dt; if (k) D[k] = e.target.value ? new Date(e.target.value).toISOString() : ""; },
      click(e) {
        const t = e.target.closest("[data-pm-tpl]"); if (t) { Object.assign(D, PM_PRESETS[t.dataset.pmTpl]); if (D.countdown && !D.endAt) D.endAt = new Date(Date.now() + 3 * 864e5).toISOString(); renderX(); return; }
        const c = e.target.closest("[data-pm-code]"); if (c) { D.code = c.dataset.pmCode; renderX(); return; }
        if (e.target.closest("[data-promo-imgx]")) { D.image = ""; renderX(); return; }
        if (e.target.closest("[data-pm-prev]")) { if (window.KOPromo) KOPromo.show({ ...D, id: "pv" }, { preview: true, host: $("[data-x-dlg]") }); }
      },
      save() {
        D.name = String(D.name || "").trim(); D.code = String(D.code || "").trim().toUpperCase();
        if (!D.title && !D.text && !D.image) { toast("اكتب عنوان أو نص للإعلان"); return false; }
        if (D.countdown && !D.endAt) { toast("حدّد تاريخ الانتهاء حتى يشتغل العدّاد"); return false; }
        if (D.btn && !/^(\/|#\/|https?:\/\/)/.test(D.link || "")) { toast("رابط الزر لازم يبدأ بـ / أو https://"); return false; }
        if (D.code && !/^[A-Z0-9_-]{2,24}$/.test(D.code)) { toast("الكود حروف إنكليزية وأرقام بس"); return false; }
        D.delay = Math.max(0, Math.min(120, +D.delay || 0));
        if (idx != null) ST.promos[idx] = D; else ST.promos.push(D);
        renderPromos(); updateSetBar();
      },
    });
  }
  document.addEventListener("change", async (e) => {
    if (!e.target.matches("[data-promo-img]") || !X) return;
    const f = e.target.files[0]; e.target.value = ""; if (!f) return;
    try { toast("جاري رفع الصورة…"); X.draft.image = await uploadBlob(await compress(f, 1000, 110)); renderX(); } catch (err) { toast(err.message); }
  });
  document.addEventListener("click", (e) => {
    if (!ST) return;
    if (e.target.closest("[data-promo-new]")) { if (ST.promos.length >= 20) { toast("الحد 20 إعلان"); return; } promoEditor(null); return; }
    const ed = e.target.closest("[data-promo-edit]"); if (ed) { promoEditor(+ed.dataset.promoEdit); return; }
    const vw = e.target.closest("[data-promo-view]"); if (vw) { const p = ST.promos[+vw.dataset.promoView]; if (window.KOPromo) KOPromo.show({ ...p, id: "pv" }, { preview: true }); return; }
    const del = e.target.closest("[data-promo-del]");
    if (del) { const p = ST.promos[+del.dataset.promoDel]; if (!confirm(`حذف «${p.name || p.title || "الإعلان"}»؟`)) return; ST.promos.splice(+del.dataset.promoDel, 1); renderPromos(); updateSetBar(); $("[data-set-save]").click(); }
  });

  // ---------- push notifications ----------
  let PU = null, puImg = "", puMid = "", puBusy = false;
  const PU_TPL = [["🔥 عرض جديد", "🔥 تخفيضات لفترة محدودة", "وفّر على معدات الملاكمة والكمال. اطلب قبل ما تخلص!"], ["📦 وصل حديثاً", "📦 وصلت منتجات جديدة", "شوف أحدث الأدوات الرياضية الآن في KO SPORT."], ["🚚 توصيل", "🚚 توصيل لكل المحافظات", "اطلب اليوم وادفع عند الاستلام."]];
  const puLink = () => {
    const t = $("[data-pu-lt]").value;
    if (t === "product") { const v = $("[data-pu-lp]").value; return v ? "/#/p/" + encodeURIComponent(v) : "/"; }
    if (t === "cat") { const c = $("[data-pu-lp]").value; if (!c) return "/"; const m = (ST && ST.design && ST.design.catMeta && ST.design.catMeta[c]) || {}; return "/#/c/" + encodeURIComponent(m.slug || c); }
    if (t === "custom") { const v = $("[data-pu-lc]").value.trim(); return /^(\/|https?:\/\/)/.test(v) ? v : "/"; }
    return "/";
  };
  function puPreview() {
    const t = $("[data-pu-title]").value, b = $("[data-pu-body]").value;
    $("[data-pv-t]").textContent = t || "عنوان الإشعار"; $("[data-pv-b]").textContent = b || "نص الإشعار يظهر هنا";
    const im = $("[data-pv-i]"); im.hidden = !puImg; if (puImg) im.src = puImg;
    $("[data-pu-c1]").textContent = t.length + "/60"; $("[data-pu-c2]").textContent = b.length + "/160";
    $("[data-pu-imgx]").hidden = !puImg;
  }
  async function puFillLinkList() {
    const t = $("[data-pu-lt]").value, sel = $("[data-pu-lp]"), cu = $("[data-pu-lc]");
    sel.hidden = !(t === "product" || t === "cat"); cu.hidden = t !== "custom";
    $("[data-pu-imgprod]").hidden = t !== "product";
    if (t === "product") {
      if (!products.length) { try { await loadProducts(); } catch {} }
      sel.innerHTML = `<option value="">— اختر المنتج —</option>` + products.filter((p) => p.active !== false).map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join("");
    } else if (t === "cat") {
      const lab = (c) => (ST && ST.design && ST.design.catLabels && ST.design.catLabels[c]) || c;
      let cats = []; try { cats = typeof allCats === "function" ? allCats() : []; } catch {}
      if (!cats.length) { const s = new Set(); products.forEach((p) => p.category && s.add(p.category)); cats = [...s]; }
      sel.innerHTML = `<option value="">— اختر المجموعة —</option>` + cats.map((c) => `<option value="${esc(c)}">${esc(lab(c))}</option>`).join("");
    }
  }
  async function puDevice() {
    const box = $("[data-pu-dev]");
    if (!window.KOPush || !KOPush.supported()) { box.innerHTML = `<div class="hint">هالمتصفح ما بيدعم الإشعارات. على الآيفون لازم تثبّت الموقع بـ«إضافة إلى الشاشة الرئيسية» وتفتحه منها.</div>`; return; }
    let s = null; try { s = await KOPush.current(); } catch {}
    const on = !!s && KOPush.permission() === "granted";
    box.innerHTML = on ? `<div class="pu-on">✓ مفعّلة على هالجهاز</div><button type="button" class="btn btn-ghost sm" data-pu-devoff>إيقاف</button>`
      : KOPush.permission() === "denied" ? `<div class="hint">الإذن مرفوض من إعدادات المتصفح. فعّله من إعدادات الموقع ثم حدّث الصفحة.</div>`
      : `<button type="button" class="btn btn-red sm" data-pu-devon>🔔 فعّل على هالجهاز</button>`;
  }
  function puRender() {
    if (!PU) return;
    $("[data-pu-stats]").innerHTML = [["المشتركين", PU.total], ["أندرويد", PU.android], ["آيفون", PU.ios], ["كمبيوتر", PU.pc], ["أجهزة التنبيه بالطلبات", PU.admins]]
      .map(([l, n]) => `<div class="pu-st"><b>${(+n || 0).toLocaleString("ar-SY")}</b><span>${l}</span></div>`).join("");
    puBind();
    $("[data-pu-send]").textContent = PU.total ? `إرسال لـ ${PU.total.toLocaleString("ar-SY")} مشترك` : "إرسال للجميع";
    $("[data-pu-log]").innerHTML = (PU.log || []).map((l) => `<div class="dc-row"><span class="dc-ic">🔔</span><div class="dc-txt"><b>${esc(l.title || "—")}</b><small>${esc(l.body || "")}</small><small>${new Date(l.at).toLocaleString("ar-SY")} · وصل لـ ${l.sent} من ${l.to}${l.failed ? ` · فشل ${l.failed}` : ""}${l.gone ? ` · ${l.gone} اشتراك منتهي انحذف` : ""}</small></div></div>`).join("") || `<div class="hint" style="padding:14px 0">لسا ما أرسلت أي إشعار.</div>`;
  }
  const puGet = (o, p) => p.split(".").reduce((x, k) => (x == null ? x : x[k]), o);
  const puSetP = (o, p, v) => { const ks = p.split("."); let x = o; ks.slice(0, -1).forEach((k) => (x = x[k] = x[k] || {})); x[ks.pop()] = v; };
  function puBind() {
    $$("[data-pu-cfg]").forEach((el) => { const v = puGet(PU.cfg, el.dataset.puCfg); if (el.type === "checkbox") el.checked = v !== false; else el.value = v == null ? "" : v; });
    $$("[data-pu-seg]").forEach((sg) => { const v = puGet(PU.cfg, sg.dataset.puSeg); $$("[data-v]", sg).forEach((b) => b.classList.toggle("on", b.dataset.v === v)); });
    puBarPrev();
  }
  function puBarPrev() {
    if (!PU || !window.KOBar) return;
    const mode = ($("[data-pu-pvmode] .on") || {}).dataset?.v || "combined", box = $("[data-pu-bar-prev]");
    $("[data-pu-iconrow]").hidden = PU.cfg.bar.icon !== "image";
    box.innerHTML = ""; const c = KOBar.make(PU.cfg.bar, mode); c.el.classList.add("on"); box.appendChild(c.el);
  }
  async function loadPush() {
    const tp = $("[data-pu-tpl]");
    if (!tp.children.length) { tp.innerHTML = PU_TPL.map((t, i) => `<button type="button" class="pu-chip" data-pu-t="${i}">${esc(t[0])}</button>`).join(""); puPreview(); }
    try { PU = await api("/api/push/stats"); } catch (e) { toast(e.message); return; }
    puRender(); puDevice();
  }
  async function puSend(target) {
    if (puBusy) return;
    const title = $("[data-pu-title]").value.trim(), body = $("[data-pu-body]").value.trim();
    if (!title && !body) { toast("اكتب عنوان أو نص للإشعار"); return; }
    let endpoint = "";
    if (target === "me") {
      try { const s = await KOPush.current(); endpoint = s ? s.endpoint : ""; } catch {}
      if (!endpoint) { toast("فعّل الإشعارات على هالجهاز أولاً (الزر على اليسار)"); return; }
    } else {
      const n = (PU && PU.total) || 0;
      if (!n) { toast("ما في مشتركين بعد"); return; }
      if (!confirm(`رح يوصل الإشعار لـ ${n} مشترك. تكمّل؟`)) return;
    }
    puBusy = true; puMid = Math.random().toString(36).slice(2, 12);
    const prog = $("[data-pu-prog]"), bar = prog.querySelector("i"), txt = prog.querySelector("span");
    prog.hidden = false; bar.style.width = "4%"; txt.textContent = "جاري الإرسال…";
    const msg = { title, body, url: puLink(), image: puImg, tag: target === "me" ? "test" : "", target, endpoint, mid: puMid };
    let off = 0, sent = 0, failed = 0, total = 1;
    try {
      for (;;) {
        const r = await api("/api/push/send", { method: "POST", body: JSON.stringify({ ...msg, offset: off }) });
        sent += r.sent; failed += r.failed; total = Math.max(1, r.total); off = r.next;
        bar.style.width = Math.max(6, Math.min(100, Math.round((off / total) * 100))) + "%";
        txt.textContent = `${Math.min(off, total)} / ${total}`;
        if (r.done || !r.next) break;
      }
      txt.textContent = target === "me" ? (sent ? "انرسل، لازم يطلع عندك خلال ثواني ✓" : "ما انرسل. جرّب إيقاف التفعيل وإعادته.") : `تم ✓ وصل لـ ${sent} من ${total}${failed ? ` (فشل ${failed})` : ""}`;
      bar.style.width = "100%";
      if (target !== "me") loadPush();
    } catch (e) { txt.textContent = e.message; toast(e.message); }
    puBusy = false;
  }
  document.addEventListener("click", async (e) => {
    const t = e.target.closest("[data-pu-t],[data-pu-send],[data-pu-test],[data-pu-devon],[data-pu-devoff],[data-pu-cfgsave],[data-pu-imgx],[data-pu-imgprod]");
    if (!t) return;
    if (t.dataset.puT !== undefined) { const x = PU_TPL[+t.dataset.puT]; $("[data-pu-title]").value = x[1]; $("[data-pu-body]").value = x[2]; puPreview(); }
    else if (t.matches("[data-pu-send]")) puSend("all");
    else if (t.matches("[data-pu-test]")) puSend("me");
    else if (t.matches("[data-pu-devon]")) {
      t.disabled = true;
      try { await KOPush.subscribe(pass); toast("تم التفعيل ✓"); } catch (err) { toast(err.message === "denied" ? "رفضت الإذن" : "ما تفعّلت، جرّب مرة ثانية"); }
      loadPush();
    } else if (t.matches("[data-pu-devoff]")) { try { await KOPush.unsubscribe(); } catch {} loadPush(); }
    else if (t.matches("[data-pu-cfgsave]")) {
      try { const r = await api("/api/push/config", { method: "PUT", body: JSON.stringify(PU.cfg) }); PU.cfg = r.cfg; puBind(); toast("انحفظ ونُشر ✓"); } catch (err) { toast(err.message); }
    } else if (t.matches("[data-pu-imgx]")) { puImg = ""; puPreview(); }
    else if (t.matches("[data-pu-imgprod]")) { const p = products.find((x) => x.id === $("[data-pu-lp]").value); if (p && (p.image || p.thumb)) { puImg = p.image || p.thumb; puPreview(); } else toast("اختر المنتج أولاً"); }
  });
  document.addEventListener("input", (e) => {
    if (e.target.closest("[data-pu-title],[data-pu-body]")) puPreview();
    const c = e.target.closest("[data-pu-cfg]");
    if (c && PU) { puSetP(PU.cfg, c.dataset.puCfg, c.type === "checkbox" ? c.checked : c.type === "number" ? (c.value === "" ? "" : +c.value) : c.value); puBarPrev(); }
  });
  document.addEventListener("click", (e) => {
    const sg = e.target.closest("[data-pu-seg] [data-v]");
    if (sg && PU) { puSetP(PU.cfg, sg.closest("[data-pu-seg]").dataset.puSeg, sg.dataset.v); puBind(); return; }
    const pm = e.target.closest("[data-pu-pvmode] [data-v]");
    if (pm) { $$("[data-pu-pvmode] [data-v]").forEach((b) => b.classList.toggle("on", b === pm)); puBarPrev(); }
  });
  document.addEventListener("change", async (e) => {
    if (e.target.matches("[data-pu-lt]")) puFillLinkList();
    else if (e.target.matches("[data-pu-icon]")) {
      const f = e.target.files[0]; e.target.value = ""; if (!f || !PU) return;
      try { toast("جاري رفع الأيقونة…"); PU.cfg.bar.image = await uploadBlob(await compress(f, 256, 30)); puBind(); } catch (err) { toast(err.message); }
    }
    else if (e.target.matches("[data-pu-img]")) {
      const f = e.target.files[0]; e.target.value = ""; if (!f) return;
      try { toast("جاري رفع الصورة…"); puImg = await uploadBlob(await compress(f, 1000, 110)); puPreview(); } catch (err) { toast(err.message); }
    }
  });

  // ---------- customer reviews ----------
  let REVS = [], revFilter = "pending";
  async function loadReviews(quiet) {
    try { REVS = await api("/api/reviews"); } catch (e) { if (!quiet) toast(e.message); return; }
    const pend = REVS.filter((r) => !r.ok).length, b = $("[data-revcount]");
    b.textContent = pend; b.hidden = !pend;
    renderReviews();
  }
  function renderReviews() {
    const box = $("[data-rev-list]"); if (!box) return;
    $$("[data-rf]").forEach((x) => x.classList.toggle("on", x.dataset.rf === revFilter));
    const L = REVS.filter((r) => revFilter === "all" || (revFilter === "ok" ? r.ok : !r.ok));
    box.innerHTML = L.map((r) => `<div class="rev-item${r.ok ? " ok" : ""}"><div class="rev-top"><b>${esc(r.name)}</b><span class="rev-stars">${"★".repeat(r.rating)}<i>${"★".repeat(5 - r.rating)}</i></span><small>${new Date(r.at).toLocaleString("ar-SY")}</small></div>
      <div class="rev-prod">على: <a href="/#/p/${encodeURIComponent(r.pid)}" target="_blank">${esc(r.pname || r.pid)}</a></div>${r.text ? `<p>${esc(r.text)}</p>` : ""}
      <div class="rev-acts">${r.ok ? `<button class="btn btn-ghost sm" data-rev-ok="${r.id}" data-v="0">إخفاء</button>` : `<button class="btn btn-red sm" data-rev-ok="${r.id}" data-v="1">✓ نشر</button>`}<button class="btn btn-ghost sm" data-rev-del="${r.id}">حذف</button></div></div>`).join("")
      || `<div class="hint" style="padding:18px 0">${revFilter === "pending" ? "ما في تقييمات جديدة بانتظارك." : "ما في تقييمات هون."}</div>`;
  }
  document.addEventListener("click", async (e) => {
    const f = e.target.closest("[data-rf]"); if (f) { revFilter = f.dataset.rf; renderReviews(); return; }
    const ok = e.target.closest("[data-rev-ok]"), del = e.target.closest("[data-rev-del]");
    if (!ok && !del) return;
    try {
      if (ok) await api("/api/reviews/" + encodeURIComponent(ok.dataset.revOk), { method: "PATCH", body: JSON.stringify({ ok: ok.dataset.v === "1" }) });
      else { if (!confirm("حذف التقييم نهائياً؟")) return; await api("/api/reviews/" + encodeURIComponent(del.dataset.revDel), { method: "DELETE" }); }
      toast(ok ? (ok.dataset.v === "1" ? "انتشر التقييم ✓" : "انخفى التقييم") : "انحذف"); loadReviews();
    } catch (err) { toast(err.message); }
  });
  $("[data-tabs]").addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) show(b.dataset.tab); });
  { const tb = $("[data-tabbar]"); if (tb) tb.addEventListener("click", (e) => { const b = e.target.closest("[data-tab]"); if (b) show(b.dataset.tab); }); }
  // «إعدادات متقدمة» remembers if it was open
  { const mo = $("[data-w-more]"); if (mo) { try { mo.open = localStorage.getItem("ko_wmore") === "1"; } catch {} mo.addEventListener("toggle", () => { try { localStorage.setItem("ko_wmore", mo.open ? "1" : "0"); } catch {} }); } }

  // ---------- orders ----------
  async function loadOrders(reset) {
    const j = await api("/api/orders" + (!reset && cursor ? "?cursor=" + encodeURIComponent(cursor) : ""));
    orders = reset ? j.orders : orders.concat(j.orders);
    cursor = j.cursor;
    renderOrders();
  }
  function renderOrders() {
    const q = $("[data-order-q]").value.trim().toLowerCase();
    const counts = Object.fromEntries(Object.keys(STATUS).map((k) => [k, orders.filter((o) => o.status === k).length]));
    $("[data-status-filter]").innerHTML = `<button class="chip${statusFilter ? "" : " on"}" data-sf="">الكل (${orders.length})</button>` +
      Object.entries(STATUS).map(([k, v]) => `<button class="chip${statusFilter === k ? " on" : ""}" data-sf="${k}">${v} (${counts[k]})</button>`).join("");
    const nc = $("[data-newcount]"); nc.textContent = counts.new; nc.hidden = !counts.new;
    const live = orders.filter((o) => o.status !== "cancelled");
    const today = new Date().toDateString();
    $("[data-stats]").innerHTML = `
      <div class="stat"><b>${counts.new}</b><span>طلبات جديدة</span></div>
      <div class="stat"><b>${orders.filter((o) => new Date(o.createdAt).toDateString() === today).length}</b><span>طلبات اليوم</span></div>
      <div class="stat"><b>${money(live.reduce((s, o) => s + o.total, 0))}</b><span>مجموع الطلبات (بدون الملغي)</span></div>
      <div class="stat"><b>${money(orders.filter((o) => o.status === "delivered").reduce((s, o) => s + o.total, 0))}</b><span>مبيعات انسلّمت</span></div>`;
    let list = orders;
    if (statusFilter) list = list.filter((o) => o.status === statusFilter);
    if (q) list = list.filter((o) => (o.id + " " + o.customer.name + " " + o.customer.phone).toLowerCase().includes(q));
    $("[data-orders]").innerHTML = list.length ? list.map(orderCard).join("") : `<div class="empty"><b>ما في طلبات${statusFilter || q ? " بهالفلتر" : " لسا"}</b>${orders.length ? "" : "أول ما يطلب زبون من الموقع، بيطلع طلبه هون."}</div>`;
    $("[data-more-orders]").hidden = !cursor;
  }
  function waNum(phone) {
    let d = phone.replace(/\D/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    if (d.startsWith("0")) d = "963" + d.slice(1);
    return d;
  }
  function orderCard(o) {
    const c = o.customer;
    const dt = new Date(o.createdAt).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" });
    const msg = `مرحبا ${c.name.split(" ")[0]}، معك KO SPORT بخصوص طلبك رقم ${o.id}:\n` + o.items.map((i) => `- ${i.name}${i.opt ? " (" + i.opt + ")" : ""} × ${i.qty}`).join("\n") + `\nالمجموع: ${money(o.total)}${o.delivery && o.delivery.fee === null ? " + التوصيل" : ""}${o.payment ? "\nالدفع: " + o.payment.name : ""}\nمنأكد الطلب؟`;
    return `<article class="order st-${o.status}" data-oid="${esc(o.id)}">
      <div class="o-head"><span class="o-id">${esc(o.id)}</span><span class="status ${o.status}">${STATUS[o.status]}</span><span class="o-date">${dt}</span><span class="o-total">${money(o.total)}</span></div>
      <div class="o-body">
        <div class="o-cust">
          <div><b>${esc(c.name)}</b></div>
          <div><a href="tel:${esc(c.phone)}" dir="ltr">${esc(c.phone)}</a> · <a target="_blank" rel="noopener" href="https://wa.me/${waNum(c.phone)}?text=${encodeURIComponent(msg)}">واتساب</a></div>
          <div>📍 ${esc(c.governorate)} — ${o.delivery && o.delivery.carrier ? esc(o.delivery.carrier) + " — " : ""}${c.address ? esc(c.address) : (o.delivery && o.delivery.carrier ? "" : "مركز القدموس: ") + esc(c.center)}${o.delivery && o.delivery.branchAddress ? ` <small>(${esc(o.delivery.branchAddress)})</small>` : ""}</div>
          ${c.email ? `<div>✉️ <span dir="ltr">${esc(c.email)}</span></div>` : ""}${c.altPhone ? `<div>☎️ <span dir="ltr">${esc(c.altPhone)}</span></div>` : ""}${c.postal ? `<div>📮 ${esc(c.postal)}</div>` : ""}
          ${c.notes ? `<div>📝 ${esc(c.notes)}</div>` : ""}
        </div>
        <div class="o-items">${o.items.map((i) => `<div><img src="${esc(img(i.image))}" alt="" loading="lazy"><span>${esc(i.name)}${i.opt ? ` · <b>${esc(i.opt)}</b>` : ""} × ${i.qty}</span><span style="margin-inline-start:auto">${money(i.price * i.qty)}</span></div>`).join("")}</div>
      </div>
      ${o.payment || o.delivery ? `<div class="o-meta">${o.payment ? `<span>💳 ${esc(o.payment.name)}</span>` : ""}${o.delivery ? `<span>🚚 ${o.delivery.carrier ? esc(o.delivery.carrier) : o.delivery.method === "door" ? "لباب البيت" : "القدموس"} · ${o.delivery.fee === null ? "التوصيل بيتحدد" : o.delivery.fee ? "توصيل " + money(o.delivery.fee) : "توصيل مجاني"}</span>` : ""}${o.subtotal !== undefined ? `<span>المنتجات ${money(o.subtotal)}</span>` : ""}</div>` : ""}
      <div class="o-foot">
        <select data-ost aria-label="حالة الطلب">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? "selected" : ""}>${v}</option>`).join("")}</select>
        <input data-onote placeholder="ملاحظة داخلية (مثلاً رقم بوليصة القدموس)" value="${esc(o.adminNote)}">
        <button class="btn btn-ghost sm" data-odel style="color:var(--red)">حذف</button>
      </div></article>`;
  }
  $("[data-status-filter]").addEventListener("click", (e) => { const b = e.target.closest("[data-sf]"); if (b) { statusFilter = b.dataset.sf; renderOrders(); } });
  $("[data-order-q]").addEventListener("input", renderOrders);
  $("[data-refresh]").onclick = () => loadOrders(true).then(() => toast("تم التحديث")).catch((e) => toast(e.message));
  $("[data-more-orders]").onclick = () => loadOrders(false).catch((e) => toast(e.message));
  $("[data-orders]").addEventListener("change", async (e) => {
    const card = e.target.closest("[data-oid]"); if (!card) return;
    const id = card.dataset.oid;
    const body = e.target.matches("[data-ost]") ? { status: e.target.value } : e.target.matches("[data-onote]") ? { adminNote: e.target.value } : null;
    if (!body) return;
    try { const j = await api("/api/orders/" + encodeURIComponent(id), { method: "PATCH", body: JSON.stringify(body) }); orders = orders.map((o) => (o.id === id ? j.order : o)); renderOrders(); toast("انحفظ"); }
    catch (err) { toast(err.message); }
  });
  $("[data-orders]").addEventListener("click", async (e) => {
    if (!e.target.closest("[data-odel]")) return;
    const id = e.target.closest("[data-oid]").dataset.oid;
    if (!confirm(`أكيد بدك تحذف الطلب ${id}؟`)) return;
    try { await api("/api/orders/" + encodeURIComponent(id), { method: "DELETE" }); orders = orders.filter((o) => o.id !== id); renderOrders(); }
    catch (err) { toast(err.message); }
  });

  // ---------- products ----------
  async function loadProducts() {
    const r = await fetch("/api/products?full=1", { cache: "no-store" });
    products = await r.json();
    saved = JSON.stringify(products); dirty.clear();
    const cats = [...new Set(products.map((p) => p.category))].sort();
    $("[data-prod-cat]").innerHTML = `<option value="">كل الأقسام</option>` + cats.map((c) => `<option>${esc(c)}</option>`).join("");
    $("#cat-list").innerHTML = cats.map((c) => `<option value="${esc(c)}">`).join("");
    renderProducts();
  }
  function renderProducts() {
    const q = $("[data-prod-q]").value.trim().toLowerCase();
    const cat = $("[data-prod-cat]").value, st = $("[data-prod-stock]").value;
    let list = products;
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    if (cat) list = list.filter((p) => p.category === cat || (p.also || []).includes(cat));
    if (st === "in") list = list.filter((p) => p.inStock && !p.hidden);
    if (st === "out") list = list.filter((p) => !p.inStock);
    if (st === "hidden") list = list.filter((p) => p.hidden);
    $("[data-prod-count]").textContent = `${list.length} منتج من ${products.length}`;
    $("[data-products]").innerHTML = list.slice(0, 300).map((p) => `<div class="prow${dirty.has(p.id) ? " dirty" : ""}${p.hidden ? " is-hidden" : ""}" data-pid="${esc(p.id)}">
      <img src="${esc(img(p.image))}" alt="" loading="lazy">
      <div><div class="pn">${esc(p.name)}${p.hidden ? " · <b>مخفي</b>" : ""}</div><div class="pc">${(p.images || []).length > 1 ? `📷${p.images.length} · ` : ""}${esc(p.category)}${(p.options || []).length ? " · " + esc(p.options.join("، ")) : ""}</div></div>
      <input type="number" step="0.01" min="0" value="${p.price}" data-price aria-label="السعر">
      <button class="toggle ${p.inStock ? "in" : "out"}" data-stock>${p.inStock ? "متوفر" : "خالص"}</button>
      <button class="btn btn-ghost sm edit" data-edit>تعديل</button></div>`).join("") + (list.length > 300 ? `<div class="empty">في ${list.length - 300} منتج كمان، استعمل البحث</div>` : "");
    updateSavebar();
  }
  function mark(id) { dirty.add(id); updateSavebar(); }
  function updateSavebar() {
    const changed = JSON.stringify(products) !== saved;
    $("[data-savebar]").hidden = !changed;
    $("[data-dirty-count]").textContent = `في تغييرات ما انحفظت (${dirty.size || 1})`;
  }
  ["[data-prod-q]", "[data-prod-cat]", "[data-prod-stock]"].forEach((s) => $(s).addEventListener("input", renderProducts));
  $("[data-products]").addEventListener("change", (e) => {
    if (!e.target.matches("[data-price]")) return;
    const p = products.find((x) => x.id === e.target.closest("[data-pid]").dataset.pid);
    const v = parseFloat(e.target.value);
    if (!(v >= 0)) { e.target.value = p.price; return; }
    p.price = v; mark(p.id); e.target.closest(".prow").classList.add("dirty");
  });
  $("[data-products]").addEventListener("click", (e) => {
    const row = e.target.closest("[data-pid]"); if (!row) return;
    const p = products.find((x) => x.id === row.dataset.pid);
    if (e.target.closest("[data-stock]")) { p.inStock = !p.inStock; mark(p.id); renderProducts(); }
    if (e.target.closest("[data-edit]")) openEdit(p);
  });
  $("[data-save]").onclick = async () => {
    const b = $("[data-save]"); b.disabled = true;
    try { await api("/api/products", { method: "PUT", body: JSON.stringify(products) }); saved = JSON.stringify(products); dirty.clear(); renderProducts(); toast("انحفظت التغييرات وصارت ظاهرة بالموقع"); }
    catch (err) { toast(err.message); }
    b.disabled = false;
  };
  $("[data-discard]").onclick = () => { products = JSON.parse(saved); dirty.clear(); renderProducts(); };
  window.addEventListener("beforeunload", (e) => { if (JSON.stringify(products) !== saved && saved) { e.preventDefault(); e.returnValue = ""; } });

  // edit dialog
  const dlg = $("[data-modal]"), ef = $("[data-edit]");
  let editing = null, isNew = false, imgs = [], thumbOf = {};
  const imgsOf = (p) => (p.images && p.images.length ? p.images.slice() : p.image ? [p.image] : []);
  function renderThumbs() {
    $("[data-edit-img]").src = img(imgs[0]);
    $("[data-edit-thumbs]").innerHTML = imgs.map((u, i) => `<button type="button" class="thumb${i ? "" : " main"}" data-ti="${i}" title="${i ? "خليها الرئيسية" : "الصورة الرئيسية"}"><img src="${esc(u)}" alt=""><span data-trm="${i}" title="شيل">✕</span><span class="tst" data-tst="${i}" title="عدّلها بالاستوديو">🪄</span></button>`).join("");
  }
  // ---- photo studio (remove background, shop identity, edit with words) ----
  const studioStyle = () => { try { return (ST && ST.design && ST.design.imgStyle) || JSON.parse(localStorage.getItem("ko_img_style") || "null") || {}; } catch { return {}; } };
  async function gemOk() { if (!STATUS_) { try { STATUS_ = await api("/api/status"); } catch {} } return STATUS_ ? !!STATUS_.gemini : undefined; }
  async function studio(source) {
    if (!window.KOStudio) { toast("الاستوديو ما تحمّل، حدّث الصفحة"); return null; }
    return KOStudio.open(source, { api, style: studioStyle(), gemini: await gemOk(), brand: (ST && ST.design && ST.design.primary) || "#d9232d",
      onStyle: (s) => { try { localStorage.setItem("ko_img_style", JSON.stringify(s)); } catch {} if (ST && ST.design) { ST.design.imgStyle = s; updateSetBar(); } } });
  }
  async function uploadProductImage(blob) {
    const bmp = await decode(blob);
    const url = await uploadBlob(await squareFull(bmp)); thumbOf[url] = await uploadBlob(await squareThumb(bmp)); return url;
  }
  $("[data-edit-thumbs]").addEventListener("click", (e) => {
    const ts = e.target.closest("[data-tst]");
    if (ts) { e.stopPropagation(); (async () => {
      const i = +ts.dataset.tst; let src = imgs[i];
      try {
        let blob = await fetch(src, { mode: "cors" }).then((r) => (r.ok ? r.blob() : null)).catch(() => null);
        if (!blob) { toast("عم ننقل الصورة لمتجرك أول…"); const c = await api("/api/images/fetch", { method: "POST", body: JSON.stringify({ url: src }) }); src = c.url; blob = await fetch(src).then((r) => r.blob()); }
        const out = await studio(blob); if (!out) return;
        toast("عم يرفع الصورة المعدّلة…"); imgs[i] = await uploadProductImage(out); renderThumbs(); toast("✓ انحفظت الصورة المعدّلة. اكبس «تمام» وبعدين «حفظ التغييرات»");
      } catch (err) { toast(err.message || String(err)); }
    })(); return; }
    const rm = e.target.closest("[data-trm]");
    if (rm) { imgs.splice(+rm.dataset.trm, 1); renderThumbs(); return; }
    const t = e.target.closest("[data-ti]");
    if (t) { const [x] = imgs.splice(+t.dataset.ti, 1); imgs.unshift(x); renderThumbs(); }
  });
  function openEdit(p) {
    isNew = !p;
    editing = p || { id: "", name: "", price: 0, category: $("[data-prod-cat]").value || "", also: [], options: [], sports: [], inStock: true, image: "" };
    $("[data-edit-title]").textContent = isNew ? "منتج جديد" : "تعديل منتج";
    $("[data-edit-del]").hidden = isNew;
    ef.name.value = editing.name; ef.price.value = editing.price; ef.category.value = editing.category;
    ef.also.value = (editing.also || []).join("، "); ef.options.value = (editing.options || []).join("، "); ef.sports.value = (editing.sports || []).join("، ");
    ef.inStock.checked = !!editing.inStock; ef.hidden.checked = !!editing.hidden;
    imgs = imgsOf(editing); renderThumbs();
    ef.description.value = editing.description || "";
    ef.specs.value = (editing.specs || []).map(([k, v]) => `${k}: ${v}`).join("\n");
    ef.details.value = editing.details || "";
    try { $("[data-studio-on]").checked = localStorage.getItem("ko_studio_on") === "1"; } catch {}
    dlg.showModal();
  }
  $("[data-new-product]").onclick = () => openEdit(null);
  $("[data-edit-file]").addEventListener("change", async (e) => {
    const files = [...e.target.files]; if (!files.length) return;
    try {
      const useStudio = $("[data-studio-on]") && $("[data-studio-on]").checked;
      for (const [i, f] of files.entries()) {
        let src = f;
        if (useStudio) { const out = await studio(f); if (!out) continue; src = out; }
        toast(`جاري ضغط ورفع الصورة ${i + 1} من ${files.length}…`);
        imgs.push(await uploadProductImage(src)); renderThumbs();
      }
      toast("انرفعت الصور. اكبس «تمام» وبعدين «حفظ التغييرات»");
    } catch (err) { toast(err.message); }
    e.target.value = "";
  });
  // Smallest WebP that still looks good: resize, then lower quality until under the target size.
  // ---- image pipeline: decode once, square it, then the smallest WebP under the size target (max 3 tries) ----
  const FULL = { size: 1200, kb: 150 }, THUMB = { size: 480, kb: 32 };
  const decode = (blob) => createImageBitmap(blob);
  function edgeColor(bmp) {
    const c = document.createElement("canvas"); c.width = c.height = 16;
    const x = c.getContext("2d"); x.drawImage(bmp, 0, 0, 16, 16);
    const d = x.getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < 16; i++) for (const [px, py] of [[i, 0], [i, 15], [0, i], [15, i]]) { const k = (py * 16 + px) * 4; r += d[k]; g += d[k + 1]; b += d[k + 2]; n++; }
    return `rgb(${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)})`;
  }
  // Find the product inside the photo: trim plain margins that match the edge colour.
  function contentBox(bmp) {
    const S = 120, c = document.createElement("canvas");
    const k = S / Math.max(bmp.width, bmp.height); c.width = Math.max(1, Math.round(bmp.width * k)); c.height = Math.max(1, Math.round(bmp.height * k));
    const x = c.getContext("2d"); x.drawImage(bmp, 0, 0, c.width, c.height);
    const d = x.getImageData(0, 0, c.width, c.height).data, W = c.width, H = c.height;
    const at = (i, j) => (j * W + i) * 4;
    const ref = [0, 0, 0]; let n = 0;
    for (const [i, j] of [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]]) { const p = at(i, j); ref[0] += d[p]; ref[1] += d[p + 1]; ref[2] += d[p + 2]; n++; }
    ref[0] /= n; ref[1] /= n; ref[2] /= n;
    let x0 = W, y0 = H, x1 = -1, y1 = -1;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const p = at(i, j);
      if (Math.abs(d[p] - ref[0]) + Math.abs(d[p + 1] - ref[1]) + Math.abs(d[p + 2] - ref[2]) > 48) { if (i < x0) x0 = i; if (i > x1) x1 = i; if (j < y0) y0 = j; if (j > y1) y1 = j; }
    }
    if (x1 < 0) return { x: 0, y: 0, w: bmp.width, h: bmp.height };
    const pad = 0.04 * Math.max(x1 - x0, y1 - y0);
    const bx = Math.max(0, (x0 - pad) / k), by = Math.max(0, (y0 - pad) / k);
    const bw = Math.min(bmp.width, (x1 + 1 + pad) / k) - bx, bh = Math.min(bmp.height, (y1 + 1 + pad) / k) - by;
    // only trim when it really is a margin (keeps normal photos untouched)
    return bw * bh < bmp.width * bmp.height * 0.9 ? { x: bx, y: by, w: bw, h: bh } : { x: 0, y: 0, w: bmp.width, h: bmp.height };
  }
  // Same square shape for every photo, WITHOUT cutting or zooming anything: the whole photo is shown,
  // and if it isn't square the free space is filled with the photo's own background colour.
  function square(bmp, size) {
    const cv = document.createElement("canvas"); cv.width = cv.height = size;
    const cx = cv.getContext("2d"); cx.imageSmoothingQuality = "high";
    const w = bmp.width, h = bmp.height;
    if (Math.abs(w - h) > 2) { cx.fillStyle = edgeColor(bmp); cx.fillRect(0, 0, size, size); }
    const k = Math.min(size / w, size / h, 1.6); // never blow small photos up too much
    cx.drawImage(bmp, (size - w * k) / 2, (size - h * k) / 2, w * k, h * k);
    return cv;
  }
  async function encode(cv, kb, q = 0.82, floor = 0.4) {
    let out;
    for (let i = 0; i < 4; i++) {
      out = await new Promise((res) => cv.toBlob(res, "image/webp", q));
      if (!out) break;
      if (out.size <= kb * 1024) return out;
      if (q <= floor) break;
      q = Math.max(floor, q * Math.pow((kb * 1024) / out.size, 0.55));
    }
    return out && out.type === "image/webp" ? out : await new Promise((res) => cv.toBlob(res, "image/jpeg", 0.72));
  }
  const squareFull = (bmp) => encode(square(bmp, FULL.size), FULL.kb, 0.9, 0.8);
  const squareThumb = (bmp) => encode(square(bmp, THUMB.size), THUMB.kb, 0.85, 0.7);
  // non-square images (logo, banner, share picture): keep the shape, just resize + compress
  async function compress(file, max = 900, targetKB = 70) {
    const bmp = await decode(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    const cx = cv.getContext("2d"); cx.imageSmoothingQuality = "high"; cx.drawImage(bmp, 0, 0, cv.width, cv.height);
    return encode(cv, targetKB);
  }
  const shrink = (file, max = 900) => compress(file, max, max > 1200 ? 140 : max <= 600 ? 40 : 70);
  async function uploadBlob(blob) {
    const j = await api("/api/images", { method: "POST", body: blob, headers: { "content-type": blob.type } });
    budget.add(1);
    return j.url;
  }
  // Rough count of today's KV saves made from this dashboard (Cloudflare free = 1000/day, resets 03:00 Damascus).
  const budget = {
    key: () => "ko_w_" + new Date().toISOString().slice(0, 10),
    used() { try { return +localStorage.getItem(this.key()) || 0; } catch { return 0; } },
    add(n) { try { localStorage.setItem(this.key(), this.used() + n); } catch {} },
    paid() { try { return localStorage.getItem("ko_free_plan") !== "1"; } catch { return true; } },
    left() { return this.paid() ? 1e9 : Math.max(0, 350 - this.used()); },
  };
  dlg.addEventListener("close", () => {
    const v = dlg.returnValue;
    if (v === "delete" && editing && confirm(`حذف «${editing.name}» نهائياً؟ (إذا بدك ترجعه بعدين، خليه مخفي بدل الحذف)`)) {
      products = products.filter((p) => p !== editing); dirty.add(editing.id); renderProducts(); return;
    }
    if (v !== "ok") return;
    const name = ef.name.value.trim(), price = parseFloat(ef.price.value), category = ef.category.value.trim();
    if (!name || !(price >= 0) || !category) { toast("الاسم والسعر والقسم لازمين"); return; }
    Object.assign(editing, { name, price, category, also: split(ef.also.value), options: split(ef.options.value), sports: split(ef.sports.value), inStock: ef.inStock.checked, image: imgs[0] || "", images: imgs.slice(),
      description: ef.description.value.trim(), specs: parseSpecs(ef.specs.value), details: ef.details.value.trim().slice(0, 4000),
      thumb: thumbOf[imgs[0]] || (imgs[0] === editing.image ? editing.thumb || "" : "") });
    if (!editing.thumb) delete editing.thumb;
    if (ef.hidden.checked) editing.hidden = true; else delete editing.hidden;
    if (isNew) {
      let id = name.replace(/\s+/g, "-"), n = 1;
      while (products.some((p) => p.id === id)) id = name.replace(/\s+/g, "-") + "-" + ++n;
      editing.id = id; products.unshift(editing);
    }
    mark(editing.id); renderProducts();
    // new product without a description → AI writes it automatically
    if (!editing.description) {
      const p = editing;
      toast("✨ عم يكتب الذكاء الاصطناعي الوصف…");
      aiFor(p).then((r) => { Object.assign(p, r); mark(p.id); renderProducts(); toast("✨ انكتب الوصف. اكبس «حفظ التغييرات»"); }).catch((e) => toast(e.message));
    }
  });

  // ---------- AI descriptions ----------
  const parseSpecs = (t) => String(t || "").split("\n").map((l) => l.trim()).filter(Boolean)
    .map((l) => { const i = l.search(/[:：]/); return i > 0 ? [l.slice(0, i).trim(), l.slice(i + 1).trim()] : null; })
    .filter((x) => x && x[0] && x[1]);
  async function aiFor(p) {
    const j = await api("/api/ai/describe", { method: "POST", body: JSON.stringify({ product: { name: p.name, category: p.category, also: p.also, options: p.options, sports: p.sports, price: p.price } }) });
    return { description: j.description, specs: j.specs, details: j.details || "" };
  }
  $("[data-ai-one]").onclick = async () => {
    const b = $("[data-ai-one]"); b.disabled = true; b.textContent = "✨ عم يكتب…";
    try {
      const r = await aiFor({ name: ef.name.value, category: ef.category.value, also: split(ef.also.value), options: split(ef.options.value), sports: split(ef.sports.value), price: parseFloat(ef.price.value) });
      ef.description.value = r.description; ef.specs.value = r.specs.map(([k, v]) => `${k}: ${v}`).join("\n"); if (r.details) ef.details.value = r.details;
    } catch (e) { toast(e.message); }
    b.disabled = false; b.textContent = "✨ اكتب بالذكاء الاصطناعي";
  };
  $("[data-ai-all]").onclick = async () => {
    if (JSON.stringify(products) !== saved) { toast("احفظ تغييرات المنتجات أول"); return; }
    const todo = products.filter((p) => !p.description || !p.details);
    if (!todo.length) { $("[data-ai-msg]").textContent = "كل المنتجات إلها وصف وشرح ✓"; return; }
    const b = $("[data-ai-all]"); b.disabled = true;
    const msg = (t) => ($("[data-ai-msg]").textContent = t);
    let n = 0, failed = 0, pending = 0, lastErr = "";
    const t0 = Date.now();
    const flush = async () => { if (!pending) return; await api("/api/products", { method: "PUT", body: JSON.stringify(products) }); saved = JSON.stringify(products); pending = 0; };
    try {
      for (let i = 0; i < todo.length; i += 4) {
        await Promise.all(todo.slice(i, i + 4).map(async (p) => {
          try { Object.assign(p, await aiFor(p)); pending++; }
          catch (e) { failed++; lastErr = e.message; if (/مو مربوط|كلمة السر/.test(e.message)) throw e; }
          n++;
        }));
        const left = Math.round(((todo.length - n) * (Date.now() - t0)) / 1000 / n);
        msg(`✨ ${n} من ${todo.length} — باقي تقريباً ${left > 90 ? Math.round(left / 60) + " دقيقة" : left + " ثانية"}${failed ? ` (ما زبط: ${failed})` : ""}`);
        if (pending >= 20) await flush();
      }
      await flush(); renderProducts();
      msg(`✨ خلص: انكتب وصف ومواصفات لـ ${n - failed} منتج.` + (failed ? ` ${failed} ما زبطوا (${lastErr})، اكبس الزر كمان مرة لتعيدهم.` : ""));
    } catch (e) { await flush().catch(() => {}); msg(e.message); toast(e.message); }
    b.disabled = false;
  };

  // ---------- ready-made researched descriptions (assets/descriptions.json) ----------
  async function applyDescs(all) {
    if (JSON.stringify(products) !== saved) { toast("احفظ تغييرات المنتجات أول"); return; }
    if (all && !confirm("رح تنكتب الأوصاف الجاهزة فوق الأوصاف الموجودة لكل المنتجات. متأكد؟")) return;
    const msg = (t) => ($("[data-ai-msg]").textContent = t);
    msg("📚 عم يحمّل الأوصاف…");
    let list;
    try { const r = await fetch("/assets/descriptions.json?v=" + Date.now(), { cache: "no-store" }); if (!r.ok) throw 0; list = await r.json(); }
    catch { msg("ما قدرت حمّل ملف الأوصاف"); return; }
    const norm = (t) => String(t || "").replace(/[\s\-_–]+/g, " ").replace(/[أإآ]/g, "ا").trim().toLowerCase();
    const byKey = new Map(), byId = new Map(), byName = new Map();
    for (const d of list) { byKey.set(d.id + "|" + norm(d.name), d); if (!byId.has(d.id)) byId.set(d.id, d); if (!byName.has(norm(d.name))) byName.set(norm(d.name), d); }
    let n = 0, miss = 0;
    for (const p of products) {
      const d = byKey.get(p.id + "|" + norm(p.name)) || byName.get(norm(p.name)) || byId.get(p.id);
      if (!d) { miss++; continue; }
      if (!all && p.description && p.details && (p.specs || []).length) continue;
      if (all || !p.description) p.description = d.description;
      if (all || !(p.specs || []).length) p.specs = d.specs;
      if (all || !p.details) p.details = d.details;
      n++;
    }
    if (!n) { msg(miss ? `ما في شي جديد. ${miss} منتج ما إلهم وصف جاهز — استعمل زر الذكاء الاصطناعي إلهم.` : "كل المنتجات إلها وصف ✓"); return; }
    try { await api("/api/products", { method: "PUT", body: JSON.stringify(products) }); saved = JSON.stringify(products); renderProducts(); }
    catch (e) { msg(e.message); return; }
    msg(`📚 تم: انكتب وصف ومواصفات وتفاصيل لـ ${n} منتج.` + (miss ? ` ${miss} منتج (جداد) ما إلهم وصف جاهز — اكبس ✨ ليكتبلهم الذكاء الاصطناعي.` : ""));
    toast("📚 انحفظت الأوصاف");
  }
  $("[data-desc-fill]").onclick = () => applyDescs(false);
  $("[data-desc-all]").onclick = () => applyDescs(true);

  // ---------- spelling fixer: fixes spelling (hamza, typos) and keeps the Syrian dialect as it is ----------
  const SP_AR = "\\u0621-\\u064A\\u0660-\\u0669\\u0671-\\u06FF";
  const reEsc = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const SP_PRE = "((?:و|ف)?(?:بال|كال|لل|ال|ب|ل|ك)?)";
  function spRule(w, r, opt = {}) {
    const re = opt.phrase ? new RegExp(reEsc(w), "g") : new RegExp(`(?<![${SP_AR}])${opt.nopre ? "()" : SP_PRE}${reEsc(w)}(?![${SP_AR}])`, "g");
    return { w, r, re, ai: !!opt.ai, on: true };
  }
  const spFields = (p) => [["name"], ["description"], ["details"], ...(p.specs || []).flatMap((_, i) => [["specs", i, 0], ["specs", i, 1]])];
  const spGet = (p, f) => (f[0] === "specs" ? p.specs[f[1]][f[2]] : p[f[0]]) || "";
  const spSet = (p, f, v) => { if (f[0] === "specs") p.specs[f[1]][f[2]] = v; else p[f[0]] = v; };
  const spRun = (t, r) => (r.phrase ? t.replace(r.re, r.r) : t.replace(r.re, (m, pre) => (pre || "") + r.r));
  function spCount(rules) {
    for (const r of rules) { r.n = 0; r.where = ""; }
    for (const p of products) for (const f of spFields(p)) {
      const t = spGet(p, f); if (!t) continue;
      for (const r of rules) { r.re.lastIndex = 0; const m = t.match(r.re); if (m) { r.n += m.length; if (!r.where) r.where = p.name; } }
    }
    return rules.filter((r) => r.n);
  }
  let SP = [];
  function spDraw() {
    $("[data-sp-list]").innerHTML = SP.length ? SP.map((r, i) => `<label class="sp-row"><input type="checkbox" data-sp-i="${i}" ${r.on ? "checked" : ""}><s>${esc(r.w)}</s> ← <b>${esc(r.r)}</b>${r.ai ? '<span class="ai">ذكاء اصطناعي</span>' : ""}<small>${r.n}× · ${esc(r.where.slice(0, 40))}</small></label>`).join("")
      : '<p class="hint" style="padding:10px">ما لقيت أخطاء معروفة ✓ جرّب «فحص أعمق بالذكاء الاصطناعي».</p>';
    $("[data-sp-msg]").textContent = SP.length ? `لقيت ${SP.length} كلمة بحاجة تصحيح (${SP.reduce((a, r) => a + r.n, 0)} مرة). شيل الصح من أي سطر ما بدك ياه، وبعدين «طبّق واحفظ». اللهجة السورية بتضل متل ما هي.` : "";
  }
  $("[data-spell]").onclick = async () => {
    if (JSON.stringify(products) !== saved) { toast("احفظ تغييرات المنتجات أول"); return; }
    let R;
    try { R = await (await fetch("/assets/spell.json?v=" + Date.now(), { cache: "no-store" })).json(); } catch { toast("ما قدرت حمّل قاموس الإملاء"); return; }
    const nopre = new Set(R.nopre || []);
    SP = spCount([...Object.entries(R.words).map(([w, r]) => spRule(w, r, { nopre: nopre.has(w) })), ...(R.phrases || []).map(([w, r]) => Object.assign(spRule(w, r, { phrase: true }), { phrase: true }))]);
    spDraw(); $("[data-sp-dlg]").showModal();
  };
  $("[data-sp-list]").onchange = (e) => { const i = e.target.dataset.spI; if (i != null) SP[+i].on = e.target.checked; };
  $("[data-sp-x]").onclick = () => $("[data-sp-dlg]").close();
  $("[data-sp-ai]").onclick = async () => {
    const b = $("[data-sp-ai]"); b.disabled = true;
    const texts = []; const seen = new Set();
    for (const p of products) for (const f of spFields(p)) { const t = spGet(p, f).trim(); if (t && !seen.has(t)) { seen.add(t); texts.push(t); } }
    // send unique text in chunks of ~2500 characters
    const chunks = []; let cur = "";
    for (const t of texts) { if ((cur + t).length > 2500 && cur) { chunks.push(cur); cur = ""; } cur += t + "\n"; }
    if (cur) chunks.push(cur);
    const have = new Set(SP.map((r) => r.w)); let found = 0, done = 0;
    try {
      for (let i = 0; i < chunks.length; i += 3) {
        await Promise.all(chunks.slice(i, i + 3).map(async (ch) => {
          const j = await api("/api/ai/spell", { method: "POST", body: JSON.stringify({ text: ch }) });
          for (const [w, r] of j.fixes || []) if (!have.has(w)) { have.add(w); const rule = spRule(w, r, { nopre: true, ai: true }); if (spCount([rule]).length) { SP.push(rule); found++; } }
          done++;
        }));
        $("[data-sp-msg]").textContent = `✨ عم يفحص… ${done} من ${chunks.length} (لقى ${found} كلمة جديدة)`;
      }
      spDraw(); $("[data-sp-msg]").textContent = `✨ خلص الفحص: لقى ${found} كلمة جديدة (معلّمة «ذكاء اصطناعي»). راجعها قبل ما تطبّق.`;
    } catch (e) { $("[data-sp-msg]").textContent = e.message; }
    b.disabled = false;
  };
  $("[data-sp-go]").onclick = async () => {
    const on = SP.filter((r) => r.on); if (!on.length) { $("[data-sp-dlg]").close(); return; }
    let n = 0;
    for (const p of products) for (const f of spFields(p)) {
      const t = spGet(p, f); if (!t) continue;
      let v = t; for (const r of on) v = spRun(v, r);
      if (v !== t) { spSet(p, f, v); n++; }
    }
    try { await api("/api/products", { method: "PUT", body: JSON.stringify(products) }); saved = JSON.stringify(products); renderProducts(); }
    catch (e) { toast(e.message); return; }
    $("[data-sp-dlg]").close(); $("[data-ai-msg]").textContent = `🔤 تصحّح الإملاء بـ ${n} نص وانحفظ.`; toast("🔤 تم تصحيح الإملاء");
  };

  // ---------- image migration ----------
  function migStatus() {
    const ext = products.filter((p) => /^https?:\/\//.test(p.image || "")).length;
    const total = products.length || 1;
    $("[data-mig-bar]").style.width = Math.round(((total - ext) / total) * 100) + "%";
    $("[data-mig-msg]").textContent = ext ? `${ext} منتج صورته لسا على Wuilt.` : "كل الصور صارت محفوظة بمتجرك ✓";
    $("[data-migrate]").hidden = !ext;
    galStatus();
  }
  function galStatus() {
    const all = products.filter((p) => p.oldUrl);
    const done = all.filter((p) => p.galleryApi).length;
    $("[data-gal-bar]").style.width = Math.round((done / (all.length || 1)) * 100) + "%";
    const extra = products.reduce((n, p) => n + Math.max(0, (p.images || []).length - 1), 0);
    $("[data-gal-msg]").textContent = done >= all.length ? `خلصت ✓ ${extra} صورة إضافية صارت بمتجرك.` : `${done} من ${all.length} منتج خلص (${extra} صورة إضافية لهلق).`;
    $("[data-gallery]").hidden = all.length > 0 && done >= all.length;
    optStatus();
  }
  const bidi = (x) => String(x || "").replace(/[‎‏‪-‮⁦-⁩]/g, "").trim();
  const slugOf = (u) => { let t = String(u || "").split("?")[0].split("/").pop(); try { t = decodeURIComponent(t); } catch {} return bidi(t).toLowerCase(); };
  const fileOf = (u) => String(u || "").split("?")[0].split("/").pop();
  $("[data-migrate]").onclick = async () => {
    if (JSON.stringify(products) !== saved) { toast("احفظ تغييرات المنتجات أول"); return; }
    const b = $("[data-migrate]"); b.disabled = true;
    try {
      let first = true, failed = 0;
      for (;;) {
        const j = await api("/api/images", { method: "PATCH", body: JSON.stringify({ limit: 15, retryFailed: first }) });
        first = false; failed += j.failed.length;
        $("[data-mig-msg]").textContent = `باقي ${j.remaining}…` + (failed ? ` (ما زبطت: ${failed})` : "");
        if (!j.remaining) break;
      }
      await loadProducts(); migStatus();
      if (failed) $("[data-mig-msg]").textContent += ` — ${failed} صورة ما انتسخت، اضغط الزر مرة تانية لتعيد المحاولة.`;
    } catch (err) { toast(err.message); }
    b.disabled = false;
  };
  $("[data-gallery]").onclick = async () => {
    if (JSON.stringify(products) !== saved) { toast("احفظ تغييرات المنتجات أول"); return; }
    const apiKey = $("[data-w-key]").value.trim(), storeId = $("[data-w-store]").value.trim();
    if (!storeId || !apiKey) { toast("حط الـ Store ID والـ API Key"); return; }
    const b = $("[data-gallery]"); b.disabled = true;
    const msg = (t) => ($("[data-gal-msg]").textContent = t);
    let pause = "";
    try {
      // 1) read all products + images from Wuilt (reading doesn't count toward the daily limit)
      const wp = [];
      for (const mode of ["all", "archived"]) {
        let got = 0;
        for (let off = 0; ; off += 50) {
          msg(`عم نقرأ المنتجات من Wuilt${mode === "archived" ? " (المؤرشفة)" : " (كلها، حتى غير النشطة)"}… ${wp.length}`);
          let j;
          try { j = await api("/api/wuilt/products", { method: "POST", body: JSON.stringify({ apiKey, storeId, offset: off, mode }) }); }
          catch (e) { if (mode === "archived") break; throw e; }
          wp.push(...j.products); got += j.products.length;
          if (!j.products.length || got >= j.total) break;
        }
      }
      // 2) match them to our products (by link name, then by title)
      // strongest match: the same photo file; then the link name; then the title (ignoring spaces, dashes, hamza…)
      const norm = (x) => bidi(x).toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}]+/gu, "");
      const byFile = new Map(), byHandle = new Map(), byTitle = new Map();
      for (const w of wp) {
        for (const u of w.images) if (!byFile.has(fileOf(u))) byFile.set(fileOf(u), w);
        byHandle.set(norm(slugOf(w.handle)), w); byTitle.set(norm(w.title), w);
      }
      const items = [];
      let matched = 0;
      for (const p of products) {
        if (!p.oldUrl || p.galleryApi) continue;
        const w = byFile.get(fileOf(p.originalImage || p.image)) || byHandle.get(norm(slugOf(p.oldUrl))) || byTitle.get(norm(p.name));
        if (!w) continue;
        matched++;
        const mainFile = fileOf(p.originalImage || p.image);
        const urls = w.images.filter((u) => fileOf(u) !== mainFile);
        items.push({ id: p.id, urls });
      }
      const total = items.reduce((n, x) => n + x.urls.length, 0);
      if (!wp.length) throw new Error("Wuilt ما رجّع ولا منتج. تأكد من الـ Store ID وإنه المفتاح إله صلاحية Products.");
      msg(`لقينا ${wp.length} منتج على Wuilt، طابقنا ${matched}، وفي ${total} صورة إضافية. عم ننسخ…`);
      // 3) copy within today's budget
      let copied = 0;
      for (let i = 0; i < items.length; ) {
        if (budget.left() <= 0) { pause = "وصلنا حد اليوم. كمّل بكرا بنفس الزر (رجاع حط المفتاح)."; break; }
        const batch = []; let n = 0;
        while (i < items.length && n + items[i].urls.length <= 30) { n += items[i].urls.length; batch.push(items[i++]); }
        if (!batch.length) batch.push(items[i++]);
        const j = await api("/api/gallery/copy", { method: "POST", body: JSON.stringify({ items: batch, api: true }) });
        copied += j.writes; budget.add(j.writes);
        msg(`عم ننسخ… ${copied} من حوالي ${total} صورة`);
        if (j.stopped === "limit") { pause = "وصلنا لحد Cloudflare اليومي. كمّل بكرا بنفس الزر."; break; }
        if (j.stopped === "batch") i -= batch.length - j.done.length;
      }
      await loadProducts(); galStatus();
      const unmatched = products.filter((p) => p.oldUrl && !p.galleryApi).length;
      if (pause) msg($("[data-gal-msg]").textContent + " — " + pause);
      else if (unmatched) msg($("[data-gal-msg]").textContent + ` — ${unmatched} منتج ما لقيناله مقابل على Wuilt (ممكن انحذف أو تغيّر اسمه).`);
    } catch (err) { toast(err.message); msg(err.message); }
    b.disabled = false;
  };

  const paidBox = $("[data-paid]");
  if (paidBox) { paidBox.checked = !budget.paid(); paidBox.onchange = () => { try { localStorage.setItem("ko_free_plan", paidBox.checked ? "1" : "0"); } catch {} toast(paidBox.checked ? "الأدوات رح توقف عند 350 عملية باليوم" : "ما في حد يومي"); }; }

  // ---------- image optimizer ----------
  function optStatus() {
    const all = products.filter((p) => (p.image || "").startsWith("/img/"));
    const done = all.filter((p) => p.opt3).length;
    $("[data-opt-bar]").style.width = Math.round((done / (all.length || 1)) * 100) + "%";
    $("[data-opt-msg]").textContent = all.length && done >= all.length ? "كل الصور مضغوطة وبنفس المقاس ✓" : `${done} من ${all.length} منتج صوره مضغوطة.`;
    $("[data-optimize]").hidden = all.length > 0 && done >= all.length;
  }
  $("[data-optimize]").onclick = async () => {
    if (JSON.stringify(products) !== saved) { toast("احفظ تغييرات المنتجات أول"); return; }
    const b = $("[data-optimize]"); b.disabled = true;
    const msg = (t) => ($("[data-opt-msg]").textContent = t);
    const swap = new Map(); // same source photo used by several products → convert once
    let before = 0, after = 0, n = 0, pending = 0, failed = 0;
    const flush = async () => {
      if (!pending) return;
      await api("/api/products", { method: "PUT", body: JSON.stringify(products) });
      budget.add(1); saved = JSON.stringify(products); pending = 0;
    };
    async function convert(src, withThumb) {
      const key = src + (withThumb ? "#t" : "");
      if (swap.has(key)) return swap.get(key);
      const job = (async () => {
        let r; for (let a = 0; a < 3; a++) { try { r = await fetch(src); break; } catch (e) { if (a === 2) throw e; await new Promise((x) => setTimeout(x, 1500)); } } if (!r.ok) throw new Error("img " + r.status);
        const orig = await r.blob(); const bmp = await decode(orig);
        const full = await squareFull(bmp);
        before += orig.size; after += full.size;
        const out = { full: await uploadBlob(full), orig: src.startsWith("/img/") ? src : "" };
        if (withThumb) { const t = await squareThumb(bmp); out.thumb = await uploadBlob(t); }
        bmp.close && bmp.close();
        return out;
      })();
      swap.set(key, job);
      return job;
    }
    const todo = products.filter((p) => (p.image || "").startsWith("/img/") && !p.opt3);
    const t0 = Date.now();
    async function one(p) {
      try {
        const pics = (p.images && p.images.length ? p.images : [p.image]).filter(Boolean);
        const main = await convert(pics[0], true);
        const rest = await Promise.all(pics.slice(1).map((u) => (u.startsWith("/img/") ? convert(u, false) : { full: u, orig: u })));
        // keep the untouched originals for the full-screen zoom (no extra storage: they are already saved)
        Object.assign(p, { image: main.full, thumb: main.thumb, images: [main.full, ...rest.map((x) => x.full)],
          zoom: [main.orig || main.full, ...rest.map((x) => x.orig || x.full)], opt3: true, optimized: true });
      } catch (e) {
        if (/كلمة السر|محاولات|انقطع/i.test(e.message)) throw e;
        failed++; p.opt3 = true;
      }
      n++; pending++;
      const sec = Math.max(1, (Date.now() - t0) / 1000), left = Math.round(((todo.length - n) * sec) / n);
      msg(`عم نضغط… ${n} من ${todo.length} منتج — ${Math.round(before / 1024)}KB صاروا ${Math.round(after / 1024)}KB — باقي تقريباً ${left > 90 ? Math.round(left / 60) + " دقيقة" : left + " ثانية"}`);
    }
    try {
      for (let i = 0; i < todo.length; i += 4) {
        if (budget.left() < 20) { msg($("[data-opt-msg]").textContent + " — وصلنا حد اليوم، كمّل بكرا."); break; }
        await Promise.all(todo.slice(i, i + 4).map(one));
        if (pending >= 12) await flush();
      }
      await flush();
      optStatus();
      msg($("[data-opt-msg]").textContent + ` الصور صارت ${Math.round(after / 1024)}KB بدل ${Math.round(before / 1024)}KB.` + (failed ? ` (${failed} صورة ما انقرت وتركناها متل ما هي)` : ""));
    } catch (err) { await flush().catch(() => {}); toast(err.message); msg(err.message); }
    b.disabled = false;
  };



  // ---------- restore original photos from Wuilt (undo the old crop/zoom), then compress again gently ----------
  const restoreBtn = $("[data-restore]");
  if (restoreBtn) restoreBtn.onclick = async () => {
    if (!$("[data-w-store]").value.trim() || !$("[data-w-key]").value.trim()) { toast("حط الـ Store ID والـ API Key بقسم الصور الإضافية أول"); $("[data-w-store]").focus(); return; }
    if (!confirm("رح نرجّع كل صور المنتجات الأصلية من Wuilt، وبعدين نضغطها من جديد بدون قص أو زوم. الصور اللي رفعتها إنت يدوياً لمنتج جديد بتضل متل ما هي. نكمّل؟")) return;
    if (JSON.stringify(products) !== saved) { toast("احفظ تغييرات المنتجات أول"); return; }
    const msg = (t) => ($("[data-restore-msg]").textContent = t);
    restoreBtn.disabled = true;
    try {
      let n = 0;
      for (const p of products) {
        if (!/^https?:\/\//.test(p.originalImage || "")) continue;
        p.image = p.originalImage; delete p.thumb; delete p.zoom; p.images = [];
        delete p.galleryApi; delete p.galleryDone; delete p.opt2; delete p.opt3; delete p.optimized; delete p.imageCopyFailed;
        n++;
      }
      await api("/api/products", { method: "PUT", body: JSON.stringify(products) }); saved = JSON.stringify(products);
      msg(`1/3 — عم نرجّع الصور الرئيسية الأصلية (${n})…`);
      await $("[data-migrate]").onclick();
      msg("2/3 — عم نجيب الصور الإضافية الأصلية…");
      await loadProducts(); await $("[data-gallery]").onclick();
      msg("3/3 — عم نضغط بجودة أعلى وبدون قص…");
      await loadProducts(); await $("[data-optimize]").onclick();
      msg("✓ خلصت: الصور رجعت كاملة متل الأصل، ومضغوطة.");
    } catch (e) { msg(e.message); toast(e.message); }
    restoreBtn.disabled = false;
  };

  // ---------- colour engine: every surface has its own background + text, and text is never allowed to vanish ----------
  const THEME_DEFAULTS = {
    hdrBg: "#121212", hdrFg: "", annBg: "#d9232d", annFg: "", pageBg: "#f5f3ef", pageFg: "", cardBg: "#ffffff", cardFg: "",
    price: "", btnBg: "#d9232d", btnFg: "", btn2Bg: "#121212", btn2Fg: "", heroBg: "#121212", heroFg: "", ftrBg: "#121212", ftrFg: "",
  };
  const HEX = /^#[0-9a-f]{6}$/i;
  function lum(hex) {
    const n = parseInt(hex.slice(1), 16), f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(n >> 16) + 0.7152 * f((n >> 8) & 255) + 0.0722 * f(n & 255);
  }
  function contrast(a, b) { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
  // chosen text colour if it is readable on that background, otherwise black or white automatically
  function readable(bg, chosen, min) {
    if (chosen && HEX.test(chosen) && contrast(chosen, bg) >= (min || 3)) return chosen;
    return contrast("#121212", bg) >= contrast("#ffffff", bg) ? "#121212" : "#ffffff";
  }
  function themeColors(D) {
    const legacy = {
      hdrBg: D.headerBg || D.dark, hdrFg: D.headerText, annBg: D.primary, pageBg: D.background, pageFg: D.homeText || D.textColor,
      cardFg: D.productText, price: D.priceColor, btnBg: D.primary, btn2Bg: D.dark, heroBg: D.heroBg || D.dark, ftrBg: D.footerBg || D.dark, ftrFg: D.footerText,
    };
    const src = { ...THEME_DEFAULTS, ...Object.fromEntries(Object.entries(D.colors ? {} : legacy).filter(([, v]) => v)), ...(D.colors || {}) };
    const c = {};
    for (const k of Object.keys(THEME_DEFAULTS)) c[k] = HEX.test(src[k] || "") ? src[k] : k.endsWith("Bg") ? THEME_DEFAULTS[k] : "";
    const out = {
      "hdr-bg": c.hdrBg, "hdr-fg": readable(c.hdrBg, c.hdrFg),
      "ann-bg": c.annBg, "ann-fg": readable(c.annBg, c.annFg),
      "page-bg": c.pageBg, "page-fg": readable(c.pageBg, c.pageFg, 4.5),
      "card-bg": c.cardBg, "card-fg": readable(c.cardBg, c.cardFg, 4.5),
      "btn-bg": c.btnBg, "btn-fg": readable(c.btnBg, c.btnFg),
      "btn2-bg": c.btn2Bg, "btn2-fg": readable(c.btn2Bg, c.btn2Fg),
      "hero-bg": c.heroBg, "hero-fg": readable(c.heroBg, c.heroFg),
      "ftr-bg": c.ftrBg, "ftr-fg": readable(c.ftrBg, c.ftrFg),
    };
    out["price-card"] = readable(c.cardBg, c.price || out["card-fg"]);
    out["price-page"] = readable(c.pageBg, c.price || out["page-fg"]);
    out["link"] = readable(c.pageBg, c.btnBg);          // links / active dots on the page
    out["accent-card"] = readable(c.cardBg, c.btnBg);   // accents inside cards and menus
    return out;
  }
  const themeCss = (D) => Object.entries(themeColors(D)).map(([k, v]) => `--c-${k}:${v}`).join(";");

  // ---------- theme editor ----------
  const SURFACES = [
    ["hdr", "الشريط العلوي", "ورا اللوغو والبحث والقائمة"], ["ann", "شريط التنبيهات", ""], ["page", "الصفحة", "خلفية الموقع وعناوين الأقسام"],
    ["card", "البطاقات والمربعات", "المنتجات، المجموعات، الفورمات، السلة"], ["btn", "الزر الأساسي", "اشتري الآن، تأكيد الطلب، شارة KO"],
    ["btn2", "الزر التاني", "+ للسلة، الخيار المختار"], ["hero", "الواجهة الكبيرة", ""], ["ftr", "الفوتر", "آخر الصفحة"],
  ];
  // ---------- design templates (50): each one = its own layout + colours + fonts + shapes ----------
  const LAYOUT = { hdr: ["classic", "center", "inline", "float", "tabs", "app"], hero: ["box", "full", "split", "center", "minimal", "edge"], card: ["classic", "minimal", "center", "framed", "icon", "tall", "store"],
    cat: ["tile", "circle", "pill", "big", "row", "coll"], title: ["plain", "bar", "center", "underline", "caps", "solo"], ftr: ["classic", "center", "line"], cols: ["m", "s", "l"],
    dens: ["normal", "compact", "airy"], ann: ["static", "marquee"], pdp: ["side", "flip", "stack", "store"],
    rows: ["start", "center"], list: ["classic", "store"], nav: ["off", "on"], drawer: ["list", "accordion"], price: ["latin", "arabic"] };
  const layoutOf = (D) => Object.fromEntries(Object.entries(LAYOUT).map(([k, o]) => [k, o.includes((D.layout || {})[k]) ? D.layout[k] : o[0]]));
  const LAYOUT_UI = [
    ["hdr", "الشريط العلوي", { app: "تطبيق (قائمة · لوغو بالنص · بحث)", classic: "كلاسيكي", center: "اللوغو بالنص", inline: "القائمة بنفس السطر", float: "عائم", tabs: "تبويبات" }],
    ["nav", "شريط التنقل السفلي (موبايل)", { on: "ظاهر", off: "مخفي" }],
    ["hero", "الواجهة / الشريحة", { edge: "عرض كامل مع نقاط", box: "صندوق", full: "عرض كامل", split: "مقسومة", center: "بالنص مع توهّج", minimal: "نص بس" }],
    ["card", "بطاقة المنتج", { store: "متجر (نجوم وزر عريض)", classic: "كلاسيكية", minimal: "بدون صندوق", center: "بالنص", framed: "إطار وزر عريض", icon: "زر دائري عالصورة", tall: "صورة طولية" }],
    ["rows", "السلايد الجانبي", { center: "المنتج بالنص", start: "من البداية" }],
    ["cat", "الأقسام", { coll: "بطاقات مجموعات", tile: "مربعات", circle: "دوائر (ستوري)", pill: "كبسولات", big: "صور كبيرة", row: "سطر بيتمرّر" }],
    ["title", "عناوين الأقسام", { solo: "بالنص بدون رابط", plain: "عادي", bar: "خط جانبي", center: "بالنص", underline: "خط تحت", caps: "كبير عريض" }],
    ["list", "صفحة القسم", { store: "بانر + تصفية وترتيب", classic: "كلاسيكية" }],
    ["drawer", "القائمة الجانبية", { accordion: "مجموعات بتنفتح", list: "قائمة بسيطة" }],
    ["price", "شكل السعر", { arabic: "أرقام عربية (US$ ٢٥)", latin: "أرقام إنكليزية ($25)" }],
    ["ftr", "الفوتر", { classic: "أعمدة", center: "بالنص", line: "سطر واحد" }],
    ["cols", "حجم المنتجات", { s: "صغير (أكتر بالسطر)", m: "متوسط", l: "كبير" }],
    ["dens", "المسافات", { compact: "مضغوطة", normal: "عادية", airy: "مريحة" }],
    ["ann", "شريط التنبيهات", { static: "ثابت", marquee: "متحرّك" }],
    ["pdp", "صفحة المنتج", { store: "متجر (تقييمات وشريط إضافة)", side: "الصورة يمين", flip: "الصورة يسار", stack: "الصورة فوق" }],
  ];
  const THEMES = (window.KO_THEMES || []).map((t) => {
    const [hdrBg, pageBg, cardBg, btnBg, btn2Bg, heroBg, ftrBg, annBg] = t.c, lay = t.l.split(" ");
    return { id: t.id, name: t.name, cat: t.cat, colors: { hdrBg, pageBg, cardBg, btnBg, btn2Bg, heroBg, ftrBg, annBg }, headingFont: t.f[0], bodyFont: t.f[1],
      radius: t.s[0], cardStyle: t.s[1], btnShape: t.s[2], layout: Object.fromEntries(Object.keys(LAYOUT).map((k, i) => [k, LAYOUT[k].includes(lay[i]) ? lay[i] : LAYOUT[k][0]])) };
  });
  const TH_KEYS = ["hdrBg", "pageBg", "cardBg", "btnBg", "btn2Bg", "heroBg", "ftrBg", "annBg"];
  const TH_AREAS = [["hdrBg", "الشريط العلوي", "hdr"], ["annBg", "التنبيهات", "ann"], ["pageBg", "الصفحة", "page"], ["cardBg", "البطاقات", "card"],
    ["btnBg", "الزر الأساسي", "btn"], ["btn2Bg", "الزر التاني", "btn2"], ["heroBg", "الواجهة", "hero"], ["ftrBg", "الفوتر", "ftr"]];
  const SHAPE_NAMES = { square: "مربّع", rounded: "مدوّر", pill: "كبسولة", flat: "بدون إطار", border: "إطار خفيف", shadow: "ظل" };
  let thCat = "الكل";
  function shapeVars(D) {
    const r = Math.min(24, Math.max(0, Number.isFinite(+D.radius) && D.radius !== "" && D.radius != null ? +D.radius : 14));
    const b = { square: Math.min(r, 4), rounded: Math.max(6, Math.round(r * 0.8)), pill: 999 }[D.btnShape] ?? 12;
    const cs = D.cardStyle || "border";
    return { "--radius": r + "px", "--btn-r": b + "px", "--card-bw": cs === "border" ? "1px" : "0px",
      "--card-sh": cs === "shadow" ? "0 2px 6px rgba(0,0,0,.06),0 10px 28px rgba(0,0,0,.08)" : "0 0 #0000" };
  }
  const blankFg = { hdrFg: "", annFg: "", pageFg: "", cardFg: "", price: "", btnFg: "", btn2Fg: "", heroFg: "", ftrFg: "" };
  const themePatch = (T) => ({ themeId: T.id, colors: { ...T.colors, ...blankFg }, headingFont: T.headingFont, bodyFont: T.bodyFont,
    radius: T.radius, cardStyle: T.cardStyle, btnShape: T.btnShape, layout: { ...T.layout } });
  const fam = (f) => (f && f !== "system" ? `'${f}',` : "");
  function pvStyle(D) {
    return Object.entries(themeColors(D)).map(([k, v]) => `--c-${k}:${v}`).concat(Object.entries(shapeVars(D)).map(([k, v]) => `${k}:${v}`))
      .concat([`--head:${fam(D.headingFont)}system-ui,sans-serif`, `--body:${fam(D.bodyFont)}system-ui,sans-serif`, `--head-w:${+D.headingWeight || 700}`]).join(";");
  }
  const layAttrs = (D) => Object.entries(layoutOf(D)).map(([k, v]) => `data-l-${k}="${v}"`).join(" ");
  // a real mini copy of the shop (same classes as the live site), so every template shows its true layout
  function siteMarkup(D) {
    const st = (ST && ST.store) || {}, L1 = D.logoText1 || "KO", L2 = D.logoText2 || "SPORT";
    const logo = D.logoImage ? `<img src="${esc(D.logoImage)}" alt="">` : `${L1 ? `<span class="logo-ko">${esc(L1)}</span>` : ""}<span class="logo-sport">${esc(L2)}</span>`;
    const ps = products.filter((p) => p.inStock && !p.hidden && (p.thumb || p.image)).slice(0, 4);
    while (ps.length < 4) ps.push({ name: "قفاز ملاكمة احترافي", price: 25, inStock: true });
    const catMap = new Map();
    products.forEach((p) => { if (p.category && !catMap.has(p.category) && (p.thumb || p.image)) catMap.set(p.category, p.thumb || p.image); });
    const cats = [...catMap].slice(0, 6); while (cats.length < 6) cats.push(["قسم", ""]);
    const groups = (D.groups || []).slice(0, 4).map((g) => `<a>${esc(g.name)}</a>`).join("");
    const head = (t) => `<div class="sec-head"><h2>${t}</h2><a>عرض الكل ←</a></div>`;
    const ar = layoutOf(D).price === "arabic";
    const pr = (n) => (ar ? `${Number(n).toLocaleString("ar-SY")} US$` : `$${n}`);
    const cardH = (p) => `<article class="card">${D.cardBadge ? `<span class="promo">🎟 ${esc(D.cardBadge)}</span>` : ""}<a class="pic"><img src="${esc(p.thumb || p.image || NOIMG)}" alt="" loading="lazy"></a><div class="body"><a class="name">${esc(p.name)}</a>
          <span class="stars"><i>★</i><i>★</i><i>★</i><i>★</i><i>★</i></span>
          <div class="foot-row"><span class="price">${pr(p.price)}</span><span class="add"><svg class="ic" viewBox="0 0 24 24" width="16" height="16"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2" fill="none" stroke="currentColor" stroke-width="1.8"/></svg><span class="t1">+ للسلة</span><span class="t2">أضف إلى السلّة</span></span></div>${D.buyNow ? '<span class="buy-now">اشتري الآن</span>' : ""}</div></article>`;
    const list = (sec, from) => { const grid = sec.layout === "grid", pm = +sec.perMob, pd = +sec.perDesk;
      const its = Array.from({ length: grid ? Math.max(4, (pm || 2) * 2) : 6 }, (_, i) => ps[(i + from) % ps.length]);
      return `<div class="${grid ? "grid" : "row"} slist"${pm ? " data-pm" : ""}${pd ? " data-pd" : ""} style="${pm ? `--pm:${pm}` : ""}${pd ? `;--pd:${pd}` : ""}">${its.map(cardH).join("")}</div>`; };
    const catsH = () => `<div class="cat-tiles">${cats.map(([n, u]) => `<a class="cat-tile"><img src="${esc(u || NOIMG)}" alt="" loading="lazy"><b>${esc(n)}</b><span>12 منتج</span></a>`).join("")}</div>`;
    const sl = (D.slides || []).find((x) => x.img);
    const hero = sl ? `<section class="slider"><div class="sl-track" dir="ltr"><div class="slide" data-align="${esc(sl.align || "center")}" style="--tc:${esc(sl.color || "#fff")};--ts:${+sl.size || 18}px"><img src="${esc(sl.img)}" alt=""><div class="sl-text">${sl.title ? `<h2>${esc(sl.title)}</h2>` : ""}${sl.subtitle ? `<p>${esc(sl.subtitle)}</p>` : ""}</div></div></div></section>`
      : `<section class="hero${D.heroImage ? " has-img" : ""}"${D.heroImage ? ` style="background-image:url('${esc(D.heroImage)}')"` : ""}><h1>${esc(D.heroTitle || "عدّتك الرياضية كاملة")}</h1><p>${esc(D.heroText || "قفازات ملاكمة، معدات جيم، كرة قدم وسلة وأكتر")}</p><div class="hero-stats"><div><b>380</b>منتج متوفر</div><div><b>34</b>قسم</div><div><b>9</b>محافظة</div></div></section>`;
    const secs = ((ST && ST.home && ST.home.sections) || [{ type: "slider" }, { type: "categories", title: "تسوّق حسب القسم" }, { type: "new", title: "وصل حديثاً" }]).filter((x) => x.on !== false);
    let body = "", n = 0;
    for (const sec of secs) {
      if (n >= 5) break;
      if (sec.type === "slider") body += hero;
      else if (sec.type === "categories") body += (sec.title ? head(esc(sec.title)) : "") + catsH();
      else if (["new", "best", "products"].includes(sec.type)) body += head(esc(sec.title || "")) + list(sec, n);
      else if (sec.type === "groups") body += (D.groups || []).slice(0, 2).map((g, i) => head(esc(g.name)) + list(sec, n + i + 1)).join("");
      else if (sec.type === "banner" && sec.img) body += `<div class="banner"><img src="${esc(sec.img)}" alt=""></div>`;
      else continue;
      n++;
    }
    if (!body) body = hero;
    return `<div class="announce"><span>${esc(st.announcement || "توصيل لكل المحافظات 🔥")}</span></div>
      <header class="top"><div class="top-in"><span class="icon-btn menu-btn"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span>
        <span class="logo">${logo}</span><span class="icon-btn search-btn"><svg viewBox="0 0 24 24" width="24" height="24"><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2"/><path d="m20 20-3.5-3.5" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></span><span class="search"><input placeholder="دوّر على منتج…" tabindex="-1"><button tabindex="-1">⌕</button></span>
        <span class="icon-btn cart-btn"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2" fill="none" stroke="currentColor" stroke-width="2"/></svg><span class="cart-count">2</span></span></div>
        <nav class="groups"><a class="on">الرئيسية</a>${groups}<a>كل المنتجات</a></nav></header>
      <div class="pv-main">${body}</div>
      <footer class="foot"><div class="foot-in"><div><div class="logo small">${logo}</div><p>${esc(st.tagline || "اول موقع داخل سوريا متخصص بالادوات الرياضية")}</p></div>
        <div class="foot-links"><a>واتساب</a><a>فيسبوك</a><a>إنستغرام</a></div><div class="foot-note">${esc(st.footerNote || "")}</div></div></footer>`;
  }
  let pvMode = "mob"; try { pvMode = localStorage.getItem("ko_pv_mode") || "mob"; } catch {}
  const sitePv = (D, cls) => `<div class="site-pv ${pvMode === "mob" ? "mob" : ""} ${cls || ""}" ${layAttrs(D)} style="${pvStyle(D)}"><div class="site-pv-in">${siteMarkup(D)}</div></div>`;
  function fitPreviews() { $$(".site-pv").forEach((el) => { if (el.clientWidth) el.style.setProperty("--z", (el.clientWidth / (el.classList.contains("mob") ? 390 : 1100)).toFixed(4)); }); }
  // phone previews inside the dashboard: copy the shop's phone rules (max-width media queries) and scope them to .site-pv.mob
  (function mobCss() {
    const sh = [...document.styleSheets].find((x) => /store\.css/.test(x.href || "")); if (!sh) return;
    let out = "";
    const scope = (sel) => sel.split(",").map((x) => {
      x = x.trim();
      const m = x.match(/^((?:\[data-l-[^\]]+\](?::not\([^)]*\))?)+)(.*)$/);
      if (m) return `.site-pv.mob${m[1]}${m[2]}`;
      if (/^(html|body|:root)\b/.test(x)) return x.replace(/^(html|body|:root)/, ".site-pv.mob");
      return `.site-pv.mob ${x}`;
    }).join(",");
    try {
      for (const r of sh.cssRules) {
        if (!(r instanceof CSSMediaRule)) continue;
        const t = r.conditionText || r.media.mediaText, mx = t.match(/max-width:\s*(\d+)px/);
        if (!mx || /min-width/.test(t) || +mx[1] < 390) continue;
        for (const x of r.cssRules) if (x.selectorText) out += `${scope(x.selectorText)}{${x.style.cssText}}\n`;
      }
    } catch {}
    const st = document.createElement("style"); st.textContent = out; document.head.appendChild(st);
  })();
  addEventListener("resize", () => requestAnimationFrame(fitPreviews));
  const curTheme = () => ST && THEMES.find((t) => t.id === ST.design.themeId);
  function themeModified(T) {
    if (!T) return false;
    const d = ST.design, c = d.colors || {}, l = layoutOf(d);
    return TH_KEYS.some((k) => (c[k] || "").toLowerCase() !== T.colors[k]) || d.headingFont !== T.headingFont || d.bodyFont !== T.bodyFont
      || +d.radius !== T.radius || d.cardStyle !== T.cardStyle || d.btnShape !== T.btnShape || Object.keys(LAYOUT).some((k) => l[k] !== T.layout[k]);
  }
  function paletteList(D) {
    const t = themeColors(D);
    return `<ul class="th-pal">${TH_AREAS.map(([k, n, s]) => `<li><i style="background:${t[s + "-bg"]};color:${t[s + "-fg"]}">Aa</i><span>${n}</span><code>${t[s + "-bg"]}</code></li>`).join("")}
      <li><i style="background:${t["card-bg"]};color:${t["price-card"]}">$</i><span>السعر</span><code>${t["price-card"]}</code></li></ul>`;
  }
  const layoutList = (D) => { const l = layoutOf(D); return `<ul class="th-lay">${LAYOUT_UI.map(([k, n, o]) => `<li><span>${n}</span><b>${o[l[k]]}</b></li>`).join("")}</ul>`; };
  // ---------- complete store templates ("packs") ----------
  const PACKS = window.KO_PACKS || [];
  const packDesign = (P) => {
    const d = JSON.parse(JSON.stringify(P.design)), now = Date.now();
    const out = { themeId: "pack-" + P.id, colors: { ...d.colors, ...blankFg }, headingFont: d.headingFont, bodyFont: d.bodyFont, radius: d.radius, cardStyle: d.cardStyle, btnShape: d.btnShape, skin: d.skin,
      layout: Object.fromEntries(Object.keys(LAYOUT).map((k) => [k, LAYOUT[k].includes(d.layout[k]) ? d.layout[k] : LAYOUT[k][0]])), open: d.open, fx: { ...(ST.design.fx || {}), reveal: "up", speed: "normal", page: "", card: "", btn: "", img: "", progress: false, toTop: false, hideHeader: false, glow: false, smooth: false, ...d.fx },
      bnav: { ...(ST.design.bnav || {}), ...d.bnav }, buyNow: d.buyNow, games: { ...(ST.design.games || {}), prizes: (ST.design.games || {}).prizes, ...d.games }, conv: { ...d.conv } };
    const tm = out.conv.timer || {}; out.conv.timer = { text: "", btn: "", link: "", ...tm, endsAt: tm.on ? new Date(now + (tm.days || 3) * 86400000).toISOString() : (tm.endsAt || "") }; delete out.conv.timer.days;
    out.primary = out.colors.btnBg; out.dark = out.colors.btn2Bg; out.background = out.colors.pageBg;
    return out;
  };
  const packHome = (P) => JSON.parse(JSON.stringify(P.home));
  function renderPacks() {
    const el = $("[data-packs]"); if (!el || !ST) return;
    PACKS.forEach((P) => [P.design.headingFont, P.design.bodyFont].forEach(loadFont));
    el.innerHTML = PACKS.map((P) => {
      const on = ST.design.themeId === "pack-" + P.id;
      return `<article class="pack-card${on ? " on" : ""}"><div class="pack-top" style="background:linear-gradient(135deg,${P.sw[0]},${P.sw[1]})"><span class="pack-em">${P.emoji}</span><b style="font-family:'${esc(P.design.headingFont)}'">${esc(P.name)}</b><span class="pack-sw">${P.sw.map((c) => `<i style="background:${c}"></i>`).join("")}</span></div>
        <div class="pack-body"><small>${esc(P.tag)}</small><ul>${P.feats.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>
        <div class="th-acts"><button type="button" class="btn btn-ghost sm" data-pack-prev="${P.id}">👁 معاينة</button><button type="button" class="btn btn-red sm" data-pack-apply="${P.id}">${on ? "إعادة التثبيت" : "تثبيت القالب كامل"}</button></div></div></article>`;
    }).join("");
  }
  function applyPack(P) {
    if (!confirm(`تثبيت قالب «${P.name}»؟\nبيغيّر شكل الموقع وترتيب الصفحة الرئيسية والشريط السفلي والميزات. منتجاتك وصورك وشرائحك ما بتتغيّر. ما بينحفظ شي إلا لما تكبس «حفظ».`)) return;
    Object.assign(ST.design, packDesign(P)); syncLegacy();
    ST.home = { ...(ST.home || {}), sections: packHome(P) };
    if (P.announcement) { ST.store.announcement = P.announcement; ST.design.announceOn = true; }
    ST.checkout = { ...(ST.checkout || {}), ...(P.checkout || {}) };
    ST.apps = { ...(ST.apps || {}), waFloat: false };
    renderLayoutEd(); renderTheme(); renderSettings(); renderPacks(); updateSetBar();
    toast(`تم تثبيت «${P.name}» — جرّب المعاينة ثم اكبس «حفظ» لينتشر عالموقع`);
  }
  function previewPack(P) {
    $("[data-th-dlg-name]").textContent = "معاينة قالب متكامل: " + P.name; $("[data-th-dlg-apply]").hidden = true;
    const patch = { design: { ...ST.design, ...packDesign(P) }, home: { ...(ST.home || {}), sections: packHome(P) }, store: { ...ST.store, announcement: P.announcement || ST.store.announcement } };
    const fr = $("[data-th-frame]"); fr.onload = () => { try { fr.contentWindow.postMessage({ koPreview: patch }, location.origin); } catch {} };
    if (fr.dataset.loaded) fr.onload(); else { fr.dataset.loaded = "1"; fr.src = "/?preview=1#/"; }
    $("[data-th-dlg]").showModal();
  }
  document.addEventListener("click", (e) => {
    let b; if (!ST) return;
    if ((b = e.target.closest("[data-pack-apply]"))) applyPack(PACKS.find((p) => p.id === b.dataset.packApply));
    else if ((b = e.target.closest("[data-pack-prev]"))) previewPack(PACKS.find((p) => p.id === b.dataset.packPrev));
    else if (e.target.closest("[data-trust-add]")) { const L = ST.design.conv.trustItems; if (L.length < 6) L.push({ i: "✔", t: "" }); renderTrust(); updateSetBar(); }
    else if ((b = e.target.closest("[data-trust-rm]"))) { ST.design.conv.trustItems.splice(+b.dataset.trustRm, 1); renderTrust(); renderPreviews(); updateSetBar(); }
  });
  function renderTrust() {
    const el = $("[data-trust-items]"); if (!el || !ST || !ST.design.conv) return;
    el.innerHTML = ST.design.conv.trustItems.map((x, i) => `<div class="bn-row gm-row" style="grid-template-columns:70px 1fr auto"><input data-k="design.conv.trustItems.${i}.i" maxlength="4" value="${esc(x.i || "")}" aria-label="أيقونة"><input data-k="design.conv.trustItems.${i}.t" maxlength="60" value="${esc(x.t || "")}" placeholder="نص الشارة"><span class="bn-acts"><button type="button" data-trust-rm="${i}" aria-label="حذف">✕</button></span></div>`).join("");
    const t = ST.design.conv.timer, inp = $("[data-conv-end]");
    if (inp) { const d = t.endsAt ? new Date(t.endsAt) : null; inp.value = d && !isNaN(d) ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ""; }
  }
  document.addEventListener("change", (e) => {
    const inp = e.target.closest("[data-conv-end]"); if (!inp || !ST) return;
    ST.design.conv.timer.endsAt = inp.value ? new Date(inp.value).toISOString() : ""; renderPreviews(); updateSetBar();
  });

  function renderThemes() {
    const grid = $("[data-th-grid]"); if (!grid || !ST) return;
    renderPacks();
    syncPvMode();
    ensureColors();
    new Set(THEMES.flatMap((t) => [t.headingFont, t.bodyFont])).forEach(loadFont);
    const cur = curTheme(), mod = themeModified(cur);
    $("[data-th-current]").innerHTML = `<div class="thc-pv">${sitePv(ST.design)}</div>
      <div class="thc-info"><small>التصميم الحالي</small><h2>${cur ? esc(cur.name) : "تصميم مخصّص"}${mod ? ' <span class="pill">معدّل</span>' : ""}</h2>
        <p class="hint">الخطوط: ${esc(ST.design.headingFont)} / ${ST.design.bodyFont && ST.design.bodyFont !== "system" ? esc(ST.design.bodyFont) : "خط الجهاز"} · الأزرار: ${SHAPE_NAMES[ST.design.btnShape] || "مدوّر"} · البطاقات: ${SHAPE_NAMES[ST.design.cardStyle] || "إطار خفيف"} · الزوايا: ${ST.design.radius ?? 14}px</p>
        <details class="th-det" open><summary>التخطيط</summary>${layoutList(ST.design)}</details>
        <details class="th-det"><summary>الألوان</summary>${paletteList(ST.design)}</details>
        <div class="thc-btns"><button class="btn btn-red sm" data-th-custom>🎨 تخصيص التخطيط والألوان</button><button class="btn btn-ghost sm" data-th-prev="__cur">👁 معاينة الموقع</button></div></div>`;
    const cats = ["الكل", ...new Set(THEMES.map((t) => t.cat))];
    $("[data-th-filter]").innerHTML = cats.map((c) => `<button type="button" class="chip${c === thCat ? " on" : ""}" data-th-cat="${c}">${c}${c === "الكل" ? ` (${THEMES.length})` : ""}</button>`).join("");
    grid.innerHTML = THEMES.filter((t) => thCat === "الكل" || t.cat === thCat).map((T) => {
      const D = { ...ST.design, ...themePatch(T) }, on = cur && cur.id === T.id;
      return `<article class="th-card${on ? " on" : ""}" data-th="${T.id}">
        <div class="th-shot" role="button" tabindex="0" data-th-prev="${T.id}" aria-label="معاينة ${esc(T.name)}">${sitePv(D)}</div>
        <div class="th-meta"><b>${esc(T.name)}</b><small>${esc(T.cat)}${on ? " · ✓ مثبّت" : ""}</small></div>
        <div class="th-sw">${TH_AREAS.map(([k, n]) => `<i title="${n}: ${T.colors[k]}" style="background:${T.colors[k]}"></i>`).join("")}</div>
        <details class="th-det"><summary>تفاصيل</summary>${layoutList(D)}${paletteList(D)}<p class="hint">خط العناوين: ${esc(T.headingFont)} · خط النص: ${T.bodyFont === "system" ? "خط الجهاز" : esc(T.bodyFont)}<br>الأزرار: ${SHAPE_NAMES[T.btnShape]} · البطاقات: ${SHAPE_NAMES[T.cardStyle]} · الزوايا: ${T.radius}px</p></details>
        <div class="th-acts"><button type="button" class="btn btn-ghost sm" data-th-prev="${T.id}">معاينة</button><button type="button" class="btn ${on ? "btn-ghost" : "btn-red"} sm" data-th-apply="${T.id}">${on ? "إعادة التثبيت" : "تثبيت"}</button></div>
      </article>`;
    }).join("");
    requestAnimationFrame(fitPreviews);
  }
  function renderLayoutEd() {
    const el = $("[data-layout-ed]"); if (!el || !ST) return;
    ST.design.layout = layoutOf(ST.design);
    el.innerHTML = LAYOUT_UI.map(([k, n, o]) => `<div class="field"><label>${n}</label><div class="seg" data-seg="design.layout.${k}">${Object.entries(o).map(([v, t]) => `<button type="button" data-v="${v}">${t}</button>`).join("")}</div></div>`).join("");
  }
  function renderThemeMini() {
    const el = $("[data-th-mini]"); if (!el || !ST) return;
    const cur = curTheme();
    el.innerHTML = `<span class="th-sw">${TH_AREAS.map(([k]) => `<i style="background:${(ST.design.colors || {})[k] || "#ccc"}"></i>`).join("")}</span>
      <b>${cur ? esc(cur.name) : "مخصّص"}${themeModified(cur) ? " (معدّل)" : ""}</b><button type="button" class="btn btn-ghost sm" data-th-goto>اختار قالب ←</button>`;
  }
  function applyTheme(T) {
    Object.assign(ST.design, themePatch(T)); syncLegacy();
    renderLayoutEd(); renderTheme(); bindInputs(); renderSegs(); renderPreviews(); renderThemes(); updateSetBar();
    toast(`تم تثبيت «${T.name}» — اكبس «حفظ» لينتشر عالموقع`);
  }
  function syncPvMode() { $$("[data-pvm]").forEach((x) => x.classList.toggle("on", x.dataset.pvm === pvMode)); }
  // ---------- live phone preview docked next to the editors ----------
  const DOCK_TABS = ["themes", "appearance"];
  let dockT = 0;
  function dockMsg() { return { koPreview: { design: ST.design, home: ST.home, store: ST.store } }; }
  function fitDock() {
    const dock = $("[data-dock]"), scr = $("[data-dock-screen]"), fr = $("[data-dock-frame]"); if (!dock || !fr) return;
    const desk = dock.classList.contains("desk"), w = desk ? 1280 : 390, avail = scr.clientWidth || 280;
    const z = avail / w, h = Math.max(300, (scr.clientHeight || 560) / z);
    fr.style.width = w + "px"; fr.style.height = h + "px"; fr.style.transform = `scale(${z})`;
  }
  function dockSync() {
    clearTimeout(dockT);
    dockT = setTimeout(() => {
      if (!ST || !document.body.classList.contains("dock-on")) return;
      const fr = $("[data-dock-frame]"); if (!fr || getComputedStyle($("[data-dock]")).display === "none") return;
      if (!fr.dataset.loaded) { fr.dataset.loaded = "1"; fr.onload = () => { fitDock(); try { fr.contentWindow.postMessage(dockMsg(), location.origin); if (pvLast) setTimeout(() => fr.contentWindow.postMessage({ koGo: pvLast }, location.origin), 400); } catch {} }; fr.src = "/?preview=1#/"; return; }
      try { fr.contentWindow.postMessage(dockMsg(), location.origin); } catch {}
    }, 250);
  }
  addEventListener("resize", () => { fitDock(); dockSync(); });
  // ---------- the preview follows what you're editing (page + spot) ----------
  const PROD = "#/p/";
  const PV_PANEL = { logo: { r: "#/" }, colors: { r: "#/" }, fonts: { r: "#/" }, cur: { r: "#/all" }, announce: { r: "#/", at: "top", flash: "[data-announce]" }, slider: { r: "#/" },
    product: { r: PROD }, price: { r: "#/all", at: "top", pzDemo: true, flash: ".card .pz" }, card: { r: "#/all", at: "top", flash: ".card" }, menu: { r: "#/browse" }, home: { r: "#/", at: ".hsec[data-si]:nth-child(2)" }, footer: { r: "#/", at: "bottom" }, layout: { r: "#/" },
    sound: { r: "#/" }, fx: { r: "#/all" }, dark: { r: "#/", flash: ".fx-dark,.bn-dark" }, bnav: { r: "#/", flash: "[data-bnav]" }, kx: { kx: true }, games: { r: "#/games" }, conv: { r: PROD, at: ".conv-trust" },
    contact: { r: "#/", at: "bottom" }, social: { r: "#/", at: "bottom" }, checkout: { r: "#/checkout" } };
  function pvForKey(k) {
    if (!k) return null;
    if (/^design\.layout\.pdp/.test(k)) return { r: PROD };
    if (/^design\.layout\.(card|cols|list)/.test(k)) return { r: "#/all" };
    if (/^design\.layout\.ftr|^store\.(footerNote|tagline|facebook|instagram|address|whatsapp|email|phone)/.test(k)) return { r: "#/", at: "bottom" };
    if (/^design\.layout\.(cat|title|rows)|^design\.(afterSlider|secGap)/.test(k)) return { r: "#/", at: ".hsec[data-si]:nth-child(2)" };
    if (/^design\.layout\.drawer/.test(k)) return { r: "#/", menu: true };
    if (/^design\.layout\.nav|^design\.bnav\.menuTo/.test(k)) return k.endsWith("menuTo") ? { r: "#/browse", flash: "[data-bnav]" } : { r: "#/", flash: "[data-bnav]" };
    if (/^design\.hdrStart/.test(k)) return { r: "#/", at: "top", flash: ".top .cart-btn,.top .menu-btn" };
    if (/^design\.bnav/.test(k)) return { r: "#/", flash: "[data-bnav]" };
    if (/^design\.layout\.ann|^design\.announce|^store\.announcement/.test(k)) return { r: "#/", at: "top", flash: "[data-announce]" };
    if (/^design\.layout\.(hero|hdr|dens|title|price)|^design\.(slider|hero|showHeroStats|slideDir|logo)/.test(k)) return { r: "#/" };
    if (/^design\.conv\.shipBar/.test(k)) return { r: "#/cart", at: ".conv-ship" };
    if (/^design\.conv\.upsell/.test(k)) return { r: "#/cart", at: ".conv-up" };
    if (/^design\.conv\.timer/.test(k)) return { r: "#/", at: "top", flash: "[data-conv-timer]" };
    if (/^design\.conv\.trust/.test(k)) return { r: PROD, at: ".conv-trust" };
    if (/^design\.rowDir/.test(k)) return { r: "#/", at: ".hsec .row[data-auto],.hsec .car:not(.car-hero)" };
    if (/^design\.cd\./.test(k)) return { r: "#/all", at: "top", flash: ".card" };
    if (/^design\.pz\./.test(k)) return { r: "#/all", at: "top", pzDemo: true, flash: ".card .pz" };
    if (/^design\.cu\./.test(k)) return { r: "#/all", at: "top", pzDemo: true, cuDemo: true, flash: ".card .price" };
    if (/^design\.pg\.(fx|dur|auto|speed)/.test(k)) return { r: PROD, at: "top", pgDemo: true };
    if (/^design\.pg\./.test(k)) return { r: PROD, at: "top", flash: ".pdp-media" };
    if (/^design\.(buyNow|reviews|reviewsAuto|zoomMode)/.test(k)) return { r: PROD };
    if (/^design\.(cardBadge|hideOutOfStock)/.test(k)) return { r: "#/all" };
    if (/^design\.fx\.(card|img|reveal|speed)/.test(k)) return { r: "#/all", at: "top" };
    if (/^design\.fx\.page|^design\.open\./.test(k)) return { r: "#/", open: true };
    if (/^design\.fx\.btn/.test(k)) return { r: PROD };
    if (/^design\.fx\.(progress|toTop|hideHeader|smooth)/.test(k)) return { r: "#/", at: "mid" };
    if (/^design\.fx\.confetti/.test(k)) return { r: "#/", confetti: true };
    if (/^design\.fx\.glow/.test(k)) return { r: "#/" };
    if (/^design\.dark/.test(k)) return { r: "#/", flash: ".fx-dark,.bn-dark" };
    if (/^checkout\./.test(k)) return { r: "#/checkout" };
    if (/^design\.games/.test(k)) return { r: "#/games" };
    if (/^design\.kx/.test(k)) return { kx: true };
    if (/^fx\./.test(k)) return { r: "#/all" };
    return null;
  }
  let pvLast = null, pvSent = "";
  function pvGo(t, force) {
    if (!t) return;
    pvLast = t;
    const key = JSON.stringify(t);
    if (key === pvSent && !force) return;
    pvSent = key;
    // sent just after the new settings reach the preview, so the changed part is already drawn
    clearTimeout(pvGo.t);
    pvGo.t = setTimeout(() => {
      const fr = $("[data-dock-frame]");
      if (fr && fr.dataset.loaded && document.body.classList.contains("dock-on")) { try { fr.contentWindow.postMessage({ koGo: t }, location.origin); } catch {} }
      const f2 = $("[data-th-frame]"); if (f2 && f2.dataset.loaded && $("[data-th-dlg]").open && !thPrev) { try { f2.contentWindow.postMessage({ koGo: t }, location.origin); } catch {} }
    }, 320);
  }
  // which page fits the control that was touched
  function pvFromEvent(e) {
    if (!ST || !e.target.closest) return;
    const view = e.target.closest("[data-view]"); if (!view || !["appearance", "themes"].includes(view.dataset.view)) return;
    const c = e.target.closest("[data-k],[data-seg]");
    const k = c ? c.dataset.k || c.dataset.seg : "";
    const panel = e.target.closest("[data-ap]");
    const t = pvForKey(k) || (panel && PV_PANEL[panel.dataset.ap]);
    // a switch / choice / slider released: always jump there again (before ↔ after); typing: only when the place changes
    if (t) pvGo(t, e.type === "change" || e.type === "click");
  }
  document.addEventListener("input", pvFromEvent, true);
  document.addEventListener("change", pvFromEvent, true);
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("[data-apnav]"); if (a && ST) { const t = PV_PANEL[a.dataset.apnav]; if (t) pvGo(t, true); return; }
    if (e.target.closest && e.target.closest("[data-seg] [data-v]")) pvFromEvent(e);
    const tb = e.target.closest && e.target.closest('[data-tab="themes"]'); if (tb) pvGo({ r: "#/" });
  }, true);
  let thPrev = null;
  function openThemePreview(id) {
    const T = THEMES.find((t) => t.id === id);
    thPrev = T || null;
    const dlg = $("[data-th-dlg]"), fr = $("[data-th-frame]");
    $("[data-th-dlg-name]").textContent = T ? "معاينة: " + T.name : "معاينة التصميم الحالي (قبل الحفظ)";
    $("[data-th-dlg-apply]").hidden = !T;
    const patch = { design: T ? { ...ST.design, ...themePatch(T) } : ST.design, home: ST.home, store: ST.store };
    fr.onload = () => { try { fr.contentWindow.postMessage({ koPreview: patch }, location.origin); if (!T && pvLast) setTimeout(() => fr.contentWindow.postMessage({ koGo: pvLast }, location.origin), 400); } catch {} };
    if (fr.dataset.loaded) fr.onload(); else { fr.dataset.loaded = "1"; fr.src = "/?preview=1#/"; }
    dlg.showModal();
  }
  document.addEventListener("click", (e) => {
    if (!ST) return;
    let b;
    if ((b = e.target.closest("[data-th-cat]"))) { thCat = b.dataset.thCat; renderThemes(); return; }
    if ((b = e.target.closest("[data-th-apply]"))) { applyTheme(THEMES.find((t) => t.id === b.dataset.thApply)); return; }
    if ((b = e.target.closest("[data-th-prev]"))) { openThemePreview(b.dataset.thPrev); return; }
    if (e.target.closest("[data-th-dlg-apply]")) { if (thPrev) applyTheme(thPrev); $("[data-th-dlg]").close(); return; }
    if (e.target.closest("[data-th-dlg-close]")) { $("[data-th-dlg]").close(); return; }
    if ((b = e.target.closest("[data-pvm]"))) { pvMode = b.dataset.pvm; try { localStorage.setItem("ko_pv_mode", pvMode); } catch {} renderThemes(); renderThemePreview(); syncPvMode(); return; }
    if ((b = e.target.closest("[data-dock-dev]"))) { $$("[data-dock-dev]").forEach((x) => x.classList.toggle("on", x === b)); $("[data-dock]").classList.toggle("desk", b.dataset.dockDev === "desk"); fitDock(); return; }
    if ((b = e.target.closest("[data-dev]"))) { $$("[data-dev]").forEach((x) => x.classList.toggle("on", x === b)); $("[data-th-dlg]").classList.toggle("mob", b.dataset.dev === "mob"); return; }
    if (e.target.closest("[data-th-custom]")) { show("design"); return; }
    if (e.target.closest("[data-th-goto]")) { show("themes"); return; }
  });
  function ensureColors() {
    const D = ST.design;
    if (D.colors) return;
    const t = themeColors(D);
    D.colors = { hdrBg: t["hdr-bg"], hdrFg: D.headerText || "", annBg: t["ann-bg"], annFg: "", pageBg: t["page-bg"], pageFg: D.homeText || D.textColor || "",
      cardBg: t["card-bg"], cardFg: D.productText || "", price: D.priceColor || "", btnBg: t["btn-bg"], btnFg: "", btn2Bg: t["btn2-bg"], btn2Fg: "",
      heroBg: t["hero-bg"], heroFg: "", ftrBg: t["ftr-bg"], ftrFg: D.footerText || "" };
  }
  function syncLegacy() { const c = ST.design.colors; ST.design.primary = c.btnBg; ST.design.dark = c.btn2Bg; ST.design.background = c.pageBg; }
  function renderTheme() {
    const box = $("[data-theme-rows]"); if (!box || !ST) return;
    ensureColors();
    const c = ST.design.colors, t = themeColors(ST.design);
    const row = ([k, name, hint]) => {
      const bg = c[k + "Bg"], fg = c[k + "Fg"] || "", shown = t[k + "-fg"], auto = !fg;
      const bad = fg && fg.toLowerCase() !== shown.toLowerCase();
      return `<div class="th-row"><div class="th-name"><b>${name}</b>${hint ? `<small>${hint}</small>` : ""}</div>
        <label class="th-pick" title="الخلفية"><input type="color" data-k="design.colors.${k}Bg" value="${bg}"><span>خلفية</span></label>
        <label class="th-pick" title="الكتابة"><input type="color" data-k="design.colors.${k}Fg" value="${shown}"><span>كتابة</span></label>
        <button type="button" class="th-auto${auto ? " on" : ""}" data-auto="${k}Fg">تلقائي</button>
        <span class="th-ok${bad ? " bad" : ""}">${bad ? "⚠️ ما بيبيّن، منستعمل " + (shown === "#ffffff" ? "الأبيض" : "الأسود") : "✓ " + contrast(shown, bg).toFixed(1)}</span></div>`;
    };
    const pr = c.price || "", prShown = t["price-card"];
    box.innerHTML = SURFACES.map(row).join("") + `<div class="th-row"><div class="th-name"><b>لون السعر</b><small>بالبطاقات وصفحة المنتج</small></div>
      <span></span><label class="th-pick"><input type="color" data-k="design.colors.price" value="${prShown}"><span>كتابة</span></label>
      <button type="button" class="th-auto${pr ? "" : " on"}" data-auto="price">تلقائي</button><span class="th-ok${pr && pr.toLowerCase() !== prShown.toLowerCase() ? " bad" : ""}">${pr && pr.toLowerCase() !== prShown.toLowerCase() ? "⚠️ ما بيبيّن عالبطاقة" : "✓"}</span></div>`;
    renderThemePreview();
  }
  function renderThemePreview() {
    const pv = $("[data-theme-preview]");
    pv.innerHTML = sitePv(ST.design);
    requestAnimationFrame(fitPreviews);
    renderThemeMini();
  }
  document.addEventListener("click", (e) => {
    if (!ST) return;
    const a = e.target.closest("[data-auto]");
    if (a) { ensureColors(); ST.design.colors[a.dataset.auto] = ""; renderTheme(); updateSetBar(); }
  });
  document.addEventListener("input", (e) => {
    if (!ST || !e.target.matches('[data-k^="design.colors."]')) return;
    syncLegacy(); renderThemePreview();
  });
  document.addEventListener("change", (e) => { if (ST && e.target.matches('[data-k^="design.colors."]')) renderTheme(); });

  // ---------- site settings ----------
  const SET_TABS = ["promos", "themes", "appearance", "delivery", "payments", "collections", "discounts", "pages", "general", "tax", "dev", "apps", "legal", "domain", "bot"];
  const FONTS = ["system", "Changa", "Cairo", "Tajawal", "Almarai", "IBM Plex Sans Arabic", "Noto Kufi Arabic", "Noto Sans Arabic", "Readex Pro",
    "El Messiri", "Lalezar", "Reem Kufi", "Markazi Text", "Amiri", "Rubik", "Baloo Bhaijaan 2", "Open Sans"];
  const WEIGHTS = { 300: "Light 300", 400: "Regular 400", 500: "Medium 500", 600: "Semi-bold 600", 700: "Bold 700", 800: "Extra-bold 800" };
  const SEC_NAMES = { recent: "شاهدتها مؤخراً", code: "أكواد برمجية", slider: "السلايدر", categories: "كل الأقسام", groups: "صفوف المجموعات", new: "منتجات جديدة", best: "الأكثر مبيعاً", products: "منتجات من قسم", banner: "لافتة", video: "فيديو", features: "خصائص المتجر", text: "نص" };
  const METHODS = { door: "لباب البيت", qadmous: "مركز القدموس", off: "ما في توصيل" };
  let ST = null, stSaved = "";
  const stDirty = () => ST && JSON.stringify(ST) !== stSaved;
  const getK = (path) => path.split(".").reduce((o, k) => (o == null ? o : o[k]), ST);
  const setK = (path, v) => { const ks = path.split("."); const last = ks.pop(); ks.reduce((o, k) => (o[k] ??= {}), ST)[last] = v; };
  function updateSetBar() {
    const cur = $$("[data-tab]").find((b) => b.classList.contains("on"))?.dataset.tab;
    document.body.classList.toggle("dock-on", DOCK_TABS.includes(cur) && !!ST);
    if (ST && DOCK_TABS.includes(cur)) { requestAnimationFrame(fitDock); dockSync(); }
    $("[data-set-savebar]").hidden = !(SET_TABS.includes(cur) && stDirty());
  }
  function loadFont(name) {
    if (!name || name === "system") return;
    const id = "font-" + name.replace(/\s/g, "");
    if (document.getElementById(id)) return;
    const l = document.createElement("link"); l.id = id; l.rel = "stylesheet";
    l.href = `https://fonts.googleapis.com/css2?family=${name.replace(/ /g, "+")}:wght@500;700;800&display=swap`;
    document.head.appendChild(l);
  }
  async function openSettings(tab) {
    if (!ST) {
      try { ST = await api("/api/settings"); ST.discounts = (ST.discounts || []).filter((d) => !d.virtual); ST.pages = ST.pages || []; ST.promos = ST.promos || [];
        ST.tax = { on: false, rate: 0, mode: "added", label: "", ...(ST.tax || {}) }; ST.apps = { ga: "", fbPixel: "", tiktok: "", ...(ST.apps || {}), waFloat: false }; ST.dev = { head: "", css: "", ...(ST.dev || {}) };
        ST.design.catMeta = ST.design.catMeta || {};
        ST.notify = { emails: [], ...(ST.notify || {}) }; ST.redirects = ST.redirects || []; ST.robots = ST.robots || "";
        ST.design.sliderProg = ST.design.sliderProg || (ST.design.sliderBar === false ? "off" : "dot"); ST.design.sliderFx = ST.design.sliderFx || "fade"; ST.design.sliderShape = ST.design.sliderShape || "theme"; ST.design.sliderCarFx = ST.design.sliderCarFx || "scale";
        { const D = ST.design; D.slideDir = D.slideDir === "ltr" ? "ltr" : "rtl"; D.sliderXf = D.sliderXf || 1.6; D.sliderXe = D.sliderXe || "ease-in-out"; D.sliderXk = D.sliderXk || "off"; D.sliderXt = D.sliderXt || "fade";
          D.fx = { reveal: "up", speed: "normal", page: "", card: "", btn: "", img: "", ...(D.fx || {}) };
          D.darkPos = ["hdr-start", "hdr-end", "right", "left"].includes(D.darkPos) ? D.darkPos : "hdr-end"; D.darkDefault = D.darkDefault || "light"; D.darkSize = D.darkSize || 40;
          D.logoPx = D.logoPx || ({ l: 50, m: 38, s: 30 }[D.logoSize] || 38); if (D.logoRound == null) D.logoRound = true;
          D.kx = { on: true, blur: 16, dim: 45, tint: "", gStyle: "cards", anim: "pop", speed: "normal", icons: true, counts: true, cStyle: "tiles", cCols: "2", cStart: 45, gPos: "center", gIcons: {}, ...(D.kx || {}) }; D.kx.cCols = String(D.kx.cCols || 2);
          D.open = { style: "none", speed: "normal", freq: "session", ...(D.open || {}) };
          D.bnav = { items: BN_DEFAULT.map(([label, icon, link]) => ({ label, icon, link })), height: 64, width: 100, bottom: 0, radius: 0, iconSize: 26, labelSize: 12, bg: "", fg: "", active: "", activeStyle: "color", showLabels: true, hideScroll: false, fx: "fire", fxOn: "main", menuTo: "browse", darkBtn: true, curBtn: true, ...(D.bnav || {}) }; if (!D.rowDir) D.rowDir = D.slideDir === "ltr" ? "ltr" : "rtl"; D.cu = { txt: "full", custom: "", pos: "beside", size: 55, oldUnit: false, ...(D.cu || {}) }; D.pz = { lay: "stack", al: "center", old: "left", off: "above", txt: "pct", ns: 100, os: 58, nc: "", oc: "", ob: "", of: "", ...(D.pz || {}) }; D.cd = { look: "", hover: "", accent: "", radius: "", nameSize: "", nameWeight: "", nameLines: "", nameAlign: "", nameColor: "", near: true, gap: 4, ...(D.cd || {}) }; D.pg = { tdir: "rtl", side: "left", thumbs: "wrap", tsize: "m", talign: "center", fx: "slide", dur: "normal", auto: false, speed: 4, arrows: true, ...(D.pg || {}) };
          if (!Array.isArray(D.bnav.items) || !D.bnav.items.length) D.bnav.items = BN_DEFAULT.map(([label, icon, link]) => ({ label, icon, link }));
          D.conv = { timer: { on: false, text: "", endsAt: "", btn: "", link: "" }, shipBar: false, trust: false, trustItems: [{ i: "💵", t: "الدفع عند الاستلام" }, { i: "🚚", t: "توصيل لكل المحافظات" }, { i: "💬", t: "دعم مباشر عبر واتساب" }], upsell: false, ...(D.conv || {}) }; D.conv.timer = { on: false, text: "", endsAt: "", btn: "", link: "", ...(D.conv.timer || {}) };
          D.games = { on: false, title: "ألعاب", memory: true, tap: true, wheel: true, prizes: [{ label: "خصم 10%", code: "", w: 15 }, { label: "حظ أوفر", code: "", w: 40 }, { label: "شحن مجاني", code: "", w: 10 }, { label: "جرّب مرة ثانية", code: "", w: 35 }], ...(D.games || {}) };
          D.darkPal = { bg: "#0f0f13", card: "#1a1a20", hdr: "#16161c", ftr: "#0b0b0e", ...(D.darkPal || {}) }; }
        ST.fx = { mode: "usd", visitor: true, margin: 2, manual: "", ...(ST.fx || {}) };
        ST.audio = { ...(ST.audio || {}), music: { on: false, src: "", volume: 40, loop: true, button: true, ...((ST.audio || {}).music || {}) }, sfx: { on: false, style: "soft", volume: 60, ...((ST.audio || {}).sfx || {}) } };
        ST.store.tz = ST.store.tz || "Asia/Damascus"; ST.store.specialty = ST.store.specialty || "الرياضة"; ST.design.layout = layoutOf(ST.design); ensureColors(); ST.home = ST.home || { sections: [] }; normSections(); stSaved = JSON.stringify(ST);
        if (homeOrderV2()) { normSections(); setTimeout(() => toast("رتّبت الرئيسية: تحت الشريحة «وصل حديثاً» وبعدها «الأكثر مبيعاً» كسلايد متحرك — اكبس حفظ"), 400); } }
      catch { toast("ما قدرنا نحمّل الإعدادات"); return; }
    }
    if (!products.length && ["appearance", "collections", "themes", "discounts", "colledit", "delivery"].includes(tab)) await loadProducts();
    renderSettings();
  }
  // ---------- bottom bar items, games prizes, app icon, open preview ----------
  const BN_DEFAULT = [["الرئيسية", "home", "#/"], ["متجر", "shop", "#/all"], ["السلّة", "cart", "#/cart"], ["حسابي", "user", "#/account"], ["القائمة", "menu", "menu"]];
  const BN_ICONS = { home: "رئيسية", shop: "متجر", cart: "سلة", user: "حساب", menu: "قائمة", search: "بحث", heart: "قلب", phone: "اتصال", whatsapp: "واتساب", game: "ألعاب", tag: "عروض", star: "نجمة", bell: "إشعار", gift: "هدية", grid: "أقسام", truck: "شحن", info: "معلومات", mail: "رسالة", fire: "نار", flash: "برق" };
  const BN_LINKS = { "#/": "الصفحة الرئيسية", "#/all": "كل المنتجات", "#/cart": "السلّة", "#/account": "حسابي / طلباتي", menu: "القائمة (نافذة الأقسام أو القائمة الجانبية)", explore: "نافذة الأقسام (بلور)", search: "فتح البحث", wa: "واتساب المتجر", games: "قسم الألعاب" };
  function renderBn() {
    const el = $("[data-bn-items]"); if (!el || !ST || !ST.design.bnav) return;
    const L = ST.design.bnav.items;
    el.innerHTML = L.map((it, i) => {
      const preset = Object.prototype.hasOwnProperty.call(BN_LINKS, it.link);
      return `<div class="bn-row"><input type="color" class="bn-col" data-k="design.bnav.items.${i}.color" title="لون هالزر" value="${esc(/^#[0-9a-f]{6}$/i.test(it.color || "") ? it.color : "#ffffff")}"><input data-k="design.bnav.items.${i}.label" maxlength="20" placeholder="اسم الزر" value="${esc(it.label || "")}">
        <select data-k="design.bnav.items.${i}.icon">${Object.entries(BN_ICONS).map(([k, n]) => `<option value="${k}"${it.icon === k ? " selected" : ""}>${n}</option>`).join("")}</select>
        <select data-bn-link="${i}">${Object.entries(BN_LINKS).map(([k, n]) => `<option value="${esc(k)}"${it.link === k ? " selected" : ""}>${n}</option>`).join("")}<option value="__c"${preset ? "" : " selected"}>رابط مخصص…</option></select>
        <span class="bn-acts"><button type="button" data-bn-mv="${i}:-1" aria-label="لفوق">↑</button><button type="button" data-bn-mv="${i}:1" aria-label="لتحت">↓</button><button type="button" data-bn-rm="${i}" aria-label="حذف">✕</button></span>
        ${preset ? "" : `<input class="bn-custom" data-k="design.bnav.items.${i}.link" dir="ltr" placeholder="https://… أو #/page/اسم" value="${esc(it.link || "")}">`}</div>`;
    }).join("");
    const add = $("[data-bn-add]"); if (add) add.disabled = L.length >= 6;
  }
  function renderGm() {
    const el = $("[data-gm-prizes]"); if (!el || !ST || !ST.design.games) return;
    el.innerHTML = (ST.design.games.prizes || []).map((p, i) => `<div class="bn-row gm-row"><input data-k="design.games.prizes.${i}.label" maxlength="40" placeholder="اسم الجائزة" value="${esc(p.label || "")}"><input data-k="design.games.prizes.${i}.code" maxlength="24" dir="ltr" placeholder="كود الخصم (اختياري)" value="${esc(p.code || "")}"><input type="number" data-k="design.games.prizes.${i}.w" data-num min="0" max="100" dir="ltr" placeholder="احتمال" value="${p.w ?? ""}"><span class="bn-acts"><button type="button" data-gm-rm="${i}" aria-label="حذف">✕</button></span></div>`).join("");
  }
  document.addEventListener("click", (e) => {
    if (!ST || !ST.design.bnav) return;
    const L = ST.design.bnav.items, hit = (s) => e.target.closest(s);
    let b;
    if (hit("[data-bn-add]")) { if (L.length < 6) L.push({ label: "جديد", icon: "star", link: "#/all" }); }
    else if ((b = hit("[data-bn-rm]"))) { if (L.length > 2) L.splice(+b.dataset.bnRm, 1); else toast("لازم زرّين عالأقل"); }
    else if ((b = hit("[data-bn-mv]"))) { const [i, d] = b.dataset.bnMv.split(":").map(Number), j = i + d; if (j >= 0 && j < L.length) [L[i], L[j]] = [L[j], L[i]]; }
    else if (hit("[data-gm-add]")) { const P = (ST.design.games.prizes = ST.design.games.prizes || []); if (P.length < 12) P.push({ label: "جائزة", code: "", w: 10 }); renderGm(); updateSetBar(); return; }
    else if ((b = hit("[data-gm-rm]"))) { ST.design.games.prizes.splice(+b.dataset.gmRm, 1); renderGm(); updateSetBar(); return; }
    else return;
    renderBn(); renderPreviews(); updateSetBar();
  });
  document.addEventListener("change", (e) => {
    const sel = e.target.closest("[data-bn-link]"); if (!sel || !ST) return;
    ST.design.bnav.items[+sel.dataset.bnLink].link = sel.value === "__c" ? "https://" : sel.value; renderBn(); renderPreviews(); updateSetBar();
  });
  // open-animation preview (plays inside the live preview)
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-open-prev]") || !ST) return;
    const fr = $("[data-dock-frame]"), vis = fr && getComputedStyle($("[data-dock]")).display !== "none" && document.body.classList.contains("dock-on");
    const send = (f) => { try { f.contentWindow.postMessage({ koOpen: true }, location.origin); } catch {} };
    if (vis) { send(fr); return; }
    openThemePreview(null); const f2 = $("[data-th-frame]"); setTimeout(() => send(f2), 1200);
  });
  // circular app icon from the logo (also the notification icon)
  async function makeAppIcons(bmp) {
    const D = ST.design;
    const mk = (n) => { const c = document.createElement("canvas"); c.width = c.height = n; const x = c.getContext("2d"); x.beginPath(); x.arc(n / 2, n / 2, n / 2, 0, 7); x.closePath(); x.clip();
      if (bmp) { const k = Math.max(n / bmp.width, n / bmp.height), w = bmp.width * k, h = bmp.height * k; x.fillStyle = "#fff"; x.fillRect(0, 0, n, n); x.drawImage(bmp, (n - w) / 2, (n - h) / 2, w, h); }
      else { x.fillStyle = D.primary || "#d9232d"; x.fillRect(0, 0, n, n); x.fillStyle = "#fff"; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `800 ${Math.round(n * 0.42)}px system-ui,sans-serif`; x.fillText((D.logoText1 || D.logoText2 || "KO").slice(0, 3), n / 2, n / 2 + n * 0.02); }
      return new Promise((r) => c.toBlob(r, "image/png")); };
    D.appIcon192 = await uploadBlob(await mk(192)); D.appIcon512 = await uploadBlob(await mk(512));
    renderPreviews(); updateSetBar();
  }
  document.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-make-icons]") || !ST) return;
    try { toast("عم نعمل الأيقونة…"); let bmp = null; if (ST.design.logoImage) bmp = await decode(await (await fetch(ST.design.logoImage)).blob()); await makeAppIcons(bmp); toast("انعملت أيقونة التطبيق ✓ كبس حفظ"); } catch (err) { toast(err.message || "تعذّر عمل الأيقونة"); }
  });

  // ---------- currency: live rate status ----------
  let fxInfo = null;
  async function fxStatus(force) {
    const el = $("[data-fx-status]"); if (!el || !ST) return;
    try { fxInfo = force ? await api("/api/rate", { method: "POST" }) : fxInfo || (await (await fetch("/api/rate")).json()); } catch (e) { el.innerHTML = `<b style="color:#b42318">تعذّر جلب السعر: ${esc(e.message || "")}</b>`; return; }
    const f = ST.fx || {}, margin = f.margin === "" || f.margin == null ? 2 : +f.margin, manual = +f.manual > 0 ? +f.manual : 0;
    const rate = manual || (fxInfo.sell > 0 ? fxInfo.sell + margin : 0);
    const when = fxInfo.at ? new Date(fxInfo.at).toLocaleString("ar-SY", { dateStyle: "medium", timeStyle: "short" }) : "—";
    el.innerHTML = `<div class="fx-row"><span>سعر المبيع (sp-today.com)</span><b dir="ltr">${fxInfo.sell ? fxInfo.sell.toFixed(2) : "—"}</b></div>
      <div class="fx-row"><span>${manual ? "السعر اليدوي" : "+ الزيادة"}</span><b dir="ltr">${manual ? manual : (margin >= 0 ? "+" : "") + margin}</b></div>
      <div class="fx-row big"><span>السعر المستعمل</span><b dir="ltr">${rate ? rate.toFixed(2) : "—"} ل.س</b></div>
      ${rate ? `<div class="fx-row"><span>مثال: منتج بـ $10</span><b>${Math.round(10 * rate).toLocaleString("en-US")} ل.س جديدة</b></div>` : ""}
      <small class="hint">آخر تحديث: ${esc(when)}${fxInfo.err ? ` · <span style="color:#b42318">آخر محاولة فشلت: ${esc(fxInfo.err)}</span>` : ""}</small>`;
  }
  document.addEventListener("click", async (e) => { if (!e.target.closest("[data-fx-refresh]") || !ST) return; toast("عم جيب السعر…"); await fxStatus(true); toast("تحدّث ✓"); });
  document.addEventListener("click", (e) => { if (e.target.closest('[data-apnav="cur"]')) fxStatus(false); });
  document.addEventListener("input", (e) => { if (e.target.closest('[data-k^="fx."]') && fxInfo) fxStatus(false); });

  // ---------- products explorer (blur window) ----------
  function renderKx() {
    const el = $("[data-kx-icons]"); if (!el || !ST || !ST.design.kx) return;
    const DEF = ["🥊", "🏋️", "⚽", "🎒", "🏃", "🧤", "🎾", "🏊"], I = (ST.design.kx.gIcons = ST.design.kx.gIcons || {});
    el.innerHTML = (ST.design.groups || []).map((g, i) => `<div class="bn-row" style="grid-template-columns:70px 1fr"><input data-kx-ic="${esc(g.name)}" maxlength="4" value="${esc(I[g.name] || DEF[i % DEF.length])}" style="text-align:center;font-size:20px"><span style="align-self:center">${esc(g.name)}</span></div>`).join("");
  }
  document.addEventListener("input", (e) => { const t = e.target.closest("[data-kx-ic]"); if (!t || !ST) return; ST.design.kx.gIcons[t.dataset.kxIc] = t.value.trim(); renderPreviews(); updateSetBar(); });
  document.addEventListener("click", (e) => {
    if (!e.target.closest("[data-kx-prev]") || !ST) return;
    const fr = $("[data-dock-frame]"), vis = fr && getComputedStyle($("[data-dock]")).display !== "none" && document.body.classList.contains("dock-on");
    const send = (f) => { try { f.contentWindow.postMessage({ koKx: true }, location.origin); } catch {} };
    if (vis) { send(fr); return; }
    openThemePreview(null); const f2 = $("[data-th-frame]"); setTimeout(() => send(f2), 1200);
  });

  function renderSegs() {
    $$("[data-seg]").forEach((g) => { const v = String(getK(g.dataset.seg) ?? ""); g.querySelectorAll("[data-v]").forEach((b) => b.classList.toggle("on", b.dataset.v === v)); });
    if (ST && ST.design) {
      const peek = ST.design.sliderShape === "peek";
      $$("[data-peek-opts]").forEach((x) => (x.hidden = !peek)); $$("[data-fade-opts]").forEach((x) => (x.hidden = peek)); $$("[data-xf-opts]").forEach((x) => (x.hidden = peek || ST.design.sliderFx !== "xfade"));
      $$("[data-peek-side]").forEach((x) => (x.hidden = !["scale", "cover", "stack", "rise"].includes(ST.design.sliderCarFx || "scale")));
    }
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-seg] [data-v]"); if (!b || !ST) return;
    setK(b.closest("[data-seg]").dataset.seg, b.dataset.v); renderSegs(); renderPreviews(); updateSetBar();
    if (/^design\.(btnShape|cardStyle|layout\.)/.test(b.closest("[data-seg]").dataset.seg)) renderThemePreview();
    if (b.closest("[data-carriers-ed]")) { renderCarriers(); bindInputs(); renderSegs(); }
    if (/^home\.sections\.\d+\.(layout|auto|type|cFx)$/.test(b.closest("[data-seg]").dataset.seg)) { renderSections(); bindInputs(); renderSegs(); renderSecDlg(); }
  });
  function bindInputs() {
    $$("[data-k]").forEach((el) => {
      const v = getK(el.dataset.k);
      if (el.type === "checkbox") el.checked = el.hasAttribute("data-default-true") ? v !== false : !!v;
      else if (el.type === "range") el.value = v == null || v === "" ? el.getAttribute("value") || "" : v;
      else el.value = v ?? "";
    });
    $$(".w-range").forEach((r) => { const l = r.closest(".field") && r.closest(".field").querySelector(".w-val"); if (l) l.textContent = r.value + (r.dataset.suf || "%"); });
  }
  function renderSettings() {
    if (!ST) return;
    $$("[data-fonts]").forEach((el) => (el.innerHTML = FONTS.map((f) => `<option value="${f}">${f === "system" ? "خط الجهاز (الأسرع)" : f}</option>`).join("")));
    $$("[data-weights]").forEach((el) => (el.innerHTML = Object.entries(WEIGHTS).map(([k, v]) => `<option value="${k}">${v}</option>`).join("")));
    if (ST.design.announceOn == null) { ST.design.announceOn = !!ST.store.announcement; const o = JSON.parse(stSaved); o.design.announceOn = ST.design.announceOn; stSaved = JSON.stringify(o); }
    ST.design.slides = ST.design.slides || []; ST.home = ST.home || { sections: [] }; ST.checkout = ST.checkout || {};
    renderSlides(); renderSections(); renderLayoutEd(); renderBn(); renderGm(); renderTrust(); renderKx();
    bindInputs(); renderSegs();
    ST.shipping = ST.shipping && Array.isArray(ST.shipping.carriers) ? ST.shipping : { carriers: [] };
    renderTheme(); renderThemes();
    renderPreviews(); renderGroups(); renderCarriers(); renderHeavy(); renderPays(); renderCollections(); renderDiscounts(); renderPromos(); renderPages(); renderLegal(); renderGeneral(); renderDomain();
    sndHint();
    const sn = $("[data-store-name]"); if (sn && ST.store.name) sn.textContent = ST.store.name;
    updateSetBar();
  }
  function renderPreviews() {
    const d = ST.design;
    loadFont(d.headingFont);
    if (d.bodyFont && d.bodyFont !== "system") loadFont(d.bodyFont);
    const rv = $("[data-radius-val]"); if (rv) rv.textContent = (d.radius ?? 14) + "px";
    const fp = $("[data-font-preview]"); fp.style.fontFamily = fam(d.headingFont); fp.style.fontWeight = d.headingWeight || 700; fp.textContent = d.heroTitle || "عدّتك الرياضية كاملة";
    const bp = $("[data-body-preview]"); if (bp) { bp.style.fontFamily = fam(d.bodyFont); bp.style.fontWeight = d.bodyWeight || 400; }
    const fv = $("[data-fav-preview]"); if (fv) fv.style.backgroundImage = `url('${d.favicon || "/favicon.svg"}')`;
    const aip = $("[data-app-icon-prev]"); if (aip) aip.style.backgroundImage = d.appIcon192 ? `url('${d.appIcon192}')` : "";
    const lp = $("[data-logo-preview]"); lp.style.background = d.dark;
    lp.innerHTML = `<span class="logo" style="font-family:'${esc(d.headingFont)}'">${d.logoImage ? `<img src="${esc(d.logoImage)}" alt="">` : `${d.logoText1 ? `<span class="logo-ko" style="background:${esc(d.primary)}">${esc(d.logoText1)}</span>` : ""}<span class="logo-sport">${esc(d.logoText2)}</span>`}</span>`;
    const hp = $("[data-hero-preview]");
    hp.style.backgroundImage = d.heroImage ? `url('${d.heroImage}')` : ""; hp.style.backgroundColor = d.heroImage ? "" : d.dark;
    hp.style.color = "#fff"; hp.textContent = d.heroImage ? "" : "بدون صورة خلفية (لون غامق مع KO)";
    const si = ST.store.shareImage || "", sp = $("[data-share-preview]");
    if (sp) {
      sp.style.backgroundImage = si ? `url('${si}')` : ""; sp.textContent = si ? "" : "ما في صورة";
      $("[data-copy-share]").hidden = !/^https?:\/\//.test(si);
    }
  }
  // generic inputs
  document.addEventListener("input", (e) => {
    const el = e.target.closest("[data-k]"); if (!el || !ST) return;
    let v = el.type === "checkbox" ? el.checked : el.value;
    if (el.hasAttribute("data-num")) v = Math.max(0, parseFloat(v) || 0);
    if (el.hasAttribute("data-numopt")) v = el.value === "" ? "" : Math.max(0, parseFloat(el.value) || 0);
    setK(el.dataset.k, v);
    if (el.dataset.k.startsWith("design.")) renderPreviews();
    if (el.dataset.k === "design.radius" || el.dataset.k.endsWith("Font")) renderThemePreview();
    updateSetBar();
  });
  // image upload / clear for logo + hero
  document.addEventListener("change", async (e) => {
    const inp = e.target.closest("[data-upload]"); if (!inp || !inp.files[0]) return;
    try {
      toast("جاري رفع الصورة…");
      const path = inp.dataset.upload, file = inp.files[0];
      const hero = path === "design.heroImage" || path === "store.shareImage";
      const isLogo = path === "design.logoImage", isFav = path === "design.favicon";
      const mobile = /imgMobile$/.test(path), wide = /\.img$/.test(path), isQr = /\.qr$/.test(path);
      if (isFav && file.size > 1024 * 1024) throw new Error("الأيقونة لازم تكون أقل من 1 ميغا");
      if (isLogo) { try { const bm = await decode(file); ST.design.logoRatio = Math.round((bm.width / bm.height) * 1000) / 1000; } catch {} }
      let blob;
      if (isFav) { const bm = await decode(file); if (Math.min(bm.width, bm.height) < 32) throw new Error("الأيقونة لازم تكون 32×32 عالأقل"); blob = await new Promise((r) => square(bm, 64).toBlob(r, "image/png")); }
      else if (isQr) { const bm = await decode(file); const k = Math.min(1, 700 / Math.max(bm.width, bm.height)); const cv = document.createElement("canvas"); cv.width = Math.round(bm.width * k); cv.height = Math.round(bm.height * k); const cx = cv.getContext("2d"); cx.imageSmoothingEnabled = false; cx.drawImage(bm, 0, 0, cv.width, cv.height); blob = await new Promise((r) => cv.toBlob(r, "image/png")); }
      else if (wide) blob = await compress(file, 1600, 180);
      else if (mobile) blob = await compress(file, 1200, 170);
      else blob = await compress(file, hero ? 1600 : isLogo ? 240 : 500, hero ? 130 : isLogo ? 12 : 30);
      const url = await uploadBlob(blob);
      if (isLogo) { try { await makeAppIcons(await decode(file)); } catch {} }
      setK(path, url); renderPreviews(); if (/slides|sections/.test(path)) { renderSlides(); renderSections(); renderSecDlg(); bindInputs(); renderSegs(); } if (/^payments/.test(path)) renderPays(); updateSetBar(); toast("انرفعت. لا تنسى تكبس حفظ ونشر");
    } catch (err) { toast(err.message); }
    inp.value = "";
  });
  document.addEventListener("click", (e) => {
    const c = e.target.closest("[data-clear]"); if (!c || !ST) return;
    setK(c.dataset.clear, ""); renderPreviews(); if (/slides|sections/.test(c.dataset.clear)) { renderSlides(); renderSections(); renderSecDlg(); bindInputs(); renderSegs(); } if (/^payments/.test(c.dataset.clear)) renderPays(); updateSetBar();
  });

  $("[data-copy-share]").onclick = async () => {
    try {
      toast("عم ننقل الصورة…");
      const j = await api("/api/images/fetch", { method: "POST", body: JSON.stringify({ url: ST.store.shareImage }) });
      ST.store.shareImage = j.url; renderPreviews();
      await api("/api/settings", { method: "PUT", body: JSON.stringify(ST) }); stSaved = JSON.stringify(ST); updateSetBar();
      toast("انتقلت الصورة وانحفظت ✓");
    } catch (err) { toast(err.message); }
  };

  // ----- slider editor -----
  const imgPick = (path, val, mobile) => `<div class="img-pick"><span class="pv${mobile ? " m" : ""}" style="background-image:url('${esc(val || "")}')"></span>
    <label class="btn btn-ghost sm">${val ? "تغيير" : "أضف صورة"}<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" data-upload="${path}" hidden></label>
    ${val ? `<button class="btn btn-ghost sm" data-clear="${path}">إزالة</button>` : ""}</div>`;
  const moveBtns = (i, n, kind) => `<button type="button" class="mini" data-${kind}-move="-1" data-i="${i}" ${i ? "" : "disabled"}>↑</button><button type="button" class="mini" data-${kind}-move="1" data-i="${i}" ${i < n - 1 ? "" : "disabled"}>↓</button><button type="button" class="mini del" data-${kind}-del data-i="${i}">✕</button>`;
  function renderSlides() {
    const L = ST.design.slides, box = $("[data-slides]"); if (!box) return;
    const open = new Set([...box.querySelectorAll("details[open]")].map((d) => d.dataset.i));
    box.innerHTML = L.map((sl, i) => { const p = `design.slides.${i}`; return `<details class="slide-card" data-i="${i}" ${open.has(String(i)) ? "open" : ""}>
      <summary><span class="s-thumb" style="background-image:url('${esc(sl.img || "")}')"></span><span class="s-name">شريحة رقم ${i + 1}${sl.title ? " — " + esc(sl.title) : ""}</span>${moveBtns(i, L.length, "sl")}</summary>
      <div class="slide-body">
        <div class="field"><label>صورة تناسب الكمبيوتر (1600×500)</label>${imgPick(p + ".img", sl.img)}</div>
        <div class="field"><label>صورة تناسب الهاتف (800×1200 — أبعاد 2/3، اختياري)</label>${imgPick(p + ".imgMobile", sl.imgMobile, true)}</div>
        <div class="row2"><div class="field"><label>لون النص</label><input type="color" data-k="${p}.color"></div>
          <div class="field"><label>محاذاة النص</label><div class="seg" data-seg="${p}.align"><button type="button" data-v="start">يمين</button><button type="button" data-v="center">وسط</button><button type="button" data-v="end">يسار</button></div></div></div>
        <div class="field"><label>العنوان الرئيسي (الحد الأقصى 160 حرف)</label><input data-k="${p}.title" maxlength="160"></div>
        <div class="field"><label>العنوان الفرعي (الحد الأقصى 160 حرف)</label><input data-k="${p}.subtitle" maxlength="160"></div>
        <div class="field"><label>المقاس (14–30 بكسل)</label><input type="number" min="14" max="30" data-k="${p}.size" data-num dir="ltr" style="max-width:120px"></div>
        <div class="row2"><div class="field"><label>زر 1 — النص</label><input data-k="${p}.btn1.text" maxlength="30" placeholder="تسوّق الآن"></div><div class="field"><label>زر 1 — الرابط</label><input data-k="${p}.btn1.link" dir="ltr" placeholder="#/all"></div></div>
        <div class="row2"><div class="field"><label>زر 2 — النص</label><input data-k="${p}.btn2.text" maxlength="30"></div><div class="field"><label>زر 2 — الرابط</label><input data-k="${p}.btn2.link" dir="ltr" placeholder="#/c/قفازات ملاكمة"></div></div>
      </div></details>`; }).join("") || `<div class="hint">ما في شرائح لهلق.</div>`;
  }
  $("[data-add-slide]").onclick = () => {
    ST.design.slides.push({ img: "", imgMobile: "", title: "", subtitle: "", color: "#ffffff", align: "center", size: 18, btn1: { text: "تسوّق الآن", link: "#/all" }, btn2: { text: "", link: "" } });
    renderSlides(); bindInputs(); renderSegs(); updateSetBar();
    const all = $$("[data-slides] details"); all[all.length - 1].open = true;
  };
  // ----- home sections editor -----
  const LIST_SECS = ["new", "best", "products", "groups"];
  const segBtns = (o) => o.map(([v, t]) => `<button type="button" data-v="${v}">${t}</button>`).join("");
  const listOpts = (p, sec) => `<div class="list-opts">
      <div class="field"><label>طريقة العرض</label><div class="seg" data-seg="${p}.layout">${segBtns([["row", "↔ سلايد جانبي"], ["grid", "▦ شبكة"]])}</div></div>
      <div class="field"><label>📱 كم منتج بالسطر عالموبايل</label><div class="seg" data-seg="${p}.perMob">${segBtns([["", "تلقائي"], ["1", "1"], ["2", "2"], ["3", "3"], ["4", "4"]])}</div></div>
      <div class="field"><label>💻 كم منتج بالسطر عالكمبيوتر</label><div class="seg" data-seg="${p}.perDesk">${segBtns([["", "تلقائي"], ["2", "2"], ["3", "3"], ["4", "4"], ["5", "5"], ["6", "6"]])}</div></div>
      ${sec.layout === "grid" ? "" : `<div class="field"><label>الحركة الجانبية</label><div class="seg" data-seg="${p}.auto">${segBtns([["on", "▶ بيتحرك لحاله"], ["off", "⏸ ثابت"]])}</div></div>
      ${sec.auto === "off" ? "" : `<div class="field"><label>بيتحرك كل</label><div class="seg" data-seg="${p}.speed">${segBtns([["3", "3 ثواني"], ["4", "4 ثواني"], ["6", "6 ثواني"], ["8", "8 ثواني"]])}</div></div>`}`}
    </div>`;
  // defaults for the product-list options (applied on load, so they don't count as unsaved changes)
  function normSections() {
    for (const sec of ST.home.sections || []) if (LIST_SECS.includes(sec.type)) {
      sec.layout = sec.layout || "row"; if (sec.auto == null) sec.auto = "on"; if (sec.speed == null) sec.speed = "4";
      if (sec.perMob == null) sec.perMob = ""; if (sec.perDesk == null) sec.perDesk = "";
    }
  }
  // what the owner asked for: right under the slider → new products, then best sellers (both sliding sideways)
  function homeOrderV2() {
    if (ST.home.order2) return false;
    const L = ST.home.sections, pick = (t) => L.find((x) => x.type === t);
    const sl = pick("slider"), nw = pick("new"), bs = pick("best");
    const rest = L.filter((x) => x !== sl && x !== nw && x !== bs);
    ST.home.sections = [sl, nw, bs, ...rest].filter(Boolean);
    for (const x of [nw, bs]) if (x) { x.on = true; x.layout = "row"; x.auto = "on"; }
    ST.home.order2 = true;
    return true;
  }
  // ---------- home sections: Wuilt-style list + edit window ----------
  const SEC_TITLES = { categories: "قسم المجموعات", new: "قسم المنتجات", best: "قسم المنتجات", products: "قسم المنتجات", groups: "صفوف المجموعات", banner: "قسم اللافتات", video: "قسم الفيديوهات", features: "قسم خصائص المنتجات", text: "قسم النص", ticker: "الشريط الترويجي", code: "قسم الأكواد البرمجية", slider: "الشريحة الرئيسية" };
  const SV = (d) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="${d}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const SEC_IC = { categories: SV("M4 7h16v13H4zM8 7V4h8v3M9 12h6"), new: SV("M20 12 12 20 3 11V3h8zM7.5 7.5h.01"), best: SV("M20 12 12 20 3 11V3h8zM7.5 7.5h.01"), products: SV("M20 12 12 20 3 11V3h8zM7.5 7.5h.01"),
    groups: SV("M4 6h16M4 12h16M4 18h16"), banner: SV("M4 5h16v14H4zM8 9h8M8 13h5"), video: SV("M4 5h16v14H4zM10 9l5 3-5 3z"), features: SV("M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"),
    text: SV("M5 6h14M12 6v13"), ticker: SV("M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12"), code: SV("m8 8-4 4 4 4M16 8l4 4-4 4M14 5l-4 14"), slider: SV("M3 6h18v12H3zM8 21h8") };
  const TRASH = SV("M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6");
  const ar = (n) => Number(n || 0).toLocaleString("ar-SY");
  function secSummary(sec) {
    const shape = sec.layout === "grid" ? "كشبكة" : "كشريط", wide = sec.full ? "بعرض الشاشة - " : "";
    switch (sec.type) {
      case "new": return `${ar(sec.count || 15)} منتج من منتجات جديدة يظهر ${wide}${shape}`;
      case "best": return `${ar(sec.count || 20)} منتج من المنتجات الأكثر مبيعاً يظهر ${wide}${shape}`;
      case "products": return `${ar(sec.count || 12)} منتج من ${sec.cat ? "«" + esc(sec.cat) + "»" : "كل المجموعات"} يظهر ${wide}${shape}`;
      case "categories": return `${ar((sec.cats && sec.cats.length) || allCats().length)} مجموعة يظهر ${wide}${sec.layout ? shape : "حسب القالب"}`;
      case "groups": return `${ar((ST.design.groups || []).length)} صف — كل مجموعة يظهر ${shape}`;
      case "slider": return `${ar((ST.design.slides || []).length)} شريحة`;
      case "features": return `${ar((sec.items || []).length)} خاصية`;
      case "banner": return sec.img ? "صورة" + (sec.link ? " مع رابط" : "") : "بدون صورة لهلق";
      case "video": { const n = (sec.videos || []).filter(Boolean).length || (sec.url ? 1 : 0); return n ? `${ar(n)} فيديو${sec.autoplay === false ? "" : " · تشغيل تلقائي"}` : "بدون رابط لهلق"; }
      case "code": return sec.code ? `${ar(String(sec.code).length)} حرف` : "فاضي";
      default: return sec.body ? esc(String(sec.body).slice(0, 60)) : "نص";
    }
  }
  function renderSections() {
    const L = ST.home.sections, box = $("[data-sections]"); if (!box) return;
    box.innerHTML = L.map((sec, i) => `<div class="ws-item${sec.on === false ? " off" : ""}" draggable="true" data-si="${i}">
        <span class="ws-drag" title="اسحب لترتيب الأقسام">⋮⋮</span><span class="ws-ic">${SEC_IC[sec.type] || SEC_IC.text}</span>
        <div class="ws-txt"><b>${esc(sec.title || SEC_NAMES[sec.type] || sec.type)}</b><small>${secSummary(sec)}</small></div>
        <span class="ws-arrows"><button type="button" data-sec-move="-1" data-i="${i}" ${i ? "" : "disabled"} aria-label="لفوق">↑</button><button type="button" data-sec-move="1" data-i="${i}" ${i < L.length - 1 ? "" : "disabled"} aria-label="لتحت">↓</button></span>
        <label class="switch" title="إظهار / إخفاء"><input type="checkbox" data-k="home.sections.${i}.on" data-default-true><span></span></label>
        <span class="ws-btns"><button type="button" class="ws-del" data-sec-del data-i="${i}" aria-label="حذف">${TRASH}</button><button type="button" class="ws-edit" data-sec-edit="${i}">تعديل</button></span></div>`).join("")
      || `<p class="hint">ما في أقسام. ضيف قسم من تحت.</p>`;
  }
  // edit window
  let secIdx = null, secSnap = null, secIsNew = false;
  const sw = (k, label, hint, defTrue) => `<div class="w-sw"><label class="switch"><input type="checkbox" data-k="${k}"${defTrue ? " data-default-true" : ""}><span></span> ${label}</label>${hint ? `<small class="hint">${hint}</small>` : ""}</div>`;
  const layTiles = (p, spotOk) => `<div class="lay-tiles ${spotOk ? "four" : "three"}" data-seg="${p}.layout">
      <button type="button" data-v="grid"><span class="lt-grid"><i></i><i></i><i></i><em></em><em></em></span><small>شبكة</small></button>
      <button type="button" data-v="row"><span class="lt-row"><b>‹</b><i></i><i></i><i></i><b>›</b><u></u></span><small>شريط جانبي</small></button>
      <button type="button" data-v="car"><span class="lt-car"><i></i><i></i><i></i></span><small>بالنص مع الجوانب</small></button>
      ${spotOk ? `<button type="button" data-v="spot"><span class="lt-spot"><i></i><u></u></span><small>واحد بالنص (تلاشي)</small></button>` : ""}</div>`;
  // centred carousel: effects + shapes as little pictures
  const CAR_FX_OPTS = [["scale", "تكبير الوسط"], ["fade", "تلاشي الجوانب"], ["cover", "ثلاثي الأبعاد"], ["stack", "مكدّس"], ["rise", "رفع الوسط"], ["flat", "بدون مؤثّر"]];
  const CAR_SH_OPTS = [["theme", "حسب الثيم"], ["round", "دائري ناعم"], ["sharp", "زوايا حادة"], ["float", "عائم بظل"], ["frame", "إطار للوسط"], ["clean", "بدون إطار"]];
  const fxTiles = (k) => `<div class="fx-tiles" data-seg="${k}">${CAR_FX_OPTS.map(([v, l]) => `<button type="button" data-v="${v}"><span class="fxi fxi-${v}"><i></i><i></i><i></i></span><small>${l}</small></button>`).join("")}</div>`;
  const shTiles = (k) => `<div class="fx-tiles" data-seg="${k}">${CAR_SH_OPTS.map(([v, l]) => `<button type="button" data-v="${v}"><span class="shi shi-${v}"><i></i></span><small>${l}</small></button>`).join("")}</div>`;
  function carOpts(p, sec, one) {
    if (!sec.cFx) sec.cFx = "scale"; if (!sec.cShape) sec.cShape = "theme";
    const sideOk = ["scale", "cover", "stack", "rise"].includes(sec.cFx);
    return `<div class="field"><label>حجم ${one} يلي بالنص <b class="w-val">${+sec.cSize || 72}%</b></label><input type="range" min="40" max="100" step="2" data-k="${p}.cSize" data-num class="w-range" value="72"><small class="hint">كبّر أو صغّر. كل ما صغّرته بيبيّن أكتر من يلي قبله ويلي بعده.</small></div>
      <div class="w-two"><div class="field"><label>المسافة بينه وبين يلي قبله وبعده (بكسل)</label>${stepper(p + ".cGap", 0, 60, "14", 14, 2)}</div>
      ${sideOk ? `<div class="field"><label>حجم يلي عالجوانب <b class="w-val">${+sec.cSide || 86}%</b></label><input type="range" min="50" max="100" step="2" data-k="${p}.cSide" data-num class="w-range" value="86"></div>` : ""}</div>
      <div class="field"><label>مؤثّر الحركة</label>${fxTiles(p + ".cFx")}</div>
      <div class="field"><label>شكل ${one}</label>${shTiles(p + ".cShape")}</div>
      <div class="w-two">${sw(p + ".cLoop", "دوران لا نهائي", "بعد آخر واحد بيكمّل عأول واحد، ودايماً في شي قبله وشي بعده", true)}${sw(p + ".cDots", "النقاط تحت", "بتبيّن للزائر وين صار", true)}</div>`;
  }
  function catThumb(c) { const p = products.find((x) => (x.category === c || (x.also || []).includes(c)) && (x.thumb || x.image)); return p ? p.thumb || p.image : NOIMG; }
  // Wuilt-style field helpers
  const stepper = (k, min, max, ph, opt, step) => `<div class="w-step"><button type="button" data-stp="${step || 1}" aria-label="زيادة">+</button><input type="number" data-k="${k}" ${opt ? `data-numopt data-base="${opt === true ? 28 : opt}"` : "data-num"} min="${min}" max="${max}" dir="ltr" placeholder="${ph || ""}"><button type="button" data-stp="-${step || 1}" aria-label="إنقاص">−</button></div>`;
  const colorField = (p, val, off) => `<div class="w-color${off ? " off" : ""}"><input type="color" data-colk="${p}" value="${esc(/^#[0-9a-f]{6}$/i.test(val || "") ? val : "#ffffff")}" ${off ? "disabled" : ""}><input data-colk="${p}" value="${esc(val || "")}" dir="ltr" maxlength="7" placeholder="#FFFFFF" ${off ? "disabled" : ""}></div>`;
  const bgRow = (p, sec, label) => `<div class="w-two">${sw(p + ".noBg", "حذف الخلفية", label || "قم بتعطيل أو تنشيط إضافة خلفية للمنتج")}${colorField(p + ".bg", sec.bg, sec.noBg)}</div>`;
  const PH = { categories: "مثل. مجموعاتنا المميزة لك", new: "مثل. وصل حديثاً", best: "مثل. أكثر منتجاتنا مبيعًا", products: "مثل. أكثر منتجاتنا مبيعًا", video: "مثل. فيديوهات من عملائنا", banner: "مثل. عروض الموسم", features: "مثل. ليش تشتري منا؟", text: "مثل. عن متجرنا", code: "", groups: "" };
  const NEED_TITLE = ["categories", "new", "best", "products", "video", "features"];
  const chosenCats = (sec) => { const all = allCats(); return sec.pick || (sec.cats && sec.cats.length) ? (sec.cats || []).filter((c) => all.includes(c)) : all.slice(); };
  const vidKind = (u) => (window.KOMedia && String(u || "").trim() ? KOMedia.kindName(u) : "");
  function secEditor(i) {
    const sec = ST.home.sections[i], p = `home.sections.${i}`, t = sec.type;
    const isProd = ["new", "best", "products"].includes(t);
    let h = "";
    if (t !== "slider" && t !== "groups") h += `<div class="field"><label>العنوان الرئيسي</label><input data-k="${p}.title" maxlength="160" placeholder="${PH[t] || ""}" class="${sec._err ? "bad" : ""}"><small class="hint">بحد أقصى 160 حرف</small>${sec._err ? `<small class="w-err">العنوان الرئيسي مطلوب!</small>` : ""}</div>` + sw(p + ".showTitle", "أظهر العنوان الرئيسي", "", true);
    if (isProd || ["categories", "groups", "video", "banner", "features"].includes(t)) {
      const what = { categories: "المجموعات", video: "الفيديوهات", banner: "اللافتات", features: "الخصائص" }[t] || "المنتجات";
      h += `<div class="w-two"><div class="field"><label>اختر طريقة ظهور القسم</label>${layTiles(p, t !== "groups")}</div>${sw(p + ".full", "تمديد القسم بعرض الصفحة", "اجعل القسم يظهر للعملاء بعرض الشاشة")}</div>`;
      if (sec.layout === "car") h += carOpts(p, sec, what === "المنتجات" ? "المنتج" : "العنصر");
      else if (sec.layout === "spot") h += `<div class="field"><label>حجم ${what === "المنتجات" ? "المنتج" : "العنصر"} <b class="w-val">${+sec.size || 70}%</b></label><input type="range" min="30" max="100" step="5" data-k="${p}.size" data-num class="w-range" value="${+sec.size || 70}"><small class="hint">عنصر واحد بالنص، بيتغيّر كل كم ثانية باختفاء وظهور من اليمين لليسار.</small></div>
        <div class="w-two"><div class="field"><label>التغيير التلقائي</label><div class="seg" data-seg="${p}.auto">${segBtns([["on", "▶ بيتغيّر لحاله"], ["off", "⏸ يدوي"]])}</div></div>
        ${sec.auto === "off" ? "" : `<div class="field"><label>بيتغيّر كل</label><div class="seg" data-seg="${p}.speed">${segBtns([["3", "3 ث"], ["4", "4 ث"], ["6", "6 ث"], ["8", "8 ث"]])}</div></div>`}</div>`;
      else h += `<div class="w-two"><div class="field"><label>عدد ${what} التي تريد إظهارها في كل صف</label>${stepper(p + ".perDesk", 0, 6, "تلقائي")}<small class="hint">على الكمبيوتر · 0 = تلقائي</small></div>
        <div class="field"><label>📱 على الموبايل</label>${stepper(p + ".perMob", 0, 4, "تلقائي")}<small class="hint">0 = تلقائي</small></div></div>`;
      if (t === "categories") {
        h += sw(p + ".showNames", "أظهر أسماء المجموعات", "اختر التعطيل لو كنت تريد إظهار الصور دون أسماء", true);
        h += `<hr class="w-hr"><h3 class="w-h3">شكل المجموعات وكلامها</h3>
          <div class="field"><label>شكل كل مجموعة</label><div class="seg" data-seg="${p}.tStyle">${segBtns([["classic", "مربع عادي"], ["circle", "دوائر"], ["overlay", "الاسم فوق الصورة"], ["card", "بطاقة عريضة"], ["chip", "كبسولات صغيرة"], ["btn", "أزرار بلا صور"], ["luxe", "فخم أسود وذهبي"]])}</div></div>
          <div class="w-two"><div class="field"><label>حجم الاسم</label><div class="seg" data-seg="${p}.nameSize">${segBtns([["s", "صغير"], ["m", "عادي"], ["l", "كبير"]])}</div></div>
          ${sw(p + ".showCount", "أظهر عدد المنتجات", "", true)}</div>
          <div class="w-two"><div class="field"><label>الكلمة بعد العدد</label><input data-k="${p}.countText" maxlength="20" placeholder="منتج"></div>
          <div class="field"><label>زر تحت كل مجموعة (اختياري)</label><input data-k="${p}.btnText" maxlength="24" placeholder="مثلاً: تسوّق الآن"></div></div>`;
      }
      if (t !== "banner") h += bgRow(p, sec);
      if ((sec.layout === "row" && (isProd || t === "groups")) || sec.layout === "car") h += `<div class="w-two"><div class="field"><label>الحركة الجانبية</label><div class="seg" data-seg="${p}.auto">${segBtns([["on", "▶ بيتحرك لحاله"], ["off", "⏸ ثابت"]])}</div></div>
        ${sec.auto === "off" ? "" : `<div class="field"><label>بيتحرك كل</label><div class="seg" data-seg="${p}.speed">${segBtns([["3", "3 ث"], ["4", "4 ث"], ["6", "6 ث"], ["8", "8 ث"]])}</div></div>`}</div>`;
    }
    if (isProd) {
      const src = t === "products" ? "c:" + (sec.cat || "") : t;
      h += `<hr class="w-hr"><h3 class="w-h3">عرض المنتجات من</h3><div class="w-two"><div class="field"><label>اختر مجموعة</label><select data-src class="w-sel">
          <optgroup label="ترتيب جاهز"><option value="new" ${src === "new" ? "selected" : ""}>منتجات جديدة</option><option value="best" ${src === "best" ? "selected" : ""}>الأكثر مبيعاً</option><option value="c:" ${src === "c:" ? "selected" : ""}>جميع المنتجات</option></optgroup>
          <optgroup label="المجموعات">${allCats().map((c) => `<option value="c:${esc(c)}" ${src === "c:" + c ? "selected" : ""}>${esc(ST.design.catLabels?.[c] || c)}</option>`).join("")}</optgroup></select></div>
        <div class="field"><label>عدد المنتجات المعروضة</label>${stepper(p + ".count", 1, 60)}</div></div>`;
    }
    if (t === "categories") {
      const ch = chosenCats(sec), lab = (c) => ST.design.catLabels?.[c] || c;
      h += `<hr class="w-hr"><h3 class="w-h3">المجموعات التي سيتم عرضها</h3>` + (ch.length ? `<div class="wc-list">${ch.map((c, j) => `<div class="wc-item" draggable="true" data-cj="${j}"><span class="ws-drag">⋮⋮</span><img src="${esc(catThumb(c))}" alt="" loading="lazy"><b>${esc(lab(c))}</b><button type="button" class="ws-del" data-cat-rm="${j}" aria-label="شيل">${TRASH}</button></div>`).join("")}</div>`
        : `<div class="w-empty"><b>ⓘ لم تختر أي مجموعة بعد!</b><span>أضف مجموعات للقسم بالضغط على زر <b>أضف مجموعة</b> بالأسفل</span></div>`) +
        `<div class="wc-add"><button type="button" class="w-link" data-cat-pick>+ أضف مجموعة</button>${sec.pick || (sec.cats && sec.cats.length) ? `<button type="button" class="w-link muted" data-cat-all>إظهار كل المجموعات</button>` : ""}</div>`;
    }
    if (t === "groups") h += `<p class="hint">بيعرض صف لكل مجموعة من «المظهر ← القائمة الرئيسية للمتجر».</p>`;
    if (t === "video") {
      const vids = sec.videos || [];
      h += `<hr class="w-hr"><div class="w-rowhead"><h3 class="w-h3">روابط الفيديوهات</h3><span class="w-plat">أي رابط فيديو <i title="YouTube">▶</i><i title="Instagram">IG</i><i title="TikTok">TT</i><i title="Facebook">f</i><i title="Vimeo">V</i></span></div>` +
        (vids.length ? `<div class="wc-list">${vids.map((u, j) => `<div class="wc-item"><span class="vid-k">${vidKind(u) || "؟"}</span><input data-k="${p}.videos.${j}" dir="ltr" placeholder="الصق أي رابط فيديو هون…" class="vid-in"><label class="vid-up" title="ارفع فيديو من جهازك (لحد 24 ميغا)">⬆<input type="file" accept="video/*,.mp4,.webm,.mov" data-media-up="${p}.videos.${j}" hidden></label><button type="button" class="ws-del" data-vid-rm="${j}" aria-label="حذف">${TRASH}</button></div>`).join("")}</div>`
          : `<div class="w-empty"><b>ⓘ لم تضف أي فيديوهات!</b><span>الصق رابط أي فيديو (يوتيوب، إنستغرام، تيك توك، فيسبوك، Vimeo، رابط mp4…) أو ارفع فيديو من جهازك.</span></div>`) +
        `<div class="wc-add"><button type="button" class="w-link" data-vid-add>+ أضف فيديو</button></div>
        <div class="vid-opts"><hr class="w-hr">
          ${sw(p + ".autoplay", "تشغيل تلقائي أول ما يظهر الفيديو عالشاشة", "بيوقف لحاله لما الزائر يطلع منه، وبيكمّل لما يرجع.", true)}
          ${sw(p + ".sound", "مع الصوت", "المتصفح بيسمح بالصوت بعد أول لمسة من الزائر. قبلها بيشتغل بدون صوت وبيبيّن زر «اضغط للصوت».", true)}
          ${sw(p + ".loop", "كرّر الفيديو")}
          ${sw(p + ".controls", "أزرار التحكم (إيقاف، تقديم…)", "", true)}</div>`;
    }
    if (t === "banner") {
      const its = sec.items || [];
      h += `<hr class="w-hr"><h3 class="w-h3">اللافتات</h3>` + its.map((b, j) => `<div class="w-bn"><div class="w-bn-h"><b>لافتة ${j + 1}</b><button type="button" class="ws-del" data-bn-rm="${j}" aria-label="حذف">${TRASH}</button></div>
          <div class="w-two"><div class="field"><label>صورة تناسب الكمبيوتر (1600×500)</label>${imgPick(`${p}.items.${j}.img`, b.img)}</div><div class="field"><label>صورة تناسب الهاتف (اختياري)</label>${imgPick(`${p}.items.${j}.imgMobile`, b.imgMobile, true)}</div></div>
          <div class="field"><label>الرابط لما ينكبس</label><input data-k="${p}.items.${j}.link" dir="ltr" placeholder="#/c/قفازات ملاكمة"></div></div>`).join("") +
        (its.length ? "" : `<div class="w-empty"><b>ⓘ ما في لافتات</b><span>اكبس «أضف لافتة».</span></div>`) + `<div class="wc-add"><button type="button" class="w-link" data-bn-add>+ أضف لافتة</button></div>`;
    }
    if (t === "ticker") h += `<div class="field"><label>الرسائل (كل رسالة بسطر)</label><textarea data-k="${p}.lines" rows="5" maxlength="2000" placeholder="🔥 خصم 20% على القفازات | #/c/قفازات ملاكمة"></textarea><small class="hint">إذا بدك الرسالة تفتح صفحة لما ينكبس عليها، حط بعدها «|» والرابط. مثلاً: خصم على الأحزمة | #/c/أحزمة</small></div>
        <div class="field"><label>نوع الحركة</label><div class="seg" data-seg="${p}.mode">${segBtns([["marquee", "يضل يمشي"], ["flip", "رسالة ورا رسالة"], ["type", "كتابة آلية"]])}</div></div>
        ${(sec.mode || "marquee") === "marquee" ? `<div class="w-two"><div class="field"><label>الاتجاه</label><div class="seg" data-seg="${p}.dir">${segBtns([["rtl", "← لليسار"], ["ltr", "لليمين →"]])}</div></div><div class="field"><label>السرعة</label><div class="seg" data-seg="${p}.speed">${segBtns([["slow", "هادئ"], ["normal", "عادي"], ["fast", "سريع"]])}</div></div></div>`
          : `<div class="field"><label>كل رسالة بتضل</label><div class="seg" data-seg="${p}.every">${segBtns([["3", "3 ث"], ["4", "4 ث"], ["6", "6 ث"], ["8", "8 ث"]])}</div></div>`}
        <div class="field"><label>مؤثر الكتابة</label><div class="seg" data-seg="${p}.tfx">${segBtns([["none", "بدون"], ["shine", "لمعة"], ["neon", "نيون"], ["pulse", "نبض"], ["rainbow", "ألوان"]])}</div></div>
        <div class="field"><label>الخلفية</label><div class="seg" data-seg="${p}.bfx">${segBtns([["solid", "لون واحد"], ["gradient", "تدرّج متحرك"], ["stripes", "خطوط متحركة"]])}</div></div>
        <div class="w-two"><div class="field"><label>حجم الخط</label><div class="seg" data-seg="${p}.size">${segBtns([["s", "صغير"], ["m", "وسط"], ["l", "كبير"]])}</div></div><div class="field"><label>الفاصل بين الرسائل</label><input data-k="${p}.sep" maxlength="3" placeholder="✦"></div></div>
        ${bgRow(p, sec, "بدون لون خلفية خاص (بياخد لون المتجر)")}
        <div class="w-two"><div class="field"><label>لون الكتابة</label><div class="buy-row" style="margin:0"><input type="color" data-k="${p}.fg"></div></div><div class="field"><label>لون المؤثر والفاصل</label><div class="buy-row" style="margin:0"><input type="color" data-k="${p}.ac"></div></div></div>
        ${sw(p + ".full", "بعرض الشاشة كامل")}${sw(p + ".hover", "يوقف لما يمرر الزائر الماوس عليه", "", true)}`;
    if (t === "text") h += `<div class="field"><label>النص</label><textarea data-k="${p}.body" rows="6" maxlength="2000"></textarea></div>
        <div class="field"><label>محاذاة النص</label><div class="seg" data-seg="${p}.align">${segBtns([["start", "يمين"], ["center", "وسط"], ["end", "يسار"]])}</div></div>${bgRow(p, sec, "خلفية ملوّنة للقسم")}`;
    if (t === "code") h += `<div class="field"><label>الكود (HTML / CSS / JavaScript)</label><textarea data-k="${p}.code" rows="10" dir="ltr" style="font-family:monospace;font-size:13px" maxlength="30000" placeholder="<div>...</div>"></textarea>
        <small class="hint">بيشتغل جوّا صندوق معزول: ما بيقدر يأثر على المتجر أو لوحة التحكم.</small></div>`;
    if (t === "features") h += `<hr class="w-hr"><h3 class="w-h3">الخصائص</h3>` + (sec.items || []).map((it, j) => `<div class="feat-row"><input data-k="${p}.items.${j}.icon" maxlength="4" placeholder="🚚"><input data-k="${p}.items.${j}.title" placeholder="العنوان"><input data-k="${p}.items.${j}.text" placeholder="شرح قصير"><button type="button" class="mini del" data-feat-del="${i}:${j}">✕</button></div>`).join("") + `<div class="wc-add"><button type="button" class="w-link" data-feat-add="${i}">+ أضف خاصية</button></div>`;
    if (t === "slider") h += `<p class="hint">الشرائح بتتعدّل من «المظهر ← الشريحة الرئيسية».</p><button type="button" class="btn btn-ghost sm" data-sec-cancel data-ap-jump="slider">روح للشريحة الرئيسية</button>`;
    else h += `<hr class="w-hr"><div class="field"><label>المسافة فوق هالقسم (بكسل)</label>${stepper(p + ".gapTop", 0, 160, "تلقائي", true, 4)}<small class="hint">فاضي = حسب «المسافة بين الأقسام». 0 = لازق بالقسم يلي فوقه.</small></div>`;
    return h;
  }
  function renderSecDlg() {
    if (secIdx == null) return;
    const sec = ST.home.sections[secIdx];
    $("[data-sec-dlg-title]").textContent = (secIsNew ? "أضف " : "تعديل ") + (SEC_TITLES[sec.type] || "القسم");
    $("[data-sec-dlg-ic]").innerHTML = SEC_IC[sec.type] || SEC_IC.text;
    const body = $("[data-sec-body]"), y = body.scrollTop;
    body.innerHTML = secEditor(secIdx);
    bindInputs(); renderSegs(); body.scrollTop = y;
  }
  function openSec(i, isNew) {
    const s0 = ST.home.sections[i];
    if (!s0.speed) s0.speed = "4"; if (!s0.auto) s0.auto = "on";
    if (s0.type === "video" && !s0.videos) s0.videos = s0.url ? [s0.url] : [];
    if (s0.type === "banner" && !s0.items) s0.items = s0.img ? [{ img: s0.img, imgMobile: s0.imgMobile || "", link: s0.link || "" }] : [];
    delete s0._err;
    secIdx = i; secIsNew = !!isNew; secSnap = JSON.stringify(s0);
    setTimeout(() => pvGo({ r: "#/", at: `.hsec[data-si="${i}"]` }, true), isNew ? 600 : 0);
    renderSecDlg(); $("[data-sec-dlg]").showModal();
  }
  function closeSec(save) {
    const dlg = $("[data-sec-dlg]");
    if (save && secIdx != null) {
      const sec = ST.home.sections[secIdx];
      if (NEED_TITLE.includes(sec.type) && sec.showTitle !== false && !String(sec.title || "").trim()) { sec._err = true; renderSecDlg(); $("[data-sec-body]").scrollTop = 0; return; }
      if (sec.type === "categories" && sec.pick && !(sec.cats || []).length) { toast("أضف مجموعة وحدة عالأقل"); return; }
      delete sec._err;
      if (sec.type === "video") { sec.videos = (sec.videos || []).map((u) => String(u).trim()).filter(Boolean); sec.url = sec.videos[0] || ""; }
      if (sec.type === "banner") { sec.items = (sec.items || []).filter((x) => x.img); const f = sec.items[0] || {}; sec.img = f.img || ""; sec.imgMobile = f.imgMobile || ""; sec.link = f.link || ""; }
    }
    if (!save && secIdx != null) { if (secIsNew) ST.home.sections.splice(secIdx, 1); else ST.home.sections[secIdx] = JSON.parse(secSnap); }
    secIdx = null; if (dlg.open) dlg.close();
    renderSections(); bindInputs(); renderSegs(); updateSetBar();
    if (save && stDirty()) $("[data-set-save]").click();
  }
  const NEW_TITLES = { new: "منتجات جديدة", best: "الأكثر مبيعاً", products: "منتجات مختارة", categories: "جميع المجموعات", features: "ليش تشتري منا؟", groups: "", video: "", banner: "", text: "", code: "" };
  document.addEventListener("click", (e) => {
    if (!ST) return;
    const add = e.target.closest("[data-add-sec]");
    if (add) {
      const t = add.dataset.addSec;
      const sec = { id: "s" + Date.now().toString(36), type: t, on: true, title: "", showTitle: true, count: 6, layout: "grid", auto: "on", speed: "4", perMob: 0, perDesk: 0 };
      if (t === "categories") { sec.pick = true; sec.cats = []; sec.showNames = true; }
      if (t === "video") sec.videos = [];
      if (t === "banner") sec.items = [];
      if (t === "ticker") Object.assign(sec, { showTitle: false, lines: "🔥 خصومات لفترة محدودة | #/all\n🚚 توصيل لكل المحافظات\n💵 الدفع عند الاستلام", mode: "marquee", dir: "rtl", speed: "normal", tfx: "shine", bfx: "gradient", size: "m", sep: "✦", hover: true, full: true, every: "4" });
      if (t === "features") sec.items = [{ icon: "🚚", title: "توصيل لكل المحافظات", text: "" }, { icon: "💵", title: "الدفع عند الاستلام", text: "" }, { icon: "✅", title: "منتجات أصلية", text: "" }];
      ST.home.sections.push(sec); renderSections(); bindInputs(); renderSegs(); updateSetBar();
      openSec(ST.home.sections.length - 1, true); return;
    }
    const ed = e.target.closest("[data-sec-edit]"); if (ed) { openSec(+ed.dataset.secEdit); return; }
    if (e.target.closest("[data-sec-save]")) { closeSec(true); return; }
    const cancel = e.target.closest("[data-sec-cancel]");
    if (cancel) { closeSec(false); if (cancel.dataset.apJump) showAp(cancel.dataset.apJump); return; }
    if (secIdx == null) return;
    const sec = ST.home.sections[secIdx];
    const rm = e.target.closest("[data-cat-rm]");
    if (rm) { const cur = chosenCats(sec); cur.splice(+rm.dataset.catRm, 1); sec.cats = cur; sec.pick = true; renderSecDlg(); updateSetBar(); return; }
    if (e.target.closest("[data-cat-all]")) { sec.cats = []; sec.pick = false; renderSecDlg(); updateSetBar(); return; }
    if (e.target.closest("[data-cat-pick]")) { catPicker(sec); return; }
    if (e.target.closest("[data-vid-add]")) { (sec.videos ||= []).push(""); renderSecDlg(); const ins = $$("[data-sec-body] .vid-in"); ins[ins.length - 1].focus(); return; }
    const vr = e.target.closest("[data-vid-rm]"); if (vr) { sec.videos.splice(+vr.dataset.vidRm, 1); renderSecDlg(); updateSetBar(); return; }
    if (e.target.closest("[data-bn-add]")) { (sec.items ||= []).push({ img: "", imgMobile: "", link: "" }); renderSecDlg(); return; }
    const br = e.target.closest("[data-bn-rm]"); if (br) { sec.items.splice(+br.dataset.bnRm, 1); renderSecDlg(); updateSetBar(); }
  });
  // ticker: switching the motion type shows its own options
  document.addEventListener("click", (e) => { if (secIdx != null && e.target.closest("[data-sec-body] [data-seg$='.mode'] [data-v]")) setTimeout(renderSecDlg, 0); });
  // «اختر مجموعة» picker (search + checkboxes), opens above the section window
  function catPicker(sec) {
    const have = new Set(chosenCats(sec)), D = { q: "", pick: new Set() }, lab = (c) => ST.design.catLabels?.[c] || c;
    openX("اختر مجموعة", {
      draft: D, noPublish: true,
      render() {
        const q = normA(D.q), L = allCats().filter((c) => !have.has(c) && (!q || normA(c + " " + lab(c)).includes(q)));
        return `<input data-cp-q placeholder="🔍 بحث في المجموعة" value="${esc(D.q)}" class="dc-search"><div class="cp-list">${L.map((c) => `<label class="cp-row"><input type="checkbox" data-cp="${esc(c)}" ${D.pick.has(c) ? "checked" : ""}><b>${esc(lab(c))}</b><img src="${esc(catThumb(c))}" alt="" loading="lazy"></label>`).join("") || `<p class="hint">ما في مجموعات تانية.</p>`}</div>`;
      },
      onInput(e) { if (e.target.matches("[data-cp-q]")) { D.q = e.target.value; renderX(); const i = $("[data-cp-q]"); i.focus(); i.setSelectionRange(D.q.length, D.q.length); } },
      click(e) { const c = e.target.closest("[data-cp]"); if (c) { c.checked ? D.pick.add(c.dataset.cp) : D.pick.delete(c.dataset.cp); } },
      save() { if (!D.pick.size) return; sec.cats = [...chosenCats(sec), ...D.pick]; sec.pick = true; renderSecDlg(); updateSetBar(); },
    });
  }
  document.addEventListener("change", (e) => {
    if (secIdx == null || !e.target.matches("[data-src]")) return;
    const sec = ST.home.sections[secIdx], v = e.target.value;
    if (v.startsWith("c:")) { sec.type = "products"; sec.cat = v.slice(2); } else { sec.type = v; delete sec.cat; }
    renderSecDlg(); updateSetBar();
  });
  document.addEventListener("input", (e) => { if (e.target.matches && e.target.matches(".w-range")) { const v = e.target.closest(".field").querySelector(".w-val"); if (v) v.textContent = e.target.value + (e.target.dataset.suf || "%"); } });
  // number steppers and colour fields
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-stp]"); if (!b) return;
    const inp = b.parentElement.querySelector("input"), mn = +inp.min, mx = +inp.max;
    const base = inp.value === "" ? +inp.dataset.base || +inp.placeholder || 0 : +inp.value;
    inp.value = Math.max(mn, Math.min(mx, base + +b.dataset.stp));
    inp.dispatchEvent(new Event("input", { bubbles: true }));
  });
  document.addEventListener("input", (e) => {
    const el = e.target.closest("[data-colk]"); if (!el || !ST) return;
    const v = el.value.trim();
    if (v && !/^#[0-9a-f]{6}$/i.test(v)) return;
    setK(el.dataset.colk, v);
    el.parentElement.querySelectorAll("[data-colk]").forEach((x) => { if (x !== el) x.value = x.type === "color" ? v || "#ffffff" : v; });
    updateSetBar();
  });
  document.addEventListener("change", (e) => { if (secIdx != null && e.target.matches('[data-k$=".noBg"]')) renderSecDlg(); });
  document.addEventListener("input", (e) => {
    if (secIdx == null || !e.target.matches || !e.target.matches('[data-sec-body] [data-k$=".title"]')) return;
    const sec = ST.home.sections[secIdx];
    if (sec._err && e.target.value.trim()) { delete sec._err; e.target.classList.remove("bad"); const er = e.target.parentElement.querySelector(".w-err"); if (er) er.remove(); }
  });
  document.addEventListener("input", (e) => { if (e.target.matches && e.target.matches(".vid-in")) { const k = e.target.previousElementSibling; if (k) k.textContent = vidKind(e.target.value) || "؟"; } });
  $("[data-sec-dlg]").addEventListener("cancel", (e) => { e.preventDefault(); closeSec(false); });
  // drag & drop: sections list and the collections list inside the edit window
  let drag = null;
  document.addEventListener("dragstart", (e) => {
    const it = e.target.closest && e.target.closest("[data-si],[data-cj]"); if (!it) return;
    drag = { kind: it.hasAttribute("data-si") ? "si" : "cj", i: +(it.dataset.si ?? it.dataset.cj) };
    e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", "x"); } catch {}
    it.classList.add("dragging");
  });
  document.addEventListener("dragover", (e) => {
    if (!drag) return; const it = e.target.closest && e.target.closest(`[data-${drag.kind}]`); if (!it) return;
    e.preventDefault(); $$(".drag-over").forEach((x) => x.classList.remove("drag-over")); it.classList.add("drag-over");
  });
  document.addEventListener("drop", (e) => {
    if (!drag) return; const it = e.target.closest && e.target.closest(`[data-${drag.kind}]`); if (!it) return;
    e.preventDefault();
    const to = +it.dataset[drag.kind === "si" ? "si" : "cj"], from = drag.i;
    if (to !== from) {
      if (drag.kind === "si") { const L = ST.home.sections; L.splice(to, 0, L.splice(from, 1)[0]); renderSections(); bindInputs(); }
      else { const sec = ST.home.sections[secIdx], all = allCats(); const cur = sec.cats && sec.cats.length ? sec.cats.filter((c) => all.includes(c)) : all.slice(); cur.splice(to, 0, cur.splice(from, 1)[0]); sec.cats = cur; renderSecDlg(); }
      updateSetBar();
    }
  });
  document.addEventListener("dragend", () => { drag = null; $$(".dragging,.drag-over").forEach((x) => x.classList.remove("dragging", "drag-over")); });
  document.addEventListener("click", (e) => {
    if (!ST) return;
    const t = e.target.closest("[data-sl-move],[data-sl-del],[data-sec-move],[data-sec-del],[data-feat-add],[data-feat-del]"); if (!t) return;
    e.preventDefault();
    const i = +t.dataset.i;
    const swap = (L, a, b) => { [L[a], L[b]] = [L[b], L[a]]; };
    if (t.matches("[data-sl-move]")) swap(ST.design.slides, i, i + +t.dataset.slMove);
    else if (t.matches("[data-sl-del]")) { if (!confirm("حذف الشريحة؟")) return; ST.design.slides.splice(i, 1); }
    else if (t.matches("[data-sec-move]")) swap(ST.home.sections, i, i + +t.dataset.secMove);
    else if (t.matches("[data-sec-del]")) { if (!confirm("حذف القسم من الصفحة الرئيسية؟")) return; ST.home.sections.splice(i, 1); }
    else if (t.matches("[data-feat-add]")) { const sec = ST.home.sections[+t.dataset.featAdd]; (sec.items = sec.items || []).push({ icon: "⭐", title: "", text: "" }); }
    else if (t.matches("[data-feat-del]")) { const [a, b] = t.dataset.featDel.split(":").map(Number); ST.home.sections[a].items.splice(b, 1); }
    renderSlides(); renderSections(); bindInputs(); renderSegs(); updateSetBar(); renderSecDlg();
  });
  // keep the on/off look of section cards in sync
  document.addEventListener("change", (e) => { const c = e.target.closest(".ws-item"); if (c && e.target.matches('[data-k$=".on"]')) c.classList.toggle("off", !e.target.checked); });

  // groups editor
  // ---------- import the collections exactly as they are on Wuilt (names, photos, which products, their order) ----------
  const WC_SMART = ["جميع المنتجات", "منتجات جديدة", "المنتجات الاكثر مبيعا", "المنتجات الأكثر مبيعا"];
  const wcNorm = (x) => bidi(x).toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/[^\p{L}\p{N}]+/gu, "");
  // one Wuilt product ↔ one of our products (twins with the same name/link are paired one by one)
  function wcMatcher() {
    const byFile = new Map(), byHandle = new Map(), byTitle = new Map(), push = (m, k, p) => { if (!k) return; if (!m.has(k)) m.set(k, []); if (!m.get(k).includes(p)) m.get(k).push(p); };
    for (const p of products) {
      for (const u of [p.originalImage, p.image, ...(p.images || [])]) if (u) push(byFile, fileOf(u), p);
      if (p.oldUrl) push(byHandle, wcNorm(slugOf(p.oldUrl)), p);
      push(byTitle, wcNorm(p.name), p); if (p.wuiltTitle) push(byTitle, wcNorm(p.wuiltTitle), p);
    }
    const taken = new Map(), used = new Set();
    return (w) => {
      const key = w.id || w.handle || w.title;
      if (taken.has(key)) return taken.get(key);
      const cands = [...(w.images || []).flatMap((u) => byFile.get(fileOf(u)) || []), ...(byHandle.get(wcNorm(slugOf(w.handle || ""))) || []), ...(byTitle.get(wcNorm(w.title || "")) || [])];
      const p = cands.find((x) => !used.has(x.id)) || null;
      if (p) used.add(p.id);
      taken.set(key, p); return p;
    };
  }
  async function wcLoad(D) {
    const call = (body) => api("/api/wuilt/collections", { method: "POST", body: JSON.stringify({ apiKey: D.key, storeId: D.sid, ...body }) });
    const cols = [];
    for (let off = 0; ; off += 50) {
      D.msg = `عم نقرأ المجموعات من Wuilt… ${cols.length}`; renderX();
      const r = await call({ op: "list", offset: off });
      cols.push(...r.collections); D.plan = r.plan;
      if (!r.collections.length || cols.length >= r.total) break;
    }
    // the products of each collection
    for (const [i, c] of cols.entries()) {
      const want = c.count != null ? +c.count : null;
      if (c.products && (want == null || c.products.length >= want)) continue;
      const list = [];
      for (let off = 0; ; off += 50) {
        D.msg = `عم نقرأ منتجات «${c.title}» (${i + 1}/${cols.length})… ${list.length}`; renderX();
        const r = await call({ op: "members", collectionId: c.id, offset: off });
        list.push(...(r.products || [])); if (!(r.products || []).length || list.length >= (r.total || 0)) break;
      }
      c.products = list; if (c.count == null) c.count = list.length;
    }
    const match = wcMatcher();
    const missing = new Map();
    for (const c of cols) {
      c.ids = [];
      for (const w of c.products || []) { const p = match(w); if (p) { if (!c.ids.includes(p.id)) c.ids.push(p.id); } else missing.set(w.handle || w.title, w.title); }
    }
    D.cols = cols; D.missing = [...missing.values()];
    D.inc = Object.fromEntries(cols.map((c) => [c.id, true]));
    D.step = "preview"; D.msg = "";
  }
  function wcPlan(D) {
    const inc = D.cols.filter((c) => D.inc[c.id]), names = new Set(inc.map((c) => c.title.trim()));
    const smart = (t) => WC_SMART.includes(t.trim());
    const of = new Map(); // product id → [collection titles in Wuilt order, specific ones first]
    for (const c of inc) for (const id of c.ids) { if (!of.has(id)) of.set(id, []); of.get(id).push(c.title.trim()); }
    const changes = [];
    for (const p of products) {
      let cs = of.get(p.id) || [];
      cs = [...cs.filter((t) => !smart(t)), ...cs.filter(smart)];
      let cat, also;
      if (cs.length) { cat = cs.includes(p.category) && !smart(p.category) ? p.category : cs[0]; also = cs.filter((t) => t !== cat); }
      else { cat = names.has(p.category) ? p.category : "منتجات أخرى"; also = (p.also || []).filter((t) => names.has(t)); }
      if (cat !== p.category || JSON.stringify(also) !== JSON.stringify(p.also || [])) changes.push({ p, cat, also });
    }
    const removed = allCats().filter((c) => !names.has(c) && c !== "منتجات أخرى");
    const orphans = products.filter((p) => !(of.get(p.id) || []).length).length;
    return { inc, changes, removed, orphans };
  }
  function wcRender(D) {
    if (D.step !== "preview") return `<p class="hint">بنقرأ المجموعات من Wuilt مباشرة: الاسم، الصورة، المنتجات يلي فيها وترتيبها، وبنطبّقها على منتجاتك متل ما هي بالزبط.</p>
      <div class="field"><label>Store ID</label><input data-wc-sid dir="ltr" value="${esc(D.sid)}" placeholder="Store_xxxxxxxxxxxxxxxx" autocomplete="off"></div>
      <div class="field"><label>API Key</label><input data-wc-key type="password" dir="ltr" value="${esc(D.key)}" autocomplete="off"></div>
      <button type="button" class="w-btn" data-wc-read ${D.busy ? "disabled" : ""}>اقرأ المجموعات من Wuilt</button>
      ${D.msg ? `<p class="hint" style="margin-top:10px">${esc(D.msg)}</p>` : ""}${D.err ? `<div class="wc-err"><b>⚠️ ${esc(D.err)}</b>${D.query ? `<code dir="ltr">${esc(D.query)}</code>` : ""}<small>انسخ هالرسالة وابعتلي ياها إذا ما زبطت.</small></div>` : ""}`;
    const P = wcPlan(D);
    return `<p class="hint">لقينا <b>${D.cols.length}</b> مجموعة على Wuilt. شيل الصح عن أي مجموعة ما بدك ياها. العدد الأخضر = نفس عدد Wuilt.</p>
      <div class="wc-list">${D.cols.map((c) => { const ok = c.count == null || c.ids.length === +c.count; return `<label class="wc-row"><input type="checkbox" data-wc-inc="${esc(c.id)}" ${D.inc[c.id] ? "checked" : ""}>${c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy">` : '<i class="wc-noimg">—</i>'}<b>${esc(c.title)}</b><span class="${ok ? "ok" : "bad"}">${c.ids.length}${c.count != null ? " / " + c.count : ""}</span></label>`; }).join("")}</div>
      <div class="wc-sum">
        <div>✏️ رح يتعدّل قسم <b>${P.changes.length}</b> منتج.</div>
        ${P.removed.length ? `<div>🗑 مجموعات عندك مو موجودة على Wuilt ورح تنشال: <b>${P.removed.map(esc).join("، ")}</b></div>` : "<div>✓ ما في مجموعات زيادة.</div>"}
        ${P.orphans ? `<div>📦 <b>${P.orphans}</b> منتج مو موجودين بأي مجموعة على Wuilt → بيروحوا على «منتجات أخرى».</div>` : ""}
        ${D.missing.length ? `<details><summary>⚠️ ${D.missing.length} منتج على Wuilt ما لقيناهم عندك</summary><small>${D.missing.slice(0, 80).map(esc).join(" · ")}</small></details>` : ""}
      </div>${D.msg ? `<p class="hint">${esc(D.msg)}</p>` : ""}`;
  }
  async function wcApply(D) {
    if (D.step !== "preview") return false;
    const P = wcPlan(D);
    if (!confirm(`نطبّق مجموعات Wuilt؟\n${P.inc.length} مجموعة، ${P.changes.length} منتج بيتعدّل قسمه${P.removed.length ? `، وبتنشال ${P.removed.length} مجموعة` : ""}.`)) return false;
    try {
      ST.design.catMeta = ST.design.catMeta || {};
      for (const [i, c] of P.inc.entries()) {
        const t = c.title.trim(), m = (ST.design.catMeta[t] = { ...(ST.design.catMeta[t] || {}) });
        m.order = c.ids.slice();
        if (c.image && !(m.wuiltImage === c.image && m.image)) {
          D.msg = `عم ننسخ صور المجموعات… ${i + 1}/${P.inc.length}`; renderX();
          try { const r = await api("/api/images/fetch", { method: "POST", body: JSON.stringify({ url: c.image }) }); m.image = r.url; m.wuiltImage = c.image; } catch {}
        }
      }
      for (const { p, cat, also } of P.changes) { p.category = cat; p.also = also; }
      for (const c of P.removed) { delete ST.design.catMeta[c]; if (ST.design.catLabels) delete ST.design.catLabels[c]; }
      (ST.design.groups || []).forEach((g) => (g.cats = g.cats.filter((x) => !P.removed.includes(x))));
      await api("/api/products", { method: "PUT", body: JSON.stringify(products) }); saved = JSON.stringify(products); dirty.clear();
      await api("/api/settings", { method: "PUT", body: JSON.stringify(ST) }); stSaved = JSON.stringify(ST);
      toast(`✓ صارت المجموعات متل Wuilt: ${P.inc.length} مجموعة`);
      renderCollections(); renderGroups(); updateSetBar();
      return true;
    } catch (e) { D.msg = e.message; renderX(); return false; }
  }
  document.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-wc-open]")) return;
    if (!ST) { toast("استنى ثانية لتتحمّل الإعدادات"); return; }
    if (!products.length) await loadProducts();
    if (JSON.stringify(products) !== saved) { toast("احفظ تغييرات المنتجات أول"); return; }
    // two products sharing one id can't be told apart (cart, links, collections) → give the twin its own id
    { const seen = new Set(); for (const p of products) { if (seen.has(p.id)) { let n = 2; while (seen.has(p.id + "-" + n)) n++; p.id = p.id + "-" + n; } seen.add(p.id); } }
    let sid = "", key = ""; try { sid = localStorage.getItem("ko_wsid") || ($("[data-w-store]") || {}).value || ""; key = ($("[data-w-key]") || {}).value || ""; } catch {}
    const D = { step: "form", sid, key, msg: "", err: "", cols: [], inc: {}, missing: [] };
    openX("⬇️ المجموعات من Wuilt", {
      draft: D, noPublish: true,
      render: () => wcRender(D),
      onInput(ev) { if (ev.target.matches("[data-wc-sid]")) D.sid = ev.target.value.trim(); if (ev.target.matches("[data-wc-key]")) D.key = ev.target.value.trim(); },
      async click(ev) {
        const inc = ev.target.closest("[data-wc-inc]"); if (inc) { D.inc[inc.dataset.wcInc] = inc.checked; renderX(); return; }
        if (ev.target.closest("[data-wc-read]")) {
          if (!D.sid || !D.key) { D.err = "حط الـ Store ID والـ API Key"; renderX(); return; }
          try { localStorage.setItem("ko_wsid", D.sid); } catch {}
          D.busy = true; D.err = ""; D.query = ""; renderX();
          try { await wcLoad(D); } catch (er) { D.err = er.message; D.query = er.query || ""; D.msg = ""; }
          D.busy = false; renderX();
        }
      },
      save: () => wcApply(D),
    });
    const sb = $("[data-x-save]"); if (sb) sb.textContent = "طبّق متل Wuilt";
  });
  // ---------- links for the WhatsApp bot ----------
  // ===== المجيب K FAST جوّا لوحة التحكم =====
  const KBOT_DEF = "https://k-fast-ai.pages.dev";
  function kbotUrl() { const u = String((ST && ST.apps && ST.apps.botUrl) || "").trim(); return /^https:\/\/[^\s"<>]+$/.test(u) ? u.replace(/\/+$/, "") : KBOT_DEF; }
  function kbotLoad(force) {
    const fr = $("[data-kbot-frame]"), off = $("[data-kbot-off]"), op = $("[data-kbot-open]"); if (!fr) return;
    const u = kbotUrl() + "/";
    if (op) op.href = u;
    if (!force && fr.dataset.src === u) return;
    fr.dataset.src = u; off.hidden = true;
    let ok = false; fr.onload = () => { ok = true; };
    fr.src = u + (force ? "?t=" + Date.now() : "");
    setTimeout(() => { if (!ok) off.hidden = false; }, 20000);
  }
  document.addEventListener("click", (e) => { if (e.target.closest("[data-kbot-reload]")) kbotLoad(true); });
  function renderBotLinks() {
    const el = $("[data-bot-links]"); if (!el) return;
    const o = location.origin, L = [["كل المنتجات (JSON)", o + "/api/catalog"], ["بحث عن منتج (للمجيب)", o + "/api/catalog/search?q=قفاز ملاكمة&limit=5"], ["كل المنتجات كنص", o + "/api/catalog.txt"], ["مثال رابط منتج", o + "/p/" + encodeURIComponent((products[0] || {}).id || "ID")]];
    el.innerHTML = L.map(([t, u]) => `<div class="bot-l"><span>${t}</span><code dir="ltr">${esc(u)}</code><button type="button" class="btn btn-ghost sm" data-copy="${esc(u)}">نسخ</button><a class="btn btn-ghost sm" href="${esc(u)}" target="_blank" rel="noopener">فتح</a></div>`).join("");
  }
  document.addEventListener("click", (e) => { const c = e.target.closest("[data-copy]"); if (!c) return; navigator.clipboard.writeText(c.dataset.copy).then(() => toast("انتسخ ✓")).catch(() => {}); });
  function allCats() { return [...new Set(products.flatMap((p) => [p.category, ...(p.also || [])]))].sort(); }
  function renderGroups() {
    const g = ST.design.groups, used = new Set(g.flatMap((x) => x.cats)), cats = allCats();
    const free = cats.filter((c) => !used.has(c));
    const label = (c) => ST.design.catLabels?.[c] || c;
    const chip = (c, j, n) => `<span class="catchip" data-cat="${esc(c)}"><i class="cc-h" title="اسحب">⠿</i>${esc(label(c))}${n > 1 ? `<button data-cmove="-1" data-cj="${j}" title="لقدام" ${j ? "" : "disabled"}>‹</button><button data-cmove="1" data-cj="${j}" title="لورا" ${j < n - 1 ? "" : "disabled"}>›</button>` : ""}<button data-cdel="${j}" title="شيل">✕</button></span>`;
    $("[data-groups-editor]").innerHTML = `<p class="hint" style="margin:0 0 8px">✋ اسحب المجموعة من ⠿ لترتّبها، واسحب أي قسم لتغيّر مكانو أو تنقلو لمجموعة تانية. أو استعمل الأسهم.</p>` + g.map((grp, i) => `<div class="group-card" data-gi="${i}">
      <div class="group-head"><span class="g-handle" title="اسحب لترتّب">⠿</span><b class="g-num">${i + 1}</b><input value="${esc(grp.name)}" data-gname aria-label="اسم المجموعة">
        <button class="mini" data-gmove="top" title="لأول القائمة" ${i ? "" : "disabled"}>⤒</button><button class="mini" data-gmove="-1" title="لفوق" ${i ? "" : "disabled"}>↑</button><button class="mini" data-gmove="1" title="لتحت" ${i < g.length - 1 ? "" : "disabled"}>↓</button><button class="mini" data-gmove="end" title="لآخر القائمة" ${i < g.length - 1 ? "" : "disabled"}>⤓</button><button class="mini del" data-gdel title="حذف المجموعة">✕</button></div>
      <div class="catchips" data-catlist>${grp.cats.map((c, j) => chip(c, j, grp.cats.length)).join("")}</div>
      <select data-cadd class="cadd"><option value="">+ ضيف قسم</option>${cats.filter((c) => !grp.cats.includes(c)).map((c) => `<option value="${esc(c)}">${esc(label(c))}${used.has(c) ? " (بمجموعة تانية)" : ""}</option>`).join("")}</select></div>`).join("");
    $("[data-unassigned]").innerHTML = free.length ? `<div class="unassigned"><b>أقسام مو بأي مجموعة</b> (بتطلع بس بـ «كل المنتجات») — اسحبها لمجموعة:<div class="catchips" data-catlist data-free>${free.map((c) => `<span class="catchip" data-cat="${esc(c)}"><i class="cc-h">⠿</i>${esc(label(c))}</span>`).join("")}</div></div>` : "";
    $("[data-labels]").innerHTML = cats.map((c) => `<div class="label-row"><span>${esc(c)}</span><input data-label="${esc(c)}" value="${esc(ST.design.catLabels?.[c] || "")}" placeholder="نفس الاسم"></div>`).join("");
    groupsDnD();
  }
  // السحب والإفلات (بيشتغل بالماوس وباللمس عالموبايل) — SortableJS
  let sortableP = null;
  const loadSortable = () => sortableP ||= (window.Sortable ? Promise.resolve() : new Promise((ok, no) => { const sc = document.createElement("script"); sc.src = "https://cdnjs.cloudflare.com/ajax/libs/Sortable/1.15.2/Sortable.min.js"; sc.onload = ok; sc.onerror = () => { sortableP = null; no(); }; document.head.appendChild(sc); }));
  function groupsFromDom() {
    const old = ST.design.groups;
    ST.design.groups = [...$("[data-groups-editor]").querySelectorAll(".group-card")].map((card) => ({ ...old[+card.dataset.gi], cats: [...card.querySelectorAll("[data-catlist] .catchip")].map((x) => x.dataset.cat) }));
    renderGroups(); updateSetBar();
  }
  function groupsDnD() {
    loadSortable().then(() => {
      const ed = $("[data-groups-editor]"); if (!ed) return;
      Sortable.create(ed, { handle: ".g-handle", draggable: ".group-card", animation: 160, ghostClass: "dnd-ghost", onEnd: (e) => { if (e.oldIndex !== e.newIndex) groupsFromDom(); } });
      document.querySelectorAll("[data-groups-editor] [data-catlist], [data-unassigned] [data-catlist]").forEach((list) => Sortable.create(list, { group: "kocats", draggable: ".catchip", animation: 160, ghostClass: "dnd-ghost", filter: "button", preventOnFilter: false, delay: 120, delayOnTouchOnly: true, onEnd: () => groupsFromDom() }));
    }).catch(() => {});
  }
  $("[data-groups-editor]").addEventListener("input", (e) => {
    if (!e.target.matches("[data-gname]")) return;
    ST.design.groups[e.target.closest("[data-gi]").dataset.gi].name = e.target.value; updateSetBar();
  });
  $("[data-groups-editor]").addEventListener("click", (e) => {
    const card = e.target.closest("[data-gi]"); if (!card) return;
    const g = ST.design.groups, i = +card.dataset.gi;
    const mv = e.target.closest("[data-gmove]");
    const cm = e.target.closest("[data-cmove]");
    if (mv) { const d = mv.dataset.gmove; if (d === "top") g.unshift(g.splice(i, 1)[0]); else if (d === "end") g.push(g.splice(i, 1)[0]); else { const j = i + +d; [g[i], g[j]] = [g[j], g[i]]; } }
    else if (cm) { const a = g[i].cats, j = +cm.dataset.cj, k = j + +cm.dataset.cmove; [a[j], a[k]] = [a[k], a[j]]; }
    else if (e.target.closest("[data-gdel]")) { if (!confirm(`حذف مجموعة «${g[i].name}»؟ (الأقسام نفسها ما بتنحذف)`)) return; g.splice(i, 1); }
    else if (e.target.closest("[data-cdel]")) g[i].cats.splice(+e.target.closest("[data-cdel]").dataset.cdel, 1);
    else return;
    renderGroups(); updateSetBar();
  });
  $("[data-groups-editor]").addEventListener("change", (e) => {
    if (!e.target.matches("[data-cadd]") || !e.target.value) return;
    const c = e.target.value;
    ST.design.groups.forEach((g) => (g.cats = g.cats.filter((x) => x !== c)));
    ST.design.groups[e.target.closest("[data-gi]").dataset.gi].cats.push(c);
    renderGroups(); updateSetBar();
  });
  $("[data-add-group]").onclick = () => { ST.design.groups.push({ name: "مجموعة جديدة", cats: [] }); renderGroups(); updateSetBar(); };
  $("[data-labels]").addEventListener("input", (e) => {
    if (!e.target.matches("[data-label]")) return;
    ST.design.catLabels ??= {};
    const v = e.target.value.trim();
    if (v) ST.design.catLabels[e.target.dataset.label] = v; else delete ST.design.catLabels[e.target.dataset.label];
    updateSetBar();
  });

  // delivery zones
  // ----- shipping companies editor (governorates + branches) -----
  // ---------- heavy things: shipping priced on confirmation ----------
  const HEAVY_DEF = { on: true, cats: ["أوزان"], words: ["دامبل", "دمبل", "دنبل", "طارة", "طارات", "حديد", "كيس ملاكمة", "دبل باغ", "سترة", "سترة اوزان", "سترة أوزان", "بار", "كيتل", "عقلة", "بنش", "أوزان حديد"] };
  function renderHeavy() {
    const el = $("[data-heavy]"); if (!el || !ST || !ST.shipping) return;
    const H = (ST.shipping.heavy = { ...HEAVY_DEF, ...(ST.shipping.heavy || {}) });
    const cats = [...new Set(products.map((p) => p.category))].sort();
    const nw = (t) => " " + String(t || "").replace(/[\-–—_,،.()\[\]/|+:]+/g, " ").replace(/\s+/g, " ").trim() + " ";
    const hits = products.filter((p) => H.on !== false && ((H.cats || []).includes(p.category) || (H.words || []).some((w) => w && nw(p.name).includes(nw(w)))));
    el.innerHTML = `<label class="switch"><input type="checkbox" data-heavy-on ${H.on !== false ? "checked" : ""}><span></span> الطلبات يلي فيها أغراض تقيلة: التوصيل «بيتحدد عند التأكيد»</label>
      <div class="field"><label>أقسام تقيلة</label><div class="pay-checks">${cats.map((c) => `<label class="check"><input type="checkbox" data-heavy-cat="${esc(c)}" ${(H.cats || []).includes(c) ? "checked" : ""}> ${esc(c)}</label>`).join("")}</div></div>
      <div class="field"><label>كلمات باسم المنتج (افصل بفاصلة)</label><textarea data-heavy-words rows="2">${esc((H.words || []).join("، "))}</textarea><small class="hint">الكلمة لازم تكون كلمة كاملة باسم المنتج. مثال: «بار» ما بتمسك «سبارينغ».</small></div>
      <details class="th-det"><summary>المنتجات المعتبرة تقيلة هلأ (${hits.length})</summary><p class="hint">${hits.map((p) => esc(p.name)).join(" · ") || "ولا منتج"}</p></details>`;
  }
  document.addEventListener("change", (e) => {
    if (!ST || !ST.shipping || !ST.shipping.heavy) return;
    const H = ST.shipping.heavy;
    if (e.target.matches("[data-heavy-on]")) H.on = e.target.checked;
    else if (e.target.matches("[data-heavy-cat]")) { const c = e.target.dataset.heavyCat; H.cats = (H.cats || []).filter((x) => x !== c); if (e.target.checked) H.cats.push(c); }
    else if (e.target.matches("[data-heavy-words]")) H.words = e.target.value.split(/[,،\n]+/).map((x) => x.trim()).filter(Boolean).slice(0, 100);
    else return;
    renderHeavy(); updateSetBar();
  });

  function renderCarriers() {
    const box = $("[data-carriers-ed]"); if (!box) return;
    const L = ST.shipping.carriers;
    const open = new Set([...box.querySelectorAll("details[open]")].map((d) => d.dataset.i));
    const pays = ST.payments;
    box.innerHTML = L.map((c, i) => { const p = `shipping.carriers.${i}`; return `<details class="car-card${c.on === false ? " off" : ""}" data-i="${i}" ${open.has(String(i)) ? "open" : ""}>
      <summary><label class="switch" onclick="event.stopPropagation()"><input type="checkbox" data-k="${p}.on"><span></span></label>
        <span class="s-name">${esc(c.name || "شركة بدون اسم")}</span><span class="sec-badge">${c.type === "branch" ? "استلام من فرع" : "لباب البيت"} · ${(c.govs || []).length} محافظة${c.type === "branch" ? " · " + (c.govs || []).reduce((n, g) => n + (g.branches || []).length, 0) + " فرع" : ""}</span>${moveBtns(i, L.length, "car")}</summary>
      <div class="car-body">
        <div class="row2"><div class="field"><label>اسم الشركة كيف بيشوفه الزبون</label><input data-k="${p}.name" maxlength="60"></div>
          <div class="field"><label>النوع</label><div class="seg" data-seg="${p}.type"><button type="button" data-v="branch">استلام من فرع</button><button type="button" data-v="door">توصيل لباب البيت</button></div></div></div>
        <div class="field"><label>سطر صغير تحت الاسم</label><input data-k="${p}.note" maxlength="120"></div>
        <div class="field"><label>سعر شحن ثابت لكل المحافظات ($)</label><input type="number" min="0" step="0.5" dir="ltr" data-k="${p}.flatFee" data-numopt placeholder="فاضي = بيتحدد عند التأكيد"><small class="hint">إذا محافظة إلها سعر خاص تحت، بيمشي سعرها. الطلبات يلي فيها أغراض تقيلة سعر شحنها دايماً «بيتحدد عند التأكيد».</small></div>
        <div class="field"><label>طرق الدفع المسموحة مع هالشركة</label><div class="pay-checks">${pays.map((py) => `<label class="check"><input type="checkbox" data-carpay="${i}:${esc(py.id)}" ${(c.payments || []).includes(py.id) ? "checked" : ""}> ${esc(py.name)}</label>`).join("")}</div>
          <small class="hint">إذا ما علّمت شي، بتطلع كل طرق الدفع المفعّلة.</small></div>
        <div class="field"><label>المحافظات${c.type === "branch" ? " والفروع" : ""}</label>
          ${(c.govs || []).map((g, j) => `<div class="gov-card">
            <div class="gov-head"><input data-k="${p}.govs.${j}.name" data-gname2 placeholder="اسم المحافظة">
              <input type="number" min="0" step="0.5" dir="ltr" data-gfee="${i}:${j}" value="${g.fee ?? ""}" placeholder="السعر: بيتحدد">
              <button type="button" class="mini del" data-gov-del="${i}:${j}" title="حذف المحافظة">✕</button></div>
            ${c.type === "branch" ? (g.branches || []).map((b, k) => `<div class="br-row"><input data-k="${p}.govs.${j}.branches.${k}.name" placeholder="اسم الفرع"><input data-k="${p}.govs.${j}.branches.${k}.address" placeholder="العنوان التفصيلي"><button type="button" class="mini del" data-br-del="${i}:${j}:${k}">✕</button></div>`).join("") + `<button type="button" class="btn btn-ghost sm" style="margin-top:6px" data-br-add="${i}:${j}">+ فرع</button>` : ""}
          </div>`).join("")}
          <button type="button" class="btn btn-ghost sm" data-gov-add="${i}">+ محافظة</button>
        </div>
      </div></details>`; }).join("");
  }
  $("[data-add-carrier]").onclick = () => {
    ST.shipping.carriers.push({ id: "c" + Date.now().toString(36), name: "شركة شحن جديدة", type: "branch", on: true, note: "", payments: [], govs: [] });
    renderCarriers(); bindInputs(); renderSegs(); updateSetBar();
    const all = $$("[data-carriers-ed] details"); all[all.length - 1].open = true;
  };
  document.addEventListener("click", (e) => {
    if (!ST) return;
    const t = e.target.closest("[data-car-move],[data-car-del],[data-gov-add],[data-gov-del],[data-br-add],[data-br-del]"); if (!t) return;
    e.preventDefault();
    const L = ST.shipping.carriers;
    if (t.matches("[data-car-move]")) { const i = +t.dataset.i, j = i + +t.dataset.carMove; [L[i], L[j]] = [L[j], L[i]]; }
    else if (t.matches("[data-car-del]")) { if (!confirm(`حذف «${L[+t.dataset.i].name}»؟`)) return; L.splice(+t.dataset.i, 1); }
    else if (t.matches("[data-gov-add]")) { (L[+t.dataset.govAdd].govs ||= []).push({ name: "", fee: null, branches: [] }); }
    else if (t.matches("[data-gov-del]")) { const [i, j] = t.dataset.govDel.split(":").map(Number); if (!confirm(`حذف محافظة «${L[i].govs[j].name}» من «${L[i].name}»؟`)) return; L[i].govs.splice(j, 1); }
    else if (t.matches("[data-br-add]")) { const [i, j] = t.dataset.brAdd.split(":").map(Number); (L[i].govs[j].branches ||= []).push({ name: "", address: "" }); }
    else if (t.matches("[data-br-del]")) { const [i, j, k] = t.dataset.brDel.split(":").map(Number); L[i].govs[j].branches.splice(k, 1); }
    renderCarriers(); bindInputs(); renderSegs(); updateSetBar();
  });
  document.addEventListener("input", (e) => {
    if (!ST) return;
    if (e.target.matches("[data-gfee]")) { const [i, j] = e.target.dataset.gfee.split(":").map(Number); ST.shipping.carriers[i].govs[j].fee = e.target.value === "" ? null : Math.max(0, parseFloat(e.target.value) || 0); updateSetBar(); }
    if (e.target.matches("[data-carpay]")) { const [i, id] = e.target.dataset.carpay.split(":"); const c = ST.shipping.carriers[+i]; c.payments = (c.payments || []).filter((x) => x !== id); if (e.target.checked) c.payments.push(id); updateSetBar(); }
  });
  document.addEventListener("change", (e) => { const c = e.target.closest(".car-card"); if (c && e.target.matches('[data-k$=".on"]')) c.classList.toggle("off", !e.target.checked); if (e.target.matches('[data-seg] , [data-k$=".type"]')) renderCarriers(); });

  function renderPays() {
    $("[data-payments]").innerHTML = ST.payments.map((p, i) => `<div class="pay-card${p.enabled ? "" : " off"}" data-pi="${i}">
      <div class="ph"><input value="${esc(p.name)}" data-pname placeholder="اسم الطريقة، مثلاً: شام كاش">
        <button class="toggle ${p.enabled ? "in" : "out"}" data-pon>${p.enabled ? "مفعّلة" : "موقّفة"}</button>
        <button class="mini" data-pmove="-1" ${i ? "" : "disabled"}>↑</button><button class="mini" data-pmove="1" ${i < ST.payments.length - 1 ? "" : "disabled"}>↓</button>
        <button class="mini del" data-pdel>✕</button></div>
      <textarea rows="2" data-pdetails placeholder="التفاصيل اللي بتطلع للزبون، مثلاً: حوّل على رقم شام كاش 09xxxxxxx وابعت صورة الإشعار على واتساب">${esc(p.details)}</textarea>
      <div class="img-pick"><span class="qr-pv" style="background-image:url('${esc(p.qr || "")}')"></span>
        <label class="btn btn-ghost sm">${p.qr ? "تغيير الباركود" : "رفع باركود (QR)"}<input type="file" accept="image/*" data-upload="payments.${i}.qr" hidden></label>
        ${p.qr ? `<button class="btn btn-ghost sm" data-clear="payments.${i}.qr">إزالة</button>` : ""}
        <label class="check"><input type="checkbox" data-k="payments.${i}.manual"> بدها تأكيد تحويل (الطلب بيبلّش «بانتظار التحويل»)</label></div></div>`).join("");
    bindInputs();
  }
  $("[data-payments]").addEventListener("input", (e) => {
    const card = e.target.closest("[data-pi]"); if (!card) return;
    const p = ST.payments[card.dataset.pi];
    if (e.target.matches("[data-pname]")) p.name = e.target.value;
    if (e.target.matches("[data-pdetails]")) p.details = e.target.value;
    updateSetBar();
  });
  $("[data-payments]").addEventListener("click", (e) => {
    const card = e.target.closest("[data-pi]"); if (!card) return;
    const L = ST.payments, i = +card.dataset.pi;
    if (e.target.closest("[data-pon]")) L[i].enabled = !L[i].enabled;
    else if (e.target.closest("[data-pmove]")) { const j = i + +e.target.closest("[data-pmove]").dataset.pmove; [L[i], L[j]] = [L[j], L[i]]; }
    else if (e.target.closest("[data-pdel]")) { if (!confirm(`حذف «${L[i].name}»؟`)) return; L.splice(i, 1); }
    else return;
    renderPays(); updateSetBar();
  });
  $("[data-add-pay]").onclick = () => { ST.payments.push({ id: "p" + Date.now().toString(36), name: "", details: "", enabled: true }); renderPays(); updateSetBar(); $("[data-payments] .pay-card:last-child [data-pname]").focus(); };

  // save
  $("[data-set-save]").onclick = async () => {
    if (ST.payments.some((p) => !p.name.trim())) { toast("في طريقة دفع بدون اسم"); return; }
    if (ST.design.groups.some((g) => !g.name.trim())) { toast("في مجموعة بدون اسم"); return; }
    const b = $("[data-set-save]"); b.disabled = true;
    try { await api("/api/settings", { method: "PUT", body: JSON.stringify(ST) }); stSaved = JSON.stringify(ST); updateSetBar(); toast("انحفظ ✓ التعديلات صارت ظاهرة لكل الزوار"); }
    catch (err) { toast(err.message); }
    b.disabled = false;
  };
  $("[data-set-discard]").onclick = () => { ST = JSON.parse(stSaved); renderSettings(); };
  window.addEventListener("beforeunload", (e) => { if (stDirty()) { e.preventDefault(); e.returnValue = ""; } });

  // ---------- sound & music panel, media upload ----------
  const MEDIA_EXT = { mp3: "audio/mpeg", m4a: "audio/mp4", aac: "audio/aac", wav: "audio/wav", ogg: "audio/ogg", opus: "audio/ogg", flac: "audio/flac", mp4: "video/mp4", m4v: "video/mp4", webm: "video/webm", mov: "video/quicktime" };
  document.addEventListener("change", async (e) => {
    const inp = e.target.closest("[data-media-up]"); if (!inp || !inp.files[0] || !ST) return;
    const file = inp.files[0], path = inp.dataset.mediaUp;
    try {
      const type = file.type || MEDIA_EXT[(file.name.split(".").pop() || "").toLowerCase()] || "";
      if (!type) throw new Error("نوع الملف مو معروف");
      if (file.size > 24 * 1024 * 1024) throw new Error("الملف أكبر من 24 ميغا. ضغطه، أو حط رابط بدل الرفع.");
      toast("جاري الرفع… (" + (file.size / 1048576).toFixed(1) + " ميغا)، خلّي الصفحة مفتوحة");
      const j = await api("/api/media", { method: "POST", body: file, headers: { "content-type": type } });
      budget.add(1);
      setK(path, j.url);
      if (/^home\.sections\./.test(path)) renderSecDlg(); else bindInputs();
      sndHint(); updateSetBar(); toast("انرفع ✓ لا تنسى تكبس حفظ");
    } catch (err) { toast(err.message); }
    inp.value = "";
  });
  function sndHint() {
    const el = $("[data-snd-kind]"); if (!el || !ST || !window.KOMedia) return;
    const v = String(getK("audio.music.src") || "").trim(), d = v && KOMedia.parse(v);
    el.textContent = !v ? "" : !d ? "⚠️ الرابط غلط" : d.kind === "yt" ? "✓ رابط يوتيوب" : d.kind === "file" || (d.kind === "frame" && /^\/media\//.test(v)) ? "✓ ملف صوت" : d.kind === "frame" ? "ℹ️ رابط مباشر لملف صوت. جرّبه بزر «جرّب الأغنية» تحت." : "⚠️ هالرابط مو أغنية. استعمل يوتيوب أو ملف صوت.";
  }
  let sndPrev = null;
  function stopPrev() { if (sndPrev) { sndPrev.destroy(); sndPrev = null; } const b = $("[data-snd-test]"); if (b) b.textContent = "▶ جرّب الأغنية"; const st = $("[data-snd-state]"); if (st) st.textContent = ""; }
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-sfx-test]");
    if (t && ST && window.KOMedia) { KOMedia.sfx(t.dataset.sfxTest, { on: true, style: ST.audio.sfx.style, volume: ST.audio.sfx.volume }); return; }
    const b = e.target.closest("[data-snd-test]"); if (!b || !ST || !window.KOMedia) return;
    if (sndPrev) { stopPrev(); return; }
    const src = String(ST.audio.music.src || "").trim(); if (!src) { toast("حط رابط أو ارفع ملف أول"); return; }
    sndPrev = KOMedia.music({ src, volume: ST.audio.music.volume, loop: true }, { button: false, persist: false });
    b.textContent = "⏹ وقّف";
    const st = $("[data-snd-state]");
    sndPrev.onstate = (m) => { if (!st) return; st.textContent = m.err ? "⚠️ ما اشتغل الرابط. تأكد إنه رابط صحيح." : m.playing ? "🔊 شغّال" : "جاري التحميل…"; };
    sndPrev.toggle();
  });
  document.addEventListener("input", (e) => { if (e.target.matches && e.target.matches('[data-k="audio.music.src"]')) { stopPrev(); sndHint(); } });
  document.addEventListener("click", (e) => { if (sndPrev && e.target.closest("[data-apnav],[data-tab]") && !e.target.closest('[data-apnav="sound"]')) stopPrev(); });

  if (pass) login().catch(() => {});
})();
