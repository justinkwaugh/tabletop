import { ActionSource } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { isAdvanceTurn } from '../actions/advanceTurn.js'
import type { ActionCardKind } from '../data/cards.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { atWillWindow } from '../model/atWill.js'
import { queueFollowUp } from '../model/followUps.js'
import {
    alternativeOf,
    AnyTime,
    FarmerMandate,
    KnightMandate,
    ShillingMandate,
    VesselMandate,
    Weapon
} from '../testing/atWill.js'
import {
    answer,
    commit,
    conquer,
    holdWrit as holdDeckWrit,
    PawnOf,
    tableAtCombat
} from '../testing/combat.js'
import { giveGood, showLocation } from '../testing/improving.js'
import { typesOf } from '../testing/roundEnd.js'
import {
    giveCardTurn,
    type Table,
    tableAtHandSelection,
    tableAtPlayingCards
} from '../testing/table.js'
import { stateAfterCardStep } from './cardTurns.js'
import { cardTurnSeat } from '../model/turns.js'

const Hand = ['move', 'tax', 'guild', 'explore']
const AtWillTypes: string[] = [
    ActionType.PlayMandate,
    ActionType.SpendRegionTile,
    ActionType.PlaceVessel,
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
    it('R-3.1-H1 every seat yet to finalise is active, whatever the order of the sends', () => {
        const table = tableAtHandSelection()
        const sends = [table.order[2], table.order[0], table.order[3], table.order[1]]
        sends.forEach((playerId, index) => {
            const finalised = sends.slice(0, index)
            expect(table.state.machineState).toBe(MachineState.SelectingHands)
            expect(table.state.activePlayerIds).toEqual(
                table.order.filter((id) => !finalised.includes(id))
            )
            expect(table.state.flow.selection).toEqual({ finalised })
            for (const other of table.order) {
                expect(table.offered(other).includes(ActionType.FinaliseHand)).toBe(
                    !finalised.includes(other)
                )
            }
            finalise(table, playerId)
        })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
    })

    it('R-3.1-H1 a seat finalising twice is refused', () => {
        const table = tableAtHandSelection()
        const [, second] = table.order
        finalise(table, second)
        expect(() => finalise(table, second)).toThrow()
        expect(table.state.flow.selection?.finalised).toEqual([second])
    })

    it('R-4.4-H1, R-3.1-H1 the at-will window is every seat’s yet to finalise; R-4.4-H5 a discard is any seat’s', () => {
        const table = tableAtHandSelection()
        const [first, second] = table.order
        holdWrit(table, first)
        holdWrit(table, second)

        expect(atWillWindow(table.hydrated(), first)).toBe('hand-selection')
        expect(atWillWindow(table.hydrated(), second)).toBe('hand-selection')
        expect(table.offered(first)).toContain(ActionType.DiscardWrit)
        expect(table.offered(second)).toContain(ActionType.FinaliseHand)
        expect(table.offered(second)).toContain(ActionType.DiscardWrit)
    })

    it('R-4.4-H1 a seat’s at-will window closes when it finalises, the others’ stay open', () => {
        const table = tableAtHandSelection()
        const [first, second] = table.order
        holdWrit(table, first)
        holdWrit(table, second)

        finalise(table, second)

        expect(table.offered(second).filter((type) => AtWillTypes.includes(type))).toEqual([])
        expect(table.offered(second)).toEqual([ActionType.DiscardWrit])
        expect(atWillWindow(table.hydrated(), second)).toBeUndefined()
        expect(atWillWindow(table.hydrated(), first)).toBe('hand-selection')
    })

    it('R-4.4-H5 a discard leaves the seat selecting', () => {
        const table = tableAtHandSelection()
        const [first] = table.order
        holdWrit(table, first)
        const writId = table.seat(first).writs?.[0]

        table.send(first, { type: ActionType.DiscardWrit, writId, ...AnyTime })

        expect(table.state.machineState).toBe(MachineState.SelectingHands)
        expect(table.state.flow.selection).toEqual({ finalised: [] })
        expect(table.state.activePlayerIds).toEqual(table.order)
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
        expect(cardTurnSeat(table.hydrated())).toBe(starting)
        expect(table.state.flow.turn).toEqual({ secondCard: false, followUps: [] })
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
            giveCardTurn(state, second, { secondCard: true })
            return MachineState.SelectingHands
        })

        finalise(table, second)

        expect(cardTurnSeat(table.hydrated())).toBe(first)
        expect(table.state.flow.turn).toEqual({ secondCard: false, followUps: [] })
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

const Writs = [ShillingMandate, VesselMandate, FarmerMandate, KnightMandate]

/** Each seat, in turn order, holds these cards; the first is on turn. `sulfurSeats` paid the pouch. */
function dealt(hands: ActionCardKind[][], sulfurSeats: readonly number[] = []): Table {
    const table = tableAtPlayingCards(() => ({ cards: ['move'] }), hands.length)
    table.moveTo((state) => {
        table.order.forEach((playerId, seat) => {
            const player = state.getPlayerState(playerId)
            player.hand = [...hands[seat]]
            player.handCount = hands[seat].length
            if (sulfurSeats.includes(seat)) {
                player.goods.sulfur -= 1
                player.pouch = 'sulfur'
            }
        })
        return MachineState.PlayingCards
    })
    return table
}

function forfeit(table: Table, playerId: string, kind: ActionCardKind, secondCard?: true) {
    return table.send(playerId, {
        type: ActionType.ForfeitCard,
        kind,
        ...(secondCard ? { secondCard } : {})
    })
}

/** The seat holds this many writs off the deck, past the turn it is on. */
function holdWrits(table: Table, playerId: string, count = 4) {
    table.moveTo((state) => {
        for (const writId of Writs.slice(0, count)) {
            holdDeckWrit(state, playerId, writId)
        }
        return state.machineState
    })
}

/** R-3.10 The seat rules an outpost, so Explore draws for it. */
function ruleOutpost(table: Table, playerId: string) {
    table.moveTo((state) => {
        const space = state.spaces['space.forest.1']
        showLocation(state, 'space.forest.1', 'outpost')
        space.ruler = { playerId, subject: false }
        state.getPlayerState(playerId).influenceSupply -= 1
        state.recomputeRanks()
        return state.machineState
    })
}

describe('R-3.2-H2 AdvanceTurn', () => {
    it('R-3.2-H2 a card with nothing left ends the turn by itself, as a System Action', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['move', 'tax'] }))
        const [first, second] = table.order

        const processed = forfeit(table, first, 'move')

        expect(processed.map((action) => action.type)).toEqual([
            ActionType.ForfeitCard,
            ActionType.AdvanceTurn
        ])
        expect(isAdvanceTurn(processed[1])).toBe(true)
        expect(processed[1].source).toBe(ActionSource.System)
        expect(processed[1].revealsInfo).toBeFalsy()
        expect(processed[1]).toMatchObject({
            metadata: { outcome: 'next-seat', turnPlayerId: second }
        })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(cardTurnSeat(table.hydrated())).toBe(second)
        expect(table.state.flow.turn).toEqual({ secondCard: false, followUps: [] })
        expect(table.asked).toBe(second)
    })

    it('R-3.2 passes one card at a time, clockwise from the starting player', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['move', 'tax'] }))
        const order = [...table.order]
        const asked: string[] = []
        for (const kind of ['move', 'tax'] as const) {
            for (let seat = 0; seat < order.length; seat += 1) {
                asked.push(table.asked)
                forfeit(table, table.asked, kind)
            }
        }
        expect(asked).toEqual([...order, ...order])
    })

    it('R-3.2-H1 a seat with no cards is skipped; one with more keeps playing', () => {
        const table = dealt([['move', 'tax', 'guild'], ['move'], ['move']])
        const [first, second, third] = table.order
        const asked: string[] = []
        while (table.state.machineState === MachineState.PlayingCards) {
            asked.push(table.asked)
            const [kind] = table.seat(table.asked).hand ?? []
            forfeit(table, table.asked, kind)
        }
        expect(asked).toEqual([first, second, third, first, first])
    })

    it('R-3.2-H1 a Defend flipped out of turn that empties a hand skips that seat', () => {
        const combat = tableAtCombat(['defend'], ['conquer', 'tax', 'guild'])
        const { table, attackerId, defenderId } = combat
        conquer(combat, PawnOf(defenderId))
        answer(combat, true)
        commit(combat)

        expect(table.seat(defenderId).handCount).toBe(0)
        expect(table.asked).not.toBe(attackerId)
        expect(table.asked).not.toBe(defenderId)
    })
})

