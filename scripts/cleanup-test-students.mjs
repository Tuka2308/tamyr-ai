/*
 * Уборка тестовых записей учеников из Vercel Blob.
 *
 * Запуск:  npm run cleanup:test-students
 *          node --env-file-if-exists=.env.local scripts/cleanup-test-students.mjs
 *
 * Почему отдельным скриптом, а не HTTP-методом: публичный DELETE на проде —
 * риск, даже с узкой областью действия. Имя ученика задаёт клиент, значит
 * «удаляем только записи с префиксом Тест» — это защита, которую обходят
 * подбором имени. Скрипт работает по токену Blob, наружу ничего не выставлено
 * и в API-поверхности проекта метода удаления не существует вовсе.
 *
 * Импортируется сквозным тестом: см. scripts/roster-test.mjs.
 */
import { del, get, list } from "@vercel/blob";

const PREFIX = "students/";
const TEST_NAME_PREFIX = "Тест ";

/** Удаляет тестовые записи. Возвращает, сколько убрано и сколько осталось. */
export async function cleanupTestStudents({ quiet = false } = {}) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (!quiet) console.warn("  BLOB_READ_WRITE_TOKEN не задан — уборка пропущена");
    return { removed: 0, skipped: true, remaining: null };
  }

  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  const doomed = [];

  for (const blob of blobs) {
    try {
      const file = await get(blob.url, { access: "private", useCache: false });
      if (!file || file.statusCode !== 200) continue;
      const student = JSON.parse(await new Response(file.stream).text());
      // Проверяем имя из САМОГО объекта, а не из параметра запроса:
      // здесь нет недоверенного ввода, решение принимает скрипт.
      if (typeof student.name === "string" && student.name.startsWith(TEST_NAME_PREFIX)) {
        doomed.push({ url: blob.url, name: student.name });
      }
    } catch {
      // Битый объект пропускаем: удалять то, что не смогли прочитать, не станем.
    }
  }

  if (doomed.length > 0) await del(doomed.map((d) => d.url));

  if (!quiet) {
    for (const d of doomed) console.log(`  удалено: «${d.name}»`);
    if (doomed.length === 0) console.log("  тестовых записей нет");
  }

  return { removed: doomed.length, skipped: false, remaining: blobs.length - doomed.length };
}

// Прямой запуск из терминала.
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = await cleanupTestStudents();
  console.log(`\n  убрано ${r.removed}, осталось записей ${r.remaining ?? "—"}`);
}

/** Сколько тестовых записей сейчас в хранилище. Нужно сквозному тесту. */
export async function countTestStudents() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return null;
  const { blobs } = await list({ prefix: PREFIX, limit: 1000 });
  let n = 0;
  for (const blob of blobs) {
    try {
      const file = await get(blob.url, { access: "private", useCache: false });
      if (!file || file.statusCode !== 200) continue;
      const s = JSON.parse(await new Response(file.stream).text());
      if (typeof s.name === "string" && s.name.startsWith(TEST_NAME_PREFIX)) n++;
    } catch {
      /* битый объект не считаем */
    }
  }
  return n;
}
