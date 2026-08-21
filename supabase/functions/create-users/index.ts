import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Create admin client with service role key (bypasses RLS)
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create a client with the caller's token to verify their identity
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    // Verify the caller is authenticated
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "ไม่ได้เข้าสู่ระบบ" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Verify the caller has admin/super_admin/owner role
    const { data: callerProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("roles, is_active")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError || !callerProfile) {
      return new Response(
        JSON.stringify({ error: "ไม่พบข้อมูลผู้ใช้" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const adminRoles = ["owner", "super_admin", "admin"];
    const hasAdmin = (callerProfile.roles as string[]).some((r) => adminRoles.includes(r));
    if (!hasAdmin || !callerProfile.is_active) {
      return new Response(
        JSON.stringify({ error: "ไม่มีสิทธิ์สร้างบัญชีผู้ใช้" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const body = await req.json();

    // ── Action: deleteByEmails — remove orphaned auth users by email ──
    if (body.action === "deleteByEmails") {
      const emails: string[] = body.emails;
      if (!Array.isArray(emails) || emails.length === 0) {
        return new Response(
          JSON.stringify({ error: "ต้องส่งรายการ emails" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const delResults: Array<{ email: string; success: boolean; error?: string }> = [];
      for (const email of emails) {
        const { error: rpcErr } = await adminClient.rpc("admin_delete_user_by_email", { p_email: email });
        delResults.push({ email, success: !rpcErr, error: rpcErr?.message });
      }
      return new Response(
        JSON.stringify({ results: delResults }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Action: create (default) ──
    const users: Array<{
      email: string;
      password: string;
      display_name: string;
      roles: string[];
      employment_type?: string;
      position?: string;
      phone?: string;
    }> = body.users;

    if (!Array.isArray(users) || users.length === 0) {
      return new Response(
        JSON.stringify({ error: "ต้องส่งรายการ users อย่างน้อย 1 รายการ" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const results: Array<{ email: string; success: boolean; error?: string }> = [];

    for (const u of users) {
      if (!u.email || !u.password || !u.display_name || !Array.isArray(u.roles)) {
        results.push({ email: u.email ?? "?", success: false, error: "ข้อมูลไม่ครบ" });
        continue;
      }

      // Create auth user via RPC — bypasses Supabase Auth leaked-password protection
      // so simple passwords like "123456" are accepted. If user already exists,
      // the RPC updates the password and returns the existing ID.
      const { data: authUserId, error: authError } = await adminClient.rpc("admin_create_user", {
        p_email: u.email,
        p_password: u.password,
        p_display_name: u.display_name,
      });

      if (authError || !authUserId) {
        results.push({ email: u.email, success: false, error: authError?.message ?? "สร้างบัญชีไม่สำเร็จ" });
        continue;
      }

      const validTypes = ["daily", "monthly"];
      const empType = validTypes.includes(u.employment_type ?? "")
        ? u.employment_type!
        : "daily";

      const { error: profileErr } = await adminClient.from("profiles").upsert({
        user_id: authUserId,
        email: u.email,
        display_name: u.display_name,
        roles: u.roles,
        employment_type: empType,
        is_active: true,
        profile_completed: false,
        position: u.position ?? null,
        phone: u.phone ?? null,
      }, { onConflict: "user_id" });

      if (profileErr) {
        results.push({ email: u.email, success: false, error: profileErr.message });
        continue;
      }

      results.push({ email: u.email, success: true });
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({ results, summary: { total: results.length, succeeded, failed } }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message ?? "เกิดข้อผิดพลาด" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
