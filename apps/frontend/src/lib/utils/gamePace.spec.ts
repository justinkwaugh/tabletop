import { describe, expect, it } from 'vitest'
import { GameStatus, type Game } from '@tabletop/common'
import { lastMovePaceWarning } from './gamePace'

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

describe('lastMovePaceWarning', () => {
    it('is quiet while the last move is within the pace', () => {
        expect(lastMovePaceWarning(startedGame({ lastActionAt: minutesAgo(60) }), now)).toBe(
            undefined
        )
    })

    it('names the pace once the last move is older than it', () => {
        const game = startedGame({ paceMinutes: 15, lastActionAt: minutesAgo(20) })
        expect(lastMovePaceWarning(game, now)).toBe('Past the Live pace')
    })

    it('counts from the start when nobody has moved', () => {
        const game = startedGame({ startedAt: minutesAgo(2 * 1440) })
        expect(lastMovePaceWarning(game, now)).toBe('Past the 1-day pace')
    })
})
