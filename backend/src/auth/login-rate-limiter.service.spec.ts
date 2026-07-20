import { LoginRateLimiterService } from './login-rate-limiter.service';

describe('LoginRateLimiterService', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  function makeLimiter(opts: {
    ipMax: number;
    ipWindowSeconds: number;
    accountMax: number;
    accountWindowSeconds: number;
  }) {
    process.env.LOGIN_RATE_LIMIT_PER_IP_MAX = String(opts.ipMax);
    process.env.LOGIN_RATE_LIMIT_PER_IP_WINDOW_SECONDS = String(
      opts.ipWindowSeconds,
    );
    process.env.LOGIN_RATE_LIMIT_PER_ACCOUNT_MAX = String(opts.accountMax);
    process.env.LOGIN_RATE_LIMIT_PER_ACCOUNT_WINDOW_SECONDS = String(
      opts.accountWindowSeconds,
    );
    return new LoginRateLimiterService();
  }

  it('allows attempts up to the per-account max, then blocks', () => {
    const limiter = makeLimiter({
      ipMax: 100,
      ipWindowSeconds: 60,
      accountMax: 3,
      accountWindowSeconds: 60,
    });

    for (let i = 0; i < 3; i++) {
      expect(limiter.checkAndRecord('1.1.1.1', 'a@example.com').allowed).toBe(
        true,
      );
    }
    const blocked = limiter.checkAndRecord('1.1.1.1', 'a@example.com');
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('allows attempts up to the per-IP max, then blocks, independent of which account is used', () => {
    const limiter = makeLimiter({
      ipMax: 2,
      ipWindowSeconds: 60,
      accountMax: 100,
      accountWindowSeconds: 60,
    });

    expect(limiter.checkAndRecord('2.2.2.2', 'a@example.com').allowed).toBe(
      true,
    );
    expect(limiter.checkAndRecord('2.2.2.2', 'b@example.com').allowed).toBe(
      true,
    );
    // Same IP, different account — still blocked because the IP limit is what's exhausted.
    expect(limiter.checkAndRecord('2.2.2.2', 'c@example.com').allowed).toBe(
      false,
    );
  });

  it('tracks different accounts and different IPs independently', () => {
    const limiter = makeLimiter({
      ipMax: 1,
      ipWindowSeconds: 60,
      accountMax: 1,
      accountWindowSeconds: 60,
    });

    expect(limiter.checkAndRecord('3.3.3.3', 'x@example.com').allowed).toBe(
      true,
    );
    // Different IP and different account: fresh buckets, should be allowed.
    expect(limiter.checkAndRecord('4.4.4.4', 'y@example.com').allowed).toBe(
      true,
    );
  });

  it('is case-insensitive on the account key', () => {
    const limiter = makeLimiter({
      ipMax: 100,
      ipWindowSeconds: 60,
      accountMax: 1,
      accountWindowSeconds: 60,
    });

    expect(limiter.checkAndRecord('5.5.5.5', 'Demo@Example.com').allowed).toBe(
      true,
    );
    expect(limiter.checkAndRecord('5.5.5.5', 'demo@example.com').allowed).toBe(
      false,
    );
  });

  it('allows again once the window has elapsed', async () => {
    const limiter = makeLimiter({
      ipMax: 100,
      ipWindowSeconds: 1,
      accountMax: 1,
      accountWindowSeconds: 1,
    });

    expect(limiter.checkAndRecord('6.6.6.6', 'z@example.com').allowed).toBe(
      true,
    );
    expect(limiter.checkAndRecord('6.6.6.6', 'z@example.com').allowed).toBe(
      false,
    );

    await new Promise((resolve) => setTimeout(resolve, 1100));

    expect(limiter.checkAndRecord('6.6.6.6', 'z@example.com').allowed).toBe(
      true,
    );
  });

  it('evicts stale keys via periodic sweep, bounding memory regardless of how many distinct keys were ever seen', () => {
    jest.useFakeTimers();
    try {
      const limiter = makeLimiter({
        ipMax: 100,
        ipWindowSeconds: 1,
        accountMax: 100,
        accountWindowSeconds: 1,
      });
      const hitsByKey = () =>
        (limiter as unknown as { hitsByKey: Map<string, number[]> }).hitsByKey;

      // Simulate an attacker (or just heavy traffic) rotating through many
      // one-off IPs/emails — each used only once.
      for (let i = 0; i < 50; i++) {
        limiter.checkAndRecord(`10.0.0.${i}`, `user${i}@example.com`);
      }
      expect(hitsByKey().size).toBeGreaterThan(0);

      // Advance past both the 1s window and the 5-minute sweep interval.
      jest.advanceTimersByTime(5 * 60 * 1000 + 2000);

      expect(hitsByKey().size).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it("evicts stale keys via periodic sweep, bounding memory regardless of how many distinct keys were ever seen", () => {
    jest.useFakeTimers();
    try {
      const limiter = makeLimiter({ ipMax: 100, ipWindowSeconds: 1, accountMax: 100, accountWindowSeconds: 1 });
      const hitsByKey = () => (limiter as unknown as { hitsByKey: Map<string, number[]> }).hitsByKey;

      // Simulate an attacker (or just heavy traffic) rotating through many
      // one-off IPs/emails — each used only once.
      for (let i = 0; i < 50; i++) {
        limiter.checkAndRecord(`10.0.0.${i}`, `user${i}@example.com`);
      }
      expect(hitsByKey().size).toBeGreaterThan(0);

      // Advance past both the 1s window and the 5-minute sweep interval.
      jest.advanceTimersByTime(5 * 60 * 1000 + 2000);

      expect(hitsByKey().size).toBe(0);
    } finally {
      jest.useRealTimers();
    }
  });
});
