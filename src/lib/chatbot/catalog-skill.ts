import type { ProductCategory, SourceCatalogPage, SourceCatalogProduct } from "@/src/domain/catalog/types";
import type { Answer } from "@/src/lib/chatbot/skills";
import { formatFa, formatToman, normalizePersian } from "@/src/lib/chatbot/persian";
import type { Slots } from "@/src/lib/chatbot/slots";

/**
 * Product, price and comparison answers.
 *
 * Everything here reads the local ddcpersia mirror through the app's own catalog API.
 * The assistant never invents a price: if the snapshot has no match it says so, and if
 * a product has no recorded price it reports that instead of guessing.
 */

export type CatalogProductRef = { name: string; price: number; sourceUrl: string };

const categoryWords: [RegExp, ProductCategory][] = [
  [/دوربین|کمرا|camera|بولت|دام|توربولت|ptz/, "camera"],
  [/nvr|dvr|xvr|دستگاه|ضبط|رکوردر|کاناله|کانال/, "recorder"],
  [/سوئیچ|سوییچ|switch|poe|پی ای|پورت/, "switch"],
  [/هارد|hdd|دیسک|storage|ترابایت|سرویلنس|purple|skyhawk/, "storage"],
  [/ups|یو پی اس|برق اضطراری|باتری/, "ups"]
];

/** Words that describe the question rather than the product being searched for. */
const stopWords = new Set([
  "قیمت", "قیمتش", "چند", "چنده", "هست", "هستش", "دارید", "داری", "میخوام", "می خوام", "لطفا",
  "بگو", "نشان", "نشون", "بده", "لیست", "موجود", "موجودی", "برای", "یک", "یه", "تا", "از", "با",
  "در", "به", "را", "رو", "و", "چه", "کدوم", "کدام", "بهترین", "ارزان", "ارزون", "گران", "گرون",
  "ترین", "محصول", "محصولات", "مدل", "خرید", "بخرم", "تومان", "تومن", "هزینه", "میشه", "است"
]);

function detectCategory(text: string): ProductCategory | undefined {
  for (const [pattern, category] of categoryWords) {
    if (pattern.test(text)) return category;
  }
  return undefined;
}

/** Keeps model numbers and brand-like tokens, drops the conversational filler. */
function buildSearchTerm(text: string): string {
  const tokens = normalizePersian(text)
    .split(" ")
    .filter((token) => token.length > 1 && !stopWords.has(token))
    .filter((token) => !/^\d+$/.test(token));

  const modelLike = tokens.filter((token) => /[a-z]/.test(token) && /[0-9\-]/.test(token));
  if (modelLike.length) return modelLike.slice(0, 2).join(" ");

  const latin = tokens.filter((token) => /^[a-z][a-z0-9\-]{2,}$/.test(token));
  if (latin.length) return latin.slice(0, 2).join(" ");

  return "";
}

