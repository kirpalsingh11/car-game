// ---------------- Firebase ----------------
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
const auth = firebase.auth();
const db = firebase.firestore();

// --------------- DOM ----------------
const loginScreen = document.getElementById('login-screen');
const usernameScreen = document.getElementById('username-screen');
const submitScreen = document.getElementById('submit-screen');
const leaderboardList = document.getElementById('leaderboard-list');
const playerInfo = document.getElementById('player-info');

const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');
const loginBtn = document.getElementById('login-btn');
const startBtn = document.getElementById('start-btn');
const submitScoreBtn = document.getElementById('submit-score-btn');
const skipBtn = document.getElementById('skip-btn');
const logoutBtn = document.getElementById('logout-btn');
const finalScore = document.getElementById('final-score');

let currentUser = null;
let username = '';
let score = 0;

// ---------------- Login ----------------
loginBtn.addEventListener('click', () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if(!email||!password) return alert("Enter email & password");

  auth.signInWithEmailAndPassword(email, password)
    .then(res => { currentUser = res.user; loginScreen.style.display='none'; usernameScreen.style.display='flex'; })
    .catch(err => {
      auth.createUserWithEmailAndPassword(email,password)
        .then(res => { currentUser = res.user; loginScreen.style.display='none'; usernameScreen.style.display='flex'; })
        .catch(e=>alert(e.message));
    });
});

// ---------------- Username ----------------
startBtn.addEventListener('click', () => {
  username = usernameInput.value.trim();
  if(!username) return alert("Enter username");
  usernameScreen.style.display = 'none';
  playerInfo.textContent = "Player: "+username;
  initGame();
  loadLeaderboard();
});

// ---------------- Leaderboard ----------------
function loadLeaderboard() {
  leaderboardList.innerHTML='';
  db.collection('leaderboard').orderBy('score','desc').limit(5).get()
    .then(snap=>{
      snap.forEach(doc=>{
        const li=document.createElement('li');
        li.textContent=`${doc.data().username}: ${doc.data().score}`;
        leaderboardList.appendChild(li);
      });
    });
}

// ---------------- Submit Score ----------------
submitScoreBtn.addEventListener('click', ()=>{
  if(!currentUser) return;
  db.collection('leaderboard').add({uid:currentUser.uid, username, score, timestamp:Date.now()})
    .then(()=>{alert("Score submitted"); submitScreen.style.display='none'; loadLeaderboard();})
    .catch(e=>{alert("Error: "+e.message)});
});
skipBtn.addEventListener('click',()=>{submitScreen.style.display='none';});
logoutBtn.addEventListener('click',()=>{auth.signOut().then(()=>location.reload());});

// ---------------- 3D Game ----------------
let scene, camera, renderer, carModel, enemyCar;
let road, roadLines=[], kerbs=[];
let buildings=[], streetLights=[], trafficLights=[];
let points=[];
let moveLeft=false, moveRight=false;
let carBaseY=0;
let isGameOver=false;
let pointTimer=0;

const roadWidth=10, roadLength=200;
const sceneryRecycleDistance=roadLength/2;
const driveSpeed=0.5, enemyCarSpeed=0.6;
const numPoints=15, pointValue=10;

