/* car.js -- full game + firebase (no module imports) */
/* 1) Uses global firebase (compat scripts loaded in index.html)
   2) Uses THREE (three.min + GLTFLoader loaded in index.html)
   3) Keep everything non-module and safe for direct browser use
*/

// ---------- Firebase config & init (guard to avoid double-init) ----------
if (!firebase.apps || !firebase.apps.length) {
  const firebaseConfig = {
    apiKey: "AIzaSyAtH59VsKgktUW1mmY2ANNC2yjGbFpn1pA",
    authDomain: "car-game-dabc2.firebaseapp.com",
    projectId: "car-game-dabc2",
    storageBucket: "car-game-dabc2.firebasestorage.app",
    messagingSenderId: "950881096527",
    appId: "1:950881096527:web:2598295deff284353beb3a",
    measurementId: "G-WQ8Z13ZJ0W"
  };
  firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();
const db = firebase.firestore();

// ---------- DOM ----------
const loginScreen = document.getElementById('login-screen');
const usernameScreen = document.getElementById('username-screen');
const submitScreen = document.getElementById('submit-screen');
const leaderboardList = document.getElementById('leaderboard-list');
const playerInfo = document.getElementById('player-info');
const finalScore = document.getElementById('final-score');
const scoreEl = document.getElementById('score');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');
const loginBtn = document.getElementById('login-btn');
const startBtn = document.getElementById('start-btn');
const submitScoreBtn = document.getElementById('submit-score-btn');
const skipBtn = document.getElementById('skip-btn');
const logoutBtn = document.getElementById('logout-btn');

const touchLeft = document.getElementById('touch-left');
const touchRight = document.getElementById('touch-right');

let currentUser = null;
let username = '';
let score = 0;

// ---------- Auth flow ----------
loginBtn.addEventListener('click', () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) return alert('Enter email & password');

  auth.signInWithEmailAndPassword(email, password)
    .then(cred => {
      currentUser = cred.user;
      loginScreen.style.display = 'none';
      usernameScreen.style.display = 'flex';
    })
    .catch(() => {
      // create account if not exists
      auth.createUserWithEmailAndPassword(email, password)
        .then(cred => {
          currentUser = cred.user;
          loginScreen.style.display = 'none';
          usernameScreen.style.display = 'flex';
        })
        .catch(err => alert(err.message));
    });
});

startBtn.addEventListener('click', () => {
  username = usernameInput.value.trim();
  if (!username) return alert('Enter a username');
  usernameScreen.style.display = 'none';
  playerInfo.textContent = 'Player: ' + username;
  logoutBtn.style.display = 'block';
  initGame();
  loadLeaderboard();
});

submitScoreBtn.addEventListener('click', () => {
  if (!currentUser) return alert('Not signed in');
  db.collection('leaderboard').add({
    uid: currentUser.uid,
    username: username,
    score: score,
    timestamp: Date.now()
  }).then(() => {
    alert('Score submitted!');
    submitScreen.style.display = 'none';
    loadLeaderboard();
  }).catch(err => alert('Error saving score: ' + err.message));
});

skipBtn.addEventListener('click', () => {
  submitScreen.style.display = 'none';
});

logoutBtn.addEventListener('click', () => {
  auth.signOut().then(() => location.reload());
});

function loadLeaderboard() {
  leaderboardList.innerHTML = '';
  db.collection('leaderboard').orderBy('score', 'desc').limit(8).get()
    .then(snap => {
      snap.forEach(doc => {
        const d = doc.data();
        const li = document.createElement('li');
        li.textContent = `${d.username}: ${d.score}`;
        leaderboardList.appendChild(li);
      });
    })
    .catch(e => console.warn('Leaderboard load error', e));
}

// ---------- Game constants ----------
const ROAD_WIDTH = 10;
const ROAD_LENGTH = 200;
const NUM_POINTS = 15;
const BASE_DRIVE_SPEED = 0.6;
const BASE_ENEMY_SPEED = 0.9;
const LANE_X = [ -ROAD_WIDTH/3, 0, ROAD_WIDTH/3 ]; // left, middle, right

// ---------- 3D scene vars ----------
let renderer, scene, camera;
let carModel, enemyModels = [], points = [], buildings = [];
let moveLeft = false, moveRight = false;
let carBaseY = 0;
let driveSpeed = BASE_DRIVE_SPEED;
let enemySpeed = BASE_ENEMY_SPEED;
let difficultyTimer = 0;
let spawnTimer = 0;
let maxEnemies = 1;
let isGameOver = false;

