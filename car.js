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

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM elements
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
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let currentUser = null;
let username = '';
let score = 0;
let gameRunning = false;

// Login or register
loginBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  if (!email || !password) return alert("Enter email & password");

  try {
    const userCred = await signInWithEmailAndPassword(auth, email, password);
    currentUser = userCred.user;
    loginScreen.style.display = 'none';
    usernameScreen.style.display = 'flex';
  } catch {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      currentUser = userCred.user;
      loginScreen.style.display = 'none';
      usernameScreen.style.display = 'flex';
    } catch (err) {
      alert(err.message);
    }
  }
});

// Choose username
startBtn.addEventListener('click', () => {
  username = usernameInput.value.trim();
  if (!username) return alert("Enter a username");
  usernameScreen.style.display = 'none';
  playerInfo.textContent = "Player: " + username;
  startGame();
  loadLeaderboard();
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  location.reload();
});

// Game logic
function startGame() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  let car = { x: canvas.width / 2 - 25, y: canvas.height - 100, w: 50, h: 80 };
  let obstacles = [];
  let speed = 5;
  score = 0;
  gameRunning = true;

  function drawCar() {
    ctx.fillStyle = 'red';
    ctx.fillRect(car.x, car.y, car.w, car.h);
  }

  function drawObstacles() {
    ctx.fillStyle = 'white';
    for (let obs of obstacles) {
      ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
    }
  }

  function updateObstacles() {
    if (Math.random() < 0.02) {
      obstacles.push({ x: Math.random() * (canvas.width - 50), y: -50, w: 50, h: 50 });
    }
    for (let obs of obstacles) {
      obs.y += speed;
    }
    obstacles = obstacles.filter(o => o.y < canvas.height);
  }

  function checkCollision() {
    for (let obs of obstacles) {
      if (
        car.x < obs.x + obs.w &&
        car.x + car.w > obs.x &&
        car.y < obs.y + obs.h &&
        car.y + car.h > obs.y
      ) {
        endGame();
      }
    }
  }

  function drawScore() {
    ctx.fillStyle = 'white';
    ctx.font = '20px Arial';
    ctx.fillText('Score: ' + score, 20, 30);
  }

  function gameLoop() {
    if (!gameRunning) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    updateObstacles();
    drawCar();
    drawObstacles();
    drawScore();
    checkCollision();
    score++;
    requestAnimationFrame(gameLoop);
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') car.x -= 15;
    if (e.key === 'ArrowRight') car.x += 15;
  });

  gameLoop();
}

// End Game
function endGame() {
  gameRunning = false;
  finalScore.textContent = score;
  submitScreen.style.display = 'flex';
}
window.endGame = endGame;

// Submit score
submitScoreBtn.addEventListener('click', async () => {
  if (!currentUser) return;
  try {
    await addDoc(collection(db, 'leaderboard'), {
      uid: currentUser.uid,
      username: username,
      score: score,
      timestamp: Date.now()
    });
    alert("Score submitted!");
    submitScreen.style.display = 'none';
    loadLeaderboard();
  } catch (err) {
    console.error(err);
    alert("Error saving score");
  }
});

skipBtn.addEventListener('click', () => {
  submitScreen.style.display = 'none';
});

// Load leaderboard
async function loadLeaderboard() {
  leaderboardList.innerHTML = '';
  const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(5));
  const snapshot = await getDocs(q);
  snapshot.forEach(doc => {
    const li = document.createElement('li');
    li.textContent = `${doc.data().username}: ${doc.data().score}`;
    leaderboardList.appendChild(li);
  });
}



