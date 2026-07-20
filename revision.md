## نتیجه بررسی

نسخه فعلی از نظر معماری، رابط کاربری و ایده‌ی محصول پیشرفت خوبی کرده؛ اما **موتور پیشنهاد و ویزارد هنوز در حد یک Prototype مبتنی بر Rule است، نه یک طراح مهندسی قابل اتکا**.

در بررسی محاسبه‌گرها و هسته پیشنهاددهنده، این موارد جدی پیدا شد:

| وضعیت                 | بخش                                                      |
| --------------------- | -------------------------------------------------------- |
| **غلط**               | محاسبه حساسیت نور کم                                     |
| **غلط/مبهم**          | ظرفیت RAID 1                                             |
| **غلط**               | محاسبه هاست‌های `/31` و `/32`                            |
| **ناسازگار**          | واحد Kbps/Mbps و GB/TB در محاسبه ظرفیت                   |
| **گمراه‌کننده**       | تأثیر ارتفاع و زاویه نصب در Planner                      |
| **بسیار ساده‌شده**    | انتخاب دوربین صرفاً براساس مگاپیکسل                      |
| **ناقص**              | محاسبه UPS، PoE، ظرفیت RAID و Decode دستگاه ضبط          |
| **صوری**              | امتیازهای ۹۰ و ۹۵ درصدی پلن‌ها                           |
| **خطای معماری خروجی** | متریک بالای صفحه براساس اولین پلن است، نه پلن انتخاب‌شده |

---

# ۱. مشکل اصلی موتور پیشنهاد دوربین

در کد فعلی، وضوح پیشنهادی به این صورت تعیین می‌شود:

```ts
plate => 8MP
face / mixed => 5MP
general => 3MP
```

و سپس اولین دوربینی انتخاب می‌شود که مگاپیکسل آن از این مقدار بیشتر باشد.

این منطق از نظر طراحی دوربین مداربسته صحیح نیست.

برای تشخیص چهره، پلاک یا نظارت عمومی، **مگاپیکسل به‌تنهایی تعیین‌کننده نیست**. عواملی مانند عرض صحنه، فاصله سوژه، زاویه دید، تراکم پیکسلی، نور، سرعت سوژه، شاتر، فشرده‌سازی، محل نصب و کیفیت اپتیک روی نتیجه اثر دارند. ([Axis White Papers][1])

مثلاً یک دوربین ۴ مگاپیکسل با لنز ۱۲ میلی‌متر ممکن است برای چهره در فاصله ۱۵ متر بهتر از یک دوربین ۸ مگاپیکسل با لنز ۲.۸ میلی‌متر باشد.

## مدل صحیح انتخاب دوربین

برای هر ناحیه باید این ورودی‌ها اضافه شوند:

```ts
type ProjectZone = {
  name: string;

  cameraCount?: number;
  outdoor: boolean;

  task:
    | "monitor"
    | "detect"
    | "observe"
    | "recognize"
    | "identify"
    | "plate-capture"
    | "anpr";

  targetDistanceM: number;
  targetSceneWidthM: number;

  mountingHeightM: number;
  targetHeightM: number;
  cameraTiltDeg?: number;

  minimumPpm?: number;
  minimumFps?: number;

  lighting:
    | "daylight"
    | "controlled"
    | "low-light"
    | "backlight"
    | "complete-darkness";

  minimumLux?: number;
  requiredIrDistanceM?: number;

  subjectSpeedKmh?: number;
  audioRequired: boolean;

  ipRating?: string;
  ikRating?: string;
};
```

سپس برای هر محصول:

```text
عرض صحنه در فاصله هدف
= 2 × فاصله × tan(HFOV / 2)

تراکم پیکسلی
= تعداد پیکسل افقی ÷ عرض صحنه

وضعیت قبولی
= PPM واقعی ≥ PPM موردنیاز
```

فرمول زاویه دید:

[
HFOV=2\tan^{-1}\left(\frac{S_w}{2f}\right)
]

فرمول عرض صحنه:

[
W=2D\tan\left(\frac{HFOV}{2}\right)
]

فرمول تراکم پیکسلی:

[
PPM=\frac{P_x}{W}
]

این مدل با رابطه استاندارد میدان دید در سیستم‌های تصویربرداری مطابقت دارد. در لنزهای واقعی، اعوجاج و محل صفحه اصلی اپتیکی نیز باعث اختلاف با مدل ایده‌آل می‌شوند؛ بنابراین FOV درج‌شده در دیتاشیت محصول باید بر محاسبه هندسی اولویت داشته باشد. ([Edmund Optics][2])

---

# ۲. بررسی DORI

فرمول موجود در محاسبه‌گر DORI:

```ts
distance = widthPx / (ppm * 2 * tan(fov / 2))
```

از نظر هندسی، برای مدل Pinhole و صفحه‌ای عمود بر محور دوربین درست است.

مقادیر فعلی نیز تقریباً مطابق مدل IEC 62676-4:2014 هستند:

| سطح          |          مقدار |
| ------------ | -------------: |
| پایش         |      12.5 px/m |
| آشکارسازی    |        25 px/m |
| مشاهده       |      62.5 px/m |
| بازشناسی     |       125 px/m |
| شناسایی هویت |       250 px/m |
| بازرسی       | حدود 1000 px/m |

([Axis White Papers][3])

## اصلاحات لازم

### نام‌گذاری فارسی

عبارت‌های فعلی کمی مبهم‌اند. بهتر است این نام‌ها استفاده شوند:

* Monitoring: پایش
* Detection: آشکارسازی حضور
* Observation: مشاهده جزئیات کلی
* Recognition: بازشناسی
* Identification: شناسایی هویت
* Inspection: بازرسی دقیق

### اضافه‌کردن سطح Monitoring و Inspection

