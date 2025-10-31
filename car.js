/* game.js
   - imports firebase modules
   - imports three.js modules via CDN
   - includes your 3D game code (Three.js) merged with the Firebase login/leaderboard flow
*/

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import * as THREE from 'https://unpkg.com/three@0.164.1/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.164.1/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'https://unpkg.com/three@0.164.1/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'https://unpkg.com/three@0.164.1/examples/jsm/loaders/RGBELoader.js';

/* === FIREBASE CONFIG - REPLACE with your project's config === */
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAtH59VsKgktUW1mmY2ANNC2yjGbFpn1pA",
  authDomain: "car-game-dabc2.firebaseapp.com",
  projectId: "car-game-dabc2",
  storageBucket: "car-game-dabc2.firebasestorage.app",
  messagingSenderId: "950881096527",
  appId: "1:950881096527:web:2598295deff284353beb3a",
  measurementId: "G-WQ8Z13ZJ0W"
};
/* ============================================================ */

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* --- DOM elements (shared between Firebase UI and Three game) --- */
const loadingScreen = document.getElementById('loading-screen');
const loadingProgress = document.getElementById('loading-progress');
const scoreElement = document.getElementById('score');
const gameOverElement = document.getElementById('game-over');
const restartButton = document.getElementById('restart-button');

const leftButton = document.getElementById('left-button');
const rightButton = document.getElementById('right-button');

const loginScreen = document.getElementById('login-screen');
const usernameScreen = document.getElementById('username-screen');
const submitScreen = document.getElementById('submit-screen');
const finalScoreSpan = document.getElementById('final-score');

const leaderboardList = document.getElementById('leaderboard-list');
const playerInfo = document.getElementById('player-info');
const logoutBtn = document.getElementById('logout-btn');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
const startBtn = document.getElementById('start-btn');
const usernameInput = document.getElementById('username');
const submitScoreBtn = document.getElementById('submit-score-btn');
const skipBtn = document.getElementById('skip-btn');

/* --- Firebase state --- */
let currentUser = null;
let username = '';

/* --- Game state (Three.js) --- */
let scene, camera, renderer, carModel, enemyCar;
let ambientLight, directionalLight;
let road, roadLines = [], kerbs = [];
let buildings = [], streetLights = [], trafficLights = [];
const roadWidth = 10;
const roadLength = 200;
const buildingSpacing = 15;
const lightSpacing = 30;
const numBuildings = Math.floor(roadLength * 1.5 / buildingSpacing);
const numLights = Math.floor(roadLength * 1.5 / lightSpacing);

const driveSpeed = 0.5;
const baseEnemySpeed = 0.6;
let enemySpeedMultiplier = 1;
let driveSpeedMultiplier = 1;

const kerbHeight = 0.2;
const kerbWidth = 0.3;

let moveLeft = false, moveRight = false;
const carMoveSpeed = 0.15;
let carBaseY = 0;
let score = 0;
let isGameOver = false;

const points = [];
const numPoints = 15;
const pointValue = 10;
let pointGeometry, pointMaterial;
const pointRadius = 0.3;

let playerBox = new THREE.Box3();
let enemyBox = new THREE.Box3();
let pointBox = new THREE.Box3();

const loadingManager = new THREE.LoadingManager();
loadingManager.onLoad = () => {
  loadingScreen.classList.add('hidden');
  setTimeout(() => {
    loadingScreen.style.display = 'none';
    // start animation loop only when init() already called by username flow
    if (!isGameOver && renderer && scene && camera) animate();
  }, 600);
};
loadingManager.onProgress = (url, itemsLoaded, itemsTotal) => {
  const progress = Math.round((itemsLoaded / itemsTotal) * 100);
  loadingProgress.textContent = `${progress}%`;
};
loadingManager.onError = (url) => {
  console.error('Error loading:', url);
  loadingScreen.textContent = `Error loading: ${url}`;
};

/* --- Firebase: Login / Register flow --- */
loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) return alert('Please enter email and password.');

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    currentUser = cred.user;
    loginScreen.style.display = 'none';
    usernameScreen.style.display = 'flex';
  } catch (err) {
    // try create account
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      currentUser = cred.user;
      loginScreen.style.display = 'none';
      usernameScreen.style.display = 'flex';
    } catch (regErr) {
      alert('Auth error: ' + regErr.message);
    }
  }
});

