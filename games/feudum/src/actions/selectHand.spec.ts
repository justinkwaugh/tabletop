import { ActionSource, Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { ActionCardKind } from '../data/cards.js'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { MachineState } from '../definition/states.js'
import { FeudumGameState } from '../model/gameState.js'
import { canonicalOf } from '../testing/state.js'
import { tableAtHandSelection, type Table } from '../testing/table.js'
import {
    HydratedFinaliseHand,
    isFinaliseHand,
    previewFinaliseHand,
    reasonPouchRefused
} from './finaliseHand.js'

const FOUR: ActionCardKind[] = ['move', 'tax', 'guild', 'explore']
const FIVE: ActionCardKind[] = [...FOUR, 'harvest']
const BARREL_SULFUR = "Barrel sulfur can't go in the pouch."

const actionProjector = Visibility.createActionProjector(FeudumApiActions)
const stateProjector = Visibility.createProjector(FeudumGameState)
const spectator = { kind: 'spectator' } as const

function finalise(table: Table, playerId: string, cards: string[], pouchGood?: string) {
    return table.send(playerId, {
        type: ActionType.FinaliseHand,
        revealsInfo: true,
        cards,
        ...(pouchGood === undefined ? {} : { pouchGood })
    })
}

function asPlayer(playerId: string) {
    return { kind: 'player', playerId } as const
}

describe('FinaliseHand', () => {
    it('R-3.1 takes 4 distinct kinds with no pouch good: owner-known hand, count withheld', () => {
        const table = tableAtHandSelection()
        const [first] = table.order

        const processed = finalise(table, first, FOUR)

        const seat = table.seat(first)
        expect(seat.hand).toEqual(FOUR)
        expect(seat.handCount).toBe(0)
        expect(seat.pouch).toBeUndefined()
        expect(seat.committedPouch).toBeUndefined()
        expect(processed).toHaveLength(1)
        expect(isFinaliseHand(processed[0])).toBe(true)
    })

    it('R-3.3, R-3.1-H1 saltpeter takes 5 cards and stays in the supply, committed, until the reveal (S5)', () => {
        const table = tableAtHandSelection()
        const [first] = table.order
        const before = table.seat(first).goods.saltpeter
        const haversack = table.state.supply.haversack.saltpeter

        finalise(table, first, FIVE, 'saltpeter')

        const seat = table.seat(first)
        expect(seat.committedPouch).toBe('saltpeter')
        expect(seat.pouch).toBeUndefined()
        expect(seat.handCount).toBe(0)
        expect(seat.goods.saltpeter).toBe(before)
        expect(table.state.supply.haversack.saltpeter).toBe(haversack)
    })

    it('R-3.3, R-3.1-H1 at the reveal saltpeter leaves the supply for the pouch and the hand is 5', () => {
        const table = tableAtHandSelection(2)
        const [first, second] = table.order
        const before = table.seat(first).goods.saltpeter

        finalise(table, first, FIVE, 'saltpeter')
        finalise(table, second, FOUR)

        const seat = table.seat(first)
        expect(seat.handCount).toBe(5)
        expect(seat.pouch).toBe('saltpeter')
        expect(seat.committedPouch).toBeUndefined()
        expect(seat.goods.saltpeter).toBe(before - 1)
    })

    it('R-3.3 sulfur keeps the hand at 4 and leaves the personal supply at the reveal', () => {
        const table = tableAtHandSelection(2)
        const [first, second] = table.order
        finalise(table, first, FOUR, 'sulfur')
        expect(table.seat(first).goods.sulfur).toBe(1)
        finalise(table, second, FOUR)
        expect(table.seat(first).pouch).toBe('sulfur')
        expect(table.seat(first).goods.sulfur).toBe(0)
        expect(table.seat(first).handCount).toBe(4)
    })

    it('R-3.1, R-3.3 refuses the wrong count and repeated kinds, with the reason (S5)', () => {
        const table = tableAtHandSelection()
        const [first] = table.order
        expect(() => finalise(table, first, FOUR, 'saltpeter')).toThrow('Choose 5 cards, not 4.')
        expect(() => finalise(table, first, FIVE)).toThrow('Choose 4 cards, not 5.')
        expect(() => finalise(table, first, FIVE, 'sulfur')).toThrow('Choose 4 cards, not 5.')
        expect(() => finalise(table, first, ['move', 'move', 'tax', 'guild'])).toThrow(
            'Choose different cards.'
        )
    })

    it('R-3.3 refuses barrel sulfur, with the reason, and the offer says so (S6)', () => {
        const table = tableAtHandSelection(4, () => ({
            goods: ['saltpeter', 'sulfur', 'iron'],
            sulfurToBarrel: true
        }))
        const [first] = table.order
        expect(table.seat(first).barrel).toBe(1)

        expect(reasonPouchRefused(table.seat(first), 'sulfur')).toBe(BARREL_SULFUR)
        expect(reasonPouchRefused(table.seat(first), 'saltpeter')).toBeUndefined()
        expect(() => finalise(table, first, FOUR, 'sulfur')).toThrow(BARREL_SULFUR)
        expect(table.seat(first).barrel).toBe(1)
    })

    it('R-3.3 refuses a pouch good the seat does not hold', () => {
        const table = tableAtHandSelection(4, () => ({ goods: ['iron', 'wood', 'food'] }))
        const [first] = table.order
        expect(reasonPouchRefused(table.seat(first), 'saltpeter')).toBe('You hold no saltpeter.')
        expect(() => finalise(table, first, FIVE, 'saltpeter')).toThrow('You hold no saltpeter.')
    })

    it('R-3.1-H1 every seat yet to finalise may send, in any order (S4)', () => {
        const table = tableAtHandSelection()
        const [first, second, third, fourth] = table.order

        expect(table.state.flow.selection).toEqual({ finalised: [] })
        expect(table.state.activePlayerIds).toEqual(table.order)
        for (const playerId of table.order) {
            expect(table.offered(playerId)).toEqual([ActionType.FinaliseHand])
        }

        finalise(table, third, FOUR)
        expect(table.state.flow.selection).toEqual({ finalised: [third] })
        expect(table.state.activePlayerIds).toEqual([first, second, fourth])
        expect(table.offered(third)).toEqual([])
        expect(() => finalise(table, third, FOUR)).toThrow()

        finalise(table, first, FOUR)
        finalise(table, fourth, FOUR)
        expect(table.state.activePlayerIds).toEqual([second])
        expect(table.state.machineState).toBe(MachineState.SelectingHands)
    })

    it('R-3.1-H1 the rule itself refuses a seat that has finalised, whoever is active', () => {
        const table = tableAtHandSelection()
        const [first, second] = table.order
        finalise(table, second, FOUR)
        const again = new HydratedFinaliseHand({
            id: 'a1',
            gameId: table.game.id,
            source: ActionSource.User,
            type: ActionType.FinaliseHand,
            playerId: second,
            revealsInfo: true,
            cards: FOUR
        })

        expect(() => again.apply(table.hydrated())).toThrow('Your hand is already final.')
        const preview = previewFinaliseHand(table.hydrated(), second, { cards: FOUR })
        expect(preview.reason).toBe('Your hand is already final.')
        expect(previewFinaliseHand(table.hydrated(), first, { cards: FOUR }).reason).toBeUndefined()
    })

    it('R-3.1-H1, R-3.2 after the last finaliser every pouch good is revealed together and cards begin', () => {
        const table = tableAtHandSelection(3)
        const [first, second, third] = table.order
        finalise(table, second, FOUR, 'sulfur')
        finalise(table, first, FOUR)

        const processed = finalise(table, third, FIVE, 'saltpeter')

        expect(processed.map((action) => action.type)).toEqual([
            ActionType.FinaliseHand,
            ActionType.RevealPouches
        ])
        expect(processed[1]).toMatchObject({
            revealsInfo: true,
            metadata: {
                pouches: [
                    { playerId: second, good: 'sulfur' },
                    { playerId: third, good: 'saltpeter' }
                ]
            }
        })
        expect(table.order.map((playerId) => table.seat(playerId).pouch)).toEqual([
            undefined,
            'sulfur',
            'saltpeter'
        ])
        expect(table.order.map((playerId) => table.seat(playerId).handCount)).toEqual([4, 4, 5])
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.state.activePlayerIds).toEqual([first])
        expect(table.state.flow.selection).toBeUndefined()
    })

    it('R-X.2 is always a barrier, and an Action not saying so is refused (S8)', () => {
        const table = tableAtHandSelection()
        const [first] = table.order
        expect(() => table.send(first, { type: ActionType.FinaliseHand, cards: FOUR })).toThrow()
        const [action] = finalise(table, first, FOUR)
        expect(action.revealsInfo).toBe(true)
    })

    it('R-3.1, R-3.1-H1, R-X.2 `cards` and the pouch good are actor-known in the record (S8)', () => {
        const table = tableAtHandSelection()
        const [first, second] = table.order

        const [action] = finalise(table, first, FIVE, 'saltpeter')

        expect(actionProjector.project(action, asPlayer(first), { config: {} })).toMatchObject({
            cards: FIVE,
            pouchGood: 'saltpeter',
            revealsInfo: true
        })
        for (const perspective of [asPlayer(second), spectator]) {
            const projected = actionProjector.project(action, perspective, { config: {} })
            expect(projected).not.toHaveProperty('cards')
            expect(projected).not.toHaveProperty('pouchGood')
            expect(projected).toMatchObject({ playerId: first, revealsInfo: true })
            expect(JSON.stringify(projected)).not.toContain('saltpeter')
            expect(JSON.stringify(projected)).not.toContain(FIVE[0])
        }
    })

    it('R-3.1, R-3.1-H1, R-5.1 until the reveal other seats see only that a seat has finalised (S8)', () => {
        const table = tableAtHandSelection()
        const [first, second] = table.order
        const unseen = canonicalOf(table.hydrated())
        finalise(table, first, FIVE, 'saltpeter')
        const canonical = canonicalOf(table.hydrated())

        for (const perspective of [asPlayer(second), spectator]) {
            const before = stateProjector.project(unseen, perspective, { config: {} })
            const projected = stateProjector.project(canonical, perspective, { config: {} })
            const row = projected.players.find((player) => player.playerId === first)
            expect(row).not.toHaveProperty('hand')
            expect(row).not.toHaveProperty('committedPouch')
            expect(row).not.toHaveProperty('pouch')
            expect(row).toEqual(before.players.find((player) => player.playerId === first))
            expect(projected.flow.selection).toEqual({ finalised: [first] })
        }
        const own = stateProjector.project(canonical, asPlayer(first), { config: {} })
        expect(own.players.find((player) => player.playerId === first)).toMatchObject({
            hand: FIVE,
            committedPouch: 'saltpeter'
        })
    })

    it('R-3.1-H1 the reveal is public: every seat reads each pouch good and hand count', () => {
        const table = tableAtHandSelection(2)
        const [first, second] = table.order
        finalise(table, first, FIVE, 'saltpeter')
        const [, reveal] = finalise(table, second, FOUR)
        const canonical = canonicalOf(table.hydrated())

        for (const perspective of [asPlayer(first), asPlayer(second), spectator]) {
            expect(actionProjector.project(reveal, perspective, { config: {} })).toMatchObject({
                type: ActionType.RevealPouches,
                metadata: { pouches: [{ playerId: first, good: 'saltpeter' }] }
            })
            const projected = stateProjector.project(canonical, perspective, { config: {} })
            const rows = table.order.map((playerId) =>
                projected.players.find((player) => player.playerId === playerId)
            )
            expect(rows.map((row) => [row?.handCount, row?.pouch])).toEqual([
                [5, 'saltpeter'],
                [4, undefined]
            ])
        }
    })

    it('R-3.1 needs no metadata: its history line reads the input', () => {
        const table = tableAtHandSelection()
        const [action] = finalise(table, table.order[0], FOUR)
        expect(action).not.toHaveProperty('metadata')
    })
})

