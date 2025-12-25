import { Octokit } from "octokit";
import * as core from "@actions/core";

export async function upsertSingleComment(params: {
  octokit: Octokit;
  owner: string;
  repo: string;
  issueNumber: number; // PR number
  body: string;
  tag: string;
}): Promise<void> {
  const { octokit, owner, repo, issueNumber, body, tag } = params;

  const marker = tag.trim();
  const fullBody = `${marker}\n${body}\n`;

  // list comments and find existing
  const perPage = 100;
  let page = 1;
  let existingId: number | null = null;

  try {
    while (true) {
      const res = await octokit.request("GET /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        owner,
        repo,
        issue_number: issueNumber,
        per_page: perPage,
        page
      });
      const items = res.data as any[];
      for (const c of items) {
        const text = String(c.body ?? "");
        if (text.includes(marker)) {
          existingId = Number(c.id);
          break;
        }
      }
      if (existingId) break;
      if (items.length < perPage) break;
      page += 1;
    }

    if (existingId) {
      await octokit.request("PATCH /repos/{owner}/{repo}/issues/comments/{comment_id}", {
        owner,
        repo,
        comment_id: existingId,
        body: fullBody
      });
    } else {
      await octokit.request("POST /repos/{owner}/{repo}/issues/{issue_number}/comments", {
        owner,
        repo,
        issue_number: issueNumber,
        body: fullBody
      });
    }
  } catch (e: any) {
    // permissions-limited fallback: no crash
    core.info(`Unable to create/update PR comment (non-fatal). ${e?.message ?? String(e)}`);
  }
}
