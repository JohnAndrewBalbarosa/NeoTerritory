const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const KEYS_DIR = path.join(__dirname, '..', '..', 'keys');
const PRIV_PATH = process.env.JWT_PRIVATE_KEY_PATH || path.join(KEYS_DIR, 'jwt-private.pem');
const PUB_PATH  = process.env.JWT_PUBLIC_KEY_PATH  || path.join(KEYS_DIR, 'jwt-public.pem');

let cache = null;

function ensureKeypair() {
  if (cache) return cache;

  if (!fs.existsSync(PRIV_PATH) || !fs.existsSync(PUB_PATH)) {
    fs.mkdirSync(path.dirname(PRIV_PATH), { recursive: true });
    fs.mkdirSync(path.dirname(PUB_PATH),  { recursive: true });
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'P-256' });
    fs.writeFileSync(PRIV_PATH, privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
    fs.writeFileSync(PUB_PATH,  publicKey.export({  type: 'spki',  format: 'pem' }));
    console.log(`[jwt] generated new ES256 keypair → ${PRIV_PATH}`);
  }

  const privatePem = fs.readFileSync(PRIV_PATH, 'utf8');
  const publicPem  = fs.readFileSync(PUB_PATH,  'utf8');
  const publicKey  = crypto.createPublicKey(publicPem);
  const jwk        = publicKey.export({ format: 'jwk' });
  const kid        = computeKid(jwk);

  cache = { privatePem, publicPem, jwk: { ...jwk, kid, use: 'sig', alg: 'ES256' }, kid };
  return cache;
}

// RFC 7638 thumbprint — SHA-256 of canonical-form JWK members.
function computeKid(jwk) {
  const canonical = JSON.stringify({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y });
  return crypto.createHash('sha256').update(canonical).digest('base64url');
}

function signToken(payload, options = {}) {
  const { privatePem, kid } = ensureKeypair();
  return jwt.sign(payload, privatePem, {
    algorithm: 'ES256',
    keyid: kid,
    expiresIn: options.expiresIn || '30d',
    subject: payload.id != null ? String(payload.id) : undefined
  });
}

function verifyToken(token) {
  const { publicPem } = ensureKeypair();
  // Try ES256 first.
  try {
    return jwt.verify(token, publicPem, { algorithms: ['ES256'] });
  } catch (esErr) {
    // Legacy HS256 fallback during rollout. Honored only if JWT_SECRET is set.
    if (process.env.JWT_SECRET) {
      try {
        return jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
      } catch {
        throw esErr;
      }
    }
    throw esErr;
  }
}

function getJwks() {
  const { jwk } = ensureKeypair();
  return { keys: [jwk] };
}

module.exports = { ensureKeypair, signToken, verifyToken, getJwks };
