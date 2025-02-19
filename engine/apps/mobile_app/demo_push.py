import json
import random
import string

from fcm_django.models import FCMDevice
from firebase_admin.messaging import APNSPayload, Aps, ApsAlert, CriticalSound, Message

from apps.mobile_app.exceptions import DeviceNotSet
from apps.mobile_app.tasks import FCMMessageData, MessageType, _construct_fcm_message, _send_push_notification, logger
from apps.user_management.models import User

TEST_PUSH_TITLE = "Hi, this is a test notification from Grafana OnCall"


def send_test_push(user, critical=False):
    device_to_notify = FCMDevice.objects.filter(user=user).first()
    if device_to_notify is None:
        logger.info(f"send_test_push: fcm_device not found user_id={user.id}")
        raise DeviceNotSet
    message = _get_test_escalation_fcm_message(user, device_to_notify, critical)
    _send_push_notification(device_to_notify, message)


def _get_test_escalation_fcm_message(user: User, device_to_notify: FCMDevice, critical: bool) -> Message:
    # TODO: this method is copied from _get_alert_group_escalation_fcm_message
    # to have same notification/sound/overrideDND logic. Ideally this logic should be abstracted, not repeated.
    from apps.mobile_app.models import MobileAppUserSettings

    thread_id = f"{''.join(random.choices(string.digits, k=6))}:test_push"

    mobile_app_user_settings, _ = MobileAppUserSettings.objects.get_or_create(user=user)
    # critical defines the type of notification.
    # we use overrideDND to establish if the notification should sound even if DND is on
    overrideDND = critical and mobile_app_user_settings.important_notification_override_dnd

    # APNS only allows to specify volume for critical notifications
    apns_volume = mobile_app_user_settings.important_notification_volume if critical else None
    apns_sound_name = (
        mobile_app_user_settings.important_notification_sound_name
        if critical
        else mobile_app_user_settings.default_notification_sound_name
    ) + MobileAppUserSettings.IOS_SOUND_NAME_EXTENSION  # iOS app expects the filename to have an extension

    fcm_message_data: FCMMessageData = {
        "title": TEST_PUSH_TITLE,
        # Pass user settings, so the Android app can use them to play the correct sound and volume
        "default_notification_sound_name": (
            mobile_app_user_settings.default_notification_sound_name
            + MobileAppUserSettings.ANDROID_SOUND_NAME_EXTENSION
        ),
        "default_notification_volume_type": mobile_app_user_settings.default_notification_volume_type,
        "default_notification_volume": str(mobile_app_user_settings.default_notification_volume),
        "default_notification_volume_override": json.dumps(
            mobile_app_user_settings.default_notification_volume_override
        ),
        "important_notification_sound_name": (
            mobile_app_user_settings.important_notification_sound_name
            + MobileAppUserSettings.ANDROID_SOUND_NAME_EXTENSION
        ),
        "important_notification_volume_type": mobile_app_user_settings.important_notification_volume_type,
        "important_notification_volume": str(mobile_app_user_settings.important_notification_volume),
        "important_notification_volume_override": json.dumps(
            mobile_app_user_settings.important_notification_volume_override
        ),
        "important_notification_override_dnd": json.dumps(mobile_app_user_settings.important_notification_override_dnd),
    }

    apns_payload = APNSPayload(
        aps=Aps(
            thread_id=thread_id,
            alert=ApsAlert(title=TEST_PUSH_TITLE),
            sound=CriticalSound(
                # The notification shouldn't be critical if the user has disabled "override DND" setting
                critical=overrideDND,
                name=apns_sound_name,
                volume=apns_volume,
            ),
            custom_data={
                "interruption-level": "critical" if overrideDND else "time-sensitive",
            },
        ),
    )

    message_type = MessageType.CRITICAL if critical else MessageType.NORMAL

    return _construct_fcm_message(message_type, device_to_notify, thread_id, fcm_message_data, apns_payload)
