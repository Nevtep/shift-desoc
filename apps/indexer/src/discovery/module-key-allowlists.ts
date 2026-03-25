import { moduleKeys, type ModuleKey } from "./module-keys";

export const contractModuleKeyAllowlists: Record<string, readonly ModuleKey[]> = {
  RequestHub: [moduleKeys.REQUEST_HUB],
  DraftsManager: [moduleKeys.DRAFTS_MANAGER],
  ShiftGovernor: [moduleKeys.SHIFT_GOVERNOR],
  CountingMultiChoice: [moduleKeys.COUNTING_MULTI_CHOICE],
  Engagements: [moduleKeys.ENGAGEMENTS],
  VerifierManager: [moduleKeys.VERIFIER_MANAGER],
  ValuableActionRegistry: [moduleKeys.VALUABLE_ACTION_REGISTRY],
  RevenueRouter: [moduleKeys.REVENUE_ROUTER],
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
