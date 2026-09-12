import puppeteer from "puppeteer";

const BASE = process.env.TEST_URL || "http://localhost:3000";
const results = [];
const record = (name, pass, note = "") => {
  results.push({ name, pass, note });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${note ? "  — " + note : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(String(e)));

await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
// Babel compiles the page at runtime; the loading screen also holds for ~1.6s.
await page.waitForFunction(() => document.querySelectorAll("button").length > 5, { timeout: 60000 });
await new Promise((r) => setTimeout(r, 2500));

record("page renders without a JS error", pageErrors.length === 0, pageErrors[0] || "");

// The page source must not contain the key any more.
const html = await page.content();
record("no Gemini key in served page", !/AIzaSy|AQ\.Ab8/.test(html));

const openChat = async () => {
  await page.waitForSelector(".gemini-fab", { timeout: 15000 });
  await page.click(".gemini-fab");
  await page.waitForSelector(".gemini-chat-input", { timeout: 15000 });
};

const bubbles = () => page.$$eval(".gemini-bubble.ai", (n) => n.map((e) => e.textContent.trim()));
const typingVisible = () => page.$(".gemini-typing-dots").then(Boolean);

const ask = async (text) => {
  await new Promise((r) => setTimeout(r, 1200));
  const before = (await bubbles()).length;
  await page.click(".gemini-chat-input");
  await page.type(".gemini-chat-input", text, { delay: 8 });
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    (n) => document.querySelectorAll(".gemini-bubble.ai").length > n,
    { timeout: 45000 }, before
  );
  const all = await bubbles();
  return all[all.length - 1];
};

await openChat();
record("chat window opens", true);

// 1. basic greeting
const r1 = await ask("Hi");
record("basic chat reply", r1.length > 0, r1.slice(0, 70));

// 2. India question
const r2 = await ask("Tell me about Hampi.");
record("India question answered", /hampi|vijayanagar|karnataka/i.test(r2), r2.slice(0, 70));

// 3. follow-up context — "it" must resolve to Hampi
const r3 = await ask("When should I visit it?");
record("follow-up resolves \"it\"", /hampi|october|november|december|january|february|winter/i.test(r3), r3.slice(0, 70));

// 4. second follow-up
const r4 = await ask("What food should I try there?");
record("second follow-up keeps context", r4.length > 10, r4.slice(0, 70));

// 5. typing indicator appears, then clears
await page.click(".gemini-chat-input");
await page.type(".gemini-chat-input", "Plan a 3-day Rajasthan trip.", { delay: 5 });
const beforeCount = (await bubbles()).length;
await page.keyboard.press("Enter");
await new Promise((r) => setTimeout(r, 400));
const sawTyping = await typingVisible();
const inputClearedImmediately = (await page.$eval(".gemini-chat-input", (e) => e.value)) === "";
await page.waitForFunction((n) => document.querySelectorAll(".gemini-bubble.ai").length > n, { timeout: 45000 }, beforeCount);
await new Promise((r) => setTimeout(r, 300));
const typingGone = !(await typingVisible());
record("typing indicator shows then clears", sawTyping && typingGone, `saw=${sawTyping} cleared=${typingGone}`);
record("input clears on send", inputClearedImmediately);

// 6. empty input keeps Send disabled
const sendDisabled = await page.$eval(".gemini-chat-send", (e) => e.disabled);
record("Send disabled on empty input", sendDisabled);

// 7. rapid send must not duplicate
const beforeRapid = (await bubbles()).length;
await page.click(".gemini-chat-input");
await page.type(".gemini-chat-input", "Top forts in India?", { delay: 3 });
await page.keyboard.press("Enter");
await page.keyboard.press("Enter");
await page.keyboard.press("Enter");
await page.waitForFunction((n) => document.querySelectorAll(".gemini-bubble.ai").length > n, { timeout: 45000 }, beforeRapid);
await new Promise((r) => setTimeout(r, 5000));
const afterRapid = (await bubbles()).length;
record("rapid Enter sends once", afterRapid - beforeRapid === 1, `${afterRapid - beforeRapid} replies`);

