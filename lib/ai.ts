import { DEFAULT_DAILY_CAPACITY, DEFAULT_LIFE_AREAS } from "@/lib/constants";

const openaiKey = process.env.OPENAI_API_KEY;
const openaiBaseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";
const openRouterKey = process.env.OPENROUTER_API_KEY;
const openRouterBaseUrl = "https://openrouter.ai/api/v1";

type Provider = "openai" | "openrouter";

const provider: Provider | null = openaiKey ? "openai" : openRouterKey ? "openrouter" : null;

export async function classifyUtterance(
  message: string,
  options?: { 
    model?: string; 
    dailyCapacity?: number; 
    availableHours?: number;
    workstreams?: Array<{ title: string; description: string | null; lifeArea: string; taskExamples?: string[] }>;
  },
) {
  const model = options?.model ?? defaultModel();
  const dailyCapacity = options?.dailyCapacity ?? DEFAULT_DAILY_CAPACITY;
  const availableHours = options?.availableHours;

  const capacityContext = availableHours
    ? `The user has ${availableHours} hours available today after accounting for calendar events and routine blocks (sleep, food, etc.). Only suggest tasks that can realistically fit in this time.`
    : `The user's daily capacity is ${dailyCapacity} tasks.`;

  // Build workstream context for learning
  let workstreamContext = "";
  if (options?.workstreams && options.workstreams.length > 0) {
    workstreamContext = `\n\nEXISTING PROJECTS/PROCESSES FOR CONTEXT (learn from these to better categorize new items):\n`;
    options.workstreams.forEach((ws) => {
      workstreamContext += `- "${ws.title}" (${ws.lifeArea})`;
      if (ws.description) {
        workstreamContext += ` - Description: ${ws.description}`;
      }
      if (ws.taskExamples && ws.taskExamples.length > 0) {
        workstreamContext += ` - Example tasks: ${ws.taskExamples.slice(0, 3).join(", ")}`;
      }
      workstreamContext += `\n`;
    });
    workstreamContext += `\nUse these projects/processes as reference. If the new item relates to any of these, suggest the project/process name in "workstream_hint".`;
  }

  const systemPrompt = `
You are LifeWheel's productivity coach helping users organize their thoughts in DUMP MODE.

Your job is to classify the user's message and automatically assign it to the correct life area and project/process.

CRITICAL RULES FOR DUMP MODE:
1. All dumped items should become IDEAS (not tasks) initially - the user will later convert them to tasks or actions as needed.
2. Automatically assign the item to the most appropriate life area from: ${JSON.stringify(DEFAULT_LIFE_AREAS)}
3. IMPORTANT: If you can identify a specific project or process this item belongs to (by matching it to existing projects/processes below or by understanding the context), suggest the EXACT project/process name in "workstream_hint". Learn from project descriptions and example tasks to make better matches. If you cannot decide, leave it null - the item will stay in the outer circle of the life area.
4. If the user's wording is unclear, suggest better wording in "improved_wording" and include it in the response.
5. If you're uncertain about the life area, set "confidence" below 0.7 and suggest the user clarify in "actions".

${capacityContext}
${workstreamContext}

Return JSON with:
- "type": "idea" (always "idea" for DUMP MODE)
- "life_area": one of ${JSON.stringify(DEFAULT_LIFE_AREAS)}
- "workstream_hint": suggested project/process name if you can identify one, otherwise null
- "confidence": number 0-1 (how confident you are about the classification)
- "summary": short, clear title ready to add to the wheel (use improved wording if original was unclear)
- "improved_wording": better wording if original was unclear, otherwise same as summary
- "schedule": null (ideas don't get scheduled)
- "actions": array of strings with follow-ups or clarification requests

Remember: in DUMP MODE, items become IDEAS, not tasks.
`;

  const response = await chatCompletion([
    { role: "system", content: systemPrompt.trim() },
    { role: "user", content: message },
  ], model);

  try {
    return JSON.parse(response);
  } catch {
    return {
      type: "idea",
      life_area: "Personal Development",
      workstream_hint: null,
      confidence: 0.4,
      summary: message.slice(0, 60),
      actions: ["Clarify this idea."],
    };
  }
}

export async function decomposeProject(prompt: string, options?: { model?: string }) {
  const model = options?.model ?? defaultModel();
  const response = await chatCompletion(
    [
      {
        role: "system",
        content: `You are an AI productivity coach helping users break down plans into actionable tasks.

CRITICAL RULES FOR PLAN DECOMPOSITION (PLANNER MODE):
1. Always break down any plan until you reach actionable, one-sit tasks. A "one-sit task" means it can be completed in a single focused session (typically 15-60 minutes) without needing to switch contexts or break for other activities.

2. Tasks must be easy to accomplish with very well-verbalized Definition of Done. Each task must include:
   - Clear, specific action verb (e.g., "Write", "Call", "Research", "Create")
   - Specific deliverable or outcome
   - Definition of Done: A clear statement of what "done" looks like for this task

3. If the user gives an unclear task/idea, automatically suggest better wording and include it in the response. Provide both the original unclear version and your improved version.

4. Each task should be independent and completable without waiting for other tasks (unless explicitly sequential).

5. Avoid vague tasks like "work on X" or "think about Y". Instead, use specific actions like "Draft outline for X document" or "Research 3 options for Y and create comparison table".

Return JSON with this structure:
{
  "tasks": [
    {
      "title": "Clear, actionable task title with action verb",
      "notes": "Definition of Done: [specific criteria for completion]. Additional context or steps if needed.",
      "improved_wording": "If original was unclear, provide improved version here, otherwise same as title"
    }
  ],
  "suggestions": ["Any suggestions for better wording or clarification if input was unclear"]
}`,
      },
      { role: "user", content: prompt },
    ],
    model,
  );

  try {
    return JSON.parse(response);
  } catch {
    return { tasks: [] };
  }
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export async function chatCompletion(messages: ChatMessage[], model: string) {
  if (!provider) {
    throw new Error("No AI provider configured");
  }

  if (provider === "openai") {
    const response = await fetch(`${openaiBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });
    if (!response.ok) {
      throw new Error("OpenAI request failed");
    }
    const data = await response.json();
    return data.choices[0]?.message?.content ?? "{}";
  }

  const response = await fetch(`${openRouterBaseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openRouterKey}`,
      "HTTP-Referer": "https://lifewheel.app",
      "X-Title": "LifeWheel",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.5,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error("OpenRouter request failed");
  }
  const data = await response.json();
  return data.choices[0]?.message?.content ?? "{}";
}

export async function transcribeAudio(blob: Blob) {
  if (!openaiKey) {
    throw new Error("Audio transcription requires OPENAI_API_KEY");
  }

  const formData = new FormData();
  formData.append("file", blob, "audio.webm");
  formData.append("model", "whisper-1");

  const response = await fetch(`${openaiBaseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error("Transcription failed");
  }

  const data = await response.json();
  return data.text as string;
}

function defaultModel() {
  if (provider === "openrouter") {
    return process.env.OPENAI_MODEL ?? "openrouter/auto";
  }
  return process.env.OPENAI_MODEL ?? "gpt-4o-mini";
}

