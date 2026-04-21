from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session

from app.analyzer import analyze_response
from app.database import SessionLocal
from app.models import Article, Brand, Citation, Mention, Prompt, PromptRun, ScoreSnapshot
from app.providers import get_provider, list_enabled_providers
from app.scoring import compute_scores
from app.worker import celery_app

log = logging.getLogger(__name__)




@celery_app.task(name="reputation.run_prompt", bind=True, max_retries=2, default_retry_delay=30)
def run_prompt(self, prompt_run_id: str) -> dict:
    db: Session = SessionLocal()
    try:
        run = db.get(PromptRun, UUID(prompt_run_id))
        if run is None:
            return {"error": f"PromptRun {prompt_run_id} not found"}

        prompt: Prompt = run.prompt
        brand = prompt.brand
        competitors = [
            {"name": c.name, "aliases": c.aliases or []} for c in brand.competitors
        ]

        try:
            run.status = "running"
            db.add(run)
            db.commit()

            # Check if web search is allowed (Pro+ plans only)
            use_web_search = False
            if prompt.use_web_search:
                from app.plan_limits import effective_plan, get_limits
                org_plan = effective_plan(brand.organization.plan, brand.organization.trial_ends_at)
                limits = get_limits(brand.organization.plan, brand.organization.trial_ends_at)
                # Only Pro and Agency plans can use web search
                if org_plan in ("pro", "agency", "trial"):
                    use_web_search = True

            provider = get_provider(run.provider)
            llm_response = provider.generate(
                prompt=prompt.text,
                model=run.model,
                max_tokens=1024,
                temperature=0.7,
                use_web_search=use_web_search,
            )

            run.raw_response = llm_response.text
            run.latency_ms = llm_response.latency_ms
            run.input_tokens = llm_response.input_tokens
            run.output_tokens = llm_response.output_tokens
            run.executed_at = datetime.now(timezone.utc)

            analysis = analyze_response(
                response_text=llm_response.text,
                user_prompt=prompt.text,
                brand_name=brand.name,
                brand_aliases=brand.aliases or [],
                competitors=competitors,
            )

            # ── Sanity-check: the analyzer LLM can hallucinate a target-brand presence
            # by inferring category membership instead of requiring a verbatim name match.
            # Deterministic guard: if neither the brand name nor any alias actually appears
            # in the raw response text, forcibly clear all target-brand flags.
            brand_terms = [brand.name.lower()] + [
                a.lower() for a in (brand.aliases or [])
            ]
            response_lower = llm_response.text.lower()
            brand_in_response = any(term in response_lower for term in brand_terms)

            if not brand_in_response:
                if analysis.get("target_brand_present"):
                    log.warning(
                        "False-positive target_brand_present corrected for '%s' — "
                        "name not found verbatim in response",
                        brand.name,
                    )
                    analysis["target_brand_present"] = False
                    if isinstance(analysis.get("sentiment"), dict):
                        analysis["sentiment"]["target_brand"] = "absent"
                for m in analysis.get("mentions", []):
                    if m.get("is_target_brand"):
                        log.warning(
                            "False-positive is_target_brand corrected: mention '%s' for brand '%s'",
                            m.get("entity_name"), brand.name,
                        )
                        m["is_target_brand"] = False

            run.analysis = analysis

            for m in analysis.get("mentions", []):
                db.add(
                    Mention(
                        prompt_run_id=run.id,
                        entity_name=m.get("entity_name", "")[:255],
                        is_target_brand=bool(m.get("is_target_brand", False)),
                        is_known_competitor=bool(m.get("is_known_competitor", False)),
                        rank_position=m.get("rank_position"),
                        sentiment=(m.get("sentiment") or None),
                        mention_type=(m.get("mention_type") or None),
                        context_excerpt=m.get("context_excerpt"),
                    )
                )

            for c in analysis.get("citations", []):
                db.add(
                    Citation(
                        prompt_run_id=run.id,
                        url=c.get("url"),
                        domain=c.get("domain"),
                        title=c.get("title"),
                        citation_type=c.get("citation_type"),
                        refers_to_target=bool(c.get("refers_to_target", False)),
                    )
                )

            run.status = "done"
            db.commit()
            return {"run_id": str(run.id), "status": "done"}

        except Exception as exc:  # noqa: BLE001
            log.exception("Prompt run failed")
            run.status = "failed"
            run.error = f"{type(exc).__name__}: {exc}"[:4000]
            db.commit()
            raise self.retry(exc=exc)
    finally:
        db.close()


# ── Helpers ───────────────────────────────────────────────────────────────────