// ---------- Initialize 3D scene ----------
function initGame() {
  const canvas = document.getElementById('gameCanvas');

  renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0d7e6);
  scene.fog = new THREE.Fog(0xa0d7e6, ROAD_LENGTH * 0.4, ROAD_LENGTH * 0.9);

  camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 3, -7);

  // Lights
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dir = new THREE.DirectionalLight(0xffffff, 1.2);
  dir.position.set(50, 100, 50);
  dir.castShadow = true;
  dir.shadow.mapSize.width = dir.shadow.mapSize.height = 2048;
  scene.add(dir);

  // Ground
  const groundGeo = new THREE.PlaneGeometry(ROAD_WIDTH * 5, ROAD_LENGTH * 1.5);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1f6b2a, roughness: 0.95 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI/2; ground.receiveShadow = true; scene.add(ground);

  // Road
  const roadGeo = new THREE.PlaneGeometry(ROAD_WIDTH, ROAD_LENGTH * 1.5);
  const roadMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.7 });
  const road = new THREE.Mesh(roadGeo, roadMat);
  road.rotation.x = -Math.PI/2; road.position.y = 0.01; road.receiveShadow = true; scene.add(road);

  // Road center lines
  const lineGeo = new THREE.PlaneGeometry(0.3, 4);
  const lineMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
  for (let i = 0; i < Math.floor(ROAD_LENGTH * 1.5 / 8); i++) {
    const line = new THREE.Mesh(lineGeo, lineMat);
    line.rotation.x = -Math.PI/2;
    line.position.y = 0.02;
    line.position.z = (ROAD_LENGTH * 1.5 / 2) - i * 8;
    scene.add(line);
    // store in buildings just to move them; not necessary to keep separate array
  }

  // Buildings (simple colored boxes on both sides)
  for (let i = 0; i < 24; i++) {
    const w = 3 + Math.random()*4, h = 8 + Math.random()*24, d = 3 + Math.random()*4;
    const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color().setHSL(Math.random()*0.1+0.05, 0.3, 0.5) });
    const geo = new THREE.BoxGeometry(w,h,d);
    const left = new THREE.Mesh(geo, mat.clone());
    const right = new THREE.Mesh(geo, mat.clone());
    const z = (ROAD_LENGTH*1.5/2) - i * 12;
    left.position.set(-ROAD_WIDTH/2 - w/2 - 1.2, h/2, z + Math.random()*4);
    right.position.set(ROAD_WIDTH/2 + w/2 + 1.2, h/2, z + Math.random()*4);
    left.castShadow = right.castShadow = true;
    scene.add(left); scene.add(right);
    buildings.push(left, right);
  }

  // Points (coins)
  const pointGeo = new THREE.SphereGeometry(0.28, 12, 12);
  const pointMat = new THREE.MeshStandardMaterial({ color: 0xffff66, emissive: 0x222200, metalness: 0.6, roughness: 0.2 });
  for (let i = 0; i < NUM_POINTS; i++) {
    const p = new THREE.Mesh(pointGeo, pointMat);
    resetPoint(p, true);
    scene.add(p);
    points.push(p);
  }

  // Load car model (ferrari) - fallback to simple box if it fails
  const loader = new THREE.GLTFLoader();
  // (draco loader is available via CDN but Ferrari GLB doesn't require it)
  loader.load('https://threejs.org/examples/models/gltf/ferrari.glb',
    function(gltf) {
      carModel = gltf.scene;
      carModel.scale.set(0.8, 0.8, 0.8);
      const box = new THREE.Box3().setFromObject(carModel);
      carBaseY = -box.min.y + 0.01;
      carModel.position.set(0, carBaseY, 0);
      carModel.rotation.y = Math.PI; // face forward
      carModel.traverse(n => { if (n.isMesh) { n.castShadow = n.receiveShadow = true; }});
      scene.add(carModel);

      // create initial enemy from clone
      const enemy = carModel.clone();
      enemy.traverse(n => { if (n.isMesh) { const m = n.material.clone(); m.color.setHex(0x0044ff); n.material = m; }});
      enemy.position.set(LANE_X[2], carBaseY, 60);
      scene.add(enemy);
      enemyModels.push(enemy);
    },
    undefined,
    function(err) {
      console.warn('Model load failed, using fallback geometry', err);
      // fallback player car
      const g = new THREE.BoxGeometry(2, 0.9, 4);
      const m = new THREE.MeshStandardMaterial({ color: 0xff0000 });
      carModel = new THREE.Mesh(g,m); carBaseY = 0.45;
      carModel.position.set(0, carBaseY, 0);
      carModel.castShadow = carModel.receiveShadow = true;
      scene.add(carModel);

      // fallback enemy
      const eg = new THREE.BoxGeometry(2,0.9,4);
      const em = new THREE.MeshStandardMaterial({ color: 0x0044ff });
      const enemy = new THREE.Mesh(eg, em);
      enemy.position.set(LANE_X[2], carBaseY, 60);
      scene.add(enemy);
      enemyModels.push(enemy);
    }
  );

  // Touch controls: hold to move
  let touchLeftActive = false, touchRightActive = false;
  touchLeft.addEventListener('pointerdown', e => { touchLeftActive = true; moveLeft = true; }, {passive:false});
  touchLeft.addEventListener('pointerup', e => { touchLeftActive = false; moveLeft = false; }, {passive:false});
  touchLeft.addEventListener('pointercancel', e => { touchLeftActive = false; moveLeft = false; }, {passive:false});
  touchRight.addEventListener('pointerdown', e => { touchRightActive = true; moveRight = true; }, {passive:false});
  touchRight.addEventListener('pointerup', e => { touchRightActive = false; moveRight = false; }, {passive:false});
  touchRight.addEventListener('pointercancel', e => { touchRightActive = false; moveRight = false; }, {passive:false});

  // Desktop keyboard
  window.addEventListener('keydown', e => {
    if (e.code === 'ArrowLeft' || e.key === 'a') moveLeft = true;
    if (e.code === 'ArrowRight' || e.key === 'd') moveRight = true;
  });
  window.addEventListener('keyup', e => {
    if (e.code === 'ArrowLeft' || e.key === 'a') moveLeft = false;
    if (e.code === 'ArrowRight' || e.key === 'd') moveRight = false;
  });

  // resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  // make sure score shows 0 initially
  score = 0; updateScoreUI();
}

