# Source-Driven Development

Every framework-specific code decision must be backed by official documentation. Don't implement from memory — verify, cite, and let the user see your sources.

## When to Use

- The user wants code that follows current best practices for a given framework
- Building boilerplate, starter code, or patterns that will be copied across a project
- The user explicitly asks for documented, verified, or "correct" implementation
- Implementing features where the framework's recommended approach matters (forms, routing, data fetching, state management, auth)
- Reviewing or improving code that uses framework-specific patterns

## The Process

```
DETECT → FETCH → IMPLEMENT → CITE
  │        │         │          │
  ▼        ▼         ▼          ▼
 What     Get the   Follow the Show your
 stack?    docs      documented  sources
            for the     patterns
            feature
```

### Step 1: Detect Stack and Versions
Read the project's dependency file to identify exact versions. State what you found explicitly.

### Step 2: Fetch Official Documentation
Fetch the specific documentation page for the feature you're implementing.

**Source hierarchy (in order of authority):**
1. Official documentation (react.dev, docs.djangoproject.com, etc.)
2. Official blog / changelog
3. Web standards references (MDN, web.dev)
4. Browser/runtime compatibility (caniuse.com)

**Not authoritative:** Stack Overflow, blog posts, tutorials, AI-generated docs, training data.

### Step 3: Implement Following Documented Patterns
- Use the API signatures from the docs, not from memory
- If the docs show a new way, use the new way
- If the docs deprecate a pattern, don't use the deprecated version
- If the docs don't cover something, flag it as unverified

### Step 4: Cite Your Sources
Every framework-specific pattern gets a citation with full URLs. Quote the relevant passage when it supports a non-obvious decision.

## Trigger

"Implement this using documented patterns: [feature]"
"Verify this code against official docs: [code]"
"Source-driven implementation of: [description]"

## Output

Code backed by official documentation with source citations, verified against the detected framework version.
