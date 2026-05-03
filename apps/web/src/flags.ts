export const featureFlags = {
  enableAgentCatalog: import.meta.env.VITE_ENABLE_AGENT_CATALOG === "true",
  enableVerifierRosterImport: import.meta.env.VITE_ENABLE_VERIFIER_ROSTER_IMPORT !== "false"
};
