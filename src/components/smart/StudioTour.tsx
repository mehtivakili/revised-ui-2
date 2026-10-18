"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Cuboid,
  Eye,
  Flag,
  Layers,
  ListChecks,
  MousePointer2,
  PencilRuler,
  Settings2,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { StudioTourDemo, type StudioDemoId } from "@/src/components/smart/StudioTourDemos";

/**
 * Guided tour of the design studios.
 *
 * Each step spotlights one part of the screen and explains it together with every tool
 * inside it, so the user learns what a menu holds without having to open it. The tour
 * opens whenever a fresh design studio is started until the user ticks «دیگر نشان نده».
 * That lasting preference is kept in localStorage; the studio header's «راهنما» button
 * can still replay it at any time.
 */

export type StudioTourId = "design" | "cameras";

export interface StudioTourStep {
  /** Selectors of the parts to spotlight; several are lit as one box. None centres the card. */
  targets?: string[];
  icon: LucideIcon;
  title: string;
  body: string;
  items?: { label: string; text: string }[];
  /** An animated how-to played on the drawing canvas beside the card (inside it when there is no room). */
  demo?: StudioDemoId | StudioDemoId[];
  /** A toggle pressed while the step is shown, so a collapsed panel can be explained open. */
  reveal?: string;
}

/** Where demos play: the drawing canvas. */
const DEMO_STAGE = ".plan-canvas-wrap";

const STORAGE_PREFIX = "hamyar-studio-tour-v1:";
const faDigits = (value: number) => new Intl.NumberFormat("fa-IR").format(value);

/* Storage can be missing or throw (private windows, blocked site data); the tour then simply shows again. */
function readFlag(storage: () => Storage, key: string) {
  try { return storage().getItem(key) === "1"; } catch { return false; }
}
function writeFlag(storage: () => Storage, key: string, on: boolean) {
  try {
    if (on) storage().setItem(key, "1");
    else storage().removeItem(key);
  } catch { /* the choice just is not remembered */ }
}
const local = () => window.localStorage;

export function isStudioTourDismissed(id: StudioTourId) {
  return readFlag(local, STORAGE_PREFIX + id);
}

/**
 * Opens the tour for every newly-mounted design studio and exposes a manual replay.
 * Only the persistent «دیگر نشان نده» preference suppresses the automatic opening.
 */
export function useStudioTour(id: StudioTourId) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (isStudioTourDismissed(id)) return;
    // Let the designer (loaded on demand) lay out before measuring what to spotlight.
    const timer = window.setTimeout(() => setOpen(true), 700);
    return () => window.clearTimeout(timer);
  }, [id]);
  const start = useCallback(() => setOpen(true), []);
  const close = useCallback((dontShowAgain: boolean) => {
    writeFlag(local, STORAGE_PREFIX + id, dontShowAgain);
    setOpen(false);
  }, [id]);
  return { open, start, close };
}

export function StudioHelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="design-focus-help" onClick={onClick} title="مرور دوباره آموزش ابزارهای این صفحه">
      <CircleHelp size={16} aria-hidden="true" />
      <span>راهنما</span>
    </button>
  );
}

/* ── Tour content ─────────────────────────────────────────────────── */

