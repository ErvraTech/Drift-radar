import * as core from "@actions/core";
import { makeOctokit, getContextOrThrow, listPullFiles } from "./github";
import { analyze } from "./analyze";
import { computeBaseline, loadBaselineFromCache, saveBaselineToCache } from "./baseline";
import { upsertSingleComment } from "./comment";
import { formatSigned } from "./utils";

function buildComment(params: {
  score: number;
  emoji: string;
  trendText: string;
  reviewMinutes: number;
  drivers: string[];
  actions: string[];
}): string {
  const { score, emoji, trendText, reviewMinutes, drivers, actions } = params;

  const title = "Drift Radar — Structural Risk Signal";
  const line = `Score: ${score}/100 ${emoji}   Trend: ${trendText}   Review Load: ~${reviewMinutes} min`;

  const driversBlock =
    "Main risk drivers:\n" +
    drivers.map((d) => `• ${d}`).join("\n");

  const actionsBlock =
    "Suggested actions:\n" +
    actions.map((a) => `• ${a}`).join("\n");

  return `${title}\n\n${line}\n\n${driversBlock}\n\n${actionsBlock}`;
}

async function run(): Promise<void> {
  const token = core.getInput("github-token", { required: true });
  const mode = core.getInput("mode") || "analyze";
  const historyN = Number(core.getInput("history-prs") || "20");
  const tag = core.getInput("comment-tag") || "<!-- drift-radar -->";
  const pullOverrideStr = (core.getInput("pull-number") || "").trim();
  const pullOverride = pullOverrideStr ? Number(pullOverrideStr) : undefined;

  const octokit = makeOctokit(token);

  // Context: require PR unless refresh-baseline
  let ctx: ReturnType<typeof getContextOrThrow> | null = null;
  try {
    ctx = getContextOrThrow(pullOverride);
  } catch (e: any) {
    if (mode === "refresh-baseline") {
      // baseline refresh without PR context is allowed
      const owner = require("@actions/github").context.repo.owner;
      const repo = require("@actions/github").context.repo.repo;
      const defaultBranch = (require("@actions/github").context.payload as any)?.repository?.default_branch || "main";
      ctx = { owner, repo, pullNumber: 0, defaultBranch };
    } else {
      throw e;
    }
  }

  if (!ctx) throw new Error("Unable to resolve context.");

  const { owner, repo, pullNumber, defaultBranch } = ctx;

  if (mode === "refresh-baseline") {
    core.info(`Mode: refresh-baseline (historyN=${historyN})`);
    const baseline = await computeBaseline(octokit, owner, repo, historyN);
    await saveBaselineToCache(defaultBranch, baseline);
    core.info(`Baseline refreshed. median=${baseline.baselineMedianScore ?? "n/a"} hotspots=${baseline.hotspotFiles.length}`);
    return;
  }

  // mode analyze: needs PR number
  if (!pullNumber || pullNumber <= 0) {
    core.info("No pull request number available. For workflow_dispatch, provide input 'pull-number'.");
    return;
  }

  // Load baseline from cache first; fallback to compute if missing
  let baseline = await loadBaselineFromCache(defaultBranch);
  if (!baseline || baseline.historyN !== historyN) {
    core.info(`Baseline cache miss or N changed; computing baseline from GitHub (historyN=${historyN}).`);
    try {
      baseline = await computeBaseline(octokit, owner, repo, historyN);
      await saveBaselineToCache(defaultBranch, baseline);
    } catch (e: any) {
      core.info(`Unable to compute baseline history (non-fatal): ${e?.message ?? String(e)}`);
      baseline = {
        computedAt: new Date().toISOString(),
        historyN,
        baselineMedianScore: null,
        hotspotFiles: []
      };
    }
  }

  const hotspotSet = new Set<string>(baseline.hotspotFiles || []);

  // PR files
  let files;
  try {
    files = await listPullFiles(octokit, owner, repo, pullNumber);
  } catch (e: any) {
    core.info(`Unable to read PR files. ${e?.message ?? String(e)}`);
    return;
  }

  const res = analyze(files, hotspotSet);

  const baselineScore = baseline.baselineMedianScore;
  const trendText = baselineScore === null ? "n/a" : formatSigned(res.scores.score - Math.round(baselineScore));

  // drivers labels already neutral
  const drivers = res.driversTop3.map((d) => d.label);

  // Permission-limited note (only if baseline missing)
  // Product constraint: keep comment clean, but we can reflect Trend: n/a already.

  const body = buildComment({
    score: res.scores.score,
    emoji: res.scores.verdictEmoji,
    trendText,
    reviewMinutes: res.scores.reviewMinutes,
    drivers,
    actions: res.suggestedActions
  });

  core.info(`Score=${res.scores.score} Trend=${trendText} Review=${res.scores.reviewMinutes}m Drivers=${drivers.join(" | ")}`);

  await upsertSingleComment({
    octokit,
    owner,
    repo,
    issueNumber: pullNumber,
    body,
    tag
  });
}

run().catch((err) => {
  // explicit message, no crashy stack spam
  core.setFailed(err?.message ? String(err.message) : "Drift Radar failed.");
});
