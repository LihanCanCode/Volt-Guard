// Wraps the DeviceMotion/Geolocation browser APIs: iOS requires an explicit
// user-gesture permission prompt before motion events fire at all.

export function isMotionPermissionRequired() {
  return (
    typeof DeviceMotionEvent !== "undefined" &&
    typeof DeviceMotionEvent.requestPermission === "function"
  );
}

export async function requestMotionPermission() {
  if (isMotionPermissionRequired()) {
    const result = await DeviceMotionEvent.requestPermission();
    return result === "granted";
  }
  return true;
}

// onSample receives { x, y, z, t } where t is a monotonic ms timestamp
// (relative to page load) — only deltas between samples matter downstream.
export function startMotionCapture(onSample) {
  const handler = (event) => {
    const a = event.accelerationIncludingGravity || event.acceleration;
    if (!a || a.x === null || a.x === undefined) return;
    onSample({ x: a.x, y: a.y, z: a.z, t: Math.round(event.timeStamp) });
  };
  window.addEventListener("devicemotion", handler);
  return () => window.removeEventListener("devicemotion", handler);
}

export function requestLocationOnce(onLocation) {
  if (!navigator.geolocation) return;
  navigator.geolocation.getCurrentPosition(
    (pos) => onLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
    () => {
      /* location is best-effort; alerts still work without it */
    },
    { enableHighAccuracy: false, timeout: 5000 }
  );
}
