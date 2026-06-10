const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {

  // pegar header authorization
  const authHeader = req.headers.authorization;

  // verificar se existe token
  if (!authHeader) {
    return res.status(401).json({
      error: "Token não fornecido"
    });
  }

  // separar Bearer do token
  const token = authHeader.split(" ")[1];

  try {

    // validar token
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    // salvar dados do usuário na requisição
    req.user = decoded;

    // continuar para a rota
    next();

  } catch (error) {

    return res.status(401).json({
      error: "Token inválido"
    });
  }
}

module.exports = authMiddleware;