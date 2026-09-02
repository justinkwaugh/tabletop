import type {
    NotificationEvent,
    NotificationListener,
    NotificationService
} from '$lib/services/notificationService.js'

export class DummyNotificationService implements NotificationService {
    private readonly listeners = new Set<NotificationListener>()

    listenToGame(_gameId: string) {}
    stopListeningToGame(_gameId: string) {}
    addListener(listener: NotificationListener) {
        this.listeners.add(listener)
    }
    removeListener(listener: NotificationListener) {
        this.listeners.delete(listener)
    }

    async emit(event: NotificationEvent): Promise<void> {
        await Promise.all(Array.from(this.listeners, (listener) => listener(event)))
    }

    // These should probably not be here
    onMounted(): void {}
    showPrompt(): void {}
    hidePrompt(): void {}
    shouldShowPrompt(): boolean {
        return false
    }
    hasWebNotificationPermission(): boolean {
        return false
    }
    canAskforWebNotificationPermission(): boolean {
        return false
    }
    async requestWebNotificationPermission(): Promise<boolean> {
        return false
    }
}
