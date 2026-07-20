import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaService } from './../src/prisma/prisma.service';
import { buildApp, extractCookie } from './test-utils';

const TEST_EMAIL = 'e2e-auth-test@example.com';
const TEST_PASSWORD = 'CorrectHorseBatteryStaple1!';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let sessionPool: Pool;
  let prisma: PrismaService;

  beforeAll(async () => {
    ({ app, sessionPool } = await buildApp());
    prisma = app.get(PrismaService);
    const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);
    await prisma.user.upsert({
      where: { email: TEST_EMAIL },
      update: { passwordHash },
      create: { email: TEST_EMAIL, passwordHash },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: TEST_EMAIL } });
    await app.close();
    await sessionPool.end();
  });

  it('rejects catalog-style protected routes without a session', () => {
    return request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('rejects login with a malformed email (validation error state)', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'not-an-email', password: 'x' })
      .expect(400);
  });

  it('rejects login with an unexpected extra field (whitelist validation)', () => {
    return request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD, isAdmin: true })
      .expect(400);
  });

  it('rejects wrong password with a generic message (does not leak account existence)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: 'wrong-password' })
      .expect(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('rejects a nonexistent account with the identical generic message', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'nobody-at-all@example.com', password: TEST_PASSWORD })
      .expect(401);
    expect(res.body.message).toBe('Invalid email or password');
  });

  it('logs in with correct credentials, sets an httpOnly session cookie, and grants access', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: TEST_EMAIL, password: TEST_PASSWORD })
      .expect(200);

    expect(loginRes.body).toEqual({ email: TEST_EMAIL });
    const cookie = extractCookie(loginRes);
    expect(loginRes.headers['set-cookie'][0]).toMatch(/HttpOnly/);

    const meRes = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect(meRes.body).toHaveProperty('userId');

    await request(app.getHttpServer()).post('/auth/logout').set('Cookie', cookie).expect(200);

    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookie).expect(401);
  });
});

describe('Auth rate limiting (e2e)', () => {
  // Isolated app instance so this test's burst of attempts doesn't share
  // in-memory rate-limit state with the functional tests above.
  let app: INestApplication<App>;
  let sessionPool: Pool;
  const originalAccountMax = process.env.LOGIN_RATE_LIMIT_PER_ACCOUNT_MAX;
  const originalAccountWindow = process.env.LOGIN_RATE_LIMIT_PER_ACCOUNT_WINDOW_SECONDS;

  beforeAll(async () => {
    process.env.LOGIN_RATE_LIMIT_PER_ACCOUNT_MAX = '3';
    process.env.LOGIN_RATE_LIMIT_PER_ACCOUNT_WINDOW_SECONDS = '60';
    ({ app, sessionPool } = await buildApp());
  });

  afterAll(async () => {
    await app.close();
    await sessionPool.end();
    // Restore so these overrides don't leak into any test file that runs
    // after this one in the same worker process.
    process.env.LOGIN_RATE_LIMIT_PER_ACCOUNT_MAX = originalAccountMax;
    process.env.LOGIN_RATE_LIMIT_PER_ACCOUNT_WINDOW_SECONDS = originalAccountWindow;
  });

  it('blocks after exceeding the per-account attempt limit, with a Retry-After header', async () => {
    const email = 'rate-limit-test@example.com';
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email, password: 'wrong' })
        .expect(401);
    }

    const blocked = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong' })
      .expect(429);

    expect(blocked.headers['retry-after']).toBeDefined();
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
  });
});
