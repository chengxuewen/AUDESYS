import { describe, it, expect, beforeAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import FbdEditor from "../FbdEditor";

// Minimal DataTransfer polyfill for jsdom
class StubDataTransfer {
  dropEffect: string = "none";
  effectAllowed: string = "none";
  files: never[] = [];
  items: never[] = [];
  types: string[] = [];

  private _data: Record<string, string> = {};

  clearData(format?: string): void {
    if (format) delete this._data[format];
    else this._data = {};
  }
  getData(format: string): string {
    return this._data[format] ?? "";
  }
  setData(format: string, data: string): void {
    this._data[format] = data;
    if (!this.types.includes(format)) (this.types as string[]).push(format);
  }
  setDragImage(): void {}
}

beforeAll(() => {
  (globalThis as Record<string, unknown>).DataTransfer =
    StubDataTransfer as unknown as typeof DataTransfer;
});

describe("FbdEditor", () => {
  it("renders palette with block categories", () => {
    render(<FbdEditor />);

    expect(screen.getByText("Timers")).toBeInTheDocument();
    expect(screen.getByText("Counters")).toBeInTheDocument();
    expect(screen.getByText("Bistables")).toBeInTheDocument();
    expect(screen.getByText("Edge Detection")).toBeInTheDocument();
    expect(screen.getByText("Arithmetic")).toBeInTheDocument();
    expect(screen.getByText("Comparison")).toBeInTheDocument();

    expect(screen.getByText("TON")).toBeInTheDocument();
    expect(screen.getByText("CTU")).toBeInTheDocument();
    expect(screen.getByText("RS")).toBeInTheDocument();
  });

  it("click block adds to canvas", () => {
    render(<FbdEditor />);

    const canvas = document.querySelector(".fbd-canvas") as HTMLElement;
    expect(canvas).toBeInTheDocument();

    const tonItem = screen.getByText("TON").closest(".fbd-palette__item")! as HTMLElement;
    const dt = new DataTransfer();
    dt.setData("text/plain", "TON");

    fireEvent.dragStart(tonItem, { dataTransfer: dt });
    fireEvent.dragOver(canvas, { dataTransfer: dt });
    fireEvent.drop(canvas, { dataTransfer: dt });

    // After drop, TON is both in palette and on canvas — expect 2 occurrences
    const tonElements = screen.getAllByText("TON");
    expect(tonElements.length).toBe(2);

    // One of them is a block header label on the canvas
    const blockLabels = document.querySelectorAll(".fbd-block__label");
    expect(blockLabels.length).toBe(1);
    expect(blockLabels[0].textContent).toBe("TON");
  });

  it("canvas renders SVG element", () => {
    render(<FbdEditor />);

    const canvas = document.querySelector(".fbd-canvas") as HTMLElement;
    expect(canvas).toBeInTheDocument();

    const tonItem = screen.getByText("TON").closest(".fbd-palette__item")! as HTMLElement;
    const dt = new DataTransfer();
    dt.setData("text/plain", "TON");

    fireEvent.dragStart(tonItem, { dataTransfer: dt });
    fireEvent.dragOver(canvas, { dataTransfer: dt });
    fireEvent.drop(canvas, { dataTransfer: dt });

    const svg = canvas.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });
});
