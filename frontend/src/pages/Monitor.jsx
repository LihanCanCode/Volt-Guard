import { useEffect, useRef, useState, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { socket } from "../lib/socket";
import {
  requestMotionPermission,
  startMotionCapture,
  requestLocationOnce,
} from "../lib/sensorCapture";

const COUNTDOWN_SECONDS = 15;
const CHART_POINTS = 150;
const CHART_SAMPLE_INTERVAL_MS = 100;

function magnitude(s) {
  return Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
}

export default function Monitor() {
  const [status, setStatus] = useState("idle"); // idle | monitoring | suspected | alerted
  const [chartData, setChartData] = useState([]);
  const [activeEvent, setActiveEvent] = useState(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [confirmedAlert, setConfirmedAlert] = useState(null);
  const [error, setError] = useState(null);
  const [primaryContact, setPrimaryContact] = useState(null);

  const stopCaptureRef = useRef(null);
  const latestSampleRef = useRef(null);
  const chartTimerRef = useRef(null);
  const countdownTimerRef = useRef(null);

  const confirmAlert = useCallback(() => {
    setActiveEvent((current) => {
      if (current) socket.emit("confirm-alert", { eventId: current.id });
      return current;
    });
  }, []);

  const cancelAlert = useCallback(() => {
    setActiveEvent((current) => {
      if (current) socket.emit("cancel-alert", { eventId: current.id });
      return current;
    });
  }, []);

  useEffect(() => {
    socket.on("fall-suspected", (event) => {
      setActiveEvent(event);
      setStatus("suspected");
      setCountdown(COUNTDOWN_SECONDS);
    });
    socket.on("alert-confirmed", (payload) => {
      setConfirmedAlert(payload);
      setStatus("alerted");
      fetch("/api/contacts")
        .then((res) => res.json())
        .then((contacts) => setPrimaryContact(contacts[0] ?? null))
        .catch(() => setPrimaryContact(null));
    });
    socket.on("alert-cancelled", () => {
      setActiveEvent(null);
      setStatus("monitoring");
    });
    return () => {
      socket.off("fall-suspected");
      socket.off("alert-confirmed");
      socket.off("alert-cancelled");
    };
  }, []);

  useEffect(() => {
    if (status !== "suspected") {
      clearInterval(countdownTimerRef.current);
      return undefined;
    }
    countdownTimerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(countdownTimerRef.current);
          confirmAlert();
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(countdownTimerRef.current);
  }, [status, confirmAlert]);

  useEffect(
    () => () => {
      stopCaptureRef.current?.();
      clearInterval(chartTimerRef.current);
      clearInterval(countdownTimerRef.current);
    },
    []
  );

  const startMonitoring = async () => {
    setError(null);
    const granted = await requestMotionPermission();
    if (!granted) {
      setError("Motion permission denied — this app needs it to detect falls.");
      return;
    }

    socket.connect();
    requestLocationOnce((loc) => socket.emit("location-update", loc));

    stopCaptureRef.current = startMotionCapture((sample) => {
      latestSampleRef.current = sample;
      socket.emit("motion-sample", sample);
    });

    chartTimerRef.current = setInterval(() => {
      const s = latestSampleRef.current;
      if (!s) return;
      setChartData((prev) => {
        const next = [...prev, { t: s.t, mag: magnitude(s) }];
        return next.length > CHART_POINTS ? next.slice(next.length - CHART_POINTS) : next;
      });
    }, CHART_SAMPLE_INTERVAL_MS);

    setStatus("monitoring");
  };

  const stopMonitoring = () => {
    stopCaptureRef.current?.();
    stopCaptureRef.current = null;
    clearInterval(chartTimerRef.current);
    socket.disconnect();
    setStatus("idle");
    setChartData([]);
    setActiveEvent(null);
    setConfirmedAlert(null);
    setPrimaryContact(null);
  };

  if (status === "suspected" && activeEvent) {
    return (
      <div className="alert-overlay alert-overlay--suspected">
        <h1>Possible fall detected</h1>
        <p>Confidence: {(activeEvent.probability * 100).toFixed(0)}%</p>
        <div className="countdown">{countdown}</div>
        <p>Notifying your caregiver automatically unless you cancel.</p>
        <div className="alert-actions">
          <button className="btn btn-safe" onClick={cancelAlert}>I'm OK</button>
          <button className="btn btn-danger" onClick={confirmAlert}>I need help now</button>
        </div>
      </div>
    );
  }

  if (status === "alerted") {
    return (
      <div className="alert-overlay alert-overlay--confirmed">
        <h1>Caregiver notified</h1>
        <p>
          Contact:{" "}
          {primaryContact
            ? `${primaryContact.name}${primaryContact.relationship ? ` (${primaryContact.relationship})` : ""}`
            : "No emergency contact configured — add one in Contacts"}
        </p>
        {confirmedAlert && <p>Time: {new Date(confirmedAlert.timestamp).toLocaleTimeString()}</p>}
        {confirmedAlert?.lat != null && (
          <p>
            Location: {confirmedAlert.lat.toFixed(5)}, {confirmedAlert.lon.toFixed(5)}
          </p>
        )}
        <button className="btn" onClick={stopMonitoring}>Reset</button>
      </div>
    );
  }

  return (
    <div className="page">
      <h1>Monitor</h1>
      <p className="status-line">
        Status: <strong>{status}</strong>
      </p>
      {error && <p className="error">{error}</p>}
      {status === "idle" ? (
        <button className="btn btn-primary" onClick={startMonitoring}>
          Start Monitoring
        </button>
      ) : (
        <button className="btn" onClick={stopMonitoring}>
          Stop Monitoring
        </button>
      )}
      <div className="chart-wrap">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={chartData}>
            <XAxis dataKey="t" hide />
            <YAxis domain={[0, 40]} />
            <Line type="monotone" dataKey="mag" stroke="#2563eb" dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="hint">
        Tip: on iPhone this page must be opened over HTTPS, and you must tap "Start Monitoring"
        yourself for the motion-permission prompt to appear.
      </p>
    </div>
  );
}
