import express from "express";
import cors from "cors";
import http from "node:http";
import { Server } from "socket.io";
import eventsRouter from "./routes/events.js";
import contactsRouter from "./routes/contacts.js";
import { classifyWindow } from "./inference/model.js";
import { evaluateFallSignal } from "./inference/alertDecision.js";
import { insertEvent, setEventOutcome } from "./db/db.js";

const PORT = process.env.PORT || 4000;
const WINDOW_MS = 2500; // sliding window of motion history used per classification
const MIN_WINDOW_MS = 1000; // don't classify until we have at least this much data
const CLASSIFY_INTERVAL_MS = 150; // throttle how often we re-run inference
const FALL_PROBABILITY_THRESHOLD = 0.6;
const COOLDOWN_MS = 8000; // suppress re-triggering while an alert is pending/just resolved

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api/events", eventsRouter);
app.use("/api/contacts", contactsRouter);
app.get("/api/health", (req, res) => res.json({ ok: true }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// One sensor buffer + alert state per connected "monitor" socket.
const sessions = new Map();

io.on("connection", (socket) => {
  sessions.set(socket.id, {
    buffer: [],
    lastClassifyAt: 0,
    lastLocation: null,
    activeEventId: null,
    cooldownUntil: 0,
    consecutiveHits: 0,
  });

  socket.on("join-caregiver", () => {
    socket.join("caregivers");
  });

  socket.on("location-update", ({ lat, lon }) => {
    const session = sessions.get(socket.id);
    if (session) session.lastLocation = { lat, lon };
  });

  socket.on("motion-sample", (sample) => {
    const session = sessions.get(socket.id);
    if (!session) return;

    session.buffer.push(sample);
    const latestT = sample.t;
    session.buffer = session.buffer.filter((s) => latestT - s.t <= WINDOW_MS);

    const windowSpan = session.buffer[session.buffer.length - 1].t - session.buffer[0].t;
    const now = Date.now();
    if (
      windowSpan < MIN_WINDOW_MS ||
      now - session.lastClassifyAt < CLASSIFY_INTERVAL_MS ||
      now < session.cooldownUntil ||
      session.activeEventId !== null
    ) {
      return;
    }
    session.lastClassifyAt = now;

    const { probability, source } = classifyWindow(session.buffer);
    if (evaluateFallSignal(session, probability, { threshold: FALL_PROBABILITY_THRESHOLD })) {
      const event = insertEvent({
        probability,
        lat: session.lastLocation?.lat ?? null,
        lon: session.lastLocation?.lon ?? null,
      });
      session.activeEventId = event.id;
      console.log(`[fall-suspected] event=${event.id} p=${probability.toFixed(2)} source=${source}`);
      socket.emit("fall-suspected", { ...event, source });
    }
  });

  socket.on("confirm-alert", ({ eventId }) => {
    const session = sessions.get(socket.id);
    if (!session || session.activeEventId !== eventId) return;
    setEventOutcome(eventId, "alerted");
    const payload = {
      eventId,
      timestamp: new Date().toISOString(),
      lat: session.lastLocation?.lat ?? null,
      lon: session.lastLocation?.lon ?? null,
    };
    io.to("caregivers").emit("alert-confirmed", payload);
    socket.emit("alert-confirmed", payload);
    session.activeEventId = null;
    session.cooldownUntil = Date.now() + COOLDOWN_MS;
  });

  socket.on("cancel-alert", ({ eventId }) => {
    const session = sessions.get(socket.id);
    if (!session || session.activeEventId !== eventId) return;
    setEventOutcome(eventId, "cancelled");
    socket.emit("alert-cancelled", { eventId });
    session.activeEventId = null;
    session.cooldownUntil = Date.now() + COOLDOWN_MS;
  });

  socket.on("disconnect", () => {
    sessions.delete(socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
