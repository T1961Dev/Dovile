# Life Scope Product Specification

> Version: 0.1 (2025-11-12)  
> Owners: Engineering & Product  
> Goal: unify the LifeScope experience into a single-screen, circle-first UI with full Supabase + AI support.

---

## 1. Experience Overview

### 1.1 Primary Screen
- **Single canvas** (whiteboard-like) containing three concentric regions:
  1. **Center hub** – today view of tasks/ideas (mixed inner bubbles).
  2. **Middle orbit** – projects & processes grouped by life area.
  3. **Outer orbit** – life areas with rating ring & shortcuts.
- **All entities are bubbles**. Size encodes scope/weight, color encodes state (brand palette below).
- **Zoom controls / timeline scrubber** align bottom of screen:
  - Day → Week → Quarter → Year → 10-year vision.
  - Zooming swaps which time slice is shown in the center hub.
- **AI Avatar** anchored bottom-left, primary actions (“Add idea”, “Add task”) plus chat entry.
- **Empty Head mode** toggled top-right to switch to backlog/list view using same layout.

### 1.2 Entity Types & Actions

| Type        | Bubble Location          | Required Data                                     | Quick Actions                                 |
|-------------|--------------------------|---------------------------------------------------|-----------------------------------------------|
| Idea        | Outer idea stream / captured backlog | `title`, optional `notes`, `life_area_id`, `project_id`, `status` (`backlog`/`converted`) | Approve → convert to task/project, archive, edit |
| Task        | Center hub (scheduled/completed) | `title`, `life_area_id`, `project_id/process_id`, `scheduled_for`, `status`, `xp_value` | Complete, reschedule, edit, drag to new area   |
| Project     | Middle orbit             | `title`, `life_area_id`, `status`, `xp_value`, `vision_link` | Decompose (AI), mark done (+10xp), archive    |
| Process     | Middle orbit             | `title`, `life_area_id`, `recurrence`, `status`   | Schedule recurrence, archive, convert         |
| Life Area   | Outer orbit              | `name`, `color`, `rating (0–10)`, `xp_multiplier`, `vision_text` | Adjust rating, add project/process, edit meta |
| Vision / Plan | Overlay mode           | `title`, `timeframe`, `description`, `ai_summary`, `target_date` | Approve plan (auto create bubbles), archive  |

All entities share base attributes: `id`, `type`, `user_id`, `created_at`, `updated_at`, `bubble_size`, `bubble_position`.

### 1.3 XP System
- **Idea capture**: +1 XP.
- **Task completion**: +2 XP (immediate animation near bubble).
- **Project completion**: +10 XP.
- XP streak tracked daily; surface small card top-right (Day/Week streak).
- Completed tasks remain on timeline (faded, dated).

---

## 2. Technical Architecture

### 2.1 Supabase Schema Additions

#### Tables
1. `visions`
   ```sql
   create table if not exists visions (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references auth.users(id) on delete cascade,
     title text not null,
     timeframe text not null, -- e.g. "3 years"
     description text,
     ai_summary text,
     target_date date,
     status text not null default 'active',
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );
   ```

2. `vision_steps`
   ```sql
   create table if not exists vision_steps (
     id uuid primary key default gen_random_uuid(),
     vision_id uuid not null references visions(id) on delete cascade,
     bubble_type text not null, -- idea|task|project|process
     bubble_payload jsonb not null,
     approved boolean not null default false,
     created_at timestamptz default now(),
     approved_at timestamptz
   );
   ```

3. `life_area_ratings`
   ```sql
   create table if not exists life_area_ratings (
     id uuid primary key default gen_random_uuid(),
     life_area_id uuid not null references life_areas(id) on delete cascade,
     rating smallint not null check (rating between 0 and 10),
     noted_at date not null default current_date,
     note text,
     created_at timestamptz default now()
   );
   ```

4. `idea_archive`
   ```sql
   create table if not exists idea_archive (
     id uuid primary key default gen_random_uuid(),
     idea_id uuid not null references items(id) on delete cascade,
     archived_at timestamptz default now(),
     reason text
   );
   ```

#### Columns
- `items`: add `bubble_size float`, `bubble_position jsonb`.
- `workstreams`: add `bubble_size float`, `bubble_position jsonb`, `vision_id uuid`.
- `life_areas`: add `bubble_size float`, `bubble_position jsonb`, `vision_text text`.

Indexes: indexes on `items(user_id, scheduled_for)`, `vision_steps(vision_id, approved)` etc.

### 2.2 Server Actions (replace `/api/*`)

| Entity        | Action file                       | Functions                                                     |
|---------------|------------------------------------|---------------------------------------------------------------|
| Life areas    | `actions/life-areas.ts`            | `createLifeArea`, `updateLifeArea`, `deleteLifeArea`, `rateLifeArea` |
| Projects/Process | `actions/workstreams.ts`       | `createWorkstream`, `updateWorkstream`, `deleteWorkstream`    |
| Tasks/Ideas   | `actions/items.ts`                | `createItem`, `updateItem`, `completeItem`, `deleteItem`, `convertIdea` |
| Visions       | `actions/visions.ts`              | `createVision`, `approveVisionSteps`, `archiveVision`         |
| Empty Head    | `actions/ideas.ts` (alias of items)| `archiveIdea`, `restoreIdea`                                 |
| XP/Stats      | `actions/xp.ts`                   | `logXpEvent` (server-enforced)                                |

