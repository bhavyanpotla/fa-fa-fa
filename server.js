// Local server for dry runs: node server.js  (needs Node 18+). Works with flat or netlify/functions layout.
const http = require('http'), fs = require('fs'), path = require('path');
try { for (const l of fs.readFileSync(path.join(__dirname, '.env'), 'utf8').split(/\r?\n/)) { const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/); if (m) process.env[m[1]] ||= m[2]; } } catch {}
const dir = fs.existsSync(path.join(__dirname, 'netlify/functions/translate.js')) ? path.join(__dirname, 'netlify/functions') : __dirname;
// Discover every function in the directory instead of listing them by hand.
// A hardcoded list is how 'voices' silently 404'd while translate/speak/listen worked.
const fns = {};
for (const file of fs.readdirSync(dir)) {
  if (!file.endsWith('.js') || file === 'server.js' || file === 'voices.json') continue;
  const name = file.replace(/\.js$/, '');
  try { fns[name] = require(path.join(dir, file)).handler; }
  catch (e) { console.log('Could not load ' + file + ' (' + e.code + ')'); }
}
console.log('Functions loaded: ' + (Object.keys(fns).join(', ') || 'none'));
http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const match = url.pathname.match(/^\/\.netlify\/functions\/([\w-]+)/);

  if (!match) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
  }

  const name = match[1];
  const handler = fns[name];
  if (!handler) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: name + '.js is missing from your folder.' }));
  }

  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', async () => {
    try {
      const result = await handler({
        httpMethod: req.method,
        body,
        // the query string has to reach the handler: /voices?lang=bn-IN depends on it
        queryStringParameters: Object.fromEntries(url.searchParams.entries()),
      });
      res.writeHead(result.statusCode, result.headers);
      res.end(result.body);
    } catch (error) {
      // a broken request must not take the dev server down with it
      console.error('Function ' + name + ' threw:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Function ' + name + ' threw: ' + error.message }));
    }
  });
}).listen(3000, () => console.log('Setu running at http://localhost:3000' + (process.env.SARVAM_API_KEY ? '' : '  (WARNING: SARVAM_API_KEY not set)')));
