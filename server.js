// Incredible India — Gemini proxy.
//
// The browser never sees the Gemini API key. The page posts to /api/gemini,
// this process attaches the key from the environment and forwards the call.

import "dotenv/config";
import express from "express";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* Both settings accept a comma-separated list. Google's free tier meters usage
   per project *per model*, so a second model is a second allowance and a second
   key is another project again. Listing a few means a demo keeps answering
   after the first allowance is spent, instead of failing for the rest of the
   day. The first entry is always preferred; the rest only come into play when
   one is exhausted. */
const list = (value, fallback) =>
  String(value || fallback).split(",").map((item) => item.trim()).filter(Boolean);

const API_KEYS = list(process.env.GEMINI_API_KEY, "");
const MODELS = list(process.env.GEMINI_MODEL, "gemini-3.6-flash");
const PORT = Number(process.env.PORT) || 3000;

const endpointFor = (model) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

// Ordered attempts: stay on the preferred model across every key before
// dropping to the next model, so answer quality degrades as late as possible.
const ATTEMPTS = MODELS.flatMap((model) => API_KEYS.map((apiKey) => ({ model, apiKey })));

// Google gives up on its own eventually, but we want a bound we control so a
// wedged socket can't hold a browser request open forever.
const UPSTREAM_TIMEOUT_MS = 25000;

const MAX_MESSAGE_CHARS = 4000;
const MAX_HISTORY_TURNS = 20;

const app = express();
app.use(express.json({ limit: "64kb" }));

/* The structured features (route stops, transport legs, weather advice, heritage
   explanations, nearby pins) send an identical prompt every time you revisit a
   place, so caching their answers stops a demo from burning the free-tier daily
   quota just by navigating around the site. Chat is deliberately excluded: two
   people opening the widget and typing "hi" should not get the same sentence
   back, and an instant reply also reads as fake. */
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const CACHE_LIMIT = 300;
const cache = new Map();

function cacheKey(system, message, format) {
  return crypto.createHash("sha1").update([format, system, message].join("|~|")).digest("hex");
}

function readCache(key) {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) {
    cache.delete(key);
    return null;
  }
  // Refresh insertion order so hot entries survive eviction.
  cache.delete(key);
  cache.set(key, hit);
  return hit.text;
}

