export type DashboardTool = {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  status: "ready" | "planned";
  metric: string;
  icon: "database" | "radar" | "aperture" | "eye" | "hard-drive" | "network" | "router" | "wifi" | "radio" | "clock" | "activity" | "gauge" | "camera";
};

export type DashboardCategory = {
  id: "storage" | "lens" | "network" | "wireless";
  title: string;
  subtitle: string;
  icon: "network" | "camera" | "hard-drive" | "radio" | "gauge";
  tools: DashboardTool[];
};

export const dashboardCategories: DashboardCategory[] = [
  {
    id: "storage",
    title: "ذخیره‌سازی و ظرفیت",
    subtitle: "آرشیو ضبط، پهنای باند و برنامه‌ریزی دیسک",
    icon: "hard-drive",
    tools: [
      {
        slug: "capacity",
        title: "محاسبه ظرفیت ذخیره‌سازی",
        subtitle: "ذخیره‌سازی / پهنای باند",
        description: "برآورد بیت‌ریت کل، مدت نگهداری تصویر و فضای لازم بر اساس تعداد دوربین‌ها.",
        status: "ready",
        metric: "دوربین، Kbps، روز",
        icon: "database"
      },
      {
        slug: "raid",
        title: "ظرفیت RAID",
        subtitle: "فضای قابل استفاده",
        description: "محاسبه ظرفیت قابل استفاده برای RAID 0، 1، 5، 6 و 10 با اعتبارسنجی تعداد دیسک.",
        status: "ready",
        metric: "TB قابل استفاده",
        icon: "hard-drive"
      }
    ]
  },
  {
    id: "lens",
    title: "لنز و زاویه دید",
    subtitle: "انتخاب لنز، عرض صحنه، DORI و برنامه‌ریزی پوشش",
    icon: "camera",
    tools: [
      {
        slug: "dori",
        title: "فاصله DORI",
        subtitle: "تشخیص / شناسایی",
        description: "محاسبه فاصله‌های مشاهده، تشخیص، بازشناسی و شناسایی.",
        status: "ready",
        metric: "متر",
        icon: "radar"
      },
      {
        slug: "lens",
        title: "فاصله کانونی لنز",
        subtitle: "انتخاب لنز",
        description: "برآورد فاصله کانونی بر اساس عرض صحنه، فاصله دوربین و اندازه سنسور.",
        status: "ready",
        metric: "میلی‌متر",
        icon: "aperture"
      },
      {
        slug: "view-angle",
        title: "زاویه دید",
        subtitle: "FOV افقی",
        description: "محاسبه زاویه دید افقی از روی فاصله کانونی و عرض سنسور.",
        status: "ready",
        metric: "درجه",
        icon: "eye"
      },
      {
        slug: "planner",
        title: "میدان دید",
        subtitle: "میدان دید دوربین",
        description: "محاسبه زاویه دید، عرض صحنه، تراکم پیکسلی و فواصل دوربین بر اساس مشخصات حسگر و لنز.",
        status: "ready",
        metric: "FOV / PPM",
        icon: "camera"
      },
      {
        slug: "sensitivity",
        title: "مقایسه حساسیت",
        subtitle: "مقایسه نور کم",
        description: "مقایسه دو تنظیمات دوربین بر اساس عرض سنسور و عدد F.",
        status: "ready",
        metric: "نسبت / استاپ",
        icon: "gauge"
      },
      {
        slug: "lens-3d",
        title: "ماشین‌حساب لنز سه‌بعدی",
        subtitle: "شبیه‌ساز دوربین",
        description: "شبیه‌سازی سه‌بعدی میدان دید دوربین با نمایش نواحی DORI، تراکم پیکسلی و زاویه دید.",
        status: "ready",
        metric: "3D / DORI",
        icon: "camera"
      }
    ]
  },
  {
    id: "network",
    title: "شبکه و IP",
    subtitle: "رنج IPv4، جزئیات ساب‌نت و برنامه‌ریزی آدرس‌دهی",
    icon: "network",
    tools: [
      {
        slug: "ipv4",
        title: "پیشوند IPv4",
        subtitle: "اندازه پیشوند",
        description: "محاسبه تعداد کل آدرس‌ها و هاست‌های قابل استفاده برای یک پیشوند IPv4.",
        status: "ready",
        metric: "/CIDR",
        icon: "network"
      },
      {
        slug: "ip",
        title: "محاسبه‌گر ساب‌نت IP",
        subtitle: "جزئیات ساب‌نت",
        description: "نمایش شبکه، برادکست، وایلدکارت، نمایش باینری و نمونه ساب‌نت‌ها.",
        status: "ready",
        metric: "ماسک / هاست",
        icon: "router"
      }
    ]
  },
  {
    id: "wireless",
    title: "لینک‌های بی‌سیم",
    subtitle: "بودجه لینک، ناحیه فرنل، زمان ACK و تبدیل توان RF",
    icon: "radio",
    tools: [
      {
        slug: "wireless",
        title: "بودجه لینک بی‌سیم",
        subtitle: "بودجه لینک",
        description: "محاسبه افت مسیر فضای آزاد و توان دریافتی.",
        status: "ready",
        metric: "dBm / dB",
        icon: "wifi"
      },
      {
        slug: "fresnel",
        title: "ناحیه فرنل",
        subtitle: "شعاع پاک‌سازی",
        description: "محاسبه شعاع ناحیه فرنل اول در نقطه میانی لینک بی‌سیم.",
        status: "ready",
        metric: "متر",
        icon: "radio"
      },
      {
        slug: "ack",
        title: "زمان ACK",
        subtitle: "زمان‌بندی فاصله",
        description: "برآورد زمان رفت و برگشت تاییدیه بر اساس فاصله لینک.",
        status: "ready",
        metric: "میکروثانیه",
        icon: "clock"
      },
      {
        slug: "mw-dbm",
        title: "تبدیل mW و dBm",
        subtitle: "تبدیل توان",
        description: "تبدیل توان RF بین میلی‌وات و dBm.",
        status: "ready",
        metric: "mW / dBm",
        icon: "activity"
      }
    ]
  }
];

export const dashboardTools = dashboardCategories.flatMap((category) => category.tools);

export function getToolBySlug(slug: string) {
  return dashboardTools.find((tool) => tool.slug === slug);
}
