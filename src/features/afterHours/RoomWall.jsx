import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Check,
  Move,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  Undo2,
} from 'lucide-react';
import { ActionSheet } from '../../shared/components/ActionSheet';
import { CardArtwork } from '../cards/CardArtwork';
import {
  getRoomWall,
  moveWallPiece,
  postWallPiece,
  reactToWallPiece,
  removeWallPiece,
} from '../../services/roomWallService';
import './RoomWall.css';

const PALETTE = ['gold', 'red', 'green', 'blue', 'ivory', 'violet'];
const nameFor = (piece) =>
  piece.actor?.displayName || piece.actor?.username || 'Former player';
const pointIn = (event, element) => {
  const bounds = element.getBoundingClientRect();
  return [
    Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width)),
    Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)),
  ];
};
const recentWeeks = () => {
  const monday = new Date();
  monday.setUTCHours(0, 0, 0, 0);
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  return Array.from({ length: 4 }, (_, index) => {
    const date = new Date(monday);
    date.setUTCDate(date.getUTCDate() - index * 7);
    return {
      key: date.toISOString().slice(0, 10),
      label:
        index === 0
          ? 'This week'
          : 'Week of ' +
            date.toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              timeZone: 'UTC',
            }),
    };
  });
};
const Sketch = ({ strokes = [], label = 'Sketch' }) => (
  <svg
    className="wall-sketch"
    viewBox="0 0 200 200"
    preserveAspectRatio="none"
    role="img"
    aria-label={label}
  >
    {strokes.map((stroke, index) => (
      <path
        key={index}
        d={
          stroke
            .map(([x, y], point) => `${point ? 'L' : 'M'}${x * 200} ${y * 200}`)
            .join(' ') + (stroke.length === 1 ? ' l.1 .1' : '')
        }
        fill="none"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ))}
  </svg>
);

