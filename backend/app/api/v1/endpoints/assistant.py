from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user
from app.core.database import get_db
from app.schemas.familyhub import AssistantRequest, AssistantResponse
from app.services.assistant_service import recommendations

router = APIRouter()


@router.post("/recommendations", response_model=AssistantResponse)
def ask_assistant(
    payload: AssistantRequest,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    return recommendations(db, payload.query, current_user.family_id)
