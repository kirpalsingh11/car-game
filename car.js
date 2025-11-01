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
const auth = firebase.auth();
const db = firebase.firestore();

// --- DOM ---
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

let currentUser = null;
let username = '';
let score = 0;

// --- Login ---
loginBtn.addEventListener('click', () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) return alert("Enter email & password");

  auth.signInWithEmailAndPassword(email, password)
    .then(userCred => { currentUser = userCred.user; loginScreen.style.display='none'; usernameScreen.style.display='flex'; })
    .catch(err => {
      auth.createUserWithEmailAndPassword(email, password)
        .then(userCred => { currentUser = userCred.user; loginScreen.style.display='none'; usernameScreen.style.display='flex'; })
        .catch(e=>alert(e.message));
    });
});

// --- Choose Username ---
startBtn.addEventListener('click', () => {
  username = usernameInput.value.trim();
  if (!username) return alert("Enter a username");
  usernameScreen.style.display='none';
  playerInfo.textContent = "Player: " + username;
  initGame();
  loadLeaderboard();
});

// --- Submit Score ---
submitScoreBtn.addEventListener('click', () => {
  if (!currentUser) return;
  db.collection('leaderboard').add({ uid: currentUser.uid, username, score, timestamp: Date.now() })
    .then(()=>{ alert("Score submitted!"); submitScreen.style.display='none'; loadLeaderboard(); })
    .catch(err=>alert(err.message));
});

// --- Skip ---
skipBtn.addEventListener('click', ()=>{ submitScreen.style.display='none'; });

// --- Logout ---
logoutBtn.addEventListener('click', ()=>{ auth.signOut(); location.reload(); });

// --- Load Leaderboard ---
function loadLeaderboard(){
  leaderboardList.innerHTML='';
  db.collection('leaderboard').orderBy('score','desc').limit(5).get()
    .then(snapshot=>{
      snapshot.forEach(doc=>{
        const li=document.createElement('li');
        li.textContent=`${doc.data().username}: ${doc.data().score}`;
        leaderboardList.appendChild(li);
      });
    });
}

// --- Game ---
let scene, camera, renderer, car, enemy;
let moveLeft=false, moveRight=false, carBaseY=0;
let points=[], pointValue=10;
let isGameOver=false;

function initGame(){
  const canvas = document.getElementById('gameCanvas');
  renderer = new THREE.WebGLRenderer({canvas, antialias:true});
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled=true;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa0d7e6);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
  camera.position.set(0,3,-7);

  const light = new THREE.DirectionalLight(0xffffff,1.5);
  light.position.set(50,100,50);
  light.castShadow=true;
  scene.add(light);
  scene.add(new THREE.AmbientLight(0xffffff,0.6));

  // --- Ground & Road ---
  const roadGeo = new THREE.PlaneGeometry(10,200);
  const roadMat = new THREE.MeshStandardMaterial({color:0x333333});
  const road = new THREE.Mesh(roadGeo, roadMat); road.rotation.x=-Math.PI/2; scene.add(road);

  // --- Car ---
  const loader = new THREE.GLTFLoader();
  loader.load('https://threejs.org/examples/models/gltf/ferrari.glb', gltf=>{
    car = gltf.scene; car.scale.set(0.8,0.8,0.8);
    const box = new THREE.Box3().setFromObject(car);
    carBaseY = -box.min.y + 0.01;
    car.position.set(0, carBaseY, 0);
    car.rotation.y=Math.PI;
    car.traverse(n=>{ if(n.isMesh){ n.castShadow=n.receiveShadow=true; } });
    scene.add(car);

    // --- Enemy ---
    enemy = car.clone();
    enemy.traverse(n=>{ if(n.isMesh){ const m=n.material.clone(); m.color.setHex(0x0000ff); n.material=m; } });
    enemy.position.set(3,carBaseY,50);
    scene.add(enemy);

    animate();
  }, undefined, e=>console.error(e));

  // --- Points ---
  for(let i=0;i<15;i++){
    const geo=new THREE.SphereGeometry(0.3,16,16);
    const mat=new THREE.MeshStandardMaterial({color:0xffff00});
    const p=new THREE.Mesh(geo,mat);
    p.position.set((Math.random()*8)-4,0.3,Math.random()*100);
    scene.add(p); points.push(p);
  }

  window.addEventListener('keydown', e=>{
    if(e.key==='ArrowLeft'||e.key==='a') moveLeft=true;
    if(e.key==='ArrowRight'||e.key==='d') moveRight=true;
  });
  window.addEventListener('keyup', e=>{
    if(e.key==='ArrowLeft'||e.key==='a') moveLeft=false;
    if(e.key==='ArrowRight'||e.key==='d') moveRight=false;
  });

  window.addEventListener('resize', ()=>{
    camera.aspect=window.innerWidth/window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function animate(){
  requestAnimationFrame(animate);
  if(!car) return;

  if(moveLeft) car.position.x-=0.15;
  if(moveRight) car.position.x+=0.15;
  car.position.x=Math.max(-4,Math.min(4,car.position.x));

  // Move enemy
  if(enemy) { enemy.position.z-=0.6; if(enemy.position.z<-50){ enemy.position.z=50; enemy.position.x=(Math.random()*8)-4; } }

  // Points collision
  const carBox = new THREE.Box3().setFromObject(car);
  points.forEach(p=>{
    const pBox=new THREE.Box3().setFromObject(p);
    if(carBox.intersectsBox(pBox)&&p.visible){ score+=pointValue; scoreEl.textContent='Score: '+score; p.visible=false; }
  });

  renderer.render(scene,camera);
}

// --- Call this when game ends ---
function endGame(){
  isGameOver=true;
  finalScore.textContent=score;
  submitScreen.style.display='flex';
}
window.endGame=endGame;