در محاسبه‌گر DORI مستقل، Monitoring و Inspection نمایش داده نمی‌شوند. در شبیه‌ساز سه‌بعدی Monitoring وجود دارد، اما Inspection وجود ندارد.

### نسخه استاندارد مشخص شود

در رابط بنویسید:

> مدل تراکم پیکسلی مطابق IEC 62676-4:2014

نه اینکه فقط بنویسید «مطابق استاندارد IEC». پیش‌نویس‌های جدیدتر استاندارد در حال تغییر دسته‌ها و تراکم‌های تصویری هستند؛ بنابراین بهتر است مدل استاندارد نسخه‌بندی شود. ([dinmedia][4])

### DORI را برای پلاک استفاده نکنید

DORI عمومی برای مشاهده انسان و صحنه است. برای پلاک‌خوانی باید معیار جداگانه داشته باشید:

* عرض پلاک در تصویر
* تعداد پیکسل روی پلاک
* زاویه افقی و عمودی پلاک
* سرعت خودرو
* زمان نوردهی
* بازتاب IR
* فاصله و عرض مسیر
* تعداد Lane

بنابراین گزینه `plate` نباید فقط به `8MP` یا DORI عمومی تبدیل شود.

---

# ۳. Planner فعلی ارتفاع و زاویه را در محاسبه استفاده نمی‌کند

در `/calculators/planner` پارامترهای ارتفاع نصب و زاویه نصب از کاربر گرفته می‌شوند، اما تابع اصلی فقط این پارامترها را دریافت می‌کند:

```ts
sensorW
sensorH
focal
hPixels
rangeM
```

ارتفاع و زاویه فقط برای رسم Canvas استفاده می‌شوند و در PPM، عرض صحنه یا فاصله DORI اثر ندارند.

بنابراین کاربر می‌تواند ارتفاع را از ۲ متر به ۱۰ متر یا Tilt را از ۱۰ به ۶۰ درجه تغییر دهد، اما نتیجه‌ی فنی اصلی تغییر نمی‌کند. این رفتار گمراه‌کننده است.

## مدل صحیح نمای جانبی

اگر:

* ارتفاع دوربین: (h_c)
* ارتفاع هدف: (h_t)
* زاویه رو به پایین دوربین: (\theta)
* زاویه دید عمودی: (VFOV)

باشد، محل برخورد پرتو پایین و بالا با صفحه هدف باید محاسبه شود:

[
D_{near}=
\frac{h_c-h_t}
{\tan(\theta+VFOV/2)}
]

[
D_{far}=
\frac{h_c-h_t}
{\tan(\theta-VFOV/2)}
]

فرمول دوم فقط وقتی معتبر است که پرتو بالایی واقعاً با صفحه هدف برخورد کند. اگر:

[
\theta \le VFOV/2
]

باشد، پرتو بالایی ممکن است به آسمان یا بالای صفحه هدف برود و فاصله دور تعریف‌نشده شود.

## مدل حرفه‌ای‌تر

برای نسخه نهایی Planner باید:

1. موقعیت دوربین در سه محور تعیین شود.
2. Yaw، Pitch و Roll اعمال شوند.
3. از چهار گوشه تصویر Ray ساخته شود.
4. Rayها با صفحه زمین یا صفحه هدف برخورد داده شوند.
5. Polygon واقعی پوشش رسم شود.
6. تراکم پیکسلی در نقاط مختلف Polygon محاسبه شود.
7. PPM به‌صورت Heatmap نمایش داده شود.

در این حالت PPM دیگر یک عدد ثابت نیست؛ هرچه از دوربین دورتر می‌شویم، تراکم پیکسلی کاهش پیدا می‌کند.

---

# ۴. ایراد شبیه‌ساز سه‌بعدی

فرمول زاویه دید در نسخه سه‌بعدی درست است، اما عرض صحنه از این رابطه محاسبه شده:

```ts
sceneWidth = slantRange * sensorW / focal;
```

و فاصله‌های DORI نیز از این رابطه به‌دست می‌آیند:

```ts
distance = resolutionWidth * focal / (ppm * sensorWidth);
```

این روابط برای صفحه‌ای عمود بر محور نوری قابل قبول‌اند، اما نمایش فعلی، نواحی DORI را روی زمین مسطح رسم می‌کند. این دو مدل دقیقاً یکسان نیستند.

## اصلاح ضروری

باید دو حالت جدا داشته باشید:

### حالت Target Plane

برای چهره یا پلاک، یک صفحه عمودی در فاصله هدف قرار داده شود. PPM روی همان صفحه محاسبه شود.

### حالت Ground Coverage

برای محوطه و پوشش عمومی، Frustum دوربین با صفحه زمین برخورد داده شود و شکل واقعی محدوده روی زمین نمایش داده شود.

اکنون نرم‌افزار این دو مفهوم را با هم ترکیب کرده است.

## اطلاعاتی که باید به 3D اضافه شود

* ارتفاع هدف
* عرض و ارتفاع هدف
* زاویه Yaw
* زاویه Roll
* اعوجاج لنز
* نوع لنز Rectilinear یا Fisheye
* موانع
* دیوار
* ستون
* قفسه
* Occlusion
* نمایش تراکم پیکسلی روی سطح
* ناحیه خارج از فوکوس
* حداقل و حداکثر فاصله IR
* ارتفاع مناسب نصب براساس زاویه چهره

---

# ۵. ناسازگاری اندازه سنسور

در محاسبه‌گر لنز، برای سنسور `1/4"` عرض ۳.۲ میلی‌متر استفاده شده است.

اما در شبیه‌ساز سه‌بعدی برای همان سنسور عرض ۳.۶ میلی‌متر استفاده شده است.

این باعث می‌شود یک دوربین با ورودی مشابه در دو بخش، FOV و فاصله DORI متفاوت بدهد.

