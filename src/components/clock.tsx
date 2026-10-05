"use client";

import { useEffect, useState } from "react";

const fmt = new Intl.DateTimeFormat("ru-RU", { timeZone: "Asia/Yekaterinburg", hour: "2-digit", minute: "2-digit", hour12: false });

/** Время по Екатеринбургу, формат 22:49. */
export function Clock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () => setTime(fmt.format(new Date()));
    tick();
    const id = setInterval(tick, 5000);
    return () => clearInterval(id);
  }, []);
  return <span className="num">{time || " "}</span>;
}
