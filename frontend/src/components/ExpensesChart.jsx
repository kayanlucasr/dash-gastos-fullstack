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
  Alimentação: "#e8e421",
  Transporte: "#0d6efd",
  Moradia: "#6f42c1",
  Saúde: "#198754",
  Lazer: "#fd7e14",
  Educação: "#20c997",
  Outros: "#dc3545",
};

function ExpensesChart({ categories }) {
  const labels = categories.map((category) => category.categoria || "Sem categoria");

  const data = {
    labels,
    datasets: [
      {
        data: categories.map((category) => Number(category.total)),

        // 🎨 AQUI ENTRA A COR POR CATEGORIA
        backgroundColor: labels.map(
          (label) => COLORS[label] || "#999"
        ),

        borderWidth: 1
      }
    ]
  };

  if (!categories.length) return <p>Nenhuma despesa cadastrada.</p>;
  return <Pie data={data} options={{ maintainAspectRatio: false }} aria-label="Despesas por categoria" />;
}

export default ExpensesChart;
