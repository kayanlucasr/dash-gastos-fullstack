const pool = require("../db");

const getDashboard = async (req, res) => {

  try {

    const result = await pool.query(
      `
      SELECT
      COALESCE(
        SUM(CASE WHEN tipo = 'income' THEN valor END),
        0
      ) AS receitas,

      COALESCE(
        SUM(CASE WHEN tipo = 'expense' THEN valor END),
        0
      ) AS despesas

      FROM transactions
      WHERE user_id = $1
      `,
      [req.user.id]
    );

    const receitas = Number(result.rows[0].receitas);
    const despesas = Number(result.rows[0].despesas);

    res.json({
      receitas,
      despesas,
      saldo: receitas - despesas
    });

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Erro ao carregar dashboard"
    });

  }
};

const getExpensesByCategory = async (req, res) => {
  try {

    const result = await pool.query(
      `
      SELECT
        c.nome AS categoria,
        SUM(t.valor) AS total
      FROM transactions t
      JOIN categories c
        ON c.id = t.category_id
      WHERE t.user_id = $1
      AND t.tipo = 'expense'
      GROUP BY c.nome
      ORDER BY total DESC
      `,
      [req.user.id]
    );

    res.json(result.rows);

  } catch (error) {

    console.error(error);

    res.status(500).json({
      message: "Erro ao buscar categorias"
    });

  }
};

module.exports = {
  getDashboard,
  getExpensesByCategory
};