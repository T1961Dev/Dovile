export type LifeArea = {
  id: string;
  name: string;
  color: string;
  rating: number;
  user_id: string;
  created_at: string | null;
  bubble_size: number | null;
  bubble_position: { ring: number; angle: number } | null;
  vision_text: string | null;
};

export type WorkstreamKind = "project" | "process" | "habit";

export type Workstream = {
  id: string;
  life_area_id: string;
  user_id: string;
  kind: WorkstreamKind;
  title: string;
  description: string | null;
  active: boolean;
  created_at: string | null;
  bubble_size: number | null;
  bubble_position: { ring: number; angle: number } | null;
  vision_id: string | null;
};

export type ItemType = "task" | "idea";

export type ItemStatus = "pending" | "in_progress" | "done" | "archived";

export type Item = {
  id: string;
  life_area_id: string;
  workstream_id: string | null;
  user_id: string;
  type: ItemType;
  title: string;
  notes: string | null;
  status: ItemStatus;
  due_date: string | null;
  scheduled_for: string | null;
  created_at: string | null;
  completed_at: string | null;
  bubble_size: number | null;
  bubble_position: { ring: number; angle: number } | null;
};

export type Vision = {
  id: string;
  user_id: string;
  title: string;
  timeframe: string;
  description: string | null;
  ai_summary: string | null;
  target_date: string | null;
  status: string;
  created_at: string | null;
  updated_at: string | null;
};

export type VisionStep = {
  id: string;
  vision_id: string;
  bubble_type: "idea" | "task" | "project" | "process";
  bubble_payload: Record<string, unknown>;
  approved: boolean;
  approved_at: string | null;
  created_at: string | null;
};

export type LifeAreaRating = {
  id: string;
  life_area_id: string;
  rating: number;
  noted_at: string;
  note: string | null;
  created_at: string | null;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  color?: string;
  source?: "google" | "lifewheel";
};

export type XpSummary = {
  totalXp: number;
  currentLevel: number;
  xpToNextLevel: number;
  streak: number;
};

