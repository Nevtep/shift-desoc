import type { ValuableActionDirectAuthorityStatus } from "../../hooks/useValuableActionAuthorityMode";

/**
 * Builds a truthful governance-fallback status message based on the actual
 * direct-write authority status. "Not authorized" is only claimed when the
 * AccessManager check genuinely returned unauthorized; other statuses get
 * accurate wording instead of a blanket authorization claim.
 *
 * The draft-persistence suffix is also truthful: it only claims the payload
 * was saved when best-effort persistence actually succeeded.
 */
export function buildGovernanceFallbackMessage(
  status: ValuableActionDirectAuthorityStatus,
  operation: "create" | "edit",
  draftSaved: boolean
): string {
  const operationNoun = operation === "create" ? "direct creation" : "direct edits";
  const suffix = buildDraftPersistenceSuffix(draftSaved);

  switch (status) {
    case "unauthorized":
      return `Connected wallet is not authorized for ${operationNoun}. ${suffix}`;
    case "delayed":
      return `Connected wallet is authorized for ${operationNoun} only after an AccessManager execution delay; direct execution is disabled here. ${suffix}`;
    case "unknown":
      return `Wallet authority for ${operationNoun} is still being verified. ${suffix}`;
    case "unavailable":
      return `Wallet authority for ${operationNoun} could not be verified. ${suffix}`;
    default:
      return `Direct execution is unavailable for ${operationNoun}. ${suffix}`;
  }
}

/**
 * Truthful suffix describing whether the governance prefill draft was
 * actually persisted for the proposal builder.
 */
export function buildDraftPersistenceSuffix(draftSaved: boolean): string {
  return draftSaved
    ? "Payload saved for the governance proposal builder."
    : "The draft could not be saved locally; re-enter the details in the governance proposal builder.";
}
