import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Radio, RefreshCw, Send, Swords, Users, Zap } from 'lucide-react';
import {
  answerAfterHours,
  getAfterHours,
  joinAfterHoursChallenge,
  reactAfterHours,
  shoutAfterHours,
  tagInAfterHours,
  throwAfterHoursChallenge
} from '../../services/afterHoursService';
import { Modal } from '../../shared/components/Modal';
import { UserAvatar } from '../../shared/components/UserAvatar';
import './AfterHoursView.css';

const relativeTime = (value) => {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 45) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
};

const personLabel = (person) => person?.displayName || person?.username || 'Someone';

const usernamesFromContracts = (friendships, ownUsername) => {
  const names = new Set();
  (friendships || []).forEach((friendship) => {
    [friendship?.user1, friendship?.user2].forEach((person) => {
      const username = String(person?.username || '').toLowerCase();
      if (username && username !== ownUsername) names.add(username);
    });
  });
  return names;
};

export const AfterHoursView = ({ user, friendships = [], onStartContract, showToast }) => {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [shout, setShout] = useState('');
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [customChallenge, setCustomChallenge] = useState('');
  const [challengeReplyId, setChallengeReplyId] = useState(null);
  const [challengeReply, setChallengeReply] = useState('');
  const [selectedPerson, setSelectedPerson] = useState(null);

  const loadRoom = useCallback(async ({ quiet = false } = {}) => {
    try {
      const next = await getAfterHours();
      setRoom(next);
    } catch (error) {
      if (!quiet) showToast?.(error.message || 'Could not enter After Hours', 'ERROR');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadRoom();
    const refresh = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadRoom({ quiet: true });
    }, 15000);
    const clock = window.setInterval(() => setNow(Date.now()), 1000);

    return () => {
      window.clearInterval(refresh);
      window.clearInterval(clock);
    };
  }, [loadRoom]);

  useEffect(() => {
    const endsAt = new Date(room?.roomEvent?.endsAt || 0).getTime();
    if (!endsAt || endsAt > now || busy) return;
    void loadRoom({ quiet: true });
  }, [now, room?.roomEvent?.endsAt, busy, loadRoom]);

  const event = room?.roomEvent || null;
  const secondsLeft = Math.max(0, Math.ceil((new Date(event?.endsAt || 0).getTime() - now) / 1000));
  const timeLabel = `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`;
  const ownUsername = String(user?.username || '').toLowerCase();
  const shoutLimit = Number(room?.composer?.shoutMaxLength) || 88;
  const challengeLimit = Number(room?.composer?.challengeMaxLength) || 96;
  const total = Number(event?.totalAnswers) || 0;
  const contractedUsernames = useMemo(
    () => usernamesFromContracts(friendships, ownUsername),
    [friendships, ownUsername]
  );

  const results = useMemo(() => {
    if (!event?.viewerAnswer) return [];
    return (event.options || []).map((option) => {
      const count = Number(event.tally?.[option]) || 0;
      return {
        option,
        count,
        percent: total > 0 ? Math.round((count / total) * 100) : 0
      };
    });
  }, [event?.viewerAnswer, event?.options, event?.tally, total]);

  const hasContractWith = (person) => contractedUsernames.has(String(person?.username || '').toLowerCase());

  const presenceFor = (person) => (
    (room?.people || []).find(
      (candidate) => String(candidate?.username || '').toLowerCase() === String(person?.username || '').toLowerCase()
    ) || null
  );

  const openPerson = (person) => {
    if (!person?.username || String(person.username).toLowerCase() === ownUsername) return;
    setSelectedPerson(person);
  };

  const startContract = (person) => {
    if (!person?.username || hasContractWith(person)) return;
    setSelectedPerson(null);
    onStartContract?.(person);
  };

  const submitAnswer = async (choice) => {
    if (!event || event.viewerAnswer || busy) return;
    setBusy(`answer:${choice}`);
    try {
      setRoom(await answerAfterHours(event.roundKey, choice));
    } catch (error) {
      showToast?.(error.message || 'Could not lock your side', 'ERROR');
      if (error.status === 409) void loadRoom({ quiet: true });
    } finally {
      setBusy(null);
    }
  };

  const submitShout = async (eventObject) => {
    eventObject.preventDefault();
    const text = shout.replace(/\s+/g, ' ').trim();
    if (!text || busy) return;
    setBusy('shout');
    try {
      setRoom(await shoutAfterHours(text));
      setShout('');
    } catch (error) {
      showToast?.(error.message || 'Could not shout into the room', 'ERROR');
    } finally {
      setBusy(null);
    }
  };

  const throwChallenge = async ({ promptId = null, text = '' } = {}) => {
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if ((!promptId && !cleanText) || busy) return;
    setBusy(promptId ? `challenge:${promptId}` : 'challenge:custom');
    try {
      setRoom(await throwAfterHoursChallenge({ promptId, text: cleanText }));
      setCustomChallenge('');
      setChallengeOpen(false);
      showToast?.('Challenge is live.', 'SUCCESS');
    } catch (error) {
      showToast?.(error.message || 'Could not throw that challenge', 'ERROR');
    } finally {
      setBusy(null);
    }
  };

  const joinChallenge = async (activityId) => {
    const text = challengeReply.replace(/\s+/g, ' ').trim();
    if (!text || busy) return;
    setBusy(`join:${activityId}`);
    try {
      setRoom(await joinAfterHoursChallenge(activityId, text));
      setChallengeReply('');
      setChallengeReplyId(null);
    } catch (error) {
      showToast?.(error.message || 'Could not answer that challenge', 'ERROR');
      if (error.status === 409) void loadRoom({ quiet: true });
    } finally {
      setBusy(null);
    }
  };

  const submitReaction = async (activityId, reaction) => {
    if (busy) return;
    setBusy(`react:${activityId}:${reaction}`);
    try {
      setRoom(await reactAfterHours(activityId, reaction));
    } catch (error) {
      showToast?.(error.message || 'Could not react', 'ERROR');
    } finally {
      setBusy(null);
    }
  };

  const submitTagIn = async (username) => {
    if (busy) return;
    setBusy(`tag-in:${username}`);
    try {
      setRoom(await tagInAfterHours(username));
      setSelectedPerson(null);
      showToast?.(`Tagged @${username} in.`, 'SUCCESS');
    } catch (error) {
      showToast?.(error.message || 'Could not tag them in', 'ERROR');
      if (error.status === 409) void loadRoom({ quiet: true });
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <section className="after-hours after-hours-loading" aria-live="polite">
        <Radio size={21} strokeWidth={1.8} />
        <span>Opening After Hours…</span>
      </section>
    );
  }

  if (!room || !event) {
    return (
      <section className="after-hours after-hours-empty">
        <h1>After Hours</h1>
        <p>The room did not open.</p>
        <button type="button" onClick={() => loadRoom()}>
          <RefreshCw size={16} /> Try again
        </button>
      </section>
    );
  }

  const renderReactions = (item, isOwn) => {
    if (isOwn) return null;
    return (
      <div className="after-hours-reactions" aria-label="React">
        {(room.reactions || []).map((reaction) => {
          const count = Number(item.reactions?.counts?.[reaction]) || 0;
          const selected = item.reactions?.viewerReaction === reaction;
          return (
            <button
              type="button"
              key={reaction}
              className={selected ? 'is-selected' : ''}
              disabled={Boolean(busy)}
              onClick={() => submitReaction(item.id, reaction)}
              aria-pressed={selected}
            >
              <span>{reaction}</span>
              {count > 0 && <small>{count}</small>}
            </button>
          );
        })}
      </div>
    );
  };

  const selectedPresence = selectedPerson ? presenceFor(selectedPerson) : null;
  const selectedHasContract = selectedPerson ? hasContractWith(selectedPerson) : false;
  const canTagSelected = Boolean(
    selectedPresence
    && event.viewerAnswer
    && !selectedPresence.answeredCurrent
    && !selectedPresence.isYou
  );

  return (
    <>
      <section className="after-hours">
        <header className="after-hours-header">
          <div>
            <span className="after-hours-kicker"><Radio size={13} /> LIVE ROOM</span>
            <h1>After Hours</h1>
            <p>People, bad takes, and unfinished business.</p>
          </div>
          <div className="after-hours-presence" aria-label={`${room.presenceCount} people around`}>
            <strong>{room.presenceCount}</strong>
            <span>around now</span>
          </div>
        </header>

        <section className="after-hours-around" aria-label="People around now">
          <div className="after-hours-section-label">
            <span>AROUND NOW</span>
            <small>{room.presenceCount}</small>
          </div>
          <div className="after-hours-around-list">
            {(room.people || []).map((person) => (
              <div className="after-hours-person-chip" key={person.username}>
                <button
                  type="button"
                  className="after-hours-person-open"
                  disabled={person.isYou}
                  onClick={() => openPerson(person)}
                  aria-label={person.isYou ? 'You' : `Open @${person.username}`}
                >
                  <UserAvatar person={person} size="sm" decorative />
                  <span>
                    <strong>{person.isYou ? 'You' : personLabel(person)}</strong>
                    <small>@{person.username}</small>
                  </span>
                </button>
                {!person.isYou && (
                  person.answeredCurrent
                    ? <small>picked</small>
                    : event.viewerAnswer
                      ? (
                        <button
                          type="button"
                          className="after-hours-tag-in"
                          disabled={Boolean(busy)}
                          onClick={() => submitTagIn(person.username)}
                          title="Pull them into the current Pick a Side"
                        >
                          Tag in
                        </button>
                      )
                      : <small>around</small>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="after-hours-composer" aria-label="Say something to After Hours">
          <UserAvatar person={user} size="md" decorative />
          <form onSubmit={submitShout}>
            <input
              value={shout}
              onChange={(eventObject) => setShout(eventObject.target.value.slice(0, shoutLimit))}
              maxLength={shoutLimit}
              placeholder="Say something to the room…"
              aria-label="Shout to the room"
            />
            <span>{shout.length}/{shoutLimit}</span>
            <button type="submit" disabled={!shout.trim() || Boolean(busy)} aria-label="Send shout">
              <Send size={16} strokeWidth={1.9} />
            </button>
          </form>
          <button
            type="button"
            className={challengeOpen ? 'after-hours-challenge-toggle is-open' : 'after-hours-challenge-toggle'}
            onClick={() => setChallengeOpen((value) => !value)}
            disabled={Boolean(busy)}
          >
            <Swords size={16} strokeWidth={1.8} />
            <span>Challenge</span>
          </button>
        </section>

        {challengeOpen && (
          <section className="after-hours-challenge-picker">
            <div className="after-hours-section-label">
              <span>THROW ONE IN</span>
              <small>one-shot · no thread</small>
            </div>
            <form
              className="after-hours-custom-challenge"
              onSubmit={(eventObject) => {
                eventObject.preventDefault();
                void throwChallenge({ text: customChallenge });
              }}
            >
              <input
                autoFocus
                value={customChallenge}
                onChange={(eventObject) => setCustomChallenge(eventObject.target.value.slice(0, challengeLimit))}
                maxLength={challengeLimit}
                placeholder="Write your own challenge…"
                aria-label="Custom challenge"
              />
              <span>{customChallenge.length}/{challengeLimit}</span>
              <button type="submit" disabled={!customChallenge.trim() || Boolean(busy)}>Throw</button>
            </form>
            <div className="after-hours-suggestion-label">Or steal one</div>
            <div className="after-hours-challenge-suggestions">
              {(room.composer?.challenges || []).map((challenge) => (
                <button
                  type="button"
                  key={challenge.id}
                  disabled={Boolean(busy)}
                  onClick={() => throwChallenge({ promptId: challenge.id })}
                >
                  <span>{challenge.text}</span>
                  <Swords size={15} strokeWidth={1.8} />
                </button>
              ))}
            </div>
          </section>
        )}

        <section className="after-hours-pin" aria-labelledby="after-hours-question">
          <div className="after-hours-pin-head">
            <span><Zap size={13} /> ROOM EVENT · PICK A SIDE</span>
            <time dateTime={event.endsAt}>{timeLabel}</time>
          </div>
          <div className="after-hours-pin-body">
            <h2 id="after-hours-question">{event.text}</h2>

            {!event.viewerAnswer ? (
              <div className="after-hours-pin-options">
                {(event.options || []).map((option) => (
                  <button
                    type="button"
                    key={option}
                    disabled={Boolean(busy)}
                    onClick={() => submitAnswer(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <div className="after-hours-pin-results">
                {results.map((result) => (
                  <div
                    className={event.viewerAnswer === result.option ? 'is-yours' : ''}
                    key={result.option}
                  >
                    <span>{result.option}</span>
                    <i><b style={{ width: `${result.percent}%` }} /></i>
                    <strong>{result.percent}%</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
          <small>{total} answered · Tag in someone around if you want their take.</small>
        </section>

        <section className="after-hours-feed">
          <div className="after-hours-section-label after-hours-feed-heading">
            <span>ROOM NOISE</span>
            <small>real activity · last 3h</small>
          </div>

          {room.feed.length === 0 ? (
            <div className="after-hours-feed-empty">
              <Users size={19} strokeWidth={1.8} />
              <div>
                <strong>It is quiet.</strong>
                <p>Leave the first thing behind. It will still be here when somebody walks in.</p>
              </div>
            </div>
          ) : (
            <div className="after-hours-feed-list">
              {room.feed.map((item) => {
                const isOwn = String(item.actor?.username || '').toLowerCase() === ownUsername;
                const answeredYourChallenge = item.type === 'CHALLENGE_JOIN'
                  && String(item.target?.username || '').toLowerCase() === ownUsername
                  && !isOwn;

                return (
                  <article className={`after-hours-feed-item is-${String(item.type || '').toLowerCase().replaceAll('_', '-')}`} key={item.id}>
                    <button
                      type="button"
                      className="after-hours-feed-person"
                      disabled={isOwn}
                      onClick={() => openPerson(item.actor)}
                      aria-label={isOwn ? 'You' : `Open @${item.actor?.username}`}
                    >
                      <UserAvatar person={item.actor} size="md" decorative />
                    </button>
                    <div className="after-hours-feed-copy">
                      <div className="after-hours-feed-meta">
                        <button type="button" disabled={isOwn} onClick={() => openPerson(item.actor)}>
                          <strong>{personLabel(item.actor)}</strong>
                          <span>@{item.actor.username}</span>
                        </button>
                        <time>{relativeTime(item.createdAt)}</time>
                      </div>

                      {item.type === 'SHOUT' && (
                        <p className="after-hours-shout">“{item.text}”</p>
                      )}

                      {item.type === 'ANSWER' && (
                        <>
                          <p>picked <b>{item.choice}</b></p>
                          <small>{item.promptText}</small>
                        </>
                      )}

                      {item.type === 'CALLOUT' && (
                        <>
                          <p><b>tagged @{item.target?.username} in</b> for the live Pick a Side.</p>
                          <small>{item.promptText}</small>
                        </>
                      )}

                      {item.type === 'CHALLENGE' && (
                        <div className="after-hours-challenge">
                          <span>THREW A CHALLENGE</span>
                          <p>{item.text}</p>
                          <div>
                            <small>{item.joinCount || 0} answered</small>
                            {item.canJoin && !item.viewerJoined && (
                              <button
                                type="button"
                                disabled={Boolean(busy)}
                                onClick={() => {
                                  setChallengeReplyId((current) => current === item.id ? null : item.id);
                                  setChallengeReply('');
                                }}
                              >
                                {challengeReplyId === item.id ? 'Close' : 'Answer'}
                              </button>
                            )}
                            {item.viewerJoined && <small className="after-hours-answered">answered</small>}
                          </div>
                          {challengeReplyId === item.id && !item.viewerJoined && (
                            <form
                              className="after-hours-challenge-response-form"
                              onSubmit={(eventObject) => {
                                eventObject.preventDefault();
                                void joinChallenge(item.id);
                              }}
                            >
                              <input
                                autoFocus
                                value={challengeReply}
                                onChange={(eventObject) => setChallengeReply(eventObject.target.value.slice(0, shoutLimit))}
                                maxLength={shoutLimit}
                                placeholder="Your one-line answer…"
                                aria-label="Answer challenge"
                              />
                              <button type="submit" disabled={!challengeReply.trim() || Boolean(busy)}>
                                Send
                              </button>
                            </form>
                          )}
                        </div>
                      )}

                      {item.type === 'CHALLENGE_JOIN' && (
                        <>
                          <p>answered <b>@{item.target?.username}'s challenge</b>.</p>
                          <small>{item.promptText}</small>
                          <p className="after-hours-challenge-response">“{item.text}”</p>
                          {answeredYourChallenge && !hasContractWith(item.actor) && (
                            <button
                              type="button"
                              className="after-hours-convert-link"
                              onClick={() => startContract(item.actor)}
                            >
                              Start contract <ArrowRight size={14} strokeWidth={1.8} />
                            </button>
                          )}
                        </>
                      )}

                      {renderReactions(item, isOwn)}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>

      <Modal
        isOpen={Boolean(selectedPerson)}
        onClose={() => setSelectedPerson(null)}
        title={selectedPerson?.username ? `@${selectedPerson.username}` : 'After Hours'}
        size="sm"
      >
        {selectedPerson && (
          <div className="after-hours-person-sheet">
            <UserAvatar person={selectedPerson} size="lg" decorative />
            <div className="after-hours-person-sheet-copy">
              <h3>{personLabel(selectedPerson)}</h3>
              <p>@{selectedPerson.username}</p>
              <small>You ran into each other in After Hours.</small>
            </div>

            <div className="after-hours-person-sheet-actions">
              {selectedHasContract ? (
                <div className="after-hours-existing-contract">Already in your circle.</div>
              ) : (
                <button type="button" className="after-hours-start-contract" onClick={() => startContract(selectedPerson)}>
                  Start contract <ArrowRight size={15} strokeWidth={1.8} />
                </button>
              )}

              {canTagSelected && (
                <button
                  type="button"
                  className="after-hours-sheet-tag"
                  disabled={Boolean(busy)}
                  onClick={() => submitTagIn(selectedPresence.username)}
                >
                  Tag into Pick a Side
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  );
};
