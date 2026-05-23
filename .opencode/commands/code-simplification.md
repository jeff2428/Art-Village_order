# Code Simplification

Simplify code by reducing complexity while preserving exact behavior. The goal is code that is easier to read, understand, modify, and debug — not fewer lines.

## When to Use

- After a feature is working and tests pass, but the implementation feels heavier than it needs to be
- During code review when readability or complexity issues are flagged
- When you encounter deeply nested logic, long functions, or unclear names
- When refactoring code written under time pressure

## When NOT to Use

- Code is already clean and readable
- You don't understand what the code does yet
- The code is performance-critical and the "simpler" version would be measurably slower

## The Five Principles

1. **Preserve behavior exactly** — All inputs, outputs, side effects, error behavior must remain identical
2. **Follow project conventions** — Match the codebase's style, not external preferences
3. **Prefer clarity over cleverness** — Explicit code > compact code when compact requires a mental pause
4. **Maintain balance** — Avoid over-simplification traps (inlining too aggressively, combining unrelated logic)
5. **Scope to what changed** — Simplify recently modified code, avoid drive-by refactors

## The Process

1. **Understand before touching** (Chesterton's Fence) — What is this code's responsibility? What calls it? Edge cases?
2. **Identify simplification opportunities** — Deep nesting, long functions, generic names, duplicated logic, dead code
3. **Apply changes incrementally** — One simplification at a time. Run tests after each change.
4. **Verify the result** — Is the simplified version genuinely easier to understand?

## Trigger

"Simplify this: [file/function]"
"Refactor for clarity: [description]"
"Reduce complexity in: [code]"

## Output

Simplified code with preserved behavior, verified by passing tests, with a clean diff showing only the simplifications.
