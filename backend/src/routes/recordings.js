import { Router } from "express";
import { listRecordings, insertRecording, deleteRecording, exportRecordings } from "../db/db.js";

const VALID_LABELS = ["fall", "resting", "walking", "jogging", "sitting_down", "standing_up"];
const MIN_SAMPLES = 10;

const router = Router();

router.get("/", (req, res) => {
  res.json(listRecordings());
});

router.get("/export", (req, res) => {
  res.json(exportRecordings());
});

router.post("/", (req, res) => {
  const { label, samples } = req.body ?? {};
  if (!VALID_LABELS.includes(label)) {
    return res.status(400).json({ error: `label must be one of: ${VALID_LABELS.join(", ")}` });
  }
  if (!Array.isArray(samples) || samples.length < MIN_SAMPLES) {
    return res.status(400).json({ error: `samples must be an array of at least ${MIN_SAMPLES} readings` });
  }
  const isValidSample = (s) =>
    s && typeof s.x === "number" && typeof s.y === "number" && typeof s.z === "number" && typeof s.t === "number";
  if (!samples.every(isValidSample)) {
    return res.status(400).json({ error: "each sample must have numeric x, y, z, t" });
  }
  const recording = insertRecording({ label, samples });
  res.status(201).json(recording);
});

router.delete("/:id", (req, res) => {
  deleteRecording(Number(req.params.id));
  res.status(204).end();
});

export default router;
