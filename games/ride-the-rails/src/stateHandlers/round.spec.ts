import { ActionSource, assertExists, type GameAction } from '@tabletop/common'
import { describe, expect, it } from 'vitest'
import type { HexId } from '../data/hexes.js'
import { isEndRound } from '../actions/endRound.js'
import { ActionType } from '../definition/actions.js'
import { PhaseName } from '../definition/phases.js'
import { MachineState } from '../definition/states.js'
import type { RideTheRailsGameState } from '../model/gameState.js'
import { legalPlacements } from '../rules/placement.js'
import { createGame, engine, hydrated, masterSeed } from '../testing/fixtures.js'
import { offersByPlayer } from '../testing/offers.js'

const NEW_YORK: HexId = 'hex.usa.6-60'
const BETWEEN_NEW_YORK_AND_PHILADELPHIA: HexId = 'hex.usa.6-58'
const PHILADELPHIA: HexId = 'hex.usa.7-57'

const NEW_YORK_TO_PHILADELPHIA = {
    railroadId: 'railroad.red',
    hexIds: [NEW_YORK, BETWEEN_NEW_YORK_AND_PHILADELPHIA, PHILADELPHIA]
}
const PHILADELPHIA_TO_NEW_YORK = {
    ...NEW_YORK_TO_PHILADELPHIA,
    hexIds: NEW_YORK_TO_PHILADELPHIA.hexIds.toReversed()
}

type UserInput = Omit<GameAction, 'id' | 'gameId' | 'source'> & Record<string, unknown>

class Table {
    readonly game = createGame(3)
    readonly history: GameAction[] = []
    state: RideTheRailsGameState

    constructor() {
        this.state = engine.startGame(this.game, {
            masterSeed,
            startingPositions: { playerIds: ['p1', 'p2', 'p3'] }
        }).initialState
    }

    act(input: UserInput): string[] {
        const action = {
            id: `a${this.state.actionCount}`,
            gameId: this.state.gameId,
            source: ActionSource.User,
            ...input
        }
        const result = engine.executeCanonicalAction({
            game: this.game,
            state: this.state,
            action
        })
        this.history.push(...result.processedActions)
        this.state = result.updatedState
        return result.processedActions.map((processed) => processed.type)
    }

    // Each handler offers its actions to the deciding player only.
    expectOffers(playerId: string, types: string[]) {
        const offers = offersByPlayer(this.state)
        const expected = Object.fromEntries(
            Object.keys(offers).map((other) => [other, other === playerId ? types : []])
        )
        expect(offers).toEqual(expected)
        expect(this.state.activePlayerIds).toEqual([playerId])
    }
}

