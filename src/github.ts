import { Octokit } from "octokit";
import * as github from "@actions/github";

export type GHContext = {
  owner: string;
  repo: string;
  pullNumber: number;
  defaultBranch: string;
};

export type PRFileApi = {
  filename: string;
  additions: number;
  deletions: number;
};

export function makeOctokit(token: string): Octokit {
  return new Octokit({ auth: token });
}

export function getContextOrThrow(pullNumberOverride?: number): GHContext {
  const ctx = github.context;
  const owner = ctx.repo.owner;
  const repo = ctx.repo.repo;

  const pr = (ctx.payload as any).pull_request;
  const pullNumber = pullNumberOverride ?? pr?.number;

  if (!owner || !repo) throw new Error("Missing repository context.");
  if (!pullNumber) throw new Error("No pull request in context. Provide input 'pull-number' for workflow_dispatch.");

  // defaultBranch might be on payload.repository
  const defaultBranch = (ctx.payload as any)?.repository?.default_branch || "main";

  return { owner, repo, pullNumber: Number(pullNumber), defaultBranch };
}

export async function getPull(octokit: Octokit, owner: string, repo: string, pullNumber: number) {
  const res = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}", {
    owner,
    repo,
    pull_number: pullNumber
  });
  return res.data;
}

export async function listPullFiles(octokit: Octokit, owner: string, repo: string, pullNumber: number): Promise<PRFileApi[]> {
  const perPage = 100;
  let page = 1;
  const out: PRFileApi[] = [];

  while (true) {
    const res = await octokit.request("GET /repos/{owner}/{repo}/pulls/{pull_number}/files", {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: perPage,
      page
    });

    const items = res.data as any[];
    for (const it of items) {
      out.push({
        filename: String(it.filename),
        additions: Number(it.additions ?? 0),
        deletions: Number(it.deletions ?? 0)
      });
    }
    if (items.length < perPage) break;
    page += 1;
  }

  return out;
}

export async function listMergedPulls(octokit: Octokit, owner: string, repo: string, n: number): Promise<number[]> {
  // List closed PRs, filter merged.
  // Note: GitHub API doesn't support merged=true directly for pulls.list; we filter.
  const perPage = 50;
  let page = 1;
  const mergedNumbers: number[] = [];

  while (mergedNumbers.length < n) {
    const res = await octokit.request("GET /repos/{owner}/{repo}/pulls", {
      owner,
      repo,
      state: "closed",
      sort: "updated",
      direction: "desc",
      per_page: perPage,
      page
    });

    const items = res.data as any[];
    if (items.length === 0) break;

    for (const pr of items) {
      if (pr.merged_at) mergedNumbers.push(Number(pr.number));
      if (mergedNumbers.length >= n) break;
    }

    if (items.length < perPage) break;
    page += 1;
  }

  return mergedNumbers.slice(0, n);
}
