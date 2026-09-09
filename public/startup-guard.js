(() => {
  const loading = document.querySelector('#loading');
  const copy = document.querySelector('#loading-copy');
  const bar = document.querySelector('#loading-bar');
  const action = document.querySelector('#loading-action');
  if (!loading || !copy) return;

  let completed = false;
  let failed = false;

  const hideLoader = () => {
    completed = true;
    loading.hidden = true;
    loading.style.setProperty('display', 'none', 'important');
  };

  const showFailure = message => {
    if (completed || failed) return;
    failed = true;
    loading.hidden = false;
    loading.style.removeProperty('display');
    loading.classList.add('error');
    copy.textContent = message || 'The anatomy viewer did not finish starting.';
    if (bar) bar.style.width = '100%';
    if (action && !action.querySelector('button')) {
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'loading-retry';
      retry.textContent = 'Retry anatomy viewer';
      retry.addEventListener('click', () => location.reload());
      action.appendChild(retry);
    }
  };

  const inspectProgress = () => {
    const text = copy.textContent || '';
    if (/^100%\b/.test(text)) {
      // Give the scene one paint to finish its final matrices, then remove the overlay.
      requestAnimationFrame(() => requestAnimationFrame(hideLoader));
    }
  };

  new MutationObserver(inspectProgress).observe(copy, {
    childList: true,
    characterData: true,
    subtree: true
  });

  window.addEventListener('error', event => {
    const detail = event?.error?.message || event?.message;
    if (!completed && detail) showFailure(`Viewer startup error: ${detail}`);
  });

  window.addEventListener('unhandledrejection', event => {
    const detail = event?.reason?.message || String(event?.reason || 'Unknown startup error');
    if (!completed) showFailure(`Viewer startup error: ${detail}`);
  });

  setTimeout(() => {
    if (!completed && !failed && !loading.hidden) {
      showFailure('The anatomy data is taking too long to finish loading.');
    }
  }, 45000);

  inspectProgress();
})();
