# Code Review and Quality

Conduct a multi-axis code review before merging any change. Review covers five dimensions: correctness, readability, architecture, security, and performance.

## When to Use

- Before merging any PR or change
- After completing a feature implementation
- When another agent or model produced code you need to evaluate
- After any bug fix (review both the fix and the regression test)

## The Five-Axis Review

Every review evaluates code across these dimensions:

1. **Correctness** — Does it match the spec? Edge cases handled? Error paths handled? Tests pass?
2. **Readability & Simplicity** — Are names descriptive? Is control flow straightforward? Could this be done in fewer lines? Are abstractions earning their complexity?
3. **Architecture** — Does it fit the system? Follow existing patterns? Clean module boundaries? No circular dependencies?
4. **Security** — Input validated? Secrets out of code? Auth checks in place? No injection vulnerabilities?
5. **Performance** — No N+1 patterns? No unbounded operations? Pagination on list endpoints?

## Change Sizing

- ~100 lines changed → Good. Reviewable in one sitting.
- ~300 lines changed → Acceptable for a single logical change.
- ~1000 lines changed → Too large. Split it.

## Review Process

1. Understand the context and intent
2. Review the tests first (reveal intent and coverage)
3. Walk through the code with the five axes in mind
4. Categorize findings by severity (Critical / Required / Nit / Optional / FYI)
5. Verify the verification story

## Trigger

"Review this code: [PR/diff/file]"
"Code review: [description]"
"Review for correctness, security, and architecture: [code]"

## Output

A structured review with findings categorized by severity, a verdict (Approve / Request changes), and specific actionable feedback.
