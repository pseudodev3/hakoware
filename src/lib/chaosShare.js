import { drawHakowareStamp } from './shareStamp';

const RED = '#ff747b';
const PAPER = '#f7f4ec';
const MUTED = '#777268';
const BG = '#090908';

const fitFont = (ctx, text, maxWidth, startSize, minSize = 32, weight = 700, family = 'system-ui, -apple-system, sans-serif') => {
  let size = startSize;
  while (size > minSize) {
    ctx.font = `${weight} ${size}px ${family}`;
    if (ctx.measureText(String(text || '')).width <= maxWidth) break;
    size -= 2;
  }
  return size;
};

const wrapLines = (ctx, text, maxWidth) => {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';

  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }

  if (line) lines.push(line);
  return lines;
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

const drawOrbit = (ctx, x, y, rx, ry, rotation, alpha) => {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.strokeStyle = `rgba(255,116,123,${alpha})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

export const buildChaosShareImage = async ({
  eventName,
  rule,
  targetLabel,
  timeLeft,
  partnerName,
  seasonNumber = 1,
  duoLevel = 1,
  duoTitle = 'New Contract'
}) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1080;
  canvas.height = 1350;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not create Chaos share image');

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(950, 170, 0, 950, 170, 700);
  glow.addColorStop(0, 'rgba(255,116,123,.22)');
  glow.addColorStop(1, 'rgba(255,116,123,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawOrbit(ctx, 980, 230, 430, 160, -0.22, 0.30);
  drawOrbit(ctx, 70, 1120, 520, 190, 0.18, 0.15);
  drawOrbit(ctx, 900, 1100, 610, 240, -0.08, 0.09);

  await drawHakowareStamp(ctx, {
    x: 872,
    y: 264,
    radius: 126,
    tint: RED,
    opacity: 0.13,
    rotation: 0.09,
    footer: 'CONTRACT SYSTEM'
  });

  ctx.fillStyle = RED;
  ctx.font = '700 25px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('HAKOWARE CHAOS CARD', 82, 98);

  ctx.fillStyle = MUTED;
  ctx.font = '600 20px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(`SEASON ${seasonNumber} · ANOMALY LIVE`, 82, 142);

  const title = String(eventName || 'Chaos Anomaly');
  const titleSize = fitFont(ctx, title, 900, 88, 48);
  ctx.fillStyle = PAPER;
  ctx.font = `700 ${titleSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(title, 82, 286);

  ctx.fillStyle = RED;
  ctx.font = '650 27px system-ui, -apple-system, sans-serif';
  ctx.fillText('Rules changed. Deal with it.', 82, 346);

  roundedRect(ctx, 82, 430, 916, 270, 34);
  ctx.fillStyle = 'rgba(247,244,236,.035)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,116,123,.18)';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const stats = [
    ['TARGET', String(targetLabel || 'Your move').toUpperCase()],
    ['TIME LEFT', String(timeLeft || 'Live').toUpperCase()],
    ['DUO LEVEL', String(duoLevel || 1)]
  ];

  stats.forEach(([label, value], index) => {
    const x = 124 + index * 292;
    ctx.fillStyle = MUTED;
    ctx.font = '700 18px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.fillText(label, x, 502);

    const isLevel = index === 2;
    const size = fitFont(
      ctx,
      value,
      index === 0 ? 220 : 180,
      isLevel ? 62 : 36,
      25,
      700,
      isLevel ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'system-ui, -apple-system, sans-serif'
    );
    ctx.fillStyle = index === 1 ? RED : PAPER;
    ctx.font = `700 ${size}px ${isLevel ? 'ui-monospace, SFMono-Regular, Menlo, monospace' : 'system-ui, -apple-system, sans-serif'}`;
    ctx.fillText(value, x, 594);
  });

  ctx.strokeStyle = 'rgba(247,244,236,.08)';
  ctx.beginPath();
  ctx.moveTo(82, 814);
  ctx.lineTo(998, 814);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = '700 18px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('CURRENT RULE', 82, 882);

  ctx.fillStyle = PAPER;
  let ruleSize = 44;
  ctx.font = `650 ${ruleSize}px system-ui, -apple-system, sans-serif`;
  let ruleLines = wrapLines(ctx, rule, 890);
  if (ruleLines.length > 3) {
    ruleSize = 36;
    ctx.font = `650 ${ruleSize}px system-ui, -apple-system, sans-serif`;
    ruleLines = wrapLines(ctx, rule, 890);
  }
  let ruleY = 956;
  const ruleLineHeight = ruleSize + 11;
  ruleLines.slice(0, 3).forEach((line) => {
    ctx.fillText(line, 82, ruleY);
    ruleY += ruleLineHeight;
  });

  const duoLineY = 1158;
  ctx.fillStyle = MUTED;
  ctx.font = '600 22px system-ui, -apple-system, sans-serif';
  ctx.fillText(`You × ${partnerName || 'contract partner'}`, 82, duoLineY);

  const duoText = `Duo Lv. ${duoLevel} · ${duoTitle || 'New Contract'}`;
  const duoSize = fitFont(ctx, duoText, 820, 29, 22, 650);
  ctx.fillStyle = PAPER;
  ctx.font = `650 ${duoSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillText(duoText, 82, duoLineY + 48);

  ctx.fillStyle = RED;
  ctx.font = '700 20px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('RULES MAY CHANGE MID-SEASON', 82, 1270);

  ctx.fillStyle = MUTED;
  ctx.font = '600 20px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('hakoware.vercel.app', 998, 1270);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Could not create Chaos share image')),
      'image/png'
    );
  });
};
