export type AgeGroup = "child" | "teen" | "adult";

export function computeAgeGroup(birthDate: string | Date | null | undefined): AgeGroup | null {
  if (!birthDate) return null;
  const d = typeof birthDate === "string" ? new Date(birthDate) : birthDate;
  if (isNaN(d.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  if (age < 13) return "child";
  if (age < 18) return "teen";
  return "adult";
}

export function isMinor(g: AgeGroup | null | undefined): boolean {
  return g === "child" || g === "teen";
}

export function ageGroupLabel(g: AgeGroup | null | undefined): string {
  if (g === "child") return "Criança";
  if (g === "teen") return "Adolescente";
  if (g === "adult") return "Adulto";
  return "—";
}
