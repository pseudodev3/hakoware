import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Radio, RefreshCw, Zap } from 'lucide-react';
import {
  answerAfterHours,
  callOutAfterHours,
  getAfterHours,
  reactAfterHours
} from '../../services/afterHoursService';
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

const initialFor = (person) => (
  person?.displayName?.[0]?.toUpperCase()
  || person?.username?.[0]?.toUpperCase()
  || '?'
);

const personLabel = (person) => person?.displayName || person?.username || 'Someone';

export const AfterHoursView = ({ user, showToast }) => {
  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [now, setNow] = useState(Date.now());

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
    }, 20000);
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
      const next = await answerAfterHours(event.roundKey, choice);
      setRoom(next);
    } catch (error) {
      showToast?.(error.message || 'Could not lock your side', 'ERROR');
      if (error.status === 409) void loadRoom({ quiet: true });
    } finally {
      setBusy(null);
    }
  };

  const submitReaction = async (activityId, reaction) => {
    if (busy) return;
    setBusy(`react:${activityId}:${reaction}`);
    try {
      const next = await reactAfterHours(activityId, reaction);
      setRoom(next);
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
      const next = await callOutAfterHours(username);
      setRoom(next);
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
        <Radio size={22} strokeWidth={1.8} />
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

  return (
    <section className="after-hours">
      <header className="after-hours-header">
        <div>
          <span className="after-hours-kicker"><Radio size={14} /> LIVE ROOM</span>
          <h1>After Hours</h1>
          <p>One room. One thing happening now.</p>
        </div>
        <div className="after-hours-presence" aria-label={`${room.presenceCount} people around`}>
          <strong>{room.presenceCount}</strong>
          <span>around</span>
        </div>
      </header>

      <section className="after-hours-stage" aria-labelledby="after-hours-question">
        <div className="after-hours-stage-top">
          <span>PICK A SIDE</span>
          <time dateTime={event.endsAt}>{timeLabel}</time>
        </div>
        <h2 id="after-hours-question">{event.text}</h2>

        {!event.viewerAnswer ? (
          <div className="after-hours-options">
            {(event.options || []).map((option) => (
              <button
                type="button"
                key={option}
                disabled={Boolean(busy)}
                onClick={() => submitAnswer(option)}
                className={busy === `answer:${option}` ? 'is-busy' : ''}
              >
                <span>{option}</span>
                <ArrowRight size={18} strokeWidth={1.8} />
              </button>
            ))}
          </div>
        ) : (
          <div className="after-hours-results" aria-label="Room split">
            {results.map((result) => (
              <div
                className={`after-hours-result ${event.viewerAnswer === result.option ? 'is-yours' : ''}`}
                key={result.option}
              >
                <div>
                  <span>{result.option}</span>
                  <strong>{result.percent}%</strong>
                </div>
                <i aria-hidden="true"><b style={{ width: `${result.percent}%` }} /></i>
              </div>
            ))}
            <p>You picked <strong>{event.viewerAnswer}</strong> · {total} answered</p>
          </div>
        )}
      </section>

      <div className="after-hours-body">
        <div className="after-hours-feed">
          <div className="after-hours-section-label">
            <span>ROOM NOISE</span>
            <small>{room.feed.length ? 'latest first' : 'quiet for once'}</small>
          </div>

          {room.feed.length === 0 ? (
            <div className="after-hours-feed-empty">
              <Zap size={18} strokeWidth={1.8} />
              <p>Nothing yet. Pick a side and ruin the silence.</p>
            </div>
          ) : (
            <div className="after-hours-feed-list">
              {room.feed.map((item) => {
                const isOwn = String(item.actor?.username || '').toLowerCase() === ownUsername;
                if (item.type === 'CALLOUT') {
                  return (
                    <article className="after-hours-feed-item is-callout" key={item.id}>
                      <div className="after-hours-avatar">{initialFor(item.actor)}</div>
                      <div className="after-hours-feed-copy">
                        <div className="after-hours-feed-meta">
                          <strong>{personLabel(item.actor)}</strong>
                          <span>@{item.actor.username}</span>
                          <time>{relativeTime(item.createdAt)}</time>
                        </div>
                        <p><b>called out @{item.target?.username}</b> for this round.</p>
                        <small>{item.promptText}</small>
                      </div>
                    </article>
                  );
                }

                return (
                  <article className="after-hours-feed-item" key={item.id}>
                    <div className="after-hours-avatar">{initialFor(item.actor)}</div>
                    <div className="after-hours-feed-copy">
                      <div className="after-hours-feed-meta">
                        <strong>{personLabel(item.actor)}</strong>
                        <span>@{item.actor.username}</span>
                        <time>{relativeTime(item.createdAt)}</time>
                      </div>
                      <p>picked <b>{item.choice}</b></p>
                      <small>{item.promptText}</small>
                      {!isOwn && (
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
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="after-hours-people">
          <div className="after-hours-section-label">
            <span>AROUND NOW</span>
            <small>{room.presenceCount}</small>
          </div>
          <div className="after-hours-people-list">
            {(room.people || []).map((person) => (
              <div className="after-hours-person" key={person.username}>
                <div className="after-hours-avatar">{initialFor(person)}</div>
                <div>
                  <strong>{personLabel(person)}</strong>
                  <span>@{person.username}</span>
                </div>
                {person.isYou ? (
                  <small className="after-hours-you">you</small>
                ) : person.answeredCurrent ? (
                  <small>picked</small>
                ) : (
                  <button
                    type="button"
                    disabled={Boolean(busy)}
                    onClick={() => submitCallout(person.username)}
                  >
                    Call out
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </section>
  );
};
