// Vercel serverless function for settheory.fit waitlist signups.
// Receives { email } from the landing page form, validates,
// then creates a Beehiiv subscription via API v2.
//
// Required Vercel environment variables:
//   BEEHIIV_PUBLICATION_ID
//   BEEHIIV_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }

  const { email } = req.body || {};

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'invalid email' });
  }

  const PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;
  const API_KEY = process.env.BEEHIIV_API_KEY;

  if (!PUBLICATION_ID || !API_KEY) {
    return res.status(500).json({ error: 'server not configured' });
  }

  try {
    const response = await fetch(
      `https://api.beehiiv.com/v2/publications/${PUBLICATION_ID}/subscriptions`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          reactivate_existing: false,
          send_welcome_email: true,
          utm_source: 'settheory.fit',
          utm_medium: 'landing_page',
          referring_site: 'settheory.fit',
        }),
      }
    );

    if (!response.ok) {
      let errorMessage = 'subscription failed';
      try {
        const errorData = await response.json();
        errorMessage = errorData?.errors?.[0]?.message || errorMessage;
      } catch (_) {
        // ignore parse errors
      }
      return res.status(response.status).json({ error: errorMessage });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'server error' });
  }
}
