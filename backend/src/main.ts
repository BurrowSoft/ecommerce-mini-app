import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './setup-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const { sessionPool } = configureApp(app);
  process.on('SIGTERM', () => void sessionPool.end());
  process.on('SIGINT', () => void sessionPool.end());
  await app.listen(process.env.BACKEND_PORT ?? process.env.PORT ?? 4000);
}
void bootstrap();
