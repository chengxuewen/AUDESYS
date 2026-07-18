import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ObservablePanel from "../ObservablePanel";

describe("ObservablePanel", () => {
  it("renders Observability header", () => {
    render(<ObservablePanel />);
    expect(screen.getByText("Observability")).toBeTruthy();
  });

  it("renders port input with default 9000", () => {
    render(<ObservablePanel />);
    const input = screen.getByPlaceholderText("port") as HTMLInputElement;
    expect(input).toBeTruthy();
    expect(input.value).toBe("9000");
  });

  it("renders Start button", () => {
    render(<ObservablePanel />);
    expect(screen.getByText("Start")).toBeTruthy();
  });
});
