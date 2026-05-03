import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AgentCatalog, AgentStatic, DiscSet, DiscSetCatalog } from "@ika/shared";

interface CatalogFile {
  catalogVersion: string;
  agents: Array<Omit<AgentStatic, "catalogVersion">>;
}

interface DiscSetFile {
  catalogVersion: string;
  discSets: DiscSet[];
}

export interface CatalogStore {
  getCatalog(): AgentCatalog;
  getDiscSets(): DiscSetCatalog;
  getDiscSetMap(): Map<number, DiscSet>;
  reload(): Promise<{ catalogVersion: string }>;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const catalogPath = path.join(repoRoot, "packages", "catalog", "agents.v1.json");
const discSetsPath = path.join(repoRoot, "packages", "catalog", "disc-sets.v1.json");

async function readJsonFile<T>(filePath: string): Promise<T> {
  const raw = await readFile(filePath, "utf-8");
  return JSON.parse(raw) as T;
}

function stripColorTags(value: string | undefined): string | undefined {
  if (!value) {
    return value;
  }
  return value.replace(/<color=.*?>|<\/color>/g, "");
}

async function loadCatalog(): Promise<AgentCatalog> {
  const file = await readJsonFile<CatalogFile>(catalogPath);
  const catalogVersion = file.catalogVersion ?? "unknown";
  const agents = (file.agents ?? []).map((agent) => ({
    ...agent,
    catalogVersion
  }));
  return { catalogVersion, agents };
}

async function loadDiscSets(): Promise<DiscSetCatalog> {
  const file = await readJsonFile<DiscSetFile>(discSetsPath);
  const catalogVersion = file.catalogVersion ?? "unknown";
  const discSets = (file.discSets ?? []).map((discSet) => ({
    ...discSet,
    twoPieceBonus: stripColorTags(discSet.twoPieceBonus),
    fourPieceBonus: stripColorTags(discSet.fourPieceBonus)
  }));
  return { catalogVersion, discSets };
}

export async function createCatalogStore(): Promise<CatalogStore> {
  let catalog = await loadCatalog();
  let discSets = await loadDiscSets();
  let discSetMap = new Map(discSets.discSets.map((discSet) => [discSet.gameId, discSet]));

  return {
    getCatalog: () => catalog,
    getDiscSets: () => discSets,
    getDiscSetMap: () => discSetMap,
    reload: async () => {
      catalog = await loadCatalog();
      discSets = await loadDiscSets();
      discSetMap = new Map(discSets.discSets.map((discSet) => [discSet.gameId, discSet]));
      return { catalogVersion: catalog.catalogVersion };
    }
  };
}
