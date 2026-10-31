/**
 * Daily scheduled maintenance for the Netlify deployment.
 *
 * Calls the authenticated maintenance endpoint, which releases expired inventory
 * reservations, cancels stale unpaid orders, retries Telegram notifications and
 * prunes expired sessions. The endpoint is idempotent, so a daily run is safe.
 *
 * Requires CRON_SECRET in the Netlify environment. Netlify provides URL at
 * runtime (the site's primary URL).
 */
export default async () => {
  const base = process.env.URL || process.env.DEPLOY_PRIME_URL;
  const secret = process.env.CRON_SECRET;

  if (!base || !secret) {
    return new Response("maintenance cron is not configured (URL or CRON_SECRET missing)", {
      status: 500,
    });
  }

  try {
    const response = await fetch(new URL("/api/cron/maintenance", base), {
      headers: { authorization: `Bearer ${secret}` },
    });
    const body = await response.text();
    return new Response(body, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch (error) {
    return new Response(`maintenance call failed: ${String(error)}`, { status: 502 });
  }
};

export const config = { schedule: "@daily" };
