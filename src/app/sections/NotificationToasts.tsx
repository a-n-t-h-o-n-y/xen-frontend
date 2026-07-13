import { Icon } from '../ui/Icon'
import type { AppNotification } from '../hooks/useNotifications'

type NotificationToastsProps = {
  notifications: AppNotification[]
  dismissNotification: (id: number) => void
}

export function NotificationToasts({
  notifications,
  dismissNotification,
}: NotificationToastsProps) {
  if (notifications.length === 0) return null

  return (
    <div className="notificationStack" aria-label="Notifications">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`notificationToast notificationToast-${notification.level}`}
          role={notification.level === 'error' ? 'alert' : 'status'}
        >
          <span className="notificationMessage">{notification.message}</span>
          <button
            type="button"
            className="notificationDismiss"
            onClick={() => dismissNotification(notification.id)}
            aria-label="Dismiss notification"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  )
}
