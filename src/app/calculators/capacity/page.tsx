"use client";

import { useMemo, useState } from "react";
import { Download, Plus, Trash2 } from "lucide-react";
import { CalculatorShell, RequiredNumberInput, ResultGrid, formatNumber } from "@/src/components/calculators/CalculatorUi";
import type { DashboardTool } from "@/src/lib/dashboard";

type DiskUnit = "GB" | "TB";
type RetentionUnit = "day" | "week" | "month";
type CalcTab = "saving" | "space" | "bandwidth";
type ChannelProfile = {
  id: number;
  selected: boolean;
  channelName: string;
  channelNumber: number;
  brand: string;
  videoStandard: string;
  encoding: string;
  resolution: string;
  fps: string;
  bitrate: number;
};

const tool: DashboardTool = {
  slug: "capacity",
  title: "محاسبه ظرفیت ذخیره‌سازی",
  subtitle: "پروفایل کانال / پهنای باند / مدت نگهداری",
  description: "پروفایل کانال‌ها را تعریف کنید و مدت نگهداری، فضای ذخیره‌سازی و پهنای‌باند کل را بر اساس ورودی واقعی ببینید.",
  status: "ready",
  metric: "کانال، Kbps، روز",
  icon: "database"
};

const videoStandards = ["IP", "TVI", "CVI", "AHD", "CVBS", "PAL", "NTSC"];
const encodings = ["H.264", "H.264+", "H.265", "H.265+", "MPEG4", "MJPEG", "Smart265"];
const resolutions = [
  "12MP (4000×3000)",
  "12MP (4000×3072)",
  "9MP (3072×3072)",
  "9MP (4096×2160)",
  "8MP (3840×2160)",
  "6MP (3072×2048)",
  "6MP (2560×2560)",
  "5MP (3072×1728)",
  "5MP (2880×1620)",
  "5MP (2592×1944)",
  "4MP (2688×1520)",
  "4MP (2560×1440)",
  "3MP (2304×1296)",
  "3MP (2048×1536)",
  "1080p (1920×1080)",
  "960p (1280×960)",
  "720p (1280×720)",
  "960H (960×576)",
  "960H (960×480)",
  "4CIF (704×576)",
  "2CIF (704×288)",
  "D1 (720×576)",
  "CIF (352×288)",
  "QCIF (176×144)"
];
const fpsOptions = ["1", "5", "10", "12.5", "15", "20", "25", "30", "50", "60"];
const bitrateOptions = [128, 256, 384, 512, 768, 1024, 1536, 2048, 2560, 3072, 4096, 5120, 6144, 8192, 10240, 12288, 16384, 20480];
const brands = ["هایک ویژن", "داهوا", "تیاندی", "اپتینت", "اکسیس", "بوش", "یونی ویو", "هانوا", "پاناسونیک", "سونی", "سایر"];

const baseBitrates: Record<string, number> = {
  "12MP (4000×3000)": 20480,
  "12MP (4000×3072)": 20480,
  "9MP (3072×3072)": 16384,
  "9MP (4096×2160)": 16384,
  "8MP (3840×2160)": 8192,
  "6MP (3072×2048)": 6144,
  "6MP (2560×2560)": 6144,
  "5MP (3072×1728)": 5120,
  "5MP (2880×1620)": 5120,
  "5MP (2592×1944)": 5120,
  "4MP (2688×1520)": 4096,
  "4MP (2560×1440)": 4096,
  "3MP (2304×1296)": 3072,
  "3MP (2048×1536)": 3072,
  "1080p (1920×1080)": 2048,
  "960p (1280×960)": 1536,
  "720p (1280×720)": 1024,
  "960H (960×576)": 768,
  "960H (960×480)": 768,
  "4CIF (704×576)": 512,
  "2CIF (704×288)": 256,
  "D1 (720×576)": 768,
  "CIF (352×288)": 384,
  "QCIF (176×144)": 128
};

const encodingFactors: Record<string, number> = {
  "H.264": 1,
  "H.264+": 0.85,
  "H.265": 0.66,
  "H.265+": 0.5,
  MPEG4: 1.4,
  MJPEG: 4,
  Smart265: 0.46
};

const retentionUnitOptions: Array<{ label: string; value: RetentionUnit }> = [
  { label: "روز", value: "day" },
  { label: "هفته", value: "week" },
  { label: "ماه", value: "month" }
];

const initialChannel: ChannelProfile = {
  id: 1,
  selected: false,
  channelName: "Channel 1",
  channelNumber: 1,
  brand: "هانوا",
  videoStandard: "IP",
  encoding: "H.265",
  resolution: "1080p (1920×1080)",
  fps: "25",
  bitrate: 2048
};

function clampChannelCount(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1024, Math.max(0, Math.floor(value)));
}

