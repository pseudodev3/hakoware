import { createShareCanvas, shareBlob, shareCover, shareFooter, shareNumber, shareRule, textBlock, textLine } from './shareCanvas';

export const buildChaosShareImage = async ({ eventName, rule, targetLabel, timeLeft, partnerName, seasonNumber = 1, duoLevel = 1, duoTitle = 'New Contract' }) => {
  const { canvas, ctx, ink, muted, accent } = await createShareCanvas({ label: 'CHAOS', background: '#221917', accent: '#ffb09b', muted: '#c4ada4' });
  shareCover(ctx, 'rays', accent, { opacity: .11, bottom: 620 });
  textLine(ctx, `SEASON ${shareNumber(seasonNumber)} · RULES CHANGED`, 76, 231, 928, { size: 22, weight: 650, color: accent });
  textBlock(ctx, eventName || 'Chaos arrived.', 76, 354, 928, { size: 108, min: 56, lines: 2 });
  textLine(ctx, 'A little pressure. A shared story.', 76, 563, 928, { size: 29, color: muted });
  shareRule(ctx, 628, muted);
  textLine(ctx, 'THE CHALLENGE', 76, 692, 928, { size: 22, weight: 650, color: accent });
  textBlock(ctx, rule || 'Open your contract to see the current rule.', 76, 768, 928, { size: 43, min: 30, weight: 550, lines: 4, leading: 1.25, color: ink });
  shareRule(ctx, 983, muted);
  textLine(ctx, targetLabel || 'Your move', 76, 1044, 430, { size: 29, min: 22, weight: 650, color: ink });
  textLine(ctx, `Snapshot · ${timeLeft || 'time not recorded'}`, 1004, 1044, 470, { size: 25, min: 22, color: accent, align: 'right' });
  textLine(ctx, `You + ${partnerName || 'your partner'}`, 76, 1122, 928, { size: 28, min: 22, color: ink });
  textLine(ctx, `Duo Lv. ${shareNumber(duoLevel)} · ${duoTitle || 'New Contract'}`, 76, 1166, 928, { size: 24, min: 20, color: muted });
  shareFooter(ctx, { ink, muted, note: 'Your next move matters.' });
  return shareBlob(canvas);
};
