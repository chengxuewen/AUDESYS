// StudioEventBus — pub/sub event bus with request/response and tool-scoped cleanup
// SDD §3: on, emit, respond, request, cleanupTool, hasResponder
// Test scenarios: EB-001 through EB-015

// ─── Types ───

export type EventHandler<T = unknown> = (payload: T) => void;
export type ResponderHandler<T = unknown, R = unknown> = (
  payload: T,
) => R | Promise<R>;

// ─── Errors ───

export class DuplicateResponderError extends Error {
  constructor(event: string) {
    super(`Duplicate responder for event: ${event}`);
    this.name = "DuplicateResponderError";
  }
}

export class NoResponderError extends Error {
  constructor(event: string) {
    super(`No responder for event: ${event}`);
    this.name = "NoResponderError";
  }
}

export class TimeoutError extends Error {
  constructor(event: string) {
    super(`EventBus request timeout: ${event}`);
    this.name = "TimeoutError";
  }
}

// ─── StudioEventBus ───

export class StudioEventBus {
  private listeners = new Map<string, Set<EventHandler>>();
  private responders = new Map<string, EventHandler>();
  // toolId → Map<eventName, Set<EventHandler>>
  private toolHandlers = new Map<string, Map<string, Set<EventHandler>>>();
  // toolId → Set<eventName>
  private toolResponders = new Map<string, Set<string>>();

  /** Subscribe to an event. Returns unsubscribe function. */
  on<T>(
    event: string,
    handler: EventHandler<T>,
    opts?: { toolId?: string },
  ): () => void {
    const h = handler as EventHandler;

    // Register in listeners map
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(h);

    // Track by toolId if provided
    if (opts?.toolId) {
      if (!this.toolHandlers.has(opts.toolId)) {
        this.toolHandlers.set(opts.toolId, new Map());
      }
      const toolMap = this.toolHandlers.get(opts.toolId)!;
      if (!toolMap.has(event)) {
        toolMap.set(event, new Set());
      }
      toolMap.get(event)!.add(h);
    }

    return () => {
      this.listeners.get(event)?.delete(h);
      if (opts?.toolId) {
        this.toolHandlers.get(opts.toolId)?.get(event)?.delete(h);
      }
    };
  }

  /** Emit an event. All matching handlers are called. Errors are caught. */
  emit<T>(event: string, payload: T): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (e) {
        console.error(`EventBus handler error [${event}]:`, e);
      }
    }
  }

  /** Register a responder. Only one responder per event. */
  respond<T, R>(
    event: string,
    handler: ResponderHandler<T, R>,
    opts?: { toolId?: string },
  ): void {
    if (this.responders.has(event)) {
      throw new DuplicateResponderError(event);
    }
    this.responders.set(event, handler as EventHandler);

    if (opts?.toolId) {
      if (!this.toolResponders.has(opts.toolId)) {
        this.toolResponders.set(opts.toolId, new Set());
      }
      this.toolResponders.get(opts.toolId)!.add(event);
    }
  }

  /** Send a request and wait for the responder's result. */
  async request<T, R>(
    event: string,
    payload?: T,
    timeoutMs = 5000,
  ): Promise<R> {
    const handler = this.responders.get(event);
    if (!handler) {
      throw new NoResponderError(event);
    }

    const result = Promise.resolve(handler(payload) as R);
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(
        () => reject(new TimeoutError(event)),
        timeoutMs,
      ),
    );

    return Promise.race([result, timeout]);
  }

  /** Check if a responder is registered. */
  hasResponder(event: string): boolean {
    return this.responders.has(event);
  }

  /** Remove all listeners and responders for a toolId. */
  cleanupTool(toolId: string): void {
    // Cleanup listeners
    const handlers = this.toolHandlers.get(toolId);
    if (handlers) {
      for (const [event, handlerSet] of handlers) {
        for (const h of handlerSet) {
          this.listeners.get(event)?.delete(h);
        }
      }
    }
    this.toolHandlers.delete(toolId);

    // Cleanup responders
    const respEvents = this.toolResponders.get(toolId);
    if (respEvents) {
      for (const event of respEvents) {
        this.responders.delete(event);
      }
    }
    this.toolResponders.delete(toolId);
  }
}
