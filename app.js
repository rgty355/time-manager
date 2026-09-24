"use strict";

const STORAGE_KEY = "timemanager_data_v3";

let appData = {
  pendingTasks: [],
  schedules: {},
  notes: "",
  quickChecks: [],
  settings: {
    apiKey: "",
    bgColor: "#131722",
    accentColor: "#6366f1"
  }
};

let selectedDate = getToday();

/* Utilitaire Date */
function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseTime(t) {
  if (!t || !t.includes(":")) return 0;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
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

/* Planning */
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

  const schedule = getSchedule();
  container.innerHTML = "";

  if (schedule.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 italic p-4 text-center">Aucun créneau pour ce jour.</div>`;
    return;
  }

  schedule.sort((a, b) => parseTime(a.start) - parseTime(b.start)).forEach(item => {
    const div = document.createElement("div");
    div.className = "p-3 rounded-xl border border-app-border flex justify-between items-center gap-3 bg-black/40";
    div.innerHTML = `
      <div>
        <div class="font-medium text-sm text-white">${item.title}</div>
        <div class="text-xs text-slate-400">${item.start} - ${item.end}</div>
      </div>
      <button class="delete-item text-xs text-rose-400">✕</button>
    `;

    div.querySelector(".delete-item").addEventListener("click", () => {
      appData.schedules[selectedDate] = schedule.filter(x => x.id !== item.id);
      saveData();
      renderSchedule();
    });

    container.appendChild(div);
  });
}

/* Vue & Navigation */
function showView(viewName) {
  const views = ['planning', 'tasks', 'notes', 'settings'];
  views.forEach(v => {
    const el = document.getElementById(`view${v.charAt(0).toUpperCase() + v.slice(1)}`);
    if (el) el.classList.toggle('hidden', v !== viewName);
  });
}

/* Style Dynamique */
function applyStyle() {
  document.documentElement.style.setProperty('--app-bg', appData.settings.bgColor);
  document.documentElement.style.setProperty('--app-accent', appData.settings.accentColor);
}

/* Initialisation */
document.addEventListener("DOMContentLoaded", () => {
  loadData();
  applyStyle();
  renderSchedule();

  /* Boutons de navigation */
  document.getElementById("navPlanning")?.addEventListener("click", () => showView("planning"));
  document.getElementById("navTasks")?.addEventListener("click", () => showView("tasks"));
  document.getElementById("navNotes")?.addEventListener("click", () => showView("notes"));
  document.getElementById("navSettings")?.addEventListener("click", () => showView("settings"));

  /* Selecteur de couleur RGB */
  document.getElementById("bgColorPicker")?.addEventListener("input", (e) => {
    appData.settings.bgColor = e.target.value;
    saveData();
    applyStyle();
  });

  /* Import Texte Pronote */
  document.getElementById("importPronoteTextBtn")?.addEventListener("click", () => {
    const txt = document.getElementById("pronoteRawImport")?.value;
    if (!txt) return;
    const courses = parsePronoteText(txt);
    if (courses.length) {
      appData.schedules[selectedDate] = [...getSchedule(), ...courses];
      saveData();
      renderSchedule();
      alert(`${courses.length} cours ajoutés !`);
    }
  });
});
