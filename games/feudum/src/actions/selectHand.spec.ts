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
    it('R-3.1 takes 4 distinct kinds with no pouch good: owner-known hand, public count', () => {
        const table = tableAtHandSelection()
        const [first] = table.order

        const processed = finalise(table, first, FOUR)

        const seat = table.seat(first)
        expect(seat.hand).toEqual(FOUR)
        expect(seat.handCount).toBe(4)
        expect(seat.pouch).toBeUndefined()
        expect(processed).toHaveLength(1)
        expect(isFinaliseHand(processed[0])).toBe(true)
    })

    it('R-3.3 saltpeter takes 5 cards and leaves the personal supply (S5)', () => {
        const table = tableAtHandSelection()
        const [first] = table.order
        const before = table.seat(first).goods.saltpeter
        const haversack = table.state.supply.haversack.saltpeter

        finalise(table, first, FIVE, 'saltpeter')

        const seat = table.seat(first)
        expect(seat.handCount).toBe(5)
        expect(seat.pouch).toBe('saltpeter')
        expect(seat.goods.saltpeter).toBe(before - 1)
        expect(table.state.supply.haversack.saltpeter).toBe(haversack)
    })

    it('R-3.3 sulfur keeps the hand at 4 and leaves the personal supply', () => {
        const table = tableAtHandSelection()
        const [first] = table.order
        finalise(table, first, FOUR, 'sulfur')
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

    it('R-3.1-H1 only the first seat not finalised may send (S4)', () => {
        const table = tableAtHandSelection()
        const [first, second, third, fourth] = table.order

        expect(() => finalise(table, second, FOUR)).toThrow()
        expect(table.state.flow.selection).toEqual({ playerId: first, finalised: [] })
        expect(table.asked).toBe(first)
        expect(table.offered(first)).toEqual([ActionType.FinaliseHand])
        expect(table.offered(second)).toEqual([])

        finalise(table, first, FOUR)
        expect(table.state.flow.selection).toEqual({ playerId: second, finalised: [first] })
        expect(table.asked).toBe(second)
        expect(() => finalise(table, first, FOUR)).toThrow()

        finalise(table, second, FOUR)
        finalise(table, third, FOUR)
        expect(table.asked).toBe(fourth)
        expect(table.state.machineState).toBe(MachineState.SelectingHands)
    })

    it('R-3.1-H1 the rule itself refuses a seat out of order, whoever is active', () => {
        const table = tableAtHandSelection()
        const [first, second] = table.order
        const outOfOrder = new HydratedFinaliseHand({
            id: 'a1',
            gameId: table.game.id,
            source: ActionSource.User,
            type: ActionType.FinaliseHand,
            playerId: second,
            revealsInfo: true,
            cards: FOUR
        })

        expect(() => outOfOrder.apply(table.hydrated())).toThrow('Earlier seats finalise first.')
        const preview = previewFinaliseHand(table.hydrated(), second, { cards: FOUR })
        expect(preview.reason).toBe('Earlier seats finalise first.')
        expect(previewFinaliseHand(table.hydrated(), first, { cards: FOUR }).reason).toBeUndefined()
    })

    it('R-3.1-H1, R-3.2 after the last finaliser the selection closes and cards begin', () => {
        const table = tableAtHandSelection(2)
        const [first, second] = table.order
        finalise(table, first, FOUR)
        finalise(table, second, FOUR)
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

    it('R-3.1, R-X.2 `cards` is actor-known in the record; the pouch good is public (S8)', () => {
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
            expect(projected).toMatchObject({ pouchGood: 'saltpeter', playerId: first })
            expect(JSON.stringify(projected)).not.toContain(FIVE[0])
        }
    })

    it('R-3.1, R-5.1 other seats see the count and the pouch good, never the hand (S8)', () => {
        const table = tableAtHandSelection()
        const [first, second] = table.order
        finalise(table, first, FIVE, 'saltpeter')
        const canonical = canonicalOf(table.hydrated())

        for (const perspective of [asPlayer(second), spectator]) {
            const projected = stateProjector.project(canonical, perspective, { config: {} })
            const row = projected.players.find((player) => player.playerId === first)
            expect(row).not.toHaveProperty('hand')
            expect(row).toMatchObject({ handCount: 5, pouch: 'saltpeter' })
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
