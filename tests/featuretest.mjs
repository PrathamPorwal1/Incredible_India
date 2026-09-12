// Exercises the non-chat Gemini features in a real browser, so a chatbot fix
// can't quietly break the route planner, weather advice or heritage explainer.
import puppeteer from "puppeteer";

const BASE = process.env.TEST_URL || "http://localhost:3000";
const out = [];
const record = (name, pass, note = "") => {
  out.push(pass);
  console.log(`${pass ? "PASS" : "FAIL"}  ${name}${note ? "  — " + note : ""}`);
};

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
  headless: "new",
  args: ["--no-sandbox"],
});

const errors = [];
const calls = [];

const newPage = async () => {
  const p = await browser.newPage();
  await p.setViewport({ width: 1400, height: 1000 });
  p.on("pageerror", (e) => errors.push(String(e)));
  p.on("response", (r) => {
    if (r.url().includes("/api/gemini")) calls.push(r.status());
  });
  await p.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 3200));
  return p;
};

const clickByText = (page, selector, text) =>
  page.evaluate((sel, t) => {
    const el = [...document.querySelectorAll(sel)].find((n) => n.textContent.trim().toLowerCase().includes(t.toLowerCase()));
    if (el) { el.click(); return true; }
    return false;
  }, selector, text);

/* ---------- 1. Multi-city route planner ---------- */
{
  const p = await newPage();
  await p.evaluate(() => document.getElementById("sec-route-planner").scrollIntoView());
  await p.waitForSelector(".route-input-row input", { timeout: 15000 });
  await p.type(".route-input-row input", "Agra, Vrindavan", { delay: 10 });
  await p.click(".route-plan-btn");
  const ok = await p.waitForFunction(
    () => document.querySelectorAll(".route-main-card").length >= 2 &&
          !document.body.textContent.includes("Loading destination details…"),
    { timeout: 70000 }
  ).then(() => true).catch(() => false);
  const stops = await p.$$eval(".route-main-card h3", (n) => n.map((e) => e.textContent.trim()));
  const sights = await p.$$eval(".route-main-card b", (n) => n.slice(0, 3).map((e) => e.textContent.trim()));
  const transport = await p.$$eval(".route-option b", (n) => n.map((e) => e.textContent.trim()));
  record("route planner resolves stops", stops.length >= 2, stops.join(" / "));
  record("route planner returns sights", sights.length > 0, sights.join(", "));
  record("route planner returns transport legs", transport.length > 0, transport.join(", "));
  await p.close();
}

/* ---------- 2. Attraction page: heritage explainer, weather advice, nearby pins ---------- */
{
  const p = await newPage();
  // Home -> Featured heritage -> first attraction card.
  await p.evaluate(() => document.getElementById("sec-heritage").scrollIntoView());
  await new Promise((r) => setTimeout(r, 600));
  await p.evaluate(() => {
    const card = document.querySelector("#sec-heritage .tilt-card");
    card.click();
  });
  await p.waitForFunction(() => document.body.textContent.includes("PHOTO GALLERY"), { timeout: 20000 });

  // Heritage explainer
  const clicked = await clickByText(p, "button", "Tell me the history");
  record("heritage explainer button present", clicked);
  if (clicked) {
    const got = await p.waitForFunction(
      () => !!document.querySelector("#root .weather-advice-panel"),
      { timeout: 60000 }
    ).then(() => true).catch(() => false);
    const para = got ? await p.$eval("#root .weather-advice-panel", (e) => e.innerText.trim()) : "";
    record("heritage explainer returns text", got && para.length > 40, para.slice(0, 70));

    // Hindi translation of that explanation
    if (got) {
      await clickByText(p, "button", "Read in Hindi");
      const hi = await p.waitForFunction(
        () => /[\u0900-\u097F]/.test(document.querySelector("#root .weather-advice-panel")?.innerText || ""),
        { timeout: 60000 }
      ).then(() => true).catch(() => false);
      const hiText = hi ? await p.$eval("#root .weather-advice-panel", (e) => e.innerText.trim()) : "";
      record("Hindi translation of history", hi && /[\u0900-\u097F]/.test(hiText), hiText.slice(0, 50));
    }
  }

  // Plan Visit tab -> weather advice + nearby pins
  await clickByText(p, "button", "PLAN VISIT");
  await p.waitForFunction(() => document.body.textContent.includes("CURRENT WEATHER"), { timeout: 20000 });

  const nearby = await p.waitForFunction(
    () => document.querySelectorAll(".gemini-response-fadein").length > 0 ||
          document.body.textContent.includes("Couldn't fetch nearby recommendations"),
    { timeout: 70000 }
  ).then(() => true).catch(() => false);
  const pins = await p.$$eval("[title]", (n) => n.length);
  const nearbyList = await p.$eval("#root .gemini-response-fadein", (e) => e.innerText.trim()).catch(() => "");
  record("nearby recommendations render", nearby && nearbyList.length > 20 && !/Couldn.t fetch/.test(nearbyList), nearbyList.slice(0, 80));

  const adviceBtn = await clickByText(p, "button", "Ask Gemini for travel advice");
  record("weather advice button present", adviceBtn);
  if (adviceBtn) {
    const adv = await p.waitForFunction(
      () => document.body.textContent.includes("Quick tips") ||
            document.body.textContent.includes("couldn't fetch advice"),
      { timeout: 60000 }
    ).then(() => true).catch(() => false);
    const ok = await p.evaluate(() => document.body.textContent.includes("Quick tips"));
    record("weather advice returns tips", adv && ok);
  }
  await p.close();
}

/* ---------- 3. Solan planner ---------- */
{
  const p = await newPage();
  await p.evaluate(() => document.getElementById("sec-solan").scrollIntoView());
  await new Promise((r) => setTimeout(r, 500));
  await p.evaluate(() => {
    const inputs = [...document.querySelectorAll('#sec-solan input[type="number"]')];
    const set = (el, v) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(el, v);
      el.dispatchEvent(new Event("input", { bubbles: true }));
    };
    set(inputs[0], "2500");
    set(inputs[1], "2");
  });
  await clickByText(p, "#sec-solan button", "Ask Gemini");
  const got = await p.waitForFunction(
    () => document.querySelectorAll("#sec-solan .gemini-response-fadein").length > 0,
    { timeout: 60000 }
  ).then(() => true).catch(() => false);
  const picks = got ? await p.$eval("#sec-solan .gemini-response-fadein", (e) => e.textContent.trim()) : "";
  record("Solan planner returns a shortlist", got && picks.length > 40, picks.slice(0, 90));
  await p.close();
}

record("every /api/gemini call returned 200 (no silent fallback)",
  calls.length > 0 && calls.every((c) => c === 200), calls.join(", ") || "no calls");
console.log("\n/api/gemini responses:", calls.join(", ") || "none");
console.log("page errors:", errors.length ? errors : "none");
const failed = out.filter((v) => !v).length;
console.log(`\n${out.length - failed}/${out.length} passed`);
await browser.close();
process.exit(failed ? 1 : 0);
