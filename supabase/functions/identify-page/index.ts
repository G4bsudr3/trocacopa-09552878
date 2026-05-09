// deno-lint-ignore-file
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { image, catalog } = await req.json();
    if (!image) return json({ error: "image required" }, 400);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ error: "LOVABLE_API_KEY missing" }, 500);

    const SYSTEM = `Você identifica figurinhas Panini FIFA World Cup 2026 em uma página de álbum (grid 4 colunas x 4 linhas, totalizando 16 figurinhas). Cada figurinha tem um código no canto superior direito.
Formatos: SIGLA+NUMERO (ex: GER1, BRA10, ARG12), 00 ou COV para a capa, FWC1..FWC19, CC1..CC14.
Catálogo oficial:
${catalog}
Responda APENAS um JSON: {"cells":[{"r":0,"c":0,"code":"GER0"}, ... 16 itens]}. Use linha 0=topo, coluna 0=esquerda. Se não souber, "?".`;

    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user", content: [
            { type: "text", text: "Identifique os 16 códigos." },
            { type: "image_url", image_url: { url: image } },
          ]},
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!r.ok) return json({ error: `gateway ${r.status}: ${await r.text()}` }, 500);
    const data = await r.json();
    const content: string = data.choices?.[0]?.message?.content ?? "{}";
    const cleaned = content.replace(/```json|```/g, "").trim();
    let parsed: any = {};
    try { parsed = JSON.parse(cleaned); } catch { parsed = { cells: [] }; }
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
