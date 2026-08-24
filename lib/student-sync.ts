"use client";

import type { DiagnosisResult, MisconceptionTag, Profile, StudentError } from "./types";

/**
 * Отправляет результат диагностики учителю.
 *
 * Намеренно «выстрелил и забыл»: результат уже сохранён в localStorage,
 * и ученику всё равно, дошёл ли он до сервера. Любая ошибка гасится —
 * ни один экран не должен из-за этого сломаться, в том числе офлайн.
 */
export async function syncStudent(profile: Profile, result: DiagnosisResult): Promise<boolean> {
  if (!profile.id || !profile.name.trim()) return false;

  // История ошибок собирается из шагов: неверные ответы с их тегами.
  const errors: StudentError[] = result.steps
    .filter((s) => !s.correct && s.answerIndex !== null)
    .map((s) => ({
      nodeId: s.nodeId,
      questionId: s.questionId,
      chosenIndex: s.answerIndex as number,
      tag: s.misconception as MisconceptionTag,
    }));

  try {
    const response = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: profile.id,
        name: profile.name.trim(),
        grade: profile.grade,
        locale: profile.locale,
        rootNodeId: result.root.id,
        targetNodeId: result.target.id,
        masteredNodeIds: result.masteredNodeIds,
        gdi: result.gdi,
        gdiInputs: result.igpInputs,
        errors,
        questionsAsked: result.questionsAsked,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
