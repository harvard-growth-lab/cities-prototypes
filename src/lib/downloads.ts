import type { Insight } from "../data/content";

function downloadBlob(content: string, mime: string, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: mime }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function downloadInsights(insights: Insight[]) {
  const lines =
    insights.length === 0
      ? ["No saved insights or notes yet."]
      : insights.map((ins) => `${ins.city} (${ins.span})\n${ins.text}\n`);
  downloadBlob(
    "My saved insights/notes — Cities Tool\n\n" + lines.join("\n"),
    "text/plain",
    "my-insights-notes.txt",
  );
}

export function downloadChatCsv(query: string) {
  const q = query.replace(/"/g, '""');
  const csv =
    "query,city,year,sector,export_value\n" +
    `"${q}",Boston,2024,Scientific Research,98632\n` +
    `"${q}",Boston,2024,Software Publishing,80928\n` +
    `"${q}",Boston,2024,Higher Education,85543\n`;
  downloadBlob(csv, "text/csv", "data-chat-sample.csv");
}
