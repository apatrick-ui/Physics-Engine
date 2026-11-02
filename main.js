import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import * as CANNON from 'cannon-es';

// ============================================================
//  GROK'S DESTRUCTIVE 3D PHYSICS PLAYGROUND
//  FPS + Orbit | Rapid fire | Containers | Explosives | Chaos
// ============================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x070710);
scene.fog = new THREE.Fog(0x070710, 45, 120);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 300);
camera.position.set(20, 16, 26);

// ---------- CONTROLS ----------
const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;
orbit.dampingFactor = 0.07;
orbit.maxPolarAngle = Math.PI * 0.49;
orbit.target.set(0, 4, 0);
orbit.enabled = true;

const fps = new PointerLockControls(camera, document.body);
fps.enabled = false;

let isFPS = false;
const keys = {};
const playerSpeed = 14;
const playerSprint = 26;
let canJump = false;

// Player body (sphere is simple + solid)
const playerBody = new CANNON.Body({
  mass: 85,
  shape: new CANNON.Sphere(0.55),
  position: new CANNON.Vec3(0, 4, 14),
  linearDamping: 0.12,
  angularDamping: 1
});
playerBody.fixedRotation = true;

// ---------- PHYSICS WORLD ----------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -22, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 15;
world.allowSleep = true;

const groundMat = new CANNON.Material('ground');
const boxMat = new CANNON.Material('box');
const sphereMat = new CANNON.Material('sphere');
const explosiveMat = new CANNON.Material('explosive');

world.addContactMaterial(new CANNON.ContactMaterial(groundMat, boxMat, { friction: 0.55, restitution: 0.18 }));
world.addContactMaterial(new CANNON.ContactMaterial(groundMat, sphereMat, { friction: 0.22, restitution: 0.62 }));
world.addContactMaterial(new CANNON.ContactMaterial(boxMat, boxMat, { friction: 0.42, restitution: 0.1 }));
world.addContactMaterial(new CANNON.ContactMaterial(groundMat, explosiveMat, { friction: 0.4, restitution: 0.25 }));
world.addContactMaterial(new CANNON.ContactMaterial(boxMat, explosiveMat, { friction: 0.35, restitution: 0.15 }));
world.addContactMaterial(new CANNON.ContactMaterial(sphereMat, explosiveMat, { friction: 0.2, restitution: 0.4 }));

world.addBody(playerBody);

// ---------- LIGHTS ----------
scene.add(new THREE.AmbientLight(0x2a2a44, 0.5));
const dir = new THREE.DirectionalLight(0xffffff, 1.25);
dir.position.set(22, 40, 18);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
dir.shadow.camera.near = 2;
dir.shadow.camera.far = 90;
dir.shadow.camera.left = dir.shadow.camera.bottom = -35;
dir.shadow.camera.right = dir.shadow.camera.top = 35;
scene.add(dir);
scene.add(new THREE.DirectionalLight(0x4455aa, 0.4).translateX(-14).translateY(12).translateZ(-12));

// ---------- GROUND ----------
const groundSize = 90;
const groundMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(groundSize, groundSize),
  new THREE.MeshStandardMaterial({ color: 0x101018, roughness: 0.92, metalness: 0.04 })
);
groundMesh.rotation.x = -Math.PI / 2;
groundMesh.receiveShadow = true;
scene.add(groundMesh);

const grid = new THREE.GridHelper(groundSize, 90, 0x2a2a48, 0x181828);
grid.position.y = 0.015;
scene.add(grid);

const groundBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Plane(),
  material: groundMat
});
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// ---------- BODY TRACKING ----------
const bodies = [];
let rapidFire = false;
let ammoType = 0; // 0 box, 1 sphere, 2 plank, 3 explosive
const ammoNames = ['BOX', 'SPHERE', 'PLANK', 'EXPLOSIVE'];
const colors = [0x4488ff, 0x44ff88, 0xff4488, 0xffaa33, 0xaa66ff, 0x33ccff, 0xff6633, 0x88ffcc];

function updateUI() {
  document.getElementById('count').textContent = bodies.length;
  document.getElementById('mode').textContent = isFPS ? 'FIRST PERSON' : 'ORBIT';
  const r = document.getElementById('rapid');
  r.textContent = rapidFire ? 'ON' : 'OFF';
  r.className = rapidFire ? 'on' : 'off';
  document.getElementById('ammo').textContent = ammoNames[ammoType];
}

