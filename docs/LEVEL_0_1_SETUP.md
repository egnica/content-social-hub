# Level 0 and Level 1 Deployment Setup

This checkpoint connects the deployed Next.js application to MongoDB Atlas and the private `content-social-hub-media` S3 bucket.

## Amplify environment variables

Add the following server-side variables to the Amplify application. Do not prefix them with `NEXT_PUBLIC_`.

```text
MONGODB_URI=<private Atlas connection string>
MONGODB_DB=content_social_hub
SESSION_SECRET=<random value containing at least 32 characters>
ADMIN_PASSWORD=<owner sign-in password>
AWS_REGION=us-east-2
S3_MEDIA_BUCKET=content-social-hub-media
```

Generate the session secret locally with:

```bash
openssl rand -base64 32
```

Never commit the real values. Redeploy Amplify after changing environment variables.

## MongoDB Atlas access

Use a database user limited to `readWrite` access on `content_social_hub` rather than a user with access to every database.

Atlas Network Access must permit connections from the Amplify server runtime. Amplify server compute does not provide a stable outbound IP by default. For the initial checkpoint, Atlas can allow `0.0.0.0/0` while the database remains protected by TLS and its unique least-privilege credentials. A future paid networking setup can narrow this through static egress or private connectivity.

After deployment, open:

```text
https://main.d1yfjibipwjpld.amplifyapp.com/api/health
```

Expected response:

```json
{
  "status": "ok",
  "database": "connected"
}
```

## S3 CORS

The browser uploads directly to private S3 objects using short-lived presigned URLs. Add this CORS configuration to `content-social-hub-media`:

```json
[
  {
    "AllowedHeaders": [
      "content-type",
      "x-amz-server-side-encryption"
    ],
    "AllowedMethods": [
      "GET",
      "HEAD",
      "PUT"
    ],
    "AllowedOrigins": [
      "https://main.d1yfjibipwjpld.amplifyapp.com",
      "http://localhost:3000"
    ],
    "ExposeHeaders": [
      "ETag"
    ],
    "MaxAgeSeconds": 3000
  }
]
```

Add future production custom domains to `AllowedOrigins` before using them.

## Amplify runtime access to S3

The server runtime needs permission to create signed upload and view requests for client media. Prefer an Amplify compute role using a least-privilege policy equivalent to:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ContentSocialHubMedia",
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject"
      ],
      "Resource": "arn:aws:s3:::content-social-hub-media/clients/*"
    }
  ]
}
```

The application uses the AWS SDK default credential provider chain. Do not place AWS credentials in client-side code.

## Checkpoint test

1. Open `/api/health` and confirm MongoDB is connected.
2. Open `/login` and sign in with `ADMIN_PASSWORD`.
3. Add a client.
4. Create a Master Content package.
5. Upload an image and a video.
6. Confirm upload progress completes and previews load.
7. Save the package.
8. Return to Content and reopen it.
9. Confirm fields, media order, dimensions, duration, default primary media, and reusable state persist.

Do not begin a social OAuth adapter until this checkpoint passes.