// 8. status indicator turned Online after a successful call
const status = await page.$eval(".gemini-chat-header .font-utility", (e) => e.textContent.trim());
record("status shows Online after success", /online/i.test(status), status);

// 9. session history survives close + reopen
await page.click('.gemini-chat-header button[aria-label]');
await new Promise((r) => setTimeout(r, 400));
await page.click(".gemini-fab");
await page.waitForSelector(".gemini-chat-input", { timeout: 10000 });
const afterReopen = (await bubbles()).length;
record("history survives close/reopen", afterReopen === afterRapid, `${afterReopen} vs ${afterRapid}`);

// 10. history survives a reload (sessionStorage)
await page.reload({ waitUntil: "networkidle2" });
await new Promise((r) => setTimeout(r, 3500));
await page.click(".gemini-fab");
await page.waitForSelector(".gemini-chat-input", { timeout: 15000 });
const afterReload = (await bubbles()).length;
record("history survives reload", afterReload === afterRapid, `${afterReload} vs ${afterRapid}`);

// 11. Hindi mode — toggle the site language, then ask in English
await page.evaluate(() => document.querySelector(".gemini-chat-header button[aria-label]").click());
await new Promise((r) => setTimeout(r, 300));
const langBtn = await page.$$eval("header button", (btns) =>
  btns.findIndex((b) => /हिं|EN/.test(b.textContent)));
await page.evaluate((i) => document.querySelectorAll("header button")[i].click(), langBtn);
await new Promise((r) => setTimeout(r, 600));
await page.click(".gemini-fab");
await page.waitForSelector(".gemini-chat-input", { timeout: 10000 });
const rHi = await ask("Best time to visit Jaipur?");
record("Hindi mode replies in Devanagari", /[\u0900-\u097F]/.test(rHi), rHi.slice(0, 60));

// 12. mobile layout
const mobile = await browser.newPage();
await mobile.setViewport({ width: 390, height: 780, isMobile: true, hasTouch: true });
await mobile.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 3500));
await mobile.evaluate(() => document.querySelector(".gemini-fab").click());
await mobile.waitForSelector(".gemini-chat-input", { timeout: 15000 });
// getBoundingClientRect is measured against the visual viewport under Chrome's
// mobile emulation, so read the resolved style instead — that is what the
// browser actually laid the panel out with.
const box = await mobile.evaluate(() => {
  const cs = getComputedStyle(document.querySelector(".gemini-chat-window"));
  return { top: cs.top, left: cs.left, right: cs.right, bottom: cs.bottom,
    width: cs.width, viewport: window.innerWidth + "px", radius: cs.borderTopLeftRadius };
});
const inputVisible = await mobile.$eval(".gemini-chat-inputbar", (e) => {
  const r = e.getBoundingClientRect();
  return r.bottom <= window.innerHeight + 1 && r.height > 20;
});
const noHScroll = await mobile.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
record("mobile chat is full-screen", box.top === "0px" && box.left === "0px" && box.right === "0px" && box.width === box.viewport && box.radius === "0px", JSON.stringify(box));
record("mobile input bar visible", inputVisible);
record("no horizontal scroll on mobile", noHScroll);

// 13. offline behaviour
await mobile.setOfflineMode(true);
const offBefore = (await mobile.$$eval(".gemini-bubble.ai", (n) => n.length));
await mobile.evaluate(() => document.querySelector(".gemini-chat-input").focus());
await mobile.type(".gemini-chat-input", "Anything?", { delay: 5 });
await mobile.keyboard.press("Enter");
await mobile.waitForFunction((n) => document.querySelectorAll(".gemini-bubble.ai").length > n, { timeout: 30000 }, offBefore);
const offMsg = await mobile.$$eval(".gemini-bubble.ai", (n) => n[n.length - 1].textContent.trim());
const offTypingGone = !(await mobile.$(".gemini-typing-dots"));
record("offline shows friendly error", /offline|connection/i.test(offMsg), offMsg.slice(0, 60));
record("offline clears typing state", offTypingGone);
await mobile.setOfflineMode(false);

console.log("\npage errors:", pageErrors.length ? pageErrors : "none");
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
await browser.close();
process.exit(failed.length ? 1 : 0);
