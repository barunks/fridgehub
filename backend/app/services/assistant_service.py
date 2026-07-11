from typing import Any

from sqlalchemy.orm import Session

from app.services.assistant_rules import answer_query, generate_insights
from app.services.family_service import bootstrap_state


def recommendations(db: Session, query: str, family_id: int) -> dict[str, Any]:
    state = bootstrap_state(db, family_id)
    return {"answer": answer_query(query, state), "insights": generate_insights(state)}
