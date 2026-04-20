from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import brand_for_user, current_user
from app.models import Prompt, PromptRun, User
from app.providers import list_enabled_providers
from app.schemas import PromptRunRead, RunRequest

router = APIRouter(prefix="/brands/{brand_id}/runs", tags=["runs"])


@router.get("", response_model=list[PromptRunRead])
def list_runs(
    brand_id: UUID,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
    limit: int = 50,
) -> list[PromptRun]:
    brand_for_user(brand_id, user, db)
    return (
        db.query(PromptRun)
        .filter(PromptRun.brand_id == brand_id)
        .order_by(desc(PromptRun.created_at))
        .limit(limit)
        .all()
    )


@router.get("/{run_id}", response_model=PromptRunRead)
def get_run(
    brand_id: UUID,
    run_id: UUID,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> PromptRun:
    brand_for_user(brand_id, user, db)
    run = db.get(PromptRun, run_id)
    if not run or run.brand_id != brand_id:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post("", response_model=list[PromptRunRead], status_code=202)
def trigger_runs(
    brand_id: UUID,
    body: RunRequest,
    user: User = Depends(current_user),
    db: Session = Depends(get_db),
) -> list[PromptRun]:
    brand = brand_for_user(brand_id, user, db)

    # Select prompts
    q = db.query(Prompt).filter(Prompt.brand_id == brand.id, Prompt.enabled == True)  # noqa: E712
    if body.prompt_ids:
        q = q.filter(Prompt.id.in_(body.prompt_ids))
    prompts = q.all()
    if not prompts:
        raise HTTPException(status_code=400, detail="No enabled prompts to run")

    # Select providers
    if body.providers:
        provider_specs = [(p.provider, p.model) for p in body.providers]
    else:
        provider_specs = [(p.name, p.default_model) for p in list_enabled_providers()]
    if not provider_specs:
        raise HTTPException(
            status_code=400,
            detail="No providers enabled. Set *_ENABLED=true and provide an API key in .env.",
        )

    created: list[PromptRun] = []
    for prompt in prompts:
        for provider_name, model in provider_specs:
            run = PromptRun(
                prompt_id=prompt.id,
                brand_id=brand.id,
                provider=provider_name,
                model=model or "",
                status="pending",
            )
            db.add(run)
            created.append(run)
    db.commit()
    for r in created:
        db.refresh(r)

    # Enqueue
    from app.tasks import run_prompt  # local import avoids celery import at module load

    for r in created:
        run_prompt.delay(str(r.id))

    return created
