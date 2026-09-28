"use strict";

const STORAGE_KEY = "timemanager_data_v6";

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
      if (!Array.isArray(appData.quickChecks)) appData.quickChecks = [];
    }
  } catch (e) {
    console.error("Erreur chargement:", e);
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
   RENDU AGENDA DROITE (1/3)
   ========================= */

function renderSchedule() {
  const container = document.getElementById("timelineGrid");
  if (!container) return;

  container.innerHTML = "";
  const schedule = [...getSchedule()].sort((a, b) => parseTime(a.start) - parseTime(b.start));

  let currentMins = 6 * 60;
  const endDayMins = 23 * 60;

  if (schedule.length === 0) {
    container.appendChild(createFreeSlotElement("06:00", "23:00"));
  } else {
    schedule.forEach(item => {
      const itemStartMins = parseTime(item.start);
      const itemEndMins = parseTime(item.end);

      if (itemStartMins > currentMins) {
        container.appendChild(createFreeSlotElement(minutesToTime(currentMins), minutesToTime(itemStartMins)));
      }

      const eventDiv = document.createElement("div");
      const isFixed = item.type === "fixed";
      const borderClass = isFixed ? "border-sky-500/50 bg-sky-950/30 text-sky-200" : "border-indigo-500/50 bg-indigo-950/40 text-indigo-200";

      eventDiv.className = `p-3 rounded-xl border ${borderClass} flex justify-between items-start text-xs shadow-sm`;
      eventDiv.innerHTML = `
        <div class="space-y-1">
          <div class="font-bold text-white text-xs flex items-center gap-1.5">
            <span>${isFixed ? "📌" : "💼"}</span>
            <span>${escapeHTML(item.title)}</span>
          </div>
          <div class="text-[11px] opacity-80 font-mono">${item.start} - ${item.end}</div>
        </div>
        <button onclick="deleteScheduleItem(${item.id})" class="text-rose-400 hover:text-rose-300 text-xs px-1 font-bold">✕</button>
      `;
      container.appendChild(eventDiv);

      currentMins = Math.max(currentMins, itemEndMins);
    });

    if (currentMins < endDayMins) {
      container.appendChild(createFreeSlotElement(minutesToTime(currentMins), minutesToTime(endDayMins)));
    }
  }

  updateDateLabel();
  updateStats();
}

function createFreeSlotElement(startStr, endStr) {
  const div = document.createElement("div");
  div.className = "p-3 rounded-xl border border-dashed border-white/10 bg-black/20 text-slate-400 flex justify-between items-center text-xs";
  div.innerHTML = `
    <span class="font-mono text-[10px] text-slate-500">🌿 Libre : ${startStr} - ${endStr}</span>
    <button onclick="quickAddInSlot('${startStr}')" class="text-indigo-400 hover:underline text-[11px] font-medium">+ Placer</button>
  `;
  return div;
}

window.quickAddInSlot = function(startTimeStr) {
  if (appData.pendingTasks.length === 0) {
    alert("Aucune tâche en attente dans la banque de tâches !");
    return;
  }

  const options = appData.pendingTasks.map((t, i) => `${i + 1}. ${t.title} (${t.duration} min)`).join("\n");
  const choice = prompt(`Placer une tâche à ${startTimeStr} :\n\n${options}`);
  const idx = Number(choice) - 1;

  if (!isNaN(idx) && appData.pendingTasks[idx]) {
    placeTaskInSchedule(appData.pendingTasks[idx].id, startTimeStr);
  }
};

function placeTaskInSchedule(taskId, startTimeStr) {
  const task = appData.pendingTasks.find(t => Number(t.id) === Number(taskId));
  if (!task) return;

  const startMins = parseTime(startTimeStr);
  const endMins = startMins + (Number(task.duration) || 60);

  getSchedule().push({
    id: uid(),
    title: task.title,
    start: startTimeStr,
    end: minutesToTime(endMins),
    type: "work"
  });

  appData.pendingTasks = appData.pendingTasks.filter(t => Number(t.id) !== Number(taskId));
  saveData();

  renderSchedule();
  renderFullTasks();
}

window.deleteScheduleItem = function(id) {
  appData.schedules[selectedDate] = getSchedule().filter(x => Number(x.id) !== Number(id));
  saveData();
  renderSchedule();
};

/* =========================
   MODULE PRONOTE (ICS & TEXTE)
   ========================= */

function setupPronoteModule() {
  const modal = document.getElementById("pronoteModal");
  const openBtn = document.getElementById("openPronoteModalBtn");
  const openBtn2 = document.getElementById("openPronoteSyncBtn2");
  const closeBtn = document.getElementById("closePronoteModalBtn");

  const openModal = () => modal?.classList.remove("hidden");
  const closeModal = () => modal?.classList.add("hidden");

  openBtn?.addEventListener("click", openModal);
  openBtn2?.addEventListener("click", openModal);
  closeBtn?.addEventListener("click", closeModal);

  // Import fichier .ics
  document.getElementById("icsFileInput")?.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      parseAndSaveICS(event.target.result);
      closeModal();
    };
    reader.readAsText(file);
  });

  // Import texte brut
  document.getElementById("importPronoteTextBtn")?.addEventListener("click", () => {
    const txt = document.getElementById("pronoteRawImport")?.value;
    if (!txt?.trim()) return;

    const count = parsePronoteText(txt);
    if (count > 0) {
      alert(`✨ ${count} cours ajouté(s) pour la journée !`);
      document.getElementById("pronoteRawImport").value = "";
      closeModal();
      renderSchedule();
    } else {
      alert("Aucun cours reconnu. Exemple : '08h00 - 09h00 : MATHS'");
    }
  });
}

