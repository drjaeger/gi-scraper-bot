import type { ProductMap } from "./types.js";

// Set these as GitHub Actions secrets:
// GIST_ID  — the ID of your private Gist (from the URL)
// GIST_TOKEN — a GitHub personal access token with gist scope
const GIST_ID = process.env.GIST_ID ?? "";
const GIST_TOKEN = process.env.GIST_TOKEN ?? "";
const GIST_FILENAME = "games-island-state.json";

const GIST_API = `https://api.github.com/gists/${GIST_ID}`;

const headers = {
  Authorization: `Bearer ${GIST_TOKEN}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  "X-GitHub-Api-Version": "2022-11-28",
};

export async function loadState(): Promise<ProductMap> {
  if (!GIST_ID || !GIST_TOKEN) {
    console.warn("GIST_ID or GIST_TOKEN not set — starting with empty state");
    return {};
  }

  const response = await fetch(GIST_API, { headers });

  if (!response.ok) {
    if (response.status === 404) {
      console.log("Gist not found — starting with empty state");
      return {};
    }
    throw new Error(`Failed to load Gist: ${response.status}`);
  }

  const gist = await response.json();
  const file = gist.files?.[GIST_FILENAME];

  if (!file?.content) {
    console.log("State file not found in Gist — starting fresh");
    return {};
  }

  return JSON.parse(file.content) as ProductMap;
}

export async function saveState(state: ProductMap): Promise<void> {
  if (!GIST_ID || !GIST_TOKEN) {
    console.warn("GIST_ID or GIST_TOKEN not set — skipping state save");
    return;
  }

  const body = JSON.stringify({
    files: {
      [GIST_FILENAME]: {
        content: JSON.stringify(state, null, 2),
      },
    },
  });

  const response = await fetch(GIST_API, {
    method: "PATCH",
    headers,
    body,
  });

  if (!response.ok) {
    throw new Error(`Failed to save Gist: ${response.status}`);
  }

  console.log("State saved to Gist");
}