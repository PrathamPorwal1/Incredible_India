# Incredible India — Hackathon Guide

Hack Days Solan · JUIT · Google Gemini API track

Everything in this document describes what the project **actually does** today.
Anything not built yet is listed under "Future work", not claimed as a feature.

---

## 1. One sentence

Incredible India is a travel and heritage site for India where Gemini turns a
static collection of places into something you can hold a conversation with —
ask about a monument, plan a multi-city route, or get advice for today's weather
at the place you're looking at.

---

## 2. Thirty-second pitch

> India has an enormous amount of heritage, and most travel sites present it as
> a list you scroll. You can read a page about Hampi, but you can't ask it
> anything. We built Incredible India as a normal, fast, content-rich site —
> states, monuments, photos, maps, live weather — and then put Gemini
> underneath it. You can ask the guide a question in English or Hindi, keep
> asking follow-ups, plan a route across three cities, or ask what today's
> weather means for your visit. The key stays on our server, so nobody has to
> bring their own.

---

## 3. Sixty-second pitch

> Every Indian tourism site has the same problem. The information is there, but
> it's frozen. If you want to know whether to visit Hampi in June, or what to
> eat there, or how to get from Kanpur to Agra to Vrindavan, you end up with
> eight browser tabs.
>
> Incredible India keeps the curated content — thirty-odd states, real photos
> pulled from Wikipedia, live weather from Open-Meteo, 3D models of monuments —
> and adds Gemini in the places where a static page genuinely can't help.
>
> There's a floating guide you can talk to. It remembers the conversation, so
> "tell me about Jaipur" followed by "when should I visit it" works the way you'd
> expect. There's a route planner where you type three city names and it builds
> an ordered journey with sights, stays and transport between each stop. On any
> monument page you can ask for its history in plain English, then read the same
> thing in Hindi. And the weather card will tell you what the conditions
> actually mean for sightseeing today.
>
> All of it runs through one small Node server that holds the API key, so the
> key is never in the page source and a visitor never sees a setup screen.

---

## 4. Two-minute pitch

Open with the problem, demo, then the engineering.

**Problem.** India has 40+ UNESCO sites and thousands of significant places.
Tourism sites are catalogues: good at telling you a monument exists, bad at
answering the question you actually have. Those questions are personal — my
budget, my dates, my interests, the language I'm comfortable in — and a static
page can't be written in advance for all of them.

**What we built.** A working heritage site with real content, and Gemini layered
on top at six specific points where generation beats a lookup:

1. A conversational guide with memory, in English or Hindi.
2. A multi-city route planner that takes free-text city names and returns an
   ordered journey with sights, stay tiers and transport options per leg.
3. A "explain this monument's history in simple English" button, plus a Hindi
   translation of that explanation.
4. Weather-aware travel advice generated from the live conditions at the place
   you're viewing.
5. Nearby-place recommendations plotted as pins on the map.
6. A budget-and-days shortlist planner for Solan, our host city.

**Why this is a Gemini project and not a website with a chatbot bolted on.**
Every one of those is a case where the answer depends on a combination the
author couldn't pre-write. Weather advice depends on today's temperature and
rain probability. A route depends on which cities you named. A follow-up depends
on what you already asked. That's generation, not retrieval.

**Engineering.** The key lives only on the server. The browser posts to
`/api/gemini`; the server attaches the key and forwards to Google. One shared
transport layer handles timeouts, cancellation and error mapping for all six
features; feature-specific wrappers own their prompts and parsing. Structured
features ask Gemini for JSON via `responseMimeType`; chat asks for plain prose,
because wrapping a conversation in JSON only adds a way for a good answer to be
thrown away.

---

## 5. Problem statement

- Heritage information online is organised for browsing, not for asking.
- The useful question is always specific: *when* should I go, *what* should I
  eat, *how* do I get between these three towns, *why* does this place matter.
- Pre-writing an answer for every combination of budget, dates, interests and
  language is not possible.
- Much of India's audience is more comfortable reading Hindi, and most travel
  content is English-first.

We are not claiming a statistic we did not measure. The argument stands on the
shape of the problem, not on a number.

