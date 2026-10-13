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
          <p className={styles.date}>Last updated: October 13, 2026</p>
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
          A YouTube connection is planned but is not enabled until implementation
          and access checks are completed. When enabled, the YouTube API Services
          will be used only after a user explicitly authorizes the selected
          channel. YouTube read-only and upload permissions allow channel
          identity checks and authorized video uploads. We may retain channel
          identifiers, encrypted OAuth tokens, upload and processing status,
          and video publication records. Connecting a channel does not
          automatically upload content. Credentials are stored server-side
          and are not intentionally exposed in public web pages.
        </p>
        <p>
          You can revoke access using the social provider’s account settings.
          To request deletion of connection records in Content Social Hub,
          contact the email below. Revoking access or removing a connection
          does not delete posts already published on external platforms.
        </p>

        <h2>YouTube and Google data</h2>
        <p>
          YouTube integration, when available, will use the{" "}
          <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>
          {" "}and is subject to the{" "}
          <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.
          Google user data obtained for a channel connection is used only
          to provide the requested channel identification and publishing
          features. We do not sell Google user data or use it for advertising
          or unrelated profiling.
        </p>
        <p>
          You can revoke Google authorization using{" "}
          <a href="https://myaccount.google.com/connections">Google Account connections</a>.
          You may request disconnection or deletion of locally stored
          channel credentials and associated personal information using
          the contact email below. Revocation does not delete videos
          previously published on YouTube. Operational records are retained
          only as needed for service, security, legal, and publishing purposes,
          subject to applicable deletion requests.
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
        <p><Link href="/terms-of-service">Terms of Service</Link></p>
      </article>
    </main>
  );
}
