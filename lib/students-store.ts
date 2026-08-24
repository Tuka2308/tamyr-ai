import "server-only";
import { del, get, list, put } from "@vercel/blob";
import type { Student } from "./types";

/* ============================================================================
   Хранилище живых учеников — Vercel Blob, один JSON на ученика.

   Почему Blob, а не БД: за два дня до сдачи миграции и схема — это риск
   уронить то, что уже задеплоено и покрыто тестами. Здесь 25–100 записей
   и ни одного запроса сложнее «дай всех», так что коллекция документов
   покрывает задачу целиком. Одна зависимость, ноль миграций.

   Хранилище ПРИВАТНОЕ: имена и результаты диагностики — персональные данные,
   лежать по публичной ссылке они не должны.

   Ни один вызов отсюда не является обязательным для ученика. Диагностика
   и её результат живут в localStorage, как и раньше; запись на сервер —
   дополнительный шаг после. Если Blob недоступен, ученик этого не заметит.
   ============================================================================ */

const PREFIX = "students/";

/**
 * Имена с этим префиксом создаёт сквозной тест. Убирает их отдельный
 * скрипт (scripts/cleanup-test-students.mjs), а НЕ HTTP-эндпоинт:
 * публичный метод удаления на проде — риск, даже с узкой областью действия,
 * потому что значение имени задаёт клиент.
 */
export const TEST_NAME_PREFIX = "Тест ";

/** Живой ученик отличается от seed-профиля происхождением. */
export type LiveStudent = Student & {
  origin: "live";
  /** ISO-время регистрации. */
  registeredAt: string;
};

function isConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

/** Записывает ученика. Возвращает false, если хранилище не настроено. */
export async function saveStudent(student: LiveStudent): Promise<boolean> {
  if (!isConfigured()) return false;

  await put(`${PREFIX}${student.id}.json`, JSON.stringify(student), {
    // Приватно: имя и результаты диагностики не должны читаться по ссылке.
    access: "private",
    contentType: "application/json",
    // Перезапись по тому же пути: повторная диагностика обновляет запись,
    // а не плодит дубли. Без этого addRandomSuffix создал бы второй файл.
    addRandomSuffix: false,
    allowOverwrite: true,
  });

  return true;
}

/**
 * Все живые ученики. При любой ошибке возвращает пустой список, а не бросает:
 * панель учителя обязана открыться даже когда хранилище недоступно —
 * там всегда есть демо-класс.
 */
export async function listStudents(): Promise<LiveStudent[]> {
  if (!isConfigured()) return [];

  try {
    const { blobs } = await list({ prefix: PREFIX, limit: 1000 });

    const loaded = await Promise.all(
      blobs.map(async (blob) => {
        try {
          // Хранилище приватное, поэтому читаем через get с токеном
          // из окружения, а не обычным fetch по URL.
          const file = await get(blob.url, {
            access: "private",
            // Без этого свежезарегистрированный ученик появился бы
            // у учителя с задержкой CDN-кэша.
            useCache: false,
          });
          if (!file || file.statusCode !== 200) return null;
          const text = await new Response(file.stream).text();
          return JSON.parse(text) as LiveStudent;
        } catch {
          return null;
        }
      }),
    );

    return loaded
      .filter((s): s is LiveStudent => s !== null)
      .sort((a, b) => b.registeredAt.localeCompare(a.registeredAt));
  } catch {
    return [];
  }
}

/** Один ученик по id. null, если нет или хранилище недоступно. */
export async function getStudent(id: string): Promise<LiveStudent | null> {
  const all = await listStudents();
  return all.find((s) => s.id === id) ?? null;
}

/**
 * Удаляет запись ученика. Вызывается ТОЛЬКО скриптом уборки после сквозного
 * теста, из HTTP наружу не выставлен. Держится в этом модуле, чтобы путь
 * к объектам в Blob был описан в одном месте.
 */
export async function deleteStudent(id: string): Promise<boolean> {
  if (!isConfigured()) return false;
  try {
    const { blobs } = await list({ prefix: `${PREFIX}${id}.json`, limit: 1 });
    if (blobs.length === 0) return false;
    await del(blobs.map((b) => b.url));
    return true;
  } catch {
    return false;
  }
}
