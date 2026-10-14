export const duelResultCopy = (view, cards) => {
  if (!view.result) return '';
  const name = id => cards[id]?.name || 'their card';
  const last = view.moves.at(-1), partner = view.partner.displayName;
  if (view.result.reason === 'GUESS') return `${last?.actor === 'YOU' ? 'You' : partner} called ${name(last?.guess)}. The hidden card matched.`;
  if (view.result.reason === 'OATH_DISCARDED') {
    if (last?.cardId === 'OATH') return `${last.actor === 'YOU' ? 'You' : partner} played Oath. It wins only when you keep it hidden.`;
    return `${last?.target === 'YOU' ? 'Your' : `${partner}’s`} Oath was forced out by Clean Slate. Discarding it ends the round.`;
  }
  const you = cards[view.result.you[0]], other = cards[view.result.partner[0]];
  if (!you || !other) return 'The round is complete.';
  if (view.result.reason === 'DRAW') return `The deck ran out. You both held ${you.name}, rank ${you.rank}.`;
  return `The deck ran out. Your ${you.name} (${you.rank}) ${view.result.winner === 'YOU' ? 'beat' : 'lost to'} ${partner}’s ${other.name} (${other.rank}).`;
};
