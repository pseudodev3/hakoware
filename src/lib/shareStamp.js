let markPromise;

const loadHakowareMark = () => {
  if (!markPromise) {
    markPromise = new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => resolve(null);
      image.src = '/hakoware-mark-v2.png';
    });
  }
  return markPromise;
};

const drawSpacedText = (ctx, text, centerX, y, spacing) => {
  const chars = [...String(text || '')];
  if (!chars.length) return;

  const widths = chars.map((char) => ctx.measureText(char).width);
  const totalWidth = widths.reduce((sum, width) => sum + width, 0) + spacing * Math.max(0, chars.length - 1);
  let x = centerX - totalWidth / 2;

  chars.forEach((char, index) => {
    ctx.fillText(char, x, y);
    x += widths[index] + spacing;
  });
};

const tintedMark = (image, size, tint) => {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const markCtx = canvas.getContext('2d');
  if (!markCtx) return null;

  markCtx.drawImage(image, 0, 0, size, size);
  markCtx.globalCompositeOperation = 'source-in';
  markCtx.fillStyle = tint;
  markCtx.fillRect(0, 0, size, size);
  markCtx.globalCompositeOperation = 'source-over';
  return canvas;
};

export const drawHakowareStamp = async (ctx, {
  x,
  y,
  radius = 128,
  tint = '#e7b35a',
  opacity = 0.13,
  rotation = -0.08,
  footer = 'CONTRACT SYSTEM'
} = {}) => {
  if (!ctx || !Number.isFinite(x) || !Number.isFinite(y)) return;

  const image = await loadHakowareMark();
  const markSize = Math.round(radius * 0.82);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = tint;
  ctx.fillStyle = tint;
  ctx.lineCap = 'round';

  ctx.lineWidth = Math.max(2, radius * 0.025);
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = Math.max(1, radius * 0.012);
  ctx.beginPath();
  ctx.arc(0, 0, radius * 0.83, 0, Math.PI * 2);
  ctx.stroke();

  ctx.font = `800 ${Math.round(radius * 0.145)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.textBaseline = 'middle';
  drawSpacedText(ctx, 'HAKOWARE', 0, -radius * 0.58, radius * 0.025);

  ctx.font = `700 ${Math.round(radius * 0.082)}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  drawSpacedText(ctx, footer, 0, radius * 0.61, radius * 0.012);

  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(side * radius * 0.65, radius * 0.02, Math.max(2, radius * 0.025), 0, Math.PI * 2);
    ctx.fill();
  }

  if (image) {
    const mark = tintedMark(image, markSize, tint);
    if (mark) {
      ctx.globalAlpha = Math.min(1, opacity * 1.25);
      ctx.drawImage(mark, -markSize / 2, -markSize / 2, markSize, markSize);
    }
  } else {
    ctx.globalAlpha = Math.min(1, opacity * 1.2);
    ctx.font = `800 ${Math.round(radius * 0.62)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('H', 0, radius * 0.03);
  }

  ctx.restore();
};
