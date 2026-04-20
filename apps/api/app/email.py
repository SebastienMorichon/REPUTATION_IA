"""
Email utility for AI Reputation Shield.

Uses stdlib smtplib — no extra dependency needed.
If SMTP is not configured, all calls are silent no-ops (just log).
Configure via .env:
  SMTP_HOST=smtp.gmail.com
  SMTP_PORT=587
  SMTP_USER=you@gmail.com
  SMTP_PASSWORD=app-password
  SMTP_FROM=noreply@yourapp.com
"""
from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

log = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    from app.config import get_settings
    s = get_settings()
    return bool(s.smtp_host and s.smtp_user and s.smtp_password)


def send_email(*, to: str, subject: str, html: str, text: str = "") -> bool:
    """Send an email. Returns True on success. Silent no-op if SMTP not configured."""
    if not _smtp_configured():
        log.info("SMTP not configured — skipping email to %s (%s)", to, subject)
        return False

    from app.config import get_settings
    s = get_settings()

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = s.smtp_from
    msg["To"] = to
    if text:
        msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    try:
        with smtplib.SMTP(s.smtp_host, s.smtp_port, timeout=10) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(s.smtp_user, s.smtp_password)
            smtp.sendmail(s.smtp_from, to, msg.as_string())
        log.info("Email sent → %s : %s", to, subject)
        return True
    except Exception as exc:
        log.error("Email failed → %s : %s", to, exc)
        return False


# ── Alert email ───────────────────────────────────────────────────────────────

_SEVERITY_COLOR = {"high": "#D94040", "medium": "#C97B18", "low": "#7A7972"}
_SEVERITY_LABEL = {"high": "🔴 Urgent", "medium": "🟡 Important", "low": "ℹ️ Info"}


def send_alert_email(
    *,
    to: str,
    brand_name: str,
    alerts: list[dict],
    dashboard_url: str = "http://localhost:3000",
    brand_id: str = "",
) -> bool:
    if not alerts:
        return False

    high_count = sum(1 for a in alerts if a.get("severity") == "high")
    detail_url = f"{dashboard_url}/dashboard/brands/{brand_id}" if brand_id else f"{dashboard_url}/dashboard"

    rows_html = ""
    for alert in alerts[:12]:
        color = _SEVERITY_COLOR.get(alert.get("severity", "low"), "#7A7972")
        label = _SEVERITY_LABEL.get(alert.get("severity", "low"), "")
        desc = (alert.get("description") or "").replace("\n", "<br>")[:250]
        rows_html += f"""
        <tr>
          <td style="padding:14px 20px;border-bottom:1px solid #EDEAE3;">
            <div style="font-size:11px;font-weight:700;color:{color};text-transform:uppercase;
                        letter-spacing:.05em;margin-bottom:5px;">{label}</div>
            <div style="font-size:14px;font-weight:600;color:#1C1C1A;margin-bottom:4px;">
              {alert.get('title','')}
            </div>
            <div style="font-size:13px;color:#7A7972;line-height:1.5;">{desc}</div>
          </td>
        </tr>"""

    urgent_banner = ""
    if high_count:
        urgent_banner = (
            f'<div style="font-size:13px;color:#F87171;margin-top:6px;">'
            f'{high_count} alerte{"s" if high_count > 1 else ""} urgente{"s" if high_count > 1 else ""} — action recommandée</div>'
        )

    html = f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:32px 16px;background:#EDEAE3;
             font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:16px;
              overflow:hidden;box-shadow:0 2px 20px rgba(0,0,0,.08);">

    <!-- Header -->
    <div style="background:#1C1C1A;padding:28px 32px;">
      <div style="color:#C5F236;font-size:11px;font-weight:700;text-transform:uppercase;
                  letter-spacing:.12em;margin-bottom:10px;">AI Reputation Shield</div>
      <div style="color:#fff;font-size:22px;font-weight:700;line-height:1.3;">
        {len(alerts)} alerte{"s" if len(alerts)>1 else ""} pour<br>{brand_name}
      </div>
      {urgent_banner}
    </div>

    <!-- Body -->
    <div style="padding:28px 32px 8px;">
      <p style="color:#7A7972;font-size:14px;margin:0 0 20px;line-height:1.6;">
        Voici les alertes détectées pour <strong style="color:#1C1C1A;">{brand_name}</strong>
        lors de la dernière analyse automatique.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0"
             style="border:1px solid #EDEAE3;border-radius:10px;border-collapse:collapse;overflow:hidden;">
        {rows_html}
      </table>
    </div>

    <!-- CTA -->
    <div style="padding:24px 32px 32px;text-align:center;">
      <a href="{detail_url}"
         style="display:inline-block;background:#1C1C1A;color:#C5F236;font-weight:700;
                font-size:14px;padding:13px 32px;border-radius:8px;text-decoration:none;
                letter-spacing:.02em;">
        Voir le tableau de bord →
      </a>
    </div>

    <!-- Footer -->
    <div style="padding:16px 32px;background:#f8f7f4;border-top:1px solid #EDEAE3;">
      <p style="color:#7A7972;font-size:12px;margin:0;text-align:center;line-height:1.6;">
        AI Reputation Shield · Vous recevez cet email car vous avez activé les alertes
        pour la marque <strong>{brand_name}</strong>.
      </p>
    </div>
  </div>
</body>
</html>"""

    text_lines = [f"AI Reputation Shield — {len(alerts)} alerte(s) pour {brand_name}\n"]
    for a in alerts[:12]:
        text_lines.append(
            f"[{a.get('severity','').upper()}] {a.get('title','')}\n"
            f"{(a.get('description') or '')[:200]}\n"
        )
    text_lines.append(f"\nVoir le tableau de bord : {detail_url}")

    return send_email(
        to=to,
        subject=f"[AI Shield] {len(alerts)} alerte{'s' if len(alerts)>1 else ''} pour {brand_name}",
        html=html,
        text="\n".join(text_lines),
    )
