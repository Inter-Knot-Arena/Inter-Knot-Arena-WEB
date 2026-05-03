export interface FeatureFlags {
  enableAgentCatalog: boolean;
  enableVerifierRosterImport: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    enableAgentCatalog: process.env.ENABLE_AGENT_CATALOG === "true",
    enableVerifierRosterImport: process.env.ENABLE_VERIFIER_ROSTER_IMPORT !== "false"
  };
}