startBtn.addEventListener('click', () => {
  const val = usernameInput.value.trim();
  if (!val) return alert('Please enter username.');
  username = val;
  usernameScreen.style.display = 'none';
  playerInfo.textContent = `Player: ${username}`;
  init();           // initialize Three scene & load resources
  loadLeaderboard(); // show leaderboard
});

/* Logout */
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  location.reload();
});

/* Submit / Skip handling */
submitScoreBtn.addEventListener('click', async () => {
  if (!currentUser) return alert('Not signed in.');
  try {
    await addDoc(collection(db, 'leaderboard'), {
      uid: currentUser.uid,
      username: username,
      score: score,
      timestamp: Date.now()
    });
    alert('Score submitted!');
    submitScreen.style.display = 'none';
    loadLeaderboard();
  } catch (err) {
    console.error(err);
    alert('Error saving score: ' + err.message);
  }
});
skipBtn.addEventListener('click', () => {
  submitScreen.style.display = 'none';
});

/* Load top 5 leaderboard entries */
async function loadLeaderboard() {
  leaderboardList.innerHTML = '';
  try {
    const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(5));
    const snap = await getDocs(q);
    snap.forEach(doc => {
      const data = doc.data();
      const li = document.createElement('li');
      li.textContent = `${data.username}: ${data.score}`;
      leaderboardList.appendChild(li);
    });
  } catch (err) {
    console.error('Load leaderboard error:', err);
  }
}

/* --- THREE.JS Game Code (adapted from your full code) --- */

