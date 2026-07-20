import { Injectable, OnModuleDestroy } from '@nestjs/common';

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

interface WindowConfig {
  max: number;
  windowMs: number;
}

const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Fixed-key sliding-window counter, in-memory. Deliberately not
 * @nestjs/throttler: that library's per-named-throttler custom tracker API
 * has changed shape across major versions and I'd rather write ~40 lines I
 * can fully verify than guess at a security-relevant library API under time
 * pressure. In-memory means limits reset on restart and don't share state
 * across instances — the same documented trade-off as the session store
 * (see README "Trade-offs"), fine for a single-instance deployment.
 *
 * hitsByKey is periodically swept (see `sweep`) rather than only cleaned up
 * lazily on next hit: without it, a single request from each of many unique
 * IPs/emails would leave a permanent entry behind forever — unbounded memory
 * growth regardless of how tight the per-key window is. Caught in review,
 * not something the original design accounted for.
 */
@Injectable()
export class LoginRateLimiterService implements OnModuleDestroy {
  private readonly hitsByKey = new Map<string, number[]>();
  private readonly sweepTimer: NodeJS.Timeout;

  private readonly ipConfig: WindowConfig = {
    max: Number(process.env.LOGIN_RATE_LIMIT_PER_IP_MAX ?? 10),
    windowMs:
      Number(process.env.LOGIN_RATE_LIMIT_PER_IP_WINDOW_SECONDS ?? 60) * 1000,
  };

  private readonly accountConfig: WindowConfig = {
    max: Number(process.env.LOGIN_RATE_LIMIT_PER_ACCOUNT_MAX ?? 5),
    windowMs:
      Number(process.env.LOGIN_RATE_LIMIT_PER_ACCOUNT_WINDOW_SECONDS ?? 60) *
      1000,
  };

  constructor() {
    this.sweepTimer = setInterval(() => this.sweep(), SWEEP_INTERVAL_MS);
    this.sweepTimer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.sweepTimer);
  }

  /** Evicts any key with no hits inside either window — bounds map size to
   * "keys active recently", not "every key ever seen". */
  private sweep(): void {
    const now = Date.now();
    const staleCutoff =
      now - Math.max(this.ipConfig.windowMs, this.accountConfig.windowMs);
    for (const [key, timestamps] of this.hitsByKey) {
      const stillRecent = timestamps.some((ts) => ts > staleCutoff);
      if (!stillRecent) this.hitsByKey.delete(key);
    }
  }

  /** Records this attempt and reports whether it's within limits. Call once per login request. */
  checkAndRecord(ip: string, email: string): RateLimitResult {
    const ipResult = this.hit(`ip:${ip}`, this.ipConfig);
    const accountResult = this.hit(
      `account:${email.toLowerCase()}`,
      this.accountConfig,
    );

    if (!ipResult.allowed || !accountResult.allowed) {
      const retryAfterSeconds = Math.max(
        ipResult.retryAfterSeconds ?? 0,
        accountResult.retryAfterSeconds ?? 0,
      );
      return { allowed: false, retryAfterSeconds };
    }

    return { allowed: true };
  }

  private hit(key: string, config: WindowConfig): RateLimitResult {
    const now = Date.now();
    const windowStart = now - config.windowMs;
    const existing = this.hitsByKey.get(key) ?? [];
    const recent = existing.filter((ts) => ts > windowStart);

    if (recent.length >= config.max) {
      const retryAfterSeconds = Math.ceil(
        (recent[0] + config.windowMs - now) / 1000,
      );
      this.hitsByKey.set(key, recent);
      return { allowed: false, retryAfterSeconds };
    }

    recent.push(now);
    this.hitsByKey.set(key, recent);
    return { allowed: true };
  }
}
