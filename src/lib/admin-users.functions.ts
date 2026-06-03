import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const Input = z.object({
  email: z.string().email().max(255),
  password: z.string().min(6).max(128),
  display_name: z.string().min(1).max(120),
});

export const createAppUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data: created, error } = await admin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.display_name },
    });
    if (error) throw new Error(error.message);
    return { id: created.user?.id, email: created.user?.email };
  });

export const listAppUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );
    const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 });
    if (error) throw new Error(error.message);
    return data.users.map((u) => ({
      id: u.id,
      email: u.email,
      display_name: (u.user_metadata?.display_name as string) ?? null,
      created_at: u.created_at,
    }));
  });
