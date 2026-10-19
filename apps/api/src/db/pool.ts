import pg from 'pg';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import bcrypt from 'bcryptjs';
import { PGlite } from '@electric-sql/pglite';
import { env } from '../config.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../../../../.pglite_data');

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
  fields?: any[];
}

interface DbDriver {
  type: 'pg' | 'pglite';
  query(text: string, params?: any[]): Promise<QueryResult>;
  connect(): Promise<{ query(text: string, params?: any[]): Promise<QueryResult>; release(): void }>;
  end(): Promise<void>;
}

let dbInstance: DbDriver | null = null;
let initPromise: Promise<DbDriver> | null = null;

async function initDb(): Promise<DbDriver> {
  // 1. Try external PostgreSQL with a 2-second timeout
  try {
    const testPool = new pg.Pool({
      connectionString: env.DATABASE_URL,
      connectionTimeoutMillis: 2000,
      ssl: env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined,
      max: 10,
      idleTimeoutMillis: 30_000
    });
    const client = await testPool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('[Database] Connected to external PostgreSQL');
    const driver: DbDriver = {
      type: 'pg',
      async query(text: string, params?: any[]) {
        return testPool.query(text, params) as Promise<QueryResult>;
      },
      async connect() {
        const c = await testPool.connect();
        return {
          query: (t: string, p?: any[]) => c.query(t, p) as Promise<QueryResult>,
          release: () => c.release()
        };
      },
      async end() {
        await testPool.end();
      }
    };
    dbInstance = driver;
    return driver;
  } catch (err: any) {
    console.log(`[Database] PostgreSQL at ${env.DATABASE_URL.replace(/:[^:@]+@/, ':***@')} unavailable (${err.code || err.message}). Falling back to embedded PostgreSQL (PGlite).`);
  }

  // 2. Fall back to embedded PGlite
  let pglite: PGlite;
  try {
    pglite = new PGlite(dataDir);
    await pglite.waitReady;
  } catch (err: any) {
    console.warn('[Database] PGlite could not open data directory, using fresh memory database:', err?.message || err);
    pglite = new PGlite();
    await pglite.waitReady;
  }

  // Auto-migrate if needed
  try {
    const check = await pglite.query("SELECT 1 FROM information_schema.tables WHERE table_name = 'staff_users'");
    if (!check.rows || check.rows.length === 0) {
      console.log('[Database] Initializing schema for embedded database...');
      let sql = await readFile(path.resolve(here, '../../migrations/001_initial.sql'), 'utf8');
      sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS pgcrypto;?/gi, '-- omitted pgcrypto');
      await pglite.exec(sql);
      console.log('[Database] Schema migrations applied successfully.');

      // Auto-seed initial administrator and demo records
      console.log('[Database] Seeding administrator and demo data...');
      const hash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12);
      await pglite.query(
        `INSERT INTO staff_users (email, display_name, password_hash, role)
         VALUES ($1, 'XYZ Bank Administrator', $2, 'SUPER_ADMIN') ON CONFLICT (email) DO NOTHING`,
        [env.SEED_ADMIN_EMAIL.toLowerCase(), hash]
      );

      await pglite.query(
        `INSERT INTO knowledge_articles (title, category, content, status, created_by)
         SELECT 'UPI payment status', 'payments', 'For failed UPI payments, verify the transaction through an approved bank system. Never promise a refund timeline unless confirmed by bank policy.', 'PUBLISHED', id FROM staff_users WHERE email=$1 AND NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE title='UPI payment status')
         ON CONFLICT DO NOTHING`,
        [env.SEED_ADMIN_EMAIL.toLowerCase()]
      );

      await pglite.query(
        `INSERT INTO knowledge_articles (title, category, content, status, created_by)
         SELECT 'Card safety', 'cards', 'Never ask a caller to disclose their PIN, CVV, password, or OTP. Direct customers to approved secure channels for card security actions.', 'PUBLISHED', id FROM staff_users WHERE email=$1 AND NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE title='Card safety')
         ON CONFLICT DO NOTHING`,
        [env.SEED_ADMIN_EMAIL.toLowerCase()]
      );

      await pglite.query(
        `INSERT INTO customers(customer_reference,display_name,masked_phone,data_classification)
         VALUES ('SYN-CUST-1001','Aarav Sharma','+91******0011','SYNTHETIC'),('SYN-CUST-1002','Diya Rao','+91******0022','SYNTHETIC')
         ON CONFLICT (customer_reference) DO NOTHING`
      );

      await pglite.query(
        `INSERT INTO synthetic_accounts(account_reference,customer_id,account_type,currency,available_balance,account_status,data_classification)
         SELECT 'SYN-ACCT-1001',id,'Savings','INR',24500.00,'ACTIVE','SYNTHETIC' FROM customers WHERE customer_reference='SYN-CUST-1001'
         AND NOT EXISTS (SELECT 1 FROM synthetic_accounts WHERE account_reference='SYN-ACCT-1001')`
      );

      await pglite.query(
        `INSERT INTO synthetic_accounts(account_reference,customer_id,account_type,currency,available_balance,account_status,data_classification)
         SELECT 'SYN-ACCT-1002',id,'Current','INR',78200.50,'ACTIVE','SYNTHETIC' FROM customers WHERE customer_reference='SYN-CUST-1002'
         AND NOT EXISTS (SELECT 1 FROM synthetic_accounts WHERE account_reference='SYN-ACCT-1002')`
      );

      await pglite.query(
        `INSERT INTO integration_status(provider,status,public_metadata) VALUES
         ('openai_sip',CASE WHEN $1='true' AND $2<>'' THEN 'CONFIGURED' ELSE 'NOT_CONFIGURED' END,$3::jsonb),
         ('bank_api','NOT_CONFIGURED','{"mode":"synthetic-only"}'::jsonb)
         ON CONFLICT(provider) DO NOTHING`,
        [env.OPENAI_SIP_ENABLED, env.OPENAI_API_KEY, JSON.stringify({ model: env.OPENAI_REALTIME_MODEL })]
      );

      console.log(`[Database] Seed complete! Admin email: ${env.SEED_ADMIN_EMAIL}`);
    } else {
      console.log('[Database] Embedded database loaded from .pglite_data.');
    }
  } catch (seedErr) {
    console.error('[Database] Embedded setup error:', seedErr);
  }

  const driver: DbDriver = {
    type: 'pglite',
    async query(text: string, params?: any[]) {
      if ((!params || params.length === 0) && text.trim().includes(';') && !text.trim().startsWith('SELECT')) {
        const results = await pglite.exec(text);
        const last = results[results.length - 1];
        return {
          rows: (last?.rows as any[]) || [],
          rowCount: last?.affectedRows ?? 0,
          fields: last?.fields
        };
      }
      const res = await pglite.query(text, params);
      return {
        rows: res.rows as any[],
        rowCount: res.rowCount ?? res.affectedRows ?? res.rows.length,
        fields: res.fields
      };
    },
    async connect() {
      return {
        async query(text: string, params?: any[]) {
          return driver.query(text, params);
        },
        release() {}
      };
    },
    async end() {
      await pglite.close();
    }
  };

  dbInstance = driver;
  return driver;
}

function getDb(): Promise<DbDriver> {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (!initPromise) initPromise = initDb();
  return initPromise;
}

export const pool = {
  async query(textOrConfig: any, params?: any[]): Promise<QueryResult> {
    try {
      const db = await getDb();
      if (typeof textOrConfig === 'string') {
        return await db.query(textOrConfig, params);
      }
      return await db.query(textOrConfig.text, textOrConfig.values || params);
    } catch (err: any) {
      if (String(err?.message || err).includes('Aborted') || err?.name === 'RuntimeError') {
        console.warn('[Database] Resetting aborted database driver...');
        dbInstance = null;
        initPromise = null;
        const freshDb = await getDb();
        if (typeof textOrConfig === 'string') {
          return await freshDb.query(textOrConfig, params);
        }
        return await freshDb.query(textOrConfig.text, textOrConfig.values || params);
      }
      throw err;
    }
  },
  async connect() {
    const db = await getDb();
    return db.connect();
  },
  on(_event: string, _listener: (...args: any[]) => void) {
    return this;
  },
  async end() {
    if (dbInstance) await dbInstance.end();
  }
};
