// Calendar reminders: all-day events for the next scouting checks.
const ymd = (d: Date) => `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

export function buildIcs(firstCheck: Date, everyDays: number, count = 4): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Patra Lens//Leaf Watch//EN", "CALSCALE:GREGORIAN"];
  for (let i = 0; i < count; i++) {
    const start = new Date(firstCheck); start.setDate(start.getDate() + i * everyDays);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    lines.push("BEGIN:VEVENT", `UID:patra-${ymd(start)}-${i}@patra-lens`, `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(start)}`, `DTEND;VALUE=DATE:${ymd(end)}`, "SUMMARY:Patra Lens: check sentinel plants", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadIcs(firstCheck: Date, everyDays: number) {
  downloadBlob(new Blob([buildIcs(firstCheck, everyDays)], { type: "text/calendar" }), "patra-lens-checks.ics");
}
