import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';

export const CSRF_HEADER = 'x-csrf-token';

/**
 * Double-submit cookie CSRF protection. Only meaningful behind
 * SessionAuthGuard (must run after it — a session, and therefore a
 * session.csrfToken, has to exist first). Applied to state-changing
 * requests only (currently just logout); login itself is deliberately
 * NOT covered — there's no prior session to protect at that point, and a
 * forged login POST doesn't let an attacker act as the victim (the
 * classic CSRF impact model), just log the victim's browser into an
 * account the attacker already controls, which SameSite=Lax on its own
 * already mitigates for the common case.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const headerToken = req.headers[CSRF_HEADER];

    if (
      !req.session?.csrfToken ||
      typeof headerToken !== 'string' ||
      headerToken !== req.session.csrfToken
    ) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    return true;
  }
}
