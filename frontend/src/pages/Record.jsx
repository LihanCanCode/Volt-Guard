import { useEffect, useRef, useState } from "react";
import { requestMotionPermission, startMotionCapture } from "../lib/sensorCapture";

const LABELS = [
  { value: "fall", text: "Fall (simulate — drop onto a bed/couch)" },
  { value: "resting", text: "Resting" },
  { value: "walking", text: "Walking" },
  { value: "jogging", text: "Jogging" },
  { value: "sitting_down", text: "Sitting down" },
  { value: "standing_up", text: "Standing up" },
];

export default function Record() {
  const [label, setLabel] = useState(LABELS[0].value);
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [sampleCount, setSampleCount] = useState(0);
  const [recordings, setRecordings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const stopCaptureRef = useRef(null);
  const samplesRef = useRef([]);
  const startedAtRef = useRef(0);
  const elapsedTimerRef = useRef(null);

  const loadRecordings = () => {
    setLoading(true);
    fetch("/api/recordings")
      .then((res) => res.json())
      .then(setRecordings)
      .finally(() => setLoading(false));
  };

  useEffect(loadRecordings, []);

  useEffect(
    () => () => {
      stopCaptureRef.current?.();
      clearInterval(elapsedTimerRef.current);
    },
    []
  );

  const startRecording = async () => {
    setError(null);
    const granted = await requestMotionPermission();
    if (!granted) {
      setError("Motion permission denied — this app needs it to record a clip.");
      return;
    }

    samplesRef.current = [];
    startedAtRef.current = Date.now();
    setSampleCount(0);
    setElapsedMs(0);

    stopCaptureRef.current = startMotionCapture((sample) => {
      samplesRef.current.push(sample);
      setSampleCount(samplesRef.current.length);
    });

    elapsedTimerRef.current = setInterval(() => {
      setElapsedMs(Date.now() - startedAtRef.current);
    }, 100);

    setRecording(true);
  };

  const stopRecording = async () => {
    stopCaptureRef.current?.();
    stopCaptureRef.current = null;
    clearInterval(elapsedTimerRef.current);
    setRecording(false);

    const samples = samplesRef.current;
    if (samples.length < 10) {
      setError("Clip too short — record at least a second of motion.");
      return;
    }

    const res = await fetch("/api/recordings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label, samples }),
    });
    if (!res.ok) {
      setError("Could not save recording.");
      return;
    }
    loadRecordings();
  };

  const removeRecording = async (id) => {
    await fetch(`/api/recordings/${id}`, { method: "DELETE" });
    loadRecordings();
  };

  return (
    <div className="page">
      <h1>Record Session</h1>
      <p className="hint">
        Capture short (~2–3s), single-activity accelerometer clips to improve the fall-detection
        model with real data. For "Fall", simulate by dropping the phone onto a bed or couch —
        never perform an actual fall.
      </p>

      <label htmlFor="label-select">Activity</label>
      <select
        id="label-select"
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        disabled={recording}
      >
        {LABELS.map((l) => (
          <option key={l.value} value={l.value}>
            {l.text}
          </option>
        ))}
      </select>

      {error && <p className="error">{error}</p>}

      {recording && (
        <p className="status-line">
          Recording... {(elapsedMs / 1000).toFixed(1)}s / {sampleCount} samples
        </p>
      )}

      {recording ? (
        <button className="btn btn-danger" onClick={stopRecording}>
          Stop &amp; Save
        </button>
      ) : (
        <button className="btn btn-primary" onClick={startRecording}>
          Start Recording
        </button>
      )}

      <h2>Past Recordings</h2>
      {loading && <p>Loading...</p>}
      {!loading && recordings.length === 0 && <p>No recordings yet.</p>}
      {recordings.length > 0 && (
        <ul className="contact-list">
          {recordings.map((r) => (
            <li key={r.id}>
              <span>
                {r.label} — {(r.durationMs / 1000).toFixed(1)}s, {r.sampleCount} samples (
                {new Date(r.createdAt).toLocaleString()})
              </span>
              <button className="btn btn-danger" onClick={() => removeRecording(r.id)}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
