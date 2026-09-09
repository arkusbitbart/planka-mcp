/**
 * Process-level safety net shared by both entry points.
 *
 * - unhandledRejection: logged, the process keeps running. A rejected
 *   promise nobody awaited must not take the whole server down.
 * - uncaughtException: logged, then a graceful shutdown (close the HTTP
 *   listener if there is one) and exit code 1. Continuing after an
 *   uncaught exception risks running with corrupted state, so we hand
 *   over to the supervisor — whose restart policy, not a tight loop
 *   inside this process, decides when to try again.
 */

export interface ProcessGuardOptions {
  /** Called once before exiting on an uncaught exception. */
  shutdown?: () => Promise<void> | void;
  /** Hard exit deadline in case shutdown hangs (default 2000 ms). */
  exitDelayMs?: number;
  /** Exit function, replaceable for tests. */
  exit?: (code: number) => void;
}

let handlers: {
  onRejection: (reason: unknown) => void;
  onException: (error: Error) => void;
} | null = null;

export function installProcessGuards(options: ProcessGuardOptions = {}): void {
  if (handlers) return;

  const exit = options.exit ?? ((code: number) => process.exit(code));

  const onRejection = (reason: unknown) => {
    console.error("Unhandled promise rejection (process keeps running):", reason);
  };

  const onException = (error: Error) => {
    console.error("Uncaught exception, shutting down:", error);

    const deadline = setTimeout(() => exit(1), options.exitDelayMs ?? 2000);
    deadline.unref();

    Promise.resolve()
      .then(() => options.shutdown?.())
      .catch((shutdownError) => {
        console.error("Shutdown after uncaught exception failed:", shutdownError);
      })
      .finally(() => {
        clearTimeout(deadline);
        exit(1);
      });
  };

  process.on("unhandledRejection", onRejection);
  process.on("uncaughtException", onException);
  handlers = { onRejection, onException };
}

/** Test helper: removes only this module's handlers, nothing else's. */
export function resetProcessGuardsForTests(): void {
  if (!handlers) return;
  process.off("unhandledRejection", handlers.onRejection);
  process.off("uncaughtException", handlers.onException);
  handlers = null;
}
