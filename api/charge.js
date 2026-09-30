// api/charge.js
// Função serverless da Vercel. Roda no servidor — a chave secreta da NovaPay
// nunca é exposta ao navegador do cliente.
//
// Configure na Vercel (Project Settings > Environment Variables):
//   NOVAPAY_CLIENT_ID     -> valor do header "ci"
//   NOVAPAY_CLIENT_SECRET -> valor do header "cs"
// (Depois de conectar um banco Postgres na Vercel, as variáveis do banco
//  são adicionadas automaticamente — não precisa configurar nada a mais
//  pra isso.)

const { sql } = require('@vercel/postgres');

function generateOrderNumber() {
  const n = Math.floor(1000 + Math.random() * 9000);
  return 'P10-' + Date.now().toString().slice(-6) + n;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { amount, subtotal, deliveryFee, description, items, customer } = req.body || {};

  if (!amount || typeof amount !== 'number' || amount <= 0) {
    return res.status(400).json({ error: 'Campo "amount" é obrigatório e deve ser um número maior que zero (em reais).' });
  }
  if (!description) {
    return res.status(400).json({ error: 'Campo "description" é obrigatório.' });
  }

  const clientId = process.env.NOVAPAY_CLIENT_ID;
  const clientSecret = process.env.NOVAPAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return res.status(500).json({ error: 'Credenciais da NovaPay não configuradas no servidor.' });
  }

  const payload = {
    amount,
    description,
    ...(customer ? { customer } : {}),
  };

  let novapayData;
  try {
    const novapayResponse = await fetch('https://api.anovapay.com.br/charges', {
      method: 'POST',
      headers: {
        ci: clientId,
        cs: clientSecret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    novapayData = await novapayResponse.json();

    if (!novapayResponse.ok) {
      return res.status(novapayResponse.status).json({ error: 'Erro ao criar cobrança na NovaPay', details: novapayData });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Falha ao conectar com a NovaPay', details: String(err) });
  }

  // Salva o pedido no banco (se o banco não estiver configurado ainda, o
  // pedido não é perdido pro cliente — o Pix já foi gerado — mas não vai
  // aparecer no painel até o banco ser conectado).
  const orderNumber = generateOrderNumber();
  try {
    await sql`
      INSERT INTO orders (order_number, customer_name, customer_phone, address, items, subtotal, delivery_fee, total, payment_status, status, pix_id)
      VALUES (
        ${orderNumber},
        ${customer && customer.name ? customer.name : ''},
        ${customer && customer.phone ? customer.phone : ''},
        ${customer && customer.address ? customer.address : ''},
        ${JSON.stringify(items || [])}::jsonb,
        ${typeof subtotal === 'number' ? subtotal : amount},
        ${typeof deliveryFee === 'number' ? deliveryFee : 0},
        ${amount},
        'pendente',
        'novo',
        ${novapayData.transaction ? novapayData.transaction.id : null}
      )
    `;
  } catch (err) {
    // Não falha o pedido do cliente por causa disso — só avisa no log da Vercel.
    console.error('Falha ao salvar pedido no banco:', err);
  }

  return res.status(200).json({
    id: novapayData.transaction ? novapayData.transaction.id : null,
    order_number: orderNumber,
    pix_copy_paste: novapayData.copyPaste || null,
    qr_code_image: novapayData.qrCodeBase64 || novapayData.qrcodeUrl || null,
    status: novapayData.transaction ? novapayData.transaction.status : null,
  });
};
