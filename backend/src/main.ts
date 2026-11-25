import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: true });
  app.useBodyParser('json', { limit: '5mb' });
  app.enableCors({ origin: (process.env.CORS_ORIGINS || '*').split(','), methods: ['GET', 'POST'] });
  // Yerelde ön yüzü de aynı sunucudan ver (AWS'de CloudFront + S3 verir)
  const fe = process.env.FRONTEND_DIR || resolve(import.meta.dirname, '../../frontend');
  if (existsSync(fe)) app.useStaticAssets(fe, { index: 'index.html' });
  const port = Number(process.env.PORT || 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`OptiSupply backend http://localhost:${port}`);
}
bootstrap();
