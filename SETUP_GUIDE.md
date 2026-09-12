# Incredible India — Setup Guide

Everything you need to get this running on your own machine, from nothing.
No prior Node.js experience assumed. Takes about five minutes.

---

## What this is

A website about India's states, monuments and heritage, with Google Gemini
built into it — a chat guide you can ask questions, a multi-city route planner,
history explanations, weather-aware travel advice and more.

It has two parts:

- **The website** — one HTML file in `public/`.
- **A small server** — `server.js`. It exists so the Google API key stays on
  the machine running the server instead of being visible in the web page.

You need the server running for the AI features to work. Everything else
(photos, maps, live weather, 3D models) works regardless.

---

## Step 1 — Install Node.js

Node is what runs the server.

1. Go to **<https://nodejs.org>**
2. Download the **LTS** version (the left-hand button).
3. Run the installer, accept the defaults, click through to the end.

Check it worked. Open a terminal:

- **Windows** — press `Win`, type `powershell`, press Enter.
- **macOS** — press `Cmd+Space`, type `terminal`, press Enter.

Type this and press Enter:

```
node -v
```

You should see a version number like `v22.14.0`. Anything **v18 or higher** is
fine. If you get "command not found", close the terminal, open a new one and try
again — the installer needs a fresh terminal to take effect.

---

## Step 2 — Get a Google Gemini API key

Free, takes a minute.

1. Go to **<https://aistudio.google.com/apikey>**
2. Sign in with a Google account.
3. Click **Create API key**.
4. Copy the key. It's a long string of letters and numbers.

Keep it somewhere for the next step. Treat it like a password — don't paste it
into a chat, a screenshot, or a public repository.

---

## Step 3 — Put the project somewhere

If you were sent a ZIP file, unzip it. Put the folder somewhere simple, for
example:

- Windows: `C:\Users\YourName\Documents\incredible-india`
- macOS: `~/Documents/incredible-india`

Avoid folder names with unusual characters.

---

## Step 4 — Open a terminal in that folder

**Windows:** open the folder in File Explorer, click the address bar, type
`powershell` and press Enter.

**macOS:** open Terminal and type `cd ` (with a space), then drag the folder
onto the Terminal window and press Enter.

To confirm you're in the right place, type:

```
dir        (Windows)
ls         (macOS)
```

You should see `server.js`, `package.json` and a `public` folder listed.

---

## Step 5 — Install the dependencies

```
npm install
```

This downloads the two libraries the server needs. It takes 10–30 seconds and
prints a few lines. Warnings are normal; errors are not.

You only ever do this once.

---

## Step 6 — Add your API key

The project includes a file called `.env.example`. Make a copy of it named
`.env` and put your key inside.

**Windows (PowerShell):**

```
Copy-Item .env.example .env
notepad .env
```

**macOS:**

```
cp .env.example .env
open -e .env
```

The file opens in a text editor. Change this line:

```
GEMINI_API_KEY=your_key_here
```

to your actual key:

```
GEMINI_API_KEY=AIzaSy...your real key...
```

No quotes, no spaces around the `=`. Save and close.

> `.env` is deliberately excluded from Git, so your key never ends up in a
> repository by accident.

---

## Step 7 — Start it

```
npm start
```

You should see:

```
Incredible India running at http://localhost:3000
```

Leave this terminal window open. Closing it stops the server.

---

## Step 8 — Open the site

Go to **<http://localhost:3000>** in Chrome or Edge.

Click the glowing circle in the bottom-right corner and ask it something, for
example *"Tell me about Hampi."*

If you get an answer, everything works.

### To stop the server

Click the terminal window and press `Ctrl + C`.

### To start it again tomorrow

Open a terminal in the folder and run `npm start`. That's it — steps 1 to 6 are
one-time only.

---

## Using the site

**The AI guide (bottom-right circle)**
Ask anything about travelling in India. It remembers the conversation, so you
can ask *"Tell me about Jaipur"* and then *"When should I visit it?"* without
repeating yourself. There's a microphone button if you'd rather speak (Chrome
and Edge only) — it types what you say into the box, and you press Send.

**Language**
The `हिं` / `EN` button in the header switches the whole site between English
and Hindi. The AI answers in whichever one is selected, even if you type your
question in the other language.

