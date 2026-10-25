import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import adminAccessRouter from './routes/adminAccess.js';
import { isServiceRoleConfigured } from './lib/supabaseAdmin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

// Trusted Server-Side CEO Access & Supabase Auth Admin API
app.use('/api/admin', adminAccessRouter);

// System Health Check
app.get('/api/health', (_req, res) => {
  const supabaseUrlConfigured = Boolean(
    process.env.VITE_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
  );
  const supabaseKeyConfigured = Boolean(
    process.env.VITE_SUPABASE_ANON_KEY?.trim() ||
      process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      process.env.SUPABASE_ANON_KEY?.trim()
  );

  res.json({
    status: 'healthy',
    organization: 'AICONEKT TECHNOLOGIES',
    tagline: 'CONNECT IDEAS. CREATE IMPACT.',
    backend: 'Supabase Auth & PostgreSQL (CEO RBAC + RLS Enforced)',
    supabase_env_configured: supabaseUrlConfigured && supabaseKeyConfigured,
    server_admin_configured: isServiceRoleConfigured(),
    timestamp: new Date().toISOString(),
  });
});

// Reject retired / unknown /api/* routes cleanly
app.use('/api', (_req, res) => {
  res.status(404).json({
    error:
      'Endpoint not found. Authentication and content operations are enforced via Supabase Auth, PostgreSQL RLS, and /api/admin.',
  });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, '../dist');
    app.use(express.static(distPath));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        const indexPath = path.join(distPath, 'index.html');
        return res.sendFile(indexPath, (err) => {
          if (err) next();
        });
      }
      next();
    });
  }

  app.use(
    (
      err: any,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error('[Server Error]', err);
      res.status(err.status || 500).json({
        error: err.message || 'An internal server error occurred.',
      });
    }
  );

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[AICONEKT Server] Listening on http://0.0.0.0:${PORT}`);
    console.log(
      `[AICONEKT Server] Environment: ${process.env.NODE_ENV || 'development'}`
    );
  });
}

startServer();

export default app;
