import type { Product } from "./types.js";

const WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL ?? "";

interface DiscordEmbed {
  title: string;
  url?: string;
  description?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
}

// Discord color constants
const COLOR_NEW = 0x00b0f4;      // Blue — new product
const COLOR_RESTOCK = 0x57f287;  // Green — back in stock

async function sendWebhook(embeds: DiscordEmbed[]): Promise<void> {
  if (!WEBHOOK_URL) {
    console.warn("DISCORD_WEBHOOK_URL not set — skipping notification");
    return;
  }

  // Discord allows max 10 embeds per message — chunk if needed
  for (let i = 0; i < embeds.length; i += 10) {
    const chunk = embeds.slice(i, i + 10);

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ embeds: chunk }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Discord webhook failed: ${response.status} — ${text}`);
    }

    // Respect Discord rate limit between chunks
    if (i + 10 < embeds.length) {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

export async function notifyNewProduct(product: Product): Promise<void> {
  await sendWebhook([
    {
      title: `🆕 New Product: ${product.name}`,
      url: product.url,
      color: COLOR_NEW,
      fields: [
        { name: "Category", value: product.category, inline: true },
        { name: "Status", value: "✅ In Stock", inline: true },
      ],
      footer: { text: "Games Island Monitor" },
    },
  ]);
}

export async function notifyRestocked(product: Product): Promise<void> {
  await sendWebhook([
    {
      title: `🔄 Back in Stock: ${product.name}`,
      url: product.url,
      color: COLOR_RESTOCK,
      fields: [
        { name: "Category", value: product.category, inline: true },
        { name: "Status", value: "✅ Available", inline: true },
      ],
      footer: { text: "Games Island Monitor" },
    },
  ]);
}

// Batched version — sends one message with multiple embeds when there are many changes
export async function notifyBatch(
  newProducts: Product[],
  restocked: Product[]
): Promise<void> {
  const embeds: DiscordEmbed[] = [];

  for (const p of newProducts) {
    embeds.push({
      title: `🆕 ${p.name}`,
      url: p.url,
      color: COLOR_NEW,
      fields: [{ name: "Category", value: p.category, inline: true }],
    });
  }

  for (const p of restocked) {
    embeds.push({
      title: `🔄 ${p.name}`,
      url: p.url,
      color: COLOR_RESTOCK,
      fields: [{ name: "Category", value: p.category, inline: true }],
    });
  }

  if (embeds.length === 0) return;

  await sendWebhook(embeds);
  console.log(
    `Notified: ${newProducts.length} new, ${restocked.length} restocked`
  );
}