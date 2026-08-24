import { TeacherPanel } from "@/components/teacher-panel";
import { combineClass } from "@/lib/teacher";
import { listStudents } from "@/lib/students-store";

/**
 * Панель учителя. Серверный компонент: список живых учеников читается
 * из хранилища при каждом заходе, поэтому новая регистрация появляется
 * сама, без действий учителя.
 *
 * force-dynamic обязателен — со статическим пререндером список замёрз бы
 * на момент сборки. Офлайн это не ломает: service worker отдаёт последнюю
 * закэшированную версию страницы, а в ней всегда есть демо-класс.
 * listStudents() при любой ошибке возвращает пустой список, а не бросает.
 */
export const dynamic = "force-dynamic";

export default async function TeacherPage() {
  const live = await listStudents();
  return <TeacherPanel students={combineClass(live)} />;
}
