import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// === KONFIGURASI ===
const COLORS = {
  Box: 0x3aa7ff, Sphere: 0x00e5ff, Plane: 0x8b5cf6,
  Cylinder: 0x22c55e, Cone: 0xf59e0b, Torus: 0xef4444
};

// === STATE ===
let scene, camera, renderer, controls, gridHelper, axesHelper;
let selectedObject = null;
let transformMode = 'translate';
let objects = new Map();
let objectIdCounter = 0;
let isPlaying = false;
let clock = new THREE.Clock();

// === INISIALISASI THREE.JS ===
function initThree() {
  const canvas = document.getElementById('viewport');
  const container = document.getElementById('viewport-container');

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0e1a);
  scene.fog = new THREE.Fog(0x0a0e1a, 20, 100);

  const w = container.clientWidth;
  const h = container.clientHeight;

  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000);
  camera.position.set(5, 5, 5);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // Grid + axes
  gridHelper = new THREE.GridHelper(20, 20, 0x2a3548, 0x1a2233);
  scene.add(gridHelper);
  axesHelper = new THREE.AxesHelper(2);
  scene.add(axesHelper);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(5, 10, 5);
  dir.castShadow = true;
  dir.shadow.mapSize.set(1024, 1024);
  scene.add(dir);

  // Orbit controls
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = true;
  controls.minDistance = 1;
  controls.maxDistance = 50;

  // Resize
  window.addEventListener('resize', onResize);
  if ('ResizeObserver' in window) {
    new ResizeObserver(onResize).observe(container);
  }

  // Animate loop
  animate();
  log('Scene 3D siap.', 'success');
}

function onResize() {
  const container = document.getElementById('viewport-container');
  const w = container.clientWidth;
  const h = container.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h, false);
}

// === FABRIKASI GEOMETRI ===
function createGeometry(type) {
  switch (type) {
    case 'Box': return new THREE.BoxGeometry(1, 1, 1);
    case 'Sphere': return new THREE.SphereGeometry(0.5, 32, 16);
    case 'Plane': return new THREE.PlaneGeometry(2, 2);
    case 'Cylinder': return new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
    case 'Cone': return new THREE.ConeGeometry(0.5, 1, 24);
    case 'Torus': return new THREE.TorusGeometry(0.5, 0.2, 16, 32);
    case 'Empty': return new THREE.BoxGeometry(0.1, 0.1, 0.1);
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}

function createMaterial(type) {
  if (type === 'Empty') return new THREE.MeshBasicMaterial({ visible: false });
  const color = COLORS[type] ?? 0x3aa7ff;
  return new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
}

// === TAMBAH OBJEK ===
function addObject(type) {
  const id = `obj_${++objectIdCounter}`;
  const geometry = createGeometry(type);
  const material = createMaterial(type);
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(0, type === 'Plane' ? 0 : 0.5, 0);
  mesh.castShadow = type !== 'Plane';
  mesh.receiveShadow = true;
  if (type === 'Plane') mesh.rotation.x = -Math.PI / 2;

  mesh.userData = { id, type, name: type };
  scene.add(mesh);
  objects.set(id, mesh);

  log(`Ditambah: ${type} (${id})`, 'success');
  refreshHierarchy();

  // Auto select
  selectObject(id);
  return mesh;
}

// === SELEKSI ===
function selectObject(id) {
  // Clear previous
  if (selectedObject) {
    selectedObject.traverse?.(o => {
      if (o.isMesh && o.userData._origColor !== undefined) {
        o.material.color.setHex(o.userData._origColor);
      }
    });
  }

  selectedObject = objects.get(id) || null;

  if (selectedObject) {
    selectedObject.userData._origColor = selectedObject.material.color.getHex();
    selectedObject.material.color.setHex(0xffffff);
    controls.target.copy(selectedObject.position);
    updateInspector();
  }

  refreshHierarchy();
}

// === MODE TRANSFORMASI ===
function setTransformMode(mode) {
  transformMode = mode;
  document.querySelectorAll('#mode-bar button').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === mode);
  });
  log(`Mode: ${mode}`, 'info');
}

