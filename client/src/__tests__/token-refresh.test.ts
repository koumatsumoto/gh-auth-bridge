import { describe, it, expect, beforeEach } from "vitest";
import { registerTokenRefresh, getTokenRefreshFn, _resetTokenRefresh } from "../token-refresh.js";

beforeEach(() => {
  _resetTokenRefresh();
});

describe("token-refresh", () => {
  it("returns null when no function registered", () => {
    expect(getTokenRefreshFn()).toBeNull();
  });

  it("returns registered function", () => {
    const fn = () => Promise.resolve("new-token");
    registerTokenRefresh(fn);
    expect(getTokenRefreshFn()).toBe(fn);
  });

  it("overwrites previous registration", () => {
    const fn1 = () => Promise.resolve("token-1");
    const fn2 = () => Promise.resolve("token-2");
    registerTokenRefresh(fn1);
    registerTokenRefresh(fn2);
    expect(getTokenRefreshFn()).toBe(fn2);
  });

  it("_resetTokenRefresh clears registration", () => {
    registerTokenRefresh(() => Promise.resolve("token"));
    _resetTokenRefresh();
    expect(getTokenRefreshFn()).toBeNull();
  });
});
