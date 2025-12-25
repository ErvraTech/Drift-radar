import * as core from "@actions/core";
import * as cache from "@actions/cache";
import { Octokit } from "octokit";
import { listMergedPulls, listPullFiles } from "./github";
import { analyze } from "./analyze";
import { median } from "./utils";

export type BaselineData = {
  computedAt: string;
  historyN: number;
  baselineMedianScore: number | null;
  hotspotFiles: string[]; // exact paths
};

const CACHE_PATH = ".drift-radar-cache";
const CACHE_FILE = `${CACHE_PATH}/baseline.json`;

function safeJsonParse(s: string): any | null {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export async function loadBaselineFromCache(defaultBranch: string): Promise<BaselineData | null> {
  try {
    const key = `drift-radar-baseline-${defaultBranch}`;
    await cache.restoreCache([CACHE_PATH], key);
    const fs = await import("fs");
    if (!fs.existsSync(CACHE_FILE)) return null;
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const parsed = safeJsonParse(raw);
    if (!parsed) return null;
    return parsed as BaselineData;
  } catch (e: any) {
    core.info(`Baseline cache restore failed (non-fatal): ${e?.message ?? String(e)}`);
    return null;
  }
}

export async function saveBaselineToCache(defaultBranch: string, data: BaselineData): Promise<void> {
  const fs = await import("fs");
  const path = await import("path");
  fs.mkdirSync(CACHE_PATH, { recursive: true });
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data), "utf8");

  const key = `drift-radar-baseline-${defaultBranch}`;
  try {
    await cache.saveCache([CACHE_PATH], key);
  } catch (e: any) {
    // cache save might fail (already exists), that's fine.
    core.info(`Baseline cache save failed (non-fatal): ${e?.message ?? String(e)}`);
  }
}

export async function computeBaseline(
  octokit: Octokit,
  owner: string,
  repo: string,
  historyN: number
): Promise<BaselineData> {
  const merged = await listMergedPulls(octokit, owner, repo, historyN);

  if (merged.length === 0) {
    return {
      computedAt: new Date().toISOString(),
      historyN,
      baselineMedianScore: null,
      hotspotFiles: []
    };
  }

  // Hotspots: count file frequencies across merged PRs
  const freq = new Map<string, number>();
  const scores: number[] = [];

  // Rate-limit friendly: hard cap how many PRs we fully expand if needed
  const toProcess = merged.slice(0, historyN);

  for (const prNumber of toProcess) {
    const files = await listPullFiles(octokit, owner, repo, prNumber);
    for (const f of files) {
      freq.set(f.filename, (freq.get(f.filename) ?? 0) + 1);
    }

    // Baseline score for this PR (trend baseline uses the same scoring model)
    // Hotspots for historical PR scoring: we don't want circular dependency.
    // Use empty hotspot set when scoring history.
    const res = analyze(files, new Set());
    scores.push(res.scores.score);
  }

  // Determine hotspots: threshold >= 3 occurrences OR top 10, whichever yields more signal.
  const entries = [...freq.entries()].sort((a, b) => b[1] - a[1]);
  const top10 = entries.slice(0, 10).map(([p]) => p);
  const threshold = entries.filter(([, c]) => c >= 3).map(([p]) => p);
  const hotspotSet = new Set<string>([...top10, ...threshold]);

  const baselineMedianScore = median(scores);

  return {
    computedAt: new Date().toISOString(),
    historyN,
    baselineMedianScore,
    hotspotFiles: [...hotspotSet]
  };
}
