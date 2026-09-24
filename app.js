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
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      appData = { ...appData, ...JSON.parse(saved) };
      if (!Array.isArray(appData.pendingTasks)) appData.pendingTasks = [];
    }
  } catch (e) {
    console.error("Erreur chargement :", e);
    appData.pendingTasks = [];
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
   AFFICHAGE OPTIMISÉ DU PLANNING (Condensé)
   ========================= */

function renderSchedule() {
  const container = document.getElementById("timelineGrid");
  if (!container) return;

  container.innerHTML = "";
  const schedule = [...getSchedule()].sort((a, b) => parseTime(a.start) - parseTime(b.start));

  let currentMins = 6 * 60; // Début à 06:00
  const endDayMins = 23 * 60; // Fin à 23:00

  if (schedule.length === 0) {
    container.appendChild(createFreeSlotElement("06:00", "23:00"));
  } else {
    schedule.forEach(item => {
      const itemStartMins = parseTime(item.start);
      const itemEndMins = parseTime(item.end);

      // Si trou libre avant cet événement
      if (itemStartMins > currentMins) {
        container.appendChild(
          createFreeSlotElement(minutesToTime(currentMins), minutesToTime(itemStartMins))
        );
      }

      // Élément d'événement
      const eventDiv = document.createElement("div");
      eventDiv.className = "p-3 rounded-xl border border-indigo-500/40 bg-indigo-950/40 flex justify-between items-center text-xs shadow-sm";
      eventDiv.innerHTML = `
        <div>
          <span class="font-bold text-white text-sm">${escapeHTML(item.title)}</span>
          <span class="text-xs text-indigo-300 ml-2 font-mono">(${item.start} - ${item.end})</span>
        </div>
        <button onclick="deleteScheduleItem(${item.id})" class="text-rose-400 hover:text-rose-300 text-xs px-2 py-1 font-bold">✕ Supprimer</button>
      `;
      container.appendChild(eventDiv);

      currentMins = Math.max(currentMins, itemEndMins);
    });

    // Si trou libre après le dernier événement jusqu'à 23:00
    if (currentMins < endDayMins) {
      container.appendChild(
        createFreeSlotElement(minutesToTime(currentMins), minutesToTime(endDayMins))
      );
    }
  }

  updateStats();
}

function createFreeSlotElement(startStr, endStr) {
  const div = document.createElement("div");
  div.className = "p-3 rounded-xl border border-dashed border-white/10 bg-black/20 text-slate-400 flex justify-between items-center text-xs";
  div.innerHTML = `
    <span class="font-mono text-[11px] text-slate-500">🌿 Plage libre : ${startStr} - ${endStr}</span>
    <button onclick="quickAddInSlot('${startStr}')" class="text-indigo-400 hover:underline text-[11px] font-semibold">+ Placer une tâche ici</button>
  `;
  return div;
}

window.quickAddInSlot = function(startTimeStr) {
  if (appData.pendingTasks.length === 0) {
    alert("Aucune tâche en attente ! Crée d'abord une tâche dans la Banque de Tâches.");
    return;
  }

  const taskOptions = appData.pendingTasks.map((t, idx) => `${idx + 1}. ${t.title} (${t.duration} min)`).join("\n");
  const choice = prompt(`Choisis le numéro de la tâche à placer à ${startTimeStr} :\n\n${taskOptions}`);
  
  const index = Number(choice) - 1;
  if (!isNaN(index) && appData.pendingTasks[index]) {
    placeTaskInSchedule(appData.pendingTasks[index].id, startTimeStr);
  }
};

function placeTaskInSchedule(taskId, startTimeStr) {
  const task = appData.pendingTasks.find(t => Number(t.id) === Number(taskId));
  if (!task) return;

  const startMins = parseTime(startTimeStr);
  const endMins = startMins + (Number(task.duration) || 60);

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
    priority: task.priority || "moyenne"
  });

  appData.pendingTasks = appData.pendingTasks.filter(t => Number(t.id) !== Number(taskId));
  saveData();

  renderSchedule();
  renderDraggableTasks();
  renderFullTasks();
}

