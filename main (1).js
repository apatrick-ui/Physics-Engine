import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import * as CANNON from 'cannon-es';

// ============================================================
//  GROK'S DESTRUCTIVE 3D PHYSICS ENGINE
//  FPS + Orbit, rapid fire, containers, explosives, chaos
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x080812);
scene.fog = new THREE.Fog(0x080812, 40, 110);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 250);
camera.position.set(18, 14, 22);

// ---------- CONTROLS ----------
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.08;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.target.set(0, 3, 0);
orbit.enabled = true;

const fps = new PointerLockControls(camera, document.body);
fps.enabled = false;

let isFPS = false;
const keys = {};
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();
let canJump = false;
const playerSpeed = 12;
const playerSprint = 22;

// Player physics body (capsule-ish)
const playerBody = new CANNON.Body({
  mass: 80,
  shape: new CANNON.Sphere(0.5),
  position: new CANNON.Vec3(0, 3, 12),
  linearDamping: 0.15,
  angularDamping: 1
});
playerBody.fixedRotation = true;

// ---------- WORLD ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -18, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 14;
world.allowSleep = true;

const groundMat = new CANNON.Material('ground');
const boxMat = new CANNON.Material('box');
const sphereMat = new CANNON.Material('sphere');
const explosiveMat = new CANNON.Material('explosive');

world.addContactMaterial(new CANNON.ContactMaterial(groundMat, boxMat, { friction: 0.5, restitution: 0.2 }));
world.addContactMaterial(new CANNON.ContactMaterial(groundMat, sphereMat, { friction: 0.25, restitution: 0.6 }));
world.addContactMaterial(new CANNON.ContactMaterial(boxMat, boxMat, { friction: 0.4, restitution: 0.12 }));
world.addContactMaterial(new CANNON.ContactMaterial(groundMat, explosiveMat, { friction: 0.4, restitution: 0.3 }));
world.addContactMaterial(new CANNON.ContactMaterial(boxMat, explosiveMat, { friction: 0.35, restitution: 0.2 }));

world.addBody(playerBody);

// ---------- LIGHTS ----------
scene.add(new THREE.AmbientLight(0x353555, 0.55));
const dir = new THREE.DirectionalLight(0xffffff, 1.15);
dir.position.set(20, 35, 15);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
dir.shadow.camera.near = 2;
dir.shadow.camera.far = 80;
dir.shadow.camera.left = dir.shadow.camera.bottom = -30;
dir.shadow.camera.right = dir.shadow.camera.top = 30;
scene.add(dir);
scene.add(new THREE.DirectionalLight(0x5566aa, 0.35).translateX(-12).translateY(10).translateZ(-10));

// ---------- GROUND ----------
const groundSize = 80;
const groundMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(groundSize, groundSize),
  new THREE.MeshStandardMaterial({ color: 0x12121c, roughness: 0.9, metalness: 0.05 })
);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const grid = new THREE.GridHelper(groundSize, 80, 0x2a2a44, 0x1a1a2a);
grid.position.y = 0.02;
scene.add(grid);

const groundBody = new CANNON.Body({ type: CANNON.Body.STATIC, shape: new CANNON.Plane(), material: groundMat });
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// ---------- BODY TRACKING ----------
const bodies = []; // { mesh, body, type, life? }
let rapidFire = false;
let ammoType = 0; // 0 box, 1 sphere, 2 plank, 3 explosive
const colors = [0x4488ff, 0x44ff88, 0xff4488, 0xffaa33, 0xaa66ff, 0x33ccff, 0xff6633];

function updateUI() {
  document.getElementById('count').textContent = bodies.length;
  document.getElementById('mode').textContent = isFPS ? 'FIRST PERSON' : 'ORBIT';
  const r = document.getElementById('rapid');
  r.textContent = rapidFire ? 'ON' : 'OFF';
  r.className = rapidFire ? 'on' : 'off';
}

function removeBody(entry) {
  scene.remove(entry.mesh);
  world.removeBody(entry.body);
  const idx = bodies.indexOf(entry);
  if (idx !== -1) bodies.splice(idx, 1);
}

