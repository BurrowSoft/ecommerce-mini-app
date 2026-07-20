import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SessionAuthGuard } from './session-auth.guard';

function makeContext(
  session: Record<string, unknown> | undefined,
): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ session }),
    }),
  } as unknown as ExecutionContext;
}

describe('SessionAuthGuard', () => {
  const originalTimeout = process.env.SESSION_INACTIVITY_TIMEOUT_SECONDS;

  afterEach(() => {
    process.env.SESSION_INACTIVITY_TIMEOUT_SECONDS = originalTimeout;
  });

  it('rejects when there is no session', () => {
    const guard = new SessionAuthGuard();
    expect(() => guard.canActivate(makeContext(undefined))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects when the session has no userId', () => {
    const guard = new SessionAuthGuard();
    expect(() =>
      guard.canActivate(makeContext({ lastSeenAt: Date.now() })),
    ).toThrow(UnauthorizedException);
  });

  it('allows a session that was active within the timeout, and refreshes lastSeenAt', () => {
    process.env.SESSION_INACTIVITY_TIMEOUT_SECONDS = '3600';
    const guard = new SessionAuthGuard();
    const session = { userId: 1, lastSeenAt: Date.now() - 1000 };
    const context = makeContext(session);

    expect(guard.canActivate(context)).toBe(true);
    expect(session.lastSeenAt).toBeGreaterThan(Date.now() - 1000);
  });

  it('rejects and destroys the session once idle time exceeds the configured timeout', () => {
    process.env.SESSION_INACTIVITY_TIMEOUT_SECONDS = '1'; // 1 second, for a fast test
    const guard = new SessionAuthGuard();
    const destroy = jest.fn((cb: () => void) => cb());
    const session = { userId: 1, lastSeenAt: Date.now() - 2000, destroy };

    expect(() => guard.canActivate(makeContext(session))).toThrow(
      UnauthorizedException,
    );
    expect(destroy).toHaveBeenCalled();
  });
});
