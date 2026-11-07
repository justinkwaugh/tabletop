import { ActionSource, Visibility } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import { ActionType } from '../definition/actions.js'
import { FeudumApiActions } from '../definition/apiActions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import { FeudumGameState, HydratedFeudumGameState } from '../model/gameState.js'
import { canonicalOf } from '../testing/state.js'
import { tableAtPlayingCards, type Table } from '../testing/table.js'
import { HydratedStartRound, isStartRound } from './startRound.js'

const actionProjector = Visibility.createActionProjector(FeudumApiActions)
const stateProjector = Visibility.createProjector(FeudumGameState)

/** Back in `SelectingHands` as the round's end leaves a table, `edit` setting the round's traces. */
function startNextRound(table: Table, edit: (state: HydratedFeudumGameState) => void = () => {}) {
    table.moveTo((state) => {
        state.flow.turn = undefined
        edit(state)
        return MachineState.SelectingHands
    })
    return table.sendSystem({ type: ActionType.StartRound })
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

        table.moveTo((state) => {
            state.roundManager.endRound(state.actionCount)
            return MachineState.PlayingCards
        })
        const [action] = startNextRound(table)

        expect(table.state.roundManager.series.map((round) => round.number)).toEqual([1, 2])
        expect(table.hydrated().roundManager.currentRound?.number).toBe(2)
        expect(action).toMatchObject({ metadata: { round: 2 } })
    })

    it('R-2.2.5 everyone takes back all action cards', () => {
        const table = tableAtPlayingCards()
        const [first, ...others] = table.order
        table.send(first, { type: ActionType.ForfeitCard, kind: 'move' })
        expect(table.seat(first).played).not.toEqual([])

        startNextRound(table)

        for (const playerId of [first, ...others]) {
            const seat = table.seat(playerId)
            expect(seat.hand).toEqual([])
            expect(seat.handCount).toBe(0)
            expect(seat.played).toEqual([])
        }
    })

    it('R-3.3, R-3.15.1, R-3.16.2, R-3.7.5 the round’s limits start over', () => {
        const table = tableAtPlayingCards()
        const [first] = table.order

        startNextRound(table, (state) => {
            const player = state.getPlayerState(first)
            player.sequentialUsed = true
            player.repeatUsed = true
            player.guildsUsed = ['farmer', 'noble']
            player.successfulMoves = 2
        })

        const seat = table.seat(first)
        expect(seat.sequentialUsed).toBe(false)
        expect(seat.repeatUsed).toBe(false)
        expect(seat.guildsUsed).toEqual([])
        expect(seat.successfulMoves).toBe(0)
    })

    it('R-3.1-H1 the selection order starts over from the first seat in turn order', () => {
        const table = tableAtPlayingCards()
        const [first, second, ...rest] = table.order

        startNextRound(table, (state) => {
            state.turnManager.turnOrder = [second, ...rest, first]
        })

        expect(table.state.machineState).toBe(MachineState.SelectingHands)
        expect(table.state.flow.selection).toEqual({ playerId: second, finalised: [] })
        expect(table.asked).toBe(second)
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

    it('R-4.10.2 a pawn already drunk is not named again; with none, the list is empty', () => {
        const table = tableAtPlayingCards()
        const [first] = table.order

        const [action] = startNextRound(table, (state) => {
            wineOnPawn(state, first, 'drunk')
        })

        expect(table.seat(first).pawns[0].wine).toBe('drunk')
        expect(action).toMatchObject({ metadata: { drunk: [] } })
    })

    it('R-3.3 leaves the pouch to the round’s end', () => {
        const table = tableAtPlayingCards(() => ({
            cards: ['move', 'tax', 'guild', 'explore'],
            pouchGood: 'sulfur'
        }))
        const [first] = table.order
        startNextRound(table)
        expect(table.seat(first).pouch).toBe('sulfur')
    })

    it('R-2.2 marks the hand selection phase', () => {
        const table = tableAtPlayingCards()
        startNextRound(table)
        expect(table.hydrated().phaseManager.currentPhase?.name).toBe(PhaseName.HandSelection)
        expect(table.state.phaseManager.series.map((phase) => phase.name)).toEqual([
            PhaseName.Setup,
            PhaseName.HandSelection,
            PhaseName.Cards,
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

    it('R-3.1, R-5.1 on a projected state another seat’s hand stays omitted', () => {
        const table = tableAtPlayingCards()
        const [first, second] = table.order
        const perspective = { kind: 'player', playerId: second } as const
        const state = new HydratedFeudumGameState(
            stateProjector.project(canonicalOf(table.hydrated()), perspective, { config: {} })
        )
        const action = new HydratedStartRound({
            id: 'round',
            gameId: table.game.id,
            source: ActionSource.System,
            type: ActionType.StartRound
        })

        action.apply(state)

        expect(state.getPlayerState(first)).not.toHaveProperty('hand')
        expect(state.getPlayerState(first).handCount).toBe(0)
        expect(state.getPlayerState(second).hand).toEqual([])
        expect(
            actionProjector.project(action.dehydrate(), perspective, { config: {} })
        ).toMatchObject({ metadata: action.metadata })
    })

    it('R-3.1-H1, R-3.2 the next round runs as the first, from its own starting player', () => {
        const table = tableAtPlayingCards()
        const [first, second, ...rest] = table.order
        startNextRound(table, (state) => {
            state.turnManager.turnOrder = [second, ...rest, first]
        })

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
