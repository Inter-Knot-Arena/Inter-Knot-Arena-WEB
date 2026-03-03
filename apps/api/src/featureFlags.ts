export interface FeatureFlags {
  enableAgentCatalog: boolean;
  enableEnkaImport: boolean;
  enableVerifierRosterImport: boolean;
  enableAccumulativeImport: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    enableAgentCatalog: process.env.ENABLE_AGENT_CATALOG === "true",
    enableEnkaImport: process.env.ENABLE_ENKA_IMPORT === "true",
    enableVerifierRosterImport: process.env.ENABLE_VERIFIER_ROSTER_IMPORT !== "false",
    enableAccumulativeImport: process.env.ENABLE_ACCUMULATIVE_IMPORT === "true"
  };
}
