# Pipwise — Journal Community

A responsive trading journal community based on the supplied Pipwise reference screens.

## Features

- Community feed with latest / most liked sorting
- Private-by-default journal creation, editing and deletion
- Personal journals with public / private filters
- Likes and a personal saved-journal collection
- Trader profiles, unique usernames, bios and profile photos
- Position-size calculator for forex, gold, crypto and index CFDs
- Manual account conversion rates and broker contract settings
- Calculator-to-journal trade-plan drafts
- Responsive navigation and keyboard-accessible dialogs

## Stack and data

React / Vinext, Cloudflare Workers, D1 (journals, profiles, likes and bookmarks), R2 (profile images), and Sites-managed ChatGPT identity. Each API mutation authorizes the signed-in user. Private entries are excluded from other users’ feeds, profiles and saved collections.

The new hosted Site is private to its owner. Public journal visibility means visible within the community to visitors who have Site access; it does not change the Site’s access policy. No demo journal records are seeded in production. Local preview test records stay in the ignored `.wrangler/` directory.

## Local development

```sh
npm run dev -- --host 127.0.0.1
```

The local sign-in flow uses the starter’s local preview identity. Hosted authentication uses the trusted Sites identity headers, not this mock identity.

## Checks

```sh
npx tsc --noEmit
node --test tests/risk.test.mjs
npm run build
```

To run API integration tests, start the built Worker locally on port 8787 with `npm run start -- --port 8787`, then run `node --test tests/api.test.mjs`. These tests are restricted to a loopback host and use dedicated local QA identities.

## Database migrations

Generate schema-only migrations with `npm run db:generate`. The checked-in SQL is applied during deployment. For the first local preview, build once, then apply the initial migration:

```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_black_wiccan.sql
```

Do not replay an already applied migration. The local and hosted databases are separate.

## Calculator assumptions

All prices are entered manually; the included prices are examples. Lot sizes round down to the chosen increment. USD/JPY risk converts at the stop and profit at the target. Other non-USD account currencies require a user-supplied USD conversion rate. Broker contract sizes vary, especially for indices, metals and crypto. Estimates exclude spread, slippage, commissions and swaps.
