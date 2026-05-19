import { jsPDF } from "jspdf";
import type { Sticker } from "@/lib/use-album";
import { groupByCountry, GROUP_LETTERS } from "@/lib/stickers";

export type ExportKind = "missing" | "duplicates";

export type GroupedExport = {
  letter: string;
  total: number;
  countries: {
    country_code: string;
    country_name: string;
    flag_emoji: string;
    items: { code: string; position: number; player_name: string | null; duplicates: number }[];
  }[];
};

function build(stickers: Sticker[], kind: ExportKind): GroupedExport[] {
  const filtered = stickers.filter((s) =>
    kind === "missing" ? !s.owned : s.duplicates > 1,
  );
  const grouped = groupByCountry(filtered);
  const byLetter = new Map<string, GroupedExport>();
  for (const letter of GROUP_LETTERS) {
    byLetter.set(letter, { letter, total: 0, countries: [] });
  }
  for (const c of grouped) {
    const g = byLetter.get(c.group_letter);
    if (!g) continue;
    const items = c.stickers.map((s) => ({
      code: s.code,
      position: s.position,
      player_name: s.player_name,
      duplicates: kind === "duplicates" ? (s as any).duplicates - 1 : 0,
    }));
    g.countries.push({
      country_code: c.country_code,
      country_name: c.country_name,
      flag_emoji: c.flag_emoji,
      items,
    });
    g.total += items.length;
  }
  return Array.from(byLetter.values()).filter((g) => g.total > 0);
}

const title = (kind: ExportKind) =>
  kind === "missing" ? "Figurinhas que faltam" : "Figurinhas repetidas";

export function toCSV(stickers: Sticker[], kind: ExportKind): string {
  const data = build(stickers, kind);
  const rows: string[] = [];
  rows.push("grupo,pais,codigo,posicao,jogador" + (kind === "duplicates" ? ",trocaveis" : ""));
  for (const g of data) {
    for (const c of g.countries) {
      for (const it of c.items) {
        const cells = [
          g.letter,
          c.country_name,
          it.code,
          String(it.position),
          (it.player_name ?? "").replace(/"/g, '""'),
        ];
        if (kind === "duplicates") cells.push(String(it.duplicates));
        rows.push(cells.map((v) => (/[",\n]/.test(v) ? `"${v}"` : v)).join(","));
      }
    }
  }
  return rows.join("\n");
}

export function toTXT(stickers: Sticker[], kind: ExportKind, who?: string): string {
  const data = build(stickers, kind);
  const total = data.reduce((a, g) => a + g.total, 0);
  const lines: string[] = [];
  const date = new Date().toLocaleDateString("pt-BR");
  lines.push(`TrocaCopa — ${title(kind)}${who ? ` (${who})` : ""} — ${date}`);
  lines.push(`Total: ${total}`);
  lines.push("");
  for (const g of data) {
    lines.push(`GRUPO ${g.letter}`);
    for (const c of g.countries) {
      lines.push(`  ${c.flag_emoji} ${c.country_name} (${c.items.length})`);
      for (const it of c.items) {
        const name = it.player_name ? ` — ${it.player_name}` : "";
        const dup = kind === "duplicates" ? ` ×${it.duplicates}` : "";
        lines.push(`    ${it.code.padEnd(7)}${name}${dup}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function toPDF(stickers: Sticker[], kind: ExportKind, who?: string): Blob {
  const data = build(stickers, kind);
  const total = data.reduce((a, g) => a + g.total, 0);
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 40;
  let y = 50;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(`TrocaCopa — ${title(kind)}`, marginX, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `${who ? who + " · " : ""}${new Date().toLocaleDateString("pt-BR")} · Total: ${total}`,
    marginX,
    y,
  );
  y += 18;

  const ensure = (h: number) => {
    if (y + h > pageH - 40) {
      doc.addPage();
      y = 50;
    }
  };

  for (const g of data) {
    ensure(30);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(`GRUPO ${g.letter} (${g.total})`, marginX, y);
    y += 14;
    for (const c of g.countries) {
      ensure(20);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(`${c.country_name} — ${c.items.length}`, marginX + 8, y);
      y += 12;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      for (const it of c.items) {
        ensure(12);
        const name = it.player_name ? ` — ${it.player_name}` : "";
        const dup = kind === "duplicates" ? `  (×${it.duplicates})` : "";
        doc.text(`${it.code}${name}${dup}`, marginX + 20, y);
        y += 11;
      }
      y += 4;
    }
    y += 6;
  }

  return doc.output("blob");
}

export function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportStickers(
  stickers: Sticker[],
  kind: ExportKind,
  format: "csv" | "txt" | "pdf",
  who?: string,
) {
  const date = new Date().toISOString().slice(0, 10);
  const base = `trocacopa-${kind === "missing" ? "faltam" : "repetidas"}-${date}`;
  if (format === "csv") {
    downloadBlob(`${base}.csv`, new Blob(["\uFEFF" + toCSV(stickers, kind)], { type: "text/csv;charset=utf-8" }));
  } else if (format === "txt") {
    downloadBlob(`${base}.txt`, new Blob([toTXT(stickers, kind, who)], { type: "text/plain;charset=utf-8" }));
  } else {
    downloadBlob(`${base}.pdf`, toPDF(stickers, kind, who));
  }
}
