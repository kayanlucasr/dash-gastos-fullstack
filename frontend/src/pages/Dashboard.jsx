import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import ExpensesChart from "../components/ExpensesChart";
import "../styles/Dashboard.css";

function Dashboard() {
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState(null);
  const [transactions, setTransactions] = useState([]);

  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState("expense");
  const [categoryId, setCategoryId] = useState(1);

  const [editandoId, setEditandoId] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("");

  useEffect(() => {
    carregarDados();
  }, [filtroTipo]);

  async function carregarDados() {
    try {
      const token = localStorage.getItem("token");

      const dashboardResponse = await api.get("/dashboard", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const transactionsResponse = await api.get(
        `/transactions${filtroTipo ? `?tipo=${filtroTipo}` : ""}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      setDashboard(dashboardResponse.data);
      setTransactions(transactionsResponse.data);

    } catch (error) {
      console.error(error);

      if (error.response?.status === 401) {
        localStorage.removeItem("token");
        navigate("/");
      }
    }
  }

  async function criarTransacao(e) {
    e.preventDefault();

    try {
      const token = localStorage.getItem("token");

      if (editandoId) {
        await api.put(
          `/transactions/${editandoId}`,
          {
            descricao,
            valor,
            tipo,
            category_id: categoryId
          },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
      } else {
        await api.post(
          "/transactions",
          {
            descricao,
            valor,
            tipo,
            category_id: categoryId
          },
          {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );
      }

      limparFormulario();
      carregarDados();

    } catch (error) {
      console.error(error);
      alert("Erro ao salvar transação");
    }
  }

  function editarTransacao(transaction) {
    setEditandoId(transaction.id);

    setDescricao(transaction.descricao);
    setValor(transaction.valor);
    setTipo(transaction.tipo);

    const categorias = {
      "Alimentação": 1,
      "Transporte": 2,
      "Moradia": 3,
      "Saúde": 4,
      "Lazer": 5,
      "Educação": 6
    };

    setCategoryId(
      categorias[transaction.categoria] || 1
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  async function excluirTransacao(id) {
    const confirmar = window.confirm(
      "Deseja realmente excluir esta transação?"
    );

    if (!confirmar) return;

    try {
      const token = localStorage.getItem("token");

      await api.delete(`/transactions/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      carregarDados();

    } catch (error) {
      console.error(error);
      alert("Erro ao excluir transação");
    }
  }

  function limparFormulario() {
    setDescricao("");
    setValor("");
    setTipo("expense");
    setCategoryId(1);
    setEditandoId(null);
  }

  function logout() {
    localStorage.removeItem("token");
    navigate("/");
  }

  return (
    <div className="dashboard-container">

      <div className="header">
        <h1>💰 Dashboard de Gastos</h1>

        <button
          className="logout-btn"
          onClick={logout}
        >
          Sair
        </button>
      </div>
      <div className="header">
        <h2>💻 By Kayan Lucas</h2>
      </div>

      {dashboard && (
        <div className="cards">

          <div className="card receitas">
            <h3>💰 Receitas</h3>
            <p>R$ {dashboard.receitas}</p>
          </div>

          <div className="card despesas">
            <h3>💸 Despesas</h3>
            <p>R$ {dashboard.despesas}</p>
          </div>

          <div className="card saldo">
            <h3>📈 Saldo</h3>
            <p>R$ {dashboard.saldo}</p>
          </div>

        </div>
      )}

      <div className="chart-container">
        <ExpensesChart transactions={transactions} />
      </div>

      <div className="form-container">

        <h2>
          {editandoId
            ? "Editar Transação"
            : "Nova Transação"}
        </h2>

        <form onSubmit={criarTransacao}>

          <input
            type="text"
            placeholder="Descrição"
            value={descricao}
            onChange={(e) =>
              setDescricao(e.target.value)
            }
          />

          <input
            type="number"
            placeholder="Valor"
            value={valor}
            onChange={(e) =>
              setValor(e.target.value)
            }
          />

          <select
            value={tipo}
            onChange={(e) =>
              setTipo(e.target.value)
            }
          >
            <option value="expense">
              Despesa
            </option>

            <option value="income">
              Receita
            </option>
          </select>

          <select
            value={categoryId}
            onChange={(e) =>
              setCategoryId(
                Number(e.target.value)
              )
            }
          >
            <option value={1}>Alimentação</option>
            <option value={2}>Transporte</option>
            <option value={3}>Moradia</option>
            <option value={4}>Saúde</option>
            <option value={5}>Lazer</option>
            <option value={6}>Educação</option>
            <option value={7}>Outros</option>
          </select>

          <button type="submit">
            {editandoId
              ? "Atualizar Transação"
              : "Salvar Transação"}
          </button>

          {editandoId && (
            <button
              type="button"
              onClick={limparFormulario}
              style={{ marginLeft: "10px" }}
            >
              Cancelar
            </button>
          )}

        </form>

      </div>

      <h2>Transações</h2>

      <div style={{ marginBottom: "20px" }}>
        <select
          value={filtroTipo}
          onChange={(e) =>
            setFiltroTipo(e.target.value)
          }
        >
          <option value="">
            Todas
          </option>

          <option value="income">
            Receitas
          </option>

          <option value="expense">
            Despesas
          </option>
        </select>
      </div>

      <div className="transactions">

        {transactions.length === 0 ? (

          <p>Nenhuma transação cadastrada.</p>

        ) : (

          transactions.map((transaction) => (

            <div
              key={transaction.id}
              className="transaction-card"
            >

              <h3>
                {transaction.descricao}
              </h3>

              <p>
                <strong>Valor:</strong> R$ {transaction.valor}
              </p>

              <p>
                <strong>Tipo:</strong>{" "}
                {transaction.tipo === "income"
                  ? "Receita"
                  : "Despesa"}
              </p>

              <p>
                <strong>Categoria:</strong>{" "}
                {transaction.categoria}
              </p>

              <p>
                <strong>Data:</strong>{" "}
                {new Date(
                  transaction.data
                ).toLocaleDateString("pt-BR")}
              </p>

              <div className="transaction-actions">

                <button
                  className="edit-btn"
                  onClick={() =>
                    editarTransacao(transaction)
                  }
                >
                  Editar
                </button>

                <button
                  className="delete-btn"
                  onClick={() =>
                    excluirTransacao(transaction.id)
                  }
                >
                  Excluir
                </button>

              </div>

            </div>

          ))

        )}

      </div>

    </div>
  );
}

export default Dashboard;