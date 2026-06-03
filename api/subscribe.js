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
    return res.status(400).json({ error: 'please enter a valid email.' });
  }

  const PUBLICATION_ID = process.env.BEEHIIV_PUBLICATION_ID;
  const API_KEY = process.env.BEEHIIV_API_KEY;

  if (!PUBLICATION_ID || !API_KEY) {
    console.error('[subscribe] missing env vars — check BEEHIIV_PUBLICATION_ID + BEEHIIV_API_KEY in Vercel');
    return res.status(500).json({ error: 'something went wrong. try again.' });
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

    // Success path
    if (response.ok) {
      console.log(`[subscribe] success: ${email.toLowerCase().trim()}`);
      return res.status(200).json({ success: true });
    }

    // Error path — log the raw Beehiiv response for our debugging,
    // but return a clean, brand-voice message to the user.
    let beehiivErrorPayload = null;
    try {
      beehiivErrorPayload = await response.json();
    } catch (_) {
      // Beehiiv didn't return JSON; nothing more to log
    }
    console.error(`[subscribe] beehiiv ${response.status}:`, JSON.stringify(beehiivErrorPayload));

    // Detect "already subscribed" — Beehiiv returns this as a 4xx with a
    // specific error message. Catching the most common variants.
    const rawMessage = beehiivErrorPayload?.errors?.[0]?.message?.toLowerCase() || '';
    const alreadySubscribed =
      response.status === 409 ||
      rawMessage.includes('already') ||
      rawMessage.includes('exists') ||
      rawMessage.includes('duplicate');

    if (alreadySubscribed) {
      return res.status(200).json({ success: true, alreadySubscribed: true });
    }

    // Everything else: clean generic message
    return res.status(response.status >= 500 ? 502 : 400).json({
      error: 'something went wrong. try again.',
    });
  } catch (error) {
    console.error('[subscribe] network/runtime error:', error);
    return res.status(500).json({ error: 'something went wrong. try again.' });
  }
}
