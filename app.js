import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const SYSTEMS = {
  nervous:{label:'Nervous',color:'#d4ad62'},
  cardiac:{label:'Cardiovascular',color:'#9d4f45'},
  respiratory:{label:'Respiratory',color:'#a66f77'},
  digestive:{label:'Digestive',color:'#a67b54'},
  urinary:{label:'Urinary',color:'#7d6c8f'},
  skeletal:{label:'Skeletal',color:'#d8cfb6'},
};

// Interaction-only stand-ins. Production geometry will come from a separately attributed BodyParts3D import.
const PARTS = [
  ['brain','Brain','nervous','head',[0,2.65,0],[.44,.34,.36],'sphere',100,'Central organ of the nervous system.',['spine']],
  ['spine','Spinal column','skeletal','thorax',[0,1.25,-.15],[.10,1.15,.10],'capsule',85,'Axial support protecting the spinal cord.',['brain','pelvis']],
  ['heart','Heart','cardiac','thorax',[-.10,1.62,.27],[.24,.31,.22],'sphere',100,'Muscular pump at the center of the circulatory system.',['left-lung','right-lung','spine']],
  ['left-lung','Left lung','respiratory','thorax',[-.34,1.72,.16],[.28,.54,.20],'sphere',90,'Respiratory organ occupying the left thorax.',['heart']],
  ['right-lung','Right lung','respiratory','thorax',[.34,1.72,.16],[.31,.58,.21],'sphere',90,'Respiratory organ occupying the right thorax.',['heart','liver']],
  ['liver','Liver','digestive','abdomen',[.22,.92,.22],[.46,.25,.24],'sphere',92,'Large metabolic organ beneath the right diaphragm.',['stomach','right-kidney']],
  ['stomach','Stomach','digestive','abdomen',[-.19,.79,.27],[.26,.30,.18],'sphere',82,'Muscular chamber between the esophagus and small intestine.',['liver','left-kidney']],
  ['left-kidney','Left kidney','urinary','abdomen',[-.28,.58,-.04],[.15,.26,.10],'sphere',78,'Retroperitoneal organ that filters blood and produces urine.',['stomach']],
  ['right-kidney','Right kidney','urinary','abdomen',[.29,.56,-.04],[.15,.25,.10],'sphere',78,'Retroperitoneal organ that filters blood and produces urine.',['liver']],
  ['pelvis','Pelvis','skeletal','pelvis',[0,.15,0],[.48,.23,.26],'torus',86,'Bony ring linking the spine to the lower limbs.',['spine','left-femur','right-femur']],
  ['left-humerus','Left humerus','skeletal','upper limb',[-.77,1.22,0],[.08,.62,.08],'capsule',70,'Long bone of the upper arm.',[]],
  ['right-humerus','Right humerus','skeletal','upper limb',[.77,1.22,0],[.08,.62,.08],'capsule',70,'Long bone of the upper arm.',[]],
  ['left-femur','Left femur','skeletal','lower limb',[-.27,-.65,0],[.11,.82,.11],'capsule',82,'Long bone of the left thigh.',['pelvis']],
  ['right-femur','Right femur','skeletal','lower limb',[.27,-.65,0],[.11,.82,.11],'capsule',82,'Long bone of the right thigh.',['pelvis']],
].map(([id,name,system,region,position,scale,shape,priority,summary,relations])=>({id,name,system,region,position,scale,shape,priority,summary,relations}));

