# PLAN.md — CloudRoot: Dual Deploy to Vercel + Cloudflare

Goal: keep `chat/` (Next.js) deploying to Vercel as-is, while adding a
second, independent deploy path to Cloudflare Workers via OpenNext.
`worker/` (the LangChain LLM proxy) already deploys to Cloudflare and is
unaffected by any of this.

Repos involved:
- `CloudRoot` — https://github.com/ModelEarth/CloudRoot (root repo, holds `worker/`, workflows)
- `chat` — https://github.com/ModelEarth/chat (submodule, Next.js app)

---

## 0. Prerequisite check — confirm the Postgres driver blocker

Before anything else, open `chat/lib/db` (or wherever the Drizzle client is
constructed) and check the import:

- `drizzle-orm/postgres-js` (using the `postgres` npm package) →
  **blocks the Cloudflare build**. This package uses raw TCP sockets that
  don't work on Workers and will fail with
  `UnhandledSchemeError: Reading from "cloudflare:sockets"`.
- `drizzle-orm/node-postgres` (using `pg`) → fine, proceed.

`chat/next.config.mjs` currently lists `serverExternalPackages: ['drizzle-orm', 'postgres']`,
which strongly suggests the `postgres` package is in use. If so:

- [ ] Swap the Cloudflare-path DB client to `drizzle-orm/node-postgres` + `pg`
- [ ] Keep Vercel's existing client untouched (it can keep using `postgres`/`POSTGRES_URL` directly — this only matters for the Cloudflare build)
- [ ] Wire the Cloudflare-path client to read from the Hyperdrive binding (see step 4) instead of `process.env.POSTGRES_URL` directly, when running on Workers

This step happens in application code, not config — do this first, since
nothing past this point will build if it's skipped.

---

## 1. Add Cloudflare config files to `chat/`

Working directly in the `modelearth/chat` repo (not through the CloudRoot
submodule pointer):

- [ ] Add `chat/open-next.config.ts`
- [ ] Add `chat/wrangler.jsonc`
- [ ] Append to `chat/.gitignore`:
  ```
  .open-next/
  .wrangler/
  ```
- [ ] Merge into `chat/package.json`:
  - scripts: `cf:build`, `cf:deploy`, `cf:preview`
  - devDependencies: `@opennextjs/cloudflare`, `wrangler`
  (see `package.json.additions.md` for exact snippets)
- [ ] `npm install`, commit, push to `modelearth/chat` `main`

---

## 2. Bump the CloudRoot submodule pointer

Back in `CloudRoot`:

```bash
git submodule update --remote chat
git add chat
git commit -m "Bump chat submodule for Cloudflare deploy support"
git push
```

---

## 3. Add the GitHub Actions workflow

- [ ] Add `CloudRoot/.github/workflows/deploy-chat-worker.yml`
  (already drafted — reuses `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`
  secrets already set up for `worker/`)

---

## 4. Create the Hyperdrive binding (only if step 0 applies)

One-time setup, run locally with Wrangler CLI logged in:

```bash
npx wrangler hyperdrive create chat-db --connection-string="<Supabase POSTGRES_URL>"
```

- [ ] Copy the returned `id` into `chat/wrangler.jsonc`'s `hyperdrive[0].id`
- [ ] Commit that change to `modelearth/chat`, bump the submodule pointer again (step 2)

---

## 5. Set Cloudflare Worker secrets for `chat-nextjs`

The `chat` app needs its own runtime secrets on Cloudflare (separate from
`worker/`'s `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`). From `chat/`:

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put GOOGLE_GENERATIVE_AI_API_KEY
# ...and any other secrets from chat/.env.example that the app needs at runtime
```

- [ ] Decide whether to run these manually once, or add them to
      `deploy-chat-worker.yml` the same way `deploy-worker.yml` pushes
      `ANTHROPIC_API_KEY`/`OPENAI_API_KEY` from GitHub Secrets — recommended
      if secrets rotate, since manual `wrangler secret put` won't survive
      a secret rotation without someone remembering to rerun it
- [ ] If added to the workflow, add matching entries in GitHub
      (**Settings → Secrets and variables → Actions**) for each one

---

## 6. First deploy — do it locally before trusting CI

```bash
cd chat
npm install
npm run cf:build
npm run cf:preview   # sanity check locally against the Workers runtime
npm run cf:deploy    # first real deploy
```

- [ ] Confirm the Worker URL Cloudflare prints
      (`https://chat-nextjs.<your-subdomain>.workers.dev`)
- [ ] Load a few pages that touch: auth (BetterAuth login), a DB-backed
      page (chat history), and RAG (a query that hits Pinecone) — these
      are the three subsystems most likely to behave differently on
      Workers vs. Vercel
- [ ] Check Image Optimization on any page using `next/image`, since
      OpenNext's support can lag Vercel's native implementation

---

## 7. Enable CI

- [ ] Push a trivial change under `chat/**` (via the submodule bump) to
      confirm `deploy-chat-worker.yml` fires and succeeds end to end
- [ ] Confirm `worker/**` changes still deploy `llm-proxy-worker`
      independently and haven't been affected by any of the above

---

## End state

| | Vercel | Cloudflare |
|---|---|---|
| `chat/` (Next.js) | deploys automatically via Vercel's git integration, unchanged | deploys via `deploy-chat-worker.yml` → OpenNext → `chat-nextjs` Worker |
| `worker/` (LLM proxy) | not deployed here | deploys via `deploy-worker.yml` → `llm-proxy-worker` |

Both Cloudflare Workers deploy independently and can redeploy on every
merge to `main`, as decided earlier — double-deploying is intentional, not
a bug to fix.