describe('one whole round through the engine (R-2.1, R-2.2)', () => {
    const table = new Table()
    const share = (playerId: string, railroadId: string) =>
        table.act({ type: ActionType.TakeShare, playerId, railroadId })
    const place = (playerId: string, railroadId: string, hexId: HexId) =>
        table.act({ type: ActionType.PlaceLocomotive, playerId, railroadId, hexId })
    const endBuilding = (playerId: string) => table.act({ type: ActionType.EndBuilding, playerId })

    it('walks Take a Share from the last in turn order to the first', () => {
        expect(table.state.machineState).toBe(MachineState.TakingShares)
        table.expectOffers('p3', [ActionType.TakeShare])
        expect(share('p3', 'railroad.red')).toEqual([ActionType.TakeShare])
        table.expectOffers('p2', [ActionType.TakeShare])
        share('p2', 'railroad.blue')
        table.expectOffers('p1', [ActionType.TakeShare])
        share('p1', 'railroad.red')
        expect(table.state.machineState).toBe(MachineState.Building)
    })

    it('walks Build from the first in turn order to the last, opening each building turn', () => {
        table.expectOffers('p1', [ActionType.PlaceLocomotive, ActionType.EndBuilding])
        expect(table.state.building).toEqual({ placed: 0, usedMountain: false })
        place('p1', 'railroad.red', NEW_YORK)
        place('p1', 'railroad.red', BETWEEN_NEW_YORK_AND_PHILADELPHIA)
        place('p1', 'railroad.red', PHILADELPHIA)
        expect(table.state.building).toEqual({ placed: 3, usedMountain: false })
        endBuilding('p1')

        table.expectOffers('p2', [ActionType.PlaceLocomotive, ActionType.EndBuilding])
        expect(table.state.building).toEqual({ placed: 0, usedMountain: false })
        const blueStart = legalPlacements(hydrated(table.state), 'p2').find(
            (placement) => placement.railroadId === 'railroad.blue'
        )
        assertExists(blueStart, 'Blue starts on the East Coast')
        place('p2', 'railroad.blue', blueStart.hexId)
        endBuilding('p2')

        table.expectOffers('p3', [ActionType.PlaceLocomotive, ActionType.EndBuilding])
        endBuilding('p3')
        expect(table.state.machineState).toBe(MachineState.Riding)
        expect(table.state.building).toBeUndefined()
    })

    it('walks Ride from first to last, passing by itself once no journey exists (R-3.3.1)', () => {
        table.expectOffers('p1', [ActionType.RideJourney])
        table.act({
            type: ActionType.RideJourney,
            playerId: 'p1',
            links: [NEW_YORK_TO_PHILADELPHIA]
        })
        table.expectOffers('p2', [ActionType.RideJourney])
        // No passenger is left with a link out, so p3 passes by itself and the round ends.
        expect(
            table.act({
                type: ActionType.RideJourney,
                playerId: 'p2',
                links: [PHILADELPHIA_TO_NEW_YORK]
            })
        ).toEqual([ActionType.RideJourney, ActionType.PassJourney, ActionType.EndRound])
        const pass = table.history.at(-2)
        expect(pass).toMatchObject({ playerId: 'p3', source: ActionSource.System })
    })

    it('runs the end of round in the cascade of the last pass and opens round 2', () => {
        const turnOrderBefore = ['p1', 'p2', 'p3']
        const endRound = table.history.at(-1)
        assertExists(endRound, 'The round ended')
        expect(isEndRound(endRound)).toBe(true)
        expect(endRound.source).toBe(ActionSource.System)

        const turnOrder = table.state.turnManager.turnOrder
        expect([...turnOrder].sort()).toEqual([...turnOrderBefore].sort())
        expect(table.state.machineState).toBe(MachineState.TakingShares)
        expect(table.state.roundManager.series.at(-1)?.number).toBe(2)
        const lastInTurnOrder = turnOrder.at(-1)
        assertExists(lastInTurnOrder, 'The turn order has players')
        table.expectOffers(lastInTurnOrder, [ActionType.TakeShare])
    })

    it('records every round and phase, so history can group by them', () => {
        const endRoundIndex = table.history.findIndex(isEndRound)
        expect(table.state.roundManager.series).toEqual([
            { type: 'round', number: 1, start: 0, end: endRoundIndex + 1 },
            { type: 'round', number: 2, start: endRoundIndex + 1 }
        ])

        const phases = table.state.phaseManager.series
        expect(phases.map((phase) => phase.name)).toEqual([
            PhaseName.TakeShare,
            PhaseName.Build,
            PhaseName.Ride,
            PhaseName.TakeShare
        ])
        expect(phases[0].start).toBe(0)
        for (const [index, phase] of phases.slice(1).entries()) {
            expect(phase.start).toBe(phases[index].end)
        }
        expect(phases[2].end).toBe(endRoundIndex + 1)
        expect(phases[3].end).toBeUndefined()
    })

    it('records one turn per player per phase, in the phase’s order (R-2.2)', () => {
        const turns = table.state.turnManager.series
        expect(turns.map((turn) => turn.playerId)).toEqual([
            ...['p3', 'p2', 'p1'],
            ...['p1', 'p2', 'p3'],
            ...['p1', 'p2', 'p3'],
            table.state.turnManager.turnOrder.at(-1)
        ])
        for (const [index, turn] of turns.slice(1).entries()) {
            expect(turn.start).toBeGreaterThanOrEqual(turns[index].end ?? Infinity)
        }
    })
})
