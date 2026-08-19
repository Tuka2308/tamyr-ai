"use client";

import Link from "next/link";
import { ProblemStats } from "@/components/problem-stats";
import { useLocale } from "@/lib/i18n";

const REPO_URL = "https://github.com/Tuka2308/tamyr-ai";

/**
 * «О проекте»: проблема → причина → решение → уникальность → как проверяем →
 * масштабирование. Тексты скомпонованы из README и docs/preregistration.md,
 * чтобы логика продукта читалась на самом сайте, а не только в питч-деке.
 */
export default function AboutPage() {
  const { t } = useLocale();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-2xl font-bold sm:text-3xl">{t.about.title}</h1>
      <p className="mt-2 text-sm text-bedrock">{t.about.lede}</p>

      <Section title={t.about.problemTitle} body={t.about.problemBody} />

      <div className="mt-8">
        <ProblemStats />
      </div>

      <Section title={t.about.causeTitle} body={t.about.causeBody} accent />
      <Section title={t.about.solutionTitle} body={t.about.solutionBody} />

      <Section title={t.about.uniqueTitle} body={t.about.uniqueBody}>
        <List items={t.about.uniqueList} />
      </Section>

      <Section title={t.about.proofTitle} body={t.about.proofBody}>
        <List items={t.about.proofList} />
      </Section>

      {/* Оговорки — на равных правах с достижениями, не мелким шрифтом. */}
      <section className="mt-10 rounded-xl border-2 border-bedrock/25 p-5">
        <h2 className="font-display text-sm font-semibold">{t.about.limitsTitle}</h2>
        <List items={t.about.limitsList} muted />
      </section>

      <Section title={t.about.scaleTitle} body={t.about.scaleBody}>
        <List items={t.about.scaleList} />
      </Section>

      <div className="mt-12 flex flex-wrap gap-3">
        <a
          href={REPO_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border-2 border-bedrock/30 px-5 py-2.5 font-display text-sm font-semibold text-bedrock hover:border-bedrock/60 hover:text-ink"
        >
          {t.about.repoLink}
        </a>
        <a
          href={`${REPO_URL}/blob/main/docs/preregistration.md`}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border-2 border-bedrock/30 px-5 py-2.5 font-display text-sm font-semibold text-bedrock hover:border-bedrock/60 hover:text-ink"
        >
          {t.about.preregLink}
        </a>
        <Link
          href="/onboarding"
          className="rounded-full bg-ink px-5 py-2.5 font-display text-sm font-semibold text-chalk"
        >
          {t.home.cta}
        </Link>
      </div>
    </div>
  );
}

function Section({
  title,
  body,
  accent,
  children,
}: {
  title: string;
  body: string;
  accent?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2
        className="font-display text-sm font-semibold"
        style={{ color: accent ? "var(--color-root)" : undefined }}
      >
        {title}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-ink/85">{body}</p>
      {children}
    </section>
  );
}

function List({ items, muted }: { items: readonly string[]; muted?: boolean }) {
  return (
    <ul className={`mt-3 space-y-1.5 text-sm ${muted ? "text-bedrock" : "text-ink/85"}`}>
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="shrink-0 text-bedrock" aria-hidden="true">
            ·
          </span>
          <span className="leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  );
}
