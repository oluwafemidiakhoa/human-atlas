const card = document.querySelector('#structure-card');
const structureName = document.querySelector('#structure-name');
const structureMeta = document.querySelector('#structure-meta');
const relationStrip = card?.querySelector('.relation-strip');
const cardActions = card?.querySelector('.card-actions');
const searchOpen = document.querySelector('#search-open');
const searchInput = document.querySelector('#search-input');
const searchResults = document.querySelector('#search-results');
const homeButton = document.querySelector('#home-view');
const focusButton = document.querySelector('#focus-selection');

const intelligence = { atlas:null, concepts:new Map(), partsByElement:new Map(), partsByName:new Map(), lastResolvedKey:'', suppressHashJump:false };

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = value => String(value ?? '').trim().toLowerCase();

function resolveSelectedPart(){
  if(!intelligence.atlas || !card?.classList.contains('visible')) return null;
  const name=structureName?.textContent?.trim()||'';
  const meta=structureMeta?.textContent||'';
  const elementId=meta.match(/FJ\d+/i)?.[0]?.toUpperCase()||'';
  let candidates=elementId?(intelligence.partsByElement.get(elementId)||[]):[];
  if(!candidates.length&&name)candidates=intelligence.partsByName.get(normalize(name))||[];
  return candidates.find(part=>normalize(part.name)===normalize(name))||candidates[0]||null;
}

function conceptLineage(conceptId){
  const out=[],seen=new Set(); let current=conceptId;
  while(current&&!seen.has(current)&&out.length<12){seen.add(current);const concept=intelligence.concepts.get(current);if(!concept)break;out.push(concept);current=concept.parentId}
  return out.reverse();
}

function conceptMeshCount(concept){
  if(!concept)return 0; let count=0;
  for(const id of concept.elements||[])count+=(intelligence.partsByElement.get(String(id).toUpperCase())||[]).length;
  return count;
}

function openAndSelect(query){
  if(!query||!searchOpen||!searchInput||!searchResults)return;
  searchOpen.click(); searchInput.value=query; searchInput.dispatchEvent(new Event('input',{bubbles:true}));
  requestAnimationFrame(()=>{const buttons=[...searchResults.querySelectorAll('button')];const exact=buttons.find(b=>normalize(b.querySelector('strong')?.textContent)===normalize(query));(exact||buttons[0])?.click()});
}

function setShareHash(elementId){if(!elementId||intelligence.suppressHashJump)return;const next=`#${encodeURIComponent(elementId)}`;if(location.hash!==next)history.replaceState(null,'',next)}

async function copyStructureLink(elementId,button){
  if(!elementId)return; const url=`${location.origin}${location.pathname}#${encodeURIComponent(elementId)}`;
  try{await navigator.clipboard.writeText(url)}catch{const input=document.createElement('input');input.value=url;document.body.appendChild(input);input.select();document.execCommand('copy');input.remove()}
  button.textContent='Link copied';setTimeout(()=>{button.textContent='Copy structure link'},1400);
}

function renderNeighborhood(part){
  let panel=card?.querySelector('.intelligence-panel');
  if(!panel&&card){panel=document.createElement('section');panel.className='intelligence-panel';panel.setAttribute('aria-label','Anatomical neighborhood and source hierarchy');cardActions?.before(panel)}
  if(!panel)return;
  if(!part){panel.replaceChildren();relationStrip?.replaceChildren();return}
  const concept=intelligence.concepts.get(part.conceptId),parent=concept?.parentId?intelligence.concepts.get(concept.parentId):null,children=(concept?.children||[]).map(id=>intelligence.concepts.get(id)).filter(Boolean),lineage=conceptLineage(part.conceptId),mappedMeshes=conceptMeshCount(concept),elementId=String(part.elementId||part.id||'').toUpperCase();
  const breadcrumb=lineage.slice(-5).map(item=>`<button type="button" data-jump="${escapeHtml(item.name)}">${escapeHtml(item.name)}</button>`).join('<span>›</span>');
  const childrenMarkup=children.slice(0,6).map(child=>`<button type="button" class="neighbor-chip" data-jump="${escapeHtml(child.name)}">${escapeHtml(child.name)}</button>`).join('');
  panel.innerHTML=`<div class="intelligence-title"><span>ANATOMICAL NEIGHBORHOOD</span><b>source graph</b></div><div class="anatomy-breadcrumbs">${breadcrumb||'<span>No mapped lineage</span>'}</div><div class="neighborhood-facts"><div><small>PARENT</small><strong>${escapeHtml(parent?.name||'Top-level mapping')}</strong></div><div><small>CONTAINS</small><strong>${children.length} mapped child concept${children.length===1?'':'s'}</strong></div><div><small>MESHES</small><strong>${mappedMeshes} mapped source mesh${mappedMeshes===1?'':'es'}</strong></div></div>${childrenMarkup?`<div class="neighbor-list"><small>EXPLORE CHILDREN</small><div>${childrenMarkup}</div></div>`:''}<div class="source-ledger"><div><span>BodyParts3D element</span><code>${escapeHtml(elementId||'—')}</code></div><div><span>Source concept</span><code>${escapeHtml(part.conceptId||'—')}</code></div><div><span>Mesh file</span><code>${escapeHtml((part.sourceFile||'').split('/').pop()||'—')}</code></div></div><div class="provenance-note"><b>Source-backed:</b> hierarchy and identifiers. <b>Human Atlas derived:</b> display region used for navigation.</div><div class="intelligence-actions">${parent?`<button type="button" data-jump="${escapeHtml(parent.name)}">Go to parent</button>`:''}<button type="button" data-lineage>Show lineage</button><button type="button" data-copy-link>Copy structure link</button></div>`;
  panel.querySelectorAll('[data-jump]').forEach(button=>button.addEventListener('click',()=>openAndSelect(button.dataset.jump)));
  panel.querySelector('[data-lineage]')?.addEventListener('click',()=>document.querySelector('[data-mode="relate"]')?.click());
  panel.querySelector('[data-copy-link]')?.addEventListener('click',event=>copyStructureLink(elementId,event.currentTarget));
  relationStrip?.replaceChildren();
  for(const text of ['Source hierarchy',mappedMeshes>1?`${mappedMeshes} mapped meshes`:'1 mapped mesh','Region derived']){const span=document.createElement('span');span.textContent=text;relationStrip?.appendChild(span)}
  setShareHash(elementId);
}

