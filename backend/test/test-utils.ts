import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { Pool } from 'pg';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/setup-app';

export async function buildApp(): Promise<{
  app: INestApplication<App>;
  sessionPool: Pool;
}> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app: INestApplication<App> = moduleFixture.createNestApplication();
  const { sessionPool } = configureApp(app);
  await app.init();
  return { app, sessionPool };
}

function setCookieHeaders(res: request.Response): string[] {
  const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
  return Array.isArray(setCookie) ? setCookie : [setCookie ?? ''];
}

export function extractCookie(res: request.Response): string {
  const sidCookie = setCookieHeaders(res).find((c) =>
    c.startsWith('connect.sid='),
  );
  if (!sidCookie) throw new Error('No session cookie in response');
  return sidCookie.split(';')[0];
}

/** Returns just the value of a named cookie set on this response (e.g. 'csrf_token'). */
export function extractCookieValue(
  res: request.Response,
  name: string,
): string {
  const cookie = setCookieHeaders(res).find((c) => c.startsWith(`${name}=`));
  if (!cookie) throw new Error(`No ${name} cookie in response`);
  return cookie.split(';')[0].slice(name.length + 1);
}
