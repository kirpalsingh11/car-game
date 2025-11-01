// --- Firebase config ---
const firebaseConfig = {
  apiKey: "AIzaSyAtH59VsKgktUW1mmY2ANNC2yjGbFpn1pA",
  authDomain: "car-game-dabc2.firebaseapp.com",
  projectId: "car-game-dabc2",
  storageBucket: "car-game-dabc2.appspot.com",
  messagingSenderId: "950881096527",
  appId: "1:950881096527:web:2598295deff284353beb3a",
  measurementId: "G-WQ8Z13ZJ0W"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// --- DOM ---
const usernameScreen = document.getElementById('username-screen');
const submitScreen = document.getElementById('submit-screen');
const leaderboardList = document.getElementById('leaderboard-list');
const playerInfo = document.getElementById('player-info');
const finalScore = document.getElementById('final-score');
const scoreEl = document.getElementById('score');

const usernameInput = document.getElementById('username');
const startBtn = document.getElementById('start-btn');
const submitScoreBtn = document.getElementById('submit-score-btn');
const skipBtn = document.getElementById('skip-btn');

const leftBtn = document.getElementById('left-btn');
const rightBtn = document.getElementById('right-btn');

let username = '';
let score = 0;

// --- Start game ---
startBtn.addEventListener('click', () => {
  username = usernameInput.value.trim();
  if (!username) return alert("Enter a username");
  usernameScreen.style.display='none';
  playerInfo.textContent = "Player: " + username;
  initGame();
  loadLeaderboard();
});

// --- Touch buttons ---
let moveLeft=false, moveRight=false;
leftBtn.addEventListener('mousedown', ()=>moveLeft=true);
leftBtn.addEventListener('mouseup', ()=>moveLeft=false);
rightBtn.addEventListener('mousedown', ()=>moveRight=true);
rightBtn.addEventListener('mouseup', ()=>moveRight=false);

// --- Keyboard controls ---
window.addEventListener('keydown', e=>{
  if(e.key==='ArrowLeft'||e.key==='a') moveLeft=true;
  if(e.key==='ArrowRight'||e.key==='d') moveRight=true;
});
window.addEventListener('keyup', e=>{
  if(e.key==='ArrowLeft'||e.key==='a') moveLeft=false;
  if(e.key==='ArrowRight'||e.key==='d') moveRight=false;
});

// --- Leaderboard ---
submitScoreBtn.addEventListener('click', ()=> {
  db.collection('leaderboard').add({ username, score, timestamp: Date.now() })
    .then(()=>{ alert("Score submitted!"); submitScreen.style.display='none'; loadLeaderboard(); })
    .catch(err=>alert(err.message));
});
skipBtn.addEventListener('click', ()=>{ submitScreen.style.display='none'; });

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

// --- 3D Game ---
let scene, camera, renderer, car, enemies=[], points=[], carBaseY=0, isGameOver=false;

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

  // --- Ground ---
  const roadGeo = new THREE.PlaneGeometry(10,200);
  const roadMat = new THREE.MeshStandardMaterial({color:0x333333});
  const road = new THREE.Mesh(roadGeo, roadMat); 
  road.rotation.x=-Math.PI/2; 
  scene.add(road);

  // --- Side buildings ---
  for(let i=-1;i<=1;i+=2){
    for(let z=0; z<200; z+=20){
      const geo = new THREE.BoxGeometry(3, Math.random()*5+3, 3);
      const mat = new THREE.MeshStandardMaterial({color:Math.random()*0xffffff});
      const building = new THREE.Mesh(geo, mat);
      building.position.set(i*6, geo.parameters.height/2, z);
      scene.add(building);
    }
  }

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

    // --- Initial enemies ---
    for(let i=0;i<2;i++){
      const enemyCar = car.clone();
      enemyCar.traverse(n=>{ if(n.isMesh){ const m=n.material.clone(); m.color.setHex(0xff0000); n.material=m; } });
      enemyCar.position.set((Math.random()*8)-4, carBaseY, Math.random()*50+30);
      scene.add(enemyCar);
      enemies.push(enemyCar);
    }

    // --- Points ---
    for(let i=0;i<15;i++){
      const geo=new THREE.SphereGeometry(0.3,16,16);
      const mat=new THREE.MeshStandardMaterial({color:0xffff00});
      const p=new THREE.Mesh(geo,mat);
      p.position.set((Math.random()*8)-4,0.3,Math.random()*100);
      scene.add(p); points.push(p);
    }

    animate();
  }, undefined, e=>console.error(e));

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

  // Move enemies
  enemies.forEach(enemy=>{
    enemy.position.z-=0.6;
    if(enemy.position.z<-50){ 
      en
