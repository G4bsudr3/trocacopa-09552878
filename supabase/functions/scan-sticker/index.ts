// deno-lint-ignore-file
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SYSTEM = `Você é especialista em figurinhas oficiais do álbum Panini FIFA World Cup 26.

CÓDIGOS POSSÍVEIS (sempre impressos na figurinha, geralmente no canto):
- "00" = capa
- <SIGLA FIFA 3 letras><número 1-20>: ex BRA10, ARG3, MEX1, USA20, FRA15, GER7
- "FWC"+1-19 = FIFA World Cup History
- "CC"+1-14 = Coca-Cola

REGRAS DE LEITURA:
- Leia o CÓDIGO IMPRESSO no canto da figurinha (prioridade máxima).
- O NOME DO JOGADOR é o texto grande sob a foto (ex: "VINÍCIUS JÚNIOR", "MESSI"). Mantenha acentos e grafia originais.
- A BANDEIRA / ESCUDO + nome do país impresso indicam o country_name (em português).
- O NÚMERO DA CAMISA pode aparecer perto do nome ou na camiseta.
- Se for capa, FWC ou CC, player_name DEVE ser null.
- Se a imagem está cortada/borrada/escura e você não tem certeza, devolva confidence baixa (<0.5) mas tente extrair o que conseguir.

Devolva APENAS um JSON válido (sem markdown, sem texto extra):
{
  "code": "<código exato lido ou null>",
  "country_name": "<nome do país em português ou null>",
  "player_name": "<nome completo do jogador como impresso ou null>",
  "jersey_number": <número 1-20 ou null>,
  "kind_hint": "player" | "history" | "sponsor" | "cover" | null,
  "confidence": <0..1>
}

Se não for figurinha do álbum, devolva todos os campos null e confidence 0.`;

const CODE_ONLY_SYSTEM = `Olhe APENAS para o CÓDIGO IMPRESSO no canto desta figurinha do Panini World Cup 26.
Formatos válidos: "00", "FWC1".."FWC19", "CC1".."CC14", ou 3 letras + número 1-20 (ex BRA10, MEX1, ARG3).
Devolva APENAS este JSON: {"code":"<código ou null>","confidence":<0..1>}`;

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

async function callGateway(payload: unknown): Promise<any> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_API_KEY,
    },
    body: JSON.stringify(payload),
  });
  if (r.status === 429) throw new Error("rate_limited");
  if (r.status === 402) throw new Error("credits_exhausted");
  if (!r.ok) throw new Error(`gateway_${r.status}: ${(await r.text()).slice(0, 200)}`);
  return await r.json();
}

async function callAI(image: string): Promise<AIResult> {
  const data = await callGateway({
    model: "google/gemini-2.5-pro",
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: "Identifique esta figurinha com a máxima precisão." },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
  });
  const content: string = data?.choices?.[0]?.message?.content ?? "{}";
  let parsed: any = {};
  try { parsed = JSON.parse(content); } catch { parsed = {}; }
  return {
    code: parsed.code ? String(parsed.code).toUpperCase().replace(/\s+/g, "") : null,
    country_name: parsed.country_name ? String(parsed.country_name).trim() : null,
    player_name: parsed.player_name ? String(parsed.player_name).trim() : null,
    jersey_number: typeof parsed.jersey_number === "number" ? parsed.jersey_number : null,
    kind_hint: parsed.kind_hint ?? null,
    confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
  };
}

async function callAICodeOnly(image: string): Promise<{ code: string | null; confidence: number }> {
  const data = await callGateway({
    model: "google/gemini-2.5-pro",
    messages: [
      { role: "system", content: CODE_ONLY_SYSTEM },
      {
        role: "user",
        content: [
          { type: "text", text: "Qual é o código impresso?" },
          { type: "image_url", image_url: { url: image } },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0,
  });
  const content: string = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    const p = JSON.parse(content);
    return {
      code: p.code ? String(p.code).toUpperCase().replace(/\s+/g, "") : null,
      confidence: typeof p.confidence === "number" ? p.confidence : 0,
    };
  } catch {
    return { code: null, confidence: 0 };
  }
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

  // 2) country + jersey number
  if (ai.country_name && ai.jersey_number) {
    const { data } = await db.from("stickers")
      .select("code,player_name,country_name,flag_emoji")
      .eq("kind", "player")
      .eq("position", ai.jersey_number)
      .ilike("country_name", ai.country_name)
      .maybeSingle();
    if (data) return { ...data, match_source: "country+number", suggestions: [] };
  }

  // 3) player_name fuzzy
  if (ai.player_name) {
    const name = ai.player_name.toLowerCase();
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
    let resolved = await resolveCode(ai, db);

    // 2nd-pass: if no resolved code and confidence is low, ask for the printed code only
    if (!resolved.code && ai.confidence < 0.6) {
      try {
        const codeOnly = await callAICodeOnly(image);
        if (codeOnly.code) {
          const { data } = await db.from("stickers")
            .select("code,player_name,country_name,flag_emoji")
            .ilike("code", codeOnly.code).maybeSingle();
          if (data) {
            resolved = {
              ...data,
              match_source: "code_pass2",
              suggestions: resolved.suggestions,
            };
            ai.confidence = Math.max(ai.confidence, codeOnly.confidence);
          }
        }
      } catch { /* ignore */ }
    }

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
