const { verifyPassword, createSessionToken } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: 'Usuário e senha são obrigatórios.' });
  }

  const adminUser = process.env.ADMIN_USER;
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH;
  if (!adminUser || !adminPasswordHash) {
    return res.status(500).json({ error: 'Login administrativo não configurado no servidor.' });
  }

  if (username !== adminUser || !verifyPassword(password, adminPasswordHash)) {
    return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
  }

  const token = createSessionToken(username);
  res.setHeader('Set-Cookie', [
    `central_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${30 * 24 * 60 * 60}`,
  ]);
  return res.status(200).json({ ok: true });
};