// === HIERARCHY UI ===
function refreshHierarchy() {
  const list = document.getElementById('hierarchy-list');
  list.innerHTML = '';
  if (objects.size === 0) {
    list.innerHTML = '<p style="font-size:11px;color:#6b7280">Kosong. Klik + untuk tambah.</p>';
    return;
  }
  objects.forEach((mesh, id) => {
    const div = document.createElement('div');
    div.className = 'hier-item' + (selectedObject === mesh ? ' selected' : '');
    div.textContent = mesh.userData.name;
    div.onclick = () => selectObject(id);
    list.appendChild(div);
  });
}

// === INSPECTOR UI ===
function updateInspector() {
  const c = document.getElementById('inspector-content');
  if (!selectedObject) {
    c.innerHTML = '<p style="font-size:11px;color:#6b7280">Pilih objek dulu</p>';
    return;
  }
  const m = selectedObject;
  const p = m.position, r = m.rotation, s = m.scale;

  c.innerHTML = `
    <div style="margin-bottom:12px">
      <div class="panel-title">Name</div>
      <input id="insp-name" value="${m.userData.name}" style="width:100%;padding:6px;background:#0a0e1a;border:1px solid #2a3548;border-radius:6px;color:#e5e7eb;font-size:12px">
    </div>
    <div style="margin-bottom:12px">
      <div class="panel-title">Position</div>
      <div class="inspector-row"><label>X</label><input type="number" step="0.1" data-prop="position.x" value="${p.x.toFixed(2)}"></div>
      <div class="inspector-row"><label>Y</label><input type="number" step="0.1" data-prop="position.y" value="${p.y.toFixed(2)}"></div>
      <div class="inspector-row"><label>Z</label><input type="number" step="0.1" data-prop="position.z" value="${p.z.toFixed(2)}"></div>
    </div>
    <div style="margin-bottom:12px">
      <div class="panel-title">Rotation</div>
      <div class="inspector-row"><label>X</label><input type="number" step="0.1" data-prop="rotation.x" value="${r.x.toFixed(2)}"></div>
      <div class="inspector-row"><label>Y</label><input type="number" step="0.1" data-prop="rotation.y" value="${r.y.toFixed(2)}"></div>
      <div class="inspector-row"><label>Z</label><input type="number" step="0.1" data-prop="rotation.z" value="${r.z.toFixed(2)}"></div>
    </div>
    <div style="margin-bottom:12px">
      <div class="panel-title">Scale</div>
      <div class="inspector-row"><label>X</label><input type="number" step="0.1" data-prop="scale.x" value="${s.x.toFixed(2)}"></div>
      <div class="inspector-row"><label>Y</label><input type="number" step="0.1" data-prop="scale.y" value="${s.y.toFixed(2)}"></div>
      <div class="inspector-row"><label>Z</label><input type="number" step="0.1" data-prop="scale.z" value="${s.z.toFixed(2)}"></div>
    </div>
    <div style="margin-bottom:12px">
      <div class="panel-title">Color</div>
      <input type="color" id="insp-color" value="#${m.material.color.getHexString()}" style="width:100%;height:32px;border:1px solid #2a3548;border-radius:6px;background:#0a0e1a">
    </div>
    <button id="insp-delete" style="width:100%;padding:8px;background:#ef4444;border:none;border-radius:6px;color:white;font-size:12px;cursor:pointer">Hapus Objek</button>
  `;

  // Bind events
  c.querySelectorAll('input[data-prop]').forEach(input => {
    input.oninput = () => {
      const [prop, axis] = input.dataset.prop.split('.');
      const val = parseFloat(input.value) || 0;
      m[prop][axis] = val;
    };
  });

  document.getElementById('insp-name').oninput = (e) => {
    m.userData.name = e.target.value;
    refreshHierarchy();
  };

  document.getElementById('insp-color').oninput = (e) => {
    m.material.color.set(e.target.value);
  };

  document.getElementById('insp-delete').onclick = () => {
    scene.remove(m);
    objects.delete(m.userData.id);
    selectedObject = null;
    refreshHierarchy();
    updateInspector();
    log(`Dihapus: ${m.userData.name}`, 'warn');
  };
}

