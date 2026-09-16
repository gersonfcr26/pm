import { expect, test, type Page, type Route } from "@playwright/test";

const createBoard = () => ({
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
    { id: "col-review", title: "Review", cardIds: ["card-6"] },
    { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
  ],
  cards: {
    "card-1": {
      id: "card-1",
      title: "Align roadmap themes",
      details: "Draft quarterly themes with impact statements and metrics.",
    },
    "card-2": {
      id: "card-2",
      title: "Gather customer signals",
      details: "Review support tags, sales notes, and churn feedback.",
    },
    "card-3": {
      id: "card-3",
      title: "Prototype analytics view",
      details: "Sketch initial dashboard layout and key drill-downs.",
    },
    "card-4": {
      id: "card-4",
      title: "Refine status language",
      details: "Standardize column labels and tone across the board.",
    },
    "card-5": {
      id: "card-5",
      title: "Design card layout",
      details: "Add hierarchy and spacing for scanning dense lists.",
    },
    "card-6": {
      id: "card-6",
      title: "QA micro-interactions",
      details: "Verify hover, focus, and loading states.",
    },
    "card-7": {
      id: "card-7",
      title: "Ship marketing page",
      details: "Final copy approved and asset pack delivered.",
    },
    "card-8": {
      id: "card-8",
      title: "Close onboarding sprint",
      details: "Document release notes and share internally.",
    },
  },
});

const mockBoardApi = async (page: Page) => {
  let board = createBoard();

  await page.route("**/api/board**", async (route: Route) => {
    const request = route.request();
    if (request.method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          username: "user",
          schemaVersion: 1,
          board,
          updatedAt: new Date().toISOString(),
        }),
      });
      return;
    }

    if (request.method() === "PUT") {
      board = JSON.parse(request.postData() ?? "{}");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          username: "user",
          schemaVersion: 1,
          board,
          updatedAt: new Date().toISOString(),
        }),
      });
      return;
    }

    await route.fulfill({ status: 405, body: "Method not allowed" });
  });
};

const login = async (page: Page) => {
  await page.goto("/");
  await page.getByLabel("Username").fill("user");
  await page.getByLabel("Password").fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
};

const ensureAiChatOpen = async (page: Page) => {
  const promptField = page.getByLabel(/ask ai to update board/i);
  if (await promptField.isVisible()) {
    return;
  }

  await page.getByRole("button", { name: /open ai chat/i }).click();
  await expect(promptField).toBeVisible();
};

const dragCardToLane = async (
  page: Page,
  cardTestId: string,
  laneTestId: string
) => {
  // dnd-kit PointerSensor is more reliable with explicit mouse down/move/up than locator.dragTo.
  const card = page.getByTestId(cardTestId);
  const lane = page.getByTestId(laneTestId);
  await card.scrollIntoViewIfNeeded();
  await lane.scrollIntoViewIfNeeded();

  const cardBox = await card.boundingBox();
  const laneBox = await lane.boundingBox();

  if (!cardBox || !laneBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  const startX = cardBox.x + cardBox.width / 2;
  const startY = cardBox.y + cardBox.height / 2;
  const endX = laneBox.x + laneBox.width / 2;
  const endY = laneBox.y + Math.min(140, Math.max(36, laneBox.height / 2));

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 8, startY + 8, { steps: 4 });
  await page.mouse.move(endX, endY, { steps: 20 });
  await page.mouse.up();
};

test("requires login before board is visible", async ({ page }) => {
  await mockBoardApi(page);
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /sign in to kanban studio/i })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: /^Kanban Studio$/ })
  ).not.toBeVisible();
});

test("loads the kanban board after login", async ({ page }) => {
  await mockBoardApi(page);
  await login(page);

  await expect(
    page.getByRole("heading", { name: /^Kanban Studio$/ })
  ).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await mockBoardApi(page);
  await login(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await mockBoardApi(page);
  await login(page);
  const targetColumn = page.getByTestId("column-col-review");
  await dragCardToLane(page, "card-card-1", "lane-col-review");
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("drops a card into an empty column", async ({ page }) => {
  await mockBoardApi(page);
  await login(page);

  await dragCardToLane(page, "card-card-6", "lane-col-done");
  const reviewColumn = page.getByTestId("column-col-review");
  await expect(reviewColumn.getByText("Drop a card here")).toBeVisible();

  await dragCardToLane(page, "card-card-1", "lane-col-review");
  await expect(reviewColumn.getByTestId("card-card-1")).toBeVisible();
});

test("logs out and returns to login screen", async ({ page }) => {
  await mockBoardApi(page);
  await login(page);

  await page.getByRole("button", { name: /log out/i }).click();

  await expect(
    page.getByRole("heading", { name: /sign in to kanban studio/i })
  ).toBeVisible();
});

test("persists board changes across page refresh", async ({ page }) => {
  await mockBoardApi(page);
  await login(page);

  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Persisted card");
  await firstColumn.getByPlaceholder("Details").fill("Survives refresh");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Persisted card")).toBeVisible();

  await page.reload();
  await login(page);
  await expect(page.getByText("Persisted card")).toBeVisible();
});

test("applies AI-proposed board update only after confirmation", async ({ page }) => {
  await mockBoardApi(page);

  await page.route("**/api/ai/chat**", async (route) => {
    const request = route.request();
    if (request.method() !== "POST") {
      await route.fulfill({ status: 405, body: "Method not allowed" });
      return;
    }

    const body = JSON.parse(request.postData() ?? "{}");
    const nextBoard = structuredClone(body.board);
    nextBoard.columns[0].title = "Ideas";

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        version: "1",
        assistantMessage: "I prepared a rename proposal.",
        boardUpdate: {
          mode: "replace",
          reason: "Rename Backlog to Ideas",
          payload: nextBoard,
        },
        warnings: [],
      }),
    });
  });

  await login(page);
  await ensureAiChatOpen(page);
  await expect(page.locator('input[aria-label="Column title"][value="Backlog"]').first()).toBeVisible();

  await page
    .getByLabel(/ask ai to update board/i)
    .fill("Rename Backlog to Ideas");
  await page.getByRole("button", { name: /^send$/i }).click();

  await expect(page.getByTestId("update-proposal")).toBeVisible();
  await expect(page.locator('input[aria-label="Column title"][value="Backlog"]').first()).toBeVisible();
  await expect(page.locator('input[aria-label="Column title"][value="Ideas"]').first()).toHaveCount(0);

  await page.getByRole("button", { name: /confirm update/i }).click();
  await expect(page.locator('input[aria-label="Column title"][value="Ideas"]').first()).toBeVisible();
});
