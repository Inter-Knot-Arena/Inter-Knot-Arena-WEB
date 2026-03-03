export const featureFlags = {
  enableAgentCatalog: import.meta.env.VITE_ENABLE_AGENT_CATALOG === "true",
  enableEnkaImport: import.meta.env.VITE_ENABLE_ENKA_IMPORT === "true",
  enableVerifierRosterImport: import.meta.env.VITE_ENABLE_VERIFIER_ROSTER_IMPORT !== "false"
};
