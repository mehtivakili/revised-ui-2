const persianDigits = "۰۱۲۳۴۵۶۷۸۹";
const arabicDigits = "٠١٢٣٤٥٦٧٨٩";

export function normalizeDigits(input: string): string {
  return input.replace(/[۰-۹٠-٩]/g, (char) => {
    const persianIndex = persianDigits.indexOf(char);
    if (persianIndex >= 0) return String(persianIndex);

    const arabicIndex = arabicDigits.indexOf(char);
    if (arabicIndex >= 0) return String(arabicIndex);

    return char;
  });
}

export function formatCalculationNumber(value: number, fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "0";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits
  }).format(value);
}

export function formatUiNumber(value: number, locale: "fa-IR" | "en-US", fractionDigits = 0): string {
  if (!Number.isFinite(value)) return "0";

  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits
  }).format(value);
}
