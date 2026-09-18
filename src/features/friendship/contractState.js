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
