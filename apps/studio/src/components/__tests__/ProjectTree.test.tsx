import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ProjectTree from "../ProjectTree";
import { PlatformContext } from "../../platform/provider";

const mockedInvoke = vi.fn();

const MockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
<PlatformContext.Provider value={{ invoke: mockedInvoke } as any}>{children}</PlatformContext.Provider>
);
import type { StudioEventBus } from "../../core/StudioEventBus";

describe("ProjectTree", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderTree = (eventBus?: StudioEventBus) =>
    render(
      <MockProvider>
        <ProjectTree onFileOpen={vi.fn()} activeFile={null} eventBus={eventBus} />
      </MockProvider>,
    );

  it("renders 'Project' header", () => {
    renderTree();
    expect(screen.getByText("Project")).toBeInTheDocument();
  });

  it("shows Open and New buttons when no project loaded", () => {
    renderTree();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New" })).toBeInTheDocument();
  });

  it("shows resource sections when project is loaded", async () => {
    const projectInfo = {
      name: "test-project",
      entry: "test-project/main.st",
      files: [
        { name: "main.st", path: "test-project/main.st" },
        { name: "io.st", path: "test-project/io.st" },
        { name: "panel.hmi", path: "test-project/panel.hmi" },
      ],
    };
    mockedInvoke.mockResolvedValue(projectInfo);

    renderTree();

    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
    });

    expect(screen.getByText("test-project")).toBeInTheDocument();
    expect(screen.getByText("Programs")).toBeInTheDocument();
    expect(screen.getByText("HMI Layouts")).toBeInTheDocument();
    expect(screen.getByText("main.st")).toBeInTheDocument();
    expect(screen.getByText("io.st")).toBeInTheDocument();
    expect(screen.getByText("panel.hmi")).toBeInTheDocument();
  });

  it("shows only non-empty sections", async () => {
    const projectInfo = {
      name: "minimal-project",
      entry: "main.st",
      files: [{ name: "main.st", path: "main.st" }],
    };
    mockedInvoke.mockResolvedValue(projectInfo);

    renderTree();

    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
    });

    expect(screen.getByText("Programs")).toBeInTheDocument();
    expect(screen.queryByText("HMI Layouts")).not.toBeInTheDocument();
    expect(screen.queryByText("CNC")).not.toBeInTheDocument();
  });

  it("emits project:file-opened event on file click", async () => {
    const projectInfo = {
      name: "test-project",
      entry: "main.st",
      files: [{ name: "main.st", path: "main.st" }],
    };
    mockedInvoke.mockResolvedValue(projectInfo);
    const fakeEmit = vi.fn();
    const fakeBus = { emit: fakeEmit } as unknown as StudioEventBus;

    renderTree(fakeBus);
    await act(() => {
      fireEvent.click(screen.getByRole("button", { name: "Open" }));
    });

    await act(() => {
      fireEvent.click(screen.getByText("main.st"));
    });

    expect(fakeEmit).toHaveBeenCalledWith("project:file-opened", {
      path: "main.st",
      name: "main.st",
    });
  });
});
