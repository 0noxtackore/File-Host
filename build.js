const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'public');
const DIST = path.join(__dirname, 'dist');

async function build() {
  if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });

  fs.mkdirSync(path.join(DIST, 'css'), { recursive: true });
  fs.mkdirSync(path.join(DIST, 'js'), { recursive: true });
  fs.mkdirSync(path.join(DIST, 'assets'), { recursive: true });

  // Minify CSS
  const cssResult = await esbuild.build({
    entryPoints: [path.join(SRC, 'css/style.css')],
    bundle: true,
    minify: true,
    outdir: path.join(DIST, 'css'),
    write: false,
  });
  for (const file of cssResult.outputFiles) {
    fs.writeFileSync(file.path, file.contents);
  }

  // Minify JS
  const jsResult = await esbuild.build({
    entryPoints: [path.join(SRC, 'js/app.js')],
    bundle: true,
    minify: true,
    outfile: path.join(DIST, 'js/app.js'),
    write: false,
  });
  for (const file of jsResult.outputFiles) {
    fs.writeFileSync(file.path, file.contents);
  }

  // Copy favicon
  fs.copyFileSync(path.join(SRC, 'favicon.svg'), path.join(DIST, 'favicon.svg'));

  // Build HTML — replace asset references with minified versions
  let html = fs.readFileSync(path.join(SRC, 'index.html'), 'utf8');
  html = html.replace(/\/css\/style\.css/g, '/css/style.css');
  html = html.replace(/\/js\/app\.js/g, '/js/app.js');
  fs.writeFileSync(path.join(DIST, 'index.html'), html);

  const cssSize = fs.statSync(path.join(DIST, 'css/style.css')).size;
  const jsSize = fs.statSync(path.join(DIST, 'js/app.js')).size;
  const htmlSize = fs.statSync(path.join(DIST, 'index.html')).size;

  console.log(`Build completado en dist/`);
  console.log(`  index.html  ${htmlSize} bytes`);
  console.log(`  style.css   ${cssSize} bytes`);
  console.log(`  app.js      ${jsSize} bytes`);
}

build().catch(err => { console.error(err); process.exit(1); });