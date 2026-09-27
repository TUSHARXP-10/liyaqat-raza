// Renders the site's legal pages from Markdown (one source of truth each):
//   LICENSE.md        → /license
//   legal/privacy.md  → /privacy
//   legal/terms.md    → /terms
// Handles the small Markdown subset they use: headings, paragraphs, lists,
// tables, bold, links and rules.
import { readFileSync } from 'node:fs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\][]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\[([^\][]+)\]\((\/[^\s)]*)\)/g, '<a href="$2">$1</a>');

function markdownToHtml(md) {
  const out = [];
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let para = [];
  const flush = () => {
    if (para.length) out.push(`<p>${inline(para.join(' '))}</p>`);
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) { flush(); continue; }
    if (/^---+$/.test(line.trim())) { flush(); out.push('<hr />'); continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) { flush(); out.push(`<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`); continue; }
    if (line.startsWith('- ')) {
      flush();
      const items = [];
      while (i < lines.length && lines[i].startsWith('- ')) items.push(`<li>${inline(lines[i++].slice(2))}</li>`);
      i--;
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }
    if (line.startsWith('|')) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++]);
      i--;
      const cells = (r) => r.split('|').slice(1, -1).map((c) => c.trim());
      const [head, , ...body] = rows;
      out.push(`<div class="table"><table><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body
        .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return out.join('\n');
}

export const LEGAL = {
  license: { file: 'LICENSE.md', title: 'License', description: 'Website License Agreement between Webzoo Innovation and Raza Perfume.' },
  privacy: { file: 'legal/privacy.md', title: 'Privacy Policy', description: 'How Raza Perfume collects, uses and protects your personal data: orders, newsletter, browser storage and analytics.' },
  terms: { file: 'legal/terms.md', title: 'Terms & Conditions', description: 'Terms for ordering from Raza Perfume: fragrances, prices, WhatsApp orders, payment, delivery, returns and safe use.' },
};

// on the privacy page: withdraw or change the analytics choice (src/ui/consent.js)
const CHOICE = `<section class="choice" aria-labelledby="choice-title">
  <h2 id="choice-title">Your analytics choice</h2>
  <p data-choice-now>You haven't made a choice yet.</p>
  <button type="button" data-choice-reset>Change my choice</button>
  <script>
    (function () {
      var KEY = 'raza-consent-v1', now = document.querySelector('[data-choice-now]');
      try {
        var c = JSON.parse(localStorage.getItem(KEY) || 'null');
        if (c) now.textContent = c.analytics ? 'You allowed anonymous visit statistics.' : 'You chose no visit statistics.';
      } catch (e) {}
      document.querySelector('[data-choice-reset]').addEventListener('click', function () {
        try { localStorage.removeItem(KEY); } catch (e) {}
        now.textContent = 'Done. Nothing is measured, and we will ask you again on your next visit.';
      });
    })();
  </script>
</section>`;

export function legalPage(key, root = new URL('../', import.meta.url)) {
  const page = LEGAL[key];
  const md = readFileSync(new URL(page.file, root), 'utf8');
  const nav = Object.entries(LEGAL).map(([k, p]) => (k === key ? `<b>${p.title}</b>` : `<a href="/${k}">${p.title}</a>`)).join('<span>·</span>');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${page.title} · Raza Perfume</title>
  <meta name="description" content="${page.description}" />
  <meta name="theme-color" content="#070504" />
  <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32.png" />
  <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #070504; color: #d9cdb6; font: 300 15.5px/1.75 'Jost', system-ui, sans-serif; }
    main { max-width: 820px; margin: 0 auto; padding: 72px 24px 64px; }
    .back { display: inline-block; margin-bottom: 40px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #c9a45c; text-decoration: none; }
    h1 { font: 400 clamp(28px, 5vw, 42px)/1.2 'Cinzel', serif; letter-spacing: .12em; text-transform: uppercase; color: #ecd49a; margin: 0 0 8px; }
    h2 { font: 400 17px/1.4 'Cinzel', serif; letter-spacing: .14em; text-transform: uppercase; color: #ecd49a; margin: 44px 0 12px; }
    strong { font-weight: 500; color: #f0e3c8; }
    a { color: #c9a45c; text-underline-offset: 3px; }
    hr { border: 0; border-top: 1px solid rgba(201,164,92,.25); margin: 36px 0; }
    ul { padding-left: 20px; }
    li + li { margin-top: 6px; }
    .table { overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 12px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid rgba(201,164,92,.18); vertical-align: top; }
    th { font-weight: 500; color: #ecd49a; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
    footer { max-width: 820px; margin: 0 auto; padding: 28px 24px 56px; border-top: 1px solid rgba(201,164,92,.18); font-size: 12px; letter-spacing: .12em; text-transform: uppercase; color: #a3957d; display: flex; flex-wrap: wrap; gap: 10px 14px; }
    .choice { margin-top: 44px; padding: 22px 24px; border: 1px solid rgba(201,164,92,.25); border-radius: 12px; }
    .choice h2 { margin-top: 0; }
    .choice button { padding: 11px 22px; border: 1px solid #c9a45c; border-radius: 999px; background: none; color: #ecd49a; font: 400 11px/1 'Jost', sans-serif; letter-spacing: .24em; text-transform: uppercase; cursor: pointer; }
    .choice button:hover, .choice button:focus-visible { background: rgba(201,164,92,.14); }
    footer b { font-weight: 500; color: #ecd49a; }
    footer span { color: #6c604f; }
    @media print { body { background: #fff; color: #111; } h1, h2, th, strong { color: #111; } .back, footer { display: none; } }
  </style>
</head>
<body>
  <main>
    <a class="back" href="/">← Raza Perfume</a>
${markdownToHtml(md)}
${key === 'privacy' ? CHOICE : ''}
  </main>
  <footer><nav aria-label="Legal">${nav}</nav></footer>
</body>
</html>
`;
}

// kept for the existing callers
export const licensePage = (root) => legalPage('license', root);
