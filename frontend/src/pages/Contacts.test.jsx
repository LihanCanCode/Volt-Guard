import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Contacts from "./Contacts";

function jsonResponse(body, ok = true) {
  return Promise.resolve({ ok, json: () => Promise.resolve(body) });
}

describe("Contacts", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  it("renders the contact list from GET /api/contacts", async () => {
    fetch.mockResolvedValueOnce(
      jsonResponse([{ id: 1, name: "Ada", relationship: "Daughter" }])
    );

    render(<Contacts />);

    expect(await screen.findByText("Ada (Daughter)")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/contacts");
  });

  it("submits the form and reloads the list", async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse({ id: 2 }, true))
      .mockResolvedValueOnce(jsonResponse([{ id: 2, name: "Bo", relationship: "" }]));

    render(<Contacts />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByPlaceholderText("Name"), "Bo");
    await userEvent.click(screen.getByRole("button", { name: "Add Contact" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith(
        "/api/contacts",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ name: "Bo", relationship: "" }),
        })
      )
    );
    expect(await screen.findByText("Bo")).toBeInTheDocument();
  });

  it("shows an error and keeps the form when the POST fails", async () => {
    fetch.mockResolvedValueOnce(jsonResponse([])).mockResolvedValueOnce(jsonResponse({}, false));

    render(<Contacts />);
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

    await userEvent.type(screen.getByPlaceholderText("Name"), "Bo");
    await userEvent.click(screen.getByRole("button", { name: "Add Contact" }));

    expect(await screen.findByText("Could not add contact — name is required.")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Name")).toHaveValue("Bo");
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("removes a contact and reloads the list", async () => {
    fetch
      .mockResolvedValueOnce(jsonResponse([{ id: 1, name: "Ada", relationship: "" }]))
      .mockResolvedValueOnce(jsonResponse({}, true))
      .mockResolvedValueOnce(jsonResponse([]));

    render(<Contacts />);
    await screen.findByText("Ada");

    await userEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() =>
      expect(fetch).toHaveBeenCalledWith("/api/contacts/1", { method: "DELETE" })
    );
    expect(await screen.findByText("No contacts yet — add one above.")).toBeInTheDocument();
  });
});
