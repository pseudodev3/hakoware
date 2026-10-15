import assert from 'node:assert/strict';
import test from 'node:test';
import { trackChatViewport } from '../src/lib/chatViewport.js';
const { Event, EventTarget } = globalThis;

const fixture = () => {
  const previous = { window: globalThis.window, document: globalThis.document };
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  const frames = new Map(), styles = new Map(), classes = new Set(), writes = [];
  let next = 0;
  const window = Object.assign(new EventTarget(), { visualViewport: viewport, innerWidth: 390, innerHeight: 844,
    requestAnimationFrame(fn) { frames.set(++next, fn); return next; }, cancelAnimationFrame(id) { frames.delete(id); } });
  const input = { matches: () => true }, document = Object.assign(new EventTarget(), { activeElement: null });
  const shell = { contains: node => node === input,
    style: { getPropertyValue: name => styles.get(name) || '', setProperty(name, value) { styles.set(name, value); writes.push([name, value]); }, removeProperty: name => styles.delete(name) },
    classList: { toggle(name, on) { if (on) classes.add(name); else classes.delete(name); }, remove: name => classes.delete(name) } };
  globalThis.window = window; globalThis.document = document;
  const cleanup = trackChatViewport(shell);
  return { window, document, input, viewport, frames, styles, classes, writes, cleanup,
    flush() { const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); },
    resize(height) { viewport.height = height; viewport.dispatchEvent(new Event('resize')); },
    focus() { document.activeElement = input; document.dispatchEvent(new Event('focusin')); },
    close() { cleanup(); Object.assign(globalThis, previous); } };
};

test('installed iOS keyboard is detected when innerHeight and visualViewport both shrink', () => {
  const f = fixture();
  try {
    f.focus(); f.window.innerHeight = 360; f.resize(360); f.flush();
    assert.equal(f.classes.has('friend-keyboard-open'), true);
    assert.equal(f.styles.get('--friend-viewport-height'), '360px');
    f.viewport.offsetTop = 125; f.viewport.dispatchEvent(new Event('scroll')); f.flush();
    assert.equal(f.styles.get('--friend-viewport-top'), '125px');
    assert.equal(f.classes.has('friend-keyboard-open'), true);
    f.document.activeElement = null; f.document.dispatchEvent(new Event('focusout')); f.flush();
    assert.equal(f.classes.has('friend-keyboard-open'), false);
    f.window.innerHeight = 844; f.resize(844); f.flush();
    assert.equal(f.styles.get('--friend-viewport-height'), '844px');
  } finally { f.close(); }
});

test('ordinary focus, orientation changes and pinch zoom do not masquerade as a keyboard', () => {
  const f = fixture();
  try {
    f.focus(); f.flush(); assert.equal(f.classes.has('friend-keyboard-open'), false);
    f.window.innerWidth = 844; f.window.innerHeight = 390; f.resize(390); f.flush();
    assert.equal(f.classes.has('friend-keyboard-open'), false);
    const before = [...f.styles]; f.viewport.scale = 2; f.viewport.offsetTop = 90; f.resize(160); f.flush();
    assert.deepEqual([...f.styles], before);
    f.viewport.scale = 1; f.resize(200); f.flush(); assert.equal(f.classes.has('friend-keyboard-open'), true);
  } finally { f.close(); }
});

test('viewport events are coalesced, unchanged geometry is not rewritten and leaving chat cancels pending work', () => {
  const f = fixture();
  try {
    f.resize(700); f.resize(650); f.viewport.dispatchEvent(new Event('scroll'));
    assert.equal(f.frames.size, 1); f.flush(); assert.equal(f.styles.get('--friend-viewport-height'), '650px');
    const writes = f.writes.length; f.resize(650); f.flush(); assert.equal(f.writes.length, writes);
    f.resize(360); f.cleanup(); assert.equal(f.frames.size, 0); assert.equal(f.styles.size, 0);
    f.resize(200); f.focus(); f.window.dispatchEvent(new Event('resize')); assert.equal(f.frames.size, 0);
    assert.equal(f.classes.has('friend-keyboard-open'), false);
  } finally { f.close(); }
});
