// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const TEAMS = [
  "África do Sul", "Alemanha", "Arábia Saudita", "Argélia", "Argentina",
  "Austrália", "Áustria", "Bélgica", "Bósnia e Herzegovina", "Brasil",
  "Cabo Verde", "Canadá", "Catar", "Colômbia", "Congo DR", "Coreia do Sul",
  "Costa do Marfim", "Croácia", "Curaçao", "Egito", "Equador", "Escócia",
  "Espanha", "Estados Unidos", "FIFA World Cup 2026", "Fifa World Cup History",
  "França", "Gana", "Haiti", "Inglaterra", "Irã", "Iraque", "Japão",
  "Jordânia", "Marrocos", "México", "Noruega", "Nova Zelândia",
  "Países Baixos", "Panamá", "Paraguai", "Portugal", "República Tcheca",
  "Senegal", "Suécia", "Suíça", "Tunísia", "Turquia", "Uruguai", "Uzbequistão",
];

// Fallbacks for new countries we may not have yet
const FLAG_FALLBACK: Record<string, string> = {
  CUW: "🇨🇼", NED: "🇳🇱",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&aacute;/g, "á").replace(/&eacute;/g, "é").replace(/&iacute;/g, "í")
    .replace(/&oacute;/g, "ó").replace(/&uacute;/g, "ú").replace(/&atilde;/g, "ã")
    .replace(/&otilde;/g, "õ").replace(/&ntilde;/g, "ñ").replace(/&ccedil;/g, "ç");
}

