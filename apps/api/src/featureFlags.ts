export interface FeatureFlags {
  enableAgentCatalog: boolean;
  enableEnkaImport: boolean;
}

export function getFeatureFlags(): FeatureFlags {
  return {
    enableAgentCatalog: process.env.ENABLE_AGENT_CATALOG === "true",
    enableEnkaImport: process.env.ENABLE_ENKA_IMPORT === "true"
  };
}
