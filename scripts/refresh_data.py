from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from app.services.ingest import refresh_dataset


if __name__ == "__main__":
    result = refresh_dataset(force=True)
    print(result)

