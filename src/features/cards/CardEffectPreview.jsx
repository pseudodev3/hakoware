import { ArrowRight } from 'lucide-react';
import { getContractSides } from '../friendship/contractState';
export const CardEffectPreview = ({ card, friendships, userId }) => {
  const debt = friendships.reduce((total, contract) => total + (getContractSides(contract, userId).ownDebt?.totalDebt || 0), 0);
  const content = {
    PURIFY: { before: `${debt} day${debt === 1 ? '' : 's'} of contract debt`, after: 'A clean slate', note: 'Debt resets across your active contracts. Grace periods stay the same.' },
    STEAL: { before: 'A bankrupt partner', after: '10% of their Aura to you', note: 'An eligible partner is required. A seven-day Grudge follows.' },
    SIGNAL_FLARE: { before: 'A quiet contract', after: 'A very visible entrance', note: 'Your friend gets a private notice. Your name appears on the shared board. The recipient stays private; 48h cooldown.' },
    CHAOS_TICKET: { before: 'Waiting for Chaos', after: 'Roll for an anomaly now', note: 'An eligible Chaos Contract is required. The existing Chaos rules apply.' }
  }[card?.id];
  if (!content) return null;
  return <section className="card-effect-preview" aria-label="What this card does"><span>What changes</span><div><p>{content.before}</p><ArrowRight size={18} aria-hidden="true" /><strong>{content.after}</strong></div><small>{content.note}</small></section>;
};
