import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "../src/store/useAppStore.js";

describe("Web AppStore (Zustand)", () => {
  beforeEach(() => {
    useAppStore.setState({ theme: "light", activeRole: "traveller" });
  });

  it("should initialize with default light theme and traveller role", () => {
    const state = useAppStore.getState();
    expect(state.theme).toBe("light");
    expect(state.activeRole).toBe("traveller");
  });

  it("should toggle theme correctly", () => {
    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe("dark");

    useAppStore.getState().toggleTheme();
    expect(useAppStore.getState().theme).toBe("light");
  });

  it("should update active role correctly", () => {
    useAppStore.getState().setActiveRole("host");
    expect(useAppStore.getState().activeRole).toBe("host");

    useAppStore.getState().setActiveRole("admin");
    expect(useAppStore.getState().activeRole).toBe("admin");
  });
});
