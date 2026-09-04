import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import { socket } from "../lib/socket";

// Vite bundles Leaflet's default marker images under hashed paths that the
// library can't resolve on its own — point it at the bundled URLs directly.
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

export default function CaregiverView() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    socket.connect();
    socket.emit("join-caregiver");
    socket.on("alert-confirmed", (payload) => {
      setAlerts((prev) => [payload, ...prev]);
    });
    return () => {
      socket.off("alert-confirmed");
    };
  }, []);

  const latest = alerts[0];

  return (
    <div className="page">
      <h1>Caregiver View</h1>
      <p>Watching for alerts in real time. Keep this page open.</p>

      {!latest && <p className="hint">No alerts yet — everything is quiet.</p>}

      {latest && (
        <div className="caregiver-alert">
          <h2>Fall alert received</h2>
          <p>Time: {new Date(latest.timestamp).toLocaleString()}</p>
          {latest.lat != null ? (
            <div className="map-wrap">
              <MapContainer center={[latest.lat, latest.lon]} zoom={15} style={{ height: 260 }}>
                <TileLayer
                  attribution='&copy; OpenStreetMap contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[latest.lat, latest.lon]}>
                  <Popup>Reported location</Popup>
                </Marker>
              </MapContainer>
            </div>
          ) : (
            <p>Location unavailable for this alert.</p>
          )}
        </div>
      )}

      {alerts.length > 1 && (
        <>
          <h3>Earlier alerts</h3>
          <ul>
            {alerts.slice(1).map((a, i) => (
              <li key={i}>{new Date(a.timestamp).toLocaleString()}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
