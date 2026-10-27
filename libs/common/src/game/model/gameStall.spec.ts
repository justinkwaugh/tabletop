import { describe, expect, it } from 'vitest'
import { MILLISECONDS_PER_DAY } from '../../site/siteStats.js'
import { GameCategory, GameStatus, GameStorage } from './game.js'
import {
    daysUntilStalledGameEnds,
    gameStallLevel,
    GameStallLevel,
    stalledGameEndsAt
} from './gameStall.js'

const now = new Date('2026-10-26T12:00:00Z')
const daysAgo = (days: number) => new Date(now.getTime() - days * MILLISECONDS_PER_DAY)
const tournament = { tournamentId: 't', stageId: 's', tableId: 'x', scheduleId: 'd' }

function game(overrides: Partial<Parameters<typeof gameStallLevel>[0]> = {}) {
    return {
        status: GameStatus.Started,
        hotseat: false,
        createdAt: daysAgo(60),
        startedAt: daysAgo(50),
        lastActionAt: daysAgo(1),
        ...overrides
    }
}

describe('gameStallLevel', () => {
    it('goes from at risk at a week to ending at two weeks to due to end at thirty days', () => {
        expect(gameStallLevel(game({ lastActionAt: daysAgo(6.9) }), now)).toBe(GameStallLevel.None)
        expect(gameStallLevel(game({ lastActionAt: daysAgo(7) }), now)).toBe(GameStallLevel.AtRisk)
        expect(gameStallLevel(game({ lastActionAt: daysAgo(14) }), now)).toBe(GameStallLevel.Ending)
        expect(gameStallLevel(game({ lastActionAt: daysAgo(30) }), now)).toBe(GameStallLevel.Due)
    })

    it('counts from the start when nobody has moved', () => {
        const unmoved = game({ lastActionAt: undefined, startedAt: daysAgo(31) })
        expect(gameStallLevel(unmoved, now)).toBe(GameStallLevel.Due)
        expect(stalledGameEndsAt(unmoved)).toEqual(daysAgo(1))
    })

    it('counts the days left until the end, rounding up', () => {
        expect(daysUntilStalledGameEnds(game({ lastActionAt: daysAgo(20) }), now)).toBe(10)
        expect(daysUntilStalledGameEnds(game({ lastActionAt: daysAgo(29.5) }), now)).toBe(1)
    })

    it('never stalls hotseat, tournament, local, exploration or unstarted games', () => {
        const old = { lastActionAt: daysAgo(90) }
        for (const exempt of [
            game({ ...old, hotseat: true }),
            game({ ...old, tournament }),
            game({ ...old, storage: GameStorage.Local }),
            game({ ...old, category: GameCategory.Exploration }),
            game({ ...old, status: GameStatus.Finished }),
            game({ ...old, status: GameStatus.WaitingForPlayers })
        ]) {
            expect(gameStallLevel(exempt, now)).toBe(GameStallLevel.None)
        }
        expect(gameStallLevel(game(old), now)).toBe(GameStallLevel.Due)
    })
})