async function fetchCatalog(params: Record<string, string>): Promise<SourceCatalogPage | null> {
  try {
    const query = new URLSearchParams({ page: "1", limit: "24", inStock: "true", ...params });
    const response = await fetch(`/api/catalog/source?${query}`, { cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as SourceCatalogPage;
  } catch {
    return null;
  }
}

const unavailable: Answer = {
  source: "catalog",
  title: "دسترسی به کاتالوگ ممکن نشد",
  lines: [
    "برای مشاهده محصولات و قیمت‌ها باید وارد حساب کاربری خود شوید.",
    "",
    "در همین حال می‌توانم در محاسبات پروژه و مشخصات فنی کمکتان کنم."
  ],
  tool: { slug: "__login__", label: "ورود به حساب کاربری" }
};

function productLine(product: SourceCatalogProduct) {
  const stock = product.stockStatus === "out_of_stock" ? "ناموجود" : product.stockStatus === "low_stock" ? "موجودی محدود" : "موجود";
  return `• **${product.name}** — ${formatToman(product.price)} — ${stock}${product.brand && product.brand !== "بدون برند" ? ` — ${product.brand}` : ""}`;
}

export async function productSearchSkill(slots: Slots): Promise<Answer> {
  const category = detectCategory(slots.text);
  const search = buildSearchTerm(slots.text);
  const page = await fetchCatalog({ q: search, category: category ?? "all" });
  if (!page) return unavailable;

  if (!page.products.length) {
    const broadened = search ? await fetchCatalog({ category: category ?? "all" }) : null;
    if (broadened?.products.length) {
      return {
        source: "catalog",
        title: "مورد دقیق پیدا نشد",
        lines: [
          `محصولی با عبارت «${search}» در کاتالوگ محلی نبود، اما این‌ها در همان دسته موجود هستند:`,
          "",
          ...broadened.products.slice(0, 6).map(productLine),
          "",
          `مجموع این دسته: **${formatFa(broadened.total)} محصول**`
        ],
        tool: { slug: "__catalog__", label: "مشاهده همه محصولات" }
      };
    }
    return {
      source: "catalog",
      title: "محصولی پیدا نشد",
      lines: [
        "در کاتالوگ محلی محصولی مطابق این جست‌وجو ثبت نشده است.",
        "",
        "می‌توانید نام مدل دقیق‌تر را بنویسید یا صفحه «محصولات» را برای دیدن فهرست کامل باز کنید."
      ],
      tool: { slug: "__catalog__", label: "مشاهده همه محصولات" }
    };
  }

  const shown = page.products.slice(0, 6);
  return {
    source: "catalog",
    title: search ? `نتایج جست‌وجوی «${search}»` : `محصولات موجود${category ? ` — ${categoryLabel(category)}` : ""}`,
    lines: [
      ...shown.map(productLine),
      "",
      `مجموع نتایج: **${formatFa(page.total)} محصول**${page.total > shown.length ? ` (${formatFa(shown.length)} مورد نمایش داده شد)` : ""}`
    ],
    assumptions: ["قیمت و موجودی از آخرین همگام‌سازی کاتالوگ محلی ddcpersia خوانده شده است"],
    tool: { slug: "__catalog__", label: "مشاهده همه محصولات" }
  };
}

export async function productPriceSkill(slots: Slots): Promise<Answer> {
  const category = detectCategory(slots.text);
  const search = buildSearchTerm(slots.text);
  const page = await fetchCatalog({ q: search, category: category ?? "all", limit: "48" });
  if (!page) return unavailable;

  const priced = page.products.filter((product) => product.price > 0);
  if (!priced.length) {
    return {
      source: "catalog",
      title: "قیمتی ثبت نشده است",
      lines: [
        page.products.length
          ? "محصول پیدا شد اما قیمتی برای آن در کاتالوگ درج نشده است."
          : "محصولی مطابق این جست‌وجو در کاتالوگ نیست.",
        "",
        "برای اطلاع از قیمت، صفحه محصول را ببینید یا با کارشناسان فروش تماس بگیرید."
      ],
      tool: { slug: "__catalog__", label: "مشاهده همه محصولات" }
    };
  }

  const sorted = [...priced].sort((a, b) => a.price - b.price);
  const cheapest = sorted[0];
  const dearest = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  const wantsCheapest = /ارزان|ارزون|کمترین|پایین ترین/.test(slots.text);
  const wantsDearest = /گران|گرون|بیشترین|بالاترین|بهترین/.test(slots.text);

  const lines: string[] = [];
  if (wantsCheapest) lines.push(`ارزان‌ترین گزینه: **${cheapest.name}** — ${formatToman(cheapest.price)}`);
  else if (wantsDearest) lines.push(`گران‌ترین گزینه: **${dearest.name}** — ${formatToman(dearest.price)}`);
  else lines.push(...sorted.slice(0, 5).map(productLine));

  lines.push("");
  lines.push(`بازه قیمت این دسته: از **${formatToman(cheapest.price)}** تا **${formatToman(dearest.price)}**`);
  lines.push(`قیمت میانه: **${formatToman(median.price)}** در میان ${formatFa(priced.length)} محصول قیمت‌دار`);

  if (slots.budgetToman) {
    const affordable = sorted.filter((product) => product.price <= slots.budgetToman!);
    lines.push("");
    lines.push(
      affordable.length
        ? `با بودجه ${formatToman(slots.budgetToman)}، **${formatFa(affordable.length)} محصول** از این دسته در دسترس است؛ گران‌ترین آن‌ها **${affordable[affordable.length - 1].name}** با ${formatToman(affordable[affordable.length - 1].price)} است.`
        : `با بودجه ${formatToman(slots.budgetToman)} هیچ محصولی در این دسته پیدا نشد؛ ارزان‌ترین گزینه ${formatToman(cheapest.price)} است.`
    );
  }

  return {
    source: "catalog",
    title: search ? `قیمت «${search}»` : `قیمت‌ها${category ? ` — ${categoryLabel(category)}` : ""}`,
    lines,
    assumptions: ["اعداد از آخرین همگام‌سازی کاتالوگ محلی ddcpersia است و ممکن است با قیمت لحظه‌ای فروشگاه تفاوت داشته باشد"],
    tool: { slug: "__catalog__", label: "مشاهده همه محصولات" }
  };
}

export async function productCompareSkill(slots: Slots): Promise<Answer> {
  const category = detectCategory(slots.text);
  const search = buildSearchTerm(slots.text);
  const page = await fetchCatalog({ q: search, category: category ?? "all", limit: "48" });
  if (!page) return unavailable;

  const candidates = page.products.filter((product) => product.price > 0).slice(0, 4);
  if (candidates.length < 2) {
    return {
      source: "catalog",
      title: "برای مقایسه به دو محصول نیاز دارم",
      lines: [
        "در کاتالوگ محلی کمتر از دو محصول قیمت‌دار مطابق این جست‌وجو پیدا شد.",
        "",
        "نام دو مدل مشخص را بنویسید، برای مثال: «مقایسه TC-C32 و TC-C34»."
      ],
      tool: { slug: "__catalog__", label: "مشاهده همه محصولات" }
    };
  }

  return {
    source: "catalog",
    title: "مقایسه محصولات کاتالوگ",
    lines: [
      ...candidates.map((product) => {
        const highlights = product.attributes
          .slice(0, 3)
          .map((attribute) => `${attribute.name}: ${attribute.options.join("، ")}`)
          .join(" | ");
        return `• **${product.name}** — ${formatToman(product.price)}${highlights ? `\n  ${highlights}` : ""}`;
      }),
      "",
      "معیارهای فنی مقایسه که فراتر از قیمت اهمیت دارند: رزولوشن و اندازه سنسور، دیافراگم لنز، True WDR، توان مصرفی اوج، درجه IP و IK، و کیفیت واقعی تحلیل هوش مصنوعی روی خود دوربین."
    ],
    tool: { slug: "__catalog__", label: "مشاهده همه محصولات" }
  };
}

function categoryLabel(category: ProductCategory) {
  const labels: Record<ProductCategory, string> = {
    camera: "دوربین",
    recorder: "دستگاه ضبط",
    switch: "سوئیچ PoE",
    storage: "ذخیره‌سازی",
    ups: "برق اضطراری"
  };
  return labels[category];
}
