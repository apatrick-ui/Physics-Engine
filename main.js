import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as CANNON from 'cannon-es';

// ============================================================
//  GROK'S 3D PHYSICS ENGINE
//  Three.js render + Cannon-es rigid body physics
//  Pure frontend — runs on GitHub Pages with zero config
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a12);
scene.fog = new THREE.Fog(0x0a0a12, 25, 80);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// Camera
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(12, 10, 16);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.maxPolarAngle = Math.PI * 0.48;
controls.target.set(0, 2, 0);

// Lights
const ambient = new THREE.AmbientLight(0x404060, 0.6);
scene.add(ambient);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.1);
dirLight.position.set(15, 25, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.set(2048, 2048);
dirLight.shadow.camera.near = 1;
dirLight.shadow.camera.far = 60;
dirLight.shadow.camera.left = -20;
dirLight.shadow.camera.right = 20;
dirLight.shadow.camera.top = 20;
dirLight.shadow.camera.bottom = -20;
scene.add(dirLight);

const fill = new THREE.DirectionalLight(0x6688ff, 0.35);
fill.position.set(-10, 8, -8);
scene.add(fill);

// ============================================================
//  PHYSICS WORLD
// ============================================================
const world = new CANNON.World({
  gravity: new CANNON.Vec3(0, -9.82, 0)
});
world.broadphase = new CANNON.NaiveBroadphase();
world.solver.iterations = 12;
world.allowSleep = true;

// Shared materials
const groundMat = new CANNON.Material('ground');
const boxMat = new CANNON.Material('box');
const sphereMat = new CANNON.Material('sphere');

const groundBoxContact = new CANNON.ContactMaterial(groundMat, boxMat, {
  friction: 0.45,
  restitution: 0.25
});
const groundSphereContact = new CANNON.ContactMaterial(groundMat, sphereMat, {
  friction: 0.3,
  restitution: 0.55
});
const boxBoxContact = new CANNON.ContactMaterial(boxMat, boxMat, {
  friction: 0.4,
  restitution: 0.15
});
world.addContactMaterial(groundBoxContact);
world.addContactMaterial(groundSphereContact);
world.addContactMaterial(boxBoxContact);

// ============================================================
//  GROUND
// ============================================================
const groundSize = 40;
const groundGeo = new THREE.PlaneGeometry(groundSize, groundSize);
const groundMeshMat = new THREE.MeshStandardMaterial({
  color: 0x1a1a28,
  roughness: 0.85,
  metalness: 0.1
});
const groundMesh = new THREE.Mesh(groundGeo, groundMeshMat);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

// Grid helper
const grid = new THREE.GridHelper(groundSize, 40, 0x333355, 0x222233);
grid.position.y = 0.01;
scene.add(grid);

const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane(),
  material: groundMat
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// ============================================================
//  BODY MANAGEMENT
// ============================================================
const bodies = []; // { mesh, body }

function addBox(x, y, z, size = 1, color = 0x4488ff) {
  const half = size / 2;
  const geo = new THREE.BoxGeometry(size, size, size);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.2
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(x, y, z);
  scene.add(mesh);

  const shape = new CANNON.Box(new CANNON.Vec3(half, half, half));
  const body = new CANNON.Body({
    mass: size * size * size, // density ~1
    shape,
    material: boxMat,
    position: new CANNON.Vec3(x, y, z)
  });
  world.addBody(body);

  bodies.push({ mesh, body });
  updateCount();
  return { mesh, body };
}

function addSphere(x, y, z, radius = 0.6, color = 0xff6644) {
  const geo = new THREE.SphereGeometry(radius, 24, 24);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.3,
    metalness: 0.15
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(x, y, z);
  scene.add(mesh);

  const shape = new CANNON.Sphere(radius);
  const body = new CANNON.Body({
    mass: (4 / 3) * Math.PI * radius * radius * radius,
    shape,
    material: sphereMat,
    position: new CANNON.Vec3(x, y, z)
  });
  world.addBody(body);

  bodies.push({ mesh, body });
  updateCount();
  return { mesh, body };
}

function updateCount() {
  document.getElementById('count').textContent = bodies.length;
}

// Initial chaos
const colors = [0x4488ff, 0x44ff88, 0xff4488, 0xffaa33, 0xaa66ff, 0x33ccff];
for (let i = 0; i < 18; i++) {
  const x = (Math.random() - 0.5) * 10;
  const y = 4 + Math.random() * 8;
  const z = (Math.random() - 0.5) * 10;
  const size = 0.6 + Math.random() * 0.9;
  const col = colors[Math.floor(Math.random() * colors.length)];
  if (Math.random() > 0.35) {
    addBox(x, y, z, size, col);
  } else {
    addSphere(x, y, z, size * 0.55, col);
  }
}

// ============================================================
//  CLICK TO SPAWN
// ============================================================
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // y = 0

window.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return; // left click only

  mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const hit = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, hit);

  if (hit) {
    const y = 6 + Math.random() * 4;
    const size = 0.7 + Math.random() * 0.8;
    const col = colors[Math.floor(Math.random() * colors.length)];
    if (Math.random() > 0.4) {
      addBox(hit.x, y, hit.z, size, col);
    } else {
      addSphere(hit.x, y, hit.z, size * 0.55, col);
    }
  }
});

// ============================================================
//  RESIZE
// ============================================================
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ============================================================
//  LOOP
// ============================================================
const clock = new THREE.Clock();
let lastTime = 0;

function animate(time) {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05); // clamp big spikes

  // Step physics
  world.step(1 / 60, dt, 3);

  // Sync meshes to bodies
  for (const { mesh, body } of bodies) {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
