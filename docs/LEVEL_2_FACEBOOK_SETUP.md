# Level 2 Facebook Pages Connection Setup

Level 2 adds the first real social-account adapter. It supports:

- owner-initiated Facebook authorization
- emailed client connection requests
- single-use setup links that expire after 48 hours
- explicit Facebook Page selection
- encrypted Page access-token storage
- initial Account Health checks

No Facebook password is collected or stored by Content Social Hub.

## Amplify environment variables

Add these server-side variables to the Amplify application after the Phase 2 code is merged:

```text
APP_BASE_URL=https://main.d1yfjibipwjpld.amplifyapp.com

META_APP_ID=<Meta application ID>
META_APP_SECRET=<Meta application secret>
META_LOGIN_CONFIG_ID=<Facebook Login for Business configuration ID, when used>
META_GRAPH_VERSION=v26.0

OAUTH_TOKEN_ENCRYPTION_KEY=<base64 encoded 32-byte key>

RESEND_API_KEY=<Resend API key>
EMAIL_FROM=Content Social Hub <nick@nicholasegner.com>
EMAIL_REPLY_TO=nick@nicholasegner.com
```

Do not prefix these variables with `NEXT_PUBLIC_`. They must remain available only to the server runtime.

Generate the encryption key locally:

```bash
openssl rand -base64 32
```

This encryption key protects saved OAuth access tokens. Store it somewhere secure before adding it to Amplify. Losing it makes existing saved social connections unreadable and requires reconnecting those accounts.

Redeploy Amplify after adding or changing any environment variable.

## Meta application

Create a Meta developer application intended to manage business assets and add Facebook Login or Facebook Login for Business.

Use this exact production OAuth redirect URI:

```text
https://main.d1yfjibipwjpld.amplifyapp.com/api/connections/facebook/callback
```

For local development, also allow:

```text
http://localhost:3000/api/connections/facebook/callback
```

The adapter requests:

```text
pages_show_list
pages_read_engagement
pages_manage_posts
```

These permissions allow the app to list eligible Pages, verify the selected Page, evaluate connection health, and support the Facebook publishing work planned for Level 3.

During Meta development mode, only people assigned an application role can complete the test OAuth flow. Connecting client accounts outside the app's roles may require switching the Meta app to Live mode, completing the required business verification, and obtaining Advanced Access through App Review.

Set the application domain and required policy/contact URLs in the Meta app before requesting review. Do not place the Meta App Secret in browser code or in this repository.

## Resend

The existing verified `nicholasegner.com` Resend domain can be reused. Create a separate API key for Content Social Hub so access can be revoked without affecting the CRM.

Recommended sender:

```text
Content Social Hub <nick@nicholasegner.com>
```

The connection email contains a secure setup URL. Generating a replacement request revokes the previous unfinished request.

## Security behavior

- request tokens are generated with cryptographically secure randomness
- only a SHA-256 hash of each request token is stored
- request links expire after approximately 48 hours
- OAuth state values expire after approximately 10 minutes and are single-use
- unfinished account-selection links expire after approximately 20 minutes
- Page access tokens are encrypted with AES-256-GCM before MongoDB storage
- Facebook passwords are handled only by Facebook
- setup pages cannot access the owner workspace
- completed, revoked, and expired request links cannot be reused

## Checkpoint test

1. Add all required Amplify environment variables and redeploy.
2. Sign in to Content Social Hub.
3. Open **Social Accounts**.
4. Select a client.
5. Choose **Connect**.
6. Complete Facebook authorization.
7. Choose the correct Facebook Page.
8. Confirm the Page appears under Connected accounts.
9. Select **Check now** and confirm Account Health is Healthy.
10. Send a Request Connection email to a test client email.
11. Open the email link in a private browser window.
12. Confirm the setup page cannot access the owner workspace.
13. Complete the connection and confirm the request changes to Completed.
14. Generate a replacement request and confirm the older unfinished link no longer works.

Level 2 passes when a real Facebook Page is stored under the correct client and Account Health can verify the connection.
