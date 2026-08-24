import { NextResponse } from "next/server";
import { loadGraph } from "@/lib/graph";
import { deleteStudent, listStudents, saveStudent, TEST_NAME_PREFIX, type LiveStudent } from "@/lib/students-store";
import { GRADES, LOCALES, type Grade, type Locale } from "@/lib/types";

/**
 * Живые ученики: запись после диагностики и чтение для панели учителя.
 *
 * Запись не является обязательной для ученика — его результат уже лежит
 * в localStorage. Поэтому ошибки здесь не должны ничего ломать на клиенте:
 * отдаём понятный статус, а клиент их проглатывает.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_NAME = 80;

export async function GET() {
  const students = await listStudents();
  return NextResponse.json(
    { students, count: students.length },
    { headers: { "Cache-Control": "no-store" } },
  );
}

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

/**
 * Удаление ученика. Нужно ровно для одного: сквозной тест не должен
 * оставлять «Тест a1b2c» в списке, который увидит жюри.
 * Открытый DELETE в продукте с настоящими данными недопустим — здесь он
 * ограничен записями, помеченными как тестовые.
 */
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Нужен параметр id" }, { status: 400 });

  const student = (await listStudents()).find((s) => s.id === id);
  if (!student) return NextResponse.json({ deleted: false }, { status: 404 });

  if (!student.name.startsWith(TEST_NAME_PREFIX)) {
    return NextResponse.json(
      { error: "Удалять можно только тестовые записи" },
      { status: 403 },
    );
  }

  await deleteStudent(id);
  return NextResponse.json({ deleted: true, id });
}
