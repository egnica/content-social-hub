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

function platformLabel(platform) {
  return platform === "instagram"
    ? "Instagram Professional account"
    : "Facebook Page";
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
            The requested social account setup for{" "}
            <strong>{request.clientName}</strong> has already been completed.
            This link can no longer be used.
          </p>
        </div>
      </main>
    );
  }

  const remainingPlatforms = (request.requestedPlatforms || ["facebook"]).filter(
    (platform) => request.platformStatus?.[platform] !== "connected",
  );

  return (
    <main className={styles.loginPage}>
      <div className={styles.loginCard}>
        <span className={styles.brandMark}>CS</span>
        <h1>Connect your social account</h1>
        <p>
          Complete the requested authorization for{" "}
          <strong>{request.clientName}</strong>. This setup page cannot access
          the Content Social Hub workspace.
        </p>
        <div className={styles.notice}>
          Facebook and Instagram handle their own sign-in. Content Social Hub
          never receives your social account password.
        </div>

        <div className={styles.accountPickerList}>
          {remainingPlatforms.map((platform) => (
            <div className={styles.accountPickerItem} key={platform}>
              <span>
                <strong>{platformLabel(platform)}</strong>
                <small>Requested for {request.clientName}</small>
              </span>
              <form action={`/api/connections/${platform}/start`} method="get">
                <input type="hidden" name="requestToken" value={token} />
                <button className={styles.button} type="submit">
                  Continue with {platform === "instagram" ? "Instagram" : "Facebook"}
                </button>
              </form>
            </div>
          ))}
        </div>

        <p className={styles.connectionExpiration}>
          This link expires {formatExpiration(request.expiresAt)}.
        </p>
      </div>
    </main>
  );
}
