import bcrypt from 'bcryptjs';
import { env } from '../config.js';
import { pool } from './pool.js';
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const hash = await bcrypt.hash(env.SEED_ADMIN_PASSWORD, 12);
  const user = await client.query(`INSERT INTO staff_users (email, display_name, password_hash, role)
    VALUES ($1, 'XYZ Bank Administrator', $2, 'SUPER_ADMIN') ON CONFLICT (email) DO NOTHING RETURNING id`, [env.SEED_ADMIN_EMAIL.toLowerCase(), hash]);
  await client.query(`INSERT INTO knowledge_articles (title, category, content, status, created_by)
    SELECT 'UPI payment status', 'payments', 'For failed UPI payments, verify the transaction through an approved bank system. Never promise a refund timeline unless confirmed by bank policy.', 'PUBLISHED', id FROM staff_users WHERE email=$1 AND NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE title='UPI payment status')
    ON CONFLICT DO NOTHING`, [env.SEED_ADMIN_EMAIL.toLowerCase()]);
  await client.query(`INSERT INTO knowledge_articles (title, category, content, status, created_by)
    SELECT 'Card safety', 'cards', 'Never ask a caller to disclose their PIN, CVV, password, or OTP. Direct customers to approved secure channels for card security actions.', 'PUBLISHED', id FROM staff_users WHERE email=$1 AND NOT EXISTS (SELECT 1 FROM knowledge_articles WHERE title='Card safety')
    ON CONFLICT DO NOTHING`, [env.SEED_ADMIN_EMAIL.toLowerCase()]);
  const syntheticCustomer = await client.query(`INSERT INTO customers(customer_reference,display_name,masked_phone,data_classification)
    VALUES ('SYN-CUST-1001','Aarav Sharma','+91******0011','SYNTHETIC'),('SYN-CUST-1002','Diya Rao','+91******0022','SYNTHETIC')
    ON CONFLICT (customer_reference) DO NOTHING RETURNING id,customer_reference`);
  await client.query(`INSERT INTO synthetic_accounts(account_reference,customer_id,account_type,currency,available_balance,account_status,data_classification)
    SELECT 'SYN-ACCT-1001',id,'Savings','INR',24500.00,'ACTIVE','SYNTHETIC' FROM customers WHERE customer_reference='SYN-CUST-1001'
    AND NOT EXISTS (SELECT 1 FROM synthetic_accounts WHERE account_reference='SYN-ACCT-1001')`);
  await client.query(`INSERT INTO synthetic_accounts(account_reference,customer_id,account_type,currency,available_balance,account_status,data_classification)
    SELECT 'SYN-ACCT-1002',id,'Current','INR',78200.50,'ACTIVE','SYNTHETIC' FROM customers WHERE customer_reference='SYN-CUST-1002'
    AND NOT EXISTS (SELECT 1 FROM synthetic_accounts WHERE account_reference='SYN-ACCT-1002')`);
  await client.query(`INSERT INTO integration_status(provider,status,public_metadata) VALUES
    ('openai_sip',CASE WHEN $1='true' AND $2<>'' THEN 'CONFIGURED' ELSE 'NOT_CONFIGURED' END,$3::jsonb),
    ('bank_api','NOT_CONFIGURED','{"mode":"synthetic-only"}'::jsonb)
    ON CONFLICT(provider) DO NOTHING`,[env.OPENAI_SIP_ENABLED,env.OPENAI_API_KEY,JSON.stringify({model:env.OPENAI_REALTIME_MODEL})]);
  await client.query('COMMIT');
  console.log(user.rowCount ? `Created seed administrator ${env.SEED_ADMIN_EMAIL}` : `Seed administrator ${env.SEED_ADMIN_EMAIL} already exists; no password changed.`);
} catch (e) { await client.query('ROLLBACK'); console.error(e); process.exitCode = 1; }
finally { client.release(); await pool.end(); }
