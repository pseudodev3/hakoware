import { MessageCircle } from 'lucide-react';
import { DuoIdentity } from '../../shared/components/DuoIdentity';
import { getContractSides } from '../friendship/contractState';
import './HomeReunion.css';

export const HomeReunion = ({ friendship, userId, socialState, onOpenFriend, onAction }) => {
  const { partner } = getContractSides(friendship, userId);
  const latest = socialState?.lastMessage;
  const unseen = socialState?.unseenActivity?.find(item => item.type === 'MESSAGE');
  const complete = friendship.season?.status === 'COMPLETE';
  const open = () => complete ? onAction('RECAP', friendship) : onOpenFriend(friendship, { focusEventId: unseen?.id });
  return <div className="home-reunion">
    <DuoIdentity friendship={friendship} userId={userId} variant="hero">
      <p className="home-reunion-note">{complete ? 'A season worth looking back on.' : unseen ? 'There’s something waiting for you.' : 'A little space for the two of you.'}</p>
      <button className="home-reunion-action" type="button" onClick={open}>{complete ? 'Relive your season' : unseen ? 'Read & reply' : 'Pick up the conversation'}</button>
    </DuoIdentity>
    <div className="home-reunion-letter"><span className="home-reunion-label"><MessageCircle size={14} />{latest ? latest.mine ? 'You left the last word' : `${partner?.displayName || 'Your friend'} said` : 'Your conversation'}</span>
      {latest ? <blockquote>{latest.text}</blockquote> : <p className="home-reunion-empty">A voice note. A small story. Something only they would get.</p>}
      <div><span>{latest ? latest.mine ? 'Keep it going, whenever you like.' : unseen ? 'Their message is ready to open.' : 'Your last shared words.' : 'Start with a hello.'}</span><button type="button" aria-label={`Open conversation with ${partner?.displayName || 'your friend'}`} onClick={() => onOpenFriend(friendship, { focusEventId: unseen?.id })}><MessageCircle size={19} aria-hidden="true" /></button></div>
    </div>
  </div>;
};
