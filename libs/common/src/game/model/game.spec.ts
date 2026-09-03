import { describe, expect, test } from 'vitest'
import { findPlayerForUserId, type Game } from './game.js'
import { PlayerStatus } from './player.js'

function createGame(): Pick<Game, 'players'> {
    return {
        players: [
            {
                id: 'player-one',
                isHuman: true,
                userId: 'user-one',
                name: 'One',
                status: PlayerStatus.Joined
            },
            {
                id: 'player-two',
                isHuman: true,
                userId: 'user-two',
                name: 'Two',
                status: PlayerStatus.Joined
            }
        ]
    }
}

describe('findPlayerForUserId', () => {
    test('finds the game player assigned to a user', () => {
        expect(findPlayerForUserId(createGame(), 'user-two')?.id).toBe('player-two')
    })

    test('returns undefined when the user is not a player', () => {
        expect(findPlayerForUserId(createGame(), 'spectator')).toBeUndefined()
    })
})
