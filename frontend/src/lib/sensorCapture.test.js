import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  isMotionPermissionRequired,
  requestMotionPermission,
  startMotionCapture,
  requestLocationOnce,
} from "./sensorCapture";

describe("isMotionPermissionRequired", () => {
  afterEach(() => {
    delete window.DeviceMotionEvent;
  });

  it("returns false when DeviceMotionEvent.requestPermission does not exist", () => {
    window.DeviceMotionEvent = function () {};
    expect(isMotionPermissionRequired()).toBe(false);
  });

  it("returns true when DeviceMotionEvent.requestPermission exists", () => {
    window.DeviceMotionEvent = function () {};
    window.DeviceMotionEvent.requestPermission = vi.fn();
    expect(isMotionPermissionRequired()).toBe(true);
  });
});

describe("requestMotionPermission", () => {
  afterEach(() => {
    delete window.DeviceMotionEvent;
  });

  it("resolves true when no permission API exists", async () => {
    delete window.DeviceMotionEvent;
    await expect(requestMotionPermission()).resolves.toBe(true);
  });

  it("resolves true when the permission API grants access", async () => {
    window.DeviceMotionEvent = function () {};
    window.DeviceMotionEvent.requestPermission = vi.fn().mockResolvedValue("granted");
    await expect(requestMotionPermission()).resolves.toBe(true);
    expect(window.DeviceMotionEvent.requestPermission).toHaveBeenCalled();
  });

  it("resolves false when the permission API denies access", async () => {
    window.DeviceMotionEvent = function () {};
    window.DeviceMotionEvent.requestPermission = vi.fn().mockResolvedValue("denied");
    await expect(requestMotionPermission()).resolves.toBe(false);
  });
});

describe("startMotionCapture", () => {
  it("calls onSample with {x,y,z,t} when a devicemotion event carries acceleration data", () => {
    const onSample = vi.fn();
    startMotionCapture(onSample);

    const event = new Event("devicemotion");
    Object.defineProperty(event, "accelerationIncludingGravity", {
      value: { x: 1.1, y: 2.2, z: 9.8 },
    });
    Object.defineProperty(event, "timeStamp", { value: 123.6 });
    window.dispatchEvent(event);

    expect(onSample).toHaveBeenCalledWith({ x: 1.1, y: 2.2, z: 9.8, t: 124 });
  });

  it("ignores devicemotion events with no acceleration data", () => {
    const onSample = vi.fn();
    startMotionCapture(onSample);

    const event = new Event("devicemotion");
    Object.defineProperty(event, "accelerationIncludingGravity", { value: null });
    Object.defineProperty(event, "acceleration", { value: null });
    window.dispatchEvent(event);

    expect(onSample).not.toHaveBeenCalled();
  });

  it("returns an unsubscribe function that removes the listener", () => {
    const onSample = vi.fn();
    const unsubscribe = startMotionCapture(onSample);
    unsubscribe();

    const event = new Event("devicemotion");
    Object.defineProperty(event, "accelerationIncludingGravity", {
      value: { x: 1, y: 1, z: 1 },
    });
    window.dispatchEvent(event);

    expect(onSample).not.toHaveBeenCalled();
  });
});

describe("requestLocationOnce", () => {
  const originalGeolocation = navigator.geolocation;

  beforeEach(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: { getCurrentPosition: vi.fn() },
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: originalGeolocation,
      configurable: true,
    });
  });

  it("calls onLocation with {lat, lon} mapped from the resolved position", () => {
    navigator.geolocation.getCurrentPosition.mockImplementation((onSuccess) => {
      onSuccess({ coords: { latitude: 40.1, longitude: -73.9 } });
    });

    const onLocation = vi.fn();
    requestLocationOnce(onLocation);

    expect(onLocation).toHaveBeenCalledWith({ lat: 40.1, lon: -73.9 });
  });
});
