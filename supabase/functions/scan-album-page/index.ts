import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type Slot = { code: string; status: "filled" | "empty" };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const image: string | undefined = body.image;
    const hint: string | undefined = typeof body.hint === "string" ? body.hint : undefined;
    if (!image) {
      return new Response(JSON.stringify({ error: "missing_image" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Load catalog
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: stickers } = await admin
      .from("stickers")
      .select("code,country_code,country_name,group_letter,position,kind")
      .limit(2000);

    const catalog = (stickers ?? []) as Array<{
      code: string;
      country_code: string;
      country_name: string;
      group_letter: string;
      position: number;
      kind: string;
    }>;
    const codeSet = new Set(catalog.map((c) => c.code.toUpperCase()));

    // Build a map of country_code -> all codes in that country
    const codesByCountry = new Map<string, string[]>();
    for (const s of catalog) {
      const cc = s.country_code.toUpperCase();
      const arr = codesByCountry.get(cc) ?? [];
      arr.push(s.code.toUpperCase());
      codesByCountry.set(cc, arr);
    }

    const sysPrompt = `You are analyzing a high-resolution photo of one page of the Panini FIFA World Cup 26 sticker album.

LAYOUT
- A country page shows a grid (commonly 4 columns × 5 rows or 4×4) of numbered slots.
- The PRINTED slot code is in the corner of each slot (e.g. "BRA 1", "NED 12", "QAT 13"). Treat "BRA 1" as code "BRA1".
- Special pages: codes "FWC1".."FWC19" (history/mascot/emblem) and "CC1".."CC14" (Coca-Cola). Cover sticker is "00".
- "filled" = a real glued sticker covers the printed placeholder (you see a player photo, crest, mascot, or shiny foil). The printed code is HIDDEN by the sticker.
- "empty" = the printed code/silhouette is visible on the flat colored background — NO sticker glued on top.

HOW TO IDENTIFY EVERY SLOT (CRITICAL)
1. Detect the country/page from any header text ("WE ARE NETHERLANDS"), flag, crest, or printed slot codes visible.
2. Decide the grid size from the visible slots.
3. For EACH slot of the grid, decide filled or empty. Never skip an empty slot — the user needs the full missing list.
4. If you can read the printed code in a slot → it is empty. Always emit it with status "empty".
5. If the slot is covered by a glued sticker → it is filled. Emit the slot's expected code with status "filled" (use the country prefix + the slot number you can infer from grid position).
6. NEVER guess a code outside this catalog. Use ONLY codes that exist in: ${catalog.map((c) => c.code).join(",")}.
7. Do not return the same code twice.

OUTPUT — STRICT JSON ONLY:
{
  "country_code": "BRA",
  "page_hint": "Brazil - Group F",
  "grid_rows": 5,
  "grid_cols": 4,
  "slots": [
    {"code":"BRA1","status":"filled"},
    {"code":"BRA2","status":"empty"}
  ]
}`;

    const userParts: Array<unknown> = [
      {
        type: "text",
        text: hint
          ? `Page hint: ${hint}. Identify EVERY slot — filled and empty.`
          : "Identify EVERY slot on this page — filled and empty.",
      },
      { type: "image_url", image_url: { url: image } },
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": LOVABLE_AI_KEY,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: userParts },
        ],
        response_format: { type: "json_object" },
        temperature: 0.1,
      }),
    });

    if (aiRes.status === 429) {
      return new Response(JSON.stringify({ error: "rate_limited" }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (aiRes.status === 402) {
      return new Response(JSON.stringify({ error: "credits_exhausted" }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    if (!aiRes.ok) {
      const t = await aiRes.text();
      return new Response(JSON.stringify({ error: `ai_${aiRes.status}`, detail: t.slice(0, 300) }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const data = await aiRes.json();
    const content = data?.choices?.[0]?.message?.content ?? "{}";
    let parsed: {
      slots?: Slot[];
      page_hint?: string;
      country_code?: string;
    } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    const filledSet = new Set<string>();
    const emptySet = new Set<string>();
    const prefixCount = new Map<string, number>();

    for (const s of parsed.slots ?? []) {
      const code = String(s.code || "").toUpperCase().replace(/\s+/g, "").trim();
      if (!code || !codeSet.has(code)) continue;
      const status = s.status === "filled" ? "filled" : s.status === "empty" ? "empty" : null;
      if (!status) continue;
      if (status === "filled") filledSet.add(code);
      else emptySet.add(code);
      const prefix = code.replace(/\d+$/, "");
      prefixCount.set(prefix, (prefixCount.get(prefix) ?? 0) + 1);
    }

    // Pick the dominant country prefix (most slots) to complete the grid
    let pageCountry: string | null = (parsed.country_code ?? "").toUpperCase() || null;
    let bestCount = 0;
    for (const [k, v] of prefixCount.entries()) {
      if (v > bestCount && k.length === 3) {
        bestCount = v;
        pageCountry = pageCountry ?? k;
      }
    }

    // Post-process: if we detected ≥3 slots from a single country, complete its grid.
    // Every catalog code for that country not seen as filled becomes empty.
    if (pageCountry && bestCount >= 3) {
      const expected = codesByCountry.get(pageCountry) ?? [];
      for (const c of expected) {
        if (!filledSet.has(c) && !emptySet.has(c)) {
          emptySet.add(c);
        }
      }
    }

    return new Response(
      JSON.stringify({
        filled: [...filledSet],
        empty: [...emptySet],
        page_hint: parsed.page_hint ?? null,
        country_code: pageCountry,
      }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 200,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
