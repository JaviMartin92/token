const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5173;
const ANVIL_PORT = 8545;
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  // CORS Headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.url.startsWith('/rpc')) {
    // Proxy RPC request directly to Anvil on port 8545
    const proxyReq = http.request(
      {
        host: '127.0.0.1',
        port: ANVIL_PORT,
        path: '/',
        method: req.method,
        headers: {
          'content-type': req.headers['content-type'] || 'application/json',
          'host': `127.0.0.1:${ANVIL_PORT}`
        }
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
      console.error('[RPC Proxy Error]:', err.message);
      res.writeHead(502, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
      res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32603, message: 'Anvil proxy error: ' + err.message } }));
    });
    req.pipe(proxyReq);
    return;
  }

  // Serve static files from dist/
  let filePath = path.join(DIST_DIR, req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(DIST_DIR, 'index.html');
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error');
    } else {
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-cache' });
      res.end(content);
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT} with /rpc proxying to http://127.0.0.1:${ANVIL_PORT}`);
});
