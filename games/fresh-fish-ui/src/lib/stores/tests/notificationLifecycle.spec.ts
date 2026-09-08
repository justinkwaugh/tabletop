import { expect, test, vi } from 'vitest'
import { NotificationChannel, NotificationEventType } from '@tabletop/frontend-components'
import { createExplorationHost, explorationClient } from './exploration.fixture.js'

test('disposing a Game Session releases its notification subscription', async () => {
    const host = createExplorationHost()
    const client = explorationClient(host)
    const unsubscribe = vi.spyOn(client.app.notificationService, 'stopListeningToGame')
    const synchronize = vi.spyOn(client.app.api, 'checkSync')
    try {
        try {
            client.session.listenToGame()
        } finally {
            client.dispose()
        }
        expect(unsubscribe).toHaveBeenCalledExactlyOnceWith(host.game.id)
        await client.app.notificationService.emit({
            eventType: NotificationEventType.Discontinuity,
            channel: NotificationChannel.GameInstance
        })
        expect(synchronize).not.toHaveBeenCalled()
    } finally {
        vi.restoreAllMocks()
    }
})