طبق جدول‌های رایج سنسور، ابعاد تقریبی Active Area برای قالب `1/4"` حدود ۳.۶ × ۲.۷ میلی‌متر است، اما مقدار واقعی می‌تواند براساس مدل سنسور متفاوت باشد. عبارت `1/4"` نیز اندازه واقعی قطر سنسور نیست. ([Teledyne Vision Solutions][5])

## راه‌حل

یک فایل مرجع مشترک ایجاد شود:

```ts
// src/lib/optics/sensor-formats.ts

export const SENSOR_FORMATS = {
  "1/4": {
    widthMm: 3.6,
    heightMm: 2.7,
    approximate: true
  },
  "1/3": {
    widthMm: 4.8,
    heightMm: 3.6,
    approximate: true
  },
  "1/2.8": {
    widthMm: 5.37,
    heightMm: 3.02,
    approximate: true
  }
};
```

ولی در کاتالوگ محصولات، در صورت وجود اندازه واقعی سنسور، همان مقدار دیتاشیت استفاده شود.

---

# ۶. محاسبه فاصله کانونی

فرمول فعلی:

```ts
focal = distance * sensorWidth / sceneWidth;
```

برای مدل هندسی ساده و فاصله‌های معمول دوربین مداربسته درست است:

[
f=\frac{D\times S_w}{W}
]

اما باید در خروجی بنویسید:

> فاصله کانونی نظری؛ نزدیک‌ترین لنز واقعی موجود باید انتخاب و FOV دیتاشیت کنترل شود.

مثلاً اگر نتیجه ۳.۴ میلی‌متر شد، خروجی نباید فقط `3.40 mm` باشد. بهتر است بگوید:

```text
فاصله کانونی نظری: 3.4 mm
لنزهای قابل بررسی: 3.6 mm یا وریفوکال 2.8–12 mm
```

همچنین برای لنزهای Fisheye این فرمول معتبر نیست.

---

# ۷. فرمول حساسیت نور کم غلط است

کد فعلی:

```ts
v = sensorWidth / (fNumber * fNumber)
```

این فرمول معیار استانداردی برای حساسیت نور کم نیست.

عرض سنسور نباید به‌صورت خطی وارد شود. چیزی که در جمع‌آوری فوتون اهمیت بیشتری دارد، اندازه پیکسل و مساحت پیکسل است، نه فقط عرض کل سنسور. علاوه بر آن، Quantum Efficiency، نویز خوانش، Dark Noise، Gain، Shutter، Lens Transmission و پردازش تصویر نیز مهم‌اند. ([Teledyne Vision Solutions][6])

## مدل اصلاح‌شده

### اثر دیافراگم

برای دو لنز با F-numberهای (N_1) و (N_2):

[
Ratio_{lens}=
\left(\frac{N_2}{N_1}\right)^2
]

تفاوت استاپ:

[
Stops=
2\log_2\left(\frac{N_2}{N_1}\right)
]

F-number نسبت فاصله کانونی به قطر دهانه مؤثر است و مستقیماً با میزان نور عبوری ارتباط دارد. ([Edmund Optics][7])

### اثر اندازه پیکسل

[
PixelPitch=
\frac{SensorWidth}{HorizontalPixels}
]

[
PixelAreaRatio=
\left(
\frac{Pitch_1}{Pitch_2}
\right)^2
]

### نسبت تقریبی کل

در صورت برابر بودن Shutter، QE، T-stop و پردازش:

[
ApproximatePhotonRatio=
LensRatio\times PixelAreaRatio
]

نام این ابزار بهتر است از «مقایسه حساسیت» به این مورد تغییر کند:

> مقایسه نظری عملکرد نور کم

و در خروجی سه نتیجه جدا نمایش دهد:

* برتری دیافراگم
* برتری مساحت پیکسل
* نسبت نظری کلی
* محدودیت‌های محاسبه

---

# ۸. محاسبه ظرفیت ذخیره‌سازی

در موتور پیشنهاد، فرمول زیر استفاده شده:

```ts
storageTb = totalBandwidthMbps * archiveDays * 0.0108;
```

این فرمول برای ضبط ۲۴ ساعته و TB ده‌دهی صحیح است:

[
Storage_{TB}=
Mbps\times Days\times0.0108
]

چون:

[
1Mbps\times86400s\div8=10.8GB/day
]

اما در محاسبه‌گر ظرفیت مستقل، Kbps با ۱۰۲۴ به بیت تبدیل می‌شود، Mbps با تقسیم بر ۱۰۲۴ محاسبه می‌شود و TB معادل (1024^4) بایت در نظر گرفته شده است.

این یعنی خروجی با برچسب `Kbps`, `Mbps`, `GB`, `TB` نمایش داده می‌شود ولی در عمل مقادیر Binary مثل Kibibit، Mebibit، GiB و TiB استفاده شده‌اند.

## اصلاح واحدها

برای مدل ده‌دهی که در دیتاشیت شبکه و هارد رایج است:

```ts
const bitsPerSecond = kbps * 1000;
const totalMbps = kbps / 1000;

const GB = 1_000_000_000;
const TB = 1_000_000_000_000;
```

فرمول عمومی:

[
Storage_{TB}=
\frac{
TotalMbps\times10^6\times3600\times HoursPerDay\times Days
}{
8\times10^{12}
}
]

یا:

[
Storage_{TB}
============

TotalMbps\times HoursPerDay\times Days\times0.00045
]

## پارامترهای ناقص

محاسبه فعلی باید این ورودی‌ها را هم داشته باشد:

* ضبط ۲۴ ساعته یا Motion
* درصد فعالیت صحنه
* VBR یا CBR
* صدای دوربین
* Stream اصلی و فرعی
* ضبط Event
* ضریب سربار فایل و Metadata
* فضای رزرو سیستم
* فضای غیرقابل استفاده هارد
* ظرفیت RAID
* Hot Spare
* درصد اطمینان
* افت ظرفیت ناشی از فرمت
* Bitrate روز و شب

