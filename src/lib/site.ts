/**
 * The public address of the site, used for canonical links, the sitemap and robots.txt.
 * Set NEXT_PUBLIC_SITE_URL for a staging or different domain.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://hamyardoorbin.ir").replace(/\/+$/, "");

export const SITE_NAME = "همیار دوربین";