---

## 6. The solution

### Features that use Gemini

| Feature | Where | What Gemini produces |
| --- | --- | --- |
| AI guide (floating chat) | Every page | Conversational answer, plain prose |
| Multi-city route planner | Home → Route Planner | Sights + stay tiers per stop; transport options per leg |
| Heritage history explainer | Any attraction page | A plain-English paragraph about the site's history |
| Hindi translation of that explanation | Same panel | Devanagari translation |
| Weather travel advice | Attraction → Plan Visit | Advice, three tips, a short packing list |
| Nearby recommendations | Attraction → Plan Visit map | 5–6 nearby places with coordinates, drawn as pins |
| Solan planner | Home → Solan | Shortlist from a fixed local list, chosen for budget + days |
| AI Heritage Guide intro line | Home → AI Heritage Guide | **Only the one-sentence intro.** The itinerary, cost and best-time figures are computed locally |

### Features that do not use Gemini

Be direct about this if asked — it's a strength, not a gap.

- Photos and article text — Wikipedia REST and action APIs.
- Live weather numbers and 5-day forecast — Open-Meteo.
- Login, favourites, trip list, ratings, comments — Supabase.
- 3D monument models — three.js, generated procedurally from each site's
  category and a seeded random number generator. No AI involved.
- Trip cost estimates and seasonality — local rate tables in the page.
- Day-by-day itinerary assembly in the AI Heritage Guide — local logic over the
  curated dataset.
- Voice input — the browser's Web Speech API. **Gemini does no speech
  recognition here.**
- UI translation (menus, labels) — a static English→Hindi dictionary.

---

## 7. Why Gemini

Reasons that hold up under questioning:

- **The output is genuinely open-ended.** Six different features, six different
  output shapes. A classifier or a search index cannot produce "what today's
  38°C and 40% rain means for walking around Hampi".
- **Strong Hindi.** The assistant answers in natural Devanagari, and translates
  the history explanation into Hindi, without a separate translation service.
- **Reliable structured output.** `responseMimeType: "application/json"` lets
  the route planner and weather advice parse the reply directly instead of
  scraping markdown fences out of prose. That is the difference between a demo
  that works and one that intermittently throws.
- **Long context and multi-turn.** Follow-up questions work because we can send
  prior turns cheaply.
- **Latency.** Flash-class models answer in a couple of seconds, which is what a
  chat widget needs.

Do not answer "because it's a Gemini hackathon."

---

## 8. What Gemini does, feature by feature

Each follows the same path: **input → what we send → what comes back → what the
UI does with it.**

### Chat guide
- **Input:** the typed message, plus up to 20 previous turns.
- **We send:** a system instruction defining the assistant as an India travel
  and culture guide (concise, prose only, resolve pronouns against earlier
  turns, say when unsure), the history as alternating `user`/`model` turns, and
  the new message. `format: "text"`.
- **Back:** a paragraph of prose.
- **UI:** rendered into a chat bubble; the header status flips to "Online".

### Route planner
- **Input:** free text like `Kanpur, Agra, Vrindavan`. Parsed client-side into
  an ordered list, with fuzzy matching for misspellings.
- **We send:** one JSON request per stop (3–4 attractions + 3 stay tiers) and
  one per gap between stops (2–3 transport options with duration and fare).
- **Back:** JSON matching the requested schema.
- **UI:** numbered stop cards with photos, plus a transport strip between each
  pair. If a call fails, a curated offline dataset fills in — and the card is
  labelled "Verified fallback data" rather than passed off as AI output.

### Heritage history explainer
- **Input:** the attraction's curated overview, history bullets and timeline.
- **We send:** those facts with an instruction to retell them in very simple
  English, 4–6 short sentences. `format: "json"`, shape `{explanation}`.
- **Back:** one grounded paragraph.
- **UI:** a panel badged "Powered by Gemini AI", with "Read in Hindi" and
  "Regenerate".

Grounding matters here: we hand Gemini our own facts and ask it to rephrase,
which keeps it from inventing dates.

