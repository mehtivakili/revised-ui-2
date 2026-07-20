import { NextRequest, NextResponse } from "next/server";
import { query } from "@/src/lib/db";
import { getCurrentSession } from "@/src/lib/session";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (session?.role !== "admin") return NextResponse.json({ error: "دسترسی فقط برای مدیر مجاز است." }, { status: 403 });
  const page = Math.max(1, Number(request.nextUrl.searchParams.get("page") || 1));
  const limit = Math.min(100, Math.max(1, Number(request.nextUrl.searchParams.get("limit") || 25)));
  const search = (request.nextUrl.searchParams.get("q") || "").slice(0, 100);
  const mapping = request.nextUrl.searchParams.get("mapping") || "all";
  const values: unknown[] = [];
  const conditions = ["source.is_active=TRUE"];
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(source.name ILIKE $${values.length} OR source.sku ILIKE $${values.length} OR source.woo_id::text ILIKE $${values.length})`);
  }
  if (mapping === "mapped") conditions.push("normalized.id IS NOT NULL");
  if (mapping === "unmapped") conditions.push("normalized.id IS NULL");
  if (mapping === "estimated") conditions.push("normalized.normalization_status='estimated'");
  const where = conditions.join(" AND ");
  const count = await query(`SELECT COUNT(*)::int AS total FROM woocommerce_product_snapshots source LEFT JOIN catalog_products normalized ON normalized.woo_id=source.woo_id AND normalized.source='woocommerce' WHERE ${where}`, values);
  values.push(limit, (page - 1) * limit);
  const result = await query(`SELECT
      source.woo_id,source.sku,source.name,source.product_type,source.price,source.regular_price,source.sale_price,
      source.stock_status,source.stock_quantity,source.permalink,source.source_modified_at,source.last_seen_at,
      normalized.id AS normalized_product_id,normalized.category,normalized.normalization_status,normalized.normalization_warnings,
      normalized.raw_payload->'specs' AS normalized_specs,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('name',a.name,'slug',a.slug,'options',a.options) ORDER BY a.position) FROM woocommerce_product_attributes a WHERE a.woo_id=source.woo_id),'[]'::jsonb) AS attributes,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.woo_image_id,'src',i.src,'alt',i.alt) ORDER BY i.position) FROM woocommerce_product_images i WHERE i.woo_id=source.woo_id),'[]'::jsonb) AS images,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',c.woo_category_id,'name',c.name,'slug',c.slug)) FROM woocommerce_product_categories c WHERE c.woo_id=source.woo_id),'[]'::jsonb) AS categories,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',t.woo_tag_id,'name',t.name,'slug',t.slug)) FROM woocommerce_product_tags t WHERE t.woo_id=source.woo_id),'[]'::jsonb) AS tags
    FROM woocommerce_product_snapshots source
    LEFT JOIN catalog_products normalized ON normalized.woo_id=source.woo_id AND normalized.source='woocommerce'
    WHERE ${where}
    ORDER BY source.source_modified_at DESC NULLS LAST,source.name
    LIMIT $${values.length - 1} OFFSET $${values.length}`, values);
  const total = Number(count.rows[0]?.total || 0);
  return NextResponse.json({ products: result.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
}
