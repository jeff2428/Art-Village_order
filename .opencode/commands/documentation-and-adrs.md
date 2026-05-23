# Documentation and ADRs

Document decisions, not just code. The most valuable documentation captures the *why* — the context, constraints, and trade-offs that led to a decision.

## When to Document

- Making a significant architectural decision
- Choosing between competing approaches
- Adding or changing a public API
- Shipping a feature that changes user-facing behavior
- Onboarding new team members to the project

## Architecture Decision Records (ADRs)

Store ADRs in `docs/decisions/` with sequential numbering.

### ADR Template

```markdown
# ADR-XXX: [Decision Title]

## Status
Accepted | Superseded by ADR-XXX | Deprecated

## Date
YYYY-MM-DD

## Context
What problem are we solving? What constraints apply?

## Decision
What did we decide and why?

## Alternatives Considered
### [Alternative 1]
- Pros: ...
- Cons: ...
- Rejected because: ...

## Consequences
- What becomes easier?
- What becomes harder?
- What are the risks?
```

### When to Write an ADR

- Choosing a framework, library, or major dependency
- Designing a data model or database schema
- Selecting an authentication strategy
- Deciding on an API architecture (REST vs. GraphQL vs. tRPC)
- Any decision that would be expensive to reverse

## Inline Documentation

Comment the *why*, not the *what*:

```typescript
// BAD: Restates the code
// Increment counter by 1
counter += 1;

// GOOD: Explains non-obvious intent
// Rate limit uses a sliding window — reset counter at window boundary,
// not on a fixed schedule, to prevent burst attacks at window edges
```

## README Structure

Every project should have a README covering:
- One-paragraph description
- Quick start (clone, install, configure, run)
- Commands table
- Architecture overview (link to ADRs)
- Contributing guide

## Trigger

"Write an ADR for: [decision]"
"Document this architecture"
"Update the README"

## Output

ADRs for significant decisions, current README, and inline documentation for non-obvious code.
