const http = require('http');
const https = require('https');

const PORT = 3000;
const TARGET_HOST = 'lms-api.mindx.edu.vn';

const server = http.createServer((req, res) => {
    // Enable CORS for localhost
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type, Authorization');
    
    // Handle OPTIONS request for CORS preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // Prepare headers for the target API
    const targetHeaders = { ...req.headers };
    
    // Need to rewrite host header for the target to accept the request
    targetHeaders.host = TARGET_HOST;
    // Remove origin/referer so the target server doesn't complain
    delete targetHeaders.origin;
    delete targetHeaders.referer;

    const options = {
        hostname: TARGET_HOST,
        port: 443,
        path: req.url === '/' ? '/' : req.url, // Ensure path is passed correctly
        method: req.method,
        headers: targetHeaders
    };

    const proxyReq = https.request(options, (proxyRes) => {
        // We might want to remove strict CORS headers from the response if they exist
        const responseHeaders = { ...proxyRes.headers };
        delete responseHeaders['access-control-allow-origin'];
        delete responseHeaders['access-control-allow-methods'];
        delete responseHeaders['access-control-allow-headers'];
        
        // Pass back all target headers except CORS overrides
        Object.keys(responseHeaders).forEach(key => {
            res.setHeader(key, responseHeaders[key]);
        });
        
        // Set standard status code
        res.writeHead(proxyRes.statusCode || 200);
        
        // Pipe the response body to the client
        proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
        console.error('Proxy Error:', err.message);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
    });

    // Pipe the client's request body to the target
    req.pipe(proxyReq);
});

server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`✅ LOCAL CORS PROXY RUNNING`);
    console.log(`======================================================`);
    console.log(`→ Proxy URL:      http://localhost:${PORT}/`);
    console.log(`→ Target API:     https://${TARGET_HOST}/`);
    console.log(`\nGiữ cửa sổ terminal này mở. Sau đó quay lại trình duyệt đang chạy app của bạn.`);
});
