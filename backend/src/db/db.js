import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const db = new DatabaseSync(path.join(__dirname, "events.db"));

db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    createdAt TEXT NOT NULL,
    probability REAL NOT NULL,
    outcome TEXT NOT NULL DEFAULT 'pending',
    lat REAL,
    lon REAL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    relationship TEXT,
    createdAt TEXT NOT NULL
  )
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL,
    samples TEXT NOT NULL,
    sampleCount INTEGER NOT NULL,
    durationMs REAL NOT NULL,
    createdAt TEXT NOT NULL
  )
`);

const insertStmt = db.prepare(
  `INSERT INTO events (createdAt, probability, outcome, lat, lon) VALUES (?, ?, ?, ?, ?)`
);
const updateOutcomeStmt = db.prepare(
  `UPDATE events SET outcome = ? WHERE id = ?`
);
const listStmt = db.prepare(
  `SELECT * FROM events ORDER BY id DESC LIMIT 100`
);

const insertContactStmt = db.prepare(
  `INSERT INTO contacts (name, relationship, createdAt) VALUES (?, ?, ?)`
);
const deleteContactStmt = db.prepare(`DELETE FROM contacts WHERE id = ?`);
const listContactsStmt = db.prepare(`SELECT * FROM contacts ORDER BY id ASC`);

const insertRecordingStmt = db.prepare(
  `INSERT INTO recordings (label, samples, sampleCount, durationMs, createdAt) VALUES (?, ?, ?, ?, ?)`
);
const deleteRecordingStmt = db.prepare(`DELETE FROM recordings WHERE id = ?`);
const listRecordingsStmt = db.prepare(
  `SELECT id, label, sampleCount, durationMs, createdAt FROM recordings ORDER BY id DESC`
);
const exportRecordingsStmt = db.prepare(
  `SELECT label, samples FROM recordings ORDER BY id ASC`
);

export function insertEvent({ probability, lat = null, lon = null }) {
  const createdAt = new Date().toISOString();
  const result = insertStmt.run(createdAt, probability, "pending", lat, lon);
  return { id: Number(result.lastInsertRowid), createdAt, probability, outcome: "pending", lat, lon };
}

export function setEventOutcome(id, outcome) {
  updateOutcomeStmt.run(outcome, id);
}

export function listEvents() {
  return listStmt.all();
}

export function insertContact({ name, relationship = null }) {
  const createdAt = new Date().toISOString();
  const result = insertContactStmt.run(name, relationship, createdAt);
  return { id: Number(result.lastInsertRowid), name, relationship, createdAt };
}

export function deleteContact(id) {
  deleteContactStmt.run(id);
}

export function listContacts() {
  return listContactsStmt.all();
}

export function insertRecording({ label, samples }) {
  const createdAt = new Date().toISOString();
  const sampleCount = samples.length;
  const durationMs = samples[samples.length - 1].t - samples[0].t;
  const result = insertRecordingStmt.run(
    label,
    JSON.stringify(samples),
    sampleCount,
    durationMs,
    createdAt
  );
  return { id: Number(result.lastInsertRowid), label, sampleCount, durationMs, createdAt };
}

export function deleteRecording(id) {
  deleteRecordingStmt.run(id);
}

export function listRecordings() {
  return listRecordingsStmt.all();
}

export function exportRecordings() {
  return exportRecordingsStmt.all().map((row) => ({
    label: row.label,
    samples: JSON.parse(row.samples),
  }));
}

export default db;