Each action returns typed records (using `Database` generated types) and triggers `revalidatePath("/app")`.

### 2.3 Store Structure

Create `app/store/bubbles.ts` using Zustand with selectors for:
```ts
type BubbleType = "life_area" | "project" | "process" | "task" | "idea" | "vision";

interface Bubble {
  id: string;
  type: BubbleType;
  lifeAreaId?: string;
  parentId?: string;
  title: string;
  status: string;
  bubbleSize: number;
  bubblePosition: { ring: number; angle: number };
  metadata: Record<string, unknown>;
}
```
Store exposes `hydrateFromServer`, `upsertBubble`, `removeBubble`, `setVisionFocus`, `setTimelineZoom`, `setIdeaStream`.

### 2.4 AI Pipelines

1. **Capture classification** (`actions/ai/classify.ts`):
   - Input: `{ text, audioUrl? }`.
   - Output: `{ type: "idea" | "task", lifeArea, workstreamSuggestion, confidence }`.
   - Uses OpenAI GPT-4o mini, fallback to heuristics.

2. **Project decomposition** (`actions/ai/decompose.ts`):
   - Input: `{ projectId, description, targetDate }`.
   - Output: list of tasks with estimates; stored in `vision_steps` as pending.

3. **Vision reflection** (`actions/ai/reflect.ts`):
   - Weekly job summarizing progress vs. `visions`, suggests next tasks (insert as idea suggestions).

4. **Planner mode**:
   - Chat flow within Avatar; on approval call `createVision` + auto-creation of workstreams/tasks.

### 2.5 Timeline & Zoom

Define zoom levels:
```ts
type ZoomLevel = "day" | "week" | "quarter" | "year" | "decade";
```
- Each level changes ring distances, bubble scaling, filter range.
- Scroll/drag timeline component updates zoom + selected date.

### 2.6 Styling

Color palette (from brand):
- Cream `#FFF4DB`, Mint `#7FE5D1`, Teal `#0EA8A8`, Yellow `#FFD833`, Peach `#FFBC85`, Orange `#FF7348`, Lavender `#DED6FF`, Off-black `#0B1918`.
- Bubbles are primarily white with tinted badge; selected states use teal glow.
- Shadows soft, blur `8-24px`, opacity ~0.2.
- Typography: heading `font-semibold`, body `font-medium`, 14–16px.

---

## 3. Delivery Plan

### Milestone A – Foundation (Backend & State)
1. Migrations for new tables/columns.
2. Implement server actions (`life-areas`, `workstreams`, `items`, `visions`, `xp`).
3. Update Zustand store to bubble model + hydration.
4. Replace API routes with server actions on the client components (`AreaSheet`, `AvatarCoach`, `Timeline`, etc.).

### Milestone B – Circular UI v1
1. New `CircleCanvas` component (canvas/WebGL) with ring layout.
2. Render life area/project/task/idea bubbles using store state.
3. Basic interactions: select, add via plus icon, drag to reorder rings (persisting bubble position).
4. XP animation on completion.

### Milestone C – Timeline & Zoom
1. Timeline scrubber with `ZoomLevel`.
2. Filter data per level, animate transitions.
3. Completed task history overlay.

### Milestone D – Modules
1. Empty Head backlog view & drag-to-convert.
2. Wheel of Life rating modal + rating history chart.
3. Current Scope list (identical data; toggle button).
4. Vision/Planner overlay, AI decomposition approval UI.

### Milestone E – AI & Voice
1. Implement classification + decomposition actions.
2. Integrate with Avatar chat; handle approvals -> store updates.
3. Vision reflection weekly job (cron).
4. Voice capture (browser): record → transcribe → classify.
5. Widget endpoint (`/api/capture`) for mobile.

### Milestone F – Polish
1. Performance pass (memoization, chunked rendering).
2. Accessibility: ensure keyboard actions, aria descriptions on dialogs.
3. Extensive QA (timeline offsets, XP counters, AI fallback).

---

## 4. Open Questions (need answers before coding)
1. **AI budget:** Preferred OpenAI model & rate limits?
2. **Planner mode approval:** Should the user receive a diff of created bubbles before commit?
3. **Recurring processes:** We storing recurrence rule (`RRULE` string) or simple weekly schedule?
4. **Widget platform:** iOS/Android? (Impacts how we surface tokenless capture endpoint.)
5. **3D effect requirement:** Are we targeting actual 3D (WebGL with perspective) or flat circle with depth cues?

Once these are resolved, proceed to Milestone A implementation.

---

**Next Step:** await stakeholder comments, then create tasks per milestone and start Milestone A. 🛠️