function stripTags(s: string) {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

type Row = {
  seq: number;
  code: string;
  player: string;
  team: string;
  group: string;
  position: string;
  variant: string;
};

function parseTeamPage(html: string): Row[] {
  const rows: Row[] = [];
  const trMatches = html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g);
  for (const tr of trMatches) {
    const cells = [...tr[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((m) => stripTags(m[1]));
    if (cells.length < 7) continue;
    const seq = parseInt(cells[0], 10);
    if (!Number.isFinite(seq)) continue;
    const variant = cells[6];
    if (variant !== "base") continue;
    rows.push({
      seq, code: cells[1], player: cells[2], team: cells[3],
      group: cells[4] === "-" ? "" : cells[4],
      position: cells[5], variant,
    });
  }
  return rows;
}

function deriveCountryCode(code: string): string {
  const m = code.match(/^([A-Z]+)\d+$/);
  return m ? m[1] : code;
}

function deriveKind(row: Row): string {
  if (row.team === "FIFA World Cup 2026") return "special";
  if (row.team === "Fifa World Cup History") return "history";
  if (row.position === "TEAM") {
    // crest = "Escudo X"; team photo = "Foto Oficial X"
    if (/^Foto Oficial/i.test(row.player)) return "team";
    return "crest";
  }
  return "player";
}

async function fetchTeam(team: string): Promise<Row[]> {
  const url = `https://centraldacopa.app/checklist/world-cup-2026?team=${encodeURIComponent(team)}`;
  const res = await fetch(url, { headers: { "user-agent": "Mozilla/5.0 LovableImporter/1.0" } });
  if (!res.ok) throw new Error(`fetch ${team} ${res.status}`);
  const html = await res.text();
  return parseTeamPage(html);
}

async function downloadImage(seq: number): Promise<{ bytes: Uint8Array; type: string } | null> {
  const url = `https://firebasestorage.googleapis.com/v0/b/centralcopa-prod.firebasestorage.app/o/public%2Fstickers%2FWC2026_BR%2F${seq}.jpg?alt=media`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const buf = new Uint8Array(await r.arrayBuffer());
  return { bytes: buf, type: r.headers.get("content-type") ?? "image/jpeg" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Auth: must be admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: authHeader } } });
  const { data: userData } = await userClient.auth.getUser();
  const user = userData?.user;
  if (!user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...cors, "Content-Type": "application/json" } });

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
  if (!roleRow) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...cors, "Content-Type": "application/json" } });

  const body = await req.json().catch(() => ({}));
  const skipImages: boolean = body.skip_images === true;
  const onlyMissingNames: boolean = body.only_missing_names === true;
  const onlyCodes: string[] | null = Array.isArray(body.only_codes) && body.only_codes.length ? body.only_codes : null;

  // Preload existing flag/country data
  const { data: existing } = await admin.from("stickers").select("code,country_code,flag_emoji,country_name,player_name");
  const existingMap = new Map<string, any>();
  const flagByCC = new Map<string, string>();
  const nameByCC = new Map<string, string>();
  for (const s of existing ?? []) {
    existingMap.set(s.code, s);
    if (s.flag_emoji) flagByCC.set(s.country_code, s.flag_emoji);
    if (s.country_name) nameByCC.set(s.country_code, s.country_name);
  }

  // 1) Scrape all teams in parallel (small chunks)
  const allRows: Row[] = [];
  const scrapeErrors: { team: string; error: string }[] = [];
  const TEAM_CHUNK = 6;
  for (let i = 0; i < TEAMS.length; i += TEAM_CHUNK) {
    const slice = TEAMS.slice(i, i + TEAM_CHUNK);
    const results = await Promise.allSettled(slice.map((t) => fetchTeam(t)));
    results.forEach((r, idx) => {
      if (r.status === "fulfilled") allRows.push(...r.value);
      else scrapeErrors.push({ team: slice[idx], error: String(r.reason) });
    });
  }

  // Deduplicate by code (keep first occurrence)
  const byCode = new Map<string, Row>();
  for (const r of allRows) if (!byCode.has(r.code)) byCode.set(r.code, r);

  let inserted = 0, updated = 0, imageOk = 0, imageFailed = 0;
  const errors: { code: string; error: string }[] = [];

  let targets = [...byCode.values()];
  if (onlyCodes) targets = targets.filter((r) => onlyCodes.includes(r.code));
  if (onlyMissingNames) {
    targets = targets.filter((r) => {
      const ex = existingMap.get(r.code);
      return !ex || !ex.player_name;
    });
  }

  // 2) Process each row in chunks
  const ROW_CHUNK = 5;
  for (let i = 0; i < targets.length; i += ROW_CHUNK) {
    const slice = targets.slice(i, i + ROW_CHUNK);
    await Promise.all(slice.map(async (row) => {
      try {
        const cc = deriveCountryCode(row.code);
        const kind = deriveKind(row);
        const flag = flagByCC.get(cc) ?? FLAG_FALLBACK[cc] ?? "";
        const country_name = nameByCC.get(cc) ?? row.team;

        let image_url: string | null = existingMap.get(row.code)?.image_url ?? null;
        if (!skipImages) {
          const img = await downloadImage(row.seq);
          if (img) {
            const path = `${row.code}.jpg`;
            const { error: upErr } = await admin.storage.from("sticker-images").upload(path, img.bytes, {
              upsert: true, contentType: img.type,
            });
            if (upErr) {
              imageFailed++;
              errors.push({ code: row.code, error: `upload: ${upErr.message}` });
            } else {
              const pub = admin.storage.from("sticker-images").getPublicUrl(path).data.publicUrl;
              image_url = `${pub}?t=${Date.now()}`;
              imageOk++;
            }
          } else {
            imageFailed++;
          }
        }

        const payload: any = {
          code: row.code,
          country_code: cc,
          country_name,
          flag_emoji: flag,
          group_letter: row.group || "",
          kind,
          position: row.seq,
          player_name: row.player,
          player_name_source: "checklist",
          image_url,
        };

        const wasExisting = existingMap.has(row.code);
        const { error: upsertErr } = await admin.from("stickers").upsert(payload, { onConflict: "code" });
        if (upsertErr) throw upsertErr;
        if (wasExisting) updated++; else inserted++;
      } catch (e: any) {
        errors.push({ code: row.code, error: String(e?.message ?? e) });
      }
    }));
    await new Promise((r) => setTimeout(r, 150));
  }

  return new Response(JSON.stringify({
    teams_scraped: TEAMS.length - scrapeErrors.length,
    rows_total: byCode.size,
    targets: targets.length,
    inserted, updated, image_ok: imageOk, image_failed: imageFailed,
    scrape_errors: scrapeErrors.slice(0, 10),
    errors: errors.slice(0, 20),
  }, null, 2), { headers: { ...cors, "Content-Type": "application/json" } });
});
