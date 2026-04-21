from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.auth import create_access_token, hash_password, verify_password
from app.database import get_db
from app.deps import current_user
from app.models import Organization, User
from app.schemas import LoginRequest, SignupRequest, TokenResponse, UserRead
from app.scoring import now_utc

router = APIRouter(prefix="/auth", tags=["auth"])


class ProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8)


@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(body: SignupRequest, db: Session = Depends(get_db)) -> TokenResponse:
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    org = Organization(
        name=body.organization_name or f"{body.email.split('@')[0]}'s workspace",
        plan="free",
        trial_ends_at=now_utc() + timedelta(days=14),
    )
    db.add(org)
    db.flush()

    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        full_name=body.full_name,
        organization_id=org.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id, org.id)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.get("/me", response_model=UserRead)
def me(user: User = Depends(current_user)) -> User:
    """Return the currently authenticated user's profile."""
    return user


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    token = create_access_token(user.id, user.organization_id)
    return TokenResponse(access_token=token, user=UserRead.model_validate(user))


@router.get("/profile")
def get_profile(user: User = Depends(current_user)) -> dict:
    """Return the current user's profile information."""
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "is_admin": user.is_admin,
        "organization_id": str(user.organization_id),
    }


@router.patch("/profile")
def update_profile(
    body: ProfileUpdate,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Update the current user's profile (name, email)."""
    if body.full_name is not None:
        user.full_name = body.full_name
    if body.email is not None:
        # Check if email is already taken
        existing = db.query(User).filter(User.email == body.email, User.id != user.id).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")
        user.email = body.email
    db.commit()
    db.refresh(user)
    return {
        "id": str(user.id),
        "email": user.email,
        "full_name": user.full_name,
        "is_admin": user.is_admin,
        "organization_id": str(user.organization_id),
    }


@router.post("/password/change")
def change_password(
    body: PasswordChange,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Change the current user's password."""
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    user.password_hash = hash_password(body.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


@router.delete("/account")
def delete_account(
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Delete the current user's account."""
    # Delete user (cascade will handle related data)
    db.delete(user)
    db.commit()
    return {"message": "Account deleted successfully"}


@router.post("/admin/promote")
def promote_to_admin(
    email: str,
    requesting_user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> dict:
    """Promote a user to admin. Only callable by existing admins."""
    if not requesting_user.is_admin:
        raise HTTPException(status_code=403, detail="Only admins can promote users")

    target = db.query(User).filter(User.email == email).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.is_admin = True
    db.commit()
    return {"message": f"User {email} is now admin"}


@router.get("/admin/promote-by-code")
def promote_by_code(
    email: str,
    code: str,
    db: Session = Depends(get_db),
) -> dict:
    """
    Promote a user to admin using a secret code.
    Usage: GET /auth/admin/promote-by-code?email=user@example.com&code=YOUR_SECRET_CODE
    The code must match ADMIN_PROMOTE_CODE env var.
    """
    import os
    secret_code = os.getenv("ADMIN_PROMOTE_CODE")
    if not secret_code or code != secret_code:
        raise HTTPException(status_code=403, detail="Invalid code")

    target = db.query(User).filter(User.email == email).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    target.is_admin = True
    db.commit()
    return {"message": f"User {email} is now admin"}
