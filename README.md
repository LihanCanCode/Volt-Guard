# VoltGuard — AI Fall Detection & Emergency Alert System

**No wearable. No dedicated hardware. Just the phone already in your pocket.**

VoltGuard turns any smartphone into a fall-detection device. It streams live
accelerometer data to a machine-learning model, classifies falls in real time,
and — if you don't cancel a countdown — automatically notifies your emergency
contacts and pushes your location to a live caregiver dashboard. It's a
complete sensor → AI → real-world-action pipeline, and it's demoable in one
move: physically drop the phone.

Built for **VoltHacks 2026** (see [About the Challenge.md](About%20the%20Challenge.md)),
targeting the **Smart Health Technology** and **AI + Hardware Integration** tracks.

---

## Table of contents

- [Why this matters](#why-this-matters)
- [How it works](#how-it-works)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Features](#features)
- [Setup](#setup)
- [Training data & the ML model](#training-data--the-ml-model)
- [Testing](#testing)
- [Demo script](#demo-script)
- [Known limitations](#known-limitations)
- [Where this could go next](#where-this-could-go-next)

---

## Why this matters

Falls are the leading cause of fatal and non-fatal injury among people over
65 — and the danger isn't just the fall itself, it's the time spent
undiscovered afterward ("long lie"), which is strongly correlated with worse
outcomes. Purpose-built fall-detection devices (pendants, smartwatches with
fall detection, medical alert systems) work, but they cost money, need to be
worn consistently, and are often a separate device an elderly person has to
remember to charge and carry.

VoltGuard's premise: **almost everyone already carries a phone.** If a phone's
accelerometer is enough signal to detect a fall, then fall detection can be
free, software-only, and instantly deployable to anyone with a smartphone —
no procurement, no extra hardware, no subscription device. That's the
real-world angle: turning a sensor that already exists in billions of pockets
into a safety net, particularly for elderly users, people recovering from
surgery, people with balance or mobility conditions, or anyone living alone.

## How it works

1. **Sense** — The phone's browser streams live `DeviceMotion` events
   (accelerometer + gravity) over a socket.io connection, tagged with GPS
   coordinates when location permission is granted.
2. **Window** — The backend keeps a rolling ~2.5s buffer of motion samples per
   connected phone and re-classifies on every new sample (throttled to every
   150ms).
3. **Extract features** — Six signal-processing features are computed per
   window: peak/min/mean/std of the Signal Magnitude Vector (SMV), peak jerk
   (rate of change of acceleration), and post-peak stillness (did motion stop
   right after the spike, the way a body does after impact, or keep moving,
   the way normal activity does?).
4. **Classify** — A logistic regression model (trained offline in `ml/`,
   exported to a plain JSON weights file) scores the window's fall
   probability.
5. **Debounce** — Two consecutive above-threshold classifications are required
   before an alert fires, not one. This absorbs single noisy spikes (a hard
   step, bumping the phone) that would otherwise cause false positives.
6. **Confirm or cancel** — A `fall-suspected` event starts a 15-second,
   full-screen countdown on the phone. Tapping **I'm OK** cancels it
   silently. Letting it expire (or tapping **I need help now**) confirms the
   alert.
7. **Notify** — A confirmed alert is broadcast over socket.io to every open
   Caregiver View tab in real time (name, timestamp, GPS pin on a Leaflet
   map) and persisted to SQLite so it shows up in the event History with its
   final outcome (`alerted` or `cancelled`).

## Architecture

```
frontend/   React 19 (Vite) — Monitor / Record / History / Caregiver View / Contacts pages
backend/    Node/Express + socket.io — windowing, feature extraction, inference, alerting, SQLite
ml/         Python — offline dataset generation, training, evaluation; exports backend/model_weights.json
```

```
        DeviceMotion / GPS                 socket.io                    socket.io
 Phone ───────────────────▶ Vite dev proxy ───────▶ Express + socket.io server ───────▶ Caregiver View
  (Monitor page)                                     │        │                          (live map + list)
                                                       │        └─ SQLite (event history)
                                                       ▼
                                          features.js → model.js (logistic regression)
                                                       ▲
                                          trained offline by ml/train_model.py
```

The frontend never talks to the backend on a different port during
development — Vite's dev server proxies `/api` and `/socket.io`, so a phone on
the same Wi-Fi only ever needs the one LAN URL shown in the Vite terminal
output.

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React 19 + Vite 8 | Fast dev server + HMR, small bundle for a mobile-first UI |
| Realtime transport | socket.io-client / socket.io | Bidirectional, reconnect-friendly streaming for continuous motion data |
| Routing | react-router-dom 7 | Multi-page app (Monitor / History / Caregiver / Contacts / Record) |
| Maps | Leaflet + react-leaflet | Lightweight, no API key required, renders the caregiver's live location pin |
| Charts | Recharts | Motion/telemetry visualization |
| Backend | Node.js + Express 5 | REST endpoints for contacts, event history, recordings |
| Realtime server | socket.io | Per-connection session buffers, broadcast rooms (`caregivers`) |
| Persistence | SQLite via `node:sqlite` (`DatabaseSync`) | Zero-config, file-based, no external DB service to run for a hackathon demo |
| ML / training | Python, NumPy, scikit-learn | Feature extraction + logistic regression, trained fully offline |
| Model transport | Plain JSON weights file | No Python runtime needed in production — Node re-implements inference from the exported weights |
| Frontend tests | Vitest 5 + jsdom + Testing Library | Component and unit tests without a real browser |
| Backend tests | `node --test` (built-in) | Zero extra test-runner dependency |
| ML tests | pytest | Standard Python testing, isolated in `requirements-dev.txt` |

## Features

- **Live fall detection** — real accelerometer streaming, real-time inference, real countdown/alert flow (not a canned demo).
- **Debounced classification** — requires two consecutive above-threshold windows, cutting single-spike false positives.
- **Emergency Contacts** — add/remove caregiver contacts (name + relationship) via `/contacts`; shown by name on the alerted screen.
- **Caregiver View** — a second device/tab that receives alerts live via socket.io, with a Leaflet map pin at the reported GPS location.
- **Event History** — every fall event (probability, outcome, timestamp, location) is persisted to SQLite and browsable at `/history`.
- **Record Session** — `/record` lets you capture real phone motion clips (walking, jogging, sitting down, standing up, resting, an actual fall/drop) labeled and saved via the backend, so the model can be retrained on real recordings blended with synthetic data instead of synthetic data alone.
- **Reproducible synthetic training pipeline** — `ml/generate_dataset.py` procedurally generates labeled fall vs. activities-of-daily-living (ADL) windows, seeded for reproducibility, so the whole ML pipeline runs offline with zero dataset download.
- **Automated test coverage across every layer** — backend (`node --test`), ML (`pytest`), and frontend (`vitest`) all have real unit/component test suites (see [Testing](#testing)).

## Setup

**Backend**
```
cd backend
npm install
npm run dev        # http://localhost:4000
```

**Frontend**
```
cd frontend
npm install
npm run dev         # http://localhost:5173
```
Vite proxies `/api` and `/socket.io` to the backend, so the phone only ever
needs one URL.

**ML (optional — a trained `backend/model_weights.json` is already checked in)**
```
cd ml
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt     # PowerShell
python train_model.py
```
Retrains and overwrites `backend/model_weights.json`. Restart the backend
afterward — it loads the model once at process start.

## Training data & the ML model

`ml/generate_dataset.py` procedurally generates labeled accelerometer windows
(fall vs. resting/walking/jogging/sitting-down/standing-up), following the
same fall-vs-ADL evaluation convention used by public datasets like SisFall,
MobiFall/MobiAct, and UMAFall. This keeps the whole pipeline reproducible
offline with no dataset download required — the same seed always produces the
same dataset.

Real phone recordings captured via `/record` (`ml/load_recordings.py`) can be
blended in alongside the synthetic data, so the model isn't trained purely on
simulation — `train_model.py` reports how many real recordings were folded
into training on every run.

**Known limitation:** a phone dropped and left lying still on a hard surface
can look identical to a human fall on accelerometer data alone — a real
limitation of single-IMU fall detection, not something masked here. If a
larger real or public dataset becomes available, swap it into
`generate_windows()` in `ml/generate_dataset.py` (same `(samples, label)`
output shape) and rerun `train_model.py` — everything downstream (feature
extraction, inference, alerting) is unchanged.

Current model: 100% accuracy / F1 on a held-out synthetic test split (expect
lower on real-world recordings — synthetic classes are more cleanly separated
than reality; this is exactly why the Record Session feature exists).

## Testing

Every layer of the stack has its own automated test suite:

```
cd backend && npm test      # node --test — inference, alert debounce logic
cd frontend && npm test     # vitest — sensor capture, Contacts/Record/Monitor pages
cd ml && .venv\Scripts\pip install -r requirements-dev.txt
        .venv\Scripts\python -m pytest    # feature extraction, dataset generation, recording loader
```

What's covered:
- **Backend** — feature extraction math, model inference, and the debounce/consecutive-hit alert logic (`evaluateFallSignal`).
- **Frontend** — `sensorCapture.js` (motion permission handling, `devicemotion` parsing, geolocation), and full component behavior for Contacts (CRUD + error states), Record (permission gating, buffering, minimum-clip-length validation, save/delete), and Monitor (start flow, fall-suspected countdown with auto-confirm, cancel flow, alert-confirmed caregiver lookup) — all driven through Testing Library with mocked sockets/fetch, not implementation internals.
- **ML** — feature math against hand-computed expected values (e.g. an exact jerk-peak spike), dataset generation invariants (label balance, reproducibility under a fixed seed), and the real-recording loader's JSON round-trip.

Deliberately out of scope for this pass: DB/socket integration tests, a
recording review/relabel UI, and an in-app retrain trigger — retraining stays
the explicit `python train_model.py` step above, which keeps the ML pipeline
auditable and prevents an untrusted or noisy recording from silently
retraining the production model.

## Demo script

1. Start both servers (above). On a phone on the same Wi-Fi, open
   `http://<laptop-LAN-IP>:5173` (shown in the Vite terminal output; for
   HTTPS/off-network access, tunnel port 5173 with ngrok/localtunnel — iOS
   requires HTTPS for motion permission).
2. Open `/caregiver` in a second tab/laptop and leave it open.
3. On the phone: `/` (Monitor) → **Start Monitoring** → grant the motion
   permission prompt.
4. Drop the phone onto a soft surface (bed/couch) from standing height.
   The Monitor page should flip to a full-screen "Possible fall detected"
   alert with a 15s countdown.
5. Either tap **I'm OK** to cancel, or **I need help now** / let the
   countdown expire — the Caregiver View tab should light up immediately
   with the alert, timestamp, and a map pin (if location permission was
   granted).
6. Check `/history` — the event is listed with its outcome (`cancelled` or
   `alerted`).
7. For a false-positive check: walk or jog normally with the phone — no
   alert should fire.
8. Optional: visit `/contacts` beforehand and add a contact — their name
   shows up on the alerted screen once a fall is confirmed.
9. Optional: visit `/record` to capture a labeled clip live, showing the
   real-data training loop end to end.

## Verification already run

- `ml/train_model.py`: 100%/100% accuracy/F1 on held-out synthetic test data.
- Simulated socket.io client tests (fall pattern, normal walking, jogging)
  confirmed the full pipeline: `motion-sample` → classification → `fall-suspected`
  → `confirm-alert` → `alert-confirmed`, persisted correctly in
  `GET /api/events`, with zero false positives on walking/jogging.
- Full automated test suites pass across backend, frontend, and ML (see
  [Testing](#testing)).
- Real on-phone motion (actual drop tests, actual iOS/Android permission
  flow) has **not** been tested yet — do this before the live demo.

## Known limitations

- **Single-IMU ambiguity** — a dropped-and-still phone can resemble a fall on
  accelerometer data alone; this is a known constraint of phone-only fall
  detection (see [Training data](#training-data--the-ml-model)).
- **Synthetic-data ceiling** — the model's 100% synthetic accuracy will not
  hold on messier real-world data; the Record Session feature exists
  specifically to close this gap over time.
- **No auth** — Contacts, History, and Caregiver View have no login; fine for
  a single-user hackathon demo, not yet production-ready for multi-tenant use.
- **No push notifications** — the caregiver alert only reaches a Caregiver
  View tab that's already open; there's no SMS/push/email fallback yet.

## Where this could go next

Honest answer: yes, there's meaningful room to grow this beyond the hackathon
scope, in three directions:

**1. Close the "does it actually work on a real fall" gap.**
The single biggest weakness is that the model is trained almost entirely on
synthetic data. The Record Session feature is the foundation for fixing
this — the next step is accumulating enough real recordings (own drop tests,
volunteer ADL clips) to retrain against a real-vs-synthetic blend and
publish an honest accuracy number on real recordings, not just synthetic
holdout.

**2. Make the alert actually reach someone who isn't staring at a browser tab.**
Right now "notify the caregiver" means "a caregiver has a tab open." Real
impact requires an out-of-band channel: SMS via Twilio, push notifications
(web push or a companion PWA), or even a phone call for an unacknowledged
alert. This is the highest-leverage addition for real-world usefulness and
would map directly to the "real world impact" judging criterion.

**3. Fuse more signals to cut the false-positive/false-negative ceiling.**
A second sensor changes the game: gyroscope data (orientation change is a
strong fall signal accelerometer alone can't see), barometric pressure
(sudden altitude drop), or even a simple "are you still lying down after 30
seconds" secondary check before firing the alert. This is exactly the kind
of "AI + Hardware Integration" extension the hackathon track rewards, and it
directly attacks the single-IMU ambiguity limitation above.

Smaller but worthwhile: a settings page for adjusting the fall-probability
threshold and countdown length per user (a more cautious user might want a
5s countdown; a less mobile user might want 30s), and exporting event
history as a CSV for a caregiver's own records.

---

## Devpost submission materials

**Project name:** VoltGuard

**Short description:**
VoltGuard turns any smartphone into a fall-detection device — no wearable,
no dedicated hardware. It streams live accelerometer data to a trained
ML model, detects falls in real time, and automatically alerts emergency
contacts with the user's location if a 15-second safety countdown isn't
cancelled.

**The problem it solves:**
Falls are a leading cause of injury for elderly and mobility-impaired people,
and the real danger is often the time spent undiscovered after the fall.
Dedicated fall-detection devices (medical alert pendants, fall-detection
smartwatches) work, but cost money, require a separate device to be worn and
charged, and are one more thing a vulnerable person has to remember. Nearly
everyone already carries a smartphone. VoltGuard proves that a phone's stock
accelerometer, combined with a purpose-trained classifier, is enough signal
to detect falls and trigger a real alert — with zero additional hardware, so
it's instantly deployable to anyone with a phone.

**How it works (short version):**
Phone motion streams over socket.io to a Node/Express backend, which windows
the signal, extracts six motion features (peak/mean/std of signal magnitude,
peak jerk, post-peak stillness), and classifies the window with a logistic
regression model trained offline in Python. Two consecutive above-threshold
classifications trigger a 15-second on-phone countdown; letting it expire (or
confirming manually) broadcasts a live alert — with GPS location — to any
open Caregiver View, and logs the event to a persistent history.

**What makes it innovative:**
- A complete sensor → AI → real-world-action pipeline that's physically
  demoable (drop the phone, watch the whole system react) rather than a
  static ML demo.
- Debounced, two-stage classification specifically engineered to suppress
  false positives from single noisy readings — a real deployability concern,
  not just a model-accuracy number.
- An offline-reproducible synthetic training pipeline *plus* a real-recording
  capture tool (`/record`), so the model can be improved with genuine
  accelerometer data over time instead of staying frozen on simulated data.
- Zero additional hardware cost or procurement — the entire system runs on
  a phone's existing sensors and a laptop acting as the server.

**Technologies / components used:**
React 19, Vite 8, react-router-dom, Leaflet/react-leaflet, Recharts,
socket.io / socket.io-client, Node.js, Express 5, `node:sqlite`
(`DatabaseSync`), Python, NumPy, scikit-learn, Vitest + Testing Library +
jsdom, pytest, Node's built-in `node --test`.

**Photos/screenshots to capture for submission** (not yet taken — capture
before submitting):
- Monitor page in its idle "Start Monitoring" state.
- The full-screen "Possible fall detected" countdown mid-alert.
- The Caregiver View map with a live alert pin.
- The History page showing a mix of `alerted` and `cancelled` events.
- The Record page mid-capture, and the Contacts page with a saved contact.

**Source code:** https://github.com/LihanCanCode/Volt-Guard

---

## Recording the video demo

**Goal:** show the full sensor → AI → alert loop happening live, not just a
slideshow of screenshots. Aim for **60–90 seconds** — Devpost judges watch a
lot of these, so tight and concrete beats long and narrated.

**Setup before recording:**
- Have two screens visible: the phone (Monitor page) and a laptop/tablet on
  `/caregiver`. Screen-record the laptop with a phone screen-mirroring tool
  (or just prop the phone next to the laptop webcam so both are in frame —
  simplest option, zero setup risk).
- Add at least one contact on `/contacts` beforehand so the alerted screen
  shows a real name, not a placeholder.
- Pre-grant location permission on the phone so the caregiver map pin shows
  up on the first try.

**Shot list, in order:**
1. **(0:00–0:10) Hook.** One sentence to camera or as on-screen text: "This is
   a phone detecting a fall and alerting a caregiver — no extra hardware."
2. **(0:10–0:20) Show the Monitor page idle**, tap **Start Monitoring**, show
   the permission prompt being granted. Quick — this is setup, not the payoff.
3. **(0:20–0:30) The drop.** Physically drop the phone onto a bed/couch from
   standing height, in frame. This is the money shot — make sure the camera
   actually catches the drop and the phone's screen flipping to the
   full-screen countdown immediately after.
4. **(0:30–0:45) The alert firing.** Either let the countdown expire or tap
   "I need help now," then immediately cut to the Caregiver View tab lighting
   up with the alert, timestamp, contact name, and map pin. This is the
   "real-world action" payoff — spend real time here, it's the whole point.
5. **(0:45–0:55) History page.** Quick pan showing the event logged with its
   outcome — proves persistence, not just a live toast.
6. **(0:55–1:10) False-positive check.** Walk or jog normally holding the
   phone for a few seconds with the Monitor page visible — no alert fires.
   This single shot answers the judges' unspoken "does this just go off
   randomly?" question better than any amount of narration.
7. **(1:10–1:20) Optional: Record page.** A two-second glance at `/record`
   capturing a labeled clip, mentioning in narration/text that the model
   improves from real recordings over time — shows technical depth beyond a
   toy demo.
8. **(1:20–end) Close.** One line: what it's built with, and the GitHub link
   on screen.

**Narration tips:**
- Narrate what's *happening on screen*, not what the code does — judges are
  watching a UI, not reading source.
- Say the word "no wearable, no extra hardware" out loud at least once — it's
  the single strongest differentiator and easy to miss if you only show UI.
- If something looks laggy or slow, cut it in editing rather than
  apologizing in narration — a tight cut is more convincing than a caveat.
- End on the alert firing or the false-positive check, not on a settings
  page — leave the viewer on the most impressive moment, not the last one.
