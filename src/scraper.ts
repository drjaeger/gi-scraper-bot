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

  // The page is a table — iterate all rows
  const rows = root.querySelectorAll("tr");

  for (const row of rows) {
    const cells = row.querySelectorAll("td");

    if (cells.length === 0) continue;

    // Category header rows have bold "Kategorie" text and a link
    if (cells.length === 1 || row.querySelector("b")) {
      const categoryLink = row.querySelector("a");
      if (categoryLink) {
        currentCategory = categoryLink.text.trim();
      }
      continue;
    }

    // Product rows have 2 cells: name/link and stock status
    if (cells.length >= 2) {
      const link = cells[0].querySelector("a");
      if (!link) continue;

      const name = link.text.trim();
      const href = link.getAttribute("href") ?? "";
      const stockText = cells[1].text.trim();

      if (!name || !href) continue;

      // Build absolute URL — crawlme URLs are relative paths
      const url = href.startsWith("http") ? href : `${BASE_URL}${href}`;

      products[url] = {
        name,
        url,
        inStock: isInStock(stockText),
        category: currentCategory,
      };
    }
  }

  console.log(`Scraped ${Object.keys(products).length} products`);
  return products;
}