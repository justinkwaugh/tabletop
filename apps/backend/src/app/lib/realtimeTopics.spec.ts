import { Role } from '@tabletop/common'
import { describe, expect, it, vi } from 'vitest'
import { realtimeTopicsFor } from './realtimeTopics.js'

vi.mock('@tabletop/backend-services', () => ({
    GLOBAL_TOPIC: 'global',
    RELAY_STATS_TOPIC: 'relay-stats',
    userTopic: (userId: string) => `user-${userId}`,
    gameTopic: (gameId: string) => `game-${gameId}`
}))

const user = { id: 'u1', roles: [Role.User] }
const admin = { id: 'a1', roles: [Role.User, Role.Admin] }

describe('realtimeTopicsFor', () => {
    it('grants only the caller user topic and the global topic by default', () => {
        expect(realtimeTopicsFor({ user })).toEqual(['user-u1', 'global'])
    })

    it('adds one game topic per distinct requested game', () => {
        expect(realtimeTopicsFor({ user, gameIds: ['g1', 'g2', 'g1'] })).toEqual([
            'user-u1',
            'global',
            'game-g1',
            'game-g2'
        ])
    })

    it('grants relay stats only to an admin who asks for it', () => {
        expect(realtimeTopicsFor({ user, relayStats: true })).toEqual(['user-u1', 'global'])
        expect(realtimeTopicsFor({ user: admin, relayStats: true })).toEqual([
            'user-a1',
            'global',
            'relay-stats'
        ])
        expect(realtimeTopicsFor({ user: admin })).toEqual(['user-a1', 'global'])
    })
})