Bitrate فقط به رزولوشن وابسته نیست و می‌تواند با فعالیت صحنه، نویز شب، FPS، تنظیم کیفیت و نوع فشرده‌سازی تغییر زیادی کند. محاسبه‌گرهای رسمی ذخیره‌سازی نیز FPS، فشرده‌سازی، ساعات ضبط، Motion و افزونگی را جداگانه دریافت می‌کنند. ([Axis][8])

## فرمول پیشنهادی نهایی

```ts
requiredStorageTb =
  baseStorageTb
  * recordingDutyCycle
  * (1 + audioOverhead)
  * (1 + filesystemOverhead)
  * (1 + vbrSafetyMargin);
```

پیشنهاد اولیه:

```text
VBR margin: 20%
Filesystem/metadata: 5%
Reserve: 10%
```

این ضرایب باید قابل تنظیم و در گزارش شفاف باشند، نه مخفی.

---

# ۹. Bitrateهای Hardcoded قابل اعتماد نیستند

در محاسبه‌گر ظرفیت، برای هر رزولوشن یک Bitrate ثابت در نظر گرفته شده و سپس ضرایب ثابت برای H.265، H.265+ و Smart265 اعمال می‌شود.

این اعداد فقط می‌توانند Default تخمینی باشند، نه مقدار قطعی.

## بهتر است سه حالت داشته باشید

### حالت سریع

کاربر رزولوشن، FPS، کدک و سطح حرکت را انتخاب کند و سیستم یک بازه بدهد:

```text
Bitrate تخمینی: 2.5 تا 4.5 Mbps
مقدار طراحی ایمن: 4.5 Mbps
```

### حالت دیتاشیت

برای محصول واقعی، `recommendedBitrateKbps` از دیتاشیت یا پروفایل برند دریافت شود.

### حالت واقعی

کاربر Bitrate واقعی Stream یا فایل نمونه را وارد کند.

خروجی ذخیره‌سازی نیز باید:

* Typical
* Conservative
* Worst-case

را جدا نشان دهد.

---

# ۱۰. RAID 1 فعلی غلط یا حداقل بسیار مبهم است

کد فعلی:

```ts
RAID1 = floor(disks / 2) * diskSize
```

مثلاً برای ۴ دیسک ۴ ترابایتی، خروجی ۸ ترابایت می‌دهد. این در واقع شبیه دو Mirror مستقل یا RAID 10 است، نه یک RAID 1 معمولی.

برای RAID 1 دو دیسکی:

[
Usable=min(DiskSizes)
]

RAID 1 معمولاً ظرفیت معادل یک دیسک دارد. فرمول‌های عمومی برای RAID 5، RAID 6 و RAID 10 نیز باید براساس کوچک‌ترین دیسک محاسبه شوند. ([Dell][9])

## فرمول‌های صحیح

فرض کنیم:

[
S=min(DiskSizes)
]

| سطح     |                   ظرفیت قابل استفاده |
| ------- | -----------------------------------: |
| RAID 0  |                          (N\times S) |
| RAID 1  |           (S)، معمولاً دقیقاً ۲ دیسک |
| RAID 5  |                      ((N-1)\times S) |
| RAID 6  |                      ((N-2)\times S) |
| RAID 10 | ((N/2)\times S)، تعداد زوج و حداقل ۴ |

در Wizard نیز این شرط اشتباه وجود دارد:

```ts
driveBays * maxDriveCapacityTb >= requiredStorage
```

این فقط ظرفیت خام است. اگر RAID 5 یا RAID 6 انتخاب شود، ظرفیت قابل استفاده کمتر است.

## اصلاح موتور پیشنهاد

```ts
const usableStorage = calculateRaidUsable({
  raidLevel,
  driveCount,
  driveCapacityTb
});

if (usableStorage < requiredStorageTb) {
  reject("ظرفیت قابل استفاده پس از RAID کافی نیست");
}
```

همچنین:

* یک Bay برای Hot Spare در پلن حرفه‌ای
* محدودیت تعداد دیسک هر RAID
* محدودیت RAID واقعی NVR
* یکسان نبودن اندازه دیسک‌ها
* ظرفیت فرمت‌شده

در نظر گرفته شود.

---

# ۱۱. IPv4 برای `/31` و `/32` غلط است

در محاسبه‌گر Prefix:

```ts
hosts = prefix <= 30 ? total - 2 : 0;
```

و ورودی نیز فقط `/1` تا `/31` را قبول می‌کند.

در محاسبه‌گر کامل IP نیز برای `/31` و `/32` تعداد هاست صفر است.

## رفتار صحیح

* `/0`: کل فضای IPv4
* `/30`: دو هاست سنتی
* `/31`: دو آدرس قابل استفاده برای لینک Point-to-Point
* `/32`: یک آدرس یا Host Route

RFC 3021 استفاده از هر دو آدرس `/31` در لینک‌های Point-to-Point را تعریف می‌کند. RFC 4632 نیز `/31` را برای P2P و `/32` را به‌عنوان Host Route نشان می‌دهد. ([RFC Editor][10])

## اصلاح پیشنهادی

یک انتخاب اضافه شود:

```text
نوع Subnet:
○ شبکه LAN معمولی
○ لینک Point-to-Point
○ Host Route
```

برای `/31` در حالت P2P:

```ts
usableHosts = 2;
firstHost = network;
lastHost = network + 1;
broadcast = null;
```

برای `/32`:

```ts
usableHosts = 1;
network = ip;
firstHost = ip;
lastHost = ip;
broadcast = null;
```

---

# ۱۲. Wireless Link Budget

فرمول فعلی:

```ts
FSPL =
  32.44
  + 20 * log10(distanceKm)
  + 20 * log10(frequencyMHz);

Rx =
  TxPower
  + TxGain
  - TxLoss
  + RxGain
  - RxLoss
  - FSPL;
```

