import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
IS_VERCEL = bool(os.getenv("VERCEL")) or bool(os.getenv("VERCEL_ENV"))
DEFAULT_DATABASE_PATH = Path("/tmp/stocks.db") if IS_VERCEL else BASE_DIR / "data" / "stocks.db"
DATABASE_PATH = Path(os.getenv("STOCK_DB_PATH", DEFAULT_DATABASE_PATH))
DATA_DIR = DATABASE_PATH.parent
STATIC_DIR = BASE_DIR / "app" / "static"
TEMPLATE_DIR = BASE_DIR / "app" / "templates"

APP_TITLE = "Stock Data Intelligence Dashboard"
APP_DESCRIPTION = (
    "Mini financial data platform with analytics APIs and a lightweight dashboard."
)
DEFAULT_LOOKBACK_DAYS = 30
MAX_LOOKBACK_DAYS = 365
INGESTION_LOOKBACK_DAYS = int(os.getenv("INGESTION_LOOKBACK_DAYS", "540"))
AUTO_REFRESH_AFTER_HOURS = int(os.getenv("AUTO_REFRESH_AFTER_HOURS", "24"))

COMPANY_CATALOG = [
    {
        "symbol": "INFY",
        "name": "Infosys",
        "sector": "Technology",
        "yahoo_symbol": "INFY.NS",
    },
    {
        "symbol": "TCS",
        "name": "Tata Consultancy Services",
        "sector": "Technology",
        "yahoo_symbol": "TCS.NS",
    },
    {
        "symbol": "RELIANCE",
        "name": "Reliance Industries",
        "sector": "Energy",
        "yahoo_symbol": "RELIANCE.NS",
    },
    {
        "symbol": "HDFCBANK",
        "name": "HDFC Bank",
        "sector": "Financial Services",
        "yahoo_symbol": "HDFCBANK.NS",
    },
    {
        "symbol": "ICICIBANK",
        "name": "ICICI Bank",
        "sector": "Financial Services",
        "yahoo_symbol": "ICICIBANK.NS",
    },
    {
        "symbol": "ITC",
        "name": "ITC",
        "sector": "Consumer Goods",
        "yahoo_symbol": "ITC.NS",
    },
    {
        "symbol": "SBIN",
        "name": "State Bank of India",
        "sector": "Financial Services",
        "yahoo_symbol": "SBIN.NS",
    },
    {
        "symbol": "LT",
        "name": "Larsen & Toubro",
        "sector": "Infrastructure",
        "yahoo_symbol": "LT.NS",
    },
    {
        "symbol": "WIPRO",
        "name": "Wipro",
        "sector": "Technology",
        "yahoo_symbol": "WIPRO.NS",
    },
    {
        "symbol": "HINDUNILVR",
        "name": "Hindustan Unilever",
        "sector": "Consumer Goods",
        "yahoo_symbol": "HINDUNILVR.NS",
    },
]
