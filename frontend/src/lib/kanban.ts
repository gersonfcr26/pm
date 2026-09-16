export type Card = {
  id: string;
  title: string;
  details: string;
};

export type Column = {
  id: string;
  title: string;
  cardIds: string[];
};

export type BoardData = {
  columns: Column[];
  cards: Record<string, Card>;
};

export const initialData: BoardData = {
  columns: [
    { id: "col-backlog", title: "Backlog", cardIds: ["card-1", "card-2"] },
    { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
    {
      id: "col-progress",
      title: "In Progress",
      cardIds: ["card-4", "card-5"],
    },
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
};

/**
 * Moves a card onto another card (insert at its position) or onto a column
 * (append to the end). Returns the columns unchanged if the card or drop
 * target is not on the board.
 */
export const moveCard = (
  columns: Column[],
  activeId: string,
  overId: string
): Column[] => {
  const fromColumn = columns.find((column) => column.cardIds.includes(activeId));
  const toColumn = columns.find(
    (column) => column.id === overId || column.cardIds.includes(overId)
  );

  if (!fromColumn || !toColumn) {
    return columns;
  }

  const isSameColumn = fromColumn === toColumn;
  const withoutActive = fromColumn.cardIds.filter((cardId) => cardId !== activeId);

  // Within a column the target index is read before removal, so dragging a card
  // downwards lands it after the card it was dropped on.
  const overIndex = isSameColumn
    ? fromColumn.cardIds.indexOf(overId)
    : toColumn.cardIds.indexOf(overId);

  const nextToCardIds = isSameColumn ? withoutActive : [...toColumn.cardIds];
  nextToCardIds.splice(
    overIndex === -1 ? nextToCardIds.length : overIndex,
    0,
    activeId
  );

  return columns.map((column) => {
    if (column.id === toColumn.id) {
      return { ...column, cardIds: nextToCardIds };
    }
    if (column.id === fromColumn.id) {
      return { ...column, cardIds: withoutActive };
    }
    return column;
  });
};

export const createId = (prefix: string) => {
  const randomPart = Math.random().toString(36).slice(2, 8);
  const timePart = Date.now().toString(36);
  return `${prefix}-${randomPart}${timePart}`;
};
