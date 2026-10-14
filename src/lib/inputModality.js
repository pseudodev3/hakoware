// Safari sometimes paints :focus-visible on a dialog button after a tap.
export const installInputModality = () => {
  const root = document.documentElement;
  root.dataset.inputModality = 'pointer';
  document.addEventListener('pointerdown', () => { root.dataset.inputModality = 'pointer'; }, true);
  document.addEventListener('keydown', event => {
    if (!event.metaKey && !event.ctrlKey && !event.altKey) root.dataset.inputModality = 'keyboard';
  }, true);
};
