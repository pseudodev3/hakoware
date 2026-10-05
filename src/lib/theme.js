export const getInitialTheme = () => localStorage.getItem('hakoware_theme') === 'light' ? 'light' : 'dark';

export const applyTheme = (nextTheme) => {
  const root = document.documentElement;
  const existingGuard = document.querySelector('style[data-theme-transition-guard="true"]');
  existingGuard?.remove();

  const guard = document.createElement('style');
  guard.dataset.themeTransitionGuard = 'true';
  guard.textContent = '*,*::before,*::after{transition:none!important}';
  document.head.appendChild(guard);

  root.dataset.theme = nextTheme;
  root.style.colorScheme = nextTheme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', nextTheme === 'light' ? '#f5f5ef' : '#141719');
  localStorage.setItem('hakoware_theme', nextTheme);

  void root.offsetHeight;
  requestAnimationFrame(() => requestAnimationFrame(() => guard.remove()));
};
