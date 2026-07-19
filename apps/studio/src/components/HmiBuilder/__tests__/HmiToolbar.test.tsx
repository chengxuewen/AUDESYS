import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HmiToolbar from "../HmiToolbar";

describe("HmiToolbar", () => {
  it("renders Save, Load, and mode toggle buttons", () => {
    render(
      <HmiToolbar
        editMode={true}
        onToggleMode={vi.fn()}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText("Save")).toBeInTheDocument();
    expect(screen.getByText("Load")).toBeInTheDocument();
    expect(screen.getByText("\u25B6 Preview")).toBeInTheDocument();
  });

  it("shows 'Edit' label when in preview mode", () => {
    render(
      <HmiToolbar
        editMode={false}
        onToggleMode={vi.fn()}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onClear={vi.fn()}
      />,
    );

    expect(screen.getByText("\u270F Edit")).toBeInTheDocument();
  });

  it("shows Clear button only in edit mode", () => {
    const { rerender } = render(
      <HmiToolbar
        editMode={true}
        onToggleMode={vi.fn()}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.getByText("Clear")).toBeInTheDocument();

    rerender(
      <HmiToolbar
        editMode={false}
        onToggleMode={vi.fn()}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    expect(screen.queryByText("Clear")).not.toBeInTheDocument();
  });

  it("calls onSave when Save button is clicked", async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();
    render(
      <HmiToolbar
        editMode={true}
        onToggleMode={vi.fn()}
        onSave={onSave}
        onLoad={vi.fn()}
        onClear={vi.fn()}
      />,
    );
    await user.click(screen.getByText("Save"));
    expect(onSave).toHaveBeenCalledOnce();
  });

  it("calls onClear when Clear button is clicked", async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();
    render(
      <HmiToolbar
        editMode={true}
        onToggleMode={vi.fn()}
        onSave={vi.fn()}
        onLoad={vi.fn()}
        onClear={onClear}
      />,
    );
    await user.click(screen.getByText("Clear"));
    expect(onClear).toHaveBeenCalledOnce();
  });
});
