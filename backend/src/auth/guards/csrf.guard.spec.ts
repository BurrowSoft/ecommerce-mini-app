import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CsrfGuard, CSRF_HEADER } from './csrf.guard';

function makeContext(
  session: { csrfToken?: string } | undefined,
  headers: Record<string, string | undefined>,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ session, headers }),
    }),
  } as unknown as ExecutionContext;
}

describe('CsrfGuard', () => {
  const guard = new CsrfGuard();

  it('allows a request whose header matches the session token', () => {
    const context = makeContext(
      { csrfToken: 'abc123' },
      { [CSRF_HEADER]: 'abc123' },
    );
    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects when the header is missing', () => {
    const context = makeContext({ csrfToken: 'abc123' }, {});
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects when the header does not match the session token', () => {
    const context = makeContext(
      { csrfToken: 'abc123' },
      { [CSRF_HEADER]: 'wrong-token' },
    );
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects when there is no session token at all (e.g. guard misapplied without SessionAuthGuard first)', () => {
    const context = makeContext(undefined, { [CSRF_HEADER]: 'anything' });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
