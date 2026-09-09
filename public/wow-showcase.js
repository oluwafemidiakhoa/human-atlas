(() => {
  const app = document.querySelector('#app');
  const button = document.querySelector('#showcase');
  const explode = document.querySelector('#explode');
  const rotate = document.querySelector('#rotate-view');
  if (!app || !button || !explode) return;

  let runId = 0;
  let running = false;
  let caption = document.querySelector('#wow-caption');
  if (!caption) {
    caption = document.createElement('div');
    caption.id = 'wow-caption';
    caption.className = 'showcase-caption';
    caption.innerHTML = '<small>HUMAN ATLAS</small><strong>2,234 structures</strong><em>one body, individually addressable</em>';
    app.appendChild(caption);
  }

  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  const click = selector => document.querySelector(selector)?.click();
  const setCaption = (title, subtitle, kicker = 'HUMAN ATLAS') => {
    caption.querySelector('small').textContent = kicker;
    caption.querySelector('strong').textContent = title;
    caption.querySelector('em').textContent = subtitle;
    caption.classList.add('visible');
  };
  const hideCaption = () => caption.classList.remove('visible');
  const setExplode = value => {
    explode.value = String(value);
    explode.dispatchEvent(new Event('input', { bubbles: true }));
    explode.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const ensureRotate = on => {
    if (!rotate) return;
    const active = rotate.classList.contains('active');
    if (active !== on) rotate.click();
  };
  const resetPresentation = () => {
    setExplode(0);
    click('[data-preset="all"]');
    click('[data-view="three-quarter"]');
    ensureRotate(false);
  };
  const stop = () => {
    runId += 1;
    running = false;
    app.classList.remove('showcase-mode');
    hideCaption();
    button.querySelector('span:nth-child(2)').textContent = 'Showcase';
    button.querySelector('small').textContent = 'PLAY';
    resetPresentation();
  };
  const stage = async (id, title, subtitle, ms, action) => {
    if (id !== runId) return false;
    action?.();
    setCaption(title, subtitle);
    await wait(ms);
    return id === runId;
  };

  async function play() {
    if (running) {
      stop();
      return;
    }
    running = true;
    const id = ++runId;
    app.classList.add('showcase-mode');
    button.querySelector('span:nth-child(2)').textContent = 'Stop';
    button.querySelector('small').textContent = 'LIVE';
    resetPresentation();
    await wait(350);

    if (!await stage(id, 'One body.', '2,234 individually addressable anatomical meshes', 1300, () => {
      click('[data-preset="all"]');
      click('[data-view="three-quarter"]');
    })) return;

    if (!await stage(id, 'The framework.', 'Skeletal anatomy isolated in one gesture', 1250, () => {
      click('[data-preset="skeleton"]');
      click('[data-view="front"]');
    })) return;

    if (!await stage(id, 'The organs.', 'Internal systems brought forward without leaving the scene', 1250, () => {
      click('[data-preset="organs"]');
    })) return;

    if (!await stage(id, 'Systems separate.', 'The body becomes spatially legible', 1700, () => {
      click('[data-preset="all"]');
      setExplode(42);
      ensureRotate(true);
    })) return;

    if (!await stage(id, 'Every piece.', '2,234 source meshes become an anatomical inventory', 2600, () => {
      ensureRotate(false);
      setExplode(100);
    })) return;

    if (!await stage(id, 'Back to human.', 'The inventory resolves into the assembled body', 1900, () => {
      setExplode(0);
      click('[data-view="three-quarter"]');
    })) return;

    if (id === runId) {
      hideCaption();
      await wait(450);
      running = false;
      app.classList.remove('showcase-mode');
      button.querySelector('span:nth-child(2)').textContent = 'Showcase';
      button.querySelector('small').textContent = 'PLAY';
    }
  }

  button.addEventListener('click', play);
})();
