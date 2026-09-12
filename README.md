# Incredible India

India heritage and travel explorer. Static front end, plus a small Node server
that proxies Google Gemini so the API key never reaches the browser.

```
incredible-india/
├── server.js            Express server: static files + POST /api/gemini
├── package.json
├── .env                 your key (git-ignored, never commit)
├── .env.example
├── public/index.html    the site
└── tests/               Puppeteer checks against a running server
```

## Run it

```bash
npm install
```

Create `.env` (copy from `.env.example`) and put a Gemini API key in it:

```
GEMINI_API_KEY=your_key_here
```

Get a key at <https://aistudio.google.com/apikey>.

```bash
npm start
```

Open **<http://localhost:3000>**.

Opening `public/index.html` directly from disk will not work for the AI
features — there is no `/api/gemini` behind a `file://` URL. Everything else
(photos, maps, live weather, 3D models) still renders.

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Required. Server-side only. Comma-separated list allowed. |
| `GEMINI_MODEL` | `gemini-3.6-flash` | Comma-separated list, tried in order. |
| `PORT` | `3000` | HTTP port. |

Both lists exist for failover. Google meters the free tier per project **per
model**, so a second model name is a second allowance and a second key is
another project again. The first entry is always preferred; the rest are used
only when one is exhausted, retired or overloaded:

```
GEMINI_MODEL=gemini-3.6-flash,gemini-3.5-flash,gemini-3.8-flash
```

`GET /api/health` reports the model in use and whether a key is configured.

## Free-tier quota

Google's free tier allows roughly 20 requests per day per model, and every
visitor shares the server's key. Listing several models (above) multiplies the
allowance, and the server moves to the next one automatically. Enabling billing
on the key removes the limit entirely. When everything is spent the site says
"The assistant is busy right now" rather than breaking.

Answers to the structured features (route stops, transport legs, weather
advice, heritage explanations, nearby pins) are cached in memory for six hours,
so revisiting a place costs nothing. Chat is never cached.

## Tests

The test scripts drive a real Chrome against a running server.

```bash
npm start            # in one terminal
npm run test:chat        # chatbot: replies, follow-up context, Hindi, errors, mobile
npm run test:features    # route planner, heritage explainer, weather advice, Solan
```

They expect Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`;
edit `executablePath` in `tests/*.mjs` for another machine. Each run spends
real Gemini quota.
