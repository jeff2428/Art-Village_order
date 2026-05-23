# Shipping and Launch

Ship with confidence. The goal is not just to deploy — it's to deploy safely, with monitoring in place, a rollback plan ready, and a clear understanding of what success looks like.

## Pre-Launch Checklist

### Code Quality
- [ ] All tests pass (unit, integration, e2e)
- [ ] Build succeeds with no warnings
- [ ] Lint and type checking pass
- [ ] Code reviewed and approved
- [ ] No TODO comments that should be resolved
- [ ] No `console.log` debugging statements
- [ ] Error handling covers expected failure modes

### Security
- [ ] No secrets in code or version control
- [ ] `npm audit` shows no critical or high vulnerabilities
- [ ] Input validation on all user-facing endpoints
- [ ] Authentication and authorization checks in place
- [ ] Security headers configured
- [ ] Rate limiting on auth endpoints
- [ ] CORS configured to specific origins

### Performance
- [ ] Core Web Vitals within "Good" thresholds
- [ ] No N+1 queries in critical paths
- [ ] Images optimized
- [ ] Bundle size within budget
- [ ] Database queries have appropriate indexes
- [ ] Caching configured

### Accessibility
- [ ] Keyboard navigation works
- [ ] Screen reader can convey content
- [ ] Color contrast meets WCAG 2.1 AA
- [ ] Focus management correct
- [ ] No accessibility warnings

### Infrastructure
- [ ] Environment variables set in production
- [ ] Database migrations applied (or ready)
- [ ] DNS and SSL configured
- [ ] CDN configured
- [ ] Logging and error reporting configured
- [ ] Health check endpoint exists

## Feature Flag Strategy

```
1. DEPLOY with flag OFF     → Code in production but inactive
2. ENABLE for team/beta     → Internal testing
3. GRADUAL ROLLOUT          → 5% → 25% → 50% → 100%
4. MONITOR at each stage    → Watch error rates, performance
5. CLEAN UP                 → Remove flag and dead code within 2 weeks
```

## Staged Rollout

```
1. Deploy to staging → Full test suite + manual smoke test
2. Deploy to production (flag OFF) → Verify health check
3. Enable for team → 24-hour monitoring
4. Canary (5% of users) → 24-48 hour monitoring
5. Gradual increase (25% → 50% → 100%)
6. Full rollout → Monitor 1 week → Clean up flag
```

## Rollback Plan

Every deployment needs a rollback plan before it happens:
- Trigger conditions (error rate, latency, user reports)
- Rollback steps (disable flag / deploy previous version)
- Database considerations (migration rollback)
- Time to rollback estimates

## Trigger

"Prepare for production launch: [feature]"
"Review the pre-launch checklist"
"Create a rollback plan for: [deployment]"

## Output

Completed pre-launch checklist, feature flag strategy, staged rollout plan, and documented rollback procedure.
