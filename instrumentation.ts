export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startCatalogImageWorker } = await import("@/src/lib/catalog/image-cache");
  const timer = setTimeout(startCatalogImageWorker, 2_000);
  timer.unref?.();
}
