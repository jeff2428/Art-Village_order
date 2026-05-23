# Deprecation and Migration

Code is a liability, not an asset. Every line of code has ongoing maintenance cost. Deprecation is the discipline of removing code that no longer earns its keep, and migration is the process of moving users safely from the old to the new.

## When to Use

- Replacing an old system, API, or library with a new one
- Sunsetting a feature that's no longer needed
- Consolidating duplicate implementations
- Removing dead code that nobody owns but everybody depends on
- Planning the lifecycle of a new system

## Core Principles

### Code Is a Liability
Every line of code has ongoing cost: tests, documentation, security patches, dependency updates, mental overhead. When the same functionality can be provided with less code — the old code should go.

### Hyrum's Law Makes Removal Hard
Every observable behavior becomes depended on. Deprecation requires active migration, not just announcement.

### Deprecation Planning Starts at Design Time
When building something new, ask: "How would we remove this in 3 years?"

## Deprecation Decision

Before deprecating anything, answer:
1. Does this system still provide unique value?
2. How many users/consumers depend on it?
3. Does a replacement exist?
4. What's the migration cost for each consumer?
5. What's the ongoing maintenance cost of NOT deprecating?

## Migration Process

1. **Build the replacement** — Must cover all critical use cases, have docs, be proven in production
2. **Announce and document** — Deprecation notice with migration guide
3. **Migrate incrementally** — One consumer at a time, verify each
4. **Remove the old system** — Only after zero active usage confirmed

## Migration Patterns

- **Strangler pattern** — Run old and new in parallel, route traffic incrementally
- **Adapter pattern** — Translate calls from old interface to new implementation
- **Feature flag migration** — Switch consumers one at a time via flags

## Deprecation Types

| Type | When | Mechanism |
|------|------|-----------|
| **Advisory** | Migration is optional, old system is stable | Warnings, documentation, nudges |
| **Compulsory** | Security issues, blocks progress, unsustainable cost | Hard deadline with migration tooling |

## Trigger

"Plan the deprecation of: [system/API/feature]"
"Create a migration guide for: [old → new]"
"Identify zombie code in: [area]"

## Output

Deprecation plan with migration guide, timeline, and verification that old code is fully removed after all consumers have migrated.