function removeBody(entry) {
  scene.remove(entry.mesh);
  world.removeBody(entry.body);
  const idx = bodies.indexOf(entry);
  if (idx !== -1) bodies.splice(idx, 1);
  updateUI();
}

function addDynamic(mesh, body, type = 'normal') {
  scene.add(mesh);
  world.addBody(body);
  const entry = { mesh, body, type };
  bodies.push(entry);
  updateUI();
  return entry;
}

// ---------- FACTORIES ----------
function createBox(x, y, z, sx = 1, sy = 1, sz = 1, color = 0x4488ff, mass = null) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.12 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(x, y, z);

  const body = new CANNON.Body({
    mass: mass !== null ? mass : sx * sy * sz * 1.35,
    shape: new CANNON.Box(new CANNON.Vec3(sx / 2, sy / 2, sz / 2)),
    material: boxMat,
    position: new CANNON.Vec3(x, y, z)
  });
  return addDynamic(mesh, body, 'box');
}

function createSphere(x, y, z, r = 0.55, color = 0xff6644, mass = null) {
  const geo = new THREE.SphereGeometry(r, 18, 18);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.28, metalness: 0.18 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(x, y, z);

  const body = new CANNON.Body({
    mass: mass !== null ? mass : (4 / 3) * Math.PI * r ** 3 * 1.5,
    shape: new CANNON.Sphere(r),
    material: sphereMat,
    position: new CANNON.Vec3(x, y, z)
  });
  return addDynamic(mesh, body, 'sphere');
}

function createPlank(x, y, z, color = 0xcc8844) {
  return createBox(x, y, z, 2.6, 0.22, 0.65, color, 2.8);
}

function createExplosive(x, y, z) {
  const r = 0.58;
  const geo = new THREE.SphereGeometry(r, 14, 14);
  const mat = new THREE.MeshStandardMaterial({
    color: 0xff2200,
    roughness: 0.3,
    metalness: 0.45,
    emissive: 0x330000
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.position.set(x, y, z);

  const body = new CANNON.Body({
    mass: 4.5,
    shape: new CANNON.Sphere(r),
    material: explosiveMat,
    position: new CANNON.Vec3(x, y, z)
  });

  body.addEventListener('collide', (e) => {
    if (e.contact.getImpactVelocityAlongNormal() > 7.5) {
      explode(body.position.clone());
      const entry = bodies.find(b => b.body === body);
      if (entry) removeBody(entry);
    }
  });
  return addDynamic(mesh, body, 'explosive');
}

function explode(pos, force = 110, radius = 10) {
  const flash = new THREE.PointLight(0xff4400, 12, 22);
  flash.position.copy(pos);
  scene.add(flash);
  setTimeout(() => scene.remove(flash), 140);

  // tiny debris particles (visual only)
  for (let i = 0; i < 10; i++) {
    const p = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.15, 0.15),
      new THREE.MeshBasicMaterial({ color: 0xff6622 })
    );
    p.position.copy(pos);
    scene.add(p);
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 18,
      Math.random() * 14 + 4,
      (Math.random() - 0.5) * 18
    );
    const start = performance.now();
    (function anim() {
      const t = (performance.now() - start) / 1000;
      if (t > 0.7) { scene.remove(p); return; }
      p.position.add(vel.clone().multiplyScalar(0.016));
      vel.y -= 28 * 0.016;
      requestAnimationFrame(anim);
    })();
  }

  for (const entry of bodies) {
    if (entry.type === 'static') continue;
    const dist = entry.body.position.distanceTo(pos);
    if (dist < radius && dist > 0.05) {
      const dir = entry.body.position.vsub(pos);
      dir.normalize();
      const strength = force * (1 - dist / radius);
      entry.body.applyImpulse(dir.scale(strength), entry.body.position);
      entry.body.wakeUp();
    }
  }

  const pDist = playerBody.position.distanceTo(pos);
  if (pDist < radius) {
    const dir = playerBody.position.vsub(pos);
    dir.normalize();
    playerBody.applyImpulse(dir.scale(force * 0.55 * (1 - pDist / radius)), playerBody.position);
  }
}

// ---------- STATIC STRUCTURES ----------
function addStaticBox(x, y, z, sx, sy, sz, color = 0x2a2a40) {
  const geo = new THREE.BoxGeometry(sx, sy, sz);
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.08 });
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

