import Link from "next/link";
import styles from "./page.module.css";

export const metadata = {
  title: "Privacy Policy",
  description: "Privacy practices for Content Social Hub social-account connections and publishing.",
  alternates: {
    canonical: "https://main.d1yfjibipwjpld.amplifyapp.com/privacy-policy",
  },
};

export default function PrivacyPolicy() {
  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <header>
          <Link href="/" className={styles.home}>Content Social Hub</Link>
          <h1>Privacy Policy</h1>
          <p className={styles.date}>Last updated: October 12, 2026</p>
        </header>
        <p>
          Content Social Hub is a multi-client tool operated by Nicholas Egner
          for preparing, managing, and publishing social content. This notice
          describes how the application handles information when its features
          and social-account integrations are used.
        </p>

        <h2>Information handled</h2>
        <p>
          Content Social Hub may store client names, contact email addresses,
          content drafts, uploaded media, scheduled publishing information,
          social-account and Page identifiers, connection status, and
          publication history. When you authorize a social-account connection,
          the application receives the account information and access
          credentials permitted by that provider and your consent.
        </p>

        <h2>Purposes</h2>
        <p>
          Information is used to manage client content, connect selected
          social destinations, publish authorized posts, manage schedules,
          display account health and publishing results, troubleshoot failures,
          and protect application access. Social-platform access is not used
          to sell your information.
        </p>

        <h2>Social platforms and authorization</h2>
        <p>
          Where supported, the application connects to services such as
          Facebook, Instagram, and LinkedIn with provider authorization.
          A LinkedIn connection will only be available after that integration
          is implemented and approved for use. The permissions presented by
          each provider determine which account information and publishing
          actions are available. Credentials are stored server-side and are
          not intentionally exposed in public web pages.
        </p>
        <p>
          You can revoke access using the social provider’s account settings.
          To request deletion of connection records in Content Social Hub,
          contact the email below. Revoking access or removing a connection
          does not delete posts already published on external platforms.
        </p>

        <h2>Service providers</h2>
        <p>
          The application relies on infrastructure and service providers for
          hosting, databases, private media storage, email delivery, and
          connected social networks. Data is shared with providers as
          necessary to operate requested features, subject to their terms
          and privacy practices. Information may also be disclosed where
          legally required or necessary to address security concerns.
          Personal information is not sold.
        </p>

        <h2>Security and retention</h2>
        <p>
          The application uses access controls, private media storage, and
          server-side handling of connection credentials. No online service
          can guarantee complete security. Operational information may be
          retained while services are in use and as needed for publishing
          records, dispute resolution, security, or applicable legal
          obligations. Retention depends on the record type.
        </p>

        <h2>Requests and choices</h2>
        <p>
          Contact the operator to request access, correction, or deletion
          of personal information where applicable. Certain records may
          need to be retained for legitimate operational or legal purposes.
          Requests about information held directly by a social platform
          should also be directed to that platform.
        </p>

        <h2>Changes</h2>
        <p>
          This notice may be updated as additional integrations become
          available. The updated date above will be revised when the policy
          materially changes.
        </p>

        <h2>Contact</h2>
        <p>
          Operator: Nicholas Egner, Minneapolis, Minnesota, USA.
          Privacy and data requests:{" "}
          <a href="mailto:nick@nicholasegner.com">nick@nicholasegner.com</a>.
        </p>
      </article>
    </main>
  );
}
