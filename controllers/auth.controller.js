const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

// CADASTRO
async function register(req, res) {
  try {
    const { nome, email, senha } = req.body;

    const senhaHash = await bcrypt.hash(senha, 10);

    await db.query(
      "INSERT INTO users (nome, email, senha) VALUES ($1, $2, $3)",
      [nome, email, senhaHash]
    );

    return res.status(201).json({
      message: "Usuário cadastrado com sucesso"
    });

  } catch (error) {

    console.error(error);

    // erro de email duplicado no Postgres
    if (error.code === "23505") {
      return res.status(400).json({
        error: "Email já cadastrado"
      });
    }

    return res.status(500).json({
      error: "Erro interno do servidor"
    });
  }
}


// LOGIN
async function login(req, res) {
  try {

    const { email, senha } = req.body;

    // procurar usuário no banco
    const result = await db.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    // usuário não existe
    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Usuário não encontrado"
      });
    }

    const user = result.rows[0];

    // comparar senha
    const senhaValida = await bcrypt.compare(
      senha,
      user.senha
    );

    if (!senhaValida) {
      return res.status(401).json({
        error: "Senha inválida"
      });
    }

    // gerar token JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h"
      }
    );

    return res.status(200).json({
      message: "Login realizado com sucesso",
      token,
      user: {
        id: user.id,
        nome: user.nome,
        email: user.email
      }
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: "Erro no login"
    });
  }
}


// exportar funções
module.exports = {
  register,
  login
};