import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { tableAtHandSelection, tableAtPlayingCards, type Table } from '../testing/table.js'

const Hand = ['move', 'tax', 'guild', 'explore']
const AtWillTypes: string[] = [
    ActionType.PlayMandate,
    ActionType.SealCharter,
    ActionType.SpendRegionTile,
    ActionType.PlaceVessel,
    ActionType.DiscardWrit,
    ActionType.ReclaimImmunitySeal
]

function finalise(table: Table, playerId: string, cards: string[] = Hand) {
    return table.send(playerId, { type: ActionType.FinaliseHand, revealsInfo: true, cards })
}

/** Writs off the deck, so the seat has something to act on at will. */
function holdWrit(table: Table, playerId: string) {
    table.moveTo((state) => {
        const vault = state.requireVault()
        const { writId } = vault.writDeck[vault.writDeck.length - 1]
        vault.writDeck.pop()
        state.getPlayerState(playerId).writs = [writId]
        state.getPlayerState(playerId).writCount = 1
        return MachineState.SelectingHands
    })
}

describe('SelectingHands', () => {
    it('R-3.1-H1, D17 only the next finaliser is active, in turn order', () => {
        const table = tableAtHandSelection()
        table.order.forEach((playerId, index) => {
            expect(table.state.machineState).toBe(MachineState.SelectingHands)
            expect(table.state.activePlayerIds).toEqual([playerId])
            expect(table.state.flow.selection).toEqual({
                playerId,
                finalised: table.order.slice(0, index)
            })
            for (const other of table.order) {
                expect(table.offered(other).includes(ActionType.FinaliseHand)).toBe(
                    other === playerId
                )
            }
            finalise(table, playerId)
        })
    })

    it('R-3.1-H1 a seat finalising early is refused', () => {
        const table = tableAtHandSelection()
        const [, second] = table.order
        expect(() => finalise(table, second)).toThrow()
        expect(table.state.flow.selection?.finalised).toEqual([])
    })

    it('R-4.4-H1, D17 the at-will actions are the next finaliser’s alone', () => {
        const table = tableAtHandSelection()
        const [first, second] = table.order
        holdWrit(table, first)
        holdWrit(table, second)

        expect(table.offered(first)).toContain(ActionType.DiscardWrit)
        expect(table.offered(second)).toEqual([])
    })

    it('R-4.4-H1 the turn passes on with the finaliser, at-will actions with it', () => {
        const table = tableAtHandSelection()
        const [first, second] = table.order
        holdWrit(table, first)
        holdWrit(table, second)

        finalise(table, first)

        expect(table.offered(first).filter((type) => AtWillTypes.includes(type))).toEqual([])
        expect(table.offered(second)).toContain(ActionType.DiscardWrit)
    })

    it('R-4.4-H1 an at-will action leaves the seat selecting', () => {
        const table = tableAtHandSelection()
        const [first] = table.order
        holdWrit(table, first)
        const writId = table.seat(first).writs?.[0]

        table.send(first, { type: ActionType.DiscardWrit, writId })

        expect(table.state.machineState).toBe(MachineState.SelectingHands)
        expect(table.state.flow.selection).toEqual({ playerId: first, finalised: [] })
        expect(table.asked).toBe(first)
    })

    it('R-3.2 after the last finaliser, cards begin with the starting player', () => {
        const table = tableAtHandSelection(3)
        for (const playerId of table.order) {
            expect(table.state.machineState).toBe(MachineState.SelectingHands)
            finalise(table, playerId)
        }
        const [starting] = table.order
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.state.flow.selection).toBeUndefined()
        expect(table.state.flow.turn).toEqual({
            playerId: starting,
            secondCard: false,
            followUps: []
        })
        expect(table.asked).toBe(starting)
        expect(table.hydrated().phaseManager.currentPhase?.name).toBe(PhaseName.Cards)
        expect(table.offered(starting)).toEqual(
            expect.arrayContaining([ActionType.ForfeitCard, ActionType.Move, ActionType.Tax])
        )
    })

    it('R-3.2 a turn left open is reset, not resumed', () => {
        const table = tableAtHandSelection(2)
        const [first, second] = table.order
        finalise(table, first)
        table.moveTo((state) => {
            state.flow.turn = { playerId: second, secondCard: true, followUps: [] }
            return MachineState.SelectingHands
        })

        finalise(table, second)

        expect(table.state.flow.turn).toEqual({
            playerId: first,
            secondCard: false,
            followUps: []
        })
    })

    it('R-3.1, R-3.2 the real flow keeps the hands finalised', () => {
        const table = tableAtPlayingCards()
        for (const playerId of table.order) {
            expect(table.seat(playerId).hand).toEqual(Hand)
            expect(table.seat(playerId).handCount).toBe(Hand.length)
        }
        expect(table.state.flow.selection).toBeUndefined()
    })
})
