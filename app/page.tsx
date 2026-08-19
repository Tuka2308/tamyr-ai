import { HomeView } from "@/components/home-view";
import type { Stratum } from "@/components/strata-preview";
import { loadGraph, strata as buildStrata } from "@/lib/graph";

/** Корень демо-сценария: ученик 7 класса, реальный пробел — 6 класс. */
const DEMO_ROOT_ID = "frac_operations";

export default function HomePage() {
  const graph = loadGraph();

  const strata: Stratum[] = buildStrata(graph).map(({ grade, nodes }) => {
    const mapped = nodes.map((node) => ({
      id: node.id,
      title: node.title,
      centrality: node.centrality ?? 0,
    }));
    // Слой подписан самым блокирующим узлом — это и есть аргумент продукта.
    const keyNode = [...mapped].sort((a, b) => b.centrality - a.centrality)[0] ?? mapped[0]!;
    return { grade, nodes: mapped, keyNode };
  });

  return <HomeView strata={strata} rootId={DEMO_ROOT_ID} />;
}
