import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { env } from './config.js';
import { pool } from './db/pool.js';
import { authRouter } from './routes/auth.js';
import { dashboardRouter } from './routes/dashboard.js';
import { knowledgeRouter } from './routes/knowledge.js';
import { ticketsRouter } from './routes/tickets.js';
import { telephonyRouter } from './routes/telephony.js';
import { simulationRouter } from './routes/simulation.js';
const app=express();
app.disable('x-powered-by');app.set('trust proxy', env.NODE_ENV==='production'?1:false);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: true, credentials: false, methods: ['GET', 'POST', 'PATCH', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'x-gemini-api-key'] }));
app.use(
  '/api/telephony',
  express.raw({ type: 'application/json', limit: '256kb' }),
  express.urlencoded({ extended: true, limit: '256kb' }),
  telephonyRouter
);
app.use(express.json({limit:'25mb'}));
const isDev = env.NODE_ENV !== 'production';
const generalLimiter = rateLimit({
  windowMs: 60_000,
  limit: isDev ? 3000 : 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please wait a moment and try again.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: isDev ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait a few moments and try again.' }
});

app.use('/api', generalLimiter);
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected', service: 'xyz-bank-ai-api' });
  } catch {
    res.status(503).json({ status: 'degraded', database: 'unavailable' });
  }
});
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/knowledge', knowledgeRouter);
app.use('/api/tickets', ticketsRouter);
app.use('/api/simulation', simulationRouter);
app.use((_req,res)=>res.status(404).json({error:'Not found'}));
app.use((err:unknown,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{console.error('API error',err);res.status(500).json({error:'Internal server error'});});
const server=app.listen(env.API_PORT,()=>console.log(`XYZ Bank AI API listening on :${env.API_PORT}`));
const shutdown=()=>{server.close(()=>{pool.end().finally(()=>process.exit(0));});setTimeout(()=>process.exit(1),10_000).unref();};process.on('SIGTERM',shutdown);process.on('SIGINT',shutdown);
