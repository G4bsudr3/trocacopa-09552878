// deno-lint-ignore-file
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM = `Você é um reconhecedor das figurinhas oficiais do álbum Panini FIFA World Cup 26.

Cada figurinha tem um CÓDIGO impresso no canto, no formato:
- "00" = capa do álbum
- 3 letras (sigla do país, FIFA) + número 1-20, ex: BRA10, ARG3, MEX1, USA20, FRA15
- "FWC" + número 1-19 = FIFA World Cup History
- "CC" + número 1-14 = Coca-Cola

Olhe a foto e devolva APENAS um JSON válido (sem markdown, sem texto extra) com este shape exato:
{
  "code": "<código no formato acima ou null se não der pra ler>",
  "country_name": "<nome do país em português, ou null se não for de país>",
  "confidence": <número de 0 a 1>
}

Se a imagem não for uma figurinha do álbum, devolva {"code": null, "country_name": null, "confidence": 0}.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { image } = await req.json();
    if (!image) return json({ error: "image required" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
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

    if (r.status === 429) return json({ error: "rate_limited" }, 429);
    if (r.status === 402) return json({ error: "credits_exhausted" }, 402);
    if (!r.ok) return json({ error: `gateway ${r.status}: ${await r.text()}` }, 500);

    const data = await r.json();
    const content: string = data.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/```json|```/g, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { code: null, country_name: null, confidence: 0 }; }

    return json(parsed);
  } catch (e) {
    return json({ error: String((e as any)?.message ?? e) }, 500);
  }
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
