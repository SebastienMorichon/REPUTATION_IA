"""Editorial content routes.

Route ordering: literal paths before parameterised — see CLAUDE.md.
  /content/articles/generate  → before  /content/articles/{id}
  /content/blog               → before  /content/blog/{slug}

Access control:
  Dashboard routes (/content/articles/*)  → require_admin (is_admin=True)
  Public routes    (/content/blog/*)      → no auth required
"""
from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models import Article, Brand, User
from app.schemas import ArticleGenerateRequest, ArticleListItem, ArticleRead

router = APIRouter(prefix="/content", tags=["content"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _article_for_admin(article_id: uuid.UUID, admin: User, db: Session) -> Article:
    """Return the article if it belongs to the admin's organisation, else 404."""
    article = db.get(Article, article_id)
    if not article or article.organization_id != admin.organization_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return article


# ── Dashboard endpoints (platform admin only) ─────────────────────────────────

@router.get("/articles", response_model=list[ArticleListItem])
def list_articles(
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
    limit: int = 50,
    offset: int = 0,
) -> list[Article]:
    return (
        db.query(Article)
        .filter(Article.organization_id == admin.organization_id)
        .order_by(Article.created_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )


# NOTE: literal route MUST come before /{article_id} — FastAPI is order-sensitive
@router.post("/articles/generate", response_model=ArticleListItem, status_code=status.HTTP_202_ACCEPTED)
def generate_article(
    body: ArticleGenerateRequest,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Article:
    """Manually trigger the editorial pipeline for a new article.

    Creates the Article row immediately (status=idea) and enqueues the
    Celery pipeline task. Returns the row so the client can poll for updates.
    """
    brand: Brand | None = None
    if body.brand_id:
        brand = db.get(Brand, body.brand_id)
        if not brand or brand.organization_id != admin.organization_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Brand not found")

    article = Article(
        organization_id=admin.organization_id,
        brand_id=brand.id if brand else None,
        status="idea",
    )
    if body.topic_hint:
        article.brief = {"topic_hint": body.topic_hint}

    db.add(article)
    db.commit()
    db.refresh(article)

    from app.tasks import run_article_pipeline
    run_article_pipeline.delay(str(article.id))

    return article


@router.get("/articles/{article_id}", response_model=ArticleRead)
def get_article(
    article_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Article:
    return _article_for_admin(article_id, admin, db)


@router.post("/articles/{article_id}/approve", response_model=ArticleRead)
def approve_article(
    article_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Article:
    """Human approval step — moves status from 'review' or 'draft' → 'approved'."""
    article = _article_for_admin(article_id, admin, db)
    if article.status not in ("review", "draft"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot approve article in status '{article.status}'",
        )
    article.status = "approved"
    db.commit()
    db.refresh(article)
    return article


@router.post("/articles/{article_id}/publish", response_model=ArticleRead, status_code=status.HTTP_202_ACCEPTED)
def publish_article(
    article_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Article:
    """Trigger LinkedIn publication for an approved article."""
    article = _article_for_admin(article_id, admin, db)
    if article.status != "approved":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Article must be 'approved' before publishing (current: '{article.status}')",
        )

    from app.tasks import publish_article_task
    publish_article_task.delay(str(article.id))
    return article


@router.delete("/articles/{article_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_article(
    article_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> Response:
    article = _article_for_admin(article_id, admin, db)
    db.delete(article)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ── Public blog endpoints (no auth required) ──────────────────────────────────

@router.get("/blog", response_model=list[dict[str, Any]])
def public_blog_list(db: Session = Depends(get_db), limit: int = 20, offset: int = 0) -> list[dict]:
    """Public blog — returns published articles (title, slug, excerpt, date)."""
    articles = (
        db.query(Article)
        .filter(Article.status == "published")
        .order_by(Article.published_at.desc())
        .limit(limit)
        .offset(offset)
        .all()
    )
    return [
        {
            "title": a.title,
            "slug": a.slug,
            "excerpt": a.excerpt,
            "published_at": a.published_at.isoformat() if a.published_at else None,
            "seo_title": a.seo_title,
            "seo_description": a.seo_description,
        }
        for a in articles
    ]


@router.get("/blog/{slug}", response_model=dict[str, Any])
def public_blog_post(slug: str, db: Session = Depends(get_db)) -> dict:
    """Public blog post — returns full content for a published article by slug."""
    article = (
        db.query(Article)
        .filter(Article.slug == slug, Article.status == "published")
        .first()
    )
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Article not found")
    return {
        "title": article.title,
        "slug": article.slug,
        "excerpt": article.excerpt,
        "content_markdown": article.content_markdown,
        "published_at": article.published_at.isoformat() if article.published_at else None,
        "seo_title": article.seo_title,
        "seo_description": article.seo_description,
    }
