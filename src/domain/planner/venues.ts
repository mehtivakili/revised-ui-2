import type { SurveillanceTask } from "@/src/domain/catalog/types";

/**
 * Venue taxonomy for the smart designer.
 *
 * A project has one venue type, and every space drawn on the plan carries a section
 * type belonging to it. Everything the placement engine needs to choose a camera —
 * where the space sits, how badly it needs watching, what the image has to resolve —
 * hangs off the section type rather than off geometry, so the rules stay declarative
 * and a new venue is a data change rather than a code change.
 */

export type VenueTypeId =
  | "residential"
  | "shop"
  | "supermarket"
  | "jewellery"
  | "office"
  | "industrial"
  | "parking"
  | "restaurant"
  | "school"
  | "hospital"
  | "hotel"
  | "fuel"
  | "apartment"
  | "farm"
  | "urban-road"
  | "highway"
  | "construction"
  | "conference"
  | "car-showroom"
  | "bus-station"
  | "transit-fleet"
  | "control-room"
  | "substation"
  | "warehouse"
  | "mall"
  | "pipeline"
  | "transmission-line"
  | "onshore-oil"
  | "offshore-oil"
  | "solar-farm"
  | "hydro-plant"
  | "safe-city"
  | "sports-complex"
  | "data-centre"
  | "airport"
  | "port"
  | "railway"
  | "mine"
  | "water-plant";

/**
 * Where a space sits, which is what actually drives housing and mount height.
 *
 * A corridor is split out from a plain room because it is watched along its length
 * rather than across its area, and a perimeter is split from general outdoor space
 * because it is a line to be crossed rather than an area to be observed.
 */
export type SectionEnvironment =
  | "indoor-room"
  | "indoor-corridor"
  | "outdoor"
  | "parking"
  | "perimeter";

export type SectionPriority = "critical" | "important" | "optional";

/**
 * Processing that has to run on the camera itself.
 *
 * Deliberately separate from `goal`: an entrance needs an image good enough to show a
 * face without needing face-recognition hardware, and conflating the two is what makes
 * naive designs quote an expensive analytics camera on every door.
 */
export type CameraFeature =
  | "anpr"
  | "human-vehicle"
  | "face-search"
  | "people-count"
  | "continuous-record"
  | "audio"
  | "thermal";

export const cameraFeatureLabels: Record<CameraFeature, string> = {
  anpr: "پلاک‌خوانی",
  "human-vehicle": "تفکیک انسان و خودرو",
  "face-search": "جست‌وجوی چهره",
  "people-count": "شمارش نفرات",
  "continuous-record": "ضبط دائم",
  audio: "صدا",
  thermal: "حرارتی"
};

export const sectionEnvironmentLabels: Record<SectionEnvironment, string> = {
  "indoor-room": "اتاق داخلی",
  "indoor-corridor": "راهروی داخلی",
  outdoor: "فضای باز",
  parking: "پارکینگ",
  perimeter: "پیرامون"
};

export const sectionPriorityLabels: Record<SectionPriority, string> = {
  critical: "حیاتی",
  important: "مهم",
  optional: "تکمیلی"
};

export const surveillanceGoalLabels: Record<SurveillanceTask, string> = {
  monitor: "دید کلی",
  "face-capture": "ثبت چهره",
  "face-identify": "شناسایی قطعی",
  "plate-capture": "ثبت پلاک",
  anpr: "پلاک‌خوانی خودکار"
};

export type SectionType = {
  id: string;
  /** Venues that offer this section. Shared spaces such as corridors list several. */
  venueIds: VenueTypeId[];
  label: string;
  /** Extra words the autocomplete should match, including colloquial names. */
  aliases: string[];
  environment: SectionEnvironment;
  priority: SectionPriority;
  /** Image quality the space needs, expressed as the surveillance task it must support. */
  goal: SurveillanceTask;
  requiredFeatures: CameraFeature[];
  /** Privacy-protected spaces. The engine never proposes a camera here. */
  forbidden?: boolean;
  note?: string;
  /** User-defined types are stored on the project and offered again in later projects. */
  isCustom?: boolean;
};

export type VenueType = {
  id: VenueTypeId;
  label: string;
  aliases: string[];
  blurb: string;
};

