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

  const isEmptyObjectLike = (value: unknown): boolean => {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    return (
      Object.keys(value).length === 0 &&
      Object.getOwnPropertyNames(value).length === 0 &&
      Object.getOwnPropertySymbols(value).length === 0
    );
  };

  const isWalletConnectDevNoise = (args: unknown[]): boolean => {
    const isEmptyValue = (value: unknown): boolean => {
      if (value == null) {
        return true;
      }
      if (isEmptyObjectLike(value)) {
        return true;
      }
      if (typeof value === "string") {
        const text = value.trim();
        return text === "" || text === "{}";
      }
      return false;
    };

    // Keep this tightly scoped to WalletConnect callsites to avoid hiding unrelated errors.
    const stack = new Error().stack ?? "";
    const fromWalletConnect =
      stack.includes("@walletconnect_core") ||
      stack.includes("@walletconnect/sign-client") ||
      stack.includes("walletconnect");

    if (!fromWalletConnect) {
      return false;
    }

    if (args.length > 0 && args.every(isEmptyValue)) {
      return true;
    }

    // WalletConnect restore/init in dev sometimes logs opaque object payloads
    // that render as "{}" in the Next overlay.
    if (
      args.length === 1 &&
      typeof args[0] === "object" &&
      args[0] !== null &&
      !(args[0] instanceof Error)
    ) {
      return true;
    }

    return false;
  };

  console.error = (...args: unknown[]) => {
    if (isWalletConnectDevNoise(args)) {
      return;
    }
    original.apply(console, args as [unknown, ...unknown[]]);
  };

  return () => {
    console.error = original;
  };
}
