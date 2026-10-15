export const PlayRewards = ({ data, onPlay }) => <div className="play-rewards" aria-label="Earn Aura through play">
  <div><p className="duel-kicker">A little more Aura</p><h3>Good rounds give back.</h3><p>Play at least two turns and finish the round: <strong>+5 Aura</strong>. Win for <strong>+5 more</strong>. Your first three qualifying rounds each day count.</p></div>
  <div className="play-reward-progress"><div className="play-reward-dots" aria-hidden="true">{[0, 1, 2].map(value => <i key={value} className={value < (data?.rounds || 0) ? 'is-done' : ''} />)}</div><span>{data?.rounds || 0} of 3 rewarded today · {data?.earned || 0} Aura</span>{data?.resetsAt && <small>Resets at {new Date(data.resetsAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small>}{onPlay && <button className="duel-text-action" type="button" onClick={onPlay}>Find a table</button>}</div>
</div>;

export const RoundReward = ({ data }) => {
  const round = data?.round;
  if (!round) return null;
  return <aside className={`round-reward ${round.status === 'EARNED' ? 'is-earned' : ''}`} role="status"><strong>{round.status === 'EARNED' ? `+${round.amount} Aura earned` : round.status === 'PENDING' ? 'Your Aura reward is being confirmed.' : round.status === 'CAPPED' ? 'Your three rewarded rounds are complete today.' : 'A quick round. The next one could earn Aura.'}</strong><p>{round.status === 'EARNED' ? round.repaid ? `${round.repaid} repaid to the bank · ${round.spendable} added to your wallet.` : 'Added to your wallet. Put it toward your next card.' : round.status === 'SHORT' ? 'Take at least two turns and finish a round to qualify. Leaving a round earns no Aura.' : round.status === 'CAPPED' ? 'Keep playing for the rivalry. Rewards return at the daily reset.' : 'Your round is saved. Refresh to check the reward.'}</p></aside>;
};