function suggestBitrate(encoding: string, resolution: string, fps: string) {
  const base = baseBitrates[resolution] ?? 2048;
  const fpsFactor = Number(fps || 25) / 25;
  const estimated = base * fpsFactor * (encodingFactors[encoding] ?? 1);
  return bitrateOptions.reduce((best, value) => (Math.abs(value - estimated) < Math.abs(best - estimated) ? value : best), bitrateOptions[0]);
}

function totalBitrateKbps(channels: ChannelProfile[]) {
  return channels.reduce((sum, channel) => sum + Math.max(0, channel.bitrate) * clampChannelCount(channel.channelNumber), 0);
}

function calculateCapacity(params: {
  channels: ChannelProfile[];
  diskSize: number;
  diskUnit: DiskUnit;
  savingHours: number;
  keepValue: number;
  keepUnit: RetentionUnit;
  spaceHours: number;
}) {
  const kbps = totalBitrateKbps(params.channels);
  const totalBytes = Math.max(0, params.diskSize) * (params.diskUnit === "TB" ? 1024 ** 4 : 1024 ** 3);
  const savingBytesPerDay = ((kbps * 1024) / 8) * 3600 * Math.max(0, params.savingHours);
  const retentionDays = kbps && params.diskSize && params.savingHours ? totalBytes / savingBytesPerDay : 0;
  let targetDays = Math.max(0, params.keepValue);
  if (params.keepUnit === "week") targetDays *= 7;
  if (params.keepUnit === "month") targetDays *= 30;
  const requiredBytes = ((kbps * 1024) / 8) * 3600 * Math.max(0, params.spaceHours) * targetDays;

  return {
    totalChannels: params.channels.reduce((sum, channel) => sum + clampChannelCount(channel.channelNumber), 0),
    totalKbps: kbps,
    totalMbps: kbps / 1024,
    retentionDays,
    retentionWeeks: retentionDays / 7,
    retentionMonths: retentionDays / 30,
    requiredGb: requiredBytes / 1024 ** 3,
    requiredTb: requiredBytes / 1024 ** 4
  };
}