function refreshSelection(){const part=resolveSelectedPart(),key=part?`${part.id}|${part.conceptId}|${structureName?.textContent}`:'';if(key===intelligence.lastResolvedKey)return;intelligence.lastResolvedKey=key;renderNeighborhood(part)}
function installSelectionObserver(){if(!card)return;const observer=new MutationObserver(refreshSelection);observer.observe(card,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class']});refreshSelection()}
function installOrbitCalm(){const canvas=document.querySelector('#scene canvas');if(!canvas)return;const start=()=>document.querySelector('#app')?.classList.add('is-orbiting'),stop=()=>setTimeout(()=>document.querySelector('#app')?.classList.remove('is-orbiting'),100);canvas.addEventListener('pointerdown',start,{passive:true});window.addEventListener('pointerup',stop,{passive:true});window.addEventListener('pointercancel',stop,{passive:true})}
function installShortcuts(){const help=document.createElement('div');help.className='shortcut-key';help.innerHTML='<span><kbd>F</kbd> focus</span><span><kbd>D</kbd> dissect</span><span><kbd>G</kbd> ghost</span><span><kbd>L</kbd> lineage</span><span><kbd>H</kbd> home</span>';document.querySelector('#app')?.appendChild(help);window.addEventListener('keydown',event=>{const tag=document.activeElement?.tagName;if(tag==='INPUT'||tag==='TEXTAREA'||event.metaKey||event.ctrlKey||event.altKey)return;const key=event.key.toLowerCase();if(key==='f')focusButton?.click();else if(key==='d')document.querySelector('[data-mode="reveal"]')?.click();else if(key==='g')document.querySelector('[data-mode="xray"]')?.click();else if(key==='l')document.querySelector('[data-mode="relate"]')?.click();else if(key==='h')homeButton?.click()})}
function installHashNavigation(){const jumpFromHash=()=>{const id=decodeURIComponent(location.hash.replace(/^#/,'')).trim();if(!/^FJ\d+$/i.test(id))return;intelligence.suppressHashJump=true;openAndSelect(id.toUpperCase());setTimeout(()=>{intelligence.suppressHashJump=false},250)};window.addEventListener('hashchange',jumpFromHash);if(location.hash)setTimeout(jumpFromHash,500)}

async function init(){
  try{const response=await fetch('/models/atlas.json',{cache:'force-cache'});if(!response.ok)return;intelligence.atlas=await response.json();intelligence.atlas.concepts?.forEach(concept=>intelligence.concepts.set(concept.id,concept));intelligence.atlas.parts?.forEach(part=>{const elementId=String(part.elementId||part.id||'').toUpperCase();if(!intelligence.partsByElement.has(elementId))intelligence.partsByElement.set(elementId,[]);intelligence.partsByElement.get(elementId).push(part);const nameKey=normalize(part.name);if(!intelligence.partsByName.has(nameKey))intelligence.partsByName.set(nameKey,[]);intelligence.partsByName.get(nameKey).push(part)});installSelectionObserver();installOrbitCalm();installShortcuts();installHashNavigation()}catch(error){console.warn('[Human Atlas intelligence] could not initialize',error)}
}
init();
