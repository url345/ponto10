const { sql } = require('@vercel/postgres');
const { requireAuth } = require('../../../lib/auth');

module.exports = async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;

  if (req.method !== 'GET') return res.status(405).json({ error: 'Método não permitido' });

  const status = req.query.status;
  let result;
  if (status && status !== 'todos') {
    result = await sql`SELECT * FROM orders WHERE status = ${status} ORDER BY created_at DESC LIMIT 300`;
  } else {
    result = await sql`SELECT * FROM orders ORDER BY created_at DESC LIMIT 300`;
  }
  return res.status(200).json({ orders: result.rows });
};
