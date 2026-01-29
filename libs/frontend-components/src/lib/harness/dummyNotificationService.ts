import type { NotificationListener, NotificationService } from "$lib/services/notificationService.js";

export class DummyNotificationService implements NotificationService {
    listenToGame(_gameId: string) {}
    stopListeningToGame(_gameId: string) {}
    addListener(_listener: NotificationListener) {}
    removeListener(_listener: NotificationListener) {}

    // These should probably not be here
    onMounted(): void {}
    showPrompt(): void {}
    hidePrompt(): void {}
    shouldShowPrompt(): boolean { return false }
    hasWebNotificationPermission(): boolean { return false }
    canAskforWebNotificationPermission(): boolean { return false }
    async requestWebNotificationPermission(): Promise<boolean> { return false }
}
