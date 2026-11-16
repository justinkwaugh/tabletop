import { describe, expect, it } from 'vitest'
import { PhaseName } from '@tabletop/ride-the-rails'
import { buildState } from '@tabletop/ride-the-rails/testing'
import { SHARE_SLOTS, newShareSlot, pendingGains, seatCards } from './seatCards.js'

describe('seat cards', () => {
    const state = buildState({
        playerCount: 4,
        round: 3,
        phase: PhaseName.Build,
        currentPlayerId: 'p2',
        money: { p1: 10, p2: 22, p3: 0, p4: 15 },
        shares: {
            p1: { 'railroad.yellow': 1, 'railroad.red': 2 },
            p2: { 'railroad.orange': 1, 'railroad.blue': 3, 'railroad.red': 1 }
        }
    })

    it('gives one card per seat in turn order (R-2.3)', () => {
        state.turnManager.turnOrder = ['p3', 'p1', 'p4', 'p2']
        const cards = seatCards(state)
        expect(cards.map((card) => [card.playerId, card.money])).toEqual([
            ['p3', 0],
            ['p1', 10],
            ['p4', 15],
            ['p2', 22]
        ])
    })

    it('has a row per railroad held, in railroad order, and none for a railroad not held (R-1.4)', () => {
        const cards = new Map(seatCards(state).map((card) => [card.playerId, card]))
        expect(cards.get('p1')?.rows).toEqual([
            { railroadId: 'railroad.red', shares: 2 },
            { railroadId: 'railroad.yellow', shares: 1 }
        ])
        expect(cards.get('p2')?.rows).toEqual([
            { railroadId: 'railroad.red', shares: 1 },
            { railroadId: 'railroad.blue', shares: 3 },
            { railroadId: 'railroad.orange', shares: 1 }
        ])
        expect(cards.get('p3')?.rows).toEqual([])
    })

    it('marks the acting seat only', () => {
        expect(
            seatCards(state)
                .filter((card) => card.acting)
                .map((card) => card.playerId)
        ).toEqual(['p2'])
    })

    it('shows a share count ticked ahead of the state, adding the row of a first share', () => {
        const landed = (playerId: string, railroadId: string, shares: number) =>
            playerId === 'p3' && railroadId === 'railroad.blue' ? shares + 1 : shares
        const cards = new Map(seatCards(state, landed).map((card) => [card.playerId, card]))
        expect(cards.get('p3')?.rows).toEqual([{ railroadId: 'railroad.blue', shares: 1 }])
        expect(cards.get('p1')?.rows).toEqual([
            { railroadId: 'railroad.red', shares: 2 },
            { railroadId: 'railroad.yellow', shares: 1 }
        ])
    })
})

describe('share slots', () => {
    const state = buildState({
        playerCount: 4,
        round: 5,
        phase: PhaseName.Build,
        currentPlayerId: 'p1',
        shares: { p1: { 'railroad.yellow': 1, 'railroad.red': 2, 'railroad.blue': 1 } }
    })

    it('fills six slots with the seat’s shares in railroad order, the rest empty (R-2.1, R-3.1)', () => {
        const card = seatCards(state).find((seat) => seat.playerId === 'p1')
        expect(SHARE_SLOTS).toBe(6)
        expect(card?.slots).toEqual([
            'railroad.red',
            'railroad.red',
            'railroad.blue',
            'railroad.yellow',
            undefined,
            undefined
        ])
    })

    it('lands a new share in the slot after its railroad’s others', () => {
        const after: Record<string, number> = {
            'railroad.red': 2,
            'railroad.blue': 2,
            'railroad.yellow': 1
        }
        expect(newShareSlot((id) => after[id] ?? 0, 'railroad.blue')).toBe(3)
    })
})

describe('pending gains', () => {
    it('adds each seat’s dividends and fare, and leaves out seats paid nothing (R-3.3.4, R-3.3.5)', () => {
        const gains = pendingGains([
            { playerId: 'p1', dividends: 2, fare: 3 },
            { playerId: 'p2', dividends: 2, fare: 0 },
            { playerId: 'p3', dividends: 0, fare: 0 }
        ])
        expect([...gains]).toEqual([
            ['p1', 5],
            ['p2', 2]
        ])
    })
})
