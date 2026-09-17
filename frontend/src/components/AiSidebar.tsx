"use client";

import { FormEvent, type KeyboardEvent, useState } from "react";
import { sendChatPrompt } from "@/lib/api";
import { type BoardData } from "@/lib/kanban";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

type ProposedUpdate = {
  board: BoardData;
  reason: string;
};

type AiSidebarProps = {
  board: BoardData;
  onApplyBoardUpdate: (nextBoard: BoardData) => Promise<void>;
  onClose?: () => void;
};

export const AiSidebar = ({ board, onApplyBoardUpdate, onClose }: AiSidebarProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [proposal, setProposal] = useState<ProposedUpdate | null>(null);
  const [isApplyingProposal, setIsApplyingProposal] = useState(false);
  const [providerTag, setProviderTag] = useState("OpenRouter");

  const canSend = prompt.trim().length > 0 && !isSending;

  const addMessage = (role: ChatMessage["role"], content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        role,
        content,
      },
    ]);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextPrompt = prompt.trim();
    if (!nextPrompt) {
      return;
    }

    addMessage("user", nextPrompt);
    setPrompt("");
    setChatError("");
    setIsSending(true);

    try {
      const payload = await sendChatPrompt(nextPrompt, board);
      setProviderTag(payload.provider ?? "OpenRouter");
      addMessage("assistant", payload.assistantMessage);

      if (payload.warnings.length > 0) {
        addMessage("assistant", `Warning: ${payload.warnings.join(" ")}`);
      }

      setProposal(
        payload.boardUpdate
          ? {
              board: payload.boardUpdate.payload,
              reason: payload.boardUpdate.reason,
            }
          : null
      );
    } catch {
      setChatError("Unable to reach AI assistant right now. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Enter" || event.shiftKey) {
      return;
    }

    event.preventDefault();
    if (!canSend) {
      return;
    }

    event.currentTarget.form?.requestSubmit();
  };

  const handleRejectProposal = () => {
    setProposal(null);
    addMessage("assistant", "Update rejected. Board left unchanged.");
  };

  const handleConfirmProposal = async () => {
    if (!proposal) {
      return;
    }

    setIsApplyingProposal(true);
    await onApplyBoardUpdate(proposal.board);
    setIsApplyingProposal(false);
    setProposal(null);
    addMessage("assistant", "Update confirmed and applied.");
  };

  return (
    <aside className="flex h-full min-h-0 flex-col overflow-hidden rounded-[28px] border border-[var(--stroke)] bg-white p-5 shadow-[var(--shadow)]" data-testid="ai-sidebar">
      <div className="mb-3 flex items-center justify-end shrink-0">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-[var(--stroke)] bg-white px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]"
        >
          Hide
        </button>
      </div>
      <div className="shrink-0">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--gray-text)]">
            AI Assistant
          </p>
          <span className="rounded-full border border-[var(--stroke)] bg-[var(--surface)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--navy-dark)]" data-testid="provider-tag">
            {providerTag}
          </span>
        </div>
        <h2 className="mt-3 font-display text-2xl font-semibold text-[var(--navy-dark)]">
          Board Chat
        </h2>
        <p className="mt-2 text-sm leading-6 text-[var(--gray-text)]">
          Ask for card and column changes. Proposed updates require explicit confirmation.
        </p>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-scroll overscroll-contain rounded-2xl border border-[var(--stroke)] bg-[var(--surface)] p-3" data-testid="chat-thread">
        {messages.length > 0 ? (
          <ul className="space-y-3">
            {messages.map((message) => (
              <li key={message.id} className="rounded-xl border border-[var(--stroke)] bg-white p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--gray-text)]">
                  {message.role}
                </p>
                <p className="mt-1 text-sm leading-6 text-[var(--navy-dark)]">{message.content}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--gray-text)]">No messages yet.</p>
        )}
      </div>

      {proposal ? (
        <section className="mt-4 shrink-0 rounded-2xl border border-[var(--accent-yellow)] bg-[#fff8e6] p-4" data-testid="update-proposal">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)]">
            Proposed update
          </p>
          <p className="mt-2 text-sm text-[var(--navy-dark)]">{proposal.reason}</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={handleConfirmProposal}
              disabled={isApplyingProposal}
              className="rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-60"
            >
              Confirm update
            </button>
            <button
              type="button"
              onClick={handleRejectProposal}
              disabled={isApplyingProposal}
              className="rounded-full border border-[var(--stroke)] bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--navy-dark)] disabled:opacity-60"
            >
              Reject update
            </button>
          </div>
        </section>
      ) : null}

      {chatError ? (
        <p role="alert" className="mt-3 shrink-0 text-xs font-semibold text-[var(--secondary-purple)]">
          {chatError}
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="mt-4 space-y-3 shrink-0">
        <label htmlFor="ai-prompt" className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--gray-text)]">
          Ask AI to update board
        </label>
        <textarea
          id="ai-prompt"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={handlePromptKeyDown}
          rows={3}
          className="w-full rounded-2xl border border-[var(--stroke)] px-3 py-2 text-sm text-[var(--navy-dark)] outline-none focus:border-[var(--primary-blue)]"
          placeholder="Move API validation card to Review and rename Backlog to Ideas"
        />
        <button
          type="submit"
          disabled={!canSend}
          className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white disabled:opacity-60"
        >
          {isSending ? "Sending..." : "Send"}
        </button>
      </form>
    </aside>
  );
};