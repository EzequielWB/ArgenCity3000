/**
 * Rebuilds the PWA icons from the tent of the favicon (`index.html`): the same three triangles,
 * rendered at the sizes the manifest asks for, with the transparent margin a maskable icon needs.
 *
 *   node scripts/make-icons.cjs
 *
 * Writes `public/icons/icon-192.png` and `public/icons/icon-512.png`.
 */
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const TENT = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <path d="M16 3 29 10 16 17 3 10z" fill="#e0a526"/>
  <path d="M3 10v11l13 7V17z" fill="#b4532f"/>
  <path d="M29 10v11l-13 7V17z" fill="#6fb7e0"/>
</svg>`;

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  fs.mkdirSync(path.join(__dirname, '..', 'public', 'icons'), { recursive: true });
  for (const size of [192, 512]) {
    // Maskable icons get cut to a circle: the tent stays inside 80% of the canvas, on the deep green.
    await page.setViewport({ width: size, height: size });
    const inner = Math.round(size * 0.62);
    const pad = Math.round((size - inner) / 2);
    await page.setContent(`<body style="margin:0;background:#0a241b">
      <div style="width:${size}px;height:${size}px;display:grid;place-items:center">${TENT.replace('<svg ', `<svg width="${inner}" height="${inner}" style="margin:${pad}px"`)}</div></body>`);
    await page.screenshot({ path: path.join(__dirname, '..', 'public', 'icons', `icon-${size}.png`), omitBackground: false });
    console.log(`icon-${size}.png`);
  }
  await browser.close();
})();
