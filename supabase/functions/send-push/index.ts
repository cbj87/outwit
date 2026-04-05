// ============================================================
// send-push Edge Function
// Sends Web Push notifications to all subscribers.
// Uses VAPID authentication with JWK key import.
// Encrypts payload per RFC 8291 (key agreement) + RFC 8188 (aes128gcm).
// iOS requires an encrypted payload — signal-only pushes are silently dropped.
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

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((n, a) => n + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    keyMaterial,
    length * 8,
  );
  return new Uint8Array(bits);
}

// Encrypt push payload per RFC 8291 + RFC 8188 (aes128gcm content encoding).
async function encryptPayload(
  plaintext: string,
  p256dhBase64: string,
  authBase64: string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();

  // Generate server ephemeral ECDH key pair
  const serverKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  );
  const serverPublicKey = new Uint8Array(await crypto.subtle.exportKey('raw', serverKeyPair.publicKey));

  // Import subscriber's p256dh public key
  const subscriberPublicKey = base64UrlToUint8Array(p256dhBase64);
  const subscriberCryptoKey = await crypto.subtle.importKey(
    'raw',
    subscriberPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  );

  // ECDH: derive 32-byte shared secret
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: subscriberCryptoKey },
      serverKeyPair.privateKey,
      256,
    ),
  );

  const authSecret = base64UrlToUint8Array(authBase64);

  // RFC 8291 §3.3: derive IKM
  //   info = "WebPush: info\x00" || subscriber_public || server_public
  //   IKM  = HKDF-SHA-256(salt=authSecret, IKM=sharedSecret, info, L=32)
  const keyInfo = concat(enc.encode('WebPush: info\x00'), subscriberPublicKey, serverPublicKey);
  const ikm = await hkdf(authSecret, sharedSecret, keyInfo, 32);

  // Generate random 16-byte salt for content encryption
  const salt = crypto.getRandomValues(new Uint8Array(16));

  // RFC 8188 §2.1: derive CEK and NONCE from ikm + salt
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\x00'), 16);
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\x00'), 12);

  // Encrypt with AES-128-GCM
  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // Pad with 0x02 record delimiter (RFC 8188 last-record marker)
  const padded = concat(enc.encode(plaintext), new Uint8Array([0x02]));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce, tagLength: 128 }, cekKey, padded),
  );

  // Build ECE header: salt(16) + rs(4 big-endian) + keylen(1) + serverPublicKey(65)
  const header = new Uint8Array(16 + 4 + 1 + serverPublicKey.length);
  header.set(salt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false);
  header[20] = serverPublicKey.length; // 65 for uncompressed P-256
  header.set(serverPublicKey, 21);

  return concat(header, ciphertext);
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
  p256dh: string,
  authKey: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string,
): Promise<Response> {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await buildVapidJwt(audience, vapidSubject, vapidPublicKey, vapidPrivateKey);

  const payloadJson = JSON.stringify({
    title: 'Outwit — Scores Updated!',
    body: 'A new episode has been finalized. Check your standings!',
    url: '/',
  });
  const encryptedBody = await encryptPayload(payloadJson, p256dh, authKey);

  return fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `vapid t=${jwt},k=${vapidPublicKey}`,
      'Content-Type': 'application/octet-stream',
      'Content-Encoding': 'aes128gcm',
      TTL: '86400',
    },
    body: encryptedBody,
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
    .select('endpoint, p256dh, auth_key');

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
        const res = await sendWebPush(
          sub.endpoint,
          sub.p256dh,
          sub.auth_key,
          vapidPublicKey,
          vapidPrivateKey,
          vapidSubject,
        );
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

  const sent = results.filter(
    (r) => r.status === 'fulfilled' && (r.value === 201 || r.value === 200),
  ).length;

  return new Response(
    JSON.stringify({ sent, total: subscriptions.length }),
    { headers: { 'Content-Type': 'application/json' }, status: 200 },
  );
});
