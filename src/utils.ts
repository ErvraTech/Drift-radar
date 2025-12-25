export function clamp(min: number, max: number, v: number): number {
  return Math.max(min, Math.min(max, v));
}

export function log10(x: number): number {
  return Math.log(x) / Math.log(10);
}

export function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const a = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(a.length / 2);
  if (a.length % 2 === 0) return (a[mid - 1] + a[mid]) / 2;
  return a[mid];
}

export function round(n: number): number {
  return Math.round(n);
}

export function formatSigned(n: number): string {
  if (n > 0) return `+${n}`;
  return `${n}`;
}

export function isDocsPath(p: string): boolean {
  const lower = p.toLowerCase();
  if (lower.startsWith("docs/")) return true;
  if (lower.endsWith(".md")) return true;
  if (lower.startsWith("readme")) return true;
  return false;
}

export function isInfraPath(p: string): boolean {
  const lower = p.toLowerCase();
  if (lower.startsWith(".github/")) return true;
  if (lower === "dockerfile") return true;
  if (lower.startsWith("terraform/")) return true;
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return true;
  if (lower.endsWith(".tf")) return true;
  return false;
}

export function isCorePath(p: string): boolean {
  const lower = p.toLowerCase();
  return lower.startsWith("src/") || lower.startsWith("lib/") || lower.startsWith("app/");
}

export function isTestsPath(p: string): boolean {
  const lower = p.toLowerCase();
  return lower.startsWith("tests/") || lower.includes("/__tests__/") || lower.startsWith("__tests__/");
}

export function isDepsPath(p: string): boolean {
  const lower = p.toLowerCase();
  const depsFiles = new Set([
    "package.json",
    "package-lock.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "poetry.lock",
    "requirements.txt",
    "pipfile.lock"
  ]);
  return depsFiles.has(lower);
}
