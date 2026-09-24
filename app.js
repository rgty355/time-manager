"use strict";

const STORAGE_KEY = "timemanager_data_v3";

let appData = {
  pendingTasks: [],
  schedules: {}, // Format: { "YYYY-MM-DD": [ { id, title, start, end, type } ] }
  notes: "",
  quickChecks: [],
  settings: {
    apiKey: "",
    bgColor: "#131722",
    accentColor: "#6366f1"
  }
};

let selectedDate = getToday();
let currentWeekStart = getMonday(new Date());

/* =========================
   UTILITAIRES DATES & HEURES
   ========================= */

function getToday() {
  const d = new Date();
  return formatDate(d);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseTime(t) {
  if (!t || !t.includes(":")) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function minutesToTime(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function getMonday(d) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

function uid() {
  return Date.now() + Math.floor(Math.random() * 100000);
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
}

function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    appData = { ...appData, ...JSON.parse(saved) };
  }
}

/* =========================
   PLAGE HORAIRE ADAPTATIVE (06h - 23h + Extension)
   ========================= */

function getDayBoundaries(dateStr) {
  const schedule = appData.schedules[dateStr] || [];
  
  let startHour = 6;  // Heure de début par défaut : 06h00
  let endHour = 23;   // Heure de fin par défaut : 23h00

  schedule.forEach(item => {
    const itemStartMins = parseTime(item.start);
    const itemEndMins = parseTime(item.end);

    const itemStartHour = Math.floor(itemStartMins / 60);
    const itemEndHour = Math.ceil(itemEndMins / 60);

    if (itemStartHour < startHour) startHour = itemStartHour;
    if (itemEndHour > endHour) endHour = itemEndHour;
  });

  return { startHour: Math.max(0, startHour), endHour: Math.min(24, endHour) };
}

/* =========================
   RENDU PLANNING & SEMAINE
   ========================= */

function getSchedule(date = selectedDate) {
  if (!appData.schedules[date]) {
    appData.schedules[date] = [];
    saveData();
  }
  return appData.schedules[date];
}

function renderSchedule() {
  const container = document.getElementById("timelineGrid");
  if (!container) return;

  const schedule = getSchedule(selectedDate);
  const { startHour, endHour } = getDayBoundaries(selectedDate);
  
  container.innerHTML = "";

  // En-tête informatif sur la plage affichée
  const rangeHeader = document.createElement("div");
  rangeHeader.className = "text-[11px] text-slate-400 mb-2 font-mono";
  rangeHeader.textContent = `Plage affichée : ${String(startHour).padStart(2, '0')}:00 - ${String(endHour).padStart(2, '0')}:00`;
  container.appendChild(rangeHeader);

  if (schedule.length === 0) {
    const empty = document.createElement("div");
    empty.className = "text-xs text-slate-500 italic p-6 text-center border border-dashed border-white/10 rounded-xl";
    empty.textContent = "Aucun créneau planifié pour cette journée (Libre de 06h à 23h).";
    container.appendChild(empty);
  } else {
    const sorted = [...schedule].sort((a, b) => parseTime(a.start) - parseTime(b.start));

    sorted.forEach(item => {
      const div = document.createElement("div");
      div.className = "p-3 rounded-xl border border-app-border flex justify-between items-center gap-3 bg-black/40 hover:bg-black/60 transition";
      
      div.innerHTML = `
        <div>
          <div class="font-medium text-sm text-white">${escapeHTML(item.title)}</div>
          <div class="text-xs text-slate-400 mt-0.5">${item.start} - ${item.end}</div>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono uppercase">${item.type || 'fixe'}</span>
          <button class="delete-item text-xs text-rose-400 hover:text-rose-300 px-1.5 py-1">✕</button>
        </div>
      `;

      div.querySelector(".delete-item").addEventListener("click", () => {
        appData.schedules[selectedDate] = schedule.filter(x => x.id !== item.id);
        saveData();
        renderSchedule();
      });

      container.appendChild(div);
    });
  }

  updateStats();
}

function escapeHTML(str) {
  return String(str ?? '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/* =========================
   GESTION DES TÂCHES
   ========================= */

function addTask(title, duration, priority, targetDate = selectedDate) {
  if (!title.trim()) return;

  const task = {
    id: uid(),
    title: title.trim(),
    duration: Number(duration),
    priority: priority,
    date: targetDate,
    createdAt: Date.now()
  };

  appData.pendingTasks.push(task);
  saveData();

  renderTasksList();
}

function renderTasksList() {
  const container = document.getElementById("fullTasksContainer");
  if (!container) return;

  container.innerHTML = "";

  if (appData.pendingTasks.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 italic col-span-2">Aucune tâche enregistrée.</div>`;
    return;
  }

  appData.pendingTasks.forEach(task => {
    const div = document.createElement("div");
    div.className = "p-3.5 rounded-xl border border-app-border bg-black/40 flex justify-between items-center";
    
    div.innerHTML = `
      <div>
        <div class="text-xs font-bold text-white">${escapeHTML(task.title)}</div>
        <div class="text-[11px] text-slate-400 mt-1">${task.duration} min • Priorité : ${task.priority}</div>
      </div>
      <button class="delete-task text-xs text-rose-400 hover:text-rose-300">Supprimer</button>
    `;

    div.querySelector(".delete-task").addEventListener("click", () => {
      appData.pendingTasks = appData.pendingTasks.filter(t => t.id !== task.id);
      saveData();
      renderTasksList();
    });

    container.appendChild(div);
  });
}

/* =========================
   STATISTIQUES ET VUES
   ========================= */

function updateStats() {
  const schedule = getSchedule();
  let work = 0;

  schedule.forEach(item => {
    const dur = parseTime(item.end) - parseTime(item.start);
    if (dur > 0) work += dur;
  });

  const h = Math.floor(work / 60);
  const m = work % 60;

  const statWork = document.getElementById("statWork");
  const statPending = document.getElementById("statPending");

  if (statWork) statWork.textContent = `${h}h ${String(m).padStart(2, "0")}m`;
  if (statPending) statPending.textContent = appData.pendingTasks.length;
}

function showView(viewName) {
  const views = ['planning', 'tasks', 'notes', 'settings'];
  views.forEach(v => {
    const el = document.getElementById(`view${v.charAt(0).toUpperCase() + v.slice(1)}`);
    if (el) el.classList.toggle('hidden', v !== viewName);
  });
}

function applyStyle() {
  document.documentElement.style.setProperty('--app-bg', appData.settings.bgColor);
  document.documentElement.style.setProperty('--app-accent', appData.settings.accentColor);
}

/* =========================
   INITIALISATION
   ========================= */

document.addEventListener("DOMContentLoaded", () => {
  loadData();
  applyStyle();

  // DatePicker
  const picker = document.getElementById("selectedDatePicker");
  if (picker) {
    picker.value = selectedDate;
    picker.addEventListener("change", (e) => {
      selectedDate = e.target.value || getToday();
      renderSchedule();
    });
  }

  // Soumission Tâche sans rechargement
  const taskForm = document.getElementById("fullTaskForm");
  if (taskForm) {
    taskForm.addEventListener("submit", (e) => {
      e.preventDefault();

      const title = document.getElementById("fullTaskTitle")?.value;
      const duration = document.getElementById("fullTaskDuration")?.value;
      const priority = document.getElementById("fullTaskPriority")?.value;

      addTask(title, duration, priority);

      document.getElementById("fullTaskTitle").value = "";
    });
  }

  // Navigation
  document.getElementById("navPlanning")?.addEventListener("click", () => showView("planning"));
  document.getElementById("navTasks")?.addEventListener("click", () => showView("tasks"));
  document.getElementById("navNotes")?.addEventListener("click", () => showView("notes"));
  document.getElementById("navSettings")?.addEventListener("click", () => showView("settings"));

  renderSchedule();
  renderTasksList();
});
