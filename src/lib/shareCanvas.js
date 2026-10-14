import { DUO_PALETTES } from './duoIdentity';
import { SITE_URL } from './siteSeo';

export const SHARE_WIDTH = 1080;
export const SHARE_HEIGHT = 1350;
const FAMILY = '"Public Sans", system-ui, -apple-system, sans-serif';
const graphemes = value => typeof Intl.Segmenter === 'function'
  ? [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(value)].map(item => item.segment)
  : Array.from(value);
export const shareText = value => String(value ?? '').replace(/\/{2,}/g, ' ').replace(/\s+/g, ' ').trim();
const font = (ctx, size, weight) => { ctx.font = `${weight} ${size}px ${FAMILY}`; };

export const ellipsize = (ctx, value, width) => {
  const text = shareText(value);
  if (ctx.measureText(text).width <= width) return text;
  const parts = graphemes(text);
  while (parts.length && ctx.measureText(parts.join('') + '…').width > width) parts.pop();
  return parts.length ? parts.join('').trimEnd() + '…' : '';
};

const wrap = (ctx, value, width) => {
  const lines = [];
  let line = '';
  for (const word of shareText(value).split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width) { line = next; continue; }
    if (line) { lines.push(line); line = ''; }
    for (const part of graphemes(word)) {
      if (line && ctx.measureText(line + part).width > width) { lines.push(line); line = ''; }
      line += part;
    }
  }
  if (line) lines.push(line);
  return lines;
};

export const textLine = (ctx, value, x, y, width, { size = 30, min = size, weight = 500, color = '#f5f2e9', align = 'left' } = {}) => {
  const text = shareText(value);
  let fitted = size;
  font(ctx, fitted, weight);
  while (fitted > min && ctx.measureText(text).width > width) { fitted -= 2; font(ctx, fitted, weight); }
  ctx.save(); ctx.fillStyle = color; ctx.textAlign = align;
  ctx.fillText(ellipsize(ctx, text, width), x, y); ctx.restore();
};

export const textBlock = (ctx, value, x, y, width, { size = 82, min = 44, weight = 700, color = '#f5f2e9', lines = 2, leading = 1.12 } = {}) => {
  let fitted = size; font(ctx, fitted, weight);
  let parts = wrap(ctx, value, width);
  while (parts.length > lines && fitted > min) { fitted -= 2; font(ctx, fitted, weight); parts = wrap(ctx, value, width); }
  if (parts.length > lines) parts = [...parts.slice(0, lines - 1), ellipsize(ctx, parts.slice(lines - 1).join(' '), width)];
  const metrics = parts.map(line => ctx.measureText(line));
  const advance = Math.max(fitted * leading, ...metrics.map(metric => metric.actualBoundingBoxAscent + metric.actualBoundingBoxDescent + fitted * .15));
  ctx.save(); ctx.fillStyle = color;
  parts.forEach((line, index) => ctx.fillText(line, x, y + index * advance)); ctx.restore();
  return parts.length * advance;
};

export const shareNumber = value => (Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0).toLocaleString('en-US');
export const sharePalette = palette => DUO_PALETTES[palette] || DUO_PALETTES.citron;
export const shareRule = (ctx, y, color, x = 76, width = 928) => {
  ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + width, y); ctx.stroke(); ctx.restore();
};

export const shareCover = (ctx, cover, accent, { opacity = .16, top = 170, bottom = 1160 } = {}) => {
  ctx.save(); ctx.beginPath(); ctx.rect(0, top, SHARE_WIDTH, bottom - top); ctx.clip();
  ctx.strokeStyle = accent; ctx.globalAlpha = opacity; ctx.lineWidth = 2;
  if (cover === 'rays') {
    ctx.translate(1000, 550);
    for (let index = 0; index < 24; index += 1) { ctx.rotate(Math.PI / 12); ctx.beginPath(); ctx.moveTo(140, 0); ctx.lineTo(1300, 0); ctx.stroke(); }
  } else if (cover === 'waves') {
    for (let index = 0; index < 12; index += 1) { ctx.beginPath(); ctx.moveTo(450, top + index * 90); ctx.bezierCurveTo(650, top + index * 90 - 250, 900, top + index * 90 + 300, 1300, top + index * 90 - 90); ctx.stroke(); }
  } else {
    ctx.translate(930, 565);
    for (const angle of [-.8, .1, .9]) { ctx.beginPath(); ctx.ellipse(0, 0, 460, 210, angle, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, 16, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
  }
  ctx.restore();
};

export const createShareCanvas = async ({ label, background = '#141b18', ink = '#f5f2e9', muted = '#aab5ae', accent = '#d9f779' }) => {
  if (document.fonts) {
    let timeout;
    await Promise.race([document.fonts.ready, new Promise(resolve => { timeout = setTimeout(resolve, 1200); })]);
    clearTimeout(timeout);
  }
  const canvas = document.createElement('canvas'); canvas.width = SHARE_WIDTH; canvas.height = SHARE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image sharing is unavailable in this browser');
  ctx.fillStyle = background; ctx.fillRect(0, 0, SHARE_WIDTH, SHARE_HEIGHT);
  textLine(ctx, 'Hakoware', 76, 106, 400, { size: 32, weight: 750, color: ink });
  textLine(ctx, label, 1004, 104, 450, { size: 22, weight: 600, color: accent, align: 'right' });
  shareRule(ctx, 151, muted);
  return { canvas, ctx, ink, muted, accent };
};

export const shareFooter = (ctx, { muted = '#aab5ae', ink = '#f5f2e9', note = 'Keep the loop alive.' } = {}) => {
  shareRule(ctx, 1220, muted);
  textLine(ctx, new URL(SITE_URL).host, 76, 1281, 340, { size: 24, weight: 650, color: ink });
  textLine(ctx, note, 1004, 1281, 540, { size: 23, color: muted, align: 'right' });
};

export const shareBlob = canvas => new Promise((resolve, reject) => {
  canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not create your share image')), 'image/png');
});
