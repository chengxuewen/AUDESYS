import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LdEditor from "../LdEditor";

describe("LdEditor", () => {
  it("renders palette with 5 items", () => {
    render(<LdEditor />);

    expect(screen.getByText("NO Contact")).toBeInTheDocument();
    expect(screen.getByText("NC Contact")).toBeInTheDocument();
    expect(screen.getByText("Output Coil")).toBeInTheDocument();
    expect(screen.getByText("Set Coil")).toBeInTheDocument();
    expect(screen.getByText("Reset Coil")).toBeInTheDocument();

    expect(screen.getByText("Contacts")).toBeInTheDocument();
    expect(screen.getByText("Coils")).toBeInTheDocument();
  });

  it("renders 10 rungs with empty slots", () => {
    render(<LdEditor />);

    for (let i = 1; i <= 10; i++) {
      const label = String(i).padStart(2, "0");
      expect(screen.getByText(label)).toBeInTheDocument();
    }

    const emptySlots = screen.getAllByTitle("Select a contact from palette");
    expect(emptySlots).toHaveLength(50);
  });

  it("Add Rung button increases rung count", () => {
    render(<LdEditor />);

    expect(screen.getByText("10 rungs")).toBeInTheDocument();

    fireEvent.click(screen.getByText("+ Add Rung"));

    expect(screen.getByText("11 rungs")).toBeInTheDocument();

    const emptySlots = screen.getAllByTitle("Select a contact from palette");
    expect(emptySlots).toHaveLength(55);
  });

  it("click cell adds NO contact", () => {
    render(<LdEditor />);

    // Select NO from palette
    const noItem = screen.getByText("NO Contact").closest(".ld-editor__palette-item")! as HTMLElement;
    fireEvent.click(noItem);

    // Slots now show "Add NO"
    const targets = screen.getAllByTitle("Add NO");
    expect(targets.length).toBe(50);

    // Click a slot — need fireEvent to trigger React handler
    fireEvent.click(targets[0]);

    // Slot should become filled
    expect(screen.getAllByTitle("Click to remove").length).toBe(1);
  });
});
