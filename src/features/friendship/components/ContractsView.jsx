import React, { useEffect, useMemo, useState } from 'react';
import { Check, Clock3, Dice5, Mail, Plus, Search, Swords, X } from 'lucide-react';
import { Button } from '../../../shared/components/Button';
import { FriendCard } from './FriendCard';
import { PageHeading } from '../../../shared/components/PageHeading';
import { respondToInvitation } from '../../../services/friendshipService';
import { getBankruptPartner } from '../contractState';
import { circleRoster, filterCircleRoster } from '../../../lib/circleRoster';
import './ContractsView.css';

const FALLBACK_NAMES = {
  DONT_GHOST: "Don't Ghost Me",
  GYM_PACT: 'Gym Pact',
  STUDY_ARC: 'Study Arc',
  LOCK_IN: '30-Day Lock-In',
  LONG_DISTANCE: 'Long Distance',
  BUILD_IN_PUBLIC: 'Build in Public',
  CHAOS: 'Chaos Contract',
  CUSTOM: 'Custom'
};

export const ContractsView = ({ user, friendships, pendingReceived, pendingSent, pendingExternal = [], templates = [], onAction, onAddFriend, onRefresh, onNavigate, showToast, socialContracts = {}, socialStatus = 'ready', onOpenFriend, onAcceptedFriend }) => {
  const [respondingId, setRespondingId] = useState(null);
  const [query, setQuery] = useState(''), [filter, setFilter] = useState('all'), [now, setNow] = useState(Date.now);
  const userId = user.uid || user.id || user._id;
  useEffect(() => { setQuery(''); setFilter('all'); setNow(Date.now()); }, [userId]);
  useEffect(() => { const timer = setInterval(() => { if (document.visibilityState === 'visible') setNow(Date.now()); }, 60000); return () => clearInterval(timer); }, []);
  const waitingOnThem = pendingSent.length + pendingExternal.length;
  const modeNames = useMemo(() => Object.fromEntries(templates.map((item) => [item.id, item.name])), [templates]);
  const modeName = (id) => modeNames[id] || FALLBACK_NAMES[id] || FALLBACK_NAMES.DONT_GHOST;
  const completeSeasons = friendships.filter((item) => item.season?.status === 'COMPLETE').length;
  const chaosContracts = friendships.filter((item) => item.templateId === 'CHAOS').length;
  const bankruptPartners = friendships.filter((item) => getBankruptPartner(item, userId)).length;
  const roster = useMemo(() => circleRoster(friendships, userId, socialContracts, now), [friendships, userId, socialContracts, now]);
  const visible = filterCircleRoster(roster, query, filter);
  const updatesUnavailable = filter === 'unread' && socialStatus !== 'ready';
  const resetFilters = () => { setQuery(''); setFilter('all'); };

  const respond = async (friendship, action) => {
    const id = friendship._id || friendship.id;
    setRespondingId(id);
    const result = await respondToInvitation(id, action);
    if (result.success) {
      showToast?.(action === 'ACCEPT' ? 'Season 1 started' : 'Challenge declined', 'SUCCESS');
      const refreshedContracts = await onRefresh();
      if (action === 'ACCEPT') {
        if (onAcceptedFriend) onAcceptedFriend(friendship, refreshedContracts);
        else onNavigate?.('home');
      }
    } else {
      showToast?.(result.error || 'Could not update contract', 'ERROR');
    }
    setRespondingId(null);
  };

  return (
    <div className="contracts-view">
      {pendingReceived.length > 0 && (
        <section className="contract-section priority-invites">
          <div className="contract-section-title"><h2>Challenges</h2><span>{pendingReceived.length}</span></div>
          <div className="invite-list">
            {pendingReceived.map((friendship) => {
              const inviter = friendship.user1;
              const id = friendship._id || friendship.id;
              const chaos = friendship.templateId === 'CHAOS';
              return (
                <article className={`invite-card ${chaos ? 'chaos' : ''}`} key={id}>
                  <div className="invite-avatar">{chaos ? <Dice5 size={18} /> : inviter?.displayName?.[0]?.toUpperCase() || '?'}</div>
                  <div className="invite-copy">
                    <strong>{inviter?.displayName || 'Someone'}</strong>
                    <span>{inviter?.username ? `@${inviter.username} · ` : ''}{modeName(friendship.templateId)} · {friendship.user2Perspective?.limit || 7}-day rule</span>
                  </div>
                  <div className="invite-actions">
                    <button className="invite-action decline" disabled={respondingId === id} onClick={() => respond(friendship, 'DECLINE')} aria-label="Decline contract"><X size={17} /></button>
                    <button className="invite-action accept" disabled={respondingId === id} onClick={() => respond(friendship, 'ACCEPT')} aria-label="Accept contract"><Check size={17} /></button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      <PageHeading eyebrow="Your circle" title={<>Good people.<br /><span>Shared stories.</span></>} description="Every Duo has its own rhythm. Find yours.">
        <Button variant="aura" icon={Plus} onClick={onAddFriend}>New Duo</Button>
      </PageHeading>

      <div className="contracts-meta" aria-label="Contract summary">
        <span><b>{friendships.length}</b> active</span>
        {completeSeasons > 0 && <span><b>{completeSeasons}</b> report{completeSeasons === 1 ? '' : 's'} ready</span>}
        {bankruptPartners > 0 && <span className="danger"><b>{bankruptPartners}</b> bankrupt partner{bankruptPartners === 1 ? '' : 's'}</span>}
        {chaosContracts > 0 && <span><b>{chaosContracts}</b> Chaos</span>}
      </div>
      <button type="button" className="people-text-button" onClick={() => onNavigate('contracts', { section: 'discover' })}>Meet someone new in Discover</button>


      {waitingOnThem > 0 && (
        <section className="contract-section compact-section">
          <div className="contract-section-title"><h2>Waiting</h2><span>{waitingOnThem}</span></div>
          <div className="sent-list">
            {pendingSent.map((friendship) => (
              <div className="sent-row" key={friendship._id || friendship.id}>
                <Clock3 size={15} strokeWidth={1.8} />
                <div><span>{friendship.user2?.displayName || friendship.user2DisplayName}</span><small>{friendship.user2?.username ? `@${friendship.user2.username} · ` : ''}{modeName(friendship.templateId)}</small></div>
                <b>Pending</b>
              </div>
            ))}
            {pendingExternal.map((invite) => (
              <div className="sent-row" key={invite.id}>
                <Mail size={15} strokeWidth={1.8} />
                <div><span>{invite.recipientEmail}</span><small>{modeName(invite.templateId)}</small></div>
                <b>Invite sent</b>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="contract-section active-contract-section">
        {friendships.length > 0 && <div className="circle-roster-tools"><div className="circle-search"><Search size={17} aria-hidden="true" /><input type="search" aria-label="Search your circle" placeholder="Name, @handle or Duo" value={query} onChange={event => setQuery(event.target.value)} />{query && <button type="button" aria-label="Clear circle search" onClick={() => setQuery('')}><X size={17} /></button>}</div><div className="circle-roster-filters" role="group" aria-label="Filter your circle">{[{ id:'all', label:'All', count:roster.length }, { id:'unread', label:'Unread', count:socialStatus === 'ready' ? roster.filter(row => row.unread).length : null }, { id:'due', label:'Check-in due', count:roster.filter(row => row.due).length }].map(item => <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}{item.count !== null && <span>{item.count}</span>}</button>)}</div></div>}
        <div className="contract-section-title"><h2>{filter === 'unread' ? 'Unread' : filter === 'due' ? 'Check-in due' : 'Active'}</h2><span aria-live="polite">{updatesUnavailable ? socialStatus === 'loading' ? 'Loading updates…' : 'Updates unavailable' : visible.length}{!updatesUnavailable && query.trim() && ` of ${friendships.length}`}</span></div>
        {friendships.length === 0 ? (
          <div className="contracts-empty"><Swords size={28} strokeWidth={1.6} /><h2>It starts with one person.</h2><p>Invite a friend and pick a rhythm you can both keep.</p><Button variant="aura" icon={Plus} onClick={onAddFriend}>Invite your person</Button></div>
        ) : updatesUnavailable ? <div className="circle-roster-empty" role="status"><p>{socialStatus === 'loading' ? 'Opening your circle’s updates…' : 'Your updates couldn’t load. Your friends are still in All.'}</p><button type="button" onClick={() => setFilter('all')}>Show all friends</button></div> : !visible.length ? <div className="circle-roster-empty" role="status"><h3>{query.trim() ? 'No matching Duos.' : filter === 'unread' ? 'You’re caught up.' : 'No check-ins due.'}</h3><p>{query.trim() ? 'Try a name, handle or your Duo’s name.' : filter === 'unread' ? 'New updates from your people will appear here.' : 'Your shared spaces are still ready to open.'}</p><button type="button" onClick={resetFilters}>Show all friends</button></div> : (
          <div className="contracts-grid">
            {visible.map(({ friendship }) => (
              <FriendCard
                key={friendship._id || friendship.id}
                friendship={friendship}
                currentUserId={userId}
                onAction={onAction}
                socialState={socialContracts?.[friendship._id || friendship.id]}
                socialStatus={socialStatus}
                onOpen={onOpenFriend}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
