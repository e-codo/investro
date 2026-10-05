"use client";

import { Clock } from "@/components/clock";
import { LogoutIcon, SettingsIcon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { useWait } from "@/components/wait";
import { dmy } from "@/lib/format";

export function Header({ strategyName, lastDate }: { strategyName: string; lastDate: string | null }) {
  const { go, signOut } = useWait();
  return (
    <header className="top">
      <div className="meta">
        <Logo />
        <Clock />
        <span>{strategyName}</span>
        {lastDate && <span>Отчёт от {dmy(lastDate)}</span>}
      </div>
      <div className="tools">
        <a
          className="ibtn"
          href="/settings"
          aria-label="Настройки"
          onClick={(e) => {
            e.preventDefault();
            go("/settings");
          }}
        >
          <SettingsIcon />
        </a>
        <button className="ibtn" type="button" aria-label="Выйти" onClick={signOut}>
          <LogoutIcon />
        </button>
      </div>
    </header>
  );
}
