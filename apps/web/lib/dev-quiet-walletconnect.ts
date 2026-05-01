/**
 * WalletConnect core occasionally calls `console.error({})` while restoring sessions.
 * In dev that surfaces as noisy, empty errors. This filters only a plain empty object
 * as the sole argument (no message string, no Error).
 */
export function installDevEmptyObjectConsoleFilter(): () => void {
  if (process.env.NODE_ENV === "production") {
    return () => undefined;
  }

  const original = console.error;
  console.error = (...args: unknown[]) => {
    if (
      args.length === 1 &&
      typeof args[0] === "object" &&
      args[0] !== null &&
      Object.getPrototypeOf(args[0]) === Object.prototype &&
      Object.keys(args[0] as object).length === 0
    ) {
      return;
    }
    original.apply(console, args as [unknown, ...unknown[]]);
  };

  return () => {
    console.error = original;
  };
}