### Hindi translation
- **Input:** the English explanation just generated.
- **We send:** a translate-to-simple-Hindi instruction, `{translation}`.
- **UI:** swaps the panel text; the English version stays cached for toggling back.

### Weather travel advice
- **Input:** live Open-Meteo readings for that attraction — temperature, feels-like,
  humidity, wind, visibility, 5-day forecast.
- **We send:** those numbers plus the place name, asking for
  `{advice, tips[3], pack[2-4]}`.
- **Back:** practical guidance for sightseeing today.
- **UI:** advice paragraph, three bullets, packing chips.

This is the clearest "why Gemini" demo: the answer literally cannot exist until
the weather is fetched.

### Nearby recommendations
- **Input:** the attraction's latitude and longitude.
- **We send:** a request for 5 real places within ~5–8 km, each with a name,
  one-word category, a short note and approximate coordinates.
- **Back:** JSON array.
- **UI:** projected onto the embedded OpenStreetMap and drawn as coloured pins,
  with a matching list underneath. Clicking either highlights the other.

### Solan planner
- **Input:** budget and number of days.
- **We send:** the fixed list of eight real Solan-area places with their cost
  tiers, asking Gemini to pick and justify a subset.
- **Back:** `{picks[], note}`.
- **UI:** a numbered shortlist. Gemini chooses from our list — it never invents
  a place. If the call fails, a local heuristic picks instead.

---

## 9. User flow

```
Open http://localhost:3000
   → hero + search (Wikipedia-backed, live)
   → browse by category / region / state
   → open a state → open an attraction
        3D model · photo gallery · tabs
        "Tell me the history with Gemini"      → Gemini
        Plan Visit tab
             live weather (Open-Meteo)
             "Ask Gemini for travel advice"    → Gemini
             map + nearby pins                 → Gemini
   → Route Planner: type cities                → Gemini
   → floating guide, any page, any time        → Gemini
```

---

## 10. Architecture

```
Browser (single-page React, compiled in-page by Babel)
   │  POST /api/gemini  { system, message, history, format }
   ▼
Node + Express  (server.js)
   ├─ validate and cap the payload
   ├─ serve a cached answer for repeated structured prompts
   ├─ attach GEMINI_API_KEY from the environment
   ▼
Google Gemini  generateContent
   ▲
   │  candidate text
Node
   ├─ map upstream failures to a stable code
   ├─ retry once on a transient 503
   ▼
Browser  { text }  → parsed as JSON, or shown as prose
```

### Front end

One HTML file. React 18 + Babel from CDN, no build step. The Gemini code is
three layers:

```
requestGemini()        transport: fetch, timeout, abort, error codes, status
   ├── callGeminiForRoute()   asks for JSON, parses it — used by 8 call sites
   └── requestChatReply()     asks for prose — used by the chat widget
```

Splitting it this way is what let us change the chat response format without
touching the route planner.

### Back end

`server.js`, about 190 lines, two dependencies (`express`, `dotenv`).

- `POST /api/gemini` — the only AI route.
- `GET /api/health` — model in use, whether a key is present.
- `express.static("public")` — serves the site.

---

## 11. Chat request flow

```
user types, presses Enter
   ├─ blocked if already sending, if empty, if >1500 chars,
   │  or if the last send was under a second ago
   ├─ user bubble appended, input cleared, typing dots shown
   ├─ last 20 turns mapped to { role, text }
   ▼
POST /api/gemini { format: "text", system, message, history }
   ▼
server validates, attaches key, calls Gemini
   ▼
{ text }  → AI bubble, typing dots removed, status → "Online"

on failure → typing dots removed, one friendly bubble, still sendable
```

---

## 12. Why a backend at all

The honest answer, and the one to give a judge:

> Anything in a web page is public. Minifying, Base64-encoding, or splitting a
> key across variables doesn't change that — you open DevTools and read it. A
> stolen key is billed to us and can be used from anywhere. The only real fix
> is that the key must never be sent to the browser, which means something we
> control has to make the call. That's what the Node server does. It also lets
> us validate input, cache repeated answers to conserve quota, and keep Google's
> raw error bodies out of the client.

