import { Schema } from "effect";

// ── Log Entry Schema ─────────────────────────────────────────────────

export const LogLevel = Schema.Literals(["info", "warn", "error", "event"]);
export type LogLevel = typeof LogLevel.Type;

export const LogEntry = Schema.Struct({
  id: Schema.Number,
  timestamp: Schema.String,
  level: LogLevel,
  scope: Schema.String,
  message: Schema.String,
  context: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
});
export type LogEntry = typeof LogEntry.Type;

export const ServerGetLogsInput = Schema.Struct({});
export type ServerGetLogsInput = typeof ServerGetLogsInput.Type;
