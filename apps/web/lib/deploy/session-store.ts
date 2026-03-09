import type { DeploymentWizardSession } from "./types";

const STORAGE_KEY = "shift.manager.deploy.sessions.v1";

type SessionMap = Record<string, DeploymentWizardSession>;

function readStore(): SessionMap {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as SessionMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: SessionMap): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function saveSession(session: DeploymentWizardSession): void {
  const store = readStore();
  store[session.sessionId] = {
    ...session,
    updatedAt: new Date().toISOString()
  };
  writeStore(store);
}

export function getSession(sessionId: string): DeploymentWizardSession | null {
  const store = readStore();
  return store[sessionId] ?? null;
}

export function listSessions(): DeploymentWizardSession[] {
  return Object.values(readStore()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function clearSession(sessionId: string): void {
  const store = readStore();
  delete store[sessionId];
  writeStore(store);
}

export function findResumeCandidate(
  deployerAddress: `0x${string}`,
  chainId: number,
  communityId?: number
): DeploymentWizardSession | null {
  const normalized = deployerAddress.toLowerCase();
  const sessions = listSessions().filter((session) => {
    if (session.deployerAddress.toLowerCase() !== normalized) return false;
    if (session.chainId !== chainId) return false;
    if (communityId !== undefined) return session.communityId === communityId;
    return session.status === "in-progress" || session.status === "failed";
  });
  return sessions[0] ?? null;
}
