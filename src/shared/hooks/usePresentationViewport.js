import { useEffect } from 'react';
export const usePresentationViewport = open => {
  useEffect(() => {
    if (!open || !window.visualViewport) return undefined;
    const viewport = window.visualViewport, root = document.documentElement;
    const update = () => { if (viewport.scale === 1) { root.style.setProperty('--presentation-viewport-height', `${viewport.height}px`); root.style.setProperty('--presentation-viewport-top', `${viewport.offsetTop}px`); } };
    update(); viewport.addEventListener('resize', update); viewport.addEventListener('scroll', update);
    return () => { viewport.removeEventListener('resize', update); viewport.removeEventListener('scroll', update); root.style.removeProperty('--presentation-viewport-height'); root.style.removeProperty('--presentation-viewport-top'); };
  }, [open]);
};