describe('R-3.3-H1 a declared second card (S12)', () => {
    const withSulfur = () =>
        dealt(
            [
                ['move', 'tax'],
                ['move', 'tax'],
                ['move', 'tax']
            ],
            [0]
        )

    it('R-3.3-H1 the same seat plays again, then the turn passes', () => {
        const table = withSulfur()
        const [first, second] = table.order

        const processed = forfeit(table, first, 'tax', true)

        expect(processed[1]).toMatchObject({
            metadata: { outcome: 'second-card', turnPlayerId: first }
        })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(first)
        expect(table.state.flow.turn?.secondCard).toBe(true)
        expect(table.seat(first).sequentialUsed).toBe(true)
        expect(table.hydrated().turnManager.currentTurn()?.playerId).toBe(first)

        forfeit(table, first, 'move')

        expect(table.asked).toBe(second)
        expect(table.state.flow.turn?.secondCard).toBe(false)
    })

    it('R-4.4.4, R-3.3-H1 a keep over the limit asks for the discard before the second card', () => {
        const table = dealt([['explore', 'migrate', 'guild'], ['tax']], [0])
        const playerId = table.asked
        holdWrits(table, playerId, 3)
        ruleOutpost(table, playerId)

        table.send(playerId, { type: ActionType.Explore, revealsInfo: true, secondCard: true })
        const [kept] = table.hydrated().flow.writDraw?.drawn ?? []
        table.send(playerId, { type: ActionType.KeepWrits, keep: [kept] })

        expect(table.seat(playerId).writCount).toBe(4)
        expect(table.state.machineState).toBe(MachineState.DiscardingWrits)
        expect(table.asked).toBe(playerId)

        table.send(playerId, { type: ActionType.DiscardWrit, writId: kept, ...AnyTime })

        expect(table.seat(playerId).writCount).toBe(3)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(playerId)
        expect(table.state.flow.turn?.secondCard).toBe(true)
    })
})

