import { describe, it, expect, beforeEach } from "vitest";
import { useMobileStore } from "../src/store/useMobileStore.js";

describe("Mobile Store (Zustand)", () => {
  beforeEach(() => {
    useMobileStore.setState({ role: "traveller" });
  });

  it("should default to traveller role", () => {
    expect(useMobileStore.getState().role).toBe("traveller");
  });

  it("should switch role to host and back to traveller", () => {
    useMobileStore.getState().setRole("host");
    expect(useMobileStore.getState().role).toBe("host");

    useMobileStore.getState().setRole("traveller");
    expect(useMobileStore.getState().role).toBe("traveller");
  });
});
