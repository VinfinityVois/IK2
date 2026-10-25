import json
import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger("invoice_keeper.audit")


def audit(action: str, *, actor_id: int | None, target_type: str,
          target_id: int | str, details: dict[str, Any] | None = None) -> None:
    record = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action, "actor_id": actor_id,
        "target_type": target_type, "target_id": target_id,
        "details": details or {},
    }
    logger.info("audit %s", json.dumps(record, ensure_ascii=False, default=str))
