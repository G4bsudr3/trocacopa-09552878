import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/scan-match-alerts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Shared-secret authorization — prevents anonymous abuse of an
        // expensive admin-privileged operation.
        const expected = process.env.WEBHOOK_SECRET;
        const provided = request.headers.get("x-webhook-secret");
        if (!expected || !provided || provided !== expected) {
          return new Response(JSON.stringify({ ok: false, error: "forbidden" }), {
            status: 403,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { data, error } = await supabaseAdmin.rpc("scan_match_alerts");
        if (error) {
          console.error("scan_match_alerts failed", error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, inserted: data ?? 0 }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
