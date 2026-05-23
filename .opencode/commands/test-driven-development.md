# Test-Driven Development

Write a failing test before writing the code that makes it pass. For bug fixes, reproduce the bug with a test before attempting a fix.

## When to Use

- Implementing any new logic or behavior
- Fixing any bug (the Prove-It Pattern)
- Modifying existing functionality
- Adding edge case handling
- Any change that could break existing behavior

## The TDD Cycle

```
RED → GREEN → REFACTOR → (repeat)
```

1. **RED** — Write a test that fails. It must fail. A test that passes immediately proves nothing.
2. **GREEN** — Write the minimum code to make the test pass. Don't over-engineer.
3. **REFACTOR** — With tests green, improve the code without changing behavior. Run tests after every step.

## The Prove-It Pattern (Bug Fixes)

When a bug is reported:
1. Write a test that reproduces the bug (it should FAIL)
2. Confirm the test fails → bug confirmed
3. Implement the fix
4. Test passes → bug fixed, regression guarded
5. Run full test suite → no regressions

## Test Pyramid

- **Unit tests (~80%)** — Pure logic, isolated, milliseconds each
- **Integration tests (~15%)** — Component interactions, API boundaries
- **E2E tests (~5%)** — Critical user flows, real browser

## Trigger

"Write tests for: [feature/behavior]"
"TDD this: [description]"
"Fix this bug with TDD: [bug description]"

## Output

Failing tests first, then minimal code to make them pass, then refactored code — all verified with passing tests.
