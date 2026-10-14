import { createShareCanvas, shareBlob, shareCover, shareFooter, shareNumber, sharePalette, shareRule, textBlock, textLine } from './shareCanvas';

export const buildDuoShareCard = async ({ userName, partnerName, duoLevel = 1, duoTitle = 'New Contract', duoXP = 0, templateName = 'Contract', seasonNumber = 1, seasonStatus = 'ACTIVE', duoName = '', palette = 'citron', cover = 'orbits' }) => {
  const { color } = sharePalette(palette);
  const { canvas, ctx, ink, muted, accent } = await createShareCanvas({ label: 'OUR DUO', accent: color });
  shareCover(ctx, cover, accent, { opacity: .13 });
  textLine(ctx, `SEASON ${shareNumber(seasonNumber)}`, 76, 230, 928, { size: 22, weight: 600, color: muted });
  const names = `${userName || 'Player'} + ${partnerName || 'Partner'}`;
  textBlock(ctx, duoName || names, 76, 344, 928, { size: 90, min: 48, lines: 2 });
  if (duoName) textLine(ctx, names, 76, 496, 928, { size: 27, min: 22, color: muted });
  textLine(ctx, 'DUO LEVEL', 76, 602, 500, { size: 23, weight: 650, color: accent });
  textLine(ctx, shareNumber(duoLevel), 65, 826, 928, { size: 248, min: 96, weight: 750, color: accent });
  textLine(ctx, duoTitle && duoTitle !== 'New Contract' ? duoTitle : 'Just getting started.', 76, 897, 928, { size: 38, min: 28, weight: 650, color: ink });
  shareRule(ctx, 955, muted);
  textLine(ctx, `${shareNumber(duoXP)} Duo XP`, 76, 1019, 420, { size: 31, weight: 650, color: ink });
  textLine(ctx, templateName, 1004, 1019, 455, { size: 27, min: 22, color: muted, align: 'right' });
  textLine(ctx, seasonStatus === 'COMPLETE' ? `Season ${shareNumber(seasonNumber)} complete. A shared win.` : 'Still showing up for each other.', 76, 1120, 928, { size: 34, min: 24, weight: 600, color: ink });
  shareFooter(ctx, { ink, muted });
  return shareBlob(canvas);
};
