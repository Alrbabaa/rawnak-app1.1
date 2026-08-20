# Running the real functional test suite

`scripts/functional-test.js` performs genuine operations against your real
Firebase project (and, optionally, your real running app) — nothing in it
is simulated. It could not be run inside the sandbox that built this
migration (its network egress to Google's OAuth/Firestore/Storage APIs is
blocked entirely) — this must be run somewhere with real internet access.

## Quick start

```bash
npm install
# Make sure .env has real values (see .env.example) — especially
# FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, and
# the NEXT_PUBLIC_FIREBASE_* client config.

# Recommended: run the app in one terminal so HTTP-dependent tests
# (AI endpoints, Admin Dashboard, referral signup flow) are included
npm run dev

# In another terminal:
node scripts/functional-test.js
```

## What you'll see

A PASS/FAIL/SKIP line per test, grouped into 10 sections (Authentication,
Firestore, Security Rules, Storage, Custom Claims, Referral flow, AI
endpoints, Storage/image analysis, Admin Dashboard, public content). A
summary count at the end, plus a full list of any failures with the exact
error message — and a full list of skips with the reason, so you always
know the difference between "didn't run" and "ran and failed".

Exit code is `0` only if every test that ran passed (skips don't count
against it) — safe to wire into CI later if useful.

## Before you deploy Security Rules

The suite's Section 3 tests (Firestore Security Rules) and part of Section
4 (Storage Rules) will only genuinely pass once you've deployed
`firestore.rules` and `storage.rules` to your project:

```bash
npm install -g firebase-tools   # if you don't have it
firebase login
firebase deploy --only firestore:rules,firestore:indexes,storage --project rawnak-c504e
```

The `firestore.indexes.json` deploy is important too, separately from
rules — several public-facing screens (Picks, Articles, Academy, home
screen partners) use `.where().orderBy()` query combinations that need
these composite indexes to exist, or they'll throw a runtime error on
first real use.

## Options

- `TEST_BASE_URL` — defaults to `http://localhost:3000`. Set to a deployed
  URL to test against a real deployment instead of your local dev server.
- `RUN_AI_TESTS=false` — skips the AI endpoint tests (Section 7), which
  make real calls to your configured AI provider and may incur real API
  costs depending on your `AI_PROVIDER`/`GEMINI_API_KEY` setup.

## Test data

The suite creates two temporary Firebase Auth users and a temporary
referral partner, exercises real operations against them, then deletes
everything it created in a cleanup step at the end — including on a
partial failure. If a run is interrupted before cleanup runs, look for
Auth users with emails matching `rawnak-functest-*@example.com` in the
Firebase Console and remove them manually.
