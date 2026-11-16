import { describe, expect, it } from 'vitest'
import { GameStatus, type Game } from '@tabletop/common'
import { turnWaitDisplay, waitText } from './gamePace'

const now = new Date('2026-11-12T12:00:00Z')
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000)

function startedGame(overrides: Partial<Game> = {}): Game {
    return {
        id: 'g',
        typeId: 't',
        status: GameStatus.Started,
        isPublic: true,
        deleted: false,
        ownerId: 'owner',
        name: 'Game',
        players: [],
        config: {},
        hotseat: false,
        createdAt: minutesAgo(10_000),
        winningPlayerIds: [],
        activePlayerIds: ['a'],
        ...overrides
    }
}

describe('waitText', () => {
    it('counts minutes up to two hours, hours up to two days, then days', () => {
        expect(waitText(20_000)).toBe('1 min')
        expect(waitText(61 * 60_000)).toBe('61 min')
        expect(waitText(150 * 60_000)).toBe('2 h')
        expect(waitText(47.5 * 3_600_000)).toBe('47 h')
        expect(waitText(80 * 3_600_000)).toBe('3 days')
    })
})

describe('turnWaitDisplay', () => {
    it('describes a wait past the pace for the tooltip and screen readers', () => {
        const game = startedGame({ paceMinutes: 60, turnStartedAt: { a: minutesAgo(4 * 60) } })
        expect(turnWaitDisplay(game, now)).toEqual({
            wait: '4 h',
            pastPace: true,
            description: '4 h, past the 1 h pace'
        })
    })

    it('names the Live pace without its duration', () => {
        const game = startedGame({ paceMinutes: 15, turnStartedAt: { a: minutesAgo(20) } })
        expect(turnWaitDisplay(game, now)?.description).toBe('20 min, past the Live pace')
    })

    it('reads a game with no pace as Daily', () => {
        const game = startedGame({ turnStartedAt: { a: minutesAgo(5 * 60) } })
        expect(turnWaitDisplay(game, now)).toEqual({
            wait: '5 h',
            pastPace: false,
            description: '5 h'
        })
    })

    it('shows nothing when nobody is to move', () => {
        expect(turnWaitDisplay(startedGame({ activePlayerIds: [] }), now)).toBeUndefined()
    })
})
