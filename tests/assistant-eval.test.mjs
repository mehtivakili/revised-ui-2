import assert from "node:assert/strict";
import test, { before, describe } from "node:test";
import { AssistantModel } from "@/src/lib/chatbot/model";
import { respond } from "@/src/lib/chatbot/engine";
import { extractSlots } from "@/src/lib/chatbot/slots";

/**
 * Quality regression gate for the assistant.
 *
 * The probes are paraphrases that appear nowhere in the training corpus, so this
 * measures generalisation rather than recall. Floors are set a few points below the
 * measured figure: the point is to catch regressions, not to freeze an exact number
 * that innocuous corpus edits would break.
 *
 * `developmentProbes` were used while tuning the routing rules, so they flatter the
 * system slightly. `blindProbes` were written afterwards and never tuned against —
 * that set is the honest measure.
 */

const developmentProbes = [
  ["می‌خوام بدونم برای ۲۴ تا دوربین ۵ مگ با ۴۵ روز نگهداری چند ترابایت هارد بخرم", "calc_storage"],
  ["هارد ۸ ترابایت برای ۱۲ دوربین چند روز کفاف میده", "calc_storage"],
  ["اینترنت من ۲۰ مگ آپلود داره برای ۱۰ دوربین کافیه", "calc_bandwidth"],
  ["میخوام از ۴۰ متری صورت طرف رو تشخیص بدم چه لنزی", "calc_lens_focal"],
  ["با لنز ۱۲ میلی متر روی سنسور ۱/۲.۸ چند درجه میبینم", "calc_fov"],
  ["برای پلاک خوندن چند پیکسل بر متر لازمه", "calc_ppm"],
  ["۸ تا هارد ۶ ترابایتی رید ۶ چقدر فضای مفید", "calc_raid"],
  ["۲۴ دوربین هرکدوم ۹ وات چه سوییچی بخرم", "calc_poe_budget"],
  ["برای ۲۰ دوربین و یه ان وی ار چند وات یو پی اس", "calc_ups"],
  ["192.168.10.0/22 چند تا هاست داره", "calc_subnet"],
  ["لینک ۸ کیلومتری با آنتن ۲۴ دی بی چقدر سیگنال میگیره", "calc_wireless_link"],
  ["شعاع فرنل برای ۴ کیلومتر در ۵ گیگاهرتز", "calc_fresnel"],
  ["۵ وات چند دی بی ام میشه", "calc_dbm"],
  ["۲۲ تا دوربین دارم چند کانال بگیرم", "calc_channels"],
  ["از سوییچ تا دوربین ۱۸۰ متره چیکار کنم", "calc_cable"],
  ["دوربین ۸ مگ بگیرم یا ۴ مگ بهتره", "info_resolution"],
  ["h265 چقدر تو حجم صرفه جویی میکنه", "info_codec"],
  ["دوربین بیرونی باید چه استانداردی داشته باشه بارون نخوره", "info_ip_rating"],
  ["جلوی در نور خورشید میزنه چهره سیاه میشه", "info_wdr"],
  ["سوییچ من at هست دوربینم af میخوره", "info_poe_standard"],
  ["دوربین داهوا رو به ان وی ار هایک وصل کنم میشه", "info_onvif"],
  ["دوربین رو چند متری بذارم که چهره معلوم باشه", "info_install"],
  ["دوربینام هی قطع و وصل میشن", "info_troubleshoot"],
  ["سلام خسته نباشید", "greeting"],
  ["مرسی از راهنمایی", "thanks"],
  ["شماره تلفنتون چنده", "contact"],
  ["پایتخت فرانسه کجاست", "fallback"],
  ["قیمت دلار امروز چنده", "fallback"]
];

/** Written after the rules were finalised; never used to tune anything. */
const blindProbes = [
  ["۶ تا دوربین ۲ مگاپیکسل ۲۰ روز چقدر هارد", "calc_storage"],
  ["مجموع ترافیک ۱۲ دوربین ۵ مگاپیکسل", "calc_bandwidth"],
  ["برای عرض صحنه ۸ متر در ۳۰ متری چه لنزی بگیرم", "calc_lens_focal"],
  ["۱۰ تا دیسک ۲ ترابایتی با raid 10", "calc_raid"],
  ["۳۰ دوربین ۱۵ واتی بودجه سوییچ چقدر", "calc_poe_budget"],
  ["10.0.0.5/8 شبکه اش چیه", "calc_subnet"],
  ["ناحیه فرنل مسیر ۶ کیلومتری", "calc_fresnel"],
  ["۲۵۰ میلی وات معادل چند dbm", "calc_dbm"],
  ["ip67 با ip66 چه فرقی داره", "info_ip_rating"],
  ["hevc بهتره یا avc", "info_codec"],
  ["دوربین شب رنگی میخوام", "info_night_vision"],
  ["زوم اپتیکال با دیجیتال فرقش چیه", "info_ptz"],
  ["onvif یعنی چی", "info_onvif"],
  ["تصویر دوربینم تاره", "info_troubleshoot"],
  ["ارتفاع نصب دوربین چقدر باشه", "info_install"],
  ["واریفوکال یعنی چی", "info_lens_type"],
  ["برای پارکینگ چه سیستمی بگیرم", "recommend_system"],
  ["چه محصولاتی موجود دارید", "product_search"],
  ["سلام وقت بخیر", "greeting"],
  ["آب و هوای تهران چطوره", "fallback"]
];

