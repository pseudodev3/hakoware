import moments from '../../../server/config/auraMoments.json';
import { Coins } from 'lucide-react';

export const PlayRewards = ({ data, onPlay }) => <div className="play-rewards" aria-label="Earn Aura through play">
  <div className="play-rewards-copy"><h2><Coins size={19} strokeWidth={1.6} aria-hidden="true" />Play for Aura</h2><p><strong>+5</strong> finish · <strong>+5</strong> win · <strong>+2</strong> style</p></div>
  <div className="play-reward-progress"><div className="play-reward-dots" aria-hidden="true">{[0, 1, 2].map(value => <i key={value} className={value < (data?.rounds || 0) ? 'is-done' : ''} />)}</div><span>{data?.rounds || 0} of 3 rewarded today · {data?.earned || 0} Aura</span>{data?.resetsAt && <small>Resets at {new Date(data.resetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>}{onPlay && <button className="duel-text-action" type="button" onClick={onPlay}>Find a table</button>}</div>
  <details className="play-aura-guide"><summary>Reward rules &amp; Aura moments</summary><p>Play at least two turns and finish to qualify. Your first three qualifying rounds each day earn rewards. Leaving earns no Aura.</p><dl>{Object.entries(moments).map(([id,moment]) => <div key={id}><dt>{moment.name}</dt><dd>{moment.description}</dd></div>)}</dl><p>One +2 style bonus per qualifying round.</p></details>
</div>;

export const RoundReward = ({ data }) => {
  const round = data?.round;
  if (!round) return null;
  return <aside className={`round-reward ${round.status === 'EARNED' ? 'is-earned' : ''}`} role="status"><strong>{round.status === 'EARNED' ? `+${round.amount} Aura earned` : round.status === 'PENDING' ? 'Your Aura reward is being confirmed.' : round.status === 'CAPPED' ? 'Your three rewarded rounds are complete today.' : 'A quick round. The next one could earn Aura.'}</strong>{round.status === 'EARNED' && round.breakdown && <dl className="round-reward-breakdown"><div><dt>Round completed</dt><dd>+{round.breakdown.completion}</dd></div>{round.breakdown.win > 0 && <div><dt>Win</dt><dd>+{round.breakdown.win}</dd></div>}{round.breakdown.style > 0 && <div className="is-style"><dt>{round.breakdown.moment?.name || 'Aura moment'}</dt><dd>+{round.breakdown.style}</dd></div>}</dl>}<p>{round.status === 'EARNED' ? round.repaid ? `${round.repaid} repaid to the bank · ${round.spendable} added to your wallet.` : 'Added to your wallet. Put it toward your next card.' : round.status === 'SHORT' ? 'Take at least two turns and finish a round to qualify. Leaving a round earns no Aura.' : round.status === 'CAPPED' ? 'Keep playing for the rivalry. Rewards return at the daily reset.' : 'Your round is saved. Refresh to check the reward.'}</p></aside>;
};
