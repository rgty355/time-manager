"use strict";

/* Parser de texte Pronote */
function parsePronoteText(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const results = [];

  for (const line of lines) {
    const match = line.match(/(\d{1,2})[h:](\d{2})?\s*[-–]\s*(\d{1,2})[h:](\d{2})?\s*:?\s*(.+)/i);
    if (!match) continue;

    const startH = Number(match[1]);
    const startM = Number(match[2] || 0);
    const endH = Number(match[3]);
    const endM = Number(match[4] || 0);
    const title = match[5].trim();

    if (startH > 23 || endH > 23) continue;

    results.push({
      id: uid(),
      title: title.replace(/\(prof absent\)/gi, "").trim(),
      start: `${String(startH).padStart(2, "0")}:${String(startM).padStart(2, "0")}`,
      end: `${String(endH).padStart(2, "0")}:${String(endM).padStart(2, "0")}`,
      type: "fixed",
      source: "Pronote"
    });
  }

  return results;
}

/* Parser de fichier .ics (iCal) */
function parseICSContent(icsString) {
  const events = [];
  const lines = icsString.split(/\r?\n/);
  let currentEvent = null;

  for (let line of lines) {
    line = line.trim();

    if (line === "BEGIN:VEVENT") {
      currentEvent = {};
    } else if (line === "END:VEVENT" && currentEvent) {
      if (currentEvent.summary && currentEvent.dtstart && currentEvent.dtend) {
        events.push(currentEvent);
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
  }

  return events;
}
