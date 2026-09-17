import { redirect } from "next/navigation";
import LoginForm from "@/components/login-form";
import styles from "@/components/ui.module.css";
import { getSession } from "@/lib/session";

export const metadata = { title: "Sign In" };

export default async function LoginPage() {
  if (await getSession()) {
    redirect("/");
  }

  return (
    <main className={styles.loginPage}>
      <section className={styles.loginCard}>
        <div className={styles.brandMark}>CS</div>
        <h1>Content Social Hub</h1>
        <p>Sign in to manage clients, source content, and private media.</p>
        <LoginForm />
      </section>
    </main>
  );
}
