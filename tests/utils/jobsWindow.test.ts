import { canPerform } from '../../shared/capabilities/canPerform';
import { shouldResetWindow } from '../../shared/capabilities/usageTracking';

describe('jobs.create monthly window', () => {
  it('allows free users to create jobs at zero usage', () => {
    const r = canPerform('free', 'jobs.create', 0);
    expect(r.allowed).toBe(true);
    expect(r.limit).toBe(10);
    expect(r.remaining).toBe(10);
  });

  it('reports remaining count near the limit', () => {
    const r = canPerform('free', 'jobs.create', 8);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
  });

  it('blocks free users when monthly limit is hit', () => {
    const r = canPerform('free', 'jobs.create', 10);
    expect(r.allowed).toBe(false);
    expect(r.limitReached).toBe(true);
  });

  it('does not request a window reset within the month', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldResetWindow('free', 'jobs.create', tenDaysAgo)).toBe(false);
  });

  it('requests a window reset once 30 days have passed', () => {
    const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
    expect(shouldResetWindow('free', 'jobs.create', fortyDaysAgo)).toBe(true);
  });

  it('keeps Pro users unlimited regardless of usage', () => {
    const r = canPerform('pro', 'jobs.create', 9999);
    expect(r.allowed).toBe(true);
  });
});