این فرمول برای افت فضای آزاد صحیح است و با مدل Free-Space ITU-R P.525 هماهنگ است. ([ITU][11])

اما خروجی «توان دریافتی» به‌تنهایی نمی‌گوید لینک کار می‌کند یا نه.

## موارد لازم

### حساسیت گیرنده

```text
Receiver sensitivity at selected MCS
```

### Fade Margin

[
FadeMargin=
ReceivedPower-ReceiverSensitivity
]

### EIRP

[
EIRP=
TxPower+TxAntennaGain-TxCableLoss
]

### تلفات اضافی

* Connector
* Polarization mismatch
* Radome
* Rain
* Atmospheric absorption
* Multipath
* Obstruction
* Vegetation

### خروجی مناسب

```text
توان دریافتی: -61 dBm
حساسیت گیرنده: -75 dBm
حاشیه لینک: 14 dB
نتیجه: قابل استفاده، ولی برای پایداری بالا حاشیه بیشتری توصیه می‌شود
```

همچنین باید Bandwidth کانال و MCS انتخاب شود تا ظرفیت واقعی لینک تخمین زده شود.

---

# ۱۳. Fresnel

فرمول فعلی:

```ts
17.32 * sqrt(distanceKm / (4 * frequencyGHz))
```

این فرمول برای شعاع اولین ناحیه فرنل در **نقطه میانی لینک** صحیح است.

اما برای مانعی که دقیقاً وسط نیست، باید از فرمول عمومی استفاده شود:

[
r_1=
17.32
\sqrt{
\frac{d_1d_2}
{f(d_1+d_2)}
}
]

که در آن:

* (d_1) فاصله مانع تا فرستنده برحسب km
* (d_2) فاصله مانع تا گیرنده برحسب km
* (f) فرکانس برحسب GHz

است.

برای طراحی عملی، حداقل حدود ۶۰٪ ناحیه فرنل باید پاک باشد. ([Cisco][12])

پس ورودی‌ها باید شوند:

* فاصله کل
* فاصله مانع از سمت اول
* ارتفاع مانع
* ارتفاع دکل اول
* ارتفاع دکل دوم
* انحنای زمین
* درصد پاک‌سازی موردنیاز

---

# ۱۴. ACK

فرمول فعلی:

```ts
RTT = 2 * distance / speedOfLight
```

از نظر زمان انتشار امواج درست است، اما نام «زمان ACK» دقیق نیست.

این فقط:

> Round-trip propagation delay

را محاسبه می‌کند.

زمان ACK واقعی در تجهیزات وایرلس شامل پردازش، Slot Time، SIFS، زمان ارسال Frame و تنظیم Vendor-specific نیز هست.

نام ابزار بهتر است:

> زمان انتشار رفت‌وبرگشت لینک

و خروجی تقریبی:

```text
Propagation RTT ≈ 6.67 µs per km
```

---

# ۱۵. تبدیل mW و dBm

فرمول‌ها صحیح‌اند:

[
dBm=10\log_{10}(mW)
]

[
mW=10^{dBm/10}
]

تنها ایراد این است که برای `mW <= 0` مقدار صفر dBm برمی‌گرداند. صفر میلی‌وات معادل صفر dBm نیست؛ از نظر لگاریتمی تعریف‌نشده یا منفی بی‌نهایت است.

برای ورودی نامعتبر باید پیام Validation نمایش داده شود.

---

# ۱۶. انتخاب NVR ناقص است

اکنون فقط این موارد بررسی می‌شوند:

* تعداد کانال
* Incoming Bandwidth
* حداکثر رزولوشن دوربین
* تعداد Bay × ظرفیت هر هارد
* وجود RAID

اما مدل داده اطلاعات بیشتری دارد که موتور استفاده نمی‌کند:

* `maxDecodeMp`
* `codecs`
* `builtInPoePorts`

## شروط لازم

### کانال

```text
Channels ≥ cameras + expansion reserve
```

### پهنای‌باند ورودی

```text
Incoming bandwidth
≥ camera main-stream total × safety factor
```

### پهنای‌باند خروجی

برای کاربران Remote:

```text
Outgoing bandwidth
≥ streams watched simultaneously
```

فیلد `remoteViewingUsers` در Wizard دریافت می‌شود، اما در موتور پیشنهاد استفاده نمی‌شود.

### Decode Capacity

NVR ممکن است ۳۲ دوربین را ضبط کند، ولی فقط چند کانال ۸MP را همزمان Decode کند.

باید این موارد بررسی شوند:

* Live view layout
* Playback channels
* Decode channels at resolution/FPS
* HDMI output resolution

### سازگاری Codec

باید اشتراک Codecهای دوربین و NVR وجود داشته باشد:

```ts
camera.codecs.some(codec =>
  recorder.codecs.includes(codec)
)
```

### قابلیت‌های هوشمند

* AI by camera
* AI by recorder
* تعداد کانال Face
* تعداد کانال ANPR
* تعداد کانال Human/Vehicle
* محدودیت هوشمندی در رزولوشن مشخص

### PoE داخلی

اگر NVR دارای PoE داخلی است، موتور باید آن را با سوئیچ خارجی مقایسه کند و هزینه تکراری تولید نکند.

---

# ۱۷. انتخاب سوئیچ PoE ناقص است

کد فعلی فقط تعداد پورت و مجموع توان را بررسی می‌کند.

اما مدل داده شامل این موارد است و استفاده نمی‌شوند:

* حداکثر توان هر پورت
* سرعت Uplink
* تعداد کل پورت
* Managed بودن
* Surge Protection

## شروط ضروری

### توان هر پورت

ممکن است بودجه کل کافی باشد ولی یک PTZ به ۳۰ وات نیاز داشته باشد و پورت فقط ۱۵.۴ وات بدهد.

