from django.apps import apps
from django.conf import settings

from common.custom_celery_tasks import shared_dedicated_queue_retry_task


@shared_dedicated_queue_retry_task(
    autoretry_for=(Exception,), retry_backoff=True, max_retries=1 if settings.DEBUG else None
)
def resolve_alert_group_by_source_if_needed(alert_group_pk):
    """
    The purpose of this task is to avoid computation-heavy check after each alert.
    Should be delayed and invoked only for the last one.
    """
    AlertGroupForAlertManager = apps.get_model("alerts", "AlertGroupForAlertManager")
    AlertForAlertManager = apps.get_model("alerts", "AlertForAlertManager")

    alert_group = AlertGroupForAlertManager.all_objects.get(pk=alert_group_pk)

    if not resolve_alert_group_by_source_if_needed.request.id == alert_group.active_resolve_calculation_id:
        return "Resolve calculation celery ID mismatch. Duplication or non-active. Active: {}".format(
            alert_group.active_resolve_calculation_id
        )
    else:
        if alert_group.resolved_by == alert_group.NOT_YET_STOP_AUTORESOLVE:
            return "alert_group is too big to auto-resolve"
        if alert_group.alerts.count() > AlertGroupForAlertManager.MAX_ALERTS_IN_GROUP_FOR_AUTO_RESOLVE:
            alert_group.resolved_by = alert_group.NOT_YET_STOP_AUTORESOLVE
            alert_group.save(update_fields=["resolved_by"])
        last_alert = AlertForAlertManager.objects.get(pk=alert_group.alerts.last().pk)
        if alert_group.is_alert_a_resolve_signal(last_alert):
            alert_group.resolve_by_source()
            return f"resolved alert_group {alert_group.pk}"
