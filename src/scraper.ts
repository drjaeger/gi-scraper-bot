import { parse } from "node-html-parser";
import type { Product, ProductMap } from "./types.js";

const SHOP_URL = "https://crawlme.games-island.eu/c/Magic-The-Gathering";
const BASE_URL = "https://games-island.eu/en";

// German stock strings the site uses
const IN_STOCK_STRINGS = ["auf lager", "verfügbar"];

function isInStock(statusText: string): boolean {
  const normalized = statusText.trim().toLowerCase();
  return IN_STOCK_STRINGS.some((s) => normalized.includes(s));
}

export async function scrapeProducts(): Promise<ProductMap> {
  const response = await fetch(SHOP_URL, {
    headers: {
      // Polite browser-like headers
      "User-Agent":
        "Mozilla/5.0 (compatible; GamesIslandBot/1.0; stock-monitor)",
      Accept: "text/html",
    },
  });

  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const root = parse(html);

  const products: ProductMap = {};
  let currentCategory = "Uncategorized";

  // The page is a table of category header rows (tr.kategorie) followed by
  // product rows (tr.artikel: name/link cell + stock status cell)
  const rows = root.querySelectorAll("tr.kategorie, tr.artikel");

  for (const row of rows) {
    if (row.classList.contains("kategorie")) {
      // Header has two links: "[ /c/path ]" (crawlme) then the readable name
      const links = row.querySelectorAll("a");
      const nameLink = links[links.length - 1];
      if (nameLink) {
        currentCategory = nameLink.text.trim();
      }
      continue;
    }

    const cells = row.querySelectorAll("td");
    if (cells.length < 2) continue;

    const link = cells[0].querySelector("a");
    if (!link) continue;

    const name = link.text.trim();
    const href = link.getAttribute("href") ?? "";
    const stockText = cells[1].text.trim();

    if (!name || !href) continue;

    // Product links are absolute today; handle relative ones just in case
    const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

    products[url] = {
      name,
      url,
      inStock: isInStock(stockText),
      category: currentCategory,
    };
  }

  if (Object.keys(products).length === 0) {
    // Layout change or blocked request — don't let an empty result overwrite state
    throw new Error("Scraped 0 products — page layout may have changed");
  }

  console.log(`Scraped ${Object.keys(products).length} products`);
  return products;
}