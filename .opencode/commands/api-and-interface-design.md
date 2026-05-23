# API and Interface Design

Design stable, well-documented interfaces that are hard to misuse. Good interfaces make the right thing easy and the wrong thing hard.

## When to Use

- Designing new API endpoints
- Defining module boundaries or contracts between teams
- Creating component prop interfaces
- Establishing database schema that informs API shape
- Changing existing public interfaces

## Core Principles

### Hyrum's Law
Every observable behavior becomes a potential commitment. Be intentional about what you expose. Don't leak implementation details. Plan for deprecation at design time.

### The One-Version Rule
Design for a world where only one version exists at a time — extend rather than fork.

### Contract First
Define the interface before implementing it. The contract is the spec — implementation follows.

### Consistent Error Semantics
Pick one error strategy and use it everywhere. Don't mix patterns (some throw, some return null, some return { error }).

### Validate at Boundaries
Trust internal code. Validate at system edges where external input enters.

### Prefer Addition Over Modification
Extend interfaces without breaking existing consumers. New fields should be optional and additive.

### Predictable Naming
- REST endpoints: Plural nouns, no verbs (`GET /api/tasks`)
- Query params: camelCase (`?sortBy=createdAt&pageSize=20`)
- Response fields: camelCase (`{ createdAt, updatedAt, taskId }`)
- Boolean fields: is/has/can prefix (`isComplete`, `hasAttachments`)
- Enum values: UPPER_SNAKE (`"IN_PROGRESS"`, `"COMPLETED"`)

## REST API Patterns

```
GET    /api/tasks              → List tasks (with query params for filtering)
POST   /api/tasks              → Create a task
GET    /api/tasks/:id          → Get a single task
PATCH  /api/tasks/:id          → Update a task (partial)
DELETE /api/tasks/:id          → Delete a task
```

## Trigger

"Design an API for: [description]"
"Define the interface for: [feature]"
"Review this API design: [spec]"

## Output

Typed interface contracts, consistent error semantics, pagination, filtering, and naming conventions — all committed alongside the implementation.