function init() {
  // create scene & renderer
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0d7e6);
  scene.fog = new THREE.Fog(0xa0d7e6, roadLength * 0.4, roadLength * 0.9);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 3, -7);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  document.getElementById('container').appendChild(renderer.domElement);

  ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
  directionalLight.position.set(50, 100, 50);
  directionalLight.castShadow = true;
  directionalLight.shadow.mapSize.width = 2048;
  directionalLight.shadow.mapSize.height = 2048;
  scene.add(directionalLight);

  // HDRI (optional) — use loadingManager
  const hdrPath = 'https://threejs.org/examples/textures/equirectangular/';
  const hdrName = 'venice_sunset_1k.hdr';
  new RGBELoader(loadingManager).setPath(hdrPath).load(hdrName, (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    scene.environment = texture;
    scene.background = texture;
  }, undefined, (err) => {
    console.warn('HDRI load failed, using solid color.', err);
    scene.background = new THREE.Color(0xa0d7e6);
  });

  // Ground / road / lines
  const groundGeo = new THREE.PlaneGeometry(roadWidth * 5, roadLength * 1.5);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x55aa55, side: THREE.DoubleSide, roughness: 0.9 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);

  const roadGeo = new THREE.PlaneGeometry(roadWidth, roadLength * 1.5);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
  road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI / 2;
  road.position.y = 0.0;
  scene.add(road);

  // lines
  const lineLength = 4, lineGap = 4;
  const numLines = Math.floor(roadLength * 1.5 / (lineLength + lineGap));
  const lineGeo = new THREE.PlaneGeometry(0.3, lineLength);
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  for (let i = 0; i < numLines; i++) {
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI / 2;
    line.position.y = 0.005;
    line.position.z = (roadLength * 1.5 / 2) - (lineLength / 2) - i * (lineLength + lineGap);
    roadLines.push(line);
    scene.add(line);
  }

  // kerbs
  const kerbTexture = createKerbTexture();
  kerbTexture.wrapS = THREE.RepeatWrapping;
  kerbTexture.repeat.set(roadLength * 1.5 / 4, 1);
  const kerbGeo = new THREE.BoxGeometry(kerbWidth, kerbHeight, roadLength * 1.5);
  const kerbMat = new THREE.MeshStandardMaterial({ map: kerbTexture });
  const kerbLeft = new THREE.Mesh(kerbGeo, kerbMat);
  kerbLeft.position.set(-(roadWidth / 2) - (kerbWidth / 2), kerbHeight / 2, 0);
  scene.add(kerbLeft); kerbs.push(kerbLeft);
  const kerbRight = new THREE.Mesh(kerbGeo, kerbMat);
  kerbRight.position.set((roadWidth / 2) + (kerbWidth / 2), kerbHeight / 2, 0);
  scene.add(kerbRight); kerbs.push(kerbRight);

  // buildings
  for (let i = 0; i < numBuildings; i++) {
    const buildingLeft = createBuilding(), buildingRight = createBuilding();
    const zPos = (roadLength * 1.5 / 2) - (buildingSpacing / 2) - i * buildingSpacing;
    const xOffsetLeft = roadWidth / 2 + kerbWidth + 1 + Math.random() * 5 + buildingLeft.geometry.parameters.width / 2;
    const xOffsetRight = roadWidth / 2 + kerbWidth + 1 + Math.random() * 5 + buildingRight.geometry.parameters.width / 2;
    buildingLeft.position.set(-xOffsetLeft, buildingLeft.geometry.parameters.height / 2, zPos);
    buildingRight.position.set(xOffsetRight, buildingRight.geometry.parameters.height / 2, zPos);
    buildings.push(buildingLeft, buildingRight);
    scene.add(buildingLeft); scene.add(buildingRight);
  }

  // street lights
  for (let i = 0; i < numLights; i++) {
    const lightLeft = createStreetLight(), lightRight = createStreetLight();
    const zPos = (roadLength * 1.5 / 2) - (lightSpacing / 2) - i * lightSpacing;
    const xPos = roadWidth / 2 + kerbWidth + 0.8;
    lightLeft.position.set(-xPos, 0, zPos); lightLeft.rotation.y = Math.PI / 2;
    lightLeft.children[1].position.x = -lightLeft.userData.armLength / 2;
    lightLeft.children[2].position.x = -lightLeft.userData.armLength;
    streetLights.push(lightLeft); scene.add(lightLeft);
    lightRight.position.set(xPos, 0, zPos); lightRight.rotation.y = -Math.PI / 2;
    lightRight.children[1].position.x = -lightRight.userData.armLength / 2;
    lightRight.children[2].position.x = -lightRight.userData.armLength;
    streetLights.push(lightRight); scene.add(lightRight);
  }

  // traffic lights
  const trafficLightLeft = createTrafficLight(), trafficLightRight = createTrafficLight();
  const trafficLightZ = roadLength * 0.4, trafficLightX = roadWidth / 2 + kerbWidth + 0.5;
  trafficLightLeft.position.set(-trafficLightX, 0, trafficLightZ); trafficLightLeft.rotation.y = Math.PI;
  trafficLightRight.position.set(trafficLightX, 0, trafficLightZ); trafficLightRight.rotation.y = -Math.PI;
  trafficLights.push(trafficLightLeft, trafficLightRight);
  scene.add(trafficLightLeft); scene.add(trafficLightRight);

  // points
  pointGeometry = new THREE.SphereGeometry(pointRadius, 16, 16);
  pointMaterial = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xaaaa00, emissiveIntensity: 0.8 });
  for (let i = 0; i < numPoints; i++) {
    const point = new THREE.Mesh(pointGeometry, pointMaterial);
    point.castShadow = true; point.receiveShadow = true;
    resetPointPosition(point, true);
    points.push(point); scene.add(point);
  }

  // loader: car model
  const loader = new GLTFLoader(loadingManager);
  const dracoLoader = new DRACOLoader(loadingManager);
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(dracoLoader);
  const carUrl = 'https://threejs.org/examples/models/gltf/ferrari.glb';

  loader.load(carUrl, (gltf) => {
    carModel = gltf.scene; carModel.scale.set(0.8,0.8,0.8);
    const box = new THREE.Box3().setFromObject(carModel);
    carBaseY = -box.min.y + 0.01;
    carModel.position.set(0, carBaseY, 0);
    carModel.rotation.y = Math.PI;
    carModel.traverse((n) => { if (n.isMesh) n.castShadow = n.receiveShadow = true; });
    scene.add(carModel);

    enemyCar = carModel.clone();
    enemyCar.traverse(node => {
      if (node.isMesh) {
        const mat = node.material.clone();
        mat.color.setHex(0x0000ff);
        mat.metalness = 0.9; mat.roughness = 0.2;
        node.material = mat;
      }
    });
    enemyCar.position.set((Math.random() < 0.5 ? -1 : 1) * roadWidth/4, carBaseY, roadLength * 0.7);
    enemyCar.rotation.y = Math.PI;
    scene.add(enemyCar);

    camera.position.set(0, carBaseY + 3, -7);
    camera.lookAt(carModel.position.x, carBaseY + 1, carModel.position.z + 5);
  }, undefined, (err) => {
    console.warn('Car model load failed, using fallback box.', err);
    const fallbackGeo = new THREE.BoxGeometry(2,1,4);
    const fallbackMat = new THREE.MeshStandardMaterial({ color:0xff0000 });
    carModel = new THREE.Mesh(fallbackGeo, fallbackMat);
    carBaseY = 0.5; carModel.position.set(0,carBaseY,0);
    scene.add(carModel);
    enemyCar = new THREE.Mesh(fallbackGeo, new THREE.MeshStandardMaterial({ color:0x0000ff }));
    enemyCar.position.set(roadWidth/4, carBaseY, roadLength * 0.7);
    scene.add(enemyCar);
    camera.position.set(0, carBaseY + 3, -7);
  });

  // controls
  setupControls();
  restartButton.addEventListener('click', restartGame);
  window.addEventListener('resize', onWindowResize, false);
  updateScoreDisplay();
}

