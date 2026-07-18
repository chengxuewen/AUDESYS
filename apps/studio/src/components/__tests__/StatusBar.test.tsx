import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatusBar from "../StatusBar";

describe("StatusBar", () => {
  it("renders cursor position from line and col props", () => {
    render(<StatusBar line={42} col={7} status="ready" fileName={null} />);

    expect(screen.getByText("Ln 42, Col 7")).toBeInTheDocument();
  });

  it("renders compile status label for 'ready'", () => {
    render(<StatusBar line={1} col={0} status="ready" fileName={null} />);

    expect(screen.getByText("Ready")).toBeInTheDocument();
  });

  it("renders compile status label for 'compiling'", () => {
    render(<StatusBar line={1} col={0} status="compiling" fileName={null} />);

    expect(screen.getByText("Compiling...")).toBeInTheDocument();
  });

  it("renders compile status label for 'error'", () => {
    render(<StatusBar line={1} col={0} status="error" fileName={null} />);

    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("renders compile status label for 'success'", () => {
    render(<StatusBar line={1} col={0} status="success" fileName={null} />);

    expect(screen.getByText("Success")).toBeInTheDocument();
  });

  it("renders file basename when fileName is provided", () => {
    render(
      <StatusBar line={1} col={0} status="ready" fileName="/path/to/main.st" />,
    );

    expect(screen.getByText("main.st")).toBeInTheDocument();
  });

  it("renders untitled.st when fileName is null", () => {
    render(<StatusBar line={1} col={0} status="ready" fileName={null} />);

    expect(screen.getByText("untitled.st")).toBeInTheDocument();
  });

  it("renders windows-style path basename", () => {
    render(
      <StatusBar line={1} col={0} status="ready" fileName="C:\\projects\\demo.st" />,
    );

    expect(screen.getByText(/projects.*demo\.st/)).toBeInTheDocument();
  });
});
