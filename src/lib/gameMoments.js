export const showGameMoment = ({ userId, contractId, eventId, type, milestone, automatic = false }) => {
  if (automatic && (document.visibilityState !== 'visible' || document.querySelector('[role="dialog"][aria-modal="true"]'))) return;
  window.dispatchEvent(new CustomEvent('hakoware-game-moment', { detail: { userId: String(userId), contractId: String(contractId), eventId, type, milestone, automatic } }));
};
