/**
 * Tests for the process-level safety net.
 *
 * unhandledRejection must be logged without exiting; uncaughtException
 * must run the shutdown hook once and then exit with code 1 — never loop.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  installProcessGuards,
  resetProcessGuardsForTests,
} from "../src/process-guards.js";

beforeEach(() => {
  resetProcessGuardsForTests();
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  resetProcessGuardsForTests();
  vi.restoreAllMocks();
});

describe("installProcessGuards", () => {
  it("registers exactly one handler each and is idempotent", () => {
    const before = {
      rejection: process.listenerCount("unhandledRejection"),
      exception: process.listenerCount("uncaughtException"),
    };
    installProcessGuards();
    installProcessGuards();
    expect(process.listenerCount("unhandledRejection")).toBe(before.rejection + 1);
    expect(process.listenerCount("uncaughtException")).toBe(before.exception + 1);
  });

  it("logs an unhandled rejection without exiting", () => {
    const exit = vi.fn();
    installProcessGuards({ exit });

    process.emit("unhandledRejection", new Error("boom"), Promise.resolve());

    expect(console.error).toHaveBeenCalled();
    expect(exit).not.toHaveBeenCalled();
  });

  it("runs shutdown once, then exits 1 on an uncaught exception", async () => {
    const exit = vi.fn();
    const shutdown = vi.fn(async () => undefined);
    installProcessGuards({ exit, shutdown });

    process.emit("uncaughtException", new Error("boom"));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(shutdown).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it("still exits when the shutdown hook throws", async () => {
    const exit = vi.fn();
    installProcessGuards({
      exit,
      shutdown: async () => {
        throw new Error("close failed");
      },
    });

    process.emit("uncaughtException", new Error("boom"));
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(exit).toHaveBeenCalledWith(1);
  });

  it("exits at the deadline when shutdown hangs", async () => {
    const exit = vi.fn();
    installProcessGuards({
      exit,
      exitDelayMs: 20,
      shutdown: () => new Promise<void>(() => undefined), // never resolves
    });

    process.emit("uncaughtException", new Error("boom"));
    await new Promise((resolve) => setTimeout(resolve, 60));

    expect(exit).toHaveBeenCalledWith(1);
  });
});
