import type {
    NotificationEvent,
    NotificationListener,
    NotificationService
} from '@tabletop/frontend-components'

export function refreshOnNotifications(
    notifications: Pick<NotificationService, 'addListener' | 'removeListener'>,
    isRelevant: (event: NotificationEvent) => boolean,
    refresh: () => Promise<void>
): () => void {
    let disposed = false
    let refreshing = false
    let pending = false
    const listener: NotificationListener = async (event) => {
        if (!isRelevant(event)) return
        pending = true
        if (refreshing) return
        refreshing = true
        try {
            while (pending && !disposed) {
                pending = false
                await refresh()
            }
        } finally {
            refreshing = false
        }
    }
    notifications.addListener(listener)
    return () => {
        disposed = true
        notifications.removeListener(listener)
    }
}
