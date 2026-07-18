import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ErrorPanel, { type PanelError } from "../ErrorPanel";

const errors: PanelError[] = [
  { line: 10, col: 2, message: "Unexpected token ';'", severity: "error" },
  { line: 5, col: 0, message: "Unused variable 'x'", severity: "warning" },
  { line: 12, col: 4, message: "Type 'string' is not assignable to 'number'", severity: "error" },
];

describe("ErrorPanel", () => {
  it("renders header with error count when errors exist", () => {
    render(<ErrorPanel errors={errors} onErrorClick={vi.fn()} />);

    expect(screen.getByText(/3 issues/)).toBeInTheDocument();
    expect(screen.getByText(/2 errors/)).toBeInTheDocument();
    expect(screen.getByText(/1 warning/)).toBeInTheDocument();
  });

  it("renders header with 'No errors' when empty", () => {
    render(<ErrorPanel errors={[]} onErrorClick={vi.fn()} />);

    expect(screen.getByText("No errors")).toBeInTheDocument();
  });

  it("renders error and warning list items", () => {
    render(<ErrorPanel errors={errors} onErrorClick={vi.fn()} />);

    const items = screen.getAllByRole("button", { name: "Click to jump to location" });
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent("Ln 10, Col 2");
    expect(items[0]).toHaveTextContent("Unexpected token ';'");
    expect(items[1]).toHaveTextContent("Ln 5, Col 0");
    expect(items[2]).toHaveTextContent("Ln 12, Col 4");
  });

  it("calls onErrorClick with line and col when item clicked", async () => {
    const onErrorClick = vi.fn();
    const user = userEvent.setup();

    render(<ErrorPanel errors={errors} onErrorClick={onErrorClick} />);

    const items = screen.getAllByRole("button", { name: "Click to jump to location" });
    await user.click(items[0]);

    expect(onErrorClick).toHaveBeenCalledTimes(1);
    expect(onErrorClick).toHaveBeenCalledWith(10, 2);
  });

  it("collapses and expands when header is clicked", async () => {
    const user = userEvent.setup();

    render(<ErrorPanel errors={errors} onErrorClick={vi.fn()} />);

    const toggle = screen.getByRole("button", { name: "Collapse error panel" });
    await user.click(toggle);

    // After collapse, error items should not be visible
    expect(screen.queryByText("Unexpected token ';'")).not.toBeInTheDocument();

    const expand = screen.getByRole("button", { name: "Expand error panel" });
    await user.click(expand);

    // After expand, items reappear
    expect(screen.getByText("Unexpected token ';'")).toBeInTheDocument();
  });

  it("shows empty state when no errors and not collapsed", () => {
    render(<ErrorPanel errors={[]} onErrorClick={vi.fn()} />);

    expect(screen.getByText("No errors")).toBeInTheDocument();
  });
});
