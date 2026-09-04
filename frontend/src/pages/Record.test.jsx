import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Record from "./Record";
import { requestMotionPermission, startMotionCapture } from "../lib/sensorCapture";

vi.mock("../lib/sensorCapture");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

describe("Record", () => {
  let unsubscribe;
  let onSample;

  beforeEach(() => {
    global.fetch = vi.fn();
    unsubscribe = vi.fn();
    onSample = null;
    startMotionCapture.mockImplementation((cb) => {
      onSample = cb;
      return unsubscribe;
    });
  });

  it("shows an error and never starts recording when permission is denied", async () => {
    fetch.mockResolvedValueOnce(jsonResponse([]));
    requestMotionPermission.mockResolvedValue(false);

    render(<Record />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Start Recording" }));

    expect(
      await screen.findByText("Motion permission denied — this app needs it to record a clip.")
    ).toBeInTheDocument();
    expect(startMotionCapture).not.toHaveBeenCalled();
  });

  it("records samples and POSTs the clip with the selected label on stop", async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: 1 }, true))
      .mockResolvedValueOnce(jsonResponse([{ id: 1, label: "walking", durationMs: 1000, sampleCount: 12, createdAt: Date.now() }]));
    requestMotionPermission.mockResolvedValue(true);

    render(<Record />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await userEvent.selectOptions(screen.getByLabelText("Activity"), "walking");
    await userEvent.click(screen.getByRole("button", { name: "Start Recording" }));
    await waitFor(() => expect(startMotionCapture).toHaveBeenCalled());

    const samples = Array.from({ length: 12 }, (_, i) => ({ x: 0, y: 0, z: 9.8, t: i * 20 }));
    samples.forEach((s) => onSample(s));

    await userEvent.click(screen.getByRole("button", { name: "Stop & Save" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/recordings",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ label: "walking", samples }),
        })
      )
    );
    expect(await screen.findByText(/walking/)).toBeInTheDocument();
  });

  it("shows a too-short error and does not POST when fewer than 10 samples were captured", async () => {
    fetch.mockResolvedValueOnce(jsonResponse([]));
    requestMotionPermission.mockResolvedValue(true);

    render(<Record />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Start Recording" }));
    await waitFor(() => expect(startMotionCapture).toHaveBeenCalled());

    for (let i = 0; i < 5; i++) onSample({ x: 0, y: 0, z: 9.8, t: i * 20 });

    await userEvent.click(screen.getByRole("button", { name: "Stop & Save" }));

    expect(
      await screen.findByText("Clip too short — record at least a second of motion.")
    ).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("renders fetched recordings and removes one on click", async () => {
    fetch
      .mockResolvedValueOnce(
        jsonResponse([{ id: 5, label: "fall", durationMs: 2000, sampleCount: 20, createdAt: Date.now() }])
      )
      .mockResolvedValueOnce(jsonResponse({}, true))
      .mockResolvedValueOnce(jsonResponse([]));

    render(<Record />);
    await screen.findByText(/fall/);

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/recordings/5", { method: "DELETE" })
    );
    expect(await screen.findByText("No recordings yet.")).toBeInTheDocument();
  });
});
