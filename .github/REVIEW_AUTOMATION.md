# Review Automation Setup

This repo includes:

- Issue forms for agent tasks and owner escalations
- PR template with required review/validation checklist
- `Review Gate` workflow for PR policy checks + reviewer packet
- `Issue PR Sync` workflow for automatic issue label transitions

## Required branch protection settings

In GitHub repo settings, protect `main` with:

1. Require a pull request before merging
2. Require approvals: at least 1
3. Require status checks to pass before merging:
   - `Quality Gates` (from `ci.yml`)
   - `Review Policy Checks` (from `review-gate.yml`)
4. Require branches to be up to date before merging
5. Dismiss stale approvals when new commits are pushed

## Linked issue format

Use one of these in PR body so issue automation can sync labels:

- `Closes #123`
- `Fixes #123`
- `Resolves #123`
- `Refs #123`
