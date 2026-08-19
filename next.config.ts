import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Рядом лежит чужой lockfile в /Users/nurasyl — фиксируем корень явно.
  outputFileTracingRoot: path.resolve(import.meta.dirname),
  // Данные графа/заданий читаются из /data как статические JSON — БД в MVP нет.
};

export default nextConfig;
