import { moveCard, type Column } from "@/lib/kanban";

describe("moveCard", () => {
  const baseColumns: Column[] = [
    { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
    { id: "col-b", title: "B", cardIds: ["card-3"] },
  ];

  it("reorders cards in the same column", () => {
    const result = moveCard(baseColumns, "card-2", "card-1");
    expect(result[0].cardIds).toEqual(["card-2", "card-1"]);
  });

  it("drops a card after the target when dragged downwards", () => {
    const columns: Column[] = [
      { id: "col-a", title: "A", cardIds: ["card-1", "card-2", "card-3"] },
    ];

    const result = moveCard(columns, "card-1", "card-3");

    expect(result[0].cardIds).toEqual(["card-2", "card-3", "card-1"]);
  });

  it("leaves the board untouched for an unknown card", () => {
    expect(moveCard(baseColumns, "missing", "card-1")).toBe(baseColumns);
  });

  it("moves cards to another column", () => {
    const result = moveCard(baseColumns, "card-2", "card-3");
    expect(result[0].cardIds).toEqual(["card-1"]);
    expect(result[1].cardIds).toEqual(["card-2", "card-3"]);
  });

  it("drops cards to the end of a column", () => {
    const result = moveCard(baseColumns, "card-1", "col-b");
    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-3", "card-1"]);
  });

  it("drops cards into an empty column", () => {
    const columnsWithEmpty: Column[] = [
      { id: "col-a", title: "A", cardIds: ["card-1", "card-2"] },
      { id: "col-empty", title: "Empty", cardIds: [] },
    ];

    const result = moveCard(columnsWithEmpty, "card-1", "col-empty");

    expect(result[0].cardIds).toEqual(["card-2"]);
    expect(result[1].cardIds).toEqual(["card-1"]);
  });
});
