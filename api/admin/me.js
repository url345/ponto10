const { requireAuth } = require('../../lib/auth');

module.exports = async function handler(req, res) {
  const session = requireAuth(req, res);
  if (!session) return;
  return res.status(200).json({ username: session.u });
};
