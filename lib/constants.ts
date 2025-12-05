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
export const DEFAULT_XP_PER_TASK = 10;

export const DEFAULT_DAILY_CAPACITY = 6;

