import { createRequire } from "node:module";
import { createHash } from "node:crypto";
import path from "node:path";

import { Dwg_File_Type, LibreDwg } from "@mlightcad/libredwg-web";
import { NextResponse } from "next/server";

import { validateDwgUpload } from "@/src/lib/planner/dwg-import";
import { dwgEntityTypeSummary, recoverDxfFromDwgDatabase } from "@/src/lib/planner/dwg-database-to-dxf";
import { importDxfWalls } from "@/src/lib/planner/dxf-import";

export const runtime = "nodejs";

// LibreDWG uses fixed temporary names inside its WASM filesystem. Serialising calls
// prevents two simultaneous uploads from overwriting each other's input/output files.
let conversionQueue: Promise<void> = Promise.resolve();
let lastSuccessfulConversion: { fingerprint: string; bytes: Uint8Array } | null = null;

function enqueueConversion<T>(task: () => Promise<T>): Promise<T> {
  const result = conversionQueue.then(task, task);
  conversionQueue = result.then(() => undefined, () => undefined);
  return result;
}

function wasmDirectory() {
  // `import.meta.url` is rewritten to a virtual `[externals]` path by Turbopack.
  // Resolve from the real project manifest so Emscripten receives a physical path.
  const require = createRequire(path.join(process.cwd(), "package.json"));
  const packageEntry = require.resolve("@mlightcad/libredwg-web");
  return path.resolve(path.dirname(packageEntry), "../wasm").replaceAll("\\", "/");
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const returnCompactWalls = new URL(request.url).searchParams.get("format") === "walls";
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return errorResponse("درخواست آپلود DWG معتبر نیست.", 400);
  }

  const file = form.get("file");
  if (!(file instanceof File)) return errorResponse("فایل DWG ارسال نشده است.", 400);
  const metadataError = validateDwgUpload(file, "AC1000");
  if (metadataError) return errorResponse(metadataError.message, metadataError.status);
  const content = await file.arrayBuffer();
  const signature = new TextDecoder("ascii").decode(content.slice(0, 6));
  const fingerprint = createHash("sha256").update(new Uint8Array(content)).digest("hex");
  const validationError = validateDwgUpload(file, signature);
  if (validationError) return errorResponse(validationError.message, validationError.status);

  try {
    const dxfBytes = lastSuccessfulConversion?.fingerprint === fingerprint
      ? lastSuccessfulConversion.bytes
      : await enqueueConversion(async () => {
      // LibreDWG's WebAssembly reader is occasionally non-deterministic with large
      // AC1027 drawings: a fresh instance may return a null/empty database while the
      // same bytes open on the next attempt. Retry inside one upload so users do not
      // have to press the button repeatedly. Every attempt receives a new WASM heap.
      let lastSummary = "";
      for (let attempt = 0; attempt < 12; attempt += 1) {
        const converter = await LibreDwg.create(wasmDirectory());
        // Do not call dwg_write_dxf first: large but valid drawings can crash that writer
        // with a WASM out-of-bounds access and poison the shared decoder instance.
        const pointer = converter.dwg_read_data(content.slice(0), Dwg_File_Type.DWG);
        if (pointer) {
          try {
            const database = converter.convert(pointer);
            const recovered = recoverDxfFromDwgDatabase(database);
            if (recovered?.length) return recovered;
            lastSummary = dwgEntityTypeSummary(database);
          } finally {
            converter.dwg_free(pointer);
          }
        }
        if (attempt < 11) await new Promise((resolve) => setTimeout(resolve, Math.min(500, 75 * (attempt + 1))));
      }
      console.warn("DWG opened without recoverable linework after retries", {
        name: file.name,
        size: file.size,
        signature,
        fingerprint,
        entities: lastSummary
      });
      return null;
    });
    if (!dxfBytes?.length) {
      return errorResponse("تبدیل DWG انجام نشد؛ فایل را در AutoCAD به نسخه ۲۰۱۸ یا قدیمی‌تر ذخیره و دوباره امتحان کنید.", 422);
    }
    lastSuccessfulConversion = { fingerprint, bytes: Uint8Array.from(dxfBytes) };
    if (returnCompactWalls) {
      const requestedHeight = Number(form.get("heightM"));
      const requestedThickness = Number(form.get("thicknessM"));
      const imported = importDxfWalls(new TextDecoder().decode(Uint8Array.from(dxfBytes)), {
        heightM: Number.isFinite(requestedHeight) && requestedHeight > 0 ? requestedHeight : 3,
        thicknessM: Number.isFinite(requestedThickness) && requestedThickness > 0 ? requestedThickness : 0.2
      });
      return NextResponse.json(imported, {
        status: 200,
        headers: { "Cache-Control": "no-store" }
      });
    }
    return new Response(Uint8Array.from(dxfBytes).buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/dxf; charset=utf-8",
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.name.replace(/\.dwg$/i, ".dxf"))}"`
      }
    });
  } catch (cause) {
    console.error("DWG conversion failed", cause);
    return errorResponse("خواندن فایل DWG انجام نشد؛ ممکن است نسخه یا بعضی آبجکت‌های CAD پشتیبانی نشوند.", 422);
  }
}