export const studioTours: Record<StudioTourId, StudioTourStep[]> = {
  design: [
    {
      icon: Sparkles,
      title: "به استودیوی طراحی محیط خوش آمدید",
      body: "در این مرحله نقشه محیط پروژه را می‌سازید: طبقه‌ها، دیوارها، درها، فضاها و هر چیزی که جلوی دید دوربین را می‌گیرد. در چند قدم کوتاه همه بخش‌ها و زیرابزارهایشان را مرور می‌کنیم؛ لازم نیست منویی را باز کنید.",
      items: [
        { label: "این مرحله", text: "نقشه را بکشید یا تصویر و فایل CAD نقشه را زیر آن بگذارید و رویش ترسیم کنید." },
        { label: "مرحله بعد", text: "دوربین‌ها را از فهرست دوربین‌های آماده روی همین نقشه می‌چینید؛ تعداد را لازم نیست از قبل بگویید." },
        { label: "سپس", text: "با «ساخت گزارش» سه پلن پیشنهادی ساخته می‌شود؛ تنظیمات دقیق ضبط و زیرساخت اختیاری است." },
        { label: "نمایش متحرک", text: "در قدم‌های ترسیم، یک نمایش متحرک روی صفحه رسم نشان می‌دهد هر کار را دقیقاً چطور انجام دهید." },
        { label: "کلیدها", text: "با ← و → بین قدم‌ها بروید و با Esc راهنما را ببندید." }
      ]
    },
    {
      targets: [".plan-floor-rail"],
      icon: Layers,
      title: "طبقه‌ها",
      body: "هر طبقه نقشه جداگانه‌ای دارد و همه ابزارها روی «طبقه فعال» کار می‌کنند.",
      items: [
        { label: "طبقه فعال", text: "طبقه‌ای را که می‌خواهید ویرایش کنید انتخاب کنید؛ تعداد دوربین هر طبقه کنار نامش آمده است." },
        { label: "فلش‌ها", text: "طبقه قبلی و بعدی را باز می‌کنند." },
        { label: "طبقه جدید", text: "یک طبقه خالی روی آخرین طبقه اضافه می‌کند؛ مرز طبقه زیرین با خط قرمز دیده می‌شود." },
        { label: "تکرار نقشه قبلی", text: "طبقه جدیدی با همان دیوارها و چیدمان آخرین طبقه می‌سازد؛ برای طبقات تیپ مناسب است." },
        { label: "حذف طبقه", text: "طبقه فعال را حذف می‌کند." },
        { label: "ریست کل نقشه", text: "همه طبقه‌ها، دیوارها، تجهیزات، دوربین‌ها و تصویر زمینه را پاک می‌کند؛ نوع پروژه و چک‌لیست می‌ماند." }
      ]
    },
    {
      targets: [".plan-ribbon-drawing"],
      icon: PencilRuler,
      title: "ابزارهای ترسیم",
      body: "ابزار را انتخاب کنید و روی نقشه کلیک کنید. ابزارهای دارای فلش کوچک، با نگه‌داشتن نشانگر روی آن‌ها انواعشان را نشان می‌دهند. نمایش متحرک، کشیدن یک اتاق کامل با در و پنجره را قدم‌به‌قدم نشان می‌دهد.",
      demo: ["room", "space", "zone"],
      items: [
        { label: "انتخاب", text: "عناصر را انتخاب و با کشیدن جابه‌جا کنید؛ با Shift یا Ctrl چند عنصر را با هم انتخاب کنید." },
        { label: "دیوار", text: "پنج حالت دارد: دیوار خطی، مستطیل (چهار دیوار با دو کلیک)، جدار شیشه‌ای که دید را نمی‌بندد، حصار توری و دیوار محوطه." },
        { label: "در", text: "روی دیوار کلیک کنید: تک‌لنگه یا دولنگه، معمولی یا شیشه‌ای. روی حصار، همین ابزار ورودی (گیت) می‌سازد." },
        { label: "پنجره", text: "روی دیوار می‌نشیند و در محاسبه پوشش بسته فرض می‌شود؛ برای مرز شفاف از جدار شیشه‌ای استفاده کنید." },
        { label: "مانع", text: "با دو گوشه مقابل، یک حجم دلخواه مثل قفسه یا دستگاه بسازید." },
        { label: "فضا", text: "برای محوطه‌هایی که دیوار بسته ندارند، مرز فضا را دستی بکشید." },
        { label: "ناحیه اجباری", text: "محدوده‌ای که حتماً باید زیر پوشش باشد، مثل صندوق یا ورودی اصلی." },
        { label: "اندازه‌گیری", text: "با دو کلیک، فاصله دو نقطه را ببینید." },
        { label: "رنگ کف", text: "کف هر فضای بسته را سنگ، سرامیک، پارکت، موکت یا اپوکسی کنید: رنگ را از منو انتخاب کنید و داخل فضا کلیک کنید. از همان منو رنگ پیش‌فرض همه فضاها هم تعیین می‌شود." }
      ]
    },
    {
      targets: [".plan-ribbon-essentials"],
      icon: Cuboid,
      title: "عناصر آماده",
      body: "اشیای پرکاربرد با ابعاد واقعی. کلیک روی هر دسته آخرین مورد انتخاب‌شده را اضافه می‌کند؛ نشانگر را روی دسته نگه دارید تا همه انواع با ابعادشان را ببینید، یا مورد را مستقیم روی نقشه بکشید و رها کنید.",
      demo: "drag",
      items: [
        { label: "خودرو", text: "سواری، شاسی‌بلند، وانت، ون و کامیون برای پارکینگ و محوطه." },
        { label: "سازه", text: "راه‌پله، آسانسور، پله‌برقی، پاگرد نهایی و ستون سازه‌ای." },
        { label: "اتاق سرور", text: "رک، NVR، UPS، سوئیچ PoE و کنسول مانیتورینگ." },
        { label: "ستون", text: "ستون سازه‌ای؛ ابعاد و ارتفاعش بعداً قابل ویرایش است." },
        { label: "درخت", text: "پهن‌برگ، سوزنی‌برگ و نخل؛ تاج درخت در محوطه جلوی دید را می‌گیرد." }
      ]
    },
    {
      targets: [".plan-ribbon-view", ".plan-ribbon-settings", ".plan-history-actions"],
      icon: Settings2,
      title: "نمای نقشه و نمای سه‌بعدی",
      body: "بعد از آماده‌شدن پلان، روی «نمای سه‌بعدی» بزنید تا همان دیوارها، بازشوها، محدوده‌ها و تجهیزات را با حجم واقعی ببینید. نمایش متحرک، همین پلان نمونه را با رندر واقعی برنامه از نمای بالا به سه‌بعدی می‌برد.",
      demo: "three-dimensional",
      items: [
        { label: "نمای نقشه", text: "نمای دوبعدی از بالا، دقیق‌ترین حالت برای ترسیم." },
        { label: "نمای سه‌بعدی", text: "روی دکمه «نمای سه‌بعدی» بزنید؛ سپس روی صحنه بکشید تا نما بچرخد و با چرخ ماوس زوم کنید." },
        { label: "ساختمان", text: "همه طبقه‌ها روی هم؛ از پنل کناری یک طبقه را برجسته کنید یا محدوده طبقات نمایش‌داده‌شده را تغییر دهید." },
        { label: "محیط دینامیک", text: "آدم‌هایی که راه می‌روند، روی صندلی‌ها می‌نشینند، با هم صحبت می‌کنند و از وسایل استفاده می‌کنند، و خودروهایی که در جاده‌ها تردد دارند؛ فقط برای نمایش است و در طرح و محاسبات اثری ندارد." },
        { label: "مقیاس طراحی", text: "نقاط به شبکه ۱۰ سانتی‌متر تا ۱ متر می‌چسبند؛ «آزاد» یعنی بدون چسبندگی." },
        { label: "نقشه / CAD", text: "تصویر (PNG، JPG، WEBP) یا فایل DXF و DWG را زیر نقشه بگذارید؛ پهنا، شفافیت و محل آن از پنل کناری تنظیم می‌شود." },
        { label: "Undo / Redo", text: "برگرداندن و تکرار تغییرات؛ با Ctrl+Z و Ctrl+Y هم کار می‌کند." }
      ]
    },
    {
      targets: [".plan-advanced-switch", ".plan-element-strip.is-advanced"],
      reveal: ".plan-advanced-switch",
      icon: Shapes,
      title: "پیشرفته: المان‌های تخصصی",
      body: "کلید «پیشرفته» یک ردیف دیگر زیر نوار ابزار باز می‌کند با شانزده دسته عنصر تخصصی و تعداد کل المان‌ها؛ برای این قدم آن را برایتان باز کرده‌ایم. هر دسته مثل عناصر آماده کار می‌کند: نشانگر را رویش نگه دارید تا انواع با ابعاد واقعی باز شود، بعد کلیک کنید یا روی نقشه بکشید.",
      items: [
        { label: "خانه و اداره", text: "پذیرایی، خواب، آشپزخانه و اداری: مبل، تخت، کمد، یخچال، کابینت، میز کار، میز کنفرانس، کانتر پذیرش و پارتیشن." },
        { label: "فروشگاه و هتل", text: "قفسه و یخچال ویترینی، صندوق فروش، رگال، نشیمن لابی، جداکننده صف و دستگاه فروش." },
        { label: "درمانی، انتظامی و آموزشی", text: "تخت بیمارستانی، ایستگاه پرستاری، کانتر خدمت، نیمکت انتظار، تخت دوطبقه، میز دانش‌آموز، تخته کلاس و میز آزمایشگاه." },
        { label: "کارگاه و انبار", text: "دستگاه صنعتی، نوار نقاله، ایستگاه جوشکاری، قفسه انبار، پالت، کانتینر و سکوی بارگیری." },
        { label: "تأسیسات و حمل‌ونقل", text: "ترانسفورماتور، مخزن، ژنراتور، پمپ، خط لوله، ایستگاه شیر، پنل خورشیدی، اتوبوس و آمبولانس." },
        { label: "پارکینگ، محوطه و تجهیزات", text: "راهبند، اتاق نگهبانی، سرعت‌گیر، چمن، جاده، پرچین، حصار، دروازه، پایه دوربین و پایه روشنایی." },
        { label: "بستن", text: "با زدن دوباره «پیشرفته» ردیف بسته می‌شود؛ بعد از این قدم هم به حالت قبل برمی‌گردد." }
      ]
    },
    {
      targets: [".plan-venue-rail"],
      icon: ListChecks,
      title: "نوع پروژه و چک‌لیست فضاها",
      body: "بر اساس نوع پروژه، فضاهایی که باید دوربین داشته باشند به ترتیب اولویت فهرست می‌شوند و درصد تکمیل بالای فهرست است.",
      items: [
        { label: "حیاتی، مهم، اختیاری", text: "اولویت هر فضا؛ موارد حیاتی و مهم باید روی نقشه مشخص شوند." },
        { label: "تیک خوردن", text: "وقتی به یک فضای بسته نوع بدهید یا برایش ناحیه اجباری بکشید، آن مورد تیک می‌خورد. فهرست نوع‌ها روی خود فضا، موارد باقی‌مانده چک‌لیست را اول نشان می‌دهد." },
        { label: "تکمیل فضا", text: "اگر سه ضلع یک اتاق را کشیده باشید، با یک کلیک ضلع چهارم اضافه می‌شود." },
        { label: "طراحی ساده", text: "اگر بدون نوع پروژه شروع کرده‌اید، هر وقت خواستید نوع را از همین ستون انتخاب کنید." }
      ]
    },
    {
      targets: [".plan-canvas-wrap"],
      icon: MousePointer2,
      title: "کار با نقشه",
      body: "میدان اصلی طراحی. چند حرکت و میان‌بر، کار را بسیار سریع‌تر می‌کند؛ نمایش متحرک همه را پشت سر هم نشان می‌دهد.",
      demo: "edit",
      items: [
        { label: "زوم و جابه‌جایی", text: "با چرخ ماوس زوم کنید و با کلیک راست و کشیدن، نقشه را جابه‌جا کنید." },
        { label: "چرخش", text: "دستگیره نارنجی هر عنصر آن را می‌چرخاند؛ دستگیره بنفش کنار در، جهت بازشدن را عوض می‌کند." },
        { label: "کپی و حذف", text: "Ctrl+C، Ctrl+X و Ctrl+V برای کپی، برش و چسباندن در محل نشانگر؛ Delete برای حذف." },
        { label: "لغو", text: "Esc یا یک کلیک راست کوتاه، ترسیم نیمه‌کاره را لغو می‌کند." },
        { label: "نوع فضا", text: "روی هر فضا کلیک کنید تا همان‌جا فهرست کوتاهی از نوع‌ها باز شود؛ بنویسید تا جست‌وجو کند و با Enter انتخاب کنید. مرز قرمز یعنی فضا هنوز نوع ندارد." }
      ]
    },
    {
      targets: [".plan-workspace-sidebar"],
      icon: SlidersHorizontal,
      title: "پنل مشخصات",
      body: "هر چیزی را انتخاب کنید تا مشخصاتش اینجا ویرایش شود. وقتی چیزی انتخاب نشده، تنظیمات ابزار فعال، مثل ارتفاع و ضخامت دیوارهای جدید، نمایش داده می‌شود.",
      items: [
        { label: "دیوار", text: "طول، ارتفاع، ضخامت و نوع: دیوار ساختمان، جدار شیشه‌ای، حصار توری یا دیوار محوطه." },
        { label: "در و پنجره", text: "نوع، عرض، سمت لولا و جهت بازشدن نسبت به فضا." },
        { label: "مانع و تجهیزات", text: "نام، ابعاد، ارتفاع، چرخش و این‌که جلوی دید دوربین را می‌گیرد یا نه." },
        { label: "فضا", text: "نوع فضا (مثل لابی یا انبار) که چک‌لیست را تیک می‌زند، به‌همراه ارتفاع سقف و پیکربندی پیشنهادی دوربین؛ اگر نوع موردنظر نبود، نوع دلخواه بسازید." }
      ]
    },
    {
      targets: [".plan-statusbar", ".design-focus-footer"],
      icon: Flag,
      title: "نوار وضعیت و مرحله بعد",
      body: "پایین صفحه همیشه می‌گوید کجای کار هستید. هر وقت خواستید، دکمه «راهنما» بالای صفحه همین آموزش را دوباره باز می‌کند.",
      items: [
        { label: "راهنمای لحظه‌ای", text: "قدم بعدی ابزار فعال، مثل «گوشه مقابل مستطیل را انتخاب کنید»." },
        { label: "آمار طبقه", text: "مساحت و تعداد دیوار، در، مانع و دوربین طبقه فعال؛ مساحت وقتی محاسبه می‌شود که دیوارها یک محیط بسته بسازند." },
        { label: "مرحله بعد: جانمایی دوربین‌ها", text: "وقتی نقشه آماده شد، مستقیم به چیدن دوربین‌ها بروید؛ تغییرات نقشه حفظ می‌شود." }
      ]
    }
  ],
  cameras: [
    {
      icon: Camera,
      title: "استودیوی جانمایی دوربین",
      body: "دوربین‌ها را از فهرست «دوربین‌های آماده» بکشید و هرجا لازم است روی نقشه رها کنید. تعداد ثابتی در کار نیست؛ هر دوربین روی نقشه همان دوربین پروژه است. پوشش هر دوربین با سطوح DORI و با احتساب دیوارها و موانع محاسبه می‌شود."
    },
    {
      targets: [".camera-inventory"],
      icon: Camera,
      title: "دوربین‌های آماده",
      body: "هر نوع را هر چند بار که لازم است بکشید؛ عدد کنار هر نوع فقط می‌گوید چند عدد از آن روی نقشه است.",
      items: [
        { label: "مشخصات کوتاه", text: "رزولوشن، فاصله کانونی و نوع بدنه هر نوع زیر نامش آمده است." },
        { label: "ویرایش انواع", text: "با دکمه تنظیمات کنار عنوان، مشخصات هر نوع یا یک نوع تازه را تعریف کنید." },
        { label: "دوربین سفارشی", text: "دوربینی بدون نوع آماده که مشخصاتش را بعد از جانمایی تعیین می‌کنید." }
      ]
    },
    {
      targets: [".camera-assist"],
      icon: Sparkles,
      title: "پیشنهاد خودکار (آزمایشی)",
      body: "یک کمک اختیاری: نقشه و نوع فضاها را تحلیل می‌کند و چند دوربین پیشنهادی اضافه می‌کند. همه آن‌ها مثل دوربین‌های دستی جابه‌جا یا حذف می‌شوند.",
      items: [
        { label: "برگشت", text: "هر پیشنهاد یک مرحله Undo است؛ با Ctrl+Z برمی‌گردد." },
        { label: "پاک کردن", text: "دکمه کنارش همه دوربین‌های همه طبقه‌ها را پاک می‌کند." }
      ]
    },
    {
      targets: [".plan-ribbon"],
      icon: PencilRuler,
      title: "ابزارهای این مرحله",
      body: "در این مرحله نقشه قفل است و فقط دوربین‌ها و نواحی پوشش تغییر می‌کنند.",
      items: [
        { label: "انتخاب", text: "دوربین را انتخاب و جابه‌جا کنید." },
        { label: "ناحیه اجباری", text: "محدوده‌ای که حتماً باید زیر پوشش باشد؛ بهینه‌ساز آن را در اولویت قرار می‌دهد." },
        { label: "اندازه‌گیری", text: "فاصله دوربین تا هدف را بسنجید." },
        { label: "نمایش", text: "نمای نقشه، سه‌بعدی برای دیدن مخروط دید، و ساختمان برای مرور همه طبقه‌ها." }
      ]
    },
    {
      targets: [".plan-canvas-wrap"],
      icon: Eye,
      title: "جهت و پوشش دوربین",
      body: "رنگ‌های روی نقشه سطح جزئیات تصویر در هر نقطه است. نمایش متحرک، جانمایی و چرخاندن یک دوربین را نشان می‌دهد.",
      demo: "camera",
      items: [
        { label: "جابه‌جایی", text: "بدنه دوربین را بکشید." },
        { label: "چرخش", text: "دستگیره نارنجی را بکشید یا با کلیدهای [ و ] دوربین انتخاب‌شده را ۵ درجه بچرخانید." },
        { label: "پوشش DORI", text: "کلید «پوشش DORI» در نوار پایین، رنگ‌های پوشش را نشان می‌دهد یا پنهان می‌کند." }
      ]
    },
    {
      targets: [".plan-workspace-sidebar"],
      icon: SlidersHorizontal,
      title: "مشخصات دوربین",
      body: "با انتخاب هر دوربین، مشخصاتش اینجا تنظیم می‌شود و پوشش روی نقشه بلافاصله به‌روز می‌شود.",
      items: [
        { label: "هدف نظارتی", text: "پایش حضور، ثبت یا شناسایی چهره، ثبت پلاک یا ANPR؛ حداقل PPM لازم را تعیین می‌کند." },
        { label: "اپتیک", text: "رزولوشن، سنسور، فاصله کانونی و زاویه دید." },
        { label: "نصب", text: "ارتفاع نصب، زاویه چرخش و نصب در فضای باز." },
        { label: "قابلیت‌ها", text: "دید در شب رنگی، میکروفون داخلی و بدنه مقاوم." }
      ]
    },
    {
      targets: [".design-focus-footer"],
      icon: Flag,
      title: "گزارش یا تنظیمات دقیق",
      body: "نوار پایین تعداد دوربین‌های روی نقشه را نشان می‌دهد و اگر فضای مهمی هنوز دوربین ندارد یادآوری می‌کند. «ساخت گزارش» با تنظیمات پیش‌فرض، سه پلن پیشنهادی می‌سازد؛ «تنظیمات دقیق» مشخصات هر دوربین، ضبط و زیرساخت را باز می‌کند. دکمه «راهنما» بالای صفحه این آموزش را دوباره باز می‌کند."
    }
  ]
};

