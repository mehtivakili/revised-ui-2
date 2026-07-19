import type { CatalogProduct } from "@/src/domain/catalog/types";
import { query } from "@/src/lib/db";
import { mockCatalogUpdatedAt, mockProducts } from "@/src/lib/catalog/mock-products";

export type CatalogSnapshot = {
  products: CatalogProduct[];
  dataMode: "database-mock" | "mock-fallback";
  updatedAt: string;
};

export async function getCatalogSnapshot(): Promise<CatalogSnapshot> {
  try {
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
