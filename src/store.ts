import { readFile, writeFile, rename, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { ProductMap } from "./types.js";

// Two backends:
//  - Local file (default) — STATE_FILE, defaults to ./data/state.json
//  - GitHub Gist — used when both GIST_ID and GIST_TOKEN are set
const GIST_ID = process.env.GIST_ID ?? "";
const GIST_TOKEN = process.env.GIST_TOKEN ?? "";
const GIST_FILENAME = "games-island-state.json";
const GIST_API = `https://api.github.com/gists/${GIST_ID}`;

export const DATA_DIR = resolve(process.env.DATA_DIR ?? "data");
const STATE_FILE = resolve(process.env.STATE_FILE ?? `${DATA_DIR}/state.json`);

const useGist = Boolean(GIST_ID && GIST_TOKEN);

const gistHeaders = {
  Authorization: `Bearer ${GIST_TOKEN}`,
  Accept: "application/vnd.github+json",
  "Content-Type": "application/json",
  "X-GitHub-Api-Version": "2022-11-28",
};

// ---------- generic JSON file helpers (also used for health tracking) ----------

export async function readJsonFile<T>(path: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

// Write to a temp file then rename — atomic on the same filesystem, so a power
// cut mid-write (common on a Pi) can't leave a truncated/corrupt state file
export async function writeJsonFile(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2));
  await rename(tmp, path);
}

// ---------- state ----------

export async function loadState(): Promise<ProductMap> {
  if (!useGist) {
    const state = await readJsonFile<ProductMap>(STATE_FILE);
    if (!state) console.log(`No state file at ${STATE_FILE} — starting fresh`);
    return state ?? {};
  }

  const response = await fetch(GIST_API, {
    headers: gistHeaders,
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    // Includes 404: a wrong GIST_ID must fail loudly, otherwise every run
    // looks like a first run and no notifications are ever sent
    throw new Error(`Failed to load Gist ${GIST_ID}: ${response.status}`);
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
  if (!useGist) {
    await writeJsonFile(STATE_FILE, state);
    console.log(`State saved to ${STATE_FILE}`);
    return;
  }

  const response = await fetch(GIST_API, {
    method: "PATCH",
    headers: gistHeaders,
    body: JSON.stringify({
      files: {
        [GIST_FILENAME]: { content: JSON.stringify(state, null, 2) },
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Failed to save Gist: ${response.status}`);
  }

  console.log("State saved to Gist");
}
