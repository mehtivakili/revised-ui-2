import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/src/lib/session";
import { readAsset } from "@/src/lib/projects/store";

type Context = { params: Promise<{ id: string; assetId: string }> };

/**
 * Serves one uploaded plan drawing.
 *
 * The lookup joins through `projects` so an asset id alone is not enough to read someone
 * else's drawing — the requesting session has to own the project it belongs to. Caching
 * is aggressive because an asset id is only ever issued once for one set of bytes.
 */
export async function GET(_request: NextRequest, context: Context) {
  const session = await getCurrentSession();
  if (!session) return new NextResponse(null, { status: 401 });

  const { id, assetId } = await context.params;
  const asset = await readAsset(session.id, id, assetId);
  if (!asset) return new NextResponse(null, { status: 404 });

  return new NextResponse(new Uint8Array(asset.bytes), {
    status: 200,
    headers: {
      "Content-Type": asset.mime,
      "Content-Length": String(asset.bytes.byteLength),
      "Cache-Control": "private, max-age=31536000, immutable"
    }
  });
}
