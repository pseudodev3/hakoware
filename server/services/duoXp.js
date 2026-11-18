const duoStateFromXP = (xp = 0) => {
  const safeXP = Math.max(0, Number(xp) || 0);
  const level = Math.max(1, Math.floor(Math.sqrt(safeXP / 50)) + 1);
  const floorXP = 50 * Math.pow(level - 1, 2);
  const nextXP = 50 * Math.pow(level, 2);
  const progress = nextXP === floorXP ? 100 : Math.round(((safeXP - floorXP) / (nextXP - floorXP)) * 100);
  let title = 'New Contract';
  if (level >= 50) title = 'Legendary Duo';
  else if (level >= 25) title = 'Unbreakable Contract';
  else if (level >= 15) title = 'Habitual Enablers';
  else if (level >= 10) title = 'Certified Menaces';
  else if (level >= 5) title = 'Partners in Crime';
  else if (level >= 3) title = 'Locked In';
  return { xp: safeXP, level, title, progress, nextLevelXP: nextXP };
};

module.exports = { duoStateFromXP };
