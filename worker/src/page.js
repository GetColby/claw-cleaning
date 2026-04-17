function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderInline(text) {
  let out = escapeHtml(text);
  out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
  out = out.replace(/\*\*([^*]+)\*\*/g, (_, c) => `<strong>${c}</strong>`);
  out = out.replace(/\*([^*]+)\*/g, (_, c) => `<em>${c}</em>`);
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, h) => `<a href="${h}">${t}</a>`);
  return out;
}

export function markdownToHtml(md) {
  const lines = md.split('\n');
  const out = [];
  let inList = false;
  let inCode = false;
  let para = [];
  let codeBuf = [];

  const flushPara = () => {
    if (para.length) {
      out.push(`<p>${renderInline(para.join(' '))}</p>`);
      para = [];
    }
  };
  const closeList = () => {
    if (inList) { out.push(inList === 'ol' ? '</ol>' : '</ul>'); inList = false; }
  };

  for (const line of lines) {
    if (line.startsWith('```')) {
      flushPara(); closeList();
      if (inCode) {
        out.push(`<pre><code>${codeBuf.join('\n')}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        inCode = true;
      }
      continue;
    }
    if (inCode) { codeBuf.push(escapeHtml(line)); continue; }

    if (/^---\s*$/.test(line)) { flushPara(); closeList(); out.push('<hr>'); continue; }

    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      flushPara(); closeList();
      const level = h[1].length;
      out.push(`<h${level}>${renderInline(h[2])}</h${level}>`);
      continue;
    }

    const li = line.match(/^-\s+(.*)$/);
    if (li) {
      flushPara();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${renderInline(li[1])}</li>`);
      continue;
    }

    const oli = line.match(/^\d+\.\s+(.*)$/);
    if (oli) {
      flushPara();
      if (!inList) { out.push('<ol>'); inList = 'ol'; }
      out.push(`<li>${renderInline(oli[1])}</li>`);
      continue;
    }

    if (line.trim() === '') { flushPara(); closeList(); continue; }

    para.push(line);
  }
  flushPara();
  if (inList) out.push(inList === 'ol' ? '</ol>' : '</ul>');
  if (inCode) out.push(`<pre><code>${codeBuf.join('\n')}</code></pre>`);
  return out.join('\n');
}

export function pageHtml({ title, description, markdownPath, markdown }) {
  const body = markdownToHtml(markdown);
  const descMeta = description ? `<meta name="description" content="${escapeHtml(description)}">` : '';
  const altLink = markdownPath ? `<link rel="alternate" type="text/markdown" href="${markdownPath}">` : '';
  const ogImage = 'https://claw.cleaning/assets/icon.svg';
  const ogMeta = `<meta property="og:title" content="${escapeHtml(title)}">
${description ? `<meta property="og:description" content="${escapeHtml(description)}">` : ''}
<meta property="og:image" content="${ogImage}">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${ogImage}">`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)}</title>
${descMeta}
${ogMeta}
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
${altLink}
<style>
  :root { color-scheme: light dark; }
  body { font: 16px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 720px; margin: 40px auto; padding: 0 20px; color: #1a1a1a; background: #fafafa; }
  h1 { font-size: 2em; margin-top: 0; }
  h2 { margin-top: 2em; border-bottom: 1px solid #e5e5e5; padding-bottom: 0.3em; }
  h3 { margin-top: 1.5em; }
  a { color: #0366d6; }
  code { background: #f0f0f0; padding: 2px 5px; border-radius: 3px; font-size: 0.9em; }
  pre { background: #f0f0f0; padding: 14px; border-radius: 6px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  hr { border: none; border-top: 1px solid #e5e5e5; margin: 2em 0; }
  ul, ol { padding-left: 1.5em; }
  li { margin: 0.3em 0; }
  nav.site { font-size: 0.9em; color: #666; margin-bottom: 2em; }
  nav.site a { margin-right: 1em; }
  footer.site { font-size: 0.9em; color: #666; margin-top: 3em; }
  footer.site p { margin: 0.5em 0; }
  @media (prefers-color-scheme: dark) {
    body { background: #161616; color: #e6e6e6; }
    code, pre { background: #262626; }
    h2 { border-color: #333; }
    hr { border-color: #333; }
    a { color: #58a6ff; }
    nav.site { color: #999; }
  }
</style>
</head>
<body>
<nav class="site"><a href="/">Home</a><a href="/privacy">Privacy Policy</a></nav>
${body}
<footer class="site">
  <hr>
  <p><a href="/">Home</a> · <a href="/privacy">Privacy Policy</a> · <a href="mailto:connor@getcolby.com">Contact</a></p>
</footer>
</body>
</html>`;
}
