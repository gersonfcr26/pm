"use client";

import { FormEvent, type ReactNode, useState } from "react";
import { AiSidebar } from "@/components/AiSidebar";
import { KanbanBoard } from "@/components/KanbanBoard";
import { type BoardData } from "@/lib/kanban";

const MVP_USERNAME = "user";
const MVP_PASSWORD = "password";

const secondaryButtonClass =
  "rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]";
const primaryButtonClass =
  "rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white";
const inputClass =
  "mt-2 w-full rounded-xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]";
const labelClass =
  "text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]";

const CenteredPanel = ({ children }: { children: ReactNode }) => (
  <main className="mx-auto flex min-h-screen max-w-[560px] items-center px-6 py-12">
    <section className="w-full rounded-[28px] border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
      {children}
    </section>
  </main>
);

export const AuthGate = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [board, setBoard] = useState<BoardData | null>(null);
  const [isLoadingBoard, setIsLoadingBoard] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [isAiSidebarOpen, setIsAiSidebarOpen] = useState(false);

  const loadBoard = async () => {
    setIsLoadingBoard(true);
    setLoadError("");

    try {
      const response = await fetch(`/api/board?username=${encodeURIComponent(MVP_USERNAME)}`);

      if (!response.ok) {
        throw new Error(`load failed: ${response.status}`);
      }

      const payload = (await response.json()) as { board: BoardData };
      setBoard(payload.board);
    } catch {
      setLoadError("Unable to load your board. Please try again.");
    } finally {
      setIsLoadingBoard(false);
    }
  };

  const persistBoard = async (nextBoard: BoardData) => {
    setBoard(nextBoard);
    setSaveError("");

    try {
      const response = await fetch(`/api/board?username=${encodeURIComponent(MVP_USERNAME)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextBoard),
      });

      if (!response.ok) {
        throw new Error(`save failed: ${response.status}`);
      }
    } catch {
      setSaveError("Last change could not be saved. Please try again.");
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (username.trim() === MVP_USERNAME && password === MVP_PASSWORD) {
      setIsAuthenticated(true);
      setError("");
      setSaveError("");
      await loadBoard();
      return;
    }

    setError("Invalid credentials. Use user / password.");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    setError("");
    setBoard(null);
    setIsLoadingBoard(false);
    setLoadError("");
    setSaveError("");
    setIsAiSidebarOpen(false);
  };

  if (isAuthenticated) {
    if (isLoadingBoard) {
      return (
        <CenteredPanel>
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            Loading board...
          </p>
        </CenteredPanel>
      );
    }

    if (loadError || !board) {
      return (
        <CenteredPanel>
          <p role="alert" className="text-sm font-medium text-[var(--secondary-purple)]">
            {loadError || "Unable to load your board."}
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" onClick={loadBoard} className={primaryButtonClass}>
              Retry
            </button>
            <button type="button" onClick={handleLogout} className={secondaryButtonClass}>
              Log out
            </button>
          </div>
        </CenteredPanel>
      );
    }

    return (
      <main className="mx-auto max-w-[1900px] px-3 py-3">
        <KanbanBoard
          initialBoard={board}
          onBoardChange={persistBoard}
          headerAction={
            <div className="flex items-center gap-2">
              {saveError ? (
                <span role="alert" className="text-xs font-semibold text-[var(--secondary-purple)]">
                  Save failed
                </span>
              ) : null}
              <button type="button" onClick={handleLogout} className={secondaryButtonClass}>
                Log out
              </button>
            </div>
          }
        />

        <button
          type="button"
          onClick={() => setIsAiSidebarOpen((prev) => !prev)}
          className="fixed bottom-4 right-4 z-40 rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow-[var(--shadow)]"
        >
          {isAiSidebarOpen ? "Hide AI Chat" : "Open AI Chat"}
        </button>

        <div
          className={[
            "fixed inset-x-3 bottom-20 z-40 h-[calc(100dvh-6rem)] max-h-[calc(100dvh-6rem)] sm:inset-x-auto sm:right-4 sm:w-[380px] transition-transform duration-200",
            isAiSidebarOpen ? "translate-x-0" : "translate-x-[110%]",
          ].join(" ")}
        >
          <AiSidebar
            board={board}
            onApplyBoardUpdate={persistBoard}
            onClose={() => setIsAiSidebarOpen(false)}
          />
        </div>
      </main>
    );
  }

  return (
    <CenteredPanel>
      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
        Project Management MVP
      </p>
      <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
        Sign in to Kanban Studio
      </h1>
      <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
        Use the MVP credentials to access your board.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <div>
          <label htmlFor="username" className={labelClass}>
            Username
          </label>
          <input
            id="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            className={inputClass}
            autoComplete="username"
          />
        </div>

        <div>
          <label htmlFor="password" className={labelClass}>
            Password
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
            autoComplete="current-password"
          />
        </div>

        {error ? (
          <p role="alert" className="text-sm font-medium text-[var(--secondary-purple)]">
            {error}
          </p>
        ) : null}

        <button type="submit" className={`w-full ${primaryButtonClass}`}>
          Sign in
        </button>
      </form>
    </CenteredPanel>
  );
};
