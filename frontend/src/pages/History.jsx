import { useEffect, useState } from "react";

export default function History() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/events")
      .then((res) => res.json())
      .then(setEvents)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <h1>History</h1>
      {loading && <p>Loading...</p>}
      {!loading && events.length === 0 && <p>No events yet — nothing detected so far.</p>}
      {events.length > 0 && (
        <table className="history-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Confidence</th>
              <th>Outcome</th>
              <th>Location</th>
            </tr>
          </thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id} className={`outcome-${e.outcome}`}>
                <td>{new Date(e.createdAt).toLocaleString()}</td>
                <td>{(e.probability * 100).toFixed(0)}%</td>
                <td>{e.outcome}</td>
                <td>{e.lat != null ? `${e.lat.toFixed(4)}, ${e.lon.toFixed(4)}` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
