# Run Pipwise locally with Google sign-in

This computer already has dependencies and database tables installed. The remaining step is adding your Google OAuth credentials. All app pages, including the calculator, require a valid Google-backed session. There is no automatic demo login.

## 1. Create your Google OAuth client

1. Open https://console.cloud.google.com/ and create or select a project named Pipwise.
2. Open **Google Auth Platform**. Configure **Branding** with the application name and a support email.
3. Set **Audience** to **External**. You can start in Testing. Basic Google sign-in (`openid email profile`) is exempt from the test-user restriction; adding test users does not limit who can sign in to Pipwise.
4. Under **Clients**, create a **Web application** OAuth client.
5. Add this exact **Authorized redirect URI**:

   ```text
   http://127.0.0.1:5173/api/auth/google/callback
   ```

6. Copy the client ID and secret into your local `.dev.vars` file. Keep the secret private.

The app requests only `openid email profile`, not Gmail or Drive access. Redirect URIs must match exactly, including the host and port. Use the same `127.0.0.1` address throughout. If you prefer localhost, change APP_ORIGIN and register `http://localhost:5173/api/auth/google/callback` instead.

Google documentation: https://developers.google.com/identity/protocols/oauth2/web-server

## 2. Configure your local app

Edit `.dev.vars` in the project folder:

```dotenv
APP_ORIGIN="http://127.0.0.1:5173"
GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your-client-secret"
```

The real `.dev.vars` file is ignored by Git. `.dev.vars.example` is a safe blank template. Do not use NEXT_PUBLIC-prefixed variables for credentials.

## 3. Start the app

In Terminal:

```sh
cd /Users/aravindvattappallil/Desktop/pipwise2.0/pipwise-community
npm run dev:local
```

Open http://127.0.0.1:5173 and choose **Continue with Google**. A profile is created on first sign-in. Sign out from the account menu. Sessions last up to seven days and are invalidated on sign-out. Restart the server after changing `.dev.vars`.

## Local data

Profiles, Google account mappings, sessions, journals, likes and bookmarks persist in the local D1 SQLite database under `.wrangler/state/`. Uploaded profile photos persist in the local R2 directory there. Do not delete this directory if you want to keep your local data. Back it up while the server is stopped.

Different Google users on this local instance share the public journal feed; private journals are restricted to their owner. Data does not automatically sync with the published Site or another computer. Google login requires an internet connection. The server binds to this computer only, not the local network.

Old preview-account journals remain in the database but are not automatically assigned to a Google account. Accounts are keyed by Google's verified subject ID; emails alone cannot claim an existing profile.

## Installing on another computer

Install Node.js 22.13 or newer, copy the project without `node_modules`, `.dev.vars` or test artifacts, then:

```sh
npm ci
cp .dev.vars.example .dev.vars
npm run build
```

For a **new, empty local database only**, apply the migrations in order:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_black_wiccan.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_spicy_reptil.sql
```

Do not reapply these on this computer; they are already installed. Add your Google credentials, then run `npm run dev:local`.

## Checks

```sh
npx tsc --noEmit
node --test tests/auth.test.mjs tests/risk.test.mjs
npm run build
npm run test:api
```

API tests run in a separate local database (`.wrangler/auth-api-test`) on port 8787 with synthetic sessions. They do not sign into Google, touch real accounts or change normal local data. The complete Google consent/callback flow must still be checked after entering real OAuth credentials.

## Independent cloud hosting

See [DEPLOY_CLOUDFLARE.md](DEPLOY_CLOUDFLARE.md) for hosting the complete app in your own Cloudflare account. This uses a separate cloud database. Your local Google credentials and data remain local until the documented configuration and migration steps are completed.
