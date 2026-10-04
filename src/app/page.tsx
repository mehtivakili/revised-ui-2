import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  Camera,
  FileText,
  LayoutGrid,
  ScanEye,
  WandSparkles,
} from "lucide-react";
import { dashboardCategories } from "@/src/lib/dashboard";
import { venueTypes } from "@/src/domain/planner/venues";

const formatFa = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

// Counts come from the live catalogues so the pitch never drifts from what the app offers.
const toolCount = dashboardCategories.reduce((sum, category) => sum + category.tools.length, 0);
const venueCount = venueTypes.length;

const highlights = [
  { icon: Calculator, title: `${formatFa(toolCount)} ابزار محاسباتی`, text: "ذخیره‌سازی، شبکه، لینک بی‌سیم و لنز" },
  { icon: LayoutGrid, title: `${formatFa(venueCount)} نوع کاربری`, text: "با چیدمان و اولویت‌های اختصاصی هر محیط" },
  { icon: ScanEye, title: "تحلیل پوشش دید", text: "جانمایی روی پلان و کشف نقاط کور" },
  { icon: FileText, title: "گزارش مهندسی", text: "خروجی PDF آماده ارائه به کارفرما" },
];

export default function HomePage() {
  return (
    <main className="landing-page portal-home">
      <header className="portal-intro">
        <h1>طراحی و محاسبه سیستم‌های نظارت تصویری، <span>دقیق و حرفه‌ای</span></h1>
        <p>
          همیار دوربین همراه تخصصی مهندسان، مجریان و فروشندگان سیستم‌های امنیتی است؛ از محاسبات سریع شبکه و ذخیره‌سازی
          تا طراحی کامل پروژه روی پلان واقعی. دوربین‌ها را جانمایی کنید، پوشش و نقاط کور را ببینید، تجهیزات و ظرفیت را
          برآورد کنید و گزارشی مهندسی و قابل دفاع به کارفرما تحویل دهید؛ همه در یک محیط و در چند دقیقه.
        </p>
        <ul className="portal-highlights" aria-label="قابلیت‌های همیار دوربین">
          {highlights.map(({ icon: Icon, title, text }) => (
            <li key={title}>
              <span><Icon size={18} aria-hidden="true" /></span>
              <div><strong>{title}</strong><small>{text}</small></div>
            </li>
          ))}
        </ul>
      </header>

      <div className="portal-section-title">
        <h2>مسیر کاری خود را انتخاب کنید</h2>
        <p>محاسبات سریع مهندسی یا طراحی کامل یک پروژه؛ هر دو مسیر با ابزارهای تخصصی در دسترس شماست.</p>
      </div>

      <section className="portal-grid" aria-label="انتخاب بخش همیار دوربین">
        <article className="portal-card portal-card-tools">
          <Link className="portal-visual" href="/calculators" aria-label="ورود به ابزارهای محاسباتی">
            <Image
              src="/images/شبکه و ابزارهای محاسباتی.png"
              alt="نمای ابزارهای محاسبات شبکه و دوربین"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 520px"
            />
            <div className="portal-image-shade" />
            <span className="portal-floating-badge portal-floating-top"><Calculator size={15} />بدون نیاز به ورود</span>
          </Link>

          <div className="portal-card-body">
            <div className="portal-card-heading">
              <span className="portal-card-icon"><Calculator size={24} /></span>
              <div><small>جعبه‌ابزار رایگان</small><h2>ابزارهای محاسباتی</h2></div>
            </div>
            <p>محاسبه دقیق ظرفیت هارد، RAID، زاویه دید، DORI، زیرشبکه، Fresnel و بودجه لینک؛ سریع و بدون ساخت حساب.</p>
            <Link className="portal-main-cta" href="/calculators">
              مشاهده همه ابزارها <ArrowLeft size={18} />
            </Link>
          </div>
        </article>

        <article className="portal-card portal-card-smart">
          <Link className="portal-visual" href="/planner" aria-label="ورود به طراحی هوشمند">
            <Image
              src="/images/Futuristic Isometric CCTV Store Diorama.png"
              alt="نمای طراحی هوشمند جانمایی دوربین در فروشگاه"
              fill
              priority
              sizes="(max-width: 900px) 100vw, 520px"
            />
            <div className="portal-image-shade" />
            <span className="portal-floating-badge portal-floating-top"><WandSparkles size={15} />طراحی مبتنی بر پلان</span>
          </Link>

          <div className="portal-card-body">
            <div className="portal-card-heading">
              <span className="portal-card-icon"><Camera size={24} /></span>
              <div><small>استودیوی طراحی پروژه</small><h2>طراحی هوشمند</h2></div>
            </div>
            <p>پلان را بسازید، دوربین‌ها را جانمایی کنید، نقاط کور را ببینید و پیشنهاد کامل تجهیزات و ظرفیت را دریافت کنید.</p>
            <Link className="portal-main-cta" href="/planner">
              ورود به طراحی هوشمند <ArrowLeft size={18} />
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
