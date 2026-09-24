// Renders LICENSE.md as the public /license.html page (one source of truth).
// Handles the small Markdown subset the license uses: headings, paragraphs,
// lists, tables, bold, links and rules.
import { readFileSync } from 'node:fs';

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const inline = (s) =>
  esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\][]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

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
      out.push(`<table><thead><tr>${cells(head).map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead><tbody>${body
        .map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
      continue;
    }
    para.push(line.trim());
  }
  flush();
  return out.join('\n');
}

export function licensePage(root = new URL('../', import.meta.url)) {
  const md = readFileSync(new URL('LICENSE.md', root), 'utf8');
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>License · Raza Perfume</title>
  <meta name="description" content="Website License Agreement between Webzoo Innovation and Raza Perfume." />
  <link rel="icon" type="image/png" href="/icons/icon-32.png" />
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400&family=Jost:wght@300;400;500&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #070504; color: #d9cdb6; font: 300 15.5px/1.75 'Jost', system-ui, sans-serif; }
    main { max-width: 820px; margin: 0 auto; padding: 72px 24px 96px; }
    .back { display: inline-block; margin-bottom: 40px; font-size: 11px; letter-spacing: .3em; text-transform: uppercase; color: #c9a45c; text-decoration: none; }
    h1 { font: 400 clamp(28px, 5vw, 42px)/1.2 'Cinzel', serif; letter-spacing: .12em; text-transform: uppercase; color: #ecd49a; margin: 0 0 8px; }
    h2 { font: 400 17px/1.4 'Cinzel', serif; letter-spacing: .14em; text-transform: uppercase; color: #ecd49a; margin: 44px 0 12px; }
    strong { font-weight: 500; color: #f0e3c8; }
    a { color: #c9a45c; }
    hr { border: 0; border-top: 1px solid rgba(201,164,92,.25); margin: 36px 0; }
    ul { padding-left: 20px; }
    table { width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 12px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid rgba(201,164,92,.18); vertical-align: top; }
    th { font-weight: 500; color: #ecd49a; font-size: 12px; letter-spacing: .12em; text-transform: uppercase; }
    @media print { body { background: #fff; color: #111; } h1, h2, th, strong { color: #111; } .back { display: none; } }
  </style>
</head>
<body>
  <main>
    <a class="back" href="/">← Raza Perfume</a>
${markdownToHtml(md)}
  </main>
</body>
</html>
`;
}
