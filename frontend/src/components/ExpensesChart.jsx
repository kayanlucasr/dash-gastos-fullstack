import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from "chart.js";

import { Pie } from "react-chartjs-2";

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

//MAPA DE CORES POR CATEGORIA
const COLORS = {
  Alimentacao: "#e8e421",
  Transporte: "#0d6efd",
  Moradia: "#6f42c1",
  Saude: "#198754",
  Lazer: "#fd7e14",
  Educacao: "#20c997",
  Outros: "#dc3545",
};

function ExpensesChart({ transactions }) {

  const categorias = {};

  transactions.forEach((t) => {
    if (t.tipo === "expense") {
      categorias[t.categoria] =
        (categorias[t.categoria] || 0) + Number(t.valor);
    }
  });

  const labels = Object.keys(categorias);

  const data = {
    labels,
    datasets: [
      {
        data: Object.values(categorias),

        // 🎨 AQUI ENTRA A COR POR CATEGORIA
        backgroundColor: labels.map(
          (label) => COLORS[label] || "#999"
        ),

        borderWidth: 1
      }
    ]
  };

  return <Pie data={data} />;
}

export default ExpensesChart;