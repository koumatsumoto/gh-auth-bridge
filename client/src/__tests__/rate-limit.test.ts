import { describe, it, expect } from "vitest";
import { extractRateLimit, isRateLimited } from "../rate-limit.js";

describe("rate-limit", () => {
  describe("extractRateLimit", () => {
    it("extracts remaining and resetAt", () => {
      const headers = new Headers({
        "X-RateLimit-Remaining": "42",
        "X-RateLimit-Reset": "1700000000",
      });
      const info = extractRateLimit(headers);
      expect(info.remaining).toBe(42);
      expect(info.resetAt.getTime()).toBe(1700000000000);
    });

    it("defaults to 0 when headers missing", () => {
      const headers = new Headers();
      const info = extractRateLimit(headers);
      expect(info.remaining).toBe(0);
      expect(info.resetAt.getTime()).toBe(0);
    });
  });

  describe("isRateLimited", () => {
    it("returns true for 429", () => {
      expect(isRateLimited(new Response(null, { status: 429 }))).toBe(true);
    });

    it("returns true for 403 with zero remaining", () => {
      const response = new Response(null, {
        status: 403,
        headers: { "X-RateLimit-Remaining": "0" },
      });
      expect(isRateLimited(response)).toBe(true);
    });

    it("returns false for 403 with remaining > 0", () => {
      const response = new Response(null, {
        status: 403,
        headers: { "X-RateLimit-Remaining": "10" },
      });
      expect(isRateLimited(response)).toBe(false);
    });

    it("returns false for 200", () => {
      expect(isRateLimited(new Response(null, { status: 200 }))).toBe(false);
    });
  });
});
