import { afterEach, describe, expect, it, vi } from 'vitest'
import {
    assertExists,
    GameCallKind,
    GameResult,
    GameStatus,
    MILLISECONDS_PER_DAY,
    type Game
} from '@tabletop/common'
import { createSyntheticHost } from './tests/syntheticHost.js'
import { StalledGames } from './stalledGames.js'
import { UpdateValidationResult } from '../persistence/stores/validator.js'

afterEach(() => vi.restoreAllMocks())

const now = new Date('2026-10-26T12:00:00Z')
const daysAgo = (days: number) => new Date(now.getTime() - days * MILLISECONDS_PER_DAY)
const supported = async () => true

function stalledHost(lastActionDaysAgo: number) {
    const host = createSyntheticHost()
    host.game.createdAt = daysAgo(90)
    host.game.startedAt = daysAgo(90)
    host.game.lastActionAt = daysAgo(lastActionDaysAgo)
    const end = (supportsCalls = supported) =>
        host.service.endStalledGame({ gameId: host.game.id, supportsCalls, now })
    return { ...host, end }
}

describe('ending a Stalled Game', () => {
    it('abandons a game nobody has moved in for thirty days', async () => {
        const host = stalledHost(30)
        await host.apply(host.step('s1', 'p1'))
        host.game.lastActionAt = daysAgo(30)

        expect(await host.end()).toBe(true)
        expect(host.game.call).toEqual({ kind: GameCallKind.Stalled })
        expect(host.game.status).toBe(GameStatus.Finished)
        expect(host.state()).toMatchObject({
            result: GameResult.Abandoned,
            winningPlayerIds: [],
            activePlayerIds: []
        })
        expect(host.summary()).toEqual(['0:s1', expect.stringMatching(/^1:/)])
        expect(host.notifications.sendNotification).toHaveBeenCalled()
    })

    it('leaves a game alone that moved within thirty days', async () => {
        const host = stalledHost(29)
        expect(await host.end()).toBe(false)
        expect(host.game.status).toBe(GameStatus.Started)
        expect(host.summary()).toEqual([])
    })

    it('leaves a game alone until its title can show the ending', async () => {
        const host = stalledHost(60)
        expect(await host.end(async () => false)).toBe(false)
        expect(host.game.status).toBe(GameStatus.Started)
    })

    it('leaves tournament and hotseat games alone', async () => {
        const tournament = stalledHost(60)
        tournament.game.tournament = {
            tournamentId: 't',
            stageId: 's',
            tableId: 'x',
            scheduleId: 'd'
        }
        expect(await tournament.end()).toBe(false)

        const hotseat = stalledHost(60)
        hotseat.game.hotseat = true
        expect(await hotseat.end()).toBe(false)
    })

    it('stops when a move lands after the game was found stalled', async () => {
        const host = stalledHost(31)
        vi.mocked(host.store.addActionsToGame).mockImplementationOnce(
            async ({ game, state, validator }) => {
                assertExists(validator, 'Ending a stalled game validates the stored game')
                const moved = { ...structuredClone(host.game), lastActionAt: now }
                const priorState = structuredClone(host.state())
                expect(await validator(moved, priorState, state, [], {}, [])).toBe(
                    UpdateValidationResult.Cancel
                )
                return { storedActions: [], updatedGame: game, relatedActions: [], priorState }
            }
        )

        expect(await host.end()).toBe(false)
        expect(host.game.status).toBe(GameStatus.Started)
        expect(host.summary()).toEqual([])
    })
})

describe('StalledGames', () => {
    const template = createSyntheticHost().game
    const started = (id: string, typeId: string, lastActionDaysAgo: number): Game => ({
        ...structuredClone(template),
        id,
        typeId,
        lastActionAt: daysAgo(lastActionDaysAgo)
    })
    const games = [
        started('old', 'ready', 45),
        started('recent', 'ready', 3),
        started('unready', 'legacy', 45),
        started('unreadable', 'broken', 45)
    ]

    function createStalledGames() {
        const createPushTask = vi.fn(async () => {})
        const endStalledGame = vi.fn(async () => true)
        const stalledGames = new StalledGames(
            { findStartedGames: async () => structuredClone(games) },
            { endStalledGame },
            { createPushTask },
            async (titleId) => {
                if (titleId === 'broken') throw Error('catalog unavailable')
                return titleId === 'ready'
            },
            () => now
        )
        return { stalledGames, createPushTask, endStalledGame }
    }

    it('queues an ending for each due game whose title can show one', async () => {
        const { stalledGames, createPushTask } = createStalledGames()
        vi.spyOn(console, 'warn').mockImplementation(() => {})

        expect(await stalledGames.sweep()).toEqual({
            queuedGameIds: ['old'],
            awaitingTitleGameIds: ['unready', 'unreadable']
        })
        expect(createPushTask).toHaveBeenCalledExactlyOnceWith({
            queue: 'maintenance',
            path: '/games/endStalled',
            payload: { gameId: 'old' },
            uniqueName: 'stalled-game-old-2026-10-26'
        })
    })

    it('ends a queued game through the game service with the same title check', async () => {
        const { stalledGames, endStalledGame } = createStalledGames()

        expect(await stalledGames.end({ gameId: 'old' })).toBe(true)
        expect(endStalledGame).toHaveBeenCalledExactlyOnceWith({
            gameId: 'old',
            supportsCalls: expect.any(Function),
            now
        })
    })
})
