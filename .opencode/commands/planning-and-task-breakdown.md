# Planning and Task Breakdown

Decompose work into small, verifiable tasks with explicit acceptance criteria and dependency ordering.

## When to Use

- You have a spec and need to break it into implementable units
- A task feels too large or vague to start
- Work needs to be parallelized across multiple agents or sessions
- You need to communicate scope to a human
- The implementation order isn't obvious

## Process

1. **Enter plan mode** — Read-only: read the spec, identify patterns, map dependencies, note risks. Do NOT write code.
2. **Identify the dependency graph** — Map what depends on what
3. **Slice vertically** — Build complete feature paths at a time, not horizontal layers
4. **Write tasks** — Each with: description, acceptance criteria, verification steps, dependencies, files likely touched, estimated scope
5. **Order and checkpoint** — Arrange so dependencies are satisfied, each task leaves the system working, checkpoints every 2-3 tasks

## Task Template

```markdown
## Task [N]: [Title]
**Description:** [One paragraph]
**Acceptance criteria:**
- [ ] [Testable condition]
**Verification:**
- [ ] Tests pass: `npm test -- --grep "..."`
- [ ] Build succeeds: `npm run build`
**Dependencies:** [Task numbers or "None"]
**Files likely touched:**
- `src/path/to/file.ts`
**Estimated scope:** [XS/S/M/L/XL]
```

## Trigger

"Break this into tasks: [spec or description]"
"Plan the implementation for: [feature]"

## Output

A structured task list with phases, checkpoints, dependencies, and risk assessment.
