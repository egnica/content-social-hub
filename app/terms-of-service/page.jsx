import Link from "next/link";
import styles from "../privacy-policy/page.module.css";

export const metadata = {
  title: "Terms of Service",
  description: "Terms for using Content Social Hub to manage social content and publishing.",
  alternates: {
    canonical: "https://main.d1yfjibipwjpld.amplifyapp.com/terms-of-service",
  },
};

export default function TermsOfService() {
  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <header>
          <Link href="/" className={styles.home}>Content Social Hub</Link>
          <h1>Terms of Service</h1>
          <p className={styles.date}>Effective: October 13, 2026</p>
        </header>
        <p>
          These terms govern use of Content Social Hub, a content management
          and social publishing service operated by Nicholas Egner. By using
          the service or authorizing a social-account connection, you agree
          to these terms. When connecting an organization account, you confirm
          that you are authorized to do so.
        </p>
        <h2>Permitted use</h2>
        <p>
          Use the service only for accounts and channels you are authorized
          to manage. You are responsible for the legality, accuracy, necessary
          permissions, and third-party rights in content you provide, including
          music, images, video, and claims. Follow the policies of each
          connected platform. Do not publish spam, unlawful, or infringing
          material or circumvent provider access restrictions.
        </p>
        <h2>Connecting accounts</h2>
        <p>
          Social connections require authorization with the relevant
          platform. The platform controls the permissions granted. You can
          revoke a connection in provider settings. Revocation or expired
          access can prevent future uploads and scheduled publications.
        </p>
        <h2>Content ownership and publication</h2>
        <p>
          You retain ownership of content you supply, subject to others&apos;
          rights. You authorize Content Social Hub to store, process,
          transmit, and publish that material only for the destinations
          and publishing actions you select or schedule. The service does
          not acquire ownership of submitted content.
        </p>
        <h2>Scheduling and provider limitations</h2>
        <p>
          We seek to execute scheduled releases as requested, but do not
          guarantee exact release times, visibility, processing completion,
          or continuous availability. Providers may reject, delay, moderate,
          rate-limit, or remove content and may change or revoke API access.
          An accepted upload may remain processing or fail later. Verify
          important posts on the destination platform.
        </p>
        <h2>YouTube API Services</h2>
        <p>
          If enabled, YouTube integrations are subject to the{" "}
          <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>
          {" "}and{" "}
          <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.
          Google account permissions can be revoked through{" "}
          <a href="https://myaccount.google.com/connections">Google Account connections</a>.
        </p>
        <h2>Availability and security</h2>
        <p>
          The service uses reasonable safeguards but cannot promise
          uninterrupted or error-free operation. Do not submit passwords,
          unauthorized secrets, or unrelated confidential materials.
        </p>
        <h2>Suspension, deletion, and liability</h2>
        <p>
          Access may be restricted to address misuse, legal requirements,
          or platform restrictions. Contact us to request disconnection or
          deletion of applicable stored account information, subject to
          legitimate retention requirements. Ending access does not delete
          posts already published on other platforms. To the extent permitted
          by law, the service is provided without guarantees of publishing
          outcomes; rights that cannot legally be excluded remain intact.
        </p>
        <h2>Updates and contact</h2>
        <p>
          These terms may change as the service evolves, with material
          updates reflected in the date above. Contact Nicholas Egner,
          Minneapolis, Minnesota, USA, at{" "}
          <a href="mailto:nick@nicholasegner.com">nick@nicholasegner.com</a>.
        </p>
        <p><Link href="/privacy-policy">Privacy Policy</Link></p>
      </article>
    </main>
  );
}
