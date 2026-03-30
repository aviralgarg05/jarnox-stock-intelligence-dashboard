const state = {
  companies: [],
  selectedSymbol: null,
  currentRange: 90,
  priceChart: null,
  insightChart: null,
  compareChart: null,
};

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed for ${url}`);
  }
  return response.json();
}

function safeDateLabel(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
  });
}

function renderCompanyList(companies) {
  const container = document.getElementById("company-list");
  container.innerHTML = "";

  companies.forEach((company) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "company-button";
    button.dataset.symbol = company.symbol;
    button.innerHTML = `
      <strong>${company.name}</strong>
      <div class="company-meta">
        <span>${company.symbol}</span>
        <span>${company.sector}</span>
      </div>
    `;
    button.addEventListener("click", () => selectCompany(company.symbol));
    if (company.symbol === state.selectedSymbol) {
      button.classList.add("active");
    }
    container.appendChild(button);
  });

  const select = document.getElementById("compare-company");
  select.innerHTML = companies
    .map((company) => `<option value="${company.symbol}">${company.name} (${company.symbol})</option>`)
    .join("");

  if (companies.length > 1) {
    const fallback = companies.find((company) => company.symbol !== state.selectedSymbol) || companies[1];
    select.value = fallback.symbol;
  }
}

async function loadCompanies() {
  const payload = await fetchJson("/companies");
  state.companies = payload.companies;
  state.selectedSymbol = payload.companies[0]?.symbol || null;
  renderCompanyList(payload.companies);
  document.getElementById("refresh-time").textContent = payload.last_refresh
    ? new Date(payload.last_refresh).toLocaleString("en-IN")
    : "Not available";
}

function updateSummary(summaryPayload, company) {
  const summary = summaryPayload.summary;
  document.getElementById("selected-title").textContent = `${company.name} (${company.symbol})`;
  document.getElementById("selected-subtitle").textContent = `${company.sector} sector | Last trading day ${summary.last_trading_date}`;
  document.getElementById("metric-close").textContent = currencyFormatter.format(summary.latest_close);
  document.getElementById("metric-ma").textContent = currencyFormatter.format(summary.moving_average_7);
  document.getElementById("metric-range").textContent = `${currencyFormatter.format(summary.low_52_week)} - ${currencyFormatter.format(summary.high_52_week)}`;
  document.getElementById("metric-volatility").textContent = `${percentFormatter.format(summary.volatility_score)} pts`;
}

function createOrUpdateChart(slot, configFactory) {
  const chart = state[slot];
  if (chart) {
    chart.destroy();
  }
  state[slot] = new Chart(document.getElementById(configFactory.elementId), configFactory.config);
}

function renderPriceChart(history, symbol) {
  const labels = history.map((row) => safeDateLabel(row.date));
  createOrUpdateChart("priceChart", {
    elementId: "price-chart",
    config: {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: `${symbol} close`,
            data: history.map((row) => row.close),
            borderColor: "#5dd6b5",
            backgroundColor: "rgba(93, 214, 181, 0.14)",
            fill: true,
            tension: 0.28,
          },
          {
            label: "7D moving average",
            data: history.map((row) => row.moving_average_7),
            borderColor: "#ffbf5e",
            borderDash: [6, 6],
            fill: false,
            tension: 0.22,
          },
        ],
      },
      options: chartOptions("Price (INR)"),
    },
  });
}

function renderInsightChart(history) {
  const labels = history.map((row) => safeDateLabel(row.date));
  createOrUpdateChart("insightChart", {
    elementId: "insight-chart",
    config: {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Volatility score",
            data: history.map((row) => row.volatility_score),
            backgroundColor: "rgba(255, 191, 94, 0.65)",
            borderRadius: 8,
          },
          {
            label: "Momentum score",
            data: history.map((row) => row.momentum_score),
            type: "line",
            borderColor: "#ff7e67",
            backgroundColor: "#ff7e67",
            fill: false,
            tension: 0.28,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: "index",
          intersect: false,
        },
        plugins: {
          legend: {
            labels: { color: "#ecf7f7" },
          },
        },
        scales: {
          x: {
            ticks: { color: "#9ab6bf" },
            grid: { color: "rgba(138, 187, 201, 0.08)" },
          },
          y: {
            title: { display: true, text: "Volatility", color: "#9ab6bf" },
            ticks: { color: "#9ab6bf" },
            grid: { color: "rgba(138, 187, 201, 0.08)" },
          },
          y1: {
            position: "right",
            title: { display: true, text: "Momentum", color: "#9ab6bf" },
            ticks: { color: "#9ab6bf" },
            grid: { drawOnChartArea: false },
          },
        },
      },
    },
  });
}

function renderCompareChart(comparePayload) {
  const seriesEntries = Object.entries(comparePayload.series);
  const labels = seriesEntries[0]?.[1].map((row) => safeDateLabel(row.date)) || [];
  const palette = ["#5dd6b5", "#ffbf5e"];

  createOrUpdateChart("compareChart", {
    elementId: "compare-chart",
    config: {
      type: "line",
      data: {
        labels,
        datasets: seriesEntries.map(([symbol, values], index) => ({
          label: `${symbol} normalized return`,
          data: values.map((row) => row.normalized_change_pct),
          borderColor: palette[index],
          backgroundColor: `${palette[index]}22`,
          fill: false,
          tension: 0.26,
        })),
      },
      options: chartOptions("Normalized return (%)"),
    },
  });

  const correlation =
    comparePayload.correlation_close_price === null
      ? "not enough aligned data"
      : comparePayload.correlation_close_price;
  document.getElementById(
    "comparison-summary",
  ).textContent = `${comparePayload.outperformer} leads over ${comparePayload.comparison_window_days} sessions. Correlation: ${correlation}. Gap: ${percentFormatter.format(Math.abs(comparePayload.performance_gap_pct))}%`;
}

function chartOptions(yTitle) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        labels: { color: "#ecf7f7" },
      },
    },
    scales: {
      x: {
        ticks: { color: "#9ab6bf", maxRotation: 0 },
        grid: { color: "rgba(138, 187, 201, 0.08)" },
      },
      y: {
        title: { display: true, text: yTitle, color: "#9ab6bf" },
        ticks: { color: "#9ab6bf" },
        grid: { color: "rgba(138, 187, 201, 0.08)" },
      },
    },
  };
}

function renderMiniTable(containerId, items) {
  const container = document.getElementById(containerId);
  container.innerHTML = items
    .map((item) => {
      const directionClass = item.day_change_pct >= 0 ? "up" : "down";
      const sign = item.day_change_pct >= 0 ? "+" : "";
      return `
        <div class="mini-row">
          <div>
            <strong>${item.name}</strong>
            <span>${item.symbol} | ${item.sector}</span>
          </div>
          <div class="${directionClass}">
            <strong>${sign}${percentFormatter.format(item.day_change_pct)}%</strong>
            <span>${currencyFormatter.format(item.latest_close)}</span>
          </div>
        </div>
      `;
    })
    .join("");
}

async function loadMarketInsights() {
  const payload = await fetchJson("/market-insights");
  renderMiniTable("leaders", payload.leaders);
  renderMiniTable("laggards", payload.laggards);
}

async function selectCompany(symbol) {
  state.selectedSymbol = symbol;
  renderCompanyList(state.companies);

  const [historyPayload, summaryPayload] = await Promise.all([
    fetchJson(`/data/${symbol}?days=${state.currentRange}`),
    fetchJson(`/summary/${symbol}`),
  ]);

  updateSummary(summaryPayload, summaryPayload.company);
  renderPriceChart(historyPayload.history, symbol);
  renderInsightChart(historyPayload.history);
  await loadComparison();
}

async function loadComparison() {
  if (!state.selectedSymbol) {
    return;
  }

  const compareSymbol = document.getElementById("compare-company").value;
  if (!compareSymbol || compareSymbol === state.selectedSymbol) {
    document.getElementById("comparison-summary").textContent =
      "Choose a different company to compare.";
    return;
  }

  const payload = await fetchJson(
    `/compare?symbol1=${state.selectedSymbol}&symbol2=${compareSymbol}&days=${state.currentRange}`,
  );
  renderCompareChart(payload);
}

function attachEvents() {
  document.getElementById("compare-button").addEventListener("click", loadComparison);
  document.getElementById("compare-company").addEventListener("change", loadComparison);
  document.getElementById("range-select").addEventListener("change", async (event) => {
    state.currentRange = Number(event.target.value);
    await selectCompany(state.selectedSymbol);
  });
}

async function boot() {
  try {
    await loadCompanies();
    attachEvents();
    await Promise.all([loadMarketInsights(), selectCompany(state.selectedSymbol)]);
  } catch (error) {
    document.getElementById("selected-title").textContent = "Unable to load dashboard";
    document.getElementById("selected-subtitle").textContent = error.message;
  }
}

boot();

