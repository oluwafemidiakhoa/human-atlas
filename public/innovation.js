(() => {
  const app = document.querySelector('#app');
  if (!app) return;

  const state = { atlas: null, selectedPart: null, compareAnchor: null, compareArmed: false, discoveryIndex: 0 };
  const IMPORTANT = ['Heart','Brain','Liver','Right kidney','Left kidney','Stomach','Left femur','Right femur','Spinal cord','Pancreas','Spleen','Trachea'];

  const dock = document.createElement('div');
  dock.className = 'innovation-dock';
  dock.innerHTML = '<button data-innov="command">⌘ Command</button><button data-innov="nearby">◎ Nearby</button><button data-innov="compare">⇄ Compare</button><button data-innov="discover">✦ Discover</button>';
  app.appendChild(dock);

  const panel = document.createElement('section');
  panel.className = 'discovery-card';
  panel.innerHTML = '<small>HUMAN ATLAS · SPATIAL INTELLIGENCE</small><h2 id="innovation-title">Body Command</h2><p id="innovation-copy">Operate the atlas by intent.</p><div id="innovation-body"></div><button id="innovation-close">Close</button>';
  app.appendChild(panel);

  const command = document.createElement('div');
  command.className = 'body-command';
  command.hidden = true;
  command.innerHTML = '<div class="command-head"><span>BODY COMMAND</span><kbd>⌘K</kbd></div><input id="body-command-input" autocomplete="off" placeholder="show heart · isolate femur · explode 70 · front view…"><div id="body-command-help">Try: <b>show heart</b> · <b>skeleton</b> · <b>organs</b> · <b>explode 100</b> · <b>reset</b></div><div id="body-command-status"></div>';
  app.appendChild(command);

  const title = panel.querySelector('#innovation-title');
  const copy = panel.querySelector('#innovation-copy');
  const body = panel.querySelector('#innovation-body');
  const input = command.querySelector('#body-command-input');
  const status = command.querySelector('#body-command-status');

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const center = p => [(p.bounds[0][0]+p.bounds[1][0])/2,(p.bounds[0][1]+p.bounds[1][1])/2,(p.bounds[0][2]+p.bounds[1][2])/2];
  const dist = (a,b) => { const A=center(a),B=center(b); return Math.hypot(A[0]-B[0],A[1]-B[1],A[2]-B[2]); };
  const systemName = id => ({skeletal:'Skeletal',muscular:'Muscular',cardiac:'Cardiac',sensory:'Sensory',arterial:'Arterial',venous:'Venous',nervous:'Nervous',respiratory:'Respiratory',digestive:'Digestive',urinary:'Urinary',lymphatic:'Lymphatic',endocrine:'Endocrine',reproductive:'Reproductive',integumentary:'Body surface',connective:'Connective tissue',other:'Other anatomy'})[id] || id || 'Anatomy';

  function findPart(query) {
    if (!state.atlas || !query) return null;
    const q = query.trim().toLowerCase();
    let best = null, score = -1;
    state.atlas.parts.forEach(p => {
      const n = p.name.toLowerCase(), id = String(p.elementId || p.id || '').toLowerCase();
      let s = n === q ? 1000 : n.startsWith(q) ? 700 : n.includes(q) ? 450 : id === q ? 900 : id.includes(q) ? 300 : -1;
      if (s > score) { score = s; best = p; }
    });
    return score >= 0 ? best : null;
  }

  function selectViaSearch(part, isolate = false) {
    if (!part) return false;
    const searchOpen = document.querySelector('#search-open');
    const searchInput = document.querySelector('#search-input');
    const searchResults = document.querySelector('#search-results');
    searchOpen?.click();
    if (!searchInput) return false;
    searchInput.value = part.name;
    searchInput.dispatchEvent(new Event('input', { bubbles: true }));
    requestAnimationFrame(() => {
      const buttons = [...(searchResults?.querySelectorAll('button') || [])];
      const exact = buttons.find(b => (b.querySelector('span')?.textContent || '').trim().toLowerCase() === part.name.toLowerCase());
      (exact || buttons[0])?.click();
      setTimeout(() => {
        if (isolate) document.querySelector('#isolate-selection')?.click();
      }, 120);
    });
    return true;
  }

  function selectedFromDetail() {
    const detail = document.querySelector('#detail');
    if (!detail?.classList.contains('open')) return null;
    const name = document.querySelector('#detail-name')?.textContent?.trim();
    const id = document.querySelector('#detail-id')?.textContent?.trim();
    return findPart(id) || findPart(name);
  }

  function openPanel(kind, part = selectedFromDetail()) {
    state.selectedPart = part || state.selectedPart;
    if (kind === 'nearby') renderNearby();
    if (kind === 'compare') renderCompare();
    if (kind === 'discover') renderDiscover();
    panel.classList.add('open');
  }

  function renderNearby() {
    const p = selectedFromDetail() || state.selectedPart;
    title.textContent = p ? `Near ${p.name}` : 'Spatial Neighborhood';
    copy.textContent = p ? 'Nearest visible atlas structures by 3D center distance. Spatial proximity only; this does not claim anatomical connectivity.' : 'Select a structure first, then ask Human Atlas what sits nearest in 3D space.';
    if (!p || !state.atlas) { body.innerHTML = '<div class="innovation-empty">Select any structure on the body, then choose Nearby.</div>'; return; }
    const nearest = state.atlas.parts.filter(x => x !== p).map(x => ({p:x,d:dist(p,x)})).sort((a,b)=>a.d-b.d).slice(0,8);
    body.innerHTML = `<div class="discovery-metrics"><div><span>SYSTEM</span><b>${esc(systemName(p.system))}</b></div><div><span>SOURCE ID</span><b>${esc(p.elementId||p.id)}</b></div><div><span>NEAREST</span><b>${nearest.length}</b></div></div><div class="nearby-list">${nearest.map(({p:x,d})=>`<button data-part="${esc(x.elementId||x.id)}"><span>${esc(x.name)}</span><small>${esc(systemName(x.system))} · ${(d*1000).toFixed(0)} mm center distance</small></button>`).join('')}</div>`;
    body.querySelectorAll('[data-part]').forEach(b => b.onclick = () => { const x=findPart(b.dataset.part); panel.classList.remove('open'); selectViaSearch(x); });
  }

  function renderCompare() {
    const current = selectedFromDetail();
    if (!state.compareAnchor && current) state.compareAnchor = current;
    title.textContent = 'Compare Structures';
    if (!state.compareAnchor) {
      copy.textContent = 'Select the first structure, then press Compare again.';
      body.innerHTML = '<div class="innovation-empty">No comparison anchor selected.</div>';
      return;
    }
    if (current && current !== state.compareAnchor) {
      const d = dist(state.compareAnchor,current);
      copy.textContent = 'A geometric comparison from source mesh centers—not a clinical measurement.';
      body.innerHTML = `<div class="comparison-grid"><div><small>A</small><strong>${esc(state.compareAnchor.name)}</strong><span>${esc(systemName(state.compareAnchor.system))}</span></div><div class="comparison-arrow">⇄<b>${(d*1000).toFixed(0)} mm</b></div><div><small>B</small><strong>${esc(current.name)}</strong><span>${esc(systemName(current.system))}</span></div></div><button class="comparison-reset" id="comparison-reset">Start new comparison</button>`;
      body.querySelector('#comparison-reset').onclick = () => { state.compareAnchor=current; renderCompare(); };
    } else {
      copy.textContent = `Anchor set to ${state.compareAnchor.name}. Close this card, select another structure, then press Compare.`;
      body.innerHTML = `<div class="comparison-anchor"><small>ANCHOR</small><strong>${esc(state.compareAnchor.name)}</strong><span>${esc(state.compareAnchor.elementId||state.compareAnchor.id)}</span></div>`;
    }
  }

  function renderDiscover() {
    if (!state.atlas) return;
    let p = null;
    for (let tries=0; tries<IMPORTANT.length && !p; tries++) {
      p = findPart(IMPORTANT[state.discoveryIndex++ % IMPORTANT.length]);
    }
    if (!p) p = state.atlas.parts[Math.floor(Math.random()*state.atlas.parts.length)];
    state.selectedPart = p;
    title.textContent = p.name;
    copy.textContent = 'A guided jump into the atlas. Open it on the body, then use Nearby or Compare to continue exploring.';
    body.innerHTML = `<div class="discovery-metrics"><div><span>SYSTEM</span><b>${esc(systemName(p.system))}</b></div><div><span>SOURCE</span><b>${esc(p.elementId||p.id)}</b></div><div><span>REGION</span><b>${esc(p.region||'derived')}</b></div></div><button class="discovery-open" id="discovery-open">Open on body</button>`;
    body.querySelector('#discovery-open').onclick=()=>{panel.classList.remove('open');selectViaSearch(p);};
  }

  function setExplode(n) {
    const slider = document.querySelector('#explode');
    if (!slider) return;
    slider.value = String(Math.max(0,Math.min(100,n)));
    slider.dispatchEvent(new Event('input',{bubbles:true}));
    slider.dispatchEvent(new Event('change',{bubbles:true}));
  }

  function clickPreset(name) { document.querySelector(`[data-preset="${name}"]`)?.click(); }
  function clickView(name) { document.querySelector(`[data-view="${name}"]`)?.click(); }

  function runCommand(raw) {
    const text = raw.trim().toLowerCase();
    if (!text) return;
    let match;
    if (text === 'reset' || text === 'assemble' || text === 'home') { document.querySelector('#assemble-reset')?.click(); status.textContent='Body assembled.'; return; }
    if (text === 'skeleton' || text === 'show skeleton') { clickPreset('skeleton'); status.textContent='Skeleton shown.'; return; }
    if (text === 'organs' || text === 'show organs') { clickPreset('organs'); status.textContent='Organ systems shown.'; return; }
    if (text === 'all' || text === 'show all') { clickPreset('all'); status.textContent='All systems shown.'; return; }
    if (text.includes('front')) { clickView('front'); status.textContent='Front view.'; return; }
    if (text.includes('back')) { clickView('back'); status.textContent='Back view.'; return; }
    if (text.includes('side')) { clickView('side'); status.textContent='Side view.'; return; }
    if (text.includes('three') || text.includes('3/4') || text.includes('¾')) { clickView('three-quarter'); status.textContent='Three-quarter view.'; return; }
    if ((match=text.match(/explode\s+(\d{1,3})/))) { setExplode(Number(match[1])); status.textContent=`Explode set to ${Math.min(100,Number(match[1]))}%.`; return; }
    if ((match=text.match(/(?:show|focus)\s+(.+)/))) { const p=findPart(match[1]); if(p){selectViaSearch(p);status.textContent=`Opening ${p.name}.`;command.hidden=true;} else status.textContent=`No structure matched “${match[1]}”.`; return; }
    if ((match=text.match(/isolate\s+(.+)/))) { const p=findPart(match[1]); if(p){selectViaSearch(p,true);status.textContent=`Isolating ${p.name}.`;command.hidden=true;} else status.textContent=`No structure matched “${match[1]}”.`; return; }
    const p=findPart(text); if(p){selectViaSearch(p);status.textContent=`Opening ${p.name}.`;command.hidden=true;return;}
    status.textContent='Try “show heart”, “isolate femur”, “explode 70”, “skeleton”, “front view”, or “reset”.';
  }

  dock.querySelector('[data-innov="command"]').onclick=()=>{ command.hidden=!command.hidden; if(!command.hidden){input.focus();input.select();} };
  dock.querySelector('[data-innov="nearby"]').onclick=()=>openPanel('nearby');
  dock.querySelector('[data-innov="compare"]').onclick=()=>openPanel('compare');
  dock.querySelector('[data-innov="discover"]').onclick=()=>openPanel('discover');
  panel.querySelector('#innovation-close').onclick=()=>panel.classList.remove('open');
  input.addEventListener('keydown',e=>{if(e.key==='Enter')runCommand(input.value);if(e.key==='Escape')command.hidden=true;});
  window.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();command.hidden=false;input.focus();}});

  new MutationObserver(()=>{const p=selectedFromDetail();if(p)state.selectedPart=p;}).observe(document.querySelector('#detail')||app,{attributes:true,subtree:true,childList:true,characterData:true});

  fetch('/models/atlas.json',{cache:'force-cache'}).then(r=>r.ok?r.json():null).then(atlas=>{state.atlas=atlas;}).catch(()=>{});
})();