export const venueTypes: VenueType[] = [
  {
    id: "residential",
    label: "منزل، ویلا، خانه‌باغ",
    aliases: ["خانه", "منزل", "ویلا", "خانه باغ", "مسکونی", "آپارتمان شخصی", "حیاط دار"],
    blurb: "واحد مسکونی مستقل با حیاط یا محوطه اختصاصی"
  },
  {
    id: "shop",
    label: "مغازه و فروشگاه کوچک",
    aliases: ["مغازه", "فروشگاه", "بوتیک", "سوپر کوچک", "دکه", "لباس فروشی"],
    blurb: "واحد صنفی تک‌طبقه با صندوق و انبار پشتی"
  },
  {
    id: "supermarket",
    label: "سوپرمارکت و هایپرمارکت",
    aliases: ["سوپرمارکت", "هایپرمارکت", "هایپر", "سوپر", "فروشگاه بزرگ", "زنجیره‌ای"],
    blurb: "فروشگاه بزرگ با خط صندوق، انبار و بارانداز"
  },
  {
    id: "jewellery",
    label: "طلافروشی، صرافی، بانک",
    aliases: ["طلافروشی", "طلا", "جواهری", "صرافی", "بانک", "شعبه", "ارزی"],
    blurb: "واحد با ارزش نقدی بالا و ریسک سرقت مسلحانه"
  },
  {
    id: "office",
    label: "دفتر و ساختمان اداری",
    aliases: ["دفتر", "اداری", "شرکت", "اداره", "ساختمان اداری", "دفتر کار"],
    blurb: "فضای کار اداری با لابی، اتاق سرور و بایگانی"
  },
  {
    id: "industrial",
    label: "کارخانه، انبار، سوله",
    aliases: ["کارخانه", "انبار", "سوله", "صنعتی", "کارگاه", "شهرک صنعتی", "تولیدی"],
    blurb: "سایت صنعتی با گیت خودرو، بارانداز و محوطه حصارکشی"
  },
  {
    id: "parking",
    label: "پارکینگ عمومی",
    aliases: ["پارکینگ", "پارکینگ طبقاتی", "پارکینگ عمومی", "توقفگاه"],
    blurb: "پارکینگ چندطبقه یا محوطه‌ای با رمپ ورود و خروج"
  },
  {
    id: "restaurant",
    label: "رستوران، کافه، فست‌فود",
    aliases: ["رستوران", "کافه", "فست فود", "کافی شاپ", "سفره خانه", "غذاخوری"],
    blurb: "واحد پذیرایی با صندوق، آشپزخانه و سالن"
  },
  {
    id: "school",
    label: "مدرسه و مهدکودک",
    aliases: ["مدرسه", "مهدکودک", "مهد", "دبستان", "دبیرستان", "آموزشگاه", "هنرستان"],
    blurb: "فضای آموزشی با حیاط، راهرو و کلاس"
  },
  {
    id: "hospital",
    label: "بیمارستان و داروخانه",
    aliases: ["بیمارستان", "داروخانه", "درمانگاه", "کلینیک", "مطب", "پزشکی"],
    blurb: "مرکز درمانی با اورژانس، پذیرش و انبار دارو"
  },
  {
    id: "hotel",
    label: "هتل و اقامتگاه",
    aliases: ["هتل", "اقامتگاه", "مهمانپذیر", "هتل آپارتمان", "سوئیت", "بوم گردی"],
    blurb: "واحد اقامتی با لابی، راهروی طبقات و امانات"
  },
  {
    id: "fuel",
    label: "پمپ بنزین و جایگاه سوخت",
    aliases: ["پمپ بنزین", "جایگاه سوخت", "پمپ گاز", "سی ان جی", "جایگاه"],
    blurb: "جایگاه سوخت با نازل، مخازن و فروشگاه"
  },
  {
    id: "apartment",
    label: "مجتمع مسکونی و برج",
    aliases: ["مجتمع", "برج", "آپارتمان", "مجتمع مسکونی", "بلوک", "شهرک مسکونی"],
    blurb: "ساختمان چندواحدی با لابی، پارکینگ مشترک و مشاعات"
  },
  {
    id: "farm",
    label: "باغ، مزرعه، دامداری",
    aliases: ["باغ", "مزرعه", "دامداری", "گلخانه", "مرغداری", "زمین کشاورزی", "باغچه"],
    blurb: "سایت باز و پرت با محیط پیرامونی طولانی"
  },

  /* ── Added from the customer project list ──────────────────────── */
  {
    id: "urban-road",
    label: "جاده و معبر شهری",
    aliases: ["جاده", "خیابان", "معبر", "تقاطع", "راه شهری", "road"],
    blurb: "معبر شهری با تقاطع، گذرگاه عابر و تردد مداوم خودرو"
  },
  {
    id: "highway",
    label: "بزرگراه و آزادراه",
    aliases: ["بزرگراه", "اتوبان", "آزادراه", "highway", "جاده برون شهری"],
    blurb: "مسیر پرسرعت با رمپ ورود و خروج و فواصل طولانی"
  },
  {
    id: "construction",
    label: "کارگاه ساختمانی",
    aliases: ["کارگاه", "ساخت و ساز", "پروژه عمرانی", "construction", "کارگاه عمرانی"],
    blurb: "سایت در حال ساخت با مصالح و تجهیزات گران و پیرامون باز"
  },
  {
    id: "conference",
    label: "سالن کنفرانس و همایش",
    aliases: ["کنفرانس", "همایش", "سالن اجتماعات", "سمینار", "آمفی تئاتر"],
    blurb: "فضای گردهمایی با صحنه، پذیرش و کنترل صدا و تصویر"
  },
  {
    id: "car-showroom",
    label: "نمایشگاه خودرو",
    aliases: ["نمایشگاه ماشین", "نمایشگاه خودرو", "اتوگالری", "فروش خودرو"],
    blurb: "سالن نمایش با خودروهای گران‌قیمت و محوطه تحویل"
  },
  {
    id: "bus-station",
    label: "ایستگاه اتوبوس و پایانه",
    aliases: ["ایستگاه اتوبوس", "پایانه", "ترمینال", "توقفگاه اتوبوس"],
    blurb: "سکوی سوار و پیاده با باجه بلیت و تردد مسافر"
  },
  {
    id: "transit-fleet",
    label: "ناوگان اتوبوس و خودرو",
    aliases: ["اتوبوس", "ناوگان", "خودرو حمل و نقل", "کابین", "داخل اتوبوس"],
    blurb: "دوربین روی وسیله نقلیه؛ داخل کابین و دید مسیر"
  },
  {
    id: "control-room",
    label: "مرکز مانیتورینگ و کنترل",
    aliases: ["مانیتورینگ", "اتاق کنترل", "مرکز پایش", "control room", "دیسپاچینگ"],
    blurb: "مرکز پایش با دیوار نمایش، اپراتور و تجهیزات حیاتی"
  },
  {
    id: "substation",
    label: "پست برق و تابلو فشار قوی",
    aliases: ["پست برق", "ترانس", "فشار قوی", "تابلو برق", "دیسپاچینگ برق"],
    blurb: "تأسیسات برق بدون حضور دائم و با خطر سرقت مس"
  },
  {
    id: "warehouse",
    label: "انبار مستقل و لجستیک",
    aliases: ["انبار", "لجستیک", "دپو", "سوله انبار", "مرکز توزیع"],
    blurb: "انبار قفسه‌بندی با بارانداز و تردد کامیون"
  },
  {
    id: "mall",
    label: "مرکز خرید و پاساژ",
    aliases: ["مرکز خرید", "پاساژ", "مال", "mall", "فروشگاه چندطبقه"],
    blurb: "مجموعه چندطبقه با راهروی مشترک و پارکینگ"
  },
  {
    id: "pipeline",
    label: "خط لوله و ایستگاه پمپاژ",
    aliases: ["خط لوله", "پایپ لاین", "پمپاژ", "ایستگاه شیر", "انتقال گاز"],
    blurb: "مسیر طولانی و پرت با ایستگاه‌های پراکنده"
  },
  {
    id: "transmission-line",
    label: "خطوط انتقال برق",
    aliases: ["خط انتقال", "دکل برق", "حریم خط", "برق فشار قوی"],
    blurb: "دکل و حریم خط در مسیرهای دور از دسترس"
  },
  {
    id: "onshore-oil",
    label: "میدان نفتی خشکی",
    aliases: ["میدان نفتی", "سرچاه", "نفت خشکی", "onshore", "پالایش"],
    blurb: "سایت نفتی با سرچاه، مخزن و ریسک آتش"
  },
  {
    id: "offshore-oil",
    label: "سکوی نفتی دریایی",
    aliases: ["سکوی نفتی", "offshore", "پلتفرم", "نفت دریایی", "هلی پد"],
    blurb: "سکوی دریایی با عرشه، هلی‌پد و شرایط خورنده"
  },
  {
    id: "solar-farm",
    label: "مزرعه خورشیدی",
    aliases: ["نیروگاه خورشیدی", "پنل خورشیدی", "سولار", "solar", "فتوولتائیک"],
    blurb: "آرایه پنل در محوطه باز با پیرامون طولانی"
  },
  {
    id: "hydro-plant",
    label: "نیروگاه برق‌آبی",
    aliases: ["برق آبی", "سد", "توربین", "نیروگاه آبی", "hydro"],
    blurb: "سد و توربین‌خانه با اتاق کنترل و مسیر آب"
  },
  {
    id: "safe-city",
    label: "شهر ایمن",
    aliases: ["شهر ایمن", "پایش شهری", "safe city", "دوربین شهری", "پلیس"],
    blurb: "پایش سطح شهر با تقاطع، میدان و فضای عمومی"
  },
  {
    id: "sports-complex",
    label: "مجتمع ورزشی و استادیوم",
    aliases: ["ورزشگاه", "استادیوم", "سالن ورزشی", "باشگاه", "زمین بازی"],
    blurb: "مجموعه ورزشی با جایگاه تماشاگر و گیت بازرسی"
  },
  {
    id: "data-centre",
    label: "مرکز داده",
    aliases: ["دیتاسنتر", "مرکز داده", "data center", "اتاق سرور بزرگ", "کولوکیشن"],
    blurb: "سالن رک با دسترسی کنترل‌شده و تأسیسات حیاتی"
  },
  {
    id: "airport",
    label: "فرودگاه و ترمینال هوایی",
    aliases: ["فرودگاه", "ترمینال", "airport", "گیت پرواز", "باند"],
    blurb: "ترمینال مسافری با بازرسی، تحویل بار و اپرون"
  },
  {
    id: "port",
    label: "بندر و اسکله",
    aliases: ["بندر", "اسکله", "port", "کانتینر", "گمرک"],
    blurb: "محوطه کانتینری با جرثقیل، گیت و خط ساحلی"
  },
  {
    id: "railway",
    label: "ایستگاه راه‌آهن و مترو",
    aliases: ["راه آهن", "مترو", "ایستگاه قطار", "سکوی قطار", "تونل"],
    blurb: "ایستگاه ریلی با سکو، لبه خطر و تردد بالا"
  },
  {
    id: "mine",
    label: "معدن",
    aliases: ["معدن", "استخراج", "mine", "سنگ شکن", "باسکول"],
    blurb: "سایت استخراج با ماشین‌آلات سنگین و مواد کنترل‌شده"
  },
  {
    id: "water-plant",
    label: "تصفیه‌خانه آب و فاضلاب",
    aliases: ["تصفیه خانه", "آب و فاضلاب", "پمپاژ آب", "حوضچه"],
    blurb: "تأسیسات آبی با حوضچه، اتاق شیمیایی و پیرامون"
  }
];

/**
 * Every section a venue can contain.
 *
 * Shared spaces (corridors, lifts, staff parking, the equipment room) are declared once
 * against every venue that has them, so editing the rule for a corridor fixes it
 * everywhere rather than in fourteen places.
 */
