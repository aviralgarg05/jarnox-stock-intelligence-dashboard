from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import (
    APP_DESCRIPTION,
    APP_TITLE,
    DEFAULT_LOOKBACK_DAYS,
    MAX_LOOKBACK_DAYS,
    STATIC_DIR,
    TEMPLATE_DIR,
)
from app.database import (
    get_company,
    get_market_snapshot,
    get_metadata,
    get_stock_history,
    get_summary,
    list_company_overview,
)
from app.services.analytics import build_comparison_payload
from app.services.ingest import ensure_dataset_ready


@asynccontextmanager
async def lifespan(application: FastAPI):
    application.state.dataset_status = ensure_dataset_ready()
    yield


app = FastAPI(
    title=APP_TITLE,
    description=APP_DESCRIPTION,
    version="1.0.0",
    lifespan=lifespan,
)
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/", response_class=FileResponse)
def index() -> FileResponse:
    return FileResponse(TEMPLATE_DIR / "index.html")


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "status": "ok",
        "dataset": getattr(app.state, "dataset_status", {"status": "unknown"}),
        "last_refresh": get_metadata("last_refresh"),
    }


@app.get("/companies")
def companies() -> dict[str, Any]:
    return {
        "last_refresh": get_metadata("last_refresh"),
        "companies": list_company_overview(),
    }


@app.get("/data/{symbol}")
def stock_data(
    symbol: str,
    days: int = Query(DEFAULT_LOOKBACK_DAYS, ge=7, le=MAX_LOOKBACK_DAYS),
) -> dict[str, Any]:
    normalized_symbol = symbol.upper()
    company = get_company(normalized_symbol)
    if not company:
        raise HTTPException(status_code=404, detail="Company symbol not found.")

    history = get_stock_history(normalized_symbol, days)
    if not history:
        raise HTTPException(status_code=404, detail="No price history available for this symbol.")

    return {
        "company": company,
        "days": days,
        "history": history,
    }


@app.get("/summary/{symbol}")
def summary(symbol: str) -> dict[str, Any]:
    normalized_symbol = symbol.upper()
    company = get_company(normalized_symbol)
    if not company:
        raise HTTPException(status_code=404, detail="Company symbol not found.")

    summary_payload = get_summary(normalized_symbol)
    if not summary_payload:
        raise HTTPException(status_code=404, detail="No summary data available for this symbol.")

    return {
        "company": company,
        "summary": summary_payload,
    }


@app.get("/compare")
def compare(
    symbol1: str = Query(..., min_length=1),
    symbol2: str = Query(..., min_length=1),
    days: int = Query(90, ge=30, le=MAX_LOOKBACK_DAYS),
) -> dict[str, Any]:
    symbol_one = symbol1.upper()
    symbol_two = symbol2.upper()

    if symbol_one == symbol_two:
        raise HTTPException(status_code=400, detail="Select two different company symbols.")

    company_one = get_company(symbol_one)
    company_two = get_company(symbol_two)
    if not company_one or not company_two:
        raise HTTPException(status_code=404, detail="One or both company symbols were not found.")

    history_one = get_stock_history(symbol_one, days)
    history_two = get_stock_history(symbol_two, days)
    if not history_one or not history_two:
        raise HTTPException(status_code=404, detail="Insufficient history available for comparison.")

    return {
        "companies": [company_one, company_two],
        **build_comparison_payload(symbol_one, symbol_two, history_one, history_two),
    }


@app.get("/market-insights")
def market_insights() -> dict[str, Any]:
    snapshot = get_market_snapshot()
    if not snapshot:
        raise HTTPException(status_code=404, detail="No market snapshot available.")

    sorted_snapshot = sorted(snapshot, key=lambda item: item["day_change_pct"], reverse=True)
    losers = sorted(snapshot, key=lambda item: item["day_change_pct"])

    return {
        "last_refresh": get_metadata("last_refresh"),
        "leaders": sorted_snapshot[:3],
        "laggards": losers[:3],
        "snapshot": snapshot,
    }

