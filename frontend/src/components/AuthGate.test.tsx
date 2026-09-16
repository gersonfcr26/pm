import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/AuthGate";
import { type BoardData } from "@/lib/kanban";
import { sampleBoard } from "@/test/sampleBoard";

const makeBoard = (): BoardData =>
  JSON.parse(JSON.stringify(sampleBoard)) as BoardData;

describe("AuthGate", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("blocks board access when credentials are invalid", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthGate />);

    await userEvent.type(screen.getByLabelText(/username/i), "wrong");
    await userEvent.type(screen.getByLabelText(/password/i), "bad");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(screen.getByRole("alert")).toHaveTextContent(/invalid credentials/i);
    expect(
      screen.queryByRole("heading", { name: "Kanban Studio" })
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads board from API when credentials are valid", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        username: "user",
        schemaVersion: 1,
        board: makeBoard(),
        updatedAt: "2026-08-13T00:00:00Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthGate />);

    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    expect(
      await screen.findByRole("heading", { name: "Kanban Studio" })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith("/api/board?username=user");
  });

  it("persists board changes through API", async () => {
    const board = makeBoard();
    const fetchMock = vi.fn().mockImplementation(async (input, init) => {
      if (!init || init.method === "GET") {
        return {
          ok: true,
          json: async () => ({
            username: "user",
            schemaVersion: 1,
            board,
            updatedAt: "2026-08-13T00:00:00Z",
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          username: "user",
          schemaVersion: 1,
          board: JSON.parse(String(init.body)),
          updatedAt: "2026-08-13T00:00:01Z",
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthGate />);

    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByRole("heading", { name: "Kanban Studio" });

    const column = screen.getAllByTestId(/column-/i)[0];
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "Planned");
    await userEvent.tab();

    await waitFor(() => {
      const putCalls = fetchMock.mock.calls.filter(
        ([, init]) => (init as RequestInit | undefined)?.method === "PUT"
      );
      expect(putCalls.length).toBeGreaterThan(0);
    });

    const putCalls = fetchMock.mock.calls.filter(
      ([, init]) => (init as RequestInit | undefined)?.method === "PUT"
    );
    const lastPutBody = String((putCalls.at(-1)?.[1] as RequestInit).body ?? "");
    expect(lastPutBody).toContain("Planned");
  });

  it("logs out and hides the board", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        username: "user",
        schemaVersion: 1,
        board: makeBoard(),
        updatedAt: "2026-08-13T00:00:00Z",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthGate />);

    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByRole("heading", { name: "Kanban Studio" });

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));

    expect(
      screen.getByRole("heading", { name: /sign in to kanban studio/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Kanban Studio" })
    ).not.toBeInTheDocument();
  });

  it("renders chat messages after AI submit", async () => {
    const board = makeBoard();
    const fetchMock = vi.fn().mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.includes("/api/board") && (!init || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            username: "user",
            schemaVersion: 1,
            board,
            updatedAt: "2026-08-13T00:00:00Z",
          }),
        };
      }

      if (url.includes("/api/ai/chat")) {
        return {
          ok: true,
          json: async () => ({
            version: "1",
            assistantMessage: "I can move cards for you.",
            boardUpdate: null,
            warnings: [],
          }),
        };
      }

      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthGate />);

    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByRole("heading", { name: "Kanban Studio" });

    await userEvent.type(
      screen.getByLabelText(/ask ai to update board/i),
      "Move one card to review"
    );
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByText("Move one card to review")).toBeInTheDocument();
    expect(await screen.findByText("I can move cards for you.")).toBeInTheDocument();
  });

  it("shows confirmation UI when AI proposes board update", async () => {
    const board = makeBoard();
    const proposedBoard = makeBoard();
    proposedBoard.columns[0].title = "Ideas";

    const fetchMock = vi.fn().mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.includes("/api/board") && (!init || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            username: "user",
            schemaVersion: 1,
            board,
            updatedAt: "2026-08-13T00:00:00Z",
          }),
        };
      }

      if (url.includes("/api/ai/chat")) {
        return {
          ok: true,
          json: async () => ({
            version: "1",
            assistantMessage: "Proposed an update.",
            boardUpdate: {
              mode: "replace",
              reason: "Rename Backlog to Ideas",
              payload: proposedBoard,
            },
            warnings: [],
          }),
        };
      }

      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthGate />);

    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByRole("heading", { name: "Kanban Studio" });

    await userEvent.type(screen.getByLabelText(/ask ai to update board/i), "Rename backlog");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));

    expect(await screen.findByTestId("update-proposal")).toBeInTheDocument();
    expect(screen.getByText(/rename backlog to ideas/i)).toBeInTheDocument();
  });

  it("reject leaves board unchanged", async () => {
    const board = makeBoard();
    const proposedBoard = makeBoard();
    proposedBoard.columns[0].title = "Ideas";

    const fetchMock = vi.fn().mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.includes("/api/board") && (!init || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            username: "user",
            schemaVersion: 1,
            board,
            updatedAt: "2026-08-13T00:00:00Z",
          }),
        };
      }

      if (url.includes("/api/ai/chat")) {
        return {
          ok: true,
          json: async () => ({
            version: "1",
            assistantMessage: "Proposed an update.",
            boardUpdate: {
              mode: "replace",
              reason: "Rename Backlog to Ideas",
              payload: proposedBoard,
            },
            warnings: [],
          }),
        };
      }

      if (url.includes("/api/board") && init?.method === "PUT") {
        return {
          ok: true,
          json: async () => ({
            username: "user",
            schemaVersion: 1,
            board: JSON.parse(String(init.body)),
            updatedAt: "2026-08-13T00:00:01Z",
          }),
        };
      }

      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthGate />);

    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByRole("heading", { name: "Kanban Studio" });

    await userEvent.type(screen.getByLabelText(/ask ai to update board/i), "Rename backlog");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByTestId("update-proposal");

    await userEvent.click(screen.getByRole("button", { name: /reject update/i }));

    expect(screen.queryByDisplayValue("Ideas")).not.toBeInTheDocument();
    expect(screen.getByDisplayValue("Backlog")).toBeInTheDocument();
  });

  it("confirm applies update and rerenders board", async () => {
    const board = makeBoard();
    const proposedBoard = makeBoard();
    proposedBoard.columns[0].title = "Ideas";

    const fetchMock = vi.fn().mockImplementation(async (input, init) => {
      const url = String(input);

      if (url.includes("/api/board") && (!init || init.method === "GET")) {
        return {
          ok: true,
          json: async () => ({
            username: "user",
            schemaVersion: 1,
            board,
            updatedAt: "2026-08-13T00:00:00Z",
          }),
        };
      }

      if (url.includes("/api/ai/chat")) {
        return {
          ok: true,
          json: async () => ({
            version: "1",
            assistantMessage: "Proposed an update.",
            boardUpdate: {
              mode: "replace",
              reason: "Rename Backlog to Ideas",
              payload: proposedBoard,
            },
            warnings: [],
          }),
        };
      }

      if (url.includes("/api/board") && init?.method === "PUT") {
        return {
          ok: true,
          json: async () => ({
            username: "user",
            schemaVersion: 1,
            board: JSON.parse(String(init.body)),
            updatedAt: "2026-08-13T00:00:01Z",
          }),
        };
      }

      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AuthGate />);

    await userEvent.type(screen.getByLabelText(/username/i), "user");
    await userEvent.type(screen.getByLabelText(/password/i), "password");
    await userEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await screen.findByRole("heading", { name: "Kanban Studio" });

    await userEvent.type(screen.getByLabelText(/ask ai to update board/i), "Rename backlog");
    await userEvent.click(screen.getByRole("button", { name: /^send$/i }));
    await screen.findByTestId("update-proposal");

    await userEvent.click(screen.getByRole("button", { name: /confirm update/i }));

    expect(await screen.findByDisplayValue("Ideas")).toBeInTheDocument();
  });
});
