(() => {
  const DESKTOP_WALLPAPERS = [
    '/app/wallpapers/desktop-01-lacquer-tail.png',
    '/app/wallpapers/desktop-02-washi-ink.png',
    '/app/wallpapers/desktop-03-signal-path.png',
    '/app/wallpapers/desktop-04-comet-tail.png',
  ];
  const MOBILE_WALLPAPERS = [
    '/app/wallpapers/mobile-01-lacquer-tail.png',
    '/app/wallpapers/mobile-02-washi-ink.png',
    '/app/wallpapers/mobile-03-signal-path.png',
    '/app/wallpapers/mobile-04-comet-tail.png',
  ];
  const MOBILE_QUERY = '(max-width: 46rem)';
  const ROTATION_MS = 90_000;
  const root = document.documentElement;
  const media = window.matchMedia(MOBILE_QUERY);
  let currentUrl = '';
  let currentMode = '';
  let rotationTimer = 0;

  function activePool() {
    return media.matches ? MOBILE_WALLPAPERS : DESKTOP_WALLPAPERS;
  }

  function pickNext(pool) {
    const candidates = pool.filter((url) => url !== currentUrl);
    return candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
  }

  function applyRandomWallpaper() {
    const mode = media.matches ? 'mobile' : 'desktop';
    const pool = activePool();
    const url = pickNext(pool);
    currentMode = mode;
    currentUrl = url;
    root.dataset.wallpaperMode = mode;
    root.dataset.wallpaperUrl = url;
    root.style.setProperty('--wallpaper-image', `url("${url}")`);
  }

  function scheduleRotation() {
    window.clearTimeout(rotationTimer);
    rotationTimer = window.setTimeout(() => {
      applyRandomWallpaper();
      scheduleRotation();
    }, ROTATION_MS);
  }

  function onViewportChange() {
    if ((media.matches ? 'mobile' : 'desktop') === currentMode) return;
    applyRandomWallpaper();
    scheduleRotation();
  }

  applyRandomWallpaper();
  scheduleRotation();
  if (typeof media.addEventListener === 'function') media.addEventListener('change', onViewportChange);
  else media.addListener(onViewportChange);

  // 実ブラウザでのレスポンシブ確認と、将来の診断用に現在値だけ公開する。
  window.HTMLShareWallpaper = Object.freeze({
    desktop: [...DESKTOP_WALLPAPERS],
    mobile: [...MOBILE_WALLPAPERS],
    get current() { return { mode: currentMode, url: currentUrl }; },
  });
})();
