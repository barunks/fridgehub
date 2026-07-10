from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.dependencies import CurrentUser, get_current_user, require_parent
from app.core.database import get_db
from app.schemas.familyhub import TaskCreate, TaskOut, TaskUpdate
from app.services import task_service

router = APIRouter()


@router.get("", response_model=list[TaskOut])
def get_tasks(
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    return task_service.list_tasks(db, current_user.family_id, status, limit, offset)


@router.post("", response_model=TaskOut)
def create_task(
    payload: TaskCreate,
    current_user: CurrentUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> dict:
    return task_service.create_task(db, payload, current_user.family_id, current_user.user_id)


@router.patch("/{task_id}", response_model=TaskOut)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    current_user: CurrentUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> dict:
    return task_service.update_task(db, task_id, payload, current_user.family_id, current_user.user_id)


@router.delete("/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    current_user: CurrentUser = Depends(require_parent),
    db: Session = Depends(get_db),
) -> None:
    task_service.delete_task(db, task_id, current_user.family_id, current_user.user_id)
