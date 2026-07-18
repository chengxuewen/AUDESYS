import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SfcEditor from "../SfcEditor";

describe("SfcEditor", () => {
  it("renders with toolbar buttons", () => {
    render(<SfcEditor />);

    expect(screen.getByText("+ Step")).toBeInTheDocument();
    expect(screen.getByText("Copy SFC")).toBeInTheDocument();
  });

  it("Add Step creates a new step box", () => {
    render(<SfcEditor />);

    // Use fireEvent for reliable React event dispatch
    const addBtn = screen.getByText("+ Step");
    fireEvent.click(addBtn);

    // Initial: Init + Step1 = 2, after add: 3
    const stepBoxes = document.querySelectorAll(".sfc-step__box");
    expect(stepBoxes.length).toBe(3);
  });

  it("initial step has double border style", () => {
    render(<SfcEditor />);

    const initialBox = document.querySelector(".sfc-step__box--initial");
    expect(initialBox).toBeInTheDocument();
    expect(initialBox!.textContent).toContain("Init");
    expect(initialBox!.classList.contains("sfc-step__box--initial")).toBe(true);
  });
});
