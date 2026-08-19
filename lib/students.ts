import studentsFile from "../data/seed_students.json";
import type { Student } from "./types";

/**
 * Seed-профили класса. Отдельный модуль, а не часть lib/data.ts, чтобы 46 КБ
 * данных панели учителя не попадали в клиентский бандл экрана диагностики.
 */
export const seedStudents = studentsFile.students as unknown as Student[];

/** Сколько учеников упёрлись в каждый узел — сырьё для тепловой карты. */
export function rootGapCounts(): Map<string, number> {
  const counts = new Map<string, number>();
  for (const s of seedStudents) counts.set(s.rootNodeId, (counts.get(s.rootNodeId) ?? 0) + 1);
  return counts;
}
