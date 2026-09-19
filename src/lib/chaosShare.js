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

  ctx.fillStyle = '#0a0a09';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const glow = ctx.createRadialGradient(900, 160, 20, 900, 160, 620);
  glow.addColorStop(0, 'rgba(255, 92, 106, .26)');
  glow.addColorStop(.55, 'rgba(255, 92, 106, .07)');
  glow.addColorStop(1, 'rgba(255, 92, 106, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, 820);

  ctx.strokeStyle = 'rgba(255, 116, 123, .38)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 86);
  ctx.lineTo(1000, 86);
  ctx.stroke();

  ctx.fillStyle = '#ff747b';
  ctx.font = '700 25px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('HAKOWARE // CHAOS CONTRACT', 80, 145);

  ctx.fillStyle = '#8b8580';
  ctx.font = '650 23px system-ui, -apple-system, sans-serif';
  ctx.fillText(`SEASON ${seasonNumber} · ANOMALY LIVE`, 80, 198);

  ctx.fillStyle = '#f7f4ec';
  ctx.font = '700 86px system-ui, -apple-system, sans-serif';
  const titleLines = wrapLines(ctx, eventName, 900);
  titleLines.slice(0, 2).forEach((line, index) => ctx.fillText(line, 80, 340 + index * 96));

  const titleBottom = 340 + Math.max(0, Math.min(1, titleLines.length - 1)) * 96;

  ctx.fillStyle = '#c8c1b8';
  ctx.font = '560 43px system-ui, -apple-system, sans-serif';
  const ruleLines = wrapLines(ctx, rule, 875);
  let ruleY = titleBottom + 112;
  ruleLines.slice(0, 4).forEach((line) => {
    ctx.fillText(line, 80, ruleY);
    ruleY += 59;
  });

  const panelY = Math.max(760, ruleY + 38);
  roundedRect(ctx, 80, panelY, 920, 188, 28);
  ctx.fillStyle = 'rgba(255, 116, 123, .07)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 116, 123, .22)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#8b8580';
  ctx.font = '700 20px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('TARGET', 118, panelY + 58);
  ctx.fillText('TIME LEFT', 590, panelY + 58);

  ctx.fillStyle = '#f7f4ec';
  ctx.font = '680 39px system-ui, -apple-system, sans-serif';
  ctx.fillText(String(targetLabel || 'THE DUO').toUpperCase(), 118, panelY + 117);
  ctx.fillStyle = '#ff747b';
  ctx.fillText(String(timeLeft || 'LIVE').toUpperCase(), 590, panelY + 117);

  ctx.fillStyle = '#8b8580';
  ctx.font = '600 23px system-ui, -apple-system, sans-serif';
  ctx.fillText(`You × ${partnerName || 'contract partner'}`, 80, 1145);

  ctx.fillStyle = '#f7f4ec';
  ctx.font = '650 28px system-ui, -apple-system, sans-serif';
  ctx.fillText(`Duo Lv. ${duoLevel} · ${duoTitle}`, 80, 1192);

  ctx.fillStyle = '#ff747b';
  ctx.font = '700 22px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText('RULES MAY CHANGE MID-SEASON', 80, 1272);

  ctx.fillStyle = '#777268';
  ctx.font = '600 20px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('hakoware.vercel.app', 1000, 1272);
  ctx.textAlign = 'left';

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Could not create Chaos share image')),
      'image/png'
    );
  });
};
