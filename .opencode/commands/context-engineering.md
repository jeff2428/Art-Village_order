# Context Engineering

Feed agents the right information at the right time. Context is the single biggest lever for agent output quality — too little and the agent hallucinates, too much and it loses focus.

## Context Hierarchy

Structure context from most persistent to most transient:

```
1. Rules Files (CLAUDE.md, etc.)     → Always loaded, project-wide
2. Spec / Architecture Docs           → Loaded per feature/session
3. Relevant Source Files              → Loaded per task
4. Error Output / Test Results        → Loaded per iteration
5. Conversation History               → Accumulates, compacts
```

## Context Packing Strategies

### The Brain Dump
At session start, provide everything the agent needs:
```
PROJECT CONTEXT:
- We're building [X] using [tech stack]
- The relevant spec section is: [spec excerpt]
- Key constraints: [list]
- Files involved: [list with brief descriptions]
- Related patterns: [pointer to an example file]
- Known gotchas: [list]
```

### The Selective Include
Only include what's relevant to the current task:
```
TASK: [description]
RELEVANT FILES: [list]
PATTERN TO FOLLOW: [pointer]
CONSTRAINT: [specific rule]
```

### The Hierarchical Summary
For large projects, maintain a summary index by area. Load only the relevant section.

## Confusion Management

### When Context Conflicts
Surface the conflict explicitly. Present options. Ask which approach to take.

### When Requirements Are Incomplete
1. Check existing code for precedent
2. If no precedent exists, stop and ask
3. Don't invent requirements

### The Inline Planning Pattern
For multi-step tasks, emit a lightweight plan before executing:
```
PLAN:
1. [step 1]
2. [step 2]
3. [step 3]
→ Executing unless you redirect.
```

## Anti-Patterns

| Anti-Pattern | Problem | Fix |
|-------------|---------|-----|
| Context starvation | Agent invents APIs | Load rules file + relevant source files |
| Context flooding | Agent loses focus | Include only what's relevant, aim for <2,000 lines |
| Stale context | Agent references outdated patterns | Start fresh sessions when context drifts |
| Missing examples | Agent invents a new style | Include one example of the pattern to follow |

## Trigger

"Set up context for: [task/feature]"
"Load the relevant context for: [area]"
"Improve the agent's context for: [description]"

## Output

Focused, relevant context loaded for the current task — rules file, spec sections, source files, and patterns to follow.
