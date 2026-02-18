import { scrapeProducts } from "./scraper.js";
import { loadState, saveState } from "./store.js";
import { notifyBatch } from "./notifier.js";
import type { Product, ProductMap } from "./types.js";

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

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});