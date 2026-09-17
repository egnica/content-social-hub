"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/ui.module.css";

export default function LoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setPending(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to sign in.");
      }

      router.replace("/");
      router.refresh();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setPending(false);
    }
  }

  return (
    <form className={styles.loginForm} onSubmit={submit}>
      {error ? <div className={styles.errorNotice}>{error}</div> : null}
      <label className={styles.field}>
        <span className={styles.label}>Owner password</span>
        <input
          className={styles.input}
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoComplete="current-password"
          required
        />
      </label>
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "Signing in" : "Sign in"}
      </button>
    </form>
  );
}