def _save_score_snapshot(brand_id: "UUID", db: Session, days: int = 1) -> None:
    """Compute scores for the past `days` days and persist a ScoreSnapshot row.

    Called at the end of every scheduled brand run so the trend charts
    accumulate historical data over time.
    """
    period_end = datetime.now(timezone.utc)
    period_start = period_end - timedelta(days=days)

    runs = (
        db.query(PromptRun)
        .filter(
            PromptRun.brand_id == brand_id,
            PromptRun.status == "done",
            PromptRun.executed_at >= period_start,
        )
        .all()
    )

    if not runs:
        return

    scores = compute_scores(runs)
    snap = ScoreSnapshot(
        brand_id=brand_id,
        period_start=period_start,
        period_end=period_end,
        visibility_score=scores.visibility_score,
        share_of_voice=scores.share_of_voice,
        sentiment_score=scores.sentiment_score,
        citation_score=scores.citation_score,
        runs_count=scores.runs_count,
    )
    db.add(snap)
    db.commit()
    log.info("Score snapshot saved for brand %s: vis=%.1f%%", brand_id, scores.visibility_score)


def _severity(kind: str) -> str:
    return {"negative": "high", "absent": "medium", "failed": "medium", "new_citation": "low"}.get(kind, "low")


def _generate_alerts_for_brand(brand: Brand, db: Session, days: int = 1) -> list[dict]:
    """Pure-Python alert generation — mirrors the logic in routers/alerts.py
    but without FastAPI dependencies so Celery tasks can call it directly."""
    since = datetime.now(timezone.utc) - timedelta(days=days)

    runs: list[PromptRun] = (
        db.query(PromptRun)
        .filter(PromptRun.brand_id == brand.id, PromptRun.created_at >= since)
        .order_by(PromptRun.created_at.desc())
        .all()
    )

    prompts_by_id: dict = {p.id: p for p in brand.prompts}
    alerts: list[dict] = []

    # Collect citation domains seen before the window (for new_citation detection)
    old_domains: set[str] = set()
    for r in (
        db.query(PromptRun)
        .filter(
            PromptRun.brand_id == brand.id,
            PromptRun.created_at < since,
            PromptRun.status == "done",
        )
        .all()
    ):
        for c in (r.citations or []):
            if c.domain:
                old_domains.add(c.domain)

    seen_new_domains: set[str] = set()

    for run in runs:
        prompt = prompts_by_id.get(run.prompt_id)
        prompt_text = prompt.text if prompt else "(prompt supprimé)"

        if run.status == "failed":
            alerts.append({
                "id": f"failed-{run.id}",
                "kind": "failed",
                "severity": _severity("failed"),
                "title": f"Run en erreur sur [{run.provider}]",
                "description": f"Prompt : « {prompt_text[:80]} »\nErreur : {run.error or 'inconnue'}",
                "brand_id": str(brand.id),
                "created_at": run.created_at.isoformat(),
            })
            continue

        if run.status != "done":
            continue

        has_target = any(m.is_target_brand for m in (run.mentions or []))
        importance = prompt.importance if prompt else 1
        if not has_target and importance >= 1:
            alerts.append({
                "id": f"absent-{run.id}",
                "kind": "absent",
                "severity": _severity("absent"),
                "title": f"Marque absente sur [{run.provider}]",
                "description": f"Prompt : « {prompt_text[:100]} »\nAucune mention de {brand.name}.",
                "brand_id": str(brand.id),
                "created_at": run.created_at.isoformat(),
            })

        for mention in (run.mentions or []):
            if mention.is_target_brand and mention.sentiment in ("negative", "cautious"):
                alerts.append({
                    "id": f"neg-{run.id}-{mention.entity_name}",
                    "kind": "negative",
                    "severity": _severity("negative"),
                    "title": f"Sentiment {mention.sentiment} détecté sur [{run.provider}]",
                    "description": (
                        f"Prompt : « {prompt_text[:80]} »\n"
                        f"Extrait : « {(mention.context_excerpt or '')[:120]} »"
                    ),
                    "brand_id": str(brand.id),
                    "created_at": run.created_at.isoformat(),
                })
                break

        for citation in (run.citations or []):
            domain = citation.domain
            if domain and domain not in old_domains and domain not in seen_new_domains:
                seen_new_domains.add(domain)
                alerts.append({
                    "id": f"newcite-{run.id}-{domain}",
                    "kind": "new_citation",
                    "severity": _severity("new_citation"),
                    "title": f"Nouvelle source citée : {domain}",
                    "description": (
                        f"[{run.provider}] cite {domain} "
                        f"{'(pour votre marque)' if citation.refers_to_target else ''} "
                        f"sur le prompt : « {prompt_text[:70]} »"
                    ),
                    "brand_id": str(brand.id),
                    "created_at": run.created_at.isoformat(),
                })

    order = {"high": 0, "medium": 1, "low": 2}
    alerts.sort(key=lambda a: order.get(a["severity"], 9))
    return alerts


# ── Scheduled tasks (Celery Beat) ─────────────────────────────────────────────


