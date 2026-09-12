// Focused run for the three features the broader suite could not confirm
// before the test key ran out of free-tier quota.
import puppeteer from "puppeteer";

const BASE = process.env.TEST_URL || "http://localhost:3000";
const calls = [];
const out = [];
const record = (n, pass, note = "") => { out.push(pass); console.log(`${pass ? "PASS" : "FAIL"}  ${n}${note ? "  — " + note : ""}`); };

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new", args: ["--no-sandbox"],
});
const p = await browser.newPage();
await p.setViewport({ width: 1400, height: 1000 });
p.on("response", (r) => { if (r.url().includes("/api/gemini")) calls.push(r.status()); });
await p.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise((r) => setTimeout(r, 3200));

await p.evaluate(() => document.querySelector("#sec-heritage .tilt-card").click());
await p.waitForFunction(() => document.body.textContent.includes("PHOTO GALLERY"), { timeout: 20000 });

const clickText = (t) => p.evaluate((txt) => {
  const b = [...document.querySelectorAll("button")].find((n) => n.textContent.toLowerCase().includes(txt.toLowerCase()));
  if (b) { b.click(); return true; } return false;
}, t);

// Heritage explainer
await clickText("Tell me the history");
const gotEn = await p.waitForFunction(() => !!document.querySelector("#root .weather-advice-panel"), { timeout: 60000 })
  .then(() => true).catch(() => false);
const en = gotEn ? await p.$eval("#root .weather-advice-panel", (e) => e.innerText.trim()) : "";
record("heritage explainer returns Gemini text", gotEn && en.length > 120 && /SIMPLE ENGLISH/i.test(en), en.replace(/\s+/g, " ").slice(0, 110));

// Hindi translation of that explanation
if (gotEn) {
  await clickText("Read in Hindi");
  const gotHi = await p.waitForFunction(
    () => ((document.querySelector("#root .weather-advice-panel")?.innerText || "").match(/[\u0900-\u097F]/g) || []).length > 30,
    { timeout: 60000 }).then(() => true).catch(() => false);
  const hi = gotHi ? await p.$eval("#root .weather-advice-panel", (e) => e.innerText.trim()) : "";
  record("Hindi translation of that explanation", gotHi, hi.replace(/\s+/g, " ").slice(0, 90));
}

// Nearby recommendations (fires automatically on the Plan Visit tab)
await new Promise((r) => setTimeout(r, 800));
console.log("plan visit clicked:", await clickText("PLAN VISIT"));
await p.waitForFunction(() => document.body.textContent.includes("CURRENT WEATHER"), { timeout: 20000 });
const gotNear = await p.waitForFunction(
  () => !!document.querySelector("#root .gemini-response-fadein") ||
        document.body.textContent.includes("Couldn't fetch nearby recommendations"),
  { timeout: 70000 }).then(() => true).catch(() => false);
const near = await p.$eval("#root .gemini-response-fadein", (e) => e.innerText.trim()).catch(() => "");
const pinCount = await p.$$eval('[aria-label]', (n) => n.length);
record("nearby recommendations render", gotNear && near.length > 40, near.replace(/\s+/g, " ").slice(0, 110));

record("every /api/gemini call returned 200", calls.length > 0 && calls.every((c) => c === 200), calls.join(", "));
console.log("\ncalls:", calls.join(", "));
console.log(`${out.filter(Boolean).length}/${out.length} passed`);
await browser.close();
process.exit(out.every(Boolean) ? 0 : 1);