function addDynamic(mesh, body, type = 'normal') {
  scene.add(mesh);
  world.addBody(body);
  const entry = { mesh, body, type };
  bodies.push(entry);
  updateUI();
  return entry;
}

// ---------- OBJECT FACTORIES ----------
function createBox(x, y, z, sx = 1, sy = 1, sz = 1, color = 0x4488ff, mass = null) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.15 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(x, y, z);

  const shape = new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2));
  const body = new CANNON.Body({
    mass: mass !== null ? mass : sx * sy * sz * 1.2,
    shape,
    material: boxMat,
    position: new CANNON.Vec3(x, y, z)
  });
  return addDynamic(mesh, body, 'box');
}

function createSphere(x, y, z, r = 0.55, color = 0xff6644, mass = null) {
  const geo = new THREE.SphereGeometry(r, 20, 20);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.2 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(x, y, z);

  const body = new CANNON.Body({
    mass: mass !== null ? mass : (4 / 3) * Math.PI * r ** 3 * 1.4,
    shape: new CANNON.Sphere(r),
    material: sphereMat,
    position: new CANNON.Vec3(x, y, z)
  });
  return addDynamic(mesh, body, 'sphere');
}

function createPlank(x, y, z, color = 0xcc8844) {
  return createBox(x, y, z, 2.4, 0.25, 0.7, color, 2.5);
}

function createExplosive(x, y, z) {
  const r = 0.55;
  const geo = new THREE.SphereGeometry(r, 16, 16);
  const mat = new THREE.MeshStandardMaterial({ color: 0xff2200, roughness: 0.35, metalness: 0.4, emissive: 0x440000 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.position.set(x, y, z);

  const body = new CANNON.Body({
    mass: 4,
    shape: new CANNON.Sphere(r),
    material: explosiveMat,
    position: new CANNON.Vec3(x, y, z)
  });
  body.addEventListener('collide', (e) => {
    if (e.contact.getImpactVelocityAlongNormal() > 8) {
      explode(body.position);
      const entry = bodies.find(b => b.body === body);
      if (entry) removeBody(entry);
    }
  });
  return addDynamic(mesh, body, 'explosive');
}

function explode(pos, force = 90, radius = 9) {
  // visual flash
  const flash = new THREE.PointLight(0xff4400, 8, 18);
  flash.position.copy(pos);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 120);

  for (const entry of bodies) {
    if (entry.type === 'static') continue;
    const dist = entry.body.position.distanceTo(pos);
    if (dist < radius && dist > 0.1) {
      const dir = entry.body.position.vsub(pos);
      dir.normalize();
      const strength = force * (1 - dist / radius);
      entry.body.applyImpulse(dir.scale(strength), entry.body.position);
      entry.body.wakeUp();
    }
  }
  // also push player a bit
  const pDist = playerBody.position.distanceTo(pos);
  if (pDist < radius) {
    const dir = playerBody.position.vsub(pos);
    dir.normalize();
    playerBody.applyImpulse(dir.scale(force * 0.6 * (1 - pDist / radius)), playerBody.position);
  }
}

// ---------- STATIC STRUCTURES (containers, walls, ramp) ----------
function addStaticBox(x, y, z, sx, sy, sz, color = 0x333355) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(x, y, z);
  scene.add(mesh);

  const body = new CANNON.Body({
    type: CANNON.Body.STATIC,
    shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
    material: groundMat,
    position: new CANNON.Vec3(x, y, z)
  });
  world.addBody(body);
}

// Big outer walls
addStaticBox(0, 3, -38, 76, 6, 1.2, 0x22223a);
addStaticBox(0, 3, 38, 76, 6, 1.2, 0x22223a);
addStaticBox(-38, 3, 0, 1.2, 6, 76, 0x22223a);
addStaticBox(38, 3, 0, 1.2, 6, 76, 0x22223a);

// Containers / crates zones
// Left container open top
addStaticBox(-18, 1.5, -12, 8, 3, 0.4, 0x3a2a1a);
addStaticBox(-18, 1.5, -4, 8, 3, 0.4, 0x3a2a1a);
addStaticBox(-22, 1.5, -8, 0.4, 3, 8, 0x3a2a1a);
addStaticBox(-14, 1.5, -8, 0.4, 3, 8, 0x3a2a1a);