```text
maxPowerPerPort ≥ max camera required power
```

### بودجه کل

[
RequiredPoeBudget=
\sum MaxCameraPower\times SafetyFactor
]

ضریب ۲۰٪ به‌عنوان Default خوب است، اما باید تنظیم‌پذیر باشد.

### پورت رزرو

```text
Required ports =
Camera count + uplink/SFP needs + expansion reserve
```

### Uplink

```text
Uplink usable bandwidth
≥ Total camera bitrate × safety factor
```

### طول کابل

استاندارد معمول Ethernet مسی تا ۱۰۰ متر Channel را در نظر می‌گیرد که معمولاً شامل ۹۰ متر کابل ثابت و ۱۰ متر Patch Cord است. برای مسیر بالاتر نباید صرفاً به فیلد `extendRangeM` اعتماد کرد؛ Fiber، Remote Switch یا Ethernet Extender باید پیشنهاد شود. ([Cisco][13])

### معماری طبقات

فیلد تعداد طبقات در Wizard وجود دارد، اما در توپولوژی شبکه استفاده نمی‌شود.

برای پروژه چندطبقه باید:

* سوئیچ هر طبقه
* Backbone
* Fiber uplink
* Rack
* SFP
* Patch panel
* فاصله MDF تا IDF

محاسبه شود.

---

# ۱۸. UPS فعلی تقریباً تصادفی انتخاب می‌شود

در موتور پیشنهاد، برای پلن متعادل ارزان‌ترین UPS و برای پلن حرفه‌ای دومین UPS ارزان انتخاب می‌شود:

```ts
sort(byPrice)[professional ? 1 : 0]
```

هیچ محاسبه‌ای برای موارد زیر وجود ندارد:

* Load
* VA
* Watt
* Power factor
* Runtime
* Battery
* Efficiency

در حالی که مدل UPS این فیلدها را دارد.

## محاسبه صحیح

بار کل:

[
Load_W=
NVR_W+
HDD_W+
Switch_W+
CameraLoad_W+
Router_W+
Other_W
]

اگر دوربین‌ها توسط سوئیچ PoE تغذیه می‌شوند، مصرف آن‌ها باید با راندمان سوئیچ محاسبه شود.

ظرفیت UPS:

```text
UPS output watts ≥ load watts × 1.25
```

هم VA و هم Watt باید کنترل شوند و Runtime باید از منحنی واقعی UPS یا داده دیتاشیت محاسبه شود. راهنماهای APC نیز توصیه می‌کنند UPS حاشیه توان داشته باشد و Runtime براساس بار واقعی بررسی شود. ([Schneider Electric][14])

ویزارد باید از کاربر بپرسد:

```text
مدت پشتیبانی موردنیاز:
○ فقط خاموش‌سازی امن
○ ۱۵ دقیقه
○ ۳۰ دقیقه
○ ۶۰ دقیقه
○ مقدار سفارشی
```

---

# ۱۹. امتیاز پلن واقعی نیست

در کد:

```ts
technicalScore = 35;
energyScore = 8;
```

و بخش زیادی از امتیازها ثابت هستند.

در نتیجه امتیاز ۹۲ یا ۹۵ لزوماً نشان‌دهنده تطابق واقعی نیست.

## مدل صحیح امتیازدهی

```text
Technical fit       0–35
Capacity headroom   0–15
Image quality       0–15
Reliability         0–10
Stock availability  0–10
Price fit           0–10
Preferred brand     0–5
```

مثلاً Technical Fit باید از نسبت‌های واقعی ساخته شود:

```ts
bandwidthScore =
  clamp(recorderBandwidth / requiredBandwidth, 1, 2);

poeScore =
  clamp(poeBudget / requiredPoe, 1, 2);

storageScore =
  clamp(usableStorage / requiredStorage, 1, 2);

ppmScore =
  clamp(actualPpm / requiredPpm, 1, 2);
```

همچنین اگر یک Constraint قطعی رد شود، محصول نباید امتیاز بگیرد.

---

# ۲۰. متریک‌های صفحه نتیجه به پلن انتخابی وابسته نیستند

در انتهای موتور، متریک‌ها از `plans[0]` ساخته می‌شوند:

```ts
const selectedCameraItems = plans[0]?.items...
```

اما در رابط کاربر می‌تواند بین اقتصادی، متعادل و حرفه‌ای جابه‌جا شود. بنابراین ممکن است پلن حرفه‌ای انتخاب باشد ولی بالای صفحه Bitrate، Storage و Resolution پلن اقتصادی نمایش داده شود.

## اصلاح مدل داده

هر پلن باید متریک خودش را داشته باشد:

```ts
type RecommendationPlan = {
  id: PlanId;
  items: RecommendationItem[];

  metrics: {
    bandwidthMbps: number;
    storageRawTb: number;
    storageUsableTb: number;
    poeLoadW: number;
    poeBudgetW: number;
    upsLoadW: number;
    estimatedRuntimeMin?: number;
    expansionPorts: number;
  };
};
```

و رابط باید از:

```ts
selected.metrics
```

استفاده کند.

---

# ۲۱. ورودی‌های Wizard که اکنون عملاً استفاده نمی‌شوند

ویزارد این اطلاعات را دریافت می‌کند:

* نوع پروژه
* مساحت
* تعداد طبقات
* ورودی‌ها
* کاربران مشاهده همزمان

اما موتور پیشنهاد عمدتاً از تعداد دوربین، هدف، فضای باز، آرشیو، برند، مسیر کابل و چند Toggle استفاده می‌کند. بنابراین بخشی از Wizard فعلاً ظاهر حرفه‌ای دارد ولی تأثیر مهندسی واقعی ندارد.

## نحوه استفاده صحیح

### نوع پروژه

Preset فنی تعیین کند:

| پروژه   | پارامترهای پیشنهادی             |
| ------- | ------------------------------- |
| فروشگاه | صندوق، ورودی، WDR، Face         |
| کارخانه | IP/IK، دما، ارتعاش، Redundancy  |
| پارکینگ | Low-light، WDR، LPR، مسیر خودرو |
| مسکونی  | Privacy، Audio، فضای عمومی      |
| اداری   | ورودی، راهرو، کنترل دسترسی      |

### مساحت

نباید مستقیماً به تعداد دوربین تبدیل شود. باید فقط برای هشدار استفاده شود:

> نسبت تعداد دوربین به مساحت غیرعادی است؛ ناحیه‌بندی دقیق‌تر انجام دهید.

### طبقات

توپولوژی شبکه و تعداد Rack/IDF را تعیین کند.

### ورودی‌ها

اگر تعداد ورودی بیشتر از نواحی Face یا Plate است، هشدار دهد.

### کاربران Remote

روی این موارد اثر بگذارد:

* Outgoing bandwidth
* تعداد Stream همزمان
* Sub-stream profile
* اینترنت موردنیاز
* ظرفیت Decode
* مجوز نرم‌افزار

---

# ۲۲. بودجه باید عدد واقعی داشته باشد

اکنون کاربر فقط یکی از این سه حالت را انتخاب می‌کند:

* اقتصادی
* متعادل
* حرفه‌ای

اما موتور نمی‌داند بودجه واقعی مشتری چقدر است.

اضافه شود:

```ts
budgetMin?: number;
budgetMax?: number;
currency: "IRR" | "IRT";
includeInstallation: boolean;
includeCabling: boolean;
includeRack: boolean;
includeUps: boolean;
```

بعد موتور باید:

* پلن زیر سقف بودجه
* نزدیک‌ترین پلن بالاتر از بودجه
* اقلام قابل حذف
* تفاوت فنی حذف هر قلم

را نشان دهد.

---

# ۲۳. سه هدف فعلی کافی نیست

اکنون اهداف هر ناحیه فقط این‌ها هستند:

```text
general
face
plate
```

باید تفکیک شوند:

### انسان

* تشخیص حضور
* مشاهده رفتار
* بازشناسی فرد آشنا
* شناسایی هویت
* Face Detection
* Face Capture
* Face Recognition Analytics

### خودرو

* تشخیص خودرو
* مشاهده نوع خودرو
* ثبت پلاک
* OCR پلاک
* کنترل ورود و خروج
* اندازه‌گیری سرعت

### محیط

* شمارش نفر
* تشخیص عبور از خط
* تشخیص ازدحام
* حفاظت پیرامونی
* نظارت خط تولید
* تشخیص دود/حرارت
* نظارت صندوق

هرکدام پارامتر فنی متفاوتی دارند.

---

# ۲۴. Validation و Wizard UX

Validation فعلی فقط محدوده‌های عددی عمومی را کنترل می‌کند.

Validationهای بین‌فیلدی لازم‌اند:

```text
اگر Plate انتخاب شد:
- فاصله خودرو الزامی
- عرض مسیر الزامی
- سرعت خودرو الزامی
- زاویه دوربین الزامی

اگر Low-light انتخاب شد:
- حداقل نور یا نوع روشنایی الزامی

اگر Redundancy انتخاب شد:
- RAID level یا نوع Redundancy مشخص شود

اگر مسیر کابل > 100m:
- هشدار کابل مسی و پیشنهاد Fiber

اگر Audio انتخاب شد:
- هشدار قوانین حریم خصوصی و ضبط صدا

اگر outdoor=true:
- دما، بارندگی، گردوغبار و احتمال ضربه پرسیده شود
```

همچنین نباید کاربر بدون تکمیل اطلاعات هندسی بتواند دکمه «ساخت سه پلن هوشمند» را بزند.

---

# ۲۵. تست‌های فنی وجود ندارند

در `package.json` اسکریپت تست وجود ندارد و فقط Build، Lint و Typecheck تعریف شده‌اند.

برای محصولی که ادعای محاسبه مهندسی دارد، تست ضروری است.

## ساختار پیشنهادی

```text
src/lib/calculators/
  optics.ts
  dori.ts
  storage.ts
  raid.ts
  ipv4.ts
  wireless.ts
  fresnel.ts
  power.ts
  ups.ts

src/lib/recommendation/
  camera-constraints.ts
  recorder-constraints.ts
  storage-constraints.ts
  network-constraints.ts
  ups-constraints.ts
  scoring.ts

tests/
  optics.test.ts
  dori.test.ts
  storage.test.ts
  raid.test.ts
  ipv4.test.ts
  wireless.test.ts
  recommendation.test.ts
```

## تست‌های مرجع ضروری

```text
1 Mbps × 24 ساعت × 1 روز = 10.8 GB

RAID 1:
2 × 4TB = 4TB usable

RAID 5:
4 × 4TB = 12TB usable

RAID 6:
6 × 4TB = 16TB usable

RAID 10:
4 × 4TB = 8TB usable

IPv4 /31 P2P:
2 usable addresses

IPv4 /32:
1 host route

1 mW:
0 dBm

100 mW:
20 dBm
```

## تست‌های Property-based

* افزایش فاصله، PPM را کاهش دهد.
* افزایش فاصله کانونی، HFOV را کاهش دهد.
* افزایش تعداد دوربین، Storage را کاهش ندهد.
* افزایش Archive Days، Storage را کاهش ندهد.
* تبدیل dBm به mW و بازگشت، مقدار اولیه را بدهد.
* هیچ پلنی با PoE ناکافی پذیرفته نشود.
* هیچ NVR با پهنای‌باند کمتر پذیرفته نشود.
* ظرفیت RAID usable از ظرفیت Raw بیشتر نشود.

---

# اولویت اصلاحات

## P0 — قبل از فعال‌کردن Wizard برای کاربران

