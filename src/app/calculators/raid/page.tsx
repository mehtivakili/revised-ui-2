"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { CalculatorShell, NumberInput, ResultGrid, SelectInput, formatNumber } from "@/src/components/calculators/CalculatorUi";
import { calculateRaidUsable, type RaidLevel } from "@/src/lib/calculators/raid";
import type { DashboardTool } from "@/src/lib/dashboard";

const tool: DashboardTool = {
  slug: "raid",
  title: "ظرفیت RAID",
  subtitle: "فضای قابل استفاده",
  description: "محاسبه ظرفیت قابل استفاده برای RAID 0، 1، 5، 6 و 10 با اعتبارسنجی تعداد دیسک.",
  status: "ready",
  metric: "TB قابل استفاده",
  icon: "hard-drive"
};

const raidNotes: Record<Exclude<RaidLevel, "none">, string> = {
  "0": "RAID 0 افزونگی ندارد و خرابی یک دیسک باعث از دست رفتن داده می‌شود.",
  "1": "RAID 1 یک Mirror است و ظرفیت قابل استفاده آن، مستقل از تعداد اعضای Mirror، برابر کوچک‌ترین دیسک است.",
  "5": "RAID 5 ظرفیت یک دیسک را برای Parity مصرف می‌کند و حداقل سه دیسک لازم دارد.",
  "6": "RAID 6 ظرفیت دو دیسک را برای Parity مصرف می‌کند و حداقل چهار دیسک لازم دارد.",
  "10": "RAID 10 به حداقل چهار دیسک و تعداد زوج نیاز دارد و نیمی از ظرفیت قابل استفاده است."
};

