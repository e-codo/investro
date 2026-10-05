"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { logout } from "@/app/actions/auth";
import { LOGO_FRAME_PATH, LOGO_CIRCLE_PATH } from "./logo";

const SHOW_DELAY_MS = 250;
const MIN_VISIBLE_MS = 500;
const FAILSAFE_MS = 20_000;

type WaitApi = { go: (href: string) => void; setBusy: (key: string, on: boolean) => void; signOut: () => void };
const WaitContext = createContext<WaitApi>({ go: () => {}, setBusy: () => {}, signOut: () => {} });
export const useWait = () => useContext(WaitContext);

/** Экран ожидания между страницами: тёмный экран, логотип стоит на месте, стрелка внутри плавно растёт. */
export function WaitProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  // Причины ожидания живут, пока страница не сменилась: новый адрес сам снимает ожидание.
  const [state, setState] = useState<{ keys: string[]; at: string }>({ keys: [], at: "" });
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);
  const visibleRef = useRef(false);
  const busy = state.keys.length > 0 && state.at === pathname;

  const setBusy = useCallback(
    (key: string, on: boolean) => {
      setState((prev) => {
        const keys = (prev.at === pathname ? prev.keys : []).filter((k) => k !== key);
        return { keys: on ? [...keys, key] : keys, at: pathname };
      });
    },
    [pathname],
  );

  useEffect(() => {
    if (busy) {
      const show = setTimeout(() => {
        shownAt.current = Date.now();
        visibleRef.current = true;
        setVisible(true);
      }, SHOW_DELAY_MS);
      const failsafe = setTimeout(() => setState({ keys: [], at: pathname }), FAILSAFE_MS);
      return () => {
        clearTimeout(show);
        clearTimeout(failsafe);
      };
    }
    if (visibleRef.current) {
      const left = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
      const hide = setTimeout(() => {
        visibleRef.current = false;
        setVisible(false);
      }, left);
      return () => clearTimeout(hide);
    }
  }, [busy, pathname]);

  const go = useCallback(
    (href: string) => {
      if (href === pathname) return;
      setBusy("nav", true);
      router.push(href);
    },
    [pathname, router, setBusy],
  );
  const signOut = useCallback(() => {
    setBusy("logout", true);
    void logout();
  }, [setBusy]);

  return (
    <WaitContext.Provider value={{ go, setBusy, signOut }}>
      {children}
      <div className={`wait${visible ? " on" : ""}`} role="status" aria-label="Загрузка" aria-hidden={!visible}>
        {visible && <WaitLogo />}
      </div>
    </WaitContext.Provider>
  );
}

function WaitLogo() {
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <svg className="wlogo" viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <clipPath id="wait-frame">
          <path clipRule="evenodd" d="M0 0H24V24H0Z M6.35 6.35H17.65V17.65H6.35Z" />
        </clipPath>
        <clipPath id="wait-arrow">
          <rect x="6.3" y="6.3" width={reduced ? 11.4 : 0} height="11.4">
            {!reduced && <animate attributeName="width" values="0;11.4;11.4;0" keyTimes="0;.55;.8;1" calcMode="spline" keySplines=".22 .8 .24 1;0 0 1 1;.6 0 .8 .2" dur="3.2s" repeatCount="indefinite" />}
          </rect>
        </clipPath>
      </defs>
      <g fill="currentColor">
        <path d={LOGO_CIRCLE_PATH} />
        <path clipPath="url(#wait-frame)" d={LOGO_FRAME_PATH} />
        <path clipPath="url(#wait-arrow)" d={LOGO_FRAME_PATH} />
      </g>
    </svg>
  );
}
