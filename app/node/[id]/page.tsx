import { notFound } from "next/navigation";
import { NodeView } from "@/components/node-view";
import { questionsForNode } from "@/lib/data";
import { loadGraph } from "@/lib/graph";

/** Страницы всех 75 узлов статические — задания и структура известны на сборке. */
export function generateStaticParams() {
  return loadGraph().nodes.map((node) => ({ id: node.id }));
}

export default async function NodePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const graph = loadGraph();
  const node = graph.byId.get(id);
  if (!node) notFound();

  return <NodeView node={node} questions={questionsForNode(id)} />;
}