/* --- Controls --- */
function setupControls() {
  window.addEventListener('keydown', (e) => {
    if (isGameOver) return;
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveLeft = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') moveRight = true;
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') moveLeft = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') moveRight = false;
  });

  // mobile pointer controls
  leftButton.addEventListener('pointerdown', () => { if (!isGameOver) moveLeft = true; });
  leftButton.addEventListener('pointerup', () => { moveLeft = false; });
  rightButton.addEventListener('pointerdown', () => { if (!isGameOver) moveRight = true; });
  rightButton.addEventListener('pointerup', () => { moveRight = false; });
}

/* --- Game loop & logic --- */
function animate() {
  if (!renderer) return;
  requestAnimationFrame(animate);
  if (isGameOver) {
    renderer.render(scene, camera);
    return;
  }

  // scenery scroll
  roadLines.forEach(line => {
    line.position.z -= (driveSpeed * driveSpeedMultiplier);
    if (line.position.z < -roadLength * 0.75) line.position.z += roadLength * 1.5;
  });
  kerbs.forEach(k => { k.position.z -= (driveSpeed * driveSpeedMultiplier); if (k.position.z < -roadLength * 0.75) k.position.z += roadLength * 1.5; });

  buildings.forEach(b => {
    b.position.z -= (driveSpeed * driveSpeedMultiplier);
    if (b.position.z < -roadLength * 0.75) b.position.z += buildingSpacing * numBuildings;
  });
  streetLights.forEach(s => {
    s.position.z -= (driveSpeed * driveSpeedMultiplier);
    if (s.position.z < -roadLength * 0.75) s.position.z += lightSpacing * numLights;
  });
  trafficLights.forEach(t => {
    t.position.z -= (driveSpeed * driveSpeedMultiplier);
    if (t.position.z < -roadLength * 0.75) t.position.z += roadLength * 1.5;
  });

  // points
  points.forEach(pt => {
    pt.position.z -= (driveSpeed * driveSpeedMultiplier);
    pt.rotation.y += 0.05;
    if (pt.position.z < -roadLength * 0.75) resetPointPosition(pt);
  });

  // enemy
  if (enemyCar) {
    enemyCar.position.z -= (baseEnemySpeed * enemySpeedMultiplier + driveSpeed * driveSpeedMultiplier);
    if (enemyCar.position.z < -roadLength * 0.75) {
      enemyCar.position.z = roadLength * 0.7 + Math.random() * roadLength * 0.5;
      enemyCar.position.x = (Math.random() < 0.5 ? -1 : 1) * (roadWidth/2 - kerbWidth - 1);
    }
    enemyBox.setFromObject(enemyCar);
  }

  // player movement
  if (carModel) {
    // compute bounds
    let box = new THREE.Box3().setFromObject(carModel);
    let carHalfWidth = (box.max.x - box.min.x) / 2 || 1;
    let maxBounds = (roadWidth / 2) - kerbWidth - carHalfWidth - 0.1;
    if (moveLeft && carModel.position.x > -maxBounds) carModel.position.x -= carMoveSpeed;
    if (moveRight && carModel.position.x < maxBounds) carModel.position.x += carMoveSpeed;
    carModel.position.x = Math.max(-maxBounds, Math.min(maxBounds, carModel.position.x));
    playerBox.setFromObject(carModel);
  }

  // collisions: points
  if (carModel) {
    points.forEach(pt => {
      pointBox.setFromObject(pt);
      if (playerBox.intersectsBox(pointBox) && pt.visible !== false) {
        score += pointValue;
        updateScoreDisplay();
        pt.visible = false;
      }
    });

    // enemy collision
    if (enemyCar) {
      const expanded = playerBox.clone().expandByScalar(0.3);
      if (expanded.intersectsBox(enemyBox)) {
        // game over
        onGameOver();
      }
    }
  }

  renderer.render(scene, camera);
}