// Outer walls
addStaticBox(0, 4, -42, 84, 8, 1.4, 0x1e1e32);
addStaticBox(0, 4, 42, 84, 8, 1.4, 0x1e1e32);
addStaticBox(-42, 4, 0, 1.4, 8, 84, 0x1e1e32);
addStaticBox(42, 4, 0, 1.4, 8, 84, 0x1e1e32);

// Left open container
addStaticBox(-20, 1.8, -14, 9, 3.6, 0.45, 0x3a2a18);
addStaticBox(-20, 1.8, -5, 9, 3.6, 0.45, 0x3a2a18);
addStaticBox(-24.5, 1.8, -9.5, 0.45, 3.6, 9, 0x3a2a18);
addStaticBox(-15.5, 1.8, -9.5, 0.45, 3.6, 9, 0x3a2a18);

// Right open container
addStaticBox(18, 1.8, 6, 8, 3.6, 0.45, 0x1a2a3a);
addStaticBox(18, 1.8, 14, 8, 3.6, 0.45, 0x1a2a3a);
addStaticBox(14, 1.8, 10, 0.45, 3.6, 8, 0x1a2a3a);
addStaticBox(22, 1.8, 10, 0.45, 3.6, 8, 0x1a2a3a);

// Center platform / table
addStaticBox(0, 1.1, 0, 7, 0.35, 5, 0x333355);

// Ramp
addStaticBox(0, 1.4, -24, 12, 0.45, 9, 0x444466);
const rampBody = new CANNON.Body({
  type: CANNON.Body.STATIC,
  shape: new CANNON.Box(new CANNON.Vec3(6, 0.22, 4.5)),
  material: groundMat
});
rampBody.position.set(0, 1.4, -24);
rampBody.quaternion.setFromEuler(0.38, 0, 0);
world.addBody(rampBody);
const rampMesh = new THREE.Mesh(
  new THREE.BoxGeometry(12, 0.45, 9),
  new THREE.MeshStandardMaterial({ color: 0x555577, roughness: 0.7 })
);
rampMesh.position.set(0, 1.4, -24);
rampMesh.rotation.x = 0.38;
rampMesh.castShadow = true;
rampMesh.receiveShadow = true;
scene.add(rampMesh);

// Tall crate tower (destructible)
for (let y = 0; y < 6; y++) {
  for (let x = 0; x < 2; x++) {
    for (let z = 0; z < 2; z++) {
      createBox(-8 + x * 1.2, 0.65 + y * 1.2, 8 + z * 1.2, 1.1, 1.1, 1.1, 0x8a6644);
    }
  }
}

// Mixed scatter + more crates
for (let i = 0; i < 28; i++) {
  const x = (Math.random() - 0.5) * 36;
  const y = 2 + Math.random() * 12;
  const z = (Math.random() - 0.5) * 36;
  const col = colors[Math.floor(Math.random() * colors.length)];
  if (Math.random() > 0.5) {
    createBox(x, y, z, 0.65 + Math.random() * 1.1, 0.65 + Math.random() * 1.1, 0.65 + Math.random() * 1.1, col);
  } else {
    createSphere(x, y, z, 0.35 + Math.random() * 0.55, col);
  }
}

// Explosive barrels placed in fun spots
createExplosive(4, 3, -6);
createExplosive(-10, 4, 4);
createExplosive(2, 5, 12);
createExplosive(-15, 3.5, -8);
createExplosive(12, 4, 9);
createExplosive(0, 8, 0);

