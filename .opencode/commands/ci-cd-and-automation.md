# CI/CD and Automation

Automate quality gates so that no change reaches production without passing tests, lint, type checking, and build.

## Quality Gate Pipeline

Every change goes through these gates before merge:

```
PR Opened → LINT → TYPE CHECK → UNIT TESTS → BUILD → INTEGRATION → E2E → SECURITY AUDIT → BUNDLE SIZE → Ready for review
```

**No gate can be skipped.** If lint fails, fix lint — don't disable the rule.

## GitHub Actions Setup

### Basic CI Pipeline
- Checkout code
- Setup Node.js with npm cache
- Install dependencies (`npm ci`)
- Run lint, type check, tests (with coverage), build, security audit

### With Database Integration Tests
- Spin up PostgreSQL service container
- Run migrations
- Run integration tests against the real database

### E2E Tests
- Install Playwright with dependencies
- Build the app
- Run E2E tests
- Upload artifacts on failure

## Deployment Strategies

- **Preview deployments** — Every PR gets a preview for manual testing
- **Feature flags** — Decouple deployment from release. Ship code without enabling it.
- **Staged rollouts** — Staging → Production → Monitor → Rollback if needed
- **Rollback plan** — Every deployment should be reversible

## Environment Management

```
.env.example       → Committed (template)
.env                → NOT committed
.env.test           → Committed (no real secrets)
CI secrets          → GitHub Secrets / vault
Production secrets  → Deployment platform / vault
```

## Trigger

"Set up CI for this project"
"Configure GitHub Actions"
"Add quality gates to the pipeline"

## Output

A working CI pipeline with automated quality gates, deployment configuration, and rollback mechanism.
