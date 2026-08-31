import { describe, expect, test } from 'vitest'
import { shouldInvalidateAdminActingPlayerChoice } from './adminActingPlayer.js'

describe('Admin Acting Player choice validity', () => {
    test('Exploration cannot invalidate the dormant choice', () => {
        expect(
            shouldInvalidateAdminActingPlayerChoice({
                isExploring: true,
                chosenPlayerId: 'bob',
                activePlayerIds: ['alice']
            })
        ).toBe(false)
    })

    test('primary play invalidates a choice when the Player becomes inactive', () => {
        expect(
            shouldInvalidateAdminActingPlayerChoice({
                isExploring: false,
                chosenPlayerId: 'bob',
                activePlayerIds: ['alice']
            })
        ).toBe(true)
    })
})
