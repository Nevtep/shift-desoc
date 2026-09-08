import type { ValuableActionDirectAuthorityStatus } from "../../hooks/useValuableActionAuthorityMode";

/**
 * Builds a truthful governance-fallback status message based on the actual
 * direct-write authority status. "Not authorized" is only claimed when the
 * AccessManager check genuinely returned unauthorized; other statuses get
 * accurate wording instead of a blanket authorization claim.
 */
export function buildGovernanceFallbackMessage(
  status: ValuableActionDirectAuthorityStatus,
  operation: "create" | "edit"
): string {
  const operationNoun = operation === "create" ? "direct creation" : "direct edits";
  const suffix = "Payload saved for the governance proposal builder.";

  switch (status) {
    case "unauthorized":
      return `Connected wallet is not authorized for ${operationNoun}. ${suffix}`;
    case "unknown":
      return `Wallet authority for ${operationNoun} is still being verified. ${suffix}`;
    case "unavailable":
      return `Wallet authority for ${operationNoun} could not be verified. ${suffix}`;
    default:
      return `Direct execution is unavailable for ${operationNoun}. ${suffix}`;
  }
}
