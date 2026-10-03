import React from 'react';
import { MARKET_ART } from '../profile/marketArt';
import './CardArtwork.css';

const WALL_MARKS = [
  'ORBIT',
  'GHOST',
  'MENACE',
  'OATH',
  'ECHO',
  'EMBER',
  'NO_SIGNAL',
  'WATCHER',
];

export const CardArtwork = ({ cardId, size = 74, variant = 'card' }) => {
  const index = WALL_MARKS.indexOf(cardId);
  return (
    <span
      className={variant === 'stamp' ? 'card-artwork is-stamp' : 'card-artwork'}
      style={{ '--art-size': size + 'px' }}
      aria-hidden="true"
    >
      {MARKET_ART[cardId] ? (
        <img src={MARKET_ART[cardId]} alt="" decoding="async" />
      ) : index >= 0 ? (
        <span
          className="card-artwork-mark"
          style={{
            backgroundPosition: `${((index % 4) * 100) / 3}% ${Math.floor(index / 4) * 100}%`,
          }}
        />
      ) : null}
    </span>
  );
};
