# Debugging and Error Recovery

Systematic debugging with structured triage. When something breaks, stop adding features, preserve evidence, and follow a structured process to find and fix the root cause.

## When to Use

- Tests fail after a code change
- The build breaks
- Runtime behavior doesn't match expectations
- A bug report arrives
- An error appears in logs or console
- Something worked before and stopped working

## The Stop-the-Line Rule

1. STOP adding features or making changes
2. PRESERVE evidence (error output, logs, repro steps)
3. DIAGNOSE using the triage checklist
4. FIX the root cause
5. GUARD against recurrence
6. RESUME only after verification passes

## The Triage Checklist

1. **Reproduce** — Make the failure happen reliably
2. **Localize** — Narrow down WHERE the failure happens (UI / API / DB / build / external service)
3. **Reduce** — Create the minimal failing case
4. **Fix the root cause** — Fix the underlying issue, not the symptom
5. **Guard against recurrence** — Write a test that catches this specific failure
6. **Verify end-to-end** — Run the specific test, full suite, build, manual spot check

## Error-Specific Patterns

- **Test failure** — Did you change the code the test covers? Is the test outdated or is the code buggy?
- **Build failure** — Type error / import error / config error / dependency error / environment error?
- **Runtime error** — TypeError / network error / render error / unexpected behavior?

## Trigger

"Debug this: [error message / bug description]"
"Fix this build error: [output]"
"Troubleshoot: [description]"

## Output

Root cause identified, fix applied, regression test added, and verification confirmed.
