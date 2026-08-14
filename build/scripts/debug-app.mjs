import * as esbuild from 'esbuild';
import SpglslPlugin from 'esbuild-plugin-spglsl';
import http from 'node:http';
import { DEFINITIONS } from '../constants/constants.mjs';

let ctx = await esbuild.context({
  entryPoints: ["src/ts/main.ts"],
  bundle: true,
  format: 'iife',
  sourcemap: true,
  outfile: "build/debug/main.js",
  define: {
    "DEBUG": 'true',
    ...DEFINITIONS
  },
  loader: {
    ".webp": "dataurl"
  },
  plugins: [
    SpglslPlugin({
      compileMode: 'Optimize',
      minify: true,
      mangle: true,
    }),
  ]
});

let { hosts, port } = await ctx.serve({
  servedir: "build/debug",
  cors: {
    origin: [
      "127.0.0.1",
      "192.168.1.168",
      "localhost",
    ]
  }
});

http.createServer((req, res) => {
  const reqOptions = {
    hostname: hosts[0],
    port: port,
    path: req.url,
    method: req.method,
    headers: req.headers,
  };

  const proxyReq = http.request(reqOptions, proxyRes => {
    if (proxyRes.statusCode === 404) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>Not Found</h1>');
      return;
    }

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content, Accept, Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  req.pipe(proxyReq, { end: true });
}).listen(3000);

console.log(`Serving running on http://localhost:3000`);