export const MAX_DWG_BYTES = 25 * 1024 * 1024;

const DWG_SIGNATURE = /^AC10\d{2}$/;

export type DwgUploadInfo = {
  name: string;
  size: number;
};

/** Fast checks performed before the memory-intensive WebAssembly decoder is started. */
export function validateDwgUpload(file: DwgUploadInfo, signature: string): { message: string; status: number } | null {
  if (!file.name.toLowerCase().endsWith(".dwg")) return { message: "پسوند فایل باید DWG باشد.", status: 415 };
  if (file.size === 0) return { message: "فایل DWG خالی است.", status: 400 };
  if (file.size > MAX_DWG_BYTES) return { message: "حجم فایل DWG نباید بیشتر از ۲۵ مگابایت باشد.", status: 413 };
  if (!DWG_SIGNATURE.test(signature)) {
    return { message: "ساختار فایل DWG معتبر نیست یا نسخه فایل قابل تشخیص نیست.", status: 422 };
  }
  return null;
}