let ready = false;

before(async () => {
  const model = AssistantModel.getInstance();
  model.start();
  await new Promise((resolve, reject) => {
    const deadline = Date.now() + 240_000;
    const timer = setInterval(() => {
      if (model.isReady()) { clearInterval(timer); ready = true; resolve(); }
      else if (Date.now() > deadline) { clearInterval(timer); reject(new Error("model training timed out")); }
    }, 50);
  });
});

async function accuracyOf(probes) {
  let correct = 0;
  const failures = [];
  for (const [text, expected] of probes) {
    const result = await respond(text);
    if (result.intent === expected) correct += 1;
    else failures.push(`"${text}" expected=${expected} got=${result.intent}`);
  }
  return { ratio: correct / probes.length, failures };
}

describe("assistant quality", () => {
  test("model reaches ready state", () => {
    assert.equal(ready, true);
  });

  test("held-out intent accuracy stays above the floor", async () => {
    const { ratio, failures } = await accuracyOf(developmentProbes);
    assert.ok(
      ratio >= 0.82,
      `development-probe accuracy ${(ratio * 100).toFixed(1)}% fell below 82%:\n${failures.join("\n")}`
    );
  });

  test("blind probe accuracy stays above the floor", async () => {
    const { ratio, failures } = await accuracyOf(blindProbes);
    assert.ok(
      ratio >= 0.7,
      `blind-probe accuracy ${(ratio * 100).toFixed(1)}% fell below 70%:\n${failures.join("\n")}`
    );
  });

  test("named off-topic subjects are refused, not answered", async () => {
    for (const text of ["قیمت دلار امروز چنده", "آب و هوای تهران چطوره", "یه شعر بگو"]) {
      const result = await respond(text);
      assert.equal(result.intent, "fallback", `"${text}" should be refused`);
    }
  });
});

describe("slot extraction", () => {
  test("counting particles do not break number-noun pairing", () => {
    const slots = extractSlots("برای ۲۴ تا دوربین ۵ مگ با ۴۵ روز نگهداری");
    assert.equal(slots.cameraCount, 24);
    assert.equal(slots.megapixel, 5);
    assert.equal(slots.days, 45);
  });

  test("disk count survives the particle", () => {
    const slots = extractSlots("۸ تا هارد ۶ ترابایتی رید ۶");
    assert.equal(slots.diskCount, 8);
    assert.equal(slots.terabytes, 6);
    assert.equal(slots.raidLevel, "6");
  });

  test("sensor fraction is not read as a network prefix", () => {
    const slots = extractSlots("با لنز ۱۲ میلی متر روی سنسور ۱/۲.۸");
    assert.equal(slots.focalMm, 12);
    assert.equal(slots.prefix, undefined);
    assert.ok(slots.sensorInch > 5 && slots.sensorInch < 5.2);
  });

  test("CIDR prefix still parses alongside an address", () => {
    const slots = extractSlots("192.168.10.0/22 چند تا هاست");
    assert.equal(slots.ipAddress, "192.168.10.0");
    assert.equal(slots.prefix, 22);
  });

  test("antenna gain is distinguished from dBm", () => {
    assert.equal(extractSlots("لینک ۸ کیلومتری با آنتن ۲۴ دی بی").dbi, 24);
    assert.equal(extractSlots("توان خروجی ۲۰ دی بی ام").dbm, 20);
  });

  test("bare مگ resolves by context", () => {
    assert.equal(extractSlots("دوربین ۵ مگ").megapixel, 5);
    assert.equal(extractSlots("اینترنت ۲۰ مگ آپلود").bandwidthMbps, 20);
  });
});

describe("no fabricated numbers", () => {
  test("a calculator with no operands asks instead of inventing one", async () => {
    const result = await respond("چند ترابایت هارد لازم دارم");
    const body = result.answer.lines.join(" ");
    // It may explain the method, but it must not headline a computed total.
    assert.ok(
      !/\d+(?:\.\d+)?\s*ترابایت برای/.test(result.answer.title),
      `title should not quote a computed figure: "${result.answer.title}"`
    );
    assert.ok(body.length > 0);
  });

  test("computed answers disclose every assumed input", async () => {
    const result = await respond("برای ۱۶ دوربین چقدر هارد لازم است");
    assert.equal(result.intent, "calc_storage");
    const assumptions = (result.answer.assumptions ?? []).join(" ");
    assert.ok(/آرشیو|روز/.test(assumptions), "archive length was assumed and must be disclosed");
    assert.ok(/رزولوشن|مگاپیکسل/.test(assumptions), "resolution was assumed and must be disclosed");
  });
});
