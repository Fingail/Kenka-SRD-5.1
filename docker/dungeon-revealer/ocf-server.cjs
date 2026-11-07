// Small version-pinned server adapter; the upstream application remains intact.
const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const express = require('/usr/src/app/node_modules/express');
const { bootstrapServer } = require('/usr/src/app/server-build/server');
const { getEnv } = require('/usr/src/app/server-build/env');

bootstrapServer(getEnv(process.env)).then(({ app, httpServer }) => {
  const router = express.Router();
  const version = () => crypto.createHash('sha256').update(fs.readFileSync('/usr/src/app/build/ocf-bridge.js')).digest('hex').slice(0, 16);
  const versionedHtml = html => html.replace(/src="\/ocf-bridge\.js(?:\?[^\"]*)?"/g, `src="/ocf-bridge.js?v=${version()}"`);
  const noCache = response => {
    response.setHeader('Cache-Control', 'no-store, max-age=0');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');
    response.setHeader('X-OCF-UI-Version', version());
  };
  router.patch('/api/map/:mapId/token/:tokenId', async (request,response,next) => {
    const bearer=request.headers.authorization ? request.headers.authorization.split(' ')[1] : new URL(request.originalUrl,'http://local').searchParams.get('authorization');
    if(bearer===process.env.DM_PASSWORD||bearer!==process.env.PC_PASSWORD)return next();
    try {
      const policy=await new Promise((resolve,reject)=>{
        const upstream=http.request({hostname:'ocf-handler',port:8080,path:'/movement/check',method:'POST',headers:{Authorization:'Bearer '+process.env.PC_PASSWORD,'Content-Type':'application/json'}},result=>{result.resume();resolve(result.statusCode);});
        upstream.setTimeout(3000,()=>upstream.destroy(new Error('Turn permission timeout.')));upstream.on('error',reject);
        upstream.end(JSON.stringify({map_id:request.params.mapId,token_id:request.params.tokenId}));
      });
      if(policy>=200&&policy<300)return next();
      response.statusCode=policy;response.setHeader('Content-Type','application/json');response.end(JSON.stringify({error:{message:'This PC can move only on its active combat turn.'}}));
    }catch{response.statusCode=503;response.setHeader('Content-Type','application/json');response.end(JSON.stringify({error:{message:'Turn permissions unavailable. Movement paused; the GM can still move tokens.'}}));}
  });
  router.get(['/', '/dm'], (request, response) => {
    noCache(response);
    response.setHeader('Content-Type', 'text/html;charset=utf-8');
    response.end(versionedHtml(fs.readFileSync('/usr/src/app/build/index.html', 'utf8')));
  });
  router.get('/ocf-bridge.js', (request, response) => {
    noCache(response);
    response.setHeader('Content-Type', 'application/javascript;charset=utf-8');
    response.end(fs.readFileSync('/usr/src/app/build/ocf-bridge.js'));
  });
  router.use('/ocf-api', (request, response) => {
    const path = request.originalUrl.replace(/^\/ocf-api/, '') || '/';
    const upstream = http.request({
      hostname: 'ocf-handler', port: 8080, path, method: request.method,
      headers: {
        'content-type': request.headers['content-type'] || 'application/json',
        authorization: request.headers.authorization || '',
        origin: request.headers.origin || '',
      },
    }, result => {
      response.statusCode = result.statusCode;
      response.setHeader('Content-Type', result.headers['content-type'] || 'application/json');
      response.setHeader('Cache-Control', 'no-store');
      if ((result.headers['content-type'] || '').startsWith('text/html')) {
        noCache(response);
        const chunks = [];
        result.on('data', chunk => chunks.push(chunk));
        result.on('end', () => response.end(versionedHtml(Buffer.concat(chunks).toString('utf8'))));
      } else result.pipe(response);
    });
    upstream.setTimeout(120000, () => upstream.destroy());
    upstream.on('error', () => {
      if (!response.headersSent) { response.writeHead(502, { 'Content-Type': 'application/json' }); response.end(JSON.stringify({ error: 'OCF handler unavailable.' })); }
      else response.end();
    });
    request.pipe(upstream);
  });
  // Proxy before the upstream JSON parser and SPA fallback, retaining raw bodies.
  app.use(router);
  app._router.stack.unshift(app._router.stack.pop());
  httpServer.listen(Number(process.env.PORT || 3000), process.env.HOST || '0.0.0.0');
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => httpServer.close(() => process.exit(0)));
}).catch(error => { console.error(error.message); process.exit(1); });
