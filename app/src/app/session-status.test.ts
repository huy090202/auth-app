import { describe, expect, it } from 'vitest';
import { ApiError } from '../lib/api';
import { statusAfterError } from './session-status';

const failure = (status: number, code: string) => new ApiError(status, code, {});

describe('statusAfterError', () => {
  it('sends a 401 to sign-in', () => {
    expect(statusAfterError(failure(401, 'unauthorized'))).toBe('anon');
  });

  it('sends an unfinished sign-in to the second step', () => {
    expect(statusAfterError(failure(401, 'second_factor_required'))).toBe('half');
  });

  it.each([
    [429, 'rate_limited'],
    [502, 'authgate_unavailable'],
    [500, 'internal'],
    [0, 'network_error'],
  ])('does not treat %i %s as signed out', (status, code) => {
    expect(statusAfterError(failure(status, code))).toBe('error');
  });

  it('does not treat an unexpected error as signed out', () => {
    expect(statusAfterError(new Error('boom'))).toBe('error');
  });
});
