"use client";
/* Product images can originate from WooCommerce-configured CDN hosts before the local background cache finishes. */
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState } from "react";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, Database, ExternalLink, HardDrive, ImageOff, LoaderCircle, Search, Server, SlidersHorizontal, Zap } from "lucide-react";
import type { CameraSpecs, ProductCategory, RecorderSpecs, SourceCatalogPage, SourceCatalogProduct, StorageSpecs, SwitchSpecs, UpsSpecs } from "@/src/domain/catalog/types";

type CatalogCategory = "all" | ProductCategory | "other";
const categories: { value: CatalogCategory; label: string }[] = [
  { value: "all", label: "همه محصولات" }, { value: "camera", label: "دوربین" }, { value: "recorder", label: "ضبط‌کننده" }, { value: "switch", label: "سوئیچ PoE" }, { value: "storage", label: "ذخیره‌سازی" }, { value: "ups", label: "برق اضطراری" }, { value: "other", label: "سایر محصولات" }
];
const money = (value: number) => value > 0 ? `${new Intl.NumberFormat("fa-IR").format(value)} تومان` : "قیمت ثبت نشده";
/** Only absolute http(s) permalinks are safe to link out to; anything else stays plain text. */
const externalProductUrl = (value?: string) => (value && /^https?:\/\//i.test(value) ? value : null);

export function CatalogExplorer({ initialPage }: { initialPage: SourceCatalogPage }) {
  const [result, setResult] = useState(initialPage);
  const [category, setCategory] = useState<CatalogCategory>("all");
  const [brand, setBrand] = useState("all");
  const [query, setQuery] = useState("");
  const [inStockOnly, setInStockOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), limit: "24", category, brand, q: query, inStock: String(inStockOnly) });
        const response = await fetch(`/api/catalog/source?${params}`, { cache: "no-store", signal: controller.signal });
        if (response.ok) setResult(await response.json());
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }, query ? 280 : 0);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [page, category, brand, query, inStockOnly]);

  useEffect(() => {
    if (result.imageCache.queued + result.imageCache.downloading === 0) return;
    const interval = window.setInterval(async () => {
      const params = new URLSearchParams({ page: String(page), limit: "24", category, brand, q: query, inStock: String(inStockOnly) });
      const response = await fetch(`/api/catalog/source?${params}`, { cache: "no-store" });
      if (response.ok) setResult(await response.json());
    }, 15_000);
    return () => window.clearInterval(interval);
  }, [result.imageCache.queued, result.imageCache.downloading, page, category, brand, query, inStockOnly]);

  const updateCategory = (value: CatalogCategory) => { setCategory(value); setPage(1); };
  const imageTotal = result.imageCache.queued + result.imageCache.downloading + result.imageCache.completed + result.imageCache.failed;
  return <>
    <div className="catalog-toolbar">
      <label className="catalog-search"><Search size={18} /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="جست‌وجوی نام، مدل، برند یا SKU..." /></label>
      <label className="catalog-brand-filter"><span>برند</span><select value={brand} onChange={(event) => { setBrand(event.target.value); setPage(1); }}><option value="all">همه برندها</option>{result.facets.brands.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="stock-toggle"><input type="checkbox" checked={inStockOnly} onChange={(event) => { setInStockOnly(event.target.checked); setPage(1); }} /><span>فقط موجود</span></label>
    </div>
    <div className="category-filter"><SlidersHorizontal size={17} />{categories.map((item) => <button key={item.value} className={category === item.value ? "active" : ""} onClick={() => updateCategory(item.value)}>{item.label}{item.value !== "all" && result.facets.categoryCounts[item.value] !== undefined ? <small>{new Intl.NumberFormat("fa-IR").format(result.facets.categoryCounts[item.value])}</small> : null}</button>)}</div>
    <div className="catalog-list-status">
      <div><strong>{new Intl.NumberFormat("fa-IR").format(result.total)} محصول</strong><span>صفحه {new Intl.NumberFormat("fa-IR").format(result.page)} از {new Intl.NumberFormat("fa-IR").format(Math.max(1, result.totalPages))}</span></div>
      {imageTotal > 0 ? <div className="catalog-image-cache-status"><span><i style={{ width: `${Math.round(result.imageCache.completed / imageTotal * 100)}%` }} /></span><small>{new Intl.NumberFormat("fa-IR").format(result.imageCache.completed)} از {new Intl.NumberFormat("fa-IR").format(imageTotal)} تصویر در کش محلی</small></div> : null}
    </div>
    <div className={loading ? "catalog-grid is-loading" : "catalog-grid"}>{result.products.map((product) => <ProductCard key={product.id} product={product} />)}{loading ? <div className="catalog-loading"><LoaderCircle className="is-spinning" size={28} /><span>در حال دریافت محصولات...</span></div> : null}</div>
    {!loading && !result.products.length ? <div className="catalog-empty"><Search size={26} /><strong>محصولی با این فیلتر پیدا نشد</strong><span>فیلتر دسته، برند یا موجودی را تغییر دهید.</span></div> : null}
    {result.totalPages > 1 ? <nav className="catalog-pagination" aria-label="صفحه‌بندی محصولات"><button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronRight size={17} />قبلی</button><span>{new Intl.NumberFormat("fa-IR").format(page)} / {new Intl.NumberFormat("fa-IR").format(result.totalPages)}</span><button type="button" disabled={page >= result.totalPages || loading} onClick={() => setPage((value) => Math.min(result.totalPages, value + 1))}>بعدی<ChevronLeft size={17} /></button></nav> : null}
  </>;
}

