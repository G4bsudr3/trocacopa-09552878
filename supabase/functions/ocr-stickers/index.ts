import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_AI_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

type Sticker = { code: string; image_url: string | null; player_name: string | null };

async function ocrOne(image_url: string): Promise<{ player_name: string | null; confidence: number }> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": LOVABLE_AI_KEY,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        {
          role: "system",
          content:
            "You extract the player's full name printed on a Panini-style football sticker. Return ONLY a JSON object: {\"player_name\":\"...\",\"confidence\":0..1}. If no readable player name, return {\"player_name\":null,\"confidence\":0}. Do not include team, country, position, or numbers.",
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Extract the player name." },
            { type: "image_url", image_url: { url: image_url } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`AI ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content ?? "{}";
  try {
    const j = JSON.parse(content);
    const name = j.player_name ? String(j.player_name).trim() : null;
    const conf = typeof j.confidence === "number" ? j.confidence : 0;
    return { player_name: name && name.length > 1 ? name : null, confidence: conf };
  } catch {
    return { player_name: null, confidence: 0 };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // auth: must be admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  const codes: string[] | undefined = Array.isArray(body.codes) ? body.codes : undefined;
  const onlyMissing: boolean = body.only_missing !== false; // default true
  const onlyKind: string = body.only_kind ?? "player";
  const limit: number = Math.min(Number(body.limit ?? 1000), 1000);

  let q = admin.from("stickers").select("code,image_url,player_name").not("image_url", "is", null);
  if (codes && codes.length) q = q.in("code", codes);
  else {
    if (onlyKind) q = q.eq("kind", onlyKind);
    if (onlyMissing) q = q.is("player_name", null);
  }
  q = q.limit(limit);

  const { data: stickers, error } = await q;
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...cors, "Content-Type": "application/json" } });

  const list = (stickers ?? []) as Sticker[];
  let ok = 0, failed = 0, skipped = 0;
  const errors: { code: string; error: string }[] = [];

  // process in chunks of 5 in parallel
  const CHUNK = 5;
  for (let i = 0; i < list.length; i += CHUNK) {
    const slice = list.slice(i, i + CHUNK);
    await Promise.all(slice.map(async (s) => {
      if (!s.image_url) { skipped++; return; }
      try {
        const r = await ocrOne(s.image_url);
        await admin.from("stickers").update({
          player_name: r.player_name,
          player_name_source: "ocr",
          ocr_confidence: r.confidence,
          ocr_processed_at: new Date().toISOString(),
        }).eq("code", s.code);
        ok++;
      } catch (e) {
        failed++;
        errors.push({ code: s.code, error: (e as Error).message });
      }
    }));
    // small delay between chunks
    await new Promise((r) => setTimeout(r, 200));
  }

  return new Response(JSON.stringify({ total: list.length, ok, failed, skipped, errors: errors.slice(0, 10) }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