describe('previewFinaliseHand', () => {
    it('R-3.13-H1 flags a hand where Conquer may end last; a warning, not a refusal (S7)', () => {
        const table = tableAtHandSelection()
        const [first] = table.order
        const hand: ActionCardKind[] = ['conquer', 'move', 'tax', 'guild']

        const preview = previewFinaliseHand(table.hydrated(), first, { cards: hand })

        expect(preview.conquerMayEndLast).toBe(true)
        expect(preview.reason).toBeUndefined()
        expect(
            previewFinaliseHand(table.hydrated(), first, { cards: FOUR }).conquerMayEndLast
        ).toBe(false)
        finalise(table, first, hand)
        expect(table.seat(first).hand).toEqual(hand)
    })

    it('R-3.3 reports the chosen and required counts for a draft (S5)', () => {
        const table = tableAtHandSelection()
        const [first] = table.order

        expect(
            previewFinaliseHand(table.hydrated(), first, { cards: FOUR, pouchGood: 'saltpeter' })
        ).toMatchObject({ chosen: 4, required: 5, reason: 'Choose 5 cards, not 4.' })
        expect(previewFinaliseHand(table.hydrated(), first, { cards: FIVE })).toMatchObject({
            chosen: 5,
            required: 4,
            reason: 'Choose 4 cards, not 5.'
        })
    })

    it('R-X.2 says the send sets revealsInfo', () => {
        const table = tableAtHandSelection()
        expect(
            previewFinaliseHand(table.hydrated(), table.order[0], { cards: FOUR }).revealsInfo
        ).toBe(true)
    })
})
