# Incremental Implementation

Build in thin vertical slices — implement one piece, test it, verify it, then expand. Avoid implementing an entire feature in one pass.

## When to Use

- Implementing any multi-file change
- Building a new feature from a task breakdown
- Refactoring existing code
- Any time you're tempted to write more than ~100 lines before testing

## The Increment Cycle

For each slice:
1. **Implement** the smallest complete piece of functionality
2. **Test** — run the test suite (or write a test if none exists)
3. **Verify** — confirm the slice works (tests pass, build succeeds, manual check)
4. **Commit** — save progress with a descriptive message
5. **Move to the next slice** — carry forward, don't restart

## Slicing Strategies

- **Vertical slices** (preferred) — Build one complete path through the stack (DB + API + UI)
- **Contract-first** — Define the API contract first, then backend and frontend develop in parallel
- **Risk-first** — Tackle the riskiest or most uncertain piece first

## Rules

- **Simplicity first** — What is the simplest thing that could work?
- **Scope discipline** — Touch only what the task requires
- **One thing at a time** — Each increment changes one logical thing
- **Keep it compilable** — After each increment, the project must build and tests must pass
- **Feature flags for incomplete features** — Deploy behind flags
- **Safe defaults** — New code defaults to safe, conservative behavior
- **Rollback-friendly** — Each increment should be independently revertable

## Trigger

"Implement this incrementally: [task description]"
"Build this feature slice by slice: [feature]"

## Output

Working, tested code delivered in small, reviewable increments with each leaving the system in a functional state.
