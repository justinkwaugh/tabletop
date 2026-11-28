import { describe, expect, it } from 'vitest'
import { GameStatus, PlayerStatus, type Game } from '@tabletop/common'
import { TimeOffsetStore } from './timeOffsets.svelte'

function fastGame(id: string, activeUserId: string): Game {
    return {
        id,
        typeId: 't',
        status: GameStatus.Started,
        isPublic: true,
        deleted: false,
        ownerId: 'owner',
        name: id,
        paceMinutes: 60,
        players: ['x', 'y'].map((userId) => ({
            id: `p-${userId}`,
            userId,
            name: userId,
            isHuman: true,
            status: PlayerStatus.Joined
        })),
        activePlayerIds: [`p-${activeUserId}`],
        config: {},
        hotseat: false,
        createdAt: new Date('2026-11-12'),
        winningPlayerIds: []
    }
}

const started = new Date('2026-11-01T00:00:00Z')

describe('TimeOffsetStore', () => {
    it('keeps only the offsets that apply to each game', () => {
        const store = new TimeOffsetStore(started)
        store.record([fastGame('g', 'x')], { x: 9, y: -5 })
        expect(store.offsetFor('g', 'x')).toBe(9)
        expect(store.offsetFor('g', 'y')).toBeUndefined()
    })

    it("drops a game's old offsets when a newer list leaves them out", () => {
        const store = new TimeOffsetStore(started)
        store.record([fastGame('g', 'x')], { x: 9 })
        store.record([fastGame('g', 'y')], { y: -5 })
        expect(store.offsetFor('g', 'x')).toBeUndefined()
        expect(store.offsetFor('g', 'y')).toBe(-5)
    })

    it("words the host difference and the awaited player's time for other viewers only", () => {
        const store = new TimeOffsetStore(started)
        const now = new Date('2026-11-12T18:40:00Z')
        const open: Game = { ...fastGame('open', 'x'), status: GameStatus.WaitingForPlayers }
        store.record([open, fastGame('started', 'x')], { owner: 9, x: 9 })
        expect(store.hostDifferenceText(open, 'viewer', now)).toMatch(/h ahead|h behind|same time/)
        expect(store.hostDifferenceText(open, 'owner', now)).toBeUndefined()
        expect(store.awaitedLocalTimeText(fastGame('started', 'x'), 'viewer', now)).toBe(
            '3 AM there'
        )
        expect(store.awaitedLocalTimeText(fastGame('started', 'x'), 'x', now)).toBeUndefined()
    })

    it("shows the awaited player's time only once the turn has run past the pace", () => {
        const store = new TimeOffsetStore(started)
        const game: Game = { ...fastGame('g', 'x'), lastActionAt: new Date('2026-11-12T18:00:00Z') }
        store.record([game], { x: 9 })
        expect(store.awaitedLocalTimeText(game, 'viewer', new Date('2026-11-12T18:40:00Z'))).toBe(
            undefined
        )
        expect(store.awaitedLocalTimeText(game, 'viewer', new Date('2026-11-12T19:10:00Z'))).toBe(
            '4 AM there'
        )
    })

    it("shows nothing before the site's start date, or with none set", () => {
        const now = new Date('2026-11-12T18:40:00Z')
        for (const startsAt of [undefined, new Date('2026-12-01T00:00:00Z')]) {
            const store = new TimeOffsetStore(startsAt)
            store.record([fastGame('g', 'x')], { x: 9 })
            expect(store.awaitedLocalTimeText(fastGame('g', 'x'), 'viewer', now)).toBeUndefined()
        }
    })
})
