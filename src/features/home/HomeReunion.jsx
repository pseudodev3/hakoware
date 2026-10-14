import { MessageCircle } from 'lucide-react';
import { DuoIdentity } from '../../shared/components/DuoIdentity';
import { getContractSides } from '../friendship/contractState';
import './HomeReunion.css';

export const HomeReunion = ({ friendship, userId, socialState, onOpenFriend, onAction }) => {
  const { partner } = getContractSides(friendship, userId);
  const latest = socialState?.lastMessage;
  const unseen = socialState?.unseenActivity?.find(item => item.type === 'MESSAGE');
  const complete = friendship.season?.status === 'COMPLETE';
  const open = () => complete && !unseen ? onAction('RECAP', friendship) : onOpenFriend(friendship, { focusEventId: unseen?.id });
  return <div className="home-reunion">
    <DuoIdentity friendship={friendship} userId={userId} variant="hero">
      {latest ? <div className="home-reunion-preview"><span className="home-reunion-label"><MessageCircle size={14} aria-hidden="true" />{latest.mine ? 'Your last message' : `${partner?.displayName || 'Your friend'} said`}</span><blockquote>{latest.text}</blockquote></div> : <p className="home-reunion-note">{complete ? 'A season worth looking back on.' : 'A little space for the two of you.'}</p>}
      <button className="home-reunion-action" type="button" onClick={open}>{unseen ? 'Read & reply' : complete ? 'Relive your season' : 'Pick up the conversation'}</button>
      {complete && unseen && <button className="home-reunion-recap" type="button" onClick={() => onAction('RECAP', friendship)}>See season recap</button>}
    </DuoIdentity>
  </div>;
};
