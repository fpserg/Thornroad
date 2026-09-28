// Thornroad — bootstrap
(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    window.Thornroad.UI.init();

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(() => { /* offline install not critical to play */ });
      });
    }

    // Install prompt (Android/desktop Chrome-family)
    let deferredPrompt = null;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
    });
    document.addEventListener('click', function onceInstallHint(e) {
      if (e.target && e.target.id === 'btn-new-game' && deferredPrompt) {
        // Don't block starting the game; just leave the prompt available if the browser wants to show its own UI later.
      }
    });
  });
})();
