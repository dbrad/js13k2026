import * as esbuild from 'esbuild';
import SpglslPlugin from 'esbuild-plugin-spglsl';
import { DEFINITIONS } from '../constants/constants.mjs';

esbuild.build({
  entryPoints: ["src/ts/main.ts"],
  bundle: true,
  format: 'iife',
  write: false,
  define: {
    "DEBUG": 'false',
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
}).then(result => {
  for (let out of result.outputFiles) {
    console.log(out.text);
  }
});
