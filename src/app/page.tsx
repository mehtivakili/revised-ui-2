import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Calculator, Camera, Check, ChevronLeft, Database, HardDrive, Network, ShieldCheck, Sparkles, WandSparkles, Zap } from "lucide-react";
import { getCurrentSession } from "@/src/lib/session";
import { getCatalogSnapshot } from "@/src/lib/catalog/repository";

const categoryCounts = [
  { id: "camera", label: "دوربین ساختاریافته", icon: Camera, tone: "blue" },
  { id: "recorder", label: "ضبط‌کننده سازگار", icon: HardDrive, tone: "violet" },
  { id: "switch", label: "تجهیزات شبکه", icon: Network, tone: "teal" },
] as const;

export default async function HomePage() {
  if (!(await getCurrentSession())) redirect("/login");
  const catalog = await getCatalogSnapshot();

  return (
    <main className="app-shell smart-home">
      <section className="smart-hero">
        <div className="smart-hero-copy">
          <span className="ai-kicker"><Sparkles size={16} />طراح هوشمند سیستم نظارت تصویری</span>
          <h1>از چند نیاز ساده،<br /><em>یک راهکار کامل</em> بسازید.</h1>
          <p>محیط، هدف نظارت و مدت آرشیو را مشخص کنید؛ همیار دوربین سازگاری فنی را بررسی می‌کند و سه سناریوی خرید قابل‌توضیح می‌سازد.</p>
          <div className="hero-actions">
            <Link className="primary-action large" href="/planner">شروع طراحی هوشمند<ArrowLeft size={18} /></Link>
            <Link className="secondary-action large" href="/catalog">مشاهده کاتالوگ<ChevronLeft size={18} /></Link>
          </div>
          <div className="hero-trust">
            <span><Check size={15} />کنترل سازگاری تجهیزات</span>
            <span><Check size={15} />برآورد هزینه و ظرفیت</span>
            <span><Check size={15} />دلیل انتخاب هر محصول</span>
          </div>
        </div>

        <div className="solution-preview" aria-label="نمونه راهکار پیشنهادی">
          <div className="preview-head"><div><span className="live-dot" /><small>تحلیل هوشمند تکمیل شد</small></div><strong>پلن متعادل</strong></div>
          <div className="preview-score"><span>نوع خروجی</span><strong>پیشنهاد<small> اولیه</small></strong></div>
          <div className="preview-metrics"><div><Camera size={18} /><span>دوربین</span><strong>۸ × ۵MP</strong></div><div><Database size={18} /><span>آرشیو</span><strong>۳۰ روز</strong></div><div><Zap size={18} /><span>PoE</span><strong>۱۶ پورت</strong></div></div>
          <div className="preview-products"><div><span>TC-C54KS</span><small>لنز وریفوکال، تشخیص انسان</small></div><div><span>TC-R3116</span><small>۱۶ کانال، H.265+</small></div><div><span>WD Purple 10TB</span><small>ضبط ۲۴/۷</small></div></div>
          <div className="preview-foot"><ShieldCheck size={18} /><span>قیود بررسی‌شده و موارد نیازمند بازبینی شفاف نمایش داده می‌شوند</span></div>
        </div>
      </section>

      <section className="smart-shortcuts">
        <div className="section-title"><div><p className="eyebrow">مسیرهای اصلی</p><h2>چطور می‌خواهید کار کنید؟</h2></div></div>
        <div className="shortcut-grid">
          <Link href="/planner" className="shortcut-card featured"><span className="shortcut-icon"><WandSparkles size={23} /></span><div><h3>طراحی خودکار پروژه</h3><p>با یک ویزارد کوتاه، دوربین، NVR، هارد، شبکه و UPS مناسب را یک‌جا دریافت کنید.</p></div><span className="shortcut-link">شروع طراحی<ChevronLeft size={15} /></span></Link>
          <Link href="/catalog" className="shortcut-card"><span className="shortcut-icon"><Database size={23} /></span><div><h3>جست‌وجوی هوشمند محصول</h3><p>محصولات را بر اساس مشخصات واقعی و قابل‌مقایسه مرور کنید.</p></div><span className="shortcut-link">ورود به کاتالوگ<ChevronLeft size={15} /></span></Link>
          <Link href="/calculators" className="shortcut-card"><span className="shortcut-icon"><Calculator size={23} /></span><div><h3>محاسبه‌گرهای مهندسی</h3><p>ظرفیت، DORI، لنز، شبکه و لینک وایرلس را مستقل محاسبه کنید.</p></div><span className="shortcut-link">همه ابزارها<ChevronLeft size={15} /></span></Link>
        </div>
      </section>

      <section className="catalog-snapshot">
        <div className="section-title"><div><p className="eyebrow">زیرساخت داده</p><h2>کاتالوگ آماده تصمیم‌گیری</h2><p>داده‌های نمایشی بر اساس دسته‌ها و الگوی مشخصات محصولات پرشیا سیستم ساختاریافته شده‌اند.</p></div><Link href="/catalog">مشاهده همه محصولات<ChevronLeft size={16} /></Link></div>
        <div className="snapshot-grid">
          {categoryCounts.map(({ id, label, icon: Icon, tone }) => (
            <article key={id}>
              <span className={`snapshot-icon ${tone}`}><Icon size={22} /></span>
              <div><strong>{new Intl.NumberFormat("fa-IR").format(catalog.products.filter((product) => product.category === id).length)}</strong><span>{label}</span></div>
              <small>آماده فیلتر و امتیازدهی</small>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
