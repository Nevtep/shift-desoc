import type { ParameterUnit } from "./types";

export type ParameterMappingId =
  | "governance.debateWindow"
  | "governance.votingWindow"
  | "governance.executionDelay"
  | "eligibility.proposalThreshold"
  | "economics.revenueSplit.workersBps"
  | "economics.revenueSplit.treasuryBps"
  | "economics.revenueSplit.investorsBps"
  | "verifier.panelSize"
  | "verifier.minimumApprovals";

export type ParameterMapping = {
  id: ParameterMappingId;
  label: string;
  unit: ParameterUnit;
};

export const OVERVIEW_PARAMETER_MAPPINGS: ParameterMapping[] = [
  { id: "governance.debateWindow", label: "Governance debate window", unit: "seconds" },
  { id: "governance.votingWindow", label: "Governance voting window", unit: "seconds" },
  { id: "governance.executionDelay", label: "Execution delay", unit: "seconds" },
  { id: "eligibility.proposalThreshold", label: "Proposal eligibility threshold", unit: "integer threshold" },
  { id: "economics.revenueSplit.workersBps", label: "Revenue split workers", unit: "bps" },
  { id: "economics.revenueSplit.treasuryBps", label: "Revenue split treasury", unit: "bps" },
  { id: "economics.revenueSplit.investorsBps", label: "Revenue split investors", unit: "bps" },
  { id: "verifier.panelSize", label: "Verifier panel size", unit: "integer threshold" },
  { id: "verifier.minimumApprovals", label: "Verifier minimum approvals", unit: "integer threshold" }
];
