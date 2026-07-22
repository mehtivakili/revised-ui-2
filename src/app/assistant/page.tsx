import type { Metadata } from "next";
import { Calculator, Camera, Package, Ruler } from "lucide-react";
import { ChatPanel } from "@/src/components/chat/ChatPanel";

export const metadata: Metadata = {
  title: "دستیار فنی",
  description: "پاسخ به سوالات فنی دوربین مداربسته، محاسبات پروژه و انتخاب تجهیزات"
};

const capabilities = [
  {
    icon: Calculator,
    title: "محاسبات پروژه",
    text: "ظرفیت هارد و مدت آرشیو، پهنای باند شبکه، بودجه PoE، انتخاب UPS، ظرفیت RAID و آدرس‌دهی IP."
  },
  {
    icon: Ruler,
    title: "انتخاب لنز و پوشش",
    text: "فاصله کانونی، زاویه دید، فواصل DORI و تراکم پیکسل روی سوژه بر اساس استاندارد EN 62676-4."
  },
  {
    icon: Camera,
    title: "مشخصات فنی",
    text: "رزولوشن و سنسور، کدک‌ها، درجه حفاظت IP و IK، دید در شب، WDR، ONVIF، قابلیت‌های هوشمند و اصول نصب."
  },
  {
    icon: Package,
    title: "محصولات و قیمت",
    text: "جست‌وجو در کاتالوگ، بازه قیمت هر دسته و مقایسه مدل‌ها بر اساس مشخصات ثبت‌شده."
  }
];

export default function AssistantPage() {
  return (
    <main className="app-shell assistant-page">
      <section className="page-intro">
        <div>
          <p className="eyebrow">مشاور فنی همیار دوربین</p>
          <h1>دستیار فنی دوربین مداربسته</h1>
          <p>سوال فنی، محاسبه پروژه یا استعلام محصول را به زبان فارسی بپرسید. هر پاسخ محاسباتی، فرض‌های خود را شفاف اعلام می‌کند و به ابزار متناظر پیوند می‌دهد.</p>
        </div>
      </section>

      <div className="assistant-layout">
        <ChatPanel variant="page" />

        <aside className="assistant-aside">
          {capabilities.map((item) => (
            <article key={item.title}>
              <span><item.icon size={19} aria-hidden="true" /></span>
              <div>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </div>
            </article>
          ))}
        </aside>
      </div>
    </main>
  );
}