describe('R-4.4.4, R-3.2-H2 the writ limit (S52)', () => {
    const atLimit = (count = 4) => {
        const table = tableAtPlayingCards(() => ({ cards: ['move', 'tax'] }))
        const playerId = table.asked
        holdWrits(table, playerId, count)
        return { table, playerId, next: table.order[1] }
    }

    it('R-4.4.4 a seat holding 3 ends its turn', () => {
        const { table, playerId, next } = atLimit(3)
        forfeit(table, playerId, 'move')
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(next)
    })

    it('R-4.4.4 ending a card holding 4 opens the limit before the turn passes', () => {
        const { table, playerId, next } = atLimit()

        const processed = forfeit(table, playerId, 'move')

        expect(typesOf(processed)).not.toContain(ActionType.AdvanceTurn)
        expect(table.state.machineState).toBe(MachineState.DiscardingWrits)
        expect(table.asked).toBe(playerId)
        expect(cardTurnSeat(table.hydrated())).toBe(playerId)
        expect(table.offered(playerId)).toContain(ActionType.DiscardWrit)
        expect(table.offered(next)).toEqual([])
    })

    it('R-4.4.4 a discard shows, goes under, and the turn passes', () => {
        const { table, playerId, next } = atLimit()
        forfeit(table, playerId, 'move')

        const processed = table.send(playerId, {
            type: ActionType.DiscardWrit,
            writId: VesselMandate,
            ...AnyTime
        })

        expect(processed.map((action) => action.type)).toEqual([
            ActionType.DiscardWrit,
            ActionType.AdvanceTurn
        ])
        expect(table.seat(playerId).writCount).toBe(3)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(next)
    })

    it('R-4.4.4 a mandate played counts toward the 3', () => {
        const { table, playerId, next } = atLimit()
        forfeit(table, playerId, 'move')
        table.moveTo((state) => {
            giveGood(state, playerId, 'food')
            return state.machineState
        })

        table.send(playerId, {
            type: ActionType.PlayMandate,
            writId: ShillingMandate,
            alternative: alternativeOf(ShillingMandate, 1)
        })

        expect(table.seat(playerId).writCount).toBe(3)
        expect(table.asked).toBe(next)
    })

    it('R-4.4.4 it holds until 3, however many over', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['move', 'tax'] }))
        const playerId = table.asked
        holdWrits(table, playerId)
        table.moveTo((state) => {
            holdDeckWrit(state, playerId, Weapon)
            return state.machineState
        })
        forfeit(table, playerId, 'move')

        table.send(playerId, { type: ActionType.DiscardWrit, writId: Weapon, ...AnyTime })
        expect(table.state.machineState).toBe(MachineState.DiscardingWrits)
        expect(table.asked).toBe(playerId)

        table.send(playerId, { type: ActionType.DiscardWrit, writId: VesselMandate, ...AnyTime })
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).not.toBe(playerId)
    })

    it('R-4.4.4, R-4.4-H9 a seat off its turn over the limit is asked before play goes on; the turn stays', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['move', 'tax'] }))
        const [first, second] = table.order
        holdWrits(table, second)

        const processed = forfeit(table, first, 'move')

        expect(typesOf(processed)).not.toContain(ActionType.AdvanceTurn)
        expect(table.state.machineState).toBe(MachineState.DiscardingWrits)
        expect(table.asked).toBe(second)
        expect(cardTurnSeat(table.hydrated())).toBe(first)
        expect(table.offered(second)).toEqual([ActionType.DiscardWrit])
        expect(table.offered(first)).toEqual([])

        const discarded = table.send(second, {
            type: ActionType.DiscardWrit,
            writId: VesselMandate,
            ...AnyTime
        })

        expect(typesOf(discarded)).toEqual([ActionType.DiscardWrit, ActionType.AdvanceTurn])
        expect(table.seat(second).writCount).toBe(3)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(second)
        expect(table.offered(second)).toContain(ActionType.ForfeitCard)
    })

    it('R-4.4.4, R-3.2-H1 a seat with no card left is asked too', () => {
        const table = dealt([['move'], []])
        const [first, second] = table.order
        holdWrits(table, second)

        forfeit(table, first, 'move')

        expect(table.state.machineState).toBe(MachineState.DiscardingWrits)
        expect(table.asked).toBe(second)

        const discarded = table.send(second, {
            type: ActionType.DiscardWrit,
            writId: VesselMandate,
            ...AnyTime
        })

        expect(table.seat(second).writCount).toBe(3)
        expect(typesOf(discarded)).toContain(ActionType.NourishPawns)
    })

    it('R-4.4.1, R-4.4.4 a keep over the limit asks for the discard before the card goes on', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['explore', 'migrate', 'guild'] }))
        const playerId = table.asked
        holdWrits(table, playerId, 3)
        ruleOutpost(table, playerId)
        table.send(playerId, { type: ActionType.Explore, revealsInfo: true })
        table.moveTo((state, context) => {
            queueFollowUp(state, { kind: 'military' })
            return stateAfterCardStep(context)
        })
        const [kept] = table.hydrated().flow.writDraw?.drawn ?? []

        table.send(playerId, { type: ActionType.KeepWrits, keep: [kept] })
        expect(table.seat(playerId).writCount).toBe(4)
        expect(table.state.machineState).toBe(MachineState.DiscardingWrits)
        expect(table.asked).toBe(playerId)

        table.send(playerId, { type: ActionType.DiscardWrit, writId: kept, ...AnyTime })
        expect(table.state.machineState).toBe(MachineState.PlacingDisc)
    })
})

