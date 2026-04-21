"""LinkedIn publisher abstraction.

When LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN are configured and
LINKEDIN_ENABLED is true, posts are sent to the real LinkedIn UGC Posts API.

Otherwise, runs in mock/draft-only mode and returns a simulated success so
the pipeline can complete without real credentials.
"""
from __future__ import annotations

import logging
from typing import Any

log = logging.getLogger(__name__)


class LinkedInPublisher:
    """Publish text posts to LinkedIn via the UGC Posts API (v2)."""

    def __init__(self) -> None:
        from app.config import get_settings
        s = get_settings()
        self._token: str = s.linkedin_access_token
        self._urn: str = s.linkedin_person_urn
        self._enabled: bool = s.linkedin_enabled and bool(self._token) and bool(self._urn)

    @property
    def is_mock(self) -> bool:
        return not self._enabled

    def publish(self, post_text: str, *, article_id: str) -> dict[str, Any]:
        """Post text to LinkedIn.

        Returns:
            {"success": True, "url": str, "mock": bool}  on success
            {"success": False, "error": str, "mock": bool}  on failure
        """
        if self.is_mock:
            log.info(
                "[LinkedIn MOCK] Would post article %s — credentials not set. "
                "Set LINKEDIN_ACCESS_TOKEN, LINKEDIN_PERSON_URN, LINKEDIN_ENABLED=true to go live.",
                article_id,
            )
            return {
                "success": True,
                "url": f"https://www.linkedin.com/feed/ (mock — article {article_id})",
                "mock": True,
            }

        try:
            import urllib.request, json as _json, urllib.error

            payload = {
                "author": self._urn,
                "lifecycleState": "PUBLISHED",
                "specificContent": {
                    "com.linkedin.ugc.ShareContent": {
                        "shareCommentary": {"text": post_text},
                        "shareMediaCategory": "NONE",
                    }
                },
                "visibility": {
                    "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"
                },
            }
            data = _json.dumps(payload).encode()
            req = urllib.request.Request(
                "https://api.linkedin.com/v2/ugcPosts",
                data=data,
                headers={
                    "Authorization": f"Bearer {self._token}",
                    "Content-Type": "application/json",
                    "X-Restli-Protocol-Version": "2.0.0",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = _json.loads(resp.read())
                post_id = body.get("id", "")
                url = f"https://www.linkedin.com/feed/update/{post_id}/"
                log.info("LinkedIn post published: %s", url)
                return {"success": True, "url": url, "mock": False}

        except Exception as exc:  # noqa: BLE001
            log.exception("LinkedIn publish failed for article %s", article_id)
            return {"success": False, "error": f"{type(exc).__name__}: {exc}", "mock": False}