// ---------- Helpers ----------
function resetPoint(p, initial=false) {
  const lane = LANE_X[Math.floor(Math.random()*3)];
  p.position.x = lane + (Math.random()-0.5)*0.6;
  p.position.y = carBaseY + 0.5;
  p.position.z = initial ? (Math.random()*ROAD_LENGTH*0.8 - ROAD_LENGTH*0.4) : (ROAD_LENGTH*0.7 + Math.random()*40);
  p.visible = true;
}

function updateScoreUI() {
  scoreEl.textContent = 'Score: ' + score;
}

// ---------- Difficulty & spawning ----------
function increaseDifficulty(delta) {
  difficultyTimer += delta;
  if (difficultyTimer > 6) { // every 6 seconds increase speed a bit
    difficultyTimer = 0;
    driveSpeed += 0.05;
    enemySpeed += 0.04;
    // gradually allow more enemies
    if (maxEnemies < 3) maxEnemies++;
  }
}

// spawn extra enemies up to maxEnemies
function trySpawnEnemies(delta) {
  spawnTimer += delta;
  if (spawnTimer < 1.0) return;
  spawnTimer = 0;
  // remove enemies too far behind
  enemyModels = enemyModels.filter(e => e && e.position && e.parent);
  while (enemyModels.length < maxEnemies) {
    // clone existing enemy or create box fallback
    let e;
    if (carModel && carModel.clone) {
      e = carModel.clone();
      e.traverse(n => { if (n.isMesh) { const m = n.material.clone(); m.color.setHex(0xff00aa + Math.floor(Math.random()*0x005500)); n.material = m; }});
    } else {
      const geo = new THREE.BoxGeometry(2,0.9,4);
      const mat = new THREE.MeshStandardMaterial({ color: 0xff0044 });
      e = new THREE.Mesh(geo,mat);
      e.castShadow = true;
    }
    const laneIndex = Math.floor(Math.random()*3);
    e.position.set(LANE_X[laneIndex], carBaseY, ROAD_LENGTH*0.7 + Math.random()*80);
    scene.add(e);
    enemyModels.push(e);
  }
}