The previous version of this project had the key in the HTML. We removed it and
assume it is compromised.

---

## 13. API key security, concretely

- `GEMINI_API_KEY` is read from `process.env`, only in `server.js`.
- `.env` holds the real value and is listed in `.gitignore`.
- `.env.example` is committed and contains `your_key_here`.
- No route ever returns the key; `/api/health` returns only a boolean.
- Upstream error bodies are logged to the server console, never forwarded — a
  Google 400 can echo your prompt and name your project.
- The client receives only a fixed code (`rate_limited`, `invalid_config`, …)
  which it maps to a friendly sentence.

---

## 14. Tech stack

| Layer | What | Why | Where |
| --- | --- | --- | --- |
| UI | React 18 + Babel standalone | No build step; the whole site is one file that opens anywhere | `public/index.html` |
| 3D | three.js r128 | Procedural stylised monument models | `Monument3D` |
| Server | Node 18+, Express 4 | Smallest thing that can hold a secret and serve files | `server.js` |
| Config | dotenv | Key out of source | `.env` |
| AI | Gemini `generateContent`, `gemini-3.6-flash` | Prose + JSON, strong Hindi, fast | `/api/gemini` |
| Photos/text | Wikipedia REST + action API | Real images, no key needed | `fetchWikiThumb`, `fetchWikiSummary` |
| Weather | Open-Meteo | Free, CORS-enabled, no key | `fetchLiveWeather` |
| Maps | OpenStreetMap embed | No key, no quota | `LocationMap` |
| Auth/data | Supabase | Login, favourites, ratings, comments | `supabaseClient` |
| Voice | Web Speech API | Built into Chrome/Edge | `GeminiChatWidget` |
| Tests | Puppeteer | Drive real Chrome against a real server | `tests/` |

---

## 15. Prompt design

Two principles.

**Ground it in our own data where we have data.** The heritage explainer is
handed the curated overview, history bullets and timeline and asked to *retell*
them simply. The Solan planner is handed eight real places and asked to *choose*.
This is what stops it from inventing a monument.

**Constrain the output shape, but only where shape matters.** The route planner
and weather advice declare an exact JSON schema in the prompt *and* set
`responseMimeType: "application/json"`. Chat does neither — it's told to reply
as plain prose with no JSON and no markdown, because a conversation has no
structure worth validating and the envelope was only a failure mode.

The chat system prompt sets scope (India travel, heritage, food, festivals,
itineraries), length (~90 words for ordinary questions), the pronoun rule
(resolve "it"/"there" against earlier turns), an honesty rule (say when unsure
rather than invent), and the reply language.

---

## 16. Conversational memory

There is no server-side session. Each request carries its own context:

1. The widget keeps messages in React state and mirrors them to `sessionStorage`.
2. On send, the last 20 messages are mapped to `{ role: "user" | "model", text }`.
3. The server validates that list and converts it to Gemini's `contents` array,
   appending the new message last.
4. Gemini sees the full exchange, so "when should I visit it?" resolves.

Verified: *Tell me about Hampi* → *When should I visit it?* → *What food should
I try there?* all resolved correctly in a browser test.

---

## 17. Why cap the history

- **Tokens cost money and time.** Every turn is re-sent on every request; an
  uncapped conversation grows the bill and the latency linearly.
- **Relevance decays.** Twenty turns back is usually noise, and noise pushes the
  model off the current question.
- **Bounded requests.** A cap means one message can't grow into a megabyte
  payload. The server enforces its own limit (20 turns, 4000 chars each) so a
  crafted client can't bypass it.

---

## 18. Hindi and multilingual support

Three distinct mechanisms — worth separating if asked:

1. **UI chrome** — a static English→Hindi dictionary in the page. No AI.
2. **Chat replies** — the system prompt is selected by the site's language
   toggle, not by the language of the question. Browsing in Hindi and typing in
   English still gets a Hindi answer. Verified in a browser test.
3. **History translation** — a second Gemini call that translates the generated
   English explanation into simple Hindi.

Long-form curated content (overviews, facts, timelines) stays English.

---

## 19. Voice input