@celery_app.task(name="reputation.run_scheduled_brands")
def run_scheduled_brands() -> dict:
    """Triggered daily at 07:00 UTC by Celery Beat.

    Scans every brand whose run_schedule is 'weekly' or 'monthly'. If the
    brand has not had a run since the required interval, creates PromptRun
    rows for all enabled prompts × all enabled providers and enqueues them.
    """
    db: Session = SessionLocal()
    try:
        brands: list[Brand] = (
            db.query(Brand)
            .filter(Brand.run_schedule.in_(["weekly", "monthly"]))
            .all()
        )

        total_runs = 0
        for brand in brands:
            interval_days = 7 if brand.run_schedule == "weekly" else 30
            cutoff = datetime.now(timezone.utc) - timedelta(days=interval_days)

            last_run: PromptRun | None = (
                db.query(PromptRun)
                .filter(PromptRun.brand_id == brand.id)
                .order_by(PromptRun.created_at.desc())
                .first()
            )

            if last_run and last_run.created_at >= cutoff:
                log.debug(
                    "Brand '%s' already ran within %d days — skipping",
                    brand.name, interval_days,
                )
                continue

            prompts: list[Prompt] = (
                db.query(Prompt)
                .filter(Prompt.brand_id == brand.id, Prompt.enabled == True)  # noqa: E712
                .all()
            )
            if not prompts:
                log.info("Brand '%s' has no enabled prompts — skipping", brand.name)
                continue

            provider_specs = [(p.name, p.default_model) for p in list_enabled_providers()]
            if not provider_specs:
                log.warning("No providers enabled — cannot schedule runs")
                break

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
                run_prompt.delay(str(r.id))

            total_runs += len(created)
            log.info(
                "Scheduled run triggered for brand '%s' (%s): %d tasks enqueued",
                brand.name, brand.run_schedule, len(created),
            )
            # Snapshot the previous period before new runs overwrite the window
            _save_score_snapshot(brand.id, db, days=interval_days)

        return {"brands_checked": len(brands), "runs_triggered": total_runs}
    finally:
        db.close()


@celery_app.task(name="reputation.send_daily_alert_emails")
def send_daily_alert_emails() -> dict:
    """Triggered daily at 08:00 UTC by Celery Beat (after scheduled runs start).

    For every brand that has an alert_email configured, generates alerts for
    the past 24 hours and sends a digest email if any are found.
    """
    from app.config import get_settings
    from app.email import send_alert_email

    settings = get_settings()
    dashboard_url: str = settings.web_origin

    db: Session = SessionLocal()
    try:
        brands: list[Brand] = (
            db.query(Brand)
            .filter(Brand.alert_email.isnot(None), Brand.alert_email != "")
            .all()
        )

        emails_sent = 0
        for brand in brands:
            try:
                alerts = _generate_alerts_for_brand(brand, db, days=1)
                if not alerts:
                    log.debug("No alerts for brand '%s' — skipping email", brand.name)
                    continue

                ok = send_alert_email(
                    to=brand.alert_email,
                    brand_name=brand.name,
                    alerts=alerts,
                    dashboard_url=dashboard_url,
                    brand_id=str(brand.id),
                )
                if ok:
                    emails_sent += 1
                    log.info(
                        "Alert email sent for brand '%s' → %s (%d alerts)",
                        brand.name, brand.alert_email, len(alerts),
                    )
            except Exception:
                log.exception("Failed to send alert email for brand '%s'", brand.name)

        return {"brands_checked": len(brands), "emails_sent": emails_sent}
    finally:
        db.close()


# ── Editorial pipeline tasks ───────────────────────────────────────────────────