describe('R-3.2 the last card goes to Nourishing', () => {
    it('R-3.2, R-4.10 the turn closes and the game feeds the seats', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['move'] }), 3)
        const [first, second, third] = table.order
        forfeit(table, first, 'move')
        forfeit(table, second, 'move')

        const processed = forfeit(table, third, 'move')

        expect(processed[1]).toMatchObject({ metadata: { outcome: 'last-card' } })
        expect(processed[1]).not.toHaveProperty('metadata.turnPlayerId')
        expect(processed[2].type).toBe(ActionType.NourishPawns)
        expect(table.state.flow.turn).toBeUndefined()
        expect(table.hydrated().turnManager.currentTurn()).toBeUndefined()
    })

    it('R-4.4.4 a seat over the limit at the round’s last card discards before the round ends', () => {
        const table = tableAtPlayingCards(() => ({ cards: ['move'] }), 2)
        const [first, second] = table.order
        forfeit(table, first, 'move')
        holdWrits(table, second)

        forfeit(table, second, 'move')
        expect(table.state.machineState).toBe(MachineState.DiscardingWrits)
        expect(table.asked).toBe(second)

        const processed = table.send(second, {
            type: ActionType.DiscardWrit,
            writId: VesselMandate,
            ...AnyTime
        })
        expect(typesOf(processed)).toContain(ActionType.NourishPawns)
    })

    it('R-3.3-H1 a second card as the round’s last card ends it the same way', () => {
        const table = dealt([['move', 'tax'], []], [0])
        const [first] = table.order
        forfeit(table, first, 'move', true)
        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(typesOf(forfeit(table, first, 'tax'))).toContain(ActionType.NourishPawns)
    })
})