The microphone uses the browser's **Web Speech API** (`SpeechRecognition` /
`webkitSpeechRecognition`). Gemini is not involved in transcription.

- Recognition language follows the site toggle (`hi-IN` / `en-IN`).
- Interim results stream into the text field as you speak.
- It never auto-sends. You review, edit, then press Send.
- Unsupported browsers (Safari, Firefox) get a disabled button with a tooltip.
- Denied permission produces a specific message; a deliberate stop produces none.

---

## 20. Error handling

| Situation | User sees | Notes |
| --- | --- | --- |
| No connection | "You seem to be offline — check your internet connection and try again." | Short-circuits on `navigator.onLine` |
| Request too slow | "That's taking too long to respond — please try again." | 18s client cap, 25s server cap |
| Quota / rate limit | "The assistant is busy right now. Please try again in a moment." | Upstream 429 |
| Key or model wrong | "The AI assistant is temporarily unavailable." | Upstream 400/401/403/404; real reason logged server-side |
| Google overloaded | Same, after one automatic retry | Upstream 503 |
| Reply unusable | "Something went wrong reading the AI's response — please try again." | Empty candidate, safety stop, malformed JSON |
| Widget closed mid-request | Nothing | Cancellation is not an error |

The typing indicator is cleared in a `finally` block, so the widget can never
stay stuck on "typing".

---

## 21. Duplicate-send protection

Three independent guards:

1. A ref flipped synchronously on send — React state updates are batched, so a
   double Enter in one tick would slip past a state check.
2. The React `typing` flag disables the Send button.
3. A one-second minimum between accepted sends.

Verified: three Enter presses in a row produce exactly one reply.

---

## 22. Quota, and how we stay inside it

Google's free tier is roughly 20 requests per day **per model**, and every
visitor shares the server's key. That is what broke the original version.

Mitigations in place:

- **Automatic failover.** `GEMINI_MODEL` and `GEMINI_API_KEY` both accept a
  comma-separated list. When a model returns 429 (allowance spent), 503
  (overloaded) or 404 (retired), the server moves to the next entry and answers
  from there. The visitor sees a normal reply; only the server log records the
  switch. Three models is roughly three times the allowance.
- **Caching.** Structured answers are held in memory for six hours, keyed on the
  prompt. Revisiting a monument or replanning the same route costs nothing.
- **Chat is deliberately not cached:** two people typing "hi" should not get the
  same sentence, and an instant reply reads as fake.
- **Billing** on the key removes the limit outright.

A rejected key or a malformed request is *not* retried across the list — those
fail identically everywhere, so retrying would only hide the error you need to
see. Verified: a bad key fails in under half a second after exactly one upstream
call.

### If the quota runs out mid-demo

Ranked by how well they work:

1. **Enable billing beforehand.** Pennies for a demo, and the only option that
   cannot run out. Do this the night before.
2. **List several models** in `.env` — the failover above.
3. **Warm the cache** by walking the demo path once before you present. The
   route planner, heritage explainer, weather advice and nearby pins then answer
   from cache and spend nothing. Chat still costs a request per message.
4. **Have a recorded screen capture** of the full demo as insurance. Say plainly
   that it is a recording if you have to fall back to it.

If it does happen live, the honest answer is a good one: *"That's Google's free
tier — twenty requests a day per model, shared by everyone hitting this server.
The server fails over across models automatically, and in production you'd
enable billing. The architecture doesn't change."* Judges understand quota
limits; they do not forgive pretending.

---

## 23. Testing

Two Puppeteer suites drive a real Chrome against a running server.

`npm run test:chat` — 20 checks: page renders without a JS error, no key in the
served HTML, chat opens, replies arrive, follow-up context resolves across three
turns, typing indicator appears and clears, input clears, Send disabled when
empty, rapid Enter sends once, status becomes "Online", history survives
close/reopen and a reload, Hindi replies in Devanagari, mobile layout is
full-screen with the input bar visible and no horizontal scroll, offline shows
the right message and clears typing state.

