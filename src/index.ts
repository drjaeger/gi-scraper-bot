import { scrapeProducts } from "./scraper.js";
import { DATA_DIR, loadState, saveState, readJsonFile, writeJsonFile } from "./store.js";
import { notifyBatch, notifyHealth } from "./notifier.js";
import type { Product } from "./types.js";

// Tracks whether the last run failed, so we alert once when the monitor
// breaks and once when it recovers — not on every failed run
const HEALTH_FILE = `${DATA_DIR}/health.json`;

interface Health {
  failing: boolean;
  since: string;
  lastError?: string;
}

async function run(): Promise<void> {
  console.log(`[${new Date().toISOString()}] Starting Games Island monitor...`);

  // 1. Load previous state
  const previousState = await loadState();
  const isFirstRun = Object.keys(previousState).length === 0;

  if (isFirstRun) {
    console.log("First run — building initial state, no notifications sent");
  }

  // 2. Scrape current state
  const currentState = await scrapeProducts();

  // Sanity check: a sudden large drop usually means a partial/broken page,
  // not a real catalogue change. Refuse to overwrite good state with it.
  const prevCount = Object.keys(previousState).length;
  const currCount = Object.keys(currentState).length;
  if (!isFirstRun && currCount < prevCount * 0.5) {
    throw new Error(
      `Scraped ${currCount} products vs ${prevCount} last run — refusing to save suspicious state`
    );
  }

  // 3. Diff — find new products and restocked products
  const newProducts: Product[] = [];
  const restocked: Product[] = [];

  for (const [url, product] of Object.entries(currentState)) {
    if (!product.inStock) continue; // We only care about available items

    const previous = previousState[url];

    if (!previous) {
      // Product didn't exist before
      if (!isFirstRun) {
        newProducts.push(product);
      }
    } else if (!previous.inStock && product.inStock) {
      // Product existed but was out of stock — now it's back
      restocked.push(product);
    }
  }

  console.log(
    `Changes: ${newProducts.length} new products, ${restocked.length} restocked`
  );

  // 4. Send notifications (skipped on first run)
  if (!isFirstRun && (newProducts.length > 0 || restocked.length > 0)) {
    await notifyBatch(newProducts, restocked);
  }

  // 5. Save new state
  await saveState(currentState);

  console.log("Run complete.");
}

async function main(): Promise<void> {
  const health = await readJsonFile<Health>(HEALTH_FILE);
  const now = new Date().toISOString();

  try {
    await run();
    if (health?.failing) {
      await notifyHealth("recovered", `Failing since ${health.since}`).catch((e) =>
        console.error("Could not send recovery alert:", e)
      );
      await writeJsonFile(HEALTH_FILE, { failing: false, since: now });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("Fatal error:", err);
    if (!health?.failing) {
      await writeJsonFile(HEALTH_FILE, { failing: true, since: now, lastError: message });
      // Best effort — if Discord itself is the problem, just log it
      await notifyHealth("failing", message).catch((e) =>
        console.error("Could not send failure alert:", e)
      );
    }
    process.exitCode = 1;
  }
}

main();
