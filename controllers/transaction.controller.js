const pool = require("../db");

// Criar transação
const createTransaction = async (req, res) => {
  try {
    const { descricao, valor, tipo, category_id } = req.body;

    const user_id = req.user.id;

    const result = await pool.query(
      `
      INSERT INTO transactions
      (descricao, valor, tipo, user_id, category_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
      `,
      [descricao, valor, tipo, user_id, category_id]
    );

    res.status(201).json(result.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Erro ao criar transação"
    });
  }
};

// Listar transações
const getTransactions = async (req, res) => {
  try {

    const { tipo } = req.query;

    let query = `
      SELECT
        t.id,
        t.descricao,
        t.valor,
        t.tipo,
        t.data,
        c.nome AS categoria
      FROM transactions t
      JOIN categories c
        ON c.id = t.category_id
      WHERE t.user_id = $1
    `;

    const params = [req.user.id];

    if (tipo) {
      query += ` AND t.tipo = $2`;
      params.push(tipo);
    }

    query += ` ORDER BY t.data DESC, t.id DESC`;

    const result = await pool.query(query, params);

    res.json(result.rows);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Erro ao listar transações"
    });
  }
};

// Excluir transação
const deleteTransaction = async (req, res) => {
  try {

    const { id } = req.params;

    const result = await pool.query(
      `
      DELETE FROM transactions
      WHERE id = $1
      AND user_id = $2
      RETURNING *
      `,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Transação não encontrada"
      });
    }

    res.json({
      message: "Transação removida com sucesso"
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Erro ao remover transação"
    });
  }
};

// Atualizar transação
const updateTransaction = async (req, res) => {
  try {

    const { id } = req.params;

    const {
      descricao,
      valor,
      tipo,
      category_id
    } = req.body;

    const result = await pool.query(
      `
      UPDATE transactions
      SET
        descricao = $1,
        valor = $2,
        tipo = $3,
        category_id = $4
      WHERE id = $5
      AND user_id = $6
      RETURNING *
      `,
      [
        descricao,
        valor,
        tipo,
        category_id,
        id,
        req.user.id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Transação não encontrada"
      });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error(error);

    res.status(500).json({
      message: "Erro ao atualizar transação"
    });
  }
};

module.exports = {
  createTransaction,
  getTransactions,
  deleteTransaction,
  updateTransaction
};