// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BUCKET = "sticker-images";

// Approximate primary/secondary colors per country (FIFA 3-letter codes)
const COUNTRY_COLORS: Record<string, [string, string]> = {
  BRA: ["#009c3b", "#ffdf00"], ARG: ["#74acdf", "#ffffff"], MEX: ["#006847", "#ce1126"],
  USA: ["#3c3b6e", "#b22234"], CAN: ["#d52b1e", "#ffffff"], FRA: ["#0055a4", "#ef4135"],
  GER: ["#000000", "#dd0000"], ESP: ["#aa151b", "#f1bf00"], POR: ["#006600", "#ff0000"],
  ENG: ["#ce1124", "#ffffff"], NED: ["#ae1c28", "#ff7700"], BEL: ["#000000", "#fae042"],
  ITA: ["#008c45", "#cd212a"], SUI: ["#d52b1e", "#ffffff"], CRO: ["#171796", "#ff0000"],
  KOR: ["#003478", "#cd2e3a"], JPN: ["#bc002d", "#ffffff"], AUS: ["#012169", "#e4002b"],
  KSA: ["#006c35", "#ffffff"], QAT: ["#8a1538", "#ffffff"], IRN: ["#239f40", "#da0000"],
  IRQ: ["#007a3d", "#ce1126"], MAR: ["#c1272d", "#006233"], EGY: ["#ce1126", "#000000"],
  SEN: ["#00853f", "#fdef42"], TUN: ["#e70013", "#ffffff"], CIV: ["#f77f00", "#009e60"],
  GHA: ["#ce1126", "#fcd116"], ALG: ["#006633", "#ffffff"], CGO: ["#009543", "#fbde4a"],
  RSA: ["#007a4d", "#ffb612"], CPV: ["#003893", "#cf2027"], URU: ["#0038a8", "#fcd116"],
  COL: ["#fcd116", "#003893"], ECU: ["#ffd100", "#034ea2"], PAR: ["#d52b1e", "#0038a8"],
  HAI: ["#00209f", "#d21034"], CRC: ["#002b7f", "#ce1126"], PAN: ["#005293", "#d21034"],
  CUW: ["#002b7f", "#fbe122"], JOR: ["#000000", "#ce1126"], UZB: ["#1eb53a", "#0099b5"],
  NOR: ["#ef2b2d", "#002868"], SCO: ["#0065bd", "#ffffff"], SWE: ["#005b99", "#fecc00"],
  AUT: ["#ed2939", "#ffffff"], CZE: ["#11457e", "#d7141a"], TUR: ["#e30a17", "#ffffff"],
  NZL: ["#012169", "#cf142b"], BIH: ["#002395", "#fecb00"],
};

function svgFor(opts: {
  code: string; country: string; flag: string; jersey: number; primary: string; secondary: string;
}): string {
  const { code, country, flag, jersey, primary, secondary } = opts;
  const safeCountry = country.replace(/[<>&]/g, "");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800" width="600" height="800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${primary}"/>
      <stop offset="1" stop-color="${secondary}"/>
    </linearGradient>
    <radialGradient id="spot" cx="50%" cy="35%" r="60%">
      <stop offset="0" stop-color="rgba(255,255,255,0.25)"/>
      <stop offset="1" stop-color="rgba(0,0,0,0)"/>
    </radialGradient>
  </defs>
  <rect width="600" height="800" rx="32" fill="url(#bg)"/>
  <rect width="600" height="800" rx="32" fill="url(#spot)"/>

  <!-- top band -->
  <rect x="24" y="24" width="552" height="56" rx="16" fill="rgba(0,0,0,0.35)"/>
  <text x="48" y="62" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="28" fill="white" letter-spacing="2">${safeCountry.toUpperCase()}</text>
  <text x="552" y="64" font-size="40" text-anchor="end">${flag}</text>

  <!-- player silhouette -->
  <g transform="translate(300 480)" fill="rgba(0,0,0,0.55)">
    <circle cx="0" cy="-150" r="78"/>
    <path d="M -150 80 C -150 -30, -90 -60, 0 -60 C 90 -60, 150 -30, 150 80 L 150 200 L -150 200 Z"/>
  </g>

  <!-- jersey number -->
  <text x="300" y="430" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="220" fill="rgba(255,255,255,0.92)" stroke="rgba(0,0,0,0.4)" stroke-width="4">${jersey}</text>

  <!-- bottom band with code -->
  <rect x="24" y="700" width="552" height="76" rx="20" fill="rgba(0,0,0,0.55)"/>
  <text x="300" y="752" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="44" fill="white" letter-spacing="6">${code}</text>
</svg>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // admin only
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return json({ error: "forbidden" }, 403);

  const body = await req.json().catch(() => ({}));
  const overwrite: boolean = body.overwrite === true;
  const limit: number = Math.min(Number(body.limit ?? 500), 2000);

  let q = admin.from("stickers").select("code,country_code,country_name,flag_emoji,position,kind").eq("kind", "player");
  if (!overwrite) q = q.is("image_url", null);
  q = q.limit(limit);

  const { data: list, error } = await q;
  if (error) return json({ error: error.message }, 500);

  let ok = 0, failed = 0;
  const errors: Array<{ code: string; error: string }> = [];

  for (const s of list ?? []) {
    try {
      const cc = (s.country_code || "").toUpperCase();
      const colors = COUNTRY_COLORS[cc] ?? ["#1f2937", "#0f172a"];
      // jersey = numeric tail of code (e.g. ALG10 → 10)
      const jerseyMatch = (s.code || "").match(/(\d+)$/);
      const jersey = jerseyMatch ? Number(jerseyMatch[1]) : 0;
      const svg = svgFor({
        code: s.code, country: s.country_name, flag: s.flag_emoji || "",
        jersey, primary: colors[0], secondary: colors[1],
      });
      const path = `players/${s.code}.svg`;
      const up = await admin.storage.from(BUCKET).upload(path, new Blob([svg], { type: "image/svg+xml" }), {
        contentType: "image/svg+xml", upsert: true,
      });
      if (up.error) throw up.error;
      const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(path);
      const { error: upErr } = await admin.from("stickers").update({ image_url: pub.publicUrl }).eq("code", s.code);
      if (upErr) throw upErr;
      ok++;
    } catch (e: any) {
      failed++;
      errors.push({ code: s.code, error: String(e?.message ?? e) });
    }
  }

  return json({ total: list?.length ?? 0, ok, failed, errors: errors.slice(0, 10) });
});

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj, null, 2), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
