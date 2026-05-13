// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM = `Você reconhece figurinhas oficiais do álbum Panini FIFA World Cup 26.

Cada figurinha tem um CÓDIGO impresso (geralmente no canto), no formato:
- "00" = capa do álbum
- 3 letras (sigla FIFA do país) + número 1-20, ex: BRA10, ARG3, MEX1, USA20, FRA15
- "FWC" + número 1-19 = FIFA World Cup History
- "CC" + número 1-14 = Coca-Cola

Olhe a foto com atenção:
- O NOME DO JOGADOR é o texto grande sob a foto (ex: "VINÍCIUS JÚNIOR", "MESSI").
- A BANDEIRA / ESCUDO indica o país.
- O NÚMERO DA CAMISA pode aparecer próximo ao nome.
- Se for capa, FWC ou CC, player_name DEVE ser null.

Devolva APENAS um JSON válido (sem markdown, sem texto extra):
{
  "code": "<código no formato acima ou null>",
  "country_name": "<nome do país em português ou null>",
  "player_name": "<nome completo do jogador ou null>",
  "jersey_number": <número 1-20 ou null>,
  "kind_hint": "player" | "history" | "sponsor" | "cover" | null,
  "confidence": <0..1>
}

Se não for figurinha do álbum, devolva todos os campos null e confidence 0.`;

type AIResult = {
  code: string | null;
  country_name: string | null;
  player_name: string | null;
  jersey_number: number | null;
  kind_hint: string | null;
  confidence: number;
};

type Suggestion = {
  code: string;
  player_name: string | null;
  country_name: string | null;
  flag_emoji: string | null;
  score: number;
};

async function callAI(image: string): Promise<AIResult> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: [
            { type: "text", text: "Identifique esta figurinha." },
            { type: "image_url", image_url: { url: image } },
          ],
        },
      ],
    }),
  });
  if (r.status === 429) throw new Error("rate_limited");
  if (r.status === 402) throw new Error("credits_exhausted");
  if (!r.ok) throw new Error(`gateway_${r.status}: ${await r.text()}`);
  const data = await r.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "{}";
  const cleaned = content.replace(/```json|```/g, "").trim();
  let parsed: any = {};
  try { parsed = JSON.parse(cleaned); } catch { parsed = {}; }
  return {
    code: parsed.code ? String(parsed.code).toUpperCase().replace(/\s+/g, "") : null,
    country_name: parsed.country_name ? String(parsed.country_name).trim() : null,
    player_name: parsed.player_name ? String(parsed.player_name).trim() : null,
    jersey_number: typeof parsed.jersey_number === "number" ? parsed.jersey_number : null,
    kind_hint: parsed.kind_hint ?? null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
  };
}

async function resolveCode(ai: AIResult, db: ReturnType<typeof createClient>): Promise<{
  code: string | null;
  player_name: string | null;
  country_name: string | null;
  flag_emoji: string | null;
  match_source: string | null;
  suggestions: Suggestion[];
}> {
  // 1) exact code
  if (ai.code) {
    const { data } = await db.from("stickers")
      .select("code,player_name,country_name,flag_emoji")
      .ilike("code", ai.code).maybeSingle();
    if (data) return { ...data, match_source: "code", suggestions: [] };
  }

  // 2) country + jersey number (player kind)
  if (ai.country_name && ai.jersey_number) {
    const { data } = await db.from("stickers")
      .select("code,player_name,country_name,flag_emoji")
      .eq("kind", "player")
      .eq("position", ai.jersey_number)
      .ilike("country_name", ai.country_name)
      .maybeSingle();
    if (data) return { ...data, match_source: "country+number", suggestions: [] };
  }

  // 3) player_name fuzzy match via pg_trgm similarity()
  if (ai.player_name) {
    const name = ai.player_name.toLowerCase();
    // try filter by country first
    const baseQuery = db.from("stickers")
      .select("code,player_name,country_name,flag_emoji")
      .eq("kind", "player")
      .not("player_name", "is", null);

    const { data: candidates } = ai.country_name
      ? await baseQuery.ilike("country_name", ai.country_name).limit(200)
      : await baseQuery.limit(2000);

    const scored: Suggestion[] = (candidates ?? [])
      .map((c: any) => ({
        code: c.code,
        player_name: c.player_name,
        country_name: c.country_name,
        flag_emoji: c.flag_emoji,
        score: trigramSimilarity(name, String(c.player_name).toLowerCase()),
      }))
      .filter((s) => s.score >= 0.45)
      .sort((a, b) => b.score - a.score);

    if (scored.length) {
      const best = scored[0];
      // strong match → auto-pick
      if (best.score >= 0.7 || (scored.length === 1 && best.score >= 0.55)) {
        return {
          code: best.code,
          player_name: best.player_name,
          country_name: best.country_name,
          flag_emoji: best.flag_emoji,
          match_source: "player_name",
          suggestions: scored.slice(0, 3),
        };
      }
      return {
        code: null, player_name: null, country_name: ai.country_name, flag_emoji: null,
        match_source: "suggestion", suggestions: scored.slice(0, 3),
      };
    }
  }

  return {
    code: null, player_name: ai.player_name, country_name: ai.country_name, flag_emoji: null,
    match_source: null, suggestions: [],
  };
}

// Lightweight trigram similarity (Jaccard over 3-grams) — mirrors pg_trgm closely enough
function trigramSimilarity(a: string, b: string): number {
  const grams = (s: string) => {
    const t = `  ${s.replace(/[^a-z0-9 ]/gi, " ").trim().toLowerCase()}  `;
    const set = new Set<string>();
    for (let i = 0; i < t.length - 2; i++) set.add(t.slice(i, i + 3));
    return set;
  };
  const A = grams(a), B = grams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    // Auth check — prevent anonymous AI credit abuse
    const authHeader = req.headers.get("Authorization") ?? "";
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return json({ error: "unauthorized" }, 401);

    const { image } = await req.json();
    if (!image) return json({ error: "image required" }, 400);

    let ai: AIResult;
    try { ai = await callAI(image); }
    catch (e: any) {
      const msg = String(e?.message ?? e);
      if (msg === "rate_limited") return json({ error: "rate_limited" }, 429);
      if (msg === "credits_exhausted") return json({ error: "credits_exhausted" }, 402);
      return json({ error: msg }, 500);
    }

    const db = createClient(SUPABASE_URL, SERVICE_KEY);
    const resolved = await resolveCode(ai, db);

    return json({
      code: resolved.code,
      player_name: resolved.player_name ?? ai.player_name,
      country_name: resolved.country_name ?? ai.country_name,
      flag_emoji: resolved.flag_emoji,
      jersey_number: ai.jersey_number,
      confidence: ai.confidence,
      match_source: resolved.match_source,
      suggestions: resolved.suggestions,
    });
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
