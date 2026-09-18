import React from 'react';
import { Clock3, Dice5, Flame, Sparkles, UsersRound } from 'lucide-react';
import './WorldEventBanner.css';

const EVENT_META = {
  DUO_RUSH: { icon: UsersRound, effect: 'Duo XP +25%' },
  OPEN_MIC: { icon: Sparkles, effect: 'Voice +10 XP' },
  CLEAN_SWEEP: { icon: Flame, effect: 'Check-ins +5 XP' },
  ANOMALY_SEASON: { icon: Dice5, effect: 'Chaos cycles faster' }
};

const timeLeft = (endsAt) => {
  if (!endsAt) return 'Active now';
  const remaining = new Date(endsAt).getTime() - Date.now();
  if (remaining <= 0) return 'Ending now';

  const hours = Math.ceil(remaining / 3600000);
  if (hours < 24) return `${hours}h remaining`;

  const days = Math.ceil(hours / 24);
  return `${days}d remaining`;
};

export const WorldEventBanner = ({ event, compact = false }) => {
  if (!event) return null;

  const meta = EVENT_META[event.id] || { icon: Flame, effect: 'Season modifier active' };
  const Icon = meta.icon;

  return (
    <section
      className={`world-event-banner ${compact ? 'compact' : ''}`}
      aria-label={`Season event active: ${event.name}`}
    >
      <div className="world-event-signal">
        <span className="world-event-pulse" aria-hidden="true" />
        <span>SEASON EVENT ACTIVE</span>
      </div>

      <div className="world-event-body">
        <div className="world-event-mark" aria-hidden="true">
          <Icon size={20} strokeWidth={1.8} />
        </div>

        <div className="world-event-copy">
          <div className="world-event-meta">
            <span>{event.theme}</span>
            <b>{meta.effect}</b>
          </div>
          <h2>{event.name}</h2>
          <p>{event.description}</p>
        </div>

        <div className="world-event-time">
          <Clock3 size={14} strokeWidth={1.8} />
          <span>{timeLeft(event.endsAt)}</span>
        </div>
      </div>
    </section>
  );
};
