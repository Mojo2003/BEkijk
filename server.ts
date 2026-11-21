import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import { buildGuideResponse, buildLegacyGuideExport } from './src/server/epgService.ts';
import type { WindowMode } from './src/types/epg.ts';

const PORT = 3000;

async function startServer() {
  const app = express();
  app.use(express.json());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'kijkbe-epg' });
  });

  app.get('/api/guide', async (req, res) => {
    try {
      const dayParam = Number(req.query.day ?? 0);
      const dayOffset = Number.isFinite(dayParam) ? dayParam : 0;
      const windowMode: WindowMode = req.query.window === 'primetime' ? 'primetime' : 'day';
      const data = await buildGuideResponse({ dayOffset, windowMode });
      res.json(data);
    } catch (err) {
      console.error('[BEkijk] /api/guide error:', err);
      res.status(500).json({ error: 'Kon de TV-gids niet laden.' });
    }
  });

  app.post('/api/refresh', async (req, res) => {
    try {
      const dayParam = Number(req.query.day ?? 0);
      const dayOffset = Number.isFinite(dayParam) ? dayParam : 0;
      const windowMode: WindowMode = req.query.window === 'primetime' ? 'primetime' : 'day';
      const data = await buildGuideResponse({ dayOffset, windowMode, forceRefresh: true });
      res.json(data);
    } catch (err) {
      console.error('[BEkijk] /api/refresh error:', err);
      res.status(500).json({ error: 'Kon de EPG-feed niet verversen.' });
    }
  });

  app.get('/api/guide.json', async (_req, res) => {
    try {
      const legacy = await buildLegacyGuideExport();
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json(legacy);
    } catch (err) {
      console.error('[BEkijk] /api/guide.json error:', err);
      res.status(500).json({ error: 'Kon guide.json niet genereren.' });
    }
  });

  app.get('/api/fetch_epg.py', (_req, res) => {
    try {
      const scriptPath = path.resolve(process.cwd(), 'fetch_epg.py');
      const content = fs.readFileSync(scriptPath, 'utf-8');
      res.setHeader('Content-Type', 'text/x-python; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="fetch_epg.py"');
      res.send(content);
    } catch (err) {
      console.error('[BEkijk] /api/fetch_epg.py error:', err);
      res.status(404).json({ error: 'fetch_epg.py niet gevonden.' });
    }
  });

  const ALLOWED_TV_FILES = new Set([
    'AndroidManifest.xml',
    'EpgModels.kt',
    'TvAppLauncher.kt',
    'TvGuideScreen.kt',
  ]);

  app.get('/api/android-tv/:filename', (req, res) => {
    const filename = req.params.filename;
    if (!ALLOWED_TV_FILES.has(filename)) {
      return res.status(404).json({ error: 'Bestand niet gevonden.' });
    }
    try {
      const filePath = path.resolve(process.cwd(), 'android-tv', filename);
      const content = fs.readFileSync(filePath, 'utf-8');
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      if (req.query.download === '1') {
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }
      return res.send(content);
    } catch (err) {
      console.error('[BEkijk] /api/android-tv error:', err);
      return res.status(500).json({ error: 'Kon Android TV-bestand niet lezen.' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`BEkijk server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
