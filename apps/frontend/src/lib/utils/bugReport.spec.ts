import { describe, expect, it } from 'vitest'
import {
    ActionSource,
    BUG_REPORT_LOCAL_GAME_MAX_LENGTH,
    GameStatus,
    GameStorage,
    PlayerStatus,
    type Game,
    type GameAction,
    type GameState
} from '@tabletop/common'
import { APIError, type GameStore } from '@tabletop/frontend-components'
import { bugReportFailureMessage, localGameScenario, LocalGameTooLargeError } from './bugReport'

const state: GameState = {
    id: 'state-1',
    gameId: 'game-1',
    players: [],
    activePlayerIds: ['p-1'],
    actionCount: 1,
    actionChecksum: 7,
    prng: { seed: 1, invocations: 0 },
    machineState: 'placing',
    turnManager: { series: [], turnOrder: ['p-1'], turnCounts: {} },
    winningPlayerIds: []
}

const game: Game = {
    id: 'game-1',
    typeId: 'santiago',
    status: GameStatus.Started,
    isPublic: false,
    deleted: false,
    ownerId: 'u-1',
    name: 'Friday night',
    players: [
        { id: 'p-1', isHuman: true, userId: 'u-1', name: 'Alice', status: PlayerStatus.Joined }
    ],
    config: {},
    hotseat: true,
    storage: GameStorage.Local,
    state,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
    winningPlayerIds: []
}

const action: GameAction = {
    id: 'action-1',
    gameId: 'game-1',
    type: 'placeCanal',
    source: ActionSource.User,
    playerId: 'p-1',
    createdAt: new Date('2026-09-01T00:05:00.000Z')
}

function storeWith(data: { game?: Game; actions: GameAction[] }): GameStore {
    return {
        loadGameData: async () => data,
        createGame: async (created) => created,
        findGamesForUser: async () => [],
        findGameById: async () => data.game,
        deleteGame: async () => undefined,
        storeGameData: async () => undefined
    }
}

describe('localGameScenario', () => {
    it('sends the stored game as a dev harness scenario', async () => {
        const json = await localGameScenario(storeWith({ game, actions: [action] }), 'game-1')

        const { state: _state, ...withoutState } = game
        expect(JSON.parse(json)).toEqual(
            JSON.parse(JSON.stringify({ game: withoutState, state, actions: [action] }))
        )
    })

    it('refuses a game too large to send', async () => {
        const large = { ...action, notes: 'x'.repeat(BUG_REPORT_LOCAL_GAME_MAX_LENGTH) }

        await expect(
            localGameScenario(storeWith({ game, actions: [large] }), 'game-1')
        ).rejects.toBeInstanceOf(LocalGameTooLargeError)
    })

    it('refuses a game with no stored state', async () => {
        const { state: _state, ...withoutState } = game

        await expect(
            localGameScenario(storeWith({ game: withoutState, actions: [] }), 'game-1')
        ).rejects.toThrow('Local game game-1 has no stored state')
    })
})

describe('bugReportFailureMessage', () => {
    it('names a game too large to attach', () => {
        expect(bugReportFailureMessage(new LocalGameTooLargeError('game-1', 1))).toBe(
            'This game is too large to attach to a bug report.'
        )
    })

    it('asks to wait out the rate limit', () => {
        expect(
            bugReportFailureMessage(new APIError({ name: 'RateLimited', message: 'Too many' }))
        ).toBe('You have sent several reports just now. Please try again in a few minutes.')
    })

    it('does not suggest retrying a report the server refused', () => {
        expect(
            bugReportFailureMessage(new APIError({ name: 'InvalidLocalGameError', message: '' }))
        ).toBe('Could not send your bug report.')
    })

    it('suggests retrying when the report did not get through', () => {
        expect(bugReportFailureMessage(new TypeError('Failed to fetch'))).toBe(
            'Could not send your bug report. Please try again in a few minutes.'
        )
    })
})
