import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * GET /api/newsletter/unsubscribe?token=...
 * Token-based (no auth). Marks unsubscribed_at = now() and shows a
 * small HTML confirmation page.
 */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (!token) return page("Missing token.", false);

  const admin = createSupabaseAdminClient();
  const { data: sub, error } = await admin
    .from("newsletter_subscribers")
    .select("id, email, unsubscribed_at")
    .eq("unsubscribe_token", token)
    .maybeSingle();

  if (error || !sub) return page("Unknown token.", false);

  if (!sub.unsubscribed_at) {
    await admin
      .from("newsletter_subscribers")
      .update({ unsubscribed_at: new Date().toISOString() })
      .eq("id", sub.id);
  }

  return page(
    `You (${sub.email}) have been unsubscribed. Sorry to see you go!`,
    true,
  );
}

function page(message: string, success: boolean) {
  const html = `<!doctype html>
<html><head><meta charset="utf-8" /><title>Unsubscribed</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;background:#faf7ff;margin:0;padding:60px 20px;color:#111;}
  .card{max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;box-shadow:0 10px 40px rgba(0,0,0,.06);text-align:center;}
  h1{margin:0 0 10px;font-size:20px;color:${success ? "#16a34a" : "#dc2626"};}
  p{color:#555;line-height:1.55;}
  a{color:#7c3aed;text-decoration:none;}
</style></head><body>
<div class="card">
  <h1>${success ? "Unsubscribed" : "Unsubscribe failed"}</h1>
  <p>${message}</p>
  <p><a href="/">← Back to the store</a></p>
</div></body></html>`;
  return new Response(html, {
    status: success ? 200 : 400,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}
