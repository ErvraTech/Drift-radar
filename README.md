![Drift Radar](https://github.com/ervratech/drift-radar/actions/workflows/drift-radar.yml/badge.svg)
![Version](https://img.shields.io/github/v/tag/ervratech/drift-radar?label=version)
![Marketplace](https://img.shields.io/badge/GitHub%20Marketplace-Drift%20Radar-blue?logo=github)
![License](https://img.shields.io/github/license/ervratech/drift-radar)
![Node](https://img.shields.io/badge/node-20.x-green)

# Drift Radar — GitHub Action

**Detect risky changes before they hit production.**

Drift Radar analyses Pull Requests and computes a **Drift Score (0–100)** that estimates how structurally risky a change is — not just how big it is.

👉 Result: an **automatic Pull Request comment** with a clear verdict.

---

## What Drift Radar does

Drift Radar answers one simple question:

> *“Does this change quietly introduce long-term risk?”*

It looks beyond raw diff size and focuses on **structural drift**.

### It detects:
- Changes touching **core files**
- **Configuration & infrastructure drift**
- Dependency and API surface changes
- Repeated low-level changes that accumulate risk
- PRs that are *small but dangerous*

---

## Output

For every Pull Request, Drift Radar posts a comment like:


Color code:
- 🟢 **0–30** → Low risk  
- 🟡 **31–60** → Moderate drift  
- 🔴 **61–100** → High structural risk  

---

## How it works (high level)

Drift Radar computes a composite score based on:
- File criticality
- Change amplification patterns
- Structural vs cosmetic modifications
- Historical drift signals

📌 No ML  
📌 Deterministic  
📌 Fast  
📌 Zero configuration by default  

---

## Installation

Add this workflow to your repository:

```yaml
name: Drift Radar

on:
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pull-requests: write

jobs:
  drift-radar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run Drift Radar
        uses: ervratech/drift-radar@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}

---

## Contact

Questions, feedback, or ideas?  
Reach out at **contact@ervra.tech**.
