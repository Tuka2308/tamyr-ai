"use client";

import { useEffect } from "react";

/**
 * Регистрация service worker. Без него офлайн работает только до первой
 * перезагрузки: клиентский кэш объяснений живёт в бандле, но сам бандл
 * без сети браузеру взять неоткуда.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Приватный режим, http без TLS, отключённые SW — приложение
        // продолжает работать, просто без офлайна.
      });
    };

    // Не конкурируем за пропускную способность с первой отрисовкой.
    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register, { once: true });
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
