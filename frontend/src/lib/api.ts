import { type BoardData } from "@/lib/kanban";

export const MVP_USERNAME = "user";

export type AIChatBoardUpdate = {
  mode: "replace";
  reason: string;
  payload: BoardData;
};

export type AIChatResponse = {
  model?: string;
  provider?: string;
  version: string;
  assistantMessage: string;
  boardUpdate: AIChatBoardUpdate | null;
  warnings: string[];
};

const boardUrl = `/api/board?username=${encodeURIComponent(MVP_USERNAME)}`;
const chatUrl = `/api/ai/chat?username=${encodeURIComponent(MVP_USERNAME)}`;

async function sendJson(
  url: string,
  method: "POST" | "PUT",
  body: unknown
): Promise<Response> {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`request failed: ${response.status}`);
  }

  return response;
}

export async function fetchBoard(): Promise<BoardData> {
  const response = await fetch(boardUrl);

  if (!response.ok) {
    throw new Error(`load failed: ${response.status}`);
  }

  const payload = (await response.json()) as { board: BoardData };
  return payload.board;
}

export async function saveBoard(board: BoardData): Promise<void> {
  await sendJson(boardUrl, "PUT", board);
}

export async function sendChatPrompt(
  prompt: string,
  board: BoardData
): Promise<AIChatResponse> {
  const response = await sendJson(chatUrl, "POST", { prompt, board });
  return (await response.json()) as AIChatResponse;
}
