import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';

await rm('dist', { recursive: true, force: true });
await mkdir('dist', { recursive: true });
await cp('index.html', 'dist/index.html');
await cp('app.js', 'dist/app.js');
await cp('styles.css', 'dist/styles.css');
await cp('intelligence.js', 'dist/intelligence.js');
await cp('intelligence.css', 'dist/intelligence.css');
await cp('public', 'dist', { recursive: true });

let html = await readFile('dist/index.html', 'utf8');
html = html.replace('</head>', '  <link rel="stylesheet" href="/intelligence.css" />\n</head>');
html = html.replace('  <script type="module" src="/app.js"></script>\n</body>', '  <script type="module" src="/app.js"></script>\n  <script type="module" src="/intelligence.js"></script>\n</body>');
await writeFile('dist/index.html', html);

console.log('Static Human Atlas build written to dist/ with anatomy intelligence.');
