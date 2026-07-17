from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, require_permission
from app.core.database import get_db
from app.core.permissions import Permission
from app.schemas.fridgehub import AssistantInsightOut, AssistantRequest, AssistantResponse
from app.services.assistant_rules import generate_insights
from app.services.assistant_service import recommendations
from app.services.family_service import bootstrap_state

router = APIRouter()


@router.post("/recommendations", response_model=AssistantResponse)
def ask_assistant(
    payload: AssistantRequest,
    current_user: CurrentUser = Depends(require_permission(Permission.USE_ASSISTANT)),
    db: Session = Depends(get_db),
) -> dict:
    return recommendations(db, payload.query, current_user.family_id)


@router.get("/insights", response_model=list[AssistantInsightOut])
def assistant_insights(
    current_user: CurrentUser = Depends(require_permission(Permission.USE_ASSISTANT)),
    db: Session = Depends(get_db),
) -> list[dict]:
    return generate_insights(bootstrap_state(db, current_user.family_id))
