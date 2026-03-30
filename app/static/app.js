const { useEffect, useMemo, useRef, useState } = React;
const html = htm.bind(React.createElement);

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-IN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-IN", {
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

function formatRefresh(value) {
  return value ? new Date(value).toLocaleString("en-IN") : "Not available";
}

function buildChartOptions(yTitle, secondaryAxis) {
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: {
      duration: 320,
      easing: "easeOutQuart",
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
    plugins: {
      legend: {
        labels: {
          color: "#dce7f5",
          boxWidth: 12,
          usePointStyle: true,
          pointStyle: "circle",
        },
      },
      tooltip: {
        backgroundColor: "rgba(10, 16, 30, 0.92)",
        titleColor: "#f5fbff",
        bodyColor: "#bfd0e6",
        borderColor: "rgba(126, 165, 255, 0.18)",
        borderWidth: 1,
        padding: 12,
      },
    },
    scales: {
      x: {
        ticks: {
          color: "#8da0bf",
          maxRotation: 0,
        },
        grid: {
          color: "rgba(110, 136, 179, 0.12)",
        },
      },
      y: {
        title: {
          display: true,
          text: yTitle,
          color: "#8da0bf",
        },
        ticks: {
          color: "#8da0bf",
        },
        grid: {
          color: "rgba(110, 136, 179, 0.12)",
        },
      },
    },
  };

  if (secondaryAxis) {
    options.scales.y1 = {
      position: "right",
      title: {
        display: true,
        text: secondaryAxis,
        color: "#8da0bf",
      },
      ticks: {
        color: "#8da0bf",
      },
      grid: {
        drawOnChartArea: false,
      },
    };
  }

  return options;
}

function useChart(configFactory, dependencies) {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return undefined;
    }

    const config = configFactory();
    if (!config) {
      return undefined;
    }

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new Chart(canvasRef.current, config);
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, dependencies);

  return canvasRef;
}

function PriceChart({ symbol, history }) {
  const canvasRef = useChart(
    () => {
      if (!history.length) {
        return null;
      }

      return {
        type: "line",
        data: {
          labels: history.map((row) => safeDateLabel(row.date)),
          datasets: [
            {
              label: `${symbol} close`,
              data: history.map((row) => row.close),
              borderColor: "#7c96ff",
              backgroundColor: "rgba(124, 150, 255, 0.16)",
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 4,
            },
            {
              label: "7D moving average",
              data: history.map((row) => row.moving_average_7),
              borderColor: "#44e1c1",
              borderDash: [6, 6],
              fill: false,
              tension: 0.24,
              pointRadius: 0,
              pointHoverRadius: 3,
            },
          ],
        },
        options: buildChartOptions("Price (INR)"),
      };
    },
    [symbol, history],
  );

  return html`<canvas ref=${canvasRef}></canvas>`;
}

function InsightChart({ history }) {
  const canvasRef = useChart(
    () => {
      if (!history.length) {
        return null;
      }

      return {
        data: {
          labels: history.map((row) => safeDateLabel(row.date)),
          datasets: [
            {
              type: "bar",
              label: "Volatility score",
              data: history.map((row) => row.volatility_score),
              backgroundColor: "rgba(97, 242, 176, 0.56)",
              borderRadius: 10,
              maxBarThickness: 20,
            },
            {
              type: "line",
              label: "Momentum score",
              data: history.map((row) => row.momentum_score),
              borderColor: "#ff8d6b",
              backgroundColor: "#ff8d6b",
              fill: false,
              tension: 0.28,
              pointRadius: 0,
              pointHoverRadius: 4,
              yAxisID: "y1",
            },
          ],
        },
        options: buildChartOptions("Volatility", "Momentum"),
      };
    },
    [history],
  );

  return html`<canvas ref=${canvasRef}></canvas>`;
}

function CompareChart({ comparison }) {
  const canvasRef = useChart(
    () => {
      if (!comparison) {
        return null;
      }

      const seriesEntries = Object.entries(comparison.series);
      const labels = seriesEntries[0]?.[1].map((row) => safeDateLabel(row.date)) || [];
      const palette = ["#7c96ff", "#f9b24f"];

      return {
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
            pointRadius: 0,
            pointHoverRadius: 4,
          })),
        },
        options: buildChartOptions("Normalized return (%)"),
      };
    },
    [comparison],
  );

  return html`<canvas ref=${canvasRef}></canvas>`;
}

function ShellMetric({ label, value, tone, helper, delay }) {
  return html`
    <article className=${`metric-card tone-${tone || "default"}`} style=${{ animationDelay: `${delay}ms` }}>
      <span className="metric-glow"></span>
      <p className="metric-label">${label}</p>
      <p className="metric-value">${value}</p>
      <p className="metric-helper">${helper}</p>
    </article>
  `;
}

