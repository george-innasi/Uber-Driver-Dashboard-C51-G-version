/* Builds react/index.html: one self-contained file (React + Tailwind inlined). */
import { build } from 'esbuild';
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

writeFileSync('.in.css', '@tailwind base;@tailwind components;@tailwind utilities;');
writeFileSync('.tw.config.cjs', "module.exports={content:['./src/App.jsx','./template.html'],theme:{extend:{fontFamily:{sans:['Inter','ui-sans-serif','system-ui','sans-serif']}}}};");
execSync('npx tailwindcss -c .tw.config.cjs -i .in.css -o .app.css --minify', { stdio: 'inherit' });
const js = await build({ entryPoints: ['src/App.jsx'], bundle: true, minify: true, format: 'iife', write: false,
  define: { 'process.env.NODE_ENV': '"production"' } });
const code = js.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const css = readFileSync('.app.css', 'utf8');
const html = readFileSync('template.html', 'utf8').replace('/*CSS*/', () => css).replace('/*JS*/', () => code);
writeFileSync('index.html', html);
console.log('index.html', (html.length / 1024).toFixed(0) + ' KB');
