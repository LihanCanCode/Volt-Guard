# VoltGuard — AI Fall/Crash Detection & Emergency Alert System

Built for VoltHacks 2026. A phone's own accelerometer stands in for dedicated
fall-detection hardware: motion streams in real time to a trained classifier,
and a detected fall triggers a simulated caregiver alert with location — a
full sensor → AI → real-world-action pipeline, demoable by physically
dropping a phone.

See [About the Challenge.md](About%20the%20Challenge.md) for the hackathon brief this targets.

## Architecture

```
frontend/   React (Vite) — Monitor / History / Caregiver View pages
backend/    Node/Express + socket.io — windowing, inference, alerting, SQLite history
ml/         Python — offline training, exports backend/model_weights.json
```

Phone motion (`DeviceMotion`) streams over socket.io to the backend, which
buffers a sliding ~2.5s window per connection, extracts features
(`backend/src/inference/features.js`), and runs a logistic-regression model
(`backend/src/inference/model.js`) trained offline in `ml/`. A detected fall
(`fall-suspected`) starts a 15s countdown on the phone; letting it expire (or
tapping "I need help now") emits `alert-confirmed` to any open Caregiver View
tab and persists the event to SQLite. Tapping "I'm OK" cancels it.

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

## Training data

`ml/generate_dataset.py` procedurally generates labeled accelerometer windows
(fall vs. resting/walking/jogging/sitting-down/standing-up), following the
same fall-vs-ADL evaluation convention used by public datasets like SisFall,
MobiFall/MobiAct, and UMAFall. This keeps the whole pipeline reproducible
offline with no dataset download required. **Known limitation:** a phone
dropped and left lying still on a hard surface can look identical to a human
fall on accelerometer data alone — a real limitation of single-IMU fall
detection, not something masked here. If a real public dataset or actual
phone recordings become available, swap them into `generate_windows()` in
`ml/generate_dataset.py` (same `(samples, label)` output shape) and rerun
`train_model.py` — everything downstream is unchanged. Current model:
100% accuracy / F1 on a held-out synthetic test split (expect lower on real
recordings — the synthetic classes are more cleanly separated than reality).

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

## Verification already run

- `ml/train_model.py`: 100%/100% accuracy/F1 on held-out synthetic test data.
- Simulated socket.io client tests (fall pattern, normal walking, jogging)
  confirmed the full pipeline: `motion-sample` → classification → `fall-suspected`
  → `confirm-alert` → `alert-confirmed`, persisted correctly in
  `GET /api/events`, with zero false positives on walking/jogging.
- Real on-phone motion (actual drop tests, actual iOS/Android permission
  flow) has **not** been tested yet — do this before the live demo.
