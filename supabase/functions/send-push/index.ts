// ============================================================
// send-push Edge Function
// Sends Web Push notifications to all subscribers.
// Uses VAPID authentication with JWK key import (no manual DER encoding).
// Sends a signal-only push (no encrypted payload) — notification content
// is defined in the service worker.
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

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

async function buildVapidJwt(
  audience: string,
  subject: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
): Promise<string> {
  // Extract x, y from uncompressed public key (0x04 || x[32] || y[32])
  const pubBytes = base64UrlToUint8Array(vapidPublicKey);
  const x = uint8ArrayToBase64Url(pubBytes.slice(1, 33));
  const y = uint8ArrayToBase64Url(pubBytes.slice(33, 65));

  const cryptoKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', d: vapidPrivateKey, x, y },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const header = uint8ArrayToBase64Url(
    new TextEncoder().encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })),
  );
  const now = Math.floor(Date.now() / 1000);
  const payload = uint8ArrayToBase64Url(
    new TextEncoder().encode(
      JSON.stringify({ aud: audience, exp: now + 43200, sub: subject }),
    ),
  );

  const sigInput = `${header}.${payload}`;
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(sigInput),
  );

  return `${sigInput}.${uint8ArrayToBase64Url(new Uint8Array(signature))}`;
}

async function sendWebPush(
  endpoint: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<Response> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(audience, vapidSubject, vapidPublicKey, vapidPrivateKey);

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt},k=${vapidPublicKey}`,
      TTL: '86400',
    },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!;
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!;
  const vapidSubject = Deno.env.get('VAPID_SUBJECT')!;

  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('endpoint');

  if (error) {
    console.error('DB error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!subscriptions?.length) {
    return new Response(JSON.stringify({ sent: 0, total: 0 }), { status: 200 });
  }

  const staleEndpoints: string[] = [];

  const results = await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        const res = await sendWebPush(sub.endpoint, vapidPublicKey, vapidPrivateKey, vapidSubject);
        if (res.status === 410 || res.status === 404) {
          staleEndpoints.push(sub.endpoint);
        }
        if (!res.ok && res.status !== 410 && res.status !== 404) {
          const body = await res.text();
          console.error(`Push failed ${res.status}:`, body);
        }
        return res.status;
      } catch (err) {
        console.error('Push error:', err);
        throw err;
      }
    }),
  );

  if (staleEndpoints.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', staleEndpoints);
  }

  const sent = results.filter((r) => r.status === 'fulfilled' && (r.value === 201 || r.value === 200)).length;
  return new Response(
    JSON.stringify({ sent, total: subscriptions.length }),
    { headers: { 'Content-Type': 'application/json' }, status: 200 },
  );
});