/* --- Game over handling: show both 3D game over and Firebase submit overlay --- */
function onGameOver() {
  isGameOver = true;
  gameOverElement.style.display = 'flex';
  // show submit overlay for firebase flow
  finalScoreSpan.textContent = score;
  submitScreen.style.display = 'flex';
}

/* --- Restart logic --- */
function restartGame() {
  isGameOver = false;
  score = 0;
  updateScoreDisplay();
  gameOverElement.style.display = 'none';
  submitScreen.style.display = 'none';

  if (carModel) carModel.position.set(0, carBaseY, 0);
  if (enemyCar) enemyCar.position.set((Math.random() < 0.5? -1 : 1) * roadWidth/4, carBaseY, roadLength * 0.7);
  points.forEach(p => resetPointPosition(p, true));
}

/* === Helpers & small factories === */
function resetPointPosition(point, initial = false) {
  point.position.x = (Math.random() - 0.5) * (roadWidth - 2);
  point.position.y = carBaseY + 0.5;
  point.position.z = initial ? Math.random() * roadLength * 0.7 : roadLength * 0.75 + Math.random() * 10;
  point.visible = true;
}

function updateScoreDisplay() { scoreElement.textContent = `Score: ${score}`; }

function onWindowResize() {
  if (!camera || !renderer) return;
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function createKerbTexture() {
  const canvas = document.createElement('canvas'); canvas.width = 32; canvas.height = 32;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = '#000000'; ctx.fillRect(0, 0, 16, 16); ctx.fillRect(16, 16, 16, 16);
  return new THREE.CanvasTexture(canvas);
}

function createBuilding() {
  const width = 3 + Math.random() * 4, height = 5 + Math.random() * 10, depth = 3 + Math.random() * 4;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const color = new THREE.Color(`hsl(${Math.random() * 360}, 30%, 50%)`);
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.1 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = mesh.receiveShadow = true;
  return mesh;
}

function createStreetLight() {
  const poleHeight = 5 + Math.random() * 3, armLength = 3 + Math.random() * 2;
  const group = new THREE.Group(); group.userData.armLength = armLength;
  const poleGeo = new THREE.CylinderGeometry(0.1, 0.1, poleHeight, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.7 });
  const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.y = poleHeight / 2; group.add(pole);
  const armGeo = new THREE.BoxGeometry(armLength, 0.1, 0.1);
  const arm = new THREE.Mesh(armGeo, poleMat); arm.position.y = poleHeight; group.add(arm);
  const lightGeo = new THREE.SphereGeometry(0.3, 16, 16);
  const lightMat = new THREE.MeshStandardMaterial({ color: 0xffffaa, emissive: 0xffffaa, emissiveIntensity: 0.8 });
  const light = new THREE.Mesh(lightGeo, lightMat); light.position.set(armLength, poleHeight, 0); group.add(light);
  return group;
}

function createTrafficLight() {
  const group = new THREE.Group();
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.05, 3, 6);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
  const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.y = 1.5; group.add(pole);
  const colors = [0xff0000, 0xffff00, 0x00ff00];
  for (let i = 0; i < 3; i++) {
    const lightGeo = new THREE.SphereGeometry(0.2, 12, 12);
    const lightMat = new THREE.MeshStandardMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: 0.8 });
    const light = new THREE.Mesh(lightGeo, lightMat); light.position.y = 2.6 - i * 0.3; group.add(light);
  }
  return group;
}

/* === END of game code === */

/* Note: loadingManager starts loading when GLTFLoader/other loaders used.
   We only call animate() after resources finish (see onLoad handler).
*/

/* Expose endGame to global in case you want to call externally */
window.endGame = onGameOver;

/* (Optional) load initial leaderboard on page load so it's visible even before playing */
loadLeaderboard();
