import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import { Line } from "react-chartjs-2";
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);
export default function HistoryChart({
  labels,
  values,
  label
}) {
  if (!values.length) return <p>Nenhum histórico disponível neste período.</p>;
  const data = {
    labels,
    datasets: [{
      label,
      data: values,
      borderColor: "#3b82f6",
      backgroundColor: "#8b5cf6",
      tension: 0.2,
      pointRadius: values.length > 60 ? 0 : 3
    }]
  };
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: {
          color: "#a0aec0"
        }
      }
    },
    scales: {
      x: {
        ticks: {
          color: "#a0aec0",
          maxTicksLimit: 8
        }
      },
      y: {
        ticks: {
          color: "#a0aec0"
        }
      }
    }
  };
  return <div className="history-chart">
<Line aria-label={label} data={data} options={options} />
</div>;
}
