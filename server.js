// Local Development Server (Zero-Dependency)
// Run with: node server.js
const http = require('http');
const fs = require('fs');
const path = require('path');
const searchHandler = require('./api/search.js');

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // Route: /api/search
    if (url.pathname === '/api/search') {
        if (req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', () => {
                req.body = body;
                searchHandler(req, res);
            });
        } else {
            req.query = Object.fromEntries(url.searchParams);
            searchHandler(req, res);
        }
        return;
    }

    // Security check: Block any direct access to private files
    if (url.pathname.startsWith('/api/_') || url.pathname.endsWith('.json') || url.pathname.endsWith('.xlsx')) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not Found');
        return;
    }

    // Serve Static files (e.g. index.html)
    let filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);

    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
    });
});

server.listen(PORT, () => {
    console.log(`Server is running at: http://localhost:${PORT}`);
});
