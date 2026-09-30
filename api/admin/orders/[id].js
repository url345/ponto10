const { sql } = require('@vercel/postgres');
const { requireAuth } = require('../../../lib/auth');

const VALID_STATUS = ['novo', 'confirmado', 'preparo', 'pronto', 'entrega', 'entregue', 'cancelado'];

module.exports = async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;

  const { id } = req.query;

  if (req.method === 'GET') {
    const result = await sql`SELECT * FROM orders WHERE id = ${id}`;
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
    return res.status(200).json({ order: result.rows[0] });
  }

  if (req.method === 'PATCH') {
    const { status } = req.body || {};
    if (!VALID_STATUS.includes(status)) {
      return res.status(400).json({ error: 'Status inválido. Use um de: ' + VALID_STATUS.join(', ') });
    }
    const result = await sql`
      UPDATE orders SET status = ${status}, updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;
    if (result.rows.length === 0) return res.status(404).json({ error: 'Pedido não encontrado' });
    return res.status(200).json({ order: result.rows[0] });
  }

  return res.status(405).json({ error: 'Método não permitido' });
};