// ---------- Animation loop ----------
let lastTime = performance.now();
function animate() {
  const now = performance.now();
  const dt = (now - lastTime) / 1000; // seconds
  lastTime = now;

  if (!scene || !carModel) {
    // wait for model -> keep requesting frames until carModel exists
    renderer.render(scene, camera);
    requestAnimationFrame(animate);
    return;
  }

  if (isGameOver) {
    renderer.render(scene, camera);
    return;
  }

  // update difficulty and possibly spawn
  increaseDifficulty(dt);
  trySpawnEnemies(dt);

  // move scenery: buildings & road lines & points slide toward camera
  scene.traverse(obj => {
    // we only move specific arrays below to avoid touching everything
  });

  // move buildings
  buildings.forEach(b => {
    b.position.z -= driveSpeed;
    if (b.position.z < -ROAD_LENGTH*0.8) {
      b.position.z += ROAD_LENGTH * 1.5;
    }
  });

  // move points (coins)
  points.forEach(p => {
    p.position.z -= driveSpeed;
    p.rotation.y += 1.5 * dt;
    if (p.position.z < -ROAD_LENGTH*0.8) resetPoint(p);
  });

  // move enemies toward player
  enemyModels.forEach(e => {
    e.position.z -= (enemySpeed + driveSpeed);
    // if enemy passed behind, recycle further forward
    if (e.position.z < -ROAD_LENGTH*0.8) {
      e.position.z = ROAD_LENGTH*0.7 + Math.random()*80;
      // random lane
      const li = Math.floor(Math.random()*3);
      e.position.x = LANE_X[li] + (Math.random()-0.5)*0.4;
    }
  });

  // player left/right control (smooth)
  const maxX = ROAD_WIDTH/2 - 1.2;
  if (moveLeft) carModel.position.x -= 6 * dt;
  if (moveRight) carModel.position.x += 6 * dt;
  carModel.position.x = Math.max(-maxX, Math.min(maxX, carModel.position.x));

  // update camera to follow player slightly
  camera.position.x += (carModel.position.x*0.5 - camera.position.x) * 0.12;
  camera.position.y = carBaseY + 3;
  camera.position.z = carModel.position.z - 7;
  camera.lookAt(carModel.position.x, carBaseY+1, carModel.position.z + 8);

  // collisions: points
  const playerBox = new THREE.Box3().setFromObject(carModel);
  points.forEach(p => {
    if (!p.visible) return;
    const pb = new THREE.Box3().setFromObject(p);
    if (playerBox.intersectsBox(pb)) {
      score += 10;
      updateScoreUI();
      p.visible = false;
      // small bounce or effect could be added here
    }
  });

  // collisions: enemies -> game over
  for (let i = 0; i < enemyModels.length; i++) {
    const e = enemyModels[i];
    if (!e) continue;
    const eb = new THREE.Box3().setFromObject(e);
    // expand player's box a tiny bit for fairness
    const expanded = playerBox.clone().expandByScalar(0.2);
    if (expanded.intersectsBox(eb)) {
      // game over
      isGameOver = true;
      finalScore.textContent = score;
      submitScreen.style.display = 'flex';
      break;
    }
  }

  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

// ---------- Utility: start loop when everything ready ----------
function startLoopIfReady() {
  if (!renderer || !scene || !camera) return;
  lastTime = performance.now();
  requestAnimationFrame(animate);
}

// ---------- Expose endGame (optional external call) ----------
function endGame() {
  isGameOver = true;
  finalScore.textContent = score;
  submitScreen.style.display = 'flex';
}
window.endGame = endGame;

// ---------- Start game only after user picks username (done in start button) ----------
// The start button (username flow) calls initGame() which will set up the scene and call animate loop when model is present.

// make sure leaderboard shows current user if already signed in (session)
auth.onAuthStateChanged(user => {
  currentUser = user;
  if (user) {
    playerInfo.textContent = playerInfo.textContent.startsWith('Player:') ? playerInfo.textContent : 'Signed in';
    logoutBtn.style.display = 'block';
  } else {
    playerInfo.textContent = 'Not signed in';
    logoutBtn.style.display = 'none';
  }
});

// ---------- Small safety: ensure UI initial state ----------
loadLeaderboard();
updateScoreUI();