window.deleteScheduleItem = function(id) {
  appData.schedules[selectedDate] = getSchedule().filter(x => Number(x.id) !== Number(id));
  saveData();
  renderSchedule();
};

/* =========================
   BANQUE DE TÂCHES (Compatible Tactile)
   ========================= */

function renderDraggableTasks() {
  const container = document.getElementById("draggableTasksList");
  if (!container) return;

  container.innerHTML = "";

  if (!appData.pendingTasks || appData.pendingTasks.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 italic p-3 text-center">Aucune tâche en attente.</div>`;
    return;
  }

  appData.pendingTasks.forEach(task => {
    const div = document.createElement("div");
    div.className = "p-3 rounded-xl border border-white/10 bg-black/60 hover:border-indigo-500 transition flex justify-between items-center";

    div.innerHTML = `
      <div>
        <div class="text-xs font-bold text-white">${escapeHTML(task.title || "Tâche")}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">${task.duration || 60} min • ${escapeHTML(task.priority || "moyenne")}</div>
      </div>
      <button onclick="promptAssignTime(${task.id})" class="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg shadow transition">
        Placer ➔
      </button>
    `;

    container.appendChild(div);
  });
}

window.promptAssignTime = function(taskId) {
  const timeStr = prompt("À quelle heure souhaites-tu commencer cette tâche ? (ex: 14:00)", "08:00");
  if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) {
    placeTaskInSchedule(taskId, timeStr);
  } else if (timeStr) {
    alert("Format d'heure incorrect. Utilise HH:MM (ex: 14:30)");
  }
};

function renderFullTasks() {
  const container = document.getElementById("fullTasksContainer");
  if (!container) return;

  container.innerHTML = "";

  if (!appData.pendingTasks || appData.pendingTasks.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 italic col-span-2">Aucune tâche enregistrée.</div>`;
    return;
  }

  appData.pendingTasks.forEach(task => {
    const div = document.createElement("div");
    div.className = "p-3.5 rounded-xl border border-white/10 bg-black/40 flex justify-between items-center";

    div.innerHTML = `
      <div>
        <div class="text-xs font-bold text-white">${escapeHTML(task.title || "Tâche")}</div>
        <div class="text-[11px] text-slate-400 mt-1">${task.duration || 60} min • Priorité : ${escapeHTML(task.priority || "moyenne")}</div>
      </div>
      <button class="delete-task text-xs text-rose-400 hover:text-rose-300">Supprimer</button>
    `;

    div.querySelector(".delete-task").addEventListener("click", () => {
      appData.pendingTasks = appData.pendingTasks.filter(t => Number(t.id) !== Number(task.id));
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
  if (statPending) statPending.textContent = appData.pendingTasks ? appData.pendingTasks.length : 0;
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

  const picker = document.getElementById("selectedDatePicker");
  if (picker) {
    picker.value = selectedDate;
    picker.addEventListener("change", (e) => {
      selectedDate = e.target.value || getToday();
      renderSchedule();
    });
  }

  document.getElementById("fullTaskForm")?.addEventListener("submit", (e) => {
    e.preventDefault();

    const title = document.getElementById("fullTaskTitle")?.value;
    const duration = document.getElementById("fullTaskDuration")?.value;
    const priority = document.getElementById("fullTaskPriority")?.value;

    if (!title?.trim()) return;

    appData.pendingTasks.push({
      id: uid(),
      title: title.trim(),
      duration: Number(duration) || 60,
      priority: priority || "moyenne"
    });

    saveData();
    document.getElementById("fullTaskTitle").value = "";

    renderDraggableTasks();
    renderFullTasks();
    updateStats();
  });

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

  document.getElementById("navPlanning")?.addEventListener("click", () => showView("planning"));
  document.getElementById("navTasks")?.addEventListener("click", () => showView("tasks"));
  document.getElementById("navNotes")?.addEventListener("click", () => showView("notes"));
  document.getElementById("navSettings")?.addEventListener("click", () => showView("settings"));

  renderSchedule();
  renderDraggableTasks();
  renderFullTasks();
});
