import { describe, expect, test } from 'vitest'
import * as Value from 'typebox/value'
import { findPlayerForUserId, Game, GameWithoutState, omitGameState } from './game.js'
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

describe('omitGameState', () => {
    test('removes storage-only properties from a Game representation', () => {
        const game = Value.Create(Game)
        Reflect.set(game, 'actionChunkSize', 200)

        const gameWithoutState = omitGameState(game)

        expect(gameWithoutState).not.toHaveProperty('actionChunkSize')
        expect(Value.Check(GameWithoutState, gameWithoutState)).toBe(true)
    })
})
