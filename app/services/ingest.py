from __future__ import annotations

from datetime import datetime, timedelta, timezone
import threading
from typing import Any

import pandas as pd
import yfinance as yf

from app.config import (
    AUTO_REFRESH_AFTER_HOURS,
    COMPANY_CATALOG,
    INGESTION_LOOKBACK_DAYS,
)
from app.database import (
    count_stock_rows,
    get_metadata,
    initialize_database,
    replace_stock_data,
    set_metadata,
)
from app.services.analytics import prepare_history_frame

REFRESH_LOCK = threading.Lock()


def ensure_dataset_ready(force: bool = False) -> dict[str, Any]:
    initialize_database()
    if not force and not should_refresh_dataset():
        return {
            "status": "ready",
            "message": "Using cached SQLite dataset.",
            "last_refresh": get_metadata("last_refresh"),
            "row_count": count_stock_rows(),
        }
    return refresh_dataset(force=True)


def should_refresh_dataset() -> bool:
    if count_stock_rows() == 0:
        return True

    last_refresh = get_metadata("last_refresh")
    if not last_refresh:
        return True

    last_refresh_at = datetime.fromisoformat(last_refresh)
    age = datetime.now(timezone.utc) - last_refresh_at
    return age > timedelta(hours=AUTO_REFRESH_AFTER_HOURS)


def refresh_dataset(force: bool = False) -> dict[str, Any]:
    initialize_database()

    with REFRESH_LOCK:
        if not force and not should_refresh_dataset():
            return {
                "status": "ready",
                "message": "Refresh skipped because cached data is still fresh.",
                "last_refresh": get_metadata("last_refresh"),
                "row_count": count_stock_rows(),
            }

        start_date = datetime.now(timezone.utc) - timedelta(days=INGESTION_LOOKBACK_DAYS)
        end_date = datetime.now(timezone.utc)

        ingested_symbols: list[dict[str, Any]] = []
        failures: list[dict[str, str]] = []

        for company in COMPANY_CATALOG:
            try:
                raw_frame = download_stock_history(
                    yahoo_symbol=company["yahoo_symbol"],
                    start_date=start_date,
                    end_date=end_date,
                )
                prepared = prepare_history_frame(raw_frame)
                prepared["symbol"] = company["symbol"]
                written_rows = replace_stock_data(
                    symbol=company["symbol"],
                    records=prepared.to_dict(orient="records"),
                )
                ingested_symbols.append(
                    {
                        "symbol": company["symbol"],
                        "rows": int(len(prepared.index)),
                        "db_changes": written_rows,
                    }
                )
            except Exception as exc:  # pragma: no cover - exercised in integration runs
                failures.append({"symbol": company["symbol"], "error": str(exc)})

        if not ingested_symbols and count_stock_rows() == 0:
            raise RuntimeError(
                "Unable to bootstrap the dataset from Yahoo Finance. "
                "Check your network connection and try again."
            )

        refreshed_at = datetime.now(timezone.utc).isoformat()
        set_metadata("last_refresh", refreshed_at)

        return {
            "status": "refreshed",
            "message": "Dataset synced from Yahoo Finance into SQLite.",
            "last_refresh": refreshed_at,
            "row_count": count_stock_rows(),
            "ingested_symbols": ingested_symbols,
            "failures": failures,
        }


def download_stock_history(
    yahoo_symbol: str,
    start_date: datetime,
    end_date: datetime,
) -> pd.DataFrame:
    frame = yf.download(
        tickers=yahoo_symbol,
        start=start_date.date().isoformat(),
        end=(end_date + timedelta(days=1)).date().isoformat(),
        interval="1d",
        auto_adjust=False,
        progress=False,
        threads=False,
    )
    if frame.empty:
        raise ValueError(f"No rows returned for {yahoo_symbol}")

    frame = frame.reset_index()
    frame.columns = [flatten_column_name(column) for column in frame.columns]

    expected = ["date", "open", "high", "low", "close", "volume"]
    normalized = frame.rename(
        columns={
            "Date": "date",
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume",
        }
    )

    missing = [column for column in expected if column not in normalized.columns]
    if missing:
        raise ValueError(f"Downloaded frame missing columns: {missing}")

    return normalized[expected]


def flatten_column_name(column: Any) -> str:
    if isinstance(column, tuple):
        for value in column:
            if value and value not in {"", None}:
                return str(value)
        return ""
    return str(column)

