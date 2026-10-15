// Keep native input geometry stable while Safari resizes and pans its viewport.
export const trackChatViewport = shell => {
  const viewport = window.visualViewport;
  if (!shell || !viewport) return () => {};
  let frame = null, width = window.innerWidth;
  let unobscuredHeight = Math.max(window.innerHeight, viewport.height);
  const update = () => {
    frame = null;
    if (viewport.scale !== 1) return;
    if (window.innerWidth !== width) {
      width = window.innerWidth;
      unobscuredHeight = Math.max(window.innerHeight, viewport.height);
    } else unobscuredHeight = Math.max(unobscuredHeight, window.innerHeight, viewport.height);
    const focused = document.activeElement;
    const editing = shell.contains(focused) && focused.matches('input,textarea,[contenteditable="true"]');
    const values = { '--friend-viewport-height': `${viewport.height}px`, '--friend-viewport-top': `${viewport.offsetTop}px` };
    for (const [name, value] of Object.entries(values)) {
      if (shell.style.getPropertyValue(name) !== value) shell.style.setProperty(name, value);
    }
    // Installed iOS apps can shrink innerHeight along with visualViewport.
    // Compare against the unobscured height, rather than two shortened values.
    shell.classList.toggle('friend-keyboard-open', editing && unobscuredHeight - viewport.height > 100);
  };
  const schedule = () => { if (frame === null) frame = window.requestAnimationFrame(update); };
  update();
  viewport.addEventListener('resize', schedule); viewport.addEventListener('scroll', schedule);
  window.addEventListener('resize', schedule);
  document.addEventListener('focusin', schedule); document.addEventListener('focusout', schedule);
  return () => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    viewport.removeEventListener('resize', schedule); viewport.removeEventListener('scroll', schedule);
    window.removeEventListener('resize', schedule);
    document.removeEventListener('focusin', schedule); document.removeEventListener('focusout', schedule);
    shell.style.removeProperty('--friend-viewport-height'); shell.style.removeProperty('--friend-viewport-top');
    shell.classList.remove('friend-keyboard-open');
  };
};
