import { getConnectionRequestByToken } from "@/lib/connections";
import styles from "@/components/ui.module.css";

export const metadata = {
  title: "Connect Social Account",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export const dynamic = "force-dynamic";

function formatExpiration(value) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Chicago",
  }).format(new Date(value));
}

export default async function ConnectionRequestPage({ params }) {
  const { token } = await params;
  const request = await getConnectionRequestByToken(token);

  if (!request || ["expired", "revoked"].includes(request.status)) {
    return (
      <main className={styles.loginPage}>
        <div className={styles.loginCard}>
          <span className={styles.brandMark}>CS</span>
          <h1>This connection link is unavailable</h1>
          <p>
            It may have expired or been replaced. Ask the sender for a fresh
            connection request.
          </p>
        </div>
      </main>
    );
  }

  if (request.status === "completed") {
    return (
      <main className={styles.loginPage}>
        <div className={styles.loginCard}>
          <span className={styles.brandMark}>CS</span>
          <h1>Connection complete</h1>
          <p>
            The requested Facebook Page has already been connected for{" "}
            <strong>{request.clientName}</strong>. This link can no longer be
            used.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.loginPage}>
      <div className={styles.loginCard}>
        <span className={styles.brandMark}>CS</span>
        <h1>Connect your Facebook Page</h1>
        <p>
          Authorize Facebook and choose the Page that belongs to{" "}
          <strong>{request.clientName}</strong>. This setup page cannot access
          the Content Social Hub workspace.
        </p>
        <div className={styles.notice}>
          Facebook handles your sign-in. Content Social Hub never receives your
          Facebook password.
        </div>
        <form action="/api/connections/facebook/start" method="get">
          <input type="hidden" name="requestToken" value={token} />
          <button className={styles.button} type="submit">
            Continue with Facebook
          </button>
        </form>
        <p className={styles.connectionExpiration}>
          This link expires {formatExpiration(request.expiresAt)}.
        </p>
      </div>
    </main>
  );
}
