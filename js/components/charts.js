export function mountCharts() {
  if (!window.Chart) return;
  document.querySelectorAll("[data-chart=violations-trend]").forEach((canvas) => {
    new Chart(canvas, {
      type: "line",
      data: {
        labels: ["30 Jul", "31 Jul", "01 Aug", "02 Aug", "03 Aug", "04 Aug", "05 Aug"],
        datasets: [{ label: "Violations", data: [814, 922, 875, 1084, 1012, 1142, 1284], borderColor: "#000000", backgroundColor: "rgba(74,127,224,.2)", borderWidth: 3, pointBackgroundColor: "#F5C518", pointBorderColor: "#000000", pointBorderWidth: 2, pointRadius: 4, fill: true, tension: 0 }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { boxWidth: 12, boxHeight: 12, color: "#000000", font: { family: "Inter", weight: "700" } } } },
        scales: { x: { grid: { color: "rgba(0,0,0,.15)" }, ticks: { color: "#000000" } }, y: { beginAtZero: false, grid: { color: "rgba(0,0,0,.15)" }, ticks: { color: "#000000" } } }
      }
    });
  });
}
