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
