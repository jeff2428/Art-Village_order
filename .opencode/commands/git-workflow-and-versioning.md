# Git Workflow and Versioning

Git is your safety net. Treat commits as save points, branches as sandboxes, and history as documentation.

## Core Principles

### Trunk-Based Development (Recommended)
Keep `main` always deployable. Work in short-lived feature branches that merge back within 1-3 days.

### Commit Early, Commit Often
Each successful increment gets its own commit. Implement slice → Test → Verify → Commit → Next slice.

### Atomic Commits
Each commit does one logical thing. Separate refactoring from feature work.

### Descriptive Messages
Commit messages explain the *why*, not just the *what*.

**Format:**
```
<type>: <short description>

<optional body explaining why, not what>
```

**Types:** feat, fix, refactor, test, docs, chore

### Keep Concerns Separate
Don't combine formatting changes with behavior changes. Don't combine refactors with features.

### Size Your Changes
- ~100 lines → Easy to review, easy to revert
- ~300 lines → Acceptable for a single logical change
- ~1000 lines → Split into smaller changes

## Branch Naming

```
feature/<short-description>   → feature/task-creation
fix/<short-description>       → fix/duplicate-tasks
chore/<short-description>     → chore/update-deps
refactor/<short-description>  → refactor/auth-module
```

## Pre-Commit Hygiene

1. Check what you're about to commit: `git diff --staged`
2. Ensure no secrets: `git diff --staged | grep -i "password\|secret\|api_key\|token"`
3. Run tests: `npm test`
4. Run linting: `npm run lint`
5. Run type checking: `npx tsc --noEmit`

## Trigger

"Commit this with a descriptive message"
"Create a feature branch for: [description]"
"Help me organize these changes"

## Output

Clean commit history with atomic, descriptive commits on short-lived branches.
