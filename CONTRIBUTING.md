# راهنمای مشارکت

این راهنما روند کار تیم روی مخزن «همیار دوربین» را مشخص می‌کند. شاخهٔ `main` همیشه باید قابل
build و انتشار باشد و تغییرات فقط از طریق Pull Request وارد آن می‌شوند.

## راه‌اندازی و بررسی‌های محلی

```bash
npm ci
npm run lint
npm run typecheck
npm test              # یا npm run test:coverage برای گزارش پوشش در coverage/lcov.info
npm run build
```

آزمون‌های وابسته به پایگاه داده (`projects-store`، `calculation-versions`) فقط با تنظیم
`DATABASE_URL` اجرا می‌شوند و در غیر این صورت skip می‌شوند. همین بررسی‌ها در CI
(`.github/workflows/ci.yml`) روی هر push و Pull Request به `main` اجرا می‌شوند.

## نام‌گذاری شاخه‌ها

از `main` شاخه بگیرید و نام شاخه را با نوع کار شروع کنید؛ در صورت وجود، شمارهٔ Issue را بیاورید:

| پیشوند | کاربرد | نمونه |
| --- | --- | --- |
| `feature/` | قابلیت جدید | `feature/42-raid-calculator` |
| `fix/` | رفع اشکال | `fix/57-otp-timeout` |
| `refactor/` | بازآرایی بدون تغییر رفتار | `refactor/planner-geometry` |
| `docs/` | مستندات | `docs/versioning-policy` |
| `chore/` | ابزار، CI، وابستگی‌ها، انتشار | `chore/release-1.1.0` |

## پیام commit

پیام‌ها از [Conventional Commits](https://www.conventionalcommits.org/fa/v1.0.0/) پیروی می‌کنند:

```
<type>(<scope>): <خلاصهٔ کوتاه در زمان حال>

<توضیح اختیاری: چرا این تغییر لازم بود>

fixes #57
```

- `type`: `feat`، `fix`، `perf`، `refactor`، `test`، `docs`، `style`، `build`، `ci`، `chore`
- `scope` (اختیاری): بخش تغییرکرده، مثل `planner`، `assistant`، `catalog`، `auth`، `calculators`
- تغییر ناسازگار: `feat(api)!: ...` یا پاورقی `BREAKING CHANGE: ...`
- پیام‌های مبهم مثل `fix` یا `update` پذیرفته نمی‌شوند؛ هر commit یک تغییر منطقی واحد باشد.

نمونه‌ها:

```
feat(calculators): add RAID capacity calculator
fix(auth): reject expired OTP codes
test(planner): cover door variants on rotated walls
```

نوع commit مبنای افزایش نسخه است؛ ببینید [docs/versioning.md](docs/versioning.md).

## Pull Request و بازبینی

1. برای هر کار یک Issue باز کنید (قالب‌های «گزارش باگ» و «درخواست قابلیت» در GitHub).
2. روی شاخهٔ جدا کار کنید و Pull Request به `main` باز کنید؛ قالب PR را کامل پر کنید.
3. در توضیح PR، Issue را با کلمهٔ کلیدی پیوند دهید تا هنگام ادغام بسته شود:
   `fixes #57`، `closes #42` یا `resolves #12`.
4. هر PR دست‌کم **یک تأیید (approve)** از عضوی غیر از نویسنده لازم دارد و تا سبز شدن همهٔ
   بررسی‌های CI ادغام نمی‌شود. push مستقیم به `main` مجاز نیست.
5. بازبین درستی، آزمون‌ها، امنیت (عدم ورود کلید/رمز به کد) و به‌روز بودن `CHANGELOG.md` را
   بررسی می‌کند.
6. تغییرات قابل‌مشاهده برای کاربر را زیر `[Unreleased]` در [CHANGELOG.md](CHANGELOG.md) ثبت کنید.

## گزارش باگ

هر گزارش باگ **شدت (Severity)** و **اولویت (Priority)** دارد:

| Severity | معنا |
| --- | --- |
| S1 – بحرانی | از کار افتادن سرویس، از دست رفتن داده یا مشکل امنیتی |
| S2 – بالا | قابلیت اصلی کار نمی‌کند و راه جایگزین ندارد |
| S3 – متوسط | قابلیت با خطا کار می‌کند یا راه جایگزین دارد |
| S4 – پایین | ظاهری یا جزئی |

| Priority | معنا |
| --- | --- |
| P1 | رفع فوری (hotfix) |
| P2 | در نسخهٔ بعدی |
| P3 | در برنامهٔ کاری |
| P4 | در صورت فرصت |

## هویت نویسنده

پیش از commit نام و ایمیل خود را یکسان تنظیم کنید. هویت‌های قدیمی در `.mailmap` یکسان‌سازی شده‌اند:

```bash
git config user.name "<نام کاربری GitHub>"
git config user.email "<ایمیل ثبت‌شده در GitHub>"
```
