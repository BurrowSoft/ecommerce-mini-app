import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import type { Request } from "express";

/**
 * Guards every catalog/protected route. "Inactivity" is defined explicitly
 * as: no authenticated request received for SESSION_INACTIVITY_TIMEOUT_SECONDS
 * (default 1h). lastSeenAt is refreshed on every request that passes this
 * guard, so the timeout is a sliding window from the most recent request,
 * not a fixed expiry from login time.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const session = req.session;

    if (!session?.userId || !session.lastSeenAt) {
      throw new UnauthorizedException("Not authenticated");
    }

    const inactivityTimeoutMs =
      Number(process.env.SESSION_INACTIVITY_TIMEOUT_SECONDS ?? 3600) * 1000;
    const idleMs = Date.now() - session.lastSeenAt;
    if (idleMs > inactivityTimeoutMs) {
      session.destroy(() => {
        /* best-effort cleanup; response has already been decided below */
      });
      throw new UnauthorizedException("Session expired due to inactivity, please log in again");
    }

    session.lastSeenAt = Date.now();
    return true;
  }
}
