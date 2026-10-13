import { drawHakowareStamp } from './shareStamp';
import { DUO_PALETTES } from './duoIdentity';

const GOLD = '#e7b35a';
const PAPER = '#f7f4ec';
const MUTED = '#777268';
const BG = '#090908';

const fitFont = (ctx, text, maxWidth, startSize, minSize = 34, weight = 700, family = 'system-ui, -apple-system, sans-serif') => {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 2;
  }
  return size;
};

const roundedRect = (ctx, x, y, width, height, radius) => {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
};

const drawOrbit = (ctx, x, y, rx, ry, rotation, alpha, accent = GOLD) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = accent;
  ctx.globalAlpha = alpha;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

export const buildDuoShareCard = async ({
  userName,
  partnerName,
  duoLevel = 1,
  duoTitle = 'New Contract',
  duoXP = 0,
  templateName = 'Contract',
  seasonNumber = 1,
  seasonStatus = 'ACTIVE',
  duoName = '',
  palette = 'citron',
  cover = 'orbits'
}) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create Duo card');
  const accent = DUO_PALETTES[palette]?.color || GOLD;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(950, 180, 0, 950, 180, 700);
  glow.addColorStop(0, 'rgba(231,179,90,.18)');
  glow.addColorStop(1, 'rgba(231,179,90,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (cover === 'rays') {
    ctx.save(); ctx.strokeStyle = accent; ctx.globalAlpha = .2; ctx.translate(890, 260);
    for (let index = 0; index < 24; index += 1) { ctx.rotate(Math.PI/12); ctx.beginPath(); ctx.moveTo(100,0); ctx.lineTo(700,0); ctx.stroke(); } ctx.restore();
  } else if (cover === 'waves') {
    ctx.save(); ctx.strokeStyle = accent; ctx.globalAlpha = .2;
    for (let index = 0; index < 8; index += 1) { ctx.beginPath(); ctx.moveTo(500,index*50); ctx.bezierCurveTo(660,index*50+210,950,index*50-120,1160,index*50+180); ctx.stroke(); } ctx.restore();
  } else {
    drawOrbit(ctx, 980, 230, 430, 160, -0.22, 0.28, accent);
    drawOrbit(ctx, 80, 1120, 520, 190, 0.18, 0.14, accent);
    drawOrbit(ctx, 880, 1080, 610, 240, -0.08, 0.08, accent);
  }

  await drawHakowareStamp(ctx, {
    x: 872,
    y: 264,
    radius: 126,
    tint: accent,
    opacity: 0.12,
    rotation: -0.1,
    footer: 'CONTRACT SYSTEM'
  });

  ctx.fillStyle = accent;
  ctx.font = '700 25px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('HAKOWARE // DUO CARD', 82, 98);

  ctx.fillStyle = MUTED;
  ctx.font = '600 20px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText(`SEASON ${seasonNumber}`, 82, 142);

  const names = `${userName || 'Player'} × ${partnerName || 'Partner'}`;
  const headline = duoName || names;
  const nameSize = fitFont(ctx, headline, 900, 82, 34);
  ctx.fillStyle = PAPER;
  ctx.font = `700 ${nameSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(headline, 82, 292);

  ctx.fillStyle = accent;
  ctx.font = '650 34px system-ui, -apple-system, sans-serif';
  ctx.fillText(duoTitle && duoTitle !== 'New Contract' ? String(duoTitle) : 'Your shared story.', 82, 354);
  if (duoName) { ctx.fillStyle = MUTED; ctx.font = `500 ${fitFont(ctx, names, 900, 28, 18)}px system-ui, sans-serif`; ctx.fillText(names, 82, 405); }

  roundedRect(ctx, 82, 450, 916, 286, 34);
  ctx.fillStyle = 'rgba(247,244,236,.035)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(247,244,236,.10)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const stats = [
    ['DUO LEVEL', String(duoLevel || 1)],
    ['DUO XP', String(duoXP || 0)],
    ['MODE', String(templateName || 'Contract').toUpperCase()]
  ];

  stats.forEach(([label, value], index) => {
    const x = 124 + index * 292;
    ctx.fillStyle = MUTED;
    ctx.font = '700 18px ui-monospace, SFMono-Regular, monospace';
    ctx.fillText(label, x, 520);

    const max = index === 2 ? 220 : 180;
    const size = fitFont(ctx, value, max, index === 2 ? 34 : 62, 26, 700, index === 2 ? 'system-ui, -apple-system, sans-serif' : 'ui-monospace, SFMono-Regular, monospace');
    ctx.fillStyle = PAPER;
    ctx.font = `700 ${size}px ${index === 2 ? 'system-ui, -apple-system, sans-serif' : 'ui-monospace, SFMono-Regular, monospace'}`;
    ctx.fillText(value, x, 605);
  });

  ctx.strokeStyle = 'rgba(247,244,236,.08)';
  ctx.beginPath();
  ctx.moveTo(82, 842);
  ctx.lineTo(998, 842);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = '700 18px ui-monospace, SFMono-Regular, monospace';
  ctx.fillText('CURRENT STATUS', 82, 910);

  ctx.fillStyle = PAPER;
  ctx.font = '650 52px system-ui, -apple-system, sans-serif';
  ctx.fillText(seasonStatus === 'COMPLETE' ? `Season ${seasonNumber} complete.` : 'Still under contract.', 82, 988);

  ctx.fillStyle = accent;
  ctx.font = '650 24px system-ui, -apple-system, sans-serif';
  ctx.fillText('Keep the loop alive.', 82, 1044);

  ctx.fillStyle = MUTED;
  ctx.font = '600 21px system-ui, -apple-system, sans-serif';
  ctx.fillText(/^(localhost|127\.0\.0\.1)$/.test(window.location.hostname) ? 'hakoware' : window.location.host, 82, 1264);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not create Duo card')), 'image/png');
  });
};
