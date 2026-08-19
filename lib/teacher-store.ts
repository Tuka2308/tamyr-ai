"use client";

import type { Locale, MisconceptionTag, Question } from "./types";

/**
 * Задания, добавленные учителем в текущей сессии браузера.
 *
 * Живут в localStorage: БД в MVP нет. Помечены source: "teacher_added",
 * чтобы их нельзя было спутать с авторским набором дня 2 — ни в интерфейсе,
 * ни при выгрузке JSON. Репозиторные данные они не трогают, поэтому
 * validate-data.ts их не видит и видеть не должен.
 */

const KEY = "tamyr.teacher.questions";

/** Задание учителя — обычный Question плюс происхождение и время. */
export type TeacherQuestion = Question & {
  source: "teacher_added";
  createdAt: string;
};

export type NewQuestionInput = {
  nodeId: string;
  text: string;
  locale: Locale;
  options: string[];
  correctIndex: number;
  misconceptions: string[];
  tags: MisconceptionTag[];
};

export function loadTeacherQuestions(): TeacherQuestion[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as TeacherQuestion[]) : [];
  } catch {
    return [];
  }
}

function persist(items: TeacherQuestion[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(items));
  } catch {
    // Приватный режим или переполнение — сессия продолжается без сохранения.
  }
}

/** Собирает Question из формы. Текст дублируется во все локали:
 *  учитель вводит одну формулировку, и подменять её переводом мы не станем. */
export function buildQuestion(input: NewQuestionInput): TeacherQuestion {
  const misconception = input.options.map((_, i) =>
    i === input.correctIndex ? "" : (input.misconceptions[i] ?? "").trim(),
  );
  const misconceptionTags = input.options.map((_, i) =>
    i === input.correctIndex ? ("none" as MisconceptionTag) : (input.tags[i] ?? "unknown"),
  );

  return {
    id: `q_${input.nodeId}_teacher_${Date.now().toString(36)}`,
    nodeId: input.nodeId,
    text: { kk: input.text, ru: input.text, en: input.text },
    options: input.options,
    correctIndex: input.correctIndex,
    misconception,
    misconceptionTags,
    source: "teacher_added",
    createdAt: new Date().toISOString(),
  };
}

export function addTeacherQuestion(question: TeacherQuestion): TeacherQuestion[] {
  const next = [...loadTeacherQuestions(), question];
  persist(next);
  return next;
}

export function removeTeacherQuestion(id: string): TeacherQuestion[] {
  const next = loadTeacherQuestions().filter((q) => q.id !== id);
  persist(next);
  return next;
}

export function teacherQuestionsForNode(nodeId: string): TeacherQuestion[] {
  return loadTeacherQuestions().filter((q) => q.nodeId === nodeId);
}

/**
 * Ровно та структура, что ушла бы в data/questions.json при коммите.
 * Служебные поля source и createdAt отброшены — в репозитории их нет.
 */
export function toRepositoryJson(question: TeacherQuestion): string {
  const { source, createdAt, ...clean } = question;
  void source;
  void createdAt;
  return JSON.stringify(clean, null, 2);
}

/** Простая проверка формы до сохранения. */
export function validateInput(input: NewQuestionInput): string[] {
  const errors: string[] = [];
  if (!input.nodeId) errors.push("node");
  if (input.text.trim().length < 5) errors.push("text");

  const filled = input.options.filter((o) => o.trim().length > 0);
  if (filled.length < 2) errors.push("options");
  if (new Set(filled.map((o) => o.trim())).size !== filled.length) errors.push("duplicates");
  if (input.correctIndex < 0 || input.correctIndex >= input.options.length) errors.push("correct");

  const distractorsAnnotated = input.options.some(
    (_, i) => i !== input.correctIndex && (input.misconceptions[i] ?? "").trim().length > 0,
  );
  if (!distractorsAnnotated) errors.push("misconception");

  return errors;
}
