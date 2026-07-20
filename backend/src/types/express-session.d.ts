import 'express-session';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    // Epoch ms of the last authenticated request seen on this session.
    // Refreshed by SessionAuthGuard on every protected request; checked
    // against SESSION_INACTIVITY_TIMEOUT_SECONDS to enforce the 1h
    // inactivity timeout explicitly, rather than relying solely on the
    // session store's own cookie/expiry bookkeeping.
    lastSeenAt?: number;
    // Double-submit CSRF token, issued on login (see CsrfGuard). Compared
    // against the X-CSRF-Token request header on state-changing requests.
    csrfToken?: string;
  }
}
