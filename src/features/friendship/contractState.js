import { calculateDebt } from '../../hooks/useDebt';

const entityId = (value) => String(value?._id || value?.id || value || '');

export const getContractSides = (friendship, currentUserId, now = new Date()) => {
  if (!friendship) {
    return {
      isUser1: false,
      partner: null,
      ownPerspective: null,
      partnerPerspective: null,
      ownDebt: null,
      partnerDebt: null
    };
  }

  const isUser1 = entityId(friendship.user1) === entityId(currentUserId);
  const partner = isUser1 ? friendship.user2 : friendship.user1;
  const ownPerspective = isUser1 ? friendship.user1Perspective : friendship.user2Perspective;
  const partnerPerspective = isUser1 ? friendship.user2Perspective : friendship.user1Perspective;

  return {
    isUser1,
    partner,
    ownPerspective,
    partnerPerspective,
    ownDebt: calculateDebt(ownPerspective, now),
    partnerDebt: calculateDebt(partnerPerspective, now)
  };
};

export const getBankruptPartner = (friendship, currentUserId, now = new Date()) => {
  if (friendship?.season?.status !== 'ACTIVE') return null;
  const sides = getContractSides(friendship, currentUserId, now);
  if (!sides.partnerDebt?.isBankrupt) return null;

  return {
    friendship,
    partner: sides.partner,
    debt: sides.partnerDebt
  };
};

export const canCheckin = (friendship, userId, now = Date.now()) => {
  if (!friendship || friendship.status !== 'ACTIVE' || friendship.season?.status === 'COMPLETE') return false;
  const { ownPerspective } = getContractSides(friendship, userId);
  if (!ownPerspective) return false;
  const start = new Date(friendship.season?.startedAt || 0).getTime();
  const last = new Date(ownPerspective.lastInteraction || 0).getTime();
  return !(start > 0 ? last > start : last > 0) || now - last >= 20 * 60 * 60 * 1000;
};

export const friendSummary = (friendship, userId) => {
  const { partner, ownDebt, partnerDebt } = getContractSides(friendship, userId);
  const name = partner?.displayName || 'Your friend';
  if (friendship.season?.status === 'COMPLETE') return { label: 'Season complete', detail: 'Your shared recap is ready.', tone: 'gold', needsAction: true };
  if (ownDebt?.isBankrupt) return { label: 'Recovery needed', detail: 'Check in to start recovery. One more clean check-in follows.', tone: 'danger', needsAction: true };
  if (partnerDebt?.isBankrupt) return { label: `${name} is bankrupt`, detail: 'Their recovery and bounty are in Arena.', tone: 'danger', needsAction: true };
  if (friendship.chaos?.wantedUserId && friendship.chaos?.wantedUntil) {
    const own = String(friendship.chaos.wantedUserId) === String(userId);
    const most = new Date(friendship.chaos.wantedUntil).getTime() <= Date.now();
    return { label: `${own ? 'You are' : name + ' is'} ${most ? 'Most Wanted' : 'Wanted'}`, detail: `${own ? 'Check in' : 'They need to check in'} to escape. The bounty is in Arena.`, tone: 'danger', needsAction: true };
  }
  if (friendship.chaos?.activeEvent) return { label: friendship.chaos.activeEvent.name, detail: friendship.chaos.activeEvent.description, tone: 'danger', needsAction: true };
  if (ownDebt?.isRecovering) return { label: 'Recovering', detail: 'One clean check-in completes your recovery.', tone: 'gold', needsAction: true };
  if (ownDebt?.totalDebt > 0) return { label: `${ownDebt.totalDebt} debt`, detail: 'Your next check-in clears it.', tone: 'gold', needsAction: true };
  if (partnerDebt?.isRecovering) return { label: `${name} is recovering`, detail: 'They have one clean check-in left.', tone: 'gold', needsAction: true };
  const days = Math.max(0, (ownDebt?.limit || 7) - (ownDebt?.daysMissed || 0));
  if (days <= 1) return { label: 'Check-in due soon', detail: 'Stay in touch before debt starts.', tone: 'gold', needsAction: true };
  return { label: 'On track', detail: 'Your contract is clear.', tone: 'good', needsAction: false };
};
