const express = require("express");

const app = express();

app.use(express.json());


// Rota de teste
app.get("/", (req, res) => {
  res.send("Servidor rodando!");
});


// Rota de cadastro
app.post("/register", (req, res) => {

  const { nome, email, senha } = req.body;

  console.log("Nome:", nome);
  console.log("Email:", email);
  console.log("Senha:", senha);

  res.json({
    mensagem: "Usuário recebido com sucesso!"
  });
});
app.listen(3000, () => {
  console.log("Servidor na porta 3000");
});