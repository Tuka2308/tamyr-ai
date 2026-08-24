import { NextResponse } from "next/server";
import { loadGraph } from "@/lib/graph";
import { saveStudent, type LiveStudent } from "@/lib/students-store";
import { GRADES, LOCALES, type Grade, type Locale } from "@/lib/types";

/**
 * Запись ученика после диагностики. ТОЛЬКО POST.
 *
 * Чтения здесь намеренно нет. Раньше был GET, и он отдавал анонимному
 * запросу имена, классы и результаты диагностики всех учеников — персональные
 * данные детей в открытом доступе. Панели учителя он при этом не нужен:
 * /teacher и /teacher/[id] — серверные компоненты, они зовут listStudents()
 * напрямую, минуя HTTP. Эндпоинт использовал только сквозной тест.
 *
 * Запись не является обязательной для ученика — его результат уже лежит
 * в localStorage. Поэтому ошибки здесь не должны ничего ломать на клиенте:
 * отдаём понятный статус, а клиент его проглатывает.
 *
 * ИЗВЕСТНОЕ ОГРАНИЧЕНИЕ: POST не требует авторизации, потому что аккаунтов
 * в MVP нет — ученик регистрируется одним именем. Значит, список учителя
 * можно засорить поддельными записями. Что этому противостоит: строгая
 * валидация полей, потолок длины имени, проверка узлов по графу. Чего нет:
 * ограничения частоты запросов. Зафиксировано в docs/preregistration.md.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME = 80;

export async function POST(request: Request) {
  let body: Partial<LiveStudent>;
  try {
    body = (await request.json()) as Partial<LiveStudent>;
  } catch {
    return NextResponse.json({ error: "Тело запроса не является JSON" }, { status: 400 });
  }

  const graph = loadGraph();
  const errors: string[] = [];

  const id = typeof body.id === "string" ? body.id.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!id || id.length > 100) errors.push("id");
  if (!name || name.length > MAX_NAME) errors.push("name");
  if (!GRADES.includes(body.grade as Grade)) errors.push("grade");
  if (!(LOCALES as readonly string[]).includes(body.locale as Locale)) errors.push("locale");
  if (!body.rootNodeId || !graph.byId.has(body.rootNodeId)) errors.push("rootNodeId");
  if (!body.targetNodeId || !graph.byId.has(body.targetNodeId)) errors.push("targetNodeId");
  if (typeof body.gdi !== "number" || body.gdi < 0 || body.gdi > 1) errors.push("gdi");
  if (!Array.isArray(body.masteredNodeIds)) errors.push("masteredNodeIds");

  if (errors.length > 0) {
    return NextResponse.json({ error: "Некорректные поля", fields: errors }, { status: 400 });
  }

  const student: LiveStudent = {
    id,
    name,
    grade: body.grade as Grade,
    locale: body.locale as Locale,
    rootNodeId: body.rootNodeId!,
    targetNodeId: body.targetNodeId!,
    // Держим только существующие узлы: испорченный список сломал бы
    // тепловую карту у учителя.
    masteredNodeIds: body.masteredNodeIds!.filter((n) => graph.byId.has(n)),
    gdi: body.gdi as number,
    gdiInputs: body.gdiInputs ?? { depth: 0, breadth: 0, centrality: 0 },
    errors: Array.isArray(body.errors) ? body.errors : [],
    questionsAsked: typeof body.questionsAsked === "number" ? body.questionsAsked : 0,
    diagnosedAt: new Date().toISOString().slice(0, 10),
    origin: "live",
    registeredAt: new Date().toISOString(),
  };

  const stored = await saveStudent(student);
  if (!stored) {
    // Хранилище не настроено — это не ошибка ученика и не повод шуметь.
    return NextResponse.json({ stored: false, reason: "no_storage" }, { status: 202 });
  }

  return NextResponse.json({ stored: true, id: student.id }, { status: 201 });
}
