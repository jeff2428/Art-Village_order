# AGENTS.md

## Repository Overview

A collection of skills for OpenCode and Claude Code. Skills are in `skills/<name>/SKILL.md`.

## Core Rules

- **Always check for an applicable skill first** before implementing
- **Follow skill workflows exactly** — don't skip steps or verification
- If multiple skills apply, use the sequence: `idea-refine` → `spec-driven-development` → `planning-and-task-breakdown` → `incremental-implementation` → `test-driven-development` → `code-review-and-quality` → `shipping-and-launch`

## Intent → Skill Mapping

| Intent | Skill |
|--------|-------|
| Vague idea/need refinement | `idea-refine` |
| New feature/change | `spec-driven-development` |
| Need task breakdown | `planning-and-task-breakdown` |
| Implementing code | `incremental-implementation` |
| UI work | `frontend-ui-engineering` |
| API design | `api-and-interface-design` |
| Bug/failure | `debugging-and-error-recovery` |
| Code review | `code-review-and-quality` |
| Refactoring | `code-simplification` |

## Core Behaviors (All Skills)

1. **Surface assumptions** before non-trivial work
2. **Stop and ask** when confused or conflicting requirements exist
3. **Push back** on bad approaches with concrete alternatives
4. **Enforce simplicity** — prefer boring, obvious solutions
5. **Maintain scope discipline** — touch only what's asked
6. **Verify** — never assume, always require evidence

## File Locations

- Skills: `skills/<name>/SKILL.md`
- Scripts: `skills/<name>/scripts/{script}.sh`
