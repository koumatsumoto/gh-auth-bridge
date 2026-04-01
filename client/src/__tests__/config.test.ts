import { describe, it, expect } from "vitest";
import { configure, getProxyUrl } from "../config.js";

describe("config", () => {
  describe("getProxyUrl", () => {
    it("returns configured proxyUrl", () => {
      configure({ proxyUrl: "https://example.com" });
      expect(getProxyUrl()).toBe("https://example.com");
    });

    it("updates on reconfigure", () => {
      configure({ proxyUrl: "https://first.com" });
      expect(getProxyUrl()).toBe("https://first.com");

      configure({ proxyUrl: "https://second.com" });
      expect(getProxyUrl()).toBe("https://second.com");
    });
  });
});
