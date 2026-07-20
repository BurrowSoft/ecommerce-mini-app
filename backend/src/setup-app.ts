import { INestApplication, ValidationPipe } from '@nestjs/common';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { Pool } from 'pg';

/**
 * Shared between main.ts (real boot) and e2e tests, so tests exercise the
 * exact same CORS/validation/session configuration that actually runs in
 * production rather than a hand-rolled approximation that could drift.
 *
 * Returns the session store's pg Pool so callers can close it on shutdown —
 * it's created outside Nest's DI container (express-session middleware
 * isn't a Nest provider), so app.close() alone won't release it.
 */
export function configureApp(app: INestApplication): { sessionPool: Pool } {
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const PgSession = connectPgSimple(session);
  const sessionPool = new Pool({ connectionString: process.env.DATABASE_URL });
  const inactivityTimeoutMs =
    Number(process.env.SESSION_INACTIVITY_TIMEOUT_SECONDS ?? 3600) * 1000;

  app.use(
    session({
      store: new PgSession({ pool: sessionPool, createTableIfMissing: true, tableName: 'session' }),
      secret: process.env.SESSION_SECRET ?? 'dev-secret-change-me',
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: inactivityTimeoutMs,
      },
    }),
  );

  return { sessionPool };
}
