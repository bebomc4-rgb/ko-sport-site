const { chromium } = require("playwright");
const B = "http://localhost:" + (process.env.PORT || 8790), SH = __dirname + "/shots/";
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await chromium.launch();
  const mk = async () => { const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); await c.route(/fonts\.g/, (r) => r.fulfill({ status: 200, body: "" })); const p = await c.newPage(); p.errs = []; p.on("pageerror", (e) => p.errs.push(e.message)); return p; };
  const A = await mk(), Bp = await mk();
  // gate
  await A.goto(B + "/"); await wait(400); await A.screenshot({ path: SH + "1-gate.png" });
  await A.fill("input.in", "سامر"); await A.click(".btn"); await wait(300);
  console.log("gate without 18+:", await A.textContent(".err"));
  await A.check("input[type=checkbox]"); await A.click(".btn"); await wait(800);
  console.log("A at", await A.evaluate(() => location.hash));
  // AI chat
  await A.fill("textarea", "حاسس حالي تعبان كتير وما بدي عيش"); await A.click(".send"); await wait(1200);
  console.log("AI reply:", (await A.$$eval(".msg.bot .bub", (x) => x.map((e) => e.textContent))).slice(-1)[0]);
  console.log("safety card:", !!(await A.$(".safety")));
  await A.screenshot({ path: SH + "2-ai.png" });
  // room
  await A.click('[data-tab="rooms"]'); await wait(600); await A.screenshot({ path: SH + "3-rooms.png" });
  await A.click('a[href="#/room/general"]'); await wait(800);
  await A.fill("textarea", "مرحبا شباب، كيفكن؟"); await A.click(".send"); await wait(800);
  await A.fill("textarea", "ضيفوني 0944 123 456"); await A.click(".send"); await wait(600);
  console.log("phone in room toast:", await A.textContent(".toast").catch(() => "none"));
  // B joins and adds A
  await Bp.goto(B + "/"); await wait(300); await Bp.fill("input.in", "نور"); await Bp.check("input[type=checkbox]"); await Bp.click(".btn"); await wait(700);
  await Bp.goto(B + "/#/room/general"); await wait(900);
  await Bp.fill("textarea", "أهلين سامر 🙂"); await Bp.click(".send"); await wait(700);
  await Bp.screenshot({ path: SH + "4-room.png" });
  await Bp.locator(".msg:not(.me) .who").last().click(); await wait(300); await Bp.screenshot({ path: SH + "5-person.png" });
  await Bp.click(".sheet .opt >> nth=0"); await wait(600);
  console.log("B add friend toast:", await Bp.textContent(".toast").catch(() => "none"));
  // A sees the request (badge refreshes on page change)
  await A.click('.top .icon'); await wait(300);
  await A.goto(B + "/#/friends"); await wait(900);
  console.log("A badge:", await A.textContent('[data-tab="friends"] .dot').catch(() => "none"));
  await A.screenshot({ path: SH + "6-request.png" });
  await A.click(".acts .btn >> nth=0"); await wait(800);
  console.log("A friends:", await A.$$eval(".row .tx b", (x) => x.map((e) => e.textContent)));
  // DM
  await A.click('a[href^="#/dm/"]'); await wait(900);
  await A.fill("textarea", "هلا نور! شو أخبارك؟"); await A.click(".send"); await wait(700);
  await Bp.goto(B + "/#/friends"); await wait(900);
  console.log("B unread dot:", !!(await Bp.$(".unread")), "badge:", await Bp.textContent('[data-tab="friends"] .dot').catch(() => "none"));
  await Bp.click('a[href^="#/dm/"]'); await wait(900);
  console.log("B sees DM:", await Bp.$$eval(".msg .bub", (x) => x.map((e) => e.textContent)));
  await Bp.fill("textarea", "تمام الحمدلله وإنت؟"); await Bp.click(".send"); await wait(3800);
  console.log("A got reply by polling:", (await A.$$eval(".msg .bub", (x) => x.map((e) => e.textContent))).slice(-1)[0]);
  await A.screenshot({ path: SH + "7-dm.png" });
  // report + block
  await Bp.click(".msg:not(.me) .bub"); await wait(300); await Bp.click(".sheet .opt >> nth=0"); await wait(300); await Bp.click(".sheet .opt >> nth=1"); await wait(600);
  console.log("B report toast:", await Bp.textContent(".toast").catch(() => "none"));
  await Bp.click('.top .icon:last-child'); await wait(300); await Bp.click(".sheet .opt.red"); await wait(300); await Bp.click(".sheet .opt.red"); await wait(800);
  console.log("B after block at", await Bp.evaluate(() => location.hash));
  await A.fill("textarea", "نور؟"); await A.click(".send"); await wait(700);
  console.log("A after being blocked:", await A.textContent(".toast").catch(() => "none"));
  // admin
  const Ad = await mk(); await Ad.goto(B + "/admin.html"); await Ad.fill("#p", "test123"); await Ad.click("#go"); await wait(900);
  console.log("admin stats:", (await Ad.textContent(".stats")).replace(/\s+/g, " "));
  await Ad.screenshot({ path: SH + "8-admin.png", fullPage: true });
  Ad.on("dialog", (d) => d.accept());
  await Ad.click(".item .btn.danger >> nth=0"); await wait(900);
  console.log("admin after ban:", await Ad.textContent(".item .tag").catch(() => "no tag"));
  await A.goto(B + "/#/rooms"); await wait(900);
  console.log("A (banned) sees:", await A.evaluate(() => document.body.innerText.slice(0, 120)));
  console.log("errors:", A.errs, Bp.errs, Ad.errs);
  await b.close();
})();
