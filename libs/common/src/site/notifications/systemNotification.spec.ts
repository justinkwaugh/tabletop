import { describe, expect, it } from 'vitest'
import { NotificationCategory, NotificationValidator } from './notification.js'
import { isRelayStatsNotification, SystemNotificationAction } from './systemNotification.js'

const relayStats = {
    id: 'relay-stats-1',
    type: NotificationCategory.System,
    action: SystemNotificationAction.RelayStats,
    data: { connections: 15, accounts: 13 }
}

describe('isRelayStatsNotification', () => {
    it('accepts the counts the relay sends', () => {
        expect(NotificationValidator.Check(relayStats)).toBe(true)
        expect(isRelayStatsNotification(relayStats)).toBe(true)
    })

    it('rejects other system notifications and malformed counts', () => {
        expect(isRelayStatsNotification({ ...relayStats, action: 'other' })).toBe(false)
        expect(isRelayStatsNotification({ ...relayStats, data: { connections: 15 } })).toBe(false)
        expect(
            isRelayStatsNotification({ ...relayStats, data: { connections: -1, accounts: 0 } })
        ).toBe(false)
    })
})
