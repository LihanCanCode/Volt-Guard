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

const insertStmt = db.prepare(
  `INSERT INTO events (createdAt, probability, outcome, lat, lon) VALUES (?, ?, ?, ?, ?)`
);
const updateOutcomeStmt = db.prepare(
  `UPDATE events SET outcome = ? WHERE id = ?`
);
const listStmt = db.prepare(
  `SELECT * FROM events ORDER BY id DESC LIMIT 100`
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

export default db;
