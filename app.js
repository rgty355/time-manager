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

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function getSchedule(date = selectedDate) {
  if (!appData.schedules[date]) {
    appData.schedules[date] = [];
    saveData();
  }
  return appData.schedules[date];
}

/* =========================
   RENDU PLANNING & DROP ZONES
   ========================= */

function renderSchedule() {
  const container = document.getElementById("timelineGrid");
  if (!container) return;

  container.innerHTML = "";
  const schedule = getSchedule();

  // Créer la grille horaire de 06:00 à 23:00
  for (let h = 6; h <= 23; h++) {
    const timeLabel = `${String(h).padStart(2, "0")}:00`;
    const hourMinsStart = h * 60;
    const hourMinsEnd = (h + 1) * 60;

    // Trouver les événements sur ce créneau
    const eventsOnHour = schedule.filter(item => {
      const s = parseTime(item.start);
      return s >= hourMinsStart && s < hourMinsEnd;
    });

    const hourSlot = document.createElement("div");
    hourSlot.className = "p-2.5 rounded-xl border border-white/10 bg-black/30 hover:bg-black/50 transition flex flex-col gap-2 min-h-[50px]";
    hourSlot.dataset.timeSlot = timeLabel;

    // Événements du drag over
    hourSlot.addEventListener("dragover", (e) => {
      e.preventDefault();
      hourSlot.classList.add("drop-hover");
    });

    hourSlot.addEventListener("dragleave", () => {
      hourSlot.classList.remove("drop-hover");
    });

    hourSlot.addEventListener("drop", (e) => {
      e.preventDefault();
      hourSlot.classList.remove("drop-hover");
      const taskId = Number(e.dataTransfer.getData("text/plain"));
      placeTaskInSchedule(taskId, timeLabel);
    });

    let innerHTML = `<div class="text-[10px] font-mono text-slate-500 font-bold">${timeLabel}</div>`;

    if (eventsOnHour.length > 0) {
      eventsOnHour.forEach(item => {
        innerHTML += `
          <div class="p-2 rounded-lg border border-indigo-500/40 bg-indigo-950/40 flex justify-between items-center text-xs">
            <div>
              <span class="font-bold text-white">${escapeHTML(item.title)}</span>
              <span class="text-[10px] text-indigo-300 ml-2">(${item.start} - ${item.end})</span>
            </div>
            <button onclick="deleteScheduleItem(${item.id})" class="text-rose-400 text-xs px-1 hover:text-rose-300">✕</button>
          </div>
        `;
      });
    }

    hourSlot.innerHTML = innerHTML;
    container.appendChild(hourSlot);
  }

  updateStats();
}

function placeTaskInSchedule(taskId, startTimeStr) {
  const task = appData.pendingTasks.find(t => t.id === taskId);
  if (!task) return;

  const startMins = parseTime(startTimeStr);
  const endMins = startMins + task.duration;

  if (endMins > 24 * 60) {
    alert("Cette tâche dépasse minuit !");
    return;
  }

  const schedule = getSchedule();

  schedule.push({
    id: uid(),
    title: task.title,
    start: startTimeStr,
    end: minutesToTime(endMins),
    type: "work",
    priority: task.priority
  });

  // Retirer de la banque de tâches
  appData.pendingTasks = appData.pendingTasks.filter(t => t.id !== taskId);
  saveData();

  renderSchedule();
  renderDraggableTasks();
  renderFullTasks();
}

window.deleteScheduleItem = function(id) {
  appData.schedules[selectedDate] = getSchedule().filter(x => x.id !== id);
  saveData();
  renderSchedule();
};

/* =========================
   GESTION DES TÂCHES ET DRAG
   ========================= */

function renderDraggableTasks() {
  const container = document.getElementById("draggableTasksList");
  if (!container) return;

  container.innerHTML = "";

  if (appData.pendingTasks.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 italic p-3 text-center">Aucune tâche en attente.</div>`;
    return;
  }

  appData.pendingTasks.forEach(task => {
    const div = document.createElement("div");
    div.draggable = true;
    div.className = "p-3 rounded-xl border border-white/10 bg-black/60 cursor-grab hover:border-indigo-500 transition flex justify-between items-center";

    div.innerHTML = `
      <div>
        <div class="text-xs font-bold text-white">${escapeHTML(task.title)}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">${task.duration} min • ${task.priority}</div>
      </div>
      <span class="text-slate-500 text-xs">⋮⋮</span>
    `;

    div.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", String(task.id));
    });

    container.appendChild(div);
  });
}

function renderFullTasks() {
  const container = document.getElementById("fullTasksContainer");
  if (!container) return;

  container.innerHTML = "";

  if (appData.pendingTasks.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 italic col-span-2">Aucune tâche enregistrée.</div>`;
    return;
  }

  appData.pendingTasks.forEach(task => {
    const div = document.createElement("div");
    div.className = "p-3.5 rounded-xl border border-white/10 bg-black/40 flex justify-between items-center";

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
      renderDraggableTasks();
      renderFullTasks();
      updateStats();
    });

    container.appendChild(div);
  });
}

function escapeHTML(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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
  const views = ["planning", "tasks", "notes", "settings"];
  views.forEach(v => {
    const el = document.getElementById(`view${v.charAt(0).toUpperCase() + v.slice(1)}`);
    if (el) el.classList.toggle("hidden", v !== viewName);
  });
}

/* =========================
   INITIALISATION
   ========================= */

document.addEventListener("DOMContentLoaded", () => {
  loadData();

  // DatePicker
  const picker = document.getElementById("selectedDatePicker");
  if (picker) {
    picker.value = selectedDate;
    picker.addEventListener("change", (e) => {
      selectedDate = e.target.value || getToday();
      renderSchedule();
    });
  }

  // Ajout de tâche
  document.getElementById("fullTaskForm")?.addEventListener("submit", (e) => {
    e.preventDefault();

    const title = document.getElementById("fullTaskTitle")?.value;
    const duration = document.getElementById("fullTaskDuration")?.value;
    const priority = document.getElementById("fullTaskPriority")?.value;

    if (!title?.trim()) return;

    appData.pendingTasks.push({
      id: uid(),
      title: title.trim(),
      duration: Number(duration),
      priority: priority
    });

    saveData();
    document.getElementById("fullTaskTitle").value = "";

    renderDraggableTasks();
    renderFullTasks();
    updateStats();
  });

  // Boutons bloquer horaire & effacer
  document.getElementById("addFixedScheduleBtn")?.addEventListener("click", () => {
    const title = prompt("Titre du créneau :", "Cours");
    if (!title) return;
    const start = prompt("Heure de début (ex: 08:00) :", "08:00");
    const end = prompt("Heure de fin (ex: 10:00) :", "10:00");
    if (!start || !end) return;

    getSchedule().push({ id: uid(), title, start, end, type: "fixed" });
    saveData();
    renderSchedule();
  });

  document.getElementById("clearTimelineBtn")?.addEventListener("click", () => {
    if (confirm("Effacer la journée ?")) {
      appData.schedules[selectedDate] = [];
      saveData();
      renderSchedule();
    }
  });

  document.getElementById("quickSwitchTasks")?.addEventListener("click", () => showView("tasks"));

  // Navigation
  document.getElementById("navPlanning")?.addEventListener("click", () => showView("planning"));
  document.getElementById("navTasks")?.addEventListener("click", () => showView("tasks"));
  document.getElementById("navNotes")?.addEventListener("click", () => showView("notes"));
  document.getElementById("navSettings")?.addEventListener("click", () => showView("settings"));

  renderSchedule();
  renderDraggableTasks();
  renderFullTasks();
});