export const sectionTypes: SectionType[] = [
  /* ── Shared across venues ─────────────────────────────────────────── */
  {
    id: "shared.equipment-room",
    venueIds: ["jewellery", "office", "industrial", "parking", "supermarket", "apartment", "hotel", "hospital", "school"],
    label: "اتاق سرور یا رک NVR",
    aliases: ["رک", "سرور", "nvr", "دی وی ار", "اتاق تجهیزات", "اتاق فنی"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["continuous-record"],
    note: "ضبط‌کننده باید خودش زیر پوشش باشد تا برداشتن دستگاه ثبت شود"
  },
  {
    id: "shared.corridor",
    venueIds: ["residential", "office", "hospital", "hotel", "school", "apartment", "supermarket"],
    label: "راهرو",
    aliases: ["راهرو", "کریدور", "دالان", "راه رو"],
    environment: "indoor-corridor",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "shared.stairwell",
    venueIds: ["residential", "office", "hotel", "school", "apartment", "parking"],
    label: "راه‌پله و خروج اضطراری",
    aliases: ["پله", "راه پله", "پلکان", "خروج اضطراری", "فرار"],
    environment: "indoor-corridor",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "shared.elevator",
    venueIds: ["office", "hotel", "hospital", "apartment", "parking", "supermarket"],
    label: "آسانسور",
    aliases: ["آسانسور", "لیفت", "بالابر", "کابین"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-identify",
    requiredFeatures: [],
    note: "دوربین در گوشه سقف کابین، رو به در"
  },
  {
    id: "shared.storeroom",
    venueIds: ["residential", "office", "restaurant", "apartment", "school", "hotel"],
    label: "انباری و موتورخانه",
    aliases: ["انباری", "انبار", "موتورخانه", "تاسیسات", "زیرزمین"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "shared.staff-parking",
    venueIds: ["office", "industrial", "supermarket", "school", "hospital", "hotel", "fuel"],
    label: "پارکینگ کارکنان و مراجعان",
    aliases: ["پارکینگ", "توقفگاه", "پارک خودرو", "محوطه پارک"],
    environment: "parking",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "shared.washroom",
    venueIds: ["school", "hospital", "hotel", "office", "restaurant", "supermarket"],
    label: "سرویس بهداشتی و رختکن",
    aliases: ["سرویس", "دستشویی", "توالت", "رختکن", "حمام"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: [],
    forbidden: true,
    note: "نصب دوربین در این فضا ممنوع است"
  },

  /* ── ۱. منزل، ویلا، خانه‌باغ ───────────────────────────────────────── */
  {
    id: "residential.gate",
    venueIds: ["residential"],
    label: "ورودی حیاط و درِ پارکینگ",
    aliases: ["در حیاط", "درب حیاط", "ورودی حیاط", "در پارکینگ", "کوچه"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "residential.entrance",
    venueIds: ["residential"],
    label: "ورودی ساختمان",
    aliases: ["در ورودی", "درب ورودی", "ورودی خانه", "هال ورودی"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "residential.yard",
    venueIds: ["residential"],
    label: "حیاط و محوطه",
    aliases: ["حیاط", "محوطه", "باغچه", "فضای باز"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "residential.blind-wall",
    venueIds: ["residential"],
    label: "دیوار پشتی و نقطه کور",
    aliases: ["دیوار پشتی", "نقطه کور", "پشت خانه", "دیوار جانبی"],
    environment: "perimeter",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "residential.living",
    venueIds: ["residential"],
    label: "نشیمن و پذیرایی",
    aliases: ["نشیمن", "پذیرایی", "هال", "سالن", "اتاق نشیمن"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "residential.kitchen",
    venueIds: ["residential"],
    label: "آشپزخانه",
    aliases: ["آشپزخانه", "اپن", "کابینت"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "residential.bedroom",
    venueIds: ["residential"],
    label: "اتاق خواب",
    aliases: ["اتاق خواب", "خوابگاه", "اتاق"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "residential.parking",
    venueIds: ["residential"],
    label: "پارکینگ خودرو",
    aliases: ["پارکینگ", "پارک خودرو", "گاراژ"],
    environment: "parking",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "residential.pool",
    venueIds: ["residential"],
    label: "استخر و فضای بازی",
    aliases: ["استخر", "زمین بازی", "آلاچیق", "محوطه بازی"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "residential.roof",
    venueIds: ["residential"],
    label: "پشت‌بام و روف‌گاردن",
    aliases: ["پشت بام", "بام", "تراس", "روف گاردن"],
    environment: "outdoor",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },

  /* ── ۲. مغازه و فروشگاه کوچک ──────────────────────────────────────── */
  {
    id: "shop.checkout",
    venueIds: ["shop"],
    label: "صندوق فروش",
    aliases: ["صندوق", "کاشیر", "دخل", "میز صندوق", "پرداخت"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: [],
    note: "زاویه باید هم چهره مشتری و هم سطح دخل را بگیرد"
  },
  {
    id: "shop.entrance",
    venueIds: ["shop"],
    label: "درِ ورودی مغازه",
    aliases: ["در ورودی", "درب", "ورودی مغازه", "آستانه"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "shop.display",
    venueIds: ["shop"],
    label: "ویترین و قفسه کالای گران",
    aliases: ["ویترین", "قفسه", "استند", "کالای گران", "دکور"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "shop.backstore",
    venueIds: ["shop"],
    label: "انبار و درِ پشتی",
    aliases: ["انبار", "در پشتی", "پشت مغازه", "رختکن انبار"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "shop.salesfloor",
    venueIds: ["shop"],
    label: "سالن فروش",
    aliases: ["سالن", "فضای فروش", "داخل مغازه"],
    environment: "indoor-room",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "shop.facade",
    venueIds: ["shop"],
    label: "نمای بیرونی و سردر",
    aliases: ["نما", "سردر", "پیاده رو", "جلوی مغازه", "تابلو"],
    environment: "outdoor",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "shop.delivery",
    venueIds: ["shop"],
    label: "محل تحویل بار",
    aliases: ["تحویل بار", "بارگیری", "تخلیه بار"],
    environment: "outdoor",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "shop.fitting",
    venueIds: ["shop"],
    label: "اتاق پرو",
    aliases: ["اتاق پرو", "پرو", "رختکن"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: [],
    forbidden: true,
    note: "نصب دوربین در اتاق پرو ممنوع است"
  },

  /* ── ۳. سوپرمارکت و هایپرمارکت ────────────────────────────────────── */
  {
    id: "supermarket.checkout-line",
    venueIds: ["supermarket"],
    label: "خط صندوق",
    aliases: ["صندوق", "خط صندوق", "کاشیر", "باجه پرداخت"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: [],
    note: "یک دوربین برای هر دو تا سه باجه"
  },
  {
    id: "supermarket.entrance",
    venueIds: ["supermarket"],
    label: "ورودی و خروجی مشتری",
    aliases: ["ورودی", "خروجی", "درب مشتری", "گیت ورودی"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: ["people-count"]
  },
  {
    id: "supermarket.highvalue",
    venueIds: ["supermarket"],
    label: "قفسه اقلام گران",
    aliases: ["قفسه گران", "لوازم آرایشی", "دخانیات", "کالای گران"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "supermarket.coldstore",
    venueIds: ["supermarket"],
    label: "انبار و سردخانه",
    aliases: ["انبار", "سردخانه", "یخچال انبار", "ذخیره"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "supermarket.dock",
    venueIds: ["supermarket"],
    label: "بارانداز",
    aliases: ["بارانداز", "تخلیه بار", "بارگیری", "رمپ بار"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "supermarket.cashroom",
    venueIds: ["supermarket"],
    label: "اتاق پول و شمارش",
    aliases: ["اتاق پول", "شمارش", "خزانه", "حسابداری"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["continuous-record"]
  },
  {
    id: "supermarket.aisle",
    venueIds: ["supermarket"],
    label: "راهروی قفسه",
    aliases: ["راهرو قفسه", "بین قفسه", "قفسه بندی", "راهرو فروش"],
    environment: "indoor-corridor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },

  /* ── ۴. طلافروشی، صرافی، بانک ─────────────────────────────────────── */
  {
    id: "jewellery.entrance",
    venueIds: ["jewellery"],
    label: "درِ ورودی",
    aliases: ["در ورودی", "درب", "ورودی", "تله گیت"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: [],
    note: "تنها نقطه‌ای که در آن شناسایی قطعی لازم است"
  },
  {
    id: "jewellery.counter",
    venueIds: ["jewellery"],
    label: "پیشخوان معامله",
    aliases: ["پیشخوان", "باجه", "میز معامله", "کانتر", "ترازو"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["continuous-record"]
  },
  {
    id: "jewellery.vault",
    venueIds: ["jewellery"],
    label: "گاوصندوق و اتاق امن",
    aliases: ["گاوصندوق", "خزانه", "اتاق امن", "صندوق امانات", "vault"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["continuous-record"]
  },
  {
    id: "jewellery.display",
    venueIds: ["jewellery"],
    label: "ویترین",
    aliases: ["ویترین", "نمایش طلا", "شوکیس"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "jewellery.street",
    venueIds: ["jewellery"],
    label: "نمای بیرونی و پیاده‌رو",
    aliases: ["نما", "پیاده رو", "خیابان", "جلوی مغازه", "بیرون"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: ["human-vehicle"],
    note: "برای ثبت تردد مشکوک پیش از ورود"
  },
  {
    id: "jewellery.emergency-exit",
    venueIds: ["jewellery"],
    label: "مسیر خروج اضطراری",
    aliases: ["خروج اضطراری", "در پشتی", "راه فرار"],
    environment: "indoor-corridor",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },

  /* ── ۵. دفتر و ساختمان اداری ──────────────────────────────────────── */
  {
    id: "office.lobby",
    venueIds: ["office"],
    label: "لابی و پذیرش",
    aliases: ["لابی", "پذیرش", "ریسپشن", "منشی", "ورودی اداری"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "office.floor-entrance",
    venueIds: ["office"],
    label: "ورودی طبقه",
    aliases: ["ورودی طبقه", "در طبقه", "درب واحد"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "office.archive",
    venueIds: ["office"],
    label: "بایگانی و اسناد",
    aliases: ["بایگانی", "اسناد", "آرشیو", "مدارک", "پرونده"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "office.equipment-store",
    venueIds: ["office"],
    label: "انبار تجهیزات",
    aliases: ["انبار تجهیزات", "انبار لوازم", "استوک"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "office.openplan",
    venueIds: ["office"],
    label: "فضای کار باز",
    aliases: ["فضای کار", "اوپن اسپیس", "میزهای کار", "سالن کار"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "office.meeting",
    venueIds: ["office"],
    label: "اتاق جلسات",
    aliases: ["جلسات", "کنفرانس", "اتاق جلسه", "میتینگ"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: [],
    forbidden: true,
    note: "به دلیل محرمانگی مذاکرات از نصب دوربین پرهیز شود"
  },

  /* ── ۶. کارخانه، انبار، سوله ──────────────────────────────────────── */
  {
    id: "industrial.vehicle-gate",
    venueIds: ["industrial"],
    label: "گیت خودرو",
    aliases: ["گیت", "درب کامیون", "ورودی خودرو", "باسکول", "پلاک"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: ["anpr"],
    note: "زاویه افقی زیر ۳۰ درجه نسبت به مسیر حرکت"
  },
  {
    id: "industrial.dock",
    venueIds: ["industrial"],
    label: "بارانداز",
    aliases: ["بارانداز", "سکوی بار", "تخلیه", "بارگیری"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "industrial.staff-entrance",
    venueIds: ["industrial"],
    label: "ورود پرسنل",
    aliases: ["ورود پرسنل", "درب کارگری", "کارت زنی", "تردد پرسنل"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "industrial.warehouse",
    venueIds: ["industrial"],
    label: "انبار مواد و محصول",
    aliases: ["انبار", "سوله انبار", "مواد اولیه", "محصول", "قفسه صنعتی"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "industrial.perimeter",
    venueIds: ["industrial"],
    label: "پیرامون و حصار",
    aliases: ["حصار", "پیرامون", "فنس", "دیوار محوطه", "خط محیطی"],
    environment: "perimeter",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "industrial.production",
    venueIds: ["industrial"],
    label: "خط تولید",
    aliases: ["خط تولید", "سالن تولید", "ماشین آلات", "پروسه"],
    environment: "indoor-room",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "industrial.hazard",
    venueIds: ["industrial"],
    label: "مخازن و مواد خطرناک",
    aliases: ["مخزن", "مواد خطرناک", "شیمیایی", "سوخت", "کپسول"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["thermal"]
  },
  {
    id: "industrial.electrical",
    venueIds: ["industrial"],
    label: "اتاق برق و تابلو",
    aliases: ["اتاق برق", "تابلو برق", "ترانس", "دیزل ژنراتور"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "industrial.crane",
    venueIds: ["industrial"],
    label: "محل جرثقیل و لیفتراک",
    aliases: ["جرثقیل", "لیفتراک", "کرین", "بالابر صنعتی"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },

  /* ── ۷. پارکینگ عمومی ─────────────────────────────────────────────── */
  {
    id: "parking.entry-ramp",
    venueIds: ["parking"],
    label: "رمپ ورود",
    aliases: ["رمپ ورود", "ورودی پارکینگ", "درب ورود", "راهبند ورود"],
    environment: "parking",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: [],
    note: "کیفیت باید پلاک را خوانا کند؛ قابلیت پلاک‌خوانی خودکار الزامی نیست"
  },
  {
    id: "parking.exit-ramp",
    venueIds: ["parking"],
    label: "رمپ خروج",
    aliases: ["رمپ خروج", "خروجی پارکینگ", "درب خروج", "راهبند خروج"],
    environment: "parking",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: []
  },
  {
    id: "parking.pedestrian",
    venueIds: ["parking"],
    label: "مسیر عابر و درِ ارتباطی",
    aliases: ["مسیر عابر", "در ارتباطی", "پیاده", "درب داخلی"],
    environment: "parking",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "parking.bay-aisle",
    venueIds: ["parking", "apartment"],
    label: "راهروی پارک و جای خودرو",
    aliases: ["راهرو پارک", "جای پارک", "خط پارک", "محل توقف"],
    environment: "parking",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "parking.control-room",
    venueIds: ["parking"],
    label: "اتاق کنترل و صندوق",
    aliases: ["اتاق کنترل", "صندوق", "باجه", "نگهبانی پارکینگ"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "parking.ev-charger",
    venueIds: ["parking"],
    label: "محل شارژ خودرو برقی",
    aliases: ["شارژ برقی", "شارژر", "ای وی", "خودرو برقی"],
    environment: "parking",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },

  /* ── ۸. رستوران، کافه، فست‌فود ────────────────────────────────────── */
  {
    id: "restaurant.checkout",
    venueIds: ["restaurant"],
    label: "صندوق و پرداخت",
    aliases: ["صندوق", "پرداخت", "کاشیر", "دخل"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "restaurant.entrance",
    venueIds: ["restaurant"],
    label: "ورودی مشتری",
    aliases: ["ورودی", "درب ورودی", "در مشتری"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "restaurant.kitchen",
    venueIds: ["restaurant"],
    label: "آشپزخانه",
    aliases: ["آشپزخانه", "کیچن", "خط پخت", "اجاق"],
    environment: "indoor-room",
    priority: "important",
    goal: "monitor",
    requiredFeatures: [],
    note: "دوربین باید در برابر بخار و چربی محافظت شود"
  },
  {
    id: "restaurant.foodstore",
    venueIds: ["restaurant"],
    label: "انبار مواد غذایی",
    aliases: ["انبار غذا", "سردخانه", "انبار مواد", "یخچال"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "restaurant.dining",
    venueIds: ["restaurant"],
    label: "سالن پذیرایی",
    aliases: ["سالن", "میزها", "پذیرایی", "فضای نشیمن"],
    environment: "indoor-room",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "restaurant.backdoor",
    venueIds: ["restaurant"],
    label: "درِ پشتی و محل زباله",
    aliases: ["در پشتی", "زباله", "پسماند", "خروج خدمات"],
    environment: "outdoor",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "restaurant.takeaway",
    venueIds: ["restaurant"],
    label: "محل بیرون‌بر و پیک",
    aliases: ["بیرون بر", "پیک", "تحویل", "دلیوری"],
    environment: "outdoor",
    priority: "optional",
    goal: "face-capture",
    requiredFeatures: []
  },

  /* ── ۹. مدرسه و مهدکودک ───────────────────────────────────────────── */
  {
    id: "school.main-entrance",
    venueIds: ["school"],
    label: "درِ ورودی اصلی",
    aliases: ["در ورودی", "درب مدرسه", "ورودی اصلی", "نگهبانی"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "school.pickup",
    venueIds: ["school"],
    label: "محل تحویل دانش‌آموز",
    aliases: ["تحویل دانش آموز", "سرویس مدرسه", "محل انتظار اولیا"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "school.yard",
    venueIds: ["school"],
    label: "حیاط و زمین بازی",
    aliases: ["حیاط", "زمین بازی", "زمین ورزش", "محوطه مدرسه"],
    environment: "outdoor",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "school.perimeter",
    venueIds: ["school"],
    label: "محوطه پیرامونی",
    aliases: ["پیرامون", "دیوار مدرسه", "حصار", "اطراف"],
    environment: "perimeter",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "school.classroom",
    venueIds: ["school"],
    label: "کلاس درس",
    aliases: ["کلاس", "کلاس درس", "اتاق درس"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "school.lab",
    venueIds: ["school"],
    label: "آزمایشگاه و کارگاه",
    aliases: ["آزمایشگاه", "کارگاه", "لابراتوار", "هنرستان"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },

  /* ── ۱۰. بیمارستان و داروخانه ─────────────────────────────────────── */
  {
    id: "hospital.emergency",
    venueIds: ["hospital"],
    label: "اورژانس و ورودی",
    aliases: ["اورژانس", "ورودی بیمارستان", "تریاژ", "درب اورژانس"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "hospital.reception",
    venueIds: ["hospital"],
    label: "پذیرش و صندوق",
    aliases: ["پذیرش", "صندوق", "ترخیص", "باجه"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "hospital.pharmacy-store",
    venueIds: ["hospital"],
    label: "انبار دارو و مخدر",
    aliases: ["انبار دارو", "داروخانه", "مخدر", "قفسه دارو"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["continuous-record"]
  },
  {
    id: "hospital.ambulance",
    venueIds: ["hospital"],
    label: "پارکینگ آمبولانس",
    aliases: ["آمبولانس", "پارکینگ اورژانس", "رمپ آمبولانس"],
    environment: "outdoor",
    priority: "important",
    goal: "plate-capture",
    requiredFeatures: []
  },
  {
    id: "hospital.patient-room",
    venueIds: ["hospital"],
    label: "اتاق بیمار و معاینه",
    aliases: ["اتاق بیمار", "معاینه", "بستری", "ویزیت"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: [],
    forbidden: true,
    note: "نصب دوربین در فضای درمانی بیمار ممنوع است"
  },

  /* ── ۱۱. هتل و اقامتگاه ───────────────────────────────────────────── */
  {
    id: "hotel.lobby",
    venueIds: ["hotel"],
    label: "لابی و پذیرش",
    aliases: ["لابی", "پذیرش", "ریسپشن", "فرانت"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "hotel.floor-corridor",
    venueIds: ["hotel"],
    label: "راهروی طبقات",
    aliases: ["راهرو طبقه", "راهرو اتاق ها", "کریدور هتل"],
    environment: "indoor-corridor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "hotel.safe-deposit",
    venueIds: ["hotel"],
    label: "صندوق امانات",
    aliases: ["امانات", "صندوق امانات", "گاوصندوق هتل"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["continuous-record"]
  },
  {
    id: "hotel.restaurant",
    venueIds: ["hotel"],
    label: "رستوران و سالن",
    aliases: ["رستوران هتل", "سالن غذاخوری", "صبحانه خوری"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "hotel.guest-room",
    venueIds: ["hotel"],
    label: "داخل اتاق میهمان",
    aliases: ["اتاق هتل", "داخل اتاق", "سوئیت"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: [],
    forbidden: true,
    note: "نصب دوربین در اتاق میهمان ممنوع است"
  },

  /* ── ۱۲. پمپ بنزین ────────────────────────────────────────────────── */
  {
    id: "fuel.island",
    venueIds: ["fuel"],
    label: "جایگاه سوخت‌گیری",
    aliases: ["نازل", "جایگاه", "سکوی سوخت", "پمپ"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: [],
    note: "باید هم پلاک و هم رفتار راننده را ثبت کند"
  },
  {
    id: "fuel.gate",
    venueIds: ["fuel"],
    label: "ورودی و خروجی جایگاه",
    aliases: ["ورودی جایگاه", "خروجی جایگاه", "درب جایگاه"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: ["anpr"]
  },
  {
    id: "fuel.shop",
    venueIds: ["fuel"],
    label: "صندوق و فروشگاه جایگاه",
    aliases: ["صندوق جایگاه", "فروشگاه", "مارکت", "باجه"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "fuel.tanks",
    venueIds: ["fuel"],
    label: "مخازن و محل تخلیه",
    aliases: ["مخزن", "تخلیه سوخت", "تانکر", "منهول"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["thermal"]
  },
  {
    id: "fuel.forecourt",
    venueIds: ["fuel"],
    label: "محوطه و پیرامون جایگاه",
    aliases: ["محوطه", "پیرامون", "اطراف جایگاه", "سایبان"],
    environment: "perimeter",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },

  /* ── ۱۳. مجتمع مسکونی و برج ───────────────────────────────────────── */
  {
    id: "apartment.lobby",
    venueIds: ["apartment"],
    label: "لابی و درِ ورودی",
    aliases: ["لابی", "در ورودی", "درب مجتمع", "ورودی برج"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "apartment.parking-gate",
    venueIds: ["apartment"],
    label: "درِ پارکینگ",
    aliases: ["درب پارکینگ", "ریموت", "کرکره پارکینگ", "رمپ"],
    environment: "parking",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: []
  },
  {
    id: "apartment.storage",
    venueIds: ["apartment"],
    label: "انباری واحدها",
    aliases: ["انباری", "انبار مجتمع", "زیرزمین انباری"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "apartment.amenities",
    venueIds: ["apartment"],
    label: "مشاعات و بام",
    aliases: ["مشاعات", "بام", "سالن اجتماعات", "استخر مجتمع", "سالن ورزش"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "apartment.plantroom",
    venueIds: ["apartment"],
    label: "موتورخانه و تاسیسات",
    aliases: ["موتورخانه", "تاسیسات", "پمپ", "چیلر"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },

  /* ── ۱۴. باغ، مزرعه، دامداری ──────────────────────────────────────── */
  {
    id: "farm.access",
    venueIds: ["farm"],
    label: "ورودی و مسیر دسترسی",
    aliases: ["ورودی باغ", "جاده دسترسی", "درب باغ", "مسیر خاکی"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: [],
    note: "تنها راه ورود وسیله نقلیه؛ ثبت پلاک ارزش بالایی دارد"
  },
  {
    id: "farm.perimeter",
    venueIds: ["farm"],
    label: "محیط پیرامونی",
    aliases: ["پیرامون", "حصار باغ", "دیوار", "خط محیطی", "فنس"],
    environment: "perimeter",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"],
    note: "محیط طولانی؛ ترکیب دوربین ثابت و چرخشی مقرون‌به‌صرفه‌تر است"
  },
  {
    id: "farm.store",
    venueIds: ["farm"],
    label: "انبار محصول و ادوات",
    aliases: ["انبار محصول", "ادوات", "تراکتور", "سمپاش", "انبار باغ"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "farm.livestock",
    venueIds: ["farm"],
    label: "جایگاه دام",
    aliases: ["دامداری", "آغل", "طویله", "مرغداری", "جایگاه دام"],
    environment: "indoor-room",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "farm.utilities",
    venueIds: ["farm"],
    label: "چاه، پمپ و تابلو برق",
    aliases: ["چاه", "پمپ آب", "تابلو برق", "موتور آب", "کنتور"],
    environment: "outdoor",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: [],
    note: "کابل و الکتروموتور هدف رایج سرقت است"
  },

  /* ── Sections for the venues added from the customer list ──────── */
  {
    id: "urban-road.junction",
    venueIds: ["urban-road", "safe-city"],
    label: "تقاطع و چهارراه",
    aliases: ["تقاطع", "چهارراه", "میدان"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: [],
    note: "زاویه افقی زیر ۳۰ درجه نسبت به مسیر حرکت"
  },
  {
    id: "urban-road.crossing",
    venueIds: ["urban-road", "safe-city"],
    label: "گذرگاه عابر پیاده",
    aliases: ["گذرگاه", "خط عابر", "عابر پیاده"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "urban-road.lane",
    venueIds: ["urban-road", "highway"],
    label: "مسیر تردد خودرو",
    aliases: ["مسیر", "لاین", "خط عبور"],
    environment: "outdoor",
    priority: "important",
    goal: "plate-capture",
    requiredFeatures: []
  },
  {
    id: "urban-road.signal",
    venueIds: ["urban-road"],
    label: "چراغ راهنما و تابلو",
    aliases: ["چراغ راهنما", "تابلو", "علائم"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "urban-road.sidewalk",
    venueIds: ["urban-road", "safe-city"],
    label: "پیاده‌رو و حاشیه",
    aliases: ["پیاده رو", "حاشیه", "کنار خیابان"],
    environment: "outdoor",
    priority: "optional",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "highway.ramp",
    venueIds: ["highway"],
    label: "رمپ ورود و خروج",
    aliases: ["رمپ", "ورودی بزرگراه", "خروجی"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: ["anpr"]
  },
  {
    id: "highway.mainline",
    venueIds: ["highway"],
    label: "مسیر اصلی و لاین‌ها",
    aliases: ["مسیر اصلی", "باند", "لاین"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: []
  },
  {
    id: "highway.shoulder",
    venueIds: ["highway"],
    label: "شانه راه و توقفگاه اضطراری",
    aliases: ["شانه", "توقف اضطراری", "کنار جاده"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "highway.speed",
    venueIds: ["highway"],
    label: "نقطه پایش سرعت",
    aliases: ["سرعت سنج", "پایش سرعت", "دوربین سرعت"],
    environment: "outdoor",
    priority: "important",
    goal: "anpr",
    requiredFeatures: ["anpr"]
  },
  {
    id: "highway.sign",
    venueIds: ["highway"],
    label: "تابلو متغیر و علائم",
    aliases: ["تابلو متغیر", "علائم", "vms"],
    environment: "outdoor",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "construction.gate",
    venueIds: ["construction"],
    label: "گیت ورود کارگاه",
    aliases: ["گیت", "درب کارگاه", "ورودی سایت"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "construction.material",
    venueIds: ["construction"],
    label: "انبار مصالح",
    aliases: ["مصالح", "انبار سیمان", "دپو مصالح"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "construction.equipment",
    venueIds: ["construction"],
    label: "دپوی تجهیزات و ابزار",
    aliases: ["تجهیزات", "ابزار", "دپو"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "construction.crane",
    venueIds: ["construction"],
    label: "جرثقیل و بالابر",
    aliases: ["جرثقیل", "بالابر", "تاور کرین"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "construction.perimeter",
    venueIds: ["construction"],
    label: "پیرامون سایت",
    aliases: ["حصار", "پیرامون", "فنس کارگاه"],
    environment: "perimeter",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "construction.office",
    venueIds: ["construction"],
    label: "دفتر کارگاه",
    aliases: ["دفتر", "کانکس", "اتاق سرپرست"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "conference.entrance",
    venueIds: ["conference"],
    label: "ورودی سالن",
    aliases: ["ورودی", "درب سالن", "لابی"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "conference.stage",
    venueIds: ["conference"],
    label: "صحنه و تریبون",
    aliases: ["صحنه", "تریبون", "استیج"],
    environment: "indoor-room",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "conference.seating",
    venueIds: ["conference"],
    label: "فضای نشیمن حضار",
    aliases: ["صندلی", "سالن", "حضار"],
    environment: "indoor-room",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["people-count"]
  },
  {
    id: "conference.registration",
    venueIds: ["conference"],
    label: "پذیرش و ثبت‌نام",
    aliases: ["پذیرش", "ثبت نام", "میز ثبت"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "conference.av-room",
    venueIds: ["conference"],
    label: "اتاق کنترل صدا و تصویر",
    aliases: ["اتاق کنترل", "صدا و تصویر", "میکسر"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "car-showroom.floor",
    venueIds: ["car-showroom"],
    label: "سالن نمایش خودرو",
    aliases: ["سالن نمایش", "شوروم", "نمایشگاه"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "car-showroom.delivery",
    venueIds: ["car-showroom"],
    label: "محل تحویل خودرو",
    aliases: ["تحویل خودرو", "تحویل", "خروج خودرو"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: []
  },
  {
    id: "car-showroom.sales",
    venueIds: ["car-showroom"],
    label: "دفتر فروش و قرارداد",
    aliases: ["دفتر فروش", "قرارداد", "میز فروش"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "car-showroom.yard",
    venueIds: ["car-showroom"],
    label: "محوطه پارک خودرو",
    aliases: ["محوطه", "پارک", "حیاط نمایشگاه"],
    environment: "parking",
    priority: "important",
    goal: "plate-capture",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "car-showroom.parts",
    venueIds: ["car-showroom"],
    label: "انبار قطعات",
    aliases: ["انبار قطعات", "لوازم یدکی", "قطعات"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "bus-station.platform",
    venueIds: ["bus-station"],
    label: "سکوی سوار و پیاده شدن",
    aliases: ["سکو", "پلتفرم", "محل سوار"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: ["people-count"]
  },
  {
    id: "bus-station.ticket",
    venueIds: ["bus-station"],
    label: "باجه بلیت",
    aliases: ["باجه", "بلیت فروشی", "گیشه"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "bus-station.shelter",
    venueIds: ["bus-station"],
    label: "سرپناه انتظار",
    aliases: ["سرپناه", "انتظار", "نیمکت"],
    environment: "outdoor",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "bus-station.bus-lane",
    venueIds: ["bus-station"],
    label: "مسیر ورود اتوبوس",
    aliases: ["مسیر اتوبوس", "ورود اتوبوس", "لاین"],
    environment: "outdoor",
    priority: "important",
    goal: "plate-capture",
    requiredFeatures: []
  },
  {
    id: "bus-station.perimeter",
    venueIds: ["bus-station"],
    label: "پیرامون ایستگاه",
    aliases: ["پیرامون", "اطراف ایستگاه"],
    environment: "perimeter",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "transit-fleet.cabin",
    venueIds: ["transit-fleet"],
    label: "داخل کابین مسافر",
    aliases: ["کابین", "داخل اتوبوس", "سالن مسافر"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "transit-fleet.door",
    venueIds: ["transit-fleet"],
    label: "درِ ورود مسافر",
    aliases: ["درب", "ورود مسافر", "پله اتوبوس"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["people-count"]
  },
  {
    id: "transit-fleet.driver",
    venueIds: ["transit-fleet"],
    label: "دید راننده و داشبورد",
    aliases: ["راننده", "داشبورد", "کابین راننده"],
    environment: "indoor-room",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["audio"]
  },
  {
    id: "transit-fleet.road-view",
    venueIds: ["transit-fleet"],
    label: "دید جلو و عقب مسیر",
    aliases: ["دید جلو", "دید عقب", "مسیر"],
    environment: "outdoor",
    priority: "important",
    goal: "plate-capture",
    requiredFeatures: []
  },
  {
    id: "transit-fleet.depot",
    venueIds: ["transit-fleet"],
    label: "محل توقف و پارک ناوگان",
    aliases: ["توقفگاه", "دپو", "پارکینگ ناوگان"],
    environment: "parking",
    priority: "important",
    goal: "plate-capture",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "control-room.video-wall",
    venueIds: ["control-room"],
    label: "دیوار نمایش",
    aliases: ["ویدئو وال", "دیوار نمایش", "مانیتورها"],
    environment: "indoor-room",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "control-room.operator",
    venueIds: ["control-room"],
    label: "میز اپراتور",
    aliases: ["اپراتور", "میز کنترل", "کنسول"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["continuous-record"]
  },
  {
    id: "control-room.entrance",
    venueIds: ["control-room"],
    label: "درِ ورود کنترل‌شده",
    aliases: ["درب کنترل شده", "اکسس", "کارت خوان"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "control-room.power",
    venueIds: ["control-room"],
    label: "برق اضطراری و UPS",
    aliases: ["یو پی اس", "برق اضطراری", "ژنراتور"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "substation.transformer",
    venueIds: ["substation"],
    label: "ترانسفورماتور",
    aliases: ["ترانس", "ترانسفورماتور"],
    environment: "outdoor",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "substation.switchgear",
    venueIds: ["substation"],
    label: "تابلو فشار قوی",
    aliases: ["تابلو", "فشار قوی", "سوئیچگیر"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "substation.gate",
    venueIds: ["substation"],
    label: "گیت ورود پست",
    aliases: ["گیت", "درب پست", "ورودی"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "substation.relay-room",
    venueIds: ["substation"],
    label: "اتاق رله و کنترل",
    aliases: ["اتاق رله", "کنترل", "حفاظت"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "substation.perimeter",
    venueIds: ["substation"],
    label: "پیرامون محوطه پست",
    aliases: ["حصار", "پیرامون", "دیوار پست"],
    environment: "perimeter",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle", "thermal"]
  },
  {
    id: "warehouse.dock",
    venueIds: ["warehouse"],
    label: "بارانداز و سکوی بار",
    aliases: ["بارانداز", "سکوی بار", "تخلیه"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "warehouse.aisle",
    venueIds: ["warehouse"],
    label: "راهروی قفسه",
    aliases: ["راهرو", "قفسه", "رک انبار"],
    environment: "indoor-corridor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "warehouse.office",
    venueIds: ["warehouse"],
    label: "دفتر انبار و کنترل موجودی",
    aliases: ["دفتر انبار", "کنترل موجودی", "باسکول"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "warehouse.vehicle-gate",
    venueIds: ["warehouse"],
    label: "گیت خودرو و کامیون",
    aliases: ["گیت", "کامیون", "درب کامیون"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: ["anpr"]
  },
  {
    id: "warehouse.perimeter",
    venueIds: ["warehouse"],
    label: "محوطه پیرامونی انبار",
    aliases: ["پیرامون", "حصار", "محوطه"],
    environment: "perimeter",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "mall.main-entrance",
    venueIds: ["mall"],
    label: "ورودی اصلی مجتمع",
    aliases: ["ورودی", "درب اصلی", "گیت"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["people-count"]
  },
  {
    id: "mall.concourse",
    venueIds: ["mall"],
    label: "راهروی مشترک طبقات",
    aliases: ["راهرو", "پاساژ", "کریدور"],
    environment: "indoor-corridor",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "mall.escalator",
    venueIds: ["mall"],
    label: "پله برقی و آسانسور شیشه‌ای",
    aliases: ["پله برقی", "اسکالاتور", "آسانسور"],
    environment: "indoor-room",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "mall.food-court",
    venueIds: ["mall"],
    label: "فودکورت",
    aliases: ["فودکورت", "رستوران", "غذاخوری"],
    environment: "indoor-room",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "mall.parking",
    venueIds: ["mall"],
    label: "پارکینگ طبقاتی مجتمع",
    aliases: ["پارکینگ", "طبقاتی", "پارک"],
    environment: "parking",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: []
  },
  {
    id: "mall.control",
    venueIds: ["mall"],
    label: "اتاق کنترل مرکز خرید",
    aliases: ["اتاق کنترل", "حراست", "مانیتورینگ"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["continuous-record"]
  },
  {
    id: "pipeline.valve-station",
    venueIds: ["pipeline"],
    label: "ایستگاه شیر",
    aliases: ["ایستگاه شیر", "شیرآلات", "ولو"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "pipeline.route",
    venueIds: ["pipeline"],
    label: "مسیر خط لوله",
    aliases: ["مسیر لوله", "خط لوله", "حریم"],
    environment: "perimeter",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle", "thermal"]
  },
  {
    id: "pipeline.pump-station",
    venueIds: ["pipeline"],
    label: "ایستگاه پمپاژ",
    aliases: ["پمپاژ", "پمپ خانه", "بوستر"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "pipeline.leak-point",
    venueIds: ["pipeline"],
    label: "نقطه نشتی‌سنجی",
    aliases: ["نشتی", "نشت یاب", "بازرسی"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["thermal"]
  },
  {
    id: "transmission-line.tower",
    venueIds: ["transmission-line"],
    label: "پایه دکل",
    aliases: ["دکل", "پایه", "برج انتقال"],
    environment: "outdoor",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "transmission-line.corridor",
    venueIds: ["transmission-line"],
    label: "حریم خط انتقال",
    aliases: ["حریم", "کریدور", "مسیر خط"],
    environment: "perimeter",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle", "thermal"]
  },
  {
    id: "transmission-line.step-down",
    venueIds: ["transmission-line"],
    label: "پست تبدیل",
    aliases: ["پست تبدیل", "کاهنده", "ترانس"],
    environment: "outdoor",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "transmission-line.access",
    venueIds: ["transmission-line"],
    label: "مسیر دسترسی سرویس",
    aliases: ["جاده دسترسی", "مسیر سرویس", "راه خاکی"],
    environment: "outdoor",
    priority: "important",
    goal: "plate-capture",
    requiredFeatures: []
  },
  {
    id: "onshore-oil.wellhead",
    venueIds: ["onshore-oil"],
    label: "سرچاه",
    aliases: ["سرچاه", "چاه نفت", "wellhead"],
    environment: "outdoor",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["thermal"]
  },
  {
    id: "onshore-oil.tanks",
    venueIds: ["onshore-oil"],
    label: "مخازن ذخیره",
    aliases: ["مخزن", "تانک", "ذخیره سازی"],
    environment: "outdoor",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["thermal"]
  },
  {
    id: "onshore-oil.flare",
    venueIds: ["onshore-oil"],
    label: "مشعل",
    aliases: ["مشعل", "فلر", "سوزاننده"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["thermal"]
  },
  {
    id: "onshore-oil.control",
    venueIds: ["onshore-oil"],
    label: "اتاق کنترل میدان",
    aliases: ["اتاق کنترل", "کنترل", "دیسپاچینگ"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "onshore-oil.gate",
    venueIds: ["onshore-oil"],
    label: "گیت ورود میدان",
    aliases: ["گیت", "ورودی", "حراست"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["anpr"]
  },
  {
    id: "onshore-oil.perimeter",
    venueIds: ["onshore-oil"],
    label: "پیرامون میدان",
    aliases: ["پیرامون", "حصار", "محیط"],
    environment: "perimeter",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle", "thermal"]
  },
  {
    id: "offshore-oil.deck",
    venueIds: ["offshore-oil"],
    label: "عرشه اصلی",
    aliases: ["عرشه", "دک", "deck"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "offshore-oil.helipad",
    venueIds: ["offshore-oil"],
    label: "هلی‌پد",
    aliases: ["هلی پد", "هلیکوپتر", "باند هلی"],
    environment: "outdoor",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "offshore-oil.control",
    venueIds: ["offshore-oil"],
    label: "اتاق کنترل سکو",
    aliases: ["اتاق کنترل", "کنترل سکو"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["continuous-record"]
  },
  {
    id: "offshore-oil.lifeboat",
    venueIds: ["offshore-oil"],
    label: "محل قایق نجات",
    aliases: ["قایق نجات", "نجات", "اضطراری"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "offshore-oil.riser",
    venueIds: ["offshore-oil"],
    label: "مسیر لوله دریایی",
    aliases: ["رایزر", "لوله دریایی", "خط دریا"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["thermal"]
  },
  {
    id: "solar-farm.array",
    venueIds: ["solar-farm"],
    label: "آرایه پنل خورشیدی",
    aliases: ["پنل", "آرایه", "ماژول"],
    environment: "outdoor",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "solar-farm.inverter",
    venueIds: ["solar-farm"],
    label: "اینورتر و تجهیزات",
    aliases: ["اینورتر", "تجهیزات", "کانکس برق"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "solar-farm.substation",
    venueIds: ["solar-farm"],
    label: "پست تبدیل نیروگاه",
    aliases: ["پست", "ترانس", "تبدیل"],
    environment: "outdoor",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "solar-farm.perimeter",
    venueIds: ["solar-farm"],
    label: "حصار پیرامونی مزرعه",
    aliases: ["حصار", "فنس", "پیرامون"],
    environment: "perimeter",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle", "thermal"]
  },
  {
    id: "solar-farm.gate",
    venueIds: ["solar-farm"],
    label: "گیت ورود مزرعه",
    aliases: ["گیت", "درب", "ورودی"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: []
  },
  {
    id: "hydro-plant.dam",
    venueIds: ["hydro-plant"],
    label: "سد و دریچه‌ها",
    aliases: ["سد", "دریچه", "سرریز"],
    environment: "outdoor",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "hydro-plant.turbine-hall",
    venueIds: ["hydro-plant"],
    label: "توربین‌خانه",
    aliases: ["توربین", "ژنراتور", "سالن توربین"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "hydro-plant.control",
    venueIds: ["hydro-plant"],
    label: "اتاق کنترل نیروگاه",
    aliases: ["اتاق کنترل", "کنترل", "دیسپاچینگ"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["continuous-record"]
  },
  {
    id: "hydro-plant.channel",
    venueIds: ["hydro-plant"],
    label: "کانال و مسیر آب",
    aliases: ["کانال", "مسیر آب", "آبراه"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "hydro-plant.perimeter",
    venueIds: ["hydro-plant"],
    label: "پیرامون نیروگاه",
    aliases: ["پیرامون", "حصار", "محوطه"],
    environment: "perimeter",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "safe-city.square",
    venueIds: ["safe-city"],
    label: "میدان و فضای عمومی",
    aliases: ["میدان", "فضای عمومی", "پلازا"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: ["face-search"]
  },
  {
    id: "safe-city.park",
    venueIds: ["safe-city"],
    label: "پارک عمومی",
    aliases: ["پارک", "بوستان", "فضای سبز"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "safe-city.transit-stop",
    venueIds: ["safe-city"],
    label: "ایستگاه حمل‌ونقل عمومی",
    aliases: ["ایستگاه", "مترو", "اتوبوس"],
    environment: "outdoor",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: ["people-count"]
  },
  {
    id: "safe-city.gathering",
    venueIds: ["safe-city"],
    label: "محل تجمع",
    aliases: ["تجمع", "اجتماع", "میدان اصلی"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["people-count"]
  },
  {
    id: "safe-city.command",
    venueIds: ["safe-city"],
    label: "مرکز پایش شهری",
    aliases: ["مرکز پایش", "فرماندهی", "کنترل شهری"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["continuous-record"]
  },
  {
    id: "sports-complex.field",
    venueIds: ["sports-complex"],
    label: "زمین بازی و مسابقه",
    aliases: ["زمین", "چمن", "سالن بازی"],
    environment: "indoor-room",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "sports-complex.stand",
    venueIds: ["sports-complex"],
    label: "جایگاه تماشاگر",
    aliases: ["جایگاه", "سکو", "تماشاگر"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: ["people-count"]
  },
  {
    id: "sports-complex.gate",
    venueIds: ["sports-complex"],
    label: "گیت بازرسی ورودی",
    aliases: ["گیت", "بازرسی", "ورودی ورزشگاه"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "sports-complex.ticket",
    venueIds: ["sports-complex"],
    label: "باجه بلیت ورزشگاه",
    aliases: ["بلیت", "گیشه", "باجه"],
    environment: "outdoor",
    priority: "important",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "sports-complex.parking",
    venueIds: ["sports-complex"],
    label: "پارکینگ تماشاگران",
    aliases: ["پارکینگ", "پارک", "توقفگاه"],
    environment: "parking",
    priority: "important",
    goal: "plate-capture",
    requiredFeatures: []
  },
  {
    id: "sports-complex.locker",
    venueIds: ["sports-complex"],
    label: "رختکن ورزشکاران",
    aliases: ["رختکن", "دوش", "کمد"],
    environment: "indoor-room",
    priority: "optional",
    goal: "monitor",
    requiredFeatures: [],
    note: "نصب دوربین در رختکن ممنوع است"
  },
  {
    id: "data-centre.rack-aisle",
    venueIds: ["data-centre"],
    label: "راهروی رک",
    aliases: ["راهرو رک", "سالن سرور", "کریدور سرد"],
    environment: "indoor-corridor",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["continuous-record"]
  },
  {
    id: "data-centre.entrance",
    venueIds: ["data-centre"],
    label: "ورودی کنترل‌شده سالن",
    aliases: ["مانترپ", "ورودی", "اکسس کنترل"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "data-centre.power",
    venueIds: ["data-centre"],
    label: "اتاق برق و UPS",
    aliases: ["برق", "یو پی اس", "ژنراتور"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "data-centre.cooling",
    venueIds: ["data-centre"],
    label: "تأسیسات سرمایش",
    aliases: ["چیلر", "سرمایش", "هواساز"],
    environment: "indoor-room",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["thermal"]
  },
  {
    id: "data-centre.loading",
    venueIds: ["data-centre"],
    label: "محل تحویل تجهیزات",
    aliases: ["تحویل", "بارگیری", "انبار تجهیزات"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "airport.security-gate",
    venueIds: ["airport"],
    label: "گیت بازرسی امنیتی",
    aliases: ["بازرسی", "گیت امنیتی", "ایکس ری"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["face-search"]
  },
  {
    id: "airport.check-in",
    venueIds: ["airport"],
    label: "پیشخوان پذیرش",
    aliases: ["چک این", "پذیرش", "کانتر"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "airport.baggage",
    venueIds: ["airport"],
    label: "تحویل و دریافت بار",
    aliases: ["بار", "چمدان", "نوار بار"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "airport.transit-hall",
    venueIds: ["airport"],
    label: "سالن ترانزیت و انتظار",
    aliases: ["ترانزیت", "سالن انتظار", "گیت پرواز"],
    environment: "indoor-room",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: ["people-count"]
  },
  {
    id: "airport.apron",
    venueIds: ["airport"],
    label: "اپرون و باند",
    aliases: ["اپرون", "باند", "پارک هواپیما"],
    environment: "outdoor",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "airport.perimeter",
    venueIds: ["airport"],
    label: "پیرامون فرودگاه",
    aliases: ["پیرامون", "حصار", "محیط"],
    environment: "perimeter",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle", "thermal"]
  },
  {
    id: "port.container-yard",
    venueIds: ["port"],
    label: "محوطه کانتینر",
    aliases: ["کانتینر", "محوطه", "یارد"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "port.gate",
    venueIds: ["port"],
    label: "گیت ورود کامیون",
    aliases: ["گیت", "کامیون", "ورودی بندر"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: ["anpr"]
  },
  {
    id: "port.crane",
    venueIds: ["port"],
    label: "جرثقیل ساحلی",
    aliases: ["جرثقیل", "کرین", "گنتری"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "port.quay",
    venueIds: ["port"],
    label: "خط ساحلی و اسکله",
    aliases: ["اسکله", "ساحل", "لنگرگاه"],
    environment: "perimeter",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle", "thermal"]
  },
  {
    id: "port.customs",
    venueIds: ["port"],
    label: "محوطه گمرک و بازرسی",
    aliases: ["گمرک", "بازرسی", "ترخیص"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "railway.platform",
    venueIds: ["railway"],
    label: "سکوی مسافر",
    aliases: ["سکو", "پلتفرم", "محل انتظار"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: ["people-count"]
  },
  {
    id: "railway.platform-edge",
    venueIds: ["railway"],
    label: "لبه خطر سکو",
    aliases: ["لبه سکو", "خط زرد", "لبه خطر"],
    environment: "outdoor",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "railway.ticket-hall",
    venueIds: ["railway"],
    label: "سالن بلیت و گیت",
    aliases: ["بلیت", "گیت", "سالن فروش"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "railway.escalator",
    venueIds: ["railway"],
    label: "پله برقی و راه‌پله",
    aliases: ["پله برقی", "پله", "دسترسی"],
    environment: "indoor-corridor",
    priority: "important",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "railway.tunnel",
    venueIds: ["railway"],
    label: "دهانه تونل و مسیر",
    aliases: ["تونل", "مسیر ریل", "دهانه"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "mine.pit",
    venueIds: ["mine"],
    label: "دهانه معدن و جبهه‌کار",
    aliases: ["دهانه", "جبهه کار", "پیت"],
    environment: "outdoor",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "mine.haul-road",
    venueIds: ["mine"],
    label: "مسیر ماشین‌آلات سنگین",
    aliases: ["جاده معدن", "کامیون", "مسیر حمل"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: []
  },
  {
    id: "mine.explosives",
    venueIds: ["mine"],
    label: "دپوی مواد منفجره",
    aliases: ["مواد منفجره", "انبار دینامیت", "دپو"],
    environment: "outdoor",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: ["continuous-record"]
  },
  {
    id: "mine.weighbridge",
    venueIds: ["mine"],
    label: "باسکول",
    aliases: ["باسکول", "توزین", "وزن کشی"],
    environment: "outdoor",
    priority: "critical",
    goal: "plate-capture",
    requiredFeatures: ["anpr"]
  },
  {
    id: "mine.crusher",
    venueIds: ["mine"],
    label: "سنگ‌شکن و فرآوری",
    aliases: ["سنگ شکن", "فرآوری", "خردایش"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: []
  },
  {
    id: "water-plant.basin",
    venueIds: ["water-plant"],
    label: "حوضچه تصفیه",
    aliases: ["حوضچه", "استخر", "ته نشینی"],
    environment: "outdoor",
    priority: "important",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  },
  {
    id: "water-plant.chemical",
    venueIds: ["water-plant"],
    label: "اتاق مواد شیمیایی",
    aliases: ["مواد شیمیایی", "کلرزنی", "انبار شیمیایی"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "water-plant.pump",
    venueIds: ["water-plant"],
    label: "ایستگاه پمپاژ آب",
    aliases: ["پمپاژ", "پمپ", "موتورخانه"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-capture",
    requiredFeatures: []
  },
  {
    id: "water-plant.control",
    venueIds: ["water-plant"],
    label: "اتاق کنترل تصفیه‌خانه",
    aliases: ["اتاق کنترل", "اسکادا", "کنترل"],
    environment: "indoor-room",
    priority: "critical",
    goal: "face-identify",
    requiredFeatures: []
  },
  {
    id: "water-plant.perimeter",
    venueIds: ["water-plant"],
    label: "پیرامون تصفیه‌خانه",
    aliases: ["پیرامون", "حصار", "محوطه"],
    environment: "perimeter",
    priority: "critical",
    goal: "monitor",
    requiredFeatures: ["human-vehicle"]
  }
];

/** Free-text section available in every venue, so a space is never forced into a bad fit. */
export const genericSectionType: SectionType = {
  id: "generic.room",
  venueIds: [],
  label: "فضای عمومی (بدون دسته)",
  aliases: ["عمومی", "سایر", "متفرقه", "نامشخص", "اتاق معمولی"],
  environment: "indoor-room",
  priority: "optional",
  goal: "monitor",
  requiredFeatures: []
};

export const minimumAutocompleteLength = 3;

const venueById = new Map(venueTypes.map((venue) => [venue.id, venue]));
const sectionById = new Map(sectionTypes.map((section) => [section.id, section]));

export function findVenueType(id: string | undefined): VenueType | null {
  return id ? venueById.get(id as VenueTypeId) ?? null : null;
}

export function findSectionType(id: string | undefined, custom: SectionType[] = []): SectionType | null {
  if (!id) return null;
  if (id === genericSectionType.id) return genericSectionType;
  return sectionById.get(id) ?? custom.find((section) => section.id === id) ?? null;
}

/** Sections offered for a venue, most urgent first so the checklist reads top-down. */
export function sectionsForVenue(venueId: string | undefined, custom: SectionType[] = []): SectionType[] {
  const order: Record<SectionPriority, number> = { critical: 0, important: 1, optional: 2 };
  const owned = venueId
    ? sectionTypes.filter((section) => section.venueIds.includes(venueId as VenueTypeId))
    : sectionTypes;
  return [...owned, ...custom, genericSectionType].sort((a, b) => order[a.priority] - order[b.priority]);
}

/**
 * Persian-tolerant match for the autocomplete fields.
 *
 * Folds the Arabic forms of ye/kaf and strips ZWNJ so "کریدور" typed with an Arabic kaf,
 * or "راه‌پله" typed without the joiner, still finds its entry.
 */
function fold(text: string): string {
  return text
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/‌/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function scoreMatch(query: string, label: string, aliases: string[]): number {
  const target = fold(label);
  if (target.startsWith(query)) return 3;
  if (target.includes(query)) return 2;
  return aliases.some((alias) => fold(alias).includes(query)) ? 1 : 0;
}

/** Venue suggestions. Returns nothing below the three-character threshold. */
export function searchVenueTypes(query: string): VenueType[] {
  const needle = fold(query);
  if (needle.length < minimumAutocompleteLength) return [];
  return venueTypes
    .map((venue) => ({ venue, score: scoreMatch(needle, venue.label, venue.aliases) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.venue);
}

/**
 * Section suggestions within a venue.
 *
 * Unlike the venue field this also answers an empty query, because the room panel opens
 * with the full list of that venue's spaces — the user is picking from a known set
 * rather than searching a catalogue of fourteen.
 */
export function searchSectionTypes(
  query: string,
  venueId: string | undefined,
  custom: SectionType[] = []
): SectionType[] {
  const pool = sectionsForVenue(venueId, custom);
  const needle = fold(query);
  if (!needle) return pool;
  if (needle.length < minimumAutocompleteLength) return [];
  return pool
    .map((section) => ({ section, score: scoreMatch(needle, section.label, section.aliases) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.section);
}

export function createCustomSectionType(
  label: string,
  base: Partial<SectionType> = {}
): SectionType {
  return {
    id: `custom.${Date.now().toString(36)}-${Math.floor(Math.random() * 1e4).toString(36)}`,
    venueIds: [],
    label: label.trim(),
    aliases: [],
    environment: base.environment ?? "indoor-room",
    priority: base.priority ?? "important",
    goal: base.goal ?? "face-capture",
    requiredFeatures: base.requiredFeatures ?? [],
    note: base.note,
    isCustom: true
  };
}
