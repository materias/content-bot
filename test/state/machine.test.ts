import { describe, expect, it } from 'vitest';
import { assertTransition, isValidTransition } from '../../src/state/machine.js';

describe('submission state machine', () => {
  it('allows the happy path', () => {
    expect(isValidTransition('received', 'analyzing')).toBe(true);
    expect(isValidTransition('analyzing', 'awaiting_approval')).toBe(true);
    expect(isValidTransition('awaiting_approval', 'approved')).toBe(true);
    expect(isValidTransition('approved', 'posted')).toBe(true);
  });

  it('allows rejection and retry paths', () => {
    expect(isValidTransition('received', 'rejected_low_quality')).toBe(true);
    expect(isValidTransition('analyzing', 'failed_analysis')).toBe(true);
    expect(isValidTransition('awaiting_approval', 'rejected')).toBe(true);
    expect(isValidTransition('approved', 'failed_publish')).toBe(true);
    expect(isValidTransition('failed_publish', 'approved')).toBe(true);
  });

  it('rejects skipping states', () => {
    expect(isValidTransition('received', 'awaiting_approval')).toBe(false);
    expect(isValidTransition('received', 'approved')).toBe(false);
    expect(() => assertTransition('received', 'posted')).toThrow();
  });

  it('rejects transitions out of terminal states', () => {
    expect(isValidTransition('posted', 'approved')).toBe(false);
    expect(isValidTransition('rejected', 'awaiting_approval')).toBe(false);
  });
});
