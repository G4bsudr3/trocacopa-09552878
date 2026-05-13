import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  // Guard: require SEED_SECRET header to prevent unauthorized admin account creation.
  // Set the SEED_SECRET env var in the Supabase dashboard to enable this function.
  // Without the env var set, the function is effectively disabled in production.
  const seedSecret = Deno.env.get("SEED_SECRET");
  if (!seedSecret || req.headers.get("X-Seed-Secret") !== seedSecret) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const users = [
    { email: "juan@trocacopa.com.br", password: "trocacopa123", full_name: "Juan (Admin)", plan: "pro", role: "admin" },
    { email: "pro@trocacopa.com.br", password: "trocacopa123", full_name: "Usuário Pro", plan: "pro", role: "user" },
    { email: "user@trocacopa.com.br", password: "trocacopa123", full_name: "Usuário Comum", plan: "free", role: "user" },
  ];

  const results: any[] = [];

  for (const u of users) {
    let userId: string | null = null;

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { full_name: u.full_name },
    });

    if (createErr) {
      // Already exists? Find by listing.
      const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
      const existing = list?.users.find((x) => x.email === u.email);
      if (existing) {
        userId = existing.id;
        await admin.auth.admin.updateUserById(existing.id, { password: u.password, email_confirm: true });
      } else {
        results.push({ email: u.email, error: createErr.message });
        continue;
      }
    } else {
      userId = created.user!.id;
    }

    if (!userId) continue;

    await admin.from("profiles").upsert({
      id: userId,
      full_name: u.full_name,
      plan: u.plan,
      city: "São Paulo",
      discoverable: true,
    }, { onConflict: "id" });

    if (u.role === "admin") {
      await admin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    }

    results.push({ email: u.email, id: userId, plan: u.plan, role: u.role, ok: true });
  }

  return new Response(JSON.stringify({ results }, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
