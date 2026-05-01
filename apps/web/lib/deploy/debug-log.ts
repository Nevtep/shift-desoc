"use client";

const DEPLOY_DEBUG_STORAGE_KEY = "shift.debug.deploy";

function readFlagFromRuntime(): boolean {
  if (typeof window === "undefined") return false;

  try {
    if (window.localStorage.getItem(DEPLOY_DEBUG_STORAGE_KEY) === "1") {
      return true;
    }
  } catch {
    // Ignore storage access errors in restricted environments.
  }

  const params = new URLSearchParams(window.location.search);
  return params.get("deployDebug") === "1";
}

export function isDeployDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEPLOY_DEBUG === "1" || readFlagFromRuntime();
}

export function deployDebugLog(prefix: string, message: string, meta?: unknown): void {
  if (!isDeployDebugEnabled()) return;
  if (meta === undefined) {
    console.log(`${prefix} ${message}`);
    return;
  }
  console.log(`${prefix} ${message}`, meta);
}
