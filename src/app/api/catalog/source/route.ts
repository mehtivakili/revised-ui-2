import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/src/lib/session";
import { getSourceCatalogPage } from "@/src/lib/catalog/source-repository";

export async function GET(request: NextRequest) {
  if (!(await getCurrentSession())) return NextResponse.json({ error: "برای مشاهده محصولات وارد حساب شوید." }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const result = await getSourceCatalogPage({
    page: Number(params.get("page") || 1),
    limit: Number(params.get("limit") || 24),
    search: params.get("q") || "",
    category: params.get("category") || "all",
    brand: params.get("brand") || "all",
    inStockOnly: params.get("inStock") !== "false"
  });
  return NextResponse.json(result);
}
