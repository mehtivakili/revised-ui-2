import { NextRequest, NextResponse } from "next/server";
import { getCatalogSnapshot } from "@/src/lib/catalog/repository";

export async function GET(request: NextRequest) {
  const snapshot = await getCatalogSnapshot();
  const category = request.nextUrl.searchParams.get("category");
  const brand = request.nextUrl.searchParams.get("brand");
  const search = request.nextUrl.searchParams.get("q")?.trim().toLocaleLowerCase("fa");
  const products = snapshot.products.filter((product) =>
    (!category || product.category === category) &&
    (!brand || product.brand === brand) &&
    (!search || `${product.name} ${product.sku} ${product.brand}`.toLocaleLowerCase("fa").includes(search))
  );
  return NextResponse.json({ products, total: products.length, dataMode: snapshot.dataMode, updatedAt: snapshot.updatedAt });
}
