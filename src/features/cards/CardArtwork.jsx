import { useId } from 'react';
import './CardArtwork.css';

const colors = {
  PURIFY: ['#dbe6cc', '#50766a', '#24473e'], STEAL: ['#ead0b8', '#bb6652', '#552d28'],
  SIGNAL_FLARE: ['#f0dbad', '#d68438', '#5e3624'], CHAOS_TICKET: ['#d5ccec', '#8064ab', '#38304e'],
  ORBIT: ['#cbdede', '#4b8386', '#243e43'], GHOST: ['#dce0d6', '#849788', '#36443a'],
  MENACE: ['#e8cabb', '#b55f44', '#552e24'], OATH: ['#e2d9b7', '#9b8646', '#4e4426'],
  ECHO: ['#d0d2e3', '#7d83af', '#383c59'], EMBER: ['#ebc8b0', '#c66e38', '#623722'],
  NO_SIGNAL: ['#d2d8d8', '#7c9294', '#344449'], WATCHER: ['#dad1df', '#92729f', '#48344f']
};
const motifs = {
  PURIFY: <><path d="M60 31C55 45 34 64 34 85a26 26 0 0052 0c0-21-21-40-26-54Z" fill="var(--art-color)" /><path d="M38 78h44M35 88h50M39 98h42" stroke="var(--art-paper)" strokeWidth="3" /><path d="M31 113c16-8 42-8 58 0M24 122c22-10 50-10 72 0" fill="none" stroke="var(--art-ink)" strokeWidth="1.4" /><path d="m89 35 3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" fill="var(--art-ink)" /><path d="m26 57 2 5 5 2-5 2-2 5-2-5-5-2 5-2Z" fill="var(--art-color)" /></>,
  STEAL: <><circle cx="72" cy="65" r="22" fill="var(--art-color)" stroke="var(--art-ink)" strokeWidth="1.5" /><circle cx="72" cy="65" r="14" fill="none" stroke="var(--art-paper)" strokeWidth="1.5" /><path d="M25 119V84l14-30 8 4-8 27 5 6 14-42 9 3-9 37 6 3 12-32 9 4-10 31 10-15 8 5-21 33-23 14Z" fill="var(--art-ink)" /><path d="m38 108 8-13 10 9 11-7" fill="none" stroke="var(--art-paper)" strokeWidth="1.4" /><path d="M22 36h24M34 24v24M89 111h10M94 106v10" stroke="var(--art-color)" strokeWidth="1.5" /></>,
  SIGNAL_FLARE: <><g stroke="var(--art-color)" strokeWidth="1.4" fill="none"><path d="M60 29v18M34 33l9 17M86 33l-9 17M20 53l20 8M100 53l-20 8M17 80h22M103 80H81" /><circle cx="60" cy="67" r="31" opacity=".4" /></g><path d="M61 32c2 17 26 25 22 43-3 15-13 23-24 23-14 0-23-9-23-21 0-10 8-23 16-32-2 13 2 18 6 19 9-9 1-18 3-32Z" fill="var(--art-color)" /><path d="M62 65c-2 11 8 13 8 23a11 11 0 01-22 0c0-7 6-14 14-23Z" fill="var(--art-paper)" /><path d="m51 102 5 28h8l5-28Z" fill="var(--art-ink)" /><path d="M48 103h24M50 109h20" stroke="var(--art-paper)" strokeWidth="2" /><path d="M35 137h50" stroke="var(--art-color)" strokeWidth="1.3" /></>,
  CHAOS_TICKET: <><ellipse cx="60" cy="77" rx="43" ry="31" fill="none" stroke="var(--art-color)" strokeWidth="1.5" transform="rotate(-25 60 77)" /><path d="m34 38 43-5 7 8-6 8 9 7-5 8 9 8-2 43-44 6-7-8 5-8-8-7 5-8-9-8Z" fill="var(--art-ink)" transform="rotate(12 60 77)" /><path d="M46 59h28M44 68h31M46 101h27" stroke="var(--art-paper)" strokeWidth="2" /><g fill="var(--art-color)"><circle cx="51" cy="80" r="3" /><circle cx="69" cy="89" r="3" /><circle cx="59" cy="85" r="3" /><path d="m22 104 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" /><path d="m99 39-5 10 8-2-5 13 1-9-8 2Z" /></g></>,
  ORBIT: <><g fill="none" stroke="var(--art-ink)" strokeWidth="2"><ellipse cx="60" cy="81" rx="42" ry="20" transform="rotate(-35 60 81)" /><ellipse cx="60" cy="81" rx="42" ry="20" transform="rotate(35 60 81)" /></g><circle cx="60" cy="81" r="13" fill="var(--art-color)" /><circle cx="91" cy="60" r="6" fill="var(--art-ink)" /></>,
  GHOST: <><path d="M31 119V70a29 29 0 0158 0v49l-10-8-10 8-9-8-10 8-9-8Z" fill="var(--art-color)" /><ellipse cx="49" cy="76" rx="5" ry="8" fill="var(--art-ink)" /><ellipse cx="71" cy="76" rx="5" ry="8" fill="var(--art-ink)" /><path d="M23 130h74" stroke="var(--art-ink)" /></>,
  MENACE: <><path d="m60 35 11 19 20-5-4 21 16 12-19 10 2 24-21-9-16 16-7-23-23-3 12-19-10-19 24-1Z" fill="var(--art-color)" /><path d="m44 77 10 3m13-3 9-4M46 94c9 7 20 7 29-3" fill="none" stroke="var(--art-ink)" strokeWidth="3" /></>,
  OATH: <><rect x="27" y="43" width="37" height="67" rx="18" transform="rotate(-30 45 77)" fill="none" stroke="var(--art-color)" strokeWidth="10" /><rect x="54" y="53" width="37" height="67" rx="18" transform="rotate(-30 72 87)" fill="none" stroke="var(--art-ink)" strokeWidth="10" /></>,
  ECHO: <><g fill="none" stroke="var(--art-color)" strokeWidth="3"><path d="M18 116V75a42 42 0 0184 0v41M28 116V75a32 32 0 0164 0v41M38 116V75a22 22 0 0144 0v41" /></g><path d="M48 116V75a12 12 0 0124 0v41Z" fill="var(--art-ink)" /></>,
  EMBER: <><path d="M70 30c-14 10-2 31-18 38-4-12-10-13-15-20 4 29-17 26-8 53 10 30 55 31 64 1 7-23-9-42-23-72Z" fill="var(--art-color)" /><path d="M65 75c-4 11-20 18-17 32 3 16 24 15 28 1 3-12-8-19-11-33Z" fill="var(--art-ink)" /></>,
  NO_SIGNAL: <><g fill="none" stroke="var(--art-color)" strokeWidth="3"><path d="M25 69a45 45 0 0170 0M36 82a30 30 0 0148 0M47 95a15 15 0 0126 0" /></g><path d="m26 119 68-76" stroke="var(--art-ink)" strokeWidth="7" /><circle cx="60" cy="108" r="6" fill="var(--art-ink)" /></>,
  WATCHER: <><path d="M17 81c28-37 58-37 86 0-28 37-58 37-86 0Z" fill="var(--art-color)" /><circle cx="60" cy="81" r="23" fill="var(--art-paper)" /><circle cx="60" cy="81" r="13" fill="var(--art-ink)" /><circle cx="65" cy="75" r="4" fill="var(--art-paper)" /><path d="M60 38V25M25 46l-9-8M95 46l9-8" stroke="var(--art-ink)" strokeWidth="2" /></>
};
export const CardArtwork = ({ cardId, size = 74, variant = 'card' }) => {
  const uid = useId().replaceAll(':', '');
  const palette = colors[cardId] || colors.ORBIT;
  return <span className={`card-artwork ${variant === 'stamp' ? 'is-stamp' : ''}`} style={{ '--art-size': size+'px', '--art-paper': palette[0], '--art-color': palette[1], '--art-ink': palette[2] }} data-card-art={cardId} aria-hidden="true">
    <svg viewBox="0 0 120 160"><defs><pattern id={'grain'+uid} width="5" height="5" patternUnits="userSpaceOnUse"><path d="M0 0h1M3 3h1" stroke="var(--art-ink)" strokeWidth=".6" opacity=".17" /></pattern></defs>
      <rect width="120" height="160" rx="5" fill="var(--art-paper)" /><rect x="7" y="7" width="106" height="146" rx="2" fill="none" stroke="var(--art-ink)" strokeWidth=".5" opacity=".45" />
      <path d="M7 21h106M7 140h106" stroke="var(--art-ink)" strokeWidth=".5" opacity=".4" /><text x="13" y="16" fontSize="5" letterSpacing="1.1" fill="var(--art-ink)">HAKOWARE</text><text x="106" y="16" textAnchor="end" fontSize="5" fill="var(--art-ink)">✦</text>
      {motifs[cardId] || motifs.ORBIT}<rect width="120" height="160" fill={`url(#grain${uid})`} />
      <text x="60" y="149" textAnchor="middle" fontSize="4.6" letterSpacing="1.2" fill="var(--art-ink)">{['PURIFY','STEAL','SIGNAL_FLARE','CHAOS_TICKET'].includes(cardId) ? 'PRESSURE SERIES' : 'FOUNDING COLLECTION'}</text>
    </svg>
  </span>;
};
