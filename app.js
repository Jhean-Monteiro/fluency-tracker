import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getDatabase, ref, set, get, update } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyD-vNj-q4cMoBBTQCu_A4g2Xlomxb9c6yw",
  authDomain: "tracker-ingles.firebaseapp.com",
  databaseURL: "https://tracker-ingles-default-rtdb.firebaseio.com",
  projectId: "tracker-ingles",
  storageBucket: "tracker-ingles.firebasestorage.app",
  messagingSenderId: "372383906520",
  appId: "1:372383906520:web:14f69e6304162e16c835ad"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const LEVEL_REQUIREMENTS = {
  'Zero': { next: 'A1', mins: 150 * 60 },
  'A1': { next: 'A2', mins: 200 * 60 },
  'A2': { next: 'B1', mins: 250 * 60 },
  'B1': { next: 'B2', mins: 300 * 60 },
  'B2': { next: 'C1', mins: 300 * 60 },
  'C1': { next: 'C2', mins: 400 * 60 },
  'C2': { next: 'Max', mins: 0 }
};

const HELP_TEXTS = {
    levels: `• Zero/A1: Iniciante absoluto.
• A2: Frases básicas e rotina.
• B1/B2: Independência em conversas.
• C1/C2: Fluência avançada/acadêmica.

O sistema calcula o tempo necessário para evoluir entre esses marcos.`,
    app: `Como usar:
1. Digite quanto estudou hoje.
2. O tempo restante diminuirá.
3. Use a aba 'Desempenho' para ver seu progresso diário no gráfico.
4. Ao zerar as horas, você avança de nível!`
};

let currentUser = null;
let userData = null;
let studyChartInstance = null;

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

// Auth Functions
window.register = async () => {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  try { await createUserWithEmailAndPassword(auth, email, pass); } catch (e) { alert(e.message); }
};

window.login = async () => {
  const email = document.getElementById("email").value;
  const pass = document.getElementById("password").value;
  try { await signInWithEmailAndPassword(auth, email, pass); } catch (e) { alert(e.message); }
};

window.logout = () => signOut(auth);

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const snap = await get(ref(db, 'users/' + user.uid));
    if (snap.exists()) {
      userData = snap.val();
      if (!userData.history) userData.history = {};
      updateDashboard();
      showScreen("screen-home");
    } else { showScreen("screen-setup"); }
  } else { showScreen("screen-login"); }
});

window.saveInitialLevel = async () => {
  const level = document.getElementById("level-select").value;
  userData = { level, minsRemaining: LEVEL_REQUIREMENTS[level].mins, history: {} };
  await set(ref(db, 'users/' + currentUser.uid), userData);
  updateDashboard();
  showScreen("screen-home");
};

// Lógica de Estudo
window.addStudyTime = async () => {
  const hInput = document.getElementById('study-hours');
  const mInput = document.getElementById('study-minutes');
  const totalMins = parseInt(hInput.value || 0) * 60 + parseInt(mInput.value || 0);

  if (totalMins <= 0) return;

  userData.minsRemaining -= totalMins;
  const today = new Date().toISOString().split('T')[0];
  userData.history[today] = (userData.history[today] || 0) + totalMins;

  if (userData.minsRemaining <= 0) {
    const next = LEVEL_REQUIREMENTS[userData.level].next;
    if (next !== 'Max') {
      alert(`Parabéns! Você agora é nível ${next}!`);
      userData.level = next;
      userData.minsRemaining = LEVEL_REQUIREMENTS[next].mins - Math.abs(userData.minsRemaining);
    }
  }

  await update(ref(db, 'users/' + currentUser.uid), userData);
  hInput.value = ""; mInput.value = "";
  updateDashboard();
  if (document.getElementById('tab-stats').classList.contains('active')) renderChart();
};

function updateDashboard() {
  document.getElementById('current-level-badge').innerText = `Nível: ${userData.level}`;
  document.getElementById('next-level-target').innerText = LEVEL_REQUIREMENTS[userData.level].next;
  const total = userData.minsRemaining;
  document.getElementById('time-remaining').innerText = `${Math.floor(total/60)}h ${String(total%60).padStart(2, '0')}m`;
}

// UI Helpers
window.switchTab = (tabId) => {
    document.querySelectorAll('.tab-content, .tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabId}`).classList.add('active');
    document.getElementById(`btn-${tabId}`).classList.add('active');
    if (tabId === 'stats') renderChart();
};

window.showHelp = (type) => {
    document.getElementById('help-text').innerText = HELP_TEXTS[type];
    document.getElementById('help-modal').style.display = 'flex';
};

window.closeHelp = () => document.getElementById('help-modal').style.display = 'none';

function renderChart() {
  const ctx = document.getElementById('studyChart').getContext('2d');
  const dates = Object.keys(userData.history || {}).sort().slice(-7); // Últimos 7 dias
  const values = dates.map(d => userData.history[d]);

  if (studyChartInstance) studyChartInstance.destroy();
  studyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates,
      datasets: [{ label: 'Minutos', data: values, backgroundColor: '#4CAF50', borderRadius: 5 }]
    },
    options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { color: '#94a3b8' } }, x: { ticks: { color: '#94a3b8' } } }
    }
  });
}