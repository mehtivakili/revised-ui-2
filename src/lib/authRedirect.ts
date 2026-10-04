const redirectBaseUrl = "https://local.invalid";

export function safeAuthRedirect(value: unknown, fallback = "/") {
  if (typeof value !== "string") return fallback;

  const candidate = value.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return fallback;
  }

  try {
    const destination = new URL(candidate, redirectBaseUrl);
    if (destination.origin !== redirectBaseUrl || destination.pathname === "/login") {
      return fallback;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return fallback;
  }
}
