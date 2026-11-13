import { describe, expect, test } from 'vitest'
import * as Value from 'typebox/value'
import {
    findPlayerForUserId,
    Game,
    GameStatus,
    GameStorage,
    GameWithoutState,
    omitGameState,
    ownerMayDeleteGame
} from './game.js'
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

describe('ownerMayDeleteGame', () => {
    test.each([GameStatus.WaitingForPlayers, GameStatus.WaitingToStart, GameStatus.Started])(
        'allows deleting a Hosted Game that is %s',
        (status) => {
            expect(ownerMayDeleteGame({ status, storage: GameStorage.Remote })).toBe(true)
        }
    )

    test('keeps a Finished Hosted Game', () => {
        expect(ownerMayDeleteGame({ status: GameStatus.Finished })).toBe(false)
        expect(
            ownerMayDeleteGame({ status: GameStatus.Finished, storage: GameStorage.Remote })
        ).toBe(false)
    })

    test('keeps a Hosted Game that an Undo reopened after it was Finished', () => {
        expect(ownerMayDeleteGame({ status: GameStatus.Started, everFinished: true })).toBe(false)
    })

    test('allows deleting a Finished or reopened Local Game', () => {
        expect(
            ownerMayDeleteGame({ status: GameStatus.Finished, storage: GameStorage.Local })
        ).toBe(true)
        expect(
            ownerMayDeleteGame({
                status: GameStatus.Started,
                storage: GameStorage.Local,
                everFinished: true
            })
        ).toBe(true)
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

describe('turn start times', () => {
    test('come back as Dates when a Game is read from JSON', () => {
        const startedAt = new Date('2026-11-12T12:00:00Z')
        const game = { ...Value.Create(Game), turnStartedAt: { a: startedAt } }

        const read = Value.Convert(Game, JSON.parse(JSON.stringify(game)))

        if (!Value.Check(Game, read)) throw new Error('The JSON did not read back as a Game')
        expect(read.turnStartedAt).toEqual({ a: startedAt })
    })
})
