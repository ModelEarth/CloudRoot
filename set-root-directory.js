// Updates the "vercel-root" Vercel project's Root Directory setting to "chat"
// via Vercel's REST API (PATCH /v9/projects/{idOrName}).
//
// Reads VERCEL_API_TOKEN from .env.local at the repo root (parsed manually
// since dotenv isn't a dependency of this repo's root package.json).
//
// Usage:
//   node set-root-directory.js
//
// Optional: set VERCEL_TEAM_ID in .env.local if "vercel-root" belongs to a
// Vercel team (required by the API for team-owned projects).

const fs = require('fs');
const path = require('path');

const PROJECT_NAME = 'vercel-root';
const ROOT_DIRECTORY = 'chat';

function loadEnvLocal(envPath) {
  const content = fs.readFileSync(envPath, 'utf8');
  const env = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex === -1) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1).trim();
    env[key] = value;
  }
  return env;
}

async function main() {
  const envPath = path.join(__dirname, '.env.local');
  const env = loadEnvLocal(envPath);

  const token = env.VERCEL_API_TOKEN;
  if (!token || token === 'REPLACE_ME') {
    console.error('Failed: VERCEL_API_TOKEN is missing or still set to REPLACE_ME in .env.local');
    process.exit(1);
  }

  const teamId = env.VERCEL_TEAM_ID;
  const url = new URL(`https://api.vercel.com/v9/projects/${PROJECT_NAME}`);
  if (teamId) {
    url.searchParams.set('teamId', teamId);
  }

  let response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ rootDirectory: ROOT_DIRECTORY }),
    });
  } catch (err) {
    console.error('Failed: request to Vercel API did not complete.');
    console.error(err);
    process.exit(1);
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    console.error(`Failed: Vercel API responded with status ${response.status}`);
    console.error(JSON.stringify(body, null, 2));
    process.exit(1);
  }

  console.log(`Success: "${PROJECT_NAME}" rootDirectory is now "${body.rootDirectory}"`);
}

main();
