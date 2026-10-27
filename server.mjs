import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { extname, isAbsolute, join, normalize, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT) || 4173;
const rooms = new Map();
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
};

function send(response, status, data) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function cleanRoom(value) {
  return String(value || 'mist-island').replace(/[^\w-]/g, '').slice(0, 24) || 'mist-island';
}

function getRoom(name) {
  if (!rooms.has(name)) rooms.set(name, new Map());
  return rooms.get(name);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);

  if (url.pathname === '/api/players' && request.method === 'GET') {
    const roomName = cleanRoom(url.searchParams.get('room'));
    const room = getRoom(roomName);
    const now = Date.now();
    for (const [id, player] of room) {
      if (now - player.updatedAt > 15000) room.delete(id);
    }
    const self = url.searchParams.get('id');
    return send(response, 200, [...room.values()].filter((player) => player.id !== self).map(({ updatedAt, ...player }) => player));
  }

  if (url.pathname === '/api/players' && request.method === 'POST') {
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 4096) return send(response, 413, { error: 'payload too large' });
    }
    try {
      const input = JSON.parse(body);
      const id = String(input.id || '').slice(0, 48);
      if (!id) return send(response, 400, { error: 'player id required' });
      const room = getRoom(cleanRoom(input.room));
      room.set(id, {
        id,
        name: String(input.name || '旅人').slice(0, 14),
        x: Math.max(0, Math.min(2400, Number(input.x) || 0)),
        y: Math.max(0, Math.min(450, Number(input.y) || 0)),
        scene: String(input.scene || 'reed').slice(0, 16),
        skin: String(input.skin || 'mist').slice(0, 16),
        updatedAt: Date.now(),
      });
      return send(response, 200, { ok: true });
    } catch {
      return send(response, 400, { error: 'invalid JSON' });
    }
  }

  const pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const file = normalize(join(root, pathname));
  const filePath = relative(root, file);
  if (filePath.startsWith('..') || isAbsolute(filePath)) return send(response, 403, { error: 'forbidden' });
  createReadStream(file)
    .on('error', () => send(response, 404, { error: 'not found' }))
    .on('open', () => response.writeHead(200, { 'content-type': contentTypes[extname(file)] || 'application/octet-stream' }))
    .pipe(response);
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Mist Island is running at http://localhost:${port}`);
});