import { dashboardCategories, type DashboardCategory } from "@/src/lib/dashboard";
import type { UserAccount, UserPlan } from "@/src/lib/authStore";

export const defaultTrialDays = 7;
export const trialDayMs = 24 * 60 * 60 * 1000;
export const trialDurationMs = defaultTrialDays * trialDayMs;
export const freeAccessibleCategoryId: DashboardCategory["id"] = "storage";

export type SubscriptionAccess = {
  plan: UserPlan;
  isFreeAccount: boolean;
  signupAt: string;
  trialEndsAt: string;
  trialExpired: boolean;
  trialDaysRemaining: number;
  restricted: boolean;
  allowedCategoryIds: DashboardCategory["id"][];
  lockedCategoryIds: DashboardCategory["id"][];
  lockedToolSlugs: string[];
};

export function getSubscriptionAccess(user?: Pick<UserAccount, "plan" | "isFreeAccount" | "signupAt" | "createdAt" | "trialDays"> | null, now = Date.now()): SubscriptionAccess {
  const signupAt = user?.signupAt ?? user?.createdAt ?? new Date(now).toISOString();
  const signupTime = Date.parse(signupAt);
  const safeSignupTime = Number.isFinite(signupTime) ? signupTime : now;
  const plan = user?.plan ?? (user?.isFreeAccount ? "free" : "pro");
  const isFreeAccount = plan === "free" || Boolean(user?.isFreeAccount);
  const trialDays = Math.max(0, Number(user?.trialDays ?? defaultTrialDays));
  const trialEndsAtTime = safeSignupTime + trialDays * trialDayMs;
  const trialExpired = isFreeAccount && trialEndsAtTime <= now;
  const restricted = isFreeAccount && trialExpired;
  const allCategoryIds = dashboardCategories.map((category) => category.id);
  const allowedCategoryIds = restricted ? [freeAccessibleCategoryId] : allCategoryIds;
  const lockedCategoryIds = allCategoryIds.filter((categoryId) => !allowedCategoryIds.includes(categoryId));
  const lockedToolSlugs = restricted
    ? dashboardCategories
        .filter((category) => lockedCategoryIds.includes(category.id))
        .flatMap((category) => category.tools.map((tool) => tool.slug))
    : [];

  return {
    plan: isFreeAccount ? "free" : "pro",
    isFreeAccount,
    signupAt,
    trialEndsAt: new Date(trialEndsAtTime).toISOString(),
    trialExpired,
    trialDaysRemaining: Math.max(0, Math.ceil((trialEndsAtTime - now) / (24 * 60 * 60 * 1000))),
    restricted,
    allowedCategoryIds,
    lockedCategoryIds,
    lockedToolSlugs
  };
}

export function isCategoryLocked(access: SubscriptionAccess, categoryId: DashboardCategory["id"]) {
  return access.lockedCategoryIds.includes(categoryId);
}

export function isToolLocked(access: Pick<SubscriptionAccess, "lockedToolSlugs">, slug: string) {
  return access.lockedToolSlugs.includes(slug);
}
