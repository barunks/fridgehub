from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import User
from app.schemas.fridgehub import ErrorResponse, ResendOtpRequest, VerificationStatusOut, VerifyOtpRequest
from app.services.verification_service import issue_otp, verification_status, verify_otp

router = APIRouter()


@router.post(
    "/verify",
    response_model=VerificationStatusOut,
    responses={400: {"model": ErrorResponse}, 404: {"model": ErrorResponse}},
)
def verify_endpoint(payload: VerifyOtpRequest, db: Session = Depends(get_db)) -> dict:
    result = verify_otp(db, payload.userId, payload.emailOtp, payload.phoneOtp)
    db.commit()
    return result


@router.post(
    "/resend",
    response_model=VerificationStatusOut,
    responses={404: {"model": ErrorResponse}},
)
def resend_endpoint(payload: ResendOtpRequest, db: Session = Depends(get_db)) -> dict:
    user = db.get(User, payload.userId)
    if not user or not user.is_active:
        raise HTTPException(status_code=404, detail="User not found.")
    status = verification_status(user)
    if status["verified"]:
        return status
    issue_otp(db, user)
    db.commit()
    return verification_status(user)