function CompanyButton({ company, active, onSelect }) {
  const trendClass = company.latest_daily_return >= 0 ? "trend-up" : "trend-down";
  const sign = company.latest_daily_return >= 0 ? "+" : "";
  return html`
    <button
      type="button"
      className=${`company-button ${active ? "active" : ""}`}
      onClick=${() => onSelect(company.symbol)}
    >
      <div className="company-button__top">
        <div>
          <strong>${company.name}</strong>
          <span>${company.symbol}</span>
        </div>
        <div className=${`company-chip ${trendClass}`}>
          ${sign}${percentFormatter.format((company.latest_daily_return || 0) * 100)}%
        </div>
      </div>
      <div className="company-button__bottom">
        <span>${company.sector}</span>
        <span>Vol ${numberFormatter.format(company.volatility_score || 0)}</span>
      </div>
    </button>
  `;
}

function MoversList({ items }) {
  return html`
    <div className="mini-table">
      ${items.map((item, index) => {
        const isUp = item.day_change_pct >= 0;
        const sign = isUp ? "+" : "";
        return html`
          <div className="mini-row" key=${item.symbol} style=${{ animationDelay: `${index * 55}ms` }}>
            <div>
              <strong>${item.name}</strong>
              <span>${item.symbol} | ${item.sector}</span>
            </div>
            <div className=${isUp ? "up" : "down"}>
              <strong>${sign}${percentFormatter.format(item.day_change_pct)}%</strong>
              <span>${currencyFormatter.format(item.latest_close)}</span>
            </div>
          </div>
        `;
      })}
    </div>
  `;
}

function LoadingScreen() {
  return html`
    <div className="app-shell">
      <div className="background-grid"></div>
      <div className="ambient ambient-a"></div>
      <div className="ambient ambient-b"></div>
      <main className="loading-shell">
        <div className="loading-panel">
          <div className="loading-badge">Initializing market terminal</div>
          <h1>Building your dark mode dashboard</h1>
          <p>Fetching company snapshots, technical indicators, and comparison series.</p>
          <div className="loading-bar">
            <span></span>
          </div>
        </div>
      </main>
    </div>
  `;
}

function ErrorScreen({ message, onRetry }) {
  return html`
    <div className="app-shell">
      <div className="background-grid"></div>
      <main className="loading-shell">
        <div className="loading-panel error-panel">
          <div className="loading-badge error-badge">Data unavailable</div>
          <h1>Dashboard could not load</h1>
          <p>${message}</p>
          <button className="primary-button" type="button" onClick=${onRetry}>Retry fetch</button>
        </div>
      </main>
    </div>
  `;
}