// === ANIMATE ===
function animate() {
  requestAnimationFrame(animate);
  const dt = clock.getDelta();

  if (isPlaying) {
    // Rotasi objek saat play (contoh logika sederhana)
    objects.forEach(m => {
      m.rotation.y += dt * 0.5;
    });
  }

  controls.update();
  renderer.render(scene, camera);
}

// === CONSOLE ===
function log(msg, type = 'info') {
  const el = document.getElementById('console');
  const line = document.createElement('span');
  line.style.color = type === 'error' ? '#ef4444'
    : type === 'warn' ? '#f59e0b'
    : type === 'success' ? '#22c55e'
    : '#9ca3af';
  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}  `;
  el.innerHTML = '';
  el.appendChild(line);
  console.log(msg);
}

// === MODAL ===
function openModal() { document.getElementById('modal').classList.add('open'); }
function closeModal() { document.getElementById('modal').classList.remove('open'); }

// === PLAY/STOP ===
function togglePlay() {
  isPlaying = !isPlaying;
  document.getElementById('btn-play').style.display = isPlaying ? 'none' : 'block';
  document.getElementById('btn-stop').style.display = isPlaying ? 'block' : 'none';
  log(isPlaying ? '▶ Play mode' : '⏹ Stop', 'success');
}

// === SAVE (localStorage sederhana) ===
function saveProject() {
  const data = {
    name: document.getElementById('project-name').textContent,
    objects: [...objects.values()].map(m => ({
      id: m.userData.id,
      type: m.userData.type,
      name: m.userData.name,
      position: m.position.toArray(),
      rotation: [m.rotation.x, m.rotation.y, m.rotation.z],
      scale: m.scale.toArray(),
      color: m.material.color.getHex()
    })),
    counter: objectIdCounter
  };
  localStorage.setItem('nexus3d_project', JSON.stringify(data));
  log('💾 Tersimpan di localStorage', 'success');
}

function loadProject() {
  const raw = localStorage.getItem('nexus3d_project');
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    document.getElementById('project-name').textContent = data.name || 'Untitled Project';
    data.objects.forEach(o => {
      const geo = createGeometry(o.type);
      const mat = new THREE.MeshStandardMaterial({ color: o.color, roughness: 0.7, metalness: 0.1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.fromArray(o.position);
      mesh.rotation.set(o.rotation[0], o.rotation[1], o.rotation[2]);
      mesh.scale.fromArray(o.scale);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.userData = { id: o.id, type: o.type, name: o.name };
      scene.add(mesh);
      objects.set(o.id, mesh);
    });
    objectIdCounter = data.counter || objects.size;
    refreshHierarchy();
    log('📂 Proyek dimuat', 'success');
  } catch (e) {
    log('Gagal load: ' + e.message, 'error');
  }
}

// === EVENT BINDING ===
document.getElementById('btn-add').onclick = openModal;
document.getElementById('modal').onclick = (e) => {
  if (e.target.id === 'modal') closeModal();
};
document.querySelectorAll('.primitive-grid button').forEach(b => {
  b.onclick = () => {
    addObject(b.dataset.prim);
    closeModal();
  };
});
document.querySelectorAll('#mode-bar button').forEach(b => {
  b.onclick = () => setTransformMode(b.dataset.mode);
});
document.getElementById('btn-play').onclick = togglePlay;
document.getElementById('btn-stop').onclick = togglePlay;
document.getElementById('btn-save').onclick = saveProject;
document.getElementById('btn-undo').onclick = () => log('Undo (belum diimplementasikan di versi ini)', 'warn');
document.getElementById('btn-redo').onclick = () => log('Redo (belum diimplementasikan di versi ini)', 'warn');
document.getElementById('btn-menu').onclick = () => {
  document.getElementById('hierarchy').classList.toggle('open');
  document.getElementById('inspector').classList.toggle('open');
};

// === START ===
initThree();
loadProject();

// Contoh objek awal jika kosong
if (objects.size === 0) {
  addObject('Box');
  addObject('Plane');
}