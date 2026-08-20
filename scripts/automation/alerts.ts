import type { AutomationEvent } from "./types";

export interface EventSink { emit(event: AutomationEvent): void | Promise<void>; }

/** Stable JSON output can later be routed to a log collector without changing domain logic. */
export class JsonConsoleEventSink implements EventSink {
  emit(event: AutomationEvent): void { process.stderr.write(`${JSON.stringify(event)}\n`); }
}

export class MemoryEventSink implements EventSink {
  readonly events: AutomationEvent[] = [];
  emit(event: AutomationEvent): void { this.events.push(event); }
}
