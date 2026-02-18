export interface Product {
  name: string;
  url: string;
  inStock: boolean;
  category: string;
}

// Keyed by product URL for fast lookup
export type ProductMap = Record<string, Product>;