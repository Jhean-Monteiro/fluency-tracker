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
- A2: Frases básicas e rotina.
- B1/B2: Independência em conversas.
- C1/C2: Fluência avançada/acadêmica.

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
let currentPeriod = 'week';

function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}

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
      userData.startDate = '2026-01-01';
      updateDashboard();
      showScreen("screen-home");
    } else { showScreen("screen-setup"); }
  } else { showScreen("screen-login"); }
});

window.saveInitialLevel = async () => {
  const level = document.getElementById("level-select").value;
  userData = { level, minsRemaining: LEVEL_REQUIREMENTS[level].mins, history: {}, startDate: '2026-01-01' };
  await set(ref(db, 'users/' + currentUser.uid), userData);
  updateDashboard();
  showScreen("screen-home");
};

window.addStudyTime = async () => {
  const hInput = document.getElementById('study-hours');
  const mInput = document.getElementById('study-minutes');
  const totalMins = parseInt(hInput.value || 0) * 60 + parseInt(mInput.value || 0);

  if (totalMins <= 0) return;

  userData.minsRemaining -= totalMins;
  const today = new Date();
  const dateStr = today.toLocaleDateString('pt-BR').split('/').reverse().join('-');
  userData.history[dateStr] = (userData.history[dateStr] || 0) + totalMins;

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

function getPeriodInfo(startDate) {
  const start = new Date(startDate + 'T00:00:00-03:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffTime = today - start;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const weekNum = Math.floor(diffDays / 7) + 1;
  const monthNum = Math.floor(diffDays / 30) + 1;
  const twelveWeekNum = Math.floor(diffDays / 84) + 1;
  const yearNum = Math.floor(diffDays / 365) + 1;

  return { weekNum, monthNum, twelveWeekNum, yearNum, diffDays };
}

window.switchStatsPeriod = (period) => {
  document.querySelectorAll('.stats-nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`[data-period="${period}"]`).classList.add('active');
  document.getElementById('tab-stats').dataset.period = period;
  currentPeriod = period;
  renderChart();
};

function getDateRange(period) {
  const startDate = userData.startDate;
  const start = new Date(startDate + 'T00:00:00-03:00');
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let labels = [], data = [], periodNum = 1, avgLabel = 'min/dia', avgValue = 0;
  const history = userData.history || {};

  if (period === 'week') {
    const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
    periodNum = Math.floor(diffDays / 7) + 1;

    for (let i = 0; i < 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (6 - i));
      if (d < start) continue;
      const dateStr = d.toLocaleDateString('pt-BR').split('/').reverse().join('-');
      labels.push(d.toLocaleDateString('pt-BR', { weekday: 'short' }));
      data.push(history[dateStr] || 0);
    }

    const totalMins = data.reduce((a, b) => a + b, 0);
    avgValue = Math.round(totalMins / 7);
    avgLabel = 'min/dia';
  }
  else if (period === 'month') {
    const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
    periodNum = Math.floor(diffDays / 30) + 1;

    for (let i = 0; i < 30; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (29 - i));
      if (d < start) continue;
      const dateStr = d.toLocaleDateString('pt-BR').split('/').reverse().join('-');
      labels.push(String(d.getDate()));
      data.push(history[dateStr] || 0);
    }

    const totalMins = data.reduce((a, b) => a + b, 0);
    const daysWithData = data.filter(v => v > 0).length;
    avgValue = daysWithData > 0 ? Math.round(totalMins / Math.max(daysWithData, 1)) : 0;
    avgLabel = 'min/dia';
  }
  else if (period === 'quarter') {
    // 12 Week Year: cada ciclo = 84 dias (12 semanas × 7)
    const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
    periodNum = Math.floor(diffDays / 84) + 1;

    // Início do ciclo atual
    const cycleStartDay = (periodNum - 1) * 84;

    for (let w = 0; w < 12; w++) {
      let weekMins = 0;
      for (let d = 0; d < 7; d++) {
        const day = new Date(start);
        day.setDate(day.getDate() + cycleStartDay + (w * 7 + d));
        if (day > today) break;
        const dateStr = day.toLocaleDateString('pt-BR').split('/').reverse().join('-');
        weekMins += history[dateStr] || 0;
      }
      labels.push(`S${w + 1}`);
      data.push(Math.round(weekMins / 60 * 10) / 10);
    }

    avgValue = Math.round(data.reduce((a, b) => a + b, 0) / 12);
    avgLabel = 'hrs/sem';
  }
  else if (period === 'year') {
    const diffDays = Math.floor((today - start) / (1000 * 60 * 60 * 24));
    periodNum = Math.floor(diffDays / 365) + 1;

    for (let m = 0; m < 12; m++) {
      const monthDate = new Date(today.getFullYear(), today.getMonth() - (11 - m), 1);
      if (monthDate < start) { labels.push(''); data.push(0); continue; }
      const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
      let monthMins = 0;
      for (let d = 1; d <= daysInMonth; d++) {
        const day = new Date(monthDate.getFullYear(), monthDate.getMonth(), d);
        if (day > today) break;
        const dateStr = day.toLocaleDateString('pt-BR').split('/').reverse().join('-');
        monthMins += history[dateStr] || 0;
      }
      labels.push(monthDate.toLocaleDateString('pt-BR', { month: 'short' }));
      data.push(Math.round(monthMins / 60 * 10) / 10);
    }

    avgValue = Math.round(data.reduce((a, b) => a + b, 0) / 12);
    avgLabel = 'hrs/mês';
  }

  const periodLabels = { week: 'Semana', month: 'Mês', quarter: '12WeekYear', year: 'Ano' };
  const total = period === 'quarter' || period === 'year'
    ? data.reduce((a, b) => a + b, 0).toFixed(1) + ' hrs'
    : Math.round(data.reduce((a, b) => a + b, 0)) + ' min';
  const best = Math.max(...data);
  const bestIdx = data.indexOf(best);
  const bestLabel = labels[bestIdx] || '--';

  return { labels, data, periodNum, periodLabel: `${periodLabels[period]} ${periodNum}`, avgLabel, avgValue, total, bestLabel, best };
}

function renderChart() {
  if (!userData) return;

  const ctx = document.getElementById('studyChart').getContext('2d');
  const { labels, data, periodNum, periodLabel, avgLabel, avgValue, total, bestLabel, best } = getDateRange(currentPeriod);

  const isTimeBased = currentPeriod === 'quarter' || currentPeriod === 'year';

  const labelsMap = {
    week: { avgLabel: 'Média diária', bestLabel: 'Melhor dia' },
    month: { avgLabel: 'Média diária', bestLabel: 'Melhor dia' },
    quarter: { avgLabel: 'Média semanal', bestLabel: 'Melhor semana' },
    year: { avgLabel: 'Média mensal', bestLabel: 'Melhor mês' }
  };

  document.getElementById('period-label').innerText = periodLabel;
  document.getElementById('period-avg').innerText = `Média: ${avgValue} ${avgLabel}`;
  document.getElementById('summary-total').innerText = total;
  document.getElementById('summary-avg').innerText = `${avgValue} ${avgLabel}`;
  document.querySelector('#stats-summary .summary-item:nth-child(2) .summary-label').innerText = labelsMap[currentPeriod].avgLabel;
  document.querySelector('#stats-summary .summary-item:nth-child(3) .summary-label').innerText = labelsMap[currentPeriod].bestLabel;
  document.getElementById('summary-best').innerText = best > 0 ? `${bestLabel}: ${isTimeBased ? best + ' hrs' : best + ' min'}` : '--';

  if (studyChartInstance) studyChartInstance.destroy();

  const maxVal = Math.max(...data) || 10;
  const barPercentage = currentPeriod === 'week' ? 0.9 : (currentPeriod === 'month' ? 1.0 : 0.7);
  const categoryPercentage = currentPeriod === 'week' ? 0.8 : (currentPeriod === 'month' ? 0.95 : 0.9);

  studyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: isTimeBased ? 'Horas' : 'Minutos',
        data: data,
        backgroundColor: data.map((v, i) => v === best && best > 0 ? '#4CAF50' : 'rgba(76, 175, 80, 0.6)'),
        borderColor: '#4CAF50',
        borderWidth: 1,
        borderRadius: 4,
        barPercentage: barPercentage,
        categoryPercentage: categoryPercentage
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { color: '#94a3b8', callback: v => isTimeBased ? v + 'h' : v + 'm' },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        },
        x: {
          ticks: { color: '#94a3b8', font: { size: currentPeriod === 'month' ? 9 : 10 } },
          grid: { display: false }
        }
      }
    }
  });
}
