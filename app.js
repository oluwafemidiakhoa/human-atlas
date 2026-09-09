import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DEFAULT_COLORS = {
  skeletal: '#d8cfb6', muscular: '#a85b50', arterial: '#b95345', venous: '#527c9f', nervous: '#d8b565',
  respiratory: '#b98991', digestive: '#b8916b', urinary: '#88738f', reproductive: '#bda098', lymphatic: '#879f7c',
  endocrine: '#c5a09a', sensory: '#91aeb2', cardiac: '#9d4f45', connective: '#aec3bb', integumentary: '#ba9b7d', other: '#9da5a3'
};

const SYSTEM_NAMES = {
  skeletal: 'Skeletal', muscular: 'Muscular', arterial: 'Arterial', venous: 'Venous', nervous: 'Nervous',
  respiratory: 'Respiratory', digestive: 'Digestive', urinary: 'Urinary', reproductive: 'Reproductive', lymphatic: 'Lymphatic',
  endocrine: 'Endocrine', sensory: 'Sensory', cardiac: 'Cardiac', connective: 'Connective tissue', integumentary: 'Body surface', other: 'Other anatomy'
};

const SYSTEM_SUMMARY = {
  skeletal: 'Structural anatomy that supports and protects the body.',
  muscular: 'Muscular anatomy involved in movement and stability.',
  arterial: 'Arterial anatomy carrying blood away from the heart.',
  venous: 'Venous anatomy returning blood toward the heart.',
  nervous: 'Neural anatomy involved in signaling, sensation and control.',
  respiratory: 'Anatomy involved in conducting air and gas exchange.',
  digestive: 'Anatomy involved in digestion and nutrient processing.',
  urinary: 'Anatomy involved in filtration, urine transport and storage.',
  reproductive: 'Male reproductive anatomy in the source reference model.',
  lymphatic: 'Lymphatic and immune-associated anatomy.',
  endocrine: 'Hormone-producing anatomy.',
  sensory: 'Anatomy associated with special senses.',
  cardiac: 'Structures of the heart and cardiac apparatus.',
  connective: 'Supporting connective tissues.',
  integumentary: 'Body-surface anatomy.',
  other: 'An anatomical structure from the source atlas.'
};

const MODE_LABELS = { explore: 'Survey', reveal: 'Dissect', xray: 'Ghost', relate: 'Lineage', trace: 'Pathway' };
const state = {
  mode: 'reveal', depth: 42, labels: true, selectedIndex: null, related: new Set(), atlas: null, ready: false,
  overlayToken: 0, presentationAnimating: true
};

const host = document.querySelector('#scene');
const labelsLayer = document.querySelector('#labels-layer');
const badge = document.querySelector('.prototype-badge');
const nameEl = document.querySelector('#structure-name');
const metaEl = document.querySelector('#structure-meta');
const summaryEl = document.querySelector('#structure-summary');
const card = document.querySelector('#structure-card');
const depth = document.querySelector('#depth');
const depthOutput = document.querySelector('#depth-output');

const scene = new THREE.Scene();
scene.background = new THREE.Color('#ede7dc');
scene.fog = new THREE.Fog('#ede7dc', 4.8, 12);

const camera = new THREE.PerspectiveCamera(34, 1, 0.01, 50);
camera.position.set(2.7, 1.7, 5.3);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
host.appendChild(renderer.domElement);
renderer.domElement.setAttribute('aria-label', 'Human Atlas 3D anatomy. Drag to orbit, scroll or pinch to zoom, and select a structure to inspect it.');

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.05;
controls.maxDistance = 20;
controls.maxPolarAngle = Math.PI * 0.98;

scene.add(new THREE.HemisphereLight(0xfffbf1, 0x938d82, 2.05));
const key = new THREE.DirectionalLight(0xffffff, 3);
key.position.set(-3, 5, 5);
scene.add(key);
const rim = new THREE.DirectionalLight(0xc7eef0, 1.3);
rim.position.set(4, 2, -4);
scene.add(rim);

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(2.5, 96),
  new THREE.MeshStandardMaterial({ color: '#d9d0c1', roughness: 0.95 })
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = -0.018;
scene.add(floor);