function ProductCard({ product }: { product: SourceCatalogProduct }) {
  const [activeImage, setActiveImage] = useState(0);
  const Icon = product.category === "camera" ? Camera : product.category === "recorder" ? Server : product.category === "switch" ? Zap : product.category === "storage" ? HardDrive : Database;
  const currentImage = product.images[activeImage] || product.images[0];
  const productHref = externalProductUrl(product.sourceUrl);
  return <article className={productHref ? "catalog-card source-catalog-card is-linked" : "catalog-card source-catalog-card"}>
    <div className="catalog-card-top"><span className={`catalog-product-icon ${product.category}`}><Icon size={22} /></span><div><span className={product.stockStatus === "out_of_stock" ? "stock out" : product.stockStatus === "low_stock" ? "stock low" : "stock"}><CheckCircle2 size={13} />{product.stockStatus === "out_of_stock" ? "ناموجود" : product.stockStatus === "low_stock" ? "موجودی محدود" : "موجود"}</span><small>{product.brand}</small></div></div>
    <div className="catalog-gallery">
      <div className="catalog-main-image">
        {currentImage ? <img src={currentImage.url} alt={currentImage.alt || product.name} loading="lazy" decoding="async" /> : <div className="catalog-image-missing"><ImageOff size={30} /><span>تصویری در WooCommerce ثبت نشده</span></div>}
        {currentImage ? <span className={currentImage.cached ? "image-source-badge cached" : "image-source-badge"}>{currentImage.cached ? "کش محلی" : "در صف دریافت"}</span> : null}
      </div>
      {product.images.length > 1 ? <div className="catalog-thumbnails">{product.images.slice(0, 6).map((image, index) => <button type="button" className={activeImage === index ? "active" : ""} key={`${image.url}-${index}`} onClick={() => setActiveImage(index)} aria-label={`تصویر ${index + 1} از ${product.name}`}><img src={image.url} alt="" loading="lazy" /></button>)}</div> : null}
    </div>
    <div className="catalog-card-copy"><h2>{productHref ? <a className="catalog-card-link" href={productHref} target="_blank" rel="noreferrer">{product.name}</a> : product.name}</h2><p dir="ltr">{product.sku}</p>{product.wooCategories.length ? <small>{product.wooCategories.join(" · ")}</small> : null}</div>
    <div className="spec-chips">{getHighlights(product).map((value, index) => <span key={`${value}-${index}`}>{value}</span>)}</div>
    {product.attributes.length ? <details className="catalog-product-details"><summary>همه ویژگی‌ها ({new Intl.NumberFormat("fa-IR").format(product.attributes.length)})</summary><dl>{product.attributes.map((attribute, index) => <div key={`${attribute.name}-${index}`}><dt>{attribute.name}</dt><dd>{attribute.options.join("، ") || "—"}</dd></div>)}</dl></details> : null}
    <div className="catalog-card-foot"><div><small>{product.normalizationStatus === "unmapped" ? "قیمت WooCommerce" : "قیمت محصول"}</small><strong>{money(product.price)}</strong></div>{productHref ? <a className="catalog-card-cta" href={productHref} target="_blank" rel="noreferrer" aria-label={`مشاهده ${product.name} در ddcpersia`}><span>مشاهده در ddcpersia</span><ExternalLink size={14} aria-hidden="true" /></a> : null}</div>
  </article>;
}

function getHighlights(product: SourceCatalogProduct) {
  if (product.specs && product.category === "camera") { const s = product.specs as CameraSpecs; return [`${s.resolutionMp}MP`, `${s.focalMinMm}${s.focalMaxMm !== s.focalMinMm ? `–${s.focalMaxMm}` : ""}mm`, s.ipRating, s.codecs[0]]; }
  if (product.specs && product.category === "recorder") { const s = product.specs as RecorderSpecs; return [`${s.channels} کانال`, `${s.incomingBandwidthMbps}Mbps`, `${s.driveBays} Bay`, s.raidLevels[0] || "H.265+"]; }
  if (product.specs && product.category === "switch") { const s = product.specs as SwitchSpecs; return [`${s.poePorts} PoE`, `${s.poeBudgetW}W`, `${s.uplinkGbps}Gbps`, s.managed ? "مدیریتی" : "غیرمدیریتی"]; }
  if (product.specs && product.category === "storage") { const s = product.specs as StorageSpecs; return [`${s.capacityTb}TB`, "Surveillance", "24/7", `${s.warrantyMonths} ماه`]; }
  if (product.specs && product.category === "ups") { const s = product.specs as UpsSpecs; return [`${s.capacityVa}VA`, `${s.outputPowerW}W`, `${s.backupMinutesAtHalfLoad} دقیقه`, "UPS"]; }
  const attributes = product.attributes.flatMap((attribute) => attribute.options.slice(0, 1).map((option) => `${attribute.name}: ${option}`)).slice(0, 4);
  return attributes.length ? attributes : product.wooCategories.slice(0, 4);
}