// ---------- SHOOTING ----------
function shoot() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const origin = camera.position.clone().add(dir.clone().multiplyScalar(1.6));

  let entry;
  const speed = rapidFire ? 32 : 42;
  const col = colors[Math.floor(Math.random() * colors.length)];

  if (ammoType === 0) {
    entry = createBox(origin.x, origin.y, origin.z, 0.65, 0.65, 0.65, col, 2.2);
  } else if (ammoType === 1) {
    entry = createSphere(origin.x, origin.y, origin.z, 0.42, col, 2.8);
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
  if (e.code === 'Digit1') { ammoType = 0; updateUI(); }
  if (e.code === 'Digit2') { ammoType = 1; updateUI(); }
  if (e.code === 'Digit3') { ammoType = 2; updateUI(); }
  if (e.code === 'Digit4') { ammoType = 3; updateUI(); }
  if (e.code === 'KeyC') {
    [...bodies].forEach(b => removeBody(b));
  }
  if (e.code === 'KeyN') {
    // NUKE — fat heavy ball
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone().add(dir.clone().multiplyScalar(4));
    const entry = createSphere(origin.x, origin.y, origin.z, 2.4, 0xff2200, 95);
    entry.body.applyImpulse(new CANNON.Vec3(dir.x * 750, dir.y * 750, dir.z * 750), entry.body.position);
  }
  if (e.code === 'KeyG') {
    // Gravity slam — temporary stronger gravity + big impulse down on everything
    world.gravity.set(0, -55, 0);
    setTimeout(() => world.gravity.set(0, -22, 0), 1400);
    for (const entry of bodies) {
      entry.body.applyImpulse(new CANNON.Vec3(0, -40, 0), entry.body.position);
      entry.body.wakeUp();
    }
  }
  if (e.code === 'Space' && canJump && isFPS) {
    playerBody.velocity.y = 11;
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
    // Orbit mode: raycast spawn from sky
    const mouse = new THREE.Vector2(
      (e.clientX / window.innerWidth) * 2 - 1,
      -(e.clientY / window.innerHeight) * 2 + 1
    );
    const ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, camera);
    const hit = new THREE.Vector3();
    if (ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) {
      const y = 9 + Math.random() * 6;
      if (ammoType === 3) createExplosive(hit.x, y, hit.z);
      else if (ammoType === 2) createPlank(hit.x, y, hit.z);
      else if (ammoType === 1) createSphere(hit.x, y, hit.z, 0.55, colors[Math.floor(Math.random() * colors.length)]);
      else createBox(hit.x, y, hit.z, 0.9, 0.9, 0.9, colors[Math.floor(Math.random() * colors.length)]);
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
    // drop player under current camera
    playerBody.position.set(camera.position.x, Math.max(2, camera.position.y - 1), camera.position.z);
    playerBody.velocity.set(0, 0, 0);
  } else {
    fps.unlock();
    fps.enabled = false;
    orbit.enabled = true;
    blocker.style.display = 'none';
    crosshair.style.display = 'none';
    camera.position.y = Math.max(camera.position.y, 10);
  }
  updateUI();
}

blocker.addEventListener('click', () => fps.lock());
fps.addEventListener('lock', () => { blocker.style.display = 'none'; });
fps.addEventListener('unlock', () => {
  if (isFPS) blocker.style.display = 'flex';
});

// Jump ground check
const contactNormal = new CANNON.Vec3();
playerBody.addEventListener('collide', (e) => {
  const contact = e.contact;
  if (contact.bi.id === playerBody.id) contact.ni.negate(contactNormal);
  else contactNormal.copy(contact.ni);
  if (contactNormal.y > 0.55) canJump = true;
});

// ---------- RESIZE ----------
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- MAIN LOOP ----------
const clock = new THREE.Clock();
let lastShot = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  const time = clock.elapsedTime;

  // Rapid fire spam
  if (isFPS && fps.isLocked && mouseDown && rapidFire && time - lastShot > 0.08) {
    shoot();
    lastShot = time;
  }

  // FPS movement (WASD + Arrows)
  if (isFPS && fps.isLocked) {
    const forward = Number(keys['KeyW'] || keys['ArrowUp']) - Number(keys['KeyS'] || keys['ArrowDown']);
    const right = Number(keys['KeyD'] || keys['ArrowRight']) - Number(keys['KeyA'] || keys['ArrowLeft']);

    const speed = (keys['ShiftLeft'] || keys['ShiftRight']) ? playerSprint : playerSpeed;

    // move relative to look direction (yaw only)
    const euler = new THREE.Euler(0, 0, 0, 'YXZ');
    euler.setFromQuaternion(camera.quaternion);
    const yaw = euler.y;

    const moveX = right * Math.cos(yaw) + forward * Math.sin(yaw);
    const moveZ = -right * Math.sin(yaw) + forward * Math.cos(yaw);

    playerBody.velocity.x = moveX * speed;
    playerBody.velocity.z = moveZ * speed;

    // stick camera to player
    camera.position.x = playerBody.position.x;
    camera.position.y = playerBody.position.y + 1.35;
    camera.position.z = playerBody.position.z;
  }

  world.step(1 / 60, dt, 4);

  // Sync visuals
  for (const { mesh, body } of bodies) {
    mesh.position.copy(body.position);
    mesh.quaternion.copy(body.quaternion);
  }

  if (!isFPS) orbit.update();
  renderer.render(scene, camera);
}

updateUI();
animate();
