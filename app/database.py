from __future__ import annotations

import sqlite3
from typing import Any, Iterable

from .config import COMPANY_CATALOG, DATABASE_PATH

PRICE_COLUMNS = (
    "symbol",
    "date",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "daily_return",
    "moving_average_7",
    "rolling_52w_high",
    "rolling_52w_low",
    "volatility_score",
    "momentum_score",
)


def get_connection() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            PRAGMA journal_mode = WAL;

            CREATE TABLE IF NOT EXISTS companies (
                symbol TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                sector TEXT NOT NULL,
                yahoo_symbol TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS stock_prices (
                symbol TEXT NOT NULL,
                date TEXT NOT NULL,
                open REAL NOT NULL,
                high REAL NOT NULL,
                low REAL NOT NULL,
                close REAL NOT NULL,
                volume INTEGER NOT NULL,
                daily_return REAL NOT NULL,
                moving_average_7 REAL NOT NULL,
                rolling_52w_high REAL NOT NULL,
                rolling_52w_low REAL NOT NULL,
                volatility_score REAL NOT NULL,
                momentum_score REAL NOT NULL,
                PRIMARY KEY (symbol, date),
                FOREIGN KEY(symbol) REFERENCES companies(symbol)
            );

            CREATE INDEX IF NOT EXISTS idx_stock_prices_symbol_date
            ON stock_prices(symbol, date DESC);

            CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            """
        )
        connection.executemany(
            """
            INSERT INTO companies(symbol, name, sector, yahoo_symbol)
            VALUES(:symbol, :name, :sector, :yahoo_symbol)
            ON CONFLICT(symbol) DO UPDATE SET
                name = excluded.name,
                sector = excluded.sector,
                yahoo_symbol = excluded.yahoo_symbol
            """,
            COMPANY_CATALOG,
        )
        connection.commit()


def replace_stock_data(symbol: str, records: Iterable[dict[str, Any]]) -> int:
    with get_connection() as connection:
        connection.execute("DELETE FROM stock_prices WHERE symbol = ?", (symbol,))
        connection.executemany(
            """
            INSERT INTO stock_prices(
                symbol, date, open, high, low, close, volume,
                daily_return, moving_average_7, rolling_52w_high,
                rolling_52w_low, volatility_score, momentum_score
            )
            VALUES(
                :symbol, :date, :open, :high, :low, :close, :volume,
                :daily_return, :moving_average_7, :rolling_52w_high,
                :rolling_52w_low, :volatility_score, :momentum_score
            )
            """,
            records,
        )
        connection.commit()
        return connection.total_changes


def get_metadata(key: str) -> str | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT value FROM metadata WHERE key = ?",
            (key,),
        ).fetchone()
        return row["value"] if row else None


def set_metadata(key: str, value: str) -> None:
    with get_connection() as connection:
        connection.execute(
            """
            INSERT INTO metadata(key, value)
            VALUES(?, ?)
            ON CONFLICT(key) DO UPDATE SET value = excluded.value
            """,
            (key, value),
        )
        connection.commit()


def count_stock_rows() -> int:
    with get_connection() as connection:
        row = connection.execute("SELECT COUNT(*) AS count FROM stock_prices").fetchone()
        return int(row["count"])


def get_company(symbol: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            "SELECT symbol, name, sector, yahoo_symbol FROM companies WHERE symbol = ?",
            (symbol,),
        ).fetchone()
        return dict(row) if row else None


def list_company_overview() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            SELECT
                c.symbol,
                c.name,
                c.sector,
                latest.date AS last_trading_date,
                latest.close AS latest_close,
                latest.daily_return AS latest_daily_return,
                latest.volatility_score AS volatility_score,
                latest.momentum_score AS momentum_score
            FROM companies c
            LEFT JOIN stock_prices latest
                ON latest.symbol = c.symbol
                AND latest.date = (
                    SELECT MAX(sp.date)
                    FROM stock_prices sp
                    WHERE sp.symbol = c.symbol
                )
            ORDER BY c.name
            """
        ).fetchall()
        return [dict(row) for row in rows]


def get_stock_history(symbol: str, days: int) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            WITH recent AS (
                SELECT *
                FROM stock_prices
                WHERE symbol = ?
                ORDER BY date DESC
                LIMIT ?
            )
            SELECT *
            FROM recent
            ORDER BY date ASC
            """,
            (symbol, days),
        ).fetchall()
        return [dict(row) for row in rows]


def get_summary(symbol: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute(
            """
            WITH recent AS (
                SELECT *
                FROM stock_prices
                WHERE symbol = ?
                ORDER BY date DESC
                LIMIT 252
            ),
            latest AS (
                SELECT *
                FROM stock_prices
                WHERE symbol = ?
                ORDER BY date DESC
                LIMIT 1
            )
            SELECT
                latest.date AS last_trading_date,
                latest.close AS latest_close,
                latest.daily_return AS latest_daily_return,
                latest.moving_average_7 AS moving_average_7,
                latest.volatility_score AS volatility_score,
                latest.momentum_score AS momentum_score,
                (SELECT MAX(close) FROM recent) AS high_52_week,
                (SELECT MIN(close) FROM recent) AS low_52_week,
                (SELECT AVG(close) FROM recent) AS average_close,
                (SELECT AVG(volume) FROM recent) AS average_volume
            FROM latest
            """,
            (symbol, symbol),
        ).fetchone()
        return dict(row) if row else None


def get_market_snapshot() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            """
            WITH ranked AS (
                SELECT
                    symbol,
                    date,
                    close,
                    ROW_NUMBER() OVER (PARTITION BY symbol ORDER BY date DESC) AS rank_position
                FROM stock_prices
            ),
            latest AS (
                SELECT symbol, date, close
                FROM ranked
                WHERE rank_position = 1
            ),
            previous AS (
                SELECT symbol, close
                FROM ranked
                WHERE rank_position = 2
            )
            SELECT
                c.symbol,
                c.name,
                c.sector,
                latest.date AS last_trading_date,
                latest.close AS latest_close,
                previous.close AS previous_close,
                CASE
                    WHEN previous.close IS NULL OR previous.close = 0 THEN 0
                    ELSE ((latest.close - previous.close) / previous.close) * 100
                END AS day_change_pct
            FROM companies c
            JOIN latest ON latest.symbol = c.symbol
            LEFT JOIN previous ON previous.symbol = c.symbol
            ORDER BY day_change_pct DESC, c.name ASC
            """
        ).fetchall()
        return [dict(row) for row in rows]

