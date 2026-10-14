import { useEffect, useRef, useState } from 'react';
import { Share2, Sparkles } from 'lucide-react';
import { Modal } from '../../../shared/components/Modal';
import { Button } from '../../../shared/components/Button';
import { DuoCover } from '../../../shared/components/DuoIdentity';
import { UserAvatar } from '../../../shared/components/UserAvatar';
import { CardArtwork } from '../../cards/CardArtwork';
import { duoLabel, duoStyle } from '../../../lib/duoIdentity';
import { buildDuoShareCard } from '../../../lib/duoShareCard';
import { shareHakoware } from '../../../lib/share';
import './GameMoment.css';
import { getContractRecap } from '../../../services/friendshipService';
import { playGameSound } from '../../../lib/gameSounds';

export const GameMoment = ({ user, friendships, onAction, showToast }) => {
  const userId = String(user.uid || user.id || user._id);
  const [moment, setMoment] = useState(null);
  const [sharing, setSharing] = useState(false);
  const context = useRef(null); context.current = { userId, friendships };
  const seen = useRef(new Set());
  useEffect(() => {
    setMoment(null); seen.current.clear();
    const receive = event => {
      const detail = event.detail;
      if (!detail || detail.userId !== context.current.userId || !['DUO_LEVEL_UP', 'SEASON_COMPLETED', 'SIGNAL_FLARE'].includes(detail.type) || !/^[a-f0-9]{24}$/.test(detail.eventId || '')) return;
      const contract = context.current.friendships.find(value => String(value._id || value.id) === detail.contractId);
      if (!contract) return;
      const key = `hakoware:game-moment:${userId}:${detail.eventId}`;
      if (detail.automatic) {
        let recorded = false; try { recorded = Boolean(localStorage.getItem(key)); } catch { /* Optional device history. */ }
        if (seen.current.has(key) || recorded) return;
      }
      seen.current.add(key); try { localStorage.setItem(key, 'seen'); } catch { /* The reveal still works without storage. */ }
      setMoment({ ...detail, contract });
      playGameSound(detail.type, userId, detail.eventId);
    };
    window.addEventListener('hakoware-game-moment', receive);
    return () => window.removeEventListener('hakoware-game-moment', receive);
  }, [userId]);
  if (!moment) return null;
  const contract = friendships.find(value => String(value._id || value.id) === moment.contractId) || moment.contract;
  const ownFirst = String(contract.user1?._id || contract.user1) === userId;
  const partner = ownFirst ? contract.user2 : contract.user1;
  const flare = moment.type === 'SIGNAL_FLARE';
  const season = moment.type === 'SEASON_COMPLETED';
  const level = moment.milestone?.level || contract.duoLevel || 1;
  const number = moment.milestone?.season || contract.season?.number || 1;
  const earnedTitle = moment.milestone?.title || contract.duoTitle;
  const close = () => { if (!sharing) setMoment(null); };
  const share = async () => {
    if (sharing) return; setSharing(true);
    try {
      const recap = await getContractRecap(contract._id || contract.id);
      const blob = await buildDuoShareCard({ userName: user.username ? '@'+user.username : user.displayName, partnerName: partner?.username ? '@'+partner.username : partner?.displayName, duoName: contract.identity?.name, palette: contract.identity?.palette, cover: contract.identity?.cover, duoLevel: recap.duo.level, duoTitle: recap.duo.title, duoXP: recap.duo.xp, templateName: recap.template?.name, seasonNumber: recap.season.number, seasonStatus: recap.season.status });
      const result = await shareHakoware({ source: 'DUO', title: duoLabel(contract, 'Our Hakoware Duo'), text: `${duoLabel(contract, `${user.displayName} + ${partner?.displayName || 'my friend'}`)} · Duo Lv. ${recap.duo.level}`, url: '', files: [new File([blob], 'hakoware-duo.png', { type: 'image/png' })] });
      if (!result.cancelled) { if (result.success && result.method === 'CLIPBOARD') showToast?.('Duo text copied. Image sharing is unavailable here.', 'SUCCESS'); else if (!result.success) showToast?.(result.error || 'Could not share your Duo', 'ERROR'); }
    } catch (error) { showToast?.(error.message || 'Could not share your Duo', 'ERROR'); }
    finally { setSharing(false); }
  };
  return <Modal isOpen title={flare ? 'Signal Flare' : season ? 'Season complete' : `Duo Level ${level}`} onClose={close} size="md"><section className={`game-moment ${flare ? 'is-flare' : ''}`} style={flare ? { '--duo-accent': '#eeb55c', '--duo-ink': '#714325' } : duoStyle(contract)}>
    <div className="game-moment-art"><DuoCover cover={flare ? 'rays' : contract.identity?.cover} />{flare ? <CardArtwork cardId="SIGNAL_FLARE" size={128} /> : <><div className="game-moment-orbit" /><strong>{season ? String(number).padStart(2, '0') : String(level).padStart(2, '0')}</strong><span>{season ? 'SEASON COMPLETE' : 'DUO LEVEL'}</span></>}</div>
    <div className="game-moment-people"><UserAvatar person={user} size="sm" decorative />{!flare && <UserAvatar person={partner} size="sm" decorative />}<span>{flare ? 'A little pressure. Your signature.' : duoLabel(contract, `You + ${partner?.displayName || 'your friend'}`)}</span></div>
    <h2>{flare ? 'Your signal is lit.' : season ? 'A shared story, finished.' : 'You kept showing up.'}</h2>
    <p>{flare ? 'Your Flare goes to the shared board. Your friend gets a private notice; the recipient stays private.' : season ? `Season ${number} is in the books. Take a moment to look back at what you built together.` : `${earnedTitle && earnedTitle !== 'New Contract' ? earnedTitle + ' · ' : ''}Another level with ${partner?.displayName || 'your friend'}.`}</p>
    <div className="game-moment-actions">{flare ? <Button variant="aura" icon={Sparkles} onClick={close}>Back to it</Button> : <><Button variant="secondary" icon={Share2} loading={sharing} onClick={share}>Share your Duo</Button><Button variant="aura" disabled={sharing} onClick={() => { setMoment(null); if (season) onAction?.('RECAP', contract); }}>{season ? 'See your season' : 'Keep the loop alive'}</Button></>}</div>
  </section></Modal>;
};