export default function RaidPage() {
  const [disks, setDisks] = useState(4);
  const [size, setSize] = useState(4);
  const [level, setLevel] = useState<Exclude<RaidLevel, "none">>("5");
  const result = calculateRaidUsable(Array.from({ length: Math.max(0, Math.floor(disks)) }, () => size), level);

  return (
    <CalculatorShell tool={tool}>
      <div className="calc-form-grid">
        <NumberInput label="تعداد دیسک" value={disks} onChange={setDisks} min={1} />
        <NumberInput label="حجم هر دیسک" value={size} onChange={setSize} min={0.1} step={0.1} unit="TB" />
        <SelectInput label="سطح RAID" value={level} onChange={setLevel} options={["0", "1", "5", "6", "10"].map((value) => ({ label: `RAID ${value}`, value: value as Exclude<RaidLevel, "none"> }))} />
      </div>
      <ResultGrid results={[
        { label: "ظرفیت خام", value: formatNumber(result.rawTb, 2), unit: "TB" },
        { label: "ظرفیت قابل استفاده", value: formatNumber(result.usableTb, 2), unit: "TB" }
      ]} />
      <p className="calc-note">{result.reason || raidNotes[level]} محاسبه براساس کوچک‌ترین دیسک انجام می‌شود.</p>

      <article className="calculator-guide" aria-labelledby="raid-guide-title">
        <header className="calculator-guide-hero">
          <p className="eyebrow">راهنمای کاربردی محاسبات</p>
          <h2 id="raid-guide-title">ظرفیت قابل استفاده RAID چگونه محاسبه می‌شود؟</h2>
          <p>
            ظرفیت خام، مجموع فضای همه دیسک‌هاست؛ اما در RAID بخشی از این فضا برای Mirror یا Parity مصرف می‌شود. انتخاب سطح
            مناسب باید هم‌زمان نیاز پروژه به ظرفیت، تحمل خرابی و مدت نگهداری تصاویر دوربین مداربسته را پوشش دهد.
          </p>
        </header>

        <figure className="calculator-guide-media">
          <Image
            src="/images/guides/raid-storage-array.webp"
            alt="ذخیره‌ساز چهار دیسکی RAID در کنار دستگاه ضبط تصاویر دوربین مداربسته"
            width={1672}
            height={941}
            sizes="(max-width: 720px) 100vw, 1100px"
          />
          <figcaption>آرایه RAID ظرفیت چند دیسک را به یک فضای ذخیره‌سازی واحد برای NVR یا سرور ضبط تبدیل می‌کند.</figcaption>
        </figure>

        <section className="calculator-guide-section" aria-labelledby="raid-formula-title">
          <div className="calculator-guide-heading">
            <span>۰۱</span>
            <div>
              <p className="eyebrow">فرمول‌های اصلی</p>
              <h3 id="raid-formula-title">محاسبه ظرفیت RAID 0، 1، 5، 6 و 10</h3>
            </div>
          </div>
          <div className="formula-grid">
            <div className="formula-card">
              <strong>RAID 0 و ظرفیت خام</strong>
              <code dir="ltr">Usable = N × Smin</code>
              <p>تمام ظرفیت در دسترس است، اما هیچ افزونگی وجود ندارد و خرابی یک دیسک می‌تواند کل آرایه را از بین ببرد.</p>
            </div>
            <div className="formula-card">
              <strong>RAID 1</strong>
              <code dir="ltr">Usable = Smin</code>
              <p>اطلاعات روی دیسک‌ها Mirror می‌شود؛ در نتیجه ظرفیت قابل استفاده برابر کوچک‌ترین عضو آرایه است.</p>
            </div>
            <div className="formula-card">
              <strong>RAID 5 و RAID 6</strong>
              <code dir="ltr">RAID 5 = (N − 1) × Smin</code>
              <code dir="ltr">RAID 6 = (N − 2) × Smin</code>
              <p>در RAID 5 معادل یک دیسک و در RAID 6 معادل دو دیسک برای Parity کنار گذاشته می‌شود.</p>
            </div>
            <div className="formula-card">
              <strong>RAID 10</strong>
              <code dir="ltr">Usable = (N ÷ 2) × Smin</code>
              <p>تعداد دیسک باید زوج و حداقل چهار عدد باشد؛ نیمی از ظرفیت برای Mirror مصرف می‌شود.</p>
            </div>
          </div>
          <p className="calc-note">
            در فرمول‌ها <bdi>N</bdi> تعداد دیسک فعال و <bdi>Smin</bdi> ظرفیت کوچک‌ترین دیسک است. اگر ظرفیت دیسک‌ها متفاوت باشد،
            فضای اضافه دیسک‌های بزرگ‌تر در این محاسبه قابل استفاده نیست.
          </p>
        </section>

        <figure className="calculator-guide-media">
          <Image
            src="/images/guides/raid5-parity-distribution.webp"
            alt="نمای مفهومی توزیع داده و Parity میان چهار هارد در RAID 5"
            width={1672}
            height={941}
            sizes="(max-width: 720px) 100vw, 1100px"
          />
          <figcaption>در RAID 5 داده و Parity میان دیسک‌ها توزیع می‌شوند؛ مجموع سربار Parity معادل ظرفیت یک دیسک است.</figcaption>
        </figure>

        <section className="calculator-guide-section guide-example" aria-labelledby="raid-example-title">
          <div className="calculator-guide-heading">
            <span>۰۲</span>
            <div>
              <p className="eyebrow">مثال واقعی همین ابزار</p>
              <h3 id="raid-example-title">چهار دیسک 4 TB در RAID 5</h3>
            </div>
          </div>
          <div className="guide-example-layout">
            <div>
              <p>
                چهار هارد هم‌اندازه، در مجموع <bdi>16 TB</bdi> ظرفیت خام دارند. RAID 5 معادل ظرفیت یک هارد را برای Parity مصرف
                می‌کند؛ بنابراین سه هارد برای داده باقی می‌ماند و ظرفیت محاسباتی قابل استفاده <bdi>12 TB</bdi> خواهد بود.
              </p>
              <div className="guide-equation" dir="ltr">(4 drives − 1 parity drive) × 4 TB = 12 TB</div>
            </div>
            <div className="guide-table-wrap">
              <table>
                <thead>
                  <tr><th>ورودی یا خروجی</th><th>مقدار</th></tr>
                </thead>
                <tbody>
                  <tr><td>تعداد دیسک</td><td>۴</td></tr>
                  <tr><td>ظرفیت هر دیسک</td><td><bdi>4 TB</bdi></td></tr>
                  <tr><td>ظرفیت خام</td><td><bdi>16 TB</bdi></td></tr>
                  <tr><td>ظرفیت قابل استفاده</td><td><bdi>12 TB</bdi></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <section className="calculator-guide-section" aria-labelledby="raid-selection-title">
          <div className="calculator-guide-heading">
            <span>۰۳</span>
            <div>
              <p className="eyebrow">انتخاب سطح مناسب</p>
              <h3 id="raid-selection-title">پیش از ساخت آرایه چه چیزهایی را بررسی کنیم؟</h3>
            </div>
          </div>
          <ol className="guide-steps">
            <li><strong>هدف پروژه را مشخص کنید.</strong><span>حداکثر ظرفیت، تحمل خرابی یا تعادل میان ظرفیت و حفاظت از داده را اولویت‌بندی کنید.</span></li>
            <li><strong>تعداد دیسک را اعتبارسنجی کنید.</strong><span>RAID 5 حداقل سه، RAID 6 حداقل چهار و RAID 10 حداقل چهار دیسک با تعداد زوج می‌خواهد.</span></li>
            <li><strong>کوچک‌ترین دیسک را مبنا بگیرید.</strong><span>اختلاط ظرفیت‌های متفاوت معمولاً باعث بلااستفاده‌ماندن بخشی از دیسک‌های بزرگ‌تر می‌شود.</span></li>
            <li><strong>ظرفیت نهایی ضبط را دوباره بسنجید.</strong><span>خروجی RAID را در ابزار محاسبه ذخیره‌سازی وارد کنید تا مدت نگهداری واقعی پروژه مشخص شود.</span></li>
          </ol>
        </section>

        <section className="calculator-guide-section" aria-labelledby="raid-faq-title">
          <div className="calculator-guide-heading">
            <span>۰۴</span>
            <div>
              <p className="eyebrow">پرسش‌های متداول</p>
              <h3 id="raid-faq-title">نکات مهم ظرفیت و ایمنی RAID</h3>
            </div>
          </div>
          <div className="guide-faq">
            <details>
              <summary>آیا RAID جایگزین پشتیبان‌گیری است؟</summary>
              <p>خیر. RAID دسترس‌پذیری را هنگام خرابی بعضی دیسک‌ها افزایش می‌دهد، اما در برابر حذف اشتباه، خرابی دستگاه، بدافزار یا حادثه فیزیکی به‌تنهایی کافی نیست.</p>
            </details>
            <details>
              <summary>چرا فضای نمایش‌داده‌شده در NVR کمتر از محاسبه است؟</summary>
              <p>تفاوت واحدهای ده‌دهی و دودویی، فرمت فایل‌سیستم، متادیتا و فضای رزروشده دستگاه می‌تواند ظرفیت واقعی قابل مشاهده را کمی کاهش دهد.</p>
            </details>
            <details>
              <summary>برای ضبط دوربین RAID 5 بهتر است یا RAID 6؟</summary>
              <p>RAID 5 ظرفیت بیشتری می‌دهد و خرابی یک دیسک را تحمل می‌کند؛ RAID 6 ظرفیت کمتری دارد اما تحمل خرابی هم‌زمان دو دیسک را فراهم می‌کند. انتخاب به اهمیت آرشیو و تعداد دیسک‌ها بستگی دارد.</p>
            </details>
          </div>
        </section>

        <footer className="calculator-guide-footer">
          <div>
            <strong>گام بعدی طراحی آرشیو</strong>
            <p>ظرفیت قابل استفاده RAID را به مدت نگهداری و بیت‌ریت دوربین‌ها تبدیل کنید.</p>
          </div>
          <Link href="/calculators/capacity">محاسبه فضای ذخیره‌سازی</Link>
        </footer>
      </article>
    </CalculatorShell>
  );
}


