# Spec-Driven Development

Create a structured specification before writing any code. The spec is the shared source of truth that defines what we're building, why, and how we'll know it's done.

## When to Use

- Starting a new project or feature
- Requirements are ambiguous or incomplete
- The change touches multiple files or modules
- You're about to make an architectural decision
- The task would take more than 30 minutes to implement

## Workflow

Four gated phases — do not advance until the current phase is validated:

1. **Specify** — Write a spec covering: objective, tech stack, commands, project structure, code style, testing strategy, boundaries (Always/Ask First/Never), success criteria, open questions
2. **Plan** — Generate a technical implementation plan with components, dependencies, risks, and parallelization opportunities
3. **Tasks** — Break the plan into discrete, implementable tasks with acceptance criteria and verification steps
4. **Implement** — Execute tasks one at a time following incremental-implementation and test-driven-development

## Trigger

"Write a spec for: [your feature/idea]"
"Let's spec this out: [description]"

## Output

A spec document saved to the repository, followed by an implementation plan and task list.
