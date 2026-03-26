import { moduleKeys, type ModuleKey } from "./module-keys";

export const contractModuleKeyAllowlists: Record<string, readonly ModuleKey[]> = {
  ShiftAccessManager: [moduleKeys.ACCESS_MANAGER],
  MembershipTokenERC20Votes: [moduleKeys.MEMBERSHIP_TOKEN],
  RequestHub: [moduleKeys.REQUEST_HUB],
  DraftsManager: [moduleKeys.DRAFTS_MANAGER],
  ShiftGovernor: [moduleKeys.SHIFT_GOVERNOR],
  CountingMultiChoice: [moduleKeys.COUNTING_MULTI_CHOICE],
  Engagements: [moduleKeys.ENGAGEMENTS],
  VerifierPowerToken1155: [moduleKeys.VERIFIER_POWER_TOKEN],
  VerifierElection: [moduleKeys.VERIFIER_ELECTION],
  VerifierManager: [moduleKeys.VERIFIER_MANAGER],
  ValuableActionRegistry: [moduleKeys.VALUABLE_ACTION_REGISTRY],
  ValuableActionSBT: [moduleKeys.VALUABLE_ACTION_SBT],
  RevenueRouter: [moduleKeys.REVENUE_ROUTER],
  ParamController: [moduleKeys.PARAM_CONTROLLER],
  TreasuryVault: [moduleKeys.TREASURY_VAULT],
  TreasuryAdapter: [moduleKeys.TREASURY_ADAPTER],
  CohortRegistry: [moduleKeys.COHORT_REGISTRY],
  InvestmentCohortManager: [moduleKeys.INVESTMENT_COHORT_MANAGER],
  PositionManager: [moduleKeys.POSITION_MANAGER],
  CredentialManager: [moduleKeys.CREDENTIAL_MANAGER],
  Marketplace: [moduleKeys.MARKETPLACE],
  HousingManager: [moduleKeys.HOUSING_MANAGER],
  CommerceDisputes: [moduleKeys.COMMERCE_DISPUTES],
  ProjectFactory: [moduleKeys.PROJECT_FACTORY],
};

export const isAllowedModuleKey = (contractName: string, moduleKey: string) => {
  const allowlist = contractModuleKeyAllowlists[contractName];
  if (!allowlist) return true;
  return allowlist.includes(moduleKey);
};
