"use client";

import type { DiagnosisResult, Grade, Profile } from "./types";

/**
 * Персистентность демо-сессии. Никакой БД: MVP держит всё в браузере,
 * что заодно даёт офлайн бесплатно.
 */

const PROFILE_KEY = "tamyr.profile";
const RESULT_KEY = "tamyr.result";

/**
 * С какого узла стартует диагностика для каждого класса.
 * Восьмой класс ведёт на системы уравнений — это демо-сценарий: спуск
 * оттуда доходит до действий с дробями за 6 класс, то есть на два класса вниз.
 */
export const TARGET_BY_GRADE: Record<Grade, string> = {
  5: "text_problems_arithmetic",
  6: "rational_operations",
  7: "linear_equations",
  8: "linear_equations_systems",
};

export const DEFAULT_PROFILE: Profile = {
  id: "",
  name: "",
  grade: 8,
  subject: "math",
  goal: "ent",
  locale: "kk",
};

/**
 * Идентификатор ученика: заводится один раз и переиспользуется.
 * Повторная диагностика обновляет ту же запись у учителя, а не плодит
 * нового ученика в списке.
 */
export function ensureStudentId(): string {
  const existing = loadProfile()?.id;
  if (existing) return existing;
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Приватный режим или переполнение — молча продолжаем без персистентности.
  }
}

export const loadProfile = () => read<Profile>(PROFILE_KEY);
export const saveProfile = (profile: Profile) => write(PROFILE_KEY, profile);

export const loadResult = () => read<DiagnosisResult>(RESULT_KEY);
export const saveResult = (result: DiagnosisResult) => write(RESULT_KEY, result);

export function clearSession(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PROFILE_KEY);
  window.localStorage.removeItem(RESULT_KEY);
}
