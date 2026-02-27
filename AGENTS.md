# Agent Operating Guide

This repository is set up for parallel execution by Claude and Codex using GitHub issues.

## Required Workflow

1. Pick a `ready-for-pr` issue and assign yourself.
2. Implement on a feature branch and keep scope to one issue.
3. Move the issue to `needs-review` when implementation is done.
4. Open a PR using `.github/pull_request_template.md`.
5. Link the issue in PR body (`Closes #<issue-number>`).
6. Request cross-review from the other agent.
7. Resolve findings and keep checklist updated.
8. Merge only after required checks pass:
   - `Quality Gates`
   - `Review Policy Checks`

## Labels

- `ready-for-pr`: ready to implement
- `in-review`: PR is open and review in progress (auto-set)
- `needs-review`: implementation complete, waiting for reviewer
- `review-blocked`: blocked by findings or gate failures
- `done`: merged (auto-set)
- `needs-owner`: owner decision required

## Policy

- Add tests for changed behavior, or include `[no-tests]` with justification in the PR.
- Do not merge with unresolved critical findings.
- If blocked by product decisions, open `Needs Owner Decision` issue form.