1. اصلاح فرمول حساسیت.
2. اصلاح RAID 1.
3. اصلاح `/31` و `/32`.
4. یکسان‌سازی واحد Kbps/Mbps و GB/TB.
5. محاسبه ظرفیت قابل استفاده RAID در پیشنهاد NVR.
6. متریک مستقل برای هر پلن.
7. محاسبه واقعی UPS.
8. حذف امتیازهای ثابت.
9. افزودن تست‌های مرجع.
10. حذف عبارت‌هایی مانند «تمام قیود فنی تأیید شد» تا زمانی که تمام Constraintها واقعاً بررسی شوند.

## P1 — تبدیل Wizard به ابزار مهندسی

1. فاصله و عرض صحنه برای هر ناحیه.
2. ارتفاع و زاویه دوربین.
3. انتخاب براساس PPM به‌جای MP.
4. تفکیک Face و ANPR.
5. بررسی Decode و Codec دستگاه ضبط.
6. بررسی Per-port PoE و Uplink.
7. استفاده واقعی از طبقات و کاربران Remote.
8. Budget عددی.
9. Storage با Motion/VBR/Audio/Overhead.
10. گزارش دلیل قبول و رد هر محصول.

## P2 — ویژگی متمایزکننده برند

1. Heatmap تراکم پیکسلی.
2. برخورد Frustum با زمین و صفحه هدف.
3. نقشه چند دوربینه.
4. نمایش نقاط کور.
5. پیشنهاد خودکار محل نصب.
6. محاسبه کابل، Rack، Fiber و UPS.
7. Calibration با Bitrate پروژه‌های واقعی.
8. ذخیره نسخه محاسبات و ورژن استاندارد.
9. خروجی PDF مهندسی.
10. اتصال محصولات واقعی WooCommerce.

---

## ارزیابی نهایی

در وضعیت فعلی:

* محاسبه زاویه دید درست است.
* فرمول پایه DORI درست است.
* FSPL و Fresnel نقطه میانی درست‌اند.
* تبدیل mW و dBm درست است.
* فرمول اصلی ذخیره‌سازی در Recommendation Engine درست است، ولی ناقص است.
* RAID 1، حساسیت نور کم و IPv4های خاص نیاز به اصلاح فوری دارند.
* Planner هنوز ارتفاع و Tilt را در نتیجه واقعی وارد نمی‌کند.
* Wizard از اطلاعات کافی برای انتخاب مهندسی دوربین برخوردار نیست.
* Recommendation Engine بسیاری از فیلدهای موجود در مدل محصول را نادیده می‌گیرد.
* امتیاز پلن و انتخاب UPS فعلاً قابل دفاع فنی نیستند.

بنابراین بهتر است این نسخه را فعلاً با عنوان **«پیشنهاد اولیه تجهیزات»** نمایش دهید، نه «طراحی مهندسی تأییدشده». پس از اجرای P0 و P1، می‌توان آن را به یک سیستم انتخاب و طراحی فنی قابل اعتماد تبدیل کرد.

[1]: https://whitepapers.axis.com/it-it/lenses-in-surveillance "https://whitepapers.axis.com/it-it/lenses-in-surveillance"
[2]: https://www.edmundoptics.com/knowledge-center/application-notes/imaging/understanding-focal-length-and-field-of-view/ "https://www.edmundoptics.com/knowledge-center/application-notes/imaging/understanding-focal-length-and-field-of-view/"
[3]: https://whitepapers.axis.com/en-us/pixel-density-based-on-iec-62676-4-2014 "https://whitepapers.axis.com/en-us/pixel-density-based-on-iec-62676-4-2014"
[4]: https://www.dinmedia.de/de/norm-entwurf/din-en-iec-62676-4/397694518 "https://www.dinmedia.de/de/norm-entwurf/din-en-iec-62676-4/397694518"
[5]: https://www.teledynevisionsolutions.com/en-gb/support/support-center/application-note/iis/selecting-a-lens-for-your-camera/ "https://www.teledynevisionsolutions.com/en-gb/support/support-center/application-note/iis/selecting-a-lens-for-your-camera/"
[6]: https://www.teledynevisionsolutions.com/en-ca/learn/learning-center/imaging-fundamentals/camera-sensitivity/ "https://www.teledynevisionsolutions.com/en-ca/learn/learning-center/imaging-fundamentals/camera-sensitivity/"
[7]: https://www.edmundoptics.com/knowledge-center/application-notes/imaging/lens-iris-aperture-setting/ "https://www.edmundoptics.com/knowledge-center/application-notes/imaging/lens-iris-aperture-setting/"
[8]: https://help.axis.com/en-us/axis-m3057-plve "https://help.axis.com/en-us/axis-m3057-plve"
[9]: https://www.dell.com/support/contents/en-au/videos/videoplayer/understanding-raid-levels/6079788681001 "https://www.dell.com/support/contents/en-au/videos/videoplayer/understanding-raid-levels/6079788681001"
[10]: https://www.rfc-editor.org/info/rfc3021/ "https://www.rfc-editor.org/info/rfc3021/"
[11]: https://www.itu.int/rec/r-rec-p.525 "https://www.itu.int/rec/r-rec-p.525"
[12]: https://www.cisco.com/c/en/us/td/docs/wireless/technology/mesh/7-4/design/guide/mesh74/mesh74_chapter_0100.html "https://www.cisco.com/c/en/us/td/docs/wireless/technology/mesh/7-4/design/guide/mesh74/mesh74_chapter_0100.html"
[13]: https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst3750/software/troubleshooting/g_power_over_ethernet.html "https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst3750/software/troubleshooting/g_power_over_ethernet.html"
[14]: https://www.se.com/us/en/work/support/product-support/ups-buying-guide-for-selecting-a-battery-backup-system/ "https://www.se.com/us/en/work/support/product-support/ups-buying-guide-for-selecting-a-battery-backup-system/"