`npm run test:features` — route planner, heritage explainer, Hindi translation,
nearby pins, weather advice, Solan planner. It asserts that every `/api/gemini`
response was **200**, so a local fallback cannot masquerade as a passing AI test.
That guard caught two false passes while we were building it.

---

## 24. Likely judge questions

**"Show me it isn't hardcoded."** Open DevTools → Network → ask a question →
point at the `/api/gemini` POST and its response. Then ask something off-script.

**"Where's your API key?"** View source, search for it, it isn't there. Show
`.env`, `.gitignore`, and the one line in `server.js` that reads
`process.env.GEMINI_API_KEY`.

**"Why not call Gemini from JavaScript directly?"** Section 12.

**"Is the whole site AI-generated?"** No — section 6 lists what isn't. Photos
are Wikipedia, weather is Open-Meteo, 3D models are procedural three.js, auth is
Supabase. Gemini is used at six specific points.

**"What if Gemini is down?"** The route planner and Solan planner fall back to
curated data and say so on-screen. Chat shows a specific, friendly error and
stays usable. Nothing pretends a fallback is an AI answer.

**"Does it hallucinate?"** It can, like any LLM. We reduce it by grounding:
the heritage explainer is handed our own facts to rephrase, the Solan planner
chooses from a fixed list. AI panels carry a "verify before heading out" note.

**"What does Gemini do that a database couldn't?"** Weather advice is the
cleanest example — the answer depends on the temperature and rain probability
fetched seconds earlier. Also follow-up questions, and free-text route input
with misspellings.

**"What was hardest?"** The failure was a shared free-tier key exhausting its
20-requests-per-day quota, which surfaces as a generic error. Finding it meant
querying the API directly instead of trusting the code comments — which claimed
the key was probably revoked. It wasn't; it was rate-limited.

---

## 25. Demo script (about four minutes)

1. **Open the site.** Scroll the hero, one category, one state. Establishes that
   there is a real product here.
2. **Open a monument.** Rotate the 3D model. Click *Tell me the history with
   Gemini* → read two lines → click *Read in Hindi*. Two features, ten seconds.
3. **Plan Visit tab.** Live weather appears, then nearby pins draw themselves on
   the map. Click *Ask Gemini for travel advice* — point out that this answer
   depends on today's numbers.
4. **Route Planner.** Type `Kanpur, Agra, Vrindavan`. Let it build. Show sights,
   stays and the transport strip between legs.
5. **Floating guide.** Ask *Tell me about Hampi*, then *When should I visit it?*,
   then *What food should I try there?* Say out loud that the second question
   never names Hampi.
6. **Switch to Hindi**, ask the same thing in English, get a Hindi answer.
7. **Close with the architecture.** DevTools Network tab, the `/api/gemini`
   call, and "the key is on the server, not in this page."

Have a phone or a narrow window ready for the mobile view.

---

## 26. Known limits

- Free-tier quota is shared by all visitors (section 22).
- Gemini can be wrong; AI panels say to verify.
- Speech recognition is Chrome/Edge only — a browser limitation.
- The AI Heritage Guide's itinerary is computed locally; only its intro line is
  generated. Do not present it as an AI-planned trip.
- Hotel prices are illustrative unless the optional Amadeus test key is connected.
- Six of the Heritage-at-Risk entries reference sites with no attraction page
  yet; the UI says so instead of hiding it.

---

## 27. Future work

Not implemented. Present only as direction if asked.

- Per-IP rate limiting and a request budget on the server.
- Streamed chat responses.
- Persisting conversations per signed-in user.
- Grounding the chat in the site's own dataset (retrieval) so it cites pages.
- Image understanding: photograph a monument, get the history.
- More Indian languages beyond Hindi.

---

## 28. Numbers worth knowing

- One HTML file, ~13,700 lines; a ~190-line server; two runtime dependencies.
- 36 states and union territories, 60+ attractions with full detail pages.
- 6 Gemini-powered features, 9 call sites, 1 shared transport layer.
- 20-turn chat context cap, 18s client timeout, 25s server timeout, 6h cache.
- Verified: 20/20 chatbot checks and every Gemini feature returning HTTP 200
  in a real browser.
