import { ActionSource } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import type { HydratedFeudumGameState } from '../model/gameState.js'
import { playOutCards } from '../testing/roundEnd.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { isStartRound } from './startRound.js'

/** R-2.2 The round plays out to its real end, `edit` setting its traces before the cards run out. */
function startNextRound(table: Table, edit: (state: HydratedFeudumGameState) => void = () => {}) {
    table.moveTo((state) => {
        edit(state)
        return MachineState.PlayingCards
    })
    return playOutCards(table).filter((action) => isStartRound(action))
}

/** R-4.10.2 A barrel sulfur stands on the pawn: it leaves the personal supply, keeping totals. */
function wineOnPawn(state: HydratedFeudumGameState, playerId: string, wine: 'fed' | 'drunk') {
    const player = state.getPlayerState(playerId)
    player.goods.sulfur -= 1
    player.pawns[0].wine = wine
}

describe('StartRound', () => {
    it('R-2.2 the round manager advances: round 2 after round 1', () => {
        const table = tableAtPlayingCards()
        expect(table.hydrated().roundManager.currentRound?.number).toBe(1)

        const [action] = startNextRound(table)

        expect(table.state.roundManager.series.map((round) => round.number)).toEqual([1, 2])
        expect(table.hydrated().roundManager.currentRound?.number).toBe(2)
        expect(action).toMatchObject({ metadata: { round: 2 } })
    })

    it('R-3.1-H1 the selection starts over with every seat yet to finalise, from the new first seat', () => {
        const table = tableAtPlayingCards()
        const [first, second, ...rest] = table.order

        startNextRound(table)

        expect(table.state.machineState).toBe(MachineState.SelectingHands)
        expect(table.state.flow.selection).toEqual({ finalised: [] })
        expect(table.state.activePlayerIds).toEqual([second, ...rest, first])
    })

    it('R-4.10.2 fed wine turns drunk, for the round, and is named in metadata', () => {
        const table = tableAtPlayingCards()
        const [first, second] = table.order

        const [action] = startNextRound(table, (state) => {
            wineOnPawn(state, first, 'fed')
        })

        expect(table.seat(first).pawns[0].wine).toBe('drunk')
        expect(table.seat(second).pawns[0].wine).toBeUndefined()
        expect(action).toMatchObject({ metadata: { drunk: [{ playerId: first, n: 1 }] } })
    })

    it('R-4.10.2 a pawn drunk this round has sobered by now, so is not named; the list is empty', () => {
        const table = tableAtPlayingCards()
        const [first] = table.order

        const [action] = startNextRound(table, (state) => {
            wineOnPawn(state, first, 'drunk')
        })

        expect(table.seat(first).pawns[0].wine).toBeUndefined()
        expect(action).toMatchObject({ metadata: { drunk: [] } })
    })

    it('R-3.3 the pouch was paid at the round’s end, before this', () => {
        const table = tableAtPlayingCards(() => ({
            cards: ['move', 'tax', 'guild', 'explore'],
            pouchGood: 'sulfur'
        }))
        const [first] = table.order
        expect(table.seat(first).pouch).toBe('sulfur')
        startNextRound(table)
        expect(table.seat(first).pouch).toBeUndefined()
    })

    it('R-2.2 marks the hand selection phase', () => {
        const table = tableAtPlayingCards()
        startNextRound(table)
        expect(table.hydrated().phaseManager.currentPhase?.name).toBe(PhaseName.HandSelection)
        expect(table.state.phaseManager.series.map((phase) => phase.name)).toEqual([
            PhaseName.Setup,
            PhaseName.HandSelection,
            PhaseName.Cards,
            PhaseName.Nourish,
            PhaseName.Progress,
            PhaseName.HandSelection
        ])
    })

    it('R-X.2 is a System Action, not a barrier, and a seat cannot send it', () => {
        const table = tableAtPlayingCards()
        const [first] = table.order
        const before = table.state
        expect(() => table.send(first, { type: ActionType.StartRound })).toThrow()
        expect(table.state).toBe(before)

        const [action] = startNextRound(table)

        expect(isStartRound(action)).toBe(true)
        expect(action.source).toBe(ActionSource.System)
        expect(action.revealsInfo).toBeFalsy()
        expect(table.offered(first)).not.toContain(ActionType.StartRound)
    })

    it('R-3.1-H1, R-3.2 the next round runs as the first, from its own starting player', () => {
        const table = tableAtPlayingCards()
        const [first, second, ...rest] = table.order
        startNextRound(table)

        for (const playerId of [second, ...rest, first]) {
            expect(table.asked).toBe(playerId)
            table.send(playerId, {
                type: ActionType.FinaliseHand,
                revealsInfo: true,
                cards: ['move', 'tax', 'guild', 'explore']
            })
        }

        expect(table.state.machineState).toBe(MachineState.PlayingCards)
        expect(table.asked).toBe(second)
        expect(table.seat(second).handCount).toBe(4)
    })
})