function parsePronoteText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  let count = 0;

  for (const line of lines) {
    const match = line.match(/(\d{1,2})[h:](\d{2})?\s*[-–]\s*(\d{1,2})[h:](\d{2})?\s*:?\s*(.+)/i);
    if (!match) continue;

    const startH = Number(match[1]);
    const startM = Number(match[2] || 0);
    const endH = Number(match[3]);
    const endM = Number(match[4] || 0);
    const rawTitle = match[5].trim();

    // Si prof absent ou cours annulé
    if (/prof\s+absent|cours\s+annul[ée]/i.test(rawTitle)) continue;

    const startTime = `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`;
    const endTime = `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`;

    getSchedule().push({
      id: uid(),
      title: rawTitle.replace(/\(prof absent\)/gi, "").trim(),
      start: startTime,
      end: endTime,
      type: "fixed"
    });

    count++;
  }

  saveData();
  return count;
}

function parseAndSaveICS(icsData) {
  const lines = icsData.split(/\r?\n/);
  let count = 0;
  let currentEvent = null;

  lines.forEach((line) => {
    line = line.trim();

    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
    } else if (line === "END:VEVENT" && currentEvent) {
      if (currentEvent.summary && currentEvent.dtstart && currentEvent.dtend) {
        const dateStr = formatDateFromICS(currentEvent.dtstart);
        const startTime = formatTimeFromICS(currentEvent.dtstart);
        const endTime = formatTimeFromICS(currentEvent.dtend);

        if (dateStr && startTime && endTime) {
          if (!appData.schedules[dateStr]) {
            appData.schedules[dateStr] = [];
          }

          const exists = appData.schedules[dateStr].some(
            (item) => item.start === startTime && item.title === currentEvent.summary
          );

          if (!exists) {
            appData.schedules[dateStr].push({
              id: uid(),
              title: currentEvent.summary.replace(/\\/g, ""),
              start: startTime,
              end: endTime,
              type: "fixed"
            });
            count++;
          }
        }
      }
      currentEvent = null;
    } else if (currentEvent) {
      if (line.startsWith("SUMMARY:")) {
        currentEvent.summary = line.replace("SUMMARY:", "");
      } else if (line.startsWith("DTSTART")) {
        currentEvent.dtstart = line.split(":")[1];
      } else if (line.startsWith("DTEND")) {
        currentEvent.dtend = line.split(":")[1];
      }
    }
  });

  saveData();
  renderSchedule();
  alert(`✨ ${count} cours Pronote importés avec succès !`);
}

function formatDateFromICS(icsStr) {
  if (!icsStr || icsStr.length < 8) return null;
  const y = icsStr.substring(0, 4);
  const m = icsStr.substring(4, 6);
  const d = icsStr.substring(6, 8);
  return `${y}-${m}-${d}`;
}

function formatTimeFromICS(icsStr) {
  if (!icsStr || !icsStr.includes("T")) return null;
  const timePart = icsStr.split("T")[1];
  return `${timePart.substring(0, 2)}:${timePart.substring(2, 4)}`;
}

/* =========================
   BANQUE DE TÂCHES (GAUCHE 2/3)
   ========================= */

