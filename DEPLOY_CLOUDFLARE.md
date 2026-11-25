# Host Pipwise in your own Cloudflare account

This deployment is independent of ChatGPT Sites. Cloudflare Workers hosts the app, D1 stores profiles, Google account links, journals, likes, bookmarks and sessions, and R2 stores uploaded profile photos. Google handles sign-in. All app pages and data APIs require a verified Google session.

The deployment configuration and local data export are prepared. Nothing has been deployed or copied to an independent cloud account yet. The old ChatGPT-hosted preview remains private; its Google environment variables were removed. Do not use its URL as the production OAuth callback for this deployment.

## 1. Create and connect your Cloudflare account

Create an account at https://dash.cloudflare.com/sign-up. Then run in Terminal:

```sh
cd /Users/aravindvattappallil/Desktop/pipwise2.0/pipwise-community
npx wrangler login
npx wrangler whoami
```

Complete the Cloudflare sign-in and authorization in your browser. Do not send passwords or API tokens in chat.

## 2. Create the cloud resources

Copy the template:

```sh
cp wrangler.cloudflare.example.json wrangler.cloudflare.json
```

Set `account_id` to your Cloudflare account ID (shown by `wrangler whoami` or the dashboard). Create resources in that account:

```sh
npx wrangler d1 create pipwise-db --config wrangler.cloudflare.json
npx wrangler r2 bucket create pipwise-avatars --config wrangler.cloudflare.json
```

If the account has not enabled R2 yet, finish that setup in Cloudflare first. Set `database_id` in `wrangler.cloudflare.json` to the ID returned by the D1 creation command. If you choose other resource names, update the config to match.

In Cloudflare's Workers & Pages dashboard, set or find your account's workers.dev subdomain. Set `vars.APP_ORIGIN` to:

```text
https://pipwise-community.YOUR-SUBDOMAIN.workers.dev
```

Replace YOUR-SUBDOMAIN with the actual subdomain. Use no trailing slash. A custom domain can be configured later. Keep `.dev.vars` pointing to localhost so local development continues to work.

## 3. Add the production Google callback

In Google Cloud Console → Google Auth Platform → Clients → your Web application, add:

```text
https://pipwise-community.YOUR-SUBDOMAIN.workers.dev/api/auth/google/callback
```

Keep the localhost callback if you still develop locally. The host must exactly match `APP_ORIGIN`. Ignore the previously suggested chatgpt.site callback for this independent deployment.

Basic `openid email profile` sign-in allows Google users outside the OAuth test-user list. Pipwise currently permits any verified Google account, as requested. Private journal access is enforced separately by the application.

## 4. Publish and configure Google secrets

```sh
npm run cloud:deploy
npx wrangler secret put GOOGLE_CLIENT_ID --config wrangler.cloudflare.json
npx wrangler secret put GOOGLE_CLIENT_SECRET --config wrangler.cloudflare.json
```

`cloud:deploy` builds using your Cloudflare configuration, applies pending D1 schema migrations, and deploys the Worker and static assets. It does not publish to ChatGPT or copy local data. Until the Google values are set, the login page shows that setup is needed.

Enter the same Google client ID and secret used locally into Wrangler's secure prompts. These values are stored as Worker secrets. Do not put them in the JSON config or commit `.dev.vars`.

## 5. Move existing local data

Before anyone signs into the new cloud app, stop local edits and export the current database:

```sh
npm run cloud:export
```

The command prints the path to a private SQL backup in `.sites-runtime/backups/` and row counts. It preserves Google subject IDs, journal ownership, private/public visibility, likes and bookmarks. It excludes login sessions and OAuth flows, so everyone signs in again online. The local database is not changed.

Import that exact file into the new, empty cloud database after schema migrations have run:

```sh
npx wrangler d1 execute DB --remote --config wrangler.cloudflare.json --file /absolute/path/printed/by/cloud-export.sql
```

Do not repeat the import or import into a cloud database that already has app records. The export uses ordinary INSERT statements and does not overwrite existing rows. If anyone has already signed in online, reconcile their Google account mapping before importing.

The current snapshot has no uploaded profile photos. The exporter stops if photos exist, so an R2 transfer can be included rather than silently losing files. Legacy preview records are preserved but are not automatically assigned to a Google account.

Local development and cloud production remain separate databases; this is a one-time migration, not continuous synchronization. Use the deployed URL for all subsequent shared community activity. Calculator inputs and unsaved drafts are not durable journal records; save a journal to keep a trade plan.

## 6. Verify

Open the independent HTTPS URL, sign in with Google, and confirm your profile, own journals and saved items. Check that another Google account sees public journals but cannot see your private journals. Sign out and confirm protected pages return to login.

Local checks already available:

```sh
npm run cloud:check
npx tsc --noEmit
node --test tests/auth.test.mjs tests/risk.test.mjs tests/cloud-export.test.mjs
npm run test:api
```

`cloud:check` builds using the example configuration and runs a Wrangler dry run. It neither deploys nor needs an account. `cloud:deploy` always rebuilds from your real configuration and rejects placeholder settings.

References: [Cloudflare Worker configuration](https://developers.cloudflare.com/workers/wrangler/configuration/), [D1 commands](https://developers.cloudflare.com/d1/wrangler-commands/), [Google OAuth web applications](https://developers.google.com/identity/protocols/oauth2/web-server).
