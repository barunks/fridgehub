from app.core.database import SessionLocal
from app.models import Family
from app.services.grocery_service import regenerate_cycles
from app.tasks.celery_app import celery_app


@celery_app.task(name="app.tasks.grocery_scheduler.regenerate_all_family_cycles")
def regenerate_all_family_cycles() -> dict[str, int]:
    db = SessionLocal()
    try:
        family_ids = [family.id for family in db.query(Family).filter_by(is_active=True).all()]
        total_cycles = 0
        for family_id in family_ids:
            total_cycles += len(regenerate_cycles(db, family_id))
        return {"families": len(family_ids), "cycles": total_cycles}
    finally:
        db.close()
