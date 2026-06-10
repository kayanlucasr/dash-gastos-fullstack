const express = require("express");
const cors = require("cors");
const authMiddleware = require("./middlewares/auth.middleware");

const authRoutes = require("./routes/auth.routes");
const transactionRoutes = require("./routes/transaction.routes");
const dashboardRoutes = require("./routes/dashboard.routes");

const app = express();
app.use(express.json());
app.use(cors());

app.use("/transactions", transactionRoutes);
app.use("/dashboard", dashboardRoutes);

// rotas de autenticação
app.use("/auth", authRoutes);

// rota de teste
app.get("/", (req, res) => {
  res.send("Servidor rodando!");
});

app.get("/profile", authMiddleware, (req, res) => {

  res.json({
    message: "Rota protegida acessada!",
    user: req.user
  });

});

app.listen(3000, () => {
  console.log("Servidor na porta 3000 🚀");
});