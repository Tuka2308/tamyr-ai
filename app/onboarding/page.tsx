"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import { DEFAULT_PROFILE, ensureStudentId, loadProfile, saveProfile } from "@/lib/session";
import { GRADES, LOCALES, type Grade, type Locale, type Profile } from "@/lib/types";

/** Четыре шага, не больше: класс · предмет · цель · язык. */
const STEPS = 4;

export default function OnboardingPage() {
  const router = useRouter();
  const { locale, setLocale, t } = useLocale();
  const [step, setStep] = useState(0);
  const [profile, setProfile] = useState<Profile>({ ...DEFAULT_PROFILE, locale });

  // id и имя переносим из прошлого профиля, если он есть: повторное
  // прохождение обновляет ту же запись у учителя, а не создаёт вторую.
  useEffect(() => {
    const stored = loadProfile();
    if (stored) setProfile((p) => ({ ...p, id: stored.id, name: stored.name }));
  }, []);

  const patch = (next: Partial<Profile>) => setProfile((p) => ({ ...p, ...next }));

  const finish = () => {
    saveProfile({
      ...profile,
      locale,
      id: profile.id || ensureStudentId(),
      name: profile.name.trim(),
    });
    router.push("/diagnose");
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="font-display text-2xl font-bold sm:text-3xl">{t.onboarding.title}</h1>
        <p className="text-xs text-bedrock">
          {t.onboarding.step} {step + 1} {t.common.of} {STEPS}
        </p>
      </div>

      {/* Прогресс шагов */}
      <div className="mt-4 flex gap-1.5" aria-hidden="true">
        {Array.from({ length: STEPS }, (_, i) => (
          <span
            key={i}
            className="h-1 flex-1 rounded-full transition-colors"
            style={{ backgroundColor: i <= step ? "var(--color-ink)" : "var(--color-bedrock)" , opacity: i <= step ? 1 : 0.25 }}
          />
        ))}
      </div>

      <div className="mt-10">
        {step === 0 && (
          <Field title={t.onboarding.gradeTitle} hint={t.onboarding.gradeHint}>
            {/* Имя живёт на первом шаге, а не отдельным пятым: «4 шага,
                не больше» — зафиксированное решение, и нарушать его ради
                одного поля не стоит. */}
            <label className="mb-6 block">
              <span className="text-sm font-medium">{t.onboarding.nameLabel}</span>
              <input
                value={profile.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder={t.onboarding.namePlaceholder}
                autoComplete="given-name"
                className="mt-1.5 w-full rounded-xl border-2 border-bedrock/25 bg-white px-4 py-3 text-base"
              />
              <span className="mt-1.5 block text-xs text-bedrock">{t.onboarding.nameHint}</span>
            </label>

            <div className="grid grid-cols-4 gap-2">
              {GRADES.map((grade: Grade) => (
                <Choice
                  key={grade}
                  active={profile.grade === grade}
                  onClick={() => patch({ grade })}
                >
                  <span className="font-display text-2xl font-bold">{grade}</span>
                  <span className="text-xs text-bedrock">{t.common.grade}</span>
                </Choice>
              ))}
            </div>
          </Field>
        )}

        {step === 1 && (
          <Field title={t.onboarding.subjectTitle} hint={t.onboarding.subjectHint}>
            <Choice active onClick={() => patch({ subject: "math" })}>
              <span className="font-medium">{t.onboarding.mathLabel}</span>
            </Choice>
            <p className="mt-3 text-xs text-bedrock">{t.onboarding.otherSoon}</p>
          </Field>
        )}

        {step === 2 && (
          <Field title={t.onboarding.goalTitle} hint={t.onboarding.goalHint}>
            <div className="space-y-2">
              {(
                [
                  ["ent", t.onboarding.goalEnt],
                  ["school", t.onboarding.goalSchool],
                  ["catchup", t.onboarding.goalCatchup],
                ] as const
              ).map(([goal, label]) => (
                <Choice key={goal} active={profile.goal === goal} onClick={() => patch({ goal })}>
                  <span className="font-medium">{label}</span>
                </Choice>
              ))}
            </div>
          </Field>
        )}

        {step === 3 && (
          <Field title={t.onboarding.localeTitle} hint={t.onboarding.localeHint}>
            <div className="space-y-2">
              {LOCALES.map((code: Locale) => (
                <Choice key={code} active={locale === code} onClick={() => setLocale(code)}>
                  <span className="font-display text-xs uppercase tracking-wide text-bedrock">
                    {code}
                  </span>
                  <span className="font-medium">
                    {code === "kk" ? "Қазақша" : code === "ru" ? "Русский" : "English"}
                  </span>
                </Choice>
              ))}
            </div>
          </Field>
        )}
      </div>

      <div className="mt-10 flex items-center gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            className="text-sm text-bedrock underline underline-offset-4 hover:text-ink"
          >
            {t.common.back}
          </button>
        )}
        <button
          type="button"
          onClick={() => (step === STEPS - 1 ? finish() : setStep((s) => s + 1))}
          className="ml-auto rounded-full bg-ink px-6 py-3 font-display text-sm font-semibold text-chalk"
        >
          {step === STEPS - 1 ? t.onboarding.start : t.common.next}
        </button>
      </div>
    </div>
  );
}

function Field({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="font-display text-lg font-semibold sm:text-xl">{title}</legend>
      <p className="mt-1 mb-5 text-sm text-bedrock">{hint}</p>
      {children}
    </fieldset>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "flex w-full flex-col items-center gap-1 rounded-xl border-2 px-4 py-3 transition-colors sm:flex-row sm:items-center sm:gap-3",
        active ? "border-ink bg-ink text-chalk" : "border-bedrock/25 bg-white hover:border-bedrock/50",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