@celery_app.task(name="reputation.run_article_pipeline", bind=True, max_retries=1, default_retry_delay=60)
def run_article_pipeline(self, article_id: str) -> dict:
    """Run the full 4-agent editorial pipeline for a single article.

    Flow: brief → draft → review → auto-approve if quality ≥ 70 → linkedin variants
    """
    from app.editorial.agents import (
        run_brief_agent,
        run_draft_agent,
        run_linkedin_agent,
        run_review_agent,
    )

    db: Session = SessionLocal()
    try:
        from uuid import UUID as _UUID
        article: Article | None = db.get(Article, _UUID(article_id))
        if article is None:
            return {"error": f"Article {article_id} not found"}

        brand = db.get(Brand, article.brand_id) if article.brand_id else None
        org = article.organization

        # Extract topic_hint stored by the router, if any
        topic_hint: str | None = None
        if article.brief and isinstance(article.brief, dict):
            topic_hint = article.brief.get("topic_hint")

        try:
            # ── Agent 1: Brief ────────────────────────────────────────────────
            article.status = "drafting"
            db.commit()

            brief = run_brief_agent(brand=brand, organization=org, topic_hint=topic_hint)
            article.brief = brief
            db.commit()

            # ── Agent 2: Draft ────────────────────────────────────────────────
            draft = run_draft_agent(brief=brief, brand=brand)

            # Ensure slug uniqueness by appending short UUID suffix if taken
            slug: str = draft.get("slug", "")
            existing = db.query(Article).filter(Article.slug == slug, Article.id != article.id).first()
            if existing:
                slug = f"{slug}-{str(article.id)[:8]}"

            article.title = draft.get("title")
            article.slug = slug
            article.excerpt = draft.get("excerpt")
            article.content_markdown = draft.get("content_markdown")
            article.seo_title = draft.get("seo_title")
            article.seo_description = draft.get("seo_description")
            article.status = "draft"
            db.commit()

            # ── Agent 3: Review ───────────────────────────────────────────────
            review = run_review_agent(draft=draft, brief=brief)
            article.review = review

            quality: int = review.get("quality_score", 0)
            needs_human: bool = review.get("needs_human_review", True)

            if not needs_human and quality >= 70:
                article.status = "approved"
            else:
                article.status = "review"

            db.commit()

            # ── Agent 4: LinkedIn variants (always runs) ───────────────────────
            from app.config import get_settings as _gs
            settings = _gs()
            blog_url = f"{settings.web_origin}/blog/{slug}" if slug else None

            linkedin = run_linkedin_agent(draft=draft, brief=brief, blog_url=blog_url)
            article.linkedin_variants = linkedin
            db.commit()

            log.info(
                "Article pipeline done: id=%s status=%s quality=%s",
                article_id, article.status, quality,
            )
            return {"article_id": article_id, "status": article.status, "quality_score": quality}

        except Exception as exc:  # noqa: BLE001
            log.exception("Article pipeline failed for %s", article_id)
            try:
                article.status = "failed"
                article.error = f"{type(exc).__name__}: {exc}"[:4000]
                db.commit()
            except Exception:
                pass
            raise self.retry(exc=exc)
    finally:
        db.close()


@celery_app.task(name="reputation.publish_article_task")
def publish_article_task(article_id: str) -> dict:
    """Publish an approved article to LinkedIn."""
    from app.editorial.linkedin import LinkedInPublisher
    from uuid import UUID as _UUID

    db: Session = SessionLocal()
    try:
        article: Article | None = db.get(Article, _UUID(article_id))
        if article is None:
            return {"error": f"Article {article_id} not found"}
        if article.status != "approved":
            return {"error": f"Article must be approved (current: {article.status})"}
        if not article.linkedin_variants:
            return {"error": "No LinkedIn variants available"}

        post_text: str = article.linkedin_variants.get("post", "")
        publisher = LinkedInPublisher()
        result = publisher.publish(post_text, article_id=article_id)

        if result.get("success"):
            article.linkedin_post_url = result.get("url")
            article.status = "published"
            article.published_at = datetime.now(timezone.utc)
            log.info("Article %s published, url=%s mock=%s", article_id, result.get("url"), result.get("mock"))
        else:
            article.status = "failed"
            article.error = result.get("error", "LinkedIn publish failed")
            log.error("Article %s publish failed: %s", article_id, article.error)

        db.commit()
        return {"article_id": article_id, "status": article.status, "mock": result.get("mock", False)}
    finally:
        db.close()


@celery_app.task(name="reputation.generate_weekly_articles")
def generate_weekly_articles() -> dict:
    """Triggered weekly on Monday at 09:00 UTC by Celery Beat.

    Picks up to 3 brands (round-robin by oldest article) and creates one
    article pipeline per brand. Skips brands with no description or category.
    """
    db: Session = SessionLocal()
    try:
        # Select brands with meaningful context — prefer brands not recently processed
        subquery = (
            db.query(Article.brand_id)
            .filter(Article.brand_id.isnot(None))
            .order_by(Article.created_at.desc())
            .limit(3)
            .subquery()
        )

        brands: list[Brand] = (
            db.query(Brand)
            .filter(Brand.id.notin_(subquery))
            .filter(Brand.category.isnot(None))
            .limit(3)
            .all()
        )

        # Fallback: just take any 3 brands if the filter returns none
        if not brands:
            brands = db.query(Brand).limit(3).all()

        if not brands:
            log.info("No brands found — skipping weekly editorial generation")
            return {"brands_processed": 0, "articles_created": 0}

        created = 0
        for brand in brands:
            article = Article(
                organization_id=brand.organization_id,
                brand_id=brand.id,
                status="idea",
            )
            db.add(article)
            db.commit()
            db.refresh(article)
            run_article_pipeline.delay(str(article.id))
            created += 1
            log.info("Weekly article queued for brand '%s' → article %s", brand.name, article.id)

        return {"brands_processed": len(brands), "articles_created": created}
    finally:
        db.close()
