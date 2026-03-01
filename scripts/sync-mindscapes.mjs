import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const catalogPath = path.join(repoRoot, "packages", "catalog", "agents.v1.json");
const outputDir = path.join(repoRoot, "apps", "web", "public", "mindscapes");
const manifestPath = path.join(
  repoRoot,
  "apps",
  "web",
  "src",
  "components",
  "roster",
  "mindscapeManifest.ts"
);

const apiBase = "https://zenless-zone-zero.fandom.com/api.php";

const aliasByAgentId = {
  agent_anby: "Anby Demara",
  agent_anton: "Anton Ivanov",
  agent_ben: "Ben Bigger",
  agent_billy: "Billy Kid",
  agent_burnice: "Burnice White",
  agent_caesar: "Caesar King",
  agent_corin: "Corin Wickes",
  agent_ellen: "Ellen Joe",
  agent_grace: "Grace Howard",
  agent_harumasa: "Asaba Harumasa",
  agent_jane: "Jane Doe",
  agent_koleda: "Koleda Belobog",
  agent_lucy: "Luciana de Montefio",
  agent_lycaon: "Von Lycaon",
  agent_miyabi: "Hoshimi Miyabi",
  agent_nekomata: "Nekomiya Mana",
  agent_piper: "Piper Wheel",
  agent_pulchra: "Pulchra Fellini",
  agent_qingyi: "Qingyi",
  agent_rina: "Alexandrina Sebastiane",
  agent_seth: "Seth Lowell",
  agent_soldier_0_anby: "Soldier 0 - Anby",
  agent_soldier_11: "Soldier 11",
  agent_yanagi: "Tsukishiro Yanagi",
  agent_zhu_yuan: "Zhu Yuan"
};

function normalize(value) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function scoreCandidate(query, candidate) {
  const nq = normalize(query);
  const nc = normalize(candidate);
  if (!nq || !nc) return 0;
  if (nq === nc) return 1000;

  let score = 0;
  if (nc.includes(nq)) score += 500;

  const qTokens = nq.split(" ").filter(Boolean);
  for (const token of qTokens) {
    if (nc.includes(token)) score += 50;
  }
  return score;
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Inter-Knot-Arena/1.0 (mindscape sync)"
    }
  });
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }
  return response.json();
}

async function listFullMindscapeFiles() {
  const files = [];
  let next = null;

  while (true) {
    const url = new URL(apiBase);
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "allimages");
    url.searchParams.set("aiprefix", "Mindscape_");
    url.searchParams.set("ailimit", "500");
    url.searchParams.set("format", "json");
    if (next) {
      url.searchParams.set("aicontinue", next);
    }

    const data = await fetchJson(url.toString());
    const images = data?.query?.allimages ?? [];
    for (const item of images) {
      const name = String(item.name ?? "");
      if (/^Mindscape_.+_Full\.(png|jpg|jpeg|webp)$/i.test(name)) {
        files.push(name);
      }
    }

    next = data?.continue?.aicontinue ?? null;
    if (!next) {
      break;
    }
  }

  return files;
}

async function resolveThumbUrl(fileName) {
  const url = new URL(apiBase);
  url.searchParams.set("action", "query");
  url.searchParams.set("titles", `File:${fileName}`);
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url");
  url.searchParams.set("iiurlwidth", "520");
  url.searchParams.set("format", "json");

  const data = await fetchJson(url.toString());
  const pages = data?.query?.pages ?? {};
  const firstPage = Object.values(pages)[0];
  const info = firstPage?.imageinfo?.[0];
  return info?.thumburl ?? info?.url ?? null;
}

async function downloadFile(url, destinationPath) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Inter-Knot-Arena/1.0 (mindscape sync)"
    }
  });
  if (!response.ok) {
    throw new Error(`Download failed ${response.status} for ${url}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  await writeFile(destinationPath, Buffer.from(arrayBuffer));
}

function stripMindscapeName(fileName) {
  return fileName.replace(/^Mindscape_/, "").replace(/_Full\.(png|jpg|jpeg|webp)$/i, "");
}

function pickBestFile(agentName, agentId, fileNames) {
  const alias = aliasByAgentId[agentId];
  const queries = [alias, agentName].filter(Boolean);
  let best = null;

  for (const fileName of fileNames) {
    const candidateName = stripMindscapeName(fileName).replace(/_/g, " ");
    for (const query of queries) {
      const score = scoreCandidate(query, candidateName);
      if (!best || score > best.score) {
        best = { fileName, score };
      }
    }
  }

  if (!best || best.score < 120) {
    return null;
  }
  return best.fileName;
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const raw = await readFile(catalogPath, "utf8");
  const catalog = JSON.parse(raw);
  const agents = catalog?.agents ?? [];
  const fullFiles = await listFullMindscapeFiles();

  const manifest = {};
  const unresolved = [];

  for (const agent of agents) {
    const agentId = String(agent.agentId);
    const fileName = pickBestFile(agent.name, agentId, fullFiles);

    if (!fileName) {
      unresolved.push(`${agent.name} (${agentId})`);
      continue;
    }

    try {
      const thumbUrl = await resolveThumbUrl(fileName);
      if (!thumbUrl) {
        unresolved.push(`${agent.name} (${agentId})`);
        continue;
      }
      const ext = path.extname(new URL(thumbUrl).pathname) || ".png";
      const localFileName = `${agentId}${ext}`;
      const localPath = path.join(outputDir, localFileName);
      await downloadFile(thumbUrl, localPath);
      manifest[agentId] = `/mindscapes/${localFileName}`;
    } catch {
      unresolved.push(`${agent.name} (${agentId})`);
    }
  }

  const sortedEntries = Object.entries(manifest).sort((a, b) => a[0].localeCompare(b[0]));
  const lines = [
    "export const mindscapeManifest: Record<string, string> = {",
    ...sortedEntries.map(([agentId, assetPath]) => `  "${agentId}": "${assetPath}",`),
    "};",
    "",
    "export function getLocalMindscapePath(agentId: string): string | null {",
    "  return mindscapeManifest[agentId] ?? null;",
    "}",
    ""
  ];
  await writeFile(manifestPath, lines.join("\n"), "utf8");

  if (unresolved.length) {
    console.log("Unresolved agents:");
    unresolved.forEach((item) => console.log(`- ${item}`));
  }
  console.log(`Downloaded mindscapes: ${sortedEntries.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
