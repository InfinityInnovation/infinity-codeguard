# GitHub App integration

Infinity CodeGuard uses a GitHub App for private repositories. The app must have the repository permission **Contents: Read-only**. Do not grant write permissions.

1. Create a GitHub App owned by the appropriate GitHub account or organization.
2. Set its setup URL to `http://localhost:3000/api/v1/integrations/github/callback` for local development.
3. Disable webhook delivery until webhook signature handling is implemented.
4. Generate a private key and base64-encode the PEM without committing it.
5. Set `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY_BASE64`, and a random `GITHUB_APP_STATE_SECRET` in `.env`.
6. Recreate `api` and `worker`, then open **Intégrations** in CodeGuard and install the app on selected repositories.

Each scan requests a short-lived installation token restricted to the repository being scanned. The token is provided to Git through an ephemeral askpass process and is not stored in the database, remote URL, scan output, or logs.
