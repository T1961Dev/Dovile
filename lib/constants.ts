export const DEFAULT_LIFE_AREAS = [
  "Home",
  "Career",
  "Love",
  "Family & Friends",
  "Leisure",
  "Finance",
  "Health",
  "Personal Development",
] as const;

export type LifeAreaSlug = (typeof DEFAULT_LIFE_AREAS)[number];

export const MAX_FREE_ITEMS = 100;
export const MAX_BASIC_ITEMS = 500;
export const DEFAULT_XP_PER_TASK = 10;

export const DEFAULT_DAILY_CAPACITY = 6;
export const MAX_FREE_DAILY_CAPACITY = 6;
export const MAX_BASIC_DAILY_CAPACITY = 12;
export const MAX_PRO_DAILY_CAPACITY = 24;

export const STRIPE_PRICES = {
  basic: process.env.NEXT_PUBLIC_STRIPE_PRICE_BASIC ?? "",
  pro: process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO ?? "",
  proplus: process.env.NEXT_PUBLIC_STRIPE_PRICE_PROPLUS ?? "",
} as const;

