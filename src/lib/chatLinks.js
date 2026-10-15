// Plain text stays plain text. Only explicit web links become anchors.
export const messageParts = text => {
  const value = String(text || ''), parts = [];
  const pattern = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    let label = match[0].replace(/[.,!?:;]+$/, '');
    while (/[)\]}]$/.test(label)) {
      const close = label.at(-1), open = { ')': '(', ']': '[', '}': '{' }[close];
      if (label.split(close).length <= label.split(open).length) break;
      label = label.slice(0, -1);
    }
    let url;
    try { url = new URL(/^www\./i.test(label) ? `https://${label}` : label); } catch { continue; }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) continue;
    parts.push({ text: value.slice(cursor, match.index) }, { text: label, href: url.href });
    cursor = match.index + label.length;
  }
  parts.push({ text: value.slice(cursor) });
  return parts;
};
