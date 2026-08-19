import { computeCentrality, descendantsOf, nodesByGrade, type Graph } from "./graph";
import type { GdiBand, GdiInputs, Grade } from "./types";

/* ============================================================
   Индекс глубины пробела (ИГП).

     ИГП = (D + B + C) / 3 ∈ [0, 1]

     D = min(1, (класс_ученика − класс_корня) / 5)   глубина
     B = не_освоено_на_уровне / всего_узлов_уровня    широта
     C = |потомки(корень)| / |узлы выше по программе| блокирующая центральность

   Написан в день 2, потому что seed-ученики обязаны нести те же числа,
   которые день 6 покажет в тепловой карте. Дублировать формулу в скрипте
   генерации значит гарантированно разойтись с UI.
   ============================================================ */

export type GdiSubject = {
  studentGrade: Grade;
  rootNodeId: string;
  masteredNodeIds: readonly string[];
};

/** Глубина: на сколько классов ниже ученика лежит корень. */
export function computeDepth(studentGrade: Grade, rootGrade: Grade): number {
  return Math.min(1, Math.max(0, (studentGrade - rootGrade) / 5));
}

/** Широта: какая доля узлов текущего класса не освоена. */
export function computeBreadth(
  graph: Graph,
  studentGrade: Grade,
  masteredNodeIds: readonly string[],
): number {
  const levelNodes = nodesByGrade(graph, studentGrade);
  if (levelNodes.length === 0) return 0;

  const mastered = new Set(masteredNodeIds);
  const notMastered = levelNodes.filter((n) => !mastered.has(n.id)).length;
  return notMastered / levelNodes.length;
}

/**
 * Какими узлами ученик владеет, если найденный корень — `rootNodeId`.
 *
 * Логика: корень — это первый узел, которым ученик НЕ владеет. Всё, что стоит
 * на нём (сам корень и его потомки), считается неосвоенным; всё остальное
 * в пределах класса ученика — освоенным. Именно так строились seed-профили
 * дня 2, и переопределять это в diagnose.ts нельзя: разойдутся числа
 * в тепловой карте и в живой диагностике.
 */
export function inferMasteredNodeIds(
  graph: Graph,
  rootNodeId: string,
  studentGrade: Grade,
): string[] {
  const blocked = new Set([rootNodeId, ...descendantsOf(graph, rootNodeId)]);
  return graph.nodes
    .filter((n) => n.grade <= studentGrade && !blocked.has(n.id))
    .map((n) => n.id);
}

export function computeGdiInputs(graph: Graph, subject: GdiSubject): GdiInputs {
  const root = graph.byId.get(subject.rootNodeId);
  if (!root) throw new Error(`ИГП: узел «${subject.rootNodeId}» не найден в графе`);

  return {
    depth: computeDepth(subject.studentGrade, root.grade),
    breadth: computeBreadth(graph, subject.studentGrade, subject.masteredNodeIds),
    centrality: root.centrality ?? computeCentrality(graph, root.id),
  };
}

/** Итоговый индекс — среднее трёх компонент. */
export function computeGdi(inputs: GdiInputs): number {
  return (inputs.depth + inputs.breadth + inputs.centrality) / 3;
}

/** Пороги трактовки. 0,76+ — системный пробел, сигнал учителю. */
export function gdiBand(gdi: number): GdiBand {
  if (gdi <= 0.25) return "none";
  if (gdi <= 0.5) return "local";
  if (gdi <= 0.75) return "deep";
  return "systemic";
}

export const GDI_BAND_LABELS: Record<GdiBand, { kk: string; ru: string; en: string }> = {
  none: { kk: "мәселе жоқ", ru: "нет проблемы", en: "no problem" },
  local: { kk: "нүктелік олқылық", ru: "точечный пробел", en: "local gap" },
  deep: { kk: "терең түбірлік олқылық", ru: "глубокий корневой пробел", en: "deep root gap" },
  systemic: { kk: "жүйелі олқылық", ru: "системный пробел", en: "systemic gap" },
};
