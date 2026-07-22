import type { CatalogProduct, ProductCategory } from "@/src/domain/catalog/types";
import { query } from "@/src/lib/db";
import { mockCatalogUpdatedAt, mockProducts } from "@/src/lib/catalog/mock-products";

export type CatalogSnapshot = {
  products: CatalogProduct[];
  dataMode: "woocommerce-live" | "database-mock" | "mock-fallback";
  updatedAt: string;
};

const ALL_CATEGORIES: ProductCategory[] = ["camera", "recorder", "switch", "storage", "ups"];

function withMockFallbackForMissingCategories(products: CatalogProduct[]): CatalogProduct[] {
  const presentCategories = new Set(products.map((product) => product.category));
  const missingCategories = ALL_CATEGORIES.filter((category) => !presentCategories.has(category));
  if (!missingCategories.length) return products;
  const fallback = mockProducts.filter((product) => missingCategories.includes(product.category));
  return [...products, ...fallback];
}

export async function getCatalogSnapshot(): Promise<CatalogSnapshot> {
  try {
    const live = await query(
      `SELECT raw_payload, synced_at
       FROM catalog_products
       WHERE source = 'woocommerce'
       ORDER BY category, name`
    );
    if (live.rows.length > 0) {
      return {
        products: withMockFallbackForMissingCategories(live.rows.map((row) => row.raw_payload as CatalogProduct)),
        dataMode: "woocommerce-live",
        updatedAt: new Date(live.rows[0].synced_at).toISOString()
      };
    }
    const result = await query(
      `SELECT raw_payload, synced_at
       FROM catalog_products
       WHERE source = 'mock-ddcpersia'
       ORDER BY category, name`
    );
    if (result.rows.length > 0) {
      return {
        products: result.rows.map((row) => row.raw_payload as CatalogProduct),
        dataMode: "database-mock",
        updatedAt: new Date(result.rows[0].synced_at).toISOString()
      };
    }
  } catch {
    // First-run and offline development use the exact same typed fixture.
  }
  return { products: mockProducts, dataMode: "mock-fallback", updatedAt: mockCatalogUpdatedAt };
}
