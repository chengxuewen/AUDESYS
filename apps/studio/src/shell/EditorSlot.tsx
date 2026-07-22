// EditorSlot — keepAlive rendering with display:none for same-group tools
// SDD §1: Suspense boundary, Error boundary, group-aware mount/unmount
import { Suspense, Component, type ComponentType, type ReactNode } from "react";
import type { ToolDescriptor, ToolProps } from "../core/ToolRegistry";
import "./EditorSlot.css";

interface EditorSlotProps {
  /** Currently active tool descriptor (undefined if none) */
  activeTool: ToolDescriptor | undefined;
  /** Previously active tool id (for keepAlive logic) */
  prevToolId: string | null;
  /** ToolProps to pass to the active component */
  toolProps: ToolProps;
  /** Check if two tool ids share the same group */
  isSameGroup: (a: string, b: string) => boolean;
}

/** ponytail: simple keepAlive cache — only holds one previous tool component + id */
interface CacheEntry {
  toolId: string;
  component: ComponentType<ToolProps>;
  props: ToolProps;
}

// ponytail: module-scoped cache — single instance per Shell lifecycle
let keepAliveCache: CacheEntry | null = null;

export default function EditorSlot({
  activeTool,
  prevToolId,
  toolProps,
  isSameGroup,
}: EditorSlotProps) {
  if (!activeTool) {
    return (
      <div className="shell-editor-slot shell-editor-slot--empty">
        Select a tool to begin
      </div>
    );
  }

  const ActiveComponent = activeTool.component;

  // Keep-alive: if switching within same group, cache previous for display:none
  const sameGroup = prevToolId && isSameGroup(prevToolId, activeTool.id);
  const prevEntry = keepAliveCache;

  // Update cache
  keepAliveCache = { toolId: activeTool.id, component: ActiveComponent, props: toolProps };

  return (
    <div className="shell-editor-slot">
      <ErrorCatcher>
        <Suspense
          fallback={<div className="shell-editor-slot__loading">Loading...</div>}
        >
          {/* Render previous tool with display:none if same group */}
          {sameGroup && prevEntry && prevEntry.toolId !== activeTool.id && (
            <div className="keepalive">
              <prevEntry.component {...prevEntry.props} />
            </div>
          )}
          {/* Always render active tool */}
          <div className="shell-editor-slot__content">
            <ActiveComponent {...toolProps} />
          </div>
        </Suspense>
      </ErrorCatcher>
    </div>
  );
}

// --- Error boundary (ponytail: minimal) ---
interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorCatcher extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="shell-editor-slot__error">
          <div className="shell-editor-slot__error-title">Tool Error</div>
          <div className="shell-editor-slot__error-message">
            {this.state.error?.message ?? "Unknown error"}
          </div>
          <button
            className="shell-editor-slot__error-retry"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            Retry
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
