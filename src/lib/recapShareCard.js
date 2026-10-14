import { createShareCanvas, shareBlob, shareCover, shareFooter, shareNumber, sharePalette, shareRule, shareText, textBlock, textLine } from './shareCanvas';

export const seasonGrade = recap => {
  if (!recap?.season || !recap?.template) return '–';
  const length = Number(recap.template.seasonDays || recap.season.lengthDays || 30);
  const expected = Math.max(2, Math.ceil(length / Math.max(1, Number(recap.template.limit) || 3)) * 2);
  const ratio = Math.max(0, (recap.season.checkins || 0) / expected - (recap.season.chaosFailed || 0) * .04);
  return ratio >= .95 ? 'S' : ratio >= .8 ? 'A' : ratio >= .62 ? 'B' : ratio >= .45 ? 'C' : 'D';
};

export const recapText = (recap, period = 'week', duoName = '') => {
  const names = (recap.players || []).map(player => player.displayName).filter(Boolean).join(' + ');
  const summary = (period === 'season' ? recap.season : recap.weekly) || {};
  return [
    `Hakoware · ${period === 'season' ? 'Season' : 'Weekly'} recap`,
    ...(duoName ? [shareText(duoName)] : []), shareText(names),
    `${summary.checkins || 0} check-ins · ${summary.voiceNotes || 0} voice`,
    `${summary.chaosSurvived || 0} chaos survived · ${summary.chaosFailed || 0} failed`,
    `+${summary.xpGained || 0} Duo XP · Duo Lv. ${recap.duo?.level || 1}`,
    period === 'season' ? `Season ${recap.season?.number || 1} · ${recap.season?.status?.toLowerCase() || 'active'}` : shareText(recap.weekly?.line || 'Still showing up.')
  ].filter(Boolean).join('\n');
};

export const buildRecapShareCard = async (recap, period = 'week', identity = {}) => {
  const season = period === 'season', complete = recap.season?.status === 'COMPLETE';
  const palette = sharePalette(identity.palette);
  const { canvas, ctx, ink, muted, accent } = await createShareCanvas(season
    ? { label: 'SEASON RECAP', accent: palette.color }
    : { label: 'THIS WEEK', background: '#f0eee4', ink: '#202c25', muted: '#58655d', accent: palette.ink });
  shareCover(ctx, identity.cover, accent, { opacity: season ? .12 : .07, bottom: 890 });
  const names = (recap.players || []).map(player => player.displayName).filter(Boolean).join(' + ') || 'Our Hakoware Duo';
  textBlock(ctx, identity.name || names, 76, 255, 928, { size: 46, min: 32, lines: 2, color: ink });
  textLine(ctx, `Season ${shareNumber(recap.season?.number || 1)} · ${recap.template?.name || 'Our contract'}`, 76, 359, 928, { size: 24, min: 20, color: muted });
  const summary = (season ? recap.season : recap.weekly) || {};
  textLine(ctx, season ? (complete ? 'A season, together.' : 'The story so far.') : 'We showed up.', 76, 466, 928, { size: 57, min: 36, weight: 750, color: ink });
  textLine(ctx, shareNumber(summary.checkins), 65, 716, season ? 620 : 928, { size: 246, min: 84, weight: 750, color: accent });
  textLine(ctx, 'CHECK-INS', 76, 779, 500, { size: 25, weight: 650, color: muted });
  if (season) {
    textLine(ctx, seasonGrade(recap), 1004, 694, 245, { size: 160, weight: 750, color: accent, align: 'right' });
    textLine(ctx, complete ? 'FINAL GRADE' : 'GRADE SO FAR', 1004, 779, 280, { size: 22, weight: 650, color: muted, align: 'right' });
  }
  shareRule(ctx, 849, muted);
  const metrics = [['VOICE NOTES', shareNumber(summary.voiceNotes)], ['CHAOS CLEARED', shareNumber(summary.chaosSurvived)], ['DUO XP', `+${shareNumber(summary.xpGained)}`]];
  metrics.forEach(([label, value], index) => {
    const x = 76 + index * 320;
    textLine(ctx, label, x, 914, 285, { size: 20, weight: 650, color: muted });
    textLine(ctx, value, x, 980, 285, { size: 54, min: 28, weight: 750, color: ink });
  });
  textLine(ctx, `Duo Lv. ${shareNumber(recap.duo?.level || 1)} · ${recap.duo?.title || 'Just getting started'}`, 76, 1070, 928, { size: 25, min: 22, weight: 650, color: accent });
  const line = season ? (complete ? 'A shared win. Keep the next chapter open.' : 'One check-in at a time.') : summary.line || 'Closer than we were last week.';
  textBlock(ctx, line, 76, 1131, 928, { size: 29, min: 23, weight: 500, lines: 2, color: ink });
  shareFooter(ctx, { ink, muted, note: season ? 'A friendship worth showing up for.' : 'Small moments. Closer friends.' });
  return shareBlob(canvas);
};
