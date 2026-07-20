# اتصال کاتالوگ واقعی WooCommerce

این اتصال کاملاً سمت سرور است. `Consumer Key` و `Consumer Secret` نباید در کد، مرورگر، Git یا متغیرهای دارای پیشوند `NEXT_PUBLIC_` قرار بگیرند.

## ۱. ساخت کلید فقط-خواندنی در وردپرس

در مدیریت وردپرس وارد مسیر زیر شوید:

`WooCommerce > Settings > Advanced > REST API > Add key`

- Description: `Hamyar Doorbin Catalog`
- User: یک کاربر سرویس یا مدیر مشخص
- Permissions: `Read`

پس از تولید، مقدارهای `ck_...` و `cs_...` را همان لحظه در محل امن نگه دارید؛ Secret دوباره نمایش داده نمی‌شود.

## ۲. تنظیم متغیرهای سرور

در فایل محیطی production (معمولاً `.env.production`) بنویسید:

```dotenv
WOOCOMMERCE_URL=https://ddcpersia.com
WOOCOMMERCE_CONSUMER_KEY=ck_xxxxxxxxxxxxxxxxx
WOOCOMMERCE_CONSUMER_SECRET=cs_xxxxxxxxxxxxxxxxx
WOOCOMMERCE_PRICE_DIVISOR=1
```

اگر قیمت WooCommerce به **تومان** ثبت شده، divisor برابر `1` است. اگر قیمت به **ریال** است ولی اپ تومان نمایش می‌دهد، divisor را `10` بگذارید.

## ۳. استقرار و تست اتصال

پس از افزودن متغیرها:

```bash
npm run build
pm2 restart hamyardoorbin --update-env
```

با حساب مدیر وارد اپ شوید، در پنل مدیریت بخش «کاتالوگ واقعی WooCommerce» را باز کنید و ابتدا «بررسی آزمایشی» را بزنید. این مرحله چیزی در دیتابیس تغییر نمی‌دهد و تعداد محصولات قابل نگاشت، محصولات ردشده و هشدارهای کیفیت داده را نشان می‌دهد. بعد از بررسی واحد قیمت و هشدارها، «Sync واقعی» را اجرا کنید.

پس از اولین دریافت موفق، API کاتالوگ به‌طور خودکار محصولات استانداردشده `woocommerce` را بر داده‌های Mock ترجیح می‌دهد. اگر هنوز محصول واقعی دریافت نشده باشد، Mock fallback فعال می‌ماند. این فرایند فقط درخواست‌های `GET` به WooCommerce می‌فرستد؛ عبارت Sync صرفاً به معنی نوشتن Snapshot در دیتابیس داخلی اپ است و هیچ محصولی در سایت ایجاد، ویرایش یا حذف نمی‌شود.

تمام محصولات منتشرشده، حتی مواردی که هنوز دسته فنی‌شان قابل تشخیص نیست، در `woocommerce_product_snapshots` ذخیره می‌شوند. ویژگی‌ها، تصاویر، دسته‌ها و تگ‌ها نیز به‌ترتیب در جدول‌های `woocommerce_product_attributes`، `woocommerce_product_images`، `woocommerce_product_categories` و `woocommerce_product_tags` نگهداری می‌شوند. محصولات قابل استفاده در موتور پیشنهاد علاوه بر Snapshot در `catalog_products` و جدول مشخصات تخصصی خود استاندارد می‌شوند.

تصاویر در `catalog_image_jobs` صف می‌شوند و Worker سرور آن‌ها را بدون وابستگی به بازبودن صفحه، به‌صورت دسته‌های تدریجی در `public/catalog-cache` ذخیره می‌کند. وضعیت صف و درصد تصاویر کش‌شده در صفحه محصولات نمایش داده می‌شود. اگر تصاویر فروشگاه از CDN دیگری می‌آیند، hostname آن را در `WOOCOMMERCE_IMAGE_HOSTS` قرار دهید؛ برای چند دامنه از کاما استفاده کنید.

صفحه محصولات با pagination سروری همه Snapshotها را نمایش می‌دهد. هر کارت Gallery، دسته‌های اصلی، قیمت/موجودی، ویژگی‌های خام WooCommerce و در صورت موجودبودن مشخصات استانداردشده را دارد. محصولاتی که هنوز قابل نگاشت نیستند در دسته «سایر محصولات» باقی می‌مانند و حذف نمی‌شوند.

مدیر می‌تواند فهرست ذخیره‌شده را از API زیر بخواند:

`GET /api/admin/catalog/source-products?page=1&limit=25&q=&mapping=all`

مقدار `mapping` می‌تواند `all`، `mapped`، `unmapped` یا `estimated` باشد.

## قرارداد داده پیشنهادی محصولات

برای اینکه موتور مجبور به تخمین مشخصات نشود، بهتر است ویژگی‌های WooCommerce با نام و واحد ثابت ثبت شوند:

- دوربین: `Resolution MP`, `Focal Length mm`, `IR Range m`, `FPS`, `Codec`, `Power W`, `PoE`, `IP Rating`, `Brand`
- ضبط‌کننده: `Channels`, `Incoming Bandwidth Mbps`, `Decode Capacity MP`, `HDD Bays`, `Max HDD TB`, `RAID`, `Codec`, `Built-in PoE`
- سوئیچ: `PoE Ports`, `PoE Budget W`, `Max Power Per Port W`, `Uplink Gbps`, `Managed`
- هارد: `Capacity TB`, `Workload TB/year`, `Surveillance Optimized`
- UPS: `Capacity VA`, `Output Power W`, `Runtime at 50% load min`

نام دسته یا متن محصول باید حداقل یکی از خانواده‌های `camera`، `NVR/DVR`، `switch`، `storage/hard` یا `UPS` را مشخص کند. تصویر اصلی و Gallery محصول مستقیماً از آرایه تصاویر WooCommerce دریافت می‌شود.

## کنترل کیفیت قبل از فروش واقعی

- محصولات دارای هشدار `estimated` را بازبینی و ویژگی‌های فنی‌شان را در WooCommerce تکمیل کنید.
- چند SKU از هر خانواده را با دیتاشیت سازنده تطبیق دهید.
- قیمت و موجودی را بعد از Sync با سایت مقایسه کنید.
- کلید REST را دوره‌ای تعویض و دسترسی کاربر سرویس را محدود نگه دارید.
- برای Sync دوره‌ای بدون ورود مدیر، یک endpoint داخلی با token و محدودیت IP لازم است؛ endpoint فعلی عمداً فقط با session مدیر اجرا می‌شود.
