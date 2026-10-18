import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Calculator,
  Camera,
} from "lucide-react";
import type { Metadata } from "next";
import { pageMetadata } from "@/src/lib/seo";

export const metadata: Metadata = pageMetadata("/", "همیار دوربین — طراحی و محاسبه سیستم‌های نظارت تصویری", "طراحی هوشمند پروژه‌های دوربین مداربسته روی نقشه، جانمایی دوربین و ابزارهای رایگان محاسبه ذخیره‌سازی، لنز، DORI، شبکه و لینک بی‌سیم.", { absoluteTitle: true });

export default function HomePage() {
  return (
    <main className="landing-page portal-home">
      <header className="portal-intro">
        <h1>طراحی و محاسبه سیستم‌های نظارت تصویری، <span>دقیق و حرفه‌ای</span></h1>
        <p>
          محاسبات فنی و طراحی پروژه‌های نظارت تصویری را در یک محیط انجام دهید.
        </p>
      </header>

      <div className="portal-section-title">
        <h2>مسیر کاری خود را انتخاب کنید</h2>
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
          </Link>

          <div className="portal-card-body">
            <div className="portal-card-heading">
              <span className="portal-card-icon"><Calculator size={24} /></span>
              <div><h2>ابزارهای محاسباتی</h2></div>
            </div>
            <p>محاسبه ظرفیت ذخیره‌سازی، شبکه، زاویه دید و لینک بی‌سیم.</p>
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
          </Link>

          <div className="portal-card-body">
            <div className="portal-card-heading">
              <span className="portal-card-icon"><Camera size={24} /></span>
              <div><h2>طراحی هوشمند</h2></div>
            </div>
            <p>پلان را بسازید، دوربین‌ها را جانمایی کنید و پوشش تصویر را ببینید.</p>
            <Link className="portal-main-cta" href="/planner">
              ورود به طراحی هوشمند <ArrowLeft size={18} />
            </Link>
          </div>
        </article>
      </section>
    </main>
  );
}
