import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@xyzbank.local'),
  SEED_ADMIN_PASSWORD: z.string().min(12).default('ChangeThisPassword123!'),
  OPENAI_API_KEY: z.string().optional().default(''),
  OPENAI_WEBHOOK_SECRET: z.string().optional().default(''),
  OPENAI_REALTIME_MODEL: z.string().default('gpt-realtime-2.1'),
  OPENAI_REALTIME_VOICE: z.string().default('marin'),
  OPENAI_SIP_ENABLED: z.string().default('false'),
  GEMINI_API_KEY: z.string().optional().default(''),
  TWILIO_ACCOUNT_SID: z.string().optional().default(''),
  TWILIO_AUTH_TOKEN: z.string().optional().default(''),
  TWILIO_PHONE_NUMBER: z.string().optional().default(''),
  HUMAN_TRANSFER_URI: z.string().default(''),
  STORE_TRANSCRIPTS: z.string().default('false')
});

export const env = schema.parse(process.env);
export const isProduction = env.NODE_ENV === 'production';