function writeCache(key, text) {
  if (cache.size >= CACHE_LIMIT) cache.delete(cache.keys().next().value);
  cache.set(key, { text, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Only accept the exact shape the page sends; anything else is rejected before
// it can reach Google and spend quota.
function readRequest(body) {
  if (!body || typeof body !== "object") return { error: "bad_request" };

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return { error: "bad_request" };
  if (message.length > MAX_MESSAGE_CHARS) return { error: "message_too_long" };

  const system = typeof body.system === "string" ? body.system.slice(0, 6000) : "";
  const format = body.format === "json" ? "json" : "text";

  const history = Array.isArray(body.history)
    ? body.history
        .filter((turn) => turn && (turn.role === "user" || turn.role === "model")
          && typeof turn.text === "string" && turn.text.trim())
        .slice(-MAX_HISTORY_TURNS)
        .map((turn) => ({ role: turn.role, parts: [{ text: turn.text.slice(0, MAX_MESSAGE_CHARS) }] }))
    : [];

  return { system, message, format, history };
}

// Google's failures reach the browser as a stable code, never as the upstream
// body — that body can echo the prompt and name the key's project.
function classifyUpstream(status) {
  if (status === 429) return { code: "rate_limited", status: 429 };
  if (status >= 500) return { code: "server_error", status: 502 };
  // A retired or mistyped model name is worth trying the next one for; a
  // rejected key or malformed payload would fail identically everywhere.
  if (status === 404) return { code: "model_unavailable", status: 503 };
  if (status >= 400) return { code: "invalid_config", status: 503 };
  return { code: "api_error", status: 502 };
}

// Google intermittently answers 503 "high demand" on flash models. It clears
// within a second or so, and one quiet retry is the difference between a live
// demo working and showing an error.
const RETRY_DELAY_MS = 900;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Worth trying the next model or key for. A rejected key or a malformed
// request is left out on purpose: it would fail the same way everywhere, and
// retrying only delays the error you actually need to see.
const RECOVERABLE = new Set(["rate_limited", "server_error", "timeout", "model_unavailable"]);

async function callGemini(request) {
  let lastError;

  for (const [index, attempt] of ATTEMPTS.entries()) {
    try {
      return await sendToGemini(request, attempt);
    } catch (err) {
      lastError = err;
      if (!RECOVERABLE.has(err.code)) throw err;

      // Transient overload usually clears on the spot, so give the current
      // model one more go. A spent allowance or a missing model will not.
      if (err.code === "server_error" || err.code === "timeout") {
        await wait(RETRY_DELAY_MS);
        try {
          return await sendToGemini(request, attempt);
        } catch (retryErr) {
          lastError = retryErr;
          if (!RECOVERABLE.has(retryErr.code)) throw retryErr;
        }
      }

      const next = ATTEMPTS[index + 1];
      if (next) console.warn(`[gemini] ${attempt.model} unavailable (${lastError.code}), falling back to ${next.model}`);
    }
  }

  throw lastError;
}

async function sendToGemini({ system, message, format, history }, { model, apiKey }) {
  const payload = {
    contents: [...history, { role: "user", parts: [{ text: message }] }],
    generationConfig: { temperature: format === "json" ? 0.4 : 0.7 },
  };
  if (system) payload.systemInstruction = { parts: [{ text: system }] };
  // Structured features parse the reply as JSON, so ask Google to guarantee the
  // shape rather than stripping markdown fences after the fact.
  if (format === "json") payload.generationConfig.responseMimeType = "application/json";

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), UPSTREAM_TIMEOUT_MS);

  let response;
  try {
    response = await fetch(endpointFor(model), {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify(payload),
      signal: abort.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw Object.assign(new Error("upstream timeout"), { code: "timeout", status: 504 });
    }
    console.error("[gemini] could not reach Google:", err.message);
    throw Object.assign(new Error("upstream unreachable"), { code: "server_error", status: 502 });
  }
  clearTimeout(timer);

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[gemini] upstream ${response.status} for model ${model}: ${detail.slice(0, 400)}`);
    throw Object.assign(new Error("upstream error"), classifyUpstream(response.status));
  }

  const data = await response.json();
  const candidate = data?.candidates?.[0];

  // A candidate can arrive with no text when a safety filter or the token limit
  // stopped generation. Reporting that as "empty" lets the page offer a retry
  // instead of rendering a blank bubble.
  const text = (candidate?.content?.parts || []).map((part) => part.text || "").join("").trim();
  if (!text) {
    const reason = candidate?.finishReason || data?.promptFeedback?.blockReason || "unknown";
    console.error(`[gemini] empty candidate, finishReason=${reason}`);
    throw Object.assign(new Error("empty candidate"), { code: "empty_response", status: 502 });
  }

  return text;
}

app.post("/api/gemini", async (req, res) => {
  if (!API_KEYS.length) {
    console.error("[gemini] GEMINI_API_KEY is not set — copy .env.example to .env and add your key.");
    return res.status(503).json({ error: "invalid_config" });
  }

  const parsed = readRequest(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });

  // Only one-shot structured lookups are cacheable; the key ignores history.
  const cacheable = parsed.format === "json" && parsed.history.length === 0;
  const key = cacheable ? cacheKey(parsed.system, parsed.message, parsed.format) : null;
  if (key) {
    const cached = readCache(key);
    if (cached) return res.json({ text: cached, cached: true });
  }

  try {
    const text = await callGemini(parsed);
    if (key) writeCache(key, text);
    res.json({ text });
  } catch (err) {
    res.status(err.status || 502).json({ error: err.code || "api_error" });
  }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, models: MODELS, keysConfigured: API_KEYS.length });
});

app.use(express.static(path.join(__dirname, "public")));

app.listen(PORT, () => {
  console.log(`Incredible India running at http://localhost:${PORT}`);
  if (!API_KEYS.length) console.warn("WARNING: GEMINI_API_KEY missing — AI features will report as unavailable.");
  else console.log(`Gemini: ${MODELS.join(" then ")} · ${API_KEYS.length} key(s)`);
});
