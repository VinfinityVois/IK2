from datetime import date, datetime
from zoneinfo import ZoneInfo
from app.core.config import settings

@property
def is_overdue(self) -> bool:
    today = datetime.now(ZoneInfo(settings.TIMEZONE)).date()

    if self.is_paid:
        # оплачен с опозданием
        if self.paid_at and self.paid_at > self.due_date:
            return True
        return False

    return today > self.due_date