// Right container
addStaticBox(16, 1.5, 8, 7, 3, 0.4, 0x1a2a3a);
addStaticBox(16, 1.5, 15, 7, 3, 0.4, 0x1a2a3a);
addStaticBox(12.5, 1.5, 11.5, 0.4, 3, 7, 0x1a2a3a);
addStaticBox(19.5, 1.5, 11.5, 0.4, 3, 7, 0x1a2a3a);

// Ramp
addStaticBox(0, 1.2, -22, 10, 0.4, 8, 0x444466);
const rampBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Box(new CANNON.Vec3(5, 0.2, 4)),
  material: groundMat
});
rampBody.position.set(0, 1.2, -22);
rampBody.quaternion.setFromEuler(0.35, 0, 0);
world.addBody(rampBody);
// visual for ramp tilt
const rampMesh = new THREE.Mesh(
  new THREE.BoxGeometry(10, 0.4, 8),
  new THREE.MeshStandardMaterial({ color: 0x555577, roughness: 0.7 })
);
rampMesh.position.set(0, 1.2, -22);
rampMesh.rotation.x = 0.35;
rampMesh.castShadow = true;
rampMesh.receiveShadow = true;
scene.add(rampMesh);

// Stack of crates (destructible)
for (let y = 0; y < 4; y++) {
  for (let x = 0; x < 3; x++) {
    for (let z = 0; z < 3; z++) {
      createBox(-6 + x * 1.15, 0.6 + y * 1.15, 6 + z * 1.15, 1.05, 1.05, 1.05, 0x886644);
    }
  }
}

// Some initial free objects + explosives
for (let i = 0; i < 22; i++) {
  const x = (Math.random() - 0.5) * 30;
  const y = 3 + Math.random() * 10;
  const z = (Math.random() - 0.5) * 30;
  const col = colors[Math.floor(Math.random() * colors.length)];
  if (Math.random() > 0.55) createBox(x, y, z, 0.7 + Math.random() * 0.9, 0.7 + Math.random() * 0.9, 0.7 + Math.random() * 0.9, col);
  else createSphere(x, y, z, 0.4 + Math.random() * 0.5, col);
}
createExplosive(5, 4, -5);
createExplosive(-8, 5, 3);
createExplosive(0, 6, 10);

// ---------- SHOOTING ----------
function shoot() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone().add(dir.clone().multiplyScalar(1.4));

  let entry;
  const speed = rapidFire ? 28 : 38;
  const col = colors[Math.floor(Math.random() * colors.length)];

  if (ammoType === 0) {
    entry = createBox(origin.x, origin.y, origin.z, 0.7, 0.7, 0.7, col, 2);
  } else if (ammoType === 1) {
    entry = createSphere(origin.x, origin.y, origin.z, 0.45, col, 2.5);
  } else if (ammoType === 2) {
    entry = createPlank(origin.x, origin.y, origin.z, col);
  } else {
    entry = createExplosive(origin.x, origin.y, origin.z);
  }

  const impulse = dir.multiplyScalar(speed * entry.body.mass);
  entry.body.applyImpulse(new CANNON.Vec3(impulse.x, impulse.y, impulse.z), entry.body.position);
  entry.body.wakeUp();
}

// ---------- INPUT ----------
window.addEventListener('keydown', (e) => {
  keys[e.code] = true;

  if (e.code === 'KeyV') toggleMode();
  if (e.code === 'KeyR') {
    rapidFire = !rapidFire;
    updateUI();
  }
  if (e.code === 'Digit1') ammoType = 0;
  if (e.code === 'Digit2') ammoType = 1;
  if (e.code === 'Digit3') ammoType = 2;
  if (e.code === 'Digit4') ammoType = 3;
  if (e.code === 'KeyC') {
    // clear all dynamic
    [...bodies].forEach(b => removeBody(b));
    updateUI();
  }
  if (e.code === 'KeyN') {
    // NUKE
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone().add(dir.clone().multiplyScalar(3));
    const entry = createSphere(origin.x, origin.y, origin.z, 2.2, 0xff2200, 80);
    entry.body.applyImpulse(new CANNON.Vec3(dir.x * 600, dir.y * 600, dir.z * 600), entry.body.position);
  }
  if (e.code === 'Space' && canJump && isFPS) {
    playerBody.velocity.y = 9;
    canJump = false;
  }
});