const byId = new Map(PARTS.map(p=>[p.id,p]));
const state = {selectedId:'heart', mode:'reveal', depth:42, labels:true};
const host = document.querySelector('#scene');
const scene = new THREE.Scene();
scene.background = new THREE.Color('#ede7dc');
scene.fog = new THREE.Fog('#ede7dc',5.5,10);
const camera = new THREE.PerspectiveCamera(36,1,.01,40);
camera.position.set(2.8,1.8,5.8);
const renderer = new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
host.appendChild(renderer.domElement);
const controls = new OrbitControls(camera,renderer.domElement);
controls.target.set(0,.85,0);controls.enableDamping=true;controls.minDistance=2.4;controls.maxDistance=11;controls.maxPolarAngle=Math.PI*.96;
scene.add(new THREE.HemisphereLight(0xfffbf1,0x938d82,2.1));
const key = new THREE.DirectionalLight(0xffffff,3.2);key.position.set(-3,5,5);scene.add(key);
const rim = new THREE.DirectionalLight(0xc7eef0,1.4);rim.position.set(4,2,-4);scene.add(rim);
const floor = new THREE.Mesh(new THREE.CircleGeometry(2.4,96),new THREE.MeshStandardMaterial({color:'#d9d0c1',roughness:.92}));floor.rotation.x=-Math.PI/2;floor.position.y=-1.58;scene.add(floor);
const ring = new THREE.Mesh(new THREE.RingGeometry(1.3,1.315,128),new THREE.MeshBasicMaterial({color:'#8e7c64',transparent:true,opacity:.35,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=-1.565;scene.add(ring);
const body = new THREE.Group();scene.add(body);
const meshes = new Map(), basePositions = new Map();
function geometryFor(p){if(p.shape==='capsule')return new THREE.CapsuleGeometry(.5,1.1,7,14);if(p.shape==='torus')return new THREE.TorusGeometry(.65,.20,14,48);return new THREE.SphereGeometry(.5,24,18)}
for(const p of PARTS){
  const mat=new THREE.MeshPhysicalMaterial({color:SYSTEMS[p.system].color,roughness:.62,metalness:.02,clearcoat:.08,transparent:true,opacity:1});
  const mesh=new THREE.Mesh(geometryFor(p),mat);mesh.userData.partId=p.id;mesh.position.set(...p.position);mesh.scale.set(...p.scale);if(p.id==='heart')mesh.rotation.z=-.24;if(p.id==='pelvis')mesh.rotation.x=Math.PI/2;body.add(mesh);meshes.set(p.id,mesh);basePositions.set(p.id,mesh.position.clone());
}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
renderer.domElement.addEventListener('pointerup',e=>{const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hit=raycaster.intersectObjects([...meshes.values()],false)[0];if(hit)selectPart(hit.object.userData.partId)});
const observer=new ResizeObserver(()=>{const w=host.clientWidth,h=host.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false)});observer.observe(host);

const labelsLayer=document.querySelector('#labels-layer');
function updateLabels(){
  if(!state.labels){labelsLayer.replaceChildren();return}
  const v=new THREE.Vector3();
  const candidates=PARTS.map(p=>{const m=meshes.get(p.id);v.copy(m.position).project(camera);return {...p,x:(v.x*.5+.5)*host.clientWidth,y:(-v.y*.5+.5)*host.clientHeight,z:v.z,selected:p.id===state.selectedId}}).filter(p=>p.z>-1&&p.z<1).sort((a,b)=>Number(b.selected)-Number(a.selected)||b.priority-a.priority);
  const placed=[], accepted=[],limit=camera.position.distanceTo(controls.target)<4?14:8;
  for(const c of candidates){if(accepted.length>=limit&&!c.selected)continue;if(!c.selected&&placed.some(p=>Math.hypot(p.x-c.x,p.y-c.y)<72))continue;placed.push({x:c.x,y:c.y});accepted.push(c)}
  const frag=document.createDocumentFragment();
  for(const l of accepted){const btn=document.createElement('button');btn.className='living-label'+(l.selected?' selected':'');btn.style.left=l.x+'px';btn.style.top=l.y+'px';btn.innerHTML=`<span class="label-line"></span><span class="label-text"><strong>${l.name}</strong>${l.selected?`<small>${SYSTEMS[l.system].label}</small>`:''}</span>`;btn.addEventListener('click',()=>selectPart(l.id));frag.appendChild(btn)}
  labelsLayer.replaceChildren(frag);
}

const nameEl=document.querySelector('#structure-name'),metaEl=document.querySelector('#structure-meta'),summaryEl=document.querySelector('#structure-summary'),card=document.querySelector('#structure-card');
function selectPart(id){state.selectedId=id;const p=byId.get(id);if(!p)return;nameEl.textContent=p.name;metaEl.textContent=`${SYSTEMS[p.system].label} · ${p.region}`;summaryEl.textContent=p.summary;card.classList.add('visible');if(state.mode==='explore')setMode('reveal')}
function clearSelection(){state.selectedId=null;card.classList.remove('visible')}
function setMode(mode){if(mode==='trace')return;state.mode=mode;document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));document.querySelectorAll('[data-card-mode]').forEach(b=>b.classList.toggle('active',b.dataset.cardMode===mode))}
document.querySelector('#clear-selection').addEventListener('click',clearSelection);
document.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.mode)));
document.querySelectorAll('[data-card-mode]').forEach(b=>b.addEventListener('click',()=>setMode(b.dataset.cardMode)));
document.querySelectorAll('[data-focus]').forEach(b=>b.addEventListener('click',()=>selectPart(b.dataset.focus)));
const depth=document.querySelector('#depth'),depthOutput=document.querySelector('#depth-output');depth.addEventListener('input',()=>{state.depth=Number(depth.value);depthOutput.textContent=state.depth+'%'});
const labelsToggle=document.querySelector('#labels-toggle');labelsToggle.addEventListener('click',()=>{state.labels=!state.labels;labelsToggle.classList.toggle('active',state.labels)});

