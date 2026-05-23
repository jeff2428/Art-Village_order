# Performance Optimization

Measure before optimizing. Profile first, identify the actual bottleneck, fix it, measure again. Optimize only what measurements prove matters.

## When to Use

- Performance requirements exist in the spec (load time budgets, response time SLAs)
- Users or monitoring report slow behavior
- Core Web Vitals scores are below thresholds
- You suspect a change introduced a regression
- Building features that handle large datasets or high traffic

## Core Web Vitals Targets

| Metric | Good | Needs Improvement | Poor |
|--------|------|-------------------|------|
| **LCP** | ≤ 2.5s | ≤ 4.0s | > 4.0s |
| **INP** | ≤ 200ms | ≤ 500ms | > 500ms |
| **CLS** | ≤ 0.1 | ≤ 0.25 | > 0.25 |

## The Optimization Workflow

1. **Measure** — Establish baseline with real data (synthetic + RUM)
2. **Identify** — Find the actual bottleneck (not assumed)
3. **Fix** — Address the specific bottleneck
4. **Verify** — Measure again, confirm improvement
5. **Guard** — Add monitoring or tests to prevent regression

## Common Anti-Patterns to Fix

- **N+1 queries** — Use joins/includes instead of loops
- **Unbounded data fetching** — Paginate with limits
- **Missing image optimization** — Dimensions, lazy loading, responsive sizes
- **Unnecessary re-renders** — Stable references, React.memo, useMemo
- **Large bundle size** — Dynamic imports, route-level code splitting
- **Missing caching** — TTL-based caches, HTTP caching headers

## Performance Budget

- JavaScript bundle: < 200KB gzipped (initial load)
- CSS: < 50KB gzipped
- Images: < 200KB per image (above the fold)
- Fonts: < 100KB total
- API response time: < 200ms (p95)

## Trigger

"Optimize performance for: [feature/page]"
"Profile and fix: [slow area]"
"Improve Core Web Vitals for: [page]"

## Output

Measured before/after performance data, specific bottlenecks addressed, and performance budget enforcement in CI.
