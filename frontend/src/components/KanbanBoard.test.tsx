import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";
import { type BoardData } from "@/lib/kanban";
import { sampleBoard } from "@/test/sampleBoard";

const getFirstColumn = () => screen.getAllByTestId(/column-/i)[0];

const StatefulBoard = () => {
  const [board, setBoard] = useState<BoardData>(sampleBoard);
  return <KanbanBoard board={board} onBoardChange={setBoard} />;
};

describe("KanbanBoard", () => {
  it("renders five columns", () => {
    render(<StatefulBoard />);
    expect(screen.getAllByTestId(/column-/i)).toHaveLength(5);
  });

  it("renames a column", async () => {
    render(<StatefulBoard />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    await userEvent.clear(input);
    await userEvent.type(input, "New Name");
    expect(input).toHaveValue("New Name");
  });

  it("rejects an empty column title and reverts on blur", async () => {
    render(<StatefulBoard />);
    const column = getFirstColumn();
    const input = within(column).getByLabelText("Column title");
    const originalTitle = (input as HTMLInputElement).value;
    await userEvent.clear(input);
    await userEvent.tab();
    expect(input).toHaveValue(originalTitle);
  });

  it("adds and removes a card", async () => {
    render(<StatefulBoard />);
    const column = getFirstColumn();
    const addButton = within(column).getByRole("button", {
      name: /add a card/i,
    });
    await userEvent.click(addButton);

    const titleInput = within(column).getByPlaceholderText(/card title/i);
    await userEvent.type(titleInput, "New card");
    const detailsInput = within(column).getByPlaceholderText(/details/i);
    await userEvent.type(detailsInput, "Notes");

    await userEvent.click(within(column).getByRole("button", { name: /add card/i }));

    expect(within(column).getByText("New card")).toBeInTheDocument();

    const deleteButton = within(column).getByRole("button", {
      name: /delete new card/i,
    });
    await userEvent.click(deleteButton);

    expect(within(column).queryByText("New card")).not.toBeInTheDocument();
  });
});