const searchModal=document.querySelector('#search-modal'),aboutModal=document.querySelector('#about-modal'),searchInput=document.querySelector('#search-input'),searchResults=document.querySelector('#search-results');
function renderSearch(){const q=searchInput.value.trim().toLowerCase();const results=PARTS.filter(p=>p.name.toLowerCase().includes(q)).slice(0,8);searchResults.replaceChildren(...results.map(p=>{const b=document.createElement('button');b.innerHTML=`<span class="system-dot" style="background:${SYSTEMS[p.system].color}"></span><span><strong>${p.name}</strong><small>${SYSTEMS[p.system].label} · ${p.region}</small></span>`;b.addEventListener('click',()=>{selectPart(p.id);searchModal.hidden=true});return b}))}
document.querySelector('#search-open').addEventListener('click',()=>{searchModal.hidden=false;searchInput.focus();renderSearch()});document.querySelector('#about-open').addEventListener('click',()=>aboutModal.hidden=false);searchInput.addEventListener('input',renderSearch);
document.querySelectorAll('[data-close="search"]').forEach(b=>b.addEventListener('click',()=>searchModal.hidden=true));document.querySelectorAll('[data-close="about"]').forEach(b=>b.addEventListener('click',()=>aboutModal.hidden=true));searchModal.addEventListener('pointerdown',e=>{if(e.target===searchModal)searchModal.hidden=true});aboutModal.addEventListener('pointerdown',e=>{if(e.target===aboutModal)aboutModal.hidden=true});window.addEventListener('keydown',e=>{if(e.key==='/'&&document.activeElement?.tagName!=='INPUT'){e.preventDefault();searchModal.hidden=false;searchInput.focus();renderSearch()}if(e.key==='Escape'){searchModal.hidden=true;aboutModal.hidden=true}});

const clock=new THREE.Clock();
function animate(){requestAnimationFrame(animate);const selected=state.selectedId?byId.get(state.selectedId):null,selectedPos=selected?new THREE.Vector3(...selected.position):null,f=state.depth/100;
  for(const p of PARTS){const mesh=meshes.get(p.id),base=basePositions.get(p.id),mat=mesh.material,isSelected=p.id===state.selectedId,related=selected&&(selected.relations.includes(p.id)||p.relations.includes(selected.id));let target=base.clone();
    if(state.mode==='reveal'&&selectedPos&&!isSelected){const away=base.clone().sub(selectedPos);if(away.lengthSq()<.002)away.set(base.x>=0?1:-1,.2,.2);away.normalize();const influence=Math.max(0,1-base.distanceTo(selectedPos)/2.4);target.addScaledVector(away,f*influence*.95)}
    else if(state.mode==='explore'){target.x+=Math.sign(base.x||.01)*f*.12;target.y+=(base.y-.6)*f*.06}
    else if(state.mode==='relate'&&selectedPos&&related){target.add(base.clone().sub(selectedPos).normalize().multiplyScalar(.14))}
    mesh.position.lerp(target,.085);const xrayOpacity=state.mode==='xray'&&state.selectedId&&!isSelected?.12+(1-f)*.22:1,quietOpacity=state.mode==='reveal'&&state.selectedId&&!isSelected?.34+(1-f)*.42:1,relateOpacity=state.mode==='relate'&&state.selectedId&&!isSelected&&!related?.10:1;mat.opacity=Math.min(xrayOpacity,quietOpacity,relateOpacity);mat.emissive.set(isSelected?'#4b9e9d':related&&state.mode==='relate'?'#6d8b86':'#000000');mat.emissiveIntensity=isSelected?.38:related&&state.mode==='relate'?.18:0}
  const t=clock.getElapsedTime();if(!state.selectedId&&state.mode==='explore')body.rotation.y=Math.sin(t*.12)*.08;else body.rotation.y*=.94;controls.update();renderer.render(scene,camera);updateLabels()}
animate();
