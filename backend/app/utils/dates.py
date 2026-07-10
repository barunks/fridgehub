from datetime import date, datetime, time, timedelta


def start_of_week(value: date | None = None) -> date:
    current = value or date.today()
    return current - timedelta(days=current.weekday())


def date_offset(days: int) -> date:
    return date.today() + timedelta(days=days)


def datetime_offset(days: int, hour: int, minute: int = 0) -> datetime:
    return datetime.combine(date_offset(days), time(hour=hour, minute=minute))


def cycle_end(start: date, frequency: str) -> date:
    days = {"daily": 1, "weekly": 7, "monthly": 30, "quarterly": 90}.get(frequency, 7)
    return start + timedelta(days=days - 1)
