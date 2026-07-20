import { Injectable } from "@nestjs/common";

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

interface WindowConfig {
  max: number;
  windowMs: number;
}

/**
 * Fixed-key sliding-window counter, in-memory. Deliberately not
 * @nestjs/throttler: that library's per-named-throttler custom tracker API
 * has changed shape across major versions and I'd rather write ~40 lines I
 * can fully verify than guess at a security-relevant library API under time
 * pressure. In-memory means limits reset on restart and don't share state
 * across instances — the same documented trade-off as the session store
 * (see README "Trade-offs"), fine for a single-instance deployment.
 */
@Injectable()
export class LoginRateLimiterService {
  private readonly hitsByKey = new Map<string, number[]>();

  private readonly ipConfig: WindowConfig = {
    max: Number(process.env.LOGIN_RATE_LIMIT_PER_IP_MAX ?? 10),
    windowMs: Number(process.env.LOGIN_RATE_LIMIT_PER_IP_WINDOW_SECONDS ?? 60) * 1000,
  };

  private readonly accountConfig: WindowConfig = {
    max: Number(process.env.LOGIN_RATE_LIMIT_PER_ACCOUNT_MAX ?? 5),
    windowMs: Number(process.env.LOGIN_RATE_LIMIT_PER_ACCOUNT_WINDOW_SECONDS ?? 60) * 1000,
  };

  /** Records this attempt and reports whether it's within limits. Call once per login request. */
  checkAndRecord(ip: string, email: string): RateLimitResult {
    const ipResult = this.hit(`ip:${ip}`, this.ipConfig);
    const accountResult = this.hit(`account:${email.toLowerCase()}`, this.accountConfig);

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
      const retryAfterSeconds = Math.ceil((recent[0] + config.windowMs - now) / 1000);
      this.hitsByKey.set(key, recent);
      return { allowed: false, retryAfterSeconds };
    }

    recent.push(now);
    this.hitsByKey.set(key, recent);
    return { allowed: true };
  }
}