function initGame(){
  scene=new THREE.Scene();
  scene.background=new THREE.Color(0xa0d7e6);

  camera=new THREE.PerspectiveCamera(75,window.innerWidth/window.innerHeight,0.1,1000);
  camera.position.set(0,3,-7);

  renderer=new THREE.WebGLRenderer({canvas:document.getElementById('gameCanvas'),antialias:true});
  renderer.setSize(window.innerWidth,window.innerHeight);
  renderer.shadowMap.enabled=true;

  // Lights
  const ambient=new THREE.AmbientLight(0xffffff,0.6);
  scene.add(ambient);
  const dir=new THREE.DirectionalLight(0xffffff,1.5);
  dir.position.set(50,100,50); dir.castShadow=true;
  scene.add(dir);

  // Ground & Road
  const groundMat=new THREE.MeshStandardMaterial({color:0x55aa55});
  const groundGeo=new THREE.PlaneGeometry(roadWidth*5,roadLength*1.5);
  const ground=new THREE.Mesh(groundGeo,groundMat); ground.rotation.x=-Math.PI/2;
  scene.add(ground);

  const roadMat=new THREE.MeshStandardMaterial({color:0x333333});
  const roadGeo=new THREE.PlaneGeometry(roadWidth,roadLength*1.5);
  road=new THREE.Mesh(roadGeo,roadMat); road.rotation.x=-Math.PI/2;
  scene.add(road);

  // Road Lines
  const lineGeo=new THREE.PlaneGeometry(0.3,4);
  const lineMat=new THREE.MeshStandardMaterial({color:0xffffff});
  const lineGap=4;
  const numLines=Math.floor(roadLength*1.5/(4+lineGap));
  for(let i=0;i<numLines;i++){
    const line=new THREE.Mesh(lineGeo,lineMat); line.rotation.x=-Math.PI/2;
    line.position.z=(roadLength*1.5/2)-2-i*(4+lineGap);
    roadLines.push(line); scene.add(line);
  }

  // Player Car
  const loader=new THREE.GLTFLoader();
  const draco=new THREE.DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(draco);
  loader.load('https://threejs.org/examples/models/gltf/ferrari.glb', (gltf)=>{
    carModel=gltf.scene; carModel.scale.set(0.8,0.8,0.8);
    const box=new THREE.Box3().setFromObject(carModel); carBaseY=-box.min.y+0.01;
    carModel.position.set(0,carBaseY,0); carModel.rotation.y=Math.PI;
    carModel.traverse(node=>{if(node.isMesh){node.castShadow=node.receiveShadow=true;}});
    scene.add(carModel);

    // Enemy car clone
    enemyCar=carModel.clone();
    enemyCar.traverse(node=>{if(node.isMesh){node.material=node.material.clone(); node.material.color.setHex(0x0000ff);}});
    enemyCar.position.set(roadWidth/4,carBaseY,roadLength*0.7); scene.add(enemyCar);

    camera.position.set(0,carBaseY+3,-7); camera.lookAt(carModel.position.x,carBaseY+1,carModel.position.z+5);

    animate();
  });

  // Points
  const pointGeo=new THREE.SphereGeometry(0.3,16,16);
  const pointMat=new THREE.MeshStandardMaterial({color:0xffff00,emissive:0xaaaa00});
  for(let i=0;i<numPoints;i++){
    const point=new THREE.Mesh(pointGeo,pointMat);
    resetPoint(point,true);
    points.push(point); scene.add(point);
  }

  // Controls
  window.addEventListener('keydown', e=>{if(e.key==='ArrowLeft'||e.key==='a') moveLeft=true; else if(e.key==='ArrowRight'||e.key==='d') moveRight=true;});
  window.addEventListener('keyup', e=>{if(e.key==='ArrowLeft'||e.key==='a') moveLeft=false; else if(e.key==='ArrowRight'||e.key==='d') moveRight=false;});
  window.addEventListener('resize', ()=>{camera.aspect=window.innerWidth/window.innerHeight;camera.updateProjectionMatrix();renderer.setSize(window.innerWidth,window.innerHeight);});
}

// Reset point position
function resetPoint(point,initial=false){
  point.position.x=(Math.random()*2-1)*(roadWidth/2-1);
  point.position.y=0.3+0.01;
  point.position.z=initial?Math.random()*roadLength*0.8-Math.random()*roadLength*0.4:roadLength/2+Math.random()*roadLength*0.5;
  point.visible=true;
}

// Animate loop
function animate(){
  requestAnimationFrame(animate);
  if(!carModel) return;

  const deltaZ=driveSpeed;

  // Move road lines
  roadLines.forEach(line=>{line.position.z-=deltaZ; if(line.position.z<-sceneryRecycleDistance) line.position.z+=roadLength*1.5;});

  // Move enemy
  if(enemyCar){enemyCar.position.z-=(enemyCarSpeed+driveSpeed); if(enemyCar.position.z<-sceneryRecycleDistance){enemyCar.position.z=roadLength*0.7+Math.random()*roadLength*0.5; enemyCar.position.x=(Math.random()<0.5?-1:1)*(roadWidth/2-1);}}

  // Move player
  if(moveLeft) carModel.position.x=Math.max(-roadWidth/2+1,carModel.position.x-0.15);
  if(moveRight) carModel.position.x=Math.min(roadWidth/2-1,carModel.position.x+0.15);

  // Camera follow
  camera.position.x+= (carModel.position.x*0.5 - camera.position.x)*0.1;
  camera.lookAt(carModel.position.x,carBaseY+1,carModel.position.z+5);

  // Points collision
  const playerBox=new THREE.Box3().setFromObject(carModel);
  points.forEach(point=>{
    if(!point.visible) return;
    const pointBox=new THREE.Box3().setFromObject(point);
    if(playerBox.intersectsBox(pointBox)){score+=pointValue; point.visible=false;}
    point.position.z-=deltaZ; point.rotation.y+=0.05; if(point.position.z<-sceneryRecycleDistance) resetPoint(point);
  });

  // Enemy collision
  const enemyBox=new THREE.Box3().setFromObject(enemyCar);
  const expandedPlayerBox=playerBox.clone().expandByScalar(0.5);
  if(expandedPlayerBox.intersectsBox(enemyBox)){gameOver(); return;}

  // Update score timer
  pointTimer+=deltaZ;
  renderer.render(scene,camera);
}

// Game over
function gameOver(){isGameOver=true; finalScore.textContent=score; submitScreen.style.display='flex';}
