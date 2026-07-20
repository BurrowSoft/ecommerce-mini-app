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

export function extractCookie(res: request.Response): string {
  const setCookie = res.headers['set-cookie'] as string[] | string | undefined;
  const cookies: string[] = Array.isArray(setCookie)
    ? setCookie
    : [setCookie ?? ''];
  const sidCookie = cookies.find((c) => c.startsWith('connect.sid='));
  if (!sidCookie) throw new Error('No session cookie in response');
  return sidCookie.split(';')[0];
}
