import { describe, expect, it } from 'vitest'
import { TestGame } from '@tabletop/power-grid/testing'
import { historyRounds } from './historyEntries.js'

describe('history entries', () => {
    const game = new TestGame(4)
    game.playUntil((state) => state.round === 3)
    const rounds = historyRounds(game.actions)

    it('splits the game into rounds at each restock', () => {
        expect(rounds.map((round) => round.round)).toEqual([1, 2])
    })

    it('runs the phases in rulebook order within a round', () => {
        expect(rounds[0].phases.map((phase) => phase.phase)).toEqual([2, 3, 4, 5])
    })

    it('makes one entry of each auction, naming the buyer', () => {
        const auctions = rounds[0].phases[0].entries.filter((entry) => entry.kind === 'auction')
        expect(auctions).toHaveLength(4)
        for (const auction of auctions) {
            expect(auction.lines[0][1]).toMatchObject({ kind: 'verb', third: ' buys' })
            expect(auction.firstIndex).toBeLessThanOrEqual(auction.lastIndex)
        }
    })

    it('gathers the whole bureaucracy into one entry', () => {
        const bureaucracy = rounds[0].phases.at(-1)?.entries ?? []
        expect(bureaucracy).toHaveLength(1)
        expect(bureaucracy[0].lines.length).toBeGreaterThanOrEqual(4)
    })
})
