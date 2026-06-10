import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import "../styles/login.css"; // 🔥 ajuste o caminho se necessário

function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const navigate = useNavigate();

  async function fazerLogin(e) {
    e.preventDefault();

    try {
      const response = await api.post("/auth/login", {
        email,
        senha
      });

      localStorage.setItem("token", response.data.token);

      navigate("/dashboard");
    } catch (error) {
      console.error(error);
      alert("Email ou senha inválidos");
    }
  }

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>Login</h1>

        <form onSubmit={fazerLogin}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="Senha"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
          />

          <button type="submit">
            Entrar
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;