function App() {
  const [companies, setCompanies] = useState([]);
  const [selectedSymbol, setSelectedSymbol] = useState("");
  const [compareSymbol, setCompareSymbol] = useState("");
  const [currentRange, setCurrentRange] = useState(90);
  const [historyPayload, setHistoryPayload] = useState(null);
  const [summaryPayload, setSummaryPayload] = useState(null);
  const [comparisonPayload, setComparisonPayload] = useState(null);
  const [marketInsights, setMarketInsights] = useState(null);
  const [lastRefresh, setLastRefresh] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const selectedCompany = useMemo(
    () => companies.find((company) => company.symbol === selectedSymbol) || null,
    [companies, selectedSymbol],
  );

  const comparisonSummary = useMemo(() => {
    if (!comparisonPayload) {
      return "Select a second company to compare relative strength, correlation, and trend divergence.";
    }

    const correlation =
      comparisonPayload.correlation_close_price === null
        ? "not enough aligned data"
        : comparisonPayload.correlation_close_price;

    return `${comparisonPayload.outperformer} leads over ${comparisonPayload.comparison_window_days} sessions. Correlation ${correlation}. Relative gap ${percentFormatter.format(Math.abs(comparisonPayload.performance_gap_pct))}%.`;
  }, [comparisonPayload]);

  async function loadShellData(initial = false) {
    if (initial) {
      setLoading(true);
    } else {
      setBusy(true);
    }

    setError("");

    try {
      const companiesPayload = await fetchJson("/companies");
      const baseCompanies = companiesPayload.companies;
      const defaultSymbol = initial ? baseCompanies[0]?.symbol : selectedSymbol;
      const activeSymbol = defaultSymbol || baseCompanies[0]?.symbol;
      const fallbackCompare =
        compareSymbol && compareSymbol !== activeSymbol
          ? compareSymbol
          : baseCompanies.find((item) => item.symbol !== activeSymbol)?.symbol || "";

      if (!activeSymbol) {
        throw new Error("No companies were returned by the API.");
      }

      const [history, summary, insights] = await Promise.all([
        fetchJson(`/data/${activeSymbol}?days=${currentRange}`),
        fetchJson(`/summary/${activeSymbol}`),
        fetchJson("/market-insights"),
      ]);

      let comparison = null;
      if (fallbackCompare) {
        comparison = await fetchJson(
          `/compare?symbol1=${activeSymbol}&symbol2=${fallbackCompare}&days=${currentRange}`,
        );
      }

      setCompanies(baseCompanies);
      setSelectedSymbol(activeSymbol);
      setCompareSymbol(fallbackCompare);
      setHistoryPayload(history);
      setSummaryPayload(summary);
      setMarketInsights(insights);
      setComparisonPayload(comparison);
      setLastRefresh(companiesPayload.last_refresh);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setLoading(false);
      setBusy(false);
    }
  }

  async function loadForSelection(nextSymbol, nextCompare, nextRange) {
    setBusy(true);
    setError("");

    try {
      const [history, summary, insights] = await Promise.all([
        fetchJson(`/data/${nextSymbol}?days=${nextRange}`),
        fetchJson(`/summary/${nextSymbol}`),
        fetchJson("/market-insights"),
      ]);

      let comparison = null;
      if (nextCompare && nextCompare !== nextSymbol) {
        comparison = await fetchJson(
          `/compare?symbol1=${nextSymbol}&symbol2=${nextCompare}&days=${nextRange}`,
        );
      }

      setSelectedSymbol(nextSymbol);
      setCompareSymbol(nextCompare);
      setHistoryPayload(history);
      setSummaryPayload(summary);
      setMarketInsights(insights);
      setComparisonPayload(comparison);
    } catch (fetchError) {
      setError(fetchError.message);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    loadShellData(true);
  }, []);

  if (loading) {
    return html`<${LoadingScreen} />`;
  }

  if (error && !historyPayload) {
    return html`<${ErrorScreen} message=${error} onRetry=${() => loadShellData(true)} />`;
  }

  const history = historyPayload?.history || [];
  const summary = summaryPayload?.summary || {};
  const rangeLabel = `${currentRange} sessions`;
  const moversLead = marketInsights?.leaders || [];
  const moversLag = marketInsights?.laggards || [];

  return html`
    <div className=${`app-shell ${busy ? "is-busy" : ""}`}>
      <div className="background-grid"></div>
      <div className="ambient ambient-a"></div>
      <div className="ambient ambient-b"></div>
      <div className="ambient ambient-c"></div>

      <main className="dashboard-frame">
        <aside className="sidebar-shell glass-panel">
          <div className="brand-lockup">
            <div className="brand-tag">
              <span className="status-dot"></span>
              JarNox Assignment
            </div>
            <h1>Pulseboard</h1>
            <p>
              A dark market workspace with live analytics, rich comparison views, and tactile micro-interactions.
            </p>
          </div>

          <div className="sidebar-section">
            <div className="section-heading">
              <span>Coverage</span>
              <strong>${companies.length} stocks</strong>
            </div>
            <div className="company-list">
              ${companies.map(
                (company) => html`
                  <${CompanyButton}
                    key=${company.symbol}
                    company=${company}
                    active=${company.symbol === selectedSymbol}
                    onSelect=${(symbol) => {
                      const nextCompare =
                        compareSymbol && compareSymbol !== symbol
                          ? compareSymbol
                          : companies.find((item) => item.symbol !== symbol)?.symbol || "";
                      loadForSelection(symbol, nextCompare, currentRange);
                    }}
                  />
                `,
              )}
            </div>
          </div>

          <div className="sidebar-section sidebar-controls">
            <div className="section-heading">
              <span>Comparison Lab</span>
              <strong>${rangeLabel}</strong>
            </div>

            <label className="field">
              <span>Benchmark symbol</span>
              <select
                value=${compareSymbol}
                onChange=${(event) => setCompareSymbol(event.target.value)}
              >
                ${companies
                  .filter((company) => company.symbol !== selectedSymbol)
                  .map(
                    (company) => html`
                      <option key=${company.symbol} value=${company.symbol}>
                        ${company.name} (${company.symbol})
                      </option>
                    `,
                  )}
              </select>
            </label>

            <label className="field">
              <span>Analysis window</span>
              <div className="range-pills">
                ${[30, 90, 180, 365].map(
                  (value) => html`
                    <button
                      key=${value}
                      type="button"
                      className=${`range-pill ${currentRange === value ? "active" : ""}`}
                      onClick=${() => {
                        setCurrentRange(value);
                        loadForSelection(selectedSymbol, compareSymbol, value);
                      }}
                    >
                      ${value}D
                    </button>
                  `,
                )}
              </div>
            </label>

            <button
              type="button"
              className="primary-button"
              onClick=${() => loadForSelection(selectedSymbol, compareSymbol, currentRange)}
            >
              Refresh comparison
            </button>
          </div>
        </aside>

        <section className="content-shell">
          <header className="hero-card glass-panel">
            <div className="hero-copy">
              <div className="hero-meta">
                <span className="hero-badge">Dark mode command center</span>
                <span className="hero-refresh">Synced ${formatRefresh(lastRefresh)}</span>
              </div>
              <h2>
                ${selectedCompany?.name || "Selected stock"}
                <span>${selectedCompany ? ` ${selectedCompany.symbol}` : ""}</span>
              </h2>
              <p>
                ${selectedCompany?.sector || "Market"}
                ${summary.last_trading_date ? ` | Last trading day ${summary.last_trading_date}` : ""}
              </p>
            </div>
            <div className="hero-pulse">
              <span></span>
              <strong>${summary.latest_daily_return >= 0 ? "Bullish tilt" : "Cooling session"}</strong>
              <small>
                ${summary.latest_daily_return >= 0 ? "+" : ""}
                ${percentFormatter.format((summary.latest_daily_return || 0) * 100)}% today
              </small>
            </div>
          </header>

          <section className="metric-grid">
            <${ShellMetric}
              label="Latest close"
              value=${currencyFormatter.format(summary.latest_close || 0)}
              helper="Current market close from the selected window"
              tone="primary"
              delay=${20}
            />
            <${ShellMetric}
              label="7D moving average"
              value=${currencyFormatter.format(summary.moving_average_7 || 0)}
              helper="Short-term trend smoothing signal"
              tone="teal"
              delay=${80}
            />
            <${ShellMetric}
              label="52W range"
              value=${`${currencyFormatter.format(summary.low_52_week || 0)} - ${currencyFormatter.format(summary.high_52_week || 0)}`}
              helper="Rolling 52-week floor to ceiling"
              tone="amber"
              delay=${140}
            />
            <${ShellMetric}
              label="Volatility score"
              value=${`${percentFormatter.format(summary.volatility_score || 0)} pts`}
              helper="Annualized daily-return variability"
              tone="danger"
              delay=${200}
            />
          </section>

          <section className="spotlight-grid">
            <article className="chart-card glass-panel">
              <div className="card-header">
                <div>
                  <span className="eyebrow">Price action</span>
                  <h3>Close with 7-day drift line</h3>
                </div>
                <div className="card-chip">${rangeLabel}</div>
              </div>
              <div className="chart-wrap">
                <${PriceChart} symbol=${selectedSymbol} history=${history} />
              </div>
            </article>

            <article className="signal-stack">
              <section className="signal-card glass-panel">
                <div className="card-header">
                  <div>
                    <span className="eyebrow">Technical mix</span>
                    <h3>Volatility vs momentum</h3>
                  </div>
                </div>
                <div className="chart-wrap compact">
                  <${InsightChart} history=${history} />
                </div>
              </section>

              <section className="narrative-card glass-panel">
                <span className="eyebrow">Signal note</span>
                <h3>
                  ${(summary.momentum_score || 0) >= 0 ? "Momentum remains constructive" : "Momentum is fading"}
                </h3>
                <p>
                  ${(summary.momentum_score || 0) >= 0
                    ? "Recent closes are still holding up versus the short-term baseline, with volatility that stays within a controlled band."
                    : "Short-term momentum has softened. The stock is under pressure relative to its own recent baseline and deserves closer monitoring."}
                </p>
                <div className="narrative-stats">
                  <div>
                    <strong>${percentFormatter.format(summary.momentum_score || 0)}%</strong>
                    <span>7-day momentum</span>
                  </div>
                  <div>
                    <strong>${currencyFormatter.format(summary.average_close || 0)}</strong>
                    <span>52W average close</span>
                  </div>
                </div>
              </section>
            </article>
          </section>

          <section className="compare-shell glass-panel">
            <div className="card-header compare-header">
              <div>
                <span className="eyebrow">Relative strength</span>
                <h3>${selectedSymbol} vs ${compareSymbol || "benchmark"}</h3>
              </div>
              <p>${comparisonSummary}</p>
            </div>
            <div className="chart-wrap compare-chart-wrap">
              <${CompareChart} comparison=${comparisonPayload} />
            </div>
          </section>

          <section className="bottom-grid">
            <article className="glass-panel movers-panel">
              <div className="card-header">
                <div>
                  <span className="eyebrow">Top gainers</span>
                  <h3>Session leaders</h3>
                </div>
              </div>
              <${MoversList} items=${moversLead} />
            </article>

            <article className="glass-panel movers-panel">
              <div className="card-header">
                <div>
                  <span className="eyebrow">Top losers</span>
                  <h3>Under pressure</h3>
                </div>
              </div>
              <${MoversList} items=${moversLag} />
            </article>
          </section>
        </section>
      </main>
    </div>
  `;
}

ReactDOM.createRoot(document.getElementById("root")).render(html`<${App} />`);
