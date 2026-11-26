// 작은 정적 서버(시험·개발용). 의존성 없음.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json' };
export function startServer(port = 0, root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'web')) {
  const srv = http.createServer((req, res) => {
    const u = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let f = path.normalize(path.join(root, u));
    if (!f.startsWith(root)) { res.writeHead(403); return res.end(); }
    if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
    fs.readFile(f, (err, buf) => {
      if (err) { res.writeHead(404); return res.end('없음'); }
      res.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      res.end(buf);
    });
  });
  return new Promise((ok) => srv.listen(port, '127.0.0.1', () => ok({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() })));
}
