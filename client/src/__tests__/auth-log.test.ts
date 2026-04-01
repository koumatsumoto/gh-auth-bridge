import { describe, it, expect, beforeEach } from "vitest";
import { authLog, getAuthLog, clearAuthLog } from "../auth-log.js";

beforeEach(() => {
  clearAuthLog();
});

describe("auth-log", () => {
  it("starts empty", () => {
    expect(getAuthLog()).toEqual([]);
  });

  it("records entries", () => {
    authLog("test-event", "detail");
    const log = getAuthLog();
    expect(log).toHaveLength(1);
    expect(log[0]?.event).toBe("test-event");
    expect(log[0]?.detail).toBe("detail");
    expect(log[0]?.timestamp).toBeTruthy();
  });

  it("limits to 50 entries", () => {
    for (let i = 0; i < 60; i++) {
      authLog(`event-${String(i)}`);
    }
    const log = getAuthLog();
    expect(log).toHaveLength(50);
    expect(log[0]?.event).toBe("event-10");
    expect(log[49]?.event).toBe("event-59");
  });

  it("clearAuthLog resets", () => {
    authLog("event");
    clearAuthLog();
    expect(getAuthLog()).toEqual([]);
  });

  it("getAuthLog returns a copy", () => {
    authLog("event");
    const log1 = getAuthLog();
    const log2 = getAuthLog();
    expect(log1).not.toBe(log2);
    expect(log1).toEqual(log2);
  });
});