/* ── Spotlight and card ───────────────────────────────────────────── */

const SPOT_PADDING = 6;
const GAP = 14;
const GUTTER = 16;

interface Box { top: number; left: number; width: number; height: number }

/** The union of the step's visible targets, or null to centre the card. */
function measureTargets(selectors: string[] | undefined): Box | null {
  if (!selectors?.length) return null;
  const rects = selectors
    .map((selector) => document.querySelector(selector)?.getBoundingClientRect())
    .filter((rect): rect is DOMRect => Boolean(rect && rect.width * rect.height > 400));
  if (!rects.length) return null;
  const top = Math.min(...rects.map((rect) => rect.top));
  const left = Math.min(...rects.map((rect) => rect.left));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));
  const right = Math.max(...rects.map((rect) => rect.right));
  return {
    top: Math.max(0, top - SPOT_PADDING),
    left: Math.max(0, left - SPOT_PADDING),
    width: Math.min(window.innerWidth, right + SPOT_PADDING) - Math.max(0, left - SPOT_PADDING),
    height: Math.min(window.innerHeight, bottom + SPOT_PADDING) - Math.max(0, top - SPOT_PADDING)
  };
}

/** The dim layer as one even-odd path: the whole screen minus a rounded hole over the spotlight. */
function dimPath(spot: Box | null, width: number, height: number) {
  const screen = `M0 0H${width}V${height}H0Z`;
  if (!spot) return screen;
  const { left: x, top: y, width: w, height: h } = spot;
  const r = Math.min(14, w / 2, h / 2);
  return `${screen}M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`
    + `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
}

interface CardPlacement { top: number; left: number; maxHeight?: number }

/**
 * Beside the spotlight where the whole card fits (below, above, then either side); failing
 * that, shortened to scroll in the roomier of below and above; over the spotlight as a last resort.
 */
function placeCard(spot: Box | null, card: { width: number; height: number }): CardPlacement {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(GUTTER, x), vw - card.width - GUTTER);
  const clampY = (y: number) => Math.min(Math.max(GUTTER, y), vh - card.height - GUTTER);
  if (!spot) return { top: clampY((vh - card.height) / 2), left: clampX((vw - card.width) / 2) };
  const centreX = spot.left + spot.width / 2;
  const centreY = spot.top + spot.height / 2;
  const bottom = spot.top + spot.height;
  const right = spot.left + spot.width;
  if (bottom + GAP + card.height <= vh - GUTTER) return { top: bottom + GAP, left: clampX(centreX - card.width / 2) };
  if (spot.top - GAP - card.height >= GUTTER) return { top: spot.top - GAP - card.height, left: clampX(centreX - card.width / 2) };
  if (spot.left - GAP - card.width >= GUTTER) return { top: clampY(centreY - card.height / 2), left: spot.left - GAP - card.width };
  if (right + GAP + card.width <= vw - GUTTER) return { top: clampY(centreY - card.height / 2), left: right + GAP };
  const below = vh - GUTTER - (bottom + GAP);
  const above = spot.top - GAP - GUTTER;
  if (Math.max(below, above) >= 260) {
    return below >= above
      ? { top: bottom + GAP, left: clampX(centreX - card.width / 2), maxHeight: below }
      : { top: GUTTER, left: clampX(centreX - card.width / 2), maxHeight: above };
  }
  return { top: clampY(centreY - card.height / 2), left: clampX(centreX - card.width / 2) };
}

/**
 * For a step with a demo: the card at the side of the screen that hides less of the canvas,
 * clear of the spotlight, and the demo in the canvas space left beside it. A null demo box
 * means there is no room, and the demo plays inside the card instead.
 */
function placeWithDemo(spot: Box | null, card: { width: number; height: number }, stage: DOMRect) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const leftOverlap = Math.max(0, GUTTER + card.width + GAP - stage.left);
  const rightOverlap = Math.max(0, stage.right - (vw - GUTTER - card.width - GAP));
  const onRight = rightOverlap <= leftOverlap;
  const left = onRight ? vw - GUTTER - card.width : GUTTER;
  const spotOverCard = spot && spot.top + spot.height <= stage.top + 8 && spot.left < left + card.width && spot.left + spot.width > left;
  const top = Math.min(Math.max(GUTTER, spotOverCard ? spot.top + spot.height + GAP : stage.top), vh - card.height - GUTTER);

  const areaLeft = onRight ? stage.left : Math.max(stage.left, left + card.width + GAP);
  const areaRight = onRight ? Math.min(stage.right, left - GAP) : stage.right;
  const areaWidth = areaRight - areaLeft - 24;
  const areaHeight = stage.height - 24;
  // The scene keeps its 400 × 260 proportions; 84px holds the header and caption.
  const width = Math.min(areaWidth, 660, ((areaHeight - 84) * 400) / 260);
  if (width < 320) return { card: { top, left }, demo: null };
  const height = (width * 260) / 400 + 84;
  return {
    card: { top, left },
    demo: { left: areaLeft + 12 + (areaWidth - width) / 2, top: stage.top + 12 + (areaHeight - height) / 2, width, height }
  };
}

export function StudioTour({
  tourId,
  onClose
}: {
  tourId: StudioTourId;
  onClose: (dontShowAgain: boolean) => void;
}) {
  const steps = studioTours[tourId];
  const [index, setIndex] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(() => isStudioTourDismissed(tourId));
  const [spot, setSpot] = useState<Box | null>(null);
  const [screen, setScreen] = useState({ width: 0, height: 0 });
  const [cardPosition, setCardPosition] = useState<CardPlacement | null>(null);
  /* On a phone the card is a sheet, docked to whichever edge leaves the spotlight in view. */
  const [docked, setDocked] = useState<"top" | "bottom" | null>(null);
  /* Where this step's demo plays; tagged with the step so a stale layout is never used. */
  const [demoLayout, setDemoLayout] = useState<{ index: number; box: Box | null } | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const step = steps[index]!;
  const isLast = index === steps.length - 1;
  const Icon = step.icon;
  const demoReady = demoLayout?.index === index;
  const demoBox = demoReady ? demoLayout.box : null;
  // A step can play one demo or a short playlist of them.
  const demoList = step.demo === undefined ? [] : Array.isArray(step.demo) ? step.demo : [step.demo];

  const finish = useCallback(() => onClose(dontShowAgain), [dontShowAgain, onClose]);
  const go = useCallback((next: number) => setIndex(Math.min(Math.max(0, next), steps.length - 1)), [steps.length]);

  /* Measure the spotlight and place the card; repeated while the target is still loading. */
  const layout = useCallback(() => {
    const nextSpot = measureTargets(step.targets);
    setSpot(nextSpot);
    setScreen({ width: window.innerWidth, height: window.innerHeight });
    const isDocked = window.innerWidth < 640;
    const lowSpot = nextSpot && nextSpot.top + nextSpot.height / 2 > window.innerHeight / 2;
    setDocked(isDocked ? (lowSpot ? "top" : "bottom") : null);
    const card = cardRef.current;
    if (!card || isDocked) {
      setCardPosition(null);
      setDemoLayout({ index, box: null });
      return;
    }
    // The full height the card wants, even while it is shortened to scroll.
    const scroll = card.querySelector<HTMLElement>(".studio-tour-scroll");
    const wanted = card.offsetHeight - (scroll?.clientHeight ?? 0) + (scroll?.scrollHeight ?? 0);
    const size = { width: card.offsetWidth, height: Math.min(wanted, 620, window.innerHeight - 2 * GUTTER) };
    const stage = step.demo ? document.querySelector(DEMO_STAGE)?.getBoundingClientRect() : undefined;
    if (stage && stage.width > 0) {
      const placed = placeWithDemo(nextSpot, size, stage);
      setCardPosition(placed.card);
      setDemoLayout({ index, box: placed.demo });
      return;
    }
    setCardPosition(placeCard(nextSpot, size));
    setDemoLayout({ index, box: null });
  }, [index, step.demo, step.targets]);

  /* A revealed panel is closed again when the step ends, unless the user had it open already. */
  useEffect(() => {
    if (!step.reveal) return;
    const selector = step.reveal;
    const toggle = document.querySelector<HTMLElement>(selector);
    const opened = toggle?.getAttribute("aria-pressed") === "false";
    if (opened) toggle!.click();
    return () => {
      if (opened) document.querySelector<HTMLElement>(selector)?.click();
    };
  }, [step.reveal]);

  useEffect(() => {
    for (const selector of step.targets ?? []) {
      document.querySelector(selector)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
    // Measured on the next frame, after the scroll above has settled.
    const frame = window.requestAnimationFrame(layout);
    // The designer loads on demand, so a target can appear a moment after the tour opens.
    let tries = 0;
    const retry = window.setInterval(() => {
      tries += 1;
      layout();
      if (tries >= 10) window.clearInterval(retry);
    }, 150);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(retry);
    };
  }, [layout, step.targets]);

  useEffect(() => {
    const relayout = () => layout();
    window.addEventListener("resize", relayout);
    window.addEventListener("scroll", relayout, true);
    return () => {
      window.removeEventListener("resize", relayout);
      window.removeEventListener("scroll", relayout, true);
    };
  }, [layout]);

  /* Focus moves into the card and returns to where it was when the tour closes. */
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);
  // A card still hidden while it is being placed cannot take focus, so wait until it is shown.
  const shown = Boolean(cardPosition || docked);
  useEffect(() => {
    if (shown) cardRef.current?.focus();
  }, [index, shown]);

  /*
   * Captured at the window, ahead of the studio: no key reaches the designer's shortcuts
   * (Delete, Ctrl+Z, [ and ]) behind the tour. Stopping propagation keeps a key's default
   * action, so Enter and Space still press the card's own buttons.
   */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      event.stopImmediatePropagation();
      if (event.key === "Escape") finish();
      else if (event.key === "ArrowLeft") go(index + 1);
      else if (event.key === "ArrowRight") go(index - 1);
      else if (event.key === "Tab") {
        // Focus stays inside the card.
        const focusable = Array.from(cardRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input") ?? []);
        if (!focusable.length) return;
        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === cardRef.current)) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
        return;
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [finish, go, index]);

  return (
    <div className="studio-tour" dir="rtl">
      {/* Keeps the studio inert while the tour is open; the hole in the dim layer is only visual. */}
      <div className="studio-tour-blocker" aria-hidden="true" />
      <svg className="studio-tour-dim" aria-hidden="true">
        <path d={dimPath(spot, screen.width, screen.height)} fillRule="evenodd" />
      </svg>
      {spot ? (
        <div
          className="studio-tour-spotlight"
          aria-hidden="true"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
      ) : null}
      {step.demo && demoBox ? (
        <div
          key={`demo-${index}`}
          className="studio-tour-demo-frame"
          style={{ top: demoBox.top, left: demoBox.left, width: demoBox.width, height: demoBox.height }}
        >
          <StudioTourDemo demos={demoList} />
        </div>
      ) : null}
      <div
        key={index}
        ref={cardRef}
        className={docked ? `studio-tour-card is-docked is-docked-${docked}` : "studio-tour-card"}
        role="dialog"
        aria-modal="true"
        aria-labelledby="studio-tour-title"
        aria-describedby="studio-tour-body"
        tabIndex={-1}
        style={cardPosition ? { top: cardPosition.top, left: cardPosition.left, maxHeight: cardPosition.maxHeight } : docked ? undefined : { visibility: "hidden" }}
      >
        <header className="studio-tour-head">
          <span className="studio-tour-icon"><Icon size={19} aria-hidden="true" /></span>
          <small>راهنمای قدم‌به‌قدم · {faDigits(index + 1)} از {faDigits(steps.length)}</small>
          <button type="button" className="studio-tour-close" onClick={finish} aria-label="بستن راهنما" title="بستن (Esc)">
            <X size={16} aria-hidden="true" />
          </button>
        </header>
        <h2 id="studio-tour-title">{step.title}</h2>
        <div className="studio-tour-scroll">
          {step.demo && demoReady && !demoBox ? <StudioTourDemo demos={demoList} compact /> : null}
          <p id="studio-tour-body">{step.body}</p>
          {step.items?.length ? (
            <dl className="studio-tour-items">
              {step.items.map((item) => (
                <div key={item.label}>
                  <dt>{item.label}</dt>
                  <dd>{item.text}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <div className="studio-tour-progress" role="group" aria-label="قدم‌های راهنما">
          {steps.map((item, stepIndex) => (
            <button
              key={item.title}
              type="button"
              className={stepIndex === index ? "is-active" : stepIndex < index ? "is-done" : undefined}
              onClick={() => go(stepIndex)}
              aria-label={`قدم ${faDigits(stepIndex + 1)}: ${item.title}`}
              aria-current={stepIndex === index ? "step" : undefined}
            />
          ))}
        </div>
        <footer className="studio-tour-foot">
          <label className="studio-tour-dismiss">
            <input type="checkbox" checked={dontShowAgain} onChange={(event) => setDontShowAgain(event.target.checked)} />
            <span>دیگر نشان نده</span>
          </label>
          <div className="studio-tour-nav">
            <button type="button" className="studio-tour-back" onClick={() => go(index - 1)} disabled={index === 0}>
              <ChevronRight size={16} aria-hidden="true" />قبلی
            </button>
            <button type="button" className="studio-tour-next" onClick={isLast ? finish : () => go(index + 1)}>
              {isLast ? "پایان" : "بعدی"}
              {isLast ? null : <ChevronLeft size={16} aria-hidden="true" />}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
