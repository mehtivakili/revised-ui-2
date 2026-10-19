# سیاست نسخه‌گذاری و انتشار

## Semantic Versioning

نسخه‌ها به شکل `MAJOR.MINOR.PATCH` و مطابق [SemVer 2.0.0](https://semver.org/lang/fa/) هستند.
منبع واحد شمارهٔ نسخه، فیلد `version` در `package.json` است (نسخهٔ فعلی: `1.0.0`).

| بخش | چه زمانی افزایش می‌یابد | نمونه |
| --- | --- | --- |
| `MAJOR` | تغییر ناسازگار در API، قالب دادهٔ ذخیره‌شدهٔ پروژه یا رفتار محاسبات | `1.4.2` ← `2.0.0` |
| `MINOR` | قابلیت جدید سازگار با قبل (محاسبه‌گر، ابزار طراحی، گزارش جدید) | `1.4.2` ← `1.5.0` |
| `PATCH` | رفع اشکال و اصلاحات بدون تغییر رفتار عمومی | `1.4.2` ← `1.4.3` |

نوع تغییر از پیام‌های commit ([Conventional Commits](../CONTRIBUTING.md#پیام-commit)) مشخص می‌شود:
`feat` ← MINOR، `fix`/`perf` ← PATCH، و `!` یا `BREAKING CHANGE:` ← MAJOR.

## کانال‌های انتشار

| کانال | قالب نسخه | کاربرد |
| --- | --- | --- |
| alpha | `1.5.0-alpha.1` | نسخهٔ آزمایشی داخلی تیم؛ ممکن است ناقص باشد |
| beta | `1.5.0-beta.1` | آزمایش با کاربران منتخب؛ قابلیت‌ها کامل و در حال تثبیت |
| stable | `1.5.0` | نسخهٔ عمومی روی محیط تولید و فروشگاه اندروید |

نسخهٔ alpha/beta در GitHub Releases با گزینهٔ **Pre-release** منتشر می‌شود.

## برچسب‌ها (tags) و GitHub Releases

- هر انتشار یک برچسب annotated به شکل `vX.Y.Z` (یا `vX.Y.Z-beta.N`) روی `main` دارد.
- برای هر برچسب یک GitHub Release ساخته می‌شود و متن آن از بخش مربوط در
  [CHANGELOG.md](../CHANGELOG.md) برداشته می‌شود.
- فقط commitهایی برچسب می‌خورند که CI روی آن‌ها سبز باشد.

## مراحل انتشار

1. بخش `[Unreleased]` در `CHANGELOG.md` را به `[X.Y.Z] - YYYY-MM-DD` تبدیل کنید و لینک‌های
   مقایسه در انتهای فایل را به‌روز کنید.
2. نسخه را بدون ساخت خودکار برچسب افزایش دهید:
   ```bash
   npm version X.Y.Z --no-git-tag-version
   ```
3. تغییرات را با پیام `chore(release): vX.Y.Z` از طریق Pull Request به `main` ادغام کنید.
4. پس از سبز شدن CI روی `main`، برچسب بزنید و منتشر کنید:
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z"
   git push origin vX.Y.Z
   gh release create vX.Y.Z --title "vX.Y.Z" --notes-file <یادداشت-انتشار>
   ```
   برای alpha/beta گزینهٔ `--prerelease` را اضافه کنید.
5. نسخهٔ اندروید (`android/app/build.gradle`: `versionName` و `versionCode`) را هم‌زمان با
   نسخهٔ stable به‌روز کنید.
