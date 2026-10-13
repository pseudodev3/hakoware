import { useEffect, useState } from 'react';
import { Check, Clock3, MessageCircle } from 'lucide-react';
import { getNextMove } from '../../lib/nextMove';
import './NextMove.css';

export const NextMove = ({ friendships, userId, socialContracts, onOpenFriend, onAction, firstOnly = false }) => {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(update, 60000);
    document.addEventListener('visibilitychange', update);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update); };
  }, []);
  const move = getNextMove(friendships, userId, socialContracts, now);
  if (!move || (move.kind === 'first') !== firstOnly) return null;
  const name = move.partner?.username ? `@${move.partner.username}` : move.partner?.displayName || 'your friend';
  const date = move.kind === 'later' ? new Intl.DateTimeFormat(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(move.at)) : null;
  const content = {
    first: { label: 'Your first shared win', title: move.ownDone ? 'You showed up. Their move is next.' : move.partnerDone ? `${name} made the first move.` : 'Two check-ins. One Duo.', copy: move.ownDone ? 'Keep the conversation going while you wait for their check-in.' : 'A valid check-in from each of you starts your shared story.', action: move.ownDone ? 'Keep talking' : 'Make your first move' },
    reply: { label: 'Pick up the conversation', title: `${name} left you a message.`, copy: 'Open their message and carry on where you left off.', action: 'Read & reply' },
    recap: { label: 'Your season, together', title: `See what you built with ${name}.`, copy: 'Your recap is ready. Relive the season, then decide whether to run it back.', action: 'See your recap' },
    moment: { label: 'Something to share', title: `A moment with ${name} is waiting.`, copy: 'Open your friend space to see what’s up.', action: 'Open your moment' },
    ready: { label: 'Make a little time', title: `Your next check-in with ${name} is ready.`, copy: 'Say hello, share a small win, or ask how their day went.', action: 'Open your friend space' },
    later: { label: 'A rhythm you can keep', title: `Next check-in · ${date}`, copy: `Your check-in with ${name} is in. You can keep chatting anytime; the next check-in window opens then.`, action: 'Keep talking' },
  }[move.kind];
  const open = () => move.kind === 'recap' ? onAction('RECAP', move.contract) : onOpenFriend(move.contract, { focusEventId: move.eventId });
  return <section className={`next-move ${firstOnly ? 'is-first' : ''}`} aria-label={content.label}>
    <div className="next-move-copy"><span className="next-move-label">{content.label}</span><h2>{content.title}</h2><p>{content.copy}</p></div>
    {firstOnly && <div className="next-move-progress" aria-label={`${Number(move.ownDone) + Number(move.partnerDone)} of 2 first check-ins complete`}>
      <span className={move.ownDone ? 'done' : ''}>{move.ownDone ? <Check size={15} /> : <MessageCircle size={15} />} You</span>
      <span className={move.partnerDone ? 'done' : ''}>{move.partnerDone ? <Check size={15} /> : <Clock3 size={15} />} Your friend</span>
    </div>}
    <button type="button" className="next-move-action" onClick={open}>{content.action}</button>
  </section>;
};