export default function CapacityPage() {
  const [channels, setChannels] = useState<ChannelProfile[]>([initialChannel]);
  const [activeTab, setActiveTab] = useState<CalcTab>("saving");
  const [diskSize, setDiskSize] = useState(4);
  const [diskUnit, setDiskUnit] = useState<DiskUnit>("TB");
  const [savingHours, setSavingHours] = useState(24);
  const [keepValue, setKeepValue] = useState(30);
  const [keepUnit, setKeepUnit] = useState<RetentionUnit>("month");
  const [spaceHours, setSpaceHours] = useState(24);

  const result = useMemo(
    () => calculateCapacity({ channels, diskSize, diskUnit, savingHours, keepValue, keepUnit, spaceHours }),
    [channels, diskSize, diskUnit, savingHours, keepValue, keepUnit, spaceHours]
  );

  const updateChannel = <K extends keyof ChannelProfile>(id: number, key: K, value: ChannelProfile[K]) => {
    setChannels((current) =>
      current.map((channel) => {
        if (channel.id !== id) return channel;
        const next = { ...channel, [key]: value };
        if (key === "encoding" || key === "resolution" || key === "fps") {
          next.bitrate = suggestBitrate(String(next.encoding), String(next.resolution), String(next.fps));
        }
        if (key === "channelNumber") {
          next.channelNumber = clampChannelCount(Number(value));
        }
        return next;
      })
    );
  };

  const addChannel = () => {
    setChannels((current) => {
      const nextId = Math.max(...current.map((channel) => channel.id), 0) + 1;
      return [...current, { ...initialChannel, id: nextId, channelName: `Channel ${nextId}`, selected: false }];
    });
  };

  const removeChannel = (id: number) => {
    setChannels((current) => (current.length === 1 ? current : current.filter((channel) => channel.id !== id)));
  };

  const deleteSelected = () => {
    setChannels((current) => {
      const next = current.filter((channel) => !channel.selected);
      return next.length ? next : [current[0] ? { ...current[0], selected: false } : initialChannel];
    });
  };

  const exportExcel = () => {
    const header = ["نام کانال", "تعداد کانال", "برند", "استاندارد ویدئو", "روش کُدگذاری", "رزولوشن", "فریم‌ریت (fps)", "بیت‌ریت (Kbps)"];
    const rows = channels.map((channel) => [
      channel.channelName,
      channel.channelNumber,
      channel.brand,
      channel.videoStandard,
      channel.encoding,
      channel.resolution,
      channel.fps,
      channel.bitrate
    ]);

    import("xlsx").then((XLSX) => {
      const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Profiles");
      XLSX.writeFile(wb, "hamyardoorbin-devices.xlsx");
    });
  };

  return (
    <CalculatorShell tool={tool}>
      <section className="capacity-dashboard">
        <div className="capacity-summary-card">
          <span>کانال فعال</span>
          <strong>{formatNumber(result.totalChannels)}</strong>
        </div>
        <div className="capacity-summary-card">
          <span>بیت‌ریت کل</span>
          <strong>{formatNumber(result.totalKbps)}</strong>
          <small>Kbps</small>
        </div>
        <div className="capacity-summary-card">
          <span>پهنای‌باند کل</span>
          <strong>{formatNumber(result.totalMbps, 2)}</strong>
          <small>Mbps</small>
        </div>
      </section>

      <section className="capacity-panel capacity-channel-section">
        <div className="capacity-panel-head">
          <div>
            <p className="eyebrow">پروفایل کانال‌ها</p>
            <h2>تعریف کانال‌های ضبط</h2>
          </div>
          <div className="capacity-actions">
            <button className="secondary-action" type="button" onClick={addChannel}>
              <Plus size={18} aria-hidden="true" />
              افزودن
            </button>
            <button className="secondary-action" type="button" onClick={exportExcel}>
              <Download size={18} aria-hidden="true" />
              خروجی Excel
            </button>
            <button className="danger-action compact" type="button" onClick={deleteSelected} disabled={!channels.some((channel) => channel.selected)}>
              <Trash2 size={16} aria-hidden="true" />
              حذف گروهی
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="calculator-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={channels.every((c) => c.selected)}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setChannels((curr) => curr.map((c) => ({ ...c, selected: checked })));
                    }}
                  />
                </th>
                <th>نام کانال</th>
                <th>تعداد کانال</th>
                <th>برند</th>
                <th>استاندارد ویدئو</th>
                <th>روش کُدگذاری</th>
                <th>رزولوشن</th>
                <th>فریم‌ریت (fps)</th>
                <th>بیت‌ریت (Kbps)</th>
                <th>عملیات</th>
              </tr>
            </thead>
            <tbody>
              {channels.map((channel) => (
                <tr key={channel.id} className={channel.selected ? "selected-row" : ""}>
                  <td className="col-select">
                    <label className="channel-select">
                      <input
                        type="checkbox"
                        checked={channel.selected}
                        onChange={(event) => updateChannel(channel.id, "selected", event.target.checked)}
                      />
                      <span className="mobile-label">انتخاب</span>
                    </label>
                  </td>
                  <td className="col-name">
                    <span className="mobile-label">نام کانال</span>
                    <input value={channel.channelName} onChange={(event) => updateChannel(channel.id, "channelName", event.target.value)} />
                  </td>
                  <td className="col-number">
                    <span className="mobile-label">تعداد کانال</span>
                    <RequiredNumberInput
                      min={0}
                      max={1024}
                      step={1}
                      value={channel.channelNumber}
                      onValueChange={(value) => updateChannel(channel.id, "channelNumber", value)}
                    />
                  </td>
                  <td className="col-brand">
                    <span className="mobile-label">برند</span>
                    <select value={channel.brand} onChange={(event) => updateChannel(channel.id, "brand", event.target.value)}>
                      {brands.map((brand) => (
                        <option key={brand} value={brand}>
                          {brand}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="col-standard">
                    <span className="mobile-label">استاندارد ویدئو</span>
                    <select value={channel.videoStandard} onChange={(event) => updateChannel(channel.id, "videoStandard", event.target.value)}>
                      {videoStandards.map((standard) => (
                        <option key={standard} value={standard}>
                          {standard}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="col-encoding">
                    <span className="mobile-label">روش کُدگذاری</span>
                    <select value={channel.encoding} onChange={(event) => updateChannel(channel.id, "encoding", event.target.value)}>
                      {encodings.map((encoding) => (
                        <option key={encoding} value={encoding}>
                          {encoding}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="col-resolution">
                    <span className="mobile-label">رزولوشن</span>
                    <select value={channel.resolution} onChange={(event) => updateChannel(channel.id, "resolution", event.target.value)}>
                      {resolutions.map((resolution) => (
                        <option key={resolution} value={resolution}>
                          {resolution}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="col-fps">
                    <span className="mobile-label">فریم‌ریت (fps)</span>
                    <select value={channel.fps} onChange={(event) => updateChannel(channel.id, "fps", event.target.value)}>
                      {fpsOptions.map((fps) => (
                        <option key={fps} value={fps}>
                          {fps}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="col-bitrate">
                    <span className="mobile-label">بیت‌ریت (Kbps)</span>
                    <RequiredNumberInput min={0} step={1} value={channel.bitrate} onValueChange={(value) => updateChannel(channel.id, "bitrate", value)} />
                  </td>
                  <td className="col-delete">
                    <button className="danger-action compact" type="button" onClick={() => removeChannel(channel.id)} disabled={channels.length === 1}>
                      <Trash2 size={15} aria-hidden="true" />
                      <span className="mobile-label">حذف</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="calc-note">
          راهنما: نام کانال، تعداد کانال و بیت‌ریت قابل ویرایش هستند و سایر ستون‌ها به‌صورت کشویی انتخاب می‌شوند. بیت‌ریت بر اساس رزولوشن، کُدگذاری و فریم‌ریت پیش‌فرض پیشنهاد می‌شود، اما می‌توانید مقدار دلخواه وارد کنید.
        </p>
      </section>

      <section className="capacity-panel capacity-calc-card">
        <div className="capacity-panel-head">
          <div>
            <p className="eyebrow">محاسبه</p>
            <h2>مدت نگهداری، فضای لازم و پهنای‌باند</h2>
          </div>
        </div>

        <div className="capacity-tabs" role="tablist" aria-label="نوع محاسبه">
          <button type="button" className={activeTab === "saving" ? "active" : ""} onClick={() => setActiveTab("saving")}>
            محاسبه مدت نگهداری
          </button>
          <button type="button" className={activeTab === "space" ? "active" : ""} onClick={() => setActiveTab("space")}>
            محاسبه فضای ذخیره‌سازی
          </button>
          <button type="button" className={activeTab === "bandwidth" ? "active" : ""} onClick={() => setActiveTab("bandwidth")}>
            محاسبه پهنای‌باند
          </button>
        </div>

        {activeTab === "saving" ? (
          <div className="capacity-calc-panel">
            <div className="capacity-input-grid">
              <label>
                <span>فضای دیسک</span>
                <RequiredNumberInput min={0} step={0.1} value={diskSize} onValueChange={setDiskSize} />
              </label>
              <label>
                <span>واحد</span>
                <select value={diskUnit} onChange={(event) => setDiskUnit(event.target.value as DiskUnit)}>
                  <option value="TB">TB</option>
                  <option value="GB">GB</option>
                </select>
              </label>
              <label>
                <span>ساعت ضبط در روز</span>
                <RequiredNumberInput min={0} max={24} step={1} value={savingHours} onValueChange={setSavingHours} />
              </label>
              <label>
                <span>تنظیم سریع ساعت</span>
                <input type="range" min={0} max={24} step={1} value={savingHours} onChange={(event) => setSavingHours(Number(event.target.value))} />
              </label>
            </div>
            <ResultGrid
              results={[
                { label: "به ازای روز", value: formatNumber(Math.floor(result.retentionDays)), unit: "روز" },
                { label: "به ازای هفته", value: formatNumber(Math.floor(result.retentionWeeks)), unit: "هفته" },
                { label: "به ازای ماه", value: formatNumber(Math.floor(result.retentionMonths)), unit: "ماه" }
              ]}
            />
          </div>
        ) : null}

        {activeTab === "space" ? (
          <div className="capacity-calc-panel">
            <div className="capacity-input-grid">
              <label>
                <span>زمان نگهداری</span>
                <RequiredNumberInput min={0} step={1} value={keepValue} onValueChange={setKeepValue} />
              </label>
              <label>
                <span>واحد</span>
                <select value={keepUnit} onChange={(event) => setKeepUnit(event.target.value as RetentionUnit)}>
                  {retentionUnitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>ساعت ضبط در روز</span>
                <RequiredNumberInput min={0} max={24} step={1} value={spaceHours} onValueChange={setSpaceHours} />
              </label>
              <label>
                <span>تنظیم سریع ساعت</span>
                <input type="range" min={0} max={24} step={1} value={spaceHours} onChange={(event) => setSpaceHours(Number(event.target.value))} />
              </label>
            </div>
            <ResultGrid
              results={[
                { label: "نیاز تقریبی", value: formatNumber(Math.ceil(result.requiredGb)), unit: "GB" },
                { label: "برحسب ترابایت", value: formatNumber(result.requiredTb, 2), unit: "TB" },
                { label: "مبنای محاسبه", value: formatNumber(result.totalKbps), unit: "Kbps" }
              ]}
            />
          </div>
        ) : null}

        {activeTab === "bandwidth" ? (
          <div className="capacity-calc-panel">
            <ResultGrid
              results={[
                { label: "پهنای‌باند کل", value: formatNumber(result.totalKbps), unit: "Kbps" },
                { label: "برحسب مگابیت", value: formatNumber(result.totalMbps, 2), unit: "Mbps" },
                { label: "تعداد کانال", value: formatNumber(result.totalChannels), unit: "کانال" }
              ]}
            />
            <p className="calc-note">برای برآورد دقیق‌تر، بیت‌ریت هر کانال را مطابق پروفایل ضبط تنظیم کنید.</p>
          </div>
        ) : null}
      </section>
    </CalculatorShell>
  );
}
