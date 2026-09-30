// lib/auth.js
// Autenticação simples e própria (sem bibliotecas externas), usando só o
// módulo "crypto" nativo do Node. Guarda a sessão num cookie HttpOnly
// assinado (não é um JWT de verdade, mas usa a mesma ideia: payload + assinatura).

const crypto = require('crypto');

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET não configurado nas variáveis de ambiente.');
  return secret;
}

// ---- senha ----
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64).toString('hex');
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(check, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// ---- sessão (cookie assinado) ----
function sign(value) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('hex');
}

function createSessionToken(username) {
  const payload = JSON.stringify({ u: username, t: Date.now() });
  const b64 = Buffer.from(payload, 'utf8').toString('base64url');
  const sig = sign(b64);
  return `${b64}.${sig}`;
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [b64, sig] = token.split('.');
  const expected = sign(b64);
  const a = Buffer.from(sig || '', 'hex');
  const b = Buffer.from(expected, 'hex');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString('utf8'));
    // sessão expira em 30 dias
    if (Date.now() - payload.t > 30 * 24 * 60 * 60 * 1000) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const out = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx === -1) return;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  });
  return out;
}

function requireAuth(req, res) {
  const cookies = parseCookies(req);
  const session = verifySessionToken(cookies.central_session);
  if (!session) {
    res.status(401).json({ error: 'Não autenticado' });
    return null;
  }
  return session;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createSessionToken,
  verifySessionToken,
  parseCookies,
  requireAuth,
};
