// ============================================================
// send-push Edge Function
// Sends Web Push notifications to all subscribers.
// Called fire-and-forget from calculate-scores after an episode is finalized.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── VAPID helpers ────────────────────────────────────────────────────────────

function base64UrlToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function uint8ArrayToBase64Url(arr: Uint8Array): string {
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function buildVapidJwt(audience: string, subject: string, privateKeyB64: string): Promise<string> {
  const header = uint8ArrayToBase64Url(new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const now = Math.floor(Date.now() / 1000);
  const payload = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject }))
  );
  const sigInput = `${header}.${payload}`;

  const keyData = base64UrlToUint8Array(privateKeyB64);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    // Wrap raw 32-byte EC private key in PKCS#8 DER envelope for P-256
    buildPkcs8Der(keyData),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(sigInput),
  );

  return `${sigInput}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`;
}

// Wrap a raw 32-byte P-256 private key scalar in a PKCS#8 DER structure
function buildPkcs8Der(rawKey: Uint8Array): ArrayBuffer {
  // ECPrivateKey structure for P-256 (OID 1.2.840.10045.3.1.7)
  const ecPrivateKey = new Uint8Array([
    0x30, 0x77,                         // SEQUENCE
    0x02, 0x01, 0x01,                   // INTEGER version=1
    0x04, 0x20, ...rawKey,              // OCTET STRING (32 bytes)
    0xa0, 0x0a,                         // [0] EXPLICIT
    0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, // OID P-256
    0xa1, 0x44,                         // [1] EXPLICIT
    0x03, 0x42, 0x00,                   // BIT STRING
    // Public key placeholder — not needed for signing, fill with zeros
    ...new Uint8Array(65),
  ]);
  // Wrap in PKCS#8 PrivateKeyInfo
  const oid = new Uint8Array([0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07]);
  const inner = new Uint8Array([0x04, ecPrivateKey.length, ...ecPrivateKey]);
  const outer = new Uint8Array([0x30, oid.length + inner.length, ...oid, ...inner]);
  return outer.buffer;
}

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<Response> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(audience, vapidSubject, vapidPrivateKey);

  return fetch(subscription.endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `vapid t=${jwt},k=${vapidPublicKey}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      'TTL': '86400',
    },
    body: new TextEncoder().encode(payload),
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  // Only callable with service role key
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')!;

  const body = await req.json().catch(() => ({}));
  const episodeNumber: number | undefined = body.episode_number;

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key');

  if (error || !subscriptions?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
  }

  const payload = JSON.stringify({
    title: 'Outwit Open',
    body: episodeNumber
      ? `Episode ${episodeNumber} scores are in — check the leaderboard!`
      : 'Scores have been updated!',
    url: '/',
  });

  const staleEndpoints: string[] = [];

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const res = await sendWebPush(sub, payload, vapidPublicKey, vapidPrivateKey, vapidSubject);
      if (res.status === 410 || res.status === 404) {
        staleEndpoints.push(sub.endpoint);
      }
      return res.status;
    })
  );

  // Clean up expired subscriptions
  if (staleEndpoints.length > 0) {
    await supabase
      .from('push_subscriptions')
      .delete()
      .in('endpoint', staleEndpoints);
  }

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return new Response(JSON.stringify({ sent, total: subscriptions.length }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  });
});
