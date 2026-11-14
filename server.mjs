import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const DIR = path.dirname(new URL(import.meta.url).pathname);
const PORT = Number(process.env.PORT || 6070);
const ROOTS = [['/three/', DIR + '/node_modules/three/'], ['/', DIR + '/public/']];
const MIME = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json', '.css':'text/css',
  '.png':'image/png', '.jpg':'image/jpeg', '.webp':'image/webp', '.glb':'model/gltf-binary', '.ogg':'audio/ogg', '.wav':'audio/wav', '.obj':'text/plain; charset=utf-8', '.svg':'image/svg+xml' };
const GZ = new Set(['.html', '.js', '.mjs', '.json', '.css', '.obj']);
http.createServer((req, res) => {
  try {
    const u = new URL(req.url, 'http://x'); let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    let full = null;
    for (const [pre, dir] of ROOTS) { if (p.startsWith(pre)) { const f = path.join(dir, p.slice(pre.length)); if (f.startsWith(dir)) { full = f; break; } } }
    if (!full || !fs.existsSync(full) || !fs.statSync(full).isFile()) { res.writeHead(404, {'content-type':'text/plain'}); return res.end('404'); }
    const st = fs.statSync(full), ext = path.extname(full).toLowerCase();
    const h = { 'content-type': MIME[ext] || 'application/octet-stream', 'accept-ranges': 'bytes', 'cache-control': ['.html','.js','.json'].includes(ext) ? 'no-cache' : 'public, max-age=3600', 'etag': `"${st.size}-${st.mtimeMs}"`, 'access-control-allow-origin': '*' };
    if (req.headers['if-none-match'] === h.etag) { res.writeHead(304, h); return res.end(); }
    const m = (req.headers.range || '').match(/bytes=(\d*)-(\d*)/);
    if (m && (m[1] || m[2])) { let s = m[1] ? +m[1] : st.size - +m[2], e = m[1] && m[2] ? +m[2] : st.size - 1; e = Math.min(e, st.size - 1);
      res.writeHead(206, { ...h, 'content-range': `bytes ${s}-${e}/${st.size}`, 'content-length': e - s + 1 }); return fs.createReadStream(full, { start: s, end: e }).pipe(res); }
    if (GZ.has(ext) && /gzip/.test(req.headers['accept-encoding'] || '') && st.size > 1024) {
      res.writeHead(200, { ...h, 'content-encoding': 'gzip', vary: 'accept-encoding' }); return fs.createReadStream(full).pipe(zlib.createGzip({ level: 6 })).pipe(res); }
    res.writeHead(200, { ...h, 'content-length': st.size }); fs.createReadStream(full).pipe(res);
  } catch (e) { res.writeHead(500); res.end(String(e.message)); }
}).listen(PORT, '0.0.0.0', () => console.log('selena-game di port ' + PORT));
