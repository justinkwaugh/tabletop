import {
    GameStatus,
    PlayerStatus,
    UserStatus,
    type Game,
    type Player,
    type User
} from '@tabletop/common'
import { describe, expect, test } from 'vitest'
import { continuationGame } from './gameContinuation.svelte.js'

const dana: User = {
    id: 'dana-user',
    status: UserStatus.Active,
    username: 'Dana',
    roles: [],
    externalIds: []
}

const danaSeat: Player = {
    id: 'dana-new-seat',
    userId: dana.id,
    isHuman: true,
    name: 'Dana',
    status: PlayerStatus.Joined
}

function finishedGame(overrides: Partial<Game> = {}): Game {
    return {
        id: 'finished-game',
        typeId: 'some-title',
        status: GameStatus.Finished,
        isPublic: true,
        deleted: false,
        ownerId: 'rhys-user',
        name: 'Friday game',
        players: [
            {
                id: 'p1',
                userId: 'rhys-user',
                isHuman: true,
                name: 'Rhys',
                status: PlayerStatus.Joined
            },
            { id: 'p2', userId: dana.id, isHuman: true, name: 'Dana', status: PlayerStatus.Joined },
            { id: 'p3', isHuman: true, name: '', status: PlayerStatus.Open }
        ],
        config: { variant: 'advanced', rounds: 3, expansions: true },
        hotseat: false,
        createdAt: new Date(0),
        winningPlayerIds: ['p1'],
        canContinue: true,
        ...overrides
    }
}

function heldInState(game: Game): Game {
    const history = $state<Game[]>([game])
    return history[0]
}

describe('continuationGame', () => {
    test('continues a finished game the History list holds in $state', () => {
        const source = heldInState(finishedGame({ unlisted: true, paceMinutes: 60 }))
        expect(() => structuredClone(source.config)).toThrow(/could not be cloned/)

        const continued = continuationGame(source, dana, () => danaSeat)

        expect(continued).toEqual({
            id: expect.any(String),
            typeId: 'some-title',
            name: 'Friday game',
            players: [
                {
                    id: expect.any(String),
                    userId: 'rhys-user',
                    isHuman: true,
                    name: 'Rhys',
                    status: PlayerStatus.Reserved
                },
                danaSeat,
                { id: expect.any(String), isHuman: true, name: '', status: PlayerStatus.Open }
            ],
            isPublic: true,
            unlisted: true,
            paceMinutes: 60,
            hotseat: false,
            ownerId: dana.id,
            config: { variant: 'advanced', rounds: 3, expansions: true }
        })
    })

    test.each([
        { held: 'in $state', source: () => heldInState(finishedGame()) },
        { held: 'as a plain object', source: () => finishedGame() }
    ])('changing the continued config leaves a source game held $held unchanged', ({ source }) => {
        const game = source()

        const continued = continuationGame(game, dana, () => danaSeat)
        continued.config.rounds = 5

        expect(continued.config).toEqual({ variant: 'advanced', rounds: 5, expansions: true })
        expect(game.config.rounds).toBe(3)
    })

    test('continues a hotseat game held in $state, matching seats by name', () => {
        const source = heldInState(
            finishedGame({
                isPublic: false,
                hotseat: true,
                players: [
                    { id: 'p1', isHuman: true, name: 'Rhys', status: PlayerStatus.Joined },
                    { id: 'p2', isHuman: true, name: 'Dana', status: PlayerStatus.Joined }
                ]
            })
        )

        const continued = continuationGame(source, dana, () => danaSeat)

        expect(continued.hotseat).toBe(true)
        expect(continued).not.toHaveProperty('unlisted')
        expect(continued.players).toEqual([
            { id: expect.any(String), isHuman: true, name: 'Rhys', status: PlayerStatus.Reserved },
            danaSeat
        ])
    })
})
