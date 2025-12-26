
DRIFT RADAR — USAGE NOTES
============================================================

Overview
--------
Drift Radar is designed to be used with minimal configuration.
It runs automatically on Pull Requests and posts a single
comment summarizing structural drift signals.

No action is required from the user once installed.

------------------------------------------------------------

Installation
------------
Drift Radar is distributed as a GitHub Action.

Basic installation consists of adding a workflow file to the
repository.

Example:

.github/workflows/drift-radar.yml

<minimal example here>

------------------------------------------------------------

When Drift Radar Runs
--------------------
- On pull_request events
- On workflow_dispatch (optional)

It does not run on every push by default.

------------------------------------------------------------

Output
------
Drift Radar posts a single, stable comment on the Pull Request.

The comment:
- is updated on each run
- does not spam the PR
- does not block merges
- does not fail the CI

------------------------------------------------------------

How to Read the Comment
-----------------------
The drift signal should be read as contextual information.

Examples:
- A higher signal indicates structural amplification
- A lower signal indicates continuity with historical evolution

There is no "good" or "bad" score.

------------------------------------------------------------

Typical Developer Workflow
--------------------------
1. Open a Pull Request
2. Review the Drift Radar comment
3. Use it as additional context during review
4. Decide normally whether to merge

------------------------------------------------------------

Configuration
-------------
Drift Radar requires little to no configuration.

Optional parameters may include:
- history window size
- verbosity level

Defaults are designed to be safe and interpretable.

------------------------------------------------------------

Limitations
-----------
- Drift Radar does not understand business logic
- It does not assess correctness
- It does not replace code review

------------------------------------------------------------

Troubleshooting
---------------
If Drift Radar does not appear on a PR:
- check that the workflow is enabled
- check repository permissions
- check GitHub Actions logs

------------------------------------------------------------


