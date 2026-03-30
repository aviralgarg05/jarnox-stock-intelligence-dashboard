# Stock Data Intelligence Dashboard

This repository contains my solution for the JarNox software internship assignment. The project is a mini financial data platform built with FastAPI, SQLite, Pandas, and a lightweight frontend dashboard.

## What the project does

- Fetches real NSE stock data from Yahoo Finance and caches it in SQLite.
- Cleans the dataset and computes:
  - Daily return
  - 7-day moving average
  - 52-week high and low
  - Volatility score (custom metric)
  - Momentum score (extra analytical signal)
- Exposes REST APIs for company listing, recent price history, 52-week summary, and stock-vs-stock comparison.
- Serves a responsive dashboard with company selection, charts, comparison mode, and top gainers/losers.
- Uses a modern dark mode React UI with animated cards, motion-rich transitions, and richer comparison storytelling.

## Tech choices

- Backend: FastAPI
- Storage: SQLite
- Data processing: Pandas, NumPy
- Data source: Yahoo Finance via `yfinance`
- Frontend: HTML, CSS, React 18 (CDN runtime), HTM, Chart.js
- Bonus: Dockerfile and unit tests

## Project structure

```text
app/
  main.py
  config.py
  database.py
  services/
    analytics.py
    ingest.py
  static/
    app.js
    styles.css
  templates/
    index.html
scripts/
  refresh_data.py
tests/
  test_analytics.py
```

## Setup

### Local run

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000).

On first launch, the app downloads historical data for a curated NSE watchlist and stores it in `data/stocks.db`. Later launches reuse the cached dataset and auto-refresh it when it is older than 24 hours.

### Manual refresh

```bash
python scripts/refresh_data.py
```

### Tests

```bash
pytest
```

### Docker

```bash
docker build -t stock-dashboard .
docker run -p 8000:8000 stock-dashboard
```

### Vercel deployment

This project is now set up to deploy directly on Vercel as a website backed by the FastAPI app.

```bash
npm i -g vercel
vercel
```

What was added for Vercel:

- `index.py` exposes the FastAPI `app` at a supported Vercel entrypoint.
- `.python-version` pins Python `3.12`, which Vercel supports.
- `vercel.json` sets a higher function timeout and excludes non-runtime files from the bundle.
- On Vercel, SQLite automatically uses `/tmp/stocks.db` because the deployment filesystem is read-only outside writable scratch storage.

Recommended environment variables if you want to tune runtime behavior:

```bash
AUTO_REFRESH_AFTER_HOURS=24
INGESTION_LOOKBACK_DAYS=540
```

Important note:

- Vercel serverless storage is ephemeral, so each new cold instance may rebuild the SQLite cache from Yahoo Finance. For a production-grade persistent deployment, swap SQLite for a managed database such as Vercel Postgres, Neon, or Supabase.

## API endpoints

- `GET /companies` returns all available companies with latest market snapshot.
- `GET /data/{symbol}` returns the latest trading history for the requested window.
- `GET /summary/{symbol}` returns 52-week high, low, average close, and current analytics.
- `GET /compare?symbol1=INFY&symbol2=TCS&days=90` compares two stocks and returns normalized performance plus price correlation.
- `GET /market-insights` returns top gainers and losers for the dashboard.
- `GET /health` shows application and dataset refresh status.

## Notes on the solution

- I selected a diversified NSE basket across technology, banking, energy, and consumer sectors.
- The custom analytical layer includes a volatility score and a momentum score so that the API exposes more than raw price movement.
- The comparison endpoint normalizes both stocks to the same baseline, which makes relative performance easy to interpret visually.

## Submission checklist

- `app/main.py`
- `requirements.txt`
- `README.md`
- Optional bonus items included:
  - Dashboard UI
  - Docker support
  - Unit tests
