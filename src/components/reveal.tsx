"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

// Один общий механизм: анимация блока стартует, когда он попал в видимую область, один раз за показ страницы.
const callbacks = new WeakMap<Element, () => void>();
let observer: IntersectionObserver | null = null;

const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function getObserver() {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        callbacks.get(e.target)?.();
        callbacks.delete(e.target);
        observer?.unobserve(e.target);
      }
    },
    { threshold: 0.2, rootMargin: "0px 0px -6% 0px" },
  );
  return observer;
}

const noopSubscribe = () => () => {};
/** Без анимаций: «уменьшить движение» или нет IntersectionObserver. На сервере false, чтобы разметка совпала при гидратации. */
const instantSnapshot = () => prefersReducedMotion() || typeof IntersectionObserver === "undefined";

/** true, когда элемент впервые попал в экран. При «уменьшить движение» и без IntersectionObserver сразу true. */
export function useReveal<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  const instant = useSyncExternalStore(noopSubscribe, instantSnapshot, () => false);
  useEffect(() => {
    const el = ref.current;
    if (!el || instantSnapshot()) return;
    callbacks.set(el, () => setSeen(true));
    getObserver().observe(el);
    return () => {
      callbacks.delete(el);
      observer?.unobserve(el);
    };
  }, []);
  return [ref, seen || instant];
}

/** Раздел страницы: до появления на экране все анимации внутри стоят в начальном кадре. */
export function Section({ className = "sec", children }: { className?: string; children: React.ReactNode }) {
  const [ref, shown] = useReveal<HTMLElement>();
  return (
    <section ref={ref} data-reveal className={`${className}${shown ? " in" : ""}`}>
      {children}
    </section>
  );
}

/** Число «пробегает» от нуля (потом от прежнего значения) до нового, когда блок появился на экране. */
export function Count({ value, format }: { value: number; format: (v: number) => string }) {
  const [ref, shown] = useReveal<HTMLSpanElement>();
  const last = useRef(0);
  const formatRef = useRef(format);
  useEffect(() => {
    formatRef.current = format;
  });
  useEffect(() => {
    const el = ref.current;
    if (!shown || !el) return;
    const from = last.current;
    last.current = value;
    if (prefersReducedMotion() || from === value) {
      el.textContent = formatRef.current(value);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / 1000);
      const eased = 1 - Math.pow(1 - k, 3);
      el.textContent = formatRef.current(k < 1 ? from + (value - from) * eased : value);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    el.textContent = formatRef.current(from);
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [shown, value, ref]);
  return (
    <span ref={ref} suppressHydrationWarning>
      {format(value)}
    </span>
  );
}

/** Полоса растёт от нуля до значения, когда её раздел появился на экране (класс `in` у Section). Ширину анимирует CSS. */
export function Fill({ percent }: { percent: number }) {
  return <i data-fill style={{ "--w": `${Math.max(0, Math.min(100, percent))}%` } as React.CSSProperties} />;
}
