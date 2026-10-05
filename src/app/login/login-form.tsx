"use client";

import { useActionState, useEffect, useState } from "react";
import { login, register, type AuthState } from "@/app/actions/auth";
import { Logo } from "@/components/logo";
import { useWait } from "@/components/wait";

export function LoginForm() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const up = mode === "up";
  return (
    <main className="login">
      <div>
        <Logo />
        <p>{up ? "Создайте аккаунт: только почта и пароль, без подтверждения." : "Войдите, чтобы продолжить."}</p>
      </div>
      {/* Своё состояние у каждого режима: ошибка входа не должна висеть на форме регистрации. */}
      <AuthForm key={mode} up={up} onSwitch={() => setMode(up ? "in" : "up")} />
    </main>
  );
}

function AuthForm({ up, onSwitch }: { up: boolean; onSwitch: () => void }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(up ? register : login, undefined);
  const { setBusy } = useWait();
  // Экран ожидания на время запроса: после входа страница меняется, при ошибке он гаснет.
  useEffect(() => {
    setBusy("auth", pending);
  }, [pending, setBusy]);
  return (
    <>
      <form action={action} noValidate>
        <div className="fld">
          <label htmlFor="email">Почта</label>
          <input id="email" name="email" className="inp" type="email" autoComplete="email" placeholder="name@mail.ru" defaultValue={state?.email ?? ""} required />
        </div>
        <div className="fld">
          <label htmlFor="password">Пароль</label>
          <input id="password" name="password" className="inp" type="password" autoComplete={up ? "new-password" : "current-password"} required />
        </div>
        {up && <p className="sum">Пароль восстановить нельзя. Сохраните его в менеджере паролей.</p>}
        {state?.error && (
          <p id="auth-error" className="err" role="alert">
            {state.error}
          </p>
        )}
        <button className="btn fill" type="submit" disabled={pending}>
          {pending ? "Подождите…" : up ? "Создать аккаунт" : "Войти"}
        </button>
        <button className="linkbtn" type="button" onClick={onSwitch}>
          {up ? "У меня уже есть аккаунт" : "Создать аккаунт"}
        </button>
      </form>
    </>
  );
}
