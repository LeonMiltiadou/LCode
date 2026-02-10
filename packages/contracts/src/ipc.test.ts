import { describe, expect, it } from "vitest";

import { appBootstrapResultSchema, appHealthResultSchema } from "./ipc";

describe("appBootstrapResultSchema", () => {
  it("accepts valid bootstrap payloads", () => {
    const parsed = appBootstrapResultSchema.parse({
      launchCwd: "/workspace",
      projectName: "workspace",
      provider: "codex",
      model: "gpt-5-codex",
      session: {
        sessionId: "sess-1",
        provider: "codex",
        status: "ready",
        cwd: "/workspace",
        model: "gpt-5-codex",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
      },
    });

    expect(parsed.provider).toBe("codex");
  });

  it("rejects invalid bootstrap payloads", () => {
    expect(() =>
      appBootstrapResultSchema.parse({
        launchCwd: "/workspace",
        projectName: "",
        provider: "codex",
        model: "gpt-5-codex",
        session: {
          sessionId: "sess-1",
          provider: "codex",
          status: "ready",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
      }),
    ).toThrow();
  });

  it("rejects empty bootstrap errors", () => {
    expect(() =>
      appBootstrapResultSchema.parse({
        launchCwd: "/workspace",
        projectName: "workspace",
        provider: "codex",
        model: "gpt-5-codex",
        session: {
          sessionId: "sess-1",
          provider: "codex",
          status: "ready",
          createdAt: "2026-02-01T00:00:00.000Z",
          updatedAt: "2026-02-01T00:00:00.000Z",
        },
        bootstrapError: "",
      }),
    ).toThrow();
  });
});

describe("appHealthResultSchema", () => {
  it("accepts valid health payloads", () => {
    const parsed = appHealthResultSchema.parse({
      status: "ok",
      launchCwd: "/workspace",
      sessionCount: 2,
      activeClientConnected: true,
    });

    expect(parsed.status).toBe("ok");
  });

  it("rejects invalid health payloads", () => {
    expect(() =>
      appHealthResultSchema.parse({
        status: "ok",
        launchCwd: "/workspace",
        sessionCount: -1,
        activeClientConnected: true,
      }),
    ).toThrow();
  });

  it("rejects non-integer session counts", () => {
    expect(() =>
      appHealthResultSchema.parse({
        status: "ok",
        launchCwd: "/workspace",
        sessionCount: 1.5,
        activeClientConnected: true,
      }),
    ).toThrow();
  });
});
