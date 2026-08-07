# LLM Proxy Worker (LangChain + Cloudflare + GitHub Secrets)

A Cloudflare Worker that holds your LLM API keys server-side and exposes a
single `/api/chat` endpoint. Your frontend JS calls the Worker — it never
touches an Anthropic or OpenAI key directly. GitHub Actions deploys the
Worker and pushes your keys from **GitHub Secrets** into **Cloudflare
Secrets** on every push to `main`.

```
frontend JS  --->  Cloudflare Worker (/api/chat)  --->  Anthropic / OpenAI
                    (holds API keys as secrets)
```

## GitHub Secrets

GitHub Secrets are provided by GitHub Actions runners during a workflow run — they are never sent to a browser. This repo uses them to configure Cloudflare (a service that *can* safely hold runtime secrets and serve requests), not to hand keys to frontend code.

## 1. Get your API keys

- Anthropic: [console.anthropic.com](https://console.anthropic.com) → **API Keys**
- OpenAI: [platform.openai.com](https://platform.openai.com/api-keys) → **API Keys**

## 2. Get your Cloudflare credentials

1. Cloudflare dashboard → **My Profile → API Tokens → Create Token**
   - Use the "Edit Cloudflare Workers" template, scoped to your account.
2. Note your **Account ID** (right sidebar of the Cloudflare dashboard, or
   `Workers & Pages` overview page).

## 3. Add secrets to GitHub

In your repo: **Settings → Secrets and variables → Actions → New repository secret**

Add each of these (name must match exactly):

| Secret name             | Value                                  |
|--------------------------|-----------------------------------------|
| `ANTHROPIC_API_KEY`      | Your Anthropic key                     |
| `OPENAI_API_KEY`         | Your OpenAI key                        |
| `CLOUDFLARE_API_TOKEN`   | The token you created in step 2        |
| `CLOUDFLARE_ACCOUNT_ID`  | Your Cloudflare account ID             |

Since this is a private repo with multiple collaborators: repo secrets are
only visible to workflows, never in logs or to collaborators via the UI —
but anyone with **write access** can modify a workflow file to print or
exfiltrate a secret in a run they trigger. If you want tighter control,
use **Environments** (Settings → Environments → New environment → add the
secrets there instead of at repo level) and require reviewers to approve
deployments that use them.

## 4. Deploy

Push to `main` with changes under `worker/`, or trigger manually from the
**Actions** tab (`workflow_dispatch`). The workflow:

1. Installs dependencies in `worker/`
2. Pushes `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` into Cloudflare as Worker
   secrets via `wrangler secret put`
3. Runs `wrangler deploy`

After the first deploy, note the Worker URL Cloudflare prints
(`https://llm-proxy-worker.<your-subdomain>.workers.dev`) and update it in
your frontend code.

## 5. Local development (optional)

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars   # fill in real keys locally, not committed
npm run dev
```

`.dev.vars` is git-ignored — it's only for local `wrangler dev` testing and
is never used in production (production uses the secrets pushed by the
Actions workflow).

## 6. Call it from the frontend

See `frontend-example.js`. No keys anywhere in the frontend bundle — just a
`fetch()` to your Worker's `/api/chat` endpoint, with `provider` set to
`"anthropic"` or `"openai"` per request.

## Files

```
.github/workflows/deploy-worker.yml   # CI: deploy + sync secrets
worker/src/index.js                   # Worker: LangChain LLM proxy
worker/wrangler.toml                  # Worker config
worker/package.json                   # Worker deps (@langchain/anthropic, @langchain/openai)
worker/.dev.vars.example              # local dev secrets template
frontend-example.js                   # example fetch() call from frontend
```

## Adding more providers / models

Edit `getModel()` in `worker/src/index.js` — add a new `case` for the
provider, wire up its LangChain chat class, and add the matching key as
both a GitHub secret and a `wrangler secret put` line in the workflow.


CloudRoot/  
├── .github/workflows/  
│   ├── deploy-worker.yml           ← commit as-is  
│   └── deploy-chat-worker.yml      ← commit as-is  
├── worker/  
│   ├── src/index.js  
│   ├── package.json  
│   ├── wrangler.toml  
│   ├── .dev.vars.example  
│   └── .gitignore                  ← already updated  
├── frontend-example.js  
├── README.md  
├── PLAN.md  
└── chat/ — edit submodule in modelearth/chat directly, then bump CloudRoot pointer  
    ├── open-next.config.ts         ← commit as-is  
    ├── wrangler.jsonc               ← commit as-is  
    ├── .gitignore                   ← merge chat-gitignore-additions.txt into this  
    └── package.json                 ← PLAN.md is merging package.json.additions.md into this  