const ring = new THREE.Mesh(
  new THREE.RingGeometry(1.31, 1.325, 128),
  new THREE.MeshBasicMaterial({ color: '#8e7c64', transparent: true, opacity: 0.34, side: THREE.DoubleSide })
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = -0.004;
scene.add(ring);

const batches = new Map();
const handles = [];
const partCenters = [];
const partRadii = [];
const currentOffsets = [];
const conceptById = new Map();
const elementToIndices = new Map();
const focusGroup = new THREE.Group();
focusGroup.renderOrder = 20;
scene.add(focusGroup);

let needLabels = true;
const identity = new THREE.Matrix4();
const matrix = new THREE.Matrix4();
const right = new THREE.Vector3();
const up = new THREE.Vector3();
const forward = new THREE.Vector3();
const zero = new THREE.Vector3();
const tempCenter = new THREE.Vector3();

new ResizeObserver(() => {
  const width = Math.max(1, host.clientWidth);
  const height = Math.max(1, host.clientHeight);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
  needLabels = true;
}).observe(host);

controls.addEventListener('change', () => {
  state.presentationAnimating = true;
  needLabels = true;
});

async function fetchBinary(url) {
  const response = await fetch(url, { cache: 'force-cache' });
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`);
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('This browser cannot decompress the anatomy package. Please use a current Chrome, Edge, Safari, or Firefox.');
    }
    const stream = new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).arrayBuffer();
  }
  return buffer;
}

function colorFor(system) {
  return state.atlas?.systemColors?.[system] || DEFAULT_COLORS[system] || DEFAULT_COLORS.other;
}

function systemName(system) {
  return SYSTEM_NAMES[system] || system || 'Anatomy';
}

function centerAndRadius(bounds) {
  const a = bounds[0];
  const b = bounds[1];
  const center = new THREE.Vector3((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
  const radius = Math.max(0.002, Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 2);
  return [center, radius];
}

function createBatches(atlas) {
  for (const [system, stats] of Object.entries(atlas.systemStats || {})) {
    const material = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.57,
      metalness: 0.025,
      transparent: false,
      opacity: 1,
      side: THREE.DoubleSide
    });
    const batch = new THREE.BatchedMesh(
      Math.max(1, stats.parts + 2),
      Math.ceil(stats.vertices * 1.01) + 16,
      Math.ceil(stats.indices * 1.01) + 48,
      material
    );
    batch.frustumCulled = false;
    batch.perObjectFrustumCulled = true;
    batch.userData.instanceToPart = [];
    batches.set(system, batch);
    scene.add(batch);
  }
}

function geometryFromPart(buffer, part) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(buffer, part.positions, part.vertexCount * 3);
  const normals = new Int16Array(buffer, part.normals, part.vertexCount * 3);
  const indices = new Uint32Array(buffer, part.indices, part.indexCount);
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3, true));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.boundingBox = new THREE.Box3(
    new THREE.Vector3(...part.bounds[0]),
    new THREE.Vector3(...part.bounds[1])
  );
  geometry.computeBoundingSphere();
  return geometry;
}

async function loadAtlas(atlas) {
  state.atlas = atlas;
  atlas.parts.forEach((part, index) => {
    const [center, radius] = centerAndRadius(part.bounds);
    partCenters[index] = center;
    partRadii[index] = radius;
    currentOffsets[index] = new THREE.Vector3();
    const elementId = String(part.elementId || part.id || '').toUpperCase();
    if (!elementToIndices.has(elementId)) elementToIndices.set(elementId, []);
    elementToIndices.get(elementId).push(index);
  });
  atlas.concepts?.forEach(concept => conceptById.set(concept.id, concept));
  createBatches(atlas);

  const byChunk = Array.from({ length: atlas.chunks.length }, () => []);
  atlas.parts.forEach((part, index) => byChunk[part.chunk].push([index, part]));

  let loaded = 0;
  let cursor = 0;
  const worker = async () => {
    while (cursor < atlas.chunks.length) {
      const chunkIndex = cursor++;
      const chunk = atlas.chunks[chunkIndex];
      const buffer = await fetchBinary(chunk.url);
      for (const [partIndex, part] of byChunk[chunkIndex]) {
        const batch = batches.get(part.system);
        if (!batch) continue;
        const geometry = geometryFromPart(buffer, part);
        const geometryId = batch.addGeometry(geometry);
        const instanceId = batch.addInstance(geometryId);
        batch.setColorAt(instanceId, new THREE.Color(colorFor(part.system)));
        batch.setMatrixAt(instanceId, identity);
        batch.userData.instanceToPart[instanceId] = partIndex;
        handles[partIndex] = { batch, instanceId, geometryId };
        geometry.dispose();
      }
      loaded += 1;
      badge.textContent = `Loading BodyParts3D · ${Math.round((loaded / atlas.chunks.length) * 100)}%`;
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  };

  await Promise.all(Array.from({ length: Math.min(3, atlas.chunks.length) }, worker));
  state.ready = true;
  badge.textContent = `${atlas.parts.length.toLocaleString()} verified meshes · ${atlas.version}`;
  badge.classList.add('source-ready');
  fitWholeBody();
  pickBest('heart');
  state.presentationAnimating = true;
  needLabels = true;
}

function fitWholeBody() {
  const bounds = state.atlas?.bounds;
  if (!bounds) return;
  const center = new THREE.Vector3(
    (bounds[0][0] + bounds[1][0]) / 2,
    (bounds[0][1] + bounds[1][1]) / 2,
    (bounds[0][2] + bounds[1][2]) / 2
  );
  const height = bounds[1][1] - bounds[0][1];
  controls.target.copy(center).add(new THREE.Vector3(0, height * 0.02, 0));
  camera.position.copy(center).add(new THREE.Vector3(height * 0.95, height * 0.17, height * 2.05));
  controls.update();
}

function conceptRelations(index) {
  const part = state.atlas.parts[index];
  const concept = conceptById.get(part.conceptId);
  const result = new Set();
  if (!concept) return result;
  const relationConcepts = [concept.parentId, ...(concept.children || [])].filter(Boolean);
  for (const conceptId of relationConcepts) {
    const relatedConcept = conceptById.get(conceptId);
    for (const elementId of relatedConcept?.elements || []) {
      for (const relatedIndex of elementToIndices.get(String(elementId).toUpperCase()) || []) {
        if (relatedIndex !== index) result.add(relatedIndex);
      }
    }
  }
  return result;
}

function selectPart(index, { focus = false } = {}) {
  if (!state.atlas || index == null || !state.atlas.parts[index]) return;
  state.selectedIndex = index;
  state.related = conceptRelations(index);
  const part = state.atlas.parts[index];
  nameEl.textContent = part.name;
  const sourceId = part.elementId || part.id;
  metaEl.textContent = `${systemName(part.system)} · ${part.region || 'anatomy'}${sourceId ? ` · ${sourceId}` : ''}`;
  summaryEl.textContent = SYSTEM_SUMMARY[part.system] || SYSTEM_SUMMARY.other;
  card.classList.add('visible');
  if (focus) focusPart(index);
  applyModeLayer();
  state.presentationAnimating = true;
  needLabels = true;
}

function clearSelection() {
  state.selectedIndex = null;
  state.related.clear();
  card.classList.remove('visible');
  applyModeLayer();
  state.presentationAnimating = true;
  needLabels = true;
}

function focusPart(index) {
  const center = partCenters[index].clone().add(currentOffsets[index] || zero);
  const radius = partRadii[index];
  const direction = camera.position.clone().sub(controls.target).normalize();
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, Math.max(0.28, Math.min(3.5, radius * 6.5)));
  controls.update();
}

function pickBest(term) {
  if (!state.atlas) return;
  const query = term.toLowerCase();
  let best = -1;
  let score = -Infinity;
  state.atlas.parts.forEach((part, index) => {
    const name = part.name.toLowerCase();
    let current = name === query ? 1000 : name.startsWith(query) ? 800 : name.includes(query) ? 500 : 0;
    current += Math.log10(partRadii[index] + 1e-5) * 10;
    if (current > score) {
      score = current;
      best = index;
    }
  });
  if (best >= 0 && score > 0) selectPart(best, { focus: false });
}

function setMode(mode) {
  if (mode === 'trace') return;
  state.mode = mode;
  document.querySelectorAll('[data-mode]').forEach(button => button.classList.toggle('active', button.dataset.mode === mode));
  document.querySelectorAll('[data-card-mode]').forEach(button => button.classList.toggle('active', button.dataset.cardMode === mode));
  document.querySelector('.deck-heading small').textContent = `${MODE_LABELS[mode]} lens active · spatial context updates in place`;
  applyModeLayer();
  state.presentationAnimating = true;
  needLabels = true;
}

function clearFocusOverlays() {
  state.overlayToken += 1;
  for (const mesh of [...focusGroup.children]) {
    focusGroup.remove(mesh);
    mesh.geometry?.dispose();
    mesh.material?.dispose();
  }
}

function restoreInstanceVisibility() {
  for (const handle of handles) {
    if (handle?.batch?.setVisibleAt) handle.batch.setVisibleAt(handle.instanceId, true);
  }
}

function setBatchOpacity(opacity) {
  for (const batch of batches.values()) {
    batch.material.transparent = opacity < 0.999;
    batch.material.opacity = opacity;
    batch.material.depthWrite = opacity >= 0.45;
    batch.material.needsUpdate = true;
  }
}

async function buildFocusOverlays(indices) {
  const token = ++state.overlayToken;
  const unique = [...new Set(indices)].filter(index => index != null && handles[index]);
  const byChunk = new Map();
  for (const index of unique) {
    const part = state.atlas.parts[index];
    if (!byChunk.has(part.chunk)) byChunk.set(part.chunk, []);
    byChunk.get(part.chunk).push(index);
  }

  for (const [chunkIndex, partIndices] of byChunk) {
    const buffer = await fetchBinary(state.atlas.chunks[chunkIndex].url);
    if (token !== state.overlayToken) return;
    for (const index of partIndices) {
      const part = state.atlas.parts[index];
      const geometry = geometryFromPart(buffer, part);
      const selected = index === state.selectedIndex;
      const baseColor = new THREE.Color(colorFor(part.system));
      if (selected) baseColor.lerp(new THREE.Color('#70d2ca'), 0.65);
      else baseColor.lerp(new THREE.Color('#4b9e9d'), 0.35);
      const material = new THREE.MeshStandardMaterial({
        color: baseColor,
        roughness: 0.45,
        metalness: 0.02,
        side: THREE.DoubleSide,
        emissive: selected ? new THREE.Color('#173d3a') : new THREE.Color('#000000'),
        emissiveIntensity: selected ? 0.18 : 0
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(currentOffsets[index]);
      mesh.userData.partIndex = index;
      focusGroup.add(mesh);
    }
  }
}

function applyModeLayer() {
  if (!state.ready) return;
  clearFocusOverlays();
  restoreInstanceVisibility();
  setBatchOpacity(1);

  const selected = state.selectedIndex;
  if (selected == null) return;

  if (state.mode === 'xray') {
    setBatchOpacity(0.13 + (1 - state.depth / 100) * 0.11);
    handles[selected]?.batch?.setVisibleAt?.(handles[selected].instanceId, false);
    buildFocusOverlays([selected]).catch(console.error);
  }

  if (state.mode === 'relate') {
    setBatchOpacity(0.11);
    const related = [...state.related]
      .sort((a, b) => partRadii[b] - partRadii[a])
      .slice(0, 24);
    const overlay = [selected, ...related];
    for (const index of overlay) handles[index]?.batch?.setVisibleAt?.(handles[index].instanceId, false);
    buildFocusOverlays(overlay).catch(console.error);
  }
}

function targetOffsetFor(index, selectedCenter, selectedNdc, selectedDistance, selectedRadius) {
  if (state.mode !== 'reveal' || state.selectedIndex == null || index === state.selectedIndex) return zero;
  const factor = state.depth / 100;
  const center = partCenters[index];
  const distance = camera.position.distanceTo(center);
  const ndc = center.clone().project(camera);
  const ndcDistance = Math.hypot(ndc.x - selectedNdc.x, ndc.y - selectedNdc.y);
  const screenRadius = ((partRadii[index] + selectedRadius) / Math.max(0.1, selectedDistance)) * 1.8;
  const inFront = distance < selectedDistance + partRadii[index] * 0.25;
  const overlap = inFront && ndcDistance < Math.max(0.05, screenRadius);
  if (!overlap) return zero;

  let sx = ndc.x - selectedNdc.x;
  let sy = ndc.y - selectedNdc.y;
  if (Math.hypot(sx, sy) < 0.018) {
    sx = center.x >= selectedCenter.x ? 1 : -1;
    sy = (center.y - selectedCenter.y) * 0.45;
  }
  const length = Math.hypot(sx, sy) || 1;
  sx /= length;
  sy /= length;

  return new THREE.Vector3()
    .addScaledVector(right, sx * factor * (0.10 + selectedRadius * 0.8))
    .addScaledVector(up, sy * factor * (0.08 + selectedRadius * 0.55));
}

function updatePresentation() {
  if (!state.ready) return;
  const selected = state.selectedIndex;
  const selectedCenter = selected != null ? partCenters[selected] : null;
  const selectedNdc = selectedCenter ? selectedCenter.clone().project(camera) : null;
  const selectedDistance = selectedCenter ? camera.position.distanceTo(selectedCenter) : 0;
  const selectedRadius = selected != null ? partRadii[selected] : 0;
  camera.getWorldDirection(forward).normalize();
  right.crossVectors(forward, camera.up).normalize();
  up.crossVectors(right, forward).normalize();

  let maxDelta = 0;
  for (let index = 0; index < state.atlas.parts.length; index += 1) {
    const part = state.atlas.parts[index];
    const handle = handles[index];
    if (!handle) continue;
    const selectedPart = index === selected;
    const related = state.related.has(index);
    const color = new THREE.Color(colorFor(part.system));

    if (selectedPart) color.lerp(new THREE.Color('#70d2ca'), 0.65);
    else if (state.mode === 'relate' && related) color.lerp(new THREE.Color('#4b9e9d'), 0.4);
    else if (state.mode === 'reveal' && selected != null) color.lerp(new THREE.Color('#c7c0b1'), 0.08);
    handle.batch.setColorAt(handle.instanceId, color);

    const target = selectedCenter ? targetOffsetFor(index, selectedCenter, selectedNdc, selectedDistance, selectedRadius) : zero;
    const before = currentOffsets[index].distanceTo(target);
    currentOffsets[index].lerp(target, 0.18);
    maxDelta = Math.max(maxDelta, before);
    matrix.makeTranslation(currentOffsets[index].x, currentOffsets[index].y, currentOffsets[index].z);
    handle.batch.setMatrixAt(handle.instanceId, matrix);
  }

  for (const overlay of focusGroup.children) {
    const index = overlay.userData.partIndex;
    if (index != null) overlay.position.copy(currentOffsets[index]);
  }

  state.presentationAnimating = maxDelta > 0.00035;
  needLabels = true;
}

function updateLabels() {
  if (!state.ready || !state.labels) {
    labelsLayer.replaceChildren();
    return;
  }

  const width = host.clientWidth;
  const height = host.clientHeight;
  const candidates = [];
  for (let index = 0; index < state.atlas.parts.length; index += 1) {
    const part = state.atlas.parts[index];
    const selected = index === state.selectedIndex;
    const related = state.related.has(index);
    if (state.mode === 'relate' && state.selectedIndex != null && !selected && !related) continue;
    if (state.mode === 'xray' && state.selectedIndex != null && !selected && partRadii[index] < 0.08) continue;

    const center = tempCenter.copy(partCenters[index]).add(currentOffsets[index]);
    const ndc = center.clone().project(camera);
    if (ndc.z < -1 || ndc.z > 1 || Math.abs(ndc.x) > 1.15 || Math.abs(ndc.y) > 1.15) continue;

    const distance = camera.position.distanceTo(center);
    const screenSize = (partRadii[index] / Math.max(0.01, distance)) * 900;
    let priority = screenSize + (selected ? 10000 : 0) + (state.mode === 'relate' && related ? 1200 : 0);
    if ((part.name || '').length < 30) priority += 12;
    candidates.push({
      index,
      part,
      x: (ndc.x * 0.5 + 0.5) * width,
      y: (-ndc.y * 0.5 + 0.5) * height,
      priority,
      screenSize,
      selected
    });
  }

  candidates.sort((a, b) => b.priority - a.priority);
  const cameraDistance = camera.position.distanceTo(controls.target);
  const limit = state.mode === 'relate' ? 26 : cameraDistance < 0.7 ? 42 : cameraDistance < 1.5 ? 28 : 16;
  const placed = [];
  const accepted = [];

  for (const candidate of candidates) {
    if (accepted.length >= limit && !candidate.selected) continue;
    if (!candidate.selected && candidate.screenSize < 1.4 && accepted.length > 8) continue;
    const collision = placed.some(item => Math.abs(item.x - candidate.x) < 92 && Math.abs(item.y - candidate.y) < 28);
    if (collision && !candidate.selected) continue;
    placed.push(candidate);
    accepted.push(candidate);
  }

  const fragment = document.createDocumentFragment();
  for (const label of accepted) {
    const button = document.createElement('button');
    button.className = `living-label${label.selected ? ' selected' : ''}`;
    button.style.left = `${label.x}px`;
    button.style.top = `${label.y}px`;
    button.innerHTML = `<span class="label-line"></span><span class="label-text"><strong>${escapeHtml(label.part.name)}</strong>${label.selected ? `<small>${systemName(label.part.system)}</small>` : ''}</span>`;
    button.addEventListener('click', event => {
      event.stopPropagation();
      selectPart(label.index);
    });
    fragment.appendChild(button);
  }
  labelsLayer.replaceChildren(fragment);
  needLabels = false;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let pointerDown = null;

renderer.domElement.addEventListener('pointerdown', event => {
  pointerDown = { x: event.clientX, y: event.clientY };
});

renderer.domElement.addEventListener('pointerup', event => {
  if (!state.ready || !pointerDown || Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y) > 8) return;
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);

  const overlayHits = raycaster.intersectObjects(focusGroup.children, false);
  if (overlayHits.length && overlayHits[0].object.userData.partIndex != null) {
    selectPart(overlayHits[0].object.userData.partIndex);
    return;
  }

  const hits = raycaster.intersectObjects([...batches.values()], false);
  const hit = hits.find(item => (item.batchId ?? item.instanceId) != null);
  if (!hit) return;
  const instanceId = hit.batchId ?? hit.instanceId;
  const index = hit.object.userData.instanceToPart[instanceId];
  if (index != null) selectPart(index);
});

function renderSearch() {
  const query = searchInput.value.trim().toLowerCase();
  if (!state.atlas) return;
  const results = state.atlas.parts
    .map((part, index) => ({ part, index }))
    .filter(({ part }) => {
      if (!query) return true;
      return part.name.toLowerCase().includes(query)
        || String(part.elementId || '').toLowerCase().includes(query)
        || String(part.conceptId || '').toLowerCase().includes(query)
        || String(part.region || '').toLowerCase().includes(query)
        || systemName(part.system).toLowerCase().includes(query);
    })
    .sort((a, b) => partRadii[b.index] - partRadii[a.index])
    .slice(0, 18);

  searchResults.replaceChildren(...results.map(({ part, index }) => {
    const button = document.createElement('button');
    const sourceId = part.elementId || part.id || '';
    button.innerHTML = `<span class="system-dot" style="background:${colorFor(part.system)}"></span><span><strong>${escapeHtml(part.name)}</strong><small>${systemName(part.system)} · ${escapeHtml(part.region || 'anatomy')}${sourceId ? ` · ${escapeHtml(sourceId)}` : ''}</small></span>`;
    button.addEventListener('click', () => {
      selectPart(index, { focus: true });
      searchModal.hidden = true;
    });
    return button;
  }));
}

document.querySelector('#clear-selection').addEventListener('click', clearSelection);
document.querySelectorAll('[data-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.mode)));
document.querySelectorAll('[data-card-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.cardMode)));
document.querySelectorAll('[data-focus]').forEach(button => button.addEventListener('click', () => pickBest(button.dataset.focus)));

depth.addEventListener('input', () => {
  state.depth = Number(depth.value);
  depthOutput.textContent = `${state.depth}%`;
  if (state.mode === 'xray') applyModeLayer();
  state.presentationAnimating = true;
  needLabels = true;
});

const labelsToggle = document.querySelector('#labels-toggle');
labelsToggle.addEventListener('click', () => {
  state.labels = !state.labels;
  labelsToggle.classList.toggle('active', state.labels);
  needLabels = true;
});

const searchModal = document.querySelector('#search-modal');
const aboutModal = document.querySelector('#about-modal');
const searchInput = document.querySelector('#search-input');
const searchResults = document.querySelector('#search-results');

document.querySelector('#search-open').addEventListener('click', () => {
  searchModal.hidden = false;
  searchInput.focus();
  renderSearch();
});

document.querySelector('#about-open').addEventListener('click', () => { aboutModal.hidden = false; });
searchInput.addEventListener('input', renderSearch);
document.querySelectorAll('[data-close="search"]').forEach(button => button.addEventListener('click', () => { searchModal.hidden = true; }));
document.querySelectorAll('[data-close="about"]').forEach(button => button.addEventListener('click', () => { aboutModal.hidden = true; }));
searchModal.addEventListener('pointerdown', event => { if (event.target === searchModal) searchModal.hidden = true; });
aboutModal.addEventListener('pointerdown', event => { if (event.target === aboutModal) aboutModal.hidden = true; });
window.addEventListener('keydown', event => {
  if (event.key === '/' && document.activeElement?.tagName !== 'INPUT') {
    event.preventDefault();
    searchModal.hidden = false;
    searchInput.focus();
    renderSearch();
  }
  if (event.key === 'Escape') {
    searchModal.hidden = true;
    aboutModal.hidden = true;
  }
});

function startFallback(message) {
  badge.textContent = 'Anatomy package unavailable · diagnostic shell';
  const group = new THREE.Group();
  scene.add(group);
  const skin = new THREE.MeshStandardMaterial({ color: '#b78e79', roughness: 0.72, transparent: true, opacity: 0.55 });
  const bone = new THREE.MeshStandardMaterial({ color: '#d8cfb6', roughness: 0.65 });
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 20, 14), skin);
  head.position.y = 1.72;
  group.add(head);
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.30, 0.78, 8, 16), skin);
  torso.position.y = 0.93;
  group.add(torso);
  for (const x of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.8, 6, 12), bone);
    leg.position.set(x, 0.05, 0);
    group.add(leg);
  }
  const note = document.createElement('div');
  note.className = 'build-note';
  note.textContent = message;
  host.appendChild(note);
  state.ready = false;
  controls.target.set(0, 0.9, 0);
  camera.position.set(2.7, 1.5, 4.7);
}

let lastLabelUpdate = 0;
function animate(time) {
  requestAnimationFrame(animate);
  controls.update();
  if (state.presentationAnimating) updatePresentation();
  renderer.render(scene, camera);
  if (state.ready && (needLabels || time - lastLabelUpdate > 140)) {
    updateLabels();
    lastLabelUpdate = time;
  }
}
requestAnimationFrame(animate);

(async () => {
  try {
    badge.textContent = 'Loading verified BodyParts3D package…';
    const response = await fetch('/models/atlas.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error('The verified anatomy package could not be loaded.');
    const atlas = await response.json();
    if (atlas.version !== 'BodyParts3D 4.0' || atlas.parts?.length !== 2234) {
      throw new Error('The anatomy manifest did not pass the 2,234-part source gate.');
    }
    await loadAtlas(atlas);
  } catch (error) {
    console.error(error);
    startFallback(error instanceof Error ? error.message : 'The anatomy package is not ready yet.');
  }
})();
