import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Monitor from "./Monitor";
import { socket } from "../lib/socket";
import { requestMotionPermission, startMotionCapture, requestLocationOnce } from "../lib/sensorCapture";

vi.mock("../lib/socket", () => ({
  socket: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  },
}));
vi.mock("../lib/sensorCapture");

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

function handlerFor(event) {
  const call = socket.on.mock.calls.find(([name]) => name === event);
  return call?.[1];
}

describe("Monitor", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    requestMotionPermission.mockResolvedValue(true);
    startMotionCapture.mockReturnValue(vi.fn());
    requestLocationOnce.mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("requests permission and connects the socket when starting monitoring", async () => {
    render(<Monitor />);

    await userEvent.click(screen.getByRole("button", { name: "Start Monitoring" }));

    await waitFor(() => expect(requestMotionPermission).toHaveBeenCalled());
    expect(socket.connect).toHaveBeenCalled();
  });

  it("switches to the countdown UI on fall-suspected and auto-confirms at zero", async () => {
    vi.useFakeTimers();
    render(<Monitor />);

    const onFallSuspected = handlerFor("fall-suspected");
    act(() => {
      onFallSuspected({ id: "evt-1", probability: 0.9 });
    });

    expect(screen.getByText("Possible fall detected")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(socket.emit).toHaveBeenCalledWith("confirm-alert", { eventId: "evt-1" });
  });

  it("emits cancel-alert with the active event id when clicking I'm OK", async () => {
    render(<Monitor />);

    const onFallSuspected = handlerFor("fall-suspected");
    act(() => {
      onFallSuspected({ id: "evt-2", probability: 0.7 });
    });

    await userEvent.click(screen.getByRole("button", { name: "I'm OK" }));

    expect(socket.emit).toHaveBeenCalledWith("cancel-alert", { eventId: "evt-2" });
  });

  it("shows the alerted screen with the fetched contact on alert-confirmed", async () => {
    fetch.mockResolvedValueOnce(jsonResponse([{ id: 1, name: "Ada", relationship: "Daughter" }]));
    render(<Monitor />);

    const onAlertConfirmed = handlerFor("alert-confirmed");
    await act(async () => {
      onAlertConfirmed({ timestamp: Date.now() });
    });

    expect(await screen.findByText("Caregiver notified")).toBeInTheDocument();
    expect(await screen.findByText(/Ada \(Daughter\)/)).toBeInTheDocument();
  });
});
