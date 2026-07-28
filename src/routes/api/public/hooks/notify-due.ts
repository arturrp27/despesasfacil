import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

export const Route = createFileRoute("/api/public/hooks/notify-due")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.NOTIFY_DUE_SECRET;
        if (!expected) {
          return new Response(JSON.stringify({ ok: false, error: "Server not configured" }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        const provided =
          request.headers.get("x-notify-secret") ??
          (request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
        if (!provided || !safeEqual(provided, expected)) {
          return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
            status: 401, headers: { "Content-Type": "application/json" },
          });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("generate_due_notifications");
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500, headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, inserted: data }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
