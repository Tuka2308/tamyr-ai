import { notFound } from "next/navigation";
import { StudentView } from "@/components/student-view";
import { combineClass } from "@/lib/teacher";
import { listStudents } from "@/lib/students-store";

/**
 * Кабинет ученика глазами учителя — только просмотр, без правок.
 * Ищем и среди живых, и среди демо-профилей: у обоих один и тот же
 * набор полей, отличается только происхождение.
 */
export const dynamic = "force-dynamic";

export default async function TeacherStudentPage({
  params,
}: {
  params: Promise<{ studentId: string }>;
}) {
  const { studentId } = await params;
  const live = await listStudents();
  const student = combineClass(live).find((s) => s.id === decodeURIComponent(studentId));

  if (!student) notFound();

  return <StudentView student={student} />;
}
