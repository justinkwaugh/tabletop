import { describe, expect, it, vi } from 'vitest'
import { NotificationCategory, SystemNotificationAction } from '@tabletop/common'
import {
    NotificationChannel,
    NotificationEventType,
    type NotificationEvent,
    type NotificationListener
} from '@tabletop/frontend-components'
import { listenForTopicRegistrationChanges } from './topicRegistrationUpdates'

const registrationsChanged = {
    id: 'notification',
    type: NotificationCategory.System,
    action: SystemNotificationAction.TopicRegistrationsChanged,
    data: {}
}

function listen() {
    let listener: NotificationListener | undefined
    const notifications = {
        addListener: (added: NotificationListener) => void (listener = added),
        removeListener: vi.fn()
    }
    const refresh = vi.fn(async () => {})
    listenForTopicRegistrationChanges(notifications, refresh)
    return { send: (event: NotificationEvent) => listener!(event), refresh }
}

describe('listenForTopicRegistrationChanges', () => {
    it("refreshes when the user's topic registrations change", async () => {
        const { send, refresh } = listen()
        await send({
            eventType: NotificationEventType.Data,
            channel: NotificationChannel.User,
            notification: registrationsChanged
        })
        expect(refresh).toHaveBeenCalledTimes(1)
    })

    it('refreshes after the user stream reconnects', async () => {
        const { send, refresh } = listen()
        await send({
            eventType: NotificationEventType.Discontinuity,
            channel: NotificationChannel.User
        })
        expect(refresh).toHaveBeenCalledTimes(1)
    })

    it('ignores other notifications and streams', async () => {
        const { send, refresh } = listen()
        await send({
            eventType: NotificationEventType.Data,
            channel: NotificationChannel.User,
            notification: { ...registrationsChanged, action: 'relayStats' }
        })
        await send({
            eventType: NotificationEventType.Discontinuity,
            channel: NotificationChannel.Global
        })
        expect(refresh).not.toHaveBeenCalled()
    })
})