**Browse**
Pick a category (Forts, Temples, Palaces…) or a region, then a state, then a
place. Every place has photos, a rotatable 3D model, history, architecture and
a timeline.

**On a monument page**
- *Tell me the history with Gemini* — a plain-English explanation, with a
  *Read in Hindi* button.
- *Plan Visit* tab — live weather, an interactive map with AI-suggested nearby
  places, travel routes, and hotel and bus booking links.
- *Ask Gemini for travel advice* — advice based on today's actual weather there.

**Route Planner** (on the home page)
Type city names — `Kanpur, Agra, Vrindavan` — and it builds an ordered journey
with sights, places to stay and transport options between each stop. Spelling
mistakes are handled.

**Plan a trip**
Pick a region and number of days for a day-by-day itinerary with a cost
estimate. This one is calculated from the site's own data, not AI.

**Sign in** (optional)
Creates an account so favourites, ratings and comments are saved across visits.

---

## If something goes wrong

**"npm is not recognised"**
Node isn't installed, or the terminal was open before you installed it. Close
the terminal, open a new one, try again.

**"Cannot find module 'express'"**
You skipped step 5. Run `npm install`.

**"EADDRINUSE: address already in use :::3000"**
The server is already running in another window, or something else is using
port 3000. Either close the other window, or start it on a different port:

```
Windows:  $env:PORT=4000; npm start
macOS:    PORT=4000 npm start
```

Then open `http://localhost:4000`.

**The page loads, but the AI says "temporarily unavailable"**
Your key is missing or wrong. Check `.env` has no typos, no quotes, no trailing
spaces. Then restart the server (`Ctrl + C`, then `npm start`). You can also
visit <http://localhost:3000/api/health> — it will tell you whether a key was
found.

**"The assistant is busy right now"**
You've hit Google's free daily limit — about 20 requests per day per model. It
resets after 24 hours. Three ways around it:

- **List several models** in `.env`. Each one has its own separate allowance and
  the server moves to the next automatically when one runs out:
  ```
  GEMINI_MODEL=gemini-3.6-flash,gemini-3.5-flash,gemini-3.8-flash
  ```
- **List several keys** the same way. Each key is a separate Google project, so
  each brings its own allowance:
  ```
  GEMINI_API_KEY=key_one,key_two
  ```
- **Enable billing** on your key in Google AI Studio, which removes the limit.
  This is the only option that genuinely cannot run out.

**"You seem to be offline"**
Check your internet connection.

**The AI features do nothing at all, and the browser console shows an error
about `/api/gemini`**
You probably opened `public/index.html` by double-clicking it. That won't work —
the AI needs the server. Use `npm start` and open `http://localhost:3000`.

**The microphone button is greyed out**
Your browser doesn't support speech recognition. Use Chrome or Edge.

---

## Sharing it with someone else

**Sending the files.** Zip the project folder, but **delete `node_modules` and
`.env` first**. `node_modules` is large and gets rebuilt by `npm install`, and
`.env` contains your key — the recipient should create their own.

What they receive should look like:

```
incredible-india/
├── server.js
├── package.json
├── package-lock.json
├── .env.example
├── .gitignore
├── README.md
├── SETUP_GUIDE.md
├── HACKATHON_COMPLETE_GUIDE.md
├── public/index.html
└── tests/
```

Then point them at this guide.

**Letting someone try it without installing anything.** Put it online instead.
Free hosts that run Node apps include Render, Railway and Fly.io. The general
shape is the same on all of them:

1. Push the project to a GitHub repository (`.env` is already ignored).
2. Create a new **Web Service** on the host and connect the repository.
3. Build command: `npm install` — Start command: `npm start`.
4. In the host's dashboard, add an environment variable named
   `GEMINI_API_KEY` with your key as the value. **Never** commit the key.
5. Deploy. You get a public URL to share.

The server already reads `PORT` from the environment, which is what these hosts
require, so no code changes are needed.

**One caution before you share a link.** Everyone using that URL shares your one
API key and its quota. On the free tier that's exhausted quickly. Enable billing
before sharing a link widely, or expect it to stop answering.
