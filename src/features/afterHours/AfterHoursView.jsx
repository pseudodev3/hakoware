import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Radio, RefreshCw, Send, Swords, Users, Zap } from 'lucide-react';
import {
  answerAfterHours,
  callOutAfterHours,
  getAfterHours,
  joinAfterHoursChallenge,
  reactAfterHours,
  shoutAfterHours,
  throwAfterHoursChallenge
} from '../../services/afterHoursService';
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

export const AfterHoursView = ({ user, showToast }) => {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [now, setNow] = useState(Date.now());
  const [shout, setShout] = useState('');
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeReplyId, setChallengeReplyId] = useState(null);
  const [challengeReply, setChallengeReply] = useState('');

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
  const total = Number(event?.totalAnswers) || 0;

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

  const throwChallenge = async (promptId) => {
    if (busy) return;
    setBusy(`challenge:${promptId}`);
    try {
      setRoom(await throwAfterHoursChallenge(promptId));
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

  const submitCallout = async (username) => {
    if (busy) return;
    setBusy(`callout:${username}`);
    try {
      setRoom(await callOutAfterHours(username));
      showToast?.(`Called out @${username}.`, 'SUCCESS');
    } catch (error) {
      showToast?.(error.message || 'Could not call them out', 'ERROR');
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

  return (
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
              <UserAvatar person={person} size="sm" decorative />
              <div>
                <strong>{person.isYou ? 'You' : personLabel(person)}</strong>
                <span>@{person.username}</span>
              </div>
              {!person.isYou && (
                person.answeredCurrent
                  ? <small>picked</small>
                  : event.viewerAnswer
                    ? (
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => submitCallout(person.username)}
                      >
                        Call out
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
          <div>
            {(room.composer?.challenges || []).map((challenge) => (
              <button
                type="button"
                key={challenge.id}
                disabled={Boolean(busy)}
                onClick={() => throwChallenge(challenge.id)}
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
        <small>{total} answered · this event is just one thing happening in the room</small>
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

              return (
                <article className={`after-hours-feed-item is-${String(item.type || '').toLowerCase().replaceAll('_', '-')}`} key={item.id}>
                  <UserAvatar person={item.actor} size="md" decorative />
                  <div className="after-hours-feed-copy">
                    <div className="after-hours-feed-meta">
                      <strong>{personLabel(item.actor)}</strong>
                      <span>@{item.actor.username}</span>
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
                        <p><b>called out @{item.target?.username}</b> before the room moves on.</p>
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
  );
};
