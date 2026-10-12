const WINDOW_MS = 20 * 60 * 60 * 1000;
const FIRST_DAYS_MS = 72 * 60 * 60 * 1000;
const id = value => String(value?._id || value?.id || value || '');
const time = value => value && Number.isFinite(new Date(value).getTime()) ? new Date(value).getTime() : null;
const checkedAfter = (value, start, now) => {
  const timestamp = time(value);
  return timestamp > start && timestamp <= now;
};

// Season-start timestamps are baselines, not completed check-ins.
export const getNextMove = (friendships, userId, social = {}, now = Date.now()) => {
  const contracts = friendships.filter(contract => contract.status === 'ACTIVE');
  const sides = contract => {
    const isFirst = id(contract.user1) === id(userId);
    return {
      partner: isFirst ? contract.user2 : contract.user1,
      own: isFirst ? contract.user1Perspective : contract.user2Perspective,
      other: isFirst ? contract.user2Perspective : contract.user1Perspective,
    };
  };
  const first = contracts.find(contract => {
    const started = time(contract.season?.startedAt);
    if (contract.season?.status !== 'ACTIVE' || Number(contract.season?.number) !== 1 || !started || now < started || now - started > FIRST_DAYS_MS) return false;
    if (contract.chaos?.activeEvent) return false;
    const { own, other } = sides(contract);
    return own && other && !(checkedAfter(own.lastInteraction, started, now) && checkedAfter(other.lastInteraction, started, now));
  });
  if (first) {
    const { own, other, partner } = sides(first);
    const started = time(first.season.startedAt);
    return { kind: 'first', contract: first, partner, ownDone: checkedAfter(own.lastInteraction, started, now), partnerDone: checkedAfter(other.lastInteraction, started, now) };
  }
  for (const contract of contracts) {
    const message = social[id(contract)]?.unseenActivity?.find(item => item.type === 'MESSAGE');
    if (message) return { kind: 'reply', contract, partner: sides(contract).partner, eventId: message.id };
  }
  const recap = contracts.find(contract => contract.season?.status === 'COMPLETE');
  if (recap) return { kind: 'recap', contract: recap, partner: sides(recap).partner };
  const moment = contracts.find(contract => social[id(contract)]?.moment?.status === 'OPEN');
  if (moment) return { kind: 'moment', contract: moment, partner: sides(moment).partner };
  const next = contracts.filter(contract => contract.season?.status === 'ACTIVE' && !contract.chaos?.activeEvent).map(contract => {
    const { own, partner } = sides(contract);
    const started = time(contract.season?.startedAt);
    const last = time(own?.lastInteraction);
    if (!own || !started || !last || started > now || last > now) return null;
    return { contract, partner, at: last > started ? last + WINDOW_MS : now };
  }).filter(Boolean).sort((a, b) => a.at - b.at)[0];
  return next ? { ...next, kind: next.at > now ? 'later' : 'ready' } : null;
};
