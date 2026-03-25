import type { CommunityModules } from "../../hooks/useCommunityModules";

export function canEditParameters(options: { connected: boolean; modules: CommunityModules | null }): boolean {
  if (!options.connected) return false;
  const modules = options.modules;
  if (!modules) return false;

  // Safety-first gate: editing is only surfaced when governance wiring is present.
  return Boolean(modules.governor && modules.timelock && modules.paramController);
}
