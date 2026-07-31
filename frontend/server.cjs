const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5173;
const ANVIL_HOST = process.env.ANVIL_HOST || 'host.docker.internal';
const ANVIL_PORT = 8545;
const DIST_DIR = path.resolve(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // Security & Anti-Cache Headers (Ensures State 0 Clean Reloads)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url.startsWith('/rpc')) {
    let bodyChunks = [];
    req.on('data', (chunk) => bodyChunks.push(chunk));
    req.on('end', () => {
      const bodyBuffer = Buffer.concat(bodyChunks);
      const hostsToTry = [ANVIL_HOST, 'alpha-anvil', '127.0.0.1', 'localhost'];

      function tryProxy(hostIndex) {
        if (hostIndex >= hostsToTry.length) {
          res.writeHead(502, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'RPC proxy unavailable across all hosts' } }));
          return;
        }

        const targetHost = hostsToTry[hostIndex];
        const proxyReq = http.request(
          {
            host: targetHost,
            port: ANVIL_PORT,
            path: '/',
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              'content-length': bodyBuffer.length,
              'host': `${targetHost}:${ANVIL_PORT}`
            },
            timeout: 3000
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode, {
              'content-type': 'application/json',
              'access-control-allow-origin': '*'
            });
            proxyRes.pipe(res);
          }
        );

        proxyReq.on('error', (err) => {
          tryProxy(hostIndex + 1);
        });

        proxyReq.on('timeout', () => {
          proxyReq.destroy();
        });

        proxyReq.write(bodyBuffer);
        proxyReq.end();
      }

      tryProxy(0);
    });
    return;
  }

  // Prevent Path Traversal by resolving and validating absolute target path
  const sanitizedUrl = path.normalize(req.url === '/' ? '/index.html' : req.url).replace(/^(\.\.[\/\\])+/, '');
  let filePath = path.join(DIST_DIR, sanitizedUrl);

  // Ensure resolved path stays strictly within DIST_DIR
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden: Invalid Path Access');
    return;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      console.error('[Static Server Error]:', filePath, err.message);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server Error');
      return;
    }

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Frontend & RPC Proxy] Running at http://0.0.0.0:${PORT}`);
});