function renderFullTasks() {
  const container = document.getElementById("fullTasksContainer");
  if (!container) return;

  container.innerHTML = "";

  if (appData.pendingTasks.length === 0) {
    container.innerHTML = `<div class="text-xs text-slate-500 italic col-span-2 p-2">Aucune tâche en attente.</div>`;
    return;
  }

  appData.pendingTasks.forEach(task => {
    const div = document.createElement("div");
    div.className = "p-3 rounded-xl border border-white/10 bg-black/40 flex justify-between items-center text-xs";

    const prioColor = task.priority === "haute" ? "text-rose-400" : task.priority === "basse" ? "text-emerald-400" : "text-amber-400";

    div.innerHTML = `
      <div>
        <div class="font-bold text-white">${escapeHTML(task.title)}</div>
        <div class="text-[10px] text-slate-400 mt-0.5">${task.duration} min • <span class="${prioColor}">${task.priority || "moyenne"}</span></div>
      </div>
      <div class="flex items-center gap-2">
        <button onclick="promptAssignTime(${task.id})" class="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-lg transition">Placer ➔</button>
        <button onclick="deleteTask(${task.id})" class="text-rose-400 hover:text-rose-300">✕</button>
      </div>
    `;

    container.appendChild(div);
  });
}

window.promptAssignTime = function(taskId) {
  const timeStr = prompt("À quelle heure commencer ? (ex: 14:00)", "08:00");
  if (timeStr && /^\d{1,2}:\d{2}$/.test(timeStr)) {
    placeTaskInSchedule(taskId, timeStr);
  }
};

window.deleteTask = function(taskId) {
  appData.pendingTasks = appData.pendingTasks.filter(t => Number(t.id) !== Number(taskId));
  saveData();
  renderFullTasks();
  updateStats();
};

/* =========================
   CHECKLIST FLASH & UTILITAIRES
   ========================= */

function renderQuickChecklist() {
  const container = document.getElementById("quickChecklist");
  if (!container) return;

  container.innerHTML = "";

  if (appData.quickChecks.length === 0) {
    container.innerHTML = `<li class="text-xs text-slate-500 italic">Aucune action flash.</li>`;
    return;
  }

  appData.quickChecks.forEach(item => {
    const li = document.createElement("li");
    li.className = "flex items-center justify-between gap-2 bg-black/30 border border-white/10 rounded-lg p-2 text-xs";
    li.innerHTML = `
      <div class="flex items-center gap-2 min-w-0">
        <input type="checkbox" ${item.done ? "checked" : ""} onchange="toggleCheck(${item.id})" class="accent-indigo-500">
        <span class="${item.done ? "line-through text-slate-500" : "text-slate-200"} truncate">${escapeHTML(item.text)}</span>
      </div>
      <button onclick="deleteCheck(${item.id})" class="text-rose-400 text-xs">✕</button>
    `;
    container.appendChild(li);
  });
}

window.toggleCheck = function(id) {
  const item = appData.quickChecks.find(x => x.id === id);
  if (item) {
    item.done = !item.done;
    saveData();
    renderQuickChecklist();
  }
};

window.deleteCheck = function(id) {
  appData.quickChecks = appData.quickChecks.filter(x => x.id !== id);
  saveData();
  renderQuickChecklist();
};

function updateDateLabel() {
  const label = document.getElementById("dayLabel");
  if (!label) return;

  if (selectedDate === getToday()) {
    label.textContent = "Aujourd'hui";
  } else {
    const d = new Date(selectedDate + "T12:00:00");
    label.textContent = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  }
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

function setupNotes() {
  const area = document.getElementById("quickNotesArea");
  if (!area) return;

  area.value = appData.notes || "";
  area.addEventListener("input", () => {
    appData.notes = area.value;
    saveData();
  });
}

function escapeHTML(str) {
  return String(str ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

    renderFullTasks();
    updateStats();
  });

  document.getElementById("quickCheckForm")?.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("quickCheckInput");
    if (!input || !input.value.trim()) return;

    appData.quickChecks.push({ id: uid(), text: input.value.trim(), done: false });
    saveData();
    input.value = "";
    renderQuickChecklist();
  });

  document.getElementById("addFixedScheduleBtn")?.addEventListener("click", () => {
    const title = prompt("Titre du cours / créneau :", "Cours");
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

  setupPronoteModule();
  setupNotes();
  renderSchedule();
  renderFullTasks();
  renderQuickChecklist();
});
