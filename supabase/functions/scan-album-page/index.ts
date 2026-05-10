import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
    const image: string | undefined = body.image; // data URL or http(s) URL
    const hint: string | undefined = typeof body.hint === "string" ? body.hint : undefined;
    if (!image) {
      return new Response(JSON.stringify({ error: "missing_image" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Load catalog (codes + country) — cap to keep prompt small
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: stickers } = await admin
      .from("stickers")
      .select("code,country_code,country_name,group_letter,position")
      .limit(2000);

    const catalog = (stickers ?? []).map((s) => s.code);
    const codeSet = new Set(catalog.map((c) => c.toUpperCase()));

    const sysPrompt = `You analyze a photo of a Panini FIFA World Cup 2026 sticker album page.

Layout reference (real album):
- Country pages show a grid of slots (typically 4×5 or 4×4) with a header like "WE ARE NETHERLANDS".
- Each slot has the code PRINTED on it (e.g. "QAT 13", "NED 1", "BRA 10"). Treat "QAT 13" as code "QAT13".
- A slot is "filled" when a real sticker (player photo, team crest, mascot, logo) is GLUED on top of the printed code/placeholder.
- A slot is "empty" when you can clearly read the printed code on the flat colored background — no sticker glued on top.
- Special pages use codes FWC1..FWC19 (emblem, mascots, slogan, history) and CC1..CC14 (Coca-Cola).
- Cover sticker code is "00" (or "COV").

Identify EVERY slot visible on the page — be thorough with empty ones, the user needs the missing list.
Use ONLY codes that exist in this catalog: ${catalog.join(",")}.
If a printed code isn't in the catalog, omit it. Never invent codes. Never list the same code twice.

Return STRICT JSON:
{"slots":[{"code":"NED1","status":"filled"},{"code":"NED2","status":"empty"}],
 "page_hint":"short text like 'Netherlands - Group G'",
 "country_code":"NED"}`;

    const userParts: Array<unknown> = [
      { type: "text", text: hint ? `Page hint: ${hint}` : "Identify all slots on this page." },
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
    let parsed: { slots?: Array<{ code: string; status: string }>; page_hint?: string } = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = {};
    }

    const filledSet = new Set<string>();
    const emptySet = new Set<string>();
    for (const s of parsed.slots ?? []) {
      const code = String(s.code || "").toUpperCase().trim();
      if (!code || !codeSet.has(code)) continue;
      if (s.status === "filled") filledSet.add(code);
      else if (s.status === "empty") emptySet.add(code);
    }

    return new Response(
      JSON.stringify({
        filled: [...filledSet],
        empty: [...emptySet],
        page_hint: parsed.page_hint ?? null,
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
