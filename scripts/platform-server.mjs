import http from 'http';
import { handlePlatformApiRequest, initPlatformServices } from '../dashboard/vite-plugin-platform-api.mjs';

const PORT = Number(process.env.PORT || process.env.PLATFORM_API_PORT || 8787);

initPlatformServices();

const server = http.createServer(async (req, res) => {
  const handled = await handlePlatformApiRequest(req, res);
  if (handled) return;

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Playwright platform API listening on http://0.0.0.0:${PORT}`);
});