const SketchEditor = ({ strokes, onChange, color }) => {
  const drawing = useRef(null);
  const [current, setCurrent] = useState([]);
  const finish = (event) => {
    if (!drawing.current || drawing.current.pointer !== event.pointerId) return;
    const points = drawing.current.points;
    const sampled =
      points.length <= 40
        ? points
        : Array.from(
            { length: 40 },
            (_, index) =>
              points[Math.round((index * (points.length - 1)) / 39)],
          );
    drawing.current = null;
    setCurrent([]);
    onChange([...strokes, sampled]);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  return (
    <div className="wall-sketch-editor">
      <div
        className={'wall-drawing-pad wall-color-' + color}
        aria-label="Sketch pad. Draw with a finger or pointer."
        onPointerDown={(event) => {
          if (strokes.length >= 12 || drawing.current || event.button !== 0)
            return;
          event.currentTarget.setPointerCapture(event.pointerId);
          const points = [pointIn(event, event.currentTarget)];
          drawing.current = { pointer: event.pointerId, points };
          setCurrent(points);
        }}
        onPointerMove={(event) => {
          if (!drawing.current || drawing.current.pointer !== event.pointerId)
            return;
          const point = pointIn(event, event.currentTarget);
          const points = drawing.current.points;
          if (
            Math.hypot(
              point[0] - points.at(-1)[0],
              point[1] - points.at(-1)[1],
            ) < 0.004
          )
            return;
          if (points.length >= 512) points.splice(1, 1);
          drawing.current.points = [...points, point];
          setCurrent(drawing.current.points);
        }}
        onPointerUp={finish}
        onPointerCancel={() => {
          drawing.current = null;
          setCurrent([]);
        }}
      >
        <Sketch
          strokes={current.length ? [...strokes, current] : strokes}
          label="Your sketch"
        />
        {!strokes.length && !current.length && (
          <span>Draw something that belongs here.</span>
        )}
      </div>
      <div className="wall-sketch-actions">
        <small>{strokes.length}/12 strokes</small>
        <button
          type="button"
          disabled={!strokes.length}
          onClick={() => onChange(strokes.slice(0, -1))}
        >
          <Undo2 size={16} /> Undo
        </button>
        <button
          type="button"
          disabled={!strokes.length}
          onClick={() => onChange([])}
        >
          Clear
        </button>
      </div>
      <p className="wall-hint">
        Drawing works with touch or a mouse. Choose a note or sticker if you
        prefer the keyboard.
      </p>
    </div>
  );
};

export const RoomWall = ({
  focusPieceId,
  requestedWeek,
  onNavigate,
  showToast,
}) => {
  const [week, setWeek] = useState(requestedWeek || '');
  const [wall, setWall] = useState(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [movingId, setMovingId] = useState(null);
  const [kind, setKind] = useState('NOTE');
  const [text, setText] = useState('');
  const [cardId, setCardId] = useState('');
  const [color, setColor] = useState('gold');
  const [strokes, setStrokes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [position, setPosition] = useState(null);
  const alive = useRef(true);
  const generation = useRef(0);
  const busyRef = useRef(false);
  const draftKey = useRef(null);
  const focusDone = useRef(null);
  const drag = useRef(null);
  const board = useRef(null);
  const load = useCallback(async () => {
    const request = ++generation.current;
    try {
      const next = await getRoomWall(week);
      if (alive.current && request === generation.current) {
        setWall(next);
        setError('');
      }
    } catch (err) {
      if (alive.current && request === generation.current)
        setError(err.message || 'Could not open the wall');
    }
  }, [week]);
  useEffect(() => {
    if ((requestedWeek || '') !== week) {
      setWeek(requestedWeek || '');
      setWall(null);
      setMovingId(null);
      setPosition(null);
    }
  }, [requestedWeek]);
  useEffect(() => {
    alive.current = true;
    void load();
    const refresh = () => {
      if (
        document.visibilityState === 'visible' &&
        !busyRef.current &&
        !drag.current
      )
        void load();
    };
    const timer = setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      alive.current = false;
      generation.current += 1;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [load]);
  useEffect(() => {
    if (!wall || !focusPieceId || focusDone.current === focusPieceId) return;
    focusDone.current = focusPieceId;
    if (wall.pieces.some((piece) => piece.id === focusPieceId)) {
      setSelectedId(focusPieceId);
      setSheet('piece');
    } else setError('This mark is no longer on this wall.');
  }, [wall, focusPieceId]);
  const run = async (operation, message, close = true) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setFormError('');
    generation.current += 1;
    try {
      const next = await operation();
      if (!alive.current) return false;
      setWall(next);
      setError('');
      if (close) setSheet(null);
      if (message) showToast?.(message, 'SUCCESS');
      return true;
    } catch (err) {
      if (alive.current) {
        setFormError(err.message || 'Could not save your mark');
        if (!sheet) setError(err.message || 'Could not save your move');
      }
      return false;
    } finally {
      busyRef.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const close = () => {
    if (!busyRef.current) {
      setSheet(null);
      setFormError('');
    }
  };
  const selected = wall?.pieces.find((piece) => piece.id === selectedId);
  const moving = wall?.pieces.find((piece) => piece.id === movingId);
  const ownCount = wall?.pieces.filter((piece) => piece.isOwn).length || 0;
  const openComposer = () => {
    setSheet('compose');
    setFormError('');
  };
  const submit = async (event) => {
    event.preventDefault();
    const payload = {
      kind,
      color,
      ...(kind === 'NOTE'
        ? { text }
        : kind === 'STICKER'
          ? { cardId }
          : { strokes }),
    };
    const signature = JSON.stringify(payload);
    if (draftKey.current?.signature !== signature)
      draftKey.current = {
        signature,
        clientId: crypto.randomUUID(),
        x: 0.35 + Math.random() * 0.3,
        y: 0.3 + Math.random() * 0.4,
        rotation: Math.round(Math.random() * 12 - 6),
      };
    if (
      await run(
        () => postWallPiece({ ...payload, ...draftKey.current }),
        'Your mark is on the wall.',
      )
    ) {
      setText('');
      setStrokes([]);
      draftKey.current = null;
    }
  };
  const boundsFor = (piece, x, y) => {
    const width = board.current?.clientWidth || 300;
    const height = board.current?.clientHeight || 460;
    const marginX = Math.min(0.3, (piece.kind === 'NOTE' ? 70 : 54) / width);
    const marginY = 60 / height;
    return {
      x: Math.max(marginX, Math.min(1 - marginX, x)),
      y: Math.max(marginY, Math.min(1 - marginY, y)),
      rotation: piece.rotation || 0,
    };
  };
  const saveMove = async (piece, next) => {
    await run(() => moveWallPiece(piece.id, next), null, false);
    if (alive.current) setPosition(null);
  };
  const nudge = (dx, dy) => {
    if (!moving || busyRef.current) return;
    const next = boundsFor(moving, moving.x + dx, moving.y + dy);
    setPosition({ id: moving.id, ...next });
    void saveMove(moving, next);
  };
  const changeWeek = (value) => {
    onNavigate?.('afterHours', { wall: true, week: value });
    setWeek(value);
    setWall(null);
    setSheet(null);
    setSelectedId(null);
    setMovingId(null);
    setPosition(null);
    setError('');
  };
  return (
    <section className="room-wall" aria-label="After Hours shared wall">
      <header className="wall-heading">
        <div>
          <p className="eyebrow">This week’s wall</p>
          <h2>Leave your mark.</h2>
          <p>
            Sketch, leave a note, or stamp a card. Fresh every Monday.
          </p>
        </div>
      </header>
      <div className="wall-topline">
        <label className="wall-week-label">
          <select
            aria-label="Choose a weekly wall"
            value={wall?.weekKey || week || recentWeeks()[0].key}
            onChange={(event) => changeWeek(event.target.value)}
          >
            {recentWeeks().map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <span>
          {wall
            ? wall.readOnly
              ? 'Read-only keepsake'
              : `${ownCount}/${wall.limits.perPerson} your marks`
            : 'Opening wall…'}
        </span>
      </div>
      {error && (
        <div className="wall-error" role="status">
          <p>{error}</p>
          <button onClick={() => void load()}>Retry</button>
          {week && <button onClick={() => changeWeek('')}>This week</button>}
        </div>
      )}
      <div className={`wall-board ${movingId ? 'is-moving' : ''}`} ref={board}>
        <span className="wall-board-label" aria-hidden="true">
          AFTER HOURS / {wall?.weekKey || 'THIS WEEK'}
        </span>
        {!wall && !error && (
          <p className="wall-board-empty" role="status">
            Opening the wall…
          </p>
        )}
        {wall && !wall.pieces.length && (
          <div className="wall-board-empty">
            <Pencil size={30} strokeWidth={1.4} />
            <h3>Someone has to start it.</h3>
            <p>
              {wall.readOnly
                ? 'No marks were left here that week.'
                : 'Draw a face. Stamp a ghost. Leave a note for whoever wanders in.'}
            </p>
            {!wall.readOnly && (
              <button onClick={openComposer}>
                Leave the first mark <Plus size={16} />
              </button>
            )}
          </div>
        )}
        {wall?.pieces.map((piece) => {
          const display = position?.id === piece.id ? position : piece;
          const isMoving = movingId === piece.id;
          return (
            <button
              key={piece.id}
              className={`wall-piece wall-piece-${piece.kind.toLowerCase()} wall-color-${piece.color} ${isMoving ? 'is-moving' : ''}`}
              style={{
                left: display.x * 100 + '%',
                top: display.y * 100 + '%',
                '--piece-rotation': display.rotation + 'deg',
              }}
              aria-label={`${piece.kind === 'NOTE' ? piece.text : piece.kind === 'STICKER' ? piece.cardId.replaceAll('_', ' ') + ' sticker' : 'Sketch'} by ${nameFor(piece)}${isMoving ? '. Use arrow keys to move.' : ''}`}
              disabled={busy}
              onClick={() => {
                if (isMoving) return;
                setSelectedId(piece.id);
                setSheet('piece');
                setFormError('');
              }}
              onKeyDown={(event) => {
                if (
                  !isMoving ||
                  !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                nudge(
                  event.key === 'ArrowLeft'
                    ? -0.025
                    : event.key === 'ArrowRight'
                      ? 0.025
                      : 0,
                  event.key === 'ArrowUp'
                    ? -0.025
                    : event.key === 'ArrowDown'
                      ? 0.025
                      : 0,
                );
              }}
              onPointerDown={(event) => {
                if (!isMoving || busyRef.current || event.button !== 0) return;
                event.currentTarget.setPointerCapture(event.pointerId);
                drag.current = {
                  pointer: event.pointerId,
                  start: pointIn(event, board.current),
                  piece,
                  moved: false,
                };
              }}
              onPointerMove={(event) => {
                if (
                  !isMoving ||
                  !drag.current ||
                  drag.current.pointer !== event.pointerId
                )
                  return;
                const point = pointIn(event, board.current);
                const delta = [
                  point[0] - drag.current.start[0],
                  point[1] - drag.current.start[1],
                ];
                if (Math.hypot(...delta) < 0.008 && !drag.current.moved) return;
                drag.current.moved = true;
                const next = boundsFor(
                  piece,
                  drag.current.piece.x + delta[0],
                  drag.current.piece.y + delta[1],
                );
                drag.current.next = next;
                setPosition({ id: piece.id, ...next });
              }}
              onPointerUp={(event) => {
                if (
                  !isMoving ||
                  !drag.current ||
                  drag.current.pointer !== event.pointerId
                )
                  return;
                if (event.currentTarget.hasPointerCapture(event.pointerId))
                  event.currentTarget.releasePointerCapture(event.pointerId);
                const next = drag.current.next;
                drag.current = null;
                if (next) void saveMove(piece, next);
              }}
              onPointerCancel={() => {
                drag.current = null;
                setPosition(null);
              }}
            >
              {piece.kind === 'NOTE' ? (
                <span className="wall-note-text">{piece.text}</span>
              ) : piece.kind === 'STICKER' ? (
                <CardArtwork cardId={piece.cardId} size={46} variant="stamp" />
              ) : (
                <Sketch
                  strokes={piece.strokes}
                  label={'Sketch by ' + nameFor(piece)}
                />
              )}
              <small>
                {piece.isOwn ? 'you' : piece.actor?.username || nameFor(piece)}
              </small>
            </button>
          );
        })}
      </div>
      {moving ? (
        <div className="wall-move-tools" aria-label="Move your mark">
          <span>Drag your mark or use the arrows.</span>
          <div>
            {[
              [ArrowLeft, -0.025, 0, 'Move left'],
              [ArrowUp, 0, -0.025, 'Move up'],
              [ArrowDown, 0, 0.025, 'Move down'],
              [ArrowRight, 0.025, 0, 'Move right'],
            ].map(([Icon, dx, dy, label]) => (
              <button
                key={label}
                disabled={busy}
                aria-label={label}
                onClick={() => nudge(dx, dy)}
              >
                <Icon size={18} />
              </button>
            ))}
            <button
              disabled={busy}
              onClick={() => {
                setMovingId(null);
                setPosition(null);
                drag.current = null;
              }}
            >
              <Check size={16} /> Done
            </button>
          </div>
        </div>
      ) : (
        <div className="wall-bottomline">
          <button
            className="wall-browse"
            disabled={!wall?.pieces.length}
            onClick={() => {
              setSheet('list');
              setFormError('');
            }}
          >
            Browse {wall?.pieces.length || 0} marks
          </button>
          {wall && !wall.readOnly && (
            <button
              className="wall-primary"
              disabled={
                busy ||
                ownCount >= wall.limits.perPerson ||
                wall.pieces.length >= wall.limits.total
              }
              onClick={openComposer}
            >
              <Plus size={18} />{' '}
              {ownCount >= wall.limits.perPerson
                ? 'Your wall is full'
                : 'Add your mark'}
            </button>
          )}
        </div>
      )}
      {sheet === 'list' && (
        <ActionSheet title="On this wall" onClose={close}>
          <p className="wall-hint">
            Find a mark even when others overlap it. Past walls stay for four
            weeks.
          </p>
          <div className="wall-mark-list">
            {wall.pieces.map((piece) => (
              <button
                key={piece.id}
                onClick={() => {
                  setSelectedId(piece.id);
                  setSheet('piece');
                }}
              >
                {piece.kind === 'STICKER' ? (
                  <CardArtwork cardId={piece.cardId} size={36} />
                ) : piece.kind === 'DRAWING' ? (
                  <Pencil size={22} />
                ) : (
                  <StickyNote size={22} />
                )}
                <span>
                  <strong>
                    {piece.kind === 'NOTE'
                      ? piece.text
                      : piece.kind === 'STICKER'
                        ? piece.cardId.replaceAll('_', ' ').toLowerCase() +
                          ' sticker'
                        : 'Sketch'}
                  </strong>
                  <small>
                    {piece.isOwn ? 'By you' : 'By ' + nameFor(piece)}
                  </small>
                </span>
              </button>
            ))}
          </div>
        </ActionSheet>
      )}
      {sheet === 'compose' && (
        <ActionSheet
          title="Leave your mark"
          onClose={close}
          footer={
            <button
              form="wall-compose-form"
              className="wall-primary wall-submit"
              disabled={
                busy ||
                (kind === 'NOTE'
                  ? !text.trim()
                  : kind === 'STICKER'
                    ? !wall.stickers.some((card) => card.id === cardId)
                    : !strokes.length)
              }
            >
              {busy ? 'Saving…' : 'Put it on the wall'}
            </button>
          }
        >
          <form
            id="wall-compose-form"
            className="wall-compose"
            onSubmit={submit}
          >
            <div className="wall-compose-kinds" aria-label="Type of mark">
              {[
                ['NOTE', StickyNote, 'Note'],
                ['DRAWING', Pencil, 'Sketch'],
                ['STICKER', Plus, 'Sticker'],
              ].map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  disabled={busy}
                  aria-pressed={kind === value}
                  onClick={() => setKind(value)}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
            {kind === 'NOTE' ? (
              <label className="wall-note-label">
                A note for the room
                <textarea
                  aria-label="A note for the room"
                  value={text}
                  maxLength={90}
                  rows={3}
                  onChange={(event) => setText(event.target.value)}
                  placeholder="Something worth leaving behind…"
                  disabled={busy}
                />
                <small>{text.length}/90 · signed with your name</small>
              </label>
            ) : kind === 'DRAWING' ? (
              <SketchEditor
                strokes={strokes}
                onChange={setStrokes}
                color={color}
              />
            ) : (
              <div className="wall-sticker-picker">
                {wall.stickers.length ? (
                  <>
                    <p>Pick an available card. Stamping keeps your copy.</p>
                    <div>
                      {wall.stickers.map((card) => (
                        <button
                          type="button"
                          key={card.id}
                          disabled={busy}
                          aria-pressed={cardId === card.id}
                          onClick={() => setCardId(card.id)}
                        >
                          <CardArtwork cardId={card.id} size={32} />
                          <span>{card.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <p>
                      Your collection doesn’t have a wall mark yet. Notes and
                      sketches are ready to use.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        close();
                        onNavigate?.('arena', { section: 'cards' });
                      }}
                    >
                      Browse card collection <ArrowRight size={16} />
                    </button>
                  </>
                )}
              </div>
            )}
            {kind !== 'STICKER' && (
              <div className="wall-palette" aria-label="Mark color">
                {PALETTE.map((value) => (
                  <button
                    type="button"
                    key={value}
                    disabled={busy}
                    className={'wall-color-' + value}
                    aria-label={(value === 'ivory' ? 'ink' : value) + ' color'}
                    aria-pressed={color === value}
                    onClick={() => setColor(value)}
                  >
                    <span>{color === value && <Check size={15} />}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="wall-hint">
              Everyone in After Hours can see your mark. You can move or remove
              your own work.
            </p>
          </form>
          {formError && (
            <p className="wall-error" role="status">
              {formError}
            </p>
          )}
        </ActionSheet>
      )}
      {sheet === 'piece' && selected && (
        <ActionSheet title={'By ' + nameFor(selected)} onClose={close}>
          <div className={'wall-piece-preview wall-color-' + selected.color}>
            {selected.kind === 'NOTE' ? (
              <p>{selected.text}</p>
            ) : selected.kind === 'STICKER' ? (
              <CardArtwork cardId={selected.cardId} size={85} />
            ) : (
              <Sketch strokes={selected.strokes} />
            )}
          </div>
          <p className="wall-hint">
            {selected.actor?.username
              ? '@' + selected.actor.username + ' · '
              : ''}
            {new Date(selected.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
          </p>
          <div className="wall-reactions" aria-label="React to this mark">
            {wall.reactions.map((reaction) => (
              <button
                key={reaction}
                disabled={busy || wall.readOnly}
                aria-label={'React ' + reaction}
                aria-pressed={selected.reactions.viewerReaction === reaction}
                onClick={() =>
                  void run(
                    () => reactToWallPiece(selected.id, reaction),
                    null,
                    false,
                  )
                }
              >
                <span>{reaction}</span>
                <small>{selected.reactions.counts[reaction] || 0}</small>
              </button>
            ))}
          </div>
          {selected.isOwn && !wall.readOnly && (
            <div className="wall-owner-actions">
              <button
                disabled={busy}
                onClick={() => {
                  close();
                  setMovingId(selected.id);
                  requestAnimationFrame(() =>
                    board.current
                      ?.querySelector('.wall-piece.is-moving')
                      ?.focus({ preventScroll: true }),
                  );
                }}
              >
                <Move size={17} /> Move on wall
              </button>
              <button
                disabled={busy}
                onClick={() =>
                  void run(
                    () => removeWallPiece(selected.id),
                    'Your mark was removed.',
                  )
                }
              >
                <Trash2 size={16} /> Remove your mark
              </button>
            </div>
          )}
          {formError && (
            <p className="wall-error" role="status">
              {formError}
            </p>
          )}
        </ActionSheet>
      )}
    </section>
  );
};
