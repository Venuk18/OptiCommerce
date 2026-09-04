import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { app as apiApp, initDatabase } from './server/app';

const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  const app = express();

  // Mount API routes first
  app.use(apiApp);

  // Initialize DB in background safely
  initDatabase().catch((err) => {
    console.warn('[Database] Background init notice:', err);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server Startup Error]:', err);
});
