"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { Camera, CheckCircle2, Database, ExternalLink, HardDrive, Search, Server, SlidersHorizontal, Zap } from "lucide-react";
import type { CameraSpecs, CatalogProduct, ProductCategory, RecorderSpecs, StorageSpecs, SwitchSpecs, UpsSpecs } from "@/src/domain/catalog/types";

const categories: { value: "all" | ProductCategory; label: string }[] = [
  { value: "all", label: "همه محصولات" }, { value: "camera", label: "دوربین" }, { value: "recorder", label: "ضبط‌کننده" }, { value: "switch", label: "سوئیچ PoE" }, { value: "storage", label: "ذخیره‌سازی" }, { value: "ups", label: "برق اضطراری" }
];

const money = (value: number) => `${new Intl.NumberFormat("fa-IR").format(value)} تومان`;

export function CatalogExplorer({ products }: { products: CatalogProduct[] }) {
  const [category, setCategory] = useState<"all" | ProductCategory>("all");
  const [brand, setBrand] = useState("all");
  const [query, setQuery] = useState("");
  const [inStockOnly, setInStockOnly] = useState(true);
  const brands = useMemo(() => Array.from(new Set(products.map((product) => product.brand))).sort(), [products]);
  const filtered = useMemo(() => products.filter((product) =>
    (category === "all" || product.category === category) &&
    (brand === "all" || product.brand === brand) &&
    (!inStockOnly || product.stockStatus !== "out_of_stock") &&
    (!query.trim() || `${product.name} ${product.sku} ${product.brand}`.toLocaleLowerCase("fa").includes(query.trim().toLocaleLowerCase("fa")))
  ), [products, category, brand, query, inStockOnly]);

  return <>
    <div className="catalog-toolbar">
      <label className="catalog-search"><Search size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جست‌وجوی مدل، برند یا SKU..." /></label>
      <label className="catalog-brand-filter"><span>برند</span><select value={brand} onChange={(event) => setBrand(event.target.value)}><option value="all">همه برندها</option>{brands.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      <label className="stock-toggle"><input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} /><span>فقط موجود</span></label>
    </div>
    <div className="category-filter"><SlidersHorizontal size={17} />{categories.map((item) => <button key={item.value} className={category === item.value ? "active" : ""} onClick={() => setCategory(item.value)}>{item.label}</button>)}</div>
    <div className="catalog-count">نمایش {new Intl.NumberFormat("fa-IR").format(filtered.length)} محصول ساختاریافته</div>
    <div className="catalog-grid">{filtered.map((product) => <ProductCard key={product.id} product={product} />)}</div>
  </>;
}

function ProductCard({ product }: { product: CatalogProduct }) {
  const [activeImage, setActiveImage] = useState(0);
  const Icon = product.category === "camera" ? Camera : product.category === "recorder" ? Server : product.category === "switch" ? Zap : product.category === "storage" ? HardDrive : Database;
  return <article className="catalog-card">
    <div className="catalog-card-top"><span className={`catalog-product-icon ${product.category}`}><Icon size={22} /></span><div><span className={product.stockStatus === "low_stock" ? "stock low" : "stock"}><CheckCircle2 size={13} />{product.stockStatus === "low_stock" ? "موجودی محدود" : "موجود"}</span><small>{product.brand}</small></div></div>
    {product.images?.length ? <div className="catalog-gallery">
      <div className="catalog-main-image">
        <Image src={product.images[activeImage]?.url || product.images[0].url} alt={product.images[activeImage]?.alt || product.name} fill sizes="(max-width: 680px) 90vw, (max-width: 980px) 45vw, 30vw" />
        <span className={`image-source-badge ${product.images[activeImage]?.source === "ai-generated" ? "ai" : ""}`}>{product.images[activeImage]?.source === "ai-generated" ? "تصویر مفهومی AI" : "تصویر ddcpersia"}</span>
      </div>
      {product.images.length > 1 && <div className="catalog-thumbnails">{product.images.map((image, index) => <button type="button" className={activeImage === index ? "active" : ""} key={`${image.url}-${index}`} onClick={() => setActiveImage(index)} aria-label={`تصویر ${index + 1} از ${product.name}`}><Image src={image.url} alt="" fill sizes="44px" /></button>)}</div>}
    </div> : null}
    <div className="catalog-card-copy"><h2>{product.name}</h2><p dir="ltr">{product.sku}</p></div>
    <div className="spec-chips">{getHighlights(product).map((value) => <span key={value}>{value}</span>)}</div>
    <div className="catalog-card-foot"><div><small>قیمت نمایشی</small><strong>{money(product.price)}</strong></div><a href={product.sourceUrl} target="_blank" rel="noreferrer" aria-label="مشاهده منبع محصول"><ExternalLink size={17} /></a></div>
  </article>;
}

function getHighlights(product: CatalogProduct) {
  if (product.category === "camera") { const s = product.specs as CameraSpecs; return [`${s.resolutionMp}MP`, `${s.focalMinMm}${s.focalMaxMm !== s.focalMinMm ? `–${s.focalMaxMm}` : ""}mm`, s.ipRating, s.codecs[0]]; }
  if (product.category === "recorder") { const s = product.specs as RecorderSpecs; return [`${s.channels} کانال`, `${s.incomingBandwidthMbps}Mbps`, `${s.driveBays} Bay`, s.raidLevels[0] || "H.265+"]; }
  if (product.category === "switch") { const s = product.specs as SwitchSpecs; return [`${s.poePorts} PoE`, `${s.poeBudgetW}W`, `${s.uplinkGbps}Gbps`, s.managed ? "مدیریتی" : "غیرمدیریتی"]; }
  if (product.category === "storage") { const s = product.specs as StorageSpecs; return [`${s.capacityTb}TB`, "Surveillance", "24/7", `${s.warrantyMonths} ماه`]; }
  const s = product.specs as UpsSpecs; return [`${s.capacityVa}VA`, `${s.outputPowerW}W`, `${s.backupMinutesAtHalfLoad} دقیقه`, "Online"];
}
