import questionsFile from "../data/questions.json";
import chunksFile from "../data/curriculum_chunks.json";
import type { CurriculumChunk, Locale, Question } from "./types";

/* Типизированный доступ к данным /data. Индексы строятся один раз. */

export const questions = questionsFile.questions as unknown as Question[];
export const curriculumChunks = chunksFile.chunks as unknown as CurriculumChunk[];

const byId = new Map(questions.map((q) => [q.id, q]));

const byNode = new Map<string, Question[]>();
for (const q of questions) byNode.set(q.nodeId, [...(byNode.get(q.nodeId) ?? []), q]);

const byPair = new Map<string, Question[]>();
for (const q of questions) {
  if (q.pairId) byPair.set(q.pairId, [...(byPair.get(q.pairId) ?? []), q]);
}

export function questionById(id: string): Question | undefined {
  return byId.get(id);
}

/** Все задания узла. День 3 берёт отсюда до 2 вопросов на проверку владения. */
export function questionsForNode(nodeId: string): Question[] {
  return byNode.get(nodeId) ?? [];
}

/**
 * Парное задание на то же умение в другой формулировке.
 * Вход классификатора языкового барьера: ошибся на длинной, решил краткую —
 * значит подвело условие, а не тема, и опускать по графу нельзя.
 */
export function pairedQuestion(question: Question): Question | undefined {
  if (!question.pairId) return undefined;
  return byPair.get(question.pairId)?.find((q) => q.id !== question.id);
}

/** Есть ли на узле пара для проверки языкового барьера. */
export function hasLanguagePair(nodeId: string): boolean {
  return questionsForNode(nodeId).some((q) => q.pairId !== undefined);
}

/** Чанки узла с фильтром по языку; при отсутствии языка — откат на ru. */
export function chunksForNode(nodeId: string, lang: Locale): CurriculumChunk[] {
  const all = curriculumChunks.filter((c) => c.nodeId === nodeId);
  const inLang = all.filter((c) => c.lang === lang);
  return inLang.length > 0 ? inLang : all.filter((c) => c.lang === "ru");
}
