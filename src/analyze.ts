import { clamp, log10, round, isCorePath, isTestsPath, isDepsPath, isInfraPath, isDocsPath } from "./utils";

export type ClassifiedCounts = {
  F: number;
  L: number;
  C: number;
  T: number;
  D: number;
  I: number;
  H: number;
  docsOnly: boolean;
  testCoverage: number;
};

export type Scores = {
  S_size: number;
  S_deps: number;
  S_infra: number;
  S_hot: number;
  S_quality: number;
  base: number;
  amp: number;
  score: number;
  reviewMinutes: number;
  verdictEmoji: "🟢" | "🟡" | "🔴";
};

export type Driver = {
  key:
    | "Core changed without tests"
    | "Dependency churn"
    | "Infra/config touched"
    | "Hotspot repeatedly modified"
    | "Large change size"
    | "Low test coverage";
  label: string;
  contribution: number;
};

export type AnalyzeResult = {
  counts: ClassifiedCounts;
  scores: Scores;
  driversTop3: Driver[];
  suggestedActions: string[];
};

export type PRFile = {
  filename: string;
  additions: number;
  deletions: number;
};

export function classifyFiles(files: PRFile[], hotspotSet: Set<string>): ClassifiedCounts {
  let F = 0,
    L = 0,
    C = 0,
    T = 0,
    D = 0,
    I = 0,
    H = 0;

  let docsCount = 0;

  for (const f of files) {
    F += 1;
    const lines = (f.additions || 0) + (f.deletions || 0);
    L += lines;

    const path = f.filename;
    const isDocs = isDocsPath(path);
    if (isDocs) docsCount += 1;

    if (isCorePath(path)) C += 1;
    if (isTestsPath(path)) T += 1;
    if (isDepsPath(path)) D += 1;
    if (isInfraPath(path)) I += 1;

    if (hotspotSet.has(path)) H += 1;
  }

  const docsOnly = files.length > 0 && docsCount === files.length;
  const testCoverage = T / Math.max(1, C);

  return { F, L, C, T, D, I, H, docsOnly, testCoverage };
}

export function computeReviewMinutes(F: number, L: number, C: number, T: number, D: number, I: number, H: number): number {
  const sizeUnits = Math.sqrt(Math.max(0, L)) + 2 * F;

  const m_core = 1 + 0.15 * Math.min(5, C);
  const m_infra = 1 + 0.2 * Math.min(3, I);
  const m_deps = 1 + 0.25 * Math.min(2, D);
  const m_hot = 1 + 0.1 * Math.min(5, H);
  const m_tests = 1 - 0.1 * Math.min(3, T);

  const raw = (sizeUnits / 12) * m_core * m_infra * m_deps * m_hot * m_tests;
  return clamp(5, 90, round(raw));
}

export function computeScores(counts: ClassifiedCounts): Scores {
  const { F, L, C, T, D, I, H, testCoverage, docsOnly } = counts;

  const S_size = clamp(0, 100, 8 * F + 12 * log10(1 + Math.max(0, L)));
  const S_deps = clamp(0, 100, 35 * D);
  const S_infra = clamp(0, 100, 25 * I);
  const S_hot = clamp(0, 100, 20 * H);
  const S_quality = clamp(0, 100, 60 * (1 - Math.min(1, testCoverage)));

  const base = 0.35 * S_size + 0.2 * S_quality + 0.2 * S_deps + 0.15 * S_infra + 0.1 * S_hot;

  let amp = 1.0;
  if (C > 0 && T === 0) amp += 0.15;
  if (D > 0 && I > 0) amp += 0.1;
  if (C > 0 && D > 0) amp += 0.1;
  if (H >= 2) amp += 0.05;
  amp = Math.min(1.4, amp);

  let score = clamp(0, 100, round(base * amp));

  // Docs-only cap
  if (docsOnly) score = Math.min(score, 25);

  const verdictEmoji = score <= 39 ? "🟢" : score <= 69 ? "🟡" : "🔴";
  const reviewMinutes = computeReviewMinutes(F, L, C, T, D, I, H);

  return { S_size, S_deps, S_infra, S_hot, S_quality, base, amp, score, reviewMinutes, verdictEmoji };
}

export function pickDrivers(counts: ClassifiedCounts, scores: Scores): Driver[] {
  const { C, T, D, I, H, testCoverage } = counts;
  const { S_size, S_quality, S_deps, S_infra, S_hot } = scores;

  const drivers: Driver[] = [];

  // contribution weights aligned with base weights + amplification bonuses
  const contribLarge = 0.35 * S_size;

  const qualityBase = 0.2 * S_quality;
  const bonusCoreNoTests = C > 0 && T === 0 ? 12 : 0; // pushes it up when it matters
  const contribLowTests = qualityBase + (testCoverage < 1 ? 0 : 0) + bonusCoreNoTests;

  const depsBase = 0.2 * S_deps;
  const bonusDepsInfra = D > 0 && I > 0 ? 6 : 0;
  const bonusDepsCore = C > 0 && D > 0 ? 6 : 0;
  const contribDeps = depsBase + bonusDepsInfra + bonusDepsCore;

  const infraBase = 0.15 * S_infra;
  const contribInfra = infraBase;

  const hotBase = 0.1 * S_hot;
  const bonusHot = H >= 2 ? 3 : 0;
  const contribHot = hotBase + bonusHot;

  if (C > 0 && T === 0) {
    drivers.push({
      key: "Core changed without tests",
      label: "Core code modified without tests",
      contribution: bonusCoreNoTests + 0.15 * 100 // reflect amp effect
    });
  }

  drivers.push({ key: "Large change size", label: "Large change size", contribution: contribLarge });

  if (testCoverage < 1) {
    drivers.push({ key: "Low test coverage", label: "Low test coverage", contribution: contribLowTests });
  }

  if (D > 0) {
    drivers.push({ key: "Dependency churn", label: "Dependency churn above baseline", contribution: contribDeps });
  }

  if (I > 0) {
    drivers.push({ key: "Infra/config touched", label: "Infra/config touched", contribution: contribInfra });
  }

  if (H > 0) {
    drivers.push({ key: "Hotspot repeatedly modified", label: "Repeated changes in hotspot folders", contribution: contribHot });
  }

  // Sort by contribution, unique by key
  const bestByKey = new Map<string, Driver>();
  for (const d of drivers) {
    const existing = bestByKey.get(d.key);
    if (!existing || d.contribution > existing.contribution) bestByKey.set(d.key, d);
  }

  return [...bestByKey.values()].sort((a, b) => b.contribution - a.contribution).slice(0, 3);
}

export function suggestedActions(counts: ClassifiedCounts, score: number): string[] {
  const { C, T, D, I, docsOnly } = counts;
  const actions: string[] = [];

  if (docsOnly) return ["No action needed (docs-only change)"];

  if (C > 0 && T === 0) actions.push("Add targeted tests");
  if (score >= 70) actions.push("Split this PR");
  else if (score >= 40 && (D > 0 || I > 0)) actions.push("Add a focused review checklist");

  if (actions.length === 0) actions.push("Proceed with normal review");

  return actions.slice(0, 2);
}

export function analyze(files: PRFile[], hotspotSet: Set<string>): AnalyzeResult {
  const counts = classifyFiles(files, hotspotSet);
  const scores = computeScores(counts);
  const driversTop3 = pickDrivers(counts, scores);
  const suggested = suggestedActions(counts, scores.score);

  return {
    counts,
    scores,
    driversTop3,
    suggestedActions: suggested
  };
}
