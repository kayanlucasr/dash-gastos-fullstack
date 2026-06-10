const express = require("express");
const bcrypt= require("bcrypt");
const app = express();

app.use(express.json());


// Rota de teste
app.get("/", (req, res) => {
    res.send("Servidor rodando!");
});


// Rota de cadastro
app.post("/register", async (req, res) => {

    const { nome, email, senha } = req.body;
    //Se(!) nome ou email ou senha forem nullo : 400(bad request)
    if(!nome||!email||!senha) {
        return res.status(400).json({
            "mensagem":"Preencha todos os campos."
        });
    }

    const senhaCriptografada = await bcrypt.hash(senha, 10);

    console.log("Nome:", nome);
    console.log("Email:", email);
    console.log("Senha original:", senha);
    console.log("Senha protegida:", senhaCriptografada);

    res.json({
        mensagem: "Usuário recebido com sucesso!"
    });
});

app.listen(3000, () => {
    console.log("Servidor na porta 3000");
});