window.addEventListener('keyup', (e) => { keys[e.code] = false; });

let mouseDown = false;
window.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  mouseDown = true;
  if (isFPS && fps.isLocked) {
    shoot();
  } else if (!isFPS) {
    // orbit mode click spawn from sky
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, camera);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) {
      const y = 8 + Math.random() * 5;
      if (ammoType === 3) createExplosive(hit.x, y, hit.z);
      else if (ammoType === 2) createPlank(hit.x, y, hit.z);
      else if (ammoType === 1) createSphere(hit.x, y, hit.z, 0.6, colors[Math.floor(Math.random()*colors.length)]);
      else createBox(hit.x, y, hit.z, 0.9, 0.9, 0.9, colors[Math.floor(Math.random()*colors.length)]);
    }
  }
});
window.addEventListener('pointerup', () => { mouseDown = false; });

// FPS lock UI
const blocker = document.getElementById('blocker');
const crosshair = document.getElementById('crosshair');

function toggleMode() {
  isFPS = !isFPS;
  if (isFPS) {
    orbit.enabled = false;
    fps.enabled = true;
    blocker.style.display = 'flex';
    crosshair.style.display = 'block';
    // put player under camera roughly
    playerBody.position.set(camera.position.x, 2, camera.position.z);
  } else {
    fps.unlock();
    fps.enabled = false;
    orbit.enabled = true;
    blocker.style.display = 'none';
    crosshair.style.display = 'none';
    // free camera a bit higher
    camera.position.y = Math.max(camera.position.y, 8);
  }
  updateUI();
}

blocker.addEventListener('click', () => {
  fps.lock();
});
fps.addEventListener('lock', () => { blocker.style.display = 'none'; });
fps.addEventListener('unlock', () => {
  if (isFPS) blocker.style.display = 'flex';
});

// ground contact for jump
const contactNormal = new CANNON.Vec3();
playerBody.addEventListener('collide', (e) => {
  const contact = e.contact;
  if (contact.bi.id === playerBody.id) contact.ni.negate(contactNormal);
  else contactNormal.copy(contact.ni);
  if (contactNormal.y > 0.5) canJump = true;
});

// ---------- RESIZE ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- LOOP ----------
const clock = new THREE.Clock();
let lastShot = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // rapid fire
  if (isFPS && fps.isLocked && mouseDown && rapidFire && time - lastShot > 0.09) {
    shoot();
    lastShot = time;
  }

  // FPS movement
  if (isFPS && fps.isLocked) {
    direction.set(0, 0, 0);
    const forward = Number(keys['KeyW'] || keys['ArrowUp']) - Number(keys['KeyS'] || keys['ArrowDown']);
    const right = Number(keys['KeyD'] || keys['ArrowRight']) - Number(keys['KeyA'] || keys['ArrowLeft']);
    direction.z = forward;
    direction.x = right;
    direction.normalize();

    const speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? playerSprint : playerSpeed;

    // move relative to camera yaw
    const yaw = camera.rotation.y;
    const moveX = direction.x * Math.cos(yaw) + direction.z * Math.sin(yaw);
    const moveZ = -direction.x * Math.sin(yaw) + direction.z * Math.cos(yaw);

    playerBody.velocity.x = moveX * speed;
    playerBody.velocity.z = moveZ * speed;

    // keep camera on player
    camera.position.x = playerBody.position.x;
    camera.position.y = playerBody.position.y + 1.2;
    camera.position.z = playerBody.position.z;
  }

  world.step(1 / 60, dt, 4);

  // sync meshes
  for (const { mesh, body } of bodies) {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  }

  if (!isFPS) orbit.update();
  renderer.render(scene, camera);
}

updateUI();
animate();
