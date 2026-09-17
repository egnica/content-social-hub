"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/components/ui.module.css";

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function logout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      className={styles.buttonGhost}
      type="button"
      onClick={logout}
      disabled={pending}
    >
      {pending ? "Signing out" : "Sign out"}
    </button>
  